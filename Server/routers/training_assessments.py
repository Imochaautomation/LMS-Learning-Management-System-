"""
AI-generated training assessment routes.

POST   /training/assessments/generate     — manager: generate assessment via AI
GET    /training/assessments              — manager: list assessments they created
GET    /training/assessments/mine         — new joiner: their assessments
GET    /training/assessments/{id}         — detail (with questions, no correct_answer exposed to joiner)
POST   /training/assessments/{id}/start   — new joiner starts attempt
POST   /training/assessments/{id}/submit  — new joiner submits answers → AI evaluates
GET    /training/assessments/{id}/attempts — list all attempts (manager)
GET    /training/attempts/{attempt_id}    — attempt detail with per-answer flags
"""

import json
import re
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import SessionLocal
from auth import require_role
from models import User, SmeKit, SmeKitFileV2, TrainingAssessment, TrainingQuestion, TrainingAttempt, TrainingAnswer
from schemas import (
    GenerateAssessmentRequest, TrainingAssessmentOut, TrainingQuestionOut,
    SubmitAttemptRequest, TrainingAttemptOut,
)
from config import OPENROUTER_API_KEY, MODEL_NAME

router = APIRouter(prefix="/api/training", tags=["training-assessments"])

import httpx


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── AI helpers ───────────────────────────────────────────────────────────────

def _call_ai(prompt: str) -> str:
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }
    body = {
        "model": MODEL_NAME,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3,
    }
    with httpx.Client(timeout=120) as client:
        r = client.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=body)
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip()


def _extract_json(text: str) -> any:
    cleaned = re.sub(r"^```(?:json)?\s*", "", text.strip())
    cleaned = re.sub(r"\s*```$", "", cleaned.strip())
    return json.loads(cleaned)


def _build_content_context(files: List[SmeKitFileV2]) -> str:
    parts = []
    for f in files:
        if f.transcript:
            parts.append(f"[{f.name}]\n{f.transcript[:3000]}")
        elif f.youtube_url:
            parts.append(f"[YouTube: {f.name}] URL: {f.youtube_url} (no transcript provided)")
        else:
            parts.append(f"[Document: {f.name}] (file uploaded, no text extracted)")
    return "\n\n---\n\n".join(parts) if parts else "No content available."


def _generate_questions(content: str, mcq_count: int, written_count: int) -> List[dict]:
    prompt = f"""You are an expert trainer creating an assessment based on learning materials.

CONTENT:
{content[:8000]}

Generate exactly {mcq_count} MCQ questions and {written_count} written/open-ended questions.

Return ONLY valid JSON in this exact format (no explanation, no markdown):
{{
  "questions": [
    {{
      "order_index": 1,
      "question_type": "mcq",
      "question_text": "...",
      "options": ["A. option1", "B. option2", "C. option3", "D. option4"],
      "correct_answer": "A"
    }},
    {{
      "order_index": 2,
      "question_type": "written",
      "question_text": "...",
      "options": null,
      "correct_answer": "Model answer: ..."
    }}
  ]
}}

Rules:
- MCQ must have exactly 4 options labeled A-D
- correct_answer for MCQ is the letter (A/B/C/D)
- correct_answer for written is a model answer starting with "Model answer:"
- Questions must be based on the provided content
- Number questions sequentially starting from 1, MCQs first then written"""

    raw = _call_ai(prompt)
    data = _extract_json(raw)
    return data.get("questions", [])


def _evaluate_attempt(questions: List[TrainingQuestion], answers: List[dict]) -> dict:
    qa_pairs = []
    answer_map = {a["question_id"]: a["answer_text"] for a in answers}
    for q in questions:
        qa_pairs.append({
            "question_id": q.id,
            "question_type": q.question_type,
            "question_text": q.question_text,
            "options": q.options,
            "correct_answer": q.correct_answer,
            "user_answer": answer_map.get(q.id, ""),
        })

    prompt = f"""You are evaluating a training assessment submission.

Questions and answers:
{json.dumps(qa_pairs, indent=2)}

For each question, evaluate the user's answer.

Return ONLY valid JSON (no markdown, no explanation):
{{
  "evaluations": [
    {{
      "question_id": 1,
      "is_correct": true,
      "ai_flag": "correct",
      "ai_explanation": "Brief explanation"
    }}
  ],
  "overall_feedback": "2-3 sentences of overall feedback on the submission",
  "score": 75.0
}}

Rules:
- ai_flag must be "correct", "wrong", or "partial"
- MCQ: correct only if exact letter match (case-insensitive)
- Written: partial credit allowed; use your judgment based on the model answer
- score = (correct_count + 0.5 * partial_count) / total * 100, rounded to 1 decimal
- Be constructive in explanations"""

    raw = _call_ai(prompt)
    return _extract_json(raw)


# ── Serialisers ──────────────────────────────────────────────────────────────

def _assessment_out(a: TrainingAssessment, include_questions=False, for_joiner=False) -> dict:
    d = {
        "id": a.id,
        "title": a.title,
        "new_joiner_id": a.new_joiner_id,
        "created_by": a.created_by,
        "sme_kit_id": a.sme_kit_id,
        "source_file_ids": a.source_file_ids or [],
        "total_questions": a.total_questions,
        "mcq_count": a.mcq_count,
        "written_count": a.written_count,
        "pass_threshold": a.pass_threshold,
        "status": a.status,
        "created_at": a.created_at,
        "new_joiner_name": a.new_joiner.name if a.new_joiner else None,
        "creator_name": a.creator.name if a.creator else None,
        "kit_name": a.kit.name if a.kit else None,
    }
    if include_questions:
        qs = []
        for q in sorted(a.questions, key=lambda x: x.order_index):
            qd = {
                "id": q.id,
                "assessment_id": q.assessment_id,
                "order_index": q.order_index,
                "question_type": q.question_type,
                "question_text": q.question_text,
                "options": q.options,
            }
            if not for_joiner:
                qd["correct_answer"] = q.correct_answer
            qs.append(qd)
        d["questions"] = qs
    return d


def _attempt_out(attempt: TrainingAttempt) -> dict:
    return {
        "id": attempt.id,
        "assessment_id": attempt.assessment_id,
        "user_id": attempt.user_id,
        "attempt_number": attempt.attempt_number,
        "status": attempt.status,
        "score": attempt.score,
        "passed": attempt.passed,
        "trophy_awarded": attempt.trophy_awarded,
        "ai_feedback": attempt.ai_feedback,
        "submitted_at": attempt.submitted_at,
        "evaluated_at": attempt.evaluated_at,
        "created_at": attempt.created_at,
        "answers": [
            {
                "id": ans.id,
                "question_id": ans.question_id,
                "answer_text": ans.answer_text,
                "is_correct": ans.is_correct,
                "ai_flag": ans.ai_flag,
                "ai_explanation": ans.ai_explanation,
            }
            for ans in attempt.answers
        ],
    }


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/assessments/generate", response_model=dict)
def generate_assessment(
    payload: GenerateAssessmentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager", "admin")),
):
    kit = db.query(SmeKit).filter(SmeKit.id == payload.sme_kit_id).first()
    if not kit:
        raise HTTPException(404, "SME Kit not found")

    joiner = db.query(User).filter(User.id == payload.new_joiner_id).first()
    if not joiner:
        raise HTTPException(404, "New joiner not found")

    files = db.query(SmeKitFileV2).filter(
        SmeKitFileV2.id.in_(payload.source_file_ids),
        SmeKitFileV2.sme_kit_id == payload.sme_kit_id,
    ).all()
    if not files:
        raise HTTPException(400, "No valid files found in kit for given IDs")

    content = _build_content_context(files)
    questions_data = _generate_questions(content, payload.mcq_count, payload.written_count)

    assessment = TrainingAssessment(
        title=payload.title,
        new_joiner_id=payload.new_joiner_id,
        created_by=current_user.id,
        sme_kit_id=payload.sme_kit_id,
        source_file_ids=payload.source_file_ids,
        total_questions=payload.mcq_count + payload.written_count,
        mcq_count=payload.mcq_count,
        written_count=payload.written_count,
        pass_threshold=payload.pass_threshold,
        status="active",
    )
    db.add(assessment)
    db.flush()

    for qd in questions_data:
        q = TrainingQuestion(
            assessment_id=assessment.id,
            order_index=qd.get("order_index", 0),
            question_type=qd.get("question_type", "written"),
            question_text=qd.get("question_text", ""),
            options=qd.get("options"),
            correct_answer=qd.get("correct_answer"),
        )
        db.add(q)

    db.commit()
    db.refresh(assessment)
    return _assessment_out(assessment, include_questions=True, for_joiner=False)


@router.get("/assessments", response_model=List[dict])
def list_assessments_manager(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager", "admin")),
):
    q = db.query(TrainingAssessment)
    if current_user.role == "manager":
        q = q.filter(TrainingAssessment.created_by == current_user.id)
    assessments = q.order_by(TrainingAssessment.created_at.desc()).all()
    return [_assessment_out(a) for a in assessments]


@router.get("/assessments/mine", response_model=List[dict])
def list_assessments_joiner(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("new_joiner")),
):
    assessments = (
        db.query(TrainingAssessment)
        .filter(
            TrainingAssessment.new_joiner_id == current_user.id,
            TrainingAssessment.status == "active",
        )
        .order_by(TrainingAssessment.created_at.desc())
        .all()
    )
    result = []
    for a in assessments:
        d = _assessment_out(a)
        attempts = db.query(TrainingAttempt).filter(
            TrainingAttempt.assessment_id == a.id,
            TrainingAttempt.user_id == current_user.id,
        ).all()
        d["attempt_count"] = len(attempts)
        d["best_score"] = max((at.score for at in attempts if at.score is not None), default=None)
        d["passed"] = any(at.passed for at in attempts)
        result.append(d)
    return result


@router.get("/assessments/{assessment_id}", response_model=dict)
def get_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager", "admin", "new_joiner")),
):
    a = db.query(TrainingAssessment).filter(TrainingAssessment.id == assessment_id).first()
    if not a:
        raise HTTPException(404, "Assessment not found")
    is_joiner = current_user.role == "new_joiner"
    if is_joiner and a.new_joiner_id != current_user.id:
        raise HTTPException(403, "Not your assessment")
    return _assessment_out(a, include_questions=True, for_joiner=is_joiner)


@router.post("/assessments/{assessment_id}/start", response_model=dict)
def start_attempt(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("new_joiner")),
):
    a = db.query(TrainingAssessment).filter(TrainingAssessment.id == assessment_id).first()
    if not a or a.new_joiner_id != current_user.id:
        raise HTTPException(404, "Assessment not found")
    if a.status != "active":
        raise HTTPException(400, "Assessment is not active")

    in_progress = db.query(TrainingAttempt).filter(
        TrainingAttempt.assessment_id == assessment_id,
        TrainingAttempt.user_id == current_user.id,
        TrainingAttempt.status == "in_progress",
    ).first()
    if in_progress:
        return _attempt_out(in_progress)

    attempt_number = db.query(TrainingAttempt).filter(
        TrainingAttempt.assessment_id == assessment_id,
        TrainingAttempt.user_id == current_user.id,
    ).count() + 1

    attempt = TrainingAttempt(
        assessment_id=assessment_id,
        user_id=current_user.id,
        attempt_number=attempt_number,
        status="in_progress",
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return _attempt_out(attempt)


@router.post("/assessments/{assessment_id}/submit", response_model=dict)
def submit_attempt(
    assessment_id: int,
    payload: SubmitAttemptRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("new_joiner")),
):
    a = db.query(TrainingAssessment).filter(TrainingAssessment.id == assessment_id).first()
    if not a or a.new_joiner_id != current_user.id:
        raise HTTPException(404, "Assessment not found")

    attempt = db.query(TrainingAttempt).filter(
        TrainingAttempt.assessment_id == assessment_id,
        TrainingAttempt.user_id == current_user.id,
        TrainingAttempt.status == "in_progress",
    ).first()
    if not attempt:
        raise HTTPException(400, "No in-progress attempt found. Start the assessment first.")

    attempt.status = "submitted"
    attempt.submitted_at = datetime.utcnow()
    db.commit()

    questions = sorted(a.questions, key=lambda x: x.order_index)
    answers_input = payload.answers

    try:
        evaluation = _evaluate_attempt(questions, answers_input)
        evals = {e["question_id"]: e for e in evaluation.get("evaluations", [])}
        score = float(evaluation.get("score", 0.0))
        overall_feedback = evaluation.get("overall_feedback", "")
    except Exception as exc:
        score = 0.0
        overall_feedback = "Evaluation could not be completed automatically."
        evals = {}

    for ans_data in answers_input:
        qid = ans_data.get("question_id")
        ev = evals.get(qid, {})
        answer = TrainingAnswer(
            attempt_id=attempt.id,
            question_id=qid,
            answer_text=ans_data.get("answer_text", ""),
            is_correct=ev.get("is_correct"),
            ai_flag=ev.get("ai_flag"),
            ai_explanation=ev.get("ai_explanation"),
        )
        db.add(answer)

    passed = score >= a.pass_threshold
    attempt.score = score
    attempt.passed = passed
    attempt.trophy_awarded = passed
    attempt.ai_feedback = {"overall": overall_feedback}
    attempt.status = "evaluated"
    attempt.evaluated_at = datetime.utcnow()
    db.commit()
    db.refresh(attempt)
    return _attempt_out(attempt)


@router.get("/assessments/{assessment_id}/attempts", response_model=List[dict])
def list_attempts(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager", "admin", "new_joiner")),
):
    a = db.query(TrainingAssessment).filter(TrainingAssessment.id == assessment_id).first()
    if not a:
        raise HTTPException(404, "Assessment not found")
    if current_user.role == "new_joiner" and a.new_joiner_id != current_user.id:
        raise HTTPException(403, "Not your assessment")

    attempts = db.query(TrainingAttempt).filter(
        TrainingAttempt.assessment_id == assessment_id,
    ).order_by(TrainingAttempt.attempt_number.desc()).all()
    return [_attempt_out(at) for at in attempts]


@router.get("/attempts/{attempt_id}", response_model=dict)
def get_attempt(
    attempt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager", "admin", "new_joiner")),
):
    attempt = db.query(TrainingAttempt).filter(TrainingAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(404, "Attempt not found")
    if current_user.role == "new_joiner" and attempt.user_id != current_user.id:
        raise HTTPException(403, "Not your attempt")
    return _attempt_out(attempt)

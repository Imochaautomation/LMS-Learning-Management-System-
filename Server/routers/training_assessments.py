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

import io
import json
import re
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
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


def _generate_questions(
    content: str,
    easy_count: int, easy_type: str,
    medium_count: int, medium_type: str,
    hard_count: int, hard_type: str,
) -> List[dict]:
    total = easy_count + medium_count + hard_count

    def _type_label(t: str) -> str:
        return "MCQ" if t == "mcq" else "Descriptive (open-ended, no options)"

    def _type_rule(difficulty: str, t: str) -> str:
        if difficulty == "Easy":
            lang_note = " Write in plain, simple language (CEFR A2-B1 level): short sentences, common vocabulary, no jargon. Uniformly simple — context, logic, AND wording must all be easy."
        elif difficulty == "Medium":
            lang_note = " Use clear professional language (CEFR B1-B2 level): straightforward sentences, standard industry terms where needed."
        else:
            lang_note = " Language may be more complex (CEFR B2-C1 level) to match the depth of the concept being tested."

        if t == "mcq":
            return f"{'Easy' if difficulty == 'Easy' else difficulty} questions test {'direct recall of specific facts' if difficulty == 'Easy' else ('understanding of concepts' if difficulty == 'Medium' else 'analysis and application of concepts')} from the content. Use MCQ format (4 options A/B/C/D).{lang_note}"
        else:
            return f"{'Easy' if difficulty == 'Easy' else difficulty} questions test {'direct recall of specific facts' if difficulty == 'Easy' else ('application of concepts' if difficulty == 'Medium' else 'analysis and critical evaluation of concepts')} from the content. Use descriptive/open-ended format (no options).{lang_note}"

    prompt = f"""You are an expert trainer creating a training assessment STRICTLY based on the provided SME Kit content below.

ABSOLUTE RULES — violating any of these makes the assessment useless:
1. CONTENT-ONLY: Every single question MUST be directly and specifically answerable from the content below. If you cannot point to a specific sentence, rule, or fact in the content that answers the question, do NOT include that question.
2. NO EXTERNAL KNOWLEDGE: Do NOT use facts, rules, or concepts from outside the provided content — not from general training knowledge, industry standards, or common sense. Only what is explicitly stated in the document below.
3. TOPIC FIDELITY: If the content is about "Content Editing Guidelines", generate questions ONLY about content editing. If it is about "Insurance Claims Processing", generate questions ONLY about insurance claims. Read the content first and identify its actual topic — then generate questions ONLY on that topic.
4. ZERO HALLUCINATION: Do not invent rules, scenarios, or facts. Every correct answer must be a direct quote or paraphrase from the content below.
5. {_type_rule('Easy', easy_type)}
6. {_type_rule('Medium', medium_type)}
7. {_type_rule('Hard', hard_type)}
8. PRACTICAL ERROR-IDENTIFICATION (MCQ only): For at least 30% of MCQ questions, present a sentence or example that violates a SPECIFIC RULE from this document. Ask the candidate to identify the error or choose the corrected version. Only use rules that appear verbatim in the content below.

BEFORE generating questions, briefly identify: (1) the topic of this document, and (2) three to five key rules or concepts it covers. Then base ALL questions on those.

SME KIT CONTENT:
{content[:10000]}

Generate exactly {easy_count} Easy ({_type_label(easy_type)}) + {medium_count} Medium ({_type_label(medium_type)}) + {hard_count} Hard ({_type_label(hard_type)}) questions ({total} total).

Return ONLY valid JSON (no markdown, no explanation):
{{
  "questions": [
    {{
      "order_index": 1,
      "difficulty": "easy",
      "question_type": "mcq",
      "question_text": "Question text here. If technical, add: For example, ...",
      "options": ["A. option1", "B. option2", "C. option3", "D. option4"],
      "correct_answer": "A"
    }},
    {{
      "order_index": 2,
      "difficulty": "medium",
      "question_type": "mcq",
      "question_text": "The following sentence violates a rule in the guidelines: [example sentence with error]. Which option correctly fixes this?",
      "options": ["A. corrected version", "B. another option", "C. another option", "D. another option"],
      "correct_answer": "A"
    }},
    {{
      "order_index": 4,
      "difficulty": "hard",
      "question_type": "descriptive",
      "question_text": "Question text here. For example, ...",
      "options": null,
      "correct_answer": "Model answer: ..."
    }}
  ]
}}

Format rules:
- MCQ: exactly 4 options labeled A. B. C. D.; correct_answer is the single letter (A/B/C/D)
- Descriptive: options is null; correct_answer starts with "Model answer:"
- Order: Easy questions first (indices 1–{easy_count}), then Medium ({easy_count+1}–{easy_count+medium_count}), then Hard ({easy_count+medium_count+1}–{total})
- Include difficulty field for every question
- Use "question_type": "mcq" for MCQ questions and "question_type": "descriptive" for open-ended questions"""

    raw = _call_ai(prompt)
    data = _extract_json(raw)
    return data.get("questions", [])


def _evaluate_attempt(questions: List[TrainingQuestion], answers: List[dict]) -> dict:
    qa_pairs = []
    answer_map = {a["question_id"]: a["answer_text"] for a in answers}
    for seq_num, q in enumerate(questions, start=1):
        qa_pairs.append({
            "question_id": q.id,
            "question_number": seq_num,  # sequential 1..N — use this in feedback text, NOT question_id
            "question_type": q.question_type,
            "question_text": q.question_text,
            "options": q.options,
            "correct_answer": q.correct_answer,
            "user_answer": answer_map.get(q.id, ""),
        })

    total_q = len(qa_pairs)
    prompt = f"""You are evaluating a training assessment submission of {total_q} questions.

Questions and answers:
{json.dumps(qa_pairs, indent=2)}

For each question, evaluate the user's answer.

Return ONLY valid JSON (no markdown, no explanation):
{{
  "evaluations": [
    {{
      "question_id": <copy the question_id field exactly>,
      "is_correct": true,
      "ai_flag": "correct",
      "ai_explanation": "Brief explanation of why this answer is correct or wrong"
    }}
  ],
  "overall_feedback": "2-3 sentences of overall feedback on the submission",
  "score": 75.0
}}

CRITICAL RULES:
- The evaluations array MUST have exactly {total_q} entries — one per question, in the same order.
- "question_id" in each evaluation MUST be copied exactly from the question_id field in the input — do NOT substitute or invent new IDs.
- In "overall_feedback" and "ai_explanation", ALWAYS refer to questions by their "question_number" (e.g. "Question 3", "Q5"), NEVER by their "question_id" (which is an internal database ID, not a sequence number).
- ai_flag must be "correct", "wrong", or "partial" — nothing else.
- MCQ: correct only if the user's letter matches the correct_answer letter (case-insensitive). Wrong otherwise — no partial credit for MCQ.
- Descriptive (question_type = "descriptive" or "written"): partial credit allowed; compare the user's answer against the model answer and use your judgment.
- score = (correct_count + 0.5 * partial_count) / {total_q} * 100, rounded to 1 decimal.
- Be constructive and specific in explanations. Reference the actual content from the question."""

    raw = _call_ai(prompt)
    return _extract_json(raw)


# ── Serialisers ──────────────────────────────────────────────────────────────

def _assessment_out(a: TrainingAssessment, include_questions=False, for_joiner=False, generation=None) -> dict:
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
        "easy_count": a.easy_count or 0,
        "medium_count": a.medium_count or 0,
        "hard_count": a.hard_count or 0,
        "pass_threshold": a.pass_threshold,
        "status": a.status,
        "created_at": a.created_at,
        "new_joiner_name": a.new_joiner.name if a.new_joiner else None,
        "creator_name": a.creator.name if a.creator else None,
        "kit_name": a.kit.name if a.kit else None,
    }
    if include_questions:
        # Only expose the latest generation of questions (or generation passed as hint)
        all_qs = sorted(a.questions, key=lambda x: x.order_index)
        max_gen = max((q.generation or 1 for q in all_qs), default=1) if all_qs else 1
        target_gen = generation if generation is not None else max_gen
        qs = []
        for q in all_qs:
            if (q.generation or 1) != target_gen:
                continue
            qd = {
                "id": q.id,
                "assessment_id": q.assessment_id,
                "order_index": q.order_index,
                "question_type": q.question_type,
                "difficulty": q.difficulty,
                "question_text": q.question_text,
                "options": q.options,
            }
            if not for_joiner:
                qd["correct_answer"] = q.correct_answer
            qs.append(qd)
        d["questions"] = qs
    return d


def _attempt_out(attempt: TrainingAttempt) -> dict:
    answers_out = []
    for ans in attempt.answers:
        a = {
            "id": ans.id,
            "question_id": ans.question_id,
            "answer_text": ans.answer_text,
            "is_correct": ans.is_correct,
            "ai_flag": ans.ai_flag,
            "ai_explanation": ans.ai_explanation,
        }
        # Embed the question data so history works regardless of which generation was used
        if ans.question:
            a["question_text"] = ans.question.question_text
            a["question_type"] = ans.question.question_type
            a["difficulty"] = ans.question.difficulty
            a["options"] = ans.question.options
            a["order_index"] = ans.question.order_index
        answers_out.append(a)
    # Sort by order_index so they display in the right sequence
    answers_out.sort(key=lambda x: x.get("order_index", 0))
    return {
        "id": attempt.id,
        "assessment_id": attempt.assessment_id,
        "user_id": attempt.user_id,
        "attempt_number": attempt.attempt_number,
        "question_generation": attempt.question_generation or 1,
        "status": attempt.status,
        "score": attempt.score,
        "passed": attempt.passed,
        "trophy_awarded": attempt.trophy_awarded,
        "ai_feedback": attempt.ai_feedback,
        "submitted_at": attempt.submitted_at,
        "evaluated_at": attempt.evaluated_at,
        "created_at": attempt.created_at,
        "answers": answers_out,
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
    easy_type = getattr(payload, 'easy_type', 'mcq') or 'mcq'
    medium_type = getattr(payload, 'medium_type', 'mcq') or 'mcq'
    hard_type = getattr(payload, 'hard_type', 'descriptive') or 'descriptive'
    questions_data = _generate_questions(
        content,
        payload.easy_count, easy_type,
        payload.medium_count, medium_type,
        payload.hard_count, hard_type,
    )

    total = payload.easy_count + payload.medium_count + payload.hard_count
    # Count MCQ vs descriptive based on chosen types
    mcq_count = sum([
        payload.easy_count if easy_type == 'mcq' else 0,
        payload.medium_count if medium_type == 'mcq' else 0,
        payload.hard_count if hard_type == 'mcq' else 0,
    ])
    written_count = total - mcq_count

    assessment = TrainingAssessment(
        title=payload.title,
        new_joiner_id=payload.new_joiner_id,
        created_by=current_user.id,
        sme_kit_id=payload.sme_kit_id,
        source_file_ids=payload.source_file_ids,
        total_questions=total,
        mcq_count=mcq_count,
        written_count=written_count,
        easy_count=payload.easy_count,
        medium_count=payload.medium_count,
        hard_count=payload.hard_count,
        pass_threshold=payload.pass_threshold,
        status="active",
    )
    db.add(assessment)
    db.flush()

    for qd in questions_data:
        raw_type = qd.get("question_type", "descriptive")
        # Normalise: old "written" values → "descriptive"
        if raw_type == "written":
            raw_type = "descriptive"
        q = TrainingQuestion(
            assessment_id=assessment.id,
            order_index=qd.get("order_index", 0),
            question_type=raw_type,
            difficulty=qd.get("difficulty"),
            question_text=qd.get("question_text", ""),
            options=qd.get("options"),
            correct_answer=qd.get("correct_answer"),
        )
        db.add(q)

    db.commit()
    db.refresh(assessment)
    return _assessment_out(assessment, include_questions=True, for_joiner=False)


@router.post("/assessments/from-excel", response_model=dict)
async def create_assessment_from_excel(
    file: UploadFile = File(...),
    new_joiner_id: int = Form(...),
    title: str = Form(...),
    pass_threshold: int = Form(70),
    sheet: str = Form("all"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager", "admin")),
):
    """Import questions from an Excel file (3-sheet template) instead of AI generation."""
    import openpyxl

    joiner = db.query(User).filter(User.id == new_joiner_id).first()
    if not joiner:
        raise HTTPException(404, "New joiner not found")

    content = await file.read()
    try:
        wb = openpyxl.load_workbook(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(400, f"Could not read Excel file: {str(e)[:120]}")

    DESCRIPTIVE_SHEET = "Descriptive questions"
    all_sheets = wb.sheetnames
    sheets_to_read = all_sheets if sheet == "all" else [sheet]

    questions_data = []
    order = 1

    for sheet_name in sheets_to_read:
        if sheet_name not in wb.sheetnames:
            continue
        ws = wb[sheet_name]
        is_descriptive = sheet_name == DESCRIPTIVE_SHEET

        for row in ws.iter_rows(min_row=2, values_only=True):
            if not row or not row[0]:
                continue
            difficulty = str(row[0] or "").strip().lower()
            if difficulty not in ("easy", "medium", "hard"):
                continue

            question_text = str(row[2] or "").strip()
            if not question_text:
                continue

            if is_descriptive:
                answer_explanation = str(row[3] or "").strip()
                questions_data.append({
                    "order_index": order,
                    "question_type": "descriptive",
                    "difficulty": difficulty,
                    "question_text": question_text,
                    "options": None,
                    "correct_answer": f"Model answer: {answer_explanation}",
                })
            else:
                opt_a = str(row[3] or "").strip()
                opt_b = str(row[4] or "").strip()
                opt_c = str(row[5] or "").strip()
                opt_d = str(row[6] or "").strip()
                correct = str(row[7] or "").strip()
                questions_data.append({
                    "order_index": order,
                    "question_type": "mcq",
                    "difficulty": difficulty,
                    "question_text": question_text,
                    "options": [f"A. {opt_a}", f"B. {opt_b}", f"C. {opt_c}", f"D. {opt_d}"],
                    "correct_answer": correct,
                })
            order += 1

    if not questions_data:
        raise HTTPException(400, "No valid questions found in the uploaded file. Check the file format.")

    total = len(questions_data)
    mcq_count = sum(1 for q in questions_data if q["question_type"] == "mcq")
    written_count = total - mcq_count
    easy_count = sum(1 for q in questions_data if q["difficulty"] == "easy")
    medium_count = sum(1 for q in questions_data if q["difficulty"] == "medium")
    hard_count = sum(1 for q in questions_data if q["difficulty"] == "hard")

    assessment = TrainingAssessment(
        title=title.strip(),
        new_joiner_id=new_joiner_id,
        created_by=current_user.id,
        sme_kit_id=None,
        source_file_ids=[],
        total_questions=total,
        mcq_count=mcq_count,
        written_count=written_count,
        easy_count=easy_count,
        medium_count=medium_count,
        hard_count=hard_count,
        pass_threshold=pass_threshold,
        status="active",
    )
    db.add(assessment)
    db.flush()

    for qd in questions_data:
        db.add(TrainingQuestion(
            assessment_id=assessment.id,
            order_index=qd["order_index"],
            question_type=qd["question_type"],
            difficulty=qd["difficulty"],
            question_text=qd["question_text"],
            options=qd["options"],
            correct_answer=qd["correct_answer"],
        ))

    db.commit()
    db.refresh(assessment)
    d = _assessment_out(assessment, include_questions=False)
    d["attempt_count"] = 0
    d["best_score"] = None
    d["passed"] = False
    d["attempts"] = []
    return d


@router.get("/assessments", response_model=List[dict])
def list_assessments_manager(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager", "admin")),
):
    q = db.query(TrainingAssessment)
    if current_user.role == "manager":
        q = q.filter(TrainingAssessment.created_by == current_user.id)
    assessments = q.order_by(TrainingAssessment.created_at.desc()).all()
    result = []
    for a in assessments:
        d = _assessment_out(a, include_questions=True, for_joiner=False)
        attempts = db.query(TrainingAttempt).filter(
            TrainingAttempt.assessment_id == a.id,
        ).order_by(TrainingAttempt.attempt_number.desc()).all()
        d["attempt_count"] = len(attempts)
        d["best_score"] = max((at.score for at in attempts if at.score is not None), default=None)
        d["passed"] = any(at.passed for at in attempts)
        d["attempts"] = [_attempt_out(at) for at in attempts]
        result.append(d)
    return result


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

    # For joiners: return the question generation matching their in-progress attempt
    gen = None
    if is_joiner:
        in_progress = db.query(TrainingAttempt).filter(
            TrainingAttempt.assessment_id == assessment_id,
            TrainingAttempt.user_id == current_user.id,
            TrainingAttempt.status == "in_progress",
        ).first()
        if in_progress:
            gen = in_progress.question_generation or 1

    return _assessment_out(a, include_questions=True, for_joiner=is_joiner, generation=gen)


@router.post("/assessments/{assessment_id}/start", response_model=dict)
def start_attempt(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("new_joiner")),
):
    from models import TrainingQuestion as TQ
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

    # Determine which question generation to use for this attempt
    existing_gens = db.query(TQ.generation).filter(TQ.assessment_id == assessment_id).distinct().all()
    max_existing_gen = max((g[0] or 1 for g in existing_gens), default=1)

    if attempt_number == 1:
        # First attempt — use existing question set (generation 1)
        question_generation = 1
    else:
        # Re-attempt — regenerate a fresh question set so answers can't be memorised
        new_generation = max_existing_gen + 1
        try:
            files = db.query(SmeKitFileV2).filter(
                SmeKitFileV2.id.in_(a.source_file_ids or []),
                SmeKitFileV2.sme_kit_id == a.sme_kit_id,
            ).all()
            content = _build_content_context(files)
            easy_type = "mcq"
            medium_type = "mcq"
            hard_type = "descriptive"
            # Infer types from existing generation-1 questions
            gen1_qs = [q for q in a.questions if (q.generation or 1) == 1]
            if gen1_qs:
                easy_qs = [q for q in gen1_qs if (q.difficulty or "").lower() == "easy"]
                medium_qs = [q for q in gen1_qs if (q.difficulty or "").lower() == "medium"]
                hard_qs = [q for q in gen1_qs if (q.difficulty or "").lower() == "hard"]
                if easy_qs:
                    easy_type = easy_qs[0].question_type
                if medium_qs:
                    medium_type = medium_qs[0].question_type
                if hard_qs:
                    hard_type = hard_qs[0].question_type
            questions_data = _generate_questions(
                content,
                a.easy_count or 0, easy_type,
                a.medium_count or 0, medium_type,
                a.hard_count or 0, hard_type,
            )
            for qd in questions_data:
                raw_type = qd.get("question_type", "descriptive")
                if raw_type == "written":
                    raw_type = "descriptive"
                q = TrainingQuestion(
                    assessment_id=a.id,
                    order_index=qd.get("order_index", 0),
                    question_type=raw_type,
                    difficulty=qd.get("difficulty"),
                    question_text=qd.get("question_text", ""),
                    options=qd.get("options"),
                    correct_answer=qd.get("correct_answer"),
                    generation=new_generation,
                )
                db.add(q)
            db.commit()
            question_generation = new_generation
        except Exception:
            # If regeneration fails, fall back to the most recent existing generation
            question_generation = max_existing_gen

    attempt = TrainingAttempt(
        assessment_id=assessment_id,
        user_id=current_user.id,
        attempt_number=attempt_number,
        question_generation=question_generation,
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
        # Check if already submitted/evaluated (e.g. client timeout but server completed)
        recent = db.query(TrainingAttempt).filter(
            TrainingAttempt.assessment_id == assessment_id,
            TrainingAttempt.user_id == current_user.id,
            TrainingAttempt.status.in_(["submitted", "evaluated"]),
        ).order_by(TrainingAttempt.id.desc()).first()
        if recent:
            return _attempt_out(recent)
        raise HTTPException(400, "No in-progress attempt found. Start the assessment first.")

    attempt.status = "submitted"
    attempt.submitted_at = datetime.utcnow()
    db.commit()

    # Use the question generation tied to this specific attempt
    attempt_gen = attempt.question_generation or 1
    questions = sorted(
        [q for q in a.questions if (q.generation or 1) == attempt_gen],
        key=lambda x: x.order_index,
    )
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

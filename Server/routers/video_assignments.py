import json
import re
from datetime import datetime
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import require_role
from config import MODEL_NAME, OPENROUTER_API_KEY
from database import get_db
from models import User, VideoAssignment, VideoContent, VideoQuizAttempt, VideoQuizQuestion

router = APIRouter(prefix="/api/video-assignments", tags=["video-assignments"])


# ── Request schemas ───────────────────────────────────────────────────────────

class VideoCreate(BaseModel):
    title: str
    description: Optional[str] = None
    video_url: str


class AssignRequest(BaseModel):
    video_id: int
    user_ids: List[int]
    due_date: Optional[str] = None   # ISO date string, e.g. "2025-12-31"


class ProgressUpdate(BaseModel):
    progress_percent: int


class QuizSubmission(BaseModel):
    answers: dict   # {str(question_id): int(chosen_index)}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _calc_status(a: VideoAssignment) -> str:
    now = datetime.utcnow()
    if a.progress_percent >= 100:
        return "completed"
    if a.due_date and a.due_date < now:
        return "overdue"
    if a.due_date and (a.due_date - now).total_seconds() <= 3 * 86400:
        return "urgent"
    return "assigned"


# ── Manager endpoints ─────────────────────────────────────────────────────────

@router.post("/videos")
def create_video(
    body: VideoCreate,
    db: Session = Depends(get_db),
    manager=Depends(require_role("manager")),
):
    video = VideoContent(
        title=body.title,
        description=body.description,
        video_url=body.video_url,
        uploaded_by=manager.id,
    )
    db.add(video)
    db.commit()
    db.refresh(video)
    return {"id": video.id, "title": video.title, "message": "Video added"}


@router.get("/videos")
def list_videos(
    db: Session = Depends(get_db),
    manager=Depends(require_role("manager")),
):
    videos = db.query(VideoContent).order_by(VideoContent.created_at.desc()).all()
    return [
        {
            "id": v.id,
            "title": v.title,
            "description": v.description,
            "video_url": v.video_url,
            "quiz_generated": v.quiz_generated,
            "question_count": len(v.questions),
            "assignment_count": len(v.assignments),
            "created_at": v.created_at.isoformat() if v.created_at else None,
        }
        for v in videos
    ]


@router.post("/videos/{video_id}/generate-quiz")
async def generate_quiz(
    video_id: int,
    db: Session = Depends(get_db),
    manager=Depends(require_role("manager")),
):
    video = db.query(VideoContent).filter(VideoContent.id == video_id).first()
    if not video:
        raise HTTPException(404, "Video not found")
    if not OPENROUTER_API_KEY:
        raise HTTPException(500, "AI not configured — set OPENROUTER_API_KEY")

    prompt = (
        f'Generate exactly 5 multiple-choice quiz questions for a training video titled: "{video.title}".'
        + (f"\nTopic context: {video.description}" if video.description else "")
        + "\n\nReturn a JSON array of 5 objects. Each object must have:"
        + ' "question" (string), "options" (array of exactly 4 strings), "correct_index" (integer 0–3).'
        + "\nReturn ONLY the raw JSON array, no markdown, no explanation."
    )

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            json={"model": MODEL_NAME, "messages": [{"role": "user", "content": prompt}]},
        )
        if resp.status_code != 200:
            raise HTTPException(500, f"AI request failed: {resp.text[:300]}")

    raw = resp.json()["choices"][0]["message"]["content"].strip()

    # Extract JSON array from the response
    questions_data = None
    array_match = re.search(r"\[[\s\S]*\]", raw)
    if array_match:
        try:
            questions_data = json.loads(array_match.group())
        except Exception:
            pass

    if questions_data is None:
        obj_match = re.search(r"\{[\s\S]*\}", raw)
        if obj_match:
            try:
                obj = json.loads(obj_match.group())
                for val in obj.values():
                    if isinstance(val, list):
                        questions_data = val
                        break
            except Exception:
                pass

    if not questions_data:
        raise HTTPException(500, "Could not parse quiz questions from AI response")

    # Replace existing questions and bump generation counter
    existing = db.query(VideoQuizQuestion).filter(VideoQuizQuestion.video_id == video_id).all()
    new_gen = (max(q.generation for q in existing) + 1) if existing else 1
    for q in existing:
        db.delete(q)
    db.flush()

    for item in questions_data[:5]:
        db.add(VideoQuizQuestion(
            video_id=video_id,
            question_text=item.get("question", ""),
            options=item.get("options", []),
            correct_index=int(item.get("correct_index", 0)),
            generation=new_gen,
        ))

    video.quiz_generated = True
    db.commit()
    return {"message": "Quiz generated", "question_count": min(len(questions_data), 5)}


@router.post("/assign")
def assign_video(
    body: AssignRequest,
    db: Session = Depends(get_db),
    manager=Depends(require_role("manager")),
):
    video = db.query(VideoContent).filter(VideoContent.id == body.video_id).first()
    if not video:
        raise HTTPException(404, "Video not found")

    due_date = datetime.fromisoformat(body.due_date) if body.due_date else None
    created, updated = 0, 0

    for uid in body.user_ids:
        existing = db.query(VideoAssignment).filter(
            VideoAssignment.video_id == body.video_id,
            VideoAssignment.user_id == uid,
        ).first()
        if existing:
            if due_date:
                existing.due_date = due_date
            updated += 1
        else:
            db.add(VideoAssignment(
                video_id=body.video_id,
                user_id=uid,
                assigned_by=manager.id,
                due_date=due_date,
                status="assigned",
            ))
            created += 1

    db.commit()
    return {"message": f"Done — {created} assigned, {updated} updated"}


@router.get("/stats")
def assignment_stats(
    db: Session = Depends(get_db),
    manager=Depends(require_role("manager")),
):
    assignments = db.query(VideoAssignment).all()
    return [
        {
            "id": a.id,
            "user_name": a.user.name if a.user else "—",
            "user_email": a.user.email if a.user else "—",
            "user_role": a.user.role if a.user else "—",
            "video_title": a.video.title if a.video else "—",
            "due_date": a.due_date.isoformat() if a.due_date else None,
            "status": a.status,
            "progress_percent": a.progress_percent,
            "quiz_passed": a.quiz_passed,
            "attempt_count": len(a.attempts),
            "best_score": max(
                (att.score for att in a.attempts if att.score is not None), default=None
            ),
        }
        for a in assignments
    ]


@router.get("/users-list")
def list_assignable_users(
    db: Session = Depends(get_db),
    manager=Depends(require_role("manager")),
):
    users = (
        db.query(User)
        .filter(User.role.in_(["new_joiner", "employee"]))
        .order_by(User.name)
        .all()
    )
    return [
        {"id": u.id, "name": u.name, "email": u.email, "role": u.role, "department": u.department}
        for u in users
    ]


# ── Learner endpoints ─────────────────────────────────────────────────────────

@router.get("/my")
def my_assignments(
    db: Session = Depends(get_db),
    user=Depends(require_role("new_joiner", "employee")),
):
    assignments = db.query(VideoAssignment).filter(VideoAssignment.user_id == user.id).all()
    result = []

    for a in assignments:
        new_status = _calc_status(a)
        if a.status != new_status:
            a.status = new_status

        questions = []
        if a.video and a.video.quiz_generated and a.progress_percent >= 100:
            qs = (
                db.query(VideoQuizQuestion)
                .filter(VideoQuizQuestion.video_id == a.video_id)
                .all()
            )
            questions = [
                {"id": q.id, "question_text": q.question_text, "options": q.options}
                for q in qs
            ]

        attempts = sorted(a.attempts, key=lambda x: x.attempt_number)
        latest = attempts[-1] if attempts else None

        result.append({
            "id": a.id,
            "video_id": a.video_id,
            "video_title": a.video.title if a.video else "—",
            "video_url": a.video.video_url if a.video else None,
            "video_description": a.video.description if a.video else None,
            "quiz_generated": a.video.quiz_generated if a.video else False,
            "due_date": a.due_date.isoformat() if a.due_date else None,
            "status": new_status,
            "progress_percent": a.progress_percent,
            "quiz_passed": a.quiz_passed,
            "attempt_count": len(a.attempts),
            "last_score": latest.score if latest else None,
            "last_passed": latest.passed if latest else None,
            "questions": questions,
        })

    db.commit()
    return result


@router.patch("/{assignment_id}/progress")
def update_progress(
    assignment_id: int,
    body: ProgressUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_role("new_joiner", "employee")),
):
    a = db.query(VideoAssignment).filter(
        VideoAssignment.id == assignment_id,
        VideoAssignment.user_id == user.id,
    ).first()
    if not a:
        raise HTTPException(404, "Assignment not found")

    a.progress_percent = min(100, max(0, body.progress_percent))
    a.status = _calc_status(a)
    db.commit()
    return {"progress_percent": a.progress_percent, "status": a.status}


@router.post("/{assignment_id}/quiz")
def submit_quiz(
    assignment_id: int,
    body: QuizSubmission,
    db: Session = Depends(get_db),
    user=Depends(require_role("new_joiner", "employee")),
):
    a = db.query(VideoAssignment).filter(
        VideoAssignment.id == assignment_id,
        VideoAssignment.user_id == user.id,
    ).first()
    if not a:
        raise HTTPException(404, "Assignment not found")
    if a.progress_percent < 100:
        raise HTTPException(400, "Watch the full video before taking the quiz")
    if len(a.attempts) >= 2:
        raise HTTPException(400, "Maximum 2 attempts reached")

    questions = (
        db.query(VideoQuizQuestion)
        .filter(VideoQuizQuestion.video_id == a.video_id)
        .all()
    )
    if not questions:
        raise HTTPException(400, "No quiz questions available for this video")

    correct = sum(
        1 for q in questions
        if str(q.id) in body.answers and body.answers[str(q.id)] == q.correct_index
    )
    score = round(correct / len(questions) * 100)
    passed = score >= 50

    db.add(VideoQuizAttempt(
        assignment_id=a.id,
        user_id=user.id,
        attempt_number=len(a.attempts) + 1,
        score=score,
        passed=passed,
    ))
    if passed:
        a.quiz_passed = True

    db.commit()
    return {"score": score, "passed": passed, "correct": correct, "total": len(questions)}


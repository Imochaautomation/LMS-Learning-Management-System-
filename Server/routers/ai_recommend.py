"""AI Recommendation endpoints — courses and assessments for a user."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
import httpx, json

from database import get_db
from models import User, Profile, AssessmentAssignment, CourseBankItem, InterviewSession
from auth import require_role
from config import OPENROUTER_API_KEY, MODEL_NAME

router = APIRouter(prefix="/api/ai", tags=["ai"])


def _build_context(user: User, db: Session) -> str:
    """Build a context string about the user for AI recommendations."""
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    assessments = db.query(AssessmentAssignment).filter(
        AssessmentAssignment.user_id == user.id
    ).all()
    session = db.query(InterviewSession).filter(
        InterviewSession.user_id == user.id,
        InterviewSession.status == "completed"
    ).order_by(InterviewSession.completed_at.desc()).first()

    context = f"Employee: {user.name}, Role: {user.role}, Dept: {user.department or 'N/A'}, "
    context += f"Designation: {user.designation or 'N/A'}, Experience: {user.experience or 'N/A'}\n"
    if profile and profile.summary:
        context += f"Summary: {profile.summary}\n"
    if session and session.skill_gaps:
        gaps = ", ".join([f"{g['skill']}({g['score']}%)" for g in session.skill_gaps])
        context += f"Skill Gaps: {gaps}\n"
    if assessments:
        assess_info = ", ".join([f"{a.assessment_name}(score:{a.score})" for a in assessments if a.score])
        if assess_info:
            context += f"Assessment scores: {assess_info}\n"
    return context


@router.get("/recommend/courses")
async def recommend_courses(
    user_id: int = Query(...),
    manager: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        return {"recommendations": []}

    context = _build_context(target, db)
    available = db.query(CourseBankItem).all()
    course_list = ", ".join([f"{c.title} ({c.category})" for c in available])

    if not OPENROUTER_API_KEY:
        return {"recommendations": [
            {"title": c.title, "provider": c.provider, "reason": "Based on your profile", "priority": "Medium"}
            for c in available[:10]
        ]}

    prompt = f"""Based on this employee's profile, recommend up to 10 courses from the available catalog.
Employee context: {context}
Available courses: {course_list}

Return JSON: {{"recommendations": [{{"title": "...", "provider": "...", "reason": "...", "priority": "High/Medium/Low"}}]}}"""

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}"},
                json={"model": MODEL_NAME, "messages": [{"role": "user", "content": prompt}]},
            )
            content = resp.json()["choices"][0]["message"]["content"]
            cleaned = content.strip().removeprefix("```json").removesuffix("```").strip()
            return json.loads(cleaned)
    except Exception:
        return {"recommendations": [{"title": c.title, "provider": c.provider, "reason": "Recommended", "priority": "Medium"} for c in available[:10]]}



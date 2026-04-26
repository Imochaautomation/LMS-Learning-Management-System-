"""Conversational AI Interview + Skill Analysis Generation via OpenRouter."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import httpx, json

from database import get_db
from models import User, InterviewSession, UserCourse, CourseBankItem, Profile
from schemas import InterviewRequest, InterviewResponse, AnalysisRequest
from auth import get_current_user
from config import OPENROUTER_API_KEY, MODEL_NAME

router = APIRouter(prefix="/api/ai", tags=["ai"])

SYSTEM_PROMPT = """You are Jarvis, an AI skill analyst for an LMS (Learning Management System) platform. 
Your job is to interview employees to understand their skills, experience, strengths and areas for improvement.
You are friendly, professional, and encouraging. Your name is Jarvis — use it naturally when appropriate.

Rules:
- Ask ONE question at a time
- Make questions contextual — follow up on previous answers
- Cover areas like: current skills, tools used, challenges faced, areas they want to improve, career goals
- Be conversational, not robotic
- After the user answers, acknowledge their response briefly then ask the next question
- Questions should be relevant to their role in editing, content creation, and language skills"""

ANALYSIS_PROMPT = """Based on the following interview conversation, generate a detailed skill gap analysis.

Return ONLY valid JSON in this exact format:
{
  "skill_gaps": [
    {
      "skill": "Skill Name",
      "score": 75,
      "severity": "Medium",
      "observation": "A specific 2-sentence observation referencing exactly what this employee said. Quote or paraphrase their actual answer. E.g. 'When asked about X, you described Y which shows Z. However, your response on Q revealed a gap in R.'",
      "question_asked": "The specific question from the interview that most revealed this skill level",
      "answer_summary": "A concise 1-sentence summary of what the employee actually said that determined this score"
    }
  ],
  "strengths": [
    "Clear strength point 1 — reference what the employee actually said",
    "Clear strength point 2"
  ],
  "areas_of_improvement": [
    "Specific area referencing something from the interview 1",
    "Specific area 2"
  ],
  "course_recommendations": [
    {"title": "Course Title", "provider": "Coursera", "category": "Category", "tag": "Gap-Fill", "link": "https://www.coursera.org/learn/course-slug", "duration": "4 weeks"},
    ...
  ]
}

Rules for skill_gaps:
- Score is 0-100 (higher = better)
- Severity: ONLY use these 3 levels — "High" (score < 50), "Medium" (score 50-69), "Low" (score 70+)
- score of exactly 70 = "Low" (proficient), NOT "Medium"
- DO NOT use "Strong" — use "Low" for high scores
- Include 5-8 skills
- observation MUST be personalized — reference specific things the employee said, NOT generic text
- question_asked: copy or paraphrase the actual interview question
- answer_summary: summarize what the employee specifically said (1 sentence)

Rules for strengths:
- List 3-5 concrete strengths observed from what they specifically said in the interview
- Reference actual answers, not generic observations

Rules for areas_of_improvement:
- List 3-5 specific areas grounded in what was revealed in the conversation
- Be specific about what was missing from their answers

Rules for course_recommendations:
- Recommend MAXIMUM 10 courses
- Focus on weak areas (High/Medium severity)
- CRITICAL: Every course MUST have a working "link" URL. Use SEARCH URLs (always valid) as your PRIMARY format:
  * Coursera: https://www.coursera.org/search?query=YOUR+COURSE+TOPIC
  * Udemy: https://www.udemy.com/courses/search/?q=YOUR+COURSE+TOPIC
  * LinkedIn Learning: https://www.linkedin.com/learning/search?keywords=YOUR+COURSE+TOPIC
  * edX: https://www.edx.org/search?q=YOUR+COURSE+TOPIC
  * YouTube: https://www.youtube.com/results?search_query=YOUR+COURSE+TOPIC+full+course
- The link field must NEVER be empty or null.

Interview conversation:
"""


async def _call_llm(messages: list[dict], timeout: int = 30) -> str:
    """Call OpenRouter LLM."""
    if not OPENROUTER_API_KEY:
        return "Thank you for your answer! Let me ask you about another area."

    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}"},
            json={"model": MODEL_NAME, "messages": messages},
        )
        data = resp.json()
        if "error" in data:
            err = data["error"]
            raise Exception(f"OpenRouter error {err.get('code', '')}: {err.get('message', str(err))}")
        if "choices" not in data or not data["choices"]:
            raise Exception(f"No choices in response: {str(data)[:200]}")
        return data["choices"][0]["message"]["content"]


def _build_search_url(title: str, provider: str) -> str:
    """Build a guaranteed-working search URL for a given course title and provider."""
    from urllib.parse import quote_plus
    q = quote_plus(title)
    provider_lower = (provider or "").lower()
    if "coursera" in provider_lower:
        return f"https://www.coursera.org/search?query={q}"
    elif "udemy" in provider_lower:
        return f"https://www.udemy.com/courses/search/?q={q}"
    elif "linkedin" in provider_lower:
        return f"https://www.linkedin.com/learning/search?keywords={q}"
    elif "edx" in provider_lower:
        return f"https://www.edx.org/search?q={q}"
    elif "youtube" in provider_lower:
        return f"https://www.youtube.com/results?search_query={q}+full+course"
    else:
        # Default to Google search for the course
        return f"https://www.google.com/search?q={q}+online+course"


async def _validate_course_links(courses: list[dict]) -> list[dict]:
    """Validate each course link via HTTP HEAD. Replace dead links with search URLs."""
    validated = []
    async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
        for c in courses:
            link = c.get("link", "")
            title = c.get("title", "")
            provider = c.get("provider", "")

            if not link:
                # No link at all — generate a search URL
                c["link"] = _build_search_url(title, provider)
                validated.append(c)
                continue

            # Check if it's already a search URL (always valid)
            if any(p in link for p in ["search?", "search/?", "/results?"]):
                validated.append(c)
                continue

            # Validate direct URLs with HTTP HEAD
            try:
                resp = await client.head(link, headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                })
                if resp.status_code < 400:
                    # Link is valid
                    validated.append(c)
                else:
                    # Dead link — replace with search URL
                    c["link"] = _build_search_url(title, provider)
                    validated.append(c)
            except Exception:
                # Network error — fall back to search URL
                c["link"] = _build_search_url(title, provider)
                validated.append(c)
    return validated


@router.post("/interview", response_model=InterviewResponse)
async def interview(
    req: InterviewRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Get or create session
    session = db.query(InterviewSession).filter(
        InterviewSession.user_id == user.id,
        InterviewSession.status == "in_progress"
    ).first()

    if not session:
        session = InterviewSession(user_id=user.id, messages=[], question_index=0)
        db.add(session)
        db.commit()
        db.refresh(session)

    # Add user's answer to history
    messages = session.messages or []
    messages.append({"role": "user", "content": req.answer})

    # If user wants to finish early (after minimum 5 questions)
    if req.force_complete:
        session.messages = messages
        session.question_index = req.question_index + 1
        session.status = "completed"
        session.completed_at = datetime.utcnow()
        db.commit()
        return InterviewResponse(
            follow_up=f"Great! You've answered {req.question_index + 1} questions — that's enough for a solid analysis. Let me generate your skill breakdown and course recommendations now! 🎯"
        )

    # Build LLM context
    llm_messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Add user context
    context = f"Employee: {user.name}, Role: {user.role}, Department: {user.department or 'N/A'}, Designation: {user.designation or 'N/A'}, Experience: {user.experience or 'N/A'}"
    llm_messages.append({"role": "system", "content": f"Employee context: {context}"})

    remaining = req.total_questions - req.question_index - 1
    if remaining > 0:
        llm_messages.append({"role": "system", "content": f"This is question {req.question_index + 1} of {req.total_questions}. {remaining} questions remaining. Ask the next question."})
    else:
        llm_messages.append({"role": "system", "content": "This is the LAST answer. Thank the employee warmly and tell them you'll now analyze their responses."})

    # Add conversation history
    for msg in messages:
        llm_messages.append(msg)

    try:
        follow_up = await _call_llm(llm_messages)
    except Exception:
        # Fallback questions
        fallback_topics = ['editing tools', 'grammar standards', 'US English conventions', 'team collaboration', 
                           'deadline management', 'document formatting', 'quality assurance', 'mentoring',
                           'handling feedback', 'career goals']
        idx = min(req.question_index, len(fallback_topics) - 1)
        follow_up = f"That's great! Tell me about your experience with {fallback_topics[idx]}?"

    messages.append({"role": "assistant", "content": follow_up})
    session.messages = messages
    session.question_index = req.question_index + 1

    if req.question_index + 1 >= req.total_questions:
        session.status = "completed"
        session.completed_at = datetime.utcnow()

    db.commit()

    return InterviewResponse(follow_up=follow_up)


@router.post("/reset-interview")
async def reset_interview(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reset interview session so user can retake."""
    sessions = db.query(InterviewSession).filter(
        InterviewSession.user_id == user.id
    ).all()
    for s in sessions:
        db.delete(s)
    db.commit()
    return {"ok": True, "message": "Interview reset. You can start a new interview."}


@router.post("/generate-analysis")
async def generate_analysis(
    req: AnalysisRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = db.query(InterviewSession).filter(
        InterviewSession.user_id == req.user_id,
        InterviewSession.status == "completed"
    ).order_by(InterviewSession.completed_at.desc()).first()

    if not session:
        raise HTTPException(status_code=404, detail="No completed interview found")

    # Build conversation text
    conversation = "\n".join([
        f"{'Employee' if m['role'] == 'user' else 'Interviewer'}: {m['content']}"
        for m in (session.messages or [])
    ])

    llm_messages = [
        {"role": "system", "content": ANALYSIS_PROMPT + conversation},
        {"role": "user", "content": "Generate the skill gap analysis and course recommendations as JSON. Include observation, question_asked, and answer_summary for every skill_gap item."},
    ]

    # Extract Q&A pairs once — used for keyword fallback below
    messages_list = session.messages or []
    qa_pairs = []
    for i, msg in enumerate(messages_list):
        if msg.get("role") == "assistant" and i + 1 < len(messages_list) and messages_list[i + 1].get("role") == "user":
            qa_pairs.append({"question": msg["content"], "answer": messages_list[i + 1]["content"]})

    try:
        response = await _call_llm(llm_messages, timeout=120)
        # Strip markdown fences if present
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```", 2)[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
            cleaned = cleaned.rsplit("```", 1)[0].strip()
        analysis = json.loads(cleaned)
    except Exception as e:
        # Fallback — build basic analysis from Q&A so it at least has real content
        analysis = {
            "skill_gaps": [],
            "strengths": ["Completed the full AI interview — demonstrates commitment to growth."],
            "areas_of_improvement": ["Further analysis will be available after a successful AI evaluation."],
            "course_recommendations": [],
        }

    # For any skill_gap missing observation/question_asked/answer_summary,
    # find the most relevant Q&A by keyword matching on the skill name
    skill_gaps = analysis.get("skill_gaps", [])
    used_qa_indices = set()
    for gap in skill_gaps:
        skill_lower = gap.get("skill", "").lower()
        # Fill missing observation with a score-based description
        if not gap.get("observation"):
            score = gap.get("score", 50)
            sev = gap.get("severity", "Medium")
            if sev == "High":
                gap["observation"] = (
                    f"Responses showed limited familiarity with core {gap['skill']} concepts — answers lacked depth and applied confidence."
                    if score < 40 else
                    f"Basic awareness of {gap['skill']} was evident but answers were inconsistent when applied to varied scenarios."
                )
            elif sev == "Medium":
                gap["observation"] = (
                    f"Good foundational grasp of {gap['skill']} but struggled with edge cases and nuanced application."
                    if score >= 60 else
                    f"Knowledge of {gap['skill']} exists but depth and consistency were missing in more complex questions."
                )
            else:
                gap["observation"] = f"Demonstrated confident and consistent understanding of {gap['skill']} across all scenarios."
        # Fill missing Q&A evidence by keyword search — each Q&A used at most once
        if not gap.get("question_asked") and qa_pairs:
            for idx, qa in enumerate(qa_pairs):
                if idx not in used_qa_indices and (skill_lower in qa["question"].lower() or skill_lower in qa["answer"].lower()):
                    gap["question_asked"] = qa["question"].strip()
                    gap["answer_summary"] = qa["answer"].strip()[:300]
                    used_qa_indices.add(idx)
                    break

    analysis["skill_gaps"] = skill_gaps

    # Save skill gaps, strengths, areas
    session.skill_gaps = analysis.get("skill_gaps", [])
    session.strengths = analysis.get("strengths", [])
    session.areas_of_improvement = analysis.get("areas_of_improvement", [])
    db.commit()

    # Save recommended courses (max 10) — validate links first
    courses = analysis.get("course_recommendations", [])[:10]
    try:
        courses = await _validate_course_links(courses)
    except Exception:
        pass  # If validation fails, save courses as-is
    for c in courses:
        existing = db.query(UserCourse).filter(
            UserCourse.user_id == req.user_id,
            UserCourse.title == c["title"],
        ).first()
        if not existing:
            db.add(UserCourse(
                user_id=req.user_id,
                title=c["title"],
                provider=c.get("provider"),
                link=c.get("link"),
                category=c.get("category"),
                tag=c.get("tag", "Gap-Fill"),
                duration=c.get("duration"),
                status="recommended",
            ))
    db.commit()

    return {"ok": True, "skill_gaps": analysis.get("skill_gaps"), "courses": len(courses)}


def _build_analysis_response(session, profile):
    """Build the full analysis response including Q&A and profile context."""
    messages = session.messages or []
    qa_pairs = []
    for i, msg in enumerate(messages):
        if msg.get("role") == "assistant" and i + 1 < len(messages) and messages[i + 1].get("role") == "user":
            qa_pairs.append({
                "question": msg["content"],
                "answer": messages[i + 1]["content"],
            })

    # For skill_gaps missing observation or question_asked, fill them in now
    skill_gaps = []
    used_qa_indices = set()
    for gap in (session.skill_gaps or []):
        gap = dict(gap)  # don't mutate the stored object
        skill_lower = gap.get("skill", "").lower()

        if not gap.get("observation"):
            score = gap.get("score", 50)
            sev = gap.get("severity", "Medium")
            if sev == "High":
                gap["observation"] = (
                    f"Responses showed limited familiarity with core {gap['skill']} concepts — answers lacked depth and applied confidence."
                    if score < 40 else
                    f"Basic awareness of {gap['skill']} was evident but answers were inconsistent when applied to varied scenarios."
                )
            elif sev == "Medium":
                gap["observation"] = (
                    f"Good foundational grasp of {gap['skill']} but struggled with edge cases and nuanced application."
                    if score >= 60 else
                    f"Knowledge of {gap['skill']} exists but depth and consistency were missing in more complex questions."
                )
            else:
                gap["observation"] = f"Demonstrated confident and consistent understanding of {gap['skill']} across all scenarios."

        if not gap.get("question_asked") and qa_pairs:
            for idx, qa in enumerate(qa_pairs):
                if idx not in used_qa_indices and (skill_lower in qa["question"].lower() or skill_lower in qa["answer"].lower()):
                    gap["question_asked"] = qa["question"].strip()
                    gap["answer_summary"] = qa["answer"].strip()[:300]
                    used_qa_indices.add(idx)
                    break

        skill_gaps.append(gap)

    return {
        "skill_gaps": skill_gaps,
        "strengths": session.strengths or [],
        "areas_of_improvement": session.areas_of_improvement or [],
        "qa_pairs": qa_pairs,
        "interview_date": session.completed_at.isoformat() if session.completed_at else None,
        "learning_goals": profile.learning_goals if profile else None,
        "profile_summary": profile.summary if profile else None,
    }


@router.get("/skill-analysis")
async def get_skill_analysis(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return skill gaps + strengths + areas of improvement for a user."""
    session = db.query(InterviewSession).filter(
        InterviewSession.user_id == user.id,
        InterviewSession.status == "completed"
    ).order_by(InterviewSession.completed_at.desc()).first()
    if not session:
        return {"skill_gaps": [], "strengths": [], "areas_of_improvement": [], "qa_pairs": []}
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    return _build_analysis_response(session, profile)


@router.get("/skill-analysis/{user_id}")
async def get_user_skill_analysis(
    user_id: int,
    db: Session = Depends(get_db),
):
    """Return skill analysis for a specific user (manager view)."""
    session = db.query(InterviewSession).filter(
        InterviewSession.user_id == user_id,
        InterviewSession.status == "completed"
    ).order_by(InterviewSession.completed_at.desc()).first()
    if not session:
        return {"skill_gaps": [], "strengths": [], "areas_of_improvement": [], "qa_pairs": []}
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    return _build_analysis_response(session, profile)

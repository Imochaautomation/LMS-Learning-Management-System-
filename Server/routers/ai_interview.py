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

def _build_system_prompt(user, profile=None) -> str:
    """Build a fully personalised interview system prompt from employee profile data."""
    dept = (user.department or "").strip()
    designation = (user.designation or "").strip()
    experience = (user.experience or "").strip()
    learning_goals = (profile.learning_goals or "").strip() if profile else ""
    resume_summary = (profile.summary or "").strip() if profile else ""

    # Infer focus domain from department + designation
    dept_lower = dept.lower()
    desig_lower = designation.lower()

    if any(k in dept_lower or k in desig_lower for k in ["tech", "engineer", "software", "developer", "data", "it", "cloud", "devops", "ai", "ml"]):
        domain = "technology and software engineering"
        skill_areas = "programming languages, system design, debugging, cloud platforms, data structures, APIs, DevOps practices, testing, code quality, and technical problem-solving"
    elif any(k in dept_lower or k in desig_lower for k in ["sales", "business development", "account", "revenue"]):
        domain = "sales and business development"
        skill_areas = "prospecting, lead qualification, CRM tools, negotiation, objection handling, pipeline management, closing techniques, customer relationship management, and sales metrics"
    elif any(k in dept_lower or k in desig_lower for k in ["product", "ux", "design", "ui"]):
        domain = "product management and design"
        skill_areas = "product roadmapping, user research, competitive analysis, stakeholder management, sprint planning, wireframing, A/B testing, metrics and KPIs, and go-to-market strategy"
    elif any(k in dept_lower or k in desig_lower for k in ["market", "growth", "brand", "content", "seo", "social"]):
        domain = "marketing and growth"
        skill_areas = "digital marketing, SEO/SEM, content strategy, campaign management, analytics, social media, email marketing, brand positioning, and customer acquisition"
    elif any(k in dept_lower or k in desig_lower for k in ["finance", "accounting", "audit", "tax", "budget"]):
        domain = "finance and accounting"
        skill_areas = "financial analysis, budgeting, forecasting, accounting principles, Excel/BI tools, compliance, risk management, and financial reporting"
    elif any(k in dept_lower or k in desig_lower for k in ["hr", "people", "talent", "recruit", "learning"]):
        domain = "human resources and people management"
        skill_areas = "talent acquisition, performance management, employee engagement, HRIS tools, conflict resolution, learning & development, and HR compliance"
    elif any(k in dept_lower or k in desig_lower for k in ["ops", "operations", "supply", "logistics", "project", "program"]):
        domain = "operations and project management"
        skill_areas = "project planning, Agile/Scrum, process optimisation, stakeholder communication, risk management, resource allocation, and operational metrics"
    elif any(k in dept_lower or k in desig_lower for k in ["content", "edit", "write", "publish", "media", "journalism"]):
        domain = "content creation and editorial"
        skill_areas = "writing, editing, grammar, style guides, SEO writing, content strategy, storytelling, research, fact-checking, and publishing workflows"
    else:
        domain = f"{dept or designation or 'professional'} domain"
        skill_areas = "core technical skills, communication, problem-solving, tools and workflows, collaboration, and continuous learning"

    # Build profile context block
    profile_block = f"""
Employee Profile:
- Name: {user.name}
- Designation: {designation or 'Not specified'}
- Department: {dept or 'Not specified'}
- Experience: {experience or 'Not specified'}"""

    if learning_goals:
        profile_block += f"\n- Learning Goals: {learning_goals}"
    if resume_summary:
        profile_block += f"\n- Professional Background: {resume_summary[:600]}"

    goal_instruction = ""
    if learning_goals:
        goal_instruction = f"""
The employee's stated learning goals are: "{learning_goals}"
Tailor your questions to probe whether their current skills align with these goals.
Identify gaps between where they are now and where they want to reach."""

    return f"""You are Jarvis, an expert AI skill interviewer for iMocha's Learning Management platform.
You are interviewing {user.name}, currently working as a {designation or 'professional'} in {dept or 'the organisation'}.
Your job is to conduct a friendly, conversational skill assessment focused on the {domain}.
{profile_block}
{goal_instruction}

STRICT QUESTION RULES — follow these exactly:
1. Each question must be MAX 2 sentences. Short, clear, one topic only.
2. Ask about ONE thing at a time — never combine multiple questions.
3. PLAIN TEXT ONLY — NEVER use asterisks (*) of any kind. No **bold**, no *italic*, no bullet points starting with *. No markdown whatsoever. Write in plain natural sentences only.
4. Stay focused on the employee's CURRENT role and present work. Do not reference or mix in their previous jobs or career history when asking about something new.
5. Never repeat a topic already covered, even in different wording.
6. If the employee says they prefer not to discuss a topic, acknowledge once and move to a completely different skill area.
7. If the employee asks you to clarify or rephrase a question, explain it clearly in plain language. Do NOT ask a new question — re-ask the same one more simply.
8. Vary your question types: scenario-based, tool-specific, challenge-focused, goal-oriented.
9. After each answer, start with ONE brief specific acknowledgment (1 sentence referencing something they actually said), then ask your next question.
10. Use the employee's first name occasionally (every 3-4 exchanges) to keep it personal.
11. If the employee's response seems garbled, repetitive, or unclear (e.g. voice transcription errors), ask them to clarify in one sentence — do not repeat your previous question verbatim.

Your questions must probe: {skill_areas}

Start with their current day-to-day work and responsibilities, then go deeper into specific skills and challenges."""


def _build_analysis_prompt(user, profile=None) -> str:
    """Build a personalised analysis prompt that knows the employee's domain and goals."""
    dept = (user.department or "").strip()
    designation = (user.designation or "").strip()
    experience = (user.experience or "").strip()
    learning_goals = (profile.learning_goals or "").strip() if profile else ""
    resume_summary = (profile.summary or "").strip() if profile else ""

    profile_section = f"""Employee: {user.name}
Designation: {designation or 'N/A'} | Department: {dept or 'N/A'} | Experience: {experience or 'N/A'}"""
    if learning_goals:
        profile_section += f"\nLearning Goals: {learning_goals}"
    if resume_summary:
        profile_section += f"\nProfessional Background: {resume_summary[:500]}"

    return f"""You are an expert skill analyst. Based on the interview conversation below, generate a detailed, personalised skill gap analysis for this employee.

{profile_section}

IMPORTANT: The skill gaps, observations, and course recommendations MUST be directly relevant to this employee's role ({designation or 'professional'}), department ({dept or 'N/A'}), and their stated learning goals. Do NOT generate generic or irrelevant skills.

Return ONLY valid JSON in this exact format:
{{
  "skill_gaps": [
    {{
      "skill": "Skill Name relevant to their role/domain",
      "score": 75,
      "severity": "Medium",
      "observation": "A specific 2-sentence observation referencing exactly what this employee said. Quote or paraphrase their actual answer. E.g. 'When asked about X, you described Y which shows Z. However, your response on Q revealed a gap in R.'",
      "question_asked": "The specific question from the interview that most revealed this skill level",
      "answer_summary": "Copy the employee's EXACT words verbatim from their answer — do not paraphrase or summarize"
    }}
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
    {{"title": "Course Title", "provider": "Coursera", "category": "Category", "tag": "Gap-Fill", "link": "https://www.coursera.org/search?query=TOPIC", "duration": "4 weeks"}},
    "..."
  ]
}}

Rules for skill_gaps:
- Score is 0-100 (higher = better)
- Severity: ONLY use these 3 levels — "High" (score < 50), "Medium" (score 50-69), "Low" (score 70+)
- score of exactly 70 = "Low" (proficient), NOT "Medium"
- DO NOT use "Strong" — use "Low" for high scores
- Include 5-8 skills — ALL must be relevant to the employee's role and department
- observation MUST be personalized — reference specific things the employee said, NOT generic text
- question_asked: copy or paraphrase the actual interview question
- answer_summary: summarize what the employee specifically said (1 sentence)

Rules for strengths:
- List 3-5 concrete strengths observed from what they specifically said in the interview
- Reference actual answers, not generic observations

Rules for areas_of_improvement:
- List 3-5 specific areas grounded in what was revealed in the conversation
- Be specific about what was missing from their answers
- Align improvement areas with their stated learning goals where possible

Rules for course_recommendations:
- Recommend MAXIMUM 12 courses
- Focus on weak areas (High/Medium severity)
- Courses MUST be relevant to the employee's role ({designation or 'N/A'}) and department ({dept or 'N/A'})
- If they have learning goals, prioritise courses that help achieve those goals
- DIVERSITY RULE: At least 60% of courses MUST be FREE. Prioritise free resources: YouTube, freeCodeCamp, Google Digital Garage, Khan Academy, Coursera (audit/free tier), edX (audit), Anthropic docs, OpenAI cookbook, GitHub Learning Lab, MDN Web Docs, MIT OpenCourseWare, Harvard CS50, or any free industry resource. Only include paid courses (Udemy, LinkedIn Learning, Coursera paid) if no good free alternative exists for that topic.
- Set "free": true for free courses, "free": false for paid ones.
- CRITICAL: Every course MUST have a working "link" URL. Use SEARCH URLs (always valid) as your PRIMARY format:
  * Coursera: https://www.coursera.org/search?query=YOUR+COURSE+TOPIC
  * Udemy: https://www.udemy.com/courses/search/?q=YOUR+COURSE+TOPIC
  * LinkedIn Learning: https://www.linkedin.com/learning/search?keywords=YOUR+COURSE+TOPIC
  * edX: https://www.edx.org/search?q=YOUR+COURSE+TOPIC
  * YouTube: https://www.youtube.com/results?search_query=YOUR+COURSE+TOPIC+tutorial
  * freeCodeCamp: https://www.freecodecamp.org/news/search/?query=YOUR+TOPIC
  * Google: https://learndigital.withgoogle.com/digitalgarage/courses
- The link field must NEVER be empty or null.

Interview conversation:
"""


import re as _re
def _strip_md(t: str) -> str:
    """Remove all asterisk markdown from LLM output."""
    return _re.sub(r'\*+', '', t).strip()


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

    # If user wants to finish early
    if req.force_complete:
        session.messages = messages
        session.question_index = req.question_index + 1
        session.status = "completed"
        session.completed_at = datetime.utcnow()
        db.commit()
        return InterviewResponse(
            follow_up=f"Great! You've answered {req.question_index + 1} questions — that's enough for a solid analysis. Let me generate your skill breakdown and course recommendations now! 🎯"
        )

    # Fetch profile for personalised context
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()

    # Build LLM context using dynamic profile-aware prompt
    llm_messages = [{"role": "system", "content": _build_system_prompt(user, profile)}]

    remaining = req.total_questions - req.question_index - 1
    if req.is_clarification:
        llm_messages.append({"role": "system", "content": "The employee is asking for clarification on your last question. Explain it clearly in plain text (no markdown). Keep it to 2 sentences. Then re-ask the same question more simply. Do NOT move to a new topic."})
    elif remaining > 0:
        llm_messages.append({"role": "system", "content": f"This is question {req.question_index + 1} of {req.total_questions}. {remaining} questions remaining. Ask the next question. Keep it to 2 sentences max, plain text only."})
    else:
        llm_messages.append({"role": "system", "content": "This is the last answer. Thank the employee warmly in 1-2 sentences. Plain text only, no markdown."})

    # Add conversation history
    for msg in messages:
        llm_messages.append(msg)

    try:
        follow_up = _strip_md(await _call_llm(llm_messages))
    except Exception:
        dept_lower = (user.department or "").lower()
        desig_lower = (user.designation or "").lower()
        if any(k in dept_lower or k in desig_lower for k in ["tech", "engineer", "software", "developer", "data", "it"]):
            fallback_topics = ["your primary programming languages", "system design decisions you've made", "debugging a complex issue", "tools you use daily", "code review practices", "a recent technical challenge", "testing strategies", "your learning approach for new tech"]
        elif any(k in dept_lower or k in desig_lower for k in ["sales", "business development", "account"]):
            fallback_topics = ["your sales process", "handling objections", "CRM tools you use", "your best deal and how you closed it", "pipeline management", "prospecting strategies", "customer relationship building", "meeting sales targets"]
        elif any(k in dept_lower or k in desig_lower for k in ["product", "ux", "design"]):
            fallback_topics = ["how you prioritise features", "your user research process", "a product decision you made", "working with engineering teams", "metrics you track", "handling stakeholder conflicts", "your roadmapping process", "A/B testing experience"]
        elif any(k in dept_lower or k in desig_lower for k in ["market", "growth", "brand", "seo"]):
            fallback_topics = ["your go-to marketing channels", "a campaign you led", "analytics tools you use", "SEO or content strategy", "measuring campaign ROI", "audience targeting", "brand messaging", "growth experiments you've run"]
        else:
            fallback_topics = ["your daily responsibilities", "tools and workflows you use", "a challenge you overcame", "your collaboration style", "areas you're actively improving", "your career goals", "how you handle feedback", "a recent achievement"]
        idx = min(req.question_index, len(fallback_topics) - 1)
        follow_up = f"That's helpful context! Tell me more about {fallback_topics[idx]}?"

    messages.append({"role": "assistant", "content": _strip_md(follow_up)})
    session.messages = messages

    if not req.is_clarification:
        session.question_index = req.question_index + 1
        if req.question_index + 1 >= req.total_questions:
            session.status = "completed"
            session.completed_at = datetime.utcnow()
    else:
        session.question_index = req.question_index  # don't advance on clarification

    db.commit()

    return InterviewResponse(follow_up=_strip_md(follow_up))


@router.post("/reset-interview")
async def reset_interview(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark any in-progress session as abandoned so user can start a fresh interview.
    Completed sessions are preserved so skill gap reports remain visible."""
    in_progress = db.query(InterviewSession).filter(
        InterviewSession.user_id == user.id,
        InterviewSession.status == "in_progress",
    ).all()
    for s in in_progress:
        s.status = "abandoned"
    db.commit()
    return {"ok": True, "message": "Ready for a new interview. Your previous results are preserved."}


@router.get("/session")
async def get_session(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all past completed sessions + current in-progress session messages for the chat window."""
    sessions = db.query(InterviewSession).filter(
        InterviewSession.user_id == user.id,
    ).order_by(InterviewSession.id.asc()).all()

    result = []
    for s in sessions:
        result.append({
            "id": s.id,
            "status": s.status,
            "question_index": s.question_index,
            "messages": s.messages or [],
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
        })
    return result


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

    # Fetch profile for personalised analysis
    target_user = db.query(User).filter(User.id == req.user_id).first()
    profile = db.query(Profile).filter(Profile.user_id == req.user_id).first()

    # Build conversation text
    conversation = "\n".join([
        f"{'Employee' if m['role'] == 'user' else 'Interviewer'}: {m['content']}"
        for m in (session.messages or [])
    ])

    analysis_prompt = _build_analysis_prompt(target_user or user, profile)

    llm_messages = [
        {"role": "system", "content": analysis_prompt + conversation},
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
                    gap["answer_summary"] = qa["answer"].strip()  # verbatim
                    used_qa_indices.add(idx)
                    break

    analysis["skill_gaps"] = skill_gaps

    # Save skill gaps, strengths, areas
    session.skill_gaps = analysis.get("skill_gaps", [])
    session.strengths = analysis.get("strengths", [])
    session.areas_of_improvement = analysis.get("areas_of_improvement", [])
    db.commit()

    # Save recommended courses (max 10) — validate links first
    courses = analysis.get("course_recommendations", [])[:12]
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
                    gap["answer_summary"] = qa["answer"].strip()  # verbatim
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

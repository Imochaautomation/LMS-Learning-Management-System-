"""Conversational AI Interview + Skill Analysis Generation via OpenRouter."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import httpx, json
from sqlalchemy.orm.attributes import flag_modified

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

QUESTION STRUCTURE — distribute your 15 questions across these areas:
- Questions 1-5: Current day-to-day responsibilities, tools, and workflows
- Questions 6-10: Specific skills, challenges faced, and how they were handled
- Questions 11-13: Growth, accomplishments, and professional journey so far
- Questions 14-15: Learning goals alignment — probe whether current skills match where they want to go

TOPIC DIVERSITY — CRITICAL RULE: You MUST spread your questions across at least 6 different skill areas.
- After asking 2 questions on any single topic (e.g. SEO, content editing, grammar, Excel), you MUST move to a completely different skill area permanently. Do NOT return to that topic even in a new phrasing.
- Count your past questions. If SEO has appeared 2+ times already, the next question MUST be about something entirely different — tools, communication, project management, specific software, etc.
- Treat sub-topics of the same domain as the same topic: "on-page SEO", "keyword research", and "search ranking" are all "SEO" — counted together toward the 2-question cap.
- If you cannot think of a new topic, ask about: daily tools/software, collaboration/team dynamics, data analysis, reporting, client interaction, process improvement, or professional development."""


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

CRITICAL ANTI-FABRICATION RULES — these are absolute, non-negotiable:
1. A skill gap entry is ONLY valid if there is a real question about that skill in the Interview Conversation below AND a real answer from the employee. If no question was asked about a skill, do NOT create a skill gap for it.
2. Learning Goals are NOT evidence. If the employee's learning goal mentions "AI" or "SEO" but no interview question covered that topic, do NOT create a skill gap for AI or SEO.
3. Professional Background is NOT evidence. Do not use the profile text as if it were an interview answer.
4. answer_summary MUST be the employee's EXACT verbatim words from their actual interview answer — not paraphrased, not from the profile.
5. question_asked MUST be copied from the actual Interviewer message in the conversation — not invented.
6. If fewer than 5 real Q&A exchanges exist in the conversation, only generate skill gaps for topics actually covered — do not pad to 5.

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
    {{"title": "Course Title", "provider": "Coursera", "category": "Category", "tag": "Gap-Fill", "link": "https://www.coursera.org/learn/EXACT-COURSE-SLUG", "duration": "4 weeks", "course_type": "video_freemium", "free": true}},
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
- answer_summary: paste the employee's EXACT verbatim words from their answer — do not paraphrase

Rules for strengths:
- List 3-5 concrete strengths observed from what they specifically said in the interview
- Reference actual answers, not generic observations

Rules for areas_of_improvement:
- List 3-5 specific areas grounded in what was revealed in the conversation
- Be specific about what was missing from their answers
- Align improvement areas with their stated learning goals where possible

Rules for course_recommendations:
- Recommend MAXIMUM 12 courses. Focus on weak areas (High/Medium severity).
- Courses MUST be relevant to the employee's role ({designation or 'N/A'}) and department ({dept or 'N/A'}).
- If they have learning goals, prioritise courses that help achieve those goals.

COURSE TYPE — set "course_type" for every course using EXACTLY one of these values, in PRIORITY ORDER (recommend higher-priority types first, they should appear earlier in the list):
  1. "video_free_cert"  — Video course with certificate, completely FREE (Google Digital Garage, freeCodeCamp with cert, Khan Academy, Harvard CS50, Coursera fully-free-with-cert). Set "free": true.
  2. "video_freemium"   — Video FREE to watch, certificate requires payment (Coursera Professional Certificate audit, edX audit track, Alison free courses). Set "free": true.
  3. "video_paid_cert"  — Video course + certificate, fully PAID (Udemy, LinkedIn Learning, Skillshare, Pluralsight). Set "free": false.
  4. "youtube"          — YouTube video course / playlist, FREE, no certificate. Set "free": true.
  5. "doc"              — Documentation or reading-only material. Lowest priority, only if no video alternative exists.

TARGET MIX (in order they appear in the list):
  - Recommend at least 2 "video_free_cert" courses first
  - Then at least 2 "video_freemium" courses
  - Then 2-3 "video_paid_cert" courses
  - Then 1-2 "youtube" courses
  - "doc" only as a last resort

CRITICAL — VIDEO COURSES ONLY: Do NOT recommend documentation pages, official API docs, GitHub repos, research papers, or blog posts. Specifically NEVER use: MDN Web Docs, docs.anthropic.com, platform.openai.com/docs, docs.cohere.com, GitHub repositories, or any URL that is purely a reading/reference resource. Every recommended course must be a structured VIDEO learning experience with a clear curriculum.

LINKS — STRICT RULES:
  NEVER use google.com, google.co.in, or any Google search link. NEVER use Bing or other search engines as a link.
  Use ONLY platform search URLs — these always resolve correctly:
  * Coursera: https://www.coursera.org/search?query=YOUR+COURSE+TOPIC
  * Udemy: https://www.udemy.com/courses/search/?q=YOUR+COURSE+TOPIC
  * LinkedIn Learning: https://www.linkedin.com/learning/search?keywords=YOUR+COURSE+TOPIC
  * edX: https://www.edx.org/search?q=YOUR+COURSE+TOPIC
  * YouTube: https://www.youtube.com/results?search_query=YOUR+COURSE+TOPIC+full+course
  * freeCodeCamp: https://www.freecodecamp.org/learn
  * Google Digital Garage: https://learndigital.withgoogle.com/digitalgarage/courses
  * Khan Academy: https://www.khanacademy.org/search?page_search_query=YOUR+TOPIC
  * Skillshare: https://www.skillshare.com/en/search?query=YOUR+TOPIC
  * Alison: https://alison.com/courses?query=YOUR+TOPIC
  * Pluralsight: https://www.pluralsight.com/search?q=YOUR+TOPIC
  * DeepLearning.AI: https://www.deeplearning.ai/courses/
  * If a provider is not in this list, use their homepage URL — do NOT use a Google search.
  * NEVER use google.com/search — users must land on the course platform.
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
    elif "freecodecamp" in provider_lower:
        return f"https://www.freecodecamp.org/news/search/?query={q}"
    elif "khan" in provider_lower:
        return f"https://www.khanacademy.org/search?page_search_query={q}"
    elif "mit" in provider_lower:
        return f"https://ocw.mit.edu/search/?q={q}"
    elif "harvard" in provider_lower or "cs50" in provider_lower:
        return f"https://www.edx.org/search?q={q}"
    elif "github" in provider_lower:
        return f"https://github.com/search?q={q}&type=repositories"
    elif "anthropic" in provider_lower:
        return f"https://docs.anthropic.com/search?q={q}"
    elif "openai" in provider_lower:
        return f"https://platform.openai.com/docs/search?query={q}"
    elif "google" in provider_lower or "digital garage" in provider_lower:
        return f"https://learndigital.withgoogle.com/digitalgarage/courses"
    elif "cohere" in provider_lower:
        return f"https://docs.cohere.com/docs/llmu"
    else:
        # Default to YouTube search — always free and accessible
        return f"https://www.youtube.com/results?search_query={q}+tutorial+course"


async def _validate_course_links(courses: list[dict]) -> list[dict]:
    """Validate course links in parallel. Replace dead/missing links with search URLs."""
    import asyncio

    async def _check_one(c: dict, client: httpx.AsyncClient) -> dict:
        link = c.get("link", "")
        title = c.get("title", "")
        provider = c.get("provider", "")

        if not link:
            c["link"] = _build_search_url(title, provider)
            return c

        # Search URLs are always valid — skip HEAD check
        if any(p in link for p in ["search?", "search/?", "/results?", "query=", "keywords="]):
            return c

        # Validate direct URLs in parallel
        try:
            resp = await client.head(link, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            })
            if resp.status_code >= 400:
                c["link"] = _build_search_url(title, provider)
        except Exception:
            c["link"] = _build_search_url(title, provider)
        return c

    async with httpx.AsyncClient(timeout=6, follow_redirects=True) as client:
        results = await asyncio.gather(*[_check_one(c, client) for c in courses], return_exceptions=True)

    validated = []
    for r in results:
        if isinstance(r, Exception):
            continue
        validated.append(r)
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

    # If user wants to finish (force_complete from wrapup confirm button)
    if req.force_complete:
        if not session:
            # Main session already completed — find it and append final note to it
            session = db.query(InterviewSession).filter(
                InterviewSession.user_id == user.id,
                InterviewSession.status == "completed"
            ).order_by(InterviewSession.question_index.desc()).first()
            if session:
                real = max(0, sum(1 for m in (session.messages or []) if m.get("role") == "user") - 1)
                if real < 5:
                    # Found a session but it doesn't have enough answers — don't accept it
                    return InterviewResponse(follow_up="Your previous interview session was too short. Please complete a full interview first.")
            if session and req.answer.strip() and req.answer.strip() not in ("Ready to finish. Please generate my skill analysis.", "I would like to finish the interview now."):
                msgs = list(session.messages or [])
                msgs.append({"role": "user", "content": req.answer})
                session.messages = msgs
                db.commit()
        else:
            msgs = list(session.messages or [])
            # Guard: don't complete a session with fewer than 5 real answers
            real_answers = max(0, sum(1 for m in msgs if m.get("role") == "user") - 1)
            if real_answers < 5:
                return InterviewResponse(
                    follow_up=f"You've only answered {real_answers} questions so far. Please answer at least 5 before finishing."
                )
            msgs.append({"role": "user", "content": req.answer})
            session.messages = msgs
            session.question_index = req.question_index + 1
            session.status = "completed"
            session.completed_at = datetime.utcnow()
            db.commit()
        return InterviewResponse(
            follow_up="Great! You've completed the interview — generating your skill breakdown and course recommendations now."
        )

    # Consultant mode: answer career/learning guidance without advancing the interview
    if req.is_consultant:
        profile = db.query(Profile).filter(Profile.user_id == user.id).first()
        dept = (user.department or "").strip()
        designation = (user.designation or "").strip()
        learning_goals = (profile.learning_goals or "").strip() if profile else ""
        resume_summary = (profile.summary or "").strip() if profile else ""

        consultant_ctx = f"User profile: {designation or 'Professional'} in {dept or 'the organisation'}."
        if learning_goals:
            consultant_ctx += f" Stated learning goals: {learning_goals}."
        if resume_summary:
            consultant_ctx += f" Background: {resume_summary[:300]}."

        consultant_system = (
            f"You are Jarvis, an expert AI learning consultant and career advisor from iMocha. "
            f"You are helping {user.name}. {consultant_ctx} "
            "The user has asked a career or learning guidance question during their skill interview. "
            "Answer it as a friendly, knowledgeable consultant. Give concrete, actionable advice — "
            "mention specific skills, tools, courses, or steps relevant to their role and goals. "
            "PLAIN TEXT ONLY — no asterisks, no markdown. Write in natural sentences. "
            "Keep your answer to 3-5 sentences. At the end, briefly note they can continue the interview whenever they are ready."
        )
        existing_msgs = session.messages if session else []
        llm_msgs = [{"role": "system", "content": consultant_system}]
        for m in (existing_msgs or [])[-6:]:
            llm_msgs.append(m)
        llm_msgs.append({"role": "user", "content": req.answer})

        try:
            reply = _strip_md(await _call_llm(llm_msgs))
        except Exception:
            reply = (
                "Great question! The best path depends on your goals, but I'd suggest building strong "
                "fundamentals first, then applying them through real projects. "
                "Platforms like Coursera, Udemy, and fast.ai are excellent starting points. "
                "Whenever you are ready, we can jump back into the interview!"
            )
        return InterviewResponse(follow_up=reply)

    if not session:
        session = InterviewSession(user_id=user.id, messages=[], question_index=0)
        db.add(session)
        db.commit()
        db.refresh(session)

    # Always copy the list — SQLAlchemy won't detect mutations to the same JSON object reference
    messages = list(session.messages or [])
    messages.append({"role": "user", "content": req.answer})

    # Fetch profile for personalised context
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()

    # Build LLM context using dynamic profile-aware prompt
    llm_messages = [{"role": "system", "content": _build_system_prompt(user, profile)}]

    # remaining = questions still to be asked AFTER this current response
    # question_index 0 = initial trigger ("yes go"), so real answers start at index 1
    # We need all total_questions answered before wrapping up
    remaining = req.total_questions - req.question_index

    # Build a hard list of already-asked questions to enforce topic diversity
    prev_questions = [
        m["content"] for m in messages
        if m.get("role") == "assistant" and len(m.get("content", "")) > 15
    ]

    # Detect explicitly rejected topics from user answers
    forbidden_topics = []
    rejection_phrases = ["not part of my", "not my area", "i don't work on", "not included in my",
                         "i never worked on", "not part of my team", "not my responsibility",
                         "i have never worked", "i don't use", "we don't use", "not related to my",
                         "isn't part of my", "is not part of my"]
    for msg in messages:
        if msg.get("role") == "user":
            content_lower = msg.get("content", "").lower()
            if any(phrase in content_lower for phrase in rejection_phrases):
                forbidden_topics.append(msg["content"][:200])

    if forbidden_topics and not req.is_clarification:
        forbidden_note = (
            "FORBIDDEN — the employee explicitly said these topics are NOT part of their role. "
            "You MUST NOT ask about them again under any circumstances:\n"
            + "\n".join(f"- Employee said: {t}" for t in forbidden_topics[-5:])
        )
        llm_messages.append({"role": "system", "content": forbidden_note})

    if req.is_clarification:
        llm_messages.append({"role": "system", "content": "The employee is asking for clarification on your last question. Explain it clearly in plain text (no markdown). Keep it to 2 sentences. Then re-ask the same question more simply. Do NOT move to a new topic."})
    elif remaining > 0:
        covered_note = ""
        if prev_questions:
            covered_note = (
                f"\n\nQUESTIONS ALREADY ASKED (do NOT repeat or rephrase any of these topics):\n"
                + "\n".join(f"- {q[:120]}" for q in prev_questions)
                + "\n\nYour next question MUST cover a completely different skill area not listed above."
            )
        llm_messages.append({"role": "system", "content": f"This is question {req.question_index + 1} of {req.total_questions}. {remaining} questions remaining. Ask the next question. Keep it to 2 sentences max, plain text only.{covered_note}"})
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
    flag_modified(session, "messages")  # Force SQLAlchemy to detect the JSON mutation

    if not req.is_clarification:
        session.question_index = req.question_index + 1
        # Complete only after ALL answers received (index+1 > total means 15 real answers given)
        if req.question_index + 1 > req.total_questions:
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
    """Return completed/in-progress sessions for the chat window.
    Only the most-recent in_progress session is returned (abandoned sessions are excluded).
    """
    sessions = db.query(InterviewSession).filter(
        InterviewSession.user_id == user.id,
    ).order_by(InterviewSession.id.desc()).all()

    # Keep only the newest in_progress (skip older ones and all abandoned sessions)
    seen_in_progress = False
    result = []
    for s in sessions:
        if s.status == "abandoned":
            continue
        if s.status == "in_progress":
            if seen_in_progress:
                continue  # skip older in_progress duplicates
            seen_in_progress = True
        result.append({
            "id": s.id,
            "status": s.status,
            "question_index": s.question_index,
            "messages": s.messages or [],
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
        })
    # Return in chronological order (oldest first) so the frontend sorts correctly
    result.reverse()
    return result


@router.get("/debug-sessions")
async def debug_sessions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Temporary debug: show session summary for current user."""
    import os as _os
    all_s = db.query(InterviewSession).filter(InterviewSession.user_id == user.id).all()
    return {
        "user_id": user.id,
        "db_url_type": "sqlite" if "sqlite" in str(db.bind.url) else "postgres",
        "session_count": len(all_s),
        "sessions": [
            {
                "id": s.id,
                "status": s.status,
                "question_index": s.question_index,
                "user_message_count": sum(1 for m in (s.messages or []) if m.get("role") == "user"),
            }
            for s in all_s
        ],
    }


@router.post("/generate-analysis")
async def generate_analysis(
    req: AnalysisRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Always use the JWT-authenticated user's ID — sessions are always created under user.id.
    # req.user_id is kept for backwards compatibility but user.id is authoritative.
    lookup_id = user.id

    def _count_real(s):
        return max(0, sum(1 for m in (s.messages or []) if m.get("role") == "user") - 1)

    def _best_session(uid):
        """Return the best session for a given user_id, or None."""
        completed = db.query(InterviewSession).filter(
            InterviewSession.user_id == uid,
            InterviewSession.status == "completed"
        ).order_by(InterviewSession.question_index.desc(), InterviewSession.completed_at.desc()).all()

        MIN_ANSWERS = 3
        # First pass: sessions with enough answers
        for s in completed:
            if _count_real(s) >= MIN_ANSWERS:
                return s

        # Fallback: promote best in_progress session
        ip = db.query(InterviewSession).filter(
            InterviewSession.user_id == uid,
            InterviewSession.status == "in_progress"
        ).order_by(InterviewSession.question_index.desc()).first()
        if ip and _count_real(ip) >= MIN_ANSWERS:
            ip.status = "completed"
            ip.completed_at = datetime.utcnow()
            db.commit()
            return ip

        # Last resort: pick whichever has the most answers (completed or in_progress)
        candidates = list(completed)
        if ip:
            candidates.append(ip)
        if candidates:
            best = max(candidates, key=_count_real)
            if _count_real(best) >= 1:
                if best.status == "in_progress":
                    best.status = "completed"
                    best.completed_at = datetime.utcnow()
                    db.commit()
                return best
        return None

    session = _best_session(lookup_id)
    # Also try req.user_id in case there's a mismatch (shouldn't happen but safe)
    if not session and req.user_id != lookup_id:
        session = _best_session(req.user_id)

    if not session:
        raise HTTPException(status_code=404, detail="No completed interview found. Please complete the AI interview first.")

    # Fetch profile for personalised analysis
    target_user = db.query(User).filter(User.id == lookup_id).first() or user
    profile = db.query(Profile).filter(Profile.user_id == lookup_id).first()

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
        response = await _call_llm(llm_messages, timeout=85)
        # Strip markdown fences if present
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```", 2)[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
            cleaned = cleaned.rsplit("```", 1)[0].strip()
        analysis = json.loads(cleaned)
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"AI analysis generation failed — please retry in a moment. ({str(e)[:120]})"
        )

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

    if not skill_gaps:
        raise HTTPException(
            status_code=503,
            detail="AI returned no skill gaps — the interview may have been too short or the AI response was invalid. Please retry."
        )

    # Save skill gaps, strengths, areas
    session.skill_gaps = analysis.get("skill_gaps", [])
    session.strengths = analysis.get("strengths", [])
    session.areas_of_improvement = analysis.get("areas_of_improvement", [])
    flag_modified(session, "skill_gaps")
    flag_modified(session, "strengths")
    flag_modified(session, "areas_of_improvement")
    db.commit()

    # Save recommended courses — clear stale recommendations first, then save sorted by priority
    courses = analysis.get("course_recommendations", [])[:12]
    try:
        courses = await _validate_course_links(courses)
    except Exception:
        pass  # If validation fails, save courses as-is

    # Sort by course_type priority before saving
    _COURSE_PRIORITY = {"video_free_cert": 0, "video_freemium": 1, "video_paid_cert": 2, "youtube": 3, "doc": 4}
    courses.sort(key=lambda c: _COURSE_PRIORITY.get(c.get("course_type", "doc"), 5))

    # Remove old stale recommendations (not yet acted on) before inserting fresh ones
    db.query(UserCourse).filter(
        UserCourse.user_id == lookup_id,
        UserCourse.status == "recommended",
    ).delete(synchronize_session=False)
    db.flush()

    for c in courses:
        db.add(UserCourse(
            user_id=lookup_id,
            title=c["title"],
            provider=c.get("provider"),
            link=c.get("link"),
            category=c.get("category"),
            tag=c.get("tag", "Gap-Fill"),
            duration=c.get("duration"),
            free=c.get("free"),
            course_type=c.get("course_type"),
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
        "session_id": session.id,
        "session_completed": True,
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
        return {"session_id": None, "session_completed": False, "skill_gaps": [], "strengths": [], "areas_of_improvement": [], "qa_pairs": []}
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

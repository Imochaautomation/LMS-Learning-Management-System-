import asyncio
import base64
import json
import random
import re
from datetime import datetime, timedelta
from typing import List, Optional
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import require_role
from config import (
    MODEL_NAME,
    MS_CLIENT_ID,
    MS_CLIENT_SECRET,
    MS_SHAREPOINT_DRIVE_ID,
    MS_SHAREPOINT_SITE_ID,
    MS_TENANT_ID,
    OPENROUTER_API_KEY,
    JWT_ALGORITHM,
    JWT_SECRET,
)
from database import get_db
from models import User, VideoAssignment, VideoContent, VideoQuizAttempt, VideoQuizQuestion

router = APIRouter(prefix="/api/video-assignments", tags=["video-assignments"])

VIDEO_QUIZ_POOL_SIZE = 30
VIDEO_QUIZ_QUESTIONS_PER_CANDIDATE = 10
VIDEO_QUIZ_BATCH_SIZE = 10
VIDEO_RETAKE_COOLDOWN_MINUTES = 15


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


def _parse_video_quiz_questions(raw: str) -> List[dict]:
    """Parse and validate quiz JSON without depending on one response wrapper."""
    cleaned = re.sub(r"^```(?:json)?\s*", "", (raw or "").strip())
    cleaned = re.sub(r"\s*```$", "", cleaned).strip()
    candidates = [cleaned]
    object_match = re.search(r"\{[\s\S]*\}", cleaned)
    array_match = re.search(r"\[[\s\S]*\]", cleaned)
    if object_match:
        candidates.append(object_match.group())
    if array_match:
        candidates.append(array_match.group())

    parsed_questions = None
    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
        except (json.JSONDecodeError, TypeError):
            continue
        if isinstance(parsed, list):
            parsed_questions = parsed
        elif isinstance(parsed, dict):
            parsed_questions = parsed.get("questions")
            if not isinstance(parsed_questions, list):
                parsed_questions = next(
                    (value for value in parsed.values() if isinstance(value, list)),
                    None,
                )
        if isinstance(parsed_questions, list):
            break

    valid_questions = []
    for item in parsed_questions or []:
        if not isinstance(item, dict):
            continue
        question = str(item.get("question") or item.get("question_text") or "").strip()
        options = item.get("options")
        correct_index = item.get("correct_index")
        if isinstance(correct_index, str):
            value = correct_index.strip().upper()
            if value in ("A", "B", "C", "D"):
                correct_index = ord(value) - ord("A")
            elif value.isdigit():
                correct_index = int(value)
        if (
            question
            and isinstance(options, list)
            and len(options) == 4
            and all(str(option).strip() for option in options)
            and isinstance(correct_index, int)
            and 0 <= correct_index <= 3
        ):
            valid_questions.append({
                "question": question,
                "options": [str(option).strip() for option in options],
                "correct_index": correct_index,
            })
    return valid_questions


async def _generate_video_quiz_with_openrouter(
    prompt: str,
    expected_count: int = 5,
) -> List[dict]:
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=120) as client:
        for attempt in range(2):
            request_prompt = prompt
            if attempt:
                request_prompt += (
                    "\n\nYour previous response was invalid. Return the exact JSON object only, "
                    "with five complete and valid question objects."
                )
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json={
                    "model": MODEL_NAME,
                    "messages": [{"role": "user", "content": request_prompt}],
                    "temperature": 0.3,
                    "max_tokens": max(1800, expected_count * 350),
                },
            )
            if response.status_code != 200:
                raise HTTPException(502, f"AI request failed: {response.text[:300]}")
            try:
                raw = response.json()["choices"][0]["message"]["content"]
            except (KeyError, IndexError, TypeError, ValueError):
                raw = ""
            questions = _parse_video_quiz_questions(raw)
            if len(questions) >= expected_count:
                return questions[:expected_count]
    raise HTTPException(502, "AI returned an invalid video quiz response after two attempts")


def _candidate_question_ids(question_ids: List[int]) -> List[int]:
    count = min(VIDEO_QUIZ_QUESTIONS_PER_CANDIDATE, len(question_ids))
    return random.SystemRandom().sample(question_ids, count) if count else []


def _valid_assignment_question_ids(
    assignment: VideoAssignment,
    available_ids: List[int],
) -> List[int]:
    available = set(available_ids)
    selected = [
        int(question_id)
        for question_id in (assignment.quiz_question_ids or [])
        if int(question_id) in available
    ]
    expected = min(VIDEO_QUIZ_QUESTIONS_PER_CANDIDATE, len(available_ids))
    if len(selected) != expected:
        selected = _candidate_question_ids(available_ids)
        assignment.quiz_question_ids = selected
    return selected


_VIDEO_EXTENSIONS = (".mp4", ".mov", ".avi", ".mkv", ".webm", ".wmv", ".m4v")


def _sharepoint_is_configured() -> bool:
    return all((
        MS_TENANT_ID,
        MS_CLIENT_ID,
        MS_CLIENT_SECRET,
        MS_SHAREPOINT_SITE_ID,
        MS_SHAREPOINT_DRIVE_ID,
    ))


def _is_sharepoint_url(url: str) -> bool:
    return bool(re.match(r"^https://[^/]*\.sharepoint\.com/", url or "", re.IGNORECASE))


def _create_stream_ticket(user_id: int, video_id: int) -> str:
    return jwt.encode(
        {
            "sub": str(user_id),
            "video_id": video_id,
            "purpose": "sharepoint_video_stream",
            "exp": datetime.utcnow() + timedelta(hours=6),
        },
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def _decode_stream_ticket(ticket: str, video_id: int) -> int:
    try:
        payload = jwt.decode(ticket, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("purpose") != "sharepoint_video_stream":
            raise ValueError("Wrong ticket purpose")
        if int(payload.get("video_id")) != video_id:
            raise ValueError("Ticket does not match video")
        return int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise HTTPException(401, "Invalid or expired video stream ticket")


async def _get_graph_app_token(client: httpx.AsyncClient) -> str:
    token_url = (
        f"https://login.microsoftonline.com/{quote(MS_TENANT_ID, safe='')}"
        "/oauth2/v2.0/token"
    )
    response = await client.post(token_url, data={
        "grant_type": "client_credentials",
        "client_id": MS_CLIENT_ID,
        "client_secret": MS_CLIENT_SECRET,
        "scope": "https://graph.microsoft.com/.default",
    })
    if response.status_code != 200:
        raise HTTPException(502, "Microsoft Graph authentication failed")
    token = response.json().get("access_token")
    if not token:
        raise HTTPException(502, "Microsoft Graph did not return an access token")
    return token


async def _graph_collection(
    client: httpx.AsyncClient,
    url: str,
    token: str,
) -> List[dict]:
    items = []
    next_url = url
    while next_url:
        response = await client.get(
            next_url,
            headers={"Authorization": f"Bearer {token}"},
        )
        if response.status_code != 200:
            raise HTTPException(502, "Unable to read the configured SharePoint library")
        payload = response.json()
        items.extend(payload.get("value", []))
        next_url = payload.get("@odata.nextLink")
    return items


async def _list_sharepoint_drive_items(
    client: httpx.AsyncClient,
    token: str,
) -> List[dict]:
    site_id = quote(MS_SHAREPOINT_SITE_ID, safe="")
    drive_id = quote(MS_SHAREPOINT_DRIVE_ID, safe="")
    base_url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}"
    pending_urls = [f"{base_url}/root/children"]
    files = []

    while pending_urls:
        children = await _graph_collection(client, pending_urls.pop(0), token)
        for item in children:
            if item.get("folder"):
                item_id = quote(str(item.get("id", "")), safe="")
                if item_id:
                    pending_urls.append(f"{base_url}/items/{item_id}/children")
            elif item.get("file"):
                files.append(item)
    return files


async def _resolve_sharepoint_download_url(
    client: httpx.AsyncClient,
    token: str,
    sharepoint_url: str,
) -> str:
    encoded_url = base64.urlsafe_b64encode(sharepoint_url.encode("utf-8")).decode("ascii").rstrip("=")
    share_id = f"u!{encoded_url}"
    response = await client.get(
        f"https://graph.microsoft.com/v1.0/shares/{share_id}/driveItem",
        headers={"Authorization": f"Bearer {token}"},
    )
    if response.status_code != 200:
        raise HTTPException(502, "Unable to resolve the SharePoint video")
    download_url = response.json().get("@microsoft.graph.downloadUrl")
    if not download_url:
        raise HTTPException(502, "SharePoint did not return a playable video URL")
    return download_url


# ── Manager endpoints ─────────────────────────────────────────────────────────

@router.get("/sharepoint/videos")
async def list_sharepoint_videos(
    manager=Depends(require_role("manager")),
):
    if not _sharepoint_is_configured():
        raise HTTPException(
            503,
            "SharePoint is not configured. Add the Microsoft Graph site, drive, and app credentials.",
        )

    async with httpx.AsyncClient(timeout=30) as client:
        token = await _get_graph_app_token(client)
        items = await _list_sharepoint_drive_items(client, token)

    videos = []
    for item in items:
        name = str(item.get("name", ""))
        mime_type = str(item.get("file", {}).get("mimeType", ""))
        if not (mime_type.startswith("video/") or name.lower().endswith(_VIDEO_EXTENSIONS)):
            continue
        video_metadata = item.get("video") or {}
        videos.append({
            "drive_item_id": item.get("id"),
            "name": name,
            "title": re.sub(r"\.[^.]+$", "", name),
            "web_url": item.get("webUrl"),
            "size": item.get("size"),
            "duration_seconds": round((video_metadata.get("duration") or 0) / 1000),
            "last_modified": item.get("lastModifiedDateTime"),
            "mime_type": mime_type,
        })

    videos.sort(key=lambda video: video.get("name", "").lower())
    return {"videos": videos}


@router.get("/videos/{video_id}/stream")
async def stream_sharepoint_video(
    video_id: int,
    ticket: str,
    db: Session = Depends(get_db),
):
    user_id = _decode_stream_ticket(ticket, video_id)
    assignment = db.query(VideoAssignment).filter(
        VideoAssignment.video_id == video_id,
        VideoAssignment.user_id == user_id,
    ).first()
    if not assignment:
        raise HTTPException(403, "This video is not assigned to the current user")

    video = db.query(VideoContent).filter(VideoContent.id == video_id).first()
    if not video or not _is_sharepoint_url(video.video_url):
        raise HTTPException(404, "SharePoint video not found")
    if not _sharepoint_is_configured():
        raise HTTPException(503, "SharePoint is not configured")

    async with httpx.AsyncClient(timeout=30) as client:
        graph_token = await _get_graph_app_token(client)
        download_url = await _resolve_sharepoint_download_url(
            client,
            graph_token,
            video.video_url,
        )
    return RedirectResponse(download_url, status_code=307)

@router.post("/videos")
def create_video(
    body: VideoCreate,
    db: Session = Depends(get_db),
    manager=Depends(require_role("manager")),
):
    existing = db.query(VideoContent).filter(VideoContent.video_url == body.video_url).first()
    if existing:
        existing.title = body.title
        existing.description = body.description
        db.commit()
        db.refresh(existing)
        return {"id": existing.id, "title": existing.title, "message": "Video already exists and was updated"}

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

    prompt_template = '''You are creating a professional LMS assessment.
Generate exactly {batch_size} multiple-choice questions for a training video titled "{title}".
{topic_context}
This is question batch {batch_number} of {batch_total}. Create distinct questions and avoid common generic wording.
Focus this batch on: {batch_focus}.

Rules:
- Every question must have exactly four clear options.
- Only one option may be correct.
- correct_index must be an integer from 0 to 3.
- Use US English and professional language.
- Return only valid JSON. Do not use Markdown or code fences.

Return this exact structure:
{{
  "questions": [
    {{
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 0
    }}
  ]
}}'''

    batch_total = VIDEO_QUIZ_POOL_SIZE // VIDEO_QUIZ_BATCH_SIZE
    batch_focuses = (
        "foundational facts and direct comprehension",
        "practical application and workplace scenarios",
        "detailed understanding, exceptions, and nuanced decisions",
    )
    batch_prompts = [
        prompt_template.format(
            batch_size=VIDEO_QUIZ_BATCH_SIZE,
            title=video.title,
            topic_context=f"Topic context: {video.description}" if video.description else "",
            batch_number=batch_number,
            batch_total=batch_total,
            batch_focus=batch_focuses[batch_number - 1],
        )
        for batch_number in range(1, batch_total + 1)
    ]
    batches = await asyncio.gather(*[
        _generate_video_quiz_with_openrouter(prompt, VIDEO_QUIZ_BATCH_SIZE)
        for prompt in batch_prompts
    ])
    questions_data = []
    seen_questions = set()
    for batch in batches:
        for question in batch:
            key = re.sub(r"\W+", " ", question["question"].lower()).strip()
            if key and key not in seen_questions:
                seen_questions.add(key)
                questions_data.append(question)

    if len(questions_data) < VIDEO_QUIZ_POOL_SIZE:
        raise HTTPException(502, "AI did not return 30 unique video quiz questions; please retry")

    # Replace existing questions and bump generation counter
    existing = db.query(VideoQuizQuestion).filter(VideoQuizQuestion.video_id == video_id).all()
    new_gen = (max(q.generation for q in existing) + 1) if existing else 1
    for q in existing:
        db.delete(q)
    db.flush()

    new_questions = []
    for item in questions_data[:VIDEO_QUIZ_POOL_SIZE]:
        question = VideoQuizQuestion(
            video_id=video_id,
            question_text=item.get("question", ""),
            options=item.get("options", []),
            correct_index=int(item.get("correct_index", 0)),
            generation=new_gen,
        )
        db.add(question)
        new_questions.append(question)
    db.flush()

    question_ids = [question.id for question in new_questions]
    for assignment in video.assignments:
        assignment.quiz_question_ids = _candidate_question_ids(question_ids)

    video.quiz_generated = True
    db.commit()
    return {
        "message": "Quiz pool generated",
        "question_count": len(question_ids),
        "questions_per_candidate": min(VIDEO_QUIZ_QUESTIONS_PER_CANDIDATE, len(question_ids)),
    }


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
    available_question_ids = [question.id for question in video.questions]
    created, updated = 0, 0

    for uid in body.user_ids:
        existing = db.query(VideoAssignment).filter(
            VideoAssignment.video_id == body.video_id,
            VideoAssignment.user_id == uid,
        ).first()
        if existing:
            if due_date:
                existing.due_date = due_date
            _valid_assignment_question_ids(existing, available_question_ids)
            updated += 1
        else:
            assignment = VideoAssignment(
                video_id=body.video_id,
                user_id=uid,
                assigned_by=manager.id,
                due_date=due_date,
                status="assigned",
                quiz_question_ids=_candidate_question_ids(available_question_ids),
            )
            db.add(assignment)
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
            all_questions = (
                db.query(VideoQuizQuestion)
                .filter(VideoQuizQuestion.video_id == a.video_id)
                .all()
            )
            questions_by_id = {question.id: question for question in all_questions}
            selected_ids = _valid_assignment_question_ids(
                a,
                list(questions_by_id.keys()),
            )
            qs = [questions_by_id[question_id] for question_id in selected_ids]
            questions = [
                {"id": q.id, "question_text": q.question_text, "options": q.options}
                for q in qs
            ]

        attempts = sorted(a.attempts, key=lambda x: x.attempt_number)
        latest = attempts[-1] if attempts else None
        retake_wait_seconds = 0
        retake_available_at = None
        if latest and latest.passed is False and latest.submitted_at:
            available_at = latest.submitted_at + timedelta(minutes=VIDEO_RETAKE_COOLDOWN_MINUTES)
            retake_wait_seconds = max(0, int((available_at - datetime.utcnow()).total_seconds()))
            retake_available_at = available_at.isoformat()

        result.append({
            "id": a.id,
            "video_id": a.video_id,
            "video_title": a.video.title if a.video else "—",
            "video_url": a.video.video_url if a.video else None,
            "stream_url": (
                f"/api/video-assignments/videos/{a.video_id}/stream?ticket="
                f"{quote(_create_stream_ticket(user.id, a.video_id), safe='')}"
                if a.video and _is_sharepoint_url(a.video.video_url)
                else None
            ),
            "video_description": a.video.description if a.video else None,
            "quiz_generated": a.video.quiz_generated if a.video else False,
            "due_date": a.due_date.isoformat() if a.due_date else None,
            "status": new_status,
            "progress_percent": a.progress_percent,
            "quiz_passed": a.quiz_passed,
            "attempt_count": len(a.attempts),
            "last_score": latest.score if latest else None,
            "last_passed": latest.passed if latest else None,
            "retake_wait_seconds": retake_wait_seconds,
            "retake_available_at": retake_available_at,
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
    latest_attempt = max(a.attempts, key=lambda attempt: attempt.attempt_number, default=None)
    if latest_attempt and latest_attempt.passed is False and latest_attempt.submitted_at:
        available_at = latest_attempt.submitted_at + timedelta(minutes=VIDEO_RETAKE_COOLDOWN_MINUTES)
        now = datetime.utcnow()
        if now < available_at:
            wait_seconds = max(1, int((available_at - now).total_seconds()))
            wait_minutes = (wait_seconds + 59) // 60
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "retake_cooldown",
                    "message": f"Retake available in {wait_minutes} minute(s).",
                    "wait_seconds": wait_seconds,
                    "available_at": available_at.isoformat(),
                },
            )

    all_questions = (
        db.query(VideoQuizQuestion)
        .filter(VideoQuizQuestion.video_id == a.video_id)
        .all()
    )
    questions_by_id = {question.id: question for question in all_questions}
    selected_ids = _valid_assignment_question_ids(a, list(questions_by_id.keys()))
    questions = [questions_by_id[question_id] for question_id in selected_ids]
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

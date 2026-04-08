import os, uuid, shutil
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session

from database import get_db
from models import User, AssessmentAssignment, AssessmentBankItem, Notification
from schemas import AssessmentAssignRequest, AssessmentAssignOut
from auth import get_current_user, require_role
from config import UPLOAD_DIR, OPENROUTER_API_KEY, MODEL_NAME

import httpx

router = APIRouter(prefix="/api/assessments", tags=["assessments"])

SUBMISSION_DIR = os.path.join(UPLOAD_DIR, "submissions")


async def _generate_ai_summary(filename: str, assessment_name: str, file_path: str = None, assessment_file_path: str = None) -> tuple[str, float]:
    """Call OpenRouter LLM to generate an AI review summary and score.
    
    Now reads BOTH the original assessment (questions) and the submitted file (answers)
    to compare and evaluate whether the learner actually answered the assessment.
    """

    def _read_file_content(fpath: str, max_chars: int = 3000) -> str:
        """Extract text from a file (PDF, DOCX, TXT, etc.)."""
        if not fpath or not os.path.exists(fpath):
            return ""
        try:
            ext = os.path.splitext(fpath)[1].lower()
            if ext == '.pdf':
                try:    
                    import PyPDF2
                    with open(fpath, 'rb') as f:
                        reader = PyPDF2.PdfReader(f)
                        text = ""
                        for page in reader.pages[:5]:
                            text += page.extract_text() or ""
                        if text.strip():
                            return text[:max_chars]
                except (ImportError, Exception):
                    pass
                try:
                    import pdfplumber
                    with pdfplumber.open(fpath) as pdf:
                        text = ""
                        for page in pdf.pages[:5]:
                            text += (page.extract_text() or "")
                        if text.strip():
                            return text[:max_chars]
                except (ImportError, Exception):
                    pass
                return f"[PDF file — content extraction unavailable]"
            elif ext in ('.doc', '.docx'):
                try:
                    import docx
                    doc = docx.Document(fpath)
                    text = "\n".join([p.text for p in doc.paragraphs[:50]])
                    return text[:max_chars]
                except ImportError:
                    return f"[Word file — content extraction unavailable]"
            elif ext in ('.txt', '.csv', '.md'):
                with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
                    return f.read(max_chars)
            elif ext in ('.xlsx', '.xls'):
                return f"[Excel spreadsheet submission]"
            else:
                return f"[Binary format file]"
        except Exception:
            return ""

    # Read submission content
    submission_content = _read_file_content(file_path)
    if not submission_content:
        submission_content = f"[File submitted: {filename}]"

    # Read original assessment content (questions)
    assessment_content = ""
    if assessment_file_path:
        # assessment_file_path is like "/uploads/assessments/abc.docx"
        abs_assess_path = os.path.join(UPLOAD_DIR, "..", assessment_file_path.lstrip("/"))
        abs_assess_path = os.path.normpath(abs_assess_path)
        assessment_content = _read_file_content(abs_assess_path)

    if not OPENROUTER_API_KEY:
        word_count = len(submission_content.split()) if submission_content else 0
        if word_count < 10:
            return ("⚠️ The submission appears to be empty or contains very little content. Please resubmit with a completed assessment.", 15.0)
        return (
            f"Assessment '{assessment_name}' reviewed. "
            f"The submission contains {word_count} words. "
            f"Manual review recommended for detailed feedback.", 65.0
        )
    
    # Build the evaluation prompt
    system_prompt = """You are a STRICT and FAIR assessment evaluator for an LMS training platform.

YOUR JOB: Compare the ORIGINAL ASSESSMENT (questions/tasks) with the LEARNER'S SUBMISSION (answers) and evaluate whether the learner has genuinely attempted and correctly answered the assessment.

CRITICAL RULES:
1. If the submission is NOT related to the assessment (e.g., a resume, random document, cover letter, unrelated content) → Score 0-15 and flag as INVALID.
2. If the submission is partially related but doesn't answer the actual questions → Score 15-40.
3. If the submission answers the questions but with errors/incomplete → Score 40-70.
4. Only give 70-85 for good, mostly correct answers.
5. Only give 85-100 for excellent, thorough, accurate answers.

SCORING BREAKDOWN (total 100):
- Content Relevance (0-30): Does the submission ACTUALLY answer the assessment questions? A resume or unrelated doc = 0.
- Completeness (0-25): Are ALL questions/tasks addressed? Missing answers = deduction.
- Quality & Accuracy (0-25): Are the answers correct? Grammar, accuracy matter.
- Authenticity (0-20): Is this genuine work? Detect: copy-paste, gibberish, template text, or files that don't match.

IMPORTANT: Be skeptical. Do NOT give high scores just because a document has lots of text. The text must be RELEVANT ANSWERS to the specific assessment questions.

Return ONLY valid JSON:
{"summary": "Detailed 3-5 sentence evaluation mentioning specific questions answered/missed and quality of answers. Keep it professional.", "score": 45, "authentic": true, "questions_answered": 3, "questions_total": 5}"""

    user_message = f"""Assessment Name: {assessment_name}

--- ORIGINAL ASSESSMENT (Questions/Tasks) ---
{assessment_content if assessment_content else "[Assessment file content not available — evaluate submission on its own merit but be strict about relevance to the assessment name]"}
--- END ASSESSMENT ---

--- LEARNER'S SUBMISSION ---
Submitted File: {filename}
{submission_content}
--- END SUBMISSION ---

Compare the submission against the assessment. Did the learner actually answer the questions? Score strictly."""

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}"},
                json={
                    "model": MODEL_NAME,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message}
                    ],
                },
            )
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            import json
            try:
                cleaned = content.strip()
                if cleaned.startswith("```"):
                    cleaned = cleaned.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
                parsed = json.loads(cleaned)
                summary = parsed.get("summary", content)
                score = float(parsed.get("score", 40))
                authentic = parsed.get("authentic", True)
                if not authentic:
                    summary = f"⚠️ FLAGGED: {summary}"
                    score = min(score, 25)  # Cap fake submissions
                return summary, score
            except Exception:
                return content[:500], 40.0
    except Exception as e:
        return f"AI Review of '{assessment_name}': Review completed with limited analysis. {str(e)[:80]}", 50.0


@router.post("/assign", response_model=AssessmentAssignOut)
def assign_assessment(
    req: AssessmentAssignRequest,
    manager: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
):
    target = db.query(User).filter(User.id == req.user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    file_path = None
    if req.assessment_bank_id:
        bank_item = db.query(AssessmentBankItem).filter(AssessmentBankItem.id == req.assessment_bank_id).first()
        if bank_item and bank_item.file_path:
            file_path = bank_item.file_path

    assignment = AssessmentAssignment(
        user_id=req.user_id,
        assigned_by=manager.id,
        assessment_name=req.assessment_name,
        assessment_file_path=file_path,
        assessment_type=req.assessment_type,
        target_area=req.target_area,
        note=req.note,
    )
    db.add(assignment)

    notif = Notification(
        user_id=req.user_id,
        title=f"New Assessment Assigned: {req.assessment_name}",
        message=f"{manager.name} assigned you assessment '{req.assessment_name}'.",
        type="assignment",
    )
    db.add(notif)
    db.commit()
    db.refresh(assignment)

    out = AssessmentAssignOut.model_validate(assignment)
    out.user_name = target.name
    out.assigner_name = manager.name
    out.user_role = target.role
    return out


@router.get("/my", response_model=list[AssessmentAssignOut])
def my_assessments(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(AssessmentAssignment).filter(
        AssessmentAssignment.user_id == user.id
    ).order_by(AssessmentAssignment.assigned_at.desc()).all()
    result = []
    for a in items:
        out = AssessmentAssignOut.model_validate(a)
        out.user_name = a.user.name
        out.assigner_name = a.assigner.name
        out.user_role = a.user.role
        result.append(out)
    return result


@router.get("/all", response_model=list[AssessmentAssignOut])
def all_assessments(
    manager: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
):
    items = db.query(AssessmentAssignment).order_by(AssessmentAssignment.assigned_at.desc()).all()
    result = []
    for a in items:
        out = AssessmentAssignOut.model_validate(a)
        out.user_name = a.user.name
        out.assigner_name = a.assigner.name
        out.user_role = a.user.role
        result.append(out)
    return result


@router.get("/assigned", response_model=list[AssessmentAssignOut])
def assigned_assessments(
    user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Get assessments assigned to a specific user (used by manager LearnerDetail)."""
    items = db.query(AssessmentAssignment).filter(
        AssessmentAssignment.user_id == user_id
    ).order_by(AssessmentAssignment.assigned_at.desc()).all()
    result = []
    for a in items:
        out = AssessmentAssignOut.model_validate(a)
        out.user_name = a.user.name
        out.assigner_name = a.assigner.name
        out.user_role = a.user.role
        result.append(out)
    return result


@router.patch("/{assignment_id}/status")
def update_status(
    assignment_id: int,
    status: str = Query(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    a = db.query(AssessmentAssignment).filter(AssessmentAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if status not in ("pending", "downloaded", "submitted", "reviewed"):
        raise HTTPException(status_code=400, detail="Invalid status")
    a.status = status
    db.commit()

    # Notify manager on status change
    if status == 'downloaded':
        managers = db.query(User).filter(User.role == 'manager').all()
        for m in managers:
            notif = Notification(
                user_id=m.id,
                title=f"Assessment Downloaded",
                message=f"📥 {user.name} downloaded assessment '{a.assessment_name}'",
                type="info",
            )
            db.add(notif)
        db.commit()
    return {"ok": True}


@router.post("/{assignment_id}/submit")
async def submit_assessment(
    assignment_id: int,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    a = db.query(AssessmentAssignment).filter(AssessmentAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if a.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your assignment")

    ext = os.path.splitext(file.filename)[1]
    fname = f"{user.id}_{assignment_id}_{uuid.uuid4().hex[:8]}{ext}"
    path = os.path.join(SUBMISSION_DIR, fname)
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    a.submission_path = f"/uploads/submissions/{fname}"
    a.submission_file = file.filename
    a.status = "submitted"
    a.submitted_at = datetime.utcnow()

    summary, score = await _generate_ai_summary(
        file.filename, a.assessment_name,
        file_path=path,
        assessment_file_path=a.assessment_file_path,
    )
    a.ai_summary = summary
    a.score = score

    db.commit()

    # Notify managers — simple one-liner
    managers = db.query(User).filter(User.role == "manager").all()
    for m in managers:
        notif = Notification(
            user_id=m.id,
            title=f"Assessment Submitted",
            message=f"📝 {user.name} submitted assessment '{a.assessment_name}'",
            type="assignment",
        )
        db.add(notif)
    db.commit()

    return {"ok": True, "submission_path": a.submission_path, "ai_summary": summary, "score": score}


@router.get("/{assignment_id}/report")
def get_assessment_report(
    assignment_id: int,
    db: Session = Depends(get_db),
):
    """Return detailed JSON report for a submitted/reviewed assessment (for PDF modal)."""
    a = db.query(AssessmentAssignment).filter(AssessmentAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")

    score = a.score or 0
    return {
        "id": a.id,
        "assessment_name": a.assessment_name,
        "user_name": a.user.name if a.user else "Unknown",
        "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
        "submission_file": a.submission_file,
        "score": score,
        "ai_summary": a.ai_summary,
        "breakdown": [
            {"label": "Content Relevance", "max": 30, "score": round(score * 0.30)},
            {"label": "Completeness", "max": 25, "score": round(score * 0.25)},
            {"label": "Quality & Accuracy", "max": 25, "score": round(score * 0.25)},
            {"label": "Authenticity", "max": 20, "score": round(score * 0.20)},
        ],
        "status": a.status,
    }

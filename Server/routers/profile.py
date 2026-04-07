from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
import os, uuid, shutil

from database import get_db
from models import User, Profile, InterviewSession
from schemas import ProfileCreate, ProfileOut, SkillGapOut
from auth import get_current_user
from config import UPLOAD_DIR

router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.get("/me", response_model=ProfileOut)
def get_my_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return ProfileOut.model_validate(profile)


@router.get("", response_model=ProfileOut)
def get_profile_alt(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Alias for /me — ProfileSetup uses GET /profile."""
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        # Auto-create empty profile
        profile = Profile(user_id=user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return ProfileOut.model_validate(profile)


@router.post("", response_model=ProfileOut)
def create_or_update_profile(req: ProfileCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if profile:
        if req.summary is not None:
            profile.summary = req.summary
        if req.learning_goals is not None:
            profile.learning_goals = req.learning_goals
    else:
        profile = Profile(user_id=user.id, summary=req.summary, learning_goals=req.learning_goals)
        db.add(profile)
    db.commit()
    db.refresh(profile)
    return ProfileOut.model_validate(profile)


@router.post("/resume")
def upload_resume(file: UploadFile = File(...), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ext = os.path.splitext(file.filename)[1]
    fname = f"{user.id}_{uuid.uuid4().hex[:8]}{ext}"
    path = os.path.join(UPLOAD_DIR, "resumes", fname)
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        profile = Profile(user_id=user.id, resume_path=f"/uploads/resumes/{fname}")
        db.add(profile)
    else:
        profile.resume_path = f"/uploads/resumes/{fname}"
    db.commit()
    return {"resume_path": f"/uploads/resumes/{fname}"}


@router.get("/me/skill-gaps", response_model=list[SkillGapOut])
def my_skill_gaps(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.query(InterviewSession).filter(
        InterviewSession.user_id == user.id,
        InterviewSession.status == "completed"
    ).order_by(InterviewSession.completed_at.desc()).first()
    if not session or not session.skill_gaps:
        return []
    return [SkillGapOut(**g) for g in session.skill_gaps]


@router.get("/{user_id}/skill-gaps", response_model=list[SkillGapOut])
def user_skill_gaps(user_id: int, db: Session = Depends(get_db)):
    session = db.query(InterviewSession).filter(
        InterviewSession.user_id == user_id,
        InterviewSession.status == "completed"
    ).order_by(InterviewSession.completed_at.desc()).first()
    if not session or not session.skill_gaps:
        return []
    return [SkillGapOut(**g) for g in session.skill_gaps]

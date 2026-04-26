from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import (
    User, Profile, AssessmentAssignment, UserCourse, CourseAssignment,
    CourseCompletion, InterviewSession, Notification
)
from schemas import UserCreate, UserUpdate, UserOut
from auth import hash_password, require_role

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    """List all users — accessible by any authenticated user (manager/admin use it)."""
    users = db.query(User).order_by(User.id).all()
    result = []
    for u in users:
        out = UserOut.model_validate(u)
        if u.manager:
            out.manager_name = u.manager.name
            out.manager_department = u.manager.department
        result.append(out)
    return result


@router.post("/users", response_model=UserOut)
def create_user(req: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already exists")
    user = User(
        name=req.name,
        email=req.email,
        password_hash=hash_password(req.password),
        plain_password=req.password,
        role=req.role,
        department=req.department,
        designation=req.designation,
        experience=req.experience,
        manager_id=req.manager_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Auto-notify new joiners whose manager is from Content dept — SME Kit is available
    if user.role == "new_joiner" and user.manager_id:
        manager = db.query(User).filter(User.id == user.manager_id).first()
        if manager and (manager.department or "").strip() == "Content":
            notif = Notification(
                user_id=user.id,
                title="📚 SME Kit Unlocked",
                message=(
                    f"Welcome! Because your manager {manager.name} is from the Content department, "
                    "you have access to the SME Kit (Spellbook) — your go-to resource library for content guidelines, "
                    "style guides, and references. Check it out from your sidebar!"
                ),
                type="info",
            )
            db.add(notif)
            db.commit()

    out = UserOut.model_validate(user)
    if user.manager:
        out.manager_name = user.manager.name
        out.manager_department = user.manager.department
    return out


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(user_id: int, req: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if req.name is not None:
        user.name = req.name
    if req.email is not None:
        existing = db.query(User).filter(User.email == req.email, User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already taken")
        user.email = req.email
    if req.password is not None:
        user.password_hash = hash_password(req.password)
        user.plain_password = req.password
    if req.role is not None:
        user.role = req.role
    if req.department is not None:
        user.department = req.department
    if req.designation is not None:
        user.designation = req.designation
    if req.experience is not None:
        user.experience = req.experience
    if req.manager_id is not None:
        user.manager_id = req.manager_id
    db.commit()
    db.refresh(user)
    out = UserOut.model_validate(user)
    if user.manager:
        out.manager_name = user.manager.name
        out.manager_department = user.manager.department
    return out


@router.post("/users/{user_id}/mark-ready")
def mark_ready(
    user_id: int,
    manager: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
):
    """Mark a new joiner as training-complete and ready for self-learning."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role != "new_joiner":
        raise HTTPException(status_code=400, detail="Only new joiners can be marked ready")

    user.is_ready = True
    db.add(Notification(
        user_id=user_id,
        title="🎓 You've Been Marked Ready!",
        message=(
            f"Congratulations! {manager.name} has marked you as training-complete. "
            "You have successfully finished your onboarding journey. "
            "Your personalized course recommendations are now available — keep learning and growing!"
        ),
        type="info",
    ))
    db.commit()
    return {"ok": True, "is_ready": True}


@router.post("/users/{user_id}/unmark-ready")
def unmark_ready(
    user_id: int,
    manager: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
):
    """Revert a new joiner's ready status."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_ready = False
    db.commit()
    return {"ok": True, "is_ready": False}


@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Null out manager_id for any users who report to this person
    db.query(User).filter(User.manager_id == user_id).update({"manager_id": None})

    # Delete all child records that FK-reference this user
    db.query(Notification).filter(Notification.user_id == user_id).delete()
    db.query(InterviewSession).filter(InterviewSession.user_id == user_id).delete()
    db.query(CourseCompletion).filter(CourseCompletion.user_id == user_id).delete()
    db.query(UserCourse).filter(UserCourse.user_id == user_id).delete()
    db.query(CourseAssignment).filter(
        (CourseAssignment.user_id == user_id) | (CourseAssignment.assigned_by == user_id)
    ).delete(synchronize_session=False)
    db.query(AssessmentAssignment).filter(
        (AssessmentAssignment.user_id == user_id) | (AssessmentAssignment.assigned_by == user_id)
    ).delete(synchronize_session=False)
    db.query(Profile).filter(Profile.user_id == user_id).delete()

    db.delete(user)
    db.commit()
    return {"ok": True}

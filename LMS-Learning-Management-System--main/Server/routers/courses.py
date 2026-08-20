import os, uuid, shutil
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session

from database import get_db
from models import User, UserCourse, CourseAssignment, CourseCompletion, Notification, AssessmentAssignment
from schemas import (
    CourseSaveRequest, UserCourseOut, CourseAssignOut,
    CourseCompletionOut,
)
from auth import get_current_user, require_role
from config import UPLOAD_DIR

router = APIRouter(prefix="/api/courses", tags=["courses"])

PROOF_DIR = os.path.join(UPLOAD_DIR, "proofs")


# ── User's own courses (employee panel) ──

@router.get("/my", response_model=list[UserCourseOut])
def my_courses(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(UserCourse).filter(UserCourse.user_id == user.id).order_by(UserCourse.created_at.desc()).all()
    return [UserCourseOut.model_validate(c) for c in items]


@router.get("/recommended", response_model=list[UserCourseOut])
def recommended_courses(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get courses recommended for the user (status='recommended')."""
    items = db.query(UserCourse).filter(
        UserCourse.user_id == user.id, UserCourse.status == "recommended"
    ).order_by(UserCourse.created_at.desc()).limit(10).all()
    return [UserCourseOut.model_validate(c) for c in items]


@router.post("/save", response_model=UserCourseOut)
def save_course(req: CourseSaveRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Prevent duplicates — check if user already saved this course
    existing = db.query(UserCourse).filter(
        UserCourse.user_id == user.id,
        UserCourse.title == req.title,
    ).first()
    if existing:
        # Update status if different (e.g. 'recommended' → 'saved')
        new_status = req.status or "saved"
        if existing.status != new_status:
            existing.status = new_status
            db.commit()
            db.refresh(existing)
        return UserCourseOut.model_validate(existing)

    course = UserCourse(
        user_id=user.id,
        course_id=req.course_id,
        title=req.title,
        provider=req.provider,
        link=req.link,
        status=req.status or "saved",
        category=req.category,
        tag=req.tag,
        duration=req.duration,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return UserCourseOut.model_validate(course)


@router.put("/my/{course_id}/start")
def start_course(course_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = db.query(UserCourse).filter(UserCourse.id == course_id, UserCourse.user_id == user.id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Course not found")
    c.status = "started"
    c.started_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.put("/my/{course_id}/complete")
def complete_course(
    course_id: int,
    file: UploadFile = File(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    c = db.query(UserCourse).filter(UserCourse.id == course_id, UserCourse.user_id == user.id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Course not found")
    c.status = "completed"
    c.completed_at = datetime.utcnow()
    if file:
        os.makedirs(PROOF_DIR, exist_ok=True)
        ext = os.path.splitext(file.filename)[1]
        fname = f"{user.id}_{course_id}_{uuid.uuid4().hex[:8]}{ext}"
        path = os.path.join(PROOF_DIR, fname)
        with open(path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        c.proof_path = f"/uploads/proofs/{fname}"
    db.commit()
    return {"ok": True}


@router.delete("/my/{course_id}")
def remove_course(course_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = db.query(UserCourse).filter(UserCourse.id == course_id, UserCourse.user_id == user.id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Course not found")
    db.delete(c)
    db.commit()
    return {"ok": True}


# ── Manager: view a specific user's courses ──

@router.get("/user/{user_id}", response_model=list[UserCourseOut])
def get_user_courses(
    user_id: int,
    manager: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
):
    """Return all courses for a specific user (manager / admin view)."""
    items = db.query(UserCourse).filter(
        UserCourse.user_id == user_id
    ).order_by(UserCourse.created_at.desc()).all()
    return [UserCourseOut.model_validate(c) for c in items]


# ── Course Assignments (manager → learner) ──


@router.get("/assignments", response_model=list[CourseAssignOut])
def list_my_assignments(
    user_id: int = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List course assignments — own if no user_id, or for specific user (manager view)."""
    target_id = user_id or user.id
    items = db.query(CourseAssignment).filter(
        CourseAssignment.user_id == target_id
    ).order_by(CourseAssignment.assigned_at.desc()).all()
    result = []
    for a in items:
        out = CourseAssignOut.model_validate(a)
        out.user_name = a.user.name
        out.assigner_name = a.assigner.name
        result.append(out)
    return result


# ── Course Completions (new joiner) ──

@router.get("/completions", response_model=list[CourseCompletionOut])
def list_completions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(CourseCompletion).filter(CourseCompletion.user_id == user.id).all()
    result = []
    for c in items:
        out = CourseCompletionOut.model_validate(c)
        out.user_name = c.user.name
        result.append(out)
    return result


@router.get("/completions/all", response_model=list[CourseCompletionOut])
def list_all_completions(
    manager: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
):
    items = db.query(CourseCompletion).order_by(CourseCompletion.submitted_at.desc()).all()
    result = []
    for c in items:
        out = CourseCompletionOut.model_validate(c)
        out.user_name = c.user.name
        out.user_role = c.user.role
        result.append(out)
    return result


@router.post("/completion", response_model=CourseCompletionOut)
def submit_completion(
    course_id: int = Form(...),
    course_title: str = Form(...),
    proof: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    os.makedirs(PROOF_DIR, exist_ok=True)
    ext = os.path.splitext(proof.filename)[1]
    fname = f"{user.id}_{course_id}_{uuid.uuid4().hex[:8]}{ext}"
    path = os.path.join(PROOF_DIR, fname)
    with open(path, "wb") as f:
        shutil.copyfileobj(proof.file, f)

    record = CourseCompletion(
        user_id=user.id,
        course_id=course_id,
        course_title=course_title,
        proof_path=f"/uploads/proofs/{fname}",
    )
    db.add(record)

    managers = db.query(User).filter(User.role == "manager").all()
    for m in managers:
        notif = Notification(
            user_id=m.id,
            title="Course Completed",
            message=f"✅ {user.name} completed course '{course_title}'",
            type="course_complete",
        )
        db.add(notif)
    db.commit()
    db.refresh(record)

    out = CourseCompletionOut.model_validate(record)
    out.user_name = user.name
    return out


# ── Learners list (for manager dashboard) ──

@router.get("/learners")
def list_learners(
    manager: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
):
    users = db.query(User).filter(User.role.in_(["new_joiner", "employee"])).all()
    result = []
    for u in users:
        completions = db.query(CourseCompletion).filter(CourseCompletion.user_id == u.id).count()
        assignments = db.query(CourseAssignment).filter(CourseAssignment.user_id == u.id).count()
        assessments_done = db.query(AssessmentAssignment).filter(
            AssessmentAssignment.user_id == u.id,
            AssessmentAssignment.status.in_(["submitted", "reviewed"])
        ).count()
        result.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "department": u.department,
            "courses_assigned": assignments,
            "courses_completed": completions,
            "assessments_completed": assessments_done,
        })
    return result

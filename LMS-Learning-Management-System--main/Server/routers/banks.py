import os, uuid, shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from database import get_db
from models import User, AssessmentBankItem, SmeKitFile, CourseBankItem, SmeKitAssignment
from schemas import (
    AssessmentBankCreate, AssessmentBankOut,
    SmeKitCreate, SmeKitOut,
    CourseBankCreate, CourseBankOut,
)
from auth import get_current_user, require_role
from config import UPLOAD_DIR

router = APIRouter(prefix="/api/banks", tags=["banks"])


# ── Assessment Bank ──

@router.get("/assessments", response_model=list[AssessmentBankOut])
def list_assessment_bank(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(AssessmentBankItem)
    # Managers see only their own uploads; admins see all
    if user.role == "manager":
        query = query.filter(AssessmentBankItem.uploaded_by == user.id)
    return [AssessmentBankOut.model_validate(a) for a in query.order_by(AssessmentBankItem.id).all()]


@router.post("/assessments", response_model=AssessmentBankOut)
def upload_assessment(
    file: UploadFile = File(None),
    name: str = Form(""),
    difficulty: str = Form("Intermediate"),
    file_type: str = Form("Word"),
    manager: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
):
    file_path = None
    actual_file_type = file_type
    if file:
        ext = os.path.splitext(file.filename)[1]
        fname = f"{uuid.uuid4().hex[:8]}_{file.filename}"
        assess_dir = os.path.join(UPLOAD_DIR, "assessments")
        os.makedirs(assess_dir, exist_ok=True)
        path = os.path.join(assess_dir, fname)
        with open(path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        file_path = f"/uploads/assessments/{fname}"
        actual_file_type = ext.lstrip(".").upper() or file_type

    item = AssessmentBankItem(
        name=name or (file.filename if file else "Untitled"),
        difficulty=difficulty,
        file_type=actual_file_type,
        file_path=file_path,
        uploaded_by=manager.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return AssessmentBankOut.model_validate(item)


@router.delete("/assessments/{item_id}")
def delete_assessment(
    item_id: int,
    manager: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
):
    item = db.query(AssessmentBankItem).filter(AssessmentBankItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


# ── SME Kit ──

@router.get("/smekit", response_model=list[SmeKitOut])
@router.get("/sme-kit", response_model=list[SmeKitOut])
def list_sme_kit(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(SmeKitFile)
    if user.role == "manager":
        # Only Content dept managers can access SME Kit
        if (user.department or "").strip() != "Content":
            return []
        query = query.filter(SmeKitFile.uploaded_by == user.id)
    elif user.role == "new_joiner":
        # Only new joiners whose manager is from Content dept can see SME Kit
        if not user.manager_id:
            return []
        manager = db.query(User).filter(User.id == user.manager_id).first()
        if not manager or (manager.department or "").strip() != "Content":
            return []
        query = query.filter(SmeKitFile.uploaded_by == user.manager_id)
    # Admins see all
    return [SmeKitOut.model_validate(s) for s in query.order_by(SmeKitFile.id).all()]


@router.post("/smekit", response_model=SmeKitOut)
@router.post("/sme-kit", response_model=SmeKitOut)
def upload_sme_kit(
    file: UploadFile = File(None),
    name: str = Form(""),
    category: str = Form("Style Guide"),
    file_type: str = Form("PDF"),
    manager: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
):
    if manager.role == "manager" and (manager.department or "").strip() != "Content":
        raise HTTPException(status_code=403, detail="Only Content department managers can upload SME Kit files.")
    file_path = None
    actual_file_type = file_type
    if file:
        ext = os.path.splitext(file.filename)[1]
        fname = f"{uuid.uuid4().hex[:8]}_{file.filename}"
        sme_dir = os.path.join(UPLOAD_DIR, "smekit")
        os.makedirs(sme_dir, exist_ok=True)
        path = os.path.join(sme_dir, fname)
        with open(path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        file_path = f"/uploads/smekit/{fname}"
        actual_file_type = ext.lstrip(".").upper() or file_type

    item = SmeKitFile(
        name=name or (file.filename if file else "Untitled"),
        category=category,
        file_type=actual_file_type,
        file_path=file_path,
        uploaded_by=manager.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return SmeKitOut.model_validate(item)


@router.delete("/smekit/{item_id}")
@router.delete("/sme-kit/{item_id}")
def delete_sme_kit(
    item_id: int,
    manager: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
):
    item = db.query(SmeKitFile).filter(SmeKitFile.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


# ── SME Kit Assignments ──

class SmeKitAssignRequest(BaseModel):
    file_id: int
    user_id: int


class SmeKitAssignmentOut(BaseModel):
    id: int
    file_id: int
    user_id: int
    assigned_by: int
    assigned_at: Optional[datetime] = None
    file_name: Optional[str] = None
    file_path: Optional[str] = None
    file_type: Optional[str] = None
    category: Optional[str] = None
    learner_name: Optional[str] = None

    class Config:
        from_attributes = True


@router.post("/smekit/assign")
def assign_sme_kit(
    req: SmeKitAssignRequest,
    manager: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
):
    """Content manager assigns a specific SME Kit file to a new joiner."""
    if manager.role == "manager" and (manager.department or "").strip() != "Content":
        raise HTTPException(status_code=403, detail="Only Content department managers can assign SME Kit files.")

    # Prevent duplicate assignments
    existing = db.query(SmeKitAssignment).filter(
        SmeKitAssignment.file_id == req.file_id,
        SmeKitAssignment.user_id == req.user_id,
    ).first()
    if existing:
        return {"ok": True, "duplicate": True}

    assignment = SmeKitAssignment(
        file_id=req.file_id,
        user_id=req.user_id,
        assigned_by=manager.id,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return {"ok": True, "id": assignment.id}


@router.delete("/smekit/assign/{assignment_id}")
def unassign_sme_kit(
    assignment_id: int,
    manager: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
):
    """Remove an SME Kit assignment."""
    assignment = db.query(SmeKitAssignment).filter(SmeKitAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(assignment)
    db.commit()
    return {"ok": True}


@router.get("/smekit/assignments")
def list_sme_kit_assignments(
    manager: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
):
    """Manager sees all SME Kit assignments they made."""
    assignments = db.query(SmeKitAssignment).filter(
        SmeKitAssignment.assigned_by == manager.id
    ).order_by(SmeKitAssignment.assigned_at.desc()).all()

    result = []
    for a in assignments:
        result.append({
            "id": a.id,
            "file_id": a.file_id,
            "user_id": a.user_id,
            "assigned_by": a.assigned_by,
            "assigned_at": a.assigned_at,
            "file_name": a.file.name if a.file else None,
            "file_path": a.file.file_path if a.file else None,
            "file_type": a.file.file_type if a.file else None,
            "category": a.file.category if a.file else None,
            "learner_name": a.user.name if a.user else None,
        })
    return result


@router.get("/smekit/my-assigned")
def get_my_assigned_sme_kit(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """New joiner gets only the SME Kit files assigned to them."""
    assignments = db.query(SmeKitAssignment).filter(
        SmeKitAssignment.user_id == user.id
    ).order_by(SmeKitAssignment.assigned_at.desc()).all()

    result = []
    for a in assignments:
        if a.file:
            result.append({
                "id": a.file.id,
                "name": a.file.name,
                "category": a.file.category,
                "file_type": a.file.file_type,
                "file_path": a.file.file_path,
                "uploaded_by": a.file.uploaded_by,
                "created_at": a.file.created_at,
                "assignment_id": a.id,
                "assigned_at": a.assigned_at,
            })
    return result


# ── Course Bank ──

@router.get("/courses", response_model=list[CourseBankOut])
def list_course_bank(db: Session = Depends(get_db)):
    return [CourseBankOut.model_validate(c) for c in db.query(CourseBankItem).order_by(CourseBankItem.id).all()]


@router.post("/courses", response_model=CourseBankOut)
def add_course(
    req: CourseBankCreate,
    manager: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
):
    item = CourseBankItem(**req.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return CourseBankOut.model_validate(item)


@router.delete("/courses/{item_id}")
def delete_course(
    item_id: int,
    manager: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
):
    item = db.query(CourseBankItem).filter(CourseBankItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(item)
    db.commit()
    return {"ok": True}

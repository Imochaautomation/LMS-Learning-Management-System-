"""
SME Kit management + assignment routes.

GET    /training/kits                  — list all kits (manager sees own, admin sees all)
POST   /training/kits                  — create kit
GET    /training/kits/{kit_id}         — kit detail with files
DELETE /training/kits/{kit_id}         — delete kit
POST   /training/kits/{kit_id}/files   — upload document to kit
POST   /training/kits/{kit_id}/youtube — add YouTube link (+ optional transcript)
DELETE /training/kits/{kit_id}/files/{file_id} — remove file from kit
POST   /training/kits/assign           — assign kit to new joiner
GET    /training/assignments/mine      — new joiner: get their assigned kits
GET    /training/assignments           — manager: list all assignments they made
"""

import os
import shutil
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from database import SessionLocal
from auth import get_current_user, require_role
from models import User, SmeKit, SmeKitFileV2, SmeKitAssignmentV2
from schemas import SmeKitCreateV2, SmeKitOut, SmeKitFileOut, SmeKitAssignRequest, SmeKitAssignmentOut
from config import UPLOAD_DIR

router = APIRouter(prefix="/api/training", tags=["training-smekit"])

SMEKIT_DIR = os.path.join(UPLOAD_DIR, "smekit_v2")
os.makedirs(SMEKIT_DIR, exist_ok=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _kit_out(kit: SmeKit) -> dict:
    return {
        "id": kit.id,
        "name": kit.name,
        "description": kit.description,
        "department": kit.department,
        "sub_department": kit.sub_department,
        "created_by": kit.created_by,
        "creator_name": kit.creator.name if kit.creator else None,
        "created_at": kit.created_at,
        "files": [_file_out(f) for f in kit.files],
        "file_count": len(kit.files),
    }


def _file_out(f: SmeKitFileV2) -> dict:
    return {
        "id": f.id,
        "sme_kit_id": f.sme_kit_id,
        "name": f.name,
        "file_type": f.file_type,
        "file_path": f.file_path,
        "youtube_url": f.youtube_url,
        "transcript": f.transcript,
        "uploaded_by": f.uploaded_by,
        "created_at": f.created_at,
    }


# ── Kit CRUD ─────────────────────────────────────────────────────────────────

@router.get("/kits", response_model=List[dict])
def list_kits(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager", "admin")),
):
    q = db.query(SmeKit)
    if current_user.role == "manager":
        q = q.filter(SmeKit.created_by == current_user.id)
    kits = q.order_by(SmeKit.created_at.desc()).all()
    return [_kit_out(k) for k in kits]


@router.post("/kits", response_model=dict)
def create_kit(
    payload: SmeKitCreateV2,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager", "admin")),
):
    kit = SmeKit(
        name=payload.name,
        description=payload.description,
        department=payload.department or current_user.department,
        sub_department=payload.sub_department,
        created_by=current_user.id,
    )
    db.add(kit)
    db.commit()
    db.refresh(kit)
    return _kit_out(kit)


@router.get("/kits/{kit_id}", response_model=dict)
def get_kit(
    kit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager", "admin", "new_joiner")),
):
    kit = db.query(SmeKit).filter(SmeKit.id == kit_id).first()
    if not kit:
        raise HTTPException(404, "Kit not found")
    if current_user.role == "manager" and kit.created_by != current_user.id:
        raise HTTPException(403, "Not your kit")
    return _kit_out(kit)


@router.delete("/kits/{kit_id}")
def delete_kit(
    kit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager", "admin")),
):
    kit = db.query(SmeKit).filter(SmeKit.id == kit_id).first()
    if not kit:
        raise HTTPException(404, "Kit not found")
    if current_user.role == "manager" and kit.created_by != current_user.id:
        raise HTTPException(403, "Not your kit")
    db.delete(kit)
    db.commit()
    return {"ok": True}


# ── File / YouTube in kit ────────────────────────────────────────────────────

@router.post("/kits/{kit_id}/files", response_model=dict)
async def upload_kit_file(
    kit_id: int,
    file: UploadFile = File(...),
    transcript: str = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager", "admin")),
):
    kit = db.query(SmeKit).filter(SmeKit.id == kit_id).first()
    if not kit:
        raise HTTPException(404, "Kit not found")
    if current_user.role == "manager" and kit.created_by != current_user.id:
        raise HTTPException(403, "Not your kit")

    kit_dir = os.path.join(SMEKIT_DIR, str(kit_id))
    os.makedirs(kit_dir, exist_ok=True)
    dest = os.path.join(kit_dir, file.filename)
    with open(dest, "wb") as fout:
        shutil.copyfileobj(file.file, fout)

    ext = os.path.splitext(file.filename)[1].lower()
    file_type = "video" if ext in (".mp4", ".webm", ".mov") else "document"

    kit_file = SmeKitFileV2(
        sme_kit_id=kit_id,
        name=file.filename,
        file_type=file_type,
        file_path=f"smekit_v2/{kit_id}/{file.filename}",
        transcript=transcript,
        uploaded_by=current_user.id,
    )
    db.add(kit_file)
    db.commit()
    db.refresh(kit_file)
    return _file_out(kit_file)


@router.post("/kits/{kit_id}/youtube", response_model=dict)
def add_youtube_link(
    kit_id: int,
    name: str = Form(...),
    youtube_url: str = Form(...),
    transcript: str = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager", "admin")),
):
    kit = db.query(SmeKit).filter(SmeKit.id == kit_id).first()
    if not kit:
        raise HTTPException(404, "Kit not found")
    if current_user.role == "manager" and kit.created_by != current_user.id:
        raise HTTPException(403, "Not your kit")

    kit_file = SmeKitFileV2(
        sme_kit_id=kit_id,
        name=name,
        file_type="youtube",
        youtube_url=youtube_url,
        transcript=transcript,
        uploaded_by=current_user.id,
    )
    db.add(kit_file)
    db.commit()
    db.refresh(kit_file)
    return _file_out(kit_file)


@router.patch("/kits/{kit_id}/files/{file_id}", response_model=dict)
def update_kit_file(
    kit_id: int,
    file_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager", "admin")),
):
    f = db.query(SmeKitFileV2).filter(
        SmeKitFileV2.id == file_id,
        SmeKitFileV2.sme_kit_id == kit_id,
    ).first()
    if not f:
        raise HTTPException(404, "File not found")
    kit = db.query(SmeKit).filter(SmeKit.id == kit_id).first()
    if current_user.role == "manager" and kit and kit.created_by != current_user.id:
        raise HTTPException(403, "Not your kit")

    if "name" in payload and payload["name"]:
        f.name = payload["name"]
    if "youtube_url" in payload:
        f.youtube_url = payload["youtube_url"] or None
    if "transcript" in payload:
        f.transcript = payload["transcript"] or None
    db.commit()
    db.refresh(f)
    return _file_out(f)


@router.delete("/kits/{kit_id}/files/{file_id}")
def delete_kit_file(
    kit_id: int,
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager", "admin")),
):
    f = db.query(SmeKitFileV2).filter(
        SmeKitFileV2.id == file_id,
        SmeKitFileV2.sme_kit_id == kit_id,
    ).first()
    if not f:
        raise HTTPException(404, "File not found")
    kit = db.query(SmeKit).filter(SmeKit.id == kit_id).first()
    if current_user.role == "manager" and kit and kit.created_by != current_user.id:
        raise HTTPException(403, "Not your kit")

    if f.file_path:
        try:
            os.remove(os.path.join(UPLOAD_DIR, f.file_path))
        except OSError:
            pass
    db.delete(f)
    db.commit()
    return {"ok": True}


# ── Kit assignments ──────────────────────────────────────────────────────────

@router.post("/kits/assign", response_model=dict)
def assign_kit(
    payload: SmeKitAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager", "admin")),
):
    kit = db.query(SmeKit).filter(SmeKit.id == payload.sme_kit_id).first()
    if not kit:
        raise HTTPException(404, "Kit not found")
    assignee = db.query(User).filter(User.id == payload.user_id).first()
    if not assignee:
        raise HTTPException(404, "User not found")

    existing = db.query(SmeKitAssignmentV2).filter(
        SmeKitAssignmentV2.sme_kit_id == payload.sme_kit_id,
        SmeKitAssignmentV2.user_id == payload.user_id,
    ).first()
    if existing:
        raise HTTPException(409, "Kit already assigned to this user")

    a = SmeKitAssignmentV2(
        sme_kit_id=payload.sme_kit_id,
        user_id=payload.user_id,
        assigned_by=current_user.id,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return {
        "id": a.id,
        "sme_kit_id": a.sme_kit_id,
        "user_id": a.user_id,
        "assigned_by": a.assigned_by,
        "assigned_at": a.assigned_at,
        "kit_name": kit.name,
        "user_name": assignee.name,
    }


@router.get("/assignments/mine", response_model=List[dict])
def my_assigned_kits(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("new_joiner")),
):
    assignments = (
        db.query(SmeKitAssignmentV2)
        .filter(SmeKitAssignmentV2.user_id == current_user.id)
        .all()
    )
    result = []
    for a in assignments:
        kit = db.query(SmeKit).filter(SmeKit.id == a.sme_kit_id).first()
        result.append({
            "id": a.id,
            "sme_kit_id": a.sme_kit_id,
            "assigned_at": a.assigned_at,
            "kit": _kit_out(kit) if kit else None,
        })
    return result


@router.get("/assignments", response_model=List[dict])
def list_assignments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager", "admin")),
):
    q = db.query(SmeKitAssignmentV2)
    if current_user.role == "manager":
        q = q.filter(SmeKitAssignmentV2.assigned_by == current_user.id)
    assignments = q.order_by(SmeKitAssignmentV2.assigned_at.desc()).all()
    result = []
    for a in assignments:
        kit = db.query(SmeKit).filter(SmeKit.id == a.sme_kit_id).first()
        user = db.query(User).filter(User.id == a.user_id).first()
        result.append({
            "id": a.id,
            "sme_kit_id": a.sme_kit_id,
            "user_id": a.user_id,
            "assigned_by": a.assigned_by,
            "assigned_at": a.assigned_at,
            "kit_name": kit.name if kit else None,
            "user_name": user.name if user else None,
        })
    return result

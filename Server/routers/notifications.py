from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session

from database import get_db
from models import User, Notification
from schemas import NotificationOut
from auth import get_current_user

router = APIRouter(prefix="/api", tags=["notifications"])


@router.get("/notifications", response_model=list[NotificationOut])
def list_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return [
        NotificationOut.model_validate(n)
        for n in db.query(Notification)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(200)
        .all()
    ]


@router.post("/courses/notifications/{notif_id}/read")
def mark_read_compat(notif_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Compat endpoint — UI calls POST /courses/notifications/{id}/read."""
    n = db.query(Notification).filter(Notification.id == notif_id, Notification.user_id == user.id).first()
    if n:
        n.read = True
        db.commit()
    return {"ok": True}


@router.post("/notifications/bulk-read")
def bulk_mark_read(ids: list[int] = Body(...), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Mark multiple notifications as read."""
    db.query(Notification).filter(
        Notification.id.in_(ids),
        Notification.user_id == user.id,
    ).update({Notification.read: True}, synchronize_session="fetch")
    db.commit()
    return {"ok": True, "count": len(ids)}


@router.post("/notifications/bulk-delete")
def bulk_delete(ids: list[int] = Body(...), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Delete multiple notifications."""
    count = db.query(Notification).filter(
        Notification.id.in_(ids),
        Notification.user_id == user.id,
    ).delete(synchronize_session="fetch")
    db.commit()
    return {"ok": True, "count": count}


@router.delete("/notifications/{notif_id}")
def delete_notification(notif_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Delete a single notification."""
    n = db.query(Notification).filter(Notification.id == notif_id, Notification.user_id == user.id).first()
    if n:
        db.delete(n)
        db.commit()
    return {"ok": True}

"""Notifications management router."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models import Notification, User, get_db
from schemas import NotificationOut
from auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get("", response_model=list[NotificationOut])
def list_my_notifications(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    notifs = db.query(Notification).filter(
        Notification.user_id == user.id
    ).order_by(Notification.created_at.desc()).limit(30).all()
    return notifs


@router.put("/{notif_id}/read")
def mark_notification_read(
    notif_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    notif = db.query(Notification).filter(
        Notification.id == notif_id,
        Notification.user_id == user.id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="الإشعار غير موجود")
    notif.is_read = True
    db.commit()
    return {"message": "تم تحديث الإشعار كـ مقروء"}


@router.put("/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    db.query(Notification).filter(
        Notification.user_id == user.id,
        Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"message": "تم تحديد جميع الإشعارات كمقروءة"}

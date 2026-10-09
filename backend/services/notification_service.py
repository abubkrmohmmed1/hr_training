"""Notification service for dispatching and reading user alerts."""
from sqlalchemy.orm import Session
from models import Notification, User


def send_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    link: str | None = None
) -> Notification:
    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        link=link,
        is_read=False
    )
    db.add(notif)
    db.flush()
    return notif


def notify_user_or_role(
    db: Session,
    role: str,
    title: str,
    message: str,
    link: str | None = None
) -> list[Notification]:
    users = db.query(User).filter(User.role == role, User.is_active == True).all()
    created = []
    for u in users:
        created.append(send_notification(db, u.id, title, message, link))
    return created

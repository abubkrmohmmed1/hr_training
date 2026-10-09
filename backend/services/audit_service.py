"""Audit log service for recording immutable audit entries."""
from sqlalchemy.orm import Session
from models import AuditLog, User


def log_action(
    db: Session,
    user: User | None,
    action: str,
    entity: str,
    entity_id: int | None = None,
    details: str | None = None
) -> AuditLog:
    user_id = user.id if user else None
    log_entry = AuditLog(
        user_id=user_id,
        action=action,
        entity=entity,
        entity_id=entity_id,
        details=details
    )
    db.add(log_entry)
    db.flush()
    return log_entry

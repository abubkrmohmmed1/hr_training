"""Audit logs route (read-only, Admin restricted)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from models import AuditLog, User, get_db
from auth import require_role

router = APIRouter(prefix="/api/audit-logs", tags=["Audit Logs"])


@router.get("")
def list_audit_logs(db: Session = Depends(get_db), user: User = Depends(require_role("admin"))):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(50).all()
    result = []
    for log in logs:
        actor = db.query(User).filter(User.id == log.user_id).first() if log.user_id else None
        result.append({
            "id": log.id,
            "user_name": actor.name if actor else "النظام",
            "action": log.action,
            "entity": log.entity,
            "entity_id": log.entity_id,
            "details": log.details,
            "created_at": str(log.created_at) if log.created_at else None,
        })
    return result

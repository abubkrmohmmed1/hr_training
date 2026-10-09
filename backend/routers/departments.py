"""Department management routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models import Department, User, get_db
from schemas import DepartmentCreate, DepartmentOut
from auth import get_current_user, require_role
from services.audit_service import log_action

router = APIRouter(prefix="/api/departments", tags=["Departments"])


@router.get("", response_model=list[DepartmentOut])
def list_departments(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [DepartmentOut.model_validate(d) for d in db.query(Department).all()]


@router.post("", response_model=DepartmentOut)
def create_department(
    req: DepartmentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin", "hr"))
):
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="اسم القسم مطلوب")
    existing = db.query(Department).filter(Department.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="القسم موجود مسبقاً")
    dept = Department(name=name, description=req.description)
    db.add(dept)
    log_action(db, user, "create_department", "department", None, f"إنشاء قسم {name}")
    db.commit()
    db.refresh(dept)
    return DepartmentOut.model_validate(dept)

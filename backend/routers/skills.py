"""Skill library and employee skill profile routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models import Employee, EmployeeSkill, Skill, User, get_db
from schemas import SkillCreate, SkillOut
from auth import get_current_user, require_role
from services.audit_service import log_action

router = APIRouter(tags=["Skills"])


@router.get("/api/skills", response_model=list[SkillOut])
def list_skills(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [SkillOut.model_validate(s) for s in db.query(Skill).all()]


@router.post("/api/skills", response_model=SkillOut)
def create_skill(
    req: SkillCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin", "hr"))
):
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="اسم المهارة مطلوب")
    existing = db.query(Skill).filter(Skill.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="المهارة موجودة مسبقاً")

    weight = max(0.5, min(3.0, req.weight or 1.0))
    skill = Skill(
        name=name,
        category=req.category or "تقنية",
        description=req.description,
        max_level=req.max_level or 5,
        weight=weight,
    )
    db.add(skill)
    db.flush()

    employees = db.query(Employee).all()
    for emp in employees:
        db.add(EmployeeSkill(
            employee_id=emp.id,
            skill_id=skill.id,
            current_level=0,
            target_level=skill.max_level or 5,
        ))

    log_action(db, user, "create_skill", "skill", skill.id, f"إضافة مهارة: {name} بوزن {weight}")
    db.commit()
    db.refresh(skill)
    return SkillOut.model_validate(skill)


@router.get("/api/employees/{emp_id}/skills")
def get_employee_skills(emp_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")

    # Privacy check
    if user.role == "employee" and emp.user_id != user.id:
        raise HTTPException(status_code=403, detail="غير مصرح لك بعرض مهارات موظف آخر")
    if user.role == "manager":
        manager = db.query(Employee).filter(Employee.user_id == user.id).first()
        if not manager or emp.manager_id != manager.id:
            raise HTTPException(status_code=403, detail="غير مصرح لك بعرض مهارات موظف خارج فريقك")

    emp_skills = db.query(EmployeeSkill).filter(EmployeeSkill.employee_id == emp_id).all()
    result = []
    for es in emp_skills:
        result.append({
            "id": es.id,
            "employee_id": es.employee_id,
            "skill_id": es.skill_id,
            "current_level": es.current_level,
            "target_level": es.target_level,
            "assessed_date": str(es.assessed_date) if es.assessed_date else None,
            "skill_name": es.skill.name if es.skill else None,
            "skill_category": es.skill.category if es.skill else None,
            "weight": getattr(es.skill, "weight", 1.0) if es.skill else 1.0,
        })
    return result

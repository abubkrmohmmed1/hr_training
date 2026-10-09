"""Employee management and team hierarchy routes."""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models import (
    Assessment, Department, Employee, EmployeeSkill,
    Skill, TrainingPlan, User, get_db
)
from schemas import EmployeeCreate, EmployeeUpdate
from auth import get_current_user, hash_password, require_role
from services.audit_service import log_action
from ai_engine import employee_actual_impact

router = APIRouter(prefix="/api/employees", tags=["Employees"])

ALLOWED_ROLES = {"admin", "hr", "manager", "employee"}


def employee_payload(emp: Employee) -> dict:
    return {
        "id": emp.id,
        "user_id": emp.user_id,
        "department_id": emp.department_id,
        "manager_id": emp.manager_id,
        "position": emp.position,
        "hire_date": str(emp.hire_date) if emp.hire_date else None,
        "phone": emp.phone,
        "user_name": emp.user.name if emp.user else None,
        "user_email": emp.user.email if emp.user else None,
        "user_role": emp.user.role if emp.user else None,
        "user_active": emp.user.is_active if emp.user else None,
        "department_name": emp.department.name if emp.department else None,
    }


@router.get("")
def list_employees(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role in ("admin", "hr"):
        employees = db.query(Employee).all()
    elif user.role == "manager":
        mgr_emp = db.query(Employee).filter(Employee.user_id == user.id).first()
        if not mgr_emp:
            return []
        employees = db.query(Employee).filter((Employee.manager_id == mgr_emp.id) | (Employee.id == mgr_emp.id)).all()
    else:
        # employee only sees themselves
        emp = db.query(Employee).filter(Employee.user_id == user.id).first()
        employees = [emp] if emp else []
    return [employee_payload(emp) for emp in employees]


@router.post("")
def create_employee(
    req: EmployeeCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin", "hr"))
):
    name = req.name.strip()
    email = req.email.strip().lower()
    if not name or not email:
        raise HTTPException(status_code=400, detail="الاسم والبريد مطلوبان")
    if req.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="دور غير صالح")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="البريد الإلكتروني مستخدم مسبقاً")
    if req.department_id and not db.query(Department).filter(Department.id == req.department_id).first():
        raise HTTPException(status_code=400, detail="القسم غير موجود")
    if req.manager_id and not db.query(Employee).filter(Employee.id == req.manager_id).first():
        raise HTTPException(status_code=400, detail="المدير غير موجود")

    new_user = User(
        name=name,
        email=email,
        password_hash=hash_password(req.password or "123456"),
        role=req.role,
        is_active=True,
    )
    db.add(new_user)
    db.flush()

    emp = Employee(
        user_id=new_user.id,
        department_id=req.department_id,
        manager_id=req.manager_id,
        position=req.position,
        hire_date=req.hire_date or date.today(),
        phone=req.phone,
    )
    db.add(emp)
    db.flush()

    skills = db.query(Skill).all()
    for skill in skills:
        db.add(EmployeeSkill(
            employee_id=emp.id,
            skill_id=skill.id,
            current_level=0,
            target_level=skill.max_level or 5,
        ))

    log_action(db, user, "create_employee", "employee", emp.id, f"إضافة موظف: {name}")
    db.commit()
    db.refresh(emp)
    return employee_payload(emp)


@router.put("/{emp_id}")
def update_employee(
    emp_id: int,
    req: EmployeeUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin", "hr"))
):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp or not emp.user:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    if req.name:
        emp.user.name = req.name.strip()
    if req.email:
        email = req.email.strip().lower()
        taken = db.query(User).filter(User.email == email, User.id != emp.user_id).first()
        if taken:
            raise HTTPException(status_code=400, detail="البريد الإلكتروني مستخدم مسبقاً")
        emp.user.email = email
    if req.password:
        emp.user.password_hash = hash_password(req.password)
    if req.role:
        if req.role not in ALLOWED_ROLES:
            raise HTTPException(status_code=400, detail="دور غير صالح")
        emp.user.role = req.role
    if req.is_active is not None:
        emp.user.is_active = req.is_active
    if req.department_id is not None:
        if req.department_id and not db.query(Department).filter(Department.id == req.department_id).first():
            raise HTTPException(status_code=400, detail="القسم غير موجود")
        emp.department_id = req.department_id or None
    if req.manager_id is not None:
        if req.manager_id == emp.id:
            raise HTTPException(status_code=400, detail="لا يمكن تعيين الموظف مديراً لنفسه")
        if req.manager_id and not db.query(Employee).filter(Employee.id == req.manager_id).first():
            raise HTTPException(status_code=400, detail="المدير غير موجود")
        emp.manager_id = req.manager_id or None
    if req.position is not None:
        emp.position = req.position
    if req.hire_date is not None:
        emp.hire_date = req.hire_date
    if req.phone is not None:
        emp.phone = req.phone

    log_action(db, user, "update_employee", "employee", emp.id, f"تعديل موظف: {emp.user.name}")
    db.commit()
    db.refresh(emp)
    return employee_payload(emp)


@router.get("/me/profile")
def get_my_profile(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    emp = db.query(Employee).filter(Employee.user_id == user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="لا يوجد ملف موظف")
    return {
        "id": emp.id,
        "user_name": user.name,
        "user_email": user.email,
        "role": user.role,
        "position": emp.position,
        "department_name": emp.department.name if emp.department else None,
    }


@router.get("/team/members")
def get_team(db: Session = Depends(get_db), user: User = Depends(require_role("manager"))):
    emp = db.query(Employee).filter(Employee.user_id == user.id).first()
    if not emp:
        return []
    members = db.query(Employee).filter(Employee.manager_id == emp.id).all()
    result = []
    for m in members:
        result.append({
            "id": m.id,
            "user_name": m.user.name if m.user else None,
            "position": m.position,
            "department_name": m.department.name if m.department else None,
        })
    return result


@router.get("/team/overview")
def team_overview(db: Session = Depends(get_db), user: User = Depends(require_role("manager"))):
    emp = db.query(Employee).filter(Employee.user_id == user.id).first()
    if not emp:
        return []
    members = db.query(Employee).filter(Employee.manager_id == emp.id).all()
    result = []
    for m in members:
        plans = db.query(TrainingPlan).filter(TrainingPlan.employee_id == m.id).all()
        enrollments = [e for p in plans for e in p.enrollments]
        completed = sum(1 for e in enrollments if e.status == "completed")
        total = len(enrollments)
        latest = db.query(Assessment).filter(Assessment.employee_id == m.id).order_by(Assessment.assessment_date.desc()).first()
        impact = employee_actual_impact(db, m.id)
        result.append({
            "id": m.id,
            "user_name": m.user.name if m.user else None,
            "position": m.position,
            "department_name": m.department.name if m.department else None,
            "latest_score": latest.total_score if latest else 0,
            "courses_total": total,
            "courses_completed": completed,
            "progress_percent": round((completed / total) * 100) if total else 0,
            "actual_gain": impact["actual_gain"],
        })
    return result


@router.get("/{emp_id}")
def get_employee(emp_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")

    # Privacy check
    if user.role == "employee" and emp.user_id != user.id:
        raise HTTPException(status_code=403, detail="غير مصرح لك بعرض بيانات موظف آخر")
    if user.role == "manager":
        mgr_emp = db.query(Employee).filter(Employee.user_id == user.id).first()
        if mgr_emp and emp.manager_id != mgr_emp.id and emp.id != mgr_emp.id:
            raise HTTPException(status_code=403, detail="غير مصرح لك بعرض بيانات موظف خارج فريقك")

    return employee_payload(emp)

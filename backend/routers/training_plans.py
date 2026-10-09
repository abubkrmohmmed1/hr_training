"""Training plans and enrollments lifecycle router."""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models import (
    Course, Employee, TrainingEnrollment, TrainingPlan, User, get_db
)
from schemas import (
    EnrollmentComplete, TrainingPlanCreate,
    TrainingPlanManagerApprove, TrainingPlanReject
)
from auth import get_current_user, require_role
from services.audit_service import log_action
from services.plan_service import (
    hr_approve_plan, manager_approve_plan, plan_payload,
    record_course_completion, refresh_plan_status, reject_plan, resubmit_plan
)

router = APIRouter(tags=["Training Plans"])


def enrollment_for_user(db: Session, enrollment_id: int, user: User) -> TrainingEnrollment:
    enrollment = db.query(TrainingEnrollment).filter(TrainingEnrollment.id == enrollment_id).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="التسجيل غير موجود")
    emp = db.query(Employee).filter(Employee.user_id == user.id).first()
    if user.role not in ("admin", "hr") and (not emp or enrollment.plan.employee_id != emp.id):
        raise HTTPException(status_code=403, detail="صلاحيات غير كافية")
    return enrollment


@router.get("/api/training-plans")
def list_plans(
    status: str = None,
    employee_id: int = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    q = db.query(TrainingPlan)
    if user.role == "employee":
        emp = db.query(Employee).filter(Employee.user_id == user.id).first()
        if not emp:
            return []
        q = q.filter(TrainingPlan.employee_id == emp.id)
    elif user.role == "manager":
        mgr_emp = db.query(Employee).filter(Employee.user_id == user.id).first()
        if not mgr_emp:
            return []
        team_ids = [m.id for m in db.query(Employee).filter(Employee.manager_id == mgr_emp.id).all()] + [mgr_emp.id]
        if employee_id:
            if employee_id not in team_ids:
                raise HTTPException(status_code=403, detail="لا يمكن استعراض خطط موظف خارج فريقك")
            q = q.filter(TrainingPlan.employee_id == employee_id)
        else:
            q = q.filter(TrainingPlan.employee_id.in_(team_ids))
    else:
        # admin or hr
        if employee_id:
            q = q.filter(TrainingPlan.employee_id == employee_id)

    if status:
        q = q.filter(TrainingPlan.status == status)

    plans = q.order_by(TrainingPlan.created_at.desc()).all()
    return [plan_payload(p) for p in plans]


@router.get("/api/training-plans/my")
def my_plans(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    emp = db.query(Employee).filter(Employee.user_id == user.id).first()
    if not emp:
        return {"plan": None, "enrollments": []}
    plan = (db.query(TrainingPlan)
            .filter(TrainingPlan.employee_id == emp.id)
            .order_by(TrainingPlan.created_at.desc()).first())
    if not plan:
        return {"plan": None, "enrollments": []}
    return plan_payload(plan)


@router.post("/api/training-plans")
def create_plan(
    req: TrainingPlanCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin", "hr"))
):
    emp = db.query(Employee).filter(Employee.id == req.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    if not req.course_ids:
        raise HTTPException(status_code=400, detail="يجب تحديد دورة واحدة على الأقل")

    courses = db.query(Course).filter(Course.id.in_(req.course_ids)).all()
    if len(courses) != len(req.course_ids):
        raise HTTPException(status_code=400, detail="إحدى الدورات المحددة غير موجودة")

    estimated_budget = sum(c.cost or 0 for c in courses)
    plan_status = "approved" if req.auto_approve else ("pending_manager" if emp.manager_id else "pending_hr")

    plan = TrainingPlan(
        employee_id=emp.id,
        start_date=req.start_date or date.today(),
        end_date=req.end_date,
        status=plan_status,
        ai_reason=req.ai_reason or "خطة تدريبية مخصصة تم إنشاؤها عبر الإدارة.",
        budget_estimated=estimated_budget,
        is_approved=req.auto_approve,
        manager_approved=req.auto_approve,
    )
    db.add(plan)
    db.flush()

    for cid in req.course_ids:
        db.add(TrainingEnrollment(
            training_plan_id=plan.id,
            course_id=cid,
            enrolled_date=date.today(),
            status="enrolled",
        ))

    log_action(db, user, "create_plan", "training_plan", plan.id, f"إنشاء خطة للموظف {emp.id}")
    db.commit()
    db.refresh(plan)
    return plan_payload(plan)


@router.put("/api/training-plans/{plan_id}/manager-approve")
def manager_approval(
    plan_id: int,
    req: TrainingPlanManagerApprove = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    notes = req.notes if req else None
    return manager_approve_plan(db, plan_id, user, notes)


@router.put("/api/training-plans/{plan_id}/approve")
def approve_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("hr", "admin"))
):
    return hr_approve_plan(db, plan_id, user)


@router.put("/api/training-plans/{plan_id}/reject")
def reject_training_plan(
    plan_id: int,
    req: TrainingPlanReject,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return reject_plan(db, plan_id, user, req.reason)


@router.put("/api/training-plans/{plan_id}/resubmit")
def resubmit_training_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return resubmit_plan(db, plan_id, user)


@router.put("/api/enrollments/{enrollment_id}/start")
def start_enrollment(
    enrollment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    enrollment = enrollment_for_user(db, enrollment_id, user)
    if not enrollment.plan.is_approved and user.role not in ("admin", "hr"):
        raise HTTPException(status_code=400, detail="الخطة لم تُعتمد بعد من الموارد البشرية")
    if enrollment.status == "completed":
        raise HTTPException(status_code=400, detail="الدورة مكتملة مسبقاً")
    enrollment.status = "in_progress"
    if not enrollment.enrolled_date:
        enrollment.enrolled_date = date.today()
    refresh_plan_status(enrollment.plan)
    db.commit()
    return {"id": enrollment.id, "status": enrollment.status, "plan_status": enrollment.plan.status}


@router.put("/api/enrollments/{enrollment_id}/complete")
def complete_enrollment(
    enrollment_id: int,
    req: EnrollmentComplete | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    enrollment = enrollment_for_user(db, enrollment_id, user)
    if not enrollment.plan.is_approved and user.role not in ("admin", "hr"):
        raise HTTPException(status_code=400, detail="الخطة لم تُعتمد بعد")
    req = req or EnrollmentComplete()
    if req.score is not None and (req.score < 0 or req.score > 100):
        raise HTTPException(status_code=400, detail="الدرجة يجب أن تكون بين 0 و 100")
    return record_course_completion(db, enrollment, req.score, user)

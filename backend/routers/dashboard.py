"""Dashboard metrics routes for Admin, HR, and Employee."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from models import (
    Assessment, Course, Department, Employee,
    TrainingEnrollment, TrainingPlan, User, get_db
)
from schemas import AdminStats, EmployeeStats, HRStats
from auth import get_current_user, require_role

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/admin", response_model=AdminStats)
def admin_dashboard(db: Session = Depends(get_db), user: User = Depends(require_role("admin"))):
    return AdminStats(
        total_employees=db.query(Employee).count(),
        total_departments=db.query(Department).count(),
        total_courses=db.query(Course).count(),
        total_users=db.query(User).count()
    )


@router.get("/hr", response_model=HRStats)
def hr_dashboard(db: Session = Depends(get_db), user: User = Depends(require_role("hr", "admin"))):
    return HRStats(
        total_employees=db.query(Employee).count(),
        pending_assessments=db.query(Assessment).filter(Assessment.status == "pending").count(),
        in_training=db.query(TrainingEnrollment).filter(TrainingEnrollment.status.in_(["enrolled", "in_progress"])).count(),
        pending_plans=db.query(TrainingPlan).filter(TrainingPlan.is_approved == False).count()
    )


@router.get("/employee", response_model=EmployeeStats)
def employee_dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    emp = db.query(Employee).filter(Employee.user_id == user.id).first()
    if not emp:
        return EmployeeStats(courses_in_plan=0, completed_assessments=0, overall_progress=0)

    plans = db.query(TrainingPlan).filter(TrainingPlan.employee_id == emp.id).all()
    total_enrollments = 0
    completed_enrollments = 0
    for p in plans:
        for e in p.enrollments:
            total_enrollments += 1
            if e.status == "completed":
                completed_enrollments += 1

    progress = (completed_enrollments / total_enrollments * 100) if total_enrollments > 0 else 0
    completed_assessments = db.query(Assessment).filter(
        Assessment.employee_id == emp.id, Assessment.status == "completed"
    ).count()

    return EmployeeStats(
        courses_in_plan=total_enrollments,
        completed_assessments=completed_assessments,
        overall_progress=round(progress)
    )

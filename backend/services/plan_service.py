"""Plan and skill lifecycle state machine with multi-tier approval."""
from datetime import date
from sqlalchemy.orm import Session
from fastapi import HTTPException
from models import (
    TrainingPlan, TrainingEnrollment, TrainingImpact,
    Employee, EmployeeSkill, User
)
from services.audit_service import log_action
from services.notification_service import send_notification, notify_user_or_role
from ml_model import predict_course_impact


def plan_payload(plan: TrainingPlan) -> dict:
    emp = plan.employee
    dept = emp.department if emp else None
    return {
        "id": plan.id,
        "employee_id": plan.employee_id,
        "employee_name": emp.user.name if emp and emp.user else None,
        "department_name": dept.name if dept else None,
        "start_date": str(plan.start_date) if plan.start_date else None,
        "end_date": str(plan.end_date) if plan.end_date else None,
        "status": plan.status,
        "ai_reason": plan.ai_reason,
        "is_approved": bool(plan.is_approved),
        "manager_approved": bool(plan.manager_approved),
        "manager_notes": plan.manager_notes,
        "rejection_reason": plan.rejection_reason,
        "budget_estimated": getattr(plan, "budget_estimated", 0.0) or 0.0,
        "created_at": str(plan.created_at) if plan.created_at else None,
        "enrollments": [
            {
                "id": e.id,
                "course_id": e.course_id,
                "course_title": e.course.title if e.course else None,
                "status": e.status,
                "score": e.score,
                "enrolled_date": str(e.enrolled_date) if e.enrolled_date else None,
                "completed_date": str(e.completed_date) if e.completed_date else None,
            }
            for e in plan.enrollments
        ]
    }


def refresh_plan_status(plan: TrainingPlan) -> None:
    statuses = [e.status for e in plan.enrollments]
    if statuses and all(s == "completed" for s in statuses):
        plan.status = "completed"
        plan.is_approved = True
    elif any(s in ("in_progress", "completed") for s in statuses) and plan.is_approved:
        plan.status = "active"


def manager_approve_plan(db: Session, plan_id: int, user: User, notes: str | None = None) -> dict:
    plan = db.query(TrainingPlan).filter(TrainingPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="الخطة غير موجودة")

    emp = plan.employee
    manager_emp = db.query(Employee).filter(Employee.user_id == user.id).first()
    if user.role != "manager" or not manager_emp or not emp or emp.manager_id != manager_emp.id:
        raise HTTPException(status_code=403, detail="فقط المدير المباشر يمكنه اعتماد هذه الخطة")
    if plan.status != "pending_manager" or plan.manager_approved:
        raise HTTPException(status_code=409, detail="الخطة ليست بانتظار موافقة المدير المباشر")

    plan.manager_approved = True
    plan.manager_notes = notes
    plan.status = "pending_hr"
    log_action(db, user, "manager_approve_plan", "training_plan", plan.id, f"موافقة المدير المباشر: {notes or 'تمت الموافقة'}")

    notify_user_or_role(
        db,
        role="hr",
        title="خطة بانتظار اعتماد الموارد البشرية",
        message=f"وافق المدير المباشر على خطة تدريب الموظف {emp.user.name if emp and emp.user else emp.id}.",
        link="/hr-plans.html"
    )
    if emp and emp.user:
        send_notification(
            db,
            user_id=emp.user.id,
            title="موافقة المدير المباشر على خطتك",
            message="وافق مديرك المباشر على الخطة، وهي الآن بانتظار الاعتماد النهائي من الموارد البشرية.",
            link="/employee-plan.html"
        )
    db.commit()
    return {"message": "تمت موافقة المدير المباشر وأُحيلت الخطة للموارد البشرية", "status": plan.status}


def hr_approve_plan(db: Session, plan_id: int, user: User) -> dict:
    plan = db.query(TrainingPlan).filter(TrainingPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="الخطة غير موجودة")

    emp = plan.employee
    if plan.status != "pending_hr":
        raise HTTPException(status_code=409, detail="الخطة ليست بانتظار اعتماد الموارد البشرية")
    if emp and emp.manager_id and not plan.manager_approved:
        raise HTTPException(status_code=409, detail="يجب اعتماد المدير المباشر للخطة أولاً")

    plan.is_approved = True
    plan.status = "approved"
    log_action(db, user, "approve_plan", "training_plan", plan.id, "اعتماد خطة التدريب من الموارد البشرية")

    if emp and emp.user:
        send_notification(
            db,
            user_id=emp.user.id,
            title="تم اعتماد خطتك التدريبية",
            message="تم اعتماد خطتك التدريبية رسميًا من الموارد البشرية. يمكنك الآن بدء الدورات.",
            link="/employee-plan.html"
        )
    db.commit()
    return {"message": "تم اعتماد الخطة رسميًا", "status": plan.status}


def reject_plan(db: Session, plan_id: int, user: User, reason: str) -> dict:
    plan = db.query(TrainingPlan).filter(TrainingPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="الخطة غير موجودة")

    emp = plan.employee
    if user.role == "manager":
        manager_emp = db.query(Employee).filter(Employee.user_id == user.id).first()
        if not manager_emp or not emp or emp.manager_id != manager_emp.id:
            raise HTTPException(status_code=403, detail="صلاحيات غير كافية لرفض الخطة")
        if plan.status != "pending_manager":
            raise HTTPException(status_code=409, detail="الخطة ليست بانتظار موافقة المدير المباشر")
    elif user.role in ("hr", "admin"):
        if plan.status != "pending_hr":
            raise HTTPException(status_code=409, detail="الخطة ليست بانتظار اعتماد الموارد البشرية")
    else:
        raise HTTPException(status_code=403, detail="صلاحيات غير كافية لرفض الخطة")

    plan.status = "rejected"
    plan.is_approved = False
    plan.manager_approved = False
    plan.rejection_reason = reason
    log_action(db, user, "reject_plan", "training_plan", plan.id, f"رفض الخطة: {reason}")

    if emp and emp.user:
        send_notification(
            db,
            user_id=emp.user.id,
            title="تم رفض خطة التدريب مع إمكانية التعديل",
            message=f"سبب الرفض: {reason}. يمكنك مراجعة الخطة وإعادة تقديمها.",
            link="/employee-plan.html"
        )
    db.commit()
    return {"message": "تم رفض الخطة وتوثيق سبب الرفض وإعادتها للتعديل", "status": plan.status, "reason": reason}


def resubmit_plan(db: Session, plan_id: int, user: User) -> dict:
    plan = db.query(TrainingPlan).filter(TrainingPlan.id == plan_id).first()
    employee = db.query(Employee).filter(Employee.user_id == user.id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="الخطة غير موجودة")
    if user.role != "employee" or not employee or plan.employee_id != employee.id:
        raise HTTPException(status_code=403, detail="يمكن للموظف إعادة تقديم خطته فقط")
    if plan.status != "rejected":
        raise HTTPException(status_code=409, detail="يمكن إعادة تقديم الخطط المرفوضة فقط")

    plan.status = "pending_manager" if employee.manager_id else "pending_hr"
    plan.is_approved = False
    plan.manager_approved = False
    plan.rejection_reason = None
    log_action(db, user, "resubmit_plan", "training_plan", plan.id, "إعادة تقديم خطة تدريبية بعد الرفض")
    if employee.manager and employee.manager.user:
        send_notification(db, employee.manager.user.id, "خطة أُعيد تقديمها", "أعاد الموظف تقديم خطته التدريبية بعد التعديل.", "/manager.html")
    else:
        notify_user_or_role(db, "hr", "خطة بانتظار HR", "أعاد الموظف تقديم خطة تدريبية وهي جاهزة للمراجعة.", "/hr-plans.html")
    db.commit()
    return {"message": "تمت إعادة تقديم الخطة للمراجعة", "status": plan.status}


def record_course_completion(db: Session, enrollment: TrainingEnrollment, score: float | None, user: User) -> dict:
    enrollment.status = "completed"
    enrollment.completed_date = date.today()
    enrollment.score = score
    refresh_plan_status(enrollment.plan)

    course = enrollment.course
    emp = enrollment.plan.employee if enrollment.plan else None

    predicted_gain = 1.0
    previous_level = 0
    new_level = 1
    if course and course.skill_id and emp:
        emp_skill = db.query(EmployeeSkill).filter(
            EmployeeSkill.employee_id == emp.id,
            EmployeeSkill.skill_id == course.skill_id
        ).first()
        if emp_skill:
            previous_level = emp_skill.current_level
            gap = max(0, emp_skill.target_level - previous_level)
            score_factor = 0.6 if score is None else max(0.4, min(1.0, score / 100))
            predicted = predict_course_impact(
                current=previous_level,
                gap=gap,
                course_level=course.level or 1,
                duration=course.duration_hours or 10,
                cost=course.cost or 0
            )
            gain_calc = max(1, round(predicted * score_factor)) if predicted >= 0.4 else 1
            new_level = min(emp_skill.target_level, previous_level + gain_calc)
            predicted_gain = new_level - previous_level

        impact = TrainingImpact(
            employee_id=emp.id,
            enrollment_id=enrollment.id,
            skill_id=course.skill_id,
            previous_level=previous_level,
            new_level=new_level,
            gain=predicted_gain,
            course_score=score,
            status="pending_approval",
            recorded_date=date.today()
        )
        db.add(impact)

        # Notify manager for skill upgrade verification
        if emp.manager and emp.manager.user:
            send_notification(
                db,
                user_id=emp.manager.user.id,
                title="طلب اعتماد ترقية مهارة بعد إكمال دورة",
                message=f"أكمل الموظف {emp.user.name} دورة '{course.title}'. قيّم أداءه في المهارة ثم اعتمد أو ارفض الترقية المقترحة.",
                link="/manager.html"
            )

    log_action(db, user, "complete_course", "enrollment", enrollment.id, f"إكمال دورة {course.title if course else enrollment.id}")
    db.commit()
    return {
        "id": enrollment.id,
        "status": enrollment.status,
        "score": enrollment.score,
        "plan_status": enrollment.plan.status,
        "message": "تم تسجيل إكمال الدورة. الأثر تقديري حتى يقيّمه المدير المباشر ويعتمد أو يرفض ترقية المهارة.",
    }

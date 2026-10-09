"""Skill upgrade verification and manager approval router."""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models import (
    Employee, EmployeeSkill, Skill, TrainingImpact, User, get_db
)
from schemas import SkillUpgradeDecision, SkillUpgradeOut
from auth import get_current_user
from services.audit_service import log_action
from services.notification_service import send_notification

router = APIRouter(prefix="/api/skill-upgrades", tags=["Skill Upgrades"])


@router.get("/pending", response_model=list[SkillUpgradeOut])
def list_pending_skill_upgrades(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    q = db.query(TrainingImpact).filter(TrainingImpact.status == "pending_approval")
    if user.role == "manager":
        mgr_emp = db.query(Employee).filter(Employee.user_id == user.id).first()
        if not mgr_emp:
            return []
        team_ids = [m.id for m in db.query(Employee).filter(Employee.manager_id == mgr_emp.id).all()]
        q = q.filter(TrainingImpact.employee_id.in_(team_ids))
    elif user.role not in ("admin", "hr"):
        raise HTTPException(status_code=403, detail="صلاحيات غير كافية لمراجعة ترقيات المهارات")

    impacts = q.order_by(TrainingImpact.recorded_date.desc()).all()
    result = []
    for imp in impacts:
        emp = imp.employee
        skill = imp.skill
        result.append(SkillUpgradeOut(
            id=imp.id,
            employee_id=imp.employee_id,
            employee_name=emp.user.name if emp and emp.user else f"Employee #{imp.employee_id}",
            skill_id=imp.skill_id,
            skill_name=skill.name if skill else None,
            previous_level=imp.previous_level,
            new_level=imp.new_level,
            gain=imp.gain,
            course_score=imp.course_score,
            status=imp.status,
            manager_notes=imp.manager_notes,
            recorded_date=imp.recorded_date,
        ))
    return result


@router.put("/{impact_id}/decision")
def decide_skill_upgrade(
    impact_id: int,
    decision: SkillUpgradeDecision,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    impact = db.query(TrainingImpact).filter(TrainingImpact.id == impact_id).first()
    if not impact:
        raise HTTPException(status_code=404, detail="سجل أثر التدريب غير موجود")

    emp = impact.employee
    if user.role == "manager":
        mgr_emp = db.query(Employee).filter(Employee.user_id == user.id).first()
        if not mgr_emp or emp.manager_id != mgr_emp.id:
            raise HTTPException(status_code=403, detail="فقط المدير المباشر يمكنه تقييم ترقية مهارة الموظف")
    elif user.role not in ("admin", "hr"):
        raise HTTPException(status_code=403, detail="صلاحيات غير كافية")

    impact.approved_by = user.id
    impact.manager_notes = decision.notes

    if decision.approved:
        impact.status = "approved"
        # Apply the skill level promotion upon verified manager approval
        emp_skill = db.query(EmployeeSkill).filter(
            EmployeeSkill.employee_id == impact.employee_id,
            EmployeeSkill.skill_id == impact.skill_id
        ).first()
        if not emp_skill:
            emp_skill = EmployeeSkill(
                employee_id=impact.employee_id,
                skill_id=impact.skill_id,
                current_level=impact.new_level,
                target_level=5,
                assessed_date=date.today()
            )
            db.add(emp_skill)
        else:
            emp_skill.current_level = impact.new_level
            emp_skill.assessed_date = date.today()

        skill_name = impact.skill.name if impact.skill else "المهارة"
        if emp and emp.user:
            send_notification(
                db,
                user_id=emp.user.id,
                title="تم اعتماد ترقية مستوى مهارة",
                message=f"اعتمد مديرك ترقية مستواك في {skill_name} إلى المستوى {impact.new_level}/5 بنجاح.",
                link="/employee.html"
            )
        log_action(db, user, "approve_skill_upgrade", "training_impact", impact.id, f"اعتماد ترقية مهارة للموظف {emp.id}")
        message = "تم اعتماد ترقية المهارة وتحديث سجل الموظف"
    else:
        impact.status = "rejected"
        skill_name = impact.skill.name if impact.skill else "المهارة"
        if emp and emp.user:
            send_notification(
                db,
                user_id=emp.user.id,
                title="عدم اعتماد ترقية المهارة",
                message=f"لم يتم اعتماد الترقية التلقائية في {skill_name}. ملاحظة: {decision.notes or 'يُطلب إجراء تقييم عملي جديد'}.",
                link="/employee-assess.html"
            )
        log_action(db, user, "reject_skill_upgrade", "training_impact", impact.id, f"رفض ترقية مهارة: {decision.notes}")
        message = "تم تسجيل رفض الترقية والاحتفاظ بمستوى المهارة الحالي"

    db.commit()
    return {"message": message, "status": impact.status}

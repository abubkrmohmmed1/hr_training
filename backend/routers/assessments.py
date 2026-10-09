"""Assessment routes — self assessment, manager assessment, and privacy controls."""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models import (
    Assessment, AssessmentItem, Employee, EmployeeSkill, Skill, User, get_db
)
from schemas import AssessmentCreate
from auth import get_current_user
from services.audit_service import log_action
from services.notification_service import send_notification
from ai_engine import compare_assessments, generate_recommendation

router = APIRouter(prefix="/api/assessments", tags=["Assessments"])


@router.get("")
def list_assessments(
    employee_id: int = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    q = db.query(Assessment)

    if user.role == "employee":
        emp = db.query(Employee).filter(Employee.user_id == user.id).first()
        if not emp:
            return []
        q = q.filter(Assessment.employee_id == emp.id)
    elif user.role == "manager":
        mgr_emp = db.query(Employee).filter(Employee.user_id == user.id).first()
        if not mgr_emp:
            return []
        team_ids = [m.id for m in db.query(Employee).filter(Employee.manager_id == mgr_emp.id).all()] + [mgr_emp.id]
        if employee_id:
            if employee_id not in team_ids:
                raise HTTPException(status_code=403, detail="لا يمكن استعراض تقييمات موظف خارج فريقك")
            q = q.filter(Assessment.employee_id == employee_id)
        else:
            q = q.filter(Assessment.employee_id.in_(team_ids))
    else:
        # admin or hr
        if employee_id:
            q = q.filter(Assessment.employee_id == employee_id)

    assessments = q.order_by(Assessment.assessment_date.desc(), Assessment.id.desc()).all()
    result = []
    for a in assessments:
        items = []
        for item in a.items:
            items.append({
                "id": item.id,
                "skill_id": item.skill_id,
                "score": item.score,
                "notes": item.notes,
                "skill_name": item.skill.name if item.skill else None,
            })
        result.append({
            "id": a.id,
            "employee_id": a.employee_id,
            "assessor_id": a.assessor_id,
            "type": a.type,
            "assessment_date": str(a.assessment_date) if a.assessment_date else None,
            "total_score": a.total_score,
            "status": a.status,
            "employee_name": a.employee.user.name if a.employee and a.employee.user else None,
            "items": items,
        })
    return result


@router.post("")
def create_assessment(req: AssessmentCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    assessor_emp = db.query(Employee).filter(Employee.user_id == user.id).first()
    target_emp = db.query(Employee).filter(Employee.id == req.employee_id).first()
    if not target_emp:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")

    if user.role == "employee" and (not assessor_emp or assessor_emp.id != req.employee_id or req.type != "self"):
        raise HTTPException(status_code=403, detail="الموظف يمكنه تقديم التقييم الذاتي لنفسه فقط")

    if user.role == "manager" and req.type == "manager":
        if not assessor_emp or target_emp.manager_id != assessor_emp.id:
            raise HTTPException(status_code=403, detail="المدير يقيم أعضاء فريقه المباشرين فقط")

    # Do not accept a caller-supplied assessment type outside that caller's role.
    if req.type == "self":
        if user.role != "employee" or not assessor_emp or assessor_emp.id != req.employee_id:
            raise HTTPException(status_code=403, detail="الموظف يمكنه تقديم التقييم الذاتي لنفسه فقط")
    elif req.type == "manager":
        if user.role != "manager" or not assessor_emp or target_emp.manager_id != assessor_emp.id:
            raise HTTPException(status_code=403, detail="المدير يقيّم أعضاء فريقه المباشرين فقط")
    else:
        raise HTTPException(status_code=403, detail="نوع التقييم غير مسموح")

    assessment = Assessment(
        employee_id=req.employee_id,
        assessor_id=assessor_emp.id if assessor_emp else None,
        type=req.type,
        assessment_date=date.today(),
        status="completed"
    )
    db.add(assessment)
    db.flush()

    total = 0
    for item in req.items:
        skill = db.query(Skill).filter(Skill.id == item.skill_id).first()
        if not skill:
            raise HTTPException(status_code=400, detail="المهارة المحددة غير موجودة")
        ai = AssessmentItem(
            assessment_id=assessment.id,
            skill_id=item.skill_id,
            score=item.score,
            notes=item.notes
        )
        db.add(ai)
        total += item.score

        # Update employee skill current level based on assessment
        es = db.query(EmployeeSkill).filter(
            EmployeeSkill.employee_id == req.employee_id,
            EmployeeSkill.skill_id == item.skill_id
        ).first()
        if not es:
            es = EmployeeSkill(
                employee_id=req.employee_id,
                skill_id=item.skill_id,
                current_level=item.score,
                target_level=skill.max_level or 5,
                assessed_date=date.today(),
            )
            db.add(es)
        else:
            es.current_level = item.score
            es.assessed_date = date.today()

    assessment.total_score = round(total / len(req.items), 1) if req.items else 0
    log_action(db, user, "create_assessment", "assessment", assessment.id, f"تقييم {req.type} للموظف {req.employee_id}")

    if req.type == "manager" and target_emp.user:
        send_notification(
            db,
            user_id=target_emp.user.id,
            title="تقييم جديد من المدير المباشر",
            message=f"أجرى مديرك تقييماً لمهاراتك بمتوسط {assessment.total_score}/5.",
            link="/employee-assess.html"
        )

    db.commit()
    db.refresh(assessment)
    rec = generate_recommendation(db, req.employee_id, assessment.id)
    return {
        "id": assessment.id,
        "total_score": assessment.total_score,
        "status": "completed",
        "recommendation_id": rec.id,
        "confidence_score": rec.confidence_score,
        "skill_gaps": rec.skill_gaps,
        "recommended_courses": (rec.recommended_courses or [])[:6],
    }


@router.get("/compare/{employee_id}")
def compare_emp_assessments(employee_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")

    if user.role == "employee" and emp.user_id != user.id:
        raise HTTPException(status_code=403, detail="غير مصرح لك بعرض مقارنة تقييم موظف آخر")
    if user.role == "manager":
        manager = db.query(Employee).filter(Employee.user_id == user.id).first()
        if not manager or emp.manager_id != manager.id:
            raise HTTPException(status_code=403, detail="غير مصرح لك بعرض مقارنة موظف خارج فريقك")

    return compare_assessments(db, employee_id)

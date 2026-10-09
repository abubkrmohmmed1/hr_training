"""AI Engine — weighted skill gap analysis, course matching, explainability, and Ridge impact estimation."""
from sqlalchemy.orm import Session
from models import (
    Employee, EmployeeSkill, Skill, Course, Assessment,
    AIRecommendation, TrainingPlan, TrainingEnrollment, TrainingImpact
)
from datetime import date, datetime, timezone
from ml_model import predict_course_impact, explain_course_impact, model_info


def analyze_skill_gaps(db: Session, employee_id: int) -> list[dict]:
    """Calculate weighted gap between current and target level for each skill, considering importance weight."""
    emp_skills = db.query(EmployeeSkill).filter(EmployeeSkill.employee_id == employee_id).all()
    gaps = []
    for es in emp_skills:
        skill = db.query(Skill).filter(Skill.id == es.skill_id).first()
        if not skill:
            continue
        gap = es.target_level - es.current_level
        if gap > 0:
            weight = getattr(skill, "weight", 1.0) or 1.0
            weighted_gap = round(gap * weight, 2)
            if weighted_gap >= 4.0 or (weight >= 1.5 and gap >= 2.5):
                priority = "critical"
            elif weighted_gap >= 3.0:
                priority = "high"
            elif weighted_gap >= 2.0:
                priority = "medium"
            else:
                priority = "low"

            gaps.append({
                "skill_id": skill.id,
                "skill_name": skill.name,
                "category": skill.category,
                "weight": weight,
                "current_level": es.current_level,
                "target_level": es.target_level,
                "gap": gap,
                "weighted_gap": weighted_gap,
                "priority": priority,
                "gap_percentage": round((gap / skill.max_level) * 100),
                "importance_label": "حرجة" if weight >= 1.8 else ("أساسية" if weight >= 1.4 else "قياسية"),
            })
    # Sort by weighted gap descending so highest organizational impact comes first
    gaps.sort(key=lambda g: g["weighted_gap"], reverse=True)
    return gaps


def recommend_courses(db: Session, gaps: list[dict]) -> list[dict]:
    """Find best matching courses for each skill gap with explicit explainability and heuristic notices."""
    recommendations = []
    for gap in gaps:
        courses = db.query(Course).filter(
            Course.skill_id == gap["skill_id"],
            Course.level <= gap["target_level"]
        ).order_by(Course.level).all()

        for course in courses:
            explanation = explain_course_impact(
                current=gap["current_level"],
                gap=gap["gap"],
                course_level=course.level or 1,
                duration=course.duration_hours or 10,
                cost=course.cost or 0,
            )
            predicted_gain = explanation["predicted_gain"]
            expected_level = min(gap["target_level"], round(gap["current_level"] + predicted_gain, 1))

            reason_text = (
                f"فجوة مهارة {gap['skill_name']} بمقدار {gap['gap']} درجات (أهمية: {gap['importance_label']}). "
                f"الدورة تلائم المستوى {course.level}/5 بمدة {course.duration_hours}h وتكلفة {course.cost}$. "
                f"الأثر التقديري المتوقع: +{predicted_gain} درجات (تقدير تجريبي استرشادي)."
            )

            priority_order = {"critical": 4, "high": 3, "medium": 2, "low": 1}.get(gap["priority"], 1)

            recommendations.append({
                "course_id": course.id,
                "course_title": course.title,
                "skill_name": gap["skill_name"],
                "skill_id": gap["skill_id"],
                "level": course.level,
                "duration_hours": course.duration_hours,
                "provider": course.provider,
                "type": course.type,
                "cost": course.cost or 0,
                "predicted_gain": predicted_gain,
                "expected_level": expected_level,
                "priority": gap["priority"],
                "weighted_gap": gap["weighted_gap"],
                "priority_score": round(priority_order * 10 + predicted_gain * 2, 2),
                "is_experimental": True,
                "reason": reason_text,
                "factors": explanation["factors"],
            })
    recommendations.sort(key=lambda r: (r["priority_score"], r["predicted_gain"]), reverse=True)
    return recommendations


def generate_recommendation(db: Session, employee_id: int, assessment_id: int = None) -> AIRecommendation:
    """Full pipeline: weighted gaps → courses → save recommendation + draft training plan with estimated budget."""
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise ValueError(f"Employee {employee_id} does not exist")
    gaps = analyze_skill_gaps(db, employee_id)
    courses = recommend_courses(db, gaps)

    emp_skills_count = db.query(EmployeeSkill).filter(EmployeeSkill.employee_id == employee_id).count()
    confidence = min(0.95, 0.5 + (emp_skills_count * 0.05))

    rec = AIRecommendation(
        employee_id=employee_id,
        assessment_id=assessment_id,
        skill_gaps=gaps,
        recommended_courses=courses,
        confidence_score=round(confidence, 2),
        generated_at=datetime.now(timezone.utc)
    )
    db.add(rec)
    db.flush()

    existing_draft = db.query(TrainingPlan).filter(
        TrainingPlan.employee_id == employee_id,
        TrainingPlan.status.in_(["draft", "rejected", "pending_manager", "pending_hr"])
    ).order_by(TrainingPlan.created_at.desc()).first()

    if courses:
        ai_reason_parts = []
        for g in gaps[:3]:
            ai_reason_parts.append(
                f"{g['skill_name']} (فجوة {g['gap']}, وزن {g['weight']})"
            )
        ai_reason = "توصية ذكية لمعالجة الفجوات الحرجة: " + " | ".join(ai_reason_parts)
        top_courses = courses[:4]
        estimated_budget = sum(c.get("cost", 0) for c in top_courses)

        plan = existing_draft
        if not plan:
            plan = TrainingPlan(
                employee_id=employee_id,
                start_date=date.today(),
                end_date=date(date.today().year, 12, 31),
                status="pending_manager" if emp.manager_id else "pending_hr",
                ai_reason=ai_reason,
                budget_estimated=estimated_budget,
                is_approved=False,
                manager_approved=False,
            )
            db.add(plan)
            db.flush()
        else:
            plan.ai_reason = ai_reason
            plan.budget_estimated = estimated_budget
            plan.start_date = date.today()
            plan.status = "pending_manager" if emp.manager_id else "pending_hr"
            plan.is_approved = False
            plan.manager_approved = False
            for enrollment in list(plan.enrollments):
                if enrollment.status == "enrolled":
                    db.delete(enrollment)
            db.flush()

        seen_courses = set()
        existing_ids = {e.course_id for e in plan.enrollments}
        for c in top_courses:
            if c["course_id"] not in seen_courses and c["course_id"] not in existing_ids:
                seen_courses.add(c["course_id"])
                enrollment = TrainingEnrollment(
                    training_plan_id=plan.id,
                    course_id=c["course_id"],
                    enrolled_date=date.today(),
                    status="enrolled"
                )
                db.add(enrollment)

    db.commit()
    db.refresh(rec)
    return rec


def predict_employee_impact(db: Session, employee_id: int) -> dict:
    """Score recommended courses with ML metrics and explainability notice."""
    gaps = analyze_skill_gaps(db, employee_id)
    courses = recommend_courses(db, gaps)
    total_gain = round(sum(c.get("predicted_gain", 0) for c in courses[:5]), 2)
    return {
        "employee_id": employee_id,
        "model": model_info(),
        "skill_gaps": gaps,
        "courses": courses[:8],
        "total_predicted_gain": total_gain,
        "is_heuristic": True,
        "disclaimer": "تقدير تجريبي: تحسن المهارات الفعلي يخضع لاعتماد وملاحظات المدير بعد إتمام الدورة.",
        "summary": (
            f"يتوقع النموذج تحسناً إجمالياً بنحو {total_gain} درجات عبر أهم الدورات المقترحة."
            if courses else "لا توجد فجوات كافية لتقدير الأثر."
        ),
    }


def compare_assessments(db: Session, employee_id: int) -> dict:
    assessments = db.query(Assessment).filter(
        Assessment.employee_id == employee_id,
        Assessment.status == "completed",
    ).order_by(Assessment.assessment_date.desc(), Assessment.id.desc()).all()
    self_last = next((a for a in assessments if a.type == "self"), None)
    manager_last = next((a for a in assessments if a.type == "manager"), None)
    history = [{
        "id": a.id,
        "type": a.type,
        "date": str(a.assessment_date) if a.assessment_date else None,
        "total_score": a.total_score,
        "status": a.status,
    } for a in assessments[:8]]
    comparison = []
    if self_last and manager_last:
        self_map = {item.skill_id: item.score for item in self_last.items}
        manager_map = {item.skill_id: item.score for item in manager_last.items}
        skill_ids = set(self_map) | set(manager_map)
        skills = {s.id: s.name for s in db.query(Skill).filter(Skill.id.in_(skill_ids)).all()} if skill_ids else {}
        for skill_id in skill_ids:
            self_score = self_map.get(skill_id)
            manager_score = manager_map.get(skill_id)
            delta = None
            if self_score is not None and manager_score is not None:
                delta = round(manager_score - self_score, 1)
            comparison.append({
                "skill_id": skill_id,
                "skill_name": skills.get(skill_id),
                "self_score": self_score,
                "manager_score": manager_score,
                "delta": delta,
            })
        comparison.sort(key=lambda row: abs(row["delta"] or 0), reverse=True)
    return {
        "self": {"id": self_last.id, "date": str(self_last.assessment_date), "total_score": self_last.total_score} if self_last else None,
        "manager": {"id": manager_last.id, "date": str(manager_last.assessment_date), "total_score": manager_last.total_score} if manager_last else None,
        "comparison": comparison,
        "history": history,
    }


def employee_actual_impact(db: Session, employee_id: int) -> dict:
    records = db.query(TrainingImpact).filter(TrainingImpact.employee_id == employee_id).all()
    total_gain = round(sum(r.gain or 0 for r in records if r.status == "approved"), 2)
    completed = db.query(TrainingEnrollment).join(TrainingPlan).filter(
        TrainingPlan.employee_id == employee_id,
        TrainingEnrollment.status == "completed",
    ).count()
    predicted = predict_employee_impact(db, employee_id)
    details = []
    for rec in records:
        skill = db.query(Skill).filter(Skill.id == rec.skill_id).first()
        details.append({
            "id": rec.id,
            "skill_name": skill.name if skill else None,
            "previous_level": rec.previous_level,
            "new_level": rec.new_level,
            "gain": rec.gain,
            "status": rec.status,
            "course_score": rec.course_score,
            "manager_notes": rec.manager_notes,
            "recorded_date": str(rec.recorded_date) if rec.recorded_date else None,
        })
    return {
        "employee_id": employee_id,
        "completed_courses": completed,
        "actual_gain": total_gain,
        "predicted_gain": predicted.get("total_predicted_gain", 0),
        "records": details,
        "summary": (
            f"بعد إكمال {completed} دورة واعتمادها ارتفع مستوى المهارات بمقدار {total_gain} درجات."
            if completed else "لا يوجد أثر فعلي معتمد بعد."
        ),
    }

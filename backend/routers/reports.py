"""Reports and analytics router with CSV export and formula injection protection."""
import csv
import io
from datetime import date
from html import escape
from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse, StreamingResponse
from sqlalchemy.orm import Session
from models import (
    Assessment, Department, Employee, EmployeeSkill,
    Skill, TrainingEnrollment, TrainingImpact, TrainingPlan, User, get_db
)
from auth import get_current_user, require_role
from ai_engine import employee_actual_impact, predict_employee_impact

router = APIRouter(prefix="/api/reports", tags=["Reports"])


def scoped_employees(db: Session, user: User):
    if user.role in ("admin", "hr"):
        return db.query(Employee).all()
    manager = db.query(Employee).filter(Employee.user_id == user.id).first()
    if not manager:
        return []
    return db.query(Employee).filter(Employee.manager_id == manager.id).all()


def report_overview_payload(db: Session, user: User) -> dict:
    """Role-scoped operational summary for Admin, HR, and direct managers."""
    employees = scoped_employees(db, user)
    employee_ids = [employee.id for employee in employees]
    plans = db.query(TrainingPlan).filter(TrainingPlan.employee_id.in_(employee_ids)).all() if employee_ids else []
    enrollments = [enrollment for plan in plans for enrollment in plan.enrollments]
    assessments = db.query(Assessment).filter(Assessment.employee_id.in_(employee_ids)).all() if employee_ids else []

    status_counts = {status: 0 for status in ("pending_manager", "pending_hr", "approved", "active", "completed", "rejected")}
    for plan in plans:
        if plan.status in status_counts:
            status_counts[plan.status] += 1

    gaps_by_skill = {}
    for employee in employees:
        for employee_skill in employee.skills:
            gap = max(0, (employee_skill.target_level or 0) - (employee_skill.current_level or 0))
            if not gap:
                continue
            skill = employee_skill.skill
            if not skill:
                continue
            item = gaps_by_skill.setdefault(skill.id, {"skill_name": skill.name, "affected_employees": 0, "total_gap": 0})
            item["affected_employees"] += 1
            item["total_gap"] += gap

    top_gaps = sorted(gaps_by_skill.values(), key=lambda item: (item["total_gap"], item["affected_employees"]), reverse=True)[:5]
    completed = sum(1 for enrollment in enrollments if enrollment.status == "completed")
    return {
        "scope": "الفريق المباشر" if user.role == "manager" else "المؤسسة",
        "employee_count": len(employees),
        "assessment_count": len(assessments),
        "average_assessment": round(sum((assessment.total_score or 0) for assessment in assessments) / len(assessments), 1) if assessments else 0,
        "course_completion_rate": round((completed / len(enrollments)) * 100) if enrollments else 0,
        "plan_statuses": status_counts,
        "top_skill_gaps": top_gaps,
    }


def comprehensive_employee_rows(db: Session, user: User) -> list[dict]:
    """One row per visible employee, including employees with no training plan."""
    rows = []
    for employee in scoped_employees(db, user):
        plans = db.query(TrainingPlan).filter(TrainingPlan.employee_id == employee.id).all()
        enrollments = [enrollment for plan in plans for enrollment in plan.enrollments]
        total_courses = len(enrollments)
        completed_courses = sum(enrollment.status == "completed" for enrollment in enrollments)
        in_progress = sum(enrollment.status == "in_progress" for enrollment in enrollments)
        latest = db.query(Assessment).filter(Assessment.employee_id == employee.id).order_by(Assessment.assessment_date.desc(), Assessment.id.desc()).first()
        actual = employee_actual_impact(db, employee.id)
        rows.append({
            "employee_name": employee.user.name if employee.user else "—",
            "department_name": employee.department.name if employee.department else "—",
            "latest_score": round(latest.total_score, 1) if latest and latest.total_score is not None else None,
            "plan_count": len(plans),
            "plan_status": plans[0].status if plans else "no_plan",
            "total_courses": total_courses,
            "completed_courses": completed_courses,
            "in_progress": in_progress,
            "progress_percent": round((completed_courses / total_courses) * 100) if total_courses else 0,
            "actual_gain": actual["actual_gain"],
        })
    return sorted(rows, key=lambda row: (row["progress_percent"], row["employee_name"]))


def comprehensive_employee_details(db: Session, user: User) -> list[dict]:
    """Printable detail blocks for every employee visible to the requester."""
    details = []
    for employee in scoped_employees(db, user):
        plans = (
            db.query(TrainingPlan)
            .filter(TrainingPlan.employee_id == employee.id)
            .order_by(TrainingPlan.created_at.desc(), TrainingPlan.id.desc())
            .all()
        )
        enrollments = [enrollment for plan in plans for enrollment in plan.enrollments]
        latest = (
            db.query(Assessment)
            .filter(Assessment.employee_id == employee.id)
            .order_by(Assessment.assessment_date.desc(), Assessment.id.desc())
            .first()
        )
        total_courses = len(enrollments)
        completed_courses = sum(enrollment.status == "completed" for enrollment in enrollments)
        details.append({
            "employee_name": employee.user.name if employee.user else "—",
            "department_name": employee.department.name if employee.department else "—",
            "position": employee.position or "—",
            "latest_score": round(latest.total_score, 1) if latest and latest.total_score is not None else None,
            "latest_assessment_date": latest.assessment_date.isoformat() if latest and latest.assessment_date else None,
            "completed_courses": completed_courses,
            "total_courses": total_courses,
            "progress_percent": round((completed_courses / total_courses) * 100) if total_courses else 0,
            "actual_gain": employee_actual_impact(db, employee.id)["actual_gain"],
            "skills": sorted([
                {
                    "name": item.skill.name if item.skill else "—",
                    "current_level": item.current_level or 0,
                    "target_level": item.target_level or 0,
                    "gap": max(0, (item.target_level or 0) - (item.current_level or 0)),
                }
                for item in employee.skills
            ], key=lambda item: (item["gap"], item["name"]), reverse=True),
            "plans": [
                {
                    "status": plan.status,
                    "start_date": plan.start_date.isoformat() if plan.start_date else "—",
                    "end_date": plan.end_date.isoformat() if plan.end_date else "—",
                    "courses": [
                        {
                            "title": enrollment.course.title if enrollment.course else "—",
                            "status": enrollment.status,
                            "score": enrollment.score,
                        }
                        for enrollment in plan.enrollments
                    ],
                }
                for plan in plans
            ],
        })
    return sorted(details, key=lambda detail: detail["employee_name"])


def enrollment_status_label(status: str) -> str:
    return {
        "enrolled": "مسجل",
        "in_progress": "قيد التنفيذ",
        "completed": "مكتملة",
        "failed": "غير مكتملة",
    }.get(status, status)


def report_status_label(status: str) -> str:
    return {
        "pending_manager": "بانتظار المدير",
        "pending_hr": "بانتظار الموارد البشرية",
        "approved": "معتمدة",
        "active": "جارية",
        "completed": "مكتملة",
        "rejected": "مرفوضة",
        "no_plan": "لا توجد خطة",
    }.get(status, status)


@router.get("/overview")
def report_overview(db: Session = Depends(get_db), user: User = Depends(require_role("admin", "hr", "manager"))):
    return report_overview_payload(db, user)


@router.get("/department-skills")
def report_dept_skills(db: Session = Depends(get_db), user: User = Depends(require_role("hr", "admin"))):
    departments = db.query(Department).all()
    result = []
    for dept in departments:
        emps = db.query(Employee).filter(Employee.department_id == dept.id).all()
        total_gap = 0
        skill_count = 0
        for emp in emps:
            for es in emp.skills:
                gap = es.target_level - es.current_level
                if gap > 0:
                    total_gap += gap
                    skill_count += 1
        result.append({
            "department": dept.name,
            "employee_count": len(emps),
            "total_gaps": total_gap,
            "avg_gap": round(total_gap / skill_count, 1) if skill_count > 0 else 0
        })
    return result


@router.get("/training-needs")
def report_training_needs(db: Session = Depends(get_db), user: User = Depends(require_role("hr", "admin"))):
    skills = db.query(Skill).all()
    result = []
    for skill in skills:
        emp_skills = db.query(EmployeeSkill).filter(EmployeeSkill.skill_id == skill.id).all()
        gap_count = sum(1 for es in emp_skills if es.target_level - es.current_level > 0)
        total = len(emp_skills)
        result.append({
            "skill_name": skill.name,
            "category": skill.category,
            "gap_percentage": round((gap_count / total) * 100) if total > 0 else 0,
            "gap_count": gap_count
        })
    result.sort(key=lambda x: x["gap_percentage"], reverse=True)
    return result


@router.get("/performance-tracking")
def report_performance(db: Session = Depends(get_db), user: User = Depends(require_role("hr", "admin", "manager"))):
    employees = scoped_employees(db, user)
    result = []
    for emp in employees:
        latest = db.query(Assessment).filter(
            Assessment.employee_id == emp.id
        ).order_by(Assessment.assessment_date.desc()).first()

        score = latest.total_score if latest else 0

        active_plans = db.query(TrainingPlan).filter(
            TrainingPlan.employee_id == emp.id,
            TrainingPlan.status.in_(["approved", "active"])
        ).all()

        total_enr = sum(len(p.enrollments) for p in active_plans)
        completed_enr = sum(1 for p in active_plans for e in p.enrollments if e.status == "completed")

        if score < 2:
            risk = "عالي المخاطر"
        elif score < 3.5:
            risk = "يحتاج متابعة"
        else:
            risk = "جيد"

        if total_enr == 0:
            training_status = "بدون خطة"
        elif completed_enr == total_enr:
            training_status = "مكتمل"
        elif completed_enr > 0:
            training_status = "يحتاج متابعة"
        else:
            training_status = "متأخر"

        result.append({
            "employee_name": emp.user.name if emp.user else "—",
            "score": round(score * 20),
            "risk": risk,
            "training_status": training_status,
        })

    result.sort(key=lambda x: x["score"])
    return result


@router.get("/department-distribution")
def report_dept_distribution(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    departments = db.query(Department).all()
    total = db.query(Employee).count() or 1
    result = []
    for dept in departments:
        count = db.query(Employee).filter(Employee.department_id == dept.id).count()
        result.append({
            "department": dept.name,
            "count": count,
            "percentage": round((count / total) * 100),
        })
    return result


@router.get("/training-impact")
def report_training_impact(db: Session = Depends(get_db), user: User = Depends(require_role("hr", "admin", "manager"))):
    employees = scoped_employees(db, user)
    result = []
    for emp in employees:
        actual = employee_actual_impact(db, emp.id)
        predicted = predict_employee_impact(db, emp.id)
        result.append({
            "employee_id": emp.id,
            "employee_name": emp.user.name if emp.user else "—",
            "department_name": emp.department.name if emp.department else "—",
            "completed_courses": actual["completed_courses"],
            "actual_gain": actual["actual_gain"],
            "predicted_gain": predicted.get("total_predicted_gain", 0),
            "summary": actual["summary"],
        })
    result.sort(key=lambda x: x["actual_gain"], reverse=True)
    return result


@router.get("/training-progress")
def report_training_progress(db: Session = Depends(get_db), user: User = Depends(require_role("hr", "admin", "manager"))):
    employee_ids = [employee.id for employee in scoped_employees(db, user)]
    plans = db.query(TrainingPlan).filter(TrainingPlan.employee_id.in_(employee_ids)).all() if employee_ids else []
    result = []
    for plan in plans:
        total = len(plan.enrollments)
        completed = sum(1 for e in plan.enrollments if e.status == "completed")
        in_progress = sum(1 for e in plan.enrollments if e.status == "in_progress")
        percent = round((completed / total) * 100) if total else 0
        result.append({
            "plan_id": plan.id,
            "employee_name": plan.employee.user.name if plan.employee and plan.employee.user else "—",
            "department_name": plan.employee.department.name if plan.employee and plan.employee.department else "—",
            "status": plan.status,
            "is_approved": plan.is_approved,
            "total_courses": total,
            "completed_courses": completed,
            "in_progress": in_progress,
            "progress_percent": percent,
        })
    result.sort(key=lambda x: x["progress_percent"])
    return result


@router.get("/decision-summary")
def report_decision_summary(db: Session = Depends(get_db), user: User = Depends(require_role("hr", "admin"))):
    needs = []
    skills = db.query(Skill).all()
    for skill in skills:
        emp_skills = db.query(EmployeeSkill).filter(EmployeeSkill.skill_id == skill.id).all()
        gap_count = sum(1 for es in emp_skills if (es.target_level or 0) - (es.current_level or 0) > 0)
        total = len(emp_skills) or 1
        needs.append({
            "skill_name": skill.name,
            "gap_count": gap_count,
            "gap_percentage": round((gap_count / total) * 100),
        })
    needs.sort(key=lambda x: x["gap_percentage"], reverse=True)
    pending_plans = db.query(TrainingPlan).filter(TrainingPlan.is_approved == False).count()
    completed_courses = db.query(TrainingEnrollment).filter(TrainingEnrollment.status == "completed").count()
    total_gain = sum(r.gain or 0 for r in db.query(TrainingImpact).filter(TrainingImpact.status == "approved").all())
    return {
        "pending_plans": pending_plans,
        "completed_courses": completed_courses,
        "total_skill_gain": round(total_gain, 2),
        "top_training_needs": needs[:6],
        "decision_note": "اعتمد الخطط ذات الفجوات العالية أولاً ثم تابع أثر الدورات المكتملة على مستوى المهارة.",
    }


@router.get("/export/csv")
def export_reports_csv(db: Session = Depends(get_db), user: User = Depends(require_role("hr", "admin", "manager"))):
    def csv_value(value):
        value = "" if value is None else str(value)
        return f"'{value}" if value.startswith(("=", "+", "-", "@")) else value

    rows = comprehensive_employee_rows(db, user)
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(["الموظف", "القسم", "آخر تقييم", "حالة الخطة", "عدد الخطط", "إجمالي الدورات", "المكتمل", "قيد التنفيذ", "نسبة الإنجاز", "الأثر الفعلي"])
    for row in rows:
        writer.writerow([
            csv_value(row["employee_name"]),
            csv_value(row["department_name"]),
            row["latest_score"] if row["latest_score"] is not None else "",
            csv_value(report_status_label(row["plan_status"])),
            row["plan_count"],
            row["total_courses"],
            row["completed_courses"],
            row["in_progress"],
            row["progress_percent"],
            row["actual_gain"],
        ])
    payload = output.getvalue().encode("utf-8-sig")  # BOM keeps Arabic readable in Excel.
    headers = {"Content-Disposition": "attachment; filename=training-progress.csv"}
    return StreamingResponse(iter([payload]), media_type="text/csv; charset=utf-8", headers=headers)


@router.get("/export/pdf", response_class=HTMLResponse)
def export_reports_pdf(db: Session = Depends(get_db), user: User = Depends(require_role("hr", "admin", "manager"))):
    """Arabic print-ready report. The browser Print dialog saves it as a PDF with native Arabic shaping."""
    overview = report_overview_payload(db, user)
    rows = comprehensive_employee_rows(db, user)
    employee_details = comprehensive_employee_details(db, user)
    table_rows = "".join(
        f"<tr><td>{escape(str(row['employee_name']))}</td><td>{escape(str(row['department_name']))}</td>"
        f"<td>{row['latest_score'] if row['latest_score'] is not None else '—'}/5</td><td>{escape(report_status_label(row['plan_status']))}</td>"
        f"<td>{row['completed_courses']}/{row['total_courses']}</td><td>{row['progress_percent']}%</td><td>{row['actual_gain']:+g}</td></tr>"
        for row in rows
    ) or "<tr><td colspan='5'>لا توجد بيانات تدريبية</td></tr>"
    top_gaps = "".join(f"<li>{escape(str(item['skill_name']))}: {item['affected_employees']} موظف، إجمالي فجوة {item['total_gap']}</li>" for item in overview['top_skill_gaps']) or "<li>لا توجد فجوات مسجلة</li>"
    detail_sections = ""
    for detail in employee_details:
        skill_rows = "".join(
            f"<tr><td>{escape(str(skill['name']))}</td><td>{skill['current_level']}/5</td><td>{skill['target_level']}/5</td><td>{skill['gap']}</td></tr>"
            for skill in detail["skills"]
        ) or "<tr><td colspan='4'>لا توجد مهارات مسجلة لهذا الموظف</td></tr>"
        plan_rows = ""
        for plan in detail["plans"]:
            courses = plan["courses"] or [{"title": "لا توجد دورات", "status": "—", "score": None}]
            for course in courses:
                score = "—" if course["score"] is None else str(course["score"])
                plan_rows += (
                    f"<tr><td>{escape(report_status_label(plan['status']))}</td><td>{escape(str(plan['start_date']))} — {escape(str(plan['end_date']))}</td>"
                    f"<td>{escape(str(course['title']))}</td><td>{escape(enrollment_status_label(course['status']))}</td><td>{escape(score)}</td></tr>"
                )
        plan_rows = plan_rows or "<tr><td colspan='5'>لا توجد خطة أو دورات تدريبية لهذا الموظف</td></tr>"
        latest_score = "—" if detail["latest_score"] is None else f"{detail['latest_score']}/5"
        assessment_date = detail["latest_assessment_date"] or "لا يوجد تقييم"
        detail_sections += f"""
        <section class='employee-section'>
          <h3>{escape(str(detail['employee_name']))}</h3>
          <p class='meta'>القسم: {escape(str(detail['department_name']))} · الوظيفة: {escape(str(detail['position']))} · آخر تقييم: {assessment_date} ({latest_score})</p>
          <div class='mini-cards'><div>إنجاز الدورات <strong>{detail['completed_courses']}/{detail['total_courses']}</strong></div><div>نسبة الإنجاز <strong>{detail['progress_percent']}%</strong></div><div>الأثر الفعلي <strong>{detail['actual_gain']:+g}</strong></div></div>
          <h4>المهارات والفجوات</h4><table><thead><tr><th>المهارة</th><th>الحالي</th><th>المستهدف</th><th>الفجوة</th></tr></thead><tbody>{skill_rows}</tbody></table>
          <h4>الخطط والدورات</h4><table><thead><tr><th>حالة الخطة</th><th>الفترة</th><th>الدورة</th><th>حالة الدورة</th><th>النتيجة</th></tr></thead><tbody>{plan_rows}</tbody></table>
        </section>"""
    detail_sections = detail_sections or "<p>لا يوجد موظفون ضمن نطاق هذا التقرير.</p>"
    return HTMLResponse(f"""<!doctype html><html lang='ar' dir='rtl'><head><meta charset='utf-8'><title>تقرير التدريب</title>
    <style>body{{font-family:Tahoma,Arial,sans-serif;color:#172033;margin:36px;background:#fff}}h1,h2,h3{{color:#1e4fcd}}h2{{margin-top:34px}}h4{{margin:20px 0 8px;color:#172033}}.meta{{color:#667085}}.cards,.mini-cards{{display:flex;gap:12px;margin:22px 0}}.card{{border:1px solid #dbe4f0;border-radius:10px;padding:14px;flex:1;background:#f8fbff}}.mini-cards div{{border:1px solid #dbe4f0;border-radius:8px;padding:10px;flex:1;background:#f8fbff}}.mini-cards strong{{display:block;color:#1e4fcd;font-size:18px;margin-top:4px}}.value{{font-size:24px;font-weight:bold;color:#1e4fcd}}table{{width:100%;border-collapse:collapse;margin-top:10px}}th{{background:#1e4fcd;color:white}}th,td{{padding:9px;border:1px solid #dbe4f0;text-align:right;vertical-align:top}}.employee-section{{border-top:2px solid #1e4fcd;margin-top:30px;padding-top:12px;break-inside:avoid}}@media print{{body{{margin:18px}}.no-print{{display:none}}.employee-section{{break-before:page}}.employee-section:first-of-type{{break-before:auto}}}}</style></head><body>
    <button class='no-print' onclick='window.print()'>حفظ أو طباعة PDF</button><h1>تقرير تقدم التدريب</h1><p class='meta'>النطاق: {escape(overview['scope'])} · التاريخ: {date.today().isoformat()}</p>
    <h2>الجزء العام</h2>
    <div class='cards'><div class='card'>الموظفون<div class='value'>{overview['employee_count']}</div></div><div class='card'>متوسط التقييم<div class='value'>{overview['average_assessment']}/5</div></div><div class='card'>إكمال الدورات<div class='value'>{overview['course_completion_rate']}%</div></div><div class='card'>خطط بانتظار HR<div class='value'>{overview['plan_statuses']['pending_hr']}</div></div></div>
    <h2>أهم فجوات المهارات</h2><ul>{top_gaps}</ul><h2>ملخص جميع الموظفين ضمن النطاق</h2><table><thead><tr><th>الموظف</th><th>القسم</th><th>آخر تقييم</th><th>حالة الخطة</th><th>المكتمل</th><th>التقدم</th><th>الأثر</th></tr></thead><tbody>{table_rows}</tbody></table>
    <h2>التفاصيل حسب الموظف</h2>{detail_sections}</body></html>""")

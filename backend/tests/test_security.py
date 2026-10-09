"""Security tests: CSV formula injection and audit log immutability."""
import pytest
from sqlalchemy import text
from tests.conftest import login_client


def test_csv_export_formula_injection_protection(client, db):
    # Insert employee with formula injection name
    from models import Employee, User, TrainingPlan, TrainingEnrollment
    bad_user = User(name="=cmd|' /C calc'!A0", email="hacker@test.com", password_hash="xxx", role="employee")
    db.add(bad_user)
    db.flush()
    bad_emp = Employee(user_id=bad_user.id, department_id=1, position="Tester")
    db.add(bad_emp)
    db.flush()
    plan = TrainingPlan(employee_id=bad_emp.id, is_approved=True, status="active")
    db.add(plan)
    db.flush()
    db.add(TrainingEnrollment(training_plan_id=plan.id, course_id=1, status="in_progress"))
    db.commit()

    login_client(client, "hr@test.com")
    res = client.get("/api/reports/export/csv")
    assert res.status_code == 200
    assert res.content.startswith(b"\xef\xbb\xbf")
    content = res.text
    # Cell starting with '=' must be escaped with a single quote "'"
    assert "'=cmd|" in content


def test_role_report_overview_and_print_ready_pdf(client):
    login_client(client, "hr@test.com")
    overview = client.get("/api/reports/overview")
    pdf = client.get("/api/reports/export/pdf")

    assert overview.status_code == 200
    assert overview.json()["employee_count"] >= 1
    assert "top_skill_gaps" in overview.json()
    assert pdf.status_code == 200
    assert "تقرير تقدم التدريب" in pdf.text
    assert "الجزء العام" in pdf.text
    assert "التفاصيل حسب الموظف" in pdf.text


def test_manager_can_export_only_direct_team_report(client):
    login_client(client, "manager@test.com")

    csv_report = client.get("/api/reports/export/csv")
    pdf_report = client.get("/api/reports/export/pdf")

    assert csv_report.status_code == 200
    assert pdf_report.status_code == 200
    assert "Employee Test" in csv_report.content.decode("utf-8-sig")
    assert "ملخص جميع الموظفين ضمن النطاق" in pdf_report.text
    assert "التفاصيل حسب الموظف" in pdf_report.text


def test_audit_logs_immutability(db):
    from models import AuditLog
    log = AuditLog(action="test_action", entity="test", details="immutable details")
    db.add(log)
    db.commit()

    # Attempting to update or delete on SQLite should trigger abort if triggers are installed
    if db.bind.dialect.name == "sqlite":
        with pytest.raises(Exception):
            db.execute(text(f"UPDATE audit_logs SET details = 'tampered' WHERE id = {log.id}"))
            db.commit()

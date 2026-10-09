"""Regression tests for privacy boundaries and non-API route ordering."""
from tests.conftest import login_client


def test_employee_cannot_read_or_generate_ai_data_for_another_employee(client):
    headers = login_client(client, "employee@test.com")

    impact = client.get("/api/ai/impact/1", headers=headers)
    gaps = client.get("/api/ai/skill-gaps/1", headers=headers)
    recommendation = client.post("/api/ai/recommend/1", headers=headers)

    assert impact.status_code == 403
    assert gaps.status_code == 403
    assert recommendation.status_code == 403


def test_guide_route_is_not_hidden_by_static_files(client):
    response = client.get("/guides/USER_GUIDE.docx")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )


def test_manager_can_generate_recommendation_for_direct_report(client):
    headers = login_client(client, "manager@test.com")

    response = client.post("/api/ai/recommend/2", headers=headers)

    assert response.status_code == 200
    assert response.json()["employee_id"] == 2


def test_first_manager_assessment_creates_missing_employee_skill_profiles(client, db):
    from auth import hash_password
    from models import Employee, EmployeeSkill, User

    user = User(name="New Team Member", email="new-team@test.com", password_hash=hash_password("123456"), role="employee")
    db.add(user)
    db.flush()
    employee = Employee(user_id=user.id, department_id=1, manager_id=1, position="Trainee")
    db.add(employee)
    db.commit()
    headers = login_client(client, "manager@test.com")
    response = client.post("/api/assessments", json={
        "employee_id": employee.id,
        "type": "manager",
        "items": [{"skill_id": 1, "score": 3, "notes": "تقييم أول"}],
    }, headers=headers)

    assert response.status_code == 200
    profile = db.query(EmployeeSkill).filter_by(employee_id=employee.id, skill_id=1).one()
    assert profile.current_level == 3
    assert profile.target_level == 5


def test_manager_page_apis_are_limited_to_the_direct_team(client):
    headers_manager = login_client(client, "manager@test.com")
    headers_employee = login_client(client, "employee@test.com")

    assert client.get("/api/employees/team/members", headers=headers_employee).status_code == 403
    assert client.get("/api/employees/team/overview", headers=headers_employee).status_code == 403
    assert client.get("/api/employees/1/skills", headers=headers_manager).status_code == 403
    assert client.get("/api/assessments/compare/1", headers=headers_manager).status_code == 403


def test_assessment_rejects_empty_or_out_of_range_scores(client):
    headers = login_client(client, "manager@test.com")
    empty = client.post("/api/assessments", json={"employee_id": 2, "type": "manager", "items": []}, headers=headers)
    out_of_range = client.post("/api/assessments", json={"employee_id": 2, "type": "manager", "items": [{"skill_id": 1, "score": 6}]}, headers=headers)

    assert empty.status_code == 422
    assert out_of_range.status_code == 422

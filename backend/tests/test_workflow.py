"""Workflow tests for plan approvals, rejections, and skill promotions."""
from tests.conftest import login_client


def test_plan_lifecycle_and_multi_tier_approval(client, db):
    # 1. Employee self-enrolls
    headers_emp = login_client(client, "employee@test.com")
    enroll_res = client.post("/api/courses/1/enroll", headers=headers_emp)
    assert enroll_res.status_code == 200
    plan_id = enroll_res.json()["plan_id"]
    enrollment_id = enroll_res.json()["enrollment_id"]

    # Check plan is pending or draft
    plan_res = client.get("/api/training-plans/my")
    assert plan_res.status_code == 200
    assert plan_res.json()["is_approved"] is False

    # 2. Manager approves plan
    headers_mgr = login_client(client, "manager@test.com")
    mgr_app_res = client.put(f"/api/training-plans/{plan_id}/manager-approve", json={"notes": "معتمد من المدير"}, headers=headers_mgr)
    assert mgr_app_res.status_code == 200
    assert mgr_app_res.json()["status"] == "pending_hr"

    # 3. HR gives final approval
    headers_hr = login_client(client, "hr@test.com")
    hr_app_res = client.put(f"/api/training-plans/{plan_id}/approve", headers=headers_hr)
    assert hr_app_res.status_code == 200
    assert hr_app_res.json()["status"] == "approved"

    # 4. Employee starts and completes course
    headers_emp = login_client(client, "employee@test.com")
    start_res = client.put(f"/api/enrollments/{enrollment_id}/start", headers=headers_emp)
    assert start_res.status_code == 200

    comp_res = client.put(f"/api/enrollments/{enrollment_id}/complete", json={"score": 95}, headers=headers_emp)
    assert comp_res.status_code == 200
    assert comp_res.json()["status"] == "completed"

    # Verify skill was NOT auto-promoted silently
    emp_skills = client.get("/api/employees/2/skills").json()
    python_skill = next(s for s in emp_skills if s["skill_id"] == 1)
    assert python_skill["current_level"] == 2  # Still unchanged

    # 5. Manager reviews pending skill upgrades and approves
    headers_mgr = login_client(client, "manager@test.com")
    pending = client.get("/api/skill-upgrades/pending").json()
    assert len(pending) >= 1
    impact_id = pending[0]["id"]

    decide_res = client.put(f"/api/skill-upgrades/{impact_id}/decision", json={"approved": True, "notes": "أداء ممتاز"}, headers=headers_mgr)
    assert decide_res.status_code == 200
    assert decide_res.json()["status"] == "approved"

    # Now verify skill was upgraded to new level
    emp_skills_after = client.get("/api/employees/2/skills").json()
    python_skill_after = next(s for s in emp_skills_after if s["skill_id"] == 1)
    assert python_skill_after["current_level"] > 2


def test_plan_rejection_workflow(client):
    # Employee self-enrolls
    headers_emp = login_client(client, "employee@test.com")
    enroll_res = client.post("/api/courses/1/enroll", headers=headers_emp)
    plan_id = enroll_res.json()["plan_id"]

    # Manager rejects plan with reason
    headers_mgr = login_client(client, "manager@test.com")
    reject_res = client.put(
        f"/api/training-plans/{plan_id}/reject",
        json={"reason": "يُرجى اختيار دورة تتناسب أكثر مع مشاريع الربع القادم"},
        headers=headers_mgr
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "rejected"
    assert "سبب الرفض" in reject_res.json()["message"]

    headers_emp = login_client(client, "employee@test.com")
    resubmit_res = client.put(f"/api/training-plans/{plan_id}/resubmit", headers=headers_emp)
    assert resubmit_res.status_code == 200
    assert resubmit_res.json()["status"] == "pending_manager"


def test_hr_cannot_bypass_direct_manager_approval(client):
    headers_emp = login_client(client, "employee@test.com")
    plan_id = client.post("/api/courses/1/enroll", headers=headers_emp).json()["plan_id"]

    headers_hr = login_client(client, "hr@test.com")
    response = client.put(f"/api/training-plans/{plan_id}/approve", headers=headers_hr)

    assert response.status_code == 409


def test_assessment_type_is_enforced_by_role(client):
    headers_employee = login_client(client, "employee@test.com")
    response = client.post("/api/assessments", json={
        "employee_id": 2,
        "type": "manager",
        "items": [{"skill_id": 1, "score": 4}],
    }, headers=headers_employee)

    assert response.status_code == 403

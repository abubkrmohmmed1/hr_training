"""Pytest fixtures and test environment setup."""
import os
import sys
import pytest
from fastapi.testclient import TestClient

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from database import Base, get_db, setup_database_triggers
from main import app
from routers.auth import LOGIN_ATTEMPTS, LOGIN_ATTEMPTS_LOCK
from models import (
    Course, Department, Employee, EmployeeSkill,
    Skill, TrainingEnrollment, TrainingPlan, User
)
from auth import hash_password
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(bind=test_engine, autoflush=False, autocommit=False)


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=test_engine)
    setup_database_triggers(test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db():
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    # Seed baseline users
    pwd = hash_password("123456")
    admin_user = User(id=1, name="Admin Test", email="admin@test.com", password_hash=pwd, role="admin", is_active=True)
    hr_user = User(id=2, name="HR Test", email="hr@test.com", password_hash=pwd, role="hr", is_active=True)
    mgr_user = User(id=3, name="Manager Test", email="manager@test.com", password_hash=pwd, role="manager", is_active=True)
    emp_user = User(id=4, name="Employee Test", email="employee@test.com", password_hash=pwd, role="employee", is_active=True)
    session.add_all([admin_user, hr_user, mgr_user, emp_user])
    session.flush()

    dept = Department(id=1, name="IT", description="IT Dept")
    session.add(dept)
    session.flush()

    mgr_emp = Employee(id=1, user_id=mgr_user.id, department_id=1, position="Lead")
    emp_emp = Employee(id=2, user_id=emp_user.id, department_id=1, manager_id=1, position="Dev")
    session.add_all([mgr_emp, emp_emp])
    session.flush()

    skill_py = Skill(id=1, name="Python", category="Tech", weight=2.0, max_level=5)
    skill_sql = Skill(id=2, name="SQL", category="Tech", weight=1.5, max_level=5)
    session.add_all([skill_py, skill_sql])
    session.flush()

    es1 = EmployeeSkill(employee_id=emp_emp.id, skill_id=1, current_level=2, target_level=5)
    es2 = EmployeeSkill(employee_id=emp_emp.id, skill_id=2, current_level=3, target_level=5)
    session.add_all([es1, es2])

    c1 = Course(id=1, title="Advanced Python", skill_id=1, level=3, duration_hours=30, cost=100)
    session.add(c1)
    session.commit()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db):
    with LOGIN_ATTEMPTS_LOCK:
        LOGIN_ATTEMPTS.clear()

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def login_client(client: TestClient, email: str = "employee@test.com", password: str = "123456"):
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    csrf_token = res.cookies.get("csrf_token")
    return {"X-CSRF-Token": csrf_token} if csrf_token else {}

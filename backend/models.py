"""SQLAlchemy models — enterprise training and skill management."""
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Date, DateTime,
    Text, ForeignKey, JSON, UniqueConstraint, func
)
from sqlalchemy.orm import relationship
from database import Base, engine, SessionLocal, get_db


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)  # admin | hr | manager | employee
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    employee = relationship("Employee", back_populates="user", uselist=False)
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"
    id = Column(Integer, primary_key=True, index=True)
    jti = Column(String(64), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)

    employees = relationship("Employee", back_populates="department", foreign_keys="Employee.department_id")


class Employee(Base):
    __tablename__ = "employees"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    department_id = Column(Integer, ForeignKey("departments.id"))
    manager_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    position = Column(String(100))
    hire_date = Column(Date)
    phone = Column(String(20))

    user = relationship("User", back_populates="employee")
    department = relationship("Department", back_populates="employees", foreign_keys=[department_id])
    manager = relationship("Employee", remote_side="Employee.id", foreign_keys=[manager_id])
    skills = relationship("EmployeeSkill", back_populates="employee")
    assessments = relationship("Assessment", back_populates="employee", foreign_keys="Assessment.employee_id")
    training_plans = relationship("TrainingPlan", back_populates="employee", foreign_keys="TrainingPlan.employee_id")


class Skill(Base):
    __tablename__ = "skills"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    category = Column(String(50))  # technical | soft | language
    description = Column(Text)
    max_level = Column(Integer, default=5)
    weight = Column(Float, default=1.0)  # importance multiplier: 1.0 standard, 1.5 core, 2.0 critical


class EmployeeSkill(Base):
    __tablename__ = "employee_skills"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    skill_id = Column(Integer, ForeignKey("skills.id"))
    current_level = Column(Integer, default=0)
    target_level = Column(Integer, default=5)
    assessed_date = Column(Date)

    employee = relationship("Employee", back_populates="skills")
    skill = relationship("Skill")


class Assessment(Base):
    __tablename__ = "assessments"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    assessor_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    type = Column(String(20))  # self | manager
    assessment_date = Column(Date)
    total_score = Column(Float, default=0)
    status = Column(String(20), default="pending")  # pending | completed | reviewed

    employee = relationship("Employee", back_populates="assessments", foreign_keys=[employee_id])
    assessor = relationship("Employee", foreign_keys=[assessor_id])
    items = relationship("AssessmentItem", back_populates="assessment", cascade="all, delete-orphan")
    recommendation = relationship("AIRecommendation", back_populates="assessment", uselist=False)


class AssessmentItem(Base):
    __tablename__ = "assessment_items"
    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id"))
    skill_id = Column(Integer, ForeignKey("skills.id"))
    score = Column(Integer, default=0)
    notes = Column(Text)

    assessment = relationship("Assessment", back_populates="items")
    skill = relationship("Skill")


class Course(Base):
    __tablename__ = "courses"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    skill_id = Column(Integer, ForeignKey("skills.id"))
    level = Column(Integer, default=1)
    duration_hours = Column(Integer, default=10)
    provider = Column(String(100))
    type = Column(String(20))  # online | classroom | workshop
    cost = Column(Float, default=0)

    skill = relationship("Skill")


class TrainingPlan(Base):
    __tablename__ = "training_plans"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    created_by = Column(Integer, ForeignKey("employees.id"), nullable=True)
    start_date = Column(Date)
    end_date = Column(Date)
    status = Column(String(30), default="draft")  # draft | pending_manager | pending_hr | approved | active | completed | rejected
    ai_reason = Column(Text)
    is_approved = Column(Boolean, default=False)
    manager_approved = Column(Boolean, default=False)
    manager_notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    budget_estimated = Column(Float, default=0.0)
    created_at = Column(DateTime, server_default=func.now())

    employee = relationship("Employee", back_populates="training_plans", foreign_keys=[employee_id])
    enrollments = relationship("TrainingEnrollment", back_populates="plan", cascade="all, delete-orphan")


class TrainingEnrollment(Base):
    __tablename__ = "training_enrollments"
    id = Column(Integer, primary_key=True, index=True)
    training_plan_id = Column(Integer, ForeignKey("training_plans.id"))
    course_id = Column(Integer, ForeignKey("courses.id"))
    enrolled_date = Column(Date)
    completed_date = Column(Date, nullable=True)
    status = Column(String(20), default="enrolled")  # enrolled | in_progress | completed | failed
    score = Column(Float, nullable=True)

    plan = relationship("TrainingPlan", back_populates="enrollments")
    course = relationship("Course")


class AIRecommendation(Base):
    __tablename__ = "ai_recommendations"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    assessment_id = Column(Integer, ForeignKey("assessments.id"), nullable=True)
    skill_gaps = Column(JSON)
    recommended_courses = Column(JSON)
    confidence_score = Column(Float, default=0.0)
    generated_at = Column(DateTime, server_default=func.now())

    assessment = relationship("Assessment", back_populates="recommendation")


class TrainingImpact(Base):
    __tablename__ = "training_impacts"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    enrollment_id = Column(Integer, ForeignKey("training_enrollments.id"), nullable=True)
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=True)
    previous_level = Column(Integer, default=0)
    new_level = Column(Integer, default=0)
    gain = Column(Float, default=0)
    course_score = Column(Float, nullable=True)
    status = Column(String(30), default="pending_approval")  # pending_approval | approved | rejected
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    manager_notes = Column(Text, nullable=True)
    recorded_date = Column(Date, server_default=func.current_date())

    skill = relationship("Skill")
    employee = relationship("Employee")


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    link = Column(String(255), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="notifications")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(80), nullable=False)
    entity = Column(String(50))
    entity_id = Column(Integer, nullable=True)
    details = Column(Text)
    created_at = Column(DateTime, server_default=func.now())


class CourseFavorite(Base):
    __tablename__ = "course_favorites"
    __table_args__ = (UniqueConstraint("employee_id", "course_id", name="uq_course_favorite_employee_course"),)
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    course_id = Column(Integer, ForeignKey("courses.id"))
    created_at = Column(DateTime, server_default=func.now())

    employee = relationship("Employee")
    course = relationship("Course")


class CourseReview(Base):
    __tablename__ = "course_reviews"
    __table_args__ = (UniqueConstraint("employee_id", "course_id", name="uq_course_review_employee_course"),)
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    course_id = Column(Integer, ForeignKey("courses.id"))
    rating = Column(Integer, default=5)
    comment = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    employee = relationship("Employee")
    course = relationship("Course")

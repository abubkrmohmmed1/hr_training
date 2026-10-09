"""Pydantic schemas for request/response validation."""
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, Any
from datetime import date, datetime


# --- Auth ---
class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    user: "UserOut"


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


# --- Department ---
class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None


class DepartmentOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# --- Employee ---
class EmployeeCreate(BaseModel):
    name: str
    email: str
    password: Optional[str] = "123456"
    role: str = "employee"
    department_id: Optional[int] = None
    manager_id: Optional[int] = None
    position: Optional[str] = None
    hire_date: Optional[date] = None
    phone: Optional[str] = None


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    department_id: Optional[int] = None
    manager_id: Optional[int] = None
    position: Optional[str] = None
    hire_date: Optional[date] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None


class EmployeeOut(BaseModel):
    id: int
    user_id: int
    department_id: Optional[int] = None
    manager_id: Optional[int] = None
    position: Optional[str] = None
    hire_date: Optional[date] = None
    phone: Optional[str] = None
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_role: Optional[str] = None
    department_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# --- Skill ---
class SkillCreate(BaseModel):
    name: str
    category: Optional[str] = "تقنية"
    description: Optional[str] = None
    max_level: int = 5
    weight: float = 1.0


class SkillOut(BaseModel):
    id: int
    name: str
    category: Optional[str] = None
    description: Optional[str] = None
    max_level: int = 5
    weight: float = 1.0

    model_config = ConfigDict(from_attributes=True)


# --- EmployeeSkill ---
class EmployeeSkillOut(BaseModel):
    id: int
    employee_id: int
    skill_id: int
    current_level: int
    target_level: int
    assessed_date: Optional[date] = None
    skill_name: Optional[str] = None
    skill_category: Optional[str] = None
    weight: Optional[float] = 1.0

    model_config = ConfigDict(from_attributes=True)


# --- Assessment ---
class AssessmentItemIn(BaseModel):
    skill_id: int
    score: int = Field(ge=1, le=5)
    notes: Optional[str] = None


class AssessmentCreate(BaseModel):
    employee_id: int
    type: str  # self | manager
    items: list[AssessmentItemIn] = Field(min_length=1)


class AssessmentItemOut(BaseModel):
    id: int
    skill_id: int
    score: int
    notes: Optional[str] = None
    skill_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AssessmentOut(BaseModel):
    id: int
    employee_id: int
    assessor_id: Optional[int] = None
    type: str
    assessment_date: Optional[date] = None
    total_score: float
    status: str
    items: list[AssessmentItemOut] = []

    model_config = ConfigDict(from_attributes=True)


# --- Course ---
class CourseCreate(BaseModel):
    title: str
    description: Optional[str] = None
    skill_id: Optional[int] = None
    level: int = 1
    duration_hours: int = 10
    provider: Optional[str] = None
    type: Optional[str] = "online"
    cost: float = 0


class CourseOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    skill_id: Optional[int] = None
    level: int = 1
    duration_hours: int = 10
    provider: Optional[str] = None
    type: Optional[str] = None
    cost: float = 0
    skill_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CourseEnrollmentSummary(BaseModel):
    id: int
    status: str
    score: Optional[float] = None
    plan_approved: bool = False


class CourseCatalogOut(CourseOut):
    avg_rating: float = 0
    reviews_count: int = 0
    enrolled_count: int = 0
    is_favorite: bool = False
    enrollment: Optional[CourseEnrollmentSummary] = None
    my_review: Optional[dict] = None
    current_level: Optional[int] = None
    target_level: Optional[int] = None
    predicted_gain: Optional[float] = None


class CourseReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None


class CourseReviewOut(BaseModel):
    id: int
    employee_name: Optional[str] = None
    rating: int
    comment: Optional[str] = None
    created_at: Optional[datetime] = None
    message: Optional[str] = None


class CourseFavoriteToggleOut(BaseModel):
    is_favorite: bool
    message: str


# --- Training Plan ---
class TrainingPlanCreate(BaseModel):
    employee_id: int
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    course_ids: list[int]
    ai_reason: Optional[str] = None
    auto_approve: bool = False


class TrainingPlanManagerApprove(BaseModel):
    notes: Optional[str] = None


class TrainingPlanReject(BaseModel):
    reason: str = Field(min_length=3, description="سبب الرفض والتعديلات المطلوبة")


class TrainingPlanOut(BaseModel):
    id: int
    employee_id: int
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: str
    ai_reason: Optional[str] = None
    is_approved: bool
    manager_approved: bool = False
    manager_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    budget_estimated: float = 0.0
    created_at: Optional[datetime] = None
    employee_name: Optional[str] = None
    department_name: Optional[str] = None
    enrollments: list["EnrollmentOut"] = []

    model_config = ConfigDict(from_attributes=True)


class EnrollmentComplete(BaseModel):
    score: Optional[float] = None


class EnrollmentOut(BaseModel):
    id: int
    course_id: int
    status: str
    score: Optional[float] = None
    course_title: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# --- Skill Upgrade Workflow ---
class SkillUpgradeOut(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    skill_id: Optional[int] = None
    skill_name: Optional[str] = None
    previous_level: int
    new_level: int
    gain: float
    course_score: Optional[float] = None
    status: str
    manager_notes: Optional[str] = None
    recorded_date: Optional[date] = None

    model_config = ConfigDict(from_attributes=True)


class SkillUpgradeDecision(BaseModel):
    approved: bool
    notes: Optional[str] = None


# --- Notifications ---
class NotificationOut(BaseModel):
    id: int
    title: str
    message: str
    link: Optional[str] = None
    is_read: bool
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# --- AI & ML ---
class ModelMetricsOut(BaseModel):
    algorithm: str
    r2: float
    mae: float
    rmse: float
    features: list[str]
    feature_importances: dict[str, float]
    trained: bool
    note: str


class AIRecommendationOut(BaseModel):
    id: int
    employee_id: int
    skill_gaps: Optional[Any] = None
    recommended_courses: Optional[Any] = None
    confidence_score: float
    generated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# --- Dashboard Stats ---
class AdminStats(BaseModel):
    total_employees: int
    total_departments: int
    total_courses: int
    total_users: int


class HRStats(BaseModel):
    total_employees: int
    pending_assessments: int
    in_training: int
    pending_plans: int


class EmployeeStats(BaseModel):
    courses_in_plan: int
    completed_assessments: int
    overall_progress: float

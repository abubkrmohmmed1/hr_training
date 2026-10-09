"""Course catalog, enrollment requests, reviews, and favorites routes."""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models import (
    Course, CourseFavorite, CourseReview, Employee,
    EmployeeSkill, Skill, TrainingEnrollment, TrainingPlan, User, get_db
)
from schemas import (
    CourseCatalogOut, CourseCreate, CourseFavoriteToggleOut,
    CourseOut, CourseReviewCreate, CourseReviewOut
)
from auth import get_current_user, require_role
from services.audit_service import log_action
from services.notification_service import send_notification
from ml_model import predict_course_impact

router = APIRouter(prefix="/api/courses", tags=["Courses"])

COURSE_TYPES = {"online", "classroom", "workshop"}


def course_payload(course: Course) -> dict:
    return {
        "id": course.id,
        "title": course.title,
        "description": course.description,
        "skill_id": course.skill_id,
        "level": course.level,
        "duration_hours": course.duration_hours,
        "provider": course.provider,
        "type": course.type,
        "cost": course.cost,
        "skill_name": course.skill.name if course.skill else None,
    }


def course_rating(db: Session, course_id: int) -> dict:
    reviews = db.query(CourseReview).filter(CourseReview.course_id == course_id).all()
    if not reviews:
        return {"avg_rating": 0.0, "reviews_count": 0}
    avg = round(sum((r.rating or 0) for r in reviews) / len(reviews), 1)
    return {"avg_rating": avg, "reviews_count": len(reviews)}


def enrolled_count(db: Session, course_id: int) -> int:
    return db.query(TrainingEnrollment).filter(TrainingEnrollment.course_id == course_id).count()


def course_public(db: Session, course: Course, emp: Employee | None = None) -> dict:
    payload = course_payload(course)
    payload.update(course_rating(db, course.id))
    payload["enrolled_count"] = enrolled_count(db, course.id)
    payload["is_favorite"] = bool(emp and db.query(CourseFavorite).filter(
        CourseFavorite.employee_id == emp.id,
        CourseFavorite.course_id == course.id,
    ).first())
    if emp:
        enrollment = (db.query(TrainingEnrollment)
                      .join(TrainingPlan, TrainingEnrollment.training_plan_id == TrainingPlan.id)
                      .filter(TrainingPlan.employee_id == emp.id, TrainingEnrollment.course_id == course.id)
                      .order_by(TrainingEnrollment.id.desc()).first())
        payload["enrollment"] = {
            "id": enrollment.id,
            "status": enrollment.status,
            "score": enrollment.score,
            "plan_approved": enrollment.plan.is_approved if enrollment.plan else False,
        } if enrollment else None
    return payload


@router.get("", response_model=list[CourseCatalogOut])
def list_courses(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    emp = db.query(Employee).filter(Employee.user_id == user.id).first()
    return [course_public(db, c, emp) for c in db.query(Course).all()]


@router.post("", response_model=CourseOut)
def create_course(
    req: CourseCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin", "hr"))
):
    title = req.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="عنوان الدورة مطلوب")
    if req.skill_id and not db.query(Skill).filter(Skill.id == req.skill_id).first():
        raise HTTPException(status_code=400, detail="المهارة غير موجودة")
    course_type = req.type or "online"
    if course_type not in COURSE_TYPES:
        raise HTTPException(status_code=400, detail="نوع الدورة غير صالح")
    if req.level < 1 or req.level > 5:
        raise HTTPException(status_code=400, detail="المستوى يجب أن يكون بين 1 و 5")

    course = Course(
        title=title,
        description=req.description,
        skill_id=req.skill_id,
        level=req.level,
        duration_hours=req.duration_hours or 10,
        provider=req.provider,
        type=course_type,
        cost=req.cost or 0,
    )
    db.add(course)
    db.flush()
    log_action(db, user, "create_course", "course", course.id, f"إضافة دورة: {title}")
    db.commit()
    db.refresh(course)
    return course_payload(course)


@router.get("/favorites/me", response_model=list[CourseCatalogOut])
def my_favorites(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    emp = db.query(Employee).filter(Employee.user_id == user.id).first()
    if not emp:
        return []
    favorites = db.query(CourseFavorite).filter(CourseFavorite.employee_id == emp.id).all()
    courses = db.query(Course).filter(Course.id.in_([f.course_id for f in favorites])).all() if favorites else []
    return [course_public(db, c, emp) for c in courses]


@router.get("/{course_id}", response_model=CourseCatalogOut)
def get_course(course_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="الدورة غير موجودة")
    emp = db.query(Employee).filter(Employee.user_id == user.id).first()
    payload = course_public(db, course, emp)
    if emp:
        review = db.query(CourseReview).filter(
            CourseReview.employee_id == emp.id, CourseReview.course_id == course_id
        ).first()
        payload["my_review"] = {"rating": review.rating, "comment": review.comment} if review else None
        if course.skill_id:
            es = db.query(EmployeeSkill).filter(
                EmployeeSkill.employee_id == emp.id, EmployeeSkill.skill_id == course.skill_id
            ).first()
            if es:
                gap = max(0, (es.target_level or 5) - (es.current_level or 0))
                payload["current_level"] = es.current_level
                payload["target_level"] = es.target_level
                payload["predicted_gain"] = predict_course_impact(
                    current=es.current_level or 0,
                    gap=gap,
                    course_level=course.level or 1,
                    duration=course.duration_hours or 10,
                    cost=course.cost or 0,
                )
    return payload


@router.post("/{course_id}/favorite", response_model=CourseFavoriteToggleOut)
def toggle_favorite(course_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    emp = db.query(Employee).filter(Employee.user_id == user.id).first()
    if not emp:
        raise HTTPException(status_code=403, detail="لا يوجد ملف موظف")
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="الدورة غير موجودة")
    favorite = db.query(CourseFavorite).filter(
        CourseFavorite.employee_id == emp.id, CourseFavorite.course_id == course_id
    ).first()
    if favorite:
        db.delete(favorite)
        db.commit()
        return {"is_favorite": False, "message": "تمت إزالة الدورة من المفضلة"}
    db.add(CourseFavorite(employee_id=emp.id, course_id=course_id))
    db.commit()
    return {"is_favorite": True, "message": "تمت إضافة الدورة إلى المفضلة"}


@router.get("/{course_id}/reviews", response_model=list[CourseReviewOut])
def list_course_reviews(course_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not db.query(Course).filter(Course.id == course_id).first():
        raise HTTPException(status_code=404, detail="الدورة غير موجودة")
    reviews = db.query(CourseReview).filter(CourseReview.course_id == course_id).order_by(CourseReview.created_at.desc()).all()
    result = []
    for r in reviews:
        emp = db.query(Employee).filter(Employee.id == r.employee_id).first()
        result.append({
            "id": r.id,
            "employee_name": emp.user.name if emp and emp.user else "—",
            "rating": r.rating,
            "comment": r.comment,
            "created_at": r.created_at,
        })
    return result


@router.post("/{course_id}/reviews", response_model=CourseReviewOut)
def create_course_review(
    course_id: int,
    req: CourseReviewCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="الدورة غير موجودة")
    emp = db.query(Employee).filter(Employee.user_id == user.id).first()
    if not emp:
        raise HTTPException(status_code=403, detail="لا يوجد ملف موظف")

    completed = (db.query(TrainingEnrollment)
                 .join(TrainingPlan, TrainingEnrollment.training_plan_id == TrainingPlan.id)
                 .filter(TrainingPlan.employee_id == emp.id,
                         TrainingEnrollment.course_id == course_id,
                         TrainingEnrollment.status == "completed").first())
    if not completed:
        raise HTTPException(status_code=400, detail="يمكنك تقييم الدورة بعد إكمالها فقط")

    review = db.query(CourseReview).filter(
        CourseReview.employee_id == emp.id, CourseReview.course_id == course_id
    ).first()
    if review:
        review.rating = req.rating
        review.comment = req.comment
    else:
        review = CourseReview(employee_id=emp.id, course_id=course_id, rating=req.rating, comment=req.comment)
        db.add(review)

    log_action(db, user, "review_course", "course", course_id, f"تقييم دورة: {course.title} ({req.rating}/5)")
    db.commit()
    db.refresh(review)
    return {
        "id": review.id,
        "rating": review.rating,
        "comment": review.comment,
        "created_at": review.created_at,
        "message": "تم حفظ تقييمك، شكراً لك"
    }


@router.post("/{course_id}/enroll")
def self_enroll(course_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="الدورة غير موجودة")
    emp = db.query(Employee).filter(Employee.user_id == user.id).first()
    if not emp:
        raise HTTPException(status_code=403, detail="لا يوجد ملف موظف")

    existing = (db.query(TrainingEnrollment)
                .join(TrainingPlan, TrainingEnrollment.training_plan_id == TrainingPlan.id)
                .filter(TrainingPlan.employee_id == emp.id,
                        TrainingEnrollment.course_id == course_id,
                        TrainingEnrollment.status.in_(["enrolled", "in_progress"]))
                .first())
    if existing:
        return {
            "enrollment_id": existing.id,
            "status": existing.status,
            "plan_id": existing.training_plan_id,
            "plan_approved": existing.plan.is_approved if existing.plan else False,
            "message": "أنت مسجّل في هذه الدورة بالفعل",
        }

    plan = (db.query(TrainingPlan)
            .filter(TrainingPlan.employee_id == emp.id,
                    TrainingPlan.status.in_(["draft", "approved", "active"]))
            .order_by(TrainingPlan.created_at.desc()).first())
    if not plan:
        plan = TrainingPlan(
            employee_id=emp.id,
            start_date=date.today(),
            end_date=date(date.today().year, 12, 31),
            status="pending_manager" if emp.manager_id else "pending_hr",
            is_approved=False,
            ai_reason="طلب تسجيل ذاتي من الموظف في دورة تدريبية.",
        )
        db.add(plan)
        db.flush()

    enrollment = TrainingEnrollment(
        training_plan_id=plan.id,
        course_id=course_id,
        enrolled_date=date.today(),
        status="enrolled",
    )
    db.add(enrollment)
    db.flush()

    if emp.manager and emp.manager.user:
        send_notification(
            db,
            user_id=emp.manager.user.id,
            title="طلب تسجيل في دورة",
            message=f"سجل الموظف {emp.user.name} في دورة '{course.title}'.",
            link="/manager.html"
        )

    log_action(db, user, "self_enroll", "enrollment", enrollment.id, f"طلب تسجيل في دورة: {course.title}")
    db.commit()
    return {
        "enrollment_id": enrollment.id,
        "status": enrollment.status,
        "plan_id": plan.id,
        "plan_approved": plan.is_approved,
        "message": "تم تسجيل طلبك، وسيظهر في خطتك بعد اعتماد الموارد البشرية" if not plan.is_approved else "تمت إضافتك إلى الدورة",
    }

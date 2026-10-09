"""AI recommendations, weighted skill gaps, and ML model evaluation metrics router."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models import AIRecommendation, Employee, User, get_db
from schemas import AIRecommendationOut, ModelMetricsOut
from auth import get_current_user
from ai_engine import (
    analyze_skill_gaps, employee_actual_impact,
    generate_recommendation, predict_employee_impact
)
from ml_model import model_info

router = APIRouter(prefix="/api/ai", tags=["AI Engine"])


def assert_employee_scope(db: Session, user: User, employee: Employee) -> None:
    """Allow HR/Admin globally, managers for direct reports, and employees for themselves."""
    if user.role in ("admin", "hr"):
        return
    actor = db.query(Employee).filter(Employee.user_id == user.id).first()
    if user.role == "manager" and actor and employee.manager_id == actor.id:
        return
    if user.role == "employee" and employee.user_id == user.id:
        return
    raise HTTPException(status_code=403, detail="غير مصرح لك بالوصول إلى بيانات هذا الموظف")


@router.post("/recommend/{employee_id}", response_model=AIRecommendationOut)
def ai_recommend(
    employee_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    assert_employee_scope(db, user, emp)
    return generate_recommendation(db, employee_id)


@router.get("/impact/me")
def my_impact(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    emp = db.query(Employee).filter(Employee.user_id == user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="لا يوجد ملف موظف")
    return predict_employee_impact(db, emp.id)


@router.get("/impact/{employee_id}")
def employee_impact(employee_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    assert_employee_scope(db, user, emp)
    return predict_employee_impact(db, employee_id)


@router.get("/skill-gaps/{employee_id}")
def get_skill_gaps(employee_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    assert_employee_scope(db, user, emp)
    return analyze_skill_gaps(db, employee_id)


@router.get("/recommendations")
def list_recommendations(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role == "employee":
        emp = db.query(Employee).filter(Employee.user_id == user.id).first()
        if not emp:
            return []
        recs = db.query(AIRecommendation).filter(AIRecommendation.employee_id == emp.id).order_by(AIRecommendation.generated_at.desc()).all()
    elif user.role == "manager":
        mgr_emp = db.query(Employee).filter(Employee.user_id == user.id).first()
        if not mgr_emp:
            return []
        team_ids = [m.id for m in db.query(Employee).filter(Employee.manager_id == mgr_emp.id).all()] + [mgr_emp.id]
        recs = db.query(AIRecommendation).filter(AIRecommendation.employee_id.in_(team_ids)).order_by(AIRecommendation.generated_at.desc()).all()
    else:
        recs = db.query(AIRecommendation).order_by(AIRecommendation.generated_at.desc()).all()

    result = []
    for r in recs:
        emp = db.query(Employee).filter(Employee.id == r.employee_id).first()
        result.append({
            "id": r.id,
            "employee_id": r.employee_id,
            "employee_name": emp.user.name if emp and emp.user else "—",
            "department_name": emp.department.name if emp and emp.department else "—",
            "confidence_score": r.confidence_score,
            "generated_at": str(r.generated_at) if r.generated_at else None,
            "skill_gaps": r.skill_gaps,
            "recommended_courses": (r.recommended_courses or [])[:4],
        })
    return result


@router.get("/model-metrics", response_model=ModelMetricsOut)
def get_model_metrics(user: User = Depends(get_current_user)):
    info = model_info()
    return ModelMetricsOut(
        algorithm=info["algorithm"],
        r2=info["r2"],
        mae=info["mae"],
        rmse=info["rmse"],
        features=info["features"],
        feature_importances=info["feature_importances"],
        trained=info["trained"],
        note=info["note"],
    )


@router.get("/actual-impact/me")
def my_actual_impact(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    emp = db.query(Employee).filter(Employee.user_id == user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="لا يوجد ملف موظف")
    return employee_actual_impact(db, emp.id)


@router.get("/actual-impact/{employee_id}")
def actual_impact(employee_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    assert_employee_scope(db, user, emp)
    return employee_actual_impact(db, employee_id)

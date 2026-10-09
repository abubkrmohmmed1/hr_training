"""FastAPI Application Entrypoint — Clean, Modular Architecture."""
from pathlib import Path
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from config import ALLOWED_ORIGINS
from database import Base, engine, setup_database_triggers
from ml_model import get_impact_model

# Routers
from routers import (
    ai,
    assessments,
    audit_logs,
    auth,
    courses,
    dashboard,
    departments,
    employees,
    notifications,
    reports,
    skill_upgrades,
    skills,
    training_plans,
)

# Initialize schema and database-level triggers
Base.metadata.create_all(bind=engine)
setup_database_triggers(engine)

# Pre-load or initialize ML model artifact with signature check
get_impact_model()

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
GUIDE_DIR = FRONTEND_DIR.parent

app = FastAPI(
    title="نظام تدريب الموظفين الذكي",
    description="نظام ذكي متكامل لتقييم المهارات وتوليد خطط التدريب والموافقة متعددة المستويات",
    version="2.0.0",
    docs_url="/api/docs",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _csrf_is_valid(request: Request) -> bool:
    cookie_token = request.cookies.get("csrf_token")
    header_token = request.headers.get("X-CSRF-Token")
    return bool(cookie_token) and cookie_token == header_token


@app.middleware("http")
async def csrf_protection(request: Request, call_next):
    unsafe_method = request.method in {"POST", "PUT", "PATCH", "DELETE"}
    if unsafe_method and request.url.path.startswith("/api/") and request.url.path != "/api/auth/login":
        if request.cookies.get("access_token") and not _csrf_is_valid(request):
            return Response(
                status_code=403,
                content='{"detail":"CSRF token غير صالح أو مفقود"}',
                media_type="application/json"
            )
    return await call_next(request)


# Register API Routers
app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(departments.router)
app.include_router(employees.router)
app.include_router(skills.router)
app.include_router(assessments.router)
app.include_router(courses.router)
app.include_router(training_plans.router)
app.include_router(skill_upgrades.router)
app.include_router(notifications.router)
app.include_router(ai.router)
app.include_router(reports.router)
app.include_router(audit_logs.router)

# Static and SPA HTML Serving
@app.get("/")
def serve_index():
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/guides/{guide_name}")
def serve_guide(guide_name: str):
    guides = {"USER_GUIDE.docx", "TECHNICAL_GUIDE.docx"}
    if guide_name not in guides:
        raise HTTPException(status_code=404, detail="الملف غير موجود")
    path = GUIDE_DIR / guide_name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="الملف غير موجود")
    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=guide_name,
    )


# Handle naming compatibility for hr-plans.html and plans-hr.html
@app.get("/plans-hr.html")
def serve_plans_hr():
    return FileResponse(FRONTEND_DIR / "hr-plans.html")


@app.get("/{page_name}.html")
def serve_page(page_name: str):
    path = FRONTEND_DIR / f"{page_name}.html"
    if not path.exists():
        raise HTTPException(status_code=404, detail="الصفحة غير موجودة")
    return FileResponse(path)


app.mount("/css", StaticFiles(directory=str(FRONTEND_DIR / "css")), name="css")
app.mount("/js", StaticFiles(directory=str(FRONTEND_DIR / "js")), name="js")
app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

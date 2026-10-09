"""Authentication routes — login, logout, me, and user accounts."""
from uuid import uuid4
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from threading import Lock
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from config import ACCESS_TOKEN_EXPIRE_MINUTES, COOKIE_SAMESITE, COOKIE_SECURE, LOGIN_MAX_ATTEMPTS
from models import User, get_db
from schemas import LoginRequest, TokenResponse, UserOut
from auth import (
    create_token, get_current_user, require_role,
    revoke_token, verify_password
)
from services.audit_service import log_action

router = APIRouter(tags=["Auth"])

LOGIN_ATTEMPTS = defaultdict(deque)
LOGIN_ATTEMPTS_LOCK = Lock()
LOGIN_WINDOW = timedelta(minutes=15)


def enforce_login_rate_limit(request: Request) -> None:
    client_ip = request.client.host if request.client else "unknown"
    now = datetime.now(timezone.utc)
    with LOGIN_ATTEMPTS_LOCK:
        attempts = LOGIN_ATTEMPTS[client_ip]
        while attempts and now - attempts[0] > LOGIN_WINDOW:
            attempts.popleft()
        if len(attempts) >= LOGIN_MAX_ATTEMPTS:
            raise HTTPException(status_code=429, detail="تم تجاوز عدد محاولات تسجيل الدخول، حاول لاحقًا")


def record_failed_login(request: Request) -> None:
    client_ip = request.client.host if request.client else "unknown"
    with LOGIN_ATTEMPTS_LOCK:
        LOGIN_ATTEMPTS[client_ip].append(datetime.now(timezone.utc))


def clear_login_attempts(request: Request) -> None:
    client_ip = request.client.host if request.client else "unknown"
    with LOGIN_ATTEMPTS_LOCK:
        LOGIN_ATTEMPTS.pop(client_ip, None)


@router.post("/api/auth/login", response_model=TokenResponse)
def login(req: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    enforce_login_rate_limit(request)
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        record_failed_login(request)
        raise HTTPException(status_code=401, detail="بيانات الدخول غير صحيحة")
    if not user.is_active:
        record_failed_login(request)
        raise HTTPException(status_code=403, detail="الحساب معطل")

    clear_login_attempts(request)

    token = create_token(user.id, user.role)
    csrf_token = uuid4().hex
    max_age = ACCESS_TOKEN_EXPIRE_MINUTES * 60
    response.set_cookie(
        key="access_token",
        value=token,
        max_age=max_age,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/",
    )
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        max_age=max_age,
        httponly=False,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/",
    )
    log_action(db, user, "login", "auth", user.id, "تسجيل دخول ناجح")
    db.commit()
    return {"user": UserOut.model_validate(user)}


@router.get("/api/auth/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/api/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get("access_token")
    if token:
        revoke_token(token, db)
        db.commit()
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("csrf_token", path="/")


@router.get("/api/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), user: User = Depends(require_role("admin"))):
    return [UserOut.model_validate(u) for u in db.query(User).all()]

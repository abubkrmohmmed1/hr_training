"""JWT authentication — minimal but secure."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from config import ACCESS_TOKEN_EXPIRE_MINUTES, SECRET_KEY
from models import RevokedToken, User, get_db

ALGORITHM = "HS256"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_token(user_id: int, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "role": role, "jti": uuid4().hex, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def revoke_token(token: str, db: Session) -> None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        expires_at = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        jti = payload["jti"]
    except (JWTError, KeyError, TypeError, ValueError):
        return
    if not db.query(RevokedToken).filter(RevokedToken.jti == jti).first():
        db.add(RevokedToken(jti=jti, expires_at=expires_at))


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(security),
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db)
) -> User:
    try:
        token = creds.credentials if creds else access_token
        if not token:
            raise JWTError("Missing credentials")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
        jti = payload["jti"]
    except (JWTError, KeyError, TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="توكن غير صالح")
    if db.query(RevokedToken).filter(RevokedToken.jti == jti).first():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="انتهت صلاحية الجلسة")
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="مستخدم غير موجود")
    return user


def require_role(*roles):
    """Dependency factory: restricts endpoint to specific roles."""
    def checker(user: User = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="صلاحيات غير كافية")
        return user
    return checker

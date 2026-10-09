"""Runtime configuration loaded from environment variables."""
import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def required(name: str) -> str:
    value = os.getenv(name)
    if not value or value.startswith("change-me"):
        raise RuntimeError(f"{name} must be set in backend/.env")
    return value


DATABASE_URL = required("DATABASE_URL")
SECRET_KEY = required("SECRET_KEY")
MODEL_SIGNING_KEY = required("MODEL_SIGNING_KEY")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
LOGIN_MAX_ATTEMPTS = int(os.getenv("LOGIN_MAX_ATTEMPTS", "20"))
ALLOWED_ORIGINS = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "http://127.0.0.1:8000,http://localhost:8000").split(",") if origin.strip()]
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax")

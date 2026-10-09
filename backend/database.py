"""Database engine and session management supporting SQLite and PostgreSQL."""
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from config import DATABASE_URL

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine_kwargs = {"connect_args": connect_args}
if not DATABASE_URL.startswith("sqlite"):
    engine_kwargs.update({"pool_pre_ping": True, "pool_size": 10, "max_overflow": 20})

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def setup_database_triggers(target_engine=None):
    """Ensure audit logs are immutable via database-level triggers where supported."""
    eng = target_engine or engine
    if eng.dialect.name == "sqlite":
        with eng.begin() as connection:
            connection.exec_driver_sql(
                "CREATE TRIGGER IF NOT EXISTS audit_logs_no_update "
                "BEFORE UPDATE ON audit_logs BEGIN SELECT RAISE(ABORT, 'Audit logs are immutable'); END;"
            )
            connection.exec_driver_sql(
                "CREATE TRIGGER IF NOT EXISTS audit_logs_no_delete "
                "BEFORE DELETE ON audit_logs BEGIN SELECT RAISE(ABORT, 'Audit logs are immutable'); END;"
            )

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from database import engine, Base
from routers import (
    auth_router, admin_router, profile_router, assessments_router,
    courses_router, banks_router, ai_interview_router,
    ai_recommend_router, notifications_router,
    training_smekit_router, training_assessments_router,
    analytics_router, video_assignments_router,
)
from config import UPLOAD_DIR

# Create all tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="LMS Platform API", version="2.6.0")

# Open CORS — JWT is sent as Bearer header, not a cookie, so credentials=False is correct.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files
if os.path.exists(UPLOAD_DIR):
    app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Register routers
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(profile_router)
app.include_router(assessments_router)
app.include_router(courses_router)
app.include_router(banks_router)
app.include_router(ai_interview_router)
app.include_router(ai_recommend_router)
app.include_router(notifications_router)
app.include_router(training_smekit_router)
app.include_router(training_assessments_router)
app.include_router(analytics_router)
app.include_router(video_assignments_router)


@app.get("/health")
def health():
    return {"status": "ok", "version": "2.6.0"}


@app.on_event("startup")
def startup():
    """Auto-seed if DB is empty. Also run lightweight column/constraint migrations."""
    from sqlalchemy import text
    db_url_str = str(engine.url)
    if "sqlite" in db_url_str:
        try:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_ready BOOLEAN NOT NULL DEFAULT 0"))
                conn.commit()
        except Exception:
            pass
        # Migrate email unique → (email, role) unique for SQLite
        try:
            with engine.connect() as conn:
                conn.execute(text("DROP INDEX IF EXISTS ix_users_email"))
                conn.commit()
        except Exception:
            pass
        try:
            with engine.connect() as conn:
                conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_user_email_role ON users(email, role)"))
                conn.commit()
        except Exception:
            pass
    else:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_ready BOOLEAN NOT NULL DEFAULT FALSE"))
            conn.commit()
        # Migrate email unique → (email, role) unique for PostgreSQL
        try:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key"))
                conn.commit()
        except Exception:
            pass
        try:
            with engine.connect() as conn:
                conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_user_email_role ON users(email, role)"))
                conn.commit()
        except Exception:
            pass

    # Add avatar_path to profiles table if not exists
    if "sqlite" in db_url_str:
        try:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE profiles ADD COLUMN avatar_path VARCHAR(500)"))
                conn.commit()
        except Exception:
            pass
    else:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_path VARCHAR(500)"))
            conn.commit()

    # Add free + course_type columns to user_courses (added in v2.1)
    if "sqlite" in db_url_str:
        for col_sql in [
            "ALTER TABLE user_courses ADD COLUMN free BOOLEAN",
            "ALTER TABLE user_courses ADD COLUMN course_type VARCHAR(30)",
        ]:
            try:
                with engine.connect() as conn:
                    conn.execute(text(col_sql))
                    conn.commit()
            except Exception:
                pass
    else:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE user_courses ADD COLUMN IF NOT EXISTS free BOOLEAN"))
            conn.execute(text("ALTER TABLE user_courses ADD COLUMN IF NOT EXISTS course_type VARCHAR(30)"))
            conn.commit()

    # Add designation + experience + department to users (added in v2.1 profile-save fix)
    if "sqlite" in db_url_str:
        for col_sql in [
            "ALTER TABLE users ADD COLUMN designation VARCHAR(100)",
            "ALTER TABLE users ADD COLUMN experience VARCHAR(50)",
        ]:
            try:
                with engine.connect() as conn:
                    conn.execute(text(col_sql))
                    conn.commit()
            except Exception:
                pass
    else:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS designation VARCHAR(100)"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS experience VARCHAR(50)"))
            conn.commit()

    # Add sub_department to users (v2.2 training module)
    if "sqlite" in db_url_str:
        try:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN sub_department VARCHAR(100)"))
                conn.commit()
        except Exception:
            pass
    else:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS sub_department VARCHAR(100)"))
            conn.commit()

    # Add difficulty column to training_questions (v2.3)
    if "sqlite" in db_url_str:
        try:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE training_questions ADD COLUMN difficulty VARCHAR(10)"))
                conn.commit()
        except Exception:
            pass
    else:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE training_questions ADD COLUMN IF NOT EXISTS difficulty VARCHAR(10)"))
            conn.commit()

    # Add easy/medium/hard difficulty columns to training_assessments (v2.3)
    if "sqlite" in db_url_str:
        for col_sql in [
            "ALTER TABLE training_assessments ADD COLUMN easy_count INTEGER DEFAULT 0",
            "ALTER TABLE training_assessments ADD COLUMN medium_count INTEGER DEFAULT 0",
            "ALTER TABLE training_assessments ADD COLUMN hard_count INTEGER DEFAULT 0",
        ]:
            try:
                with engine.connect() as conn:
                    conn.execute(text(col_sql))
                    conn.commit()
            except Exception:
                pass
    else:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE training_assessments ADD COLUMN IF NOT EXISTS easy_count INTEGER DEFAULT 0"))
            conn.execute(text("ALTER TABLE training_assessments ADD COLUMN IF NOT EXISTS medium_count INTEGER DEFAULT 0"))
            conn.execute(text("ALTER TABLE training_assessments ADD COLUMN IF NOT EXISTS hard_count INTEGER DEFAULT 0"))
            conn.commit()

    # Add generation column to training_questions (v2.4) — tracks question set per re-attempt
    if "sqlite" in db_url_str:
        try:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE training_questions ADD COLUMN generation INTEGER DEFAULT 1"))
                conn.commit()
        except Exception:
            pass
    else:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE training_questions ADD COLUMN IF NOT EXISTS generation INTEGER DEFAULT 1"))
            conn.commit()

    # Add question_generation column to training_attempts (v2.4) — links attempt to its question set
    if "sqlite" in db_url_str:
        try:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE training_attempts ADD COLUMN question_generation INTEGER DEFAULT 1"))
                conn.commit()
        except Exception:
            pass
    else:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE training_attempts ADD COLUMN IF NOT EXISTS question_generation INTEGER DEFAULT 1"))
            conn.commit()

    # Make sme_kit_id nullable on training_assessments (v2.5) — Excel-imported assessments have no SME kit
    if "sqlite" not in db_url_str:
        try:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE training_assessments ALTER COLUMN sme_kit_id DROP NOT NULL"))
                conn.commit()
        except Exception:
            pass

    # Add attempt_request_status to training_assessments (v2.7)
    if "sqlite" in db_url_str:
        try:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE training_assessments ADD COLUMN attempt_request_status VARCHAR(20)"))
                conn.commit()
        except Exception:
            pass
    else:
        try:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE training_assessments ADD COLUMN IF NOT EXISTS attempt_request_status VARCHAR(20)"))
                conn.commit()
        except Exception:
            pass

    # Make creator/uploader columns nullable so deleting a user doesn't cascade-fail (v2.6)
    if "sqlite" not in db_url_str:
        for stmt in [
            "ALTER TABLE sme_kits ALTER COLUMN created_by DROP NOT NULL",
            "ALTER TABLE sme_kit_files_v2 ALTER COLUMN uploaded_by DROP NOT NULL",
            "ALTER TABLE training_assessments ALTER COLUMN created_by DROP NOT NULL",
            "ALTER TABLE training_assessments ALTER COLUMN new_joiner_id DROP NOT NULL",
        ]:
            try:
                with engine.connect() as conn:
                    conn.execute(text(stmt))
                    conn.commit()
            except Exception:
                pass

    # Create training module tables (v2.2) — create_all handles new tables but not column additions
    Base.metadata.create_all(bind=engine)

    from sqlalchemy.orm import Session
    from database import SessionLocal
    from models import User
    db = SessionLocal()
    try:
        if not db.query(User).first():
            db.close()
            import seed  # noqa: F401
        else:
            db.close()
    except Exception:
        db.close()

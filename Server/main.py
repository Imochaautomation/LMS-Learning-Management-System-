from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from database import engine, Base
from routers import (
    auth_router, admin_router, profile_router, assessments_router,
    courses_router, banks_router, ai_interview_router,
    ai_recommend_router, notifications_router,
)
from config import UPLOAD_DIR

# Create all tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="LMS Platform API", version="2.0.0")

origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
]
# Add production frontend URL from env
frontend_url = os.getenv("FRONTEND_URL", "")
if frontend_url:
    origins.append(frontend_url.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
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


@app.get("/health")
def health():
    return {"status": "ok", "version": "2.0.0"}


@app.on_event("startup")
def startup():
    """Auto-seed if DB is empty."""
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

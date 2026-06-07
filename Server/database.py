from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config import POSTGRES_URL
import os

# Support both PostgreSQL and SQLite
db_url = os.getenv("DATABASE_URL", POSTGRES_URL)

if db_url.startswith("sqlite"):
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
else:
    # Normalise to pg8000 driver (the only PostgreSQL driver in requirements.txt).
    # Railway provides DATABASE_URL as "postgres://" (deprecated scheme) — handle all variants.
    for old, new in [
        ("postgresql+psycopg://", "postgresql+pg8000://"),
        ("postgresql://",         "postgresql+pg8000://"),
        ("postgres://",           "postgresql+pg8000://"),   # Railway default scheme
    ]:
        if db_url.startswith(old):
            db_url = db_url.replace(old, new, 1)
            break
    engine = create_engine(db_url, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

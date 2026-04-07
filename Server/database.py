from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config import POSTGRES_URL
import os

# Support both PostgreSQL and SQLite
db_url = os.getenv("DATABASE_URL", POSTGRES_URL)

if db_url.startswith("sqlite"):
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
else:
    # Ensure the URL uses pg8000 driver
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+pg8000://", 1)
    elif db_url.startswith("postgresql+psycopg://"):
        db_url = db_url.replace("postgresql+psycopg://", "postgresql+pg8000://", 1)
    engine = create_engine(db_url, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

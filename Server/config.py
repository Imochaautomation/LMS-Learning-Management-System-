import os
from dotenv import load_dotenv

load_dotenv()

POSTGRES_URL = os.getenv("POSTGRES_URL", "postgresql://postgres:postgres@localhost:5432/lms_db")
JWT_SECRET = os.getenv("JWT_SECRET", "lms_dev_secret_key_change_in_prod")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 72

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
MODEL_NAME = os.getenv("MODEL_NAME", "google/gemini-2.0-flash-001")

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
for sub in ("assessments", "submissions", "smekit", "resumes", "proofs"):
    os.makedirs(os.path.join(UPLOAD_DIR, sub), exist_ok=True)

"""Seed database with initial users and data matching the UI mock data."""
from database import SessionLocal
from models import (
    User, SmeKitFile, AssessmentBankItem, CourseBankItem,
)
from auth import hash_password

db = SessionLocal()

# ── Users ──
# Admin
admin = User(
    name="Admin", email="admin@company.com",
    password_hash=hash_password("admin123"), plain_password="admin123",
    role="admin", department="Management",
)
db.add(admin)
db.flush()

# Manager
manager = User(
    name="Neha Gupta", email="neha@company.com",
    password_hash=hash_password("neha123"), plain_password="neha123",
    role="manager", department="Editing",
)
db.add(manager)
db.flush()

# New Joiner
nj1 = User(
    name="Priya Sharma", email="priya@company.com",
    password_hash=hash_password("priya123"), plain_password="priya123",
    role="new_joiner", department="Editing",
    manager_id=manager.id,
)
db.add(nj1)

# New Joiner 2
nj2 = User(
    name="Rohit Verma", email="rohit@company.com",
    password_hash=hash_password("rohit123"), plain_password="rohit123",
    role="new_joiner", department="Editing",
    manager_id=manager.id,
)
db.add(nj2)

# Employee
emp1 = User(
    name="Arjun Nair", email="arjun@company.com",
    password_hash=hash_password("arjun123"), plain_password="arjun123",
    role="employee", department="Editing",
    designation="Senior Editor", experience="4 years",
    manager_id=manager.id,
)
db.add(emp1)

# Employee 2
emp2 = User(
    name="Sameer Patel", email="sameer@company.com",
    password_hash=hash_password("sameer123"), plain_password="sameer123",
    role="employee", department="Editing",
    designation="Editor", experience="2 years",
    manager_id=manager.id,
)
db.add(emp2)

db.flush()

# ── SME Kit Files ──
sme_files = [
    ("imocha Style Guide v4.2", "Style Guide", "PDF"),
    ("US English Formatting Rules", "Formatting", "PDF"),
    ("Punctuation & Grammar Reference", "Style Guide", "PDF"),
    ("Error Reference Sheet", "Reference", "XLSX"),
    ("Sample Edited Questions - Set A", "Examples", "DOCX"),
    ("Sample Edited Questions - Set B", "Examples", "DOCX"),
    ("Long-Document Editing Guidelines", "Formatting", "PDF"),
    ("Academic & Technical Editing Conventions", "Style Guide", "PDF"),
]
for name, cat, ft in sme_files:
    db.add(SmeKitFile(name=name, category=cat, file_type=ft, uploaded_by=manager.id))

# ── Assessment Bank ──
assessments = [
    ("Assessment 1 - Basic Editing", "Beginner", "DOCX"),
    ("Assessment 2 - Grammar & Punctuation", "Intermediate", "XLSX"),
    ("Assessment 3 - US English Conversion", "Intermediate", "DOCX"),
    ("Assessment 4 - Technical Content", "Advanced", "DOCX"),
    ("Assessment 5 - Long Document Edit", "Advanced", "DOCX"),
]
for name, diff, ft in assessments:
    db.add(AssessmentBankItem(name=name, difficulty=diff, file_type=ft, uploaded_by=manager.id))

# ── Course Bank ──
courses = [
    ("Advanced Grammar for Editors", "Coursera", "6 weeks", "4.7", True, "Editing Skills", "Gap-Fill", "https://coursera.org"),
    ("US English Style Mastery", "Udemy", "4 weeks", "4.5", True, "Language", "Gap-Fill", "https://udemy.com"),
    ("Technical Writing Fundamentals", "LinkedIn Learning", "3 weeks", "4.6", True, "Writing", "Growth", "https://linkedin.com/learning"),
    ("Punctuation Masterclass", "Coursera", "2 weeks", "4.8", True, "Editing Skills", "Gap-Fill", "https://coursera.org"),
    ("Document Formatting Best Practices", "Udemy", "3 weeks", "4.3", True, "Formatting", "Growth", "https://udemy.com"),
    ("Academic Editing Certification", "edX", "8 weeks", "4.9", False, "Editing Skills", "Growth", "https://edx.org"),
    ("Proofreading Essentials", "Skillshare", "2 weeks", "4.4", True, "Editing Skills", "Gap-Fill", "https://skillshare.com"),
    ("Leadership Essentials", "Coursera", "5 weeks", "4.5", True, "Soft Skills", "Growth", "https://coursera.org"),
    ("Time Management for Professionals", "LinkedIn Learning", "2 weeks", "4.2", True, "Soft Skills", "Growth", "https://linkedin.com/learning"),
    ("Content Strategy & Planning", "Udemy", "4 weeks", "4.6", True, "Content", "Growth", "https://udemy.com"),
]
for title, prov, dur, rating, free, cat, tag, link in courses:
    db.add(CourseBankItem(title=title, provider=prov, duration=dur, rating=rating, free=free, category=cat, tag=tag, link=link))

db.commit()
db.close()

print("✅ Database seeded successfully!")
print(f"   Admin:      admin@company.com / admin123")
print(f"   Manager:    neha@company.com / neha123")
print(f"   New Joiner: priya@company.com / priya123")
print(f"   New Joiner: rohit@company.com / rohit123")
print(f"   Employee:   arjun@company.com / arjun123")
print(f"   Employee:   sameer@company.com / sameer123")

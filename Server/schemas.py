from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel


# ── Auth ──
class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    token: str
    user: "UserOut"


# ── Users ──
class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str
    department: Optional[str] = None
    designation: Optional[str] = None
    experience: Optional[str] = None
    manager_id: Optional[int] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    experience: Optional[str] = None
    manager_id: Optional[int] = None

class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    department: Optional[str] = None
    designation: Optional[str] = None
    experience: Optional[str] = None
    manager_id: Optional[int] = None
    manager_name: Optional[str] = None
    plain_password: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Profile ──
class ProfileCreate(BaseModel):
    summary: Optional[str] = None
    learning_goals: Optional[str] = None

class ProfileOut(BaseModel):
    id: int
    user_id: int
    summary: Optional[str] = None
    learning_goals: Optional[str] = None
    resume_path: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Assessments ──
class AssessmentAssignRequest(BaseModel):
    user_id: int
    assessment_name: str
    assessment_bank_id: Optional[int] = None
    assessment_type: str = "full"
    target_area: Optional[str] = None
    note: Optional[str] = None

class AssessmentAssignOut(BaseModel):
    id: int
    user_id: int
    assigned_by: int
    assessment_name: str
    assessment_type: str
    target_area: Optional[str] = None
    note: Optional[str] = None
    status: str
    submission_path: Optional[str] = None
    submission_file: Optional[str] = None
    assessment_file_path: Optional[str] = None
    ai_summary: Optional[str] = None
    score: Optional[float] = None
    assigned_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    user_name: Optional[str] = None
    assigner_name: Optional[str] = None
    user_role: Optional[str] = None

    class Config:
        from_attributes = True


# ── User Courses (employee) ──
class CourseSaveRequest(BaseModel):
    course_id: Optional[int] = None
    title: str
    provider: Optional[str] = None
    link: Optional[str] = None
    status: str = "saved"
    category: Optional[str] = None
    tag: Optional[str] = None
    duration: Optional[str] = None

class UserCourseOut(BaseModel):
    id: int
    user_id: int
    course_id: Optional[int] = None
    title: str
    provider: Optional[str] = None
    link: Optional[str] = None
    status: str
    proof_path: Optional[str] = None
    category: Optional[str] = None
    tag: Optional[str] = None
    duration: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Course Assignments (manager → learner) ──
class CourseAssignRequest(BaseModel):
    user_id: int
    course_id: int
    course_title: str
    note: Optional[str] = None

class CourseAssignOut(BaseModel):
    id: int
    user_id: int
    assigned_by: int
    course_id: int
    course_title: str
    note: Optional[str] = None
    assigned_at: Optional[datetime] = None
    user_name: Optional[str] = None
    assigner_name: Optional[str] = None

    class Config:
        from_attributes = True


# ── Course Completions (new joiner) ──
class CourseCompletionOut(BaseModel):
    id: int
    user_id: int
    course_id: int
    course_title: str
    proof_path: Optional[str] = None
    status: str
    submitted_at: Optional[datetime] = None
    user_name: Optional[str] = None
    user_role: Optional[str] = None

    class Config:
        from_attributes = True


# ── Banks ──
class AssessmentBankCreate(BaseModel):
    name: str
    difficulty: str = "Intermediate"
    file_type: str = "Word"

class AssessmentBankOut(BaseModel):
    id: int
    name: str
    difficulty: str
    file_type: str
    file_path: Optional[str] = None
    uploaded_by: Optional[int] = None
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class SmeKitCreate(BaseModel):
    name: str
    category: str = "Style Guide"
    file_type: str = "PDF"

class SmeKitOut(BaseModel):
    id: int
    name: str
    category: str
    file_type: str
    file_path: Optional[str] = None
    uploaded_by: Optional[int] = None
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class CourseBankCreate(BaseModel):
    title: str
    provider: Optional[str] = None
    duration: Optional[str] = None
    rating: Optional[str] = None
    free: bool = True
    category: str = "Editing Skills"
    tag: str = "Gap-Fill"
    link: Optional[str] = None

class CourseBankOut(BaseModel):
    id: int
    title: str
    provider: Optional[str] = None
    duration: Optional[str] = None
    rating: Optional[str] = None
    free: bool
    category: str
    tag: str
    link: Optional[str] = None
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True


# ── AI Interview ──
class InterviewRequest(BaseModel):
    question_index: int
    answer: str
    total_questions: int = 10
    force_complete: bool = False

class InterviewResponse(BaseModel):
    follow_up: str
    next_question: Optional[str] = None

class AnalysisRequest(BaseModel):
    user_id: int


# ── Notifications ──
class NotificationOut(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    type: str
    read: bool
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True


# ── Skill Gap ──
class SkillGapOut(BaseModel):
    skill: str
    score: int
    severity: str

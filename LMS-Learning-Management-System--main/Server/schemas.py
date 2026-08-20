from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel


# ── Auth ──
class LoginRequest(BaseModel):
    email: str
    password: str
    role: Optional[str] = None  # if same email has multiple accounts, specify which role to log into

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
    manager_department: Optional[str] = None
    is_ready: Optional[bool] = False
    plain_password: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Profile ──
class ProfileCreate(BaseModel):
    summary: Optional[str] = None
    learning_goals: Optional[str] = None
    designation: Optional[str] = None
    experience: Optional[str] = None
    department: Optional[str] = None

class ProfileOut(BaseModel):
    id: int
    user_id: int
    summary: Optional[str] = None
    learning_goals: Optional[str] = None
    resume_path: Optional[str] = None
    avatar_path: Optional[str] = None
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
    free: Optional[bool] = None
    course_type: Optional[str] = None
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
    total_questions: int = 15
    force_complete: bool = False
    is_clarification: bool = False
    is_consultant: bool = False

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


# ── Training Module ──

class SmeKitCreateV2(BaseModel):
    name: str
    description: Optional[str] = None
    department: Optional[str] = None
    sub_department: Optional[str] = None

class SmeKitFileOut(BaseModel):
    id: int
    sme_kit_id: int
    name: str
    file_type: str
    file_path: Optional[str] = None
    youtube_url: Optional[str] = None
    transcript: Optional[str] = None
    uploaded_by: int
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class SmeKitOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    department: Optional[str] = None
    sub_department: Optional[str] = None
    created_by: int
    creator_name: Optional[str] = None
    created_at: Optional[datetime] = None
    files: List[SmeKitFileOut] = []
    file_count: Optional[int] = 0
    class Config:
        from_attributes = True

class SmeKitAssignRequest(BaseModel):
    sme_kit_id: int
    user_id: int

class SmeKitAssignmentOut(BaseModel):
    id: int
    sme_kit_id: int
    user_id: int
    assigned_by: int
    assigned_at: Optional[datetime] = None
    kit_name: Optional[str] = None
    user_name: Optional[str] = None
    class Config:
        from_attributes = True

class GenerateAssessmentRequest(BaseModel):
    new_joiner_id: int
    sme_kit_id: int
    title: str
    source_file_ids: List[int]
    easy_count: int = 3
    easy_type: str = 'mcq'
    medium_count: int = 4
    medium_type: str = 'mcq'
    hard_count: int = 3
    hard_type: str = 'descriptive'
    pass_threshold: int = 70

class TrainingQuestionOut(BaseModel):
    id: int
    assessment_id: int
    order_index: int
    question_type: str
    question_text: str
    options: Optional[List[str]] = None
    class Config:
        from_attributes = True

class TrainingAssessmentOut(BaseModel):
    id: int
    title: str
    new_joiner_id: int
    created_by: int
    sme_kit_id: int
    source_file_ids: Optional[List[int]] = []
    total_questions: int
    mcq_count: int
    written_count: int
    pass_threshold: int
    status: str
    created_at: Optional[datetime] = None
    new_joiner_name: Optional[str] = None
    creator_name: Optional[str] = None
    kit_name: Optional[str] = None
    questions: Optional[List[TrainingQuestionOut]] = None
    class Config:
        from_attributes = True

class SubmitAttemptRequest(BaseModel):
    answers: List[dict]  # [{question_id: int, answer_text: str}]

class TrainingAnswerOut(BaseModel):
    id: int
    question_id: int
    answer_text: Optional[str] = None
    is_correct: Optional[bool] = None
    ai_flag: Optional[str] = None
    ai_explanation: Optional[str] = None
    class Config:
        from_attributes = True

class TrainingAttemptOut(BaseModel):
    id: int
    assessment_id: int
    user_id: int
    attempt_number: int
    status: str
    score: Optional[float] = None
    passed: Optional[bool] = None
    trophy_awarded: Optional[bool] = False
    ai_feedback: Optional[Any] = None
    submitted_at: Optional[datetime] = None
    evaluated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    answers: Optional[List[TrainingAnswerOut]] = None
    class Config:
        from_attributes = True

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON, Float, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

_now = func.now()


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint('email', 'role', name='uq_user_email_role'),)

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    plain_password = Column(String(255), nullable=True)
    role = Column(String(20), nullable=False)  # admin, manager, new_joiner, employee
    department = Column(String(100), nullable=True)
    sub_department = Column(String(100), nullable=True)  # e.g. Editing Team, Uploading Team
    designation = Column(String(100), nullable=True)
    experience = Column(String(50), nullable=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_ready = Column(Boolean, default=False, nullable=False, server_default="0")
    created_at = Column(DateTime, server_default=_now)

    manager = relationship("User", remote_side=[id], foreign_keys=[manager_id])
    profile = relationship("Profile", back_populates="user", uselist=False)


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    summary = Column(Text, nullable=True)
    learning_goals = Column(Text, nullable=True)
    resume_path = Column(String(500), nullable=True)
    avatar_path = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=_now)
    updated_at = Column(DateTime, server_default=_now, server_onupdate=_now)

    user = relationship("User", back_populates="profile")


class AssessmentAssignment(Base):
    __tablename__ = "assessment_assignments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    assessment_name = Column(String(300), nullable=False)
    assessment_file_path = Column(String(500), nullable=True)
    assessment_type = Column(String(50), default="full")
    target_area = Column(String(200), nullable=True)
    note = Column(Text, nullable=True)
    status = Column(String(20), default="pending")  # pending, downloaded, submitted, reviewed
    submission_path = Column(String(500), nullable=True)
    submission_file = Column(String(300), nullable=True)
    ai_summary = Column(Text, nullable=True)
    score = Column(Float, nullable=True)
    assigned_at = Column(DateTime, server_default=_now)
    submitted_at = Column(DateTime, nullable=True)

    user = relationship("User", foreign_keys=[user_id])
    assigner = relationship("User", foreign_keys=[assigned_by])


class UserCourse(Base):
    """Employee's own course tracking — saved, started, completed."""
    __tablename__ = "user_courses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    course_id = Column(Integer, nullable=True)  # FK to course_bank if from bank
    title = Column(String(300), nullable=False)
    provider = Column(String(200), nullable=True)
    link = Column(String(500), nullable=True)
    status = Column(String(20), default="saved")  # saved, started, completed
    proof_path = Column(String(500), nullable=True)
    category = Column(String(100), nullable=True)
    tag = Column(String(50), nullable=True)
    duration = Column(String(100), nullable=True)
    free = Column(Boolean, nullable=True)
    course_type = Column(String(30), nullable=True)  # video_free_cert, video_freemium, video_paid_cert, youtube, doc
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=_now)

    user = relationship("User")


class CourseAssignment(Base):
    """Manager assigns a course to a learner."""
    __tablename__ = "course_assignments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    course_id = Column(Integer, nullable=False)
    course_title = Column(String(300), nullable=False)
    note = Column(Text, nullable=True)
    assigned_at = Column(DateTime, server_default=_now)

    user = relationship("User", foreign_keys=[user_id])
    assigner = relationship("User", foreign_keys=[assigned_by])


class CourseCompletion(Base):
    """New joiner submits course completion proof."""
    __tablename__ = "course_completions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    course_id = Column(Integer, nullable=False)
    course_title = Column(String(300), nullable=False)
    proof_path = Column(String(500), nullable=True)
    status = Column(String(20), default="pending")  # pending, verified
    submitted_at = Column(DateTime, server_default=_now)

    user = relationship("User")


class AssessmentBankItem(Base):
    __tablename__ = "assessment_bank"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(300), nullable=False)
    difficulty = Column(String(50), default="Intermediate")
    file_type = Column(String(50), default="Word")
    file_path = Column(String(500), nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=_now)


class SmeKitFile(Base):
    __tablename__ = "sme_kit_files"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(300), nullable=False)
    category = Column(String(100), default="Style Guide")
    file_type = Column(String(50), default="PDF")
    file_path = Column(String(500), nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=_now)


class SmeKitAssignment(Base):
    """Content manager assigns SME Kit files to specific new joiners."""
    __tablename__ = "sme_kit_assignments"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("sme_kit_files.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_at = Column(DateTime, server_default=_now)

    file = relationship("SmeKitFile", foreign_keys=[file_id])
    user = relationship("User", foreign_keys=[user_id])
    assigner = relationship("User", foreign_keys=[assigned_by])


# ── Training Module (SME Kits + AI Assessments) ─────────────────────────────

class SmeKit(Base):
    """Named SME Kit collection created by a manager (e.g. 'Editing Onboarding Kit')."""
    __tablename__ = "sme_kits"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    department = Column(String(100), nullable=True)
    sub_department = Column(String(100), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=_now)

    creator = relationship("User", foreign_keys=[created_by])
    files = relationship("SmeKitFileV2", back_populates="kit", cascade="all, delete-orphan")


class SmeKitFileV2(Base):
    """File or YouTube video inside a named SmeKit."""
    __tablename__ = "sme_kit_files_v2"

    id = Column(Integer, primary_key=True, index=True)
    sme_kit_id = Column(Integer, ForeignKey("sme_kits.id"), nullable=False)
    name = Column(String(300), nullable=False)
    file_type = Column(String(20), nullable=False)   # "document" | "youtube" | "video"
    file_path = Column(String(500), nullable=True)   # for uploaded files
    youtube_url = Column(String(500), nullable=True) # for YouTube links
    transcript = Column(Text, nullable=True)         # extracted/uploaded transcript
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=_now)

    kit = relationship("SmeKit", back_populates="files")
    uploader = relationship("User", foreign_keys=[uploaded_by])


class SmeKitAssignmentV2(Base):
    """Manager assigns a whole SmeKit to a new joiner."""
    __tablename__ = "sme_kit_assignments_v2"

    id = Column(Integer, primary_key=True, index=True)
    sme_kit_id = Column(Integer, ForeignKey("sme_kits.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_at = Column(DateTime, server_default=_now)

    kit = relationship("SmeKit", foreign_keys=[sme_kit_id])
    user = relationship("User", foreign_keys=[user_id])
    assigner = relationship("User", foreign_keys=[assigned_by])


class TrainingAssessment(Base):
    """AI-generated assessment created by manager for a specific new joiner."""
    __tablename__ = "training_assessments"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(300), nullable=False)
    new_joiner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    sme_kit_id = Column(Integer, ForeignKey("sme_kits.id"), nullable=False)
    source_file_ids = Column(JSON, default=list)  # list of SmeKitFileV2 ids used
    total_questions = Column(Integer, default=10)
    mcq_count = Column(Integer, default=5)
    written_count = Column(Integer, default=5)
    easy_count = Column(Integer, default=0)
    medium_count = Column(Integer, default=0)
    hard_count = Column(Integer, default=0)
    pass_threshold = Column(Integer, default=70)  # percentage
    status = Column(String(20), default="pending")  # pending, active, completed
    created_at = Column(DateTime, server_default=_now)

    new_joiner = relationship("User", foreign_keys=[new_joiner_id])
    creator = relationship("User", foreign_keys=[created_by])
    kit = relationship("SmeKit", foreign_keys=[sme_kit_id])
    questions = relationship("TrainingQuestion", back_populates="assessment", cascade="all, delete-orphan")
    attempts = relationship("TrainingAttempt", back_populates="assessment", cascade="all, delete-orphan")


class TrainingQuestion(Base):
    """One question in a TrainingAssessment (MCQ or written)."""
    __tablename__ = "training_questions"

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("training_assessments.id"), nullable=False)
    order_index = Column(Integer, nullable=False)
    question_type = Column(String(20), nullable=False)  # "mcq" | "written"
    difficulty = Column(String(10), nullable=True)       # "easy" | "medium" | "hard"
    question_text = Column(Text, nullable=False)
    options = Column(JSON, nullable=True)        # ["A. ...", "B. ...", "C. ...", "D. ..."] for MCQ
    correct_answer = Column(Text, nullable=True) # stored for AI evaluation reference

    assessment = relationship("TrainingAssessment", back_populates="questions")


class TrainingAttempt(Base):
    """One attempt by a new joiner on a TrainingAssessment. Every attempt is stored permanently."""
    __tablename__ = "training_attempts"

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("training_assessments.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    attempt_number = Column(Integer, default=1)
    status = Column(String(20), default="in_progress")  # in_progress | submitted | evaluated
    score = Column(Float, nullable=True)           # percentage 0-100
    passed = Column(Boolean, nullable=True)
    trophy_awarded = Column(Boolean, default=False)
    ai_feedback = Column(JSON, nullable=True)      # overall feedback text from AI
    submitted_at = Column(DateTime, nullable=True)
    evaluated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=_now)

    assessment = relationship("TrainingAssessment", back_populates="attempts")
    user = relationship("User", foreign_keys=[user_id])
    answers = relationship("TrainingAnswer", back_populates="attempt", cascade="all, delete-orphan")


class TrainingAnswer(Base):
    """New joiner's answer to one TrainingQuestion within an attempt."""
    __tablename__ = "training_answers"

    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("training_attempts.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("training_questions.id"), nullable=False)
    answer_text = Column(Text, nullable=True)
    is_correct = Column(Boolean, nullable=True)
    ai_flag = Column(String(20), nullable=True)     # "correct" | "wrong" | "partial"
    ai_explanation = Column(Text, nullable=True)   # per-answer AI feedback

    attempt = relationship("TrainingAttempt", back_populates="answers")
    question = relationship("TrainingQuestion")


# ─────────────────────────────────────────────────────────────────────────────

class CourseBankItem(Base):
    __tablename__ = "course_bank"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(300), nullable=False)
    provider = Column(String(200), nullable=True)
    duration = Column(String(100), nullable=True)
    rating = Column(String(10), nullable=True)
    free = Column(Boolean, default=True)
    category = Column(String(100), default="Editing Skills")
    tag = Column(String(50), default="Gap-Fill")
    link = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=_now)


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    messages = Column(JSON, default=list)  # [{role, content}, ...]
    question_index = Column(Integer, default=0)
    status = Column(String(20), default="in_progress")  # in_progress, completed
    skill_gaps = Column(JSON, nullable=True)  # [{skill, score, severity}, ...]
    strengths = Column(JSON, nullable=True)       # ["strength 1", ...]
    areas_of_improvement = Column(JSON, nullable=True)  # ["area 1", ...]
    created_at = Column(DateTime, server_default=_now)
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(300), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), default="info")
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=_now)

    user = relationship("User")


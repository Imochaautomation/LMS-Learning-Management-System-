from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON, Float, text
from sqlalchemy.orm import relationship
from database import Base

_now = text("NOW()")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    plain_password = Column(String(255), nullable=True)
    role = Column(String(20), nullable=False)  # admin, manager, new_joiner, employee
    department = Column(String(100), nullable=True)
    designation = Column(String(100), nullable=True)
    experience = Column(String(50), nullable=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
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


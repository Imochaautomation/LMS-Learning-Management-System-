"""
Analytics endpoints — one per role dashboard.

GET /api/analytics/manager     — team analytics (manager/admin)
GET /api/analytics/admin       — org-wide analytics (admin only)
GET /api/analytics/employee    — personal analytics (employee)
GET /api/analytics/new-joiner  — personal analytics (new_joiner)
"""

from collections import defaultdict
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import SessionLocal
from auth import require_role
from models import (
    User, Profile, InterviewSession, UserCourse,
    TrainingAssessment, TrainingAttempt, SmeKitAssignmentV2,
)

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _monthly_buckets(months=6):
    now = datetime.utcnow()
    buckets = []
    for m in range(months - 1, -1, -1):
        year = now.year
        month = now.month - m
        while month <= 0:
            month += 12
            year -= 1
        start = datetime(year, month, 1)
        end = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)
        buckets.append((start, end, start.strftime("%b %Y")))
    return buckets


def _gap_severity(avg):
    if avg < 50:
        return "High"
    if avg < 70:
        return "Medium"
    return "Low"


# Sub-departments that roll up into a parent department
_DEPT_PARENT = {
    "Editing": "Content",
}

def _norm_dept(dept):
    """Normalize sub-department names to their parent department."""
    return _DEPT_PARENT.get(dept or "Unknown", dept or "Unknown")


def _aggregate_skills(sessions):
    """Return {skill: [scores]} from a list of InterviewSessions."""
    totals: dict = defaultdict(list)
    for sess in sessions:
        for gap in (sess.skill_gaps or []):
            totals[gap["skill"]].append(gap["score"])
    return totals


# ── Manager ──────────────────────────────────────────────────────────────────

@router.get("/manager")
def manager_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager", "admin")),
):
    team = db.query(User).filter(User.manager_id == current_user.id).all()
    team_ids    = [u.id for u in team]
    new_joiners = [u for u in team if u.role == "new_joiner"]
    employees   = [u for u in team if u.role == "employee"]
    nj_ids      = [u.id for u in new_joiners]
    emp_ids     = [u.id for u in employees]

    active_set = {
        r[0]
        for r in db.query(UserCourse.user_id)
        .filter(UserCourse.user_id.in_(team_ids), UserCourse.status.in_(["started", "completed"]))
        .distinct().all()
    } if team_ids else set()

    courses_completed = (
        db.query(UserCourse)
        .filter(UserCourse.user_id.in_(team_ids), UserCourse.status == "completed")
        .count()
    ) if team_ids else 0

    # Onboarding funnel
    sme_assigned = (
        db.query(SmeKitAssignmentV2.user_id)
        .filter(SmeKitAssignmentV2.user_id.in_(nj_ids))
        .distinct().count()
    ) if nj_ids else 0

    assessed = (
        db.query(TrainingAttempt.user_id)
        .filter(TrainingAttempt.user_id.in_(nj_ids))
        .distinct().count()
    ) if nj_ids else 0

    passed_users = (
        db.query(TrainingAttempt.user_id)
        .filter(TrainingAttempt.user_id.in_(nj_ids), TrainingAttempt.passed == True)
        .distinct().count()
    ) if nj_ids else 0

    ready_count = sum(1 for u in new_joiners if u.is_ready)

    # Assessment stats (new joiners)
    attempts = (
        db.query(TrainingAttempt)
        .filter(TrainingAttempt.user_id.in_(nj_ids), TrainingAttempt.status == "evaluated")
        .all()
    ) if nj_ids else []

    scored   = [a for a in attempts if a.score is not None]
    avg_score = round(sum(a.score for a in scored) / len(scored), 1) if scored else 0
    pass_rate = round(sum(1 for a in attempts if a.passed) / len(attempts) * 100) if attempts else 0

    # Team skill gaps + strengths (employee interviews)
    sessions = (
        db.query(InterviewSession)
        .filter(InterviewSession.user_id.in_(emp_ids), InterviewSession.status == "completed")
        .all()
    ) if emp_ids else []

    skill_totals = _aggregate_skills(sessions)
    all_skills = [
        {
            "skill":     s,
            "avg_score": round(sum(v) / len(v)),
            "severity":  _gap_severity(round(sum(v) / len(v))),
            "count":     len(v),
        }
        for s, v in skill_totals.items()
    ]

    team_skill_gaps = sorted(
        [sk for sk in all_skills if sk["severity"] in ("High", "Medium")],
        key=lambda x: x["avg_score"],
    )[:8]

    team_strengths = sorted(
        [sk for sk in all_skills if sk["severity"] == "Low"],
        key=lambda x: -x["avg_score"],
    )[:5]

    # Learning goal distribution
    emp_profiles = (
        db.query(Profile).filter(Profile.user_id.in_(emp_ids)).all()
    ) if emp_ids else []
    has_goal = sum(1 for p in emp_profiles if p.learning_goals and p.learning_goals.strip())
    learning_goal_distribution = {
        "with_goal":    has_goal,
        "without_goal": len(employees) - has_goal,
        "total_employees": len(employees),
    }

    # Learners needing support: new joiners + employees
    needing_support = []
    for u in new_joiners:
        user_attempts = [a for a in attempts if a.user_id == u.id]
        issues = []
        if not user_attempts:
            issues.append("No quiz attempts yet")
        elif not any(a.passed for a in user_attempts):
            issues.append(f"{len(user_attempts)} attempt(s) — not yet passed")
        if issues:
            needing_support.append({"id": u.id, "name": u.name, "role": "new_joiner", "issues": issues})

    if emp_ids:
        all_emp_courses = (
            db.query(UserCourse).filter(UserCourse.user_id.in_(emp_ids)).all()
        )
        sess_map = {s.user_id: s for s in sessions}
        for emp in employees:
            user_courses = [c for c in all_emp_courses if c.user_id == emp.id]
            issues = []
            if not any(c.status in ("started", "completed") for c in user_courses):
                issues.append("No courses started yet")
            sess = sess_map.get(emp.id)
            if sess and sess.completed_at:
                newer = [
                    c for c in user_courses
                    if c.status == "completed" and c.completed_at and c.completed_at > sess.completed_at
                ]
                if newer:
                    issues.append("Interview retake suggested (new courses completed)")
            elif not sess:
                issues.append("AI interview not completed")
            if issues:
                needing_support.append({"id": emp.id, "name": emp.name, "role": "employee", "issues": issues})

    # Monthly activity
    monthly = []
    for start, end, label in _monthly_buckets(6):
        m_att = [a for a in attempts if a.submitted_at and start <= a.submitted_at < end]
        m_courses = (
            db.query(UserCourse)
            .filter(
                UserCourse.user_id.in_(team_ids),
                UserCourse.completed_at >= start,
                UserCourse.completed_at < end,
            ).count()
        ) if team_ids else 0
        monthly.append({
            "month":            label,
            "attempts":         len(m_att),
            "passed":           sum(1 for a in m_att if a.passed),
            "courses_completed": m_courses,
        })

    # Rule-based insights
    insights = []
    if needing_support:
        insights.append({
            "type":  "warning",
            "title": f"{len(needing_support)} learner(s) need your attention",
            "body":  "Review their progress and schedule a check-in.",
        })
    if team_skill_gaps:
        top = team_skill_gaps[0]
        insights.append({
            "type":  "warning",
            "title": f"Top skill gap: {top['skill']} ({top['avg_score']}/100)",
            "body":  "Consider assigning targeted courses to close this team-wide gap.",
        })
    if team_strengths:
        insights.append({
            "type":  "positive",
            "title": f"Team strength: {team_strengths[0]['skill']} ({team_strengths[0]['avg_score']}/100)",
            "body":  "Leverage this strength for peer mentoring or advanced assignments.",
        })
    if pass_rate > 0:
        insights.append({
            "type":  "positive" if pass_rate >= 70 else "warning",
            "title": f"Quiz pass rate: {pass_rate}%",
            "body":  "Based on all evaluated quiz attempts by your new joiners.",
        })
    if ready_count > 0:
        insights.append({
            "type":  "positive",
            "title": f"{ready_count} new joiner(s) marked ready for the job",
            "body":  "They have completed their onboarding journey.",
        })

    return {
        "team_snapshot": {
            "total":            len(team),
            "new_joiners":      len(new_joiners),
            "employees":        len(employees),
            "active_learners":  len(active_set),
            "courses_completed": courses_completed,
        },
        "onboarding_funnel": [
            {"stage": "SME Kit Assigned", "count": sme_assigned,  "total": max(len(new_joiners), 1)},
            {"stage": "Quiz Attempted",   "count": assessed,       "total": max(len(new_joiners), 1)},
            {"stage": "Quiz Passed",      "count": passed_users,   "total": max(len(new_joiners), 1)},
            {"stage": "Ready for Job",    "count": ready_count,    "total": max(len(new_joiners), 1)},
        ],
        "assessment_stats": {
            "total_attempts": len(attempts),
            "avg_score":      avg_score,
            "pass_rate":      pass_rate,
        },
        "team_skill_gaps":           team_skill_gaps,
        "team_strengths":            team_strengths,
        "learning_goal_distribution": learning_goal_distribution,
        "learners_needing_support":  needing_support,
        "monthly_activity":          monthly,
        "insights":                  insights,
    }


# ── Admin ─────────────────────────────────────────────────────────────────────

@router.get("/admin")
def admin_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    all_users = db.query(User).all()
    total_users = len(all_users)

    with_profile = db.query(Profile).count()
    interviews_done = (
        db.query(InterviewSession).filter(InterviewSession.status == "completed").count()
    )
    courses_completed_total = (
        db.query(UserCourse).filter(UserCourse.status == "completed").count()
    )
    active_set = {
        r[0]
        for r in db.query(UserCourse.user_id)
        .filter(UserCourse.status.in_(["started", "completed"]))
        .distinct().all()
    }

    role_counts: dict = defaultdict(int)
    for u in all_users:
        role_counts[u.role] += 1

    # Department comparison (normalize sub-depts to parent)
    dept_users: dict = defaultdict(int)
    for u in all_users:
        dept_users[_norm_dept(u.department)] += 1

    # Raw dept → metric counts, then re-key through normalizer
    def _norm_counts(rows):
        result: dict = defaultdict(int)
        for raw_dept, cnt in rows:
            result[_norm_dept(raw_dept)] += cnt
        return result

    dept_courses = _norm_counts(
        db.query(User.department, func.count(UserCourse.id))
        .join(UserCourse, UserCourse.user_id == User.id)
        .filter(UserCourse.status == "completed")
        .group_by(User.department).all()
    )
    dept_interviews = _norm_counts(
        db.query(User.department, func.count(InterviewSession.id))
        .join(InterviewSession, InterviewSession.user_id == User.id)
        .filter(InterviewSession.status == "completed")
        .group_by(User.department).all()
    )
    dept_passed_map = _norm_counts(
        db.query(User.department, func.count(TrainingAttempt.id))
        .join(TrainingAttempt, TrainingAttempt.user_id == User.id)
        .filter(TrainingAttempt.passed == True)
        .group_by(User.department).all()
    )

    dept_comparison = sorted(
        [
            {
                "dept":               d,
                "users":              cnt,
                "courses_completed":  dept_courses.get(d, 0),
                "interviews":         dept_interviews.get(d, 0),
                "assessments_passed": dept_passed_map.get(d, 0),
            }
            for d, cnt in dept_users.items()
        ],
        key=lambda x: -x["users"],
    )

    # Monthly trends (interviews / courses / certificates)
    monthly_trends = []
    for start, end, label in _monthly_buckets(6):
        iv = (
            db.query(InterviewSession)
            .filter(InterviewSession.completed_at >= start, InterviewSession.completed_at < end)
            .count()
        )
        cc = (
            db.query(UserCourse)
            .filter(UserCourse.completed_at >= start, UserCourse.completed_at < end)
            .count()
        )
        cs = (
            db.query(UserCourse)
            .filter(UserCourse.started_at >= start, UserCourse.started_at < end)
            .count()
        )
        monthly_trends.append({
            "month":             label,
            "interviews":        iv,
            "courses_completed": cc,
            "courses_started":   cs,
            "certificates":      cc,  # certificate = course completion proof
        })

    # Org skill gaps + strengths
    all_sessions = db.query(InterviewSession).filter(InterviewSession.status == "completed").all()
    skill_totals = _aggregate_skills(all_sessions)
    all_skills = [
        {
            "skill":     s,
            "avg_score": round(sum(v) / len(v)),
            "severity":  _gap_severity(round(sum(v) / len(v))),
            "count":     len(v),
        }
        for s, v in skill_totals.items()
    ]

    org_skill_gaps = sorted(
        [sk for sk in all_skills if sk["severity"] in ("High", "Medium")],
        key=lambda x: x["avg_score"],
    )[:10]

    org_strengths = sorted(
        [sk for sk in all_skills if sk["severity"] == "Low"],
        key=lambda x: -x["avg_score"],
    )[:5]

    # Onboarding stats + monthly trend
    new_joiners  = [u for u in all_users if u.role == "new_joiner"]
    ready_count  = sum(1 for u in new_joiners if u.is_ready)
    ready_rate   = round(ready_count / len(new_joiners) * 100) if new_joiners else 0

    onboarding_monthly = []
    for start, end, label in _monthly_buckets(6):
        new_this_month   = sum(1 for u in new_joiners if u.created_at and start <= u.created_at < end)
        ready_this_month = sum(1 for u in new_joiners if u.is_ready and u.created_at and start <= u.created_at < end)
        onboarding_monthly.append({
            "month":       label,
            "new_joiners": new_this_month,
            "ready":       ready_this_month,
        })

    # Learning goal trends
    all_profiles = db.query(Profile).all()
    goal_trends  = []
    for start, end, label in _monthly_buckets(6):
        with_goal = sum(
            1 for p in all_profiles
            if p.learning_goals and p.learning_goals.strip()
            and p.created_at and start <= p.created_at < end
        )
        goal_trends.append({"month": label, "profiles_with_goal": with_goal})

    # Rule-based insights
    profile_rate   = round(with_profile / total_users * 100) if total_users else 0
    emp_count      = role_counts.get("employee", 0)
    interview_rate = round(interviews_done / emp_count * 100) if emp_count else 0

    insights = []
    if profile_rate < 50:
        insights.append({
            "type":  "warning",
            "title": f"Only {profile_rate}% of users have a profile",
            "body":  "Encourage employees to complete their profiles for better skill analytics.",
        })
    else:
        insights.append({
            "type":  "positive",
            "title": f"{profile_rate}% profile completion rate",
            "body":  "A strong profile base enables accurate org-wide skill analysis.",
        })
    if org_skill_gaps:
        top = org_skill_gaps[0]
        insights.append({
            "type":  "warning",
            "title": f"Org-wide gap: {top['skill']} ({top['avg_score']}/100)",
            "body":  f"Identified across {top['count']} employee interview(s). Consider org-wide training.",
        })
    insights.append({
        "type":  "positive" if ready_rate >= 50 else "info",
        "title": f"{ready_count}/{len(new_joiners)} new joiners job-ready ({ready_rate}%)",
        "body":  "New joiners marked ready by their managers after completing onboarding.",
    })
    if interview_rate < 50 and emp_count > 0:
        insights.append({
            "type":  "warning",
            "title": f"Only {interview_rate}% of employees completed AI interview",
            "body":  "More interview completions will improve skill gap accuracy across the org.",
        })
    if courses_completed_total > 0:
        insights.append({
            "type":  "positive",
            "title": f"{courses_completed_total} courses completed platform-wide",
            "body":  "Active learning is happening across the organization.",
        })

    return {
        "platform_adoption": {
            "total_users":          total_users,
            "with_profile":         with_profile,
            "interviews_completed": interviews_done,
            "active_learners":      len(active_set),
            "courses_completed":    courses_completed_total,
        },
        "role_counts":              dict(role_counts),
        "department_comparison":    dept_comparison,
        "monthly_trends":           monthly_trends,
        "org_skill_gaps":           org_skill_gaps,
        "org_strengths":            org_strengths,
        "onboarding_stats": {
            "total_new_joiners": len(new_joiners),
            "ready_for_job":     ready_count,
            "ready_rate":        ready_rate,
        },
        "onboarding_monthly":       onboarding_monthly,
        "learning_goal_trends":     goal_trends,
        "insights":                 insights,
    }


# ── Employee ──────────────────────────────────────────────────────────────────

@router.get("/employee")
def employee_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("employee")),
):
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    session = (
        db.query(InterviewSession)
        .filter(InterviewSession.user_id == current_user.id, InterviewSession.status == "completed")
        .order_by(InterviewSession.completed_at.desc())
        .first()
    )
    courses = db.query(UserCourse).filter(UserCourse.user_id == current_user.id).all()

    skill_gaps = session.skill_gaps or [] if session else []
    strengths  = session.strengths  or [] if session else []
    avg_score  = round(sum(g["score"] for g in skill_gaps) / len(skill_gaps)) if skill_gaps else 0

    completed_courses = [c for c in courses if c.status == "completed"]
    certificates = len(completed_courses)

    # Badges / trophies based on skill score
    badges   = 1 if 80 <= avg_score < 90 else 0
    trophies = 1 if avg_score >= 90 else 0

    # Interview retake reminder: courses completed after last interview
    retake_reminder = False
    if session and session.completed_at:
        newer = [c for c in completed_courses if c.completed_at and c.completed_at > session.completed_at]
        retake_reminder = len(newer) > 0

    monthly = []
    for start, end, label in _monthly_buckets(6):
        done = sum(1 for c in courses if c.completed_at and start <= c.completed_at < end)
        go   = sum(1 for c in courses if c.started_at   and start <= c.started_at   < end)
        monthly.append({"month": label, "started": go, "completed": done})

    # Rule-based insights
    insights = []
    if avg_score > 0:
        if avg_score >= 90:
            insights.append({
                "type":  "positive",
                "title": f"Outstanding skill score: {avg_score}/100",
                "body":  "You're in the top tier. Keep it up and consider mentoring teammates!",
            })
        elif avg_score >= 70:
            insights.append({
                "type":  "positive",
                "title": f"Good skill score: {avg_score}/100",
                "body":  "You're proficient in most areas. Focus on the remaining critical gaps.",
            })
        else:
            insights.append({
                "type":  "warning",
                "title": f"Skill score: {avg_score}/100",
                "body":  "Targeted courses can help close your skill gaps quickly.",
            })
    critical_gaps = [g for g in skill_gaps if g.get("severity") == "High"]
    if critical_gaps:
        insights.append({
            "type":  "warning",
            "title": f"{len(critical_gaps)} critical skill gap(s) identified",
            "body":  f"Priority: {critical_gaps[0]['skill']} — check your course recommendations.",
        })
    if certificates > 0:
        insights.append({
            "type":  "positive",
            "title": f"{certificates} course(s) completed",
            "body":  "Every completed course strengthens your professional profile.",
        })
    if retake_reminder:
        insights.append({
            "type":  "info",
            "title": "Consider retaking the AI interview",
            "body":  "You've completed new courses since your last interview. An updated session will reflect your current skills.",
        })
    if not profile:
        insights.append({
            "type":  "warning",
            "title": "Profile incomplete",
            "body":  "Add your learning goals and resume to unlock personalized recommendations.",
        })

    return {
        "profile": {
            "has_profile":    profile is not None,
            "learning_goals": profile.learning_goals if profile else None,
        },
        "interview": {
            "completed": session is not None,
            "date":      session.completed_at.isoformat() if session and session.completed_at else None,
        },
        "skill_gaps":       skill_gaps,
        "strengths":        strengths,
        "avg_skill_score":  avg_score,
        "courses": {
            "saved":     sum(1 for c in courses if c.status == "saved"),
            "started":   sum(1 for c in courses if c.status == "started"),
            "completed": certificates,
        },
        "certificates":     certificates,
        "badges":           badges,
        "trophies":         trophies,
        "retake_reminder":  retake_reminder,
        "monthly_courses":  monthly,
        "insights":         insights,
    }


# ── New Joiner ────────────────────────────────────────────────────────────────

@router.get("/new-joiner")
def new_joiner_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("new_joiner")),
):
    sme_assignments = (
        db.query(SmeKitAssignmentV2)
        .filter(SmeKitAssignmentV2.user_id == current_user.id)
        .all()
    )
    assessments = (
        db.query(TrainingAssessment)
        .filter(TrainingAssessment.new_joiner_id == current_user.id, TrainingAssessment.status == "active")
        .all()
    )

    assess_data = []
    for a in assessments:
        atts = (
            db.query(TrainingAttempt)
            .filter(
                TrainingAttempt.assessment_id == a.id,
                TrainingAttempt.user_id == current_user.id,
                TrainingAttempt.status == "evaluated",
            ).all()
        )
        best = max((at.score for at in atts if at.score is not None), default=None)
        assess_data.append({
            "id":         a.id,
            "title":      a.title,
            "attempts":   len(atts),
            "best_score": best,
            "passed":     any(at.passed for at in atts),
            "badge":      best is not None and 80 <= best < 90,
            "trophy":     best is not None and best >= 90,
        })

    all_attempts = (
        db.query(TrainingAttempt)
        .filter(TrainingAttempt.user_id == current_user.id, TrainingAttempt.status == "evaluated")
        .order_by(TrainingAttempt.submitted_at)
        .all()
    )

    # Latest AI feedback from most recent evaluated attempt
    latest_ai_feedback = None
    if all_attempts:
        with_fb = sorted(
            [a for a in all_attempts if a.ai_feedback],
            key=lambda x: x.submitted_at or datetime.min,
            reverse=True,
        )
        if with_fb:
            fb = with_fb[0].ai_feedback
            if isinstance(fb, dict):
                latest_ai_feedback = fb.get("overall") or fb.get("summary") or fb.get("feedback")
            elif isinstance(fb, str):
                latest_ai_feedback = fb

    timeline = []
    for sa in sme_assignments:
        timeline.append({
            "type":  "sme_kit",
            "label": "SME Kit Assigned",
            "date":  sa.assigned_at.isoformat() if sa.assigned_at else None,
            "score": None,
        })
    for at in all_attempts:
        a_obj = next((a for a in assessments if a.id == at.assessment_id), None)
        timeline.append({
            "type":  "quiz_passed" if at.passed else "quiz_attempted",
            "label": f"{'Passed' if at.passed else 'Attempted'}: {a_obj.title if a_obj else 'Quiz'}",
            "date":  at.submitted_at.isoformat() if at.submitted_at else None,
            "score": at.score,
        })
    timeline.sort(key=lambda x: x["date"] or "")

    summary = {
        "total_assessments": len(assessments),
        "attempted":  sum(1 for a in assess_data if a["attempts"] > 0),
        "passed":     sum(1 for a in assess_data if a["passed"]),
        "badges":     sum(1 for a in assess_data if a["badge"]),
        "trophies":   sum(1 for a in assess_data if a["trophy"]),
    }

    # Rule-based insights
    insights = []
    if current_user.is_ready:
        insights.append({
            "type":  "positive",
            "title": "You're Ready for the Job!",
            "body":  "Your manager has reviewed your progress and marked you ready. Great work!",
        })
    if summary["trophies"] > 0:
        insights.append({
            "type":  "positive",
            "title": f"{summary['trophies']} trophy/trophies earned (90%+ score)",
            "body":  "Outstanding performance! You've demonstrated mastery-level understanding.",
        })
    if summary["badges"] > 0:
        insights.append({
            "type":  "positive",
            "title": f"{summary['badges']} badge(s) earned (80–89% score)",
            "body":  "Strong scores — keep pushing toward the 90%+ trophy threshold.",
        })
    not_attempted = summary["total_assessments"] - summary["attempted"]
    if not_attempted > 0:
        insights.append({
            "type":  "warning",
            "title": f"{not_attempted} quiz(zes) not yet attempted",
            "body":  "Complete all assigned quizzes to finish your onboarding assessment.",
        })
    if summary["attempted"] > 0 and summary["passed"] < summary["attempted"]:
        failed = summary["attempted"] - summary["passed"]
        insights.append({
            "type":  "warning",
            "title": f"{failed} quiz(zes) not yet passed",
            "body":  "Review your AI feedback and reattempt to improve your score.",
        })

    return {
        "is_ready":          current_user.is_ready,
        "sme_kits_assigned": len(sme_assignments),
        "assessments":       assess_data,
        "latest_ai_feedback": latest_ai_feedback,
        "summary":           summary,
        "timeline":          timeline[-20:],
        "insights":          insights,
    }

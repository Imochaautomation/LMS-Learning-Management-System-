# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An LMS platform with two modules:
- **Training & Onboarding** — for new joiners (SME Kit, assessments, AI review, courses)
- **Upskilling & Reskilling** — for existing employees (profile-based AI interview, skill gap analysis, courses)

Four user roles: `new_joiner`, `employee`, `manager`, `admin`. Managers see both `/training` and `/manager` routes.

Product spec: `LMS_Final.docx` at project root.

## Commands

### Frontend
```bash
cd UI
npm install        # first time
npm run dev        # dev server on http://localhost:5173
npm run build
```

Set `VITE_API_URL` env var to point at a non-local backend (defaults to `http://localhost:8000`).

### Backend
```bash
cd Server
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Copy `.env.example` to `.env` and fill in values. The DB auto-seeds on first startup if empty (`seed.py`).

## Architecture

### Backend (Server/)

**Stack**: FastAPI + SQLAlchemy + SQLite (dev) / PostgreSQL (prod via `DATABASE_URL`). Auth is JWT (`python-jose`), 72h expiry, stored as Bearer token. Password hashing via `bcrypt`.

**Key files**:
- `config.py` — all env-var loading; `UPLOAD_DIR`, `OPENROUTER_API_KEY`, `MODEL_NAME`, `JWT_SECRET`
- `database.py` — engine setup; auto-switches between SQLite and PostgreSQL+pg8000
- `auth.py` — `get_current_user` dependency, `require_role(*roles)` factory for route guards
- `models.py` — SQLAlchemy models (see below)
- `schemas.py` — Pydantic request/response schemas
- `seed.py` — populates DB with demo users/data on first run

**Routers** (all mounted under `/api` prefix via `routers/__init__.py`):
- `auth_router` — `/auth/login`, `/auth/me`
- `admin_router` — user CRUD, system management
- `profile_router` — employee profile + resume upload
- `assessments_router` — assignment lifecycle: assign → download → submit → review
- `banks_router` — assessment bank and course bank (manager uploads)
- `courses_router` — user course tracking (save/start/complete), course assignments
- `ai_interview_router` — chatbot interview session for upskilling employees
- `ai_recommend_router` — AI course recommendations via OpenRouter
- `notifications_router` — per-user notification feed

**Data models** (models.py):
- `User` — roles: `admin`, `manager`, `new_joiner`, `employee`; self-referential `manager_id`
- `Profile` — one-to-one with User; resume path, summary, learning goals
- `AssessmentAssignment` — statuses: `pending → downloaded → submitted → reviewed`; stores AI summary + score
- `AssessmentBankItem` / `SmeKitFile` / `CourseBankItem` — manager-managed content banks
- `UserCourse` — employee's own course tracking; statuses: `saved → started → completed`
- `CourseAssignment` — manager assigns a course bank item to a learner
- `CourseCompletion` — new joiner submits proof for a training course
- `InterviewSession` — chatbot Q&A session; stores messages JSON, skill gaps, strengths
- `Notification` — per-user notification with read flag

**File uploads** stored under `Server/uploads/` in subdirs: `assessments/`, `submissions/`, `smekit/`, `resumes/`, `proofs/`. Served as static files at `/uploads/*`.

**AI**: OpenRouter API (configured via `OPENROUTER_API_KEY` + `MODEL_NAME`). Used in `ai_interview_router` for adaptive interview questions and `ai_recommend_router` for course recommendations.

### Frontend (UI/src/)

**Stack**: React 18 + Vite, Tailwind CSS v3, React Router v6, Lucide React icons, Recharts (for skill charts).

**API layer**: `api/client.js` — thin fetch wrapper; reads JWT from `localStorage` (`lms_token`); auto-redirects to `/login` on 401; handles FormData vs JSON automatically.

**Auth**: `context/AuthContext.jsx` — stores user in state + `localStorage` (`lms_user`). Validates token via `/auth/me` on load. Exposes `login()`, `logout()`, `roleRoute(role)`.

**Routing** (`App.jsx`): Role-gated via `ProtectedRoute` wrapper. Route groups:
- `/training/*` — `new_joiner` + `manager`
- `/upskilling/*` — `employee`
- `/manager/*` — `manager`
- `/admin/*` — `admin`
- `/` redirects to role's home route

**Pages**:
- `Training/` — Dashboard, SmeKit, TrainingAssessments, TrainingCourses
- `Upskilling/` — UpskillDashboard (step-gated), ProfileSetup, UpskillAssessments, UpskillCourses, ChatbotInterview
- `Manager/` — ManagerDashboard, LearnerDetail (`/manager/learner/:id`)
- `Admin/` — AdminDashboard, UserManagement
- `Auth/LoginPage` — email/password login form

**Shared components** (`components/shared/`): `StatCard`, `FileCard`, `ProgressBar`, `ScoreRing`, `Toast`, `BackButton`, plus Recharts-based skill charts (`SkillGapPieChart`, `SkillDetailPieChart`, `SkillGaugeChart`, `SkillLineChart`).

**Layout**: `AppLayout.jsx` wraps all authenticated pages with `Sidebar.jsx`. Sidebar nav items are role-aware.

### Key Design Decisions
- `data/mockData.js` exists but is largely superseded by real API calls — prefer the API layer
- Upskilling dashboard is step-gated: empty state until profile submitted + first AI interview completed
- Assessment flow: manager assigns from bank → learner downloads PDF → submits file → AI reviews → manager sees score
- `manager` role can access both `/training` and `/manager` route groups simultaneously
- DB auto-seeds on startup (`seed.py`) when the users table is empty — useful for fresh deployments

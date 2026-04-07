# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An LMS (Learning Management System) platform with two modules:
- **Training & Onboarding** — for new joiners (SME Kit, assessments, AI review, courses)
- **Upskilling & Reskilling** — for existing employees (profile-based AI assessment, skill gap analysis, open-domain courses)

Five user roles: New Joiner, Existing Employee, Trainer/Manager (same person), Admin. Role-based routing — users only see their module.

Product spec is in `LMS_Final.docx` at project root.

## Tech Stack

- **Frontend (UI/)**: React 18 + Vite, Tailwind CSS v3, React Router v6, Lucide React icons
- **Backend (Server/)**: FastAPI, LangChain, OpenRouter (model + API key in `.env`)
- **AI Integration**: OpenRouter API via LangChain for assessment review and course recommendations

## Commands

### Frontend
```bash
cd UI
npm install        # first time
npm run dev        # dev server on http://localhost:5173
npm run build      # production build
```

### Backend
```bash
cd Server
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Architecture

### Frontend Structure (UI/src/)
- `components/layout/` — Sidebar, AppLayout (shared shell with sidebar + content area)
- `components/shared/` — Reusable: StatCard, FileCard, ProgressBar, ScoreRing
- `context/AuthContext.jsx` — Mock auth with role-based login
- `data/mockData.js` — All mock data (users, SME kit files, assessments, courses, team data)
- `pages/Home/` — Landing page with module selection cards
- `pages/Training/` — New joiner views: Dashboard, SME Kit, Assessments, Courses
- `pages/Upskilling/` — Employee views: Dashboard, Assessments, Course Library, Profile Setup
- `pages/Trainer/` — Trainer view: Learner management, assessment assignment
- `pages/Manager/` — Manager view: Team overview, readiness tracking, course/assessment assignment

### Key Design Decisions
- Home page acts as module selector; clicking a module card logs in as that role (demo mode)
- Sidebar nav items change based on user role
- Upskilling dashboard is step-gated: empty until profile submitted + first assessment reviewed
- Course library is open to all domains, not restricted to current role
- AI course recommendations happen after every assessment (targeted) and after trainer marks ready (cumulative)
- Assessments are pre-loaded in a bank; trainer assigns from bank, not uploading each time

### Backend Structure (Server/)
- `main.py` — FastAPI app with CORS for frontend
- `.env` — OPENROUTER_API_KEY and MODEL_NAME (not committed)
- AI endpoints will use LangChain with OpenRouter for assessment review and course recommendations

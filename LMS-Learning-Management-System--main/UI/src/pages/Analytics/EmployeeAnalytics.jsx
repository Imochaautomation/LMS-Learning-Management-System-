import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import {
  Loader2, BookOpen, Bot, Target, TrendingUp, CheckCircle2,
  Award, Trophy, GraduationCap, Lightbulb, AlertTriangle, Info, RefreshCw,
} from 'lucide-react';

const ORANGE = '#F05A28';

function InsightCard({ type, title, body }) {
  const styles = {
    positive: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />, title: 'text-emerald-800' },
    warning:  { bg: 'bg-amber-50',   border: 'border-amber-200',   icon: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />,  title: 'text-amber-800'   },
    info:     { bg: 'bg-blue-50',    border: 'border-blue-200',    icon: <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />,            title: 'text-blue-800'    },
  }[type] || { bg: 'bg-gray-50', border: 'border-gray-200', icon: <Lightbulb className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />, title: 'text-gray-800' };

  return (
    <div className={`rounded-xl border p-3.5 flex items-start gap-3 ${styles.bg} ${styles.border}`}>
      {styles.icon}
      <div>
        <p className={`text-xs font-semibold ${styles.title}`}>{title}</p>
        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function SkillBar({ skill, score, severity }) {
  const color = severity === 'High' ? '#ef4444' : severity === 'Medium' ? '#f59e0b' : '#10b981';
  const pct = Math.min(score, 100);
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-xs text-gray-600 w-32 shrink-0 truncate" title={skill}>{skill}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-bold w-9 text-right shrink-0" style={{ color }}>{score}</span>
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full w-16 text-center shrink-0
        ${severity === 'High' ? 'bg-red-50 text-red-600' : severity === 'Medium' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
        {severity === 'High' ? 'Critical' : severity === 'Medium' ? 'Growing' : 'Strong'}
      </span>
    </div>
  );
}

function MiniLineChart({ data, height = 80 }) {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.flatMap(d => [d.started || 0, d.completed || 0]), 1);
  const w = 100 / (data.length - 1 || 1);
  const pts = (key) => data.map((d, i) => `${i * w},${height - ((d[key] || 0) / maxVal) * (height - 8)}`).join(' ');

  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      {[0.5, 1].map(r => (
        <line key={r} x1="0" x2="100" y1={height - r * (height - 8)} y2={height - r * (height - 8)}
          stroke="#f1f5f9" strokeWidth="0.5" />
      ))}
      <polyline points={pts('started')}   fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinejoin="round" />
      <polyline points={pts('completed')} fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export default function EmployeeAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/analytics/employee')
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-7 h-7 animate-spin" style={{ color: ORANGE }} />
    </div>
  );

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 text-sm">{error}</div>
  );

  const gaps     = data.skill_gaps     || [];
  const strengths = data.strengths      || [];
  const courses  = data.courses         || {};
  const monthly  = data.monthly_courses || [];
  const avg      = data.avg_skill_score  || 0;
  const interview = data.interview       || {};
  const profile  = data.profile          || {};
  const insights = data.insights         || [];
  const certificates   = data.certificates   || 0;
  const badges         = data.badges         || 0;
  const trophies       = data.trophies       || 0;
  const retakeReminder = data.retake_reminder || false;

  const criticalGaps = gaps.filter(g => g.severity === 'High');
  const mediumGaps   = gaps.filter(g => g.severity === 'Medium');
  const strongSkills = gaps.filter(g => g.severity === 'Low');

  const avgColor = avg >= 70 ? 'text-emerald-600' : avg >= 50 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="space-y-6">

      {/* Hero */}
      <div className="rounded-2xl p-6 text-white" style={{ background: `linear-gradient(135deg, ${ORANGE}, #c2410c)` }}>
        <h1 className="text-2xl font-bold mb-1">My Learning Analytics</h1>
        <p className="text-orange-100 text-sm">Your personal skill profile and learning progress.</p>
      </div>

      {/* Interview Retake Reminder */}
      {retakeReminder && (
        <div className="bg-blue-50 border border-blue-300 rounded-xl px-5 py-4 flex items-start gap-3">
          <RefreshCw className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-blue-800 text-sm">Interview Retake Suggested</p>
            <p className="text-xs text-blue-600 mt-0.5">
              You've completed new courses since your last AI interview. Retaking it will update your skill profile.
            </p>
            <Link to="/upskilling/interview" className="inline-block mt-2 text-xs font-semibold text-blue-700 underline">Retake Interview →</Link>
          </div>
        </div>
      )}

      {/* Quick Stats — 6 cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-gray-100 rounded-xl p-4 text-center shadow-sm">
          <p className={`text-2xl font-black ${avgColor}`}>{avg}<span className="text-sm font-semibold">/100</span></p>
          <p className="text-xs text-gray-500 mt-0.5">Avg Skill Score</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-black text-indigo-600">{courses.saved || 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">Courses Saved</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-black text-blue-600">{courses.started || 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">In Progress</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-black text-emerald-600">{courses.completed || 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">Completed</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-black text-purple-600 flex items-center justify-center gap-1">
            <Award className="w-5 h-5" />{badges}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Badges (80–89)</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-black text-amber-600 flex items-center justify-center gap-1">
            <Trophy className="w-5 h-5" />{trophies}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Trophies (90+)</p>
        </div>
      </div>

      {/* Certificates */}
      {certificates > 0 && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-center gap-3">
          <GraduationCap className="w-6 h-6 text-teal-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-teal-800">{certificates} Certificate{certificates !== 1 ? 's' : ''} Earned</p>
            <p className="text-xs text-teal-600 mt-0.5">Courses you've completed and received certificates for.</p>
          </div>
        </div>
      )}

      {/* AI Insights */}
      {insights.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" /> AI Insights
          </h2>
          <div className="space-y-2">
            {insights.map((ins, i) => <InsightCard key={i} {...ins} />)}
          </div>
        </div>
      )}

      {/* Status cards */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className={`rounded-xl p-4 border ${profile.has_profile ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-center gap-2 mb-1">
            {profile.has_profile ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Target className="w-4 h-4 text-amber-600" />}
            <span className="text-sm font-semibold text-gray-800">Profile</span>
          </div>
          <p className="text-xs text-gray-600">
            {profile.has_profile
              ? profile.learning_goals
                ? `Goal: ${profile.learning_goals.slice(0, 80)}${profile.learning_goals.length > 80 ? '…' : ''}`
                : 'Profile created — no learning goal set yet.'
              : 'Complete your profile to get started.'}
          </p>
          {!profile.has_profile && (
            <Link to="/upskilling/profile" className="inline-block mt-2 text-xs font-semibold text-amber-700 underline">Complete Profile →</Link>
          )}
        </div>
        <div className={`rounded-xl p-4 border ${interview.completed ? 'bg-emerald-50 border-emerald-200' : 'bg-violet-50 border-violet-200'}`}>
          <div className="flex items-center gap-2 mb-1">
            <Bot className={`w-4 h-4 ${interview.completed ? 'text-emerald-600' : 'text-violet-600'}`} />
            <span className="text-sm font-semibold text-gray-800">AI Interview</span>
          </div>
          <p className="text-xs text-gray-600">
            {interview.completed
              ? `Completed${interview.date ? ` on ${interview.date.split('T')[0]}` : ''}.`
              : 'Complete the AI interview to see your skill analysis.'}
          </p>
          {!interview.completed && (
            <Link to="/upskilling/interview" className="inline-block mt-2 text-xs font-semibold text-violet-700 underline">Start Interview →</Link>
          )}
        </div>
      </div>

      {/* Skill Gap Analysis */}
      {gaps.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-1">My Skill Profile</h2>
          <p className="text-xs text-gray-400 mb-4">From your latest AI interview. 70+ = proficient.</p>

          {criticalGaps.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-red-700 mb-2">Critical Gaps (priority training needed)</p>
              {criticalGaps.map((g, i) => <SkillBar key={i} skill={g.skill} score={g.score} severity={g.severity} />)}
            </div>
          )}
          {mediumGaps.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-amber-700 mb-2">Growing Skills (targeted practice)</p>
              {mediumGaps.map((g, i) => <SkillBar key={i} skill={g.skill} score={g.score} severity={g.severity} />)}
            </div>
          )}
          {strongSkills.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-emerald-700 mb-2">Strengths</p>
              {strongSkills.map((g, i) => <SkillBar key={i} skill={g.skill} score={g.score} severity={g.severity} />)}
            </div>
          )}
        </div>
      )}

      {/* Strengths from interview */}
      {strengths.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-emerald-800 mb-3">What the AI Interview Observed</h2>
          <ul className="space-y-1.5">
            {strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-emerald-800">
                <span className="text-emerald-500 shrink-0 mt-0.5">✓</span> {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Course Activity chart */}
      {monthly.some(m => m.started > 0 || m.completed > 0) && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-1">Course Activity (Last 6 Months)</h2>
          <div className="flex items-center gap-4 text-xs mb-3 mt-1">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 rounded bg-blue-400" /> Started</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 rounded bg-emerald-500" /> Completed</span>
          </div>
          <MiniLineChart data={monthly} />
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            {monthly.map((m, i) => <span key={i}>{m.month.split(' ')[0]}</span>)}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!interview.completed && gaps.length === 0 && (
        <div className="text-center py-12 bg-white border border-gray-100 rounded-2xl">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p className="font-semibold text-gray-500">Complete your AI interview</p>
          <p className="text-sm text-gray-400 mt-1">Your skill analytics will appear here after your first AI interview session.</p>
          <Link to="/upskilling/interview"
            className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 text-white text-sm font-semibold rounded-xl"
            style={{ background: ORANGE }}>
            <Bot className="w-4 h-4" /> Start AI Interview →
          </Link>
        </div>
      )}
    </div>
  );
}

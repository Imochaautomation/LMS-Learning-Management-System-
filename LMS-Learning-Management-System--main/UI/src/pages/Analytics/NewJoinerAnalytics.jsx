import { useState, useEffect } from 'react';
import api from '../../api/client';
import { Loader2, Award, Trophy, CheckCircle2, BookOpen, ClipboardList, Lightbulb, AlertTriangle, Info } from 'lucide-react';

const ORANGE = '#F05A28';
const TEAL   = '#0d9488';

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

function ScoreRing({ score, size = 80 }) {
  if (score == null) return (
    <div className="flex items-center justify-center rounded-full bg-gray-100 text-gray-400 text-xs font-bold"
      style={{ width: size, height: size }}>—</div>
  );
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 90 ? '#f59e0b' : score >= 80 ? '#8b5cf6' : score >= 70 ? '#10b981' : '#ef4444';
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-black" style={{ color }}>{Math.round(score)}</span>
        <span className="text-[9px] text-gray-400">/ 100</span>
      </div>
    </div>
  );
}

export default function NewJoinerAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/analytics/new-joiner')
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

  const summary    = data.summary     || {};
  const assessments = data.assessments || [];
  const timeline   = data.timeline    || [];
  const insights   = data.insights    || [];
  const isReady    = data.is_ready;
  const aiFeedback = data.latest_ai_feedback;

  return (
    <div className="space-y-6">

      {/* Hero */}
      <div className="rounded-2xl p-6 text-white" style={{ background: `linear-gradient(135deg, ${TEAL}, #134e4a)` }}>
        <h1 className="text-2xl font-bold mb-1">My Training Analytics</h1>
        <p className="text-teal-100 text-sm">Your quiz scores, badges, and onboarding progress at a glance.</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Quizzes Assigned',  value: summary.total_assessments || 0, color: 'text-gray-800' },
          { label: 'Attempted',         value: summary.attempted          || 0, color: 'text-indigo-700' },
          { label: 'Passed',            value: summary.passed             || 0, color: 'text-emerald-700' },
          { label: 'Badges (80–89%)',   value: summary.badges             || 0, color: 'text-purple-700' },
          { label: 'Trophies (90%+)',   value: summary.trophies           || 0, color: 'text-amber-600' },
        ].map(k => (
          <div key={k.label} className="bg-white border border-gray-100 rounded-xl p-4 text-center shadow-sm">
            <p className={`text-2xl font-black ${k.color}`}>{k.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

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

      {/* Ready for Job banner */}
      {isReady && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl px-5 py-4 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
          <div>
            <p className="font-semibold text-emerald-800">You've been marked Ready for the Job!</p>
            <p className="text-xs text-emerald-600 mt-0.5">Your manager has reviewed your progress and confirmed you're ready.</p>
          </div>
        </div>
      )}

      {/* Latest AI Feedback */}
      {aiFeedback && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-indigo-800 mb-2">Latest AI Feedback</h2>
          <p className="text-sm text-indigo-700 leading-relaxed">{aiFeedback}</p>
        </div>
      )}

      {/* SME Kits assigned */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="w-4 h-4 text-teal-600" />
          <h2 className="text-sm font-bold text-gray-800">SME Training Kits</h2>
        </div>
        <p className="text-2xl font-black text-teal-700">{data.sme_kits_assigned || 0}</p>
        <p className="text-xs text-gray-400 mt-0.5">Kit{data.sme_kits_assigned !== 1 ? 's' : ''} assigned to you by your manager.</p>
      </div>

      {/* Quiz scores grid */}
      {assessments.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <ClipboardList className="w-4 h-4" style={{ color: ORANGE }} /> Quiz Scores
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {assessments.map((a, i) => (
              <div key={i} className={`rounded-xl border p-4 flex items-center gap-4
                ${a.passed ? 'bg-emerald-50 border-emerald-200' : a.attempts > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                <ScoreRing score={a.best_score} size={64} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{a.title}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {a.passed && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">Passed</span>}
                    {a.trophy && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5"><Trophy className="w-2.5 h-2.5" /> Trophy</span>}
                    {a.badge  && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5"><Award className="w-2.5 h-2.5" /> Badge</span>}
                    {!a.attempts && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Not attempted</span>}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">{a.attempts} attempt{a.attempts !== 1 ? 's' : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Learning Timeline */}
      {timeline.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-4">Learning Timeline</h2>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
            <div className="space-y-4 pl-10">
              {timeline.map((ev, i) => {
                const dotColor = ev.type === 'quiz_passed' ? '#10b981' : ev.type === 'quiz_attempted' ? '#f59e0b' : TEAL;
                return (
                  <div key={i} className="relative">
                    <div className="absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-white"
                      style={{ background: dotColor }} />
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-xs font-medium text-gray-800">{ev.label}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {ev.date && <span className="text-[10px] text-gray-400">{ev.date.split('T')[0]}</span>}
                        {ev.score != null && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: ev.score >= 70 ? '#d1fae5' : '#fef3c7', color: ev.score >= 70 ? '#065f46' : '#92400e' }}>
                            {Math.round(ev.score)}/100
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {assessments.length === 0 && timeline.length === 0 && (
        <div className="text-center py-12 bg-white border border-gray-100 rounded-2xl">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p className="font-semibold text-gray-500">No quiz data yet</p>
          <p className="text-sm text-gray-400 mt-1">Your manager will assign quizzes from your SME training materials.</p>
        </div>
      )}
    </div>
  );
}

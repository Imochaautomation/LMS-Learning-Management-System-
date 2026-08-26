import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import {
  Loader2, Users, TrendingUp, CheckCircle2, Lightbulb, AlertTriangle, Info,
} from 'lucide-react';

const ORANGE = '#F05A28';
const NAVY   = '#1E1040';

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

function KpiCard({ label, value, sub, color = 'text-gray-900' }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      <p className="text-xs font-semibold text-gray-700 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function SkillBar({ skill, avg_score, severity, count }) {
  const color = severity === 'High' ? '#ef4444' : severity === 'Medium' ? '#f59e0b' : '#10b981';
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-xs text-gray-600 w-32 shrink-0 truncate" title={skill}>{skill}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${avg_score}%`, background: color }} />
      </div>
      <span className="text-xs font-bold w-8 text-right shrink-0" style={{ color }}>{avg_score}</span>
      <span className="text-[10px] text-gray-400 w-16 shrink-0">{count} member{count !== 1 ? 's' : ''}</span>
    </div>
  );
}

function LineChart({ data, keys, colors, height = 110 }) {
  if (!data || data.length === 0) return (
    <div className="h-20 flex items-center justify-center text-xs text-gray-400">No data yet</div>
  );
  const maxVal = Math.max(...data.flatMap(d => keys.map(k => d[k] || 0)), 1);
  const w = 100 / (data.length - 1 || 1);
  const points = (key) =>
    data.map((d, i) => `${i * w},${height - ((d[key] || 0) / maxVal) * (height - 10)}`).join(' ');

  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      {[0.25, 0.5, 0.75, 1].map(r => (
        <line key={r} x1="0" x2="100" y1={height - r * (height - 10)} y2={height - r * (height - 10)}
          stroke="#f1f5f9" strokeWidth="0.5" />
      ))}
      {keys.map((key, ki) => (
        <polyline key={key} points={points(key)} fill="none" stroke={colors[ki]} strokeWidth="1.5"
          strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {keys.map((key, ki) => {
        const d = data[data.length - 1];
        const x = (data.length - 1) * w;
        const y = height - ((d[key] || 0) / maxVal) * (height - 10);
        return <circle key={key} cx={x} cy={y} r="2" fill={colors[ki]} />;
      })}
    </svg>
  );
}

export default function ManagerAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const monthlyScrollRef = useRef(null);

  useEffect(() => {
    api.get('/analytics/manager')
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const container = monthlyScrollRef.current;
    if (container && data?.monthly_activity?.length) {
      container.scrollLeft = container.scrollWidth;
    }
  }, [data]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-7 h-7 animate-spin" style={{ color: ORANGE }} />
    </div>
  );

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 text-sm">{error}</div>
  );

  const snap     = data.team_snapshot               || {};
  const funnel   = data.onboarding_funnel           || [];
  const stats    = data.assessment_stats            || {};
  const gaps     = data.team_skill_gaps             || [];
  const strengths = data.team_strengths             || [];
  const goalDist = data.learning_goal_distribution  || {};
  const support  = data.learners_needing_support    || [];
  const monthly  = data.monthly_activity            || [];
  const insights = data.insights                    || [];

  return (
    <div className="space-y-6">

      {/* Hero */}
      <div className="rounded-2xl p-6 text-white" style={{ background: `linear-gradient(135deg, ${NAVY}, #312e81)` }}>
        <h1 className="text-2xl font-bold mb-1">Team Analytics</h1>
        <p className="text-indigo-200 text-sm">Your team's learning activity, skill health, and onboarding progress.</p>
      </div>

      {/* Team Snapshot */}
      <div>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Team Snapshot</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <KpiCard label="Total Team"        value={snap.total             || 0} color="text-gray-900" />
          <KpiCard label="New Joiners"        value={snap.new_joiners       || 0} color="text-teal-700" />
          <KpiCard label="Employees"          value={snap.employees         || 0} color="text-indigo-700" />
          <KpiCard label="Active Learners"    value={snap.active_learners   || 0} color="text-blue-700" />
          <KpiCard label="Courses Completed"  value={snap.courses_completed || 0} color="text-emerald-700" />
        </div>
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

      {/* Quiz Performance */}
      <div>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Quiz Performance (New Joiners)</h2>
        <div className="grid grid-cols-3 gap-3">
          <KpiCard label="Total Attempts" value={stats.total_attempts || 0} color="text-gray-800" />
          <KpiCard label="Avg Score"      value={`${stats.avg_score || 0}%`} color={stats.avg_score >= 70 ? 'text-emerald-700' : 'text-amber-700'} />
          <KpiCard label="Pass Rate"      value={`${stats.pass_rate || 0}%`} color={stats.pass_rate >= 70 ? 'text-emerald-700' : 'text-red-700'} />
        </div>
      </div>

      {/* Onboarding Funnel */}
      {funnel.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-4">Onboarding Funnel</h2>
          <div className="space-y-3">
            {funnel.map((stage, i) => {
              const pct = Math.round((stage.count / stage.total) * 100);
              const color = i === 0 ? '#6366f1' : i === 1 ? ORANGE : i === 2 ? '#10b981' : '#f59e0b';
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">{stage.stage}</span>
                    <span className="font-bold" style={{ color }}>{stage.count} / {stage.total} ({pct}%)</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Team Skill Gaps + Strengths */}
      <div className="grid sm:grid-cols-2 gap-4">
        {gaps.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-bold text-gray-800 mb-4">Team Skill Gaps</h2>
            <div className="space-y-0.5">
              {gaps.map((g, i) => <SkillBar key={i} {...g} />)}
            </div>
            <p className="text-[10px] text-gray-400 mt-3">From employee AI interview sessions. Lower = bigger gap.</p>
          </div>
        )}

        {strengths.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
            <h2 className="text-sm font-bold text-emerald-800 mb-4">Team Top Strengths</h2>
            <div className="space-y-0.5">
              {strengths.map((g, i) => <SkillBar key={i} {...g} />)}
            </div>
            <p className="text-[10px] text-emerald-600 mt-3">Skills your team scores 70+ on average.</p>
          </div>
        )}

        {gaps.length === 0 && strengths.length === 0 && (
          <div className="sm:col-span-2 bg-gray-50 border border-gray-200 rounded-xl p-5 text-center text-sm text-gray-500">
            No skill data yet — visible after employees complete AI interviews.
          </div>
        )}
      </div>

      {/* Learning Goal Distribution */}
      {goalDist.total_employees > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" style={{ color: ORANGE }} /> Learning Goal Distribution
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-emerald-700 font-medium">With learning goal</span>
                <span className="font-bold text-emerald-700">{goalDist.with_goal}</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
                <div className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${Math.round((goalDist.with_goal / goalDist.total_employees) * 100)}%` }} />
              </div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500 font-medium">No learning goal set</span>
                <span className="font-bold text-gray-500">{goalDist.without_goal}</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gray-300 rounded-full"
                  style={{ width: `${Math.round((goalDist.without_goal / goalDist.total_employees) * 100)}%` }} />
              </div>
            </div>
            <div className="text-center w-20 shrink-0">
              <p className="text-3xl font-black text-gray-800">{goalDist.total_employees}</p>
              <p className="text-[10px] text-gray-400">employees</p>
            </div>
          </div>
        </div>
      )}

      {/* Learners Needing Support */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-red-500" /> Learners Needing Support
          {support.length > 0 && (
            <span className="ml-auto text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">{support.length}</span>
          )}
        </h2>
        {support.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="w-4 h-4" /> All learners are on track!
          </div>
        ) : (
          <div className="space-y-2">
            {support.map((l, i) => (
              <div key={i} className="flex items-start justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="min-w-0">
                  <Link to={`/manager/learner/${l.id}`} className="text-sm font-semibold text-indigo-700 hover:underline">
                    {l.name}
                  </Link>
                  <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-semibold
                    ${l.role === 'new_joiner' ? 'bg-teal-100 text-teal-700' : 'bg-indigo-100 text-indigo-700'}`}>
                    {l.role === 'new_joiner' ? 'New Joiner' : 'Employee'}
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {l.issues.map((issue, j) => (
                      <span key={j} className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full">{issue}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Monthly Activity */}
      {monthly.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-1">Monthly Activity (Last 12 Months)</h2>
          <div className="flex items-center gap-4 text-xs mb-3 mt-1">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 rounded" style={{ background: ORANGE }} /> Quiz Attempts</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 rounded bg-emerald-500" /> Quiz Passed</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 rounded bg-indigo-500" /> Courses Completed</span>
          </div>
          <div ref={monthlyScrollRef} className="overflow-x-auto pb-2" aria-label="Scrollable monthly activity chart">
            <div style={{ minWidth: `${Math.max(720, monthly.length * 110)}px` }}>
              <LineChart
                data={monthly}
                keys={['attempts', 'passed', 'courses_completed']}
                colors={[ORANGE, '#10b981', '#6366f1']}
                height={110}
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                {monthly.map((m, i) => <span key={i} className="w-20 text-center shrink-0">{m.month}</span>)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

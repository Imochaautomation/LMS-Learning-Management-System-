import { useState, useEffect } from 'react';
import api from '../../api/client';
import {
  Loader2, Users, Globe, Lightbulb, AlertTriangle, Info, CheckCircle2,
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

function SkillBar({ skill, avg_score, severity, count }) {
  const color = severity === 'High' ? '#ef4444' : severity === 'Medium' ? '#f59e0b' : '#10b981';
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-xs text-gray-600 w-36 shrink-0 truncate" title={skill}>{skill}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${avg_score}%`, background: color }} />
      </div>
      <span className="text-xs font-bold w-8 text-right shrink-0" style={{ color }}>{avg_score}</span>
      <span className="text-[10px] text-gray-400 w-16 shrink-0">{count} employee{count !== 1 ? 's' : ''}</span>
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

export default function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/analytics/admin')
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

  const adopt          = data.platform_adoption    || {};
  const roles          = data.role_counts          || {};
  const depts          = data.department_comparison || [];
  const monthly        = data.monthly_trends       || [];
  const gaps           = data.org_skill_gaps       || [];
  const strengths      = data.org_strengths        || [];
  const onboard        = data.onboarding_stats     || {};
  const onboardMonthly = data.onboarding_monthly   || [];
  const goalTrends     = data.learning_goal_trends || [];
  const insights       = data.insights             || [];

  const maxDeptUsers = Math.max(...depts.map(d => d.users), 1);

  return (
    <div className="space-y-6">

      {/* Hero */}
      <div className="rounded-2xl p-6 text-white" style={{ background: 'linear-gradient(135deg,#1e1040,#312e81)' }}>
        <h1 className="text-2xl font-bold mb-1">Platform Analytics</h1>
        <p className="text-indigo-200 text-sm">Organization-wide learning activity and skill development overview.</p>
      </div>

      {/* Platform Adoption */}
      <div>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Platform Adoption</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total Users',       value: adopt.total_users          || 0, color: 'text-gray-900' },
            { label: 'Profiles Created',  value: adopt.with_profile         || 0, color: 'text-indigo-700' },
            { label: 'Interviews Done',   value: adopt.interviews_completed || 0, color: 'text-violet-700' },
            { label: 'Active Learners',   value: adopt.active_learners      || 0, color: 'text-teal-700' },
            { label: 'Courses Completed', value: adopt.courses_completed    || 0, color: 'text-emerald-700' },
          ].map(k => (
            <div key={k.label} className="bg-white border border-gray-100 rounded-xl p-4 text-center shadow-sm">
              <p className={`text-2xl font-black ${k.color}`}>{k.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
            </div>
          ))}
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

      {/* Role Breakdown + Onboarding Readiness */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: ORANGE }} /> Users by Role
          </h2>
          {Object.entries(roles).map(([role, count]) => {
            const total = Object.values(roles).reduce((s, v) => s + v, 0) || 1;
            const pct = Math.round(count / total * 100);
            const palette = { admin: '#ef4444', manager: ORANGE, employee: '#6366f1', new_joiner: '#0d9488' };
            const label   = { admin: 'Admin', manager: 'Manager', employee: 'Employee', new_joiner: 'New Joiner' };
            return (
              <div key={role} className="flex items-center gap-3 py-1.5">
                <span className="text-xs w-24 text-gray-600 shrink-0">{label[role] || role}</span>
                <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: palette[role] || '#94a3b8' }} />
                </div>
                <span className="text-xs font-bold text-gray-700 w-5 text-right">{count}</span>
                <span className="text-[10px] text-gray-400 w-8 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4 text-teal-600" /> New Joiner Readiness
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-black text-teal-700">{onboard.ready_for_job || 0}</p>
                <p className="text-xs text-gray-500">Ready for Job</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-gray-800">{onboard.total_new_joiners || 0}</p>
                <p className="text-xs text-gray-500">Total New Joiners</p>
              </div>
            </div>
            {(onboard.total_new_joiners || 0) > 0 && (
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Readiness Rate</span>
                  <span className="font-semibold">{onboard.ready_rate || 0}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full" style={{ width: `${onboard.ready_rate || 0}%` }} />
                </div>
              </div>
            )}
            {(onboard.total_new_joiners || 0) === 0 && (
              <p className="text-xs text-gray-400">No new joiners in the system yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Trends */}
      {monthly.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-1">Monthly Trends (Last 6 Months)</h2>
          <div className="flex items-center gap-4 text-xs mb-3 mt-1 flex-wrap">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 rounded bg-violet-500" /> Interviews</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 rounded bg-emerald-500" /> Certificates</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 rounded bg-blue-400" /> Courses Started</span>
          </div>
          <LineChart
            data={monthly}
            keys={['interviews', 'certificates', 'courses_started']}
            colors={['#8b5cf6', '#10b981', '#60a5fa']}
            height={110}
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            {monthly.map((m, i) => <span key={i}>{m.month.split(' ')[0]}</span>)}
          </div>
        </div>
      )}

      {/* Onboarding Monthly Trend */}
      {onboardMonthly.some(m => m.new_joiners > 0 || m.ready > 0) && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-1">Onboarding &amp; Readiness Trend</h2>
          <div className="flex items-center gap-4 text-xs mb-3 mt-1">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 rounded bg-teal-400" /> New Joiners</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 rounded" style={{ background: ORANGE }} /> Marked Ready</span>
          </div>
          <LineChart
            data={onboardMonthly}
            keys={['new_joiners', 'ready']}
            colors={['#2dd4bf', ORANGE]}
            height={90}
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            {onboardMonthly.map((m, i) => <span key={i}>{m.month.split(' ')[0]}</span>)}
          </div>
        </div>
      )}

      {/* Learning Goal Trends */}
      {goalTrends.some(m => m.profiles_with_goal > 0) && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-1">Learning Goal Adoption (Last 6 Months)</h2>
          <p className="text-xs text-gray-400 mb-3">New employee profiles that included a learning goal.</p>
          <div className="flex items-end gap-1 h-16">
            {goalTrends.map((m, i) => {
              const maxV = Math.max(...goalTrends.map(x => x.profiles_with_goal), 1);
              const h = Math.round((m.profiles_with_goal / maxV) * 100);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] font-semibold text-indigo-600">{m.profiles_with_goal || ''}</span>
                  <div className="w-full rounded-t-sm bg-indigo-200" style={{ height: `${Math.max(h, 4)}%` }} />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            {goalTrends.map((m, i) => <span key={i}>{m.month.split(' ')[0]}</span>)}
          </div>
        </div>
      )}

      {/* Org Skill Gaps + Strengths */}
      <div className="grid sm:grid-cols-2 gap-4">
        {gaps.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-bold text-gray-800 mb-1">Organization Skill Gaps</h2>
            <p className="text-xs text-gray-400 mb-4">Aggregated across all employee AI interview sessions.</p>
            <div className="space-y-0.5">
              {gaps.map((g, i) => <SkillBar key={i} {...g} />)}
            </div>
            <div className="flex items-center gap-3 mt-3 text-xs text-gray-500 flex-wrap">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Critical (&lt;50)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Growing (50–69)</span>
            </div>
          </div>
        )}

        {strengths.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
            <h2 className="text-sm font-bold text-emerald-800 mb-1">Organization Top Strengths</h2>
            <p className="text-xs text-emerald-600 mb-4">Skills scoring 70+ on average across the org.</p>
            <div className="space-y-0.5">
              {strengths.map((g, i) => <SkillBar key={i} {...g} />)}
            </div>
          </div>
        )}
      </div>

      {/* Department Comparison */}
      {depts.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-4">Department Comparison</h2>
          <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 2fr repeat(3, 1fr)' }}>
            <span className="text-[10px] font-bold text-gray-400 uppercase">Department</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase">Users</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase text-center">Courses</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase text-center">Interviews</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase text-center">Quizzes Passed</span>
          </div>
          {depts.map((d, i) => {
            const pct = Math.round((d.users / maxDeptUsers) * 100);
            return (
              <div key={i} className="grid items-center gap-2 py-2 border-b border-gray-50 last:border-0 text-xs"
                style={{ gridTemplateColumns: '1fr 2fr repeat(3, 1fr)' }}>
                <span className="font-medium text-gray-800 truncate" title={d.dept}>{d.dept}</span>
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-400" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-gray-500 w-5 shrink-0">{d.users}</span>
                </div>
                <span className="text-center text-emerald-600 font-semibold">{d.courses_completed}</span>
                <span className="text-center text-violet-600 font-semibold">{d.interviews}</span>
                <span className="text-center text-amber-600 font-semibold">{d.assessments_passed}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

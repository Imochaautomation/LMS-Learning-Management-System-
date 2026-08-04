import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import BackButton from '../../components/shared/BackButton';
import { Search, Trophy, Award, CheckCircle, XCircle, Loader2, ChevronRight, RefreshCw, ThumbsUp, ThumbsDown, Bell } from 'lucide-react';

const ORANGE = '#F05A28';

export default function ManagerQuizzes() {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | passed | failed | not_attempted | pending
  const [actionLoading, setActionLoading] = useState({}); // { [assessmentId]: 'approving'|'rejecting' }

  const reload = () => {
    api.get('/training/assessments')
      .then(setAssessments)
      .catch(() => setAssessments([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  const handleApprove = async (id) => {
    setActionLoading(p => ({ ...p, [id]: 'approving' }));
    try { await api.post(`/training/assessments/${id}/approve-attempt`, {}); reload(); }
    catch (e) { alert(e.message); }
    finally { setActionLoading(p => { const n = {...p}; delete n[id]; return n; }); }
  };

  const handleReject = async (id) => {
    setActionLoading(p => ({ ...p, [id]: 'rejecting' }));
    try { await api.post(`/training/assessments/${id}/reject-attempt`, {}); reload(); }
    catch (e) { alert(e.message); }
    finally { setActionLoading(p => { const n = {...p}; delete n[id]; return n; }); }
  };

  const filtered = assessments.filter(a => {
    const matchSearch = !search ||
      (a.new_joiner_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.title || '').toLowerCase().includes(search.toLowerCase());

    const matchFilter =
      filter === 'all' ? true :
      filter === 'passed' ? a.passed :
      filter === 'failed' ? (a.attempt_count > 0 && !a.passed) :
      filter === 'not_attempted' ? a.attempt_count === 0 :
      filter === 'pending' ? a.attempt_request_status === 'pending' :
      true;

    return matchSearch && matchFilter;
  });

  const pendingCount = assessments.filter(a => a.attempt_request_status === 'pending').length;

  const stats = {
    total: assessments.length,
    passed: assessments.filter(a => a.passed).length,
    failed: assessments.filter(a => a.attempt_count > 0 && !a.passed).length,
    not_attempted: assessments.filter(a => a.attempt_count === 0).length,
  };

  const scoreBadge = (score) => {
    if (score == null) return null;
    if (score >= 90) return { icon: <Trophy className="w-3.5 h-3.5" />, label: `${score}%`, cls: 'text-amber-600 bg-amber-50 border-amber-200' };
    if (score >= 80) return { icon: <Award className="w-3.5 h-3.5" />, label: `${score}%`, cls: 'text-purple-600 bg-purple-50 border-purple-200' };
    return { icon: null, label: `${score}%`, cls: 'text-gray-600 bg-gray-50 border-gray-200' };
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: ORANGE }} />
      <span className="ml-3 text-gray-500">Loading quizzes...</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <BackButton to="/manager" label="Back to Manager" />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Joiner Quizzes</h1>
          <p className="text-sm text-gray-500 mt-1">All AI-generated quizzes assigned to your new joiners.</p>
        </div>
        {pendingCount > 0 && (
          <div className="shrink-0 flex items-center gap-2 bg-amber-50 border border-amber-300 text-amber-800 text-sm font-semibold px-4 py-2 rounded-xl">
            <Bell className="w-4 h-4" /> {pendingCount} Attempt Request{pendingCount > 1 ? 's' : ''} Pending
          </div>
        )}
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Quizzes', value: stats.total, cls: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
          { label: 'Passed', value: stats.passed, cls: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
          { label: 'Not Passed Yet', value: stats.failed, cls: 'text-red-600', bg: 'bg-red-50 border-red-200' },
          { label: 'Not Attempted', value: stats.not_attempted, cls: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 text-center ${s.bg}`}>
            <div className={`text-2xl font-bold ${s.cls}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by joiner name or quiz title..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 bg-white"
            style={{ '--tw-ring-color': ORANGE }}
            onFocus={e => { e.target.style.borderColor = ORANGE; e.target.style.boxShadow = `0 0 0 2px rgba(240,90,40,0.15)`; }}
            onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
          />
        </div>
        <div className="flex gap-1.5">
          {[
            { key: 'all', label: 'All' },
            { key: 'pending', label: `⏳ Requests (${pendingCount})` },
            { key: 'passed', label: 'Passed' },
            { key: 'failed', label: 'Not Passed' },
            { key: 'not_attempted', label: 'Not Attempted' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${filter === f.key ? 'text-white border-transparent shadow-sm' : 'text-gray-600 bg-white border-gray-200 hover:border-gray-300'}`}
              style={filter === f.key ? { background: ORANGE } : {}}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quiz table */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <p className="text-gray-500 text-sm">No quizzes match your filters.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">New Joiner</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Quiz Title</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Questions</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Attempts</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Best Score</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Attempt Request</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(a => {
                  const badge = scoreBadge(a.best_score);
                  return (
                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3.5 font-medium text-gray-900">
                        {a.new_joiner_name || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-gray-700 max-w-[200px]">
                        <span className="truncate block">{a.title}</span>
                      </td>
                      <td className="px-4 py-3.5 text-center text-gray-600">
                        {a.total_questions}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {a.attempt_count === 0
                          ? <span className="text-gray-400">—</span>
                          : <span className="flex items-center justify-center gap-1 text-gray-700">
                              <RefreshCw className="w-3 h-3 text-gray-400" /> {a.attempt_count}
                            </span>
                        }
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {badge
                          ? <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs font-semibold ${badge.cls}`}>
                              {badge.icon}{badge.label}
                            </span>
                          : <span className="text-gray-400 text-xs">Not taken</span>
                        }
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {a.attempt_count === 0
                          ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Pending</span>
                          : a.passed
                          ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <CheckCircle className="w-3 h-3" /> Passed
                            </span>
                          : <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                              <XCircle className="w-3 h-3" /> Not Passed
                            </span>
                        }
                      </td>
                      {/* Attempt Request column */}
                      <td className="px-4 py-3.5 text-center">
                        {a.attempt_request_status === 'pending' ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleApprove(a.id)}
                              disabled={!!actionLoading[a.id]}
                              title="Approve new attempt"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 disabled:opacity-50 transition-colors">
                              {actionLoading[a.id] === 'approving' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ThumbsUp className="w-3 h-3" />}
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(a.id)}
                              disabled={!!actionLoading[a.id]}
                              title="Reject request"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors">
                              {actionLoading[a.id] === 'rejecting' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ThumbsDown className="w-3 h-3" />}
                              Reject
                            </button>
                          </div>
                        ) : a.attempt_request_status === 'approved' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle className="w-3 h-3" /> Approved
                          </span>
                        ) : a.attempt_request_status === 'rejected' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                            <XCircle className="w-3 h-3" /> Rejected
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {a.new_joiner_id && (
                          <Link
                            to={`/manager/learner/${a.new_joiner_id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-white px-3 py-1.5 rounded-lg transition-colors"
                            style={{ background: ORANGE }}
                            onMouseEnter={e => e.currentTarget.style.background = '#c2410c'}
                            onMouseLeave={e => e.currentTarget.style.background = ORANGE}
                          >
                            View <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

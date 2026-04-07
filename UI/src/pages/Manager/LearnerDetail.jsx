import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api/client';
import BackButton from '../../components/shared/BackButton';
import SkillGaugeChart from '../../components/shared/SkillGaugeChart';
import SkillLineChart from '../../components/shared/SkillLineChart';
import { FileText, GraduationCap, BarChart3, ExternalLink, Send, Search, Plus, Trophy, Flame, Award, ArrowRight, FileSearch, Printer, X } from 'lucide-react';

// Journey based on completed courses (no XP)
const JOURNEY_LEVELS = [
  { title: 'New Learner', min: 0, emoji: '🌱' },
  { title: 'Rising Learner', min: 1, emoji: '📗' },
  { title: 'Active Learner', min: 3, emoji: '⭐' },
  { title: 'Skilled Learner', min: 5, emoji: '🏆' },
  { title: 'Expert Learner', min: 8, emoji: '🏅' },
  { title: 'Champion Learner', min: 12, emoji: '✨' },
];

const severityColor = { High: 'bg-red-100 text-red-700 border-red-200', Medium: 'bg-amber-100 text-amber-700 border-amber-200', Low: 'bg-blue-100 text-blue-700 border-blue-200' };
const severityBar = { High: 'bg-red-500', Medium: 'bg-amber-500', Low: 'bg-blue-500' };

// Replace student with professional
const sanitizeReview = (text) => {
  if (!text) return text;
  return text
    .replace(/\bstudent\b/gi, 'professional')
    .replace(/\bstudents\b/gi, 'professionals')
    .replace(/\bStudent\b/g, 'Professional')
    .replace(/\bStudents\b/g, 'Professionals');
};



export default function LearnerDetail() {
  const { id } = useParams();
  const [learner, setLearner] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [skillGaps, setSkillGaps] = useState([]);
  const [strengths, setStrengths] = useState([]);
  const [areasOfImprovement, setAreasOfImprovement] = useState([]);
  const [bank, setBank] = useState([]);
  const [showAssign, setShowAssign] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');
  const [selectedAssess, setSelectedAssess] = useState([]);
  const [expandedAssess, setExpandedAssess] = useState(null);
  const [feedbackModal, setFeedbackModal] = useState(null);

  useEffect(() => {
    api.get('/admin/users').then((all) => {
      const u = all.find((x) => x.id === parseInt(id));
      setLearner(u || null);
    }).catch(() => setLearner(null));

    api.get(`/assessments/assigned?user_id=${id}`).then(setAssessments).catch(() => setAssessments([]));
    api.get(`/courses/user/${id}`).then(setCourses).catch(() => setCourses([]));
    // Fetch skill analysis (includes strengths/areas)
    api.get(`/ai/skill-analysis/${id}`).then((data) => {
      setSkillGaps(data.skill_gaps || []);
      setStrengths(data.strengths || []);
      setAreasOfImprovement(data.areas_of_improvement || []);
    }).catch(() => {
      // Fallback to old endpoint
      api.get(`/profile/${id}/skill-gaps`).then(setSkillGaps).catch(() => setSkillGaps([]));
    });
    api.get('/banks/assessments').then(setBank).catch(() => {});
  }, [id]);

  if (!learner) return <div className="p-8 text-center text-gray-400">Loading...</div>;

  const isNewJoiner = learner.role === 'new_joiner';
  const completedAssess = assessments.filter((a) => a.status === 'reviewed' || a.status === 'submitted');
  const completedCourses = courses.filter((c) => c.status === 'completed');
  const startedCourses = courses.filter((c) => c.status === 'started');

  const filteredBank = bank.filter((a) => a.name.toLowerCase().includes(assignSearch.toLowerCase()));
  const toggleAssess = (aId) => setSelectedAssess((prev) => prev.includes(aId) ? prev.filter((x) => x !== aId) : [...prev, aId]);

  const assignAssessments = async () => {
    for (const aId of selectedAssess) {
      const a = bank.find((x) => x.id === aId);
      try { await api.post('/assessments/assign', { user_id: parseInt(id), assessment_name: a.name, assessment_bank_id: a.id }); } catch {}
    }
    setShowAssign(false);
    setSelectedAssess([]);
  };

  return (
    <div className="space-y-6">
      <BackButton to="/manager" label="Back to Learners" />

      {/* Header — dark night theme for employees, light for new joiners */}
      {isNewJoiner ? (
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full -translate-y-12 translate-x-12" />
          <div className="absolute bottom-0 left-0 w-28 h-28 bg-teal-500/5 rounded-full translate-y-8 -translate-x-8" />
          {/* Name + Quest Journey in one block */}
          <div className="relative flex items-center justify-between mb-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xl font-bold shadow-lg shadow-emerald-500/20">
                {learner.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <h1 className="text-xl font-bold">{learner.name}</h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-500/25 text-emerald-300 border border-emerald-400/30">New Joiner</span>
                  <span className="text-xs text-slate-400">{learner.department || ''}</span>
                  <span className="text-xs text-slate-500">{learner.email}</span>
                </div>
              </div>
            </div>
          </div>
          {/* Quest Journey inline */}
          {(() => {
            const badgesCount = completedAssess.filter(a => a.score >= 90).length;
            const trophiesCount = completedAssess.filter(a => a.score >= 95).length;
            const titles = [{t:'New Learner',x:0,e:'🌱'},{t:'Rising Learner',x:1,e:'📗'},{t:'Active Learner',x:2,e:'⭐'},{t:'Skilled Learner',x:3,e:'🏆'},{t:'Expert Learner',x:4,e:'🧩'},{t:'Champion',x:5,e:'🌟'}];
            let title = titles[0]; for (const tt of titles) { if (completedAssess.length >= tt.x) title = tt; }
            const steps = [
              { label: '📚 Spellbook', done: true, desc: 'Studied training kit' },
              ...assessments.map((a, i) => ({
                label: `⚔️ Quest ${i + 1}`,
                done: a.status === 'reviewed' || a.status === 'submitted',
                active: a.status === 'pending' || a.status === 'downloaded',
                desc: a.assessment_name || `Assessment ${i + 1}`,
              })),
              { label: '🎓 Ready', done: false, locked: true, desc: 'Mark ready to unlock courses' },
              { label: '🚀 Self-Learning', done: false, locked: true, desc: 'Courses unlocked' },
            ];
            return (
              <>
                <div className="flex items-center justify-between mb-3 border-t border-slate-700/60 pt-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-200">🗺️ {learner.name}'s Quest Journey</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-purple-400 bg-purple-900/40 px-2 py-1 rounded-full">🏅 {badgesCount} badges</span>
                    <span className="text-xs font-bold text-amber-400 bg-amber-900/40 px-2 py-1 rounded-full">🏆 {trophiesCount} trophies</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-1.5 shrink-0">
                      <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold ${
                        step.done ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                        step.active ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 ring-1 ring-amber-400/30' :
                        step.locked ? 'bg-slate-700/50 text-slate-500 border border-slate-600/30' :
                        'bg-slate-700/30 text-slate-500 border border-slate-700/30'
                      }`}>
                        {step.done ? '✅' : step.active ? '⚔️' : step.locked ? '🔒' : '○'}
                        <span>{step.label}</span>
                      </div>
                      {i < steps.length - 1 && <span className={`text-sm ${step.done ? 'text-emerald-500' : 'text-slate-600'}`}>→</span>}
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      ) : (
        <div className="bg-gradient-to-r from-indigo-600 to-violet-700 rounded-2xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-10 -translate-x-10" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl font-bold shadow-lg">
                {learner.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <h1 className="text-xl font-bold">{learner.name}</h1>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-white/20 text-white border border-white/30">Employee</span>
                  <span className="text-xs text-indigo-200">{learner.department || ''}</span>
                  <span className="text-xs text-indigo-300">{learner.email}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== NEW JOINER VIEW ========== */}
      {isNewJoiner && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-sm text-gray-500 mb-1">Assessments</p>
              <p className="text-2xl font-bold text-gray-900">{completedAssess.length} / {assessments.length}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-sm text-gray-500 mb-1">🏅 Badges Earned</p>
              <p className="text-2xl font-bold text-purple-600">{completedAssess.filter(a => a.score >= 90).length}</p>
            </div>
          </div>

          {/* Assign Assessment */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2"><FileText className="w-4 h-4" /> Assessments</h2>
              <button onClick={() => setShowAssign(!showAssign)} className="flex items-center gap-1.5 px-3 py-2 bg-orange-100 text-orange-700 text-sm font-medium rounded-lg hover:bg-orange-200">
                <Plus className="w-4 h-4" /> Assign Assessment
              </button>
            </div>

            {showAssign && (
              <div className="mb-4 border border-orange-200 bg-orange-50 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Select from Assessment Bank:</p>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input placeholder="Search assessments..." value={assignSearch} onChange={(e) => setAssignSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg" />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 mb-3">
                  {filteredBank.map((a) => (
                    <label key={a.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-orange-100 ${selectedAssess.includes(a.id) ? 'bg-orange-100' : ''}`}>
                      <input type="checkbox" checked={selectedAssess.includes(a.id)} onChange={() => toggleAssess(a.id)} className="rounded" />
                      <span className="text-sm text-gray-700">{a.name}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button disabled={selectedAssess.length === 0} onClick={assignAssessments}
                    className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 disabled:opacity-50">
                    <Send className="w-3.5 h-3.5" /> Assign ({selectedAssess.length})
                  </button>
                  <button onClick={() => { setShowAssign(false); setSelectedAssess([]); }} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button>
                </div>
              </div>
            )}

            {assessments.length === 0 ? <p className="text-sm text-gray-400">No assessments assigned yet.</p> : (
              <div className="space-y-3">
                {assessments.map((a) => (
                  <div key={a.id} className="bg-gray-50 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-100" onClick={() => setExpandedAssess(expandedAssess === a.id ? null : a.id)}>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{a.assessment_name || a.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{a.assigned_date || a.created_at?.split('T')[0]}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {a.submission_file && (
                          <span className="text-xs text-indigo-600 font-medium">📎 Submitted</span>
                        )}
                        {a.score && <span className="text-sm font-bold text-gray-700">{a.score}/100</span>}
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          a.status === 'reviewed' ? 'bg-emerald-50 text-emerald-700' :
                          a.status === 'submitted' ? 'bg-blue-50 text-blue-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>{a.status}</span>
                      </div>
                    </div>
                    {expandedAssess === a.id && (a.status === 'submitted' || a.status === 'reviewed') && (
                      <div className="px-3 pb-3 space-y-2 border-t border-gray-200 pt-2">
                        {a.submission_file && (
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-indigo-500" />
                            <a href={a.submission_path ? `http://localhost:8000${a.submission_path}` : '#'}
                              target="_blank"
                              className="text-sm text-indigo-600 hover:underline font-medium">
                              {a.submission_file}
                            </a>
                            <span className="text-xs text-gray-400">— View submitted work</span>
                          </div>
                        )}
                        {a.ai_summary && (
                          <div className="bg-white border border-indigo-100 rounded-lg p-3">
                            <p className="text-xs font-semibold text-indigo-700 mb-1">🤖 AI Review Summary</p>
                            <p className="text-sm text-gray-700">{sanitizeReview(a.ai_summary)}</p>
                          </div>
                        )}
                        {a.ai_summary && (
                          <button
                            onClick={() => setFeedbackModal(a)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors">
                            <FileSearch className="w-3.5 h-3.5" /> View Detailed Feedback Report
                          </button>
                        )}
                        {!a.submission_file && <p className="text-xs text-gray-400">No file submitted yet.</p>}
                      </div>
                    )}
                    {expandedAssess === a.id && a.status === 'pending' && (
                      <div className="px-3 pb-3 border-t border-gray-200 pt-2">
                        <p className="text-xs text-gray-400">⏳ Waiting for learner to download and submit this assessment.</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ========== EMPLOYEE VIEW ========== */}
      {!isNewJoiner && (() => {
        // Journey based on completed courses count (no XP)
        let currentLevel = JOURNEY_LEVELS[0];
        for (const lv of JOURNEY_LEVELS) {
          if (completedCourses.length >= lv.min) currentLevel = lv;
        }
        const avgScore = skillGaps.length ? Math.round(skillGaps.reduce((s, g) => s + (g.score || 0), 0) / skillGaps.length) : 0;
        const highGaps = skillGaps.filter(g => g.severity === 'High').length;
        return (
        <>
          {/* Stats Strip */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
              <GraduationCap className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
              <div className="text-xl font-bold text-emerald-600">{completedCourses.length}</div>
              <div className="text-xs text-gray-500">Completed</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
              <BarChart3 className="w-5 h-5 text-indigo-600 mx-auto mb-1" />
              <div className="text-xl font-bold text-indigo-600">{avgScore}%</div>
              <div className="text-xs text-gray-500">Avg Skill Score</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
              <Flame className="w-5 h-5 text-red-500 mx-auto mb-1" />
              <div className="text-xl font-bold text-red-500">{highGaps}</div>
              <div className="text-xs text-gray-500">High-Priority Gaps</div>
            </div>
          </div>

          {/* Learner Title Journey */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-5 text-white">
            <h2 className="font-semibold mb-3 flex items-center gap-2 text-sm"><Trophy className="w-4 h-4 text-amber-400" /> My Journey</h2>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">{JOURNEY_LEVELS.map((lv, i) => (
              <div key={i} className="flex items-center gap-2 shrink-0">
                <div className={`text-center px-3 py-2 rounded-lg border transition-all ${completedCourses.length >= lv.min ? 'bg-white/15 border-white/20' : 'bg-white/5 border-white/5 opacity-50'}`}>
                  <span className="text-lg block">{lv.emoji}</span><p className="text-xs font-medium mt-1">{lv.title}</p>
                </div>
                {i < JOURNEY_LEVELS.length - 1 && <ArrowRight className="w-3 h-3 text-gray-500 shrink-0" />}
              </div>
            ))}</div>
          </div>

          {/* Skill Gap Analysis */}
          {skillGaps.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-indigo-600" /> Skill Gap Analysis</h2>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">High</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Medium</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Low</span>
                </div>
              </div>

              {/* Skill Gap Gauge Chart */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <SkillGaugeChart score={avgScore} size={280} />
              </div>

              {/* Skill Line Chart */}
              <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">📈 Skill Score Breakdown</h3>
                <SkillLineChart skillGaps={skillGaps} height={220} />
              </div>

              {/* Strengths & Areas of Improvement */}
              {(strengths.length > 0 || areasOfImprovement.length > 0) && (
                <div className="mt-5 grid sm:grid-cols-2 gap-4">
                  {strengths.length > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                      <h3 className="text-sm font-bold text-emerald-800 mb-3 flex items-center gap-2">💪 Strengths</h3>
                      <ul className="space-y-1.5">
                        {strengths.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-emerald-700">
                            <span className="text-emerald-500 mt-0.5 shrink-0">✓</span> {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {areasOfImprovement.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <h3 className="text-sm font-bold text-amber-800 mb-3 flex items-center gap-2">🎯 Areas of Improvement</h3>
                      <ul className="space-y-1.5">
                        {areasOfImprovement.map((a, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                            <span className="text-amber-500 mt-0.5 shrink-0">→</span> {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Course Activity */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2"><GraduationCap className="w-4 h-4 text-purple-600" /> Course Activity</h2>
              <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full font-medium">{courses.length} courses</span>
            </div>
            {courses.length === 0 ? <p className="text-sm text-gray-400">No courses yet.</p> : (
              <div className="space-y-3">
                {courses.map((c) => (
                  <div key={c.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    c.status === 'completed' ? 'bg-emerald-50 border-emerald-200' :
                    c.status === 'started' ? 'bg-blue-50 border-blue-200' :
                    'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${
                        c.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                        c.status === 'started' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>{c.status === 'completed' ? '✅' : c.status === 'started' ? '▶️' : '📌'}</div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{c.course_title || c.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{c.provider || ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.status === 'completed' && c.proof_file && (
                        <a href={c.proof_path ? `http://localhost:8000${c.proof_path}` : '#'}
                          target="_blank"
                          className="flex items-center gap-1 px-2.5 py-1 text-xs text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50">
                          <ExternalLink className="w-3 h-3" /> Certificate
                        </a>
                      )}
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                        c.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                        c.status === 'started' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>{c.status === 'completed' ? '✨ Completed' : c.status === 'started' ? '📖 In Progress' : '📌 Saved'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
        );
      })()}

      {/* Detailed Feedback PDF Modal */}
      {feedbackModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setFeedbackModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="font-bold text-gray-900">📄 Detailed Feedback Report</h2>
                <p className="text-xs text-gray-500 mt-0.5">{feedbackModal.assessment_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
                  <Printer className="w-4 h-4" /> Print / Save PDF
                </button>
                <button onClick={() => setFeedbackModal(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto p-6 space-y-5">
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Assessment:</span> <span className="font-semibold">{feedbackModal.assessment_name}</span></div>
                  <div><span className="text-gray-500">Submitted:</span> <span className="font-semibold">{feedbackModal.submitted_at ? new Date(feedbackModal.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span></div>
                  <div><span className="text-gray-500">Score:</span> <span className={`font-bold text-lg ${feedbackModal.score >= 80 ? 'text-emerald-600' : feedbackModal.score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{feedbackModal.score || 0}/100</span></div>
                  <div><span className="text-gray-500">File Submitted:</span> <span className="font-semibold">{feedbackModal.submission_file || '—'}</span></div>
                </div>
              </div>

              <div className="border border-indigo-100 rounded-xl p-5 bg-indigo-50">
                <h3 className="font-bold text-indigo-800 mb-3 flex items-center gap-2">🤖 AI Assessment Review</h3>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{sanitizeReview(feedbackModal.ai_summary)}</p>
              </div>

              <div className="border border-gray-200 rounded-xl p-5">
                <h3 className="font-bold text-gray-800 mb-3">📊 Performance Overview</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Content Relevance', max: 30, score: Math.round((feedbackModal.score || 0) * 0.30) },
                    { label: 'Completeness', max: 25, score: Math.round((feedbackModal.score || 0) * 0.25) },
                    { label: 'Quality & Accuracy', max: 25, score: Math.round((feedbackModal.score || 0) * 0.25) },
                    { label: 'Authenticity', max: 20, score: Math.round((feedbackModal.score || 0) * 0.20) },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>{item.label}</span>
                        <span className="font-semibold">{item.score}/{item.max}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            (item.score / item.max) >= 0.8 ? 'bg-emerald-500' :
                            (item.score / item.max) >= 0.6 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${(item.score / item.max) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {feedbackModal.score < 60 && (
                <div className="border border-red-200 rounded-xl p-4 bg-red-50">
                  <h3 className="font-bold text-red-700 mb-2">⚠️ Areas Requiring Attention</h3>
                  <p className="text-sm text-red-700">This submission scored below 60. Please review the feedback above, revisit the assessment material, and resubmit for a better evaluation.</p>
                </div>
              )}

              <p className="text-xs text-gray-400 text-center">Generated by LMS AI Review System · {new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

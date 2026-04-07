import { useState, useEffect, useRef } from 'react';
import api from '../../api/client';
import BackButton from '../../components/shared/BackButton';
import {
  Users, Bell, BookOpen, CheckCircle, Check, Send, Loader2,
  FileText, ExternalLink, ClipboardList, Upload, Trash2, Search, Plus, FolderOpen, GraduationCap, Star, Clock, Link, AlertTriangle, X
} from 'lucide-react';

const roleLabel = { new_joiner: 'New Joiner', employee: 'Employee' };

function ConfirmModal({ open, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 overflow-hidden">
        <div className="p-6 text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Delete</h3>
          <p className="text-sm text-gray-500">{message}</p>
        </div>
        <div className="flex border-t border-gray-100">
          <button onClick={onCancel}
            className="flex-1 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 border-l border-gray-100 transition-colors">
            Yes, Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TrainerDashboard() {
  const [tab, setTab] = useState('learners');
  const [confirmDelete, setConfirmDelete] = useState({ open: false, message: '', action: null });
  const [learners, setLearners] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [assessmentsList, setAssessmentsList] = useState([]);

  // Assessment bank (API-backed)
  const [bank, setBank] = useState([]);
  const [bankSearch, setBankSearch] = useState('');
  const [uploadingBank, setUploadingBank] = useState(false);
  const [newAssessName, setNewAssessName] = useState('');
  const [newAssessDifficulty, setNewAssessDifficulty] = useState('Beginner');
  const [newAssessType, setNewAssessType] = useState('Word');
  const bankFileRef = useRef();

  // SME kit (API-backed)
  const [smeKit, setSmeKit] = useState([]);
  const [smeUploadName, setSmeUploadName] = useState('');
  const [smeUploadCategory, setSmeUploadCategory] = useState('Style Guide');
  const smeFileRef = useRef();

  // Course bank (API-backed)
  const [courseBank, setCourseBank] = useState([]);
  const [courseSearch2, setCourseSearch2] = useState('');
  const [addingCourse, setAddingCourse] = useState(false);
  const [newCourse, setNewCourse] = useState({
    title: '', provider: '', duration: '', rating: '', free: true, category: 'Editing Skills', tag: 'Gap-Fill', link: '',
  });

  // Assignment modals
  const [assignMode, setAssignMode] = useState(null);
  const [selectedCourseIds, setSelectedCourseIds] = useState(new Set());
  const [courseSearch, setCourseSearch] = useState('');
  const [courseNote, setCourseNote] = useState('');
  const [selectedAssessIds, setSelectedAssessIds] = useState(new Set());
  const [assessSearch, setAssessSearch] = useState('');
  const [assessNote, setAssessNote] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleCourse = (id) => {
    setSelectedCourseIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAssess = (id) => {
    setSelectedAssessIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // AI recommendations
  const [aiCourseRecs, setAiCourseRecs] = useState([]);
  const [aiAssessRecs, setAiAssessRecs] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  const fetchAiRecs = async (learnerId) => {
    setLoadingRecs(true);
    setAiCourseRecs([]);
    setAiAssessRecs([]);
    try {
      const [cr, ar] = await Promise.all([
        api.get(`/ai/recommend/courses?user_id=${learnerId}`).catch(() => ({ recommendations: [] })),
        api.get(`/ai/recommend/assessments?user_id=${learnerId}`).catch(() => ({ recommendations: [] })),
      ]);
      setAiCourseRecs(cr.recommendations || []);
      setAiAssessRecs(ar.recommendations || []);
    } catch { }
    setLoadingRecs(false);
  };

  const load = () => {
    api.get('/courses/learners').then(setLearners).catch(() => {});
    api.get('/courses/notifications').then(setNotifications).catch(() => {});
    api.get('/courses/completions/all').then(setCompletions).catch(() => {});
    api.get('/assessments/all').then(setAssessmentsList).catch(() => {});
    api.get('/banks/assessments').then(setBank).catch(() => {});
    api.get('/banks/smekit').then(setSmeKit).catch(() => {});
    api.get('/banks/courses').then(setCourseBank).catch(() => {});
  };

  useEffect(load, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const openAssign = (learnerId, type) => {
    setAssignMode({ learnerId, type });
    setSelectedCourseIds(new Set()); setCourseNote(''); setCourseSearch('');
    setSelectedAssessIds(new Set()); setAssessNote(''); setAssessSearch('');
    // Fetch AI recommendations for employees
    const learner = learners.find((l) => l.id === learnerId);
    if (learner && learner.role === 'employee') {
      fetchAiRecs(learnerId);
    } else {
      setAiCourseRecs([]); setAiAssessRecs([]);
    }
  };

  const handleAssignCourse = async () => {
    if (selectedCourseIds.size === 0) return;
    setSaving(true);
    try {
      for (const cid of selectedCourseIds) {
        const course = courseBank.find((c) => c.id === cid);
        if (!course) continue;
        await api.post('/courses/assign', {
          user_id: assignMode.learnerId, course_id: course.id,
          course_title: course.title, note: courseNote || null,
        });
      }
      setAssignMode(null);
      load();
    } catch (err) { console.error(err.message); }
    finally { setSaving(false); }
  };

  const handleAssignAssessment = async () => {
    if (selectedAssessIds.size === 0) return;
    setSaving(true);
    try {
      for (const aid of selectedAssessIds) {
        const item = bank.find((a) => a.id === aid);
        if (!item) continue;
        await api.post('/assessments/assign', {
          user_id: assignMode.learnerId, assessment_name: item.name,
          assessment_bank_id: item.id,
          assessment_type: 'full', note: assessNote || null,
        });
      }
      setAssignMode(null);
      load();
    } catch (err) { console.error(err.message); }
    finally { setSaving(false); }
  };

  const markRead = async (id) => {
    await api.post(`/courses/notifications/${id}/read`);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  // Assessment bank management (API)
  const addToBank = async () => {
    if (!newAssessName.trim()) return;
    const fd = new FormData();
    fd.append('name', newAssessName.trim());
    fd.append('difficulty', newAssessDifficulty);
    fd.append('file_type', newAssessType);
    if (bankFileRef.current?.files?.[0]) fd.append('file', bankFileRef.current.files[0]);
    try {
      await api.upload('/banks/assessments', fd);
      setNewAssessName(''); setUploadingBank(false);
      if (bankFileRef.current) bankFileRef.current.value = '';
      api.get('/banks/assessments').then(setBank);
    } catch (e) { console.error(e.message); }
  };

  const removeFromBank = (id) => {
    setConfirmDelete({
      open: true,
      message: 'Are you sure you want to delete this assessment from the bank?',
      action: async () => {
        await api.delete(`/banks/assessments/${id}`);
        setBank((prev) => prev.filter((a) => a.id !== id));
        setConfirmDelete({ open: false, message: '', action: null });
      },
    });
  };

  // SME kit management (API)
  const addSmeFile = async () => {
    if (!smeUploadName.trim()) return;
    const fd = new FormData();
    fd.append('name', smeUploadName.trim());
    fd.append('category', smeUploadCategory);
    fd.append('file_type', 'PDF');
    if (smeFileRef.current?.files?.[0]) fd.append('file', smeFileRef.current.files[0]);
    try {
      await api.upload('/banks/smekit', fd);
      setSmeUploadName('');
      if (smeFileRef.current) smeFileRef.current.value = '';
      api.get('/banks/smekit').then(setSmeKit);
    } catch (e) { console.error(e.message); }
  };

  const removeSmeFile = (id) => {
    setConfirmDelete({
      open: true,
      message: 'Are you sure you want to delete this SME Kit file?',
      action: async () => {
        await api.delete(`/banks/smekit/${id}`);
        setSmeKit((prev) => prev.filter((f) => f.id !== id));
        setConfirmDelete({ open: false, message: '', action: null });
      },
    });
  };

  const filteredBank = bank.filter((a) =>
    a.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

  const filteredCoursesForAssign = courseBank.filter((c) =>
    c.title.toLowerCase().includes(courseSearch.toLowerCase())
  );

  const filteredCourseBank = courseBank.filter((c) =>
    c.title.toLowerCase().includes(courseSearch2.toLowerCase())
  );

  const addCourseToBank = async () => {
    if (!newCourse.title.trim()) return;
    try {
      await api.post('/banks/courses', { ...newCourse, rating: newCourse.rating || '0' });
      setNewCourse({ title: '', provider: '', duration: '', rating: '', free: true, category: 'Editing Skills', tag: 'Gap-Fill', link: '' });
      setAddingCourse(false);
      api.get('/banks/courses').then(setCourseBank);
    } catch (e) { console.error(e.message); }
  };

  const removeCourseFromBank = (id) => {
    setConfirmDelete({
      open: true,
      message: 'Are you sure you want to delete this course from the bank?',
      action: async () => {
        await api.delete(`/banks/courses/${id}`);
        setCourseBank((prev) => prev.filter((c) => c.id !== id));
        setConfirmDelete({ open: false, message: '', action: null });
      },
    });
  };

  const filteredBankForAssign = bank.filter((a) =>
    a.name.toLowerCase().includes(assessSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <ConfirmModal
        open={confirmDelete.open}
        message={confirmDelete.message}
        onConfirm={() => confirmDelete.action?.()}
        onCancel={() => setConfirmDelete({ open: false, message: '', action: null })}
      />

      <BackButton to="/login" label="Sign Out" />

      <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-1">Trainer Dashboard</h1>
        <p className="text-amber-100 text-sm">Manage learners, assign assessments & courses, track completions.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {[
          { id: 'learners', label: 'Learners', icon: Users },
          { id: 'notifications', label: `Notifications${unreadCount ? ` (${unreadCount})` : ''}`, icon: Bell },
          { id: 'completions', label: 'Completions', icon: CheckCircle },
          { id: 'assessments', label: 'Assessments', icon: ClipboardList },
          { id: 'bank', label: 'Assessment Bank', icon: FolderOpen },
          { id: 'coursebank', label: 'Course Bank', icon: GraduationCap },
          { id: 'smekit', label: 'SME Kit', icon: BookOpen },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium flex-1 justify-center transition-colors whitespace-nowrap ${
              tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* ===== LEARNERS TAB ===== */}
      {tab === 'learners' && (
        <div className="space-y-3">
          {learners.map((l) => (
            <div key={l.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700">
                    {l.name.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{l.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        l.role === 'new_joiner' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
                      }`}>{roleLabel[l.role]}</span>
                      <span className="text-xs text-gray-400">{l.department}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-center px-3">
                    <p className="text-lg font-bold text-gray-900">{l.courses_assigned}</p>
                    <p className="text-xs text-gray-400">Assigned</p>
                  </div>
                  <div className="text-center px-3">
                    <p className="text-lg font-bold text-emerald-600">{l.courses_completed}</p>
                    <p className="text-xs text-gray-400">Completed</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openAssign(l.id, 'assessment')}
                      className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 text-xs font-medium rounded-lg hover:bg-amber-100">
                      <FileText className="w-3.5 h-3.5" /> Assign Assessment
                    </button>
                    <button onClick={() => openAssign(l.id, 'course')}
                      className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700">
                      <Send className="w-3.5 h-3.5" /> Assign Course
                    </button>
                  </div>
                </div>
              </div>

              {/* Assign Course Form */}
              {assignMode?.learnerId === l.id && assignMode.type === 'course' && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">Assign Courses to {l.name}</h3>
                    {selectedCourseIds.size > 0 && (
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{selectedCourseIds.size} selected</span>
                    )}
                  </div>

                  {/* AI Recommendations for employees */}
                  {l.role === 'employee' && aiCourseRecs.length > 0 && (
                    <div className="mb-3 p-3 bg-violet-50 border border-violet-200 rounded-lg">
                      <p className="text-xs font-semibold text-violet-700 mb-2 flex items-center gap-1">
                        <span className="w-4 h-4 bg-violet-200 rounded-full flex items-center justify-center text-[10px] font-bold">AI</span>
                        AI Recommended from Course Bank
                      </p>
                      <div className="space-y-1.5">
                        {aiCourseRecs.map((r) => {
                          const sel = selectedCourseIds.has(r.course_id);
                          return (
                            <div key={r.course_id} onClick={() => toggleCourse(r.course_id)}
                              className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                                sel ? 'bg-violet-100 border-violet-400 ring-1 ring-violet-200' : 'bg-white border-violet-100 hover:border-violet-300'
                              }`}>
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                                sel ? 'bg-violet-600 border-violet-600' : 'border-gray-300'
                              }`}>
                                {sel && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-900">{r.title}</p>
                                <p className="text-xs text-gray-400">{r.provider} · {r.category} · {r.duration}{r.rating ? ` · ★${r.rating}` : ''}</p>
                                <p className="text-xs text-violet-600 mt-0.5">{r.reason}</p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {r.free ? <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded font-medium">Free</span>
                                  : <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-medium">Paid</span>}
                                {r.link && <a href={r.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                                  className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded font-medium hover:bg-indigo-100">Link</a>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {l.role === 'employee' && loadingRecs && <Loader2 className="w-4 h-4 animate-spin text-violet-500 mb-3" />}

                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input placeholder="Search course bank..." value={courseSearch} onChange={(e) => setCourseSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-200" />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 mb-3">
                    {filteredCoursesForAssign.map((c) => {
                      const sel = selectedCourseIds.has(c.id);
                      return (
                        <div key={c.id} onClick={() => toggleCourse(c.id)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                            sel ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-200' : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}>
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                            sel ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
                          }`}>
                            {sel && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate">{c.title}</p>
                            <p className="text-xs text-gray-400">{c.provider} · {c.category} · {c.tag}</p>
                          </div>
                          {c.free ? <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded font-medium shrink-0">Free</span>
                            : <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-medium shrink-0">Paid</span>}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-3">
                    <input value={courseNote} onChange={(e) => setCourseNote(e.target.value)}
                      placeholder="Note (optional)"
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-200" />
                    <button disabled={selectedCourseIds.size === 0 || saving} onClick={handleAssignCourse}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 shrink-0">
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Assign {selectedCourseIds.size > 1 ? `(${selectedCourseIds.size})` : ''}
                    </button>
                    <button onClick={() => setAssignMode(null)} className="px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg shrink-0">Cancel</button>
                  </div>
                </div>
              )}

              {/* Assign Assessment Form */}
              {assignMode?.learnerId === l.id && assignMode.type === 'assessment' && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">Assign Assessments to {l.name}</h3>
                    {selectedAssessIds.size > 0 && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{selectedAssessIds.size} selected</span>
                    )}
                  </div>

                  {/* AI Recommendations for employees */}
                  {l.role === 'employee' && aiAssessRecs.length > 0 && (
                    <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1">
                        <span className="w-4 h-4 bg-amber-200 rounded-full flex items-center justify-center text-[10px] font-bold">AI</span>
                        AI Recommended
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {aiAssessRecs.map((r) => {
                          const sel = selectedAssessIds.has(r.assessment_id);
                          return (
                            <button key={r.assessment_id} onClick={() => toggleAssess(r.assessment_id)}
                              className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-all ${
                                sel ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-amber-700 border-amber-200 hover:border-amber-400'
                              }`}>
                              {sel && '✓ '}{r.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {l.role === 'employee' && loadingRecs && <Loader2 className="w-4 h-4 animate-spin text-amber-500 mb-3" />}

                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input placeholder="Search assessment bank..." value={assessSearch} onChange={(e) => setAssessSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-200" />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 mb-3">
                    {filteredBankForAssign.map((a) => {
                      const sel = selectedAssessIds.has(a.id);
                      return (
                        <div key={a.id} onClick={() => toggleAssess(a.id)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                            sel ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-200' : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}>
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                            sel ? 'bg-amber-600 border-amber-600' : 'border-gray-300'
                          }`}>
                            {sel && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate">{a.name}</p>
                            <p className="text-xs text-gray-400">{a.difficulty} · {a.file_type}</p>
                          </div>
                          {a.file_path && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded font-medium shrink-0">Has File</span>}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-3">
                    <input value={assessNote} onChange={(e) => setAssessNote(e.target.value)}
                      placeholder="Note (optional)"
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-200" />
                    <button disabled={selectedAssessIds.size === 0 || saving} onClick={handleAssignAssessment}
                      className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 shrink-0">
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                      Assign {selectedAssessIds.size > 1 ? `(${selectedAssessIds.size})` : ''}
                    </button>
                    <button onClick={() => setAssignMode(null)} className="px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg shrink-0">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {learners.length === 0 && <p className="text-center text-gray-400 py-8">No learners found.</p>}
        </div>
      )}

      {/* ===== NOTIFICATIONS TAB ===== */}
      {tab === 'notifications' && (
        <div className="space-y-2">
          {notifications.length === 0 && <p className="text-center text-gray-400 py-8">No notifications yet.</p>}
          {notifications.map((n) => (
            <div key={n.id} className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${
              n.read ? 'bg-white border-gray-200' : 'bg-indigo-50 border-indigo-200'
            }`}>
              <div className={`p-2 rounded-lg shrink-0 ${
                n.type === 'course_complete' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
              }`}>
                {n.type === 'course_complete' ? <CheckCircle className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{n.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
              </div>
              {!n.read && (
                <button onClick={() => markRead(n.id)} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium shrink-0">Mark read</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ===== COMPLETIONS TAB ===== */}
      {tab === 'completions' && (
        <div className="space-y-3">
          {completions.map((c) => {
            const cRole = c.user_role ? roleLabel[c.user_role] || c.user_role : '—';
            return (
              <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{c.user_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        cRole === 'New Joiner' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
                      }`}>{cRole}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        c.status === 'verified' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>{c.status}</span>
                    </div>
                    <p className="text-sm text-gray-600">{c.course_title}</p>
                    <p className="text-xs text-gray-400 mt-1">Completed: {new Date(c.submitted_at).toLocaleDateString()}</p>
                  </div>
                  {c.proof_path && (
                    <a href={`http://localhost:8000${c.proof_path}`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-lg hover:bg-emerald-100 shrink-0">
                      <ExternalLink className="w-3.5 h-3.5" /> View Certificate
                    </a>
                  )}
                </div>
              </div>
            );
          })}
          {completions.length === 0 && <p className="text-center text-gray-400 py-8">No completions yet.</p>}
        </div>
      )}

      {/* ===== ASSESSMENTS TAB (with User Role column) ===== */}
      {tab === 'assessments' && (
        <div className="space-y-3">
          {assessmentsList.map((a) => {
            const learner = learners.find((l) => l.id === a.user_id);
            const userRole = learner ? roleLabel[learner.role] || learner.role : a.user_role || '—';
            return (
              <div key={a.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{a.user_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        userRole === 'New Joiner' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
                      }`}>{userRole}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        a.status === 'reviewed' ? 'bg-emerald-50 text-emerald-700' :
                        a.status === 'submitted' ? 'bg-blue-50 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{a.status}</span>
                    </div>
                    <p className="text-sm text-gray-600">{a.assessment_name}</p>
                    <p className="text-xs text-gray-400 mt-1">Assigned: {new Date(a.assigned_at).toLocaleDateString()}
                      {a.submitted_at && ` • Submitted: ${new Date(a.submitted_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  {a.submission_path && (
                    <a href={`http://localhost:8000${a.submission_path}`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-lg hover:bg-indigo-100 shrink-0">
                      <FileText className="w-3.5 h-3.5" /> View Submission
                    </a>
                  )}
                </div>
                {a.ai_summary && (
                  <div className="mt-3 p-3 bg-violet-50 border border-violet-200 rounded-lg">
                    <p className="text-xs font-semibold text-violet-700 mb-1 flex items-center gap-1">
                      <span className="w-4 h-4 bg-violet-200 rounded-full flex items-center justify-center text-[10px]">AI</span>
                      AI Summary
                    </p>
                    <p className="text-xs text-violet-900 leading-relaxed">{a.ai_summary}</p>
                  </div>
                )}
              </div>
            );
          })}
          {assessmentsList.length === 0 && <p className="text-center text-gray-400 py-8">No assessments assigned yet.</p>}
        </div>
      )}

      {/* ===== ASSESSMENT BANK TAB ===== */}
      {tab === 'bank' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Assessment Bank</h2>
            <button onClick={() => setUploadingBank(!uploadingBank)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700">
              <Upload className="w-4 h-4" /> Upload Assessment
            </button>
          </div>

          {uploadingBank && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-amber-900 mb-3">Add to Assessment Bank</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Assessment Name *</label>
                  <input value={newAssessName} onChange={(e) => setNewAssessName(e.target.value)}
                    placeholder="e.g. Assessment 6 - Advanced Grammar"
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-200" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Upload Document *</label>
                  <input ref={bankFileRef} type="file" accept=".doc,.docx,.xlsx,.xls,.pdf"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-amber-100 file:text-amber-700 hover:file:bg-amber-200" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Difficulty</label>
                  <select value={newAssessDifficulty} onChange={(e) => setNewAssessDifficulty(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white">
                    <option>Beginner</option><option>Intermediate</option><option>Advanced</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">File Type</label>
                  <select value={newAssessType} onChange={(e) => setNewAssessType(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white">
                    <option>Word</option><option>Excel</option><option>PDF</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button disabled={!newAssessName.trim()} onClick={addToBank}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50">
                  <Plus className="w-3.5 h-3.5" /> Add to Bank
                </button>
                <button onClick={() => setUploadingBank(false)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button>
              </div>
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input placeholder="Search assessment bank..." value={bankSearch} onChange={(e) => setBankSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-200" />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Assessment</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Difficulty</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredBank.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{a.name}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        a.difficulty === 'Beginner' ? 'bg-emerald-50 text-emerald-700' :
                        a.difficulty === 'Intermediate' ? 'bg-amber-50 text-amber-700' :
                        'bg-red-50 text-red-700'
                      }`}>{a.difficulty}</span>
                    </td>
                    <td className="px-5 py-3 text-right flex items-center justify-end gap-1.5">
                      {a.file_path ? (
                        <a href={`http://localhost:8000${a.file_path}`} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" /> View
                        </a>
                      ) : (
                        <span className="text-xs text-gray-300 px-1.5">No file</span>
                      )}
                      <button onClick={() => removeFromBank(a.id)} className="relative group text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                        <span className="absolute bottom-full right-0 mb-1.5 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredBank.length === 0 && <p className="text-center text-gray-400 py-8">No assessments in bank.</p>}
          </div>
          <p className="text-xs text-gray-400 text-center">{bank.length} assessments in bank</p>
        </div>
      )}

      {/* ===== COURSE BANK TAB ===== */}
      {tab === 'coursebank' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Course Bank</h2>
            <button onClick={() => setAddingCourse(!addingCourse)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
              <Plus className="w-4 h-4" /> Add Course
            </button>
          </div>

          {addingCourse && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-indigo-900 mb-3">Add New Course</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Course Title *</label>
                  <input value={newCourse.title} onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                    placeholder="e.g. AI-Powered Writing & Editing Tools"
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-200" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Provider / Organization *</label>
                  <input value={newCourse.provider} onChange={(e) => setNewCourse({ ...newCourse, provider: e.target.value })}
                    placeholder="e.g. Coursera, edX, Udemy"
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-200" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Course Link</label>
                  <input value={newCourse.link} onChange={(e) => setNewCourse({ ...newCourse, link: e.target.value })}
                    placeholder="https://www.coursera.org/learn/..."
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-200" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Duration</label>
                  <input value={newCourse.duration} onChange={(e) => setNewCourse({ ...newCourse, duration: e.target.value })}
                    placeholder="e.g. 4 weeks"
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-200" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Rating (out of 5)</label>
                  <input type="number" step="0.1" min="0" max="5" value={newCourse.rating} onChange={(e) => setNewCourse({ ...newCourse, rating: e.target.value })}
                    placeholder="e.g. 4.7"
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-200" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                  <select value={newCourse.category} onChange={(e) => setNewCourse({ ...newCourse, category: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white">
                    <option>Editing Skills</option><option>Soft Skills</option><option>AI Skills</option><option>Tech Skills</option><option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tag</label>
                  <select value={newCourse.tag} onChange={(e) => setNewCourse({ ...newCourse, tag: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white">
                    <option>Gap-Fill</option><option>Growth</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Pricing</label>
                  <select value={newCourse.free ? 'free' : 'paid'} onChange={(e) => setNewCourse({ ...newCourse, free: e.target.value === 'free' })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white">
                    <option value="free">Free</option><option value="paid">Paid</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button disabled={!newCourse.title.trim() || !newCourse.provider.trim()} onClick={addCourseToBank}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  <Plus className="w-3.5 h-3.5" /> Add Course
                </button>
                <button onClick={() => setAddingCourse(false)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button>
              </div>
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input placeholder="Search courses..." value={courseSearch2} onChange={(e) => setCourseSearch2(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-200" />
          </div>

          <div className="space-y-2">
            {filteredCourseBank.map((c) => (
              <div key={c.id} className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between hover:shadow-sm transition-shadow">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.tag === 'Gap-Fill' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>{c.tag}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{c.category}</span>
                    {c.free ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">Free</span>
                      : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Paid</span>}
                  </div>
                  <h3 className="font-medium text-gray-900 text-sm">{c.title}</h3>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                    <span>{c.provider}</span>
                    {c.duration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {c.duration}</span>}
                    {c.rating > 0 && <span className="flex items-center gap-1"><Star className="w-3 h-3" /> {c.rating}</span>}
                    {c.link && <a href={c.link} target="_blank" className="flex items-center gap-1 text-indigo-500 hover:text-indigo-700"><Link className="w-3 h-3" /> Link</a>}
                  </div>
                </div>
                <button onClick={() => removeCourseFromBank(c.id)} className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors ml-3 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {filteredCourseBank.length === 0 && <p className="text-center text-gray-400 py-8">No courses found.</p>}
          </div>
          <p className="text-xs text-gray-400 text-center">{courseBank.length} courses in bank</p>
        </div>
      )}

      {/* ===== SME KIT TAB ===== */}
      {tab === 'smekit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">SME Training Kit</h2>
            <p className="text-xs text-gray-400">{smeKit.length} files</p>
          </div>

          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-indigo-900 mb-3">Upload New File</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">File Name *</label>
                <input value={smeUploadName} onChange={(e) => setSmeUploadName(e.target.value)}
                  placeholder="e.g. Advanced Editing Techniques v2"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-200" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Upload Document *</label>
                <input ref={smeFileRef} type="file" accept=".doc,.docx,.xlsx,.xls,.pdf,.png,.jpg,.jpeg"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                <select value={smeUploadCategory} onChange={(e) => setSmeUploadCategory(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white">
                  <option>Style Guide</option><option>Formatting</option><option>Reference</option><option>Examples</option>
                </select>
              </div>
            </div>
            <button disabled={!smeUploadName.trim()} onClick={addSmeFile}
              className="mt-3 flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              <Upload className="w-3.5 h-3.5" /> Upload File
            </button>
          </div>

          <div className="space-y-2">
            {smeKit.map((f) => (
              <div key={f.id} className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex items-center justify-between hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${
                    f.type === 'PDF' ? 'bg-red-50 text-red-600' :
                    f.type === 'Excel' ? 'bg-emerald-50 text-emerald-600' :
                    'bg-blue-50 text-blue-600'
                  }`}>{f.type}</div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{f.name}</p>
                    <p className="text-xs text-gray-400">{f.size} · {f.category}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {f.file_path ? (
                    <a href={`http://localhost:8000${f.file_path}`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" /> View
                    </a>
                  ) : (
                    <span className="text-xs text-gray-300 px-2">No file</span>
                  )}
                  <button onClick={() => removeSmeFile(f.id)} className="relative group text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                    <span className="absolute bottom-full right-0 mb-1.5 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

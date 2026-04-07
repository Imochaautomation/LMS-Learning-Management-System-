import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import { ToastContainer, useToast } from '../../components/shared/Toast';
import {
  Users, Bell, GraduationCap, Loader2,
  FileText, ExternalLink, Search, Plus, Trash2, Upload,
  Clock, Link, UserPlus, RefreshCw, ChevronRight, Eye, EyeOff, Copy, Pencil, Check, AlertTriangle, X,
  ChevronLeft, CheckSquare, Square, MailCheck
} from 'lucide-react';

const roleLabel = { new_joiner: 'New Joiner', employee: 'Employee' };
const roleBadge = { new_joiner: 'bg-emerald-50 text-emerald-700', employee: 'bg-indigo-50 text-indigo-700' };
const categoryIcon = { 'Style Guide': '📘', 'Formatting': '📋', 'Reference': '📎', 'Examples': '📝' };

const PAGE_SIZE = 6;

function Pagination({ current, total, onChange }) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1 pt-4">
      <button disabled={current <= 1} onClick={() => onChange(current - 1)}
        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
        <ChevronLeft className="w-4 h-4" />
      </button>
      {[...Array(total)].map((_, i) => (
        <button key={i} onClick={() => onChange(i + 1)}
          className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
            current === i + 1 ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'
          }`}>{i + 1}</button>
      ))}
      <button disabled={current >= total} onClick={() => onChange(current + 1)}
        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function ManagerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'learners';
  const [tab, setTab] = useState(initialTab);
  const { toasts, removeToast, toast } = useToast();

  useEffect(() => { const t = searchParams.get('tab'); if (t) setTab(t); }, [searchParams]);

  const [learners, setLearners] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [bank, setBank] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bankSearch, setBankSearch] = useState('');
  const [newAssessName, setNewAssessName] = useState('');
  const [newAssessFile, setNewAssessFile] = useState(null);
  const [uploadingBank, setUploadingBank] = useState(false);
  const [courseBank, setCourseBank] = useState([]);
  const [courseSearch, setCourseSearch] = useState('');
  const [addingCourse, setAddingCourse] = useState(false);
  const [newCourse, setNewCourse] = useState({ title: '', provider: '', duration: '', free: true, category: 'Editing Skills', tag: 'Gap-Fill', link: '' });
  const [smeKit, setSmeKit] = useState([]);
  const [smeUploadName, setSmeUploadName] = useState('');
  const [smeUploadCategory, setSmeUploadCategory] = useState('Style Guide');
  const [smeFile, setSmeFile] = useState(null);
  const [uploadingSme, setUploadingSme] = useState(false);
  const [teamUsers, setTeamUsers] = useState([]);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'new_joiner', department: '' });
  const [creatingUser, setCreatingUser] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const [visiblePwd, setVisiblePwd] = useState({});
  const [copied, setCopied] = useState(null);
  const [editTeamModal, setEditTeamModal] = useState(null);
  const [editTeamForm, setEditTeamForm] = useState({});
  const [deleteTeamModal, setDeleteTeamModal] = useState(null);

  // Pagination states
  const [learnerPage, setLearnerPage] = useState(1);
  const [notifPage, setNotifPage] = useState(1);
  const [bankPage, setBankPage] = useState(1);
  const [teamPage, setTeamPage] = useState(1);
  const [smePage, setSmePage] = useState(1);

  // Notification multi-select
  const [selectedNotifs, setSelectedNotifs] = useState([]);

  // Multi-select for Assessment Bank & SME Kit
  const [selectedBank, setSelectedBank] = useState([]);
  const [selectedSme, setSelectedSme] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/admin/users').then((all) => {
        const myTeam = all.filter((u) => u.manager_id === user?.id && (u.role === 'new_joiner' || u.role === 'employee'));
        setLearners(myTeam); setTeamUsers(myTeam);
      }).catch(() => { setLearners([]); setTeamUsers([]); }),
      api.get('/notifications').then(setNotifications).catch(() => setNotifications([])),
      api.get('/banks/assessments').then(setBank).catch(() => {}),
      api.get('/banks/courses').then(setCourseBank).catch(() => {}),
      api.get('/banks/sme-kit').then(setSmeKit).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [user]);

  const filteredBank = bank.filter((a) => a.name.toLowerCase().includes(bankSearch.toLowerCase()));
  const filteredCourses = courseBank.filter((c) => c.title.toLowerCase().includes(courseSearch.toLowerCase()));
  const newJoiners = learners.filter((l) => l.role === 'new_joiner');
  const employees = learners.filter((l) => l.role === 'employee');

  // Pagination helpers
  const paginate = (arr, page) => arr.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = (arr) => Math.max(1, Math.ceil(arr.length / PAGE_SIZE));

  const addToBank = async () => {
    if (!newAssessName.trim()) { toast.warning('Please enter an assessment name.'); return; }
    if (!newAssessFile) { toast.warning('Please attach a file for the assessment.'); return; }
    try {
      const fd = new FormData(); fd.append('name', newAssessName); fd.append('difficulty', 'Intermediate'); fd.append('file_type', newAssessFile?.name?.split('.').pop()?.toUpperCase() || 'Word');
      if (newAssessFile) fd.append('file', newAssessFile);
      const res = await api.upload('/banks/assessments', fd);
      setBank((p) => [...p, res]);
      toast.success(`Assessment "${newAssessName}" uploaded successfully!`);
    } catch (e) { toast.error(`Failed to upload assessment: ${e.message}`); }
    setNewAssessName(''); setNewAssessFile(null); setUploadingBank(false);
  };
  const addCourse = async () => {
    if (!newCourse.title.trim()) { toast.warning('Please enter a course title.'); return; }
    try {
      const res = await api.post('/banks/courses', newCourse);
      setCourseBank((p) => [...p, res]);
      toast.success(`Course "${newCourse.title}" added!`);
    } catch (e) { toast.error(`Failed to add course: ${e.message}`); }
    setNewCourse({ title: '', provider: '', duration: '', free: true, category: 'Editing Skills', tag: 'Gap-Fill', link: '' }); setAddingCourse(false);
  };
  const addSmeFile = async () => {
    if (!smeUploadName.trim()) { toast.warning('Please enter a file name.'); return; }
    if (!smeFile) { toast.warning('Please attach a file.'); return; }
    try {
      const fd = new FormData(); fd.append('name', smeUploadName); fd.append('category', smeUploadCategory); fd.append('file_type', smeFile?.name?.split('.').pop()?.toUpperCase() || 'PDF');
      if (smeFile) fd.append('file', smeFile);
      const res = await api.upload('/banks/sme-kit', fd);
      setSmeKit((p) => [...p, res]);
      toast.success(`SME file "${smeUploadName}" uploaded!`);
    } catch (e) { toast.error(`Failed to upload SME file: ${e.message}`); }
    setSmeUploadName(''); setSmeFile(null); setUploadingSme(false);
  };
  const generatePwd = () => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$!'; let p = ''; for (let i = 0; i < 10; i++) p += c[Math.floor(Math.random() * c.length)]; setUserForm((f) => ({ ...f, password: p })); };

  const createTeamUser = async (e) => {
    e.preventDefault(); setCreatingUser(true);
    try {
      await api.post('/admin/users', { ...userForm, manager_id: user.id });
      setShowCreateUser(false); setUserForm({ name: '', email: '', password: '', role: 'new_joiner', department: '' });
      const all = await api.get('/admin/users');
      const myTeam = all.filter((u) => u.manager_id === user?.id && (u.role === 'new_joiner' || u.role === 'employee'));
      setLearners(myTeam); setTeamUsers(myTeam);
      toast.success(`Account created for "${userForm.name}"!`);
    } catch (err) { toast.error(`Failed to create account: ${err.message}`); }
    setCreatingUser(false);
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    try {
      if (deleteModal.type === 'bank') { await api.del(`/banks/assessments/${deleteModal.id}`); setBank((p) => p.filter((a) => a.id !== deleteModal.id)); }
      if (deleteModal.type === 'course') { await api.del(`/banks/courses/${deleteModal.id}`); setCourseBank((p) => p.filter((c) => c.id !== deleteModal.id)); }
      if (deleteModal.type === 'sme') { await api.del(`/banks/sme-kit/${deleteModal.id}`); setSmeKit((p) => p.filter((f) => f.id !== deleteModal.id)); }
      toast.success(`"${deleteModal.name}" deleted.`);
    } catch (e) { toast.error(`Failed to delete: ${e.message}`); }
    setDeleteModal(null);
  };

  // Multi-select for Assessment Bank
  const toggleBankSelect = (id) => setSelectedBank((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const selectAllBank = () => {
    const visibleIds = paginate(filteredBank, bankPage).map((a) => a.id);
    if (visibleIds.every((id) => selectedBank.includes(id))) setSelectedBank((prev) => prev.filter((id) => !visibleIds.includes(id)));
    else setSelectedBank((prev) => [...new Set([...prev, ...visibleIds])]);
  };
  const bulkDeleteBank = async () => {
    if (selectedBank.length === 0) return;
    try {
      for (const id of selectedBank) { await api.del(`/banks/assessments/${id}`); }
      setBank((prev) => prev.filter((a) => !selectedBank.includes(a.id)));
      toast.success(`${selectedBank.length} assessment(s) deleted.`);
      setSelectedBank([]);
    } catch (e) { toast.error(`Failed to bulk delete: ${e.message}`); }
  };

  // Multi-select for SME Kit
  const toggleSmeSelect = (id) => setSelectedSme((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const selectAllSme = () => {
    const visibleIds = paginate(smeKit, smePage).map((f) => f.id);
    if (visibleIds.every((id) => selectedSme.includes(id))) setSelectedSme((prev) => prev.filter((id) => !visibleIds.includes(id)));
    else setSelectedSme((prev) => [...new Set([...prev, ...visibleIds])]);
  };
  const bulkDeleteSme = async () => {
    if (selectedSme.length === 0) return;
    try {
      for (const id of selectedSme) { await api.del(`/banks/sme-kit/${id}`); }
      setSmeKit((prev) => prev.filter((f) => !selectedSme.includes(f.id)));
      toast.success(`${selectedSme.length} SME file(s) deleted.`);
      setSelectedSme([]);
    } catch (e) { toast.error(`Failed to bulk delete: ${e.message}`); }
  };

  // Notification actions
  const toggleNotifSelect = (id) => setSelectedNotifs((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const selectAllNotifs = () => {
    if (selectedNotifs.length === notifications.length) setSelectedNotifs([]);
    else setSelectedNotifs(notifications.map((n) => n.id));
  };
  const bulkMarkRead = async () => {
    if (selectedNotifs.length === 0) return;
    try {
      await api.post('/notifications/bulk-read', selectedNotifs);
      setNotifications((prev) => prev.map((n) => selectedNotifs.includes(n.id) ? { ...n, read: true } : n));
      toast.success(`${selectedNotifs.length} notifications marked as read.`);
      setSelectedNotifs([]);
    } catch (e) { toast.error('Failed to mark notifications as read.'); }
  };
  const bulkDeleteNotifs = async () => {
    if (selectedNotifs.length === 0) return;
    try {
      await api.post('/notifications/bulk-delete', selectedNotifs);
      setNotifications((prev) => prev.filter((n) => !selectedNotifs.includes(n.id)));
      toast.success(`${selectedNotifs.length} notifications deleted.`);
      setSelectedNotifs([]);
    } catch (e) { toast.error('Failed to delete notifications.'); }
  };

  const tabs = [
    { id: 'learners', label: 'Learners', icon: Users },
    { id: 'notifications', label: 'Notifications', icon: Bell, count: notifications.filter((n) => !n.read).length },
  ];

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-1">Manager Dashboard</h1>
        <p className="text-amber-100 text-sm">Manage your team — {newJoiners.length} new joiners, {employees.length} employees</p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
            {t.count > 0 && <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* LEARNERS */}
      {tab === 'learners' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900">My Team</h2>
          {learners.length === 0 ? (
            <div className="text-center py-12 text-gray-400"><Users className="w-10 h-10 mx-auto mb-3 opacity-50" /><p className="font-medium">No team members yet</p><p className="text-sm mt-1">Go to "Manage Team" to create accounts</p></div>
          ) : (
            <div className="space-y-3">
              {paginate(learners, learnerPage).map((l) => {
                const titles = [{t:'New Learner',x:0,e:'🌱'},{t:'Rising Learner',x:100,e:'📗'},{t:'Active Learner',x:250,e:'⭐'},{t:'Skilled Learner',x:500,e:'🏆'},{t:'Expert Learner',x:900,e:'🧩'},{t:'Champion',x:1400,e:'🌟'}];
                let title = titles[0]; for (const tt of titles) { if (0 >= tt.x) title = tt; }
                const stage = l.role === 'new_joiner' ? 'Spellbook Stage' : 'Courses';
                const bdg = l.role === 'new_joiner' ? 0 : 1;
                const streak = l.role === 'new_joiner' ? 1 : 3;
                return (
                  <div key={l.id} onClick={() => navigate(`/manager/learner/${l.id}`)}
                    className={`bg-gradient-to-r rounded-2xl px-5 py-4 flex items-center justify-between cursor-pointer hover:shadow-md transition-all border ${
                      l.role === 'new_joiner' ? 'from-teal-50 to-emerald-50 border-teal-200 hover:border-teal-400' : 'from-indigo-50 to-purple-50 border-indigo-200 hover:border-indigo-400'
                    }`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white ${l.role === 'new_joiner' ? 'bg-teal-600' : 'bg-indigo-600'}`}>
                        {l.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold text-gray-900">{l.name}</span>
                          <span className="text-xs text-gray-400 font-medium">({roleLabel[l.role]})</span>
                          <span className="text-base">{title.e}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${l.role === 'new_joiner' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>{title.t}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>Last active: Yesterday</span>
                          <span className="flex items-center gap-0.5 text-purple-600 font-bold bg-purple-50 px-1.5 py-0.5 rounded-full">🏅 {bdg} badges</span>
                          <span className="flex items-center gap-0.5 text-orange-600 font-bold bg-orange-50 px-1.5 py-0.5 rounded-full">🔥 {streak}d</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${
                        stage === 'Spellbook Stage' ? 'bg-teal-100 text-teal-700' : 'bg-blue-100 text-blue-700'
                      }`}>{stage}</span>
                      <button onClick={(e) => { e.stopPropagation(); navigate(`/manager/learner/${l.id}`); }}
                        className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50">View</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Pagination current={learnerPage} total={totalPages(learners)} onChange={setLearnerPage} />
        </div>
      )}

      {/* NOTIFICATIONS */}
      {tab === 'notifications' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Notifications</h2>
            {notifications.length > 0 && (
              <div className="flex items-center gap-2">
                <button onClick={selectAllNotifs}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                  {selectedNotifs.length === notifications.length ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                  {selectedNotifs.length === notifications.length ? 'Deselect All' : 'Select All'}
                </button>
                {selectedNotifs.length > 0 && (
                  <>
                    <button onClick={bulkMarkRead}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50">
                      <MailCheck className="w-3.5 h-3.5" /> Mark Read ({selectedNotifs.length})
                    </button>
                    <button onClick={bulkDeleteNotifs}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5" /> Delete ({selectedNotifs.length})
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          {notifications.length === 0 ? <p className="text-center text-gray-400 py-8">No notifications yet.</p> : (
            <>
              {paginate(notifications, notifPage).map((n) => (
                <div key={n.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                  selectedNotifs.includes(n.id) ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' :
                  n.read ? 'bg-white border-gray-100' : 'bg-amber-50 border-amber-100'
                }`}>
                  <button onClick={() => toggleNotifSelect(n.id)} className="shrink-0 p-0.5">
                    {selectedNotifs.includes(n.id)
                      ? <CheckSquare className="w-4.5 h-4.5 text-indigo-600" />
                      : <Square className="w-4.5 h-4.5 text-gray-300 hover:text-gray-500" />}
                  </button>
                  <Bell className={`w-4 h-4 shrink-0 ${n.read ? 'text-gray-400' : 'text-indigo-500'}`} />
                  <p className="text-sm text-gray-700 flex-1">{n.message}</p>
                  <span className="text-xs text-gray-400 shrink-0">{n.created_at?.split('T')[0]}</span>
                </div>
              ))}
              <Pagination current={notifPage} total={totalPages(notifications)} onChange={setNotifPage} />
            </>
          )}
        </div>
      )}

      {/* ASSESSMENT BANK */}
      {tab === 'bank' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-gray-900">Assessment Bank</h2>
            <div className="flex items-center gap-2">
              {selectedBank.length > 0 && (
                <button onClick={bulkDeleteBank}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 font-medium">
                  <Trash2 className="w-3.5 h-3.5" /> Delete ({selectedBank.length})
                </button>
              )}
              <button onClick={() => setUploadingBank(!uploadingBank)} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700"><Upload className="w-4 h-4" /> Upload</button>
            </div>
          </div>
          {uploadingBank && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
              <div className="grid sm:grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Name *</label><input value={newAssessName} onChange={(e) => setNewAssessName(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">File *</label><input type="file" onChange={(e) => setNewAssessFile(e.target.files[0])} className="w-full text-sm" /></div>
              </div>
              <div className="flex gap-2 mt-3"><button disabled={!newAssessName.trim()} onClick={addToBank} className="px-4 py-2 bg-orange-600 text-white text-sm rounded-lg disabled:opacity-50">Add</button><button onClick={() => setUploadingBank(false)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button></div>
            </div>
          )}
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input placeholder="Search..." value={bankSearch} onChange={(e) => setBankSearch(e.target.value)} className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-lg" /></div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b">
                <th className="text-left px-3 py-3">
                  <button onClick={selectAllBank} className="p-0.5">
                    {paginate(filteredBank, bankPage).every((a) => selectedBank.includes(a.id)) && paginate(filteredBank, bankPage).length > 0
                      ? <CheckSquare className="w-4 h-4 text-indigo-600" />
                      : <Square className="w-4 h-4 text-gray-300 hover:text-gray-500" />}
                  </button>
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Assessment</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Action</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">{paginate(filteredBank, bankPage).map((a) => (
                <tr key={a.id} className={`hover:bg-gray-50 ${selectedBank.includes(a.id) ? 'bg-indigo-50' : ''}`}>
                  <td className="px-3 py-3.5">
                    <button onClick={() => toggleBankSelect(a.id)} className="p-0.5">
                      {selectedBank.includes(a.id)
                        ? <CheckSquare className="w-4 h-4 text-indigo-600" />
                        : <Square className="w-4 h-4 text-gray-300 hover:text-gray-500" />}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 font-medium text-gray-900">{a.name}</td>
                  <td className="px-5 py-3.5 text-right flex items-center justify-end gap-1">
                    {a.file_path && <a href={`http://localhost:8000${a.file_path}`} target="_blank" rel="noreferrer" className="px-2.5 py-1 text-xs text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 flex items-center gap-1"><ExternalLink className="w-3 h-3" /> View</a>}
                    <button onClick={() => setDeleteModal({ type: 'bank', id: a.id, name: a.name })} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 text-center">{bank.length} assessments</p>
          <Pagination current={bankPage} total={totalPages(filteredBank)} onChange={setBankPage} />
        </div>
      )}


      {/* SME KIT */}
      {tab === 'smekit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-gray-900">📚 Spellbook — SME Training Kit</h2>
            <div className="flex items-center gap-2">
              {selectedSme.length > 0 && (
                <button onClick={bulkDeleteSme}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 font-medium">
                  <Trash2 className="w-3.5 h-3.5" /> Delete ({selectedSme.length})
                </button>
              )}
              <button onClick={() => setUploadingSme(!uploadingSme)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700"><Upload className="w-4 h-4" /> Upload File</button>
            </div>
          </div>
          {uploadingSme && (
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-5">
              <div className="grid sm:grid-cols-3 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Name *</label><input value={smeUploadName} onChange={(e) => setSmeUploadName(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Category</label><select value={smeUploadCategory} onChange={(e) => setSmeUploadCategory(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white"><option>Style Guide</option><option>Formatting</option><option>Reference</option><option>Examples</option></select></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">File *</label><input type="file" onChange={(e) => setSmeFile(e.target.files[0])} className="w-full text-sm" /></div>
              </div>
              <div className="flex gap-2 mt-3"><button disabled={!smeUploadName.trim()} onClick={addSmeFile} className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg disabled:opacity-50">Add</button><button onClick={() => setUploadingSme(false)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button></div>
            </div>
          )}
          {/* Select all for SME */}
          <div className="flex items-center gap-2">
            <button onClick={selectAllSme}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
              {paginate(smeKit, smePage).every((f) => selectedSme.includes(f.id)) && paginate(smeKit, smePage).length > 0
                ? <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                : <Square className="w-3.5 h-3.5" />}
              {paginate(smeKit, smePage).every((f) => selectedSme.includes(f.id)) && paginate(smeKit, smePage).length > 0 ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="space-y-2">{paginate(smeKit, smePage).map((f) => (
            <div key={f.id} className={`bg-white border rounded-xl px-5 py-3.5 flex items-center justify-between hover:shadow-sm ${selectedSme.includes(f.id) ? 'border-indigo-200 bg-indigo-50 ring-1 ring-indigo-200' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <button onClick={() => toggleSmeSelect(f.id)} className="p-0.5 shrink-0">
                  {selectedSme.includes(f.id)
                    ? <CheckSquare className="w-4 h-4 text-indigo-600" />
                    : <Square className="w-4 h-4 text-gray-300 hover:text-gray-500" />}
                </button>
                <span className="text-lg">{categoryIcon[f.category] || '📄'}</span>
                <div><p className="font-medium text-gray-900 text-sm">{f.name}</p><div className="flex items-center gap-2 mt-0.5"><span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{f.category}</span><span className="text-xs text-gray-400">{f.type} · {f.size}</span></div></div>
              </div>
              <div className="flex items-center gap-1">
                {f.file && <a href="#" className="px-2.5 py-1 text-xs text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 flex items-center gap-1"><ExternalLink className="w-3 h-3" /> View</a>}
                <button onClick={() => setDeleteModal({ type: 'sme', id: f.id, name: f.name })} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}</div>
          <p className="text-xs text-gray-400 text-center">{smeKit.length} files</p>
          <Pagination current={smePage} total={totalPages(smeKit)} onChange={setSmePage} />
        </div>
      )}

      {/* MANAGE TEAM */}
      {tab === 'team' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-gray-900">Manage Team</h2>
            <button onClick={() => setShowCreateUser(!showCreateUser)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"><UserPlus className="w-4 h-4" /> Create Account</button></div>
          {showCreateUser && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <form onSubmit={createTeamUser} className="grid sm:grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Name *</label><input required value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Email *</label><input required type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Password *</label><div className="flex gap-2"><input required value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-lg" /><button type="button" onClick={generatePwd} className="flex items-center gap-1 px-3 py-2.5 bg-gray-100 text-xs rounded-lg hover:bg-gray-200 shrink-0"><RefreshCw className="w-3.5 h-3.5" /> Gen</button></div></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Role *</label><select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white"><option value="new_joiner">New Joiner</option><option value="employee">Employee</option></select></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Department</label><select value={userForm.department} onChange={(e) => setUserForm({ ...userForm, department: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white"><option value="">Select Department</option><option value="Content">Content</option><option value="Customer Success">Customer Success</option><option value="Engineering">Engineering</option><option value="Finance">Finance</option><option value="Human Resources">Human Resources</option><option value="IT Services">IT Services</option><option value="Product Marketing">Product Marketing</option><option value="Sales">Sales</option><option value="Product">Product</option><option value="Channel Sales">Channel Sales</option><option value="Marketing">Marketing</option><option value="Marketing (Business Development)">Marketing (Business Development)</option><option value="Pre-Sales & Solutioning">Pre-Sales & Solutioning</option></select></div>
                <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowCreateUser(false)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button>
                  <button type="submit" disabled={creatingUser} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg disabled:opacity-50">{creatingUser && <Loader2 className="w-4 h-4 animate-spin" />} Create</button>
                </div>
              </form>
            </div>
          )}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Password</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Role</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Dept</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">{paginate(teamUsers, teamPage).map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{u.name}</td>
                  <td className="px-5 py-3.5 text-gray-500">{u.email}</td>
                  <td className="px-5 py-3.5">
                    {u.plain_password ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-gray-600">{visiblePwd[u.id] ? u.plain_password : '••••••'}</span>
                        <button onClick={() => setVisiblePwd((p) => ({ ...p, [u.id]: !p[u.id] }))} className="p-1 text-gray-400 hover:text-indigo-600 rounded">
                          {visiblePwd[u.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    ) : <span className="text-xs text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5"><span className={`text-xs px-2.5 py-1 rounded-full font-medium ${roleBadge[u.role]}`}>{roleLabel[u.role]}</span></td>
                  <td className="px-5 py-3.5 text-gray-500">{u.department || '—'}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { const txt = `Name: ${u.name}\nEmail: ${u.email}\nPassword: ${u.plain_password || '-'}\nRole: ${roleLabel[u.role]}\nDept: ${u.department || '-'}`; navigator.clipboard.writeText(txt); setCopied(u.id); setTimeout(() => setCopied(null), 2000); }}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Copy credentials">
                        {copied === u.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button onClick={() => { setEditTeamForm({ id: u.id, name: u.name, email: u.email, password: '', role: u.role, department: u.department || '' }); setEditTeamModal(true); }}
                        className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title="Edit user"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteTeamModal({ id: u.id, name: u.name })}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete user"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
            {teamUsers.length === 0 && <p className="text-center text-gray-400 py-6">No team members yet.</p>}
          </div>
          <Pagination current={teamPage} total={totalPages(teamUsers)} onChange={setTeamPage} />

          {/* Edit Team User Modal */}
          {editTeamModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditTeamModal(null)}>
              <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-semibold text-gray-900 mb-4">Edit Team Member</h3>
                <form onSubmit={(e) => { e.preventDefault(); setTeamUsers((prev) => prev.map((u) => u.id === editTeamForm.id ? { ...u, name: editTeamForm.name, email: editTeamForm.email, role: editTeamForm.role, department: editTeamForm.department } : u)); setEditTeamModal(null); toast.success('Team member updated.'); }} className="space-y-3">
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Name</label><input value={editTeamForm.name} onChange={(e) => setEditTeamForm({ ...editTeamForm, name: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl" /></div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Email</label><input value={editTeamForm.email} onChange={(e) => setEditTeamForm({ ...editTeamForm, email: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl" /></div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">New Password (leave blank to keep)</label><input value={editTeamForm.password} onChange={(e) => setEditTeamForm({ ...editTeamForm, password: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl" /></div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Role</label><select value={editTeamForm.role} onChange={(e) => setEditTeamForm({ ...editTeamForm, role: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white"><option value="new_joiner">New Joiner</option><option value="employee">Employee</option></select></div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Department</label><select value={editTeamForm.department} onChange={(e) => setEditTeamForm({ ...editTeamForm, department: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white"><option value="">Select Department</option><option value="Content">Content</option><option value="Customer Success">Customer Success</option><option value="Engineering">Engineering</option><option value="Finance">Finance</option><option value="Human Resources">Human Resources</option><option value="IT Services">IT Services</option><option value="Product Marketing">Product Marketing</option><option value="Sales">Sales</option><option value="Product">Product</option><option value="Channel Sales">Channel Sales</option><option value="Marketing">Marketing</option><option value="Marketing (Business Development)">Marketing (Business Development)</option><option value="Pre-Sales & Solutioning">Pre-Sales & Solutioning</option></select></div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={() => setEditTeamModal(null)} className="px-4 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">Cancel</button>
                    <button type="submit" className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700">Save</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Delete Team User Modal */}
          {deleteTeamModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setDeleteTeamModal(null)}>
              <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
                  <div><h3 className="font-semibold text-gray-900">Delete Team Member</h3><p className="text-sm text-gray-500">This cannot be undone.</p></div>
                </div>
                <p className="text-sm text-gray-600 mb-6">Delete <strong>{deleteTeamModal.name}</strong> from your team?</p>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setDeleteTeamModal(null)} className="px-4 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">Cancel</button>
                  <button onClick={() => { setTeamUsers((p) => p.filter((u) => u.id !== deleteTeamModal.id)); setLearners((p) => p.filter((u) => u.id !== deleteTeamModal.id)); setDeleteTeamModal(null); toast.success(`${deleteTeamModal.name} removed from team.`); }}
                    className="px-4 py-2.5 text-sm text-white bg-red-600 rounded-xl hover:bg-red-700">Delete</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setDeleteModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-2">Confirm Delete</h3>
            <p className="text-sm text-gray-600 mb-4">Are you sure you want to delete <strong>{deleteModal.name}</strong>?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteModal(null)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">Cancel</button>
              <button onClick={confirmDelete} className="px-4 py-2 text-sm text-white bg-red-600 rounded-xl hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import api from '../../api/client';
import BackButton from '../../components/shared/BackButton';
import {
  Video, Plus, Users, BarChart2, Sparkles, CheckCircle, XCircle,
  Loader2, Search, Calendar, AlertTriangle, Clock, X, ChevronDown,
  FolderOpen, FileVideo, RefreshCw
} from 'lucide-react';

const ORANGE = '#F05A28';
const NAVY = '#1E1040';

const STATUS_STYLES = {
  completed: { label: 'Completed', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  urgent:    { label: 'Urgent',    cls: 'text-amber-700 bg-amber-50 border-amber-200' },
  overdue:   { label: 'Overdue',   cls: 'text-red-600 bg-red-50 border-red-200' },
  assigned:  { label: 'Assigned',  cls: 'text-blue-700 bg-blue-50 border-blue-200' },
};

function formatFileSize(bytes) {
  if (bytes == null) return 'Size unavailable';
  const megabytes = Number(bytes) / (1024 * 1024);
  return `${megabytes.toFixed(1)} MB`;
}

export default function ManagerVideoAssignments() {
  const [tab, setTab] = useState('library');
  const [videos, setVideos] = useState([]);
  const [stats, setStats] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Add video form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newVideo, setNewVideo] = useState({ title: '', description: '', video_url: '' });
  const [addLoading, setAddLoading] = useState(false);
  const [showSharePointBrowser, setShowSharePointBrowser] = useState(false);
  const [sharePointVideos, setSharePointVideos] = useState([]);
  const [sharePointLoading, setSharePointLoading] = useState(false);
  const [sharePointError, setSharePointError] = useState('');
  const [sharePointSearch, setSharePointSearch] = useState('');

  // Quiz generation
  const [generatingFor, setGeneratingFor] = useState(null);

  // Assign form
  const [assignVideoId, setAssignVideoId] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [dueDate, setDueDate] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  // Progress filter
  const [statusFilter, setStatusFilter] = useState('all');
  const [progressSearch, setProgressSearch] = useState('');

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [vids, st, us] = await Promise.all([
        api.get('/video-assignments/videos'),
        api.get('/video-assignments/stats'),
        api.get('/video-assignments/users-list'),
      ]);
      setVideos(vids || []);
      setStats(st || []);
      setUsers(us || []);
    } catch {
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const loadSharePointVideos = async () => {
    setShowSharePointBrowser(true);
    setSharePointLoading(true);
    setSharePointError('');
    try {
      const result = await api.get('/video-assignments/sharepoint/videos');
      setSharePointVideos(result.videos || []);
    } catch (err) {
      setSharePointVideos([]);
      setSharePointError(err.message || 'Unable to load the SharePoint library.');
    } finally {
      setSharePointLoading(false);
    }
  };

  const selectSharePointVideo = (video) => {
    setNewVideo({
      title: video.title || video.name || '',
      description: '',
      video_url: video.web_url || '',
    });
    setShowSharePointBrowser(false);
    setShowAddForm(true);
  };

  const handleAddVideo = async (e) => {
    e.preventDefault();
    if (!newVideo.title.trim() || !newVideo.video_url.trim()) return;
    setAddLoading(true);
    try {
      await api.post('/video-assignments/videos', newVideo);
      showToast('Video added');
      setNewVideo({ title: '', description: '', video_url: '' });
      setShowAddForm(false);
      fetchAll();
    } catch (err) {
      showToast(err.message || 'Failed to add video', 'error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleGenerateQuiz = async (videoId) => {
    setGeneratingFor(videoId);
    try {
      const res = await api.post(`/video-assignments/videos/${videoId}/generate-quiz`, {});
      showToast(`Quiz generated — ${res.question_count} questions`);
      fetchAll();
    } catch (err) {
      showToast(err.message || 'Quiz generation failed', 'error');
    } finally {
      setGeneratingFor(null);
    }
  };

  const toggleUser = (uid) => {
    setSelectedUsers(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!assignVideoId || selectedUsers.length === 0) return;
    setAssignLoading(true);
    try {
      const res = await api.post('/video-assignments/assign', {
        video_id: parseInt(assignVideoId),
        user_ids: selectedUsers,
        due_date: dueDate || null,
      });
      showToast(res.message);
      setAssignVideoId('');
      setSelectedUsers([]);
      setDueDate('');
      fetchAll();
    } catch (err) {
      showToast(err.message || 'Assignment failed', 'error');
    } finally {
      setAssignLoading(false);
    }
  };

  const filteredStats = stats.filter(s => {
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchSearch = !progressSearch ||
      s.user_name.toLowerCase().includes(progressSearch.toLowerCase()) ||
      s.video_title.toLowerCase().includes(progressSearch.toLowerCase());
    return matchStatus && matchSearch;
  });

  const filteredUsers = users.filter(u =>
    !userSearch ||
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredSharePointVideos = sharePointVideos.filter(video => {
    const term = sharePointSearch.trim().toLowerCase();
    return !term ||
      (video.name || '').toLowerCase().includes(term) ||
      (video.title || '').toLowerCase().includes(term);
  });

  const summaryStats = {
    total: stats.length,
    completed: stats.filter(s => s.status === 'completed').length,
    overdue: stats.filter(s => s.status === 'overdue').length,
    quizPassed: stats.filter(s => s.quiz_passed).length,
  };

  const TABS = [
    { key: 'library', label: 'Video Library', icon: Video },
    { key: 'assign',  label: 'Assign',         icon: Users },
    { key: 'progress',label: 'Progress Tracker',icon: BarChart2 },
  ];

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-7 h-7 animate-spin" style={{ color: ORANGE }} />
      <span className="ml-3 text-gray-500">Loading...</span>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold
          ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {toast.type === 'error' ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {showSharePointBrowser && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-5xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-gray-100">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-500">SharePoint Library</p>
                <h2 className="text-lg font-bold text-gray-900">Browse training videos</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowSharePointBrowser(false)}
                className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200"
                aria-label="Close SharePoint browser"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-4 border-b border-gray-100 flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="search"
                  value={sharePointSearch}
                  onChange={e => setSharePointSearch(e.target.value)}
                  placeholder="Search videos by file name..."
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={loadSharePointVideos}
                disabled={sharePointLoading}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${sharePointLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {sharePointLoading ? (
                <div className="min-h-64 flex items-center justify-center text-sm text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" style={{ color: ORANGE }} />
                  Loading SharePoint videos...
                </div>
              ) : sharePointError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{sharePointError}</div>
              ) : filteredSharePointVideos.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
                  No matching video files were found in the configured library.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredSharePointVideos.map(video => (
                    <button
                      key={video.drive_item_id}
                      type="button"
                      onClick={() => selectSharePointVideo(video)}
                      className="text-left rounded-xl border border-gray-200 p-4 hover:border-orange-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                          <FileVideo className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate" title={video.name}>{video.title || video.name}</p>
                          <p className="text-xs text-gray-400 mt-1">{formatFileSize(video.size)}</p>
                          {video.last_modified && (
                            <p className="text-xs text-gray-400 mt-0.5">Modified {new Date(video.last_modified).toLocaleDateString()}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <BackButton to="/manager" label="Back to Manager" />

      <div>
        <h1 className="text-xl font-bold text-gray-900">Video Assignments</h1>
        <p className="text-sm text-gray-500 mt-1">Manage training videos and track learner progress.</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Assignments', value: summaryStats.total, cls: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
          { label: 'Completed', value: summaryStats.completed, cls: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
          { label: 'Overdue', value: summaryStats.overdue, cls: 'text-red-600', bg: 'bg-red-50 border-red-200' },
          { label: 'Quiz Passed', value: summaryStats.quizPassed, cls: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 text-center ${s.bg}`}>
            <div className={`text-2xl font-bold ${s.cls}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
              ${tab === t.key ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            style={tab === t.key ? { borderColor: ORANGE, color: ORANGE } : {}}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Video Library ─────────────────────────────────────────── */}
      {tab === 'library' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">{videos.length} video{videos.length !== 1 ? 's' : ''} in library</p>
            <button
              onClick={loadSharePointVideos}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg"
              style={{ background: ORANGE }}
              onMouseEnter={e => e.currentTarget.style.background = '#c2410c'}
              onMouseLeave={e => e.currentTarget.style.background = ORANGE}
            >
              <FolderOpen className="w-4 h-4" />
              Browse SharePoint Library
            </button>
          </div>

          {/* Add video form */}
          {showAddForm && (
            <form onSubmit={handleAddVideo} className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-gray-800 text-sm">Selected SharePoint Video</h3>
                <button type="button" onClick={() => { setShowAddForm(false); setNewVideo({ title: '', description: '', video_url: '' }); }} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
                  <input
                    required
                    value={newVideo.title}
                    onChange={e => setNewVideo(p => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Brand Safety Guidelines"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none"
                    onFocus={e => { e.target.style.borderColor = ORANGE; e.target.style.boxShadow = `0 0 0 2px rgba(240,90,40,0.15)`; }}
                    onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>
                <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <p className="text-xs font-medium text-gray-500">Source</p>
                  <p className="text-sm font-semibold text-gray-800 mt-1 flex items-center gap-1.5">
                    <FolderOpen className="w-4 h-4 text-orange-500" /> SharePoint Library
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description / Topic Context <span className="text-gray-400 font-normal">(helps AI generate better quiz)</span></label>
                <textarea
                  rows={2}
                  value={newVideo.description}
                  onChange={e => setNewVideo(p => ({ ...p, description: e.target.value }))}
                  placeholder="Brief description of what the video covers..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none resize-none"
                  onFocus={e => { e.target.style.borderColor = ORANGE; e.target.style.boxShadow = `0 0 0 2px rgba(240,90,40,0.15)`; }}
                  onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={addLoading}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-60"
                  style={{ background: NAVY }}
                >
                  {addLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Save Video
                </button>
              </div>
            </form>
          )}

          {/* Video table */}
          {videos.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <Video className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No videos yet. Select one from SharePoint to get started.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Video</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Quiz</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {videos.map(v => (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-gray-900 truncate max-w-[260px]">{v.title}</p>
                          {v.description && (
                            <p className="text-xs text-gray-400 truncate max-w-[260px] mt-0.5">{v.description}</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {v.quiz_generated
                            ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                <CheckCircle className="w-3 h-3" /> {v.question_count}Q ready
                              </span>
                            : <span className="text-xs text-gray-400">No quiz</span>
                          }
                        </td>
                        <td className="px-4 py-3.5 text-center text-gray-600">{v.assignment_count}</td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={() => handleGenerateQuiz(v.id)}
                            disabled={generatingFor === v.id}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all disabled:opacity-60"
                            style={{ color: ORANGE, borderColor: ORANGE, background: 'rgba(240,90,40,0.06)' }}
                            onMouseEnter={e => { if (generatingFor !== v.id) { e.currentTarget.style.background = ORANGE; e.currentTarget.style.color = '#fff'; }}}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(240,90,40,0.06)'; e.currentTarget.style.color = ORANGE; }}
                          >
                            {generatingFor === v.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <Sparkles className="w-3 h-3" />
                            }
                            {v.quiz_generated ? 'Re-generate Quiz' : 'Generate Quiz'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Assign ────────────────────────────────────────────────── */}
      {tab === 'assign' && (
        <form onSubmit={handleAssign} className="space-y-5 max-w-2xl">
          {/* Pick video */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Select Video *</label>
            <div className="relative">
              <select
                required
                value={assignVideoId}
                onChange={e => setAssignVideoId(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none appearance-none bg-white"
                onFocus={e => { e.target.style.borderColor = ORANGE; e.target.style.boxShadow = `0 0 0 2px rgba(240,90,40,0.15)`; }}
                onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
              >
                <option value="">— choose a video —</option>
                {videos.map(v => (
                  <option key={v.id} value={v.id}>{v.title} {v.quiz_generated ? '✓' : '(no quiz yet)'}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            {assignVideoId && !videos.find(v => v.id === parseInt(assignVideoId))?.quiz_generated && (
              <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> This video has no quiz yet — learners can still watch but won't get a quiz.
              </p>
            )}
          </div>

          {/* Due date */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Due Date <span className="text-gray-400 font-normal text-xs">(optional)</span>
            </label>
            <div className="relative w-52">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none"
                onFocus={e => { e.target.style.borderColor = ORANGE; e.target.style.boxShadow = `0 0 0 2px rgba(240,90,40,0.15)`; }}
                onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
          </div>

          {/* Pick learners */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Select Learners * <span className="text-gray-400 font-normal text-xs">({selectedUsers.length} selected)</span>
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none"
                onFocus={e => { e.target.style.borderColor = ORANGE; e.target.style.boxShadow = `0 0 0 2px rgba(240,90,40,0.15)`; }}
                onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
            <div className="border border-gray-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto bg-white">
              {filteredUsers.length === 0 ? (
                <p className="text-center py-6 text-sm text-gray-400">No learners found</p>
              ) : (
                filteredUsers.map(u => {
                  const checked = selectedUsers.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-0"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleUser(u.id)}
                        className="w-4 h-4 rounded"
                        style={{ accentColor: ORANGE }}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">{u.name}</p>
                        <p className="text-xs text-gray-400">{u.email} · {u.role === 'new_joiner' ? 'New Joiner' : 'Employee'}</p>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={assignLoading || !assignVideoId || selectedUsers.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-opacity"
            style={{ background: ORANGE }}
          >
            {assignLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
            Assign to {selectedUsers.length} Learner{selectedUsers.length !== 1 ? 's' : ''}
          </button>
        </form>
      )}

      {/* ── Tab: Progress Tracker ──────────────────────────────────────── */}
      {tab === 'progress' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search learner or video..."
                value={progressSearch}
                onChange={e => setProgressSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none"
                onFocus={e => { e.target.style.borderColor = ORANGE; e.target.style.boxShadow = `0 0 0 2px rgba(240,90,40,0.15)`; }}
                onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
            <div className="flex gap-1.5">
              {['all', 'assigned', 'urgent', 'overdue', 'completed'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border capitalize transition-all
                    ${statusFilter === s ? 'text-white border-transparent' : 'text-gray-600 bg-white border-gray-200 hover:border-gray-300'}`}
                  style={statusFilter === s ? { background: ORANGE } : {}}
                >
                  {s === 'all' ? 'All' : s}
                </button>
              ))}
            </div>
          </div>

          {filteredStats.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No assignments match your filters.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[800px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Learner</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Video</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Due</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Progress</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Quiz</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredStats.map(s => {
                      const st = STATUS_STYLES[s.status] || STATUS_STYLES.assigned;
                      return (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3.5">
                            <p className="font-medium text-gray-900">{s.user_name}</p>
                            <p className="text-xs text-gray-400">{s.user_email}</p>
                          </td>
                          <td className="px-4 py-3.5 text-gray-700 max-w-[180px]">
                            <span className="truncate block">{s.video_title}</span>
                          </td>
                          <td className="px-4 py-3.5 text-center text-gray-500 text-xs">
                            {s.due_date
                              ? new Date(s.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                              : <span className="text-gray-300">—</span>
                            }
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <div className="flex items-center gap-2 justify-center">
                              <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${s.progress_percent}%`, background: s.progress_percent === 100 ? '#10b981' : ORANGE }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 w-8 text-left">{s.progress_percent}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${st.cls}`}>
                              {s.status === 'urgent' && <Clock className="w-3 h-3" />}
                              {s.status === 'overdue' && <AlertTriangle className="w-3 h-3" />}
                              {s.status === 'completed' && <CheckCircle className="w-3 h-3" />}
                              {st.label}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {s.attempt_count === 0
                              ? <span className="text-xs text-gray-400">Not taken</span>
                              : s.quiz_passed
                                ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                    <CheckCircle className="w-3 h-3" /> Passed {s.best_score != null ? `· ${s.best_score}%` : ''}
                                  </span>
                                : <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                                    <XCircle className="w-3 h-3" /> Not Passed {s.best_score != null ? `· ${s.best_score}%` : ''}
                                  </span>
                            }
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
      )}
    </div>
  );
}

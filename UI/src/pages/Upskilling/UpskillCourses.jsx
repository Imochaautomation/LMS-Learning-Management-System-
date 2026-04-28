import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import BackButton from '../../components/shared/BackButton';
import {
  Search, ExternalLink, Bookmark, BookmarkX, Play, CheckCircle, Upload, Clock, GraduationCap, Bot, RefreshCw, Loader2
} from 'lucide-react';
import { ToastContainer, useToast } from '../../components/shared/Toast';

const tagColor = { 'Gap-Fill': 'bg-red-50 text-red-600', Growth: 'bg-emerald-50 text-emerald-600' };

export default function UpskillCourses() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('recommended');
  const [uploadingFor, setUploadingFor] = useState(null);
  const [retaking, setRetaking] = useState(false);
  const [redirectModal, setRedirectModal] = useState(null);
  const fileRef = useRef();
  const { toasts, removeToast, toast } = useToast();


  useEffect(() => {
    api.get('/courses/my').then(setCourses).catch(() => setCourses([]));
    api.get('/courses/recommended').then(setRecommended).catch(() => setRecommended([]));
  }, []);

  const saved = courses.filter((c) => c.status === 'saved' || c.status === 'saved_later');
  const started = courses.filter((c) => c.status === 'started');
  const completed = courses.filter((c) => c.status === 'completed');

  const [savingId, setSavingId] = useState(null);
  const [savedIds, setSavedIds] = useState(new Set());

  const saveCourse = async (course, type) => {
    if (savingId || savedIds.has(course.id)) return;
    setSavingId(course.id);
    try {
      await api.post('/courses/save', { course_id: course.id, title: course.title, provider: course.provider, link: course.link, status: type });
      const updated = await api.get('/courses/my');
      setCourses(updated);
      setSavedIds((prev) => new Set([...prev, course.id]));
      toast.success(`"${course.title}" saved!`);
    } catch (err) { toast.error(`Failed to save course: ${err.message}`); }
    finally { setSavingId(null); }
  };

  const startCourse = async (course) => {
    try {
      await api.put(`/courses/my/${course.id}/start`);
      if (course.link) window.open(course.link, '_blank');
      const updated = await api.get('/courses/my');
      setCourses(updated);
      toast.success(`Started "${course.title}"!`);
    } catch (err) { toast.error(`Failed to start course: ${err.message}`); }
  };

  const markComplete = async (courseId) => {
    const file = fileRef.current?.files?.[0];
    try {
      const formData = new FormData();
      if (file) formData.append('file', file);
      await api.put(`/courses/my/${courseId}/complete`, formData);
      setUploadingFor(null);
      const updated = await api.get('/courses/my');
      setCourses(updated);
      toast.success('Course marked as complete! 🏆');
    } catch (err) { toast.error(`Failed to complete course: ${err.message}`); }
  };

  const notInterested = async (courseId) => {
    try {
      await api.delete(`/courses/my/${courseId}`);
      const updated = await api.get('/courses/my');
      setCourses(updated);
      setRecommended((prev) => prev.filter((c) => c.id !== courseId));
      toast.info('Course removed.');
    } catch (err) { toast.error(`Failed to remove course: ${err.message}`); }
  };

  // Determine platform name from link URL
  const getPlatformName = (link) => {
    if (!link) return 'the course platform';
    const url = link.toLowerCase();
    if (url.includes('udemy')) return 'Udemy';
    if (url.includes('linkedin')) return 'LinkedIn Learning';
    if (url.includes('coursera')) return 'Coursera';
    if (url.includes('pluralsight')) return 'Pluralsight';
    if (url.includes('youtube')) return 'YouTube';
    if (url.includes('skillshare')) return 'Skillshare';
    if (url.includes('edx')) return 'edX';
    if (url.includes('khan')) return 'Khan Academy';
    try { return new URL(link).hostname.replace('www.', ''); } catch { return 'the course platform'; }
  };

  const filteredRec = recommended.filter((c) => c.title?.toLowerCase().includes(search.toLowerCase()));
  const filteredSaved = saved.filter((c) => c.title?.toLowerCase().includes(search.toLowerCase()));

  const tabs = [
    { id: 'recommended', label: '🎯 AI Recommended', count: recommended.length },
    { id: 'library', label: '📚 My Library', count: saved.length },
    { id: 'started', label: '▶️ In Progress', count: started.length },
    { id: 'completed', label: '🏆 Trophies Earned', count: completed.length },
  ];

  const CourseCard = ({ course, showActions, isMyCourse }) => (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {course.tag && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tagColor[course.tag] || 'bg-gray-100 text-gray-600'}`}>{course.tag}</span>}
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{course.category}</span>
          {course.free !== undefined && (course.free ? <span className="text-xs text-emerald-600 font-medium">Free</span> : <span className="text-xs text-gray-400">Paid</span>)}
        </div>
      </div>
      <h3 className="font-semibold text-gray-900 text-sm mb-1">{course.title}</h3>
      <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
        {course.provider && <span>{course.provider}</span>}
        {course.duration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {course.duration}</span>}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {course.link && (
          <button onClick={() => setRedirectModal({ title: course.title, link: course.link, provider: course.provider })}
            className="flex items-center gap-1 px-3 py-1.5 text-xs border rounded-lg cursor-pointer"
            style={{ color: '#F05A28', borderColor: 'rgba(240,90,40,0.4)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(240,90,40,0.07)'}
            onMouseLeave={e => e.currentTarget.style.background = ''}>
            <ExternalLink className="w-3 h-3" /> View
          </button>
        )}
        {showActions === 'recommend' && (() => {
          const isYT = (course.provider || '').toLowerCase().includes('youtube') ||
                       (course.link || '').toLowerCase().includes('youtube.com');
          return (
            <>
              {!isYT && (
                savedIds.has(course.id) ? (
                  <span className="flex items-center gap-1 px-3 py-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg font-medium">
                    <CheckCircle className="w-3 h-3" /> Saved ✓
                  </span>
                ) : (
                  <button onClick={() => saveCourse(course, 'saved')} disabled={savingId === course.id}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50 disabled:opacity-50">
                    <Bookmark className="w-3 h-3" /> {savingId === course.id ? 'Saving...' : 'Save'}
                  </button>
                )
              )}
              <button onClick={() => notInterested(course.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 bg-orange-50/50">
                <BookmarkX className="w-3 h-3" /> Not Interested
              </button>
            </>
          );
        })()}
        {showActions === 'saved' && (
          <button onClick={() => startCourse(course)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50">
            <Play className="w-3 h-3" /> Start Course
          </button>
        )}
        {showActions === 'started' && (
          <>
            {uploadingFor === course.id ? (
              <div className="flex items-center gap-2">
                <input type="file" ref={fileRef} className="text-xs" />
                <button onClick={() => markComplete(course.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50">
                  <Upload className="w-3 h-3" /> Submit
                </button>
              </div>
            ) : (
              <button onClick={() => setUploadingFor(course.id)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50"
                title="Upload certificate or proof of completion">
                <CheckCircle className="w-3 h-3" /> Mark Complete
              </button>
            )}
          </>
        )}
        {showActions === 'completed' && (
          <span className="flex items-center gap-1 px-3 py-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg font-medium">
            <CheckCircle className="w-3 h-3" /> 🏆 Trophy Earned
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <BackButton to="/upskilling" label="Back to Dashboard" />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">My Courses</h1>
        <button
          onClick={async () => {
            setRetaking(true);
            try { await api.post('/ai/reset-interview', {}); } catch {}
            setRetaking(false);
            navigate('/upskilling/interview');
          }}
          disabled={retaking}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 disabled:opacity-60 transition-colors">
          {retaking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
          Retake Interview
        </button>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label} <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input placeholder="Search courses..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-lg" />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {tab === 'recommended' && filteredRec.map((c) => <CourseCard key={c.id} course={c} showActions="recommend" />)}
        {tab === 'library' && filteredSaved.map((c) => <CourseCard key={c.id} course={c} showActions="saved" isMyCourse />)}
        {tab === 'started' && started.map((c) => <CourseCard key={c.id} course={c} showActions="started" isMyCourse />)}
        {tab === 'completed' && completed.map((c) => <CourseCard key={c.id} course={c} showActions="completed" isMyCourse />)}
      </div>

      {tab === 'recommended' && filteredRec.length === 0 && <p className="text-center text-gray-400 py-8">No recommendations yet. Complete your AI interview first.</p>}
      {tab === 'library' && filteredSaved.length === 0 && <p className="text-center text-gray-400 py-8">No saved courses. Save courses from AI recommendations.</p>}
      {tab === 'started' && started.length === 0 && <p className="text-center text-gray-400 py-8">No courses in progress.</p>}
      {tab === 'completed' && completed.length === 0 && <p className="text-center text-gray-400 py-8">No completed courses yet. Keep learning! 🚀</p>}

      {/* Redirect Confirmation Modal */}
      {redirectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setRedirectModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-5 text-white" style={{ background: 'linear-gradient(to right, #F05A28, #c2410c)' }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <ExternalLink className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg">Instructions</h3>
              </div>
              <p className="text-orange-100 text-sm">{redirectModal.title}</p>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                <p className="text-sm text-gray-700 leading-relaxed">
                  You will now be redirected to <strong style={{ color: '#c2410c' }}>{getPlatformName(redirectModal.link)}</strong> where you will be shown multiple courses. You are <strong>free to choose any one</strong> as per your suitability.
                </p>
              </div>
              <div className="flex items-start gap-2 text-xs text-gray-500">
                <GraduationCap className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                <p>Pick the course that best matches your learning style and schedule. Once you start, come back here to track your progress.</p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-5 flex items-center justify-end gap-3">
              <button onClick={() => setRedirectModal(null)}
                className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => { window.open(redirectModal.link, '_blank'); setRedirectModal(null); }}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-all">
                <ExternalLink className="w-4 h-4" /> Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


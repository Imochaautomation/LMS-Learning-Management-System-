import { useState, useEffect, useRef } from 'react';
import api from '../../api/client';
import BackButton from '../../components/shared/BackButton';
import { ExternalLink, Star, Clock, Upload, Check, Loader2, Search, Lock, Swords, Trophy } from 'lucide-react';
import { ToastContainer, useToast } from '../../components/shared/Toast';

export default function TrainingCourses() {
  const [search, setSearch] = useState('');
  const [courses, setCourses] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [uploading, setUploading] = useState(null);
  const fileRef = useRef();
  const { toasts, removeToast, toast } = useToast();

  useEffect(() => {
    api.get('/assessments/my').then(setAssessments).catch(() => {});
    api.get('/banks/courses').then(setCourses).catch(() => {});
    api.get('/courses/assignments').then(setAssignments).catch(() => {});
    api.get('/courses/completions').then(setCompletions).catch(() => {});
  }, []);

  // Check if all assessments are reviewed/submitted (quests complete)
  const allQuestsComplete = assessments.length > 0 &&
    assessments.every((a) => a.status === 'reviewed' || a.status === 'submitted');

  const completedIds = new Set(completions.map((c) => c.course_id));
  const assignedIds = new Set(assignments.map((a) => a.course_id));
  const assignedCourses = courses.filter((c) => assignedIds.has(c.id));
  const filtered = assignedCourses.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));

  const handleComplete = async (course) => {
    if (!fileRef.current?.files[0]) { toast.warning('Please upload a certificate or proof of completion.'); return; }
    setUploading(course.id);
    const fd = new FormData();
    fd.append('course_id', course.id);
    fd.append('course_title', course.title);
    fd.append('proof', fileRef.current.files[0]);
    try {
      const res = await api.upload('/courses/completion', fd);
      setCompletions((prev) => [...prev, res]);
      setUploading(null);
      fileRef.current.value = '';
      toast.success(`Course "${course.title}" marked as complete!`);
    } catch (err) { toast.error(`Failed to submit: ${err.message}`); setUploading(null); }
  };

  // Locked state — quests not complete
  if (!allQuestsComplete) {
    const reviewed = assessments.filter((a) => a.status === 'reviewed' || a.status === 'submitted');
    const total = assessments.length || 1;
    const remaining = total - reviewed.length;

    return (
      <div className="space-y-6">
        <BackButton to="/training" label="Back to Dashboard" />

        <div className="flex flex-col items-center justify-center py-16">
          {/* Lock Icon */}
          <div className="relative mb-6">
            <div className="w-32 h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center border-4 border-gray-300">
              <Lock className="w-16 h-16 text-gray-400" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center border-2 border-amber-300">
              <Swords className="w-5 h-5 text-amber-600" />
            </div>
          </div>

          {/* Lock Message */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">🔒 Courses Locked</h1>
          <p className="text-gray-500 text-center max-w-md mb-6">
            Complete all your assessment quests to unlock courses. Your manager may also assign courses as you progress.
          </p>

          {/* Progress */}
          <div className="bg-white border-2 border-amber-200 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-700">Quest Progress</span>
              <span className="text-sm font-bold text-amber-600">{reviewed.length} / {total}</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500"
                style={{ width: `${(reviewed.length / total) * 100}%` }} />
            </div>
            <p className="text-xs text-gray-400 text-center">
              {remaining === 0
                ? '✅ All quests complete! Waiting for manager to mark you ready.'
                : `⚔️ ${remaining} quest${remaining > 1 ? 's' : ''} remaining — keep going!`}
            </p>
          </div>

          {/* Motivation */}
          <div className="mt-6 flex justify-center w-full max-w-md">
            <div className="rounded-xl p-4 text-center px-8 border" style={{ background: 'rgba(240,90,40,0.08)', borderColor: 'rgba(240,90,40,0.3)' }}>
              <span className="text-lg block mb-0.5">🎓</span>
              <p className="text-xs font-semibold" style={{ color: '#F05A28' }}>Unlock Courses</p>
              <p className="text-[10px]" style={{ color: '#c2410c' }}>After all quests</p>
            </div>
          </div>

          <a href="/training/assessments" className="mt-6 px-6 py-3 bg-amber-500 text-white font-semibold rounded-xl hover:bg-amber-600 transition-colors flex items-center gap-2 shadow-lg">
            <Swords className="w-4 h-4" /> Go to Quests →
          </a>
        </div>
      </div>
    );
  }

  // Unlocked state — show courses
  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <BackButton to="/training" label="Back to Dashboard" />
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">🎓 Recommended Courses</h1>
        <p className="text-sm text-gray-500 mt-1">Based on AI review of your assessments. Complete courses and upload proof.</p>
      </div>

      {filtered.length === 0 && assignments.length === 0 && (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
          <p className="text-gray-500 text-sm">No courses assigned yet.</p>
          <p className="text-gray-400 text-xs mt-1">Your manager will assign courses based on your assessment results.</p>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Search courses..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200" />
      </div>

      <input ref={fileRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" />

      <div className="grid sm:grid-cols-2 gap-4">
        {filtered.map((c) => {
          const isCompleted = completedIds.has(c.id);
          return (
            <div key={c.id} className={`bg-white border rounded-xl p-5 hover:shadow-md transition-shadow ${isCompleted ? 'border-emerald-200' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.tag === 'Gap-Fill' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>{c.tag}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{c.category}</span>
                </div>
                {c.free ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">Free</span>
                  : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">Paid</span>}
              </div>
              <h3 className="font-semibold text-gray-900 text-sm mb-2">{c.title}</h3>
              <p className="text-xs text-gray-500 mb-3">{c.provider}</p>
              <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {c.duration}</span>
                <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5" /> {c.rating}</span>
              </div>
              {isCompleted ? (
                <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium"><Check className="w-4 h-4" /> Completed — Certificate Uploaded</div>
              ) : (
                <div className="flex items-center justify-between">
                  <a href={c.link || '#'} target={c.link ? '_blank' : undefined} className="flex items-center gap-1.5 text-sm font-medium hover:opacity-80" style={{ color: '#F05A28' }}>
                    Start <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <div className="relative group">
                    <button onClick={() => { fileRef.current.onchange = () => handleComplete(c); fileRef.current.click(); }}
                      disabled={uploading === c.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 disabled:opacity-50">
                      {uploading === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Mark Complete
                    </button>
                    <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      Upload certificate of completion or any other proof
                      <div className="absolute top-full right-4 w-2 h-2 bg-gray-900 rotate-45 -translate-y-1"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && assignments.length > 0 && (
          <p className="text-center text-gray-400 py-8 text-sm col-span-2">No courses match your search.</p>
        )}
      </div>
    </div>
  );
}

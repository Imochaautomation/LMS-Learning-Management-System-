import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../api/client';
import {
  Video, CheckCircle, XCircle, Lock, Loader2, PlayCircle,
  Clock, AlertTriangle, Calendar, Trophy, RotateCcw
} from 'lucide-react';

const ORANGE = '#F05A28';

const STATUS_CONFIG = {
  completed: { label: 'Completed', icon: CheckCircle, cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  urgent:    { label: 'Urgent',    icon: Clock,        cls: 'text-amber-700 bg-amber-50 border-amber-200' },
  overdue:   { label: 'Overdue',   icon: AlertTriangle,cls: 'text-red-600 bg-red-50 border-red-200' },
  assigned:  { label: 'Assigned',  icon: PlayCircle,   cls: 'text-blue-700 bg-blue-50 border-blue-200' },
};

function getYouTubeId(url) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function isYouTube(url) {
  return url && (url.includes('youtube.com') || url.includes('youtu.be'));
}

function VideoPlayer({ url, onProgress, onEnded }) {
  const videoRef = useRef(null);
  const saveTimer = useRef(null);

  const ytId = url ? getYouTubeId(url) : null;
  const isYT = isYouTube(url);

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const pct = Math.round((v.currentTime / v.duration) * 100);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onProgress(pct), 2000);
  };

  const handleEnded = () => {
    clearTimeout(saveTimer.current);
    onProgress(100);
    onEnded?.();
  };

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  if (!url) return (
    <div className="w-full aspect-video bg-gray-100 rounded-xl flex items-center justify-center">
      <p className="text-sm text-gray-400">No video URL</p>
    </div>
  );

  if (isYT && ytId) return (
    <iframe
      className="w-full aspect-video rounded-xl"
      src={`https://www.youtube.com/embed/${ytId}?rel=0`}
      title="Training video"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  );

  return (
    <video
      ref={videoRef}
      src={url}
      controls
      className="w-full aspect-video rounded-xl bg-black"
      onTimeUpdate={handleTimeUpdate}
      onEnded={handleEnded}
    />
  );
}

export default function VideoAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingProgress, setSavingProgress] = useState(false);
  const [localProgress, setLocalProgress] = useState(0);

  // Quiz state
  const [answers, setAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);  // {score, passed, correct, total}
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [retaking, setRetaking] = useState(false);

  const fetchAssignments = useCallback(async () => {
    try {
      const data = await api.get('/video-assignments/my');
      setAssignments(data || []);
    } catch {
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  const selectAssignment = (a) => {
    setSelected(a);
    setLocalProgress(a.progress_percent);
    setAnswers({});
    setQuizResult(null);
    setRetaking(false);
  };

  const saveProgress = useCallback(async (pct) => {
    if (!selected) return;
    setSavingProgress(true);
    try {
      const res = await api.patch(`/video-assignments/${selected.id}/progress`, { progress_percent: pct });
      setLocalProgress(res.progress_percent);
      setAssignments(prev => prev.map(a =>
        a.id === selected.id
          ? { ...a, progress_percent: res.progress_percent, status: res.status }
          : a
      ));
      setSelected(prev => prev ? { ...prev, progress_percent: res.progress_percent, status: res.status } : prev);
      // Refresh to get quiz questions if just hit 100%
      if (res.progress_percent >= 100 && (selected.progress_percent || 0) < 100) {
        const refreshed = await api.get('/video-assignments/my');
        const updated = (refreshed || []).find(a => a.id === selected.id);
        if (updated) {
          setSelected(updated);
          setAssignments(refreshed);
        }
      }
    } catch {
      // silent — progress saves are best-effort
    } finally {
      setSavingProgress(false);
    }
  }, [selected]);

  const handleMarkWatched = () => saveProgress(100);

  const handleVideoProgress = (pct) => {
    setLocalProgress(pct);
    if (pct > (selected?.progress_percent || 0)) {
      saveProgress(pct);
    }
  };

  const handleAnswerChange = (questionId, chosenIndex) => {
    setAnswers(prev => ({ ...prev, [String(questionId)]: chosenIndex }));
  };

  const handleSubmitQuiz = async () => {
    if (!selected) return;
    setSubmittingQuiz(true);
    try {
      const res = await api.post(`/video-assignments/${selected.id}/quiz`, { answers });
      setQuizResult(res);
      setRetaking(false);
      // Refresh assignments to get updated attempt_count / quiz_passed
      const refreshed = await api.get('/video-assignments/my');
      const updated = (refreshed || []).find(a => a.id === selected.id);
      if (updated) {
        setSelected(updated);
        setAssignments(refreshed);
      }
    } catch (err) {
      alert(err.message || 'Failed to submit quiz');
    } finally {
      setSubmittingQuiz(false);
    }
  };

  const handleRetake = () => {
    setAnswers({});
    setQuizResult(null);
    setRetaking(true);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-7 h-7 animate-spin" style={{ color: ORANGE }} />
      <span className="ml-3 text-gray-500">Loading assignments...</span>
    </div>
  );

  return (
    <div className="flex gap-5 h-full min-h-[calc(100vh-8rem)]">
      {/* ── Assignment list (left) ──────────────────────────────────────── */}
      <aside className="w-72 shrink-0 flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-1 mb-1">
          Video Assignments
        </h2>

        {assignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 py-12 text-center">
            <Video className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-sm text-gray-400">No video assignments yet.</p>
          </div>
        ) : (
          assignments.map(a => {
            const sc = STATUS_CONFIG[a.status] || STATUS_CONFIG.assigned;
            const isActive = selected?.id === a.id;
            return (
              <button
                key={a.id}
                onClick={() => selectAssignment(a)}
                className={`text-left w-full p-3.5 rounded-xl border transition-all ${
                  isActive
                    ? 'border-orange-300 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
                style={isActive ? { background: 'rgba(240,90,40,0.05)', borderColor: ORANGE } : {}}
              >
                <p className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2">
                  {a.video_title}
                </p>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full border ${sc.cls}`}>
                    <sc.icon className="w-2.5 h-2.5" />
                    {sc.label}
                  </span>
                  <span className="text-xs text-gray-400">{a.progress_percent}%</span>
                </div>

                <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${a.progress_percent}%`,
                      background: a.progress_percent === 100 ? '#10b981' : ORANGE,
                    }}
                  />
                </div>

                {a.due_date && (
                  <p className="mt-1.5 text-[11px] text-gray-400 flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5" />
                    Due {new Date(a.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                )}
              </button>
            );
          })
        )}
      </aside>

      {/* ── Main content (right) ────────────────────────────────────────── */}
      <main className="flex-1 min-w-0">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full py-24 text-center">
            <PlayCircle className="w-14 h-14 text-gray-300 mb-4" />
            <p className="text-gray-500 text-sm">Select a video from the list to start watching.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <h1 className="text-lg font-bold text-gray-900">{selected.video_title}</h1>
              {selected.video_description && (
                <p className="text-sm text-gray-500 mt-0.5">{selected.video_description}</p>
              )}
            </div>

            {/* Video player */}
            <VideoPlayer
              url={selected.video_url}
              onProgress={handleVideoProgress}
              onEnded={() => handleVideoProgress(100)}
            />

            {/* Progress section */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Watch Progress</span>
                <div className="flex items-center gap-2">
                  {savingProgress && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                  )}
                  <span className="text-sm font-bold" style={{ color: localProgress === 100 ? '#10b981' : ORANGE }}>
                    {localProgress}%
                  </span>
                </div>
              </div>

              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${localProgress}%`,
                    background: localProgress === 100 ? '#10b981' : ORANGE,
                  }}
                />
              </div>

              {/* For YouTube (no auto-tracking), show a manual mark button */}
              {isYouTube(selected.video_url) && localProgress < 100 && (
                <button
                  onClick={handleMarkWatched}
                  disabled={savingProgress}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-60"
                  style={{ background: ORANGE }}
                  onMouseEnter={e => e.currentTarget.style.background = '#c2410c'}
                  onMouseLeave={e => e.currentTarget.style.background = ORANGE}
                >
                  <CheckCircle className="w-4 h-4" />
                  Mark as Watched
                </button>
              )}

              {localProgress === 100 && (
                <p className="text-sm text-emerald-600 flex items-center gap-1.5 font-medium">
                  <CheckCircle className="w-4 h-4" /> Video complete
                </p>
              )}
            </div>

            {/* Quiz section */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                {selected.progress_percent < 100
                  ? <Lock className="w-4 h-4 text-gray-400" />
                  : <CheckCircle className="w-4 h-4 text-emerald-500" />
                }
                <h2 className="font-semibold text-gray-800">Quiz</h2>
                {selected.attempt_count > 0 && (
                  <span className="ml-auto text-xs text-gray-400">{selected.attempt_count}/2 attempt{selected.attempt_count !== 1 ? 's' : ''} used</span>
                )}
              </div>

              <div className="p-5">
                {/* Not watched fully */}
                {selected.progress_percent < 100 && (
                  <div className="text-center py-8">
                    <Lock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">Complete the video to unlock the quiz.</p>
                  </div>
                )}

                {/* Quiz not generated yet */}
                {selected.progress_percent >= 100 && !selected.quiz_generated && (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-400">No quiz has been set up for this video yet.</p>
                  </div>
                )}

                {/* Already passed */}
                {selected.progress_percent >= 100 && selected.quiz_passed && !retaking && (
                  <div className="text-center py-8">
                    <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                    <p className="text-base font-bold text-gray-800">Quiz Passed!</p>
                    {selected.last_score != null && (
                      <p className="text-sm text-gray-500 mt-1">Your score: {selected.last_score}%</p>
                    )}
                  </div>
                )}

                {/* Show quiz result (after submission) */}
                {quizResult && !retaking && (
                  <div className={`rounded-xl p-5 mb-5 text-center border ${quizResult.passed ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    {quizResult.passed
                      ? <Trophy className="w-10 h-10 text-amber-400 mx-auto mb-2" />
                      : <XCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
                    }
                    <p className="text-lg font-bold" style={{ color: quizResult.passed ? '#065f46' : '#991b1b' }}>
                      {quizResult.passed ? 'Passed!' : 'Not Passed'}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Score: <strong>{quizResult.score}%</strong> — {quizResult.correct}/{quizResult.total} correct
                    </p>
                    {!quizResult.passed && selected.attempt_count < 2 && (
                      <button
                        onClick={handleRetake}
                        className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg mx-auto"
                        style={{ background: ORANGE }}
                        onMouseEnter={e => e.currentTarget.style.background = '#c2410c'}
                        onMouseLeave={e => e.currentTarget.style.background = ORANGE}
                      >
                        <RotateCcw className="w-4 h-4" />
                        Retake Quiz (1 retake remaining)
                      </button>
                    )}
                    {!quizResult.passed && selected.attempt_count >= 2 && (
                      <p className="mt-3 text-xs text-red-500">No more attempts available.</p>
                    )}
                  </div>
                )}

                {/* Show questions */}
                {selected.progress_percent >= 100 &&
                  selected.quiz_generated &&
                  !selected.quiz_passed &&
                  !quizResult &&
                  selected.questions?.length > 0 && (
                  <div className="space-y-5">
                    {selected.questions.map((q, qi) => (
                      <div key={q.id} className="space-y-2">
                        <p className="text-sm font-semibold text-gray-800">
                          {qi + 1}. {q.question_text}
                        </p>
                        <div className="space-y-1.5">
                          {q.options.map((opt, oi) => {
                            const chosen = answers[String(q.id)] === oi;
                            return (
                              <label
                                key={oi}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all text-sm
                                  ${chosen
                                    ? 'border-orange-400 bg-orange-50 font-medium'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                  }`}
                                style={chosen ? { borderColor: ORANGE } : {}}
                              >
                                <input
                                  type="radio"
                                  name={`q-${q.id}`}
                                  checked={chosen}
                                  onChange={() => handleAnswerChange(q.id, oi)}
                                  className="w-4 h-4"
                                  style={{ accentColor: ORANGE }}
                                />
                                <span>{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    <div className="pt-2">
                      <button
                        onClick={handleSubmitQuiz}
                        disabled={submittingQuiz || Object.keys(answers).length < selected.questions.length}
                        className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
                        style={{ background: ORANGE }}
                        onMouseEnter={e => { if (!submittingQuiz) e.currentTarget.style.background = '#c2410c'; }}
                        onMouseLeave={e => e.currentTarget.style.background = ORANGE}
                      >
                        {submittingQuiz ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Submit Quiz
                      </button>
                      {Object.keys(answers).length < (selected.questions?.length || 0) && (
                        <p className="text-xs text-gray-400 mt-1.5">
                          Answer all {selected.questions.length} questions to submit.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Retake: show questions again (same UI, cleared answers) */}
                {retaking && selected.questions?.length > 0 && !quizResult && (
                  <div className="space-y-5">
                    <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
                      <RotateCcw className="w-4 h-4 shrink-0" /> Retake — answer all questions again.
                    </p>
                    {selected.questions.map((q, qi) => (
                      <div key={q.id} className="space-y-2">
                        <p className="text-sm font-semibold text-gray-800">
                          {qi + 1}. {q.question_text}
                        </p>
                        <div className="space-y-1.5">
                          {q.options.map((opt, oi) => {
                            const chosen = answers[String(q.id)] === oi;
                            return (
                              <label
                                key={oi}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all text-sm
                                  ${chosen ? 'border-orange-400 bg-orange-50 font-medium' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                                style={chosen ? { borderColor: ORANGE } : {}}
                              >
                                <input
                                  type="radio"
                                  name={`q-${q.id}`}
                                  checked={chosen}
                                  onChange={() => handleAnswerChange(q.id, oi)}
                                  className="w-4 h-4"
                                  style={{ accentColor: ORANGE }}
                                />
                                <span>{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={handleSubmitQuiz}
                      disabled={submittingQuiz || Object.keys(answers).length < selected.questions.length}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
                      style={{ background: ORANGE }}
                      onMouseEnter={e => { if (!submittingQuiz) e.currentTarget.style.background = '#c2410c'; }}
                      onMouseLeave={e => e.currentTarget.style.background = ORANGE}
                    >
                      {submittingQuiz ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Submit Quiz
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}


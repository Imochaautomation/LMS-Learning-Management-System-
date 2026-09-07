import { useState, useEffect, useRef, useCallback } from 'react';
import api, { API_HOST } from '../../api/client';
import {
  Video, CheckCircle, XCircle, Lock, Loader2, PlayCircle,
  Clock, AlertTriangle, Calendar, Trophy, RotateCcw
} from 'lucide-react';

const ORANGE = '#F05A28';

function formatCooldown(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const STATUS_CONFIG = {
  completed: { label: 'Completed', icon: CheckCircle, cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  urgent:    { label: 'Urgent',    icon: Clock,        cls: 'text-amber-700 bg-amber-50 border-amber-200' },
  overdue:   { label: 'Overdue',   icon: AlertTriangle,cls: 'text-red-600 bg-red-50 border-red-200' },
  assigned:  { label: 'Assigned',  icon: PlayCircle,   cls: 'text-blue-700 bg-blue-50 border-blue-200' },
};

function VideoAttemptReview({ title, score, questions }) {
  if (!questions?.length) return null;
  return (
    <div className="text-left border border-gray-200 rounded-xl overflow-hidden mt-4">
      <div className="px-4 py-2 bg-gray-50 text-sm font-semibold text-gray-700">{title} · {score}%</div>
      <div className="divide-y divide-gray-100">
        {questions.map((question, index) => (
          <div key={question.id} className="p-4">
            <p className="text-sm font-medium text-gray-900 mb-2">{index + 1}. {question.question_text}</p>
            <div className="grid sm:grid-cols-2 gap-2">
              <div className={`rounded-lg border px-3 py-2 ${question.is_correct ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                <p className="text-xs text-gray-500 mb-0.5">Your answer:</p>
                <p className="text-sm text-gray-800">{question.options?.[question.selected_index] ?? '(no answer)'}</p>
              </div>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                <p className="text-xs font-semibold text-emerald-700 mb-0.5">Correct answer:</p>
                <p className="text-sm text-emerald-800">{question.options?.[question.correct_index] ?? '—'}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getYouTubeId(url) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function isYouTube(url) {
  return url && (url.includes('youtube.com') || url.includes('youtu.be'));
}

let youtubeApiPromise;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!youtubeApiPromise) {
    youtubeApiPromise = new Promise(resolve => {
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousReady?.();
        resolve(window.YT);
      };
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(script);
      }
    });
  }
  return youtubeApiPromise;
}

function VideoPlayer({ url, streamUrl, watchedProgress, onProgress, onEnded, rewatchMode = false, onRewatchSegments }) {
  const videoRef = useRef(null);
  const saveTimer = useRef(null);
  const maxWatchedTime = useRef(0);
  const correctingSeek = useRef(false);
  const lastPlaybackTime = useRef(null);
  const pendingRanges = useRef([]);
  const youtubeContainerRef = useRef(null);
  const youtubePlayerRef = useRef(null);
  const onRewatchSegmentsRef = useRef(onRewatchSegments);

  const ytId = url ? getYouTubeId(url) : null;
  const isYT = isYouTube(url);
  const playbackUrl = streamUrl ? `${API_HOST}${streamUrl}` : url;

  useEffect(() => { onRewatchSegmentsRef.current = onRewatchSegments; }, [onRewatchSegments]);

  useEffect(() => {
    if (!isYT || !ytId || !youtubeContainerRef.current) return undefined;
    let cancelled = false;
    let pollTimer;
    let flushTimer;
    loadYouTubeApi().then(YT => {
      if (cancelled || !youtubeContainerRef.current) return;
      youtubePlayerRef.current = new YT.Player(youtubeContainerRef.current, {
        videoId: ytId,
        playerVars: { rel: 0 },
        events: {
          onStateChange: event => {
            if (event.data === YT.PlayerState.PLAYING && rewatchMode) {
              window.clearInterval(pollTimer);
              window.clearInterval(flushTimer);
              let previous = event.target.getCurrentTime();
              pollTimer = window.setInterval(() => {
                const current = event.target.getCurrentTime();
                if (current > previous && current - previous <= 2.5) pendingRanges.current.push([previous, current]);
                previous = current;
              }, 1000);
              flushTimer = window.setInterval(() => {
                const ranges = pendingRanges.current.splice(0);
                const duration = event.target.getDuration();
                if (ranges.length && duration > 0) onRewatchSegmentsRef.current?.(ranges, duration);
              }, 3000);
            } else {
              window.clearInterval(pollTimer);
              window.clearInterval(flushTimer);
              const ranges = pendingRanges.current.splice(0);
              const duration = event.target.getDuration();
              if (ranges.length && duration > 0) onRewatchSegmentsRef.current?.(ranges, duration);
            }
          },
        },
      });
    });
    return () => {
      cancelled = true;
      window.clearInterval(pollTimer);
      window.clearInterval(flushTimer);
      youtubePlayerRef.current?.destroy?.();
      youtubePlayerRef.current = null;
    };
  }, [isYT, rewatchMode, ytId]);

  useEffect(() => {
    maxWatchedTime.current = 0;
    correctingSeek.current = false;
    lastPlaybackTime.current = null;
    pendingRanges.current = [];
  }, [playbackUrl]);

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration)) return;
    maxWatchedTime.current = Math.max(
      maxWatchedTime.current,
      v.duration * Math.min(100, Math.max(0, watchedProgress || 0)) / 100,
    );
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;

    // Never accept a jump beyond the furthest point reached by normal playback.
    if (!rewatchMode && !v.seeking && v.currentTime > maxWatchedTime.current + 2) {
      correctingSeek.current = true;
      v.currentTime = maxWatchedTime.current;
      return;
    }

    if (!v.seeking) {
      maxWatchedTime.current = Math.max(maxWatchedTime.current, v.currentTime);
      const previous = lastPlaybackTime.current;
      if (rewatchMode && previous != null && v.currentTime > previous && v.currentTime - previous <= 2.5) {
        pendingRanges.current.push([previous, v.currentTime]);
      }
      lastPlaybackTime.current = v.currentTime;
    }
    if (rewatchMode) {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const ranges = pendingRanges.current.splice(0);
        if (ranges.length) onRewatchSegments?.(ranges, v.duration);
      }, 2000);
      return;
    }
    const pct = Math.round((v.currentTime / v.duration) * 100);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onProgress(pct), 2000);
  };

  const handleSeeking = () => {
    const v = videoRef.current;
    if (!v) return;

    if (correctingSeek.current) {
      correctingSeek.current = false;
      return;
    }

    lastPlaybackTime.current = null;
    // Seeking is unrestricted during an approved rewatch.
    if (!rewatchMode && v.currentTime > maxWatchedTime.current + 0.5) {
      correctingSeek.current = true;
      v.currentTime = maxWatchedTime.current;
    }
  };

  const enforceNormalPlaybackSpeed = () => {
    const v = videoRef.current;
    if (v && v.playbackRate !== 1) v.playbackRate = 1;
  };

  const handleEnded = () => {
    clearTimeout(saveTimer.current);
    if (!rewatchMode) onProgress(100);
    onEnded?.();
  };

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  if (!playbackUrl) return (
    <div className="w-full aspect-video bg-gray-100 rounded-xl flex items-center justify-center">
      <p className="text-sm text-gray-400">No video URL</p>
    </div>
  );

  if (isYT && ytId) return <div ref={youtubeContainerRef} className="w-full aspect-video rounded-xl overflow-hidden" />;

  return (
    <video
      ref={videoRef}
      src={playbackUrl}
      controls
      controlsList="nodownload noplaybackrate"
      disablePictureInPicture
      className="w-full aspect-video rounded-xl bg-black"
      onLoadedMetadata={handleLoadedMetadata}
      onTimeUpdate={handleTimeUpdate}
      onSeeking={handleSeeking}
      onRateChange={enforceNormalPlaybackSpeed}
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
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [requestingAttempt, setRequestingAttempt] = useState(false);

  const fetchAssignments = useCallback(async () => {
    try {
      const data = await api.get('/video-assignments/my');
      setAssignments(data || []);
      setSelected(current => current
        ? (data || []).find(assignment => assignment.id === current.id) || current
        : current);
    } catch {
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  useEffect(() => {
    if (selected?.attempt_request_status !== 'pending') return undefined;
    const timer = window.setInterval(fetchAssignments, 10000);
    return () => window.clearInterval(timer);
  }, [fetchAssignments, selected?.attempt_request_status]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSeconds(seconds => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  const selectAssignment = (a) => {
    setSelected(a);
    setLocalProgress(a.progress_percent);
    setAnswers({});
    setQuizResult(null);
    setRetaking(false);
    setCooldownSeconds(a.retake_wait_seconds || 0);
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

  const handleRewatchSegments = async (ranges, duration) => {
    if (!selected) return;
    try {
      const res = await api.patch(`/video-assignments/${selected.id}/rewatch-progress`, { ranges, duration });
      setSelected(prev => prev ? { ...prev, rewatch_progress_percent: res.rewatch_progress_percent } : prev);
    } catch {
      // Best effort; subsequent playback sends additional ranges.
    }
  };

  const requestAnotherAttempt = async () => {
    if (!selected) return;
    setRequestingAttempt(true);
    try {
      const res = await api.post(`/video-assignments/${selected.id}/request-attempt`, {});
      setSelected(prev => prev ? { ...prev, attempt_request_status: res.attempt_request_status } : prev);
    } catch (err) {
      alert(err.message || 'Could not request another attempt');
    } finally {
      setRequestingAttempt(false);
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
        setCooldownSeconds(updated.retake_wait_seconds || 0);
      }
    } catch (err) {
      alert(err.message || 'Failed to submit quiz');
    } finally {
      setSubmittingQuiz(false);
    }
  };

  const handleRetake = () => {
    if (cooldownSeconds > 0) return;
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
              streamUrl={selected.stream_url}
              watchedProgress={selected.progress_percent}
              onProgress={handleVideoProgress}
              onEnded={() => { if (!selected.requires_rewatch) handleVideoProgress(100); }}
              rewatchMode={selected.requires_rewatch}
              onRewatchSegments={handleRewatchSegments}
            />
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> {selected.requires_rewatch
                ? 'Approved rewatch: choose any section. Only uniquely watched portions count toward 75%.'
                : 'You may seek within the portion already watched, but you cannot skip unwatched content.'}
            </p>

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

            {selected.requires_rewatch && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex justify-between text-sm font-semibold text-blue-800 mb-2">
                  <span>Unique rewatch progress</span>
                  <span>{Math.round(selected.rewatch_progress_percent || 0)}% / 75%</span>
                </div>
                <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.min(100, selected.rewatch_progress_percent || 0)}%` }} />
                </div>
              </div>
            )}

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
                {selected.progress_percent >= 100 && selected.quiz_passed && !retaking && !quizResult && (
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
                    <VideoAttemptReview title={`Attempt ${selected.attempt_count}`} score={quizResult.score} questions={quizResult.questions} />
                    {!quizResult.passed && selected.attempt_count < 2 && (
                      <button
                        onClick={handleRetake}
                        disabled={cooldownSeconds > 0}
                        className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg mx-auto"
                        style={{ background: ORANGE }}
                        onMouseEnter={e => e.currentTarget.style.background = '#c2410c'}
                        onMouseLeave={e => e.currentTarget.style.background = ORANGE}
                      >
                        <RotateCcw className="w-4 h-4" />
                        {cooldownSeconds > 0
                          ? `Retake available in ${formatCooldown(cooldownSeconds)}`
                          : 'Retake Quiz (1 retake remaining)'}
                      </button>
                    )}
                    {!quizResult.passed && selected.attempt_count === 2 && (
                      <button onClick={requestAnotherAttempt} disabled={requestingAttempt || selected.attempt_request_status === 'pending'} className="mt-4 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg disabled:opacity-60">
                        {selected.attempt_request_status === 'pending' ? 'Retake request pending' : requestingAttempt ? 'Sending request…' : 'Request another attempt'}
                      </button>
                    )}
                  </div>
                )}

                {/* Show questions */}
                {selected.progress_percent >= 100 &&
                  selected.quiz_generated &&
                  !selected.quiz_passed &&
                  !quizResult &&
                  (selected.attempt_count < 2 || (selected.attempt_request_status === 'approved' && selected.rewatch_progress_percent >= 75)) &&
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
                {retaking && selected.questions?.length > 0 && !quizResult && selected.attempt_count < 2 && (
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

                {!quizResult && !selected.quiz_passed && selected.attempt_count === 2 && selected.attempt_request_status !== 'approved' && (
                  <div className="text-center py-6">
                    <p className="text-sm text-gray-600 mb-3">Both quiz attempts have been used.</p>
                    {selected.attempt_request_status === 'pending' ? (
                      <p className="text-sm font-semibold text-amber-700">Your additional-attempt request is pending manager approval.</p>
                    ) : (
                      <button onClick={requestAnotherAttempt} disabled={requestingAttempt} className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg disabled:opacity-60">
                        {requestingAttempt ? 'Sending request…' : selected.attempt_request_status === 'rejected' ? 'Request again' : 'Request another attempt'}
                      </button>
                    )}
                  </div>
                )}

                {!quizResult && !selected.quiz_passed && selected.attempt_count >= 3 && (
                  <p className="text-center py-6 text-sm font-semibold text-red-600">All three quiz attempts have been used.</p>
                )}

                {!quizResult && selected.attempt_request_status === 'approved' && selected.rewatch_progress_percent < 75 && (
                  <p className="text-center py-6 text-sm font-semibold text-blue-700">Watch 75% of unique video content to unlock the approved quiz attempt.</p>
                )}

                {(selected.attempt_results || [])
                  .filter(attemptResult => !quizResult || attemptResult.attempt_number !== selected.attempt_count)
                  .map(attemptResult => (
                  <VideoAttemptReview key={attemptResult.attempt_number} title={`Attempt ${attemptResult.attempt_number}`} score={attemptResult.score} questions={attemptResult.questions} />
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

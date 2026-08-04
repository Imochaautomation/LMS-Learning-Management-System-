/**
 * New Joiner: Take an AI-generated training assessment.
 * Route: /training/ai-assessments/:assessmentId
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api/client';
import BackButton from '../../components/shared/BackButton';
import { useNavigationGuard } from '../../context/NavigationGuardContext';
import { Loader2, CheckCircle2, XCircle, Trophy, AlertTriangle, ChevronDown, ChevronUp, History, PlayCircle, ShieldAlert, Send } from 'lucide-react';

const ORANGE = '#F05A28';
const TEAL = '#0d9488';

function AttemptCard({ attempt, questions, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  // Use embedded question data from answers (works across generations), fall back to questions prop
  const answersWithQ = (attempt.answers || []).map(a => ({
    ...a,
    question_text: a.question_text || questions?.find(q => q.id === a.question_id)?.question_text || '',
    question_type: a.question_type || questions?.find(q => q.id === a.question_id)?.question_type || '',
    difficulty: a.difficulty || questions?.find(q => q.id === a.question_id)?.difficulty,
    options: a.options || questions?.find(q => q.id === a.question_id)?.options,
  }));
  const correctCount = answersWithQ.filter(a => a.ai_flag === 'correct').length;
  const wrongCount = answersWithQ.filter(a => a.ai_flag === 'wrong').length;
  const partialCount = answersWithQ.filter(a => a.ai_flag === 'partial').length;

  return (
    <div className={`border rounded-xl overflow-hidden ${attempt.passed ? 'border-emerald-200' : 'border-gray-200'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 text-left ${attempt.passed ? 'bg-emerald-50 hover:bg-emerald-100' : 'bg-gray-50 hover:bg-gray-100'} transition-colors`}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold text-gray-800">Attempt #{attempt.attempt_number}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${attempt.passed ? 'bg-emerald-200 text-emerald-800' : attempt.status === 'evaluated' ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-600'}`}>
            {attempt.passed ? '🏆 Passed' : attempt.status === 'evaluated' ? 'Not passed' : attempt.status}
          </span>
          {attempt.score != null && (
            <span className={`text-sm font-bold ${attempt.passed ? 'text-emerald-600' : 'text-amber-600'}`}>{Math.round(attempt.score)}/100</span>
          )}
          {attempt.answers?.length > 0 && (
            <span className="text-xs text-gray-500">✓ {correctCount} &nbsp;~ {partialCount} &nbsp;✗ {wrongCount}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400">{attempt.submitted_at?.split('T')[0] || ''}</span>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="bg-white">
          {attempt.ai_feedback?.overall && (
            <div className="px-4 py-3 bg-orange-50 border-b border-orange-100">
              <p className="text-xs font-semibold text-orange-700 mb-1">🤖 AI Feedback</p>
              <p className="text-sm text-gray-700 leading-relaxed">{attempt.ai_feedback.overall}</p>
            </div>
          )}
          <div className="divide-y divide-gray-50">
            {answersWithQ.map((ans, idx) => {
              const flag = ans.ai_flag;
              return (
                <div key={ans.id} className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <span className={`text-base shrink-0 mt-0.5 ${flag === 'correct' ? 'text-emerald-500' : flag === 'wrong' ? 'text-red-500' : flag === 'partial' ? 'text-amber-500' : 'text-gray-300'}`}>
                      {flag === 'correct' ? '✓' : flag === 'wrong' ? '✗' : flag === 'partial' ? '~' : '○'}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${ans.question_type === 'mcq' ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'}`}>
                          {ans.question_type === 'mcq' ? 'MCQ' : 'Descriptive'}
                        </span>
                        {ans.difficulty && (
                          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${ans.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' : ans.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                            {ans.difficulty === 'easy' ? '🟢 Easy' : ans.difficulty === 'medium' ? '🟡 Medium' : '🔴 Hard'}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">Q{idx + 1}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 mb-1">{ans.question_text}</p>
                      <div className="bg-gray-50 rounded-lg px-3 py-2 mb-1">
                        <p className="text-xs text-gray-500">Your answer:</p>
                        <p className="text-sm text-gray-800">{ans.answer_text || '(no answer)'}</p>
                      </div>
                      {flag === 'wrong' && (ans.correct_answer_text || ans.correct_answer) && (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mb-1">
                          <p className="text-xs text-emerald-700 font-semibold">Correct answer:</p>
                          <p className="text-sm text-emerald-800">{ans.correct_answer_text || ans.correct_answer}</p>
                        </div>
                      )}
                      {(ans.ai_explanation || (flag === 'wrong' && (ans.correct_answer_text || ans.correct_answer))) && (
                        <div className={`rounded-lg px-3 py-2 text-xs ${flag === 'correct' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : flag === 'wrong' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                          {ans.ai_explanation || `The correct answer is: ${ans.correct_answer_text || ans.correct_answer}`}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrainingAssessmentForm() {
  const { assessmentId } = useParams();

  const [assessment, setAssessment] = useState(null);
  const [pastAttempts, setPastAttempts] = useState([]);
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('loading'); // 'loading' | 'history' | 'taking' | 'result'
  const [startingNew, setStartingNew] = useState(false);
  const [requestingSent, setRequestingSent] = useState(false);
  const { setBlocked } = useNavigationGuard();

  const isTaking = mode === 'taking';

  // Sync navigation guard with test mode
  useEffect(() => {
    setBlocked(isTaking);
    return () => setBlocked(false);
  }, [isTaking]);

  // Block browser back button, tab close, and refresh while test is active
  useEffect(() => {
    if (!isTaking) return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isTaking]);

  useEffect(() => {
    const load = async () => {
      try {
        const [a, attempts] = await Promise.all([
          api.get(`/training/assessments/${assessmentId}`),
          api.get(`/training/assessments/${assessmentId}/attempts`),
        ]);
        setAssessment(a);
        setPastAttempts(attempts);

        const inProgress = attempts.find(at => at.status === 'in_progress');
        if (inProgress) {
          // Resume the in-progress attempt
          setAttempt(inProgress);
          setMode('taking');
        } else if (attempts.length > 0) {
          // Show history
          setMode('history');
        } else {
          // No attempts yet — go straight to taking
          await startAttempt(a);
          return;
        }
      } catch (e) {
        setError(e.message);
        setMode('history');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [assessmentId]);

  const startAttempt = async (existingAssessment) => {
    setStartingNew(true);
    try {
      const a = existingAssessment || assessment || await api.get(`/training/assessments/${assessmentId}`);
      if (!assessment) setAssessment(a);
      // For re-attempts, the server regenerates questions — this takes 60-120s
      const att = await api.post(`/training/assessments/${assessmentId}/start`, {});
      // Fetch assessment fresh so we get the new generation's questions
      const freshAssessment = await api.get(`/training/assessments/${assessmentId}`);
      setAssessment(freshAssessment);
      setAttempt(att);
      setAnswers({});
      setSubmitted(false);
      setResult(null);
      setMode('taking');
    } catch (e) {
      setError(`Could not start attempt: ${e.message}`);
    } finally {
      setStartingNew(false);
      setLoading(false);
    }
  };

  const handleAnswer = (questionId, value) => {
    setAnswers(p => ({ ...p, [questionId]: value }));
  };

  const handleSubmit = async () => {
    if (!attempt) return;
    const answersArray = (assessment.questions || []).map(q => ({
      question_id: q.id,
      answer_text: answers[q.id] || '',
    }));
    setSubmitting(true);
    try {
      const res = await api.post(`/training/assessments/${assessmentId}/submit`, { answers: answersArray });
      setResult(res);
      setSubmitted(true);
      setMode('result');
      api.get(`/training/assessments/${assessmentId}/attempts`).then(setPastAttempts).catch(() => {});
    } catch (e) {
      // AI evaluation can take 30-90s — the server may have finished even if the
      // network request timed out. Try to recover by re-fetching attempts.
      try {
        const attempts = await api.get(`/training/assessments/${assessmentId}/attempts`);
        const evaluated = attempts.find(at => at.status === 'evaluated' || at.status === 'submitted');
        if (evaluated) {
          setPastAttempts(attempts);
          setResult(evaluated);
          setSubmitted(true);
          setMode('result');
          return;
        }
      } catch (_) { /* ignore */ }
      setError(`Submission failed: ${e.message}. Please go back and try again — your progress may have been saved.`);
    } finally {
      setSubmitting(false);
    }
  };

  const answeredCount = (assessment?.questions || []).filter(q => (answers[q.id] || '').trim()).length;
  const totalCount = assessment?.questions?.length || 0;

  if (loading || mode === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: TEAL }} />
        <p className="text-sm text-gray-500">Loading assessment…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <BackButton to="/training/ai-assessments" label="Back to Assessments" />
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700">{error}</div>
      </div>
    );
  }

  // ── RESULT screen (just submitted) ──────────────────────────────────────────
  if (mode === 'result' && result) {
    const passed = result.passed;
    const score = result.score ?? 0;
    const feedback = result.ai_feedback?.overall || '';

    return (
      <div className="space-y-6">
        <BackButton to="/training/ai-assessments" label="Back to Assessments" />

        <div className={`rounded-2xl p-6 text-white ${score >= 90 ? 'bg-gradient-to-r from-amber-500 to-yellow-500' : score >= 80 ? 'bg-gradient-to-r from-purple-500 to-indigo-600' : passed ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 'bg-gradient-to-r from-amber-500 to-orange-500'}`}>
          <div className="flex items-center gap-4">
            {score >= 90 ? <Trophy className="w-12 h-12 text-yellow-300" /> : passed ? <Trophy className="w-12 h-12 text-white/80" /> : <AlertTriangle className="w-12 h-12 text-white/80" />}
            <div>
              <h1 className="text-2xl font-bold">
                {score === 100 ? '🌟 Perfect Score!' : score >= 90 ? '🏆 Trophy Earned!' : score >= 80 ? '🏅 Badge Earned!' : passed ? '🎉 You Passed!' : 'Keep Practicing'}
              </h1>
              {score >= 90 && (
                <span className="inline-block text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full mt-1">🏆 Trophy</span>
              )}
              {score >= 80 && score < 90 && (
                <span className="inline-block text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full mt-1">🏅 Badge</span>
              )}
              <p className="text-white/80 text-sm mt-0.5">{assessment?.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-6 mt-5">
            <div className="text-center">
              <p className="text-3xl font-black">{Math.round(score)}<span className="text-lg font-semibold">/100</span></p>
              <p className="text-xs text-white/70 mt-1">Your Score</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold">{assessment?.pass_threshold}%</p>
              <p className="text-xs text-white/70 mt-1">Pass Threshold</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold">#{result.attempt_number}</p>
              <p className="text-xs text-white/70 mt-1">Attempt</p>
            </div>
          </div>
        </div>

        {feedback && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-800 mb-2">🤖 AI Feedback</h3>
            <p className="text-sm text-gray-700 leading-relaxed">{feedback}</p>
          </div>
        )}

        <AttemptCard attempt={result} questions={assessment?.questions || []} defaultOpen={true} />

        <div className="flex gap-3">
          {!passed && (
            <button
              onClick={startAttempt}
              disabled={startingNew}
              className="flex-1 py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: ORANGE }}>
              {startingNew ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
              {startingNew ? 'Preparing new questions…' : 'Try Again'}
            </button>
          )}
          <button
            onClick={() => setMode('history')}
            className="flex-1 py-3 rounded-xl text-gray-700 font-semibold text-sm border border-gray-200 hover:bg-gray-50 flex items-center justify-center gap-2">
            <History className="w-4 h-4" /> View All Attempts
          </button>
        </div>
      </div>
    );
  }

  // ── HISTORY screen ───────────────────────────────────────────────────────────
  if (mode === 'history') {
    const hasPassed = pastAttempts.some(a => a.passed);
    const bestScore = pastAttempts.length > 0
      ? Math.max(...pastAttempts.filter(a => a.score != null).map(a => a.score))
      : null;

    return (
      <div className="space-y-6">
        <BackButton to="/training/ai-assessments" label="Back to Assessments" />

        <div className="rounded-2xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${TEAL}, #134e4a)` }}>
          <h1 className="text-xl font-bold mb-1">{assessment?.title}</h1>
          <p className="text-teal-100 text-sm">
            {totalCount} questions · Pass at {assessment?.pass_threshold}%
          </p>
          {pastAttempts.length > 0 && (
            <div className="flex items-center gap-4 mt-3">
              <span className="text-sm text-teal-200">{pastAttempts.length} attempt{pastAttempts.length > 1 ? 's' : ''}</span>
              {bestScore != null && <span className="text-sm font-bold text-white">Best: {Math.round(bestScore)}/100</span>}
              {hasPassed && <span className="text-sm font-bold text-yellow-300">🏆 Passed!</span>}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <History className="w-4 h-4 text-gray-500" /> Attempt History
          </h2>
          {(() => {
            const failedCount = pastAttempts.filter(a => a.status === 'evaluated' && !a.passed).length;
            const attemptLimitReached = !hasPassed && failedCount >= 3;
            if (hasPassed) return null; // hide button when already passed
            if (attemptLimitReached) {
              const reqStatus = assessment?.attempt_request_status;
              if (reqStatus === 'approved') {
                return (
                  <button
                    onClick={startAttempt}
                    disabled={startingNew}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50"
                    style={{ background: '#10b981' }}>
                    {startingNew ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                    {startingNew ? 'Preparing new questions…' : 'Start Approved Attempt →'}
                  </button>
                );
              }
              if (reqStatus === 'pending') {
                return (
                  <span className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl">
                    <Send className="w-4 h-4" /> Request Pending…
                  </span>
                );
              }
              if (reqStatus === 'rejected') {
                return (
                  <button
                    onClick={async () => {
                      try { await api.post(`/training/assessments/${assessmentId}/request-attempt`, {}); setAssessment(a => ({...a, attempt_request_status: 'pending'})); }
                      catch (e) {}
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border-2 border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-all">
                    <Send className="w-4 h-4" /> Re-request New Attempt
                  </button>
                );
              }
              return (
                <button
                  onClick={async () => {
                    if (requestingSent) return;
                    try {
                      await api.post(`/training/assessments/${assessmentId}/request-attempt`, {});
                      setRequestingSent(true);
                      setAssessment(a => ({...a, attempt_request_status: 'pending'}));
                    } catch (e) { setRequestingSent(true); }
                  }}
                  disabled={requestingSent}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border-2 border-amber-400 text-amber-700 bg-amber-50 disabled:opacity-60 disabled:cursor-not-allowed transition-all hover:bg-amber-100">
                  <Send className="w-4 h-4" />
                  {requestingSent ? 'Request Sent ✓' : 'Request New Attempt from Manager'}
                </button>
              );
            }
            return (
              <button
                onClick={startAttempt}
                disabled={startingNew}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50"
                style={{ background: ORANGE }}>
                {startingNew ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                {startingNew ? 'Preparing new questions…' : 'Start New Attempt'}
              </button>
            );
          })()}
        </div>

        {pastAttempts.length === 0 ? (
          <div className="text-center py-12 bg-white border border-gray-100 rounded-2xl">
            <PlayCircle className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No attempts yet</p>
            <p className="text-sm text-gray-400 mt-1">Click "Start New Attempt" to begin.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pastAttempts.map((att, idx) => (
              <AttemptCard
                key={att.id}
                attempt={att}
                questions={assessment?.questions || []}
                defaultOpen={idx === 0}
              />
            ))}
          </div>
        )}
        {!hasPassed && pastAttempts.filter(a => a.status === 'evaluated' && !a.passed).length >= 3 && (
          <>
            {assessment?.attempt_request_status === 'pending' && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
                <Send className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-800">Request sent — awaiting manager approval</p>
                  <p className="text-xs text-blue-700 mt-0.5">Your manager will review your request and unlock a new attempt if approved.</p>
                </div>
              </div>
            )}
            {assessment?.attempt_request_status === 'approved' && (
              <div className="bg-emerald-50 border border-emerald-300 rounded-xl px-4 py-3 flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Request approved! Start your new attempt above.</p>
                  <p className="text-xs text-emerald-700 mt-0.5">Your manager has unlocked one more attempt for you.</p>
                </div>
              </div>
            )}
            {assessment?.attempt_request_status === 'rejected' && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
                <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Request rejected</p>
                  <p className="text-xs text-red-600 mt-0.5">Your manager has declined the request. Please speak with them for guidance.</p>
                </div>
              </div>
            )}
            {!assessment?.attempt_request_status && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Attempt limit reached</p>
                  <p className="text-xs text-amber-700 mt-0.5">You have used all 3 attempts. Click "Request New Attempt from Manager" above to ask your manager to unlock another try.</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ── TAKING screen ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      <div className="rounded-2xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${TEAL}, #134e4a)` }}>
        <h1 className="text-xl font-bold mb-1">{assessment?.title}</h1>
        <p className="text-teal-100 text-sm">
          {totalCount} questions ({assessment?.mcq_count} MCQ + {assessment?.written_count} Descriptive) · Pass at {assessment?.pass_threshold}%
        </p>
        {attempt && <p className="text-teal-200 text-xs mt-1">Attempt #{attempt.attempt_number}</p>}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex items-center gap-4">
        <div className="flex-1">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ background: TEAL, width: `${totalCount ? (answeredCount / totalCount) * 100 : 0}%` }} />
          </div>
        </div>
        <p className="text-sm font-medium text-gray-700 shrink-0">{answeredCount} / {totalCount} answered</p>
      </div>

      <div className="space-y-5">
        {(assessment?.questions || []).map((q, idx) => (
          <div key={q.id} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: answers[q.id]?.trim() ? TEAL : '#94a3b8' }}>
                {idx + 1}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${q.question_type === 'mcq' ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'}`}>
                    {q.question_type === 'mcq' ? 'MCQ' : 'Descriptive'}
                  </span>
                  {q.difficulty && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${q.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' : q.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {q.difficulty === 'easy' ? '🟢 Easy' : q.difficulty === 'medium' ? '🟡 Medium' : '🔴 Hard'}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-900 leading-relaxed">{q.question_text}</p>
              </div>
            </div>

            {q.question_type === 'mcq' && Array.isArray(q.options) ? (
              <div className="ml-10 space-y-2">
                {q.options.map((opt, oi) => {
                  const letter = opt.charAt(0);
                  const selected = answers[q.id] === letter;
                  return (
                    <button key={oi} onClick={() => handleAnswer(q.id, letter)}
                      className={`w-full text-left px-4 py-2.5 rounded-lg text-sm border transition-all ${selected ? 'text-white border-transparent' : 'border-gray-200 text-gray-700 hover:border-teal-300 hover:bg-teal-50'}`}
                      style={selected ? { background: TEAL, borderColor: TEAL } : {}}>
                      {opt}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="ml-10">
                <textarea value={answers[q.id] || ''} onChange={e => handleAnswer(q.id, e.target.value)} rows={4}
                  placeholder="Write your answer here…"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-400" />
              </div>
            )}
          </div>
        ))}
      </div>

      <button onClick={handleSubmit} disabled={submitting || answeredCount === 0}
        className="w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50"
        style={{ background: ORANGE }}>
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> AI is evaluating your answers… this may take up to 60 seconds
          </span>
        ) : (
          `Submit Assessment (${answeredCount}/${totalCount} answered)`
        )}
      </button>
    </div>
  );
}

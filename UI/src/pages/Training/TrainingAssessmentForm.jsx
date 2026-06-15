/**
 * New Joiner: Take an AI-generated training assessment.
 * Route: /training/ai-assessments/:assessmentId
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import BackButton from '../../components/shared/BackButton';
import { Loader2, CheckCircle2, XCircle, Trophy, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

const ORANGE = '#F05A28';
const TEAL = '#0d9488';

export default function TrainingAssessmentForm() {
  const { assessmentId } = useParams();
  const navigate = useNavigate();

  const [assessment, setAssessment] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({}); // { question_id: answer_text }
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [expandedAnswer, setExpandedAnswer] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const a = await api.get(`/training/assessments/${assessmentId}`);
        setAssessment(a);

        // Start or resume attempt
        const att = await api.post(`/training/assessments/${assessmentId}/start`, {});
        setAttempt(att);

        if (att.status === 'evaluated' || att.status === 'submitted') {
          setResult(att);
          setSubmitted(true);
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [assessmentId]);

  const handleAnswer = (questionId, value) => {
    setAnswers((p) => ({ ...p, [questionId]: value }));
  };

  const handleSubmit = async () => {
    if (!attempt) return;
    const answersArray = (assessment.questions || []).map((q) => ({
      question_id: q.id,
      answer_text: answers[q.id] || '',
    }));
    setSubmitting(true);
    try {
      const res = await api.post(`/training/assessments/${assessmentId}/submit`, { answers: answersArray });
      setResult(res);
      setSubmitted(true);
    } catch (e) {
      setError(`Submission failed: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const answeredCount = (assessment?.questions || []).filter((q) => (answers[q.id] || '').trim()).length;
  const totalCount = assessment?.questions?.length || 0;

  if (loading) {
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

  if (submitted && result) {
    const passed = result.passed;
    const score = result.score ?? 0;
    const feedback = result.ai_feedback?.overall || '';
    const answerMap = {};
    (result.answers || []).forEach((a) => { answerMap[a.question_id] = a; });

    return (
      <div className="space-y-6">
        <BackButton to="/training/ai-assessments" label="Back to Assessments" />

        <div className={`rounded-2xl p-6 text-white ${passed ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 'bg-gradient-to-r from-amber-500 to-orange-500'}`}>
          <div className="flex items-center gap-4">
            {passed
              ? <Trophy className="w-12 h-12 text-yellow-300" />
              : <AlertTriangle className="w-12 h-12 text-white/80" />}
            <div>
              <h1 className="text-2xl font-bold">{passed ? '🎉 You Passed!' : 'Keep Practising'}</h1>
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
              <p className="text-xl font-bold">{result.attempt_number}</p>
              <p className="text-xs text-white/70 mt-1">Attempt #{result.attempt_number}</p>
            </div>
          </div>
        </div>

        {feedback && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-800 mb-2">🤖 AI Feedback</h3>
            <p className="text-sm text-gray-700 leading-relaxed">{feedback}</p>
          </div>
        )}

        {/* Per-answer breakdown */}
        {assessment?.questions?.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="font-semibold text-gray-800">Answer Breakdown</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {assessment.questions.map((q) => {
                const ev = answerMap[q.id];
                const flag = ev?.ai_flag;
                const isOpen = expandedAnswer === q.id;
                return (
                  <div key={q.id} className="px-5 py-4">
                    <button
                      onClick={() => setExpandedAnswer(isOpen ? null : q.id)}
                      className="w-full flex items-start justify-between gap-3 text-left">
                      <div className="flex items-start gap-3">
                        {flag === 'correct' && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />}
                        {flag === 'wrong' && <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />}
                        {flag === 'partial' && <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />}
                        {!flag && <div className="w-5 h-5 rounded-full border-2 border-gray-300 shrink-0 mt-0.5" />}
                        <div>
                          <p className="text-sm font-medium text-gray-900">{q.question_text}</p>
                          <span className={`text-xs font-medium ${q.question_type === 'mcq' ? 'text-indigo-600' : 'text-teal-600'}`}>
                            {q.question_type === 'mcq' ? 'MCQ' : 'Written'}
                          </span>
                        </div>
                      </div>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                    </button>

                    {isOpen && (
                      <div className="mt-3 ml-8 space-y-2">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs font-medium text-gray-500 mb-1">Your answer:</p>
                          <p className="text-sm text-gray-800">{ev?.answer_text || '(no answer)'}</p>
                        </div>
                        {ev?.ai_explanation && (
                          <div className={`rounded-lg p-3 ${flag === 'correct' ? 'bg-emerald-50 border border-emerald-200' : flag === 'wrong' ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
                            <p className="text-xs font-medium mb-1" style={{ color: flag === 'correct' ? '#065f46' : flag === 'wrong' ? '#991b1b' : '#92400e' }}>AI explanation:</p>
                            <p className="text-sm" style={{ color: flag === 'correct' ? '#047857' : flag === 'wrong' ? '#b91c1c' : '#b45309' }}>{ev.ai_explanation}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!passed && (
          <button
            onClick={() => { setSubmitted(false); setResult(null); setAnswers({}); setAttempt(null); setLoading(true);
              api.post(`/training/assessments/${assessmentId}/start`, {}).then((att) => { setAttempt(att); setLoading(false); }).catch(() => setLoading(false));
            }}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm"
            style={{ background: ORANGE }}>
            Try Again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackButton to="/training/ai-assessments" label="Back to Assessments" />

      {/* Header */}
      <div className="rounded-2xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${TEAL}, #134e4a)` }}>
        <h1 className="text-xl font-bold mb-1">{assessment?.title}</h1>
        <p className="text-teal-100 text-sm">
          {totalCount} questions ({assessment?.mcq_count} MCQ + {assessment?.written_count} written) · Pass at {assessment?.pass_threshold}%
        </p>
        {attempt && (
          <p className="text-teal-200 text-xs mt-1">Attempt #{attempt.attempt_number}</p>
        )}
      </div>

      {/* Progress */}
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex items-center gap-4">
        <div className="flex-1">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ background: TEAL, width: `${totalCount ? (answeredCount / totalCount) * 100 : 0}%` }} />
          </div>
        </div>
        <p className="text-sm font-medium text-gray-700 shrink-0">{answeredCount} / {totalCount} answered</p>
      </div>

      {/* Questions */}
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
                    {q.question_type === 'mcq' ? 'MCQ' : 'Written'}
                  </span>
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
                    <button
                      key={oi}
                      onClick={() => handleAnswer(q.id, letter)}
                      className={`w-full text-left px-4 py-2.5 rounded-lg text-sm border transition-all ${selected ? 'text-white border-transparent' : 'border-gray-200 text-gray-700 hover:border-teal-300 hover:bg-teal-50'}`}
                      style={selected ? { background: TEAL, borderColor: TEAL } : {}}>
                      {opt}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="ml-10">
                <textarea
                  value={answers[q.id] || ''}
                  onChange={(e) => handleAnswer(q.id, e.target.value)}
                  rows={4}
                  placeholder="Write your answer here…"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-400"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting || answeredCount === 0}
        className="w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50"
        style={{ background: ORANGE }}>
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> AI is evaluating your answers…
          </span>
        ) : (
          `Submit Assessment (${answeredCount}/${totalCount} answered)`
        )}
      </button>
    </div>
  );
}

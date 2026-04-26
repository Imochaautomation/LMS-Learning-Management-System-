import { useState, useEffect, useRef } from 'react';
import api, { API_HOST } from '../../api/client';
import BackButton from '../../components/shared/BackButton';
import {
  Download, Upload, CheckCircle2, Clock, Loader2, ChevronDown, ChevronUp,
  FileSearch, Printer, X, Award, Trophy, FileText
} from 'lucide-react';
import { ToastContainer, useToast } from '../../components/shared/Toast';

const sanitizeReview = (text) => {
  if (!text) return text;
  return text
    .replace(/\bstudent\b/gi, 'professional')
    .replace(/\bstudents\b/gi, 'professionals')
    .replace(/\bStudent\b/g, 'Professional')
    .replace(/\bStudents\b/g, 'Professionals');
};

const parseAiSummary = (ai_summary) => {
  if (!ai_summary) return null;
  try {
    const parsed = JSON.parse(ai_summary);
    if (typeof parsed === 'object' && parsed.summary) return parsed;
  } catch (_) { }
  return { summary: ai_summary, grammar_mistakes: [], wrong_answers: [], missed_questions: [], strengths: [], areas_of_improvement: [], detailed_feedback: '' };
};

const statusLabel = { pending: 'Pending', downloaded: 'Downloaded', submitted: 'Submitted', reviewed: 'Reviewed' };
const statusColor = {
  pending: 'bg-gray-100 text-gray-600 border-gray-200',
  downloaded: 'bg-blue-50 text-blue-700 border-blue-200',
  submitted: 'bg-amber-50 text-amber-700 border-amber-200',
  reviewed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function FeedbackModal({ a, onClose }) {
  const parsed = parseAiSummary(a.ai_summary);
  const score = a.score || 0;
  const grammarMistakes = parsed?.grammar_mistakes || [];
  const wrongAnswers = parsed?.wrong_answers || [];
  const missedQuestions = parsed?.missed_questions || [];
  const strengths = parsed?.strengths || [];
  const areasOfImprovement = parsed?.areas_of_improvement || [];
  const detailedFeedback = parsed?.detailed_feedback || '';
  const qAnswered = parsed?.questions_answered;
  const qTotal = parsed?.questions_total;
  const isInvalid = parsed?.authentic === false;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div>
            <h2 className="font-bold text-gray-900">📄 Detailed Assessment Feedback Report</h2>
            <p className="text-xs text-gray-500 mt-0.5">{a.assessment_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
              <Printer className="w-4 h-4" /> Print / PDF
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-6 space-y-5">
          {isInvalid && (
            <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-bold text-red-700">Submission Mismatch Detected</p>
                <p className="text-sm text-red-600 mt-1">
                  {parsed?.submission_mismatch_reason || 'The submitted file does not appear to be a genuine attempt at this assessment. The score has been capped accordingly.'}
                </p>
              </div>
            </div>
          )}

          {/* Score cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500">Score</p>
              <p className={`text-2xl font-bold mt-0.5 ${score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{score}/100</p>
            </div>
            {qAnswered != null && qTotal != null && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500">Questions Answered</p>
                <p className="text-2xl font-bold mt-0.5 text-indigo-600">{qAnswered}/{qTotal}</p>
              </div>
            )}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500">Grammar Errors</p>
              <p className={`text-2xl font-bold mt-0.5 ${grammarMistakes.length > 3 ? 'text-red-600' : grammarMistakes.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{grammarMistakes.length}</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500">Wrong Answers</p>
              <p className={`text-2xl font-bold mt-0.5 ${wrongAnswers.length > 2 ? 'text-red-600' : wrongAnswers.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{wrongAnswers.length}</p>
            </div>
          </div>

          {/* Meta */}
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 text-sm grid grid-cols-2 gap-2">
            <div><span className="text-gray-500">Assessment:</span> <span className="font-semibold ml-1">{a.assessment_name}</span></div>
            <div><span className="text-gray-500">Submitted:</span> <span className="font-semibold ml-1">{a.submitted_at ? new Date(a.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span></div>
            <div><span className="text-gray-500">File:</span> <span className="font-semibold ml-1">{a.submission_file || '—'}</span></div>
            <div><span className="text-gray-500">Result:</span> <span className={`font-semibold ml-1 ${score >= 70 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{score >= 70 ? 'Pass' : score >= 50 ? 'Borderline' : 'Fail'}</span></div>
          </div>

          {/* Performance Breakdown */}
          <div className="border border-gray-200 rounded-xl p-5">
            <h3 className="font-bold text-gray-800 mb-3">📊 Performance Breakdown</h3>
            <div className="space-y-3">
              {[
                { label: 'Content Relevance', desc: 'Did the submission answer the actual assessment questions?', max: 30, score: parsed?.content_relevance_score ?? Math.round(score * 0.30) },
                { label: 'Completeness', desc: 'Were all questions/tasks attempted?', max: 25, score: parsed?.completeness_score ?? Math.round(score * 0.25) },
                { label: 'Grammar & Language', desc: 'Quality of writing, grammar, punctuation, sentence structure', max: 20, score: parsed?.grammar_score ?? Math.round(score * 0.20) },
                { label: 'Accuracy & Correctness', desc: 'Were the answers factually/technically correct?', max: 25, score: parsed?.accuracy_score ?? Math.round(score * 0.25) },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <div>
                      <span className="font-semibold text-gray-700">{item.label}</span>
                      <span className="text-gray-400 ml-2">{item.desc}</span>
                    </div>
                    <span className="font-bold text-gray-700 shrink-0 ml-2">{item.score}/{item.max}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${(item.score / item.max) >= 0.8 ? 'bg-emerald-500' : (item.score / item.max) >= 0.6 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${(item.score / item.max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Overall Summary */}
          <div className="border border-indigo-100 rounded-xl p-5 bg-indigo-50">
            <h3 className="font-bold text-indigo-800 mb-2 flex items-center gap-2">🤖 AI Overall Assessment</h3>
            <p className="text-sm text-gray-700 leading-relaxed">{sanitizeReview(parsed?.summary || '')}</p>
          </div>

          {/* Grammar Mistakes */}
          {grammarMistakes.length > 0 && (
            <div className="border border-orange-200 rounded-xl p-5 bg-orange-50">
              <h3 className="font-bold text-orange-800 mb-3 flex items-center gap-2">✏️ Grammar & Language Errors ({grammarMistakes.length})</h3>
              <div className="space-y-3">
                {grammarMistakes.map((m, i) => (
                  <div key={i} className="bg-white border border-orange-100 rounded-lg p-3">
                    <p className="text-xs font-semibold text-orange-700 mb-1">📍 {m.location}</p>
                    <p className="text-sm text-red-700"><span className="font-semibold">Error:</span> {m.error}</p>
                    {m.correction && <p className="text-sm text-emerald-700 mt-1"><span className="font-semibold">Correction:</span> {m.correction}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Wrong Answers */}
          {wrongAnswers.length > 0 && (
            <div className="border border-red-200 rounded-xl p-5 bg-red-50">
              <h3 className="font-bold text-red-800 mb-3 flex items-center gap-2">❌ Incorrect Answers ({wrongAnswers.length})</h3>
              <div className="space-y-3">
                {wrongAnswers.map((w, i) => (
                  <div key={i} className="bg-white border border-red-100 rounded-lg p-4">
                    <p className="text-xs font-bold text-gray-700 mb-2">📋 {w.question}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div className="bg-red-50 border border-red-100 rounded-lg p-2">
                        <p className="text-xs font-semibold text-red-600 mb-0.5">Your Answer:</p>
                        <p className="text-red-800">{w.learner_answer || '—'}</p>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2">
                        <p className="text-xs font-semibold text-emerald-600 mb-0.5">Correct Answer:</p>
                        <p className="text-emerald-800">{w.correct_answer || '—'}</p>
                      </div>
                    </div>
                    {w.explanation && <p className="text-xs text-gray-600 mt-2 bg-gray-50 rounded p-2">💡 {w.explanation}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Missed Questions */}
          {missedQuestions.length > 0 && (
            <div className="border border-gray-300 rounded-xl p-5 bg-gray-50">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">⏭️ Missed / Unanswered Questions ({missedQuestions.length})</h3>
              <ul className="space-y-2">
                {missedQuestions.map((q, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg p-3">
                    <span className="text-gray-400 shrink-0">•</span> {q}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Detailed feedback */}
          {detailedFeedback && (
            <div className="border border-slate-200 rounded-xl p-5 bg-slate-50">
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">📝 Detailed Question-by-Question Feedback</h3>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{sanitizeReview(detailedFeedback)}</p>
            </div>
          )}

          {/* Strengths */}
          {strengths.length > 0 && (
            <div className="border border-emerald-200 rounded-xl p-5 bg-emerald-50">
              <h3 className="font-bold text-emerald-800 mb-3 flex items-center gap-2">💪 What You Did Well</h3>
              <ul className="space-y-2">
                {strengths.map((s, i) => <li key={i} className="flex items-start gap-2 text-sm text-emerald-700"><span className="text-emerald-500 shrink-0 mt-0.5">✓</span>{s}</li>)}
              </ul>
            </div>
          )}

          {/* Areas of Improvement */}
          {areasOfImprovement.length > 0 && (
            <div className="border border-amber-200 rounded-xl p-5 bg-amber-50">
              <h3 className="font-bold text-amber-800 mb-3 flex items-center gap-2">🎯 Areas to Improve</h3>
              <ul className="space-y-2">
                {areasOfImprovement.map((a, i) => <li key={i} className="flex items-start gap-2 text-sm text-amber-700"><span className="text-amber-500 shrink-0 mt-0.5">→</span>{a}</li>)}
              </ul>
            </div>
          )}

          {score < 60 && (
            <div className="border border-red-200 rounded-xl p-4 bg-red-50">
              <h3 className="font-bold text-red-700 mb-2">⚠️ Action Required</h3>
              <p className="text-sm text-red-700">This submission scored below 60. Review the errors above, revisit the assessment material, and resubmit for a better evaluation.</p>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center">Generated by LMS AI Review System · {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}

export default function UpskillAssessments() {
  const [assessments, setAssessments] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [uploading, setUploading] = useState(null);
  const [feedbackModal, setFeedbackModal] = useState(null);
  const fileRef = useRef();
  const { toasts, removeToast, toast } = useToast();

  useEffect(() => {
    api.get('/assessments/my').then(setAssessments).catch(() => {});
  }, []);

  const handleDownload = async (a) => {
    if (a.status === 'pending') {
      await api.patch(`/assessments/${a.id}/status?status=downloaded`).catch(() => {});
      setAssessments((prev) => prev.map((x) => x.id === a.id ? { ...x, status: 'downloaded' } : x));
    }
    if (a.assessment_file_path) {
      window.open(`${API_HOST}${a.assessment_file_path}`, '_blank');
    } else {
      toast.warning('No assessment file attached. Please contact your manager.');
    }
  };

  const handleUpload = async (a) => {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.warning('Please select a file first.'); return; }
    setUploading(a.id);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.upload(`/assessments/${a.id}/submit`, fd);
      setAssessments((prev) => prev.map((x) => x.id === a.id ? { ...x, status: 'submitted', ai_summary: res.ai_summary, score: res.score } : x));
      fileRef.current.value = '';
      toast.success('Assessment submitted successfully!');
    } catch (e) { toast.error(`Failed to submit: ${e.message}`); }
    finally { setUploading(null); }
  };

  const pending = assessments.filter((a) => a.status !== 'reviewed' && a.status !== 'submitted');
  const completed = assessments.filter((a) => a.status === 'reviewed' || a.status === 'submitted');

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {feedbackModal && <FeedbackModal a={feedbackModal} onClose={() => setFeedbackModal(null)} />}

      <BackButton to="/upskilling" label="Back to Dashboard" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Assessments</h1>
          <p className="text-sm text-gray-500 mt-1">Assessments assigned by your manager, with AI-powered detailed feedback.</p>
        </div>
        {completed.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-xl font-bold text-purple-600">{completed.filter(a => a.score >= 90).length}</div>
              <div className="text-xs text-gray-400">Badges</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-amber-500">{completed.filter(a => a.score >= 95).length}</div>
              <div className="text-xs text-gray-400">Trophies</div>
            </div>
          </div>
        )}
      </div>

      {assessments.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No assessments assigned yet</p>
          <p className="text-sm text-gray-400 mt-1">Your manager will assign assessments based on your profile.</p>
        </div>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Pending</h2>
          <div className="space-y-3">
            {pending.map((a) => (
              <div key={a.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <button onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-amber-500 shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{a.assessment_name}</p>
                      <p className="text-xs text-gray-400">Assigned by {a.assigner_name} · {new Date(a.assigned_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${statusColor[a.status]}`}>{statusLabel[a.status]}</span>
                    {expanded === a.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>
                {expanded === a.id && (
                  <div className="border-t border-gray-100 px-5 py-5 space-y-4">
                    {a.note && <p className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">📌 Note: {a.note}</p>}
                    <button onClick={() => handleDownload(a)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
                      <Download className="w-4 h-4" /> Download Assessment File
                    </button>
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-600">Upload Your Completed Work</label>
                      <input ref={fileRef} type="file" accept=".doc,.docx,.xlsx,.xls,.pdf"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-indigo-100 file:text-indigo-700" />
                      <button disabled={uploading === a.id} onClick={() => handleUpload(a)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                        {uploading === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {uploading === a.id ? 'Submitting...' : 'Submit'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Submitted / Reviewed</h2>
          <div className="space-y-4">
            {completed.map((a) => {
              const parsed = parseAiSummary(a.ai_summary);
              const isInvalid = parsed?.authentic === false;
              const gCount = parsed?.grammar_mistakes?.length || 0;
              const wCount = parsed?.wrong_answers?.length || 0;
              const score = a.score || 0;

              return (
                <div key={a.id} className={`rounded-xl overflow-hidden border-2 ${isInvalid ? 'border-red-200 bg-red-50/20' : score >= 80 ? 'border-emerald-200 bg-emerald-50/20' : score >= 60 ? 'border-amber-200 bg-white' : 'border-gray-200 bg-white'}`}>
                  <button onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50/50">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${isInvalid ? 'bg-red-100 text-red-700' : score >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {isInvalid ? '⚠️' : score >= 80 ? '✅' : score}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{a.assessment_name}</p>
                        <p className="text-xs text-gray-400">Assigned by {a.assigner_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {isInvalid && <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 border border-red-200 rounded-full font-semibold">⚠️ Mismatch</span>}
                      {!isInvalid && gCount > 0 && <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 border border-orange-200 rounded-full">{gCount} grammar err</span>}
                      {!isInvalid && wCount > 0 && <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 border border-red-200 rounded-full">{wCount} wrong ans</span>}
                      {!isInvalid && gCount === 0 && wCount === 0 && score >= 70 && <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full">✓ No errors</span>}
                      {score > 0 && <span className={`text-sm font-bold ${score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{score}/100</span>}
                      {score >= 95 && <span className="text-lg">🏆</span>}
                      {score >= 90 && score < 95 && <span className="text-lg">🏅</span>}
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${statusColor[a.status]}`}>{statusLabel[a.status]}</span>
                      {expanded === a.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>

                  {expanded === a.id && (
                    <div className="border-t border-gray-100 px-5 py-5 space-y-4">
                      {/* Score ring + summary */}
                      {a.ai_summary && (
                        <div className="flex items-start gap-5">
                          <div className="relative w-20 h-20 shrink-0">
                            <svg viewBox="0 0 36 36" className="w-full h-full">
                              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none" stroke="#e5e7eb" strokeWidth="3" />
                              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none" stroke={score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'}
                                strokeWidth="3" strokeDasharray={`${score}, 100`} strokeLinecap="round" />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-lg font-bold text-gray-900">{score}</span>
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3">
                              <p className="text-xs font-semibold text-indigo-700 mb-1">🤖 AI Summary</p>
                              <p className="text-sm text-gray-700 line-clamp-3">{sanitizeReview(parsed?.summary || a.ai_summary)}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Submission file link */}
                      {a.submission_file && (
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-indigo-500" />
                          <a href={a.submission_path ? `${API_HOST}${a.submission_path}` : '#'} target="_blank"
                            className="text-sm text-indigo-600 hover:underline font-medium">{a.submission_file}</a>
                          <span className="text-xs text-gray-400">— View your submitted work</span>
                        </div>
                      )}

                      {/* View detailed report button */}
                      {a.ai_summary && (
                        <button onClick={() => setFeedbackModal(a)}
                          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors">
                          <FileSearch className="w-4 h-4" /> View Detailed Feedback Report
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

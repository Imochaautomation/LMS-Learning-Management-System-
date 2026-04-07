import { useState, useEffect, useRef } from 'react';
import api, { API_HOST } from '../../api/client';
import BackButton from '../../components/shared/BackButton';
import {
  Download, Upload, ChevronDown, ChevronUp, CheckCircle2, Clock, FileText, ExternalLink,
  Loader2, Award, Lock, Swords, Shield, Trophy, Star, FileSearch, Printer, X
} from 'lucide-react';
import { ToastContainer, useToast } from '../../components/shared/Toast';

// Replace unprofessional terminology
const sanitizeReview = (text) => {
  if (!text) return text;
  return text
    .replace(/\bstudent\b/gi, 'professional')
    .replace(/\bstudents\b/gi, 'professionals')
    .replace(/\bStudent\b/g, 'Professional')
    .replace(/\bStudents\b/g, 'Professionals');
};

const questIcons = ['⚔️', '🛡️', '🏹', '🗡️', '🔮'];
const questBadges = {
  reviewed: { label: '✅ Quest Complete', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  submitted: { label: '📨 Submitted', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  downloaded: { label: '📥 Downloaded', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
  pending: { label: '⚔️ Active Quest', bg: 'bg-orange-50 text-orange-700 border-orange-200' },
};

function AccuracyBadge({ score }) {
  if (score >= 95) return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
      <Trophy className="w-3 h-3" /> 🏆 Trophy
    </span>
  );
  if (score >= 90) return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
      <Award className="w-3 h-3" /> 🏅 Badge
    </span>
  );
  return null;
}

export default function TrainingAssessments() {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [uploading, setUploading] = useState(null);
  const [feedbackModal, setFeedbackModal] = useState(null);
  const fileRef = useRef();
  const { toasts, removeToast, toast } = useToast();

  useEffect(() => {
    api.get('/assessments/my').then(setAssessments).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleDownload = async (a) => {
    // Update status to downloaded
    if (a.status === 'pending') {
      await api.patch(`/assessments/${a.id}/status?status=downloaded`).catch(() => {});
      setAssessments((prev) => prev.map((x) => x.id === a.id ? { ...x, status: 'downloaded' } : x));
    }
    // Open the file for download
    if (a.assessment_file_path) {
      window.open(`${API_HOST}${a.assessment_file_path}`, '_blank');
    } else {
      toast.warning('No assessment file attached. Please contact your manager.');
    }
  };

  const handleUpload = async (a) => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.warning('Please select a file first.');
      return;
    }
    setUploading(a.id);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.upload(`/assessments/${a.id}/submit`, fd);
      setAssessments((prev) => prev.map((x) => x.id === a.id ? { ...x, status: 'submitted', ai_summary: res.ai_summary, score: res.score } : x));
      fileRef.current.value = '';
      toast.success(`Assessment submitted successfully!`);
    } catch (e) { toast.error(`Failed to submit assessment: ${e.message}`); }
    finally { setUploading(null); }
  };

  const completed = assessments.filter((a) => a.status === 'reviewed' || a.status === 'submitted');
  const totalBadges = completed.filter(a => a.score && a.score >= 90).length;
  const totalTrophies = completed.filter(a => a.score && a.score >= 95).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <span className="ml-3 text-gray-500">Loading assessments...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <BackButton to="/training" label="Back to Dashboard" />

      {/* Quest Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">⚔️ Assessment Quests</h1>
            <p className="text-slate-300 text-sm mt-1">Complete quests to earn badges & trophies based on AI accuracy!</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">{totalBadges}</div>
              <div className="text-xs text-slate-400">Badges</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-400">{totalTrophies}</div>
              <div className="text-xs text-slate-400">Trophies</div>
            </div>
          </div>
        </div>
      </div>

      {assessments.length === 0 && (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-10 text-center">
          <Swords className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-semibold">No quests assigned yet</p>
          <p className="text-sm text-gray-400 mt-1">Your manager will assign assessment quests to you. Stay ready! 🗡️</p>
        </div>
      )}

      {/* Quest Cards */}
      <div className="space-y-4">
        {assessments.map((a, idx) => {
          const isCompleted = a.status === 'reviewed' || a.status === 'submitted';
          const isActive = a.status === 'pending' || a.status === 'downloaded';
          const badge = questBadges[a.status] || questBadges.pending;
          const icon = questIcons[idx % questIcons.length];
          const name = a.assessment_name || a.name || `Assessment ${idx + 1}`;
          const submittedDate = a.submitted_at || a.submittedDate;

          return (
            <div key={a.id} className={`rounded-xl overflow-hidden border-2 transition-all ${
              isCompleted ? 'border-emerald-200 bg-emerald-50/30' :
              isActive ? 'border-amber-200 bg-white shadow-md' :
              'border-gray-200 bg-white'
            }`}>
              <button onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                    isCompleted ? 'bg-emerald-100' : isActive ? 'bg-amber-100' : 'bg-gray-100'
                  }`}>
                    {isCompleted ? '✅' : icon}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{name}</p>
                    {submittedDate && <p className="text-xs text-gray-400">Submitted {new Date(submittedDate).toLocaleDateString()}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {a.score && a.score >= 90 && (
                    <span className="text-lg" title="Badge / Trophy">{a.score >= 95 ? '🏆' : '🏅'}</span>
                  )}
                  {isCompleted && <AccuracyBadge score={a.score} />}
                  <span className={`text-xs px-3 py-1 rounded-full font-semibold border ${badge.bg}`}>{badge.label}</span>
                  {expanded === a.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </button>

              {expanded === a.id && (
                <div className="border-t border-gray-100 px-5 py-5 space-y-5">
                  {/* Download & Upload for active quests */}
                  {isActive && (
                    <>
                      <div className="flex gap-3 flex-wrap">
                        <button onClick={() => handleDownload(a)}
                          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 shadow-sm">
                          <Download className="w-4 h-4" /> ⬇ Download Quest File
                        </button>
                      </div>

                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                        <p className="text-sm font-medium text-gray-700">📤 Submit Your Answer</p>
                        <input ref={fileRef} type="file" accept=".doc,.docx,.xlsx,.xls,.pdf"
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-indigo-100 file:text-indigo-700" />
                        <button onClick={() => handleUpload(a)}
                          disabled={uploading === a.id}
                          className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 shadow-sm disabled:opacity-50">
                          {uploading === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          {uploading === a.id ? 'Submitting...' : '⬆ Submit Quest Answer'}
                        </button>
                      </div>

                      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                        <p className="text-sm text-amber-800">
                          <strong>⚔️ Your mission:</strong> Download the quest file, complete it offline, then submit your answer to earn a badge!
                        </p>
                      </div>
                    </>
                  )}

                  {/* AI Review for completed quests */}
                  {a.ai_summary && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">🤖 AI Quest Review</h3>
                      <div className="flex items-start gap-5">
                        <div className="relative w-20 h-20 shrink-0">
                          <svg viewBox="0 0 36 36" className="w-full h-full">
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none" stroke="#e5e7eb" strokeWidth="3" />
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none" stroke={a.score >= 80 ? '#10b981' : a.score >= 60 ? '#f59e0b' : '#ef4444'}
                              strokeWidth="3" strokeDasharray={`${a.score || 0}, 100`} strokeLinecap="round" />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-lg font-bold text-gray-900">{a.score || 0}</span>
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
                            <p className="text-xs font-semibold text-emerald-700 mb-1">AI Summary</p>
                            <p className="text-sm text-gray-700">{sanitizeReview(a.ai_summary)}</p>
                          </div>
                          <button
                            onClick={() => setFeedbackModal(a)}
                            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors">
                            <FileSearch className="w-3.5 h-3.5" /> View Detailed Feedback Report
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <AccuracyBadge score={a.score} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Detailed Feedback PDF Modal */}
      {feedbackModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setFeedbackModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="font-bold text-gray-900">📄 Detailed Feedback Report</h2>
                <p className="text-xs text-gray-500 mt-0.5">{feedbackModal.assessment_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
                  <Printer className="w-4 h-4" /> Print / Save PDF
                </button>
                <button onClick={() => setFeedbackModal(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div id="feedback-print-area" className="overflow-y-auto p-6 space-y-5">
              {/* Header Info */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Assessment:</span> <span className="font-semibold">{feedbackModal.assessment_name}</span></div>
                  <div><span className="text-gray-500">Submitted:</span> <span className="font-semibold">{feedbackModal.submitted_at ? new Date(feedbackModal.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span></div>
                  <div><span className="text-gray-500">Score:</span> <span className={`font-bold text-lg ${feedbackModal.score >= 80 ? 'text-emerald-600' : feedbackModal.score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{feedbackModal.score || 0}/100</span></div>
                  <div><span className="text-gray-500">File Submitted:</span> <span className="font-semibold">{feedbackModal.submission_file || '—'}</span></div>
                </div>
              </div>

              {/* AI Detailed Review */}
              <div className="border border-indigo-100 rounded-xl p-5 bg-indigo-50">
                <h3 className="font-bold text-indigo-800 mb-3 flex items-center gap-2">🤖 AI Assessment Review</h3>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{sanitizeReview(feedbackModal.ai_summary)}</p>
              </div>

              {/* Score Breakdown */}
              <div className="border border-gray-200 rounded-xl p-5">
                <h3 className="font-bold text-gray-800 mb-3">📊 Performance Overview</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Content Relevance', max: 30, score: Math.round((feedbackModal.score || 0) * 0.30) },
                    { label: 'Completeness', max: 25, score: Math.round((feedbackModal.score || 0) * 0.25) },
                    { label: 'Quality & Accuracy', max: 25, score: Math.round((feedbackModal.score || 0) * 0.25) },
                    { label: 'Authenticity', max: 20, score: Math.round((feedbackModal.score || 0) * 0.20) },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>{item.label}</span>
                        <span className="font-semibold">{item.score}/{item.max}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            (item.score / item.max) >= 0.8 ? 'bg-emerald-500' :
                            (item.score / item.max) >= 0.6 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${(item.score / item.max) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {feedbackModal.score < 60 && (
                <div className="border border-red-200 rounded-xl p-4 bg-red-50">
                  <h3 className="font-bold text-red-700 mb-2">⚠️ Areas Requiring Attention</h3>
                  <p className="text-sm text-red-700">This submission scored below 60. Please review the feedback above, revisit the assessment material, and resubmit for a better evaluation.</p>
                </div>
              )}

              <p className="text-xs text-gray-400 text-center">Generated by LMS AI Review System · {new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

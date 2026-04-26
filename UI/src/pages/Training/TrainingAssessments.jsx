import { useState, useEffect, useRef } from 'react';
import api, { API_HOST } from '../../api/client';
import BackButton from '../../components/shared/BackButton';
import {
  Download, Upload, ChevronDown, ChevronUp, CheckCircle2, Clock, FileText, ExternalLink,
  Loader2, Award, Lock, Swords, Shield, Trophy, Star, FileSearch, Printer, X
} from 'lucide-react';
import { ToastContainer, useToast } from '../../components/shared/Toast';

function printAssessmentReport(a, parsed) {
  const score = a.score || 0;
  const grammarMistakes = parsed?.grammar_mistakes || [];
  const wrongAnswers = parsed?.wrong_answers || [];
  const missedQuestions = parsed?.missed_questions || [];
  const perQuestionMarks = parsed?.per_question_marks || [];
  const strengths = parsed?.strengths || [];
  const areasOfImprovement = parsed?.areas_of_improvement || [];
  const detailedFeedback = parsed?.detailed_feedback || '';
  const qAnswered = parsed?.questions_answered;
  const qTotal = parsed?.questions_total;
  const isInvalid = parsed?.authentic === false;
  const isProofreading = parsed?.assessment_type === 'proofreading';
  const submittedDate = a.submitted_at ? new Date(a.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
  const statusLabel = score >= 70 ? 'Pass' : score >= 50 ? 'Borderline' : 'Fail';
  const statusColor = score >= 70 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626';
  const scoreColor = score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626';

  const breakdownRows = isProofreading ? [
    { label: 'Errors Caught & Fixed', desc: 'Grammar, spelling, punctuation errors correctly identified and fixed', max: 40, val: parsed?.errors_caught_score ?? Math.round(score * 0.40) },
    { label: 'No Incorrect Edits', desc: 'Penalty for changing correct text or introducing new errors', max: 25, val: parsed?.incorrect_edits_score ?? Math.round(score * 0.25) },
    { label: 'US English Compliance', desc: 'Oxford comma, -ize/-or spellings, double quotes, em-dash usage', max: 20, val: parsed?.us_english_score ?? Math.round(score * 0.20) },
    { label: 'Completeness', desc: 'All sections of the document reviewed and addressed', max: 15, val: parsed?.completeness_score ?? Math.round(score * 0.15) },
  ] : [
    { label: 'Content Relevance', desc: 'Did the submission answer the actual assessment questions?', max: 30, val: parsed?.content_relevance_score ?? Math.round(score * 0.30) },
    { label: 'Completeness', desc: 'Were all questions/tasks attempted?', max: 25, val: parsed?.completeness_score ?? Math.round(score * 0.25) },
    { label: 'Grammar & Language', desc: 'Quality of writing, grammar, punctuation, sentence structure', max: 20, val: parsed?.grammar_score ?? Math.round(score * 0.20) },
    { label: 'Accuracy & Correctness', desc: 'Were the answers factually/technically correct?', max: 25, val: parsed?.accuracy_score ?? Math.round(score * 0.25) },
  ];

  const barHtml = (val, max) => {
    const pct = Math.min(100, Math.round((val / max) * 100));
    const col = pct >= 80 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626';
    return `<div style="background:#f1f5f9;border-radius:4px;height:8px;width:100%;margin-top:4px"><div style="width:${pct}%;background:${col};height:8px;border-radius:4px"></div></div>`;
  };

  const escHtml = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Assessment Report — ${escHtml(a.assessment_name)}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;margin:0;padding:32px;color:#1e293b;font-size:13px;line-height:1.5}
    h1{color:#4f46e5;font-size:20px;margin:0 0 4px}
    h2{font-size:14px;color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin:28px 0 12px}
    h3{font-size:13px;color:#374151;margin:0 0 8px}
    .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px}
    .meta-item{font-size:12px}.meta-item .label{color:#64748b;margin-bottom:2px;font-size:11px}.meta-item .val{font-weight:bold;color:#1e293b}
    .score-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
    .score-box{text-align:center;padding:14px 8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px}
    .score-box .label{font-size:11px;color:#64748b;margin-bottom:4px}.score-box .val{font-size:22px;font-weight:bold}
    .section{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;margin-bottom:16px}
    .error-box{background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:10px 14px;margin-bottom:8px}
    .wrong-box{background:#fff;border:1px solid #fecaca;border-radius:6px;padding:10px 14px;margin-bottom:8px}
    .wrong-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px}
    .learner-ans{background:#fef2f2;border:1px solid #fecaca;border-radius:4px;padding:6px 10px}
    .correct-ans{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:4px;padding:6px 10px}
    .strength-item{color:#166534;padding:3px 0}.improvement-item{color:#92400e;padding:3px 0}
    .missed-item{background:#fff;border:1px solid #e2e8f0;border-radius:4px;padding:6px 10px;margin-bottom:5px}
    .row-block{border-bottom:1px solid #f1f5f9;padding:10px 0}
    .row-block:last-child{border-bottom:none}
    .fix{color:#166534;font-size:12px;padding:1px 0}.miss{color:#92400e;font-size:12px;padding:1px 0}.bad{color:#991b1b;font-size:12px;padding:1px 0}
    .row-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px}
    .marks-bar{width:80px;height:6px;background:#f1f5f9;border-radius:3px;margin-top:4px}
    .mismatch{background:#fef2f2;border:2px solid #fca5a5;border-radius:8px;padding:14px;margin-bottom:16px}
    .low-score{background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:14px;margin-top:16px}
    .footer{margin-top:40px;color:#94a3b8;font-size:11px;text-align:center;border-top:1px solid #e2e8f0;padding-top:12px}
    @media print{body{padding:20px}h2{page-break-after:avoid}.section{page-break-inside:avoid}.row-block{page-break-inside:avoid}}
  </style></head><body>

  <h1>📄 Detailed Assessment Feedback Report</h1>
  <p style="color:#64748b;font-size:12px;margin:0 0 20px">${isProofreading ? 'Proofreading & Editing Evaluation' : 'Assessment Submission Evaluation'}</p>

  ${isInvalid ? `<div class="mismatch"><strong style="color:#b91c1c">⚠️ Submission Mismatch Detected</strong><p style="color:#991b1b;margin:6px 0 0;font-size:12px">${escHtml(parsed?.submission_mismatch_reason || 'The submitted file does not appear to be a genuine attempt at this assessment.')}</p></div>` : ''}

  <div class="score-grid">
    <div class="score-box"><div class="label">Score</div><div class="val" style="color:${scoreColor}">${score}/100</div></div>
    ${qAnswered != null ? `<div class="score-box"><div class="label">Questions Answered</div><div class="val" style="color:#4f46e5">${qAnswered}/${qTotal}</div></div>` : ''}
    <div class="score-box"><div class="label">Grammar Errors</div><div class="val" style="color:${grammarMistakes.length > 0 ? '#d97706' : '#16a34a'}">${grammarMistakes.length}</div></div>
    <div class="score-box"><div class="label">Wrong Answers</div><div class="val" style="color:${wrongAnswers.length > 0 ? '#dc2626' : '#16a34a'}">${wrongAnswers.length}</div></div>
  </div>

  <div class="meta-grid">
    <div class="meta-item"><div class="label">Assessment</div><div class="val">${escHtml(a.assessment_name)}</div></div>
    <div class="meta-item"><div class="label">Submitted</div><div class="val">${submittedDate}</div></div>
    <div class="meta-item"><div class="label">File</div><div class="val">${escHtml(a.submission_file || '—')}</div></div>
    <div class="meta-item"><div class="label">Status</div><div class="val" style="color:${statusColor}">${statusLabel}</div></div>
  </div>

  <h2>📊 Performance Breakdown</h2>
  <div class="section">
    ${breakdownRows.map(b => `
      <div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <div><strong>${escHtml(b.label)}</strong> <span style="color:#94a3b8;font-size:11px">${escHtml(b.desc)}</span></div>
          <strong style="white-space:nowrap;margin-left:8px">${b.val}/${b.max}</strong>
        </div>
        ${barHtml(b.val, b.max)}
      </div>`).join('')}
  </div>

  <h2>🤖 AI Overall Assessment</h2>
  <div class="section"><p style="margin:0">${escHtml(parsed?.summary || '')}</p></div>

  ${grammarMistakes.length > 0 ? `
  <h2>✏️ Grammar & Language Errors (${grammarMistakes.length})</h2>
  <div class="section">
    ${grammarMistakes.map(m => `
      <div class="error-box">
        <p style="font-size:11px;font-weight:bold;color:#c2410c;margin:0 0 4px">📍 ${escHtml(m.location)}</p>
        <p style="color:#991b1b;margin:0 0 3px"><strong>Error:</strong> ${escHtml(m.error)}</p>
        ${m.correction ? `<p style="color:#166534;margin:0"><strong>Correction:</strong> ${escHtml(m.correction)}</p>` : ''}
      </div>`).join('')}
  </div>` : ''}

  ${wrongAnswers.length > 0 ? `
  <h2>❌ Incorrect Answers (${wrongAnswers.length})</h2>
  <div class="section">
    ${wrongAnswers.map(w => `
      <div class="wrong-box">
        <p style="font-weight:bold;margin:0 0 6px;font-size:12px">📋 ${escHtml(w.question)}</p>
        <div class="wrong-grid">
          <div class="learner-ans"><p style="font-size:11px;font-weight:bold;color:#991b1b;margin:0 0 2px">Your Answer:</p><p style="margin:0;color:#7f1d1d">${escHtml(w.learner_answer || '—')}</p></div>
          <div class="correct-ans"><p style="font-size:11px;font-weight:bold;color:#166534;margin:0 0 2px">Correct Answer:</p><p style="margin:0;color:#14532d">${escHtml(w.correct_answer || '—')}</p></div>
        </div>
        ${w.explanation ? `<p style="font-size:11px;color:#475569;margin:6px 0 0;background:#f8fafc;padding:6px 10px;border-radius:4px">💡 ${escHtml(w.explanation)}</p>` : ''}
      </div>`).join('')}
  </div>` : ''}

  ${missedQuestions.length > 0 ? `
  <h2>⏭️ Missed / Unanswered (${missedQuestions.length})</h2>
  <div class="section">
    ${missedQuestions.map(q => `<div class="missed-item">• ${escHtml(q)}</div>`).join('')}
  </div>` : ''}

  ${perQuestionMarks.length > 0 ? `
  <h2>📋 Row-by-Row Marking</h2>
  <div class="section" style="padding:10px 14px">
    ${perQuestionMarks.map(q => {
      const pct = q.marks_possible > 0 ? Math.round((q.marks_awarded / q.marks_possible) * 100) : 0;
      const mc = pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626';
      return `<div class="row-block">
        <div class="row-header">
          <div>
            <strong style="font-size:12px">Row ${q.row}</strong>
            ${q.question_preview ? `<p style="color:#64748b;font-size:11px;margin:2px 0 0">${escHtml(q.question_preview.slice(0, 120))}${q.question_preview.length > 120 ? '...' : ''}</p>` : ''}
          </div>
          <div style="text-align:right;flex-shrink:0;margin-left:12px">
            <strong style="color:${mc}">${q.marks_awarded}/${q.marks_possible}</strong>
            <div class="marks-bar"><div style="width:${pct}%;background:${mc};height:6px;border-radius:3px"></div></div>
          </div>
        </div>
        ${(q.correct_fixes || []).map(f => `<p class="fix">✓ ${escHtml(f)}</p>`).join('')}
        ${(q.missed_errors || []).map(f => `<p class="miss">⚠ ${escHtml(f)}</p>`).join('')}
        ${(q.incorrect_edits || []).map(f => `<p class="bad">✗ ${escHtml(f)}</p>`).join('')}
        ${q.note ? `<p style="font-size:11px;color:#94a3b8;font-style:italic;margin:4px 0 0">${escHtml(q.note)}</p>` : ''}
      </div>`;
    }).join('')}
    <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:8px;margin-top:4px">
      <span>${perQuestionMarks.length} rows evaluated</span>
      <strong>Total: ${perQuestionMarks.reduce((s, q) => s + (q.marks_awarded || 0), 0)} / ${perQuestionMarks.reduce((s, q) => s + (q.marks_possible || 0), 0)} marks</strong>
    </div>
  </div>` : ''}

  ${detailedFeedback ? `
  <h2>📝 Detailed Question-by-Question Feedback</h2>
  <div class="section"><p style="margin:0;white-space:pre-wrap">${escHtml(detailedFeedback)}</p></div>` : ''}

  ${strengths.length > 0 ? `
  <h2>💪 What You Did Well</h2>
  <div class="section">
    ${strengths.map(s => `<p class="strength-item">✓ ${escHtml(s)}</p>`).join('')}
  </div>` : ''}

  ${areasOfImprovement.length > 0 ? `
  <h2>🎯 Areas to Improve</h2>
  <div class="section">
    ${areasOfImprovement.map(a => `<p class="improvement-item">→ ${escHtml(a)}</p>`).join('')}
  </div>` : ''}

  ${score < 60 ? `<div class="low-score"><strong style="color:#991b1b">⚠️ Action Required</strong><p style="color:#991b1b;margin:6px 0 0;font-size:12px">This submission scored below 60. Review the errors above, revisit the assessment material, and resubmit for a better evaluation.</p></div>` : ''}

  <div class="footer">Generated by LMS AI Review System · ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })} &nbsp;|&nbsp; Confidential</div>
  </body></html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.addEventListener('load', () => win.print());
  }
}

// Replace unprofessional terminology
const sanitizeReview = (text) => {
  if (!text) return text;
  return text
    .replace(/\bstudent\b/gi, 'professional')
    .replace(/\bstudents\b/gi, 'professionals')
    .replace(/\bStudent\b/g, 'Professional')
    .replace(/\bStudents\b/g, 'Professionals');
};

// Parse ai_summary — may be a JSON string (new format) or plain text (old)
const parseAiSummary = (ai_summary) => {
  if (!ai_summary) return null;
  try {
    const parsed = JSON.parse(ai_summary);
    if (typeof parsed === 'object' && parsed.summary) return parsed;
  } catch (_) { }
  // Old plain text format
  return { summary: ai_summary, grammar_mistakes: [], wrong_answers: [], missed_questions: [], strengths: [], areas_of_improvement: [], detailed_feedback: '' };
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
    api.get('/assessments/my').then(setAssessments).catch(() => { }).finally(() => setLoading(false));
  }, []);

  const handleDownload = async (a) => {
    // Update status to downloaded
    if (a.status === 'pending') {
      await api.patch(`/assessments/${a.id}/status?status=downloaded`).catch(() => { });
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
            <div key={a.id} className={`rounded-xl overflow-hidden border-2 transition-all ${isCompleted ? 'border-emerald-200 bg-emerald-50/30' :
                isActive ? 'border-amber-200 bg-white shadow-md' :
                  'border-gray-200 bg-white'
              }`}>
              <button onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${isCompleted ? 'bg-emerald-100' : isActive ? 'bg-amber-100' : 'bg-gray-100'
                    }`}>
                    {isCompleted ? '✅' : icon}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{name}</p>
                    {submittedDate && <p className="text-xs text-gray-400">Submitted {new Date(submittedDate).toLocaleDateString()}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {isCompleted && (() => {
                    const p = parseAiSummary(a.ai_summary);
                    const isInvalid = p?.authentic === false;
                    const gCount = p?.grammar_mistakes?.length || 0;
                    const wCount = p?.wrong_answers?.length || 0;
                    return (
                      <>
                        {isInvalid && <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 border border-red-200 rounded-full font-semibold">⚠️ Mismatch</span>}
                        {!isInvalid && gCount > 0 && <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 border border-orange-200 rounded-full">{gCount} grammar err</span>}
                        {!isInvalid && wCount > 0 && <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 border border-red-200 rounded-full">{wCount} wrong ans</span>}
                        {!isInvalid && gCount === 0 && wCount === 0 && a.score >= 70 && <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full">✓ No errors</span>}
                      </>
                    );
                  })()}
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
                      {/* Proofreading banner */}
                      {a.assessment_type === 'proofreading' && (
                        <div className="bg-violet-50 border-2 border-violet-200 rounded-xl px-4 py-3">
                          <p className="text-sm font-bold text-violet-800 mb-1">✏️ Proofreading Task</p>
                          <p className="text-xs text-violet-700">
                            Your job is <strong>not</strong> to answer the questions — you need to <strong>proofread and edit</strong> the document.
                            Fix grammar, spelling, punctuation, and style errors using <strong>US English</strong> standards.
                            Return the corrected version of the document as your submission.
                          </p>
                        </div>
                      )}

                      <div className="flex gap-3 flex-wrap">
                        <button onClick={() => handleDownload(a)}
                          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 shadow-sm">
                          <Download className="w-4 h-4" /> ⬇ Download {a.assessment_type === 'proofreading' ? 'Document to Proofread' : 'Quest File'}
                        </button>
                      </div>

                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                        <p className="text-sm font-medium text-gray-700">
                          📤 {a.assessment_type === 'proofreading' ? 'Submit Your Edited (Proofread) Version' : 'Submit Your Answer'}
                        </p>
                        <input ref={fileRef} type="file" accept=".doc,.docx,.xlsx,.xls,.pdf"
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-indigo-100 file:text-indigo-700" />
                        <button onClick={() => handleUpload(a)}
                          disabled={uploading === a.id}
                          className={`flex items-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-lg shadow-sm disabled:opacity-50 ${a.assessment_type === 'proofreading' ? 'bg-violet-600 hover:bg-violet-700' : 'bg-orange-500 hover:bg-orange-600'}`}>
                          {uploading === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          {uploading === a.id ? 'Submitting...' : a.assessment_type === 'proofreading' ? '⬆ Submit Proofread Document' : '⬆ Submit Quest Answer'}
                        </button>
                      </div>

                      <div className={`border rounded-lg px-4 py-3 ${a.assessment_type === 'proofreading' ? 'bg-violet-50 border-violet-200' : 'bg-amber-50 border-amber-200'}`}>
                        <p className={`text-sm ${a.assessment_type === 'proofreading' ? 'text-violet-800' : 'text-amber-800'}`}>
                          {a.assessment_type === 'proofreading'
                            ? <><strong>✏️ Your mission:</strong> Download the document, fix all errors (US English), and submit your corrected version. AI will compare your edits against the original.</>
                            : <><strong>⚔️ Your mission:</strong> Download the quest file, complete it offline, then submit your answer to earn a badge!</>
                          }
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
                            <p className="text-sm text-gray-700">{sanitizeReview(parseAiSummary(a.ai_summary)?.summary || a.ai_summary)}</p>
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

      {/* Detailed Feedback Modal */}
      {feedbackModal && (() => {
        const parsed = parseAiSummary(feedbackModal.ai_summary);
        const score = feedbackModal.score || 0;
        const grammarMistakes = parsed?.grammar_mistakes || [];
        const wrongAnswers = parsed?.wrong_answers || [];
        const missedQuestions = parsed?.missed_questions || [];
        const perQuestionMarks = parsed?.per_question_marks || [];
        const strengths = parsed?.strengths || [];
        const areasOfImprovement = parsed?.areas_of_improvement || [];
        const detailedFeedback = parsed?.detailed_feedback || '';
        const qAnswered = parsed?.questions_answered;
        const qTotal = parsed?.questions_total;
        const isInvalid = parsed?.authentic === false;
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setFeedbackModal(null)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div>
                  <h2 className="font-bold text-gray-900 flex items-center gap-2">📄 Detailed Assessment Feedback Report</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{feedbackModal.assessment_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => printAssessmentReport(feedbackModal, parsed)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
                    <Printer className="w-4 h-4" /> Print / PDF
                  </button>
                  <button onClick={() => setFeedbackModal(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto p-6 space-y-5">
                {/* Invalid submission warning */}
                {isInvalid && (
                  <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-start gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div>
                      <p className="font-bold text-red-700">Submission Mismatch Detected</p>
                      <p className="text-sm text-red-600 mt-1">
                        {parsed?.submission_mismatch_reason || 'The submitted file does not appear to be a genuine attempt at this assessment. It may be an unrelated document (e.g., resume, different assignment). The score has been capped accordingly.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Meta info + score */}
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

                {/* Meta details */}
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 text-sm grid grid-cols-2 gap-2">
                  <div><span className="text-gray-500">Assessment:</span> <span className="font-semibold ml-1">{feedbackModal.assessment_name}</span></div>
                  <div><span className="text-gray-500">Submitted:</span> <span className="font-semibold ml-1">{feedbackModal.submitted_at ? new Date(feedbackModal.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span></div>
                  <div><span className="text-gray-500">File:</span> <span className="font-semibold ml-1">{feedbackModal.submission_file || '—'}</span></div>
                  <div><span className="text-gray-500">Status:</span> <span className={`font-semibold ml-1 ${score >= 70 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{score >= 70 ? 'Pass' : score >= 50 ? 'Borderline' : 'Fail'}</span></div>
                </div>

                {/* Score breakdown bars */}
                <div className="border border-gray-200 rounded-xl p-5">
                  <h3 className="font-bold text-gray-800 mb-3">📊 Performance Breakdown</h3>
                  <div className="space-y-3">
                    {(parsed?.assessment_type === 'proofreading' ? [
                      { label: 'Errors Caught & Fixed', desc: 'Grammar, spelling, punctuation errors correctly identified and fixed', max: 40, score: parsed?.errors_caught_score ?? Math.round(score * 0.40) },
                      { label: 'No Incorrect Edits', desc: 'Penalty for changing correct text or introducing new errors', max: 25, score: parsed?.incorrect_edits_score ?? Math.round(score * 0.25) },
                      { label: 'US English Compliance', desc: 'Oxford comma, -ize/-or spellings, double quotes, em-dash usage', max: 20, score: parsed?.us_english_score ?? Math.round(score * 0.20) },
                      { label: 'Completeness', desc: 'All sections of the document reviewed and addressed', max: 15, score: parsed?.completeness_score ?? Math.round(score * 0.15) },
                    ] : [
                      { label: 'Content Relevance', desc: 'Did the submission answer the actual assessment questions?', max: 30, score: parsed?.content_relevance_score ?? Math.round(score * 0.30) },
                      { label: 'Completeness', desc: 'Were all questions/tasks attempted?', max: 25, score: parsed?.completeness_score ?? Math.round(score * 0.25) },
                      { label: 'Grammar & Language', desc: 'Quality of writing, grammar, punctuation, sentence structure', max: 20, score: parsed?.grammar_score ?? Math.round(score * 0.20) },
                      { label: 'Accuracy & Correctness', desc: 'Were the answers factually/technically correct?', max: 25, score: parsed?.accuracy_score ?? Math.round(score * 0.25) },
                    ]).map((item) => (
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

                {/* Per-question marks table (proofreading CSV) */}
                {perQuestionMarks.length > 0 && (
                  <div className="border border-violet-200 rounded-xl overflow-hidden">
                    <div className="bg-violet-50 px-5 py-3 border-b border-violet-200">
                      <h3 className="font-bold text-violet-800 flex items-center gap-2">📋 Row-by-Row Marking</h3>
                      <p className="text-xs text-violet-600 mt-0.5">Each row shows what you fixed, what you missed, and marks awarded</p>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                      {perQuestionMarks.map((q, i) => {
                        const pct = q.marks_possible > 0 ? (q.marks_awarded / q.marks_possible) : 0;
                        return (
                          <div key={i} className="px-5 py-3.5">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex-1">
                                <p className="text-xs font-bold text-gray-700">Row {q.row}</p>
                                {q.question_preview && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{q.question_preview}</p>}
                              </div>
                              <div className="shrink-0 text-right">
                                <span className={`text-sm font-bold ${pct >= 0.8 ? 'text-emerald-600' : pct >= 0.5 ? 'text-amber-600' : 'text-red-600'}`}>
                                  {q.marks_awarded}/{q.marks_possible}
                                </span>
                                <div className="h-1.5 w-16 bg-gray-100 rounded-full mt-1 overflow-hidden">
                                  <div className={`h-full rounded-full ${pct >= 0.8 ? 'bg-emerald-500' : pct >= 0.5 ? 'bg-amber-500' : 'bg-red-500'}`}
                                    style={{ width: `${pct * 100}%` }} />
                                </div>
                              </div>
                            </div>
                            {q.correct_fixes?.length > 0 && (
                              <div className="mb-1.5">
                                {q.correct_fixes.map((f, j) => (
                                  <p key={j} className="text-xs text-emerald-700 flex items-start gap-1"><span className="shrink-0 mt-0.5">✓</span>{f}</p>
                                ))}
                              </div>
                            )}
                            {q.missed_errors?.length > 0 && (
                              <div className="mb-1.5">
                                {q.missed_errors.map((f, j) => (
                                  <p key={j} className="text-xs text-amber-700 flex items-start gap-1"><span className="shrink-0 mt-0.5">⚠</span>{f}</p>
                                ))}
                              </div>
                            )}
                            {q.incorrect_edits?.length > 0 && (
                              <div className="mb-1.5">
                                {q.incorrect_edits.map((f, j) => (
                                  <p key={j} className="text-xs text-red-700 flex items-start gap-1"><span className="shrink-0 mt-0.5">✗</span>{f}</p>
                                ))}
                              </div>
                            )}
                            {q.note && <p className="text-xs text-gray-500 italic mt-1">{q.note}</p>}
                          </div>
                        );
                      })}
                    </div>
                    <div className="bg-gray-50 px-5 py-2 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                      <span>{perQuestionMarks.length} rows evaluated</span>
                      <span>Total: {perQuestionMarks.reduce((s, q) => s + (q.marks_awarded || 0), 0)} / {perQuestionMarks.reduce((s, q) => s + (q.marks_possible || 0), 0)} marks</span>
                    </div>
                  </div>
                )}

                {/* Detailed paragraph feedback */}
                {detailedFeedback && (
                  <div className="border border-slate-200 rounded-xl p-5 bg-slate-50">
                    <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">📝 Detailed Question-by-Question Feedback</h3>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{sanitizeReview(detailedFeedback)}</p>
                  </div>
                )}

                {/* Strengths from AI */}
                {strengths.length > 0 && (
                  <div className="border border-emerald-200 rounded-xl p-5 bg-emerald-50">
                    <h3 className="font-bold text-emerald-800 mb-3 flex items-center gap-2">💪 What You Did Well</h3>
                    <ul className="space-y-2">
                      {strengths.map((s, i) => <li key={i} className="flex items-start gap-2 text-sm text-emerald-700"><span className="text-emerald-500 shrink-0 mt-0.5">✓</span>{s}</li>)}
                    </ul>
                  </div>
                )}

                {/* Areas of improvement */}
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
      })()}
    </div>
  );
}

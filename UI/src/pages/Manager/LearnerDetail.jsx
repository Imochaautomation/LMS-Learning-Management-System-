import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api, { API_HOST } from '../../api/client';
import BackButton from '../../components/shared/BackButton';
import {
  FileText, GraduationCap, BarChart3, ExternalLink, Send, Search, Plus,
  Trophy, Flame, Award, ArrowRight, FileSearch, Printer, X,
  CheckCircle2, AlertTriangle, TrendingUp, Target, Zap, Download, Loader2, ShieldCheck,
  BookOpen, Square, CheckSquare
} from 'lucide-react';

const JOURNEY_LEVELS = [
  { title: 'New Learner', min: 0, emoji: '🌱' },
  { title: 'Rising Learner', min: 1, emoji: '📗' },
  { title: 'Active Learner', min: 3, emoji: '⭐' },
  { title: 'Skilled Learner', min: 5, emoji: '🏆' },
  { title: 'Expert Learner', min: 8, emoji: '🏅' },
  { title: 'Champion Learner', min: 12, emoji: '✨' },
];

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

// ── Radar Chart (same as employee panel) ──────────────────────────────────────
function RadarChart({ skillGaps }) {
  const [tooltip, setTooltip] = useState(null);
  const svgRef = useRef();
  if (!skillGaps || skillGaps.length === 0) return null;
  const size = 420; const cx = size / 2; const cy = size / 2; const R = 145; const levels = 5;
  const n = skillGaps.length;
  const angleStep = (2 * Math.PI) / n;
  const getAngle = (i) => -Math.PI / 2 + i * angleStep;
  const polar = (r, angle) => ({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  const rings = Array.from({ length: levels }, (_, lvl) => {
    const r = (R * (lvl + 1)) / levels;
    return skillGaps.map((_, i) => { const p = polar(r, getAngle(i)); return `${p.x},${p.y}`; }).join(' ');
  });
  const dataPoints = skillGaps.map((g, i) => { const r = (R * Math.min(g.score, 100)) / 100; return polar(r, getAngle(i)); });
  const polygon = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');
  const labels = skillGaps.map((g, i) => { const a = getAngle(i); const p = polar(R + 28, a); return { ...p, text: g.skill, score: g.score, severity: g.severity }; });
  const severityColor = { High: '#ef4444', Medium: '#f59e0b', Low: '#10b981' };
  const handleMouseMove = (e, skill) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, skill });
  };
  return (
    <div className="relative select-none">
      <svg ref={svgRef} viewBox={`-70 -25 ${size + 140} ${size + 50}`} width="100%" style={{ width: '100%', maxWidth: 600, display: 'block', margin: '0 auto' }} onMouseLeave={() => setTooltip(null)}>
        {rings.map((pts, lvl) => <polygon key={lvl} points={pts} fill="none" stroke={lvl === levels - 1 ? '#e2e8f0' : '#f1f5f9'} strokeWidth={lvl === levels - 1 ? 1.5 : 1} />)}
        {Array.from({ length: levels }, (_, lvl) => { const r = (R * (lvl + 1)) / levels; return <text key={lvl} x={cx + r + 2} y={cy + 4} fontSize="7" fill="#94a3b8">{Math.round(((lvl + 1) / levels) * 100)}%</text>; })}
        {skillGaps.map((_, i) => { const a = getAngle(i); const end = polar(R, a); return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="#e2e8f0" strokeWidth={1} />; })}
        <polygon points={polygon} fill="rgba(99,102,241,0.15)" stroke="rgba(99,102,241,0.7)" strokeWidth={2} />
        {dataPoints.map((p, i) => {
          const g = skillGaps[i]; const col = severityColor[g.severity] || '#6366f1';
          return <circle key={i} cx={p.x} cy={p.y} r={5} fill={col} stroke="white" strokeWidth={1.5} style={{ cursor: 'pointer' }} onMouseEnter={(e) => handleMouseMove(e, g)} onMouseMove={(e) => handleMouseMove(e, g)} />;
        })}
        {labels.map((l, i) => {
          const col = severityColor[l.severity] || '#6366f1';
          const short = l.text.length > 16 ? l.text.slice(0, 15) + '…' : l.text;
          const anchor = l.x < cx - 5 ? 'end' : l.x > cx + 5 ? 'start' : 'middle';
          return (
            <g key={i} style={{ cursor: 'pointer' }} onMouseEnter={(e) => handleMouseMove(e, skillGaps[i])} onMouseMove={(e) => handleMouseMove(e, skillGaps[i])} onMouseLeave={() => setTooltip(null)}>
              <text x={l.x} y={l.y - 4} textAnchor={anchor} fontSize="9" fontWeight="600" fill={col}>{short}</text>
              <text x={l.x} y={l.y + 7} textAnchor={anchor} fontSize="8" fill="#64748b">{l.score}%</text>
            </g>
          );
        })}
      </svg>
      {tooltip && (
        <div className="absolute z-20 pointer-events-none bg-gray-900 text-white text-xs rounded-xl px-3 py-2 shadow-xl" style={{ left: tooltip.x + 12, top: tooltip.y - 10, minWidth: 165 }}>
          <p className="font-bold text-sm mb-1">{tooltip.skill.skill}</p>
          <p>Score: <span className="font-semibold">{tooltip.skill.score}/100</span></p>
          <p>Status: <span className={`font-semibold ${tooltip.skill.severity === 'High' ? 'text-red-400' : tooltip.skill.severity === 'Medium' ? 'text-amber-400' : 'text-emerald-400'}`}>
            {tooltip.skill.severity === 'High' ? '⚠️ Critical Gap' : tooltip.skill.severity === 'Medium' ? '📈 Needs Work' : '✅ Proficient'}
          </span></p>
          <p className="mt-1 text-gray-300 text-xs">{tooltip.skill.severity === 'High' ? 'Priority training needed' : tooltip.skill.severity === 'Medium' ? 'Focused practice recommended' : 'Performing well'}</p>
        </div>
      )}
    </div>
  );
}

// ── PDF download ──────────────────────────────────────────────────────────────
function downloadSkillPDF(learner, skillGaps, strengths, areasOfImprovement, qaPairs = [], learningGoals = null, interviewDate = null, courses = []) {
  const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const iDate = interviewDate ? new Date(interviewDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : null;
  const criticalGaps = skillGaps.filter(g => g.severity === 'High');
  const mediumGaps = skillGaps.filter(g => g.severity === 'Medium');
  const lowGaps = skillGaps.filter(g => g.severity === 'Low');
  const avgScore = skillGaps.length > 0 ? Math.round(skillGaps.reduce((s, g) => s + g.score, 0) / skillGaps.length) : 0;
  const esc = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const firstName = (learner?.name || 'The employee').split(' ')[0];
  const toThirdPerson = (text) => {
    if (!text) return text;
    return text
      .replace(/\bYou\b/g, firstName).replace(/\byou\b/g, firstName)
      .replace(/\bYour\b/g, 'Their').replace(/\byour\b/g, 'their')
      .replace(/\bYourself\b/g, 'Themselves').replace(/\byourself\b/g, 'themselves');
  };

  const fallbackObservation = (g) => {
    if (g.severity === 'High') return g.score < 40
      ? `${firstName} showed limited familiarity with core ${esc(g.skill)} concepts — responses lacked depth and applied confidence.`
      : `${firstName} demonstrated basic awareness of ${esc(g.skill)} but answers were inconsistent when applied to varied scenarios.`;
    if (g.severity === 'Medium') return g.score >= 65
      ? `${firstName} performed well in standard ${esc(g.skill)} scenarios but struggled with edge cases and nuanced variations.`
      : `${firstName} has conceptual ${esc(g.skill)} knowledge but depth and consistency were missing in more complex scenarios.`;
    return `${firstName} demonstrated confident, consistent understanding of ${esc(g.skill)} across all relevant scenarios.`;
  };

  const fallbackAction = (g) => {
    const goal = learningGoals ? ` Aligns with stated goal: &ldquo;${esc(learningGoals.slice(0, 80))}${learningGoals.length > 80 ? '&hellip;' : ''}&rdquo;` : '';
    if (g.severity === 'High') return g.score < 35
      ? `Assign a foundational course on ${esc(g.skill)} to build the foundation before advancing to practical application.${goal}`
      : `Assign an intermediate ${esc(g.skill)} course focused on real-world scenarios and problem-solving.${goal}`;
    if (g.severity === 'Medium') return g.score >= 65
      ? `Practice ${esc(g.skill)} through advanced case studies — the gap is narrow (${70 - g.score} pts) and targeted exercise will close it quickly.${goal}`
      : `Assign a scenario-based ${esc(g.skill)} course to build consistency under varied conditions.${goal}`;
    return `Continue applying ${esc(g.skill)} actively in day-to-day work. Consider mentoring peers or pursuing advanced specialization.`;
  };

  const skillBlock = (g) => {
    const color  = g.severity === 'High' ? '#dc2626' : g.severity === 'Medium' ? '#d97706' : '#16a34a';
    const bg     = g.severity === 'High' ? '#fef2f2' : g.severity === 'Medium' ? '#fffbeb' : '#f0fdf4';
    const border = g.severity === 'High' ? '#fecaca' : g.severity === 'Medium' ? '#fde68a' : '#bbf7d0';
    const label  = g.severity === 'High' ? 'Critical Gap' : g.severity === 'Medium' ? 'Growing' : 'Proficient';
    const foundLabel  = g.severity === 'Medium' ? 'Where they\'re falling short' : 'What the AI found';
    const actionLabel = g.severity === 'Medium' ? 'Next step' : 'Recommended action';
    const toGo   = g.severity === 'Medium' ? ` &nbsp;&nbsp; ${Math.max(0, 70 - g.score)} pts to go` : '';
    const obsText = (g.observation && g.observation.toLowerCase().includes(g.skill.toLowerCase()))
      ? g.observation : null;
    const observation = obsText ? esc(toThirdPerson(obsText)) : fallbackObservation(g);
    const action = fallbackAction(g);
    const qaBlock = (g.question_asked && g.answer_summary)
      ? `<div class="evidence-box">
          <div class="evidence-label">&#x1F4CB; Interview Evidence</div>
          <p class="evidence-q"><strong>Q:</strong> ${esc(g.question_asked)}</p>
          <p class="evidence-a"><strong>A:</strong> ${esc(toThirdPerson(g.answer_summary))}</p>
        </div>`
      : '';
    return `<div class="skill-block" style="border:1.5px solid ${border}">
      <div class="skill-block-header" style="background:${bg}">
        <strong>${esc(g.skill)}</strong>
        <div class="header-right">
          <span class="severity-pill" style="color:${color};border-color:${border};background:white">${label}</span>
          <span class="score-num" style="color:${color}">${g.score}/100</span>
        </div>
      </div>
      <div class="bar-wrap">
        <svg width="100%" height="10" viewBox="0 0 100 10" preserveAspectRatio="none" style="display:block;border-radius:3px;overflow:hidden;margin:5px 0 2px">
          <rect x="0" y="0" width="${g.score}" height="10" fill="${color}"/>
          <rect x="${g.score}" y="0" width="${100 - g.score}" height="10" fill="#e2e8f0"/>
          <line x1="70" y1="0" x2="70" y2="10" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="2,2"/>
        </svg>
        <div class="bar-label">&#x2191; 70 proficient${toGo}</div>
      </div>
      <div class="skill-detail-grid">
        <div class="detail-box" style="background:${bg};border:1px solid ${border}">
          <div class="detail-label" style="color:${color}">${foundLabel}</div>
          <p>${observation}</p>
        </div>
        <div class="detail-box" style="background:#f8fafc;border:1px solid #e2e8f0">
          <div class="detail-label" style="color:#374151">${actionLabel}</div>
          <p>${action}</p>
        </div>
      </div>
      ${qaBlock}
    </div>`;
  };

  const recommendedCourses = (courses || []).filter(c => c.status === 'recommended').slice(0, 10);
  const coursesBlock = recommendedCourses.length > 0 ? `
    <h2><span class="icon">&#x1F4DA;</span>Recommended Courses</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      ${recommendedCourses.map(c => {
        const ct = `${c.title || ''} ${c.category || ''}`.toLowerCase();
        const isCrit = criticalGaps.some(g => ct.includes(g.skill.toLowerCase().split(' ')[0]));
        const isMed  = mediumGaps.some(g => ct.includes(g.skill.toLowerCase().split(' ')[0]));
        const bd = isCrit ? '#fecaca' : isMed ? '#fde68a' : c.tag === 'Advance' ? '#bbf7d0' : '#c7d2fe';
        const bg2= isCrit ? '#fef2f2' : isMed ? '#fffbeb' : c.tag === 'Advance' ? '#f0fdf4' : '#eef2ff';
        const col= isCrit ? '#dc2626' : isMed ? '#d97706' : c.tag === 'Advance' ? '#16a34a' : '#6366f1';
        const tagLabel = isCrit ? 'Gap-Fill &middot; Critical' : isMed ? 'Gap-Fill &middot; Growing' : c.tag === 'Advance' ? 'Advance &middot; Strong' : 'Recommended';
        return `<div style="border:1.5px solid ${bd};border-radius:10px;padding:12px 14px;background:${bg2}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
            <span style="font-size:10px;font-weight:700;color:${col};text-transform:uppercase;letter-spacing:0.4px">${tagLabel}</span>
            <span style="font-size:10px;color:#64748b">${esc(c.provider || '')}${c.duration ? ' &middot; ' + esc(c.duration) : ''}</span>
          </div>
          <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:3px">${esc(c.title)}</div>
          <div style="font-size:11px;color:#64748b">${esc(c.category || '')}</div>
        </div>`;
      }).join('')}
    </div>` : '';

  const transcriptData = qaPairs.length > 0
    ? qaPairs
    : skillGaps.filter(g => g.question_asked).map(g => ({ question: g.question_asked, answer: g.answer_summary || g.observation || '' }));
  const transcriptBlock = transcriptData.length > 0 ? `
    <h2><span class="icon">&#x1F4AC;</span>Interview Transcript</h2>
    <div class="transcript-box">
      ${transcriptData.map((qa, i) => `
        <div class="transcript-entry">
          <div class="transcript-q">Q${i + 1}.&nbsp;&nbsp;${esc(qa.question.replace(/^(Jarvis:|Interviewer:)/i, '').trim())}</div>
          <div class="transcript-a">${esc(toThirdPerson(qa.answer))}${qa.answer.length > 500 ? '&hellip;' : ''}</div>
        </div>`).join('')}
    </div>` : '';

  const CSS = `
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;color:#1e293b;font-size:13px;line-height:1.6}
    .page{background:white;max-width:900px;margin:30px auto;padding:44px 48px;border-radius:16px;box-shadow:0 4px 40px rgba(0,0,0,0.10)}
    .header{border-bottom:3px solid #e2e8f0;padding-bottom:20px;margin-bottom:24px}
    .header-top{display:flex;align-items:flex-start;justify-content:space-between}
    .brand{font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#6366f1;margin-bottom:4px}
    .report-title{font-size:26px;font-weight:800;color:#0f172a;line-height:1.2}
    .report-subtitle{font-size:13px;color:#64748b;margin-top:3px}
    .confidential-badge{background:#fef3c7;border:1px solid #fde68a;color:#92400e;font-size:10px;font-weight:700;padding:4px 10px;border-radius:20px;letter-spacing:0.5px;white-space:nowrap}
    .meta-row{display:flex;flex-wrap:wrap;gap:20px;margin-top:16px}
    .meta-item{font-size:12px;color:#475569}
    .meta-item strong{color:#1e293b;font-weight:600}
    .score-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:24px 0}
    .score-card{background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;padding:16px 12px;text-align:center}
    .score-card .label{font-size:11px;color:#64748b;font-weight:500;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.4px}
    .score-card .value{font-size:28px;font-weight:800;line-height:1}
    .score-card .sublabel{font-size:10px;color:#94a3b8;margin-top:4px}
    h2{font-size:14px;font-weight:700;color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:7px;margin:32px 0 14px;page-break-after:avoid;letter-spacing:0.2px}
    h2 .icon{margin-right:6px}
    .goal-banner{background:linear-gradient(135deg,#eef2ff 0%,#f0f9ff 100%);border:1.5px solid #c7d2fe;border-radius:10px;padding:12px 18px;margin-bottom:24px;display:flex;align-items:flex-start;gap:12px}
    .goal-icon{font-size:20px;flex-shrink:0;margin-top:1px}
    .goal-label{font-size:10px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px}
    .goal-text{font-size:12.5px;color:#3730a3;font-weight:500;line-height:1.5}
    .overview-box{background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;padding:18px 22px}
    .overview-table{width:100%;border-collapse:collapse;table-layout:fixed}
    .skill-name-cell{font-size:12px;font-weight:700;color:#1e293b;text-align:right;padding-right:14px;vertical-align:middle;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .bar-cell{padding:4px 0;vertical-align:middle}
    .score-cell{font-size:14px;font-weight:800;text-align:center;padding:0 8px;vertical-align:middle}
    .badge-cell{padding-left:6px;vertical-align:middle}
    .badge{display:inline-block;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;white-space:nowrap}
    .spacer-row td{height:7px}
    .roadmap-box{background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;padding:18px 22px}
    .roadmap-section{margin-bottom:14px}
    .roadmap-label{font-size:11px;font-weight:700;margin-bottom:7px;text-transform:uppercase;letter-spacing:0.4px}
    .roadmap-row{padding:8px 14px;border-radius:8px;margin-bottom:5px;font-size:12.5px;font-weight:600}
    .chip{display:inline-block;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:600}
    .chip-wrap{display:flex;flex-wrap:wrap;gap:6px}
    .roadmap-insight{background:#eef2ff;border:1.5px solid #c7d2fe;border-radius:8px;padding:11px 16px;margin-top:14px;font-size:12px;color:#3730a3;line-height:1.6}
    .skill-block{border-radius:10px;margin-bottom:16px;overflow:hidden;page-break-inside:avoid}
    .skill-block-header{padding:11px 16px;display:flex;justify-content:space-between;align-items:center}
    .skill-block-header strong{font-size:14px;color:#0f172a}
    .header-right{display:flex;align-items:center;gap:10px}
    .severity-pill{font-size:10.5px;font-weight:700;padding:3px 10px;border-radius:20px;border:1px solid}
    .score-num{font-size:16px;font-weight:800}
    .bar-wrap{padding:8px 16px 4px}
    .bar-label{font-size:10px;color:#94a3b8;margin-top:2px;padding-left:70%}
    .skill-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:8px 16px 14px}
    .detail-box{border-radius:8px;padding:10px 12px}
    .detail-label{font-size:10.5px;font-weight:700;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.4px}
    .detail-box p{font-size:11.5px;color:#374151;line-height:1.6}
    .evidence-box{margin:0 16px 14px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;padding:10px 14px}
    .evidence-label{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px}
    .evidence-q{font-size:11.5px;color:#475569;margin-bottom:5px;line-height:1.5}
    .evidence-a{font-size:11.5px;color:#1e293b;line-height:1.5}
    .evidence-q strong,.evidence-a strong{color:#6366f1}
    .list-box{background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;padding:16px 20px}
    .list-box ul{padding-left:18px}
    .list-box li{font-size:12.5px;color:#374151;margin-bottom:7px;line-height:1.6}
    .transcript-box{border:1.5px solid #e2e8f0;border-radius:12px;overflow:hidden}
    .transcript-entry{padding:12px 18px}
    .transcript-entry+.transcript-entry{border-top:1px solid #f1f5f9}
    .transcript-q{font-size:11.5px;font-weight:700;color:#6366f1;margin-bottom:4px}
    .transcript-a{font-size:11.5px;color:#374151;line-height:1.6}
    .footer{margin-top:44px;padding-top:14px;border-top:1.5px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center}
    .footer-left{font-size:11px;color:#94a3b8}
    .footer-right{font-size:11px;color:#94a3b8;text-align:right}
    .footer-logo{font-size:12px;font-weight:700;color:#6366f1}
    @media print{body{background:white}.page{margin:0;padding:30px 36px;box-shadow:none;border-radius:0;max-width:100%}h2{page-break-after:avoid}.skill-block{page-break-inside:avoid}.score-grid{page-break-inside:avoid}}
  `;

  const avgColor = avgScore >= 70 ? '#16a34a' : avgScore >= 50 ? '#d97706' : '#dc2626';
  const avgSublabel = avgScore >= 70 ? 'Proficient overall' : avgScore >= 50 ? 'Mixed profile' : 'Needs development';
  const insightText = avgScore >= 75
    ? `Strong overall profile. Focus on eliminating remaining gaps in ${criticalGaps.map(g => esc(g.skill)).join(', ') || 'key areas'} to reach expert level.`
    : avgScore >= 55
    ? `Mixed profile — strong in some areas, significant gaps in others. Prioritize <strong>${criticalGaps.slice(0, 2).map(g => esc(g.skill)).join('</strong> and <strong>') || 'critical skills'}</strong> first — directly aligned with stated learning goals.`
    : `Several skills need significant development. A structured, course-by-course plan focused on critical areas will move the needle fastest.`;

  const logoUrl = `${window.location.origin}/logoimocha.png`;

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
  <title>Skill Gap Analysis — ${esc(learner?.name)}</title>
  <link rel="icon" type="image/png" href="${logoUrl}">
  <style>${CSS}</style></head><body>
  <div class="page">

    <div class="header">
      <div class="header-top">
        <div>
          <img src="${logoUrl}" alt="iMocha" style="height:28px;width:auto;margin-bottom:8px;display:block;object-fit:contain">
          <div class="report-title">Skill Gap Analysis Report</div>
          <div class="report-subtitle">AI Interview Assessment &middot; Detailed Performance Review</div>
        </div>
        <div class="confidential-badge">CONFIDENTIAL &middot; MANAGER VIEW</div>
      </div>
      <div class="meta-row">
        <div class="meta-item">Employee: <strong>${esc(learner?.name || '—')}</strong></div>
        ${learner?.department ? `<div class="meta-item">Department: <strong>${esc(learner.department)}</strong></div>` : ''}
        ${learner?.designation ? `<div class="meta-item">Designation: <strong>${esc(learner.designation)}</strong></div>` : ''}
        ${iDate ? `<div class="meta-item">Interview Date: <strong>${iDate}</strong></div>` : ''}
        <div class="meta-item">Report Generated: <strong>${date}</strong></div>
      </div>
    </div>

    ${learningGoals ? `<div class="goal-banner">
      <div class="goal-icon">&#127919;</div>
      <div>
        <div class="goal-label">Employee's Stated Learning Goal</div>
        <div class="goal-text">${esc(learningGoals)}</div>
      </div>
    </div>` : ''}

    <div class="score-grid">
      <div class="score-card"><div class="label">Avg Skill Score</div><div class="value" style="color:${avgColor}">${avgScore}/100</div><div class="sublabel">${avgSublabel}</div></div>
      <div class="score-card"><div class="label">Critical Gaps</div><div class="value" style="color:#dc2626">${criticalGaps.length}</div><div class="sublabel">Immediate action</div></div>
      <div class="score-card"><div class="label">Growing Skills</div><div class="value" style="color:#d97706">${mediumGaps.length}</div><div class="sublabel">Targeted practice</div></div>
      <div class="score-card"><div class="label">Proficient Skills</div><div class="value" style="color:#16a34a">${lowGaps.length}</div><div class="sublabel">Maintain &amp; build</div></div>
    </div>

    <h2><span class="icon">&#x1F4CA;</span>Skill Overview</h2>
    <div class="overview-box">
      <table class="overview-table">
        <colgroup><col style="width:200px"><col style="width:auto"><col style="width:44px"><col style="width:78px"></colgroup>
        <tbody>
          ${[...skillGaps].sort((a, b) => a.score - b.score).map(g => {
            const c2 = g.severity === 'High' ? '#dc2626' : g.severity === 'Medium' ? '#d97706' : '#16a34a';
            const bg2= g.severity === 'High' ? '#fef2f2' : g.severity === 'Medium' ? '#fffbeb' : '#f0fdf4';
            const bd2= g.severity === 'High' ? '#fecaca' : g.severity === 'Medium' ? '#fde68a' : '#bbf7d0';
            const lbl= g.severity === 'High' ? 'Critical' : g.severity === 'Medium' ? 'Growing' : 'Strong';
            return `<tr>
              <td class="skill-name-cell">${esc(g.skill)}</td>
              <td class="bar-cell">
                <svg width="100%" height="16" viewBox="0 0 100 16" preserveAspectRatio="none" style="display:block;border-radius:3px;overflow:hidden">
                  <rect x="0" y="0" width="${g.score}" height="16" fill="${c2}"/>
                  <rect x="${g.score}" y="0" width="${100-g.score}" height="16" fill="#e2e8f0"/>
                  <line x1="70" y1="0" x2="70" y2="16" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="3,2"/>
                </svg>
                <div style="font-size:9px;color:#94a3b8;margin-top:2px;padding-left:70%">&#x2191; 70</div>
              </td>
              <td class="score-cell" style="color:${c2}">${g.score}</td>
              <td class="badge-cell"><span class="badge" style="background:${bg2};border:1px solid ${bd2};color:${c2}">${lbl}</span></td>
            </tr><tr class="spacer-row"><td colspan="4"></td></tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>

    <h2><span class="icon">&#x1F5FA;&#xFE0F;</span>Learning Roadmap</h2>
    <div class="roadmap-box">
      ${criticalGaps.length > 0 ? `<div class="roadmap-section">
        <div class="roadmap-label" style="color:#dc2626">&#x1F534; Start here &mdash; critical gaps</div>
        ${criticalGaps.map(g => `<div class="roadmap-row" style="background:#fef2f2;border:1px solid #fecaca;color:#7f1d1d"><strong>${esc(g.skill)}</strong></div>`).join('')}
      </div>` : ''}
      ${mediumGaps.length > 0 ? `<div class="roadmap-section">
        <div class="roadmap-label" style="color:#d97706">&#x1F7E1; Then focus on &mdash; growing skills</div>
        ${mediumGaps.map(g => `<div class="roadmap-row" style="background:#fffbeb;border:1px solid #fde68a;color:#78350f"><strong>${esc(g.skill)}</strong></div>`).join('')}
      </div>` : ''}
      ${lowGaps.length > 0 ? `<div class="roadmap-section">
        <div class="roadmap-label" style="color:#16a34a">&#x1F7E2; Maintain &mdash; current strengths</div>
        <div class="chip-wrap">${lowGaps.map(g => `<span class="chip" style="background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d">${esc(g.skill)}</span>`).join('')}</div>
      </div>` : ''}
      <div class="roadmap-insight">${insightText}</div>
    </div>

    ${criticalGaps.length > 0 ? `<h2><span class="icon">&#x26A0;&#xFE0F;</span>Critical Gaps &mdash; Immediate Action Required</h2>${criticalGaps.map(skillBlock).join('')}` : ''}
    ${mediumGaps.length > 0 ? `<h2><span class="icon">&#x1F4C8;</span>Growing Skills &mdash; Targeted Practice Needed</h2>${mediumGaps.map(skillBlock).join('')}` : ''}
    ${lowGaps.length > 0 ? `<h2><span class="icon">&#x1F4AA;</span>Proficient Skills &mdash; Maintain &amp; Build</h2>${lowGaps.map(skillBlock).join('')}` : ''}

    ${strengths.length > 0 ? `<h2><span class="icon">&#x1F916;</span>AI Interview Observations &mdash; Strengths</h2>
    <div class="list-box"><ul>${strengths.map(s => `<li>${esc(toThirdPerson(s))}</li>`).join('')}</ul></div>` : ''}

    ${areasOfImprovement.length > 0 ? `<h2><span class="icon">&#x1F3AF;</span>Specific Areas to Develop</h2>
    <div class="list-box"><ul>${areasOfImprovement.map(a => `<li>${esc(toThirdPerson(a))}</li>`).join('')}</ul></div>` : ''}

    ${coursesBlock}
    ${transcriptBlock}

    <div class="footer">
      <div class="footer-left">
        <img src="${logoUrl}" alt="iMocha" style="height:18px;width:auto;margin-bottom:3px;display:block;object-fit:contain">
        <div style="margin-top:3px">This report is confidential and intended for authorized HR/Manager use only.</div>
      </div>
      <div class="footer-right">
        <div>Report generated: ${date}</div>
        ${iDate ? `<div>Interview date: ${iDate}</div>` : ''}
        <div style="margin-top:3px;color:#6366f1;font-weight:600">AI-Assessed &middot; Not for redistribution</div>
      </div>
    </div>

  </div>
  </body></html>`;

  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 400); }
}

// ── Detailed Feedback Modal (shared by new joiner + employee assessments) ─────
function FeedbackModal({ a, onClose }) {
  const parsed = parseAiSummary(a.ai_summary);
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

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div>
            <h2 className="font-bold text-gray-900">📄 Detailed Assessment Feedback Report</h2>
            <p className="text-xs text-gray-500 mt-0.5">{a.assessment_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white rounded-lg"
              style={{ background: '#F05A28' }}
              onMouseEnter={e => e.currentTarget.style.background = '#c2410c'}
              onMouseLeave={e => e.currentTarget.style.background = '#F05A28'}>
              <Printer className="w-4 h-4" /> Print / PDF
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="overflow-y-auto p-6 space-y-5">
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

          {/* Score cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500">Score</p>
              <p className={`text-2xl font-bold mt-0.5 ${score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{score}/100</p>
            </div>
            {qAnswered != null && qTotal != null && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500">Qs Answered</p>
                <p className="text-2xl font-bold mt-0.5" style={{ color: '#F05A28' }}>{qAnswered}/{qTotal}</p>
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

          {/* Score breakdown */}
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
                { label: 'Grammar & Language', desc: 'Quality of writing, grammar, punctuation', max: 20, score: parsed?.grammar_score ?? Math.round(score * 0.20) },
                { label: 'Accuracy & Correctness', desc: 'Were the answers factually/technically correct?', max: 25, score: parsed?.accuracy_score ?? Math.round(score * 0.25) },
              ]).map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <div><span className="font-semibold text-gray-700">{item.label}</span><span className="text-gray-400 ml-2">{item.desc}</span></div>
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
          <div className="rounded-xl p-5 border" style={{ background: 'rgba(240,90,40,0.06)', borderColor: 'rgba(240,90,40,0.2)' }}>
            <h3 className="font-bold mb-2 flex items-center gap-2" style={{ color: '#c2410c' }}>🤖 AI Overall Assessment</h3>
            <p className="text-sm text-gray-700 leading-relaxed">{sanitizeReview(parsed?.summary || '')}</p>
          </div>

          {/* Grammar Mistakes */}
          {grammarMistakes.length > 0 && (
            <div className="border border-orange-200 rounded-xl p-5 bg-orange-50">
              <h3 className="font-bold text-orange-800 mb-3">✏️ Grammar & Language Errors ({grammarMistakes.length})</h3>
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
              <h3 className="font-bold text-red-800 mb-3">❌ Incorrect Answers ({wrongAnswers.length})</h3>
              <div className="space-y-3">
                {wrongAnswers.map((w, i) => (
                  <div key={i} className="bg-white border border-red-100 rounded-lg p-4">
                    <p className="text-xs font-bold text-gray-700 mb-2">📋 {w.question}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div className="bg-red-50 border border-red-100 rounded-lg p-2">
                        <p className="text-xs font-semibold text-red-600 mb-0.5">Learner's Answer:</p>
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
              <h3 className="font-bold text-gray-800 mb-3">⏭️ Missed / Unanswered Questions ({missedQuestions.length})</h3>
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
                <p className="text-xs text-violet-600 mt-0.5">Each row shows what the learner fixed, missed, and marks awarded</p>
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

          {/* Detailed feedback */}
          {detailedFeedback && (
            <div className="border border-slate-200 rounded-xl p-5 bg-slate-50">
              <h3 className="font-bold text-slate-800 mb-3">📝 Detailed Question-by-Question Feedback</h3>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{sanitizeReview(detailedFeedback)}</p>
            </div>
          )}

          {/* Strengths */}
          {strengths.length > 0 && (
            <div className="border border-emerald-200 rounded-xl p-5 bg-emerald-50">
              <h3 className="font-bold text-emerald-800 mb-3">💪 What the Learner Did Well</h3>
              <ul className="space-y-2">{strengths.map((s, i) => <li key={i} className="flex items-start gap-2 text-sm text-emerald-700"><span className="text-emerald-500 shrink-0 mt-0.5">✓</span>{s}</li>)}</ul>
            </div>
          )}

          {/* Areas of Improvement */}
          {areasOfImprovement.length > 0 && (
            <div className="border border-amber-200 rounded-xl p-5 bg-amber-50">
              <h3 className="font-bold text-amber-800 mb-3">🎯 Areas to Improve</h3>
              <ul className="space-y-2">{areasOfImprovement.map((a, i) => <li key={i} className="flex items-start gap-2 text-sm text-amber-700"><span className="text-amber-500 shrink-0 mt-0.5">→</span>{a}</li>)}</ul>
            </div>
          )}

          {score < 60 && (
            <div className="border border-red-200 rounded-xl p-4 bg-red-50">
              <h3 className="font-bold text-red-700 mb-2">⚠️ Action Required</h3>
              <p className="text-sm text-red-700">This submission scored below 60. The learner should review the errors above, revisit the assessment material, and resubmit.</p>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center">Generated by LMS AI Review System · {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function LearnerDetail() {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const isContentManager = (currentUser?.department || '').trim() === 'Content';
  const [learner, setLearner] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [skillGaps, setSkillGaps] = useState([]);
  const [strengths, setStrengths] = useState([]);
  const [areasOfImprovement, setAreasOfImprovement] = useState([]);
  const [qaPairs, setQaPairs] = useState([]);
  const [learningGoals, setLearningGoals] = useState(null);
  const [interviewDate, setInterviewDate] = useState(null);
  const [bank, setBank] = useState([]);
  const [showAssign, setShowAssign] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');
  const [selectedAssess, setSelectedAssess] = useState([]);
  const [assignType, setAssignType] = useState('full'); // 'full' | 'proofreading'
  const [expandedAssess, setExpandedAssess] = useState(null);
  const [feedbackModal, setFeedbackModal] = useState(null);
  const [activeSkillTab, setActiveSkillTab] = useState('overview');
  const [isReady, setIsReady] = useState(false);
  const [markingReady, setMarkingReady] = useState(false);
  const [readyConfirm, setReadyConfirm] = useState(null); // { action: 'mark'|'revert' }

  // SME Kit assignment (only for new joiners under Content manager)
  const [smeBank, setSmeBank] = useState([]);
  const [smeAssigned, setSmeAssigned] = useState([]);
  const [showSmeAssign, setShowSmeAssign] = useState(false);
  const [selectedSmeFiles, setSelectedSmeFiles] = useState([]);
  const [assigningSme, setAssigningSme] = useState(false);
  const [smeSearch, setSmeSearch] = useState('');

  useEffect(() => {
    api.get('/admin/users').then((all) => {
      const u = all.find((x) => x.id === parseInt(id));
      setLearner(u || null);
      if (u) setIsReady(!!u.is_ready);
    }).catch(() => setLearner(null));

    api.get(`/assessments/assigned?user_id=${id}`).then(setAssessments).catch(() => setAssessments([]));
    api.get(`/courses/user/${id}`).then(setCourses).catch(() => setCourses([]));
    api.get(`/ai/skill-analysis/${id}`).then((data) => {
      setSkillGaps(data.skill_gaps || []);
      setStrengths(data.strengths || []);
      setAreasOfImprovement(data.areas_of_improvement || []);
      setQaPairs(data.qa_pairs || []);
      setLearningGoals(data.learning_goals || null);
      setInterviewDate(data.interview_date || null);
    }).catch(() => {
      api.get(`/profile/${id}/skill-gaps`).then(setSkillGaps).catch(() => setSkillGaps([]));
    });
    api.get('/banks/assessments').then(setBank).catch(() => { });
    api.get('/banks/sme-kit').then(setSmeBank).catch(() => { });
    api.get('/banks/smekit/assignments').then((all) => {
      setSmeAssigned(all.filter((a) => a.user_id === parseInt(id)));
    }).catch(() => { });
  }, [id]);

  if (!learner) return <div className="p-8 text-center text-gray-400">Loading...</div>;

  const isNewJoiner = learner.role === 'new_joiner';
  const completedAssess = assessments.filter((a) => a.status === 'reviewed' || a.status === 'submitted');
  const completedCourses = courses.filter((c) => c.status === 'completed');
  const startedCourses = courses.filter((c) => c.status === 'started');
  const filteredBank = bank.filter((a) => a.name.toLowerCase().includes(assignSearch.toLowerCase()));
  const toggleAssess = (aId) => setSelectedAssess((prev) => prev.includes(aId) ? prev.filter((x) => x !== aId) : [...prev, aId]);

  const assignAssessments = async () => {
    for (const aId of selectedAssess) {
      const a = bank.find((x) => x.id === aId);
      try {
        await api.post('/assessments/assign', {
          user_id: parseInt(id),
          assessment_name: a.name,
          assessment_bank_id: a.id,
          assessment_type: assignType,
        });
      } catch { }
    }
    setShowAssign(false); setSelectedAssess([]); setAssignType('full');
    api.get(`/assessments/assigned?user_id=${id}`).then(setAssessments).catch(() => { });
  };

  const assignSmeFiles = async () => {
    setAssigningSme(true);
    for (const fileId of selectedSmeFiles) {
      try {
        await api.post('/banks/smekit/assign', { file_id: fileId, user_id: parseInt(id) });
      } catch { }
    }
    setAssigningSme(false);
    setShowSmeAssign(false);
    setSelectedSmeFiles([]);
    // Refresh assigned list
    api.get('/banks/smekit/assignments').then((all) => {
      setSmeAssigned(all.filter((a) => a.user_id === parseInt(id)));
    }).catch(() => { });
  };

  const unassignSmeFile = async (assignmentId) => {
    try {
      await api.del(`/banks/smekit/assign/${assignmentId}`);
      setSmeAssigned((prev) => prev.filter((a) => a.id !== assignmentId));
    } catch { }
  };

  const toggleSmeFile = (fileId) => setSelectedSmeFiles((prev) =>
    prev.includes(fileId) ? prev.filter((x) => x !== fileId) : [...prev, fileId]
  );

  const criticalGaps = skillGaps.filter(g => g.severity === 'High');
  const mediumGaps = skillGaps.filter(g => g.severity === 'Medium');
  const lowGaps = skillGaps.filter(g => g.severity === 'Low');
  const avgScore = skillGaps.length ? Math.round(skillGaps.reduce((s, g) => s + (g.score || 0), 0) / skillGaps.length) : 0;

  return (
    <div className="space-y-6">
      <BackButton to="/manager" label="Back to Learners" />

      {/* Header */}
      {isNewJoiner ? (
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white relative overflow-hidden">
          <div className="relative flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xl font-bold shadow-lg">
              {learner.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <h1 className="text-xl font-bold">{learner.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-500/25 text-emerald-300 border border-emerald-400/30">New Joiner</span>
                <span className="text-xs text-slate-400">{learner.department || ''}</span>
                <span className="text-xs text-slate-500">{learner.email}</span>
              </div>
            </div>
          </div>
          {/* Quest Journey */}
          {(() => {
            const badgesCount = completedAssess.filter(a => a.score >= 90).length;
            const trophiesCount = completedAssess.filter(a => a.score >= 95).length;
            const steps = [
              { label: '📚 Spellbook', done: true, desc: 'Training kit studied' },
              ...assessments.map((a, i) => ({
                label: `⚔️ Quest ${i + 1}`, done: a.status === 'reviewed' || a.status === 'submitted',
                active: a.status === 'pending' || a.status === 'downloaded', desc: a.assessment_name,
              })),
              { label: '🎓 Ready', done: false, locked: true }, { label: '🚀 Self-Learning', done: false, locked: true },
            ];
            return (
              <>
                <div className="flex items-center justify-between mb-3 border-t border-slate-700/60 pt-4">
                  <h2 className="text-sm font-bold text-slate-200">🗺️ {learner.name}'s Quest Journey</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-purple-400 bg-purple-900/40 px-2 py-1 rounded-full">🏅 {badgesCount} badges</span>
                    <span className="text-xs font-bold text-amber-400 bg-amber-900/40 px-2 py-1 rounded-full">🏆 {trophiesCount} trophies</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-1.5 shrink-0">
                      <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold ${step.done ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : step.active ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 ring-1 ring-amber-400/30' : step.locked ? 'bg-slate-700/50 text-slate-500 border border-slate-600/30' : 'bg-slate-700/30 text-slate-500 border border-slate-700/30'}`}>
                        {step.done ? '✅' : step.active ? '⚔️' : step.locked ? '🔒' : '○'} <span>{step.label}</span>
                      </div>
                      {i < steps.length - 1 && <span className={`text-sm ${step.done ? 'text-emerald-500' : 'text-slate-600'}`}>→</span>}
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      ) : (
        <div className="rounded-2xl p-6 text-white relative overflow-hidden" style={{ background: 'linear-gradient(to right, #F05A28, #c2410c)' }}>
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
          <div className="relative flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl font-bold shadow-lg">
              {learner.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <h1 className="text-xl font-bold">{learner.name}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-white/20 text-white border border-white/30">Employee</span>
                <span className="text-xs text-indigo-200">{learner.department || ''}</span>
                <span className="text-xs text-indigo-300">{learner.email}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ NEW JOINER VIEW ══════════ */}
      {isNewJoiner && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5"><p className="text-sm text-gray-500 mb-1">Assessments Done</p><p className="text-2xl font-bold text-gray-900">{completedAssess.length} / {assessments.length}</p></div>
            <div className="bg-white border border-gray-200 rounded-xl p-5"><p className="text-sm text-gray-500 mb-1">🏅 Badges</p><p className="text-2xl font-bold text-purple-600">{completedAssess.filter(a => a.score >= 90).length}</p></div>
            <div className="bg-white border border-gray-200 rounded-xl p-5"><p className="text-sm text-gray-500 mb-1">Avg Score</p><p className={`text-2xl font-bold ${completedAssess.length > 0 ? (completedAssess.reduce((s, a) => s + (a.score || 0), 0) / completedAssess.length >= 70 ? 'text-emerald-600' : 'text-amber-600') : 'text-gray-400'}`}>{completedAssess.length > 0 ? Math.round(completedAssess.reduce((s, a) => s + (a.score || 0), 0) / completedAssess.length) : '—'}</p></div>
          </div>

          {/* ── Mark Ready ── */}
          <div className={`rounded-xl border-2 p-5 flex items-center justify-between gap-4 ${isReady ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isReady ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                <ShieldCheck className={`w-5 h-5 ${isReady ? 'text-emerald-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Training Readiness</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isReady
                    ? `${learner.name} has been marked as training-complete and is ready for self-learning.`
                    : 'Mark this new joiner as training-complete once all assessments are reviewed and they are ready to graduate.'}
                </p>
              </div>
            </div>
            <div className="shrink-0">
              {isReady ? (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 px-4 py-2 bg-emerald-100 text-emerald-700 text-sm font-semibold rounded-xl border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4" /> Marked Ready
                  </span>
                  <button
                    onClick={() => setReadyConfirm({ action: 'revert' })}
                    className="px-3 py-2 text-xs text-gray-500 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors">
                    Revert
                  </button>
                </div>
              ) : (
                <button
                  disabled={markingReady}
                  onClick={() => setReadyConfirm({ action: 'mark' })}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50 shadow-sm transition-colors">
                  {markingReady ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  {markingReady ? 'Marking...' : 'Mark as Ready'}
                </button>
              )}
            </div>
          </div>

          {/* Assign Assessment */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2"><FileText className="w-4 h-4" /> Assessments</h2>
              <button onClick={() => setShowAssign(!showAssign)} className="flex items-center gap-1.5 px-3 py-2 bg-orange-100 text-orange-700 text-sm font-medium rounded-lg hover:bg-orange-200">
                <Plus className="w-4 h-4" /> Assign Assessment
              </button>
            </div>

            {showAssign && (
              <div className="mb-4 border border-orange-200 bg-orange-50 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Select from Assessment Bank:</p>
                {/* Assessment Type Toggle */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-medium text-gray-600">Type:</span>
                  <button
                    onClick={() => setAssignType('full')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${assignType === 'full' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-500 border-gray-200 hover:border-orange-300'}`}>
                    📝 Answer Questions
                  </button>
                  <button
                    onClick={() => setAssignType('proofreading')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${assignType === 'proofreading' ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-500 border-gray-200 hover:border-violet-300'}`}>
                    ✏️ Proofreading
                  </button>
                </div>
                {assignType === 'proofreading' && (
                  <div className="mb-3 px-3 py-2 bg-violet-50 border border-violet-200 rounded-lg text-xs text-violet-700">
                    Proofreading task — learner must edit &amp; correct the document using US English standards. AI will evaluate their edits against the original.
                  </div>
                )}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input placeholder="Search assessments..." value={assignSearch} onChange={(e) => setAssignSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg" />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 mb-3">
                  {filteredBank.map((a) => (
                    <label key={a.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-orange-100 ${selectedAssess.includes(a.id) ? 'bg-orange-100' : ''}`}>
                      <input type="checkbox" checked={selectedAssess.includes(a.id)} onChange={() => toggleAssess(a.id)} className="rounded" />
                      <span className="text-sm text-gray-700">{a.name}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button disabled={selectedAssess.length === 0} onClick={assignAssessments} className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 disabled:opacity-50">
                    <Send className="w-3.5 h-3.5" /> Assign ({selectedAssess.length})
                  </button>
                  <button onClick={() => { setShowAssign(false); setSelectedAssess([]); }} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button>
                </div>
              </div>
            )}

            {assessments.length === 0 ? <p className="text-sm text-gray-400">No assessments assigned yet.</p> : (
              <div className="space-y-3">
                {assessments.map((a) => {
                  const parsed = parseAiSummary(a.ai_summary);
                  const isInvalid = parsed?.authentic === false;
                  return (
                    <div key={a.id} className="bg-gray-50 rounded-xl overflow-hidden border border-gray-200">
                      <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-100" onClick={() => setExpandedAssess(expandedAssess === a.id ? null : a.id)}>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{a.assessment_name || a.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-gray-400">{a.assigned_at?.split('T')[0] || ''}</p>
                            {a.assessment_type === 'proofreading' && (
                              <span className="text-xs px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded font-medium">✏️ Proofreading</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isInvalid && <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium border border-red-200">⚠️ Mismatch</span>}
                          {a.submission_file && <span className="text-xs font-medium" style={{ color: '#F05A28' }}>📎 Submitted</span>}
                          {a.score != null && <span className={`text-sm font-bold ${a.score >= 70 ? 'text-emerald-600' : a.score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{Math.round(a.score)}/100</span>}
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${a.status === 'reviewed' ? 'bg-emerald-50 text-emerald-700' : a.status === 'submitted' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>{a.status}</span>
                        </div>
                      </div>
                      {expandedAssess === a.id && (a.status === 'submitted' || a.status === 'reviewed') && (
                        <div className="px-4 pb-4 space-y-3 border-t border-gray-200 pt-3">
                          {a.submission_file && (
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4" style={{ color: '#F05A28' }} />
                              <a href={a.submission_path ? `${API_HOST}${a.submission_path}` : '#'} target="_blank" className="text-sm hover:underline font-medium" style={{ color: '#F05A28' }}>{a.submission_file}</a>
                              <span className="text-xs text-gray-400">— View submitted work</span>
                            </div>
                          )}
                          {a.ai_summary && (
                            <div className="bg-white rounded-lg p-3 border" style={{ borderColor: 'rgba(240,90,40,0.2)' }}>
                              <p className="text-xs font-semibold mb-1" style={{ color: '#c2410c' }}>🤖 AI Review Summary</p>
                              <p className="text-sm text-gray-700 line-clamp-3">{sanitizeReview(parsed?.summary || a.ai_summary)}</p>
                            </div>
                          )}
                          {a.ai_summary && (
                            <button onClick={() => setFeedbackModal(a)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border"
                              style={{ color: '#F05A28', background: 'rgba(240,90,40,0.07)', borderColor: 'rgba(240,90,40,0.3)' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(240,90,40,0.14)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'rgba(240,90,40,0.07)'} >
                              <FileSearch className="w-3.5 h-3.5" /> View Full Detailed Report
                            </button>
                          )}
                          {!a.submission_file && <p className="text-xs text-gray-400">No file submitted yet.</p>}
                        </div>
                      )}
                      {expandedAssess === a.id && a.status === 'pending' && (
                        <div className="px-4 pb-3 border-t border-gray-200 pt-2">
                          <p className="text-xs text-gray-400">⏳ Waiting for learner to download and submit this assessment.</p>
                        </div>
                      )}
                      {expandedAssess === a.id && a.status === 'downloaded' && (
                        <div className="px-4 pb-3 border-t border-gray-200 pt-2">
                          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">📥 Learner has downloaded — awaiting submission.</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── SME Kit Assignment (Content managers only) ── */}
          {isContentManager && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-teal-600" /> SME Kit Files
                </h2>
                <button
                  onClick={() => { setShowSmeAssign(!showSmeAssign); setSelectedSmeFiles([]); setSmeSearch(''); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-teal-100 text-teal-700 text-sm font-medium rounded-lg hover:bg-teal-200">
                  <Plus className="w-4 h-4" /> Assign Files
                </button>
              </div>

              {/* Assign panel */}
              {showSmeAssign && (
                <div className="border-b border-teal-200 bg-teal-50 p-4 space-y-3">
                  <p className="text-sm font-medium text-gray-700">Select files to assign to {learner.name}:</p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      value={smeSearch} onChange={(e) => setSmeSearch(e.target.value)}
                      placeholder="Search files..."
                      className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white" />
                  </div>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {smeBank.filter((f) => f.name.toLowerCase().includes(smeSearch.toLowerCase())).map((f) => {
                      const alreadyAssigned = smeAssigned.some((a) => a.file_id === f.id);
                      return (
                        <label key={f.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer border transition-colors ${
                          alreadyAssigned ? 'border-teal-200 bg-teal-50/80 opacity-60 cursor-not-allowed' :
                          selectedSmeFiles.includes(f.id) ? 'border-teal-400 bg-teal-50 ring-1 ring-teal-300' :
                          'border-gray-200 bg-white hover:bg-gray-50'
                        }`}>
                          <input
                            type="checkbox"
                            className="hidden"
                            disabled={alreadyAssigned}
                            checked={selectedSmeFiles.includes(f.id)}
                            onChange={() => !alreadyAssigned && toggleSmeFile(f.id)} />
                          {alreadyAssigned
                            ? <CheckSquare className="w-4 h-4 text-teal-500 shrink-0" />
                            : selectedSmeFiles.includes(f.id)
                              ? <CheckSquare className="w-4 h-4 text-teal-600 shrink-0" />
                              : <Square className="w-4 h-4 text-gray-300 shrink-0" />}
                          <span className="text-lg shrink-0">📄</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{f.name}</p>
                            <p className="text-xs text-gray-400">{f.category} · {f.file_type}</p>
                          </div>
                          {alreadyAssigned && <span className="text-xs text-teal-600 font-medium shrink-0">✓ Assigned</span>}
                        </label>
                      );
                    })}
                    {smeBank.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-4">No SME Kit files uploaded yet.</p>
                    )}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => { setShowSmeAssign(false); setSelectedSmeFiles([]); }}
                      className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                    <button
                      onClick={assignSmeFiles}
                      disabled={assigningSme || selectedSmeFiles.length === 0}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
                      {assigningSme && <Loader2 className="w-4 h-4 animate-spin" />}
                      Assign {selectedSmeFiles.length > 0 ? `(${selectedSmeFiles.length})` : ''}
                    </button>
                  </div>
                </div>
              )}

              {/* Currently assigned files */}
              <div className="divide-y divide-gray-100">
                {smeAssigned.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <BookOpen className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No SME Kit files assigned to {learner.name} yet.</p>
                  </div>
                ) : (
                  smeAssigned.map((a) => (
                    <div key={a.id} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">📄</span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{a.file_name}</p>
                          <p className="text-xs text-gray-400">{a.category} · {a.file_type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {a.file_path && (
                          <a href={`${API_HOST}${a.file_path}`} target="_blank" rel="noreferrer"
                            className="px-2.5 py-1 text-xs border rounded-lg flex items-center gap-1"
                            style={{ color: '#F05A28', borderColor: 'rgba(240,90,40,0.4)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(240,90,40,0.07)'}
                            onMouseLeave={e => e.currentTarget.style.background = ''}>
                            <ExternalLink className="w-3 h-3" /> View
                          </a>
                        )}
                        <button onClick={() => unassignSmeFile(a.id)}
                          className="px-2.5 py-1 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50">
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════ EMPLOYEE VIEW ══════════ */}
      {!isNewJoiner && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
              <GraduationCap className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
              <div className="text-xl font-bold text-emerald-600">{completedCourses.length}</div>
              <div className="text-xs text-gray-500">Completed</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
              <BarChart3 className="w-5 h-5 mx-auto mb-1" style={{ color: '#F05A28' }} />
              <div className="text-xl font-bold" style={{ color: '#F05A28' }}>{avgScore}%</div>
              <div className="text-xs text-gray-500">Avg Skill Score</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
              <Flame className="w-5 h-5 text-red-500 mx-auto mb-1" />
              <div className="text-xl font-bold text-red-500">{criticalGaps.length}</div>
              <div className="text-xs text-gray-500">Critical Gaps</div>
            </div>
          </div>

          {/* Journey */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-5 text-white">
            <h2 className="font-semibold mb-3 flex items-center gap-2 text-sm"><Trophy className="w-4 h-4 text-amber-400" /> Journey</h2>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {JOURNEY_LEVELS.map((lv, i) => (
                <div key={i} className="flex items-center gap-2 shrink-0">
                  <div className={`text-center px-3 py-2 rounded-lg border transition-all ${completedCourses.length >= lv.min ? 'bg-white/15 border-white/20' : 'bg-white/5 border-white/5 opacity-50'}`}>
                    <span className="text-lg block">{lv.emoji}</span><p className="text-xs font-medium mt-1">{lv.title}</p>
                  </div>
                  {i < JOURNEY_LEVELS.length - 1 && <ArrowRight className="w-3 h-3 text-gray-500 shrink-0" />}
                </div>
              ))}
            </div>
          </div>

          {/* ── SKILL GAP ANALYSIS ── */}
          {skillGaps.length > 0 && (
            <>
              {/* Summary bar */}
              <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex flex-wrap items-center gap-4 justify-between">
                <div className="flex items-center gap-5 text-sm">
                  {criticalGaps.length > 0 && <span className="flex items-center gap-1.5 text-red-600 font-semibold"><span className="w-2 h-2 rounded-full bg-red-500" />{criticalGaps.length} Critical</span>}
                  {mediumGaps.length > 0 && <span className="flex items-center gap-1.5 text-amber-600 font-semibold"><span className="w-2 h-2 rounded-full bg-amber-500" />{mediumGaps.length} Growing</span>}
                  {lowGaps.length > 0 && <span className="flex items-center gap-1.5 text-emerald-600 font-semibold"><span className="w-2 h-2 rounded-full bg-emerald-500" />{lowGaps.length} Strong</span>}
                </div>
                <button onClick={() => downloadSkillPDF(learner, skillGaps, strengths, areasOfImprovement, qaPairs, learningGoals, interviewDate, courses)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-medium rounded-lg"
                  style={{ background: '#F05A28' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#c2410c'}
                  onMouseLeave={e => e.currentTarget.style.background = '#F05A28'}>
                  <Download className="w-3.5 h-3.5" /> Download Report
                </button>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="flex border-b border-gray-100 overflow-x-auto">
                  {[
                    { id: 'overview', label: '🕸️ Skill Map' },
                    { id: 'weak', label: `⚠️ Critical${criticalGaps.length ? ` (${criticalGaps.length})` : ''}` },
                    { id: 'medium', label: `📈 Growing${mediumGaps.length ? ` (${mediumGaps.length})` : ''}` },
                    { id: 'strengths', label: '💪 Strengths & Next Steps' },
                  ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveSkillTab(tab.id)}
                      className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeSkillTab === tab.id ? 'border-transparent' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                      style={activeSkillTab === tab.id ? { borderBottomColor: '#F05A28', color: '#F05A28', background: 'rgba(240,90,40,0.06)' } : {}}>
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="p-6">
                  {/* SKILL MAP — radar + learning roadmap */}
                  {activeSkillTab === 'overview' && (
                    <div className="grid md:grid-cols-3 gap-6">
                      <div className="md:col-span-2">
                        <p className="text-xs text-gray-400 mb-3">Hover the dots to see each skill. Inner = weaker, outer = stronger.</p>
                        <RadarChart skillGaps={skillGaps} />
                        <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Critical</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Growing</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Strong</span>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-800 mb-3">Learning Roadmap</h3>
                          {criticalGaps.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-semibold text-red-700 mb-1.5">Start here — critical gaps</p>
                              <div className="space-y-1.5">
                                {criticalGaps.map((g, i) => (
                                  <div key={i} className="bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                                    <span className="text-sm font-medium text-gray-800">{g.skill}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {mediumGaps.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-semibold text-amber-700 mb-1.5">Then focus on — growing skills</p>
                              <div className="space-y-1.5">
                                {mediumGaps.map((g, i) => (
                                  <div key={i} className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                    <span className="text-sm font-medium text-gray-800">{g.skill}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {lowGaps.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-emerald-700 mb-1.5">Maintain — strengths</p>
                              <div className="flex flex-wrap gap-1.5">
                                {lowGaps.map((g, i) => (
                                  <span key={i} className="text-xs px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full font-medium">{g.skill}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="rounded-xl p-4 border" style={{ background: 'rgba(240,90,40,0.06)', borderColor: 'rgba(240,90,40,0.18)' }}>
                          <p className="text-xs leading-relaxed" style={{ color: '#7c2d12' }}>
                            {avgScore >= 75
                              ? `Strong overall profile. The remaining gaps in ${criticalGaps.map(g => g.skill).join(', ') || 'a few areas'} are worth addressing to reach expert level.`
                              : avgScore >= 55
                              ? `Mixed profile — strong in some areas, gaps in others. Focus learning time on ${criticalGaps.slice(0, 2).map(g => g.skill).join(' and ') || 'weakest skills'} first.`
                              : `Several skills need significant development. A structured, course-by-course plan focused on critical areas will move the needle fastest.`}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CRITICAL */}
                  {activeSkillTab === 'weak' && (
                    <div className="space-y-3">
                      {criticalGaps.length === 0 ? (
                        <div className="text-center py-10 text-gray-400"><CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-400" /><p>No critical gaps!</p></div>
                      ) : (
                        <>
                          <p className="text-sm text-gray-500">Scores below 50 — these skills need immediate, structured training.</p>
                          {criticalGaps.map((g, i) => (
                            <div key={i} className="border border-red-200 rounded-xl overflow-hidden">
                              <div className="flex items-center justify-between px-4 py-3 bg-red-50">
                                <div className="flex items-center gap-3">
                                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                                  <span className="font-semibold text-gray-900">{g.skill}</span>
                                </div>
                                <span className="text-sm font-bold text-red-600">{g.score}/100</span>
                              </div>
                              <div className="px-4 pt-2 pb-1">
                                <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                                  <span>0</span>
                                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-red-500 rounded-full" style={{ width: `${g.score}%` }} />
                                  </div>
                                  <span className="text-gray-500 font-medium">70 proficient</span>
                                  <span className="text-gray-300">100</span>
                                </div>
                              </div>
                              <div className="px-4 pb-4 pt-2 grid sm:grid-cols-2 gap-3">
                                <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                                  <p className="text-xs font-semibold text-red-800 mb-1">What the AI found</p>
                                  <p className="text-xs text-red-700">
                                    {(g.observation && g.observation.toLowerCase().includes(g.skill.toLowerCase()))
                                      ? g.observation
                                      : g.score < 30 ? `Responses showed limited familiarity with core ${g.skill} concepts — answers lacked depth and applied confidence.`
                                      : g.score < 40 ? `Partial awareness of ${g.skill} was evident but significant gaps in application and accuracy under varied scenarios.`
                                      : `Basic ${g.skill} concepts were present but answers lacked specificity and confidence in practical situations.`}
                                  </p>
                                </div>
                                <div className="bg-white rounded-lg p-3 border border-gray-200">
                                  <p className="text-xs font-semibold text-gray-700 mb-1">Recommended action</p>
                                  <p className="text-xs text-gray-600">
                                    {g.score < 35
                                      ? `Start with a beginner-level course on ${g.skill} — build the foundation before diving into advanced material.`
                                      : `Enroll in an intermediate ${g.skill} course focused on real-world application and problem-solving.`}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}

                  {/* GROWING */}
                  {activeSkillTab === 'medium' && (
                    <div className="space-y-3">
                      {mediumGaps.length === 0 ? (
                        <div className="text-center py-10 text-gray-400"><p>No growing-skill gaps!</p></div>
                      ) : (
                        <>
                          <p className="text-sm text-gray-500">Scores 50–69 — a foundation exists. Targeted practice will close these gaps quickly.</p>
                          {mediumGaps.map((g, i) => {
                            const toGo = Math.max(0, 70 - g.score);
                            return (
                              <div key={i} className="border border-amber-200 rounded-xl overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 bg-amber-50">
                                  <div className="flex items-center gap-3">
                                    <TrendingUp className="w-4 h-4 text-amber-500 shrink-0" />
                                    <span className="font-semibold text-gray-900">{g.skill}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-amber-600 font-medium">{toGo} pts to go</span>
                                    <span className="text-sm font-bold text-amber-700">{g.score}/100</span>
                                  </div>
                                </div>
                                <div className="px-4 pt-2 pb-1">
                                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                                    <span>0</span>
                                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${g.score}%` }} />
                                    </div>
                                    <span className="text-gray-500 font-medium">70 proficient</span>
                                    <span className="text-gray-300">100</span>
                                  </div>
                                </div>
                                <div className="px-4 pb-4 pt-2 grid sm:grid-cols-2 gap-3">
                                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                                    <p className="text-xs font-semibold text-amber-800 mb-1">Where they're falling short</p>
                                    <p className="text-xs text-amber-700">
                                      {(g.observation && g.observation.toLowerCase().includes(g.skill.toLowerCase()))
                                        ? g.observation
                                        : g.score >= 65 ? `Most ${g.skill} scenarios were handled well but edge cases and nuanced variations caused errors.`
                                        : g.score >= 58 ? `Good conceptual grasp of ${g.skill} but inconsistent when applying to unfamiliar or complex situations.`
                                        : `${g.skill} knowledge exists but depth and consistency are missing — answers were surface-level in harder questions.`}
                                    </p>
                                  </div>
                                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                                    <p className="text-xs font-semibold text-gray-700 mb-1">Next step</p>
                                    <p className="text-xs text-gray-600">
                                      {g.score >= 65
                                        ? `Practice advanced ${g.skill} scenarios — case studies and mock exercises will cover the remaining gap.`
                                        : `Assign a focused intermediate course on ${g.skill} that emphasises applied, scenario-based learning.`}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}

                  {/* STRENGTHS & NEXT STEPS */}
                  {activeSkillTab === 'strengths' && (
                    <div className="space-y-5">
                      {lowGaps.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Skills They've Mastered</h3>
                          <div className="flex flex-wrap gap-2">
                            {lowGaps.map((g, i) => (
                              <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-sm font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" /> {g.skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {strengths.length > 0 && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                          <h3 className="text-sm font-bold text-emerald-800 mb-3">What stood out in the AI interview</h3>
                          <ul className="space-y-2">
                            {strengths.map((s, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-emerald-800">
                                <span className="text-emerald-500 mt-0.5 shrink-0">✓</span> {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {areasOfImprovement.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><Target className="w-4 h-4" style={{ color: '#F05A28' }} /> Specific Areas to Develop</h3>
                          <ul className="space-y-2">
                            {areasOfImprovement.map((a, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                                <span className="text-indigo-400 shrink-0 mt-0.5">→</span> {a}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {lowGaps.length === 0 && strengths.length === 0 && (
                        <div className="text-center py-10 text-gray-400"><p>No proficient skills identified yet.</p></div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Course Activity — completed courses with proof only */}
          {(() => {
            const completedCoursesList = courses.filter(c => c.status === 'completed');
            return (
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-emerald-600" /> Completed Courses
                  </h2>
                  <span className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-semibold">
                    {completedCoursesList.length} completed
                  </span>
                </div>
                {completedCoursesList.length === 0 ? (
                  <div className="text-center py-6">
                    <GraduationCap className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No completed courses yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {completedCoursesList.map((c) => (
                      <div key={c.id} className="p-4 rounded-xl border bg-emerald-50 border-emerald-200">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold shrink-0">✅</div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 text-sm truncate">{c.course_title || c.title}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{c.provider || ''}{c.completed_at ? ` · ${new Date(c.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}</p>
                            </div>
                          </div>
                          {c.proof_path ? (
                            <a
                              href={`${API_HOST}${c.proof_path}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border shrink-0 transition-colors"
                              style={{ color: '#059669', borderColor: '#6ee7b7', background: '#fff' }}
                            >
                              <Download className="w-3 h-3" /> View Certificate
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400 italic shrink-0">No proof uploaded</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}

      {/* Detailed Feedback Modal */}
      {feedbackModal && <FeedbackModal a={feedbackModal} onClose={() => setFeedbackModal(null)} />}

      {/* Mark Ready / Revert Confirmation Modal */}
      {readyConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setReadyConfirm(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center text-center">
            {readyConfirm.action === 'mark' ? (
              <>
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4 shadow-md">
                  <CheckCircle2 className="w-9 h-9 text-emerald-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Mark as Training-Complete?</h3>
                <p className="text-sm text-gray-500 mb-6">
                  You're about to mark <span className="font-semibold text-gray-800">{learner?.name}</span> as training-complete and ready for self-learning. This will notify them and unlock their learning dashboard.
                </p>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setReadyConfirm(null)}
                    className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                    Cancel
                  </button>
                  <button
                    disabled={markingReady}
                    onClick={async () => {
                      setMarkingReady(true);
                      setReadyConfirm(null);
                      try { await api.post(`/admin/users/${id}/mark-ready`); setIsReady(true); }
                      catch (e) { alert('Failed: ' + e.message); }
                      finally { setMarkingReady(false); }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors disabled:opacity-50">
                    {markingReady ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Yes, Mark Ready
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4 shadow-md">
                  <AlertTriangle className="w-9 h-9 text-amber-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Revert Ready Status?</h3>
                <p className="text-sm text-gray-500 mb-6">
                  This will revert <span className="font-semibold text-gray-800">{learner?.name}</span>'s training-complete status back to in-progress.
                </p>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setReadyConfirm(null)}
                    className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                    Cancel
                  </button>
                  <button
                    disabled={markingReady}
                    onClick={async () => {
                      setMarkingReady(true);
                      setReadyConfirm(null);
                      try { await api.post(`/admin/users/${id}/unmark-ready`); setIsReady(false); }
                      catch (e) { alert('Failed: ' + e.message); }
                      finally { setMarkingReady(false); }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-colors disabled:opacity-50">
                    Yes, Revert
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

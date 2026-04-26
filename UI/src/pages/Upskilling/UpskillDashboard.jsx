import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import {
  GraduationCap, UserCircle, Bot, Trophy, ArrowRight, Lock, Loader2,
  CheckCircle2, BookOpen, ExternalLink, Download, TrendingUp,
  AlertTriangle, Target, Star, Zap
} from 'lucide-react';

const QUEST_LEVELS = [
  { title: 'New Learner', min: 0, emoji: '🌱' },
  { title: 'Rising Learner', min: 1, emoji: '📗' },
  { title: 'Active Learner', min: 3, emoji: '⭐' },
  { title: 'Skilled Learner', min: 5, emoji: '🏆' },
  { title: 'Expert Learner', min: 8, emoji: '🏅' },
  { title: 'Champion Learner', min: 12, emoji: '✨' },
];

function getLevel(completedCount) {
  for (let i = QUEST_LEVELS.length - 1; i >= 0; i--) {
    if (completedCount >= QUEST_LEVELS[i].min) return QUEST_LEVELS[i];
  }
  return QUEST_LEVELS[0];
}

function RadarChart({ skillGaps }) {
  const [tooltip, setTooltip] = useState(null);
  const svgRef = useRef();
  if (!skillGaps || skillGaps.length === 0) return null;
  const size = 320; const cx = size / 2; const cy = size / 2; const R = 110; const levels = 5;
  const n = skillGaps.length;
  const angleStep = (2 * Math.PI) / n;
  const getAngle = (i) => -Math.PI / 2 + i * angleStep;
  const polar = (r, angle) => ({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  const spokes = skillGaps.map((_, i) => { const a = getAngle(i); const end = polar(R, a); return { x2: end.x, y2: end.y }; });
  const rings = Array.from({ length: levels }, (_, lvl) => {
    const r = (R * (lvl + 1)) / levels;
    return skillGaps.map((_, i) => { const p = polar(r, getAngle(i)); return `${p.x},${p.y}`; }).join(' ');
  });
  const dataPoints = skillGaps.map((g, i) => { const r = (R * Math.min(g.score, 100)) / 100; return polar(r, getAngle(i)); });
  const polygon = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');
  const labels = skillGaps.map((g, i) => { const a = getAngle(i); const p = polar(R + 30, a); return { ...p, text: g.skill, score: g.score, severity: g.severity }; });
  const severityColor = { High: '#ef4444', Medium: '#f59e0b', Low: '#10b981' };
  const handleMouseMove = (e, skill) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, skill });
  };
  return (
    <div className="relative select-none">
      <svg ref={svgRef} viewBox={`-70 -25 ${size + 140} ${size + 50}`} width="100%" style={{ maxWidth: 360, display: 'block', margin: '0 auto' }} onMouseLeave={() => setTooltip(null)}>
        {rings.map((pts, lvl) => (
          <polygon key={lvl} points={pts} fill="none" stroke={lvl === levels - 1 ? '#e2e8f0' : '#f1f5f9'} strokeWidth={lvl === levels - 1 ? 1.5 : 1} />
        ))}
        {Array.from({ length: levels }, (_, lvl) => {
          const r = (R * (lvl + 1)) / levels;
          return <text key={lvl} x={cx + r + 3} y={cy + 4} fontSize="8" fill="#94a3b8">{Math.round(((lvl + 1) / levels) * 100)}%</text>;
        })}
        {spokes.map((s, i) => <line key={i} x1={cx} y1={cy} x2={s.x2} y2={s.y2} stroke="#e2e8f0" strokeWidth={1} />)}
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
              <text x={l.x} y={l.y - 5} textAnchor={anchor} fontSize="9.5" fontWeight="600" fill={col}>{short}</text>
              <text x={l.x} y={l.y + 7} textAnchor={anchor} fontSize="9" fill="#64748b">{l.score}%</text>
            </g>
          );
        })}
      </svg>
      {tooltip && (
        <div className="absolute z-20 pointer-events-none bg-gray-900 text-white text-xs rounded-xl px-3 py-2 shadow-xl" style={{ left: tooltip.x + 12, top: tooltip.y - 10, minWidth: 170 }}>
          <p className="font-bold text-sm mb-1">{tooltip.skill.skill}</p>
          <p>Score: <span className="font-semibold">{tooltip.skill.score}/100</span></p>
          <p>Status: <span className={`font-semibold ${tooltip.skill.severity === 'High' ? 'text-red-400' : tooltip.skill.severity === 'Medium' ? 'text-amber-400' : 'text-emerald-400'}`}>
            {tooltip.skill.severity === 'High' ? '⚠️ Critical Gap' : tooltip.skill.severity === 'Medium' ? '📈 Needs Work' : '✅ Proficient'}
          </span></p>
          <p className="mt-1 text-gray-300 text-xs">
            {tooltip.skill.severity === 'High' ? 'Priority training needed immediately' : tooltip.skill.severity === 'Medium' ? 'Consistent practice recommended' : 'Maintain & build on this strength'}
          </p>
        </div>
      )}
    </div>
  );
}

function downloadSkillPDF(user, skillGaps, strengths, areasOfImprovement, qaPairs = [], learningGoals = null, interviewDate = null, courses = []) {
  const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const iDate = interviewDate ? new Date(interviewDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : null;
  const criticalGaps = skillGaps.filter(g => g.severity === 'High');
  const mediumGaps = skillGaps.filter(g => g.severity === 'Medium');
  const lowGaps = skillGaps.filter(g => g.severity === 'Low');
  const avgScore = skillGaps.length > 0 ? Math.round(skillGaps.reduce((s, g) => s + g.score, 0) / skillGaps.length) : 0;
  const esc = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const fallbackObservation = (g) => {
    if (g.severity === 'High') return g.score < 40
      ? `Responses showed limited familiarity with core ${esc(g.skill)} concepts — answers lacked depth and applied confidence.`
      : `Basic awareness of ${esc(g.skill)} was evident but answers were inconsistent when applied to varied scenarios.`;
    if (g.severity === 'Medium') return g.score >= 65
      ? `Performed well in standard ${esc(g.skill)} scenarios but struggled with edge cases and nuanced variations.`
      : `${esc(g.skill)} knowledge exists but depth and consistency were missing in more complex scenarios.`;
    return `Demonstrated confident, consistent understanding of ${esc(g.skill)} across all relevant scenarios.`;
  };

  const fallbackAction = (g) => {
    const goal = learningGoals ? ` This aligns with your stated goal: &ldquo;${esc(learningGoals.slice(0, 80))}${learningGoals.length > 80 ? '&hellip;' : ''}&rdquo;` : '';
    if (g.severity === 'High') return g.score < 35
      ? `Begin with a foundational course on ${esc(g.skill)} before advancing to practical application.${goal}`
      : `Enroll in an intermediate ${esc(g.skill)} course focused on real-world scenarios and problem-solving.${goal}`;
    if (g.severity === 'Medium') return g.score >= 65
      ? `Practice ${esc(g.skill)} through advanced case studies — the gap is narrow (${70 - g.score} pts) and targeted effort will close it quickly.${goal}`
      : `Take a scenario-based ${esc(g.skill)} course to build consistency under varied conditions.${goal}`;
    return `Continue applying ${esc(g.skill)} actively in day-to-day work. Consider mentoring peers or pursuing advanced specialisation.`;
  };

  const skillBlock = (g) => {
    const color  = g.severity === 'High' ? '#dc2626' : g.severity === 'Medium' ? '#d97706' : '#16a34a';
    const bg     = g.severity === 'High' ? '#fef2f2' : g.severity === 'Medium' ? '#fffbeb' : '#f0fdf4';
    const border = g.severity === 'High' ? '#fecaca' : g.severity === 'Medium' ? '#fde68a' : '#bbf7d0';
    const label  = g.severity === 'High' ? 'Critical Gap' : g.severity === 'Medium' ? 'Growing' : 'Proficient';
    const foundLabel  = g.severity === 'Medium' ? 'Where you\'re falling short' : 'What the AI found';
    const actionLabel = g.severity === 'Medium' ? 'Next step' : 'Recommended action';
    const toGo   = g.severity === 'Medium' ? ` &nbsp;&nbsp; ${Math.max(0, 70 - g.score)} pts to go` : '';
    const observation = g.observation ? esc(g.observation) : fallbackObservation(g);
    const action = fallbackAction(g);
    const qaBlock = (g.question_asked && g.answer_summary)
      ? `<div class="evidence-box">
          <div class="evidence-label">&#x1F4CB; Interview Evidence</div>
          <p class="evidence-q"><strong>Q:</strong> ${esc(g.question_asked)}</p>
          <p class="evidence-a"><strong>A:</strong> ${esc(g.answer_summary)}</p>
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
          <div class="transcript-a">${esc(qa.answer)}</div>
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
    ? `Mixed profile — strong in some areas, significant gaps in others. Prioritise <strong>${criticalGaps.slice(0, 2).map(g => esc(g.skill)).join('</strong> and <strong>') || 'critical skills'}</strong> first.`
    : `Several skills need significant development. A structured, course-by-course plan focused on critical areas will move the needle fastest.`;

  const logoUrl = `${window.location.origin}/logoimocha.png`;

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
  <title>Skill Gap Analysis — ${esc(user?.name)}</title>
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
        <div class="confidential-badge">CONFIDENTIAL</div>
      </div>
      <div class="meta-row">
        <div class="meta-item">Employee: <strong>${esc(user?.name || '—')}</strong></div>
        ${user?.department ? `<div class="meta-item">Department: <strong>${esc(user.department)}</strong></div>` : ''}
        ${user?.designation ? `<div class="meta-item">Designation: <strong>${esc(user.designation)}</strong></div>` : ''}
        ${iDate ? `<div class="meta-item">Interview Date: <strong>${iDate}</strong></div>` : ''}
        <div class="meta-item">Report Generated: <strong>${date}</strong></div>
      </div>
    </div>

    ${learningGoals ? `<div class="goal-banner">
      <div class="goal-icon">&#127919;</div>
      <div>
        <div class="goal-label">Your Stated Learning Goal</div>
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
    <div class="list-box"><ul>${strengths.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}

    ${areasOfImprovement.length > 0 ? `<h2><span class="icon">&#x1F3AF;</span>Specific Areas to Develop</h2>
    <div class="list-box"><ul>${areasOfImprovement.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}

    ${coursesBlock}
    ${transcriptBlock}

    <div class="footer">
      <div class="footer-left">
        <img src="${logoUrl}" alt="iMocha" style="height:18px;width:auto;margin-bottom:3px;display:block;object-fit:contain">
        <div style="margin-top:3px">Your personal skill gap report &mdash; generated by AI interview assessment.</div>
      </div>
      <div class="footer-right">
        <div>Report generated: ${date}</div>
        ${iDate ? `<div>Interview date: ${iDate}</div>` : ''}
        <div style="margin-top:3px;color:#6366f1;font-weight:600">AI-Assessed &middot; Confidential</div>
      </div>
    </div>

  </div>
  </body></html>`;

  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 400); }
}

export default function UpskillDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [skillGaps, setSkillGaps] = useState([]);
  const [strengths, setStrengths] = useState([]);
  const [areasOfImprovement, setAreasOfImprovement] = useState([]);
  const [qaPairs, setQaPairs] = useState([]);
  const [learningGoals, setLearningGoals] = useState(null);
  const [interviewDate, setInterviewDate] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    Promise.all([
      api.get('/profile/me').then(setProfile).catch(() => setProfile(null)),
      api.get('/ai/skill-analysis').then((data) => {
        setSkillGaps(data.skill_gaps || []);
        setStrengths(data.strengths || []);
        setAreasOfImprovement(data.areas_of_improvement || []);
        setQaPairs(data.qa_pairs || []);
        setLearningGoals(data.learning_goals || null);
        setInterviewDate(data.interview_date || null);
      }).catch(() => { }),
      api.get('/courses/my').then(setCourses).catch(() => setCourses([])),
    ]).finally(() => setLoading(false));
  }, []);

  const profileComplete = profile && (profile.summary || profile.learning_goals);
  const interviewDone = skillGaps.length > 0;
  const started = courses.filter((c) => c.status === 'started');
  const completed = courses.filter((c) => c.status === 'completed');
  const level = getLevel(completed.length);
  let currentStep = 1;
  if (profileComplete) currentStep = 2;
  if (profileComplete && interviewDone) currentStep = 3;

  const steps = [
    { num: 1, label: 'Complete Profile', emoji: '📋', desc: 'Tell us about your background & goals' },
    { num: 2, label: 'AI Interview', emoji: '🤖', desc: 'AI analyzes your skills & gaps' },
    { num: 3, label: 'Course Recommendations', emoji: '🎓', desc: 'Personalized learning path' },
  ];

  const criticalGaps = skillGaps.filter(g => g.severity === 'High');
  const mediumGaps = skillGaps.filter(g => g.severity === 'Medium');
  const lowGaps = skillGaps.filter(g => g.severity === 'Low');
  const avgScore = skillGaps.length > 0 ? Math.round(skillGaps.reduce((s, g) => s + g.score, 0) / skillGaps.length) : 0;

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      <span className="ml-3 text-gray-500">Loading your dashboard...</span>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{level.emoji}</span>
          <span className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full">{level.title}</span>
          <span className="text-sm bg-amber-400/30 px-2 py-0.5 rounded-full">🏆 {completed.length} Trophies</span>
        </div>
        <h1 className="text-2xl font-bold">Welcome, {user?.name}! 🚀</h1>
        <p className="text-indigo-200 text-sm mt-1">Your upskilling journey — follow the steps below to get started!</p>
        {user?.manager_name && <p className="text-indigo-300 text-xs mt-2">Manager: {user.manager_name}</p>}
      </div>

      {/* Step Progress */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5">🗺️ Your Journey</h2>
        <div className="flex items-center gap-0">
          {steps.map((step, i) => {
            const isDone = step.num < currentStep;
            const isActive = step.num === currentStep;
            return (
              <div key={step.num} className="flex items-center flex-1">
                <div className={`flex items-center gap-3 flex-1 px-4 py-3 rounded-xl border-2 transition-all ${isDone ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : isActive ? 'bg-indigo-50 border-indigo-400 text-indigo-700 ring-2 ring-indigo-200 shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                    {isDone ? <CheckCircle2 className="w-5 h-5" /> : step.num}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{step.emoji} {step.label}</p>
                    <p className="text-xs opacity-70">{step.desc}</p>
                  </div>
                </div>
                {i < steps.length - 1 && <ArrowRight className={`w-5 h-5 mx-2 shrink-0 ${isDone ? 'text-emerald-400' : 'text-gray-300'}`} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* My Journey — always visible below the step progress */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 text-white">
        <h2 className="font-semibold mb-4 flex items-center gap-2 text-sm"><Trophy className="w-4 h-4 text-amber-400" /> My Journey</h2>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {QUEST_LEVELS.map((lv, i) => (
            <div key={i} className="flex items-center gap-2 shrink-0">
              <div className={`text-center px-4 py-3 rounded-xl border transition-all ${completed.length >= lv.min ? 'bg-white/15 border-white/20' : 'bg-white/5 border-white/5 opacity-50'}`}>
                <span className="text-2xl block">{lv.emoji}</span>
                <p className="text-xs font-semibold mt-1.5">{lv.title}</p>
              </div>
              {i < QUEST_LEVELS.length - 1 && <ArrowRight className="w-3 h-3 text-gray-500 shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {currentStep === 1 && (
        <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border-2 border-indigo-200 rounded-2xl p-8 text-center">
          <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4"><UserCircle className="w-10 h-10 text-indigo-600" /></div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Step 1: Complete Your Profile</h2>
          <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">Tell us about your background, designation, experience, and learning goals.</p>
          <button onClick={() => navigate('/upskilling/profile')} className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all">
            <UserCircle className="w-5 h-5" /> Complete Profile →
          </button>
          <div className="mt-8 flex justify-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/60 rounded-lg border border-gray-200 text-gray-400 text-sm"><Lock className="w-4 h-4" /> AI Interview</div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/60 rounded-lg border border-gray-200 text-gray-400 text-sm"><Lock className="w-4 h-4" /> Course Recommendations</div>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="bg-gradient-to-br from-violet-50 to-purple-50 border-2 border-violet-200 rounded-2xl p-8 text-center">
          <div className="w-20 h-20 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4"><Bot className="w-10 h-10 text-violet-600" /></div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Step 2: AI Skill Assessment Interview</h2>
          <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">Complete a 10-question interview with our AI. It will analyze your skills, identify gaps, and recommend personalized courses.</p>
          <button onClick={() => navigate('/upskilling/interview')} className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 shadow-lg shadow-violet-200 transition-all">
            <Bot className="w-5 h-5" /> Start AI Interview →
          </button>
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-emerald-600"><CheckCircle2 className="w-4 h-4" /> Profile completed ✓</div>
          <div className="mt-4 flex justify-center">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/60 rounded-lg border border-gray-200 text-gray-400 text-sm"><Lock className="w-4 h-4" /> Course Recommendations — complete interview first</div>
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <>
          {/* Single summary bar — scores + actions in one row */}
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex flex-wrap items-center gap-4 justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3 text-sm">
                {criticalGaps.length > 0 && <span className="flex items-center gap-1.5 text-red-600 font-semibold"><span className="w-2 h-2 rounded-full bg-red-500" />{criticalGaps.length} Critical</span>}
                {mediumGaps.length > 0 && <span className="flex items-center gap-1.5 text-amber-600 font-semibold"><span className="w-2 h-2 rounded-full bg-amber-500" />{mediumGaps.length} Growing</span>}
                {lowGaps.length > 0 && <span className="flex items-center gap-1.5 text-emerald-600 font-semibold"><span className="w-2 h-2 rounded-full bg-emerald-500" />{lowGaps.length} Strong</span>}
              </div>
              <div className="h-8 w-px bg-gray-100" />
              <span className="text-sm text-gray-500">🏆 {completed.length} courses · {started.length} in progress</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Link to="/upskilling/profile" className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:shadow-sm transition-shadow">
                <UserCircle className="w-3.5 h-3.5 text-indigo-500" /> Update Profile
              </Link>
              <Link to="/upskilling/interview" className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:shadow-sm transition-shadow">
                <Bot className="w-3.5 h-3.5 text-violet-500" /> Retake Interview
              </Link>
              <button onClick={() => downloadSkillPDF(user, skillGaps, strengths, areasOfImprovement, qaPairs, learningGoals, interviewDate, courses.filter(c => c.status === 'recommended'))}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors">
                <Download className="w-3.5 h-3.5" /> Download Report
              </button>
            </div>
          </div>

          {/* Skill Analysis — tabbed */}
          {skillGaps.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex border-b border-gray-100 overflow-x-auto">
                {[
                  { id: 'overview', label: '🕸️ Skill Map' },
                  { id: 'weak', label: `⚠️ Critical${criticalGaps.length ? ` (${criticalGaps.length})` : ''}` },
                  { id: 'medium', label: `📈 Growing${mediumGaps.length ? ` (${mediumGaps.length})` : ''}` },
                  { id: 'strengths', label: '💪 Strengths & Next Steps' },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === tab.id ? 'border-indigo-500 text-indigo-600 bg-indigo-50/60' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {/* OVERVIEW — radar + strategic narrative only, no score repetition */}
                {activeTab === 'overview' && (
                  <div className="grid md:grid-cols-2 gap-8">
                    <div>
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
                        <h3 className="text-sm font-semibold text-gray-800 mb-3">Your Learning Roadmap</h3>
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
                            <p className="text-xs font-semibold text-emerald-700 mb-1.5">Maintain — your strengths</p>
                            <div className="flex flex-wrap gap-1.5">
                              {lowGaps.map((g, i) => (
                                <span key={i} className="text-xs px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full font-medium">{g.skill}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                        <p className="text-xs text-indigo-800 leading-relaxed">
                          {avgScore >= 75
                            ? `Strong overall profile. Your AI interview showed solid applied knowledge. The remaining gaps in ${criticalGaps.map(g => g.skill).join(', ') || 'a few areas'} are worth addressing to reach expert level.`
                            : avgScore >= 55
                            ? `Mixed profile — strong in some areas, gaps in others. Focus your learning time on ${criticalGaps.slice(0, 2).map(g => g.skill).join(' and ') || 'your weakest skills'} first before tackling growing skills.`
                            : `Several skills need significant development. Your interview revealed gaps in both foundational knowledge and practical application. A structured, course-by-course plan will move the needle fastest.`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* CRITICAL — skill + score bar + one specific action, no redundant boxes */}
                {activeTab === 'weak' && (
                  <div className="space-y-3">
                    {criticalGaps.length === 0 ? (
                      <div className="text-center py-10 text-gray-400"><CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-400" /><p>No critical gaps — great work!</p></div>
                    ) : (
                      <>
                        <p className="text-sm text-gray-500">Scores below 50 — these skills need immediate, structured training before anything else.</p>
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
                                  {g.score < 30
                                    ? 'Responses showed limited understanding of core concepts. Foundational study is needed before applied practice.'
                                    : g.score < 40
                                    ? 'Partial awareness of concepts but significant gaps in application and accuracy under varied scenarios.'
                                    : 'Basic concepts understood but answers lacked depth, specificity, and confidence in practical situations.'}
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

                {/* GROWING — progress bar with single insight, no repeated boxes */}
                {activeTab === 'medium' && (
                  <div className="space-y-3">
                    {mediumGaps.length === 0 ? (
                      <div className="text-center py-10 text-gray-400"><Star className="w-10 h-10 mx-auto mb-2 text-amber-400" /><p>No medium-priority gaps!</p></div>
                    ) : (
                      <>
                        <p className="text-sm text-gray-500">Scores 50–69 — you have a foundation here. Targeted practice will close these gaps quickly.</p>
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
                                  <p className="text-xs font-semibold text-amber-800 mb-1">Where you're falling short</p>
                                  <p className="text-xs text-amber-700">
                                    {g.score >= 65
                                      ? 'You answered most scenarios correctly but struggled with edge cases and nuanced variations.'
                                      : g.score >= 58
                                      ? 'Good conceptual grasp but inconsistent when applying to unfamiliar or complex situations.'
                                      : 'Knowledge exists but both depth and consistency are missing — answers were surface-level in harder questions.'}
                                  </p>
                                </div>
                                <div className="bg-white rounded-lg p-3 border border-gray-200">
                                  <p className="text-xs font-semibold text-gray-700 mb-1">Next step</p>
                                  <p className="text-xs text-gray-600">
                                    {g.score >= 65
                                      ? `Practice advanced ${g.skill} scenarios — case studies and mock exercises will cover the remaining gap.`
                                      : `Take a focused intermediate course on ${g.skill} that emphasises applied, scenario-based learning.`}
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

                {/* STRENGTHS — narrative, not a repeat of scores */}
                {activeTab === 'strengths' && (
                  <div className="space-y-5">
                    {/* Strong skills — chips only, radar already showed scores */}
                    {lowGaps.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Skills You've Mastered</h3>
                        <div className="flex flex-wrap gap-2">
                          {lowGaps.map((g, i) => (
                            <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-sm font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" /> {g.skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* AI observations — what the interview revealed */}
                    {strengths.length > 0 && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                        <h3 className="text-sm font-bold text-emerald-800 mb-3">What stood out in your AI interview</h3>
                        <ul className="space-y-2">
                          {strengths.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-emerald-800">
                              <span className="text-emerald-500 mt-0.5 shrink-0">✓</span> {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {/* Areas of improvement — specific, actionable, not a score rehash */}
                    {areasOfImprovement.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><Target className="w-4 h-4 text-indigo-500" /> Specific Areas to Develop</h3>
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
                      <div className="text-center py-10 text-gray-400"><Star className="w-10 h-10 mx-auto mb-2" /><p>Complete your AI interview to see strengths.</p></div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Course CTA */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><BookOpen className="w-5 h-5 text-emerald-600" /> Recommended Courses</h2>
                <p className="text-sm text-gray-500 mt-1">Based on your AI interview results. Start learning!</p>
              </div>
              <Link to="/upskilling/courses" className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 shadow-sm">
                <GraduationCap className="w-4 h-4" /> View Courses →
              </Link>
            </div>
            {courses.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {courses.slice(0, 3).map((c) => (
                  <div key={c.id} className="bg-white rounded-lg border border-gray-200 p-3">
                    {c.link ? <a href={c.link} target="_blank" rel="noreferrer" className="text-sm font-medium text-indigo-600 hover:underline truncate block">{c.title}</a> : <p className="text-sm font-medium text-gray-900 truncate">{c.title}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{c.provider}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : c.status === 'started' ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-500'}`}>{c.status}</span>
                      {c.link && <a href={c.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium">View <ExternalLink className="w-3 h-3" /></a>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

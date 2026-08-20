/**
 * SkillLineChart — SVG line chart showing individual skill scores.
 * X-axis: skill names. Y-axis: score 0-100.
 * Connected dots with gradient fill area below.
 */

import { useState } from 'react';

const COLORS = {
  line: '#6366f1',
  dot: '#6366f1',
  dotHover: '#4f46e5',
  fill: 'url(#lineGradient)',
  gridLine: '#e5e7eb',
  label: '#6b7280',
};

export default function SkillLineChart({ skillGaps = [], height = 220 }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!skillGaps.length) return null;

  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 50;
  const width = Math.max(500, skillGaps.length * 80 + paddingLeft + paddingRight);
  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const xStep = chartW / Math.max(skillGaps.length - 1, 1);

  const points = skillGaps.map((g, i) => {
    const score = g.score ?? 50;
    const x = paddingLeft + i * xStep;
    const y = paddingTop + chartH - (score / 100) * chartH;
    return { x, y, score, skill: g.skill || g.area || `Skill ${i + 1}`, severity: g.severity };
  });

  // Build polyline string
  const linePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  // Build area path (fill below line)
  const areaPath = `M ${points[0].x} ${paddingTop + chartH} ` +
    points.map((p) => `L ${p.x} ${p.y}`).join(' ') +
    ` L ${points[points.length - 1].x} ${paddingTop + chartH} Z`;

  // Y-axis grid lines
  const yTicks = [0, 25, 50, 75, 100];

  // Severity colors for dots
  const sevColor = { High: '#ef4444', Medium: '#f59e0b', Low: '#3b82f6' };

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="min-w-full">
        <defs>
          <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Y-axis grid lines + labels */}
        {yTicks.map((tick) => {
          const y = paddingTop + chartH - (tick / 100) * chartH;
          return (
            <g key={tick}>
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y}
                stroke={COLORS.gridLine} strokeWidth="1" strokeDasharray={tick === 0 ? '0' : '4,4'} />
              <text x={paddingLeft - 8} y={y + 4} textAnchor="end"
                fill={COLORS.label} fontSize="10" fontWeight="500">
                {tick}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaPath} fill={COLORS.fill} />

        {/* Line */}
        <polyline
          points={linePoints}
          fill="none"
          stroke={COLORS.line}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Dots + labels */}
        {points.map((p, i) => {
          const isHovered = hoveredIdx === i;
          const dotColor = sevColor[p.severity] || COLORS.dot;
          return (
            <g key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: 'pointer' }}>
              {/* Hover glow */}
              {isHovered && (
                <circle cx={p.x} cy={p.y} r={14}
                  fill={dotColor} opacity={0.15} />
              )}

              {/* Dot */}
              <circle cx={p.x} cy={p.y} r={isHovered ? 7 : 5}
                fill="white" stroke={dotColor} strokeWidth={isHovered ? 3 : 2.5}
                style={{ transition: 'all 0.15s ease' }} />

              {/* Score label above dot */}
              <text x={p.x} y={p.y - (isHovered ? 16 : 12)} textAnchor="middle"
                fill={dotColor} fontSize={isHovered ? '12' : '10'} fontWeight="700"
                style={{ transition: 'all 0.15s ease' }}>
                {p.score}
              </text>

              {/* X-axis skill label */}
              <text x={p.x} y={height - paddingBottom + 18} textAnchor="middle"
                fill={isHovered ? '#111827' : COLORS.label} fontSize="9" fontWeight={isHovered ? '600' : '500'}
                style={{ transition: 'all 0.15s ease' }}>
                {p.skill.length > 12 ? p.skill.slice(0, 10) + '…' : p.skill}
              </text>

              {/* Severity dot indicator below skill name */}
              <circle cx={p.x} cy={height - paddingBottom + 30} r={3}
                fill={dotColor} />
            </g>
          );
        })}

        {/* Tooltip on hover */}
        {hoveredIdx !== null && (() => {
          const p = points[hoveredIdx];
          const tooltipW = 120;
          const tooltipH = 40;
          let tx = p.x - tooltipW / 2;
          if (tx < 2) tx = 2;
          if (tx + tooltipW > width - 2) tx = width - tooltipW - 2;
          const ty = p.y - 50;
          return (
            <g>
              <rect x={tx} y={ty} width={tooltipW} height={tooltipH}
                rx={8} fill="#1f2937" opacity={0.95} />
              <text x={tx + tooltipW / 2} y={ty + 16} textAnchor="middle"
                fill="white" fontSize="10" fontWeight="600">
                {p.skill}
              </text>
              <text x={tx + tooltipW / 2} y={ty + 30} textAnchor="middle"
                fill="#94a3b8" fontSize="10">
                Score: {p.score}/100 · {p.severity}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

/**
 * SkillDetailPieChart — Shows each individual skill as a slice in a donut chart.
 * Slice size is proportional to (100 - score), i.e. bigger gap = bigger slice.
 * Color is based on severity. Legend lists all skills with scores.
 */

const SEVERITY_FILL = {
  High: '#ef4444',
  Medium: '#f59e0b',
  Low: '#3b82f6',
};

// Generate distinct hues for each skill, tinted by severity
function getSkillColor(index, total, severity) {
  const base = SEVERITY_FILL[severity] || '#6b7280';
  // Shift lightness slightly per index for visual distinction
  const lightShift = 10 - (index / Math.max(total, 1)) * 20; // -10 to +10
  // Use the base color with opacity variation
  return base;
}

// Curated palette for individual skill slices — vibrant and distinct
const SLICE_PALETTE = [
  '#6366f1', // indigo
  '#f43f5e', // rose
  '#0ea5e9', // sky
  '#f59e0b', // amber
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#ef4444', // red
  '#06b6d4', // cyan
  '#a855f7', // purple
  '#84cc16', // lime
  '#f97316', // orange
  '#3b82f6', // blue
  '#22d3ee', // light cyan
  '#e11d48', // deep rose
  '#7c3aed', // deep violet
  '#059669', // deep emerald
  '#d97706', // deep amber
  '#2563eb', // deep blue
];

function PieSlice({ cx, cy, r, startAngle, endAngle, color, onHover, hovered }) {
  const rad = (deg) => (deg - 90) * (Math.PI / 180);
  const x1 = cx + r * Math.cos(rad(startAngle));
  const y1 = cy + r * Math.sin(rad(startAngle));
  const x2 = cx + r * Math.cos(rad(endAngle));
  const y2 = cy + r * Math.sin(rad(endAngle));
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  // Handle full circle (single skill)
  if (endAngle - startAngle >= 359.9) {
    return (
      <circle cx={cx} cy={cy} r={r} fill={color}
        stroke={hovered ? '#fff' : 'rgba(255,255,255,0.2)'}
        strokeWidth={hovered ? 3 : 1.5}
        style={{
          transform: hovered ? 'scale(1.03)' : 'scale(1)',
          transformOrigin: `${cx}px ${cy}px`,
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          filter: hovered ? 'brightness(1.15)' : 'none',
        }}
        onMouseEnter={onHover}
      />
    );
  }

  const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  return (
    <path d={d} fill={color}
      stroke={hovered ? '#fff' : 'rgba(255,255,255,0.2)'}
      strokeWidth={hovered ? 3 : 1.5}
      style={{
        transform: hovered ? 'scale(1.04)' : 'scale(1)',
        transformOrigin: `${cx}px ${cy}px`,
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        filter: hovered ? 'brightness(1.15)' : 'none',
      }}
      onMouseEnter={onHover}
    />
  );
}

import { useState } from 'react';

export default function SkillDetailPieChart({ skillGaps = [], size = 260, darkMode = false }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!skillGaps.length) return null;

  // Each skill gets a slice proportional to its score (or equal if all same)
  const totalScore = skillGaps.reduce((s, g) => s + (g.score || 50), 0);

  // Build slices
  let currentAngle = 0;
  const slices = skillGaps.map((g, i) => {
    const score = g.score || 50;
    const angle = (score / totalScore) * 360;
    const start = currentAngle;
    const end = currentAngle + angle;
    currentAngle = end;
    return {
      ...g,
      idx: i,
      startAngle: start,
      endAngle: end,
      color: SLICE_PALETTE[i % SLICE_PALETTE.length],
      score,
    };
  });

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 6;
  const innerR = r * 0.5;

  const textColor = darkMode ? '#fff' : '#111827';
  const subTextColor = darkMode ? '#94a3b8' : '#6b7280';
  const cardBg = darkMode ? 'bg-slate-800/40 border-slate-700' : 'bg-white border-gray-200';
  const cardText = darkMode ? 'text-slate-200' : 'text-gray-800';
  const cardSubtext = darkMode ? 'text-slate-500' : 'text-gray-400';
  const scoreText = darkMode ? 'text-white' : 'text-gray-900';

  const hovered = hoveredIdx !== null ? slices[hoveredIdx] : null;

  return (
    <div className="flex flex-col lg:flex-row items-center gap-6">
      {/* Donut Chart */}
      <div className="relative shrink-0" style={{ width: size, height: size }}
        onMouseLeave={() => setHoveredIdx(null)}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background */}
          <circle cx={cx} cy={cy} r={r} fill={darkMode ? '#1e293b' : '#f8fafc'} />

          {/* Slices */}
          {slices.map((slice, i) => (
            <PieSlice
              key={i}
              cx={cx} cy={cy} r={r}
              startAngle={slice.startAngle}
              endAngle={slice.endAngle}
              color={slice.color}
              hovered={hoveredIdx === i}
              onHover={() => setHoveredIdx(i)}
            />
          ))}

          {/* Donut hole */}
          <circle cx={cx} cy={cy} r={innerR} fill={darkMode ? '#0f172a' : 'white'} />

          {/* Center text */}
          {hovered ? (
            <>
              <text x={cx} y={cy - 10} textAnchor="middle"
                fill={textColor} fontSize="22" fontWeight="700">
                {hovered.score}%
              </text>
              <text x={cx} y={cy + 10} textAnchor="middle"
                fill={subTextColor} fontSize="9" fontWeight="500">
                {(hovered.skill || hovered.area || '').length > 16
                  ? (hovered.skill || hovered.area || '').slice(0, 14) + '…'
                  : (hovered.skill || hovered.area)}
              </text>
            </>
          ) : (
            <>
              <text x={cx} y={cy - 6} textAnchor="middle"
                fill={textColor} fontSize="26" fontWeight="700">
                {skillGaps.length}
              </text>
              <text x={cx} y={cy + 14} textAnchor="middle"
                fill={subTextColor} fontSize="10" fontWeight="500">
                Skills
              </text>
            </>
          )}
        </svg>
      </div>

      {/* Legend — skill list */}
      <div className="flex-1 space-y-1.5 min-w-0 max-h-[320px] overflow-y-auto pr-1">
        {slices.map((slice, i) => {
          const sevColors = {
            High: darkMode ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700',
            Medium: darkMode ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700',
            Low: darkMode ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700',
          };
          return (
            <div
              key={i}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all cursor-pointer ${cardBg} ${hoveredIdx === i ? (darkMode ? 'ring-1 ring-cyan-400/50 bg-slate-700/60' : 'ring-1 ring-indigo-300 bg-indigo-50/50') : ''}`}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${cardText}`}>{slice.skill || slice.area}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${sevColors[slice.severity] || ''}`}>
                    {slice.severity}
                  </span>
                </div>
              </div>
              <span className={`text-base font-bold shrink-0 ml-2 ${scoreText}`}>
                {slice.score}<span className={`text-xs ${cardSubtext}`}>/100</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

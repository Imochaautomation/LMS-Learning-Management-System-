/**
 * SkillGaugeChart — Speedometer-style gauge showing average skill score.
 * 4 colored arcs: Red (0-25), Orange (26-50), Cyan (51-75), Green (76-100)
 * Needle points to the score. Boundary labels at 0, 26, 51, 76, 100.
 */

import { useState, useEffect } from 'react';

const SEGMENTS = [
  { min: 0, max: 33, color: '#f87171', label: 'High' },      // red — High severity (low score)
  { min: 34, max: 66, color: '#fbbf24', label: 'Medium' },    // amber — Medium severity
  { min: 67, max: 100, color: '#86efac', label: 'Low' },      // green — Low severity (high score)
];

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 180) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx, cy, r, startDeg, endDeg) {
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export default function SkillGaugeChart({ score = 0, size = 280 }) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score), 100);
    return () => clearTimeout(timer);
  }, [score]);

  const cx = size / 2;
  const cy = size * 0.55;
  const outerR = size * 0.42;
  const innerR = outerR * 0.65;
  const midR = (outerR + innerR) / 2;
  const arcWidth = outerR - innerR;

  // Gauge spans 180 degrees (left to right semicircle)
  const scoreToDeg = (s) => (s / 100) * 180;

  // Needle angle (0 = left, 180 = right)
  const needleAngle = scoreToDeg(Math.min(100, Math.max(0, animatedScore)));

  // Boundary labels positions
  const boundaries = [
    { value: 0, deg: 0 },
    { value: 34, deg: scoreToDeg(34) },
    { value: 67, deg: scoreToDeg(67) },
    { value: 100, deg: 180 },
  ];

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.62} viewBox={`0 0 ${size} ${size * 0.62}`}>
        {/* Gauge segments */}
        {SEGMENTS.map((seg, i) => {
          const startDeg = scoreToDeg(seg.min);
          const endDeg = scoreToDeg(seg.max);
          return (
            <path
              key={i}
              d={arcPath(cx, cy, midR, startDeg, endDeg)}
              fill="none"
              stroke={seg.color}
              strokeWidth={arcWidth}
              strokeLinecap="butt"
            />
          );
        })}

        {/* Segment divider lines */}
        {[34, 67].map((val) => {
          const deg = scoreToDeg(val);
          const p1 = polarToCartesian(cx, cy, innerR - 2, deg);
          const p2 = polarToCartesian(cx, cy, outerR + 2, deg);
          return (
            <line key={val} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke="white" strokeWidth="2.5" />
          );
        })}

        {/* Boundary labels */}
        {boundaries.map((b) => {
          const labelR = outerR + 16;
          const pos = polarToCartesian(cx, cy, labelR, b.deg);
          return (
            <text key={b.value} x={pos.x} y={pos.y}
              textAnchor="middle" dominantBaseline="middle"
              fill="#6b7280" fontSize="12" fontWeight="600">
              {b.value}
            </text>
          );
        })}

        {/* Needle */}
        {(() => {
          const needleLen = innerR + arcWidth * 0.9;
          const needleRad = ((needleAngle - 180) * Math.PI) / 180;
          const tipX = cx + needleLen * Math.cos(needleRad);
          const tipY = cy + needleLen * Math.sin(needleRad);

          // Base width for the needle triangle
          const baseOffset = 5;
          const perpRad = needleRad + Math.PI / 2;
          const b1x = cx + baseOffset * Math.cos(perpRad);
          const b1y = cy + baseOffset * Math.sin(perpRad);
          const b2x = cx - baseOffset * Math.cos(perpRad);
          const b2y = cy - baseOffset * Math.sin(perpRad);

          return (
            <g style={{ transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
              <polygon
                points={`${tipX},${tipY} ${b1x},${b1y} ${b2x},${b2y}`}
                fill="#1f2937"
                style={{
                  transformOrigin: `${cx}px ${cy}px`,
                  transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              />
              <circle cx={cx} cy={cy} r={7} fill="#1f2937" />
              <circle cx={cx} cy={cy} r={3.5} fill="#ffffff" />
            </g>
          );
        })()}
      </svg>

      {/* Score display below */}
      <div className="text-center -mt-2">
        <span className="text-3xl font-bold text-gray-900">{score}</span>
        <span className="text-lg text-gray-400 ml-1">/100</span>
        <p className="text-xs text-gray-500 mt-1">Average Skill Score</p>
      </div>
    </div>
  );
}

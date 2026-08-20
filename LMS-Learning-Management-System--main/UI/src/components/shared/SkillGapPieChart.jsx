/**
 * SkillGapPieChart — A pure SVG donut/pie chart for skill gap visualization.
 * No external dependencies required.
 */

const SEVERITY_COLORS = {
  High: { fill: '#ef4444', bg: '#fef2f2', text: '#dc2626', label: 'High Priority' },
  Medium: { fill: '#f59e0b', bg: '#fffbeb', text: '#d97706', label: 'Medium Priority' },
  Low: { fill: '#3b82f6', bg: '#eff6ff', text: '#2563eb', label: 'Low Priority' },
};

function PieSlice({ cx, cy, r, startAngle, endAngle, color, hovered }) {
  const rad = (deg) => (deg - 90) * (Math.PI / 180);
  const x1 = cx + r * Math.cos(rad(startAngle));
  const y1 = cy + r * Math.sin(rad(startAngle));
  const x2 = cx + r * Math.cos(rad(endAngle));
  const y2 = cy + r * Math.sin(rad(endAngle));
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

  return (
    <path
      d={d}
      fill={color}
      stroke="white"
      strokeWidth="2"
      style={{
        transform: hovered ? 'scale(1.04)' : 'scale(1)',
        transformOrigin: `${cx}px ${cy}px`,
        transition: 'transform 0.2s ease',
        cursor: 'pointer',
      }}
    />
  );
}

export default function SkillGapPieChart({ skillGaps = [], size = 220, darkMode = false }) {
  if (!skillGaps.length) return null;

  // Group by severity
  const groups = { High: 0, Medium: 0, Low: 0 };
  skillGaps.forEach((g) => {
    if (groups[g.severity] !== undefined) groups[g.severity]++;
  });

  const total = skillGaps.length;
  const slices = Object.entries(groups)
    .filter(([, count]) => count > 0)
    .map(([severity, count]) => ({
      severity,
      count,
      percentage: Math.round((count / total) * 100),
      color: SEVERITY_COLORS[severity].fill,
    }));

  // Build pie angles
  let currentAngle = 0;
  const pieSlices = slices.map((slice) => {
    const angle = (slice.count / total) * 360;
    const start = currentAngle;
    const end = currentAngle + angle;
    currentAngle = end;
    return { ...slice, startAngle: start, endAngle: end };
  });

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;
  const innerR = r * 0.55; // Donut hole

  const textColor = darkMode ? 'text-white' : 'text-gray-900';
  const subtextColor = darkMode ? 'text-slate-400' : 'text-gray-500';
  const legendBg = darkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-200';
  const legendText = darkMode ? 'text-slate-300' : 'text-gray-700';
  const legendSubtext = darkMode ? 'text-slate-500' : 'text-gray-400';

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      {/* Pie Chart */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background circle */}
          <circle cx={cx} cy={cy} r={r} fill={darkMode ? '#1e293b' : '#f8fafc'} />
          
          {/* Pie slices */}
          {pieSlices.map((slice, i) => (
            <PieSlice
              key={slice.severity}
              cx={cx} cy={cy} r={r}
              startAngle={slice.startAngle}
              endAngle={slice.endAngle}
              color={slice.color}
            />
          ))}

          {/* Donut hole */}
          <circle cx={cx} cy={cy} r={innerR} fill={darkMode ? '#0f172a' : 'white'} />
          
          {/* Center text */}
          <text x={cx} y={cy - 6} textAnchor="middle" className={`text-2xl font-bold`}
            fill={darkMode ? '#fff' : '#111827'} fontSize="28" fontWeight="700">
            {total}
          </text>
          <text x={cx} y={cy + 16} textAnchor="middle"
            fill={darkMode ? '#94a3b8' : '#6b7280'} fontSize="11" fontWeight="500">
            Skills Analyzed
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex-1 space-y-2 min-w-0">
        {slices.map((slice) => {
          const sev = SEVERITY_COLORS[slice.severity];
          return (
            <div key={slice.severity} className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${legendBg} transition-all hover:shadow-sm`}>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: sev.fill }} />
                <div>
                  <p className={`text-sm font-semibold ${legendText}`}>{sev.label}</p>
                  <p className={`text-xs ${legendSubtext}`}>{slice.count} skill{slice.count > 1 ? 's' : ''}</p>
                </div>
              </div>
              <span className="text-lg font-bold" style={{ color: sev.fill }}>{slice.percentage}%</span>
            </div>
          );
        })}
        
        {/* Skill list */}
        <div className={`mt-3 pt-3 border-t ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
          <p className={`text-xs font-semibold mb-2 ${subtextColor}`}>Individual Skills</p>
          <div className="flex flex-wrap gap-1.5">
            {skillGaps.map((g, i) => (
              <span key={i} className="text-xs px-2 py-1 rounded-full font-medium"
                style={{
                  backgroundColor: SEVERITY_COLORS[g.severity]?.bg || '#f3f4f6',
                  color: SEVERITY_COLORS[g.severity]?.text || '#6b7280',
                }}>
                {g.skill || g.area} · {g.score || '—'}%
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

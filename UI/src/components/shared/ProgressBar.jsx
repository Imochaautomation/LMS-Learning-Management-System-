export default function ProgressBar({ value, max = 100, color = 'indigo', size = 'md' }) {
  const pct = Math.min(Math.round((value / max) * 100), 100);
  const h = size === 'sm' ? 'h-1.5' : 'h-2.5';
  const colors = {
    indigo: 'bg-indigo-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  };

  return (
    <div className="w-full">
      <div className={`w-full bg-gray-100 rounded-full ${h} overflow-hidden`}>
        <div
          className={`${h} rounded-full transition-all duration-500 ${colors[color]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

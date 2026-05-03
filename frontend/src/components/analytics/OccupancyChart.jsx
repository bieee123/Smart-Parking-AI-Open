import { useMemo } from 'react';

/**
 * OccupancyChart — pure SVG line chart with mock time-series data.
 * No external dependencies.
 *
 * Props:
 *  - data: number[] — y-axis values (0-100 scale recommended)
 *  - labels: string[] — x-axis labels
 *  - title: string
 *  - height: number (default 220)
 *  - color: string (default #6366f1 — indigo)
 */
export default function OccupancyChart({ data, labels, title, height = 220, color = '#6366f1' }) {
  const padding = { top: 20, right: 20, bottom: 36, left: 44 };
  const W = 600;
  const H = height;
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;

  const maxVal = Math.max(...data, 100);
  const minVal = 0;

  const points = useMemo(() => {
    return data.map((val, i) => {
      const x = padding.left + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2);
      const y = padding.top + chartH - ((val - minVal) / (maxVal - minVal)) * chartH;
      return { x, y, val };
    });
  }, [data, maxVal, minVal, chartW, chartH, padding.left, padding.top]);

  // Build smooth path
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Area fill path
  const areaPath =
    linePath +
    ` L ${points[points.length - 1].x} ${padding.top + chartH}` +
    ` L ${points[0].x} ${padding.top + chartH} Z`;

  // Grid lines (5 horizontal)
  const gridLines = Array.from({ length: 5 }, (_, i) => {
    const val = Math.round((maxVal / 4) * i);
    const y = padding.top + chartH - (i / 4) * chartH;
    return { val, y };
  });

  return (
    <div className="w-full">
      {title && <h3 className="text-sm font-semibold text-gray-700 mb-2">{title}</h3>}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ minWidth: 300 }}>
        {/* Grid */}
        {gridLines.map((g) => (
          <g key={g.y}>
            <line x1={padding.left} y1={g.y} x2={W - padding.right} y2={g.y} stroke="#e5e7eb" strokeWidth={1} />
            <text x={padding.left - 6} y={g.y + 4} textAnchor="end" fontSize={10} fill="#9ca3af">
              {g.val}%
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill={color} fillOpacity={0.1} />

        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

        {/* Dots */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3} fill="white" stroke={color} strokeWidth={2} />
            {labels && labels[i] && (
              <text x={p.x} y={padding.top + chartH + 18} textAnchor="middle" fontSize={9} fill="#9ca3af">
                {labels[i]}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

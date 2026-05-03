/**
 * PredictedDemandChart — pure SVG bar chart showing predicted demand.
 * No external dependencies.
 *
 * Props:
 *  - data: { hour: string, predicted: number, actual?: number }[]
 *  - title: string
 */
export default function PredictedDemandChart({ data, title }) {
  const padding = { top: 20, right: 20, bottom: 36, left: 44 };
  const W = 600;
  const H = 220;
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;

  const maxVal = Math.max(...data.map((d) => Math.max(d.predicted, d.actual || 0)), 100);
  const barGroupWidth = chartW / data.length;
  const barWidth = barGroupWidth * 0.3;

  return (
    <div className="w-full">
      {title && <h3 className="text-sm font-semibold text-gray-700 mb-2">{title}</h3>}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ minWidth: 300 }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const val = Math.round(maxVal * frac);
          const y = padding.top + chartH - frac * chartH;
          return (
            <g key={frac}>
              <line x1={padding.left} y1={y} x2={W - padding.right} y2={y} stroke="#e5e7eb" strokeWidth={1} />
              <text x={padding.left - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#9ca3af">
                {val}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const x = padding.left + i * barGroupWidth + barGroupWidth * 0.15;

          // Predicted bar
          const predH = (d.predicted / maxVal) * chartH;
          const predY = padding.top + chartH - predH;

          // Actual bar (if available)
          const actH = d.actual ? (d.actual / maxVal) * chartH : 0;
          const actY = d.actual ? padding.top + chartH - actH : 0;

          return (
            <g key={i}>
              {/* Predicted */}
              <rect x={x} y={predY} width={barWidth} height={predH} rx={3} fill="#6366f1" fillOpacity={0.85} />
              {/* Actual (if exists) */}
              {d.actual && (
                <rect
                  x={x + barWidth + 2}
                  y={actY}
                  width={barWidth}
                  height={actH}
                  rx={3}
                  fill="#10b981"
                  fillOpacity={0.85}
                />
              )}
              {/* Label */}
              <text
                x={x + barWidth}
                y={padding.top + chartH + 16}
                textAnchor="middle"
                fontSize={9}
                fill="#9ca3af"
              >
                {d.hour}
              </text>
            </g>
          );
        })}

        {/* Legend */}
        <rect x={W - 160} y={8} width={10} height={10} rx={2} fill="#6366f1" fillOpacity={0.85} />
        <text x={W - 146} y={17} fontSize={10} fill="#6b7280">Predicted</text>
        <rect x={W - 80} y={8} width={10} height={10} rx={2} fill="#10b981" fillOpacity={0.85} />
        <text x={W - 66} y={17} fontSize={10} fill="#6b7280">Actual</text>
      </svg>
    </div>
  );
}

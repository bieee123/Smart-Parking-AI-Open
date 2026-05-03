/**
 * CorrelationChart — pure SVG horizontal bar chart showing
 * traffic volume vs parking occupancy correlation per area.
 *
 * Props:
 *  - data: { label: string, traffic: number, occupancy: number }[]
 *  - title: string
 */
export default function CorrelationChart({ data, title }) {
  const padding = { top: 20, right: 30, bottom: 20, left: 140 };
  const W = 600;
  const rowH = 36;
  const H = padding.top + padding.bottom + data.length * rowH;
  const chartW = W - padding.left - padding.right;

  return (
    <div className="w-full">
      {title && <h3 className="text-sm font-semibold text-gray-700 mb-2">{title}</h3>}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ minWidth: 300 }}>
        {data.map((d, i) => {
          const y = padding.top + i * rowH;
          const trafficW = d.traffic * chartW;
          const occupancyW = d.occupancy * chartW;

          return (
            <g key={i}>
              {/* Label */}
              <text x={padding.left - 8} y={y + 14} textAnchor="end" fontSize={10} fill="#374151">
                {d.label}
              </text>

              {/* Traffic bar */}
              <rect x={padding.left} y={y + 2} width={trafficW} height={12} rx={3} fill="#3b82f6" fillOpacity={0.7} />

              {/* Occupancy bar */}
              <rect x={padding.left} y={y + 18} width={occupancyW} height={12} rx={3} fill="#f59e0b" fillOpacity={0.7} />

              {/* Values */}
              <text x={padding.left + trafficW + 4} y={y + 12} fontSize={9} fill="#3b82f6">
                {d.traffic.toFixed(2)}
              </text>
              <text x={padding.left + occupancyW + 4} y={y + 28} fontSize={9} fill="#f59e0b">
                {d.occupancy.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* Legend */}
        <rect x={W - 170} y={4} width={10} height={10} rx={2} fill="#3b82f6" fillOpacity={0.7} />
        <text x={W - 156} y={13} fontSize={10} fill="#6b7280">Traffic Volume</text>
        <rect x={W - 75} y={4} width={10} height={10} rx={2} fill="#f59e0b" fillOpacity={0.7} />
        <text x={W - 61} y={13} fontSize={10} fill="#6b7280">Occupancy</text>
      </svg>
    </div>
  );
}

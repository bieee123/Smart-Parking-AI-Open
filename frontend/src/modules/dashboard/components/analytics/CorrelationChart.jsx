/**
 * CorrelationChart — pure SVG vertical grouped bar chart showing
 * traffic volume vs parking occupancy correlation per area.
 *
 * Props:
 *  - data: { label: string, traffic: number, occupancy: number }[]
 *  - title: string
 */
export default function CorrelationChart({ data, title }) {
  const padding = { top: 40, right: 60, bottom: 30, left: 160 };
  const W = 600;
  // Dynamic height: minimum 200, plus 60px per area
  const H = Math.max(200, data.length * 60 + padding.top + padding.bottom);
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;
  
  const groupH = chartH / Math.max(1, data.length);
  const barH = Math.min(groupH * 0.35, 24); // Slightly smaller bars to fit labels better
  const gap = (groupH - barH * 2 - 4) / 2; // vertically center the group

  return (
    <div className="w-full">
      {title && <h3 className="text-lg font-semibold text-gray-700 mb-6">{title}</h3>}
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ minHeight: 200 }}>
          {/* Grid lines (vertical now) */}
          {[0, 0.25, 0.5, 0.75, 1].map(v => {
            const x = padding.left + chartW * v;
            return (
              <g key={v}>
                <line x1={x} y1={padding.top} x2={x} y2={H - padding.bottom} stroke="#f3f4f6" strokeWidth={1} />
                <text x={x} y={H - padding.bottom + 16} textAnchor="middle" fontSize={10} fill="#9ca3af">{v * 100}%</text>
              </g>
            );
          })}

          {data.map((d, i) => {
            const groupY = padding.top + i * groupH + gap;
            const trafficW = d.traffic * chartW;
            const occupancyW = d.occupancy * chartW;

            return (
              <g key={i}>
                {/* Y-axis Label */}
                <text 
                  x={padding.left - 10} 
                  y={groupY + barH + 2} 
                  textAnchor="end" 
                  fontSize={11} 
                  fontWeight="500"
                  fill="#4b5563"
                >
                  {d.label}
                </text>

                {/* Traffic bar */}
                <rect 
                  x={padding.left} 
                  y={groupY} 
                  width={trafficW} 
                  height={barH} 
                  rx={4} 
                  fill="#3b82f6" 
                  fillOpacity={0.8} 
                  className="transition-all duration-500"
                />
                <text 
                  x={padding.left + trafficW + 6} 
                  y={groupY + barH/2 + 3} 
                  textAnchor="start" 
                  fontSize={10} 
                  fill="#1d4ed8" 
                  fontWeight="bold"
                >
                  {d.trafficLabel || '0'}
                </text>

                {/* Occupancy bar */}
                <rect 
                  x={padding.left} 
                  y={groupY + barH + 4} 
                  width={occupancyW} 
                  height={barH} 
                  rx={4} 
                  fill="#f59e0b" 
                  fillOpacity={0.8} 
                  className="transition-all duration-500"
                />
                <text 
                  x={padding.left + occupancyW + 6} 
                  y={groupY + barH * 1.5 + 4 + 3} 
                  textAnchor="start" 
                  fontSize={10} 
                  fill="#b45309" 
                  fontWeight="bold"
                >
                  {d.occupancyLabel || '0%'}
                </text>
              </g>
            );
          })}

          {/* Legend */}
          <g transform={`translate(${W - 220}, 10)`}>
            <rect width={10} height={10} rx={2} fill="#3b82f6" fillOpacity={0.8} />
            <text x={16} y={9} fontSize={10} fill="#6b7280">Traffic Volume</text>
            <rect x={100} width={10} height={10} rx={2} fill="#f59e0b" fillOpacity={0.8} />
            <text x={116} y={9} fontSize={10} fill="#6b7280">Occupancy</text>
          </g>
        </svg>
      </div>
    </div>
  );
}

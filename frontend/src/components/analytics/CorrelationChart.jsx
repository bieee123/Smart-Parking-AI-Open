/**
 * CorrelationChart — pure SVG vertical grouped bar chart showing
 * traffic volume vs parking occupancy correlation per area.
 *
 * Props:
 *  - data: { label: string, traffic: number, occupancy: number }[]
 *  - title: string
 */
export default function CorrelationChart({ data, title }) {
  const padding = { top: 40, right: 30, bottom: 40, left: 40 };
  const W = 600;
  const H = 300;
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;
  
  const groupW = chartW / Math.max(1, data.length);
  const barW = groupW * 0.35;
  const gap = groupW * 0.1;

  return (
    <div className="w-full">
      {title && <h3 className="text-lg font-semibold text-gray-700 mb-6">{title}</h3>}
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ minHeight: 200 }}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(v => {
            const y = padding.top + chartH * (1 - v);
            return (
              <g key={v}>
                <line x1={padding.left} y1={y} x2={W - padding.right} y2={y} stroke="#f3f4f6" strokeWidth={1} />
                <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize={10} fill="#9ca3af">{v * 100}%</text>
              </g>
            );
          })}

          {data.map((d, i) => {
            const groupX = padding.left + i * groupW + gap;
            const trafficH = d.traffic * chartH;
            const occupancyH = d.occupancy * chartH;

            return (
              <g key={i}>
                {/* Traffic bar */}
                <rect 
                  x={groupX} 
                  y={padding.top + chartH - trafficH} 
                  width={barW} 
                  height={trafficH} 
                  rx={4} 
                  fill="#3b82f6" 
                  fillOpacity={0.8} 
                  className="transition-all duration-500"
                />
                <text 
                  x={groupX + barW/2} 
                  y={padding.top + chartH - trafficH - 6} 
                  textAnchor="middle" 
                  fontSize={10} 
                  fill="#1d4ed8" 
                  fontWeight="bold"
                >
                  {d.trafficLabel || '0'}
                </text>

                {/* Occupancy bar */}
                <rect 
                  x={groupX + barW + 4} 
                  y={padding.top + chartH - occupancyH} 
                  width={barW} 
                  height={occupancyH} 
                  rx={4} 
                  fill="#f59e0b" 
                  fillOpacity={0.8} 
                  className="transition-all duration-500"
                />
                <text 
                  x={groupX + barW * 1.5 + 4} 
                  y={padding.top + chartH - occupancyH - 6} 
                  textAnchor="middle" 
                  fontSize={10} 
                  fill="#b45309" 
                  fontWeight="bold"
                >
                  {d.occupancyLabel || '0%'}
                </text>

                {/* X-axis Label */}
                <text 
                  x={groupX + barW} 
                  y={H - padding.bottom + 18} 
                  textAnchor="middle" 
                  fontSize={11} 
                  fontWeight="500"
                  fill="#4b5563"
                >
                  {d.label}
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

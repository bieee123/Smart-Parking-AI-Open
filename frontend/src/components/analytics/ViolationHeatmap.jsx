/**
 * ViolationHeatmap — CSS grid heatmap showing violation density per zone.
 * Pure CSS, no external dependencies.
 *
 * Props:
 *  - data: { zone: string, row: number, col: number, value: number }[]
 *  - rows: number
 *  - cols: number
 *  - title: string
 */

const SEVERITY_COLORS = [
  'bg-green-100 text-green-800',   // 0 — very low
  'bg-green-200 text-green-800',   // 1
  'bg-yellow-100 text-yellow-800', // 2
  'bg-yellow-200 text-yellow-800', // 3
  'bg-orange-200 text-orange-800', // 4
  'bg-orange-300 text-orange-900', // 5
  'bg-red-200 text-red-800',       // 6
  'bg-red-300 text-red-900',       // 7
  'bg-red-400 text-white',         // 8
  'bg-red-600 text-white',         // 9 — critical
];

function getColor(value) {
  const idx = Math.min(Math.floor(value), SEVERITY_COLORS.length - 1);
  return SEVERITY_COLORS[idx];
}

export default function ViolationHeatmap({ data, rows = 5, cols = 5, title }) {
  return (
    <div className="w-full">
      {title && <h3 className="text-sm font-semibold text-gray-700 mb-2">{title}</h3>}

      {/* Column headers */}
      <div className="flex">
        <div className="w-8 shrink-0" />
        <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }, (_, c) => (
            <div key={c} className="text-center text-xs text-gray-400">Col {c + 1}</div>
          ))}
        </div>
      </div>

      {/* Rows */}
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-stretch mb-1">
          <div className="w-8 text-xs text-gray-400 flex items-center justify-center shrink-0">
            Row {r + 1}
          </div>
          <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {Array.from({ length: cols }, (_, c) => {
              const cell = data.find((d) => d.row === r && d.col === c);
              const val = cell ? cell.value : 0;
              const zone = cell ? cell.zone : '—';
              return (
                <div
                  key={c}
                  className={`rounded flex items-center justify-center text-xs font-medium aspect-square transition-all cursor-default ${getColor(val)}`}
                  title={`Zone: ${zone} | Severity: ${val.toFixed(1)}`}
                >
                  {val.toFixed(1)}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="flex items-center gap-1 mt-3 text-xs text-gray-500">
        <span>Low</span>
        {SEVERITY_COLORS.map((cls, i) => (
          <div key={i} className={`w-4 h-3 rounded ${cls.split(' ')[0]}`} />
        ))}
        <span>Critical</span>
      </div>
    </div>
  );
}

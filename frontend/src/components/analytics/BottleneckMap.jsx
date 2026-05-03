/**
 * BottleneckMap — visual placeholder for bottleneck detection.
 * Shows colored circles on a simple block representing parking areas.
 *
 * Props:
 *  - bottlenecks: { id: string, name: string, severity: number, status: string, x: number, y: number }[]
 *  - title: string
 */

const STATUS_COLORS = {
  active: 'bg-red-500 animate-pulse',
  mitigating: 'bg-yellow-500 animate-pulse',
  resolved: 'bg-green-400',
};

const STATUS_LABEL_COLORS = {
  active: 'bg-red-100 text-red-700',
  mitigating: 'bg-yellow-100 text-yellow-700',
  resolved: 'bg-green-100 text-green-700',
};

export default function BottleneckMap({ bottlenecks, title }) {
  return (
    <div className="w-full">
      {title && <h3 className="text-sm font-semibold text-gray-700 mb-2">{title}</h3>}

      {/* Map placeholder */}
      <div className="relative w-full bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg border border-slate-200 overflow-hidden" style={{ minHeight: 260 }}>
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        {/* Area labels */}
        <div className="absolute top-3 left-4 flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-white/80 backdrop-blur-sm px-2 py-1 rounded border border-slate-200 shadow-sm">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="9" rx="1"/>
            <rect x="14" y="3" width="7" height="5" rx="1"/>
            <rect x="14" y="12" width="7" height="9" rx="1"/>
            <rect x="3" y="16" width="7" height="5" rx="1"/>
            <path d="M7 12v4M17 8v4"/>
          </svg>
          <span>Area A — Downtown</span>
        </div>

        <div className="absolute top-3 right-4 flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-white/80 backdrop-blur-sm px-2 py-1 rounded border border-slate-200 shadow-sm">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            <path d="M9 22V12h6v10"/>
            <path d="M6 12h12"/>
            <path d="M8 6h8"/>
            <rect x="10" y="15" width="4" height="4" rx="0.5"/>
          </svg>
          <span>Area B — Mall</span>
        </div>

        <div className="absolute bottom-3 left-4 flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-white/80 backdrop-blur-sm px-2 py-1 rounded border border-slate-200 shadow-sm">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2"/>
            <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
            <line x1="12" y1="12" x2="12" y2="12.01"/>
            <path d="M8 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>
          </svg>
          <span>Area C — Office</span>
        </div>

        {/* Bottleneck dots */}
        {bottlenecks.map((b) => (
          <div
            key={b.id}
            className="absolute group"
            style={{ left: `${b.x}%`, top: `${b.y}%`, transform: 'translate(-50%, -50%)' }}
          >
            {/* Pulsing dot */}
            <div className={`w-5 h-5 rounded-full ${STATUS_COLORS[b.status] || 'bg-gray-400'} shadow-lg border-2 border-white`} />

            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
              <div className="bg-white rounded-lg shadow-xl border border-gray-200 px-3 py-2 text-xs whitespace-nowrap">
                <p className="font-semibold text-gray-800">{b.name}</p>
                <p className="text-gray-500">Severity: {(b.severity * 100).toFixed(0)}%</p>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_LABEL_COLORS[b.status]}`}>
                  {b.status}
                </span>
              </div>
            </div>
          </div>
        ))}

        {/* Center message */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm text-slate-400 bg-white/60 px-3 py-1 rounded-full">
            Real-time bottleneck data will appear here
          </p>
        </div>
      </div>
    </div>
  );
}

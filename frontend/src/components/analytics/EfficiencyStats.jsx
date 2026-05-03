/**
 * EfficiencyStats — displays system efficiency metrics as stat cards.
 *
 * Props:
 *  - metrics: { label: string, value: string | number, icon: string, trend?: string, color: string }[]
 *  - title: string
 */
export default function EfficiencyStats({ metrics, title }) {
  return (
    <div className="w-full">
      {title && <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {metrics.map((m, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl">{m.icon}</span>
              {m.trend && (
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                  m.trend.startsWith('+') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {m.trend}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">{m.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

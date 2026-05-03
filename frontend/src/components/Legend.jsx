// Legend component showing status color meanings
const STATUS_LEGEND = [
  { color: 'bg-green-500', label: 'Empty', description: 'Available for parking' },
  { color: 'bg-red-500', label: 'Occupied', description: 'Vehicle currently parked' },
  { color: 'bg-blue-500', label: 'Reserved', description: 'Reserved slot' },
  { color: 'bg-yellow-500', label: 'Offline', description: 'Camera/sensor offline' },
  { color: 'bg-orange-500', label: 'Error', description: 'System error' },
];

export default function Legend() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Status Legend</h3>
      <div className="flex flex-wrap gap-4">
        {STATUS_LEGEND.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded ${item.color} shadow-sm`} />
            <div>
              <span className="text-sm font-medium text-gray-700">{item.label}</span>
              <span className="text-xs text-gray-400 ml-1.5">({item.description})</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

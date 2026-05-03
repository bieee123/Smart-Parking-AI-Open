// ParkingSlot — Individual slot card component
// Matches MapParking aspect-square box style with extra detail overlays

// Map status to color classes (no border, like MapParking)
const STATUS_COLORS = {
  empty: 'bg-green-500 hover:bg-green-600',
  occupied: 'bg-red-500 hover:bg-red-600',
  reserved: 'bg-blue-500 hover:bg-blue-600',
  offline: 'bg-yellow-500 hover:bg-yellow-600',
  error: 'bg-orange-500 hover:bg-orange-600',
};

// Vehicle type icons
const VEHICLE_ICONS = {
  car: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M7 17H5a2 2 0 01-2-2v-3l2-6h14l2 6v3a2 2 0 01-2 2h-2"/>
      <path d="M7 17h10"/>
      <circle cx="7" cy="17" r="2"/>
      <circle cx="17" cy="17" r="2"/>
      <path d="M5 12h14"/>
      <path d="M8 6l-1 6M16 6l1 6"/>
    </svg>
  ),
  motorcycle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <circle cx="5.5" cy="15.5" r="2.5"/>
      <circle cx="18.5" cy="15.5" r="2.5"/>
      <path d="M8 15.5h7"/>
      <path d="M15 6h2l2 4.5"/>
      <path d="M9 6l3 4.5h4.5"/>
      <path d="M9 6H7l-1.5 4"/>
    </svg>
  ),
  truck: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <rect x="1" y="6" width="13" height="11" rx="1"/>
      <path d="M14 9h4l3 4v4h-7V9z"/>
      <circle cx="5.5" cy="18.5" r="1.5"/>
      <circle cx="18.5" cy="18.5" r="1.5"/>
      <path d="M14 13h4"/>
    </svg>
  ),
};

export default function ParkingSlot({ slot, onClick }) {
  const status = slot.status || 'empty';
  const colorClass = STATUS_COLORS[status] || STATUS_COLORS.empty;
  const vehicleIcon = slot.vehicle_type ? VEHICLE_ICONS[slot.vehicle_type] : null;

  return (
    <button
      onClick={() => onClick(slot)}
      className={`relative group aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium
        transition-all duration-200 hover:scale-110 cursor-pointer shadow-sm
        focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2
        ${colorClass} text-white`}
      title={`Slot ${slot.slot_number} — ${status}${slot.license_plate ? ` — ${slot.license_plate}` : ''}`}
    >
      {/* Vehicle icon (top-right) */}
      {vehicleIcon && (
        <span className="absolute top-1 right-1 text-[10px]" title={slot.vehicle_type}>
          {vehicleIcon}
        </span>
      )}

      {/* Camera indicator (top-left) */}
      {slot.camera_id && (
        <span
          className="absolute top-1 left-1 w-2 h-2 rounded-full bg-green-300 border border-white/50"
          title={`Camera: ${slot.camera_id}`}
        />
      )}

      {/* Center: slot number */}
      <span className="text-[11px] leading-tight font-bold text-center px-1 break-all">
        {slot.slot_number}
      </span>

      {/* License plate (bottom, if occupied) */}
      {slot.license_plate && (
        <span className="text-[8px] font-mono text-white/80 mt-0.5 truncate max-w-[90%]">
          {slot.license_plate}
        </span>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
        <span className="text-[9px] font-medium text-white bg-black/50 px-1.5 py-0.5 rounded">
          Details
        </span>
      </div>
    </button>
  );
}

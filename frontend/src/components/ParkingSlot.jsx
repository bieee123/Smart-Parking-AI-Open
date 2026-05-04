// ParkingSlot — Individual slot card component
// Matches MapParking aspect-square box style with extra detail overlays
import { FaCar, FaMotorcycle, FaTruck } from 'react-icons/fa';

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
  car: <FaCar className="w-3 h-3" />,
  motorcycle: <FaMotorcycle className="w-3 h-3" />,
  truck: <FaTruck className="w-3 h-3" />,
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

import { useState, useEffect, useMemo, useCallback } from 'react';
import { parkingApi } from '../services/parking';
import FilterBar from '../components/FilterBar';
import Legend from '../components/Legend';
import ParkingSlot from '../components/ParkingSlot';
import SlotModal from '../components/SlotModal';

export default function ParkingMap() {
  // ── State ─────────────────────────────────────────────────
  const [slots, setSlots] = useState([]);
  const [zone, setZone] = useState('all');
  const [vehicleType, setVehicleType] = useState('');
  const [search, setSearch] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Fetch slots ───────────────────────────────────────────
  const fetchSlots = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (zone !== 'all') params.zone = zone;
      if (vehicleType) params.vehicle = vehicleType;
      if (search) params.search = search;

      const res = await parkingApi.getSlots(params);
      setSlots(res.data || []);
      setError('');
    } catch (err) {
      console.error('Fetch slots error:', err);
      setError('Failed to load parking slots. Check backend connection.');
    } finally {
      setLoading(false);
    }
  }, [zone, vehicleType, search, refreshKey]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // ── Slot click handler ────────────────────────────────────
  const handleSlotClick = (slot) => {
    setSelectedSlot(slot);
  };

  const handleSlotUpdate = () => {
    // Refresh slot data after edit
    setRefreshKey((k) => k + 1);
    setSelectedSlot(null);
  };

  // ── Stats ─────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = slots.length;
    const empty = slots.filter((s) => s.status === 'empty').length;
    const occupied = slots.filter((s) => s.status === 'occupied').length;
    const reserved = slots.filter((s) => s.status === 'reserved').length;
    const offline = slots.filter((s) => s.status === 'offline').length;
    const errorCount = slots.filter((s) => s.status === 'error').length;
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;
    return { total, empty, occupied, reserved, offline, error: errorCount, occupancyRate };
  }, [slots]);

  // ── Group slots by zone ───────────────────────────────────
  const groupedByZone = useMemo(() => {
    const groups = {};
    slots.forEach((slot) => {
      const z = slot.zone || 'Unknown';
      if (!groups[z]) groups[z] = [];
      groups[z].push(slot);
    });
    // Sort each group by slot_number
    Object.values(groups).forEach((group) => {
      group.sort((a, b) => a.slot_number.localeCompare(b.slot_number, undefined, { numeric: true }));
    });
    return groups;
  }, [slots]);

  // ── Loading skeleton ──────────────────────────────────────
  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-gray-200 rounded-lg w-48" />
          <div className="h-16 bg-gray-200 rounded-xl" />
          <div className="h-12 bg-gray-200 rounded-xl" />
          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-3">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="aspect-square bg-gray-200 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Parking Map</h1>
        <p className="text-gray-500 mt-1">Real-time view of all parking slots across zones</p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard label="Total" value={stats.total} color="bg-gray-500" />
        <StatCard label="Empty" value={stats.empty} color="bg-green-500" />
        <StatCard label="Occupied" value={stats.occupied} color="bg-red-500" />
        <StatCard label="Reserved" value={stats.reserved} color="bg-blue-500" />
        <StatCard label="Offline" value={stats.offline} color="bg-yellow-500" />
        <StatCard label="Occupancy" value={`${stats.occupancyRate}%`} color="bg-purple-500" />
      </div>

      {/* Filters */}
      <FilterBar
        zone={zone}
        setZone={setZone}
        vehicleType={vehicleType}
        setVehicleType={setVehicleType}
        search={search}
        setSearch={setSearch}
      />

      {/* Legend */}
      <Legend />

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">
          {error}
        </div>
      )}

      {/* No results */}
      {!loading && slots.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="flex justify-center mb-3">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 11V7a2 2 0 012-2h10a2 2 0 012 2v4m-9 4h4m-6 0a2 2 0 00-2 2v2a2 2 0 002 2h8a2 2 0 002-2v-2a2 2 0 00-2-2H9z" />
            </svg>
          </div>
          <p className="text-gray-600 font-medium">No parking slots found</p>
          <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
        </div>
      )}

      {/* Zone Groups */}
      {Object.entries(groupedByZone).map(([zoneName, zoneSlots]) => (
        <ZoneSection key={zoneName} zone={zoneName} slots={zoneSlots} onSlotClick={handleSlotClick} />
      ))}

      {/* Slot Detail Modal */}
      {selectedSlot && (
        <SlotModal
          slot={selectedSlot}
          onClose={() => setSelectedSlot(null)}
          onUpdate={handleSlotUpdate}
        />
      )}
    </div>
  );
}

// ── Stat Card Sub-component ─────────────────────────────────
function StatCard({ label, value, color }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-3">
      <div className={`w-3 h-10 rounded ${color}`} />
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}

// ── Zone Section Sub-component ──────────────────────────────
function ZoneSection({ zone, slots, onSlotClick }) {
  // Determine vehicle type hint from slots
  const vehicleHint = useMemo(() => {
    const types = [...new Set(slots.map((s) => s.vehicle_type).filter(Boolean))];
    if (types.length === 0) return null;
    return types.join(', ');
  }, [slots]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
      {/* Zone Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-600 text-white rounded-lg flex items-center justify-center text-sm font-bold">
            {zone}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Zone {zone}</h2>
            {vehicleHint && (
              <p className="text-xs text-gray-400 capitalize">{vehicleHint}</p>
            )}
          </div>
        </div>
        <span className="text-sm text-gray-500 font-medium">
          {slots.length} slot{slots.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Slots Grid — denser layout like MapParking */}
      <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-3">
        {slots.map((slot) => (
          <ParkingSlot key={slot.id} slot={slot} onClick={onSlotClick} />
        ))}
      </div>
    </div>
  );
}

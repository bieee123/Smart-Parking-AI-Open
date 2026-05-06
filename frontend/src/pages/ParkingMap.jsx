import { useState, useEffect, useMemo, useCallback } from 'react';
import { parkingApi } from '../services/parking';
import FilterBar from '../components/FilterBar';
import Legend from '../components/Legend';
import ParkingSlot from '../components/ParkingSlot';
import SlotModal from '../components/SlotModal';
import { 
  HiMap, HiInbox, HiHashtag, HiCheckCircle, 
  HiMinusCircle, HiBookmark, HiBan, HiChartPie 
} from 'react-icons/hi';

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
      // Removed search from params to handle it client-side for speed

      const res = await parkingApi.getSlots(params);
      setSlots(res.data || []);
      setError('');
    } catch (err) {
      console.error('Fetch slots error:', err);
      setError('Failed to load parking slots. Check backend connection.');
    } finally {
      setLoading(false);
    }
  }, [zone, vehicleType, refreshKey]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // ── Client-side Filtered Slots ─────────────────────────────
  const filteredSlots = useMemo(() => {
    if (!search) return slots;
    const term = search.toLowerCase();
    return slots.filter(s => 
      s.slot_number?.toLowerCase().includes(term) ||
      s.license_plate?.toLowerCase().includes(term) ||
      s.zone?.toLowerCase().includes(term) ||
      s.status?.toLowerCase().includes(term)
    );
  }, [slots, search]);

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
    const total = filteredSlots.length;
    const empty = filteredSlots.filter((s) => s.status === 'empty').length;
    const occupied = filteredSlots.filter((s) => s.status === 'occupied').length;
    const reserved = filteredSlots.filter((s) => s.status === 'reserved').length;
    const offline = filteredSlots.filter((s) => s.status === 'offline').length;
    const errorCount = filteredSlots.filter((s) => s.status === 'error').length;
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;
    return { total, empty, occupied, reserved, offline, error: errorCount, occupancyRate };
  }, [filteredSlots]);

  // ── Group slots by zone ───────────────────────────────────
  const groupedByZone = useMemo(() => {
    const groups = {};
    filteredSlots.forEach((slot) => {
      const z = slot.zone || 'Unknown';
      if (!groups[z]) groups[z] = [];
      groups[z].push(slot);
    });
    // Sort each group by slot_number
    Object.values(groups).forEach((group) => {
      group.sort((a, b) => a.slot_number.localeCompare(b.slot_number, undefined, { numeric: true }));
    });
    return groups;
  }, [filteredSlots]);

  // ── Loading skeleton ──────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="space-y-2">
          <div className="h-10 bg-gray-200 rounded-lg w-48 animate-pulse" />
          <div className="h-4 bg-gray-100 rounded w-64 animate-pulse" />
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 animate-pulse shadow-sm">
              <div className="w-3 h-10 rounded bg-gray-100" />
              <div className="space-y-2">
                <div className="h-6 w-8 bg-gray-200 rounded" />
                <div className="h-3 w-12 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-gray-200 rounded-lg" />
            <div className="h-5 w-32 bg-gray-200 rounded" />
          </div>
          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-3">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="aspect-square bg-gray-50 border border-gray-100 rounded-lg" />
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
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-primary-600/10 border border-primary-500/20 flex items-center justify-center shadow-sm">
            <HiMap className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Parking Map</h1>
            <p className="text-gray-500 text-sm">Real-time view of all parking slots across zones</p>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard label="Total" value={stats.total} color="bg-gray-500" icon={<HiHashtag />} />
        <StatCard label="Empty" value={stats.empty} color="bg-green-500" icon={<HiCheckCircle />} />
        <StatCard label="Occupied" value={stats.occupied} color="bg-red-500" icon={<HiMinusCircle />} />
        <StatCard label="Reserved" value={stats.reserved} color="bg-blue-500" icon={<HiBookmark />} />
        <StatCard label="Offline" value={stats.offline} color="bg-yellow-500" icon={<HiBan />} />
        <StatCard label="Occupancy" value={`${stats.occupancyRate}%`} color="bg-purple-500" icon={<HiChartPie />} />
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
            <HiInbox className="w-12 h-12 text-gray-200" />
          </div>
          <p className="text-gray-600 font-medium">No parking slots found</p>
          <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
        </div>
      )}

      {/* Zone Groups */}
      {Object.entries(groupedByZone)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([zoneName, zoneSlots]) => (
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
function StatCard({ label, value, color, icon }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center text-white text-xl shadow-sm`}>
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{label}</p>
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

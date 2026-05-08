import { useState, useEffect, useMemo, useCallback } from 'react';
import { parkingApi } from '../../../services/parking';
import FilterBar from '../../../components/FilterBar';
import Legend from '../../../components/Legend';
import ParkingSlot from '../../../components/ParkingSlot';
import SlotModal from '../../../components/SlotModal';
import { 
  HiMap, HiInbox, HiHashtag, HiCheckCircle, 
  HiMinusCircle, HiBookmark, HiBan, HiChartPie,
  HiRefresh, HiViewGrid, HiClipboardList, HiInformationCircle
} from 'react-icons/hi';
import { useTranslation } from 'react-i18next';

export default function ParkingMap() {
  const { t } = useTranslation();

  // ── State ─────────────────────────────────────────────────
  const [slots, setSlots] = useState([]);
  const [zone, setZone] = useState('all');
  const [vehicleType, setVehicleType] = useState('');
  const [search, setSearch] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState('map'); // 'map' or 'operator'
  const [allReservations, setAllReservations] = useState([]);
  const [resLoading, setResLoading] = useState(false);

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

  const fetchReservations = useCallback(async () => {
    try {
      setResLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/reservations/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setAllReservations(data.data);
    } catch (err) {
      console.error('Fetch reservations error:', err);
    } finally {
      setResLoading(false);
    }
  }, []);
  
  const handleQuickStatusUpdate = async (slotId, newStatus, reservationId = null) => {
    // Optimistically update local state for immediate feedback
    setAllReservations(prev => prev.map(res => 
      res.id === reservationId ? { ...res, slot_status: newStatus } : res
    ));

    try {
      // 1. Update Slot Status
      await parkingApi.updateSlot(slotId, { status: newStatus });
      
      // 2. If it's a reservation row and we set to 'occupied', perform a check-in if it was active
      if (reservationId && newStatus === 'occupied') {
        const token = localStorage.getItem('token');
        await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/reservations/${reservationId}/checkin`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      // Silent refresh to ensure sync with server without flicker
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/reservations/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setAllReservations(data.data);
      fetchSlots(); // Background fetch slots
    } catch (err) {
      console.error('Quick update error:', err);
      // Revert or show error if needed
      fetchReservations(); 
    }
  };

  useEffect(() => {
    if (viewMode === 'map') fetchSlots();
    else fetchReservations();
  }, [viewMode, fetchSlots, fetchReservations]);

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
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary-600/10 border border-primary-500/20 flex items-center justify-center shadow-sm">
            <HiMap className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{t('parking_map.title')}</h1>
            <p className="text-gray-500 text-sm">{t('parking_map.desc')}</p>
          </div>
        </div>

        {/* Mode Toggle Switch */}
        <div className="flex p-1 bg-gray-100 rounded-xl w-fit">
          <button
            onClick={() => setViewMode('map')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'map' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <HiMap className="w-4 h-4" />
            VISUAL MAP
          </button>
          <button
            onClick={() => setViewMode('operator')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'operator' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <HiInbox className="w-4 h-4" />
            OPERATOR PANEL
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard label={t('dashboard.total_slots')} value={stats.total} color="bg-gray-500" icon={<HiHashtag />} />
        <StatCard label={t('dashboard.available')} value={stats.empty} color="bg-green-500" icon={<HiCheckCircle />} />
        <StatCard label={t('dashboard.occupied')} value={stats.occupied} color="bg-red-500" icon={<HiMinusCircle />} />
        <StatCard label={t('parking_map.reserved')} value={stats.reserved} color="bg-blue-500" icon={<HiBookmark />} />
        <StatCard label={t('common.offline')} value={stats.offline} color="bg-yellow-500" icon={<HiBan />} />
        <StatCard label={t('dashboard.occupancy_rate')} value={`${stats.occupancyRate}%`} color="bg-purple-500" icon={<HiChartPie />} />
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

      {/* Main Content Area */}
      {viewMode === 'map' ? (
        <>
          {/* Legend */}
          <Legend />

          {/* Zone Groups */}
          {Object.entries(groupedByZone)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([zoneName, zoneSlots]) => (
              <ZoneSection key={zoneName} zone={zoneName} slots={zoneSlots} onSlotClick={handleSlotClick} />
            ))}
        </>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <HiInbox className="text-primary-600" /> Recent Reservations
            </h3>
            <button 
              onClick={fetchReservations}
              disabled={resLoading}
              className="p-2 rounded-xl bg-gray-50 text-gray-500 hover:bg-primary-50 hover:text-primary-600 transition-all border border-gray-100 shadow-sm disabled:opacity-50 group"
              title="Refresh Data"
            >
              <HiRefresh className={`w-5 h-5 ${resLoading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-400 font-bold uppercase text-[10px] tracking-widest">
                <tr>
                  <th className="px-6 py-4">Slot</th>
                  <th className="px-6 py-4">Vehicle</th>
                  <th className="px-6 py-4">License Plate</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Time</th>
                  <th className="px-6 py-4 text-center">Slot Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {resLoading ? (
                  <tr><td colSpan="5" className="px-6 py-10 text-center text-gray-400">Loading reservations...</td></tr>
                ) : allReservations.length === 0 ? (
                  <tr><td colSpan="5" className="px-6 py-10 text-center text-gray-400">No recent reservations.</td></tr>
                ) : allReservations.map(res => (
                  <tr key={res.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4 font-bold text-gray-900">ZONA {res.zone} - {res.slot_number}</td>
                    <td className="px-6 py-4 capitalize text-gray-600">{res.vehicle_type}</td>
                    <td className="px-6 py-4"><span className="px-2 py-1 bg-gray-100 rounded font-mono font-bold text-xs">{res.license_plate}</span></td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                        res.status === 'active' ? 'bg-blue-100 text-blue-600' :
                        res.status === 'completed' ? 'bg-green-100 text-green-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {res.status === 'active' ? 'Reserved' : res.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-xs">
                      {new Date(res.created_at).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="relative inline-block w-full max-w-[120px]">
                        <select
                          value={res.slot_status || (res.status === 'active' ? 'reserved' : res.status === 'completed' ? 'occupied' : 'empty')}
                          onChange={(e) => handleQuickStatusUpdate(res.slot_id, e.target.value, res.id)}
                          className={`w-full appearance-none px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all cursor-pointer shadow-sm hover:shadow-md focus:ring-2 focus:ring-offset-1 outline-none
                            ${res.slot_status === 'empty' ? 'bg-emerald-50 border-emerald-100 text-emerald-600 focus:ring-emerald-400' : 
                              res.slot_status === 'occupied' ? 'bg-rose-50 border-rose-100 text-rose-600 focus:ring-rose-400' :
                              res.slot_status === 'reserved' ? 'bg-indigo-50 border-indigo-100 text-indigo-600 focus:ring-indigo-400' :
                              res.slot_status === 'offline' ? 'bg-amber-50 border-amber-100 text-amber-600 focus:ring-amber-400' :
                              'bg-slate-50 border-slate-200 text-slate-600 focus:ring-slate-400'}
                          `}
                        >
                          <option value="empty">Empty</option>
                          <option value="occupied">Occupied</option>
                          <option value="reserved">Reserved</option>
                          <option value="offline">Offline</option>
                          <option value="error">Error</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
  const { t } = useTranslation();
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
            <h2 className="text-lg font-semibold text-gray-900">{t('parking_map.zone')} {zone}</h2>
            {vehicleHint && (
              <p className="text-xs text-gray-400 capitalize">{vehicleHint}</p>
            )}
          </div>
        </div>
        <span className="text-sm text-gray-500 font-medium">
          {slots.length} {t('live_camera.slot')}{slots.length !== 1 ? 's' : ''}
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

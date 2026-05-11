import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../../hooks/useAuth';
import PublicLayout from '../../../layouts/PublicLayout';
import {
  HiCheckCircle, HiXCircle, HiBookmark, HiLockClosed,
  HiClipboardList, HiX, HiClock, HiCurrencyDollar,
  HiFilter, HiViewGrid, HiInformationCircle, HiArrowRight,
  HiSearch, HiMap, HiLightningBolt, HiUserCircle, HiCreditCard,
  HiChevronUp, HiChevronDown
} from 'react-icons/hi';
import { FaParking, FaCar, FaTruck, FaMotorcycle } from 'react-icons/fa';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const TARIFF = {
  car:        { firstHour: 5000, perHour: 2000 },
  truck:      { firstHour: 5000, perHour: 2000 },
  motorcycle: { firstHour: 3000, perHour: 2000 },
};

function formatRp(amount) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

const STATUS_CONFIG = {
  empty: { bg: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-700', label: 'Available', icon: HiCheckCircle },
  occupied: { bg: 'bg-slate-50 border-slate-200 opacity-60', text: 'text-slate-400', label: 'Occupied', icon: HiXCircle },
  reserved: { bg: 'bg-blue-50 border-blue-200 opacity-60', text: 'text-blue-600', label: 'Reserved', icon: HiBookmark },
  offline: { bg: 'bg-slate-100 border-slate-200 opacity-40', text: 'text-slate-400', label: 'Offline', icon: HiInformationCircle }
};

export default function SlotViewer() {
  const navigate = useNavigate();
  const { getToken, isAuthenticated } = useAuth();
  const token = getToken();

  // Data State
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myReservation, setMyReservation] = useState(null);

  // Filter State
  const [selectedZone, setSelectedZone] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Search State
  const [searchPlate, setSearchPlate] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundVehicle, setFoundVehicle] = useState(null);
  const [liveFee, setLiveFee] = useState(0);

  // Reservation Form & UI State
  const [form, setForm] = useState({ license_plate: '', vehicle_type: 'car', duration_hours: 1 });
  const [booking, setBooking] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [feedback, setFeedback] = useState({ show: false, type: '', title: '', message: '' });
  
  // Interaction State
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_URL}/public/slots`);
      const data = await res.json();
      if (data.success) setSlots(data.data.slots);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchMyReservation = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/reservations/my`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        const active = data.data.find(r => r.status === 'active');
        setMyReservation(active || null);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchData();
    fetchMyReservation();
    const interval = setInterval(() => { fetchData(); fetchMyReservation(); }, 30000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!foundVehicle?.entry_time) { setLiveFee(0); return; }
    const calc = () => {
      const entry = new Date(foundVehicle.entry_time);
      const now = new Date();
      const diffMs = now - entry;
      const hours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
      const t = foundVehicle.tariff || TARIFF.car;
      setLiveFee(hours <= 1 ? t.firstHour : t.firstHour + (hours - 1) * t.perHour);
    };
    calc();
    const timer = setInterval(calc, 60000);
    return () => clearInterval(timer);
  }, [foundVehicle]);

  const handleSearchVehicle = async (e) => {
    e.preventDefault();
    if (!searchPlate) return;
    setSearching(true);
    setFoundVehicle(null);
    setShowSummary(false);
    try {
      const res = await fetch(`${API_URL}/public/find-car?plate=${searchPlate}`);
      const data = await res.json();
      if (data.success) {
        setFoundVehicle(data.data);
        setIsSheetOpen(true);
      } else {
        setFeedback({ show: true, type: 'error', title: 'Vehicle Not Found', message: data.message || 'Plate not detected.' });
      }
    } catch (e) {
      setFeedback({ show: true, type: 'error', title: 'Search Failed', message: 'Unable to connect to AI finder.' });
    } finally { setSearching(false); }
  };

  const handleBook = async (e) => {
    e.preventDefault();
    if (!isAuthenticated()) {
      sessionStorage.setItem('pending_reservation', JSON.stringify({ slot: selectedSlot, form }));
      navigate('/login');
      return;
    }
    setBooking(true);
    try {
      const res = await fetch(`${API_URL}/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ slot_id: selectedSlot.id, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Booking failed');
      setFeedback({ show: true, type: 'success', title: 'Success!', message: 'Slot reserved successfully.' });
      setSelectedSlot(null);
      setIsSheetOpen(false);
      setShowSummary(false);
      await fetchData();
      await fetchMyReservation();
    } catch (err) {
      setFeedback({ show: true, type: 'error', title: 'Failed', message: err.message });
    } finally { setBooking(false); }
  };

  const handleCheckIn = async () => {
    if (!myReservation || checkingIn) return;
    setCheckingIn(true);
    try {
      const res = await fetch(`${API_URL}/reservations/${myReservation.id}/checkin`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Check-in failed.');
      setFeedback({ show: true, type: 'success', title: 'Check-in Successful!', message: 'Welcome! Your parking session is now active.' });
      await fetchData();
      await fetchMyReservation();
    } catch (e) {
      setFeedback({ show: true, type: 'error', title: 'Check-in Failed', message: e.message });
    } finally { setCheckingIn(false); }
  };

  const handleCancel = async () => {
    if (!myReservation) return;
    if (!confirm('Are you sure you want to cancel this reservation?')) return;
    try {
      await fetch(`${API_URL}/reservations/${myReservation.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setMyReservation(null);
      await fetchData();
    } catch (e) {}
  };

  const filteredSlots = useMemo(() => {
    return slots.filter(s => {
      const matchZone = selectedZone === 'all' || s.zone === selectedZone;
      const matchType = selectedType === 'all' || s.slot_type === selectedType;
      return matchZone && matchType;
    });
  }, [slots, selectedZone, selectedType]);

  const zones = ['all', ...new Set(slots.map(s => s.zone).filter(Boolean).sort())];

  return (
    <PublicLayout>
      <div className="min-h-screen bg-slate-50 pt-28 pb-40 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <FaParking className="text-indigo-600" /> Smart Parking Viewer
            </h1>
            <p className="text-slate-500 mt-2 font-medium">Real-time occupancy monitoring with AI vehicle finder.</p>
            
            <form onSubmit={handleSearchVehicle} className="mt-6 flex max-w-md">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <HiSearch className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={searchPlate}
                  onChange={e => setSearchPlate(e.target.value.toUpperCase())}
                  placeholder="ENTER LICENSE PLATE..."
                  className="block w-full pl-11 pr-4 py-4 bg-white border border-slate-200 rounded-l-2xl text-sm font-black tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                />
              </div>
              <button type="submit" disabled={searching} className="bg-indigo-600 text-white px-6 py-4 rounded-r-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-lg disabled:opacity-50">
                {searching ? '...' : 'Find'}
              </button>
            </form>
          </div>

          {/* Active Banner */}
          {myReservation && (
            <div className="mb-10 p-6 rounded-3xl bg-indigo-600 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 animate-in slide-in-from-top-4">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                  <HiBookmark className="w-8 h-8" />
                </div>
                <div>
                  <div className="text-indigo-100 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Active Reservation</div>
                  <h3 className="text-xl font-black uppercase">SLOT {myReservation.slot_number}</h3>
                  <p className="text-indigo-200 text-sm font-bold">{myReservation.license_plate}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button onClick={handleCheckIn} disabled={checkingIn} className="flex-1 md:flex-none px-8 py-4 rounded-2xl bg-emerald-500 text-white font-black text-sm hover:bg-emerald-600 shadow-lg flex items-center justify-center gap-2">
                  {checkingIn ? '...' : <><HiCheckCircle className="w-5 h-5" /> CHECK-IN</>}
                </button>
                <button onClick={handleCancel} className="px-6 py-4 rounded-2xl bg-white/10 text-white border border-white/20 font-black text-sm hover:bg-white/20">Cancel</button>
              </div>
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-10">
            <div className="flex-1 space-y-6">
              {/* Filters */}
              <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-wrap gap-6 items-center">
                 <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Zone</span>
                    <div className="flex gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100">
                       {zones.map(z => (
                         <button key={z} onClick={() => setSelectedZone(z)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${selectedZone === z ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{z}</button>
                       ))}
                    </div>
                 </div>
                 <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Type</span>
                    <div className="flex gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100">
                       {[
                         { id: 'all', label: 'ALL', icon: null },
                         { id: 'standard', label: 'STANDARD', icon: null },
                         { id: 'ev', label: 'EV', icon: <HiLightningBolt className="w-3 h-3 text-amber-500" /> },
                         { id: 'disabled', label: 'DISABLED', icon: <HiUserCircle className="w-3 h-3 text-blue-500" /> }
                       ].map(t => (
                         <button 
                           key={t.id} 
                           onClick={() => setSelectedType(t.id)} 
                           className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${selectedType === t.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                         >
                           {t.icon}
                           {t.label}
                         </button>
                       ))}
                    </div>
                 </div>
              </div>

              {/* Grid */}
              <div className="bg-white rounded-[32px] overflow-hidden border border-slate-200 shadow-sm min-h-[500px]">
                <div className="p-8">
                  {loading ? (
                      <div className="h-64 flex items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {filteredSlots.map(slot => (
                        <SlotCard 
                          key={slot.id} 
                          slot={slot} 
                          isSelected={selectedSlot?.id === slot.id} 
                          onClick={() => { 
                            if (slot.status === 'empty') { 
                              setFoundVehicle(null);
                              setSelectedSlot(slot); 
                              setShowSummary(true); // Show floating card first
                              setIsSheetOpen(false); 
                            } 
                          }} 
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop Side Panel */}
            <div className="hidden lg:block w-96 space-y-6">
              {foundVehicle && (
                <div className="bg-slate-900 rounded-[32px] p-6 text-white shadow-2xl">
                   <VehicleInfo foundVehicle={foundVehicle} liveFee={liveFee} onClose={() => setFoundVehicle(null)} />
                </div>
              )}
              <div className="bg-white rounded-[32px] p-8 border border-slate-200 shadow-sm sticky top-28">
                <h2 className="flex items-center gap-2 font-black text-slate-900 uppercase tracking-widest text-sm mb-8">
                  <HiClipboardList className="text-indigo-600 w-5 h-5" /> Reservation
                </h2>
                <ReservationForm 
                  myReservation={myReservation} 
                  selectedSlot={selectedSlot} 
                  form={form} 
                  setForm={setForm} 
                  onSubmit={handleBook} 
                  booking={booking} 
                  isAuthenticated={isAuthenticated()} 
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FLOATING SUMMARY CARD (Step 1) */}
      {showSummary && selectedSlot && !isSheetOpen && (
        <div className="lg:hidden fixed bottom-6 left-6 right-6 z-[90] animate-in slide-in-from-bottom-10 duration-300">
           <div className="bg-white rounded-[28px] p-5 shadow-2xl border border-slate-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                 <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex flex-col items-center justify-center text-white font-black shadow-lg shadow-indigo-100">
                    <span className="text-[8px] uppercase tracking-tighter opacity-70">Slot</span>
                    <span className="text-lg leading-none">{selectedSlot.slot_number}</span>
                 </div>
                 <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Zone {selectedSlot.zone}</h3>
                    <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">{selectedSlot.slot_type}</p>
                 </div>
              </div>
              <button 
                onClick={() => { setIsSheetOpen(true); setShowSummary(false); }}
                className="bg-slate-900 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all active:scale-95 shadow-lg"
              >
                 Continue <HiArrowRight />
              </button>
           </div>
        </div>
      )}

      {/* MOBILE BOTTOM SHEET (Step 2) */}
      {isSheetOpen && (
        <div className="lg:hidden fixed inset-0 z-[100] flex items-end justify-center animate-in fade-in duration-300">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsSheetOpen(false)} />
           <div className="relative w-full max-w-lg bg-white rounded-t-[40px] shadow-2xl animate-in slide-in-from-bottom duration-500 overflow-hidden flex flex-col">
              <div className="h-1.5 w-12 bg-slate-200 rounded-full mx-auto my-4" />
              <div className="px-8 pb-10 overflow-y-auto max-h-[85vh]">
                 <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-black text-slate-900 uppercase tracking-widest">
                       {foundVehicle ? 'Vehicle Finder' : 'Start Booking'}
                    </h2>
                    <button onClick={() => setIsSheetOpen(false)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                       <HiX className="w-5 h-5" />
                    </button>
                 </div>

                 {foundVehicle ? (
                    <div className="space-y-6">
                       <div className="bg-slate-900 rounded-3xl p-6 text-white">
                          <VehicleInfo foundVehicle={foundVehicle} liveFee={liveFee} hideClose />
                       </div>
                       <button onClick={() => setIsSheetOpen(false)} className="w-full py-4 rounded-2xl bg-slate-100 text-slate-600 font-black text-sm uppercase">Close</button>
                    </div>
                 ) : (
                    <ReservationForm 
                       myReservation={myReservation} 
                       selectedSlot={selectedSlot} 
                       form={form} 
                       setForm={setForm} 
                       onSubmit={handleBook} 
                       booking={booking} 
                       isAuthenticated={isAuthenticated()} 
                    />
                 )}
              </div>
           </div>
        </div>
      )}

      {/* Feedback Modal */}
      {feedback.show && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[32px] w-full max-w-sm p-8 shadow-2xl">
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
              {feedback.type === 'success' ? <HiCheckCircle className="w-12 h-12" /> : <HiXCircle className="w-12 h-12" />}
            </div>
            <h3 className="text-xl font-black text-slate-900 text-center mb-2">{feedback.title}</h3>
            <p className="text-sm text-slate-500 text-center font-medium leading-relaxed mb-8">{feedback.message}</p>
            <button onClick={() => setFeedback({...feedback, show: false})} className="w-full py-4 rounded-2xl bg-slate-900 text-white font-black text-sm">Understand</button>
          </div>
        </div>
      )}
    </PublicLayout>
  );
}

// Sub-components
function VehicleInfo({ foundVehicle, liveFee, onClose, hideClose }) {
  return (
    <>
      {!hideClose && (
        <div className="flex items-center justify-between mb-6">
          <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Vehicle Located</div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><HiX /></button>
        </div>
      )}
      <div className="flex items-center gap-4 mb-6">
         <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex flex-col items-center justify-center font-black">
            <span className="text-[10px] text-indigo-200 uppercase">Slot</span>
            <span className="text-xl">{foundVehicle.slot.slot_number}</span>
         </div>
         <div>
            <h3 className="text-xl font-black uppercase tracking-tight">{foundVehicle.slot.license_plate}</h3>
            <p className="text-indigo-400 text-xs font-bold">Zone {foundVehicle.slot.zone}</p>
         </div>
      </div>
      <div className="bg-white/5 rounded-2xl p-5 border border-white/10 space-y-4">
         <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <span className="flex items-center gap-1.5"><HiClock className="text-indigo-400" /> Entry Time</span>
            <span>{new Date(foundVehicle.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
         </div>
         <div className="pt-2 border-t border-white/5 flex justify-between items-end">
            <div>
               <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Live Billing</div>
               <div className="text-3xl font-black">{formatRp(liveFee)}</div>
            </div>
            <HiCreditCard className="w-8 h-8 text-indigo-500/50" />
         </div>
      </div>
    </>
  );
}

function ReservationForm({ myReservation, selectedSlot, form, setForm, onSubmit, booking, isAuthenticated }) {
  if (myReservation) {
    return (
      <div className="text-center py-12">
        <HiCheckCircle className="w-16 h-16 text-indigo-600 mx-auto mb-6" />
        <h3 className="text-lg font-black text-slate-900 mb-2">Active Reservation</h3>
        <p className="text-sm text-slate-500 font-medium leading-relaxed">You already have an active booking. Please check the banner at the top.</p>
      </div>
    );
  }
  if (!selectedSlot) {
    return (
      <div className="text-center py-20 px-6 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
        <HiInformationCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-loose text-center">Select an <span className="text-emerald-500">Available</span> Slot <br />to start reservation</p>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
        <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Selected Slot</div>
        <div className="text-2xl font-black text-slate-900">{selectedSlot.slot_number}</div>
        <div className="text-xs text-indigo-400 font-bold uppercase">{selectedSlot.slot_type}</div>
      </div>
      <div className="space-y-4">
        <Input label="Plate Number" value={form.license_plate} onChange={v => setForm({...form, license_plate: v.toUpperCase()})} placeholder="B 1234 ABC" />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Type" value={form.vehicle_type} onChange={v => setForm({...form, vehicle_type: v})} options={['car', 'motorcycle', 'truck']} />
          <Select label="Hours" value={form.duration_hours} onChange={v => setForm({...form, duration_hours: parseInt(v)})} options={[1, 2, 3, 4, 6, 8, 12, 24]} />
        </div>
      </div>
      <button type="submit" disabled={booking} className="w-full py-5 rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all shadow-xl flex items-center justify-center gap-2">
        {booking ? '...' : (isAuthenticated ? 'Confirm Booking' : 'Sign In to Book')} <HiArrowRight />
      </button>
    </form>
  );
}

function SlotCard({ slot, isSelected, onClick }) {
  const config = STATUS_CONFIG[slot.status] || STATUS_CONFIG.offline;
  return (
    <button onClick={onClick} className={`relative h-28 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-1 ${isSelected ? 'border-indigo-600 bg-indigo-50 scale-105 shadow-xl z-10' : `${config.bg} border-transparent`}`}>
      <span className={`text-sm font-black ${isSelected ? 'text-indigo-600' : 'text-slate-900'}`}>{slot.slot_number}</span>
      <span className={`text-[9px] font-black uppercase tracking-wider ${isSelected ? 'text-indigo-400' : config.text}`}>{config.label}</span>
      
      {slot.slot_type === 'ev' && (
        <div className="absolute top-2 left-2 flex items-center gap-1 text-indigo-600 bg-indigo-50/80 px-1.5 py-0.5 rounded-md border border-indigo-100 shadow-sm backdrop-blur-sm">
          <HiLightningBolt className="w-2.5 h-2.5" />
          <span className="text-[7px] font-black tracking-tighter">EV</span>
        </div>
      )}
      {slot.slot_type === 'disabled' && (
        <div className="absolute top-2 left-2 flex items-center gap-1 text-blue-600 bg-blue-50/80 px-1.5 py-0.5 rounded-md border border-blue-100 shadow-sm backdrop-blur-sm">
          <HiUserCircle className="w-2.5 h-2.5" />
          <span className="text-[7px] font-black tracking-tighter">DISABLED</span>
        </div>
      )}
    </button>
  );
}

function Input({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold placeholder-slate-300 focus:outline-none focus:border-indigo-500 transition-all" />
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold focus:outline-none focus:border-indigo-500 transition-all text-sm capitalize">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

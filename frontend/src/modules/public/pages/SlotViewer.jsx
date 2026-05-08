import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../../hooks/useAuth';
import PublicLayout from '../../../layouts/PublicLayout';
import {
  HiCheckCircle, HiXCircle, HiBookmark, HiLockClosed,
  HiClipboardList, HiX, HiClock, HiCurrencyDollar,
  HiFilter, HiViewGrid, HiInformationCircle, HiArrowRight
} from 'react-icons/hi';
import { FaParking, FaCar, FaTruck, FaMotorcycle } from 'react-icons/fa';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const TARIFF = {
  car:        { firstHour: 5000, perHour: 2000 },
  truck:      { firstHour: 5000, perHour: 2000 },
  motorcycle: { firstHour: 3000, perHour: 2000 },
};

const VEHICLE_ICONS = {
  car: FaCar,
  truck: FaTruck,
  motorcycle: FaMotorcycle,
};

function formatRp(amount) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

const STATUS_CONFIG = {
  empty: {
    bg: 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100/50 hover:border-emerald-300',
    text: 'text-emerald-700',
    label: 'Tersedia',
    icon: HiCheckCircle
  },
  occupied: {
    bg: 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed',
    text: 'text-slate-400',
    label: 'Terisi',
    icon: HiXCircle
  },
  reserved: {
    bg: 'bg-blue-50 border-blue-200 opacity-60 cursor-not-allowed',
    text: 'text-blue-600',
    label: 'Dipesan',
    icon: HiBookmark
  },
  offline: {
    bg: 'bg-slate-100 border-slate-200 opacity-40 cursor-not-allowed',
    text: 'text-slate-400',
    label: 'Offline',
    icon: HiInformationCircle
  }
};

export default function SlotViewer() {
  const navigate = useNavigate();
  const { getToken, isAuthenticated } = useAuth();
  const token = getToken();
  const isAuth = isAuthenticated();

  const [slots, setSlots] = useState([]);
  const [zoneSummary, setZoneSummary] = useState([]);
  const [selectedZone, setSelectedZone] = useState('all');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [myReservation, setMyReservation] = useState(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ license_plate: '', vehicle_type: 'car', duration_hours: 1 });
  const [booking, setBooking] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  
  // Modal State for Check-in Feedback
  const [feedback, setFeedback] = useState({ show: false, type: '', title: '', message: '' });

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_URL}/public/slots`);
      const data = await res.json();
      if (data.success) {
        setSlots(data.data.slots);
        setZoneSummary(data.data.zoneSummary);
      }
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
    
    // Check for pending reservation after login
    const pending = sessionStorage.getItem('pending_reservation');
    if (pending && token) {
      const parsed = JSON.parse(pending);
      setSelectedSlot(parsed.slot);
      setForm(parsed.form);
      sessionStorage.removeItem('pending_reservation');
    }

    const interval = setInterval(() => { fetchData(); fetchMyReservation(); }, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const filteredSlots = selectedZone === 'all' ? slots : slots.filter(s => s.zone === selectedZone);
  const zones = ['all', ...new Set(slots.map(s => s.zone).sort())];
  const t = TARIFF[form.vehicle_type] || TARIFF.car;
  const estimatedFee = form.duration_hours <= 1 ? t.firstHour : t.firstHour + (form.duration_hours - 1) * t.perHour;

  const handleBook = async (e) => {
    e.preventDefault();
    
    // Explicitly get fresh status and token
    const isCurrentlyAuth = isAuthenticated();
    const currentToken = getToken();

    if (!isCurrentlyAuth) {
      console.log('User not authenticated, redirecting to login...');
      // Save state and go to login
      sessionStorage.setItem('pending_reservation', JSON.stringify({ slot: selectedSlot, form }));
      navigate('/login');
      return;
    }

    if (!selectedSlot) return;
    
    setBooking(true);

    try {
      console.log('Attempting reservation with token:', currentToken?.substring(0, 10) + '...');
      const res = await fetch(`${API_URL}/reservations`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${currentToken}` 
        },
        body: JSON.stringify({ slot_id: selectedSlot.id, ...form }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reservasi gagal');
      
      setFeedback({
        show: true,
        type: 'success',
        title: 'Reservasi Berhasil!',
        message: 'Slot Anda telah dikunci. Silakan segera menuju lokasi dan lakukan check-in saat tiba.'
      });
      setSelectedSlot(null);
      setForm({ license_plate: '', vehicle_type: 'car', duration_hours: 1 });
      await fetchData();
      await fetchMyReservation();
    } catch (err) {
      console.error('Reservation error:', err);
      setFeedback({
        show: true,
        type: 'error',
        title: 'Reservasi Gagal',
        message: err.message
      });
    } finally {
      setBooking(false);
    }
  };

  const handleCheckIn = async () => {
    if (!myReservation || checkingIn) return;
    setCheckingIn(true);
    try {
      const res = await fetch(`${API_URL}/reservations/${myReservation.id}/checkin`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Gagal memproses check-in. Silakan hubungi petugas.');
      await fetchData();
      await fetchMyReservation();
      setFeedback({
        show: true,
        type: 'success',
        title: 'Check-in Successful!',
        message: 'Welcome! Your parking slot is now active. Please park your vehicle.'
      });
    } catch (e) {
      setFeedback({
        show: true,
        type: 'error',
        title: 'Check-in Failed',
        message: e.message
      });
    } finally {
      setCheckingIn(false);
    }
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

  return (
    <PublicLayout>
      <div className="min-h-screen bg-slate-50 pt-28 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          
          {/* Dashboard Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                <FaParking className="text-indigo-600" /> Select Parking Slot
              </h1>
              <p className="text-slate-500 mt-2 font-medium">Real-time slot availability monitoring from SmartPark AI system.</p>
            </div>
            
            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
              <div className="flex items-center gap-2 p-1.5 bg-white rounded-2xl border border-slate-200 shadow-sm">
                {zones.map(z => (
                  <button
                    key={z}
                    onClick={() => setSelectedZone(z)}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                      selectedZone === z 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                        : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'
                    }`}
                  >
                    {z === 'all' ? 'All' : `Zone ${z}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Active Reservation Banner */}
          {myReservation && (
            <div className="mb-10 p-6 rounded-3xl bg-indigo-600 text-white shadow-xl shadow-indigo-200 flex flex-col md:flex-row items-center justify-between gap-6 transition-all animate-in fade-in slide-in-from-top-4">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                  <HiBookmark className="w-8 h-8" />
                </div>
                <div>
                  <div className="text-indigo-100 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Active Reservation</div>
                  <h3 className="text-xl font-black uppercase">SLOT {myReservation.slot_number} — ZONE {myReservation.zone}</h3>
                  <p className="text-indigo-200 text-sm font-bold mt-1">
                    {myReservation.license_plate} • Ends at {new Date(myReservation.end_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button 
                  onClick={handleCheckIn}
                  disabled={checkingIn}
                  className="flex-1 md:flex-none px-8 py-4 rounded-2xl bg-emerald-500 text-white font-black text-sm hover:bg-emerald-600 transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  {checkingIn ? '...' : (
                    <>
                      <HiCheckCircle className="w-5 h-5" />
                      I HAVE ARRIVED
                    </>
                  )}
                </button>
                <button 
                  onClick={handleCancel}
                  className="px-6 py-4 rounded-2xl bg-white/10 text-white border border-white/20 font-black text-sm hover:bg-white/20 transition-all"
                  title="Cancel"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-10 items-start">
            {/* Main Grid Container */}
            <div className="flex-1 w-full">
              <div className="bg-white rounded-[32px] p-8 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="flex items-center gap-2 font-black text-slate-900 uppercase tracking-widest text-sm">
                    <HiViewGrid className="text-indigo-600 w-5 h-5" /> Parking Layout
                  </h2>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Available</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Reserved</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Occupied</span>
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div className="py-40 flex justify-center">
                    <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {filteredSlots.map(slot => {
                      const isSelected = selectedSlot?.id === slot.id;
                      const isMyReserved = myReservation?.slot_id === slot.id;
                      const config = STATUS_CONFIG[slot.status] || STATUS_CONFIG.offline;
                      
                      return (
                        <button
                          key={slot.id}
                          disabled={slot.status !== 'empty' && !isMyReserved}
                          onClick={() => {
                            if (isMyReserved) return;
                            if (slot.status === 'empty') setSelectedSlot(isSelected ? null : slot);
                          }}
                          className={`relative group h-24 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-1
                            ${isMyReserved ? 'bg-blue-50 border-blue-500 shadow-blue-100 shadow-lg' : config.bg}
                            ${isSelected ? 'border-indigo-600 bg-indigo-50 scale-105 shadow-xl shadow-indigo-100' : ''}
                          `}
                        >
                          <span className={`text-sm font-black tracking-tighter ${isMyReserved ? 'text-indigo-700' : isSelected ? 'text-indigo-600' : 'text-slate-900'}`}>
                            {slot.slot_number}
                          </span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${isMyReserved ? 'text-blue-500' : isSelected ? 'text-indigo-400' : config.text}`}>
                            {isMyReserved ? 'Yours' : config.label}
                          </span>
                          
                          {isSelected && <div className="absolute top-2 right-2 w-2 h-2 bg-indigo-600 rounded-full"></div>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Side Panel: Form */}
            <div className="w-full lg:w-96 sticky top-28">
              <div className="bg-white rounded-[32px] p-8 border border-slate-200 shadow-sm">
                <h2 className="flex items-center gap-2 font-black text-slate-900 uppercase tracking-widest text-sm mb-8">
                  <HiClipboardList className="text-indigo-600 w-5 h-5" /> Reservation
                </h2>

                {myReservation ? (
                  <div className="text-center py-12">
                    <HiCheckCircle className="w-16 h-16 text-indigo-600 mx-auto mb-6" />
                    <h3 className="text-lg font-black text-slate-900 mb-2">Active Reservation</h3>
                    <p className="text-sm text-slate-500 font-medium">You already have an ongoing reservation.</p>
                  </div>
                ) : !selectedSlot ? (
                  <div className="text-center py-20 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    <HiInformationCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-loose">
                      Select <span className="text-emerald-500">Green</span> Slot <br />On Parking Layout
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleBook} className="space-y-6">
                    <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
                      <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Selected Slot</div>
                      <div className="text-2xl font-black text-slate-900">ZONE {selectedSlot.zone} — {selectedSlot.slot_number}</div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">License Plate</label>
                        <input
                          value={form.license_plate}
                          onChange={e => setForm(p => ({ ...p, license_plate: e.target.value.toUpperCase() }))}
                          placeholder="B 1234 ABC"
                          className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold placeholder-slate-300 focus:outline-none focus:border-indigo-500 transition-all uppercase"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Vehicle Type</label>
                          <select
                            value={form.vehicle_type}
                            onChange={e => setForm(p => ({ ...p, vehicle_type: e.target.value }))}
                            className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold focus:outline-none focus:border-indigo-500 transition-all text-sm"
                          >
                            <option value="car">Car</option>
                            <option value="truck">Truck/Bus</option>
                            <option value="motorcycle">Motorcycle</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Duration</label>
                          <select
                            value={form.duration_hours}
                            onChange={e => setForm(p => ({ ...p, duration_hours: parseInt(e.target.value) }))}
                            className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold focus:outline-none focus:border-indigo-500 transition-all text-sm"
                          >
                            {[1, 2, 3, 4, 6, 8, 12, 24].map(h => (
                              <option key={h} value={h}>{h} Hour{h > 1 ? 's' : ''}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-3">
                      <div className="flex justify-between text-xs text-slate-400 font-bold uppercase tracking-widest">
                        <span>Fee Estimation</span>
                        <HiCurrencyDollar className="w-4 h-4" />
                      </div>
                      <div className="flex justify-between items-end">
                        <div className="text-2xl font-black">{formatRp(estimatedFee)}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Total</div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={booking}
                      className="w-full py-5 rounded-2xl bg-indigo-600 text-white font-black text-base shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-1 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                      {booking ? 'Processing...' : (
                        <>
                          {isAuthenticated() ? 'Confirm Reservation' : 'Continue & Sign In'}
                          <HiArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </button>
                    
                    <button 
                      type="button" 
                      onClick={() => setSelectedSlot(null)}
                      className="w-full py-2 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest"
                    >
                      Cancel Selection
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Modal */}
      {feedback.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[32px] w-full max-w-sm p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 ${
              feedback.type === 'success' ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'
            }`}>
              {feedback.type === 'success' ? <HiCheckCircle className="w-12 h-12" /> : <HiXCircle className="w-12 h-12" />}
            </div>
            <h3 className="text-xl font-black text-slate-900 text-center mb-2">{feedback.title}</h3>
            <p className="text-sm text-slate-500 text-center font-medium leading-relaxed mb-8">
              {feedback.message}
            </p>
            <button
              onClick={() => setFeedback({ ...feedback, show: false })}
              className="w-full py-4 rounded-2xl bg-slate-900 text-white font-black text-sm hover:bg-slate-800 transition-all shadow-lg"
            >
              Understand
            </button>
          </div>
        </div>
      )}
    </PublicLayout>
  );
}

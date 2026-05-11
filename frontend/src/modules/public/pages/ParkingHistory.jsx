import { useState, useEffect, useMemo } from 'react';
import PublicLayout from '../../../layouts/PublicLayout';
import useAuth from '../../../hooks/useAuth';
import { 
  HiClock, HiCurrencyDollar, HiDownload, HiClipboardList, 
  HiCheckCircle, HiCalendar, HiTag, HiInformationCircle,
  HiX, HiQrcode, HiPrinter, HiShare
} from 'react-icons/hi';
import { FaParking } from 'react-icons/fa';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

function formatRp(amount) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

export default function ParkingHistory() {
  const { getToken, user } = useAuth();
  const token = getToken();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const handleDownload = (log) => {
    const receiptText = `
========================================
       SMARTPARK AI - RECEIPT
========================================
ID      : TRX-${log.id.toString().slice(-6).toUpperCase()}
PLAT    : ${log.license_plate}
SLOT    : ${log.slot_number || 'N/A'}
STATUS  : ${log.status.toUpperCase()}

IN      : ${new Date(log.start_time).toLocaleString()}
OUT     : ${new Date(log.end_time).toLocaleString()}
----------------------------------------
TOTAL   : ${formatRp(log.total_fee)}
----------------------------------------
   THANK YOU FOR PARKING WITH US!
========================================
    `;
    const blob = new Blob([receiptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Receipt_${log.license_plate}_${log.id.toString().slice(-6)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/reservations/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setHistory(data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [token]);

  const stats = useMemo(() => {
    const totalSpent = history.reduce((sum, item) => sum + (parseInt(item.total_fee) || 0), 0);
    const totalVisits = history.length;
    const avgDuration = history.length > 0 
      ? history.reduce((sum, item) => {
          const start = new Date(item.start_time);
          const end = new Date(item.end_time);
          return sum + (end - start) / (1000 * 60 * 60);
        }, 0) / history.length
      : 0;
    return { totalSpent, totalVisits, avgDuration: avgDuration.toFixed(1) };
  }, [history]);

  return (
    <PublicLayout>
      <div className="min-h-screen bg-slate-50 pt-28 pb-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          
          {/* Header & Stats */}
          <div className="mb-10">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3 mb-8">
              <HiClipboardList className="text-indigo-600" /> My Parking Activity
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <StatCard 
                 label="Total Spent" 
                 value={formatRp(stats.totalSpent)} 
                 icon={<HiCurrencyDollar />} 
                 color="text-emerald-600" 
                 bg="bg-emerald-50"
               />
               <StatCard 
                 label="Total Visits" 
                 value={`${stats.totalVisits} Times`} 
                 icon={<HiCalendar />} 
                 color="text-indigo-600" 
                 bg="bg-indigo-50"
               />
               <StatCard 
                 label="Avg. Duration" 
                 value={`${stats.avgDuration} Hours`} 
                 icon={<HiClock />} 
                 color="text-amber-600" 
                 bg="bg-amber-50"
               />
            </div>
          </div>

          {/* Activity List */}
          <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Recent Sessions</h2>
                <span className="text-[10px] font-bold text-slate-400">{history.length} records found</span>
             </div>

             <div className="divide-y divide-slate-50">
                {loading ? (
                   <div className="p-20 text-center">
                      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                      <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Loading history...</p>
                   </div>
                ) : history.length === 0 ? (
                   <div className="p-20 text-center">
                      <HiInformationCircle className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                      <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">No activity found yet.</p>
                      <p className="text-slate-300 text-xs mt-2">Start parking to see your receipts here!</p>
                   </div>
                ) : (
                  history.map((log) => (
                    <div key={log.id} className="p-6 hover:bg-slate-50/80 transition-colors group">
                       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                          <div className="flex items-center gap-5">
                             <div className="w-14 h-14 rounded-2xl bg-slate-900 flex flex-col items-center justify-center text-white font-black shadow-lg shadow-slate-200">
                                <span className="text-[8px] opacity-60 uppercase tracking-tighter">Slot</span>
                                <span className="text-lg">{log.slot_number || '??'}</span>
                             </div>
                             <div>
                                <h3 className="font-black text-slate-900 uppercase tracking-tight text-base">{log.license_plate}</h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                   <p className="text-xs text-slate-400 font-bold uppercase">
                                      {new Date(log.start_time).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                   </p>
                                   <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${
                                      log.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 
                                      log.status === 'active' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
                                   }`}>
                                      {log.status}
                                   </span>
                                </div>
                             </div>
                          </div>

                          <div className="flex items-center gap-8">
                             <div className="text-right">
                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">Total Fee</p>
                                <p className="text-lg font-black text-slate-900">{formatRp(log.total_fee)}</p>
                             </div>
                             <button 
                               onClick={() => setSelectedReceipt(log)}
                               className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-sm group-hover:shadow-md"
                             >
                               View Receipt
                             </button>
                          </div>
                       </div>
                    </div>
                  ))
                )}
             </div>
          </div>
        </div>
      </div>

      {/* DIGITAL RECEIPT MODAL */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
           <div className="relative w-full max-w-sm bg-white rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
              {/* Receipt Header (Fixed) */}
              <div className="bg-slate-900 p-6 text-white text-center relative flex-shrink-0">
                 <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-600/20 rounded-full blur-3xl -mr-12 -mt-12" />
                 <div className="relative z-10">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center mx-auto mb-3 border border-white/20">
                       <FaParking className="text-indigo-400 w-5 h-5" />
                    </div>
                    <h2 className="text-sm font-black uppercase tracking-[0.25em]">Parking Receipt</h2>
                    <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">SmartPark AI Digital</p>
                 </div>
                 <button onClick={() => setSelectedReceipt(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
                    <HiX className="w-5 h-5" />
                 </button>
              </div>

              {/* Receipt Body (Scrollable) */}
              <div className="p-8 overflow-y-auto flex-1">
                 <div className="text-center mb-6">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Amount Paid</p>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">{formatRp(selectedReceipt.total_fee)}</h3>
                 </div>

                 <div className="space-y-3.5 py-4 border-y border-slate-50">
                    <ReceiptRow label="Plate Number" value={selectedReceipt.license_plate} />
                    <ReceiptRow label="Slot Number" value={selectedReceipt.slot_number || 'N/A'} />
                    <ReceiptRow label="Status" value={selectedReceipt.status} />
                    <ReceiptRow label="Start Time" value={new Date(selectedReceipt.start_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })} />
                    <ReceiptRow label="End Time" value={new Date(selectedReceipt.end_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })} />
                    <ReceiptRow label="Transaction" value={`TRX-${selectedReceipt.id.toString().slice(-6).toUpperCase()}`} />
                 </div>

                 <div className="pt-6 flex flex-col items-center opacity-60">
                    <div className="p-3 bg-slate-50 rounded-2xl mb-3">
                       <HiQrcode className="w-16 h-16 text-slate-900" />
                    </div>
                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Verified Digital Receipt</p>
                 </div>
              </div>

              {/* Receipt Footer (Fixed) */}
              <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex-shrink-0">
                 <button 
                   onClick={() => handleDownload(selectedReceipt)}
                   className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 active:scale-95"
                 >
                    <HiDownload className="w-5 h-5" /> Download Receipt
                 </button>
              </div>
           </div>
        </div>
      )}
    </PublicLayout>
  );
}

function StatCard({ label, value, icon, color, bg }) {
  return (
    <div className={`${bg} p-6 rounded-[28px] border border-white flex items-center gap-5 shadow-sm`}>
       <div className={`w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-2xl ${color} shadow-sm`}>
          {icon}
       </div>
       <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
          <p className={`text-xl font-black ${color}`}>{value}</p>
       </div>
    </div>
  );
}

function ReceiptRow({ label, value }) {
  return (
    <div className="flex justify-between items-center text-xs">
       <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">{label}</span>
       <span className="font-black text-slate-900 uppercase tracking-tight">{value}</span>
    </div>
  );
}

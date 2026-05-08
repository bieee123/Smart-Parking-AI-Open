import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicLayout from '../../../layouts/PublicLayout';
import {
  HiCheckCircle, HiArrowRight, HiShieldCheck, HiOutlineDesktopComputer,
  HiOutlineLightningBolt, HiOutlineCloudUpload, HiOutlineChartPie,
  HiOutlineClock, HiOutlineCubeTransparent
} from 'react-icons/hi';
import { FaParking, FaCar, FaTruck, FaMotorcycle } from 'react-icons/fa';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

function useCountUp(target, duration = 2000) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!target) return;
    let start = 0;
    const end = parseInt(target);
    if (start === end) return;
    let timer = setInterval(() => {
      start += Math.ceil(end / 60);
      if (start >= end) {
        setValue(end);
        clearInterval(timer);
      } else {
        setValue(start);
      }
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [target]);
  return value;
}

function StatItem({ label, value, colorClass }) {
  const count = useCountUp(value);
  return (
    <div className="flex flex-col">
      <div className={`text-4xl font-extrabold tracking-tight mb-1 ${colorClass}`}>
        {count}
      </div>
      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
        {label}
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc, delay }) {
  return (
    <div className="p-8 rounded-3xl bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-500 group">
      <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-indigo-600 transition-all duration-500">
        <Icon className="w-7 h-7 text-indigo-600 group-hover:text-white transition-colors" />
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-500 leading-relaxed text-sm">
        {desc}
      </p>
    </div>
  );
}

function ZoneStatusCard({ zone, total, available, occupied, reserved }) {
  const pct = total > 0 ? Math.round(((occupied + reserved) / total) * 100) : 0;
  const isCrowded = pct >= 80;
  
  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:border-indigo-200 transition-all">
      <div className="flex justify-between items-start mb-6">
        <div>
          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.2em] mb-1 block">Region</span>
          <h4 className="text-2xl font-black text-slate-900">ZONE {zone}</h4>
        </div>
        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
          isCrowded ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'
        }`}>
          {isCrowded ? 'Crowded' : 'Available'}
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <div className="text-3xl font-black text-slate-900">{available} <span className="text-sm font-medium text-slate-400">Slots</span></div>
          <div className="text-sm font-bold text-indigo-600">{pct}% <span className="text-xs text-slate-400 font-medium">Occupancy</span></div>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ${isCrowded ? 'bg-orange-500' : 'bg-indigo-500'}`}
            style={{ width: `${pct}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, available: 0, occupied: 0, reserved: 0 });
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/public/slots`)
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setStats(res.data.totals);
          setZones(res.data.zoneSummary);
        }
      })
      .finally(() => setLoading(false));

    // Handle hash scroll on mount
    const hash = window.location.hash;
    if (hash) {
      setTimeout(() => {
        const id = hash.replace('#', '');
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 500); // Small delay to ensure content is rendered
    }
  }, []);

  return (
    <PublicLayout>
      {/* ── HERO SECTION ────────────────────────────────── */}
      <section className="relative pt-20 pb-16 md:pt-32 md:pb-24 overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-50 rounded-full blur-[120px] opacity-60"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-cyan-50 rounded-full blur-[100px] opacity-60"></div>
        </div>

        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 text-indigo-700 text-xs font-black uppercase tracking-widest mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            Next-Gen Parking System
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black text-slate-900 mb-6 tracking-tighter leading-[0.9]">
            The Smartest <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-indigo-400">Parking Solution.</span>
          </h1>
          
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-500 mb-10 leading-relaxed">
            Manage your parking space with AI precision. Real-time monitoring, instant reservations, and deep analytics in one unified platform.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
            <button 
              onClick={() => navigate('/parking')}
              className="w-full sm:w-auto px-10 py-5 rounded-2xl bg-indigo-600 text-white font-black text-lg shadow-2xl shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-1 transition-all flex items-center justify-center gap-3"
            >
              Check Slots Now
              <HiArrowRight className="w-5 h-5" />
            </button>
            <Link 
              to="/register"
              className="w-full sm:w-auto px-10 py-5 rounded-2xl bg-white text-slate-900 border border-slate-200 font-black text-lg hover:bg-slate-50 transition-all"
            >
              Start for Free
            </Link>
          </div>

          {/* Quick Stats Grid */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-5 gap-8 max-w-5xl mx-auto border-t border-slate-100 pt-12">
            <StatItem label="Total Slots" value={stats.total} colorClass="text-slate-900" />
            <StatItem label="Available" value={stats.available} colorClass="text-emerald-500" />
            <StatItem label="Reserved" value={stats.reserved} colorClass="text-blue-500" />
            <StatItem label="Occupied" value={stats.occupied} colorClass="text-slate-400" />
            <StatItem label="Occupancy" value={stats.total > 0 ? Math.round(((stats.occupied + stats.reserved) / stats.total) * 100) : 0} colorClass="text-indigo-600" />
          </div>
        </div>
      </section>

      {/* ── TRUST BAR ───────────────────────────────────── */}
      <section className="py-12 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-10">Powered by Leading Technologies</p>
          <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-40 grayscale contrast-125">
            <div className="flex items-center gap-2 font-black text-xl italic tracking-tighter">YOLOv8</div>
            <div className="flex items-center gap-2 font-black text-xl tracking-tighter uppercase">TensorFlow</div>
            <div className="flex items-center gap-2 font-black text-xl tracking-tighter">OPENCV</div>
            <div className="flex items-center gap-2 font-black text-xl tracking-tighter uppercase">PostgreSQL</div>
          </div>
        </div>
      </section>

      {/* ── FEATURES SECTION ────────────────────────────── */}
      <section id="features" className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl mb-24">
            <h2 className="text-indigo-600 text-sm font-black uppercase tracking-[0.2em] mb-4">Key Features</h2>
            <p className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter leading-tight">
              Designed for Boundless <br />Efficiency.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={HiOutlineLightningBolt}
              title="Real-time Detection"
              desc="Our AI detects parking slot occupancy every second with 99.9% accuracy using cutting-edge vision processing."
            />
            <FeatureCard 
              icon={HiOutlineCloudUpload}
              title="Seamless Booking"
              desc="Reserve your favorite parking slot from anywhere. Slots are automatically locked and notifications sent instantly."
            />
            <FeatureCard 
              icon={HiOutlineChartPie}
              title="Advanced Analytics"
              desc="Understand your parking land usage trends with interactive analytics dashboards based on historical data."
            />
            <FeatureCard 
              icon={HiShieldCheck}
              title="Enterprise Security"
              desc="Every transaction and user data is protected with industry-standard bank-level end-to-end encryption."
            />
            <FeatureCard 
              icon={HiOutlineClock}
              title="Dynamic Tariffs"
              desc="Automatic cost calculation system based on duration and vehicle type without manual intervention."
            />
            <FeatureCard 
              icon={HiOutlineCubeTransparent}
              title="IoT Integration"
              desc="Easy integration with existing gate hardware, ultrasonic sensors, and CCTV systems at your location."
            />
          </div>
        </div>
      </section>

      {/* ── LIVE AVAILABILITY ───────────────────────────── */}
      <section id="zones" className="py-32 bg-slate-50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[50%] h-[100%] bg-indigo-600/5 -skew-x-12 translate-x-1/2"></div>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-20">
            <div className="max-w-xl">
              <h2 className="text-indigo-600 text-sm font-black uppercase tracking-[0.2em] mb-4">Live Status</h2>
              <p className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter">Monitor Parking Slots in Real-time.</p>
            </div>
            <p className="text-slate-500 max-w-sm text-sm leading-relaxed">
              The following data is taken directly from AI sensors in the field. Status is updated automatically every 30 seconds.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {zones.length > 0 ? (
                zones.map(z => <ZoneStatusCard key={z.zone} {...z} />)
              ) : (
                <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 font-bold uppercase tracking-widest">
                  Waiting for Sensor Synchronization...
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── TARIFF TABLE ────────────────────────────────── */}
      <section id="how-it-works" className="py-32 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-indigo-600 text-sm font-black uppercase tracking-[0.2em] mb-4">Service Rates</h2>
            <p className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter">Transparent Pricing.</p>
          </div>

          <div className="overflow-hidden rounded-[32px] border border-slate-200 shadow-2xl shadow-indigo-100">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="px-8 py-6 text-sm font-bold uppercase tracking-widest">Vehicle Type</th>
                  <th className="px-8 py-6 text-sm font-bold uppercase tracking-widest">First Hour</th>
                  <th className="px-8 py-6 text-sm font-bold uppercase tracking-widest">Next Hour</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { icon: FaCar,        name: 'Private Car',    first: 5000, next: 2000 },
                  { icon: FaTruck,      name: 'Truck / Bus',    first: 5000, next: 2000 },
                  { icon: FaMotorcycle, name: 'Motorcycle',     first: 3000, next: 2000 },
                ].map((item) => (
                  <tr key={item.name} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-8 py-8">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                          <item.icon className="w-5 h-5" />
                        </div>
                        <span className="font-black text-slate-900">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-8 py-8 font-bold text-slate-900">IDR {item.first.toLocaleString('en-US')}</td>
                    <td className="px-8 py-8 font-bold text-indigo-600">IDR {item.next.toLocaleString('en-US')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-8 text-center text-xs text-slate-400 font-medium italic">
            * All rates include tax and security insurance in the parking area.
          </p>
        </div>
      </section>

      {/* ── CTA FINAL ───────────────────────────────────── */}
      <section className="py-40 px-6 bg-slate-900 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-500 rounded-full blur-[100px]"></div>
        </div>
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-7xl font-black text-white tracking-tighter mb-10 leading-[0.9]">
            Start Your Parking <br />Revolution Today.
          </h2>
          <p className="text-slate-400 text-lg md:text-xl mb-12 max-w-2xl mx-auto leading-relaxed">
            Join thousands of users who have switched to a smarter, safer, and seamless way of parking.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link 
              to="/register"
              className="w-full sm:w-auto px-12 py-6 rounded-2xl bg-indigo-600 text-white font-black text-xl shadow-2xl shadow-indigo-500/20 hover:bg-indigo-700 hover:-translate-y-1 transition-all"
            >
              Join Now
            </Link>
            <button 
              onClick={() => navigate('/parking')}
              className="w-full sm:w-auto px-12 py-6 rounded-2xl bg-slate-800 text-white font-black text-xl border border-slate-700 hover:bg-slate-700 transition-all flex items-center justify-center gap-3"
            >
              Find Slots
              <HiArrowRight className="w-6 h-6 text-indigo-400" />
            </button>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

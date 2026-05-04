import { useState, useEffect, useCallback } from 'react';
import {
  HiDocumentText, HiRefresh, HiDownload, HiExclamation,
  HiCheckCircle, HiExclamationCircle, HiInformationCircle, HiTrendingUp, HiTrendingDown
} from 'react-icons/hi';
import { FaFilePdf, FaChartLine } from 'react-icons/fa';

const API = 'http://localhost:8000/api';

const PRIORITY_CONFIG = {
  critical: { bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-700', badge: 'bg-red-100 text-red-800', icon: <HiExclamationCircle className="text-xl" /> },
  high: { bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-800', icon: <HiExclamation className="text-xl" /> },
  medium: { bg: 'bg-yellow-50', border: 'border-yellow-100', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-800', icon: <HiInformationCircle className="text-xl" /> },
  low: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', badge: 'bg-gray-200 text-gray-800', icon: <HiCheckCircle className="text-xl" /> },
};

function StatCard({ label, value, sub, color = 'blue' }) {
  const colors = { blue: 'text-blue-600', green: 'text-green-600', red: 'text-red-600', amber: 'text-amber-600', purple: 'text-purple-600', slate: 'text-gray-500' };
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold ${colors[color] || colors.blue}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5 font-medium">{sub}</p>}
    </div>
  );
}

function OccupancyBar({ area }) {
  const pct = area.occupancy_percentage || 0;
  const color = pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-orange-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-gray-700">{area.area}</span>
        <span className="text-xs font-black text-gray-900">{pct.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1 shadow-inner">
        <div className={`h-1.5 rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase tracking-tight">
        <span>{area.occupied_slots} occupied</span>
        <span>{area.available_slots} free</span>
      </div>
    </div>
  );
}

function PredictionBar({ prediction }) {
  const pct = prediction.predicted_occupancy_percentage || 0;
  const color = pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-orange-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-bold text-gray-500 w-12 shrink-0 text-right uppercase">{prediction.time_label}</span>
      <div className="flex-1 bg-gray-200 rounded-full h-3 shadow-inner overflow-hidden">
        <div className={`h-3 rounded-full transition-all duration-700 ${color} shadow-sm`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-black text-gray-700 w-10 shrink-0">{pct.toFixed(0)}%</span>
      <span className="text-[10px] font-bold text-gray-400 w-10 shrink-0 uppercase">{(prediction.confidence * 100).toFixed(0)}% conf</span>
    </div>
  );
}

function RecommendationCard({ rec }) {
  const cfg = PRIORITY_CONFIG[rec.priority] || PRIORITY_CONFIG.low;
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-start gap-3">
        <span className="text-lg shrink-0">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${cfg.badge}`}>{rec.priority}</span>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{rec.category?.replace(/_/g, ' ')}</span>
          </div>
          <p className={`text-sm font-bold leading-tight ${cfg.text}`}>{rec.action}</p>
          {rec.reason && <p className="text-xs text-gray-500 mt-1 italic font-medium">{rec.reason}</p>}
        </div>
      </div>
    </div>
  );
}

function HealthBadge({ status, score }) {
  const map = {
    healthy: { color: 'text-green-600', bg: 'bg-green-500', ring: 'ring-green-100', label: 'Healthy' },
    moderate: { color: 'text-yellow-600', bg: 'bg-yellow-500', ring: 'ring-yellow-100', label: 'Moderate' },
    warning: { color: 'text-orange-600', bg: 'bg-orange-500', ring: 'ring-orange-100', label: 'Warning' },
    critical: { color: 'text-red-600', bg: 'bg-red-500', ring: 'ring-red-100', label: 'Critical' },
  };
  const cfg = map[status] || map.moderate;
  return (
    <div className={`relative flex items-center justify-center w-36 h-36 rounded-full ring-8 ${cfg.ring} bg-white shadow-xl border border-gray-100`}>
      <div className="text-center">
        <p className={`text-4xl font-black ${cfg.color}`}>{Math.round(score)}</p>
        <p className="text-[10px] font-bold text-gray-400 mt-0.5 uppercase tracking-widest">/ 100</p>
        <p className={`text-[10px] font-black mt-1 uppercase tracking-widest ${cfg.color}`}>{cfg.label}</p>
      </div>
    </div>
  );
}

function ViolationBreakdown({ breakdown }) {
  if (!breakdown) return null;
  const entries = Object.entries(breakdown);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const labels = { illegal_parking: 'Illegal Parking', blocking: 'Blocking', improper_parking: 'Improper', overtime: 'Overtime', other: 'Other' };
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-gray-400'];
  return (
    <div className="space-y-2">
      {entries.map(([key, val], i) => {
        const pct = total > 0 ? (val / total) * 100 : 0;
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-gray-500 w-32 shrink-0 uppercase">{labels[key] || key}</span>
            <div className="flex-1 bg-gray-200 rounded-full h-2 shadow-inner">
              <div className={`h-2 rounded-full ${colors[i] || 'bg-gray-400'}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-black text-gray-900 w-6 text-right">{val}</span>
          </div>
        );
      })}
    </div>
  );
}

function SkeletonBlock({ h = 'h-32', className = '' }) {
  return <div className={`bg-gray-200 border border-gray-100 rounded-xl animate-pulse ${h} ${className}`} />;
}

export default function ExecutiveSummaryPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [countdown, setCountdown] = useState(60);

  const fetchSummary = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/analytics/executive-summary`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load summary');
      setData(json);
      setLastRefresh(new Date());
      setCountdown(60);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { fetchSummary(); return 60; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  function handlePrint() { window.print(); }

  const occ = data?.data?.occupancy;
  const pred = data?.data?.predictions;
  const viol = data?.data?.violations;
  const recs = data?.data?.recommendations;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center shadow-sm">
                <HiDocumentText className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Executive Summary</h1>
                <p className="text-gray-500 text-sm">Stakeholder report — Smart Parking & Infrastructure</p>
              </div>
            </div>
            {lastRefresh && (
              <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <span>Last updated: {lastRefresh.toLocaleTimeString()}</span>
                <span className="text-gray-300">•</span>
                <span>Auto-refresh in <span className="text-blue-600">{countdown}s</span></span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchSummary} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50 rounded-lg text-xs font-bold text-gray-600 transition shadow-sm">
              <HiRefresh className={`text-lg ${loading ? 'animate-spin' : ''}`} />
              REFRESH
            </button>
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-xs font-black text-white transition shadow-lg shadow-purple-600/20 uppercase tracking-widest active:scale-95">
              <HiDownload className="text-lg" />
              Download Report
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-5 mb-6 flex items-center gap-3 shadow-sm">
            <span className="text-red-600 text-lg">⚠️</span>
            <div>
              <p className="text-sm font-bold text-red-800 uppercase tracking-tight">Failed to load executive summary</p>
              <p className="text-xs text-red-600 mt-0.5 font-medium">{error}</p>
            </div>
            <button onClick={fetchSummary} className="ml-auto text-[10px] font-black text-red-600 underline hover:text-red-700 uppercase tracking-widest">Retry</button>
          </div>
        )}

        {loading && !data && (
          <div className="space-y-6">
            {/* Real-feel Skeleton for Section 1 */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-8 flex-wrap">
                <div className="w-36 h-36 rounded-full bg-gray-100 animate-pulse border border-gray-100 flex items-center justify-center">
                  <div className="w-24 h-6 bg-gray-200 rounded-full" />
                </div>
                <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4 min-w-0">
                  <SkeletonBlock h="h-24" />
                  <SkeletonBlock h="h-24" />
                  <SkeletonBlock h="h-24" />
                  <SkeletonBlock h="h-24" />
                </div>
              </div>
            </div>

            {/* Real-feel Skeleton for Section 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
                <div className="w-40 h-4 bg-gray-200 rounded mb-4" />
                <SkeletonBlock h="h-12" />
                <SkeletonBlock h="h-12" />
                <SkeletonBlock h="h-12" />
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
                <div className="w-40 h-4 bg-gray-200 rounded mb-4" />
                <SkeletonBlock h="h-8" />
                <SkeletonBlock h="h-8" />
                <SkeletonBlock h="h-8" />
                <SkeletonBlock h="h-8" />
              </div>
            </div>

            {/* Real-feel Skeleton for Section 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="w-40 h-4 bg-gray-200 rounded mb-6" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <SkeletonBlock h="h-4" />
                  <SkeletonBlock h="h-4" />
                  <SkeletonBlock h="h-4" />
                </div>
                <div className="space-y-3">
                  <SkeletonBlock h="h-12" />
                  <SkeletonBlock h="h-12" />
                </div>
              </div>
            </div>
          </div>
        )}

        {data && (
          <div className="space-y-6">

            {/* Section 1: Health Score + Key Stats */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-8 flex-wrap">
                <div className="flex items-center justify-center">
                  <HealthBadge status={data.system_status} score={data.health_score} />
                </div>
                <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4 min-w-0">
                  <StatCard label="Total Slots" value={occ?.total_slots ?? '—'} color="slate" />
                  <StatCard label="Occupied" value={occ?.occupied_slots ?? '—'} sub={`${occ?.occupancy_percentage ?? 0}%`} color="amber" />
                  <StatCard label="Available" value={occ?.available_slots ?? '—'} color="green" />
                  <StatCard label="Violations Today" value={viol?.total_violations_today ?? '—'} color={viol?.trend?.direction === 'up' ? 'red' : 'green'} sub={viol?.trend ? `${viol.trend.change_percent}% vs yesterday` : ''} />
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />
                Source: {data.metadata?.data_source || 'rule-based'} &nbsp;•&nbsp;
                v{data.metadata?.rule_engine_version || '0.1.0'} &nbsp;•&nbsp;
                Gen: {new Date(data.generated_at).toLocaleString()}
              </div>
            </div>

            {/* Section 2: Occupancy + Predicted Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Occupancy */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <h2 className="text-xs font-black text-gray-700 mb-4 flex items-center gap-2 uppercase tracking-widest">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Occupancy by Area
                </h2>
                {occ?.areas ? (
                  <div className="space-y-3">
                    {occ.areas.map((area, i) => <OccupancyBar key={i} area={area} />)}
                  </div>
                ) : <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">No data</p>}
                {occ?.highest_occupancy && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                      <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Highest</p>
                      <p className="text-sm font-black text-gray-900">{occ.highest_occupancy.area}</p>
                      <p className="text-xs font-bold text-red-700">{occ.highest_occupancy.occupancy_percentage}%</p>
                    </div>
                    <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                      <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Lowest</p>
                      <p className="text-sm font-black text-gray-900">{occ.lowest_occupancy?.area}</p>
                      <p className="text-xs font-bold text-green-700">{occ.lowest_occupancy?.occupancy_percentage}%</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Predicted Trends */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-black text-gray-700 flex items-center gap-2 uppercase tracking-widest">
                    <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> Demand Forecast (Next 6h)
                  </h2>
                  {pred && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${pred.bottleneck_risk_level === 'high' ? 'bg-red-100 text-red-800' :
                        pred.bottleneck_risk_level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                      }`}>{pred.bottleneck_risk_level} risk</span>
                  )}
                </div>
                {pred?.predicted_next_6_hours ? (
                  <div className="space-y-3">
                    {pred.predicted_next_6_hours.map((p, i) => <PredictionBar key={i} prediction={p} />)}
                  </div>
                ) : <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">No prediction data</p>}
                {pred && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Trend</p>
                      <p className={`text-sm font-black capitalize ${pred.trend_label === 'increasing' ? 'text-red-600' : pred.trend_label === 'decreasing' ? 'text-green-600' : 'text-blue-600'}`}>
                        {pred.trend_label}
                      </p>
                    </div>
                    <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Peak Expected</p>
                      <p className="text-sm font-black text-gray-900">{pred.expected_peak_time}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">{pred.hours_to_peak === 'now' ? 'Now' : `in ${pred.hours_to_peak}`}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Violations */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <h2 className="text-xs font-black text-gray-700 mb-4 flex items-center gap-2 uppercase tracking-widest">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Violation Analysis
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] font-black text-gray-400 mb-3 uppercase tracking-widest">Breakdown by Type</p>
                  <ViolationBreakdown breakdown={viol?.breakdown} />
                </div>
                {viol?.top_hotspots && (
                  <div>
                    <p className="text-[10px] font-black text-gray-400 mb-3 uppercase tracking-widest">Top Hotspots</p>
                    <div className="space-y-2">
                      {viol.top_hotspots.map((h, i) => (
                        <div key={i} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg p-3">
                          <div>
                            <p className="text-xs font-black text-gray-700">{h.zone} — {h.area}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{h.primary_type?.replace(/_/g, ' ')}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-gray-900">{h.violations}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${h.severity === 'high' ? 'bg-red-100 text-red-800' : h.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>{h.severity}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Section 4: Recommendations */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <h2 className="text-xs font-black text-gray-700 mb-4 flex items-center gap-2 uppercase tracking-widest">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Recommendations
                <span className="ml-auto text-[10px] font-bold text-gray-400 uppercase tracking-widest">{recs?.length || 0} actions</span>
              </h2>
              {recs && recs.length > 0 ? (
                <div className="space-y-3">
                  {recs.map((rec, i) => <RecommendationCard key={i} rec={rec} />)}
                </div>
              ) : (
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center py-8">No recommendations at this time.</p>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';

const API = 'http://localhost:8000/api';

const PRIORITY_CONFIG = {
  critical: { bg: 'bg-red-900/30', border: 'border-red-700/50', text: 'text-red-300', badge: 'bg-red-100 text-red-700', icon: '🚨' },
  high:     { bg: 'bg-orange-900/20', border: 'border-orange-700/40', text: 'text-orange-300', badge: 'bg-orange-100 text-orange-700', icon: '⚠️' },
  medium:   { bg: 'bg-yellow-900/20', border: 'border-yellow-700/40', text: 'text-yellow-300', badge: 'bg-yellow-100 text-yellow-700', icon: '📋' },
  low:      { bg: 'bg-slate-700/30', border: 'border-slate-600/40', text: 'text-slate-300', badge: 'bg-slate-200 text-slate-700', icon: '✅' },
};

function StatCard({ label, value, sub, color = 'blue' }) {
  const colors = { blue: 'text-blue-400', green: 'text-green-400', red: 'text-red-400', amber: 'text-amber-400', purple: 'text-purple-400', slate: 'text-slate-300' };
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colors[color] || colors.blue}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function OccupancyBar({ area }) {
  const pct = area.occupancy_percentage || 0;
  const color = pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-orange-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="bg-slate-700/40 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-300">{area.area}</span>
        <span className="text-xs font-bold text-white">{pct.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-1.5 mb-1">
        <div className={`h-1.5 rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-slate-500">
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
      <span className="text-xs text-slate-400 w-12 shrink-0 text-right">{prediction.time_label}</span>
      <div className="flex-1 bg-slate-700 rounded-full h-3">
        <div className={`h-3 rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-slate-300 w-10 shrink-0">{pct.toFixed(0)}%</span>
      <span className="text-xs text-slate-500 w-10 shrink-0">{(prediction.confidence * 100).toFixed(0)}% conf</span>
    </div>
  );
}

function RecommendationCard({ rec }) {
  const cfg = PRIORITY_CONFIG[rec.priority] || PRIORITY_CONFIG.low;
  return (
    <div className={`rounded-xl border p-4 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-start gap-3">
        <span className="text-lg shrink-0">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>{rec.priority.toUpperCase()}</span>
            <span className="text-xs text-slate-400 capitalize">{rec.category?.replace(/_/g, ' ')}</span>
          </div>
          <p className={`text-sm font-medium leading-snug ${cfg.text}`}>{rec.action}</p>
          {rec.reason && <p className="text-xs text-slate-500 mt-1 italic">{rec.reason}</p>}
        </div>
      </div>
    </div>
  );
}

function HealthBadge({ status, score }) {
  const map = {
    healthy:  { color: 'text-green-400', bg: 'bg-green-500', ring: 'ring-green-500/30', label: 'Healthy' },
    moderate: { color: 'text-yellow-400', bg: 'bg-yellow-500', ring: 'ring-yellow-500/30', label: 'Moderate' },
    warning:  { color: 'text-orange-400', bg: 'bg-orange-500', ring: 'ring-orange-500/30', label: 'Warning' },
    critical: { color: 'text-red-400',    bg: 'bg-red-500',    ring: 'ring-red-500/30',    label: 'Critical' },
  };
  const cfg = map[status] || map.moderate;
  return (
    <div className={`relative flex items-center justify-center w-36 h-36 rounded-full ring-8 ${cfg.ring} bg-slate-800`}>
      <div className="text-center">
        <p className={`text-4xl font-black ${cfg.color}`}>{Math.round(score)}</p>
        <p className="text-xs text-slate-400 mt-0.5">/100</p>
        <p className={`text-xs font-bold mt-1 ${cfg.color}`}>{cfg.label}</p>
      </div>
    </div>
  );
}

function ViolationBreakdown({ breakdown }) {
  if (!breakdown) return null;
  const entries = Object.entries(breakdown);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const labels = { illegal_parking: 'Illegal Parking', blocking: 'Blocking', improper_parking: 'Improper', overtime: 'Overtime', other: 'Other' };
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-slate-500'];
  return (
    <div className="space-y-2">
      {entries.map(([key, val], i) => {
        const pct = total > 0 ? (val / total) * 100 : 0;
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs text-slate-400 w-32 shrink-0">{labels[key] || key}</span>
            <div className="flex-1 bg-slate-700 rounded-full h-2">
              <div className={`h-2 rounded-full ${colors[i] || 'bg-slate-500'}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-bold text-white w-6 text-right">{val}</span>
          </div>
        );
      })}
    </div>
  );
}

function SkeletonBlock({ h = 'h-32', className = '' }) {
  return <div className={`bg-slate-800 border border-slate-700 rounded-xl animate-pulse ${h} ${className}`} />;
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
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Executive Summary</h1>
                <p className="text-slate-400 text-sm">Stakeholder report — Smart Parking & Infrastructure</p>
              </div>
            </div>
            {lastRefresh && (
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>Last updated: {lastRefresh.toLocaleTimeString()}</span>
                <span className="text-slate-600">•</span>
                <span>Auto-refresh in <span className="text-slate-400 font-medium">{countdown}s</span></span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchSummary} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg text-sm font-medium text-slate-300 transition">
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-semibold text-white transition shadow-lg shadow-purple-900/30">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Report
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-5 mb-6 flex items-center gap-3">
            <span className="text-red-400 text-lg">⚠️</span>
            <div>
              <p className="text-sm font-medium text-red-300">Failed to load executive summary</p>
              <p className="text-xs text-red-400 mt-0.5">{error}</p>
            </div>
            <button onClick={fetchSummary} className="ml-auto text-xs text-red-400 underline hover:text-red-300">Retry</button>
          </div>
        )}

        {loading && !data && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><SkeletonBlock h="h-48" /><SkeletonBlock h="h-48" className="lg:col-span-2" /></div>
            <SkeletonBlock h="h-64" />
            <SkeletonBlock h="h-48" />
          </div>
        )}

        {data && (
          <div className="space-y-6">

            {/* Section 1: Health Score + Key Stats */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
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
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                <span className="w-2 h-2 rounded-full bg-slate-500 inline-block" />
                Data source: {data.metadata?.data_source || 'rule-based'} &nbsp;•&nbsp;
                Engine v{data.metadata?.rule_engine_version || '0.1.0'} &nbsp;•&nbsp;
                Generated: {new Date(data.generated_at).toLocaleString()}
              </div>
            </div>

            {/* Section 2: Occupancy + Predicted Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Occupancy */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Occupancy by Area
                </h2>
                {occ?.areas ? (
                  <div className="space-y-3">
                    {occ.areas.map((area, i) => <OccupancyBar key={i} area={area} />)}
                  </div>
                ) : <p className="text-xs text-slate-500">No data</p>}
                {occ?.highest_occupancy && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-3">
                      <p className="text-xs text-red-400 font-medium">Highest</p>
                      <p className="text-sm font-bold text-white">{occ.highest_occupancy.area}</p>
                      <p className="text-xs text-slate-400">{occ.highest_occupancy.occupancy_percentage}%</p>
                    </div>
                    <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-3">
                      <p className="text-xs text-green-400 font-medium">Lowest</p>
                      <p className="text-sm font-bold text-white">{occ.lowest_occupancy?.area}</p>
                      <p className="text-xs text-slate-400">{occ.lowest_occupancy?.occupancy_percentage}%</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Predicted Trends */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" /> Demand Forecast (Next 6h)
                  </h2>
                  {pred && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      pred.bottleneck_risk_level === 'high' ? 'bg-red-100 text-red-700' :
                      pred.bottleneck_risk_level === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>{pred.bottleneck_risk_level} risk</span>
                  )}
                </div>
                {pred?.predicted_next_6_hours ? (
                  <div className="space-y-2.5">
                    {pred.predicted_next_6_hours.map((p, i) => <PredictionBar key={i} prediction={p} />)}
                  </div>
                ) : <p className="text-xs text-slate-500">No prediction data</p>}
                {pred && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="bg-slate-700/40 rounded-lg p-3">
                      <p className="text-xs text-slate-400">Trend</p>
                      <p className={`text-sm font-bold capitalize ${pred.trend_label === 'increasing' ? 'text-red-400' : pred.trend_label === 'decreasing' ? 'text-green-400' : 'text-blue-400'}`}>
                        {pred.trend_label}
                      </p>
                    </div>
                    <div className="bg-slate-700/40 rounded-lg p-3">
                      <p className="text-xs text-slate-400">Peak Expected</p>
                      <p className="text-sm font-bold text-white">{pred.expected_peak_time}</p>
                      <p className="text-xs text-slate-500">{pred.hours_to_peak === 'now' ? 'Now' : `in ${pred.hours_to_peak}`}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Violations */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Violation Analysis
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-slate-400 mb-3">Breakdown by Type</p>
                  <ViolationBreakdown breakdown={viol?.breakdown} />
                </div>
                {viol?.top_hotspots && (
                  <div>
                    <p className="text-xs text-slate-400 mb-3">Top Hotspots</p>
                    <div className="space-y-2">
                      {viol.top_hotspots.map((h, i) => (
                        <div key={i} className="flex items-center justify-between bg-slate-700/40 rounded-lg p-3">
                          <div>
                            <p className="text-xs font-medium text-slate-300">{h.zone} — {h.area}</p>
                            <p className="text-xs text-slate-500 capitalize">{h.primary_type?.replace(/_/g, ' ')}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-white">{h.violations}</p>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${h.severity === 'high' ? 'bg-red-100 text-red-700' : h.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{h.severity}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Section 4: Recommendations */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Recommendations
                <span className="ml-auto text-xs text-slate-500">{recs?.length || 0} actions</span>
              </h2>
              {recs && recs.length > 0 ? (
                <div className="space-y-3">
                  {recs.map((rec, i) => <RecommendationCard key={i} rec={rec} />)}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No recommendations at this time.</p>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

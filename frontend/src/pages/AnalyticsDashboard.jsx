import { useState, useEffect } from 'react';
import OccupancyChart from '../components/analytics/OccupancyChart';
import PredictedDemandChart from '../components/analytics/PredictedDemandChart';
import CorrelationChart from '../components/analytics/CorrelationChart';
import ViolationHeatmap from '../components/analytics/ViolationHeatmap';
import BottleneckMap from '../components/analytics/BottleneckMap';
import EfficiencyStats from '../components/analytics/EfficiencyStats';

const API = 'http://localhost:8000/api';

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard({ className = '' }) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-5 animate-pulse ${className}`}>
      <div className="h-4 bg-gray-200 rounded w-40 mb-4" />
      <div className="h-48 bg-gray-200 rounded" />
    </div>
  );
}

// ── Error Banner ──────────────────────────────────────────────────────────────
function ErrorBanner({ errors, onRetry }) {
  if (!errors || errors.length === 0) return null;
  return (
    <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
      <span className="text-red-500 text-lg">⚠️</span>
      <div className="flex-1">
        <p className="text-sm font-medium text-red-800">Some analytics data failed to load</p>
        <ul className="text-xs text-red-600 mt-1 list-disc list-inside">
          {errors.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      </div>
      <button onClick={onRetry} className="text-xs text-red-600 underline hover:text-red-800">Retry</button>
    </div>
  );
}

// ── Efficiency Icon helpers ───────────────────────────────────────────────────
const ICONS = {
  utilization: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 11V7a2 2 0 012-2h10a2 2 0 012 2v4m-9 4h4m-6 0a2 2 0 00-2 2v2a2 2 0 002 2h8a2 2 0 002-2v-2a2 2 0 00-2-2H9z" />
    </svg>
  ),
  turnover: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  clock: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  trend: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
};

// ── Data transformers ─────────────────────────────────────────────────────────

function buildOccupancyData(trendsData, range) {
  if (!trendsData?.trends || trendsData.trends.length === 0) return { data: [], labels: [] };
  const trend = trendsData.trends[0];
  const points = trend.dataPoints || [];
  const sample = range === 'daily'
    ? points.filter((_, i) => i % 24 === 0).slice(-7)
    : range === 'weekly'
    ? points.filter((_, i) => i % (24 * 7) === 0).slice(-4)
    : points.slice(-24);
  return {
    data: sample.map(p => Math.round(p.occupancyRate * 100)),
    labels: sample.map(p => {
      const d = new Date(p.timestamp);
      return range === 'hourly' ? `${d.getHours()}:00` : d.toLocaleDateString('en', { weekday: 'short' });
    }),
  };
}

function buildPredictionData(summaryData) {
  const preds = summaryData?.data?.predictions?.predicted_next_6_hours || [];
  return preds.map(p => ({
    hour: p.time_label,
    predicted: Math.round(p.predicted_occupancy_percentage),
    actual: null,
  }));
}

function buildCorrelationData(correlationData) {
  if (!correlationData?.correlations) return [];
  return correlationData.correlations.map(c => ({
    label: (c.areaName || c.areaId || 'Area').replace(' Parking', '').replace(' Garage', ''),
    traffic: parseFloat((c.correlationScore || 0).toFixed(2)),
    occupancy: parseFloat(((c.dailySamples?.[0]?.occupancyRate) || c.correlationScore * 0.9 || 0).toFixed(2)),
  }));
}

function buildHeatmapData(hotspotsData) {
  if (!hotspotsData?.hotspots) return [];
  const zones = ['A', 'B', 'C', 'D', 'E'];
  return hotspotsData.hotspots.slice(0, 25).map((h, i) => ({
    zone: h.zone || `Zone-${i}`,
    row: Math.floor(i / 5),
    col: i % 5,
    value: parseFloat((h.severityScore * 9).toFixed(1)),
  }));
}

function buildBottleneckData(bottleneckData) {
  if (!bottleneckData?.bottlenecks) return [];
  const positions = [
    { x: 25, y: 30 }, { x: 65, y: 25 }, { x: 45, y: 70 },
    { x: 20, y: 65 }, { x: 75, y: 60 },
  ];
  return bottleneckData.bottlenecks.map((b, i) => ({
    id: b.bottleneckId || `b${i}`,
    name: b.locationName || b.areaName || `Bottleneck ${i + 1}`,
    severity: b.severityScore || 0.5,
    status: b.resolutionStatus || 'active',
    x: positions[i % positions.length].x,
    y: positions[i % positions.length].y,
  }));
}

function buildEfficiencyMetrics(effData) {
  if (!effData) return [];
  return [
    {
      label: 'Slot Utilization',
      value: `${effData.occupancyPercentage ?? 0}%`,
      icon: ICONS.utilization,
      trend: null,
      color: 'blue',
    },
    {
      label: 'Turnover Rate',
      value: `${effData.turnoverRate ?? 0}/hr`,
      icon: ICONS.turnover,
      trend: null,
      color: 'green',
    },
    {
      label: 'Available Slots',
      value: effData.availableSlots ?? '—',
      icon: ICONS.clock,
      trend: null,
      color: 'purple',
    },
    {
      label: 'Avg Duration',
      value: `${effData.averageDurationMinutes ?? 0} min`,
      icon: ICONS.clock,
      trend: null,
      color: 'amber',
    },
    {
      label: 'Utilization Score',
      value: `${Math.round((effData.utilizationScore ?? 0) * 100)}%`,
      icon: ICONS.trend,
      trend: null,
      color: 'teal',
    },
  ];
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  const [range, setRange] = useState('daily');
  const [horizon, setHorizon] = useState(6);

  // API data
  const [trendsData, setTrendsData] = useState(null);
  const [correlationData, setCorrelationData] = useState(null);
  const [hotspotsData, setHotspotsData] = useState(null);
  const [bottleneckData, setBottleneckData] = useState(null);
  const [efficiencyData, setEfficiencyData] = useState(null);
  const [summaryData, setSummaryData] = useState(null);

  async function fetchAll() {
    setLoading(true);
    const errs = [];

    const safe = async (label, url, setter) => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.success) setter(json.data);
        else throw new Error(json.error || 'API error');
      } catch (e) {
        errs.push(`${label}: ${e.message}`);
      }
    };

    await Promise.all([
      safe('Occupancy Trends', `${API}/analytics/occupancy/trends?range=7d`, setTrendsData),
      safe('Traffic Correlation', `${API}/analytics/traffic/correlation?range=7d`, setCorrelationData),
      safe('Violation Hotspots', `${API}/analytics/violation/hotspots?limit=25`, setHotspotsData),
      safe('Bottlenecks', `${API}/analytics/bottlenecks`, setBottleneckData),
      safe('Slot Efficiency', `${API}/analytics/efficiency/slots`, setEfficiencyData),
      safe('Executive Summary', `${API}/analytics/executive-summary`, (d) => setSummaryData({ data: d, success: true })),
    ]);

    setErrors(errs);
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, []);

  // Transform data for chart components
  const occupancyData = buildOccupancyData(trendsData, range);
  const predictionData = buildPredictionData(summaryData).slice(0, horizon);
  const correlData = buildCorrelationData(correlationData);
  const heatmapData = buildHeatmapData(hotspotsData);
  const bottlenecks = buildBottleneckData(bottleneckData);
  const efficiencyMetrics = buildEfficiencyMetrics(efficiencyData);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600 mt-1">Smart parking demand analysis and infrastructure insights</p>
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 border border-green-200 rounded-full text-xs text-green-700">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
            Live data from API
          </div>
          {!loading && (
            <button onClick={fetchAll} className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-full text-xs text-gray-600 transition">
              ↻ Refresh
            </button>
          )}
        </div>
      </div>

      <ErrorBanner errors={errors} onRetry={fetchAll} />

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><SkeletonCard /><SkeletonCard /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><SkeletonCard /><SkeletonCard /></div>
          <SkeletonCard className="h-40" />
          <SkeletonCard />
        </div>
      ) : (
        <div className="space-y-6">

          {/* Row 1: Occupancy + Predicted Demand */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Occupancy Trends */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-700">Occupancy Trends</h3>
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                  {['hourly', 'daily', 'weekly'].map(r => (
                    <button key={r} onClick={() => setRange(r)}
                      className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors ${range === r ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              {occupancyData.data.length > 0 ? (
                <OccupancyChart data={occupancyData.data} labels={occupancyData.labels} title="" height={220} />
              ) : (
                <div className="h-56 flex items-center justify-center text-sm text-gray-400">No trend data available</div>
              )}
            </div>

            {/* Predicted Demand */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-700">Predicted Demand</h3>
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                  {[1, 2, 3, 4, 5, 6].map(h => (
                    <button key={h} onClick={() => setHorizon(h)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${horizon === h ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                      +{h}h
                    </button>
                  ))}
                </div>
              </div>
              {predictionData.length > 0 ? (
                <PredictedDemandChart data={predictionData} title="" />
              ) : (
                <div className="h-56 flex items-center justify-center text-sm text-gray-400">No prediction data available</div>
              )}
              <p className="text-xs text-gray-400 mt-2 text-center">Rule-based predictions — ML model integration ready</p>
            </div>
          </div>

          {/* Row 2: Correlation + Violation Heatmap */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              {correlData.length > 0 ? (
                <CorrelationChart data={correlData} title="Traffic Volume vs Parking Occupancy" />
              ) : (
                <div className="h-32 flex items-center justify-center text-sm text-gray-400">No correlation data</div>
              )}
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              {heatmapData.length > 0 ? (
                <ViolationHeatmap data={heatmapData} rows={5} cols={5} title="Violation Hotspots" />
              ) : (
                <div className="h-32 flex items-center justify-center text-sm text-gray-400">No violation data</div>
              )}
            </div>
          </div>

          {/* Row 3: Bottleneck Map */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <BottleneckMap bottlenecks={bottlenecks} title="Bottleneck Detection" />
          </div>

          {/* Row 4: Efficiency Stats */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            {efficiencyMetrics.length > 0 ? (
              <EfficiencyStats metrics={efficiencyMetrics} title="System Efficiency Summary" />
            ) : (
              <div className="h-24 flex items-center justify-center text-sm text-gray-400">No efficiency data</div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

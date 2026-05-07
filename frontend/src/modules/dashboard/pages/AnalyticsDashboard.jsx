import { useState, useEffect } from 'react';
import {
  HiChartBar, HiRefresh, HiClock, HiTrendingUp, HiExclamation,
  HiArrowRight, HiMinusCircle, HiCheckCircle
} from 'react-icons/hi';
import OccupancyChart from '../components/analytics/OccupancyChart';
import PredictedDemandChart from '../components/analytics/PredictedDemandChart';
import CorrelationChart from '../components/analytics/CorrelationChart';
import ViolationHeatmap from '../components/analytics/ViolationHeatmap';
import BottleneckMap from '../components/analytics/BottleneckMap';
import EfficiencyStats from '../components/analytics/EfficiencyStats';

import { api } from '../../../services/api';
import { useTranslation } from 'react-i18next';


// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard({ className = '', h = 'h-56' }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-6 animate-pulse shadow-sm ${className}`}>
      <div className="flex justify-between items-center mb-6">
        <div className="h-5 bg-gray-200 rounded w-40" />
        <div className="flex gap-2">
          <div className="h-6 bg-gray-100 rounded w-16" />
          <div className="h-6 bg-gray-100 rounded w-16" />
        </div>
      </div>
      <div className={`${h} bg-gray-50 rounded-lg flex items-end gap-2 p-4 border border-gray-50`}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <div key={i} className="bg-gray-200/50 rounded-t w-full shadow-inner" style={{ height: `${Math.random() * 60 + 20}%` }} />
        ))}
      </div>
    </div>
  );
}

// ── Error Banner ──────────────────────────────────────────────────────────────
function ErrorBanner({ errors, onRetry }) {
  const { t } = useTranslation();
  if (!errors || errors.length === 0) return null;
  return (
    <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
      <HiExclamation className="text-red-500 text-xl" />
      <div className="flex-1">
        <p className="text-sm font-medium text-red-800">{t('analytics.failed_load')}</p>
        <ul className="text-xs text-red-600 mt-1 list-disc list-inside">
          {errors.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      </div>
      <button onClick={onRetry} className="text-xs text-red-600 underline hover:text-red-800">{t('common.retry')}</button>
    </div>
  );
}

// ── Efficiency Icon helpers ───────────────────────────────────────────────────
const ICONS = {
  utilization: <HiChartBar />,
  turnover: <HiRefresh />,
  clock: <HiClock />,
  trend: <HiTrendingUp />,
};

// ── Data transformers ─────────────────────────────────────────────────────────

function buildOccupancyData(trendsData, range) {
  if (!trendsData?.trends || trendsData.trends.length === 0) return { data: [], labels: [] };
  const trend = trendsData.trends[0];
  const points = trend.dataPoints || [];
  let sample;
  if (range === 'hourly') {
    // Last 24 hours, 1 per hour
    sample = points.slice(-24);
  } else if (range === 'daily') {
    // Last 7 days, 1 per day (every 24th point from the end)
    const daily = [];
    for (let i = points.length - 1; i >= 0 && daily.length < 7; i -= 24) {
      daily.unshift(points[i]);
    }
    sample = daily;
  } else {
    // Weekly: last 4 weeks, 1 per week (every 168th point)
    const weekly = [];
    for (let i = points.length - 1; i >= 0 && weekly.length < 4; i -= 168) {
      weekly.unshift(points[i]);
    }
    sample = weekly;
  }
  return {
    data: sample.map(p => Math.round((p.occupancyRate || 0) * 100)),
    labels: sample.map(p => {
      const d = new Date(p.timestamp);
      if (range === 'hourly') return `${String(d.getHours()).padStart(2,'0')}:00`;
      if (range === 'weekly') return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
      return d.toLocaleDateString('en', { weekday: 'short' });
    }),
  };
}

function buildPredictionData(summaryData, trendsData, horizon = 6) {
  const preds = (summaryData?.predictions?.predicted_next_6_hours || []).slice(0, horizon);
  const trends = trendsData?.trends?.[0]?.dataPoints || [];

  // Get last 3 hours of actual data
  const recentActuals = trends.slice(-3).map(p => {
    const actualVal = Math.round((p.occupancyRate || 0) * 100);
    return {
      hour: `${String(new Date(p.timestamp).getHours()).padStart(2,'0')}:00`,
      predicted: null,
      actual: actualVal
    };
  });

  // Future predictions (where Actual is null)
  const futurePredictions = preds.map(p => ({
    hour: p.time_label,
    predicted: Math.round(p.predicted_occupancy_percentage),
    actual: null,
  }));

  return [...recentActuals, ...futurePredictions];
}

function buildCorrelationData(correlationData) {
  if (!correlationData?.correlations || correlationData.correlations.length === 0) return [];

  // Find max traffic across all correlations to dynamically scale the bars
  let maxTraffic = 10;
  correlationData.correlations.forEach(c => {
    const vol = c.dailySamples?.[0]?.trafficVolume || 0;
    if (vol > maxTraffic) maxTraffic = vol;
  });

  return correlationData.correlations.map(c => {
    const latest = c.dailySamples?.[0] || {};
    
    const rawTrafficCount = latest.trafficVolume || 0;
    // Scale traffic relative to the max observed so the bars fit well
    const trafficVal = rawTrafficCount / maxTraffic; 
    const occupancyVal = latest.parkingOccupancy || 0;

    return {
      label: (c.areaName || 'Area').replace(' Parking', '').replace(' Garage', ''),
      traffic: Math.min(1, trafficVal),
      occupancy: Math.min(1, occupancyVal),
      trafficLabel: `${Math.round(rawTrafficCount)}`,
      occupancyLabel: `${Math.round(occupancyVal * 100)}%`,
    };
  });
}

function buildHeatmapData(hotspotsData) {
  if (!hotspotsData?.hotspots) return [];
  return hotspotsData.hotspots.slice(0, 25).map((h, i) => {
    const score = h.severityScore !== undefined ? h.severityScore : (h.violationCount ? Math.min(1, h.violationCount / 10) : 0);
    return {
      zone: h.zone || h.camera_id || h.slot_id || `Area-${i + 1}`,
      row: Math.floor(i / 5),
      col: i % 5,
      value: parseFloat((score * 9).toFixed(1)),
      count: h.violationCount || 0
    };
  });
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

function buildExecutiveSummary(summaryData) {
  if (!summaryData) return [];
  return [
    {
      title: 'Current Occupied',
      value: summaryData.occupancy?.occupied_slots || 0,
      change: '+12%',
      trend: 'up',
      color: 'blue',
    },
    {
      title: 'Occupancy Rate',
      value: `${summaryData.occupancy?.occupancy_percentage || 0}%`,
      change: '-5%',
      trend: 'down',
      color: 'purple',
    },
    {
      title: 'Active Violations',
      value: summaryData.violations?.total_violations_today || 0,
      change: '-2',
      trend: 'down',
      color: 'red',
    },
    {
      title: 'AI Confidence',
      value: `${Math.round((summaryData.predictions?.confidence_overall || 0) * 100)}%`,
      change: '+2%',
      trend: 'up',
      color: 'teal',
    },
  ];
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
      value: `${Math.round(((effData.utilizationScore?.value ?? effData.utilizationScore) ?? 0) * 100)}%`,
      icon: ICONS.trend,
      trend: null,
      color: 'teal',
    },
  ];
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AnalyticsDashboard() {
  const { t } = useTranslation();
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

    const safe = async (label, call, setter) => {
      try {
        const res = await call();
        // The centralized api service returns { success, data }
        if (res.success) {
          setter(res.data);
        } else {
          throw new Error(res.error || 'API error');
        }
      } catch (e) {
        errs.push(`${label}: ${e.message}`);
      }
    };

    await Promise.all([
      safe('Occupancy Trends', () => api.analytics.occupancyTrends('7d'), setTrendsData),
      safe('Traffic Correlation', () => api.analytics.trafficCorrelation('7d'), setCorrelationData),
      safe('Violation Hotspots', () => api.analytics.violationHotspots(25), setHotspotsData),
      safe('Bottlenecks', () => api.analytics.bottlenecks(), setBottleneckData),
      safe('Slot Efficiency', () => api.analytics.efficiency(), setEfficiencyData),
      safe('Executive Summary', () => api.analytics.executiveSummary(), setSummaryData),
    ]);

    setErrors(errs);
    setLoading(false);
  }

  useEffect(() => { 
    fetchAll(); 
    // Auto-refresh every 30 seconds to keep analytics in sync with real-time events
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, []);

  // Transform data for chart components
  const occupancyData = buildOccupancyData(trendsData, range);
  const predictionData = buildPredictionData(summaryData, trendsData, horizon);
  const correlData = buildCorrelationData(correlationData);
  const heatmapData = buildHeatmapData(hotspotsData);
  const bottlenecks = buildBottleneckData(bottleneckData);
  const efficiencyMetrics = buildEfficiencyMetrics(efficiencyData);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center shadow-sm">
          <HiChartBar className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{t('analytics.title')}</h1>
          <p className="text-gray-500 text-sm">{t('analytics.desc')}</p>
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 border border-green-200 rounded-full text-[10px] font-bold uppercase tracking-wider text-green-700">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
              {t('analytics.live_data')}
            </div>
            {!loading && (
              <button onClick={fetchAll} className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-full text-[10px] font-bold uppercase tracking-wider text-gray-600 transition">
                ↻ {t('common.refresh')}
              </button>
            )}
          </div>
        </div>
      </div>

      <ErrorBanner errors={errors} onRetry={fetchAll} />

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SkeletonCard h="h-40" />
            <SkeletonCard h="h-40" />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse shadow-sm">
            <div className="h-5 bg-gray-200 rounded w-48 mb-6" />
            <div className="h-72 bg-gray-50 rounded-xl border border-gray-50" />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse shadow-sm">
            <div className="h-5 bg-gray-200 rounded w-48 mb-6" />
            <div className="grid grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-gray-50 rounded-lg border border-gray-50" />)}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Row 1: Occupancy + Predicted Demand */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Occupancy Trends */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-700">{t('analytics.occupancy_trends')}</h3>
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                  {['hourly', 'daily', 'weekly'].map(r => (
                    <button key={r} onClick={() => setRange(r)}
                      className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors ${range === r ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                      {t(`analytics.${r}`)}
                    </button>
                  ))}
                </div>
              </div>
              {occupancyData.data.length > 0 ? (
                <OccupancyChart data={occupancyData.data} labels={occupancyData.labels} title="" height={220} />
              ) : (
                <div className="h-56 flex items-center justify-center text-sm text-gray-400">{t('analytics.no_trend')}</div>
              )}
            </div>

            {/* Predicted Demand */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-700">{t('analytics.predicted_demand')}</h3>
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
                <div className="h-56 flex items-center justify-center text-sm text-gray-400">{t('analytics.no_prediction')}</div>
              )}
              <p className="text-xs text-gray-400 mt-2 text-center">{t('analytics.forecast_desc')}</p>
            </div>
          </div>

          {/* Row 2: Correlation + Violation Heatmap */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              {correlData.length > 0 ? (
                <CorrelationChart data={correlData} title={t('analytics.traffic_vs_occupancy')} />
              ) : (
                <div className="h-32 flex items-center justify-center text-sm text-gray-400">{t('analytics.no_correlation')}</div>
              )}
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              {heatmapData.length > 0 ? (
                <ViolationHeatmap data={heatmapData} rows={5} cols={5} title={t('analytics.violation_hotspots')} />
              ) : (
                <div className="h-32 flex items-center justify-center text-sm text-gray-400">{t('analytics.no_violation')}</div>
              )}
            </div>
          </div>

          {/* Row 3: Bottleneck Map */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <BottleneckMap bottlenecks={bottlenecks} title={t('analytics.bottleneck_detection')} />
          </div>

          {/* Row 4: Efficiency Stats */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            {efficiencyMetrics.length > 0 ? (
              <EfficiencyStats metrics={efficiencyMetrics} title={t('analytics.efficiency_summary')} />
            ) : (
              <div className="h-24 flex items-center justify-center text-sm text-gray-400">{t('analytics.no_efficiency')}</div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
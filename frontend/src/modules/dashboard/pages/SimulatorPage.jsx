import { useState } from 'react';
import { 
  HiLightningBolt, HiCollection, HiBeaker, HiRefresh, 
  HiChevronRight, HiExclamationCircle, HiCheckCircle, HiExclamation,
  HiClock, HiArrowRight, HiMinusCircle, HiPlay, HiDocumentReport
} from 'react-icons/hi';
import { FaPlay, FaRobot, FaMicroscope, FaParking, FaTrafficLight, FaCogs } from 'react-icons/fa';

const API = 'http://localhost:8000/api';

const POLICY_TYPES = [
  { value: 'dynamic_pricing', label: 'Dynamic Pricing', paramKey: 'price_increase_percent', paramLabel: 'Price Increase %', defaultVal: 20 },
  { value: 'time_limit', label: 'Time Limit', paramKey: 'max_duration_minutes', paramLabel: 'Max Duration (min)', defaultVal: 120 },
  { value: 'reserved_zones', label: 'Reserved Zones', paramKey: 'reserved_percent', paramLabel: 'Reserved %', defaultVal: 10 },
  { value: 'enforcement_boost', label: 'Enforcement Boost', paramKey: 'patrol_increase_percent', paramLabel: 'Patrol Increase %', defaultVal: 50 },
  { value: 'reroute_active', label: 'Active Reroute', paramKey: 'reroute_percent', paramLabel: 'Reroute %', defaultVal: 15 },
];

function Badge({ level }) {
  const map = {
    critical: 'bg-red-50 text-red-700 border border-red-100',
    high: 'bg-orange-50 text-orange-700 border border-orange-100',
    warning: 'bg-yellow-50 text-yellow-700 border border-yellow-100',
    medium: 'bg-yellow-50 text-yellow-700 border border-yellow-100',
    low: 'bg-green-50 text-green-700 border border-green-100',
    none: 'bg-gray-50 text-gray-600 border border-gray-100',
    ok: 'bg-blue-50 text-blue-700 border border-blue-100',
  };
  const levelKey = String(level || 'none').toLowerCase();
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${map[levelKey] || map.none}`}>
      {level || 'None'}
    </span>
  );
}

function ScoreBar({ score }) {
  const pct = Math.round((score || 0) * 100);
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>Efficiency Score</span>
        <span className="font-bold text-gray-900">{pct}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ResultPanel({ result, title }) {
  if (!result) return null;
  const analysis = result.analysis || {};
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm h-full flex flex-col">
      <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
        <FaParking className="text-blue-500" />
        {title}
      </h3>

      <div className="grid grid-cols-2 gap-3">
        {[
          ['Occupancy', analysis.occupancy_status || analysis.occupancy_severity],
          ['Traffic', analysis.traffic_status],
          ['Violations', analysis.violation_status],
          ['Occupancy %', analysis.occupancy_percent != null ? `${analysis.occupancy_percent}%` : null],
        ].filter(([, v]) => v != null).map(([k, v]) => (
          <div key={k} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <p className="text-[10px] text-gray-500 mb-1 uppercase font-bold tracking-wider">{k}</p>
            <Badge level={v} />
          </div>
        ))}
      </div>

      {result.efficiency_score != null && <ScoreBar score={result.efficiency_score} />}

      {result.bottlenecks && result.bottlenecks.length > 0 && (
        <div className="pt-2 border-t border-gray-100">
          <p className="text-[10px] font-black text-red-600 mb-2 flex items-center gap-1 uppercase tracking-widest">
            <HiExclamationCircle /> Bottlenecks
          </p>
          {result.bottlenecks.map((b, i) => (
            <div key={i} className="bg-red-50 border border-red-100 rounded-lg p-2 mb-2">
              <div className="flex justify-between items-center mb-1">
                <p className="text-[10px] text-red-800 font-black uppercase tracking-tight">{b.area}</p>
                <Badge level={b.level} />
              </div>
              {b.reasons && b.reasons.map((r, j) => (
                <p key={j} className="text-[10px] text-red-600 font-medium leading-tight">• {r}</p>
              ))}
            </div>
          ))}
        </div>
      )}

      {result.suggestions && result.suggestions.length > 0 && (
        <div className="pt-2 border-t border-gray-100 mt-auto">
          <p className="text-[10px] font-black text-blue-600 mb-2 flex items-center gap-1 uppercase tracking-widest">
            <HiDocumentReport /> AI Suggestions
          </p>
          <div className="space-y-1">
            {result.suggestions.map((s, i) => (
              <p key={i} className="text-[10px] font-bold text-blue-800 bg-blue-50 border border-blue-100 rounded p-2 leading-tight">• {s}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SkeletonBlock({ h = 'h-32', className = '' }) {
  return <div className={`bg-gray-100 border border-gray-100 rounded-xl animate-pulse ${h} ${className}`} />;
}

function PolicyResultPanel({ result, loading }) {
  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm h-full">
        <div className="w-40 h-4 bg-gray-100 rounded mb-4" />
        <div className="grid grid-cols-2 gap-3">
          <SkeletonBlock h="h-16" />
          <SkeletonBlock h="h-16" />
          <SkeletonBlock h="h-16" />
          <SkeletonBlock h="h-16" />
        </div>
        <SkeletonBlock h="h-12" />
        <SkeletonBlock h="h-20" />
      </div>
    );
  }
  if (!result) return null;
  const diff = result.efficiency_change;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700">Policy Simulation Result</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Before Occupancy</p>
          <p className="text-lg font-bold text-gray-900">{result.current_state?.occupancy_percent ?? '—'}%</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">After Occupancy</p>
          <p className="text-lg font-bold text-blue-600">{result.simulated_state?.occupancy_percent ?? '—'}%</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Before Violations</p>
          <p className="text-lg font-bold text-gray-900">{result.current_state?.violations ?? '—'}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">After Violations</p>
          <p className="text-lg font-bold text-blue-600">{result.simulated_state?.violations ?? '—'}</p>
        </div>
      </div>

      {result.efficiency_score != null && <ScoreBar score={result.efficiency_score} />}

      {diff !== undefined && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Efficiency Change:</span>
          <span className={`text-sm font-black px-2 py-0.5 rounded ${diff >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {diff >= 0 ? '+' : ''}{(diff * 100).toFixed(1)}%
          </span>
        </div>
      )}

      {result.actions && result.actions.length > 0 && (
        <div>
          <p className="text-[10px] font-black text-purple-600 mb-2 uppercase tracking-widest flex items-center gap-1">
            <HiDocumentReport /> Policy Effects
          </p>
          {result.actions.map((a, i) => (
            <p key={i} className="text-xs font-bold text-gray-600 bg-gray-50 rounded p-2 mb-1 border border-gray-100">• {a}</p>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SimulatorPage() {
  // Tab
  const [tab, setTab] = useState('single');

  // Single area state
  const [single, setSingle] = useState({ area: 'Downtown Central', occupancy: 75, traffic: 120, violations: 3, capacity: 200 });
  const [singleResult, setSingleResult] = useState(null);
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleError, setSingleError] = useState(null);

  // Multi area state
  const [areas, setAreas] = useState([
    { area: 'Downtown Central', occupancy_percent: 85, traffic_volume: 150, capacity: 250 },
    { area: 'Shopping Mall', occupancy_percent: 60, traffic_volume: 90, capacity: 500 },
    { area: 'Office Complex', occupancy_percent: 40, traffic_volume: 60, capacity: 180 },
  ]);
  const [multiResult, setMultiResult] = useState(null);
  const [multiLoading, setMultiLoading] = useState(false);
  const [multiError, setMultiError] = useState(null);

  // Policy test state
  const [policy, setPolicy] = useState({ type: 'dynamic_pricing', paramVal: 20, occupancy: 80, traffic: 130, violations: 5, capacity: 200 });
  const [policyResult, setPolicyResult] = useState(null);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policyError, setPolicyError] = useState(null);

  const selectedPolicy = POLICY_TYPES.find(p => p.value === policy.type) || POLICY_TYPES[0];

  async function runSingle() {
    setSingleLoading(true); setSingleError(null); setSingleResult(null);
    try {
      const res = await fetch(`${API}/simulator/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area: single.area, occupancy: Number(single.occupancy), traffic: Number(single.traffic), violations: Number(single.violations), capacity: Number(single.capacity) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Simulation failed');
      setSingleResult(data);
    } catch (e) { setSingleError(e.message); }
    finally { setSingleLoading(false); }
  }

  async function runMulti() {
    setMultiLoading(true); setMultiError(null); setMultiResult(null);
    try {
      const res = await fetch(`${API}/simulator/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ areas: areas.map(a => ({ ...a, occupancy_percent: Number(a.occupancy_percent), traffic_volume: Number(a.traffic_volume), capacity: Number(a.capacity) })) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Multi-area simulation failed');
      setMultiResult(data);
    } catch (e) { setMultiError(e.message); }
    finally { setMultiLoading(false); }
  }

  async function runPolicy() {
    setPolicyLoading(true); setPolicyError(null); setPolicyResult(null);
    try {
      const res = await fetch(`${API}/simulator/policy-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policy_type: policy.type,
          current_state: { occupancy_percent: Number(policy.occupancy), traffic_volume: Number(policy.traffic), violations: { count: Number(policy.violations) }, capacity: Number(policy.capacity) },
          policy_params: { [selectedPolicy.paramKey]: Number(policy.paramVal) },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Policy test failed');
      setPolicyResult(data);
    } catch (e) { setPolicyError(e.message); }
    finally { setPolicyLoading(false); }
  }

  function updateArea(i, field, val) {
    setAreas(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: val } : a));
  }
  function addArea() {
    setAreas(prev => [...prev, { area: `Zone ${prev.length + 1}`, occupancy_percent: 50, traffic_volume: 80, capacity: 100 }]);
  }
  function removeArea(i) {
    setAreas(prev => prev.filter((_, idx) => idx !== i));
  }

  const inputCls = "w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition shadow-sm";
  const labelCls = "block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider";

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shadow-sm">
              <HiLightningBolt className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Policy Simulator</h1>
              <p className="text-gray-500 text-sm">Simulate parking policy changes and predict outcomes</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-[10px] font-bold text-blue-600 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Rule-based engine — ML integration ready
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-200/50 rounded-xl p-1 mb-8 w-fit border border-gray-200 shadow-sm">
          {[
            ['single', 'Single Area', <FaPlay className="text-[10px]" />], 
            ['multi', 'Multi-Area', <HiCollection className="text-lg" />], 
            ['policy', 'Policy Test', <HiBeaker className="text-lg" />]
          ].map(([v, l, icon]) => (
            <button key={v} onClick={() => setTab(v)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${tab === v ? 'bg-white text-blue-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700'}`}>
              {icon}
              {l}
            </button>
          ))}
        </div>

        {/* ── SINGLE AREA TAB ── */}
        {tab === 'single' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
              <h2 className="text-sm font-bold text-gray-700">Area Parameters</h2>
              <div>
                <label className={labelCls}>Area Name</label>
                <input className={inputCls} value={single.area} onChange={e => setSingle(s => ({ ...s, area: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Occupancy %</label>
                  <input type="number" min="0" max="100" className={inputCls} value={single.occupancy}
                    onChange={e => setSingle(s => ({ ...s, occupancy: e.target.value }))} />
                  <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-blue-500 transition-all shadow-sm shadow-blue-200" style={{ width: `${single.occupancy}%` }} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Traffic Volume</label>
                  <input type="number" min="0" className={inputCls} value={single.traffic}
                    onChange={e => setSingle(s => ({ ...s, traffic: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Violations</label>
                  <input type="number" min="0" className={inputCls} value={single.violations}
                    onChange={e => setSingle(s => ({ ...s, violations: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Capacity</label>
                  <input type="number" min="1" className={inputCls} value={single.capacity}
                    onChange={e => setSingle(s => ({ ...s, capacity: e.target.value }))} />
                </div>
              </div>
              {singleError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-3 font-medium">{singleError}</p>}
              <button onClick={runSingle} disabled={singleLoading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400 rounded-xl text-sm font-bold text-white transition-all shadow-lg shadow-blue-600/20 active:scale-95 flex items-center justify-center gap-2">
                {singleLoading ? (
                  <HiRefresh className="animate-spin text-lg" />
                ) : (
                  <HiPlay className="text-lg" />
                )}
                {singleLoading ? 'Running...' : 'Run Simulation'}
              </button>
            </div>
            <div>
              <ResultPanel result={singleResult} loading={singleLoading} title="Simulation Result" />
              {!singleLoading && !singleResult && !singleError && (
                <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-12 flex items-center justify-center h-full">
                  <div className="text-center">
                    <HiDocumentReport className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                    <p className="text-sm font-medium text-gray-400">Configure parameters and run simulation</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MULTI AREA TAB ── */}
        {tab === 'multi' && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-700">Areas Configuration</h2>
                <button onClick={addArea} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold rounded-lg transition border border-gray-200 uppercase tracking-widest">
                  + Add Area
                </button>
              </div>
              <div className="space-y-3">
                {areas.map((a, i) => (
                  <div key={i} className="grid grid-cols-5 gap-3 items-end bg-gray-50 border border-gray-100 rounded-lg p-3">
                    <div>
                      <label className={labelCls}>Area Name</label>
                      <input className={inputCls} value={a.area} onChange={e => updateArea(i, 'area', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Occupancy %</label>
                      <input type="number" min="0" max="100" className={inputCls} value={a.occupancy_percent} onChange={e => updateArea(i, 'occupancy_percent', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Traffic</label>
                      <input type="number" min="0" className={inputCls} value={a.traffic_volume} onChange={e => updateArea(i, 'traffic_volume', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Capacity</label>
                      <input type="number" min="1" className={inputCls} value={a.capacity} onChange={e => updateArea(i, 'capacity', e.target.value)} />
                    </div>
                    <button onClick={() => removeArea(i)} className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-lg text-xs font-bold transition uppercase">✕</button>
                  </div>
                ))}
              </div>
              {multiError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-3 mt-3 font-medium">{multiError}</p>}
              <button onClick={runMulti} disabled={multiLoading}
                className="mt-4 w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400 rounded-xl text-sm font-bold text-white transition-all shadow-lg shadow-blue-600/20 active:scale-95 flex items-center justify-center gap-2">
                {multiLoading ? <HiRefresh className="animate-spin text-lg" /> : <HiPlay className="text-lg" />}
                {multiLoading ? 'Analyzing…' : 'Run Multi-Area Simulation'}
              </button>
            </div>

            {multiLoading && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <SkeletonBlock h="h-20" />
                  <SkeletonBlock h="h-20" />
                  <SkeletonBlock h="h-20" />
                  <SkeletonBlock h="h-20" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <SkeletonBlock h="h-64" />
                  <SkeletonBlock h="h-64" />
                  <SkeletonBlock h="h-64" />
                </div>
              </div>
            )}

            {!multiLoading && multiResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    ['System Status', multiResult.status, multiResult.status],
                    ['Areas Analyzed', multiResult.areas_analyzed, null],
                    ['Critical Areas', multiResult.summary?.critical_count, 'critical'],
                    ['Efficiency', `${Math.round((multiResult.efficiency_score || 0) * 100)}%`, null],
                  ].map(([label, val, level]) => (
                    <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                      <p className="text-[10px] font-black text-gray-400 mb-1 uppercase tracking-widest">{label}</p>
                      {level ? <Badge level={String(val).toLowerCase()} /> : <p className="text-xl font-black text-gray-900">{val}</p>}
                    </div>
                  ))}
                </div>
                {multiResult.reroute_suggestions && multiResult.reroute_suggestions.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                    <p className="text-xs font-black text-green-600 mb-3 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500" /> 🔀 Reroute Suggestions
                    </p>
                    {multiResult.reroute_suggestions.map((s, i) => (
                      <p key={i} className="text-xs font-medium text-gray-600 bg-gray-50 border border-gray-100 rounded p-2 mb-1">• {s.message}</p>
                    ))}
                  </div>
                )}
                {multiResult.area_results && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {multiResult.area_results.map((r, i) => (
                      <ResultPanel key={i} result={r} title={r.area} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── POLICY TEST TAB ── */}
        {tab === 'policy' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
              <h2 className="text-sm font-bold text-gray-700">Policy Configuration</h2>
              <div>
                <label className={labelCls}>Policy Type</label>
                <select className={inputCls} value={policy.type} onChange={e => { const pt = POLICY_TYPES.find(p => p.value === e.target.value); setPolicy(p => ({ ...p, type: e.target.value, paramVal: pt?.defaultVal || 20 })); }}>
                  {POLICY_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>{selectedPolicy.paramLabel}</label>
                <input type="number" className={inputCls} value={policy.paramVal} onChange={e => setPolicy(p => ({ ...p, paramVal: e.target.value }))} />
              </div>
              <p className="text-[10px] font-black text-gray-400 pt-4 border-t border-gray-100 uppercase tracking-widest">Current System State</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Occupancy %</label>
                  <input type="number" min="0" max="100" className={inputCls} value={policy.occupancy} onChange={e => setPolicy(p => ({ ...p, occupancy: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Traffic Volume</label>
                  <input type="number" min="0" className={inputCls} value={policy.traffic} onChange={e => setPolicy(p => ({ ...p, traffic: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Violations</label>
                  <input type="number" min="0" className={inputCls} value={policy.violations} onChange={e => setPolicy(p => ({ ...p, violations: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Capacity</label>
                  <input type="number" min="1" className={inputCls} value={policy.capacity} onChange={e => setPolicy(p => ({ ...p, capacity: e.target.value }))} />
                </div>
              </div>
              {policyError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-3 font-medium">{policyError}</p>}
              <button onClick={runPolicy} disabled={policyLoading}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-100 disabled:text-gray-400 rounded-xl text-sm font-bold text-white transition-all shadow-lg shadow-purple-600/20 active:scale-95 flex items-center justify-center gap-2">
                {policyLoading ? <HiRefresh className="animate-spin text-lg" /> : <HiBeaker className="text-lg" />}
                {policyLoading ? 'Simulating…' : 'Test Policy'}
              </button>
            </div>
            <div>
              <PolicyResultPanel result={policyResult} loading={policyLoading} />
              {!policyLoading && !policyResult && !policyError && (
                <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-12 flex items-center justify-center h-full">
                  <div className="text-center">
                    <svg className="w-12 h-12 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.183.244l-.28.14a2 2 0 01-2.983-1.232l-.127-.508a2 2 0 01.31-1.638l1.373-2.06a2 2 0 00.31-1.638l-.127-.508a2 2 0 012.983-1.232l.28.14a2 2 0 001.183.244l1.933-.387a6 6 0 013.86-.517l.318-.158a6 6 0 003.86-.517l2.387.477a2 2 0 001.022.547l.484.242a2 2 0 011.132 1.132l.242.484a2 2 0 00.547 1.022l.477 2.387a2 2 0 01-.517 3.86l-.158.318a6 6 0 00-.517 3.86l.477 2.387a2 2 0 01-1.132 1.132l-.484-.242a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.183.244l-.28.14a2 2 0 01-2.983-1.232l-.127-.508a2 2 0 01.31-1.638l1.373-2.06a2 2 0 00.31-1.638l-.127-.508a2 2 0 012.983-1.232l.28.14a2 2 0 001.183.244l1.933-.387a6 6 0 013.86-.517l.318-.158a6 6 0 003.86-.517l2.387.477a2 2 0 001.022.547l.484.242a2 2 0 011.132 1.132l.242.484a2 2 0 00.547 1.022l.477 2.387a2 2 0 01-.517 3.86l-.158.318a6 6 0 00-.517 3.86l.477 2.387a2 2 0 01-1.132 1.132l-.484-.242a2 2 0 00-1.022-.547z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                    <p className="text-sm font-medium text-gray-400">Select a policy type and run test</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

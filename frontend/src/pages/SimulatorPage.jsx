import { useState } from 'react';

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
    critical: 'bg-red-100 text-red-700 border border-red-200',
    high: 'bg-orange-100 text-orange-700 border border-orange-200',
    warning: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
    medium: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
    low: 'bg-green-100 text-green-700 border border-green-200',
    none: 'bg-gray-100 text-gray-600 border border-gray-200',
    ok: 'bg-blue-100 text-blue-700 border border-blue-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${map[level] || map.none}`}>
      {level}
    </span>
  );
}

function ScoreBar({ score }) {
  const pct = Math.round((score || 0) * 100);
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>Efficiency Score</span>
        <span className="font-bold text-white">{pct}%</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ResultPanel({ result, title }) {
  if (!result) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-slate-300">{title}</h3>

      {result.analysis && (
        <div className="grid grid-cols-2 gap-3">
          {[
            ['Occupancy', result.analysis.occupancy_status || result.analysis.occupancy_severity],
            ['Traffic', result.analysis.traffic_status],
            ['Violations', result.analysis.violation_status],
            ['Occupancy %', result.analysis.occupancy_percent != null ? `${result.analysis.occupancy_percent}%` : null],
          ].filter(([, v]) => v != null).map(([k, v]) => (
            <div key={k} className="bg-slate-700/50 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-1">{k}</p>
              <Badge level={String(v).toLowerCase()} />
            </div>
          ))}
        </div>
      )}

      {result.efficiency_score != null && <ScoreBar score={result.efficiency_score} />}

      {result.bottlenecks && result.bottlenecks.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-red-400 mb-2">⚠ Bottlenecks Detected</p>
          {result.bottlenecks.map((b, i) => (
            <div key={i} className="bg-red-900/20 border border-red-800/40 rounded-lg p-3 mb-2">
              <p className="text-xs text-red-300 font-medium">{b.area} — <Badge level={b.level} /></p>
              {b.reasons && b.reasons.map((r, j) => (
                <p key={j} className="text-xs text-slate-400 mt-1">• {r}</p>
              ))}
            </div>
          ))}
        </div>
      )}

      {result.suggestions && result.suggestions.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-blue-400 mb-2">💡 Suggestions</p>
          {result.suggestions.map((s, i) => (
            <p key={i} className="text-xs text-slate-300 bg-slate-700/40 rounded p-2 mb-1">• {s}</p>
          ))}
        </div>
      )}

      {result.reroute && result.reroute.alternatives && result.reroute.alternatives.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-green-400 mb-2">🔀 Reroute Alternatives</p>
          {result.reroute.alternatives.map((a, i) => (
            <div key={i} className="flex items-center justify-between bg-green-900/20 border border-green-800/30 rounded p-2 mb-1">
              <span className="text-xs text-slate-300">{a.area}</span>
              <span className="text-xs text-green-400">{a.occupancy}% • {a.recommendation}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PolicyResultPanel({ result }) {
  if (!result) return null;
  const diff = result.efficiency_change;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-slate-300">Policy Simulation Result</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-700/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Before Occupancy</p>
          <p className="text-lg font-bold text-white">{result.current_state?.occupancy_percent ?? '—'}%</p>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">After Occupancy</p>
          <p className="text-lg font-bold text-blue-400">{result.simulated_state?.occupancy_percent ?? '—'}%</p>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Before Violations</p>
          <p className="text-lg font-bold text-white">{result.current_state?.violations ?? '—'}</p>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">After Violations</p>
          <p className="text-lg font-bold text-blue-400">{result.simulated_state?.violations ?? '—'}</p>
        </div>
      </div>

      {result.efficiency_score != null && <ScoreBar score={result.efficiency_score} />}

      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">Efficiency Change:</span>
        <span className={`text-sm font-bold ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {diff >= 0 ? '+' : ''}{(diff * 100).toFixed(1)}%
        </span>
      </div>

      {result.actions && result.actions.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-purple-400 mb-2">📋 Policy Effects</p>
          {result.actions.map((a, i) => (
            <p key={i} className="text-xs text-slate-300 bg-slate-700/40 rounded p-2 mb-1">• {a}</p>
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

  const inputCls = "w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition";
  const labelCls = "block text-xs font-medium text-slate-400 mb-1";

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Policy Simulator</h1>
              <p className="text-slate-400 text-sm">Simulate parking policy changes and predict outcomes</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-900/30 border border-blue-700/40 rounded-full text-xs text-blue-400">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Rule-based engine — ML integration ready
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-800 rounded-xl p-1 mb-8 w-fit border border-slate-700">
          {[['single', 'Single Area'], ['multi', 'Multi-Area'], ['policy', 'Policy Test']].map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${tab === v ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:text-white'}`}>
              {l}
            </button>
          ))}
        </div>

        {/* ── SINGLE AREA TAB ── */}
        {tab === 'single' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
              <h2 className="text-sm font-semibold text-slate-300">Area Parameters</h2>
              <div>
                <label className={labelCls}>Area Name</label>
                <input className={inputCls} value={single.area} onChange={e => setSingle(s => ({ ...s, area: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Occupancy %</label>
                  <input type="number" min="0" max="100" className={inputCls} value={single.occupancy}
                    onChange={e => setSingle(s => ({ ...s, occupancy: e.target.value }))} />
                  <div className="mt-1 w-full bg-slate-700 rounded-full h-1">
                    <div className="h-1 rounded-full bg-blue-500 transition-all" style={{ width: `${single.occupancy}%` }} />
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
              {singleError && <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg p-3">{singleError}</p>}
              <button onClick={runSingle} disabled={singleLoading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-900/30">
                {singleLoading ? '⏳ Running...' : '▶ Run Simulation'}
              </button>
            </div>
            <div>
              {singleLoading && (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-slate-400">Running simulation…</p>
                  </div>
                </div>
              )}
              {!singleLoading && <ResultPanel result={singleResult} title="Simulation Result" />}
              {!singleLoading && !singleResult && !singleError && (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 flex items-center justify-center h-full">
                  <p className="text-sm text-slate-500">Configure parameters and run simulation</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MULTI AREA TAB ── */}
        {tab === 'multi' && (
          <div className="space-y-6">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-300">Areas Configuration</h2>
                <button onClick={addArea} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg transition">
                  + Add Area
                </button>
              </div>
              <div className="space-y-3">
                {areas.map((a, i) => (
                  <div key={i} className="grid grid-cols-5 gap-3 items-end bg-slate-700/40 rounded-lg p-3">
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
                    <button onClick={() => removeArea(i)} className="py-2 px-3 bg-red-900/30 hover:bg-red-900/60 text-red-400 rounded-lg text-xs transition">✕</button>
                  </div>
                ))}
              </div>
              {multiError && <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg p-3 mt-3">{multiError}</p>}
              <button onClick={runMulti} disabled={multiLoading}
                className="mt-4 w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-xl text-sm font-semibold transition-all">
                {multiLoading ? '⏳ Analyzing…' : '▶ Run Multi-Area Simulation'}
              </button>
            </div>

            {multiResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    ['System Status', multiResult.status, multiResult.status],
                    ['Areas Analyzed', multiResult.areas_analyzed, null],
                    ['Critical Areas', multiResult.summary?.critical_count, 'critical'],
                    ['Efficiency', `${Math.round((multiResult.efficiency_score || 0) * 100)}%`, null],
                  ].map(([label, val, level]) => (
                    <div key={label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                      <p className="text-xs text-slate-400 mb-1">{label}</p>
                      {level ? <Badge level={String(val).toLowerCase()} /> : <p className="text-xl font-bold text-white">{val}</p>}
                    </div>
                  ))}
                </div>
                {multiResult.reroute_suggestions && multiResult.reroute_suggestions.length > 0 && (
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                    <p className="text-xs font-semibold text-green-400 mb-3">🔀 Reroute Suggestions</p>
                    {multiResult.reroute_suggestions.map((s, i) => (
                      <p key={i} className="text-xs text-slate-300 bg-slate-700/40 rounded p-2 mb-1">• {s.message}</p>
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
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
              <h2 className="text-sm font-semibold text-slate-300">Policy Configuration</h2>
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
              <p className="text-xs font-semibold text-slate-400 pt-2 border-t border-slate-700">Current System State</p>
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
              {policyError && <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg p-3">{policyError}</p>}
              <button onClick={runPolicy} disabled={policyLoading}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-xl text-sm font-semibold transition-all">
                {policyLoading ? '⏳ Simulating…' : '🔬 Test Policy'}
              </button>
            </div>
            <div>
              {policyLoading && (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {!policyLoading && <PolicyResultPanel result={policyResult} />}
              {!policyLoading && !policyResult && !policyError && (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 flex items-center justify-center h-full">
                  <p className="text-sm text-slate-500">Select a policy type and run test</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

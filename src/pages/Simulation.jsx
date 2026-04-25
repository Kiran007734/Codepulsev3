import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import SkeletonLoader from '../components/SkeletonLoader';

const API_BASE = import.meta.env.PROD
  ? `${import.meta.env.VITE_API_BASE_URL || 'https://vasanth-sjr-codepulse-api.hf.space'}/api`
  : '/api';

export default function Simulation() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [scenario, setScenario] = useState('dev_leaves');
  const [devName, setDevName] = useState('');
  const [reqTitle, setReqTitle] = useState('');
  const [complexity, setComplexity] = useState('medium');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  /* Fetch simulation history on mount */
  useEffect(() => {
    fetch(`${API_BASE}/simulation/history`)
      .then(r => r.json())
      .then(d => { setHistory(d.history || []); setHistoryLoading(false); })
      .catch(() => { setHistoryLoading(false); });
  }, []);

  const runSimulation = async () => {
    setRunning(true);
    setResult(null);
    try {
      const body = { scenario };
      if (scenario === 'dev_leaves') body.dev_name = devName;
      if (scenario === 'new_requirement') {
        body.requirement_title = reqTitle;
        body.complexity = complexity;
      }
      const res = await fetch(`${API_BASE}/simulation/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setResult(data);
      // Refresh history
      const hRes = await fetch(`${API_BASE}/simulation/history`);
      const hData = await hRes.json();
      setHistory(hData.history || []);
    } catch (e) {
      setResult({ error: true, message: e.message });
    }
    setRunning(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold t-primary">Crisis Scenario Simulator</h1>
        <p className="text-sm t-muted mt-1">Run "what-if" scenarios on real sprint data to assess impact</p>
      </div>

      {/* Scenario Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-0 animate-slide-up stagger-1">
        <button
          onClick={() => setScenario('dev_leaves')}
          className={`glass-card p-5 text-left transition-all duration-200 border-2 ${
            scenario === 'dev_leaves'
              ? isDark ? '!border-emerald-500/40 !bg-emerald-500/5' : '!border-green-400 !bg-green-50'
              : 'border-transparent'
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🚪</span>
            <h3 className="text-sm font-semibold t-primary">Developer Leaves</h3>
          </div>
          <p className="text-xs t-muted">Simulate a team member leaving mid-sprint. See impact on all tickets and get reassignment suggestions.</p>
        </button>

        <button
          onClick={() => setScenario('new_requirement')}
          className={`glass-card p-5 text-left transition-all duration-200 border-2 ${
            scenario === 'new_requirement'
              ? isDark ? '!border-emerald-500/40 !bg-emerald-500/5' : '!border-green-400 !bg-green-50'
              : 'border-transparent'
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">📝</span>
            <h3 className="text-sm font-semibold t-primary">New Requirement</h3>
          </div>
          <p className="text-xs t-muted">Add a last-minute requirement and see how it affects existing delivery probabilities.</p>
        </button>
      </div>

      {/* Parameters */}
      <div className="glass-card p-5 opacity-0 animate-slide-up stagger-2">
        <h3 className="text-sm font-semibold t-primary mb-4">⚙️ Scenario Parameters</h3>

        {scenario === 'dev_leaves' ? (
          <div>
            <label className="block text-xs t-muted mb-1.5">Developer Name (GitHub login)</label>
            <input
              type="text"
              value={devName}
              onChange={e => setDevName(e.target.value)}
              placeholder="e.g. alex-dev"
              className={`w-full max-w-md px-3 py-2 rounded-lg text-sm border transition-colors ${
                isDark
                  ? 'bg-dark-700 border-white/10 text-slate-200 focus:border-emerald-500/50 placeholder:text-slate-600'
                  : 'bg-white border-gray-200 text-gray-800 focus:border-green-400 placeholder:text-gray-400'
              } outline-none`}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs t-muted mb-1.5">Requirement Title</label>
              <input
                type="text"
                value={reqTitle}
                onChange={e => setReqTitle(e.target.value)}
                placeholder="e.g. Add SSO authentication"
                className={`w-full max-w-md px-3 py-2 rounded-lg text-sm border transition-colors ${
                  isDark
                    ? 'bg-dark-700 border-white/10 text-slate-200 focus:border-emerald-500/50 placeholder:text-slate-600'
                    : 'bg-white border-gray-200 text-gray-800 focus:border-green-400 placeholder:text-gray-400'
                } outline-none`}
              />
            </div>
            <div>
              <label className="block text-xs t-muted mb-1.5">Complexity</label>
              <div className="flex gap-2">
                {['low', 'medium', 'high'].map(c => (
                  <button
                    key={c}
                    onClick={() => setComplexity(c)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      complexity === c
                        ? isDark ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-green-50 text-green-700 border-green-300'
                        : isDark ? 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <button
          onClick={runSimulation}
          disabled={running || (scenario === 'dev_leaves' && !devName) || (scenario === 'new_requirement' && !reqTitle)}
          className={`mt-5 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
            running
              ? 'opacity-50 cursor-not-allowed'
              : isDark
              ? 'bg-gradient-to-r from-emerald-600 to-green-700 text-white hover:from-emerald-500 hover:to-green-600 shadow-lg shadow-emerald-500/20'
              : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-400 hover:to-emerald-500 shadow-md'
          }`}
        >
          {running ? '⏳ Running Simulation…' : '🧪 Run Simulation'}
        </button>
      </div>

      {/* Results */}
      {result && !result.error && (
        <div className="space-y-4 opacity-0 animate-slide-up stagger-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold t-primary">📊 Simulation Results</h2>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-green-50 text-green-600 border border-green-200'}`}>
              {result.scenario_applied?.replace(/_/g, ' ')}
            </span>
          </div>

          {/* Risk Score Changes */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold t-primary mb-3">Risk Score Impact</h3>
            <div className="space-y-2">
              {(result.recalculated_risk_scores || []).map((r, i) => (
                <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg ${isDark ? 'bg-white/3' : 'bg-gray-50'}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium t-primary truncate">{r.ticket_id} — {r.title}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs t-muted">{r.old_probability}%</span>
                    <span className="text-xs t-faint">→</span>
                    <span className={`text-xs font-bold ${r.new_probability >= 70 ? 'text-emerald-400' : r.new_probability >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {r.new_probability}%
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      r.delta > 0 ? 'bg-emerald-500/10 text-emerald-400'
                      : r.delta < 0 ? 'bg-red-500/10 text-red-400'
                      : 'bg-gray-500/10 text-gray-400'
                    }`}>
                      {r.delta > 0 ? `+${r.delta}` : r.delta}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Proposed Reassignments */}
          {(result.proposed_distribution || []).length > 0 && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold t-primary mb-3">🔄 Proposed Reassignments</h3>
              <div className="space-y-2">
                {result.proposed_distribution.map((p, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${isDark ? 'border-white/5 bg-white/3' : 'border-gray-100 bg-gray-50'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium t-primary">{p.ticket_id} → {p.assigned_to || 'Unassigned'}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.skill_match_score >= 60 ? 'badge-low' : 'badge-medium'}`}>
                        {p.skill_match_score}% match
                      </span>
                    </div>
                    <p className="text-[10px] t-muted">{p.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New Flags */}
          {(result.new_flags || []).length > 0 && (
            <div className={`glass-card p-5 border ${isDark ? '!border-red-500/20 !bg-red-500/5' : '!border-red-200 !bg-red-50'}`}>
              <h3 className="text-sm font-semibold t-primary mb-2">🚩 New Flags Triggered</h3>
              {result.new_flags.map((f, i) => (
                <p key={i} className="text-xs t-secondary mb-1">• {f.flag?.replace(/_/g, ' ')} — {f.ticket_id || f.dev || f.file_path || ''}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {result?.error && (
        <div className={`glass-card p-5 border ${isDark ? '!border-red-500/20' : '!border-red-200'}`}>
          <p className="text-sm text-red-400">❌ {result.message}</p>
        </div>
      )}

      {/* Simulation History */}
      <div className="opacity-0 animate-slide-up stagger-6">
        <h2 className="text-lg font-semibold t-primary mb-3">📜 Simulation History</h2>
        {historyLoading ? (
          <SkeletonLoader />
        ) : history.length === 0 ? (
          <div className={`glass-card p-6 text-center ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
            <p className="text-sm">No simulations run yet. Try one above!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 10).map((h, i) => (
              <div key={i} className={`glass-card p-3 flex items-center justify-between ${isDark ? '' : ''}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg">{h.scenario === 'dev_leaves' ? '🚪' : '📝'}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium t-primary truncate">{h.scenario?.replace(/_/g, ' ')}</p>
                    <p className="text-[10px] t-faint">{h.ran_at ? new Date(h.ran_at).toLocaleString() : '–'}</p>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${isDark ? 'bg-white/5 text-slate-400' : 'bg-gray-100 text-gray-600'}`}>
                  {h.simulation_id?.slice(0, 8)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useTheme } from '../context/ThemeContext';
import SkeletonLoader from '../components/SkeletonLoader';

const capacityColors = {
  overloaded: { dot: 'bg-red-500', text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'Overloaded' },
  warning: { dot: 'bg-yellow-500', text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', label: 'Warning' },
  ok: { dot: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Available' },
};

const DONUT_COLORS = ['#22C55E', '#EAB308', '#EF4444'];

const API_BASE = import.meta.env.PROD
  ? `${import.meta.env.VITE_API_BASE_URL || 'https://vasanth-sjr-codepulse-api.hf.space'}/api`
  : '/api';

export default function ManagerDashboard() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [triggerStatus, setTriggerStatus] = useState(null);
  const [downloading, setDownloading] = useState(false);

  // ── Email Report state ────────────────────────────────────────────────────
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');
  const [sendStatus, setSendStatus] = useState(null); // null | 'sending' | 'success' | 'error'
  const [sendMsg, setSendMsg] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/dashboard/manager`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError('Failed to load manager dashboard'); setLoading(false); });
  }, []);

  const handleTriggerReport = async () => {
    setTriggerStatus('sending');
    try {
      const res = await fetch(`${API_BASE}/reports/trigger`);
      const d = await res.json();
      setTriggerStatus(d.triggered ? 'sent' : 'failed');
    } catch { setTriggerStatus('failed'); }
    setTimeout(() => setTriggerStatus(null), 3000);
  };

  // ── Email validation & send ───────────────────────────────────────────────
  const isValidEmail = (addr) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr.trim());

  const handleEmailChange = (e) => {
    setEmailInput(e.target.value);
    setEmailError(e.target.value && !isValidEmail(e.target.value) ? 'Enter a valid email address' : '');
  };

  const handleSendReport = async () => {
    if (!isValidEmail(emailInput)) {
      setEmailError('Enter a valid email address');
      return;
    }
    setSendStatus('sending');
    setSendMsg('');
    try {
      const res = await fetch(`${API_BASE}/send-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Failed to send report');
      setSendStatus('success');
      setSendMsg(`Report sent to ${emailInput.trim()}`);
      setEmailInput('');
    } catch (err) {
      setSendStatus('error');
      setSendMsg(err.message || 'Failed to send report. Please try again.');
    } finally {
      setTimeout(() => { setSendStatus(null); setSendMsg(''); }, 5000);
    }
  };

  const handleDownloadReport = async () => {
    setDownloading(true);
    try {
      const response = await fetch(`${API_BASE}/report/download`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CodePulse_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError('Failed to generate report. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <SkeletonLoader />;
  if (error || !data) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold t-primary">Manager Command Center</h1>
        <div className={`glass-card p-8 text-center ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          <p className="text-4xl mb-4">📊</p>
          <p className="text-lg font-medium t-primary mb-2">No Data Available</p>
          <p className="text-sm">{error || 'Configure Jira + GitHub to enable the manager view.'}</p>
        </div>
      </div>
    );
  }

  const ss = data.sprint_summary || {};
  const donutData = [
    { name: 'On Track', value: ss.on_track || 0 },
    { name: 'At Risk', value: ss.at_risk || 0 },
    { name: 'Critical', value: ss.critical || 0 },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Header + Actions */}
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold t-primary">Manager Command Center</h1>
          <p className="text-sm t-muted mt-1">{data.sprint?.name || 'Sprint'} · {data.sprint?.days_remaining ?? '–'} days remaining</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDownloadReport}
            disabled={downloading}
            className={`text-xs font-medium px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
              downloading
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : isDark
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20'
                : 'bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100'
            }`}
          >
            {downloading ? '⏳ Generating…' : '📄 Download PDF'}
          </button>
          <button
            onClick={handleTriggerReport}
            disabled={triggerStatus === 'sending'}
            className={`text-xs font-medium px-4 py-2 rounded-lg transition-all duration-200 ${
              triggerStatus === 'sent'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : triggerStatus === 'failed'
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : isDark
                ? 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            {triggerStatus === 'sending' ? '⏳ Sending…' : triggerStatus === 'sent' ? '✅ Report Sent' : triggerStatus === 'failed' ? '❌ Failed' : '📤 Trigger Report'}
          </button>
        </div>
      </div>

      {/* ── Email Report Row ─────────────────────────────────────────────── */}
      <div className="animate-fade-in">
        <div className={`flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3 rounded-xl border ${isDark ? 'bg-white/3 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
          <span className="text-sm flex-shrink-0 t-muted">📧 Email Report:</span>
          <div className="flex flex-1 gap-2 w-full sm:w-auto">
            <div className="flex-1 relative">
              <input
                id="email-report-input"
                type="email"
                value={emailInput}
                onChange={handleEmailChange}
                placeholder="recipient@example.com"
                disabled={sendStatus === 'sending'}
                className={`w-full text-xs px-3 py-2 rounded-lg border outline-none transition-all duration-200
                  ${isDark
                    ? 'bg-white/5 text-slate-200 placeholder-slate-500 border-white/10 focus:border-blue-500/50 focus:bg-white/10'
                    : 'bg-white text-gray-800 placeholder-gray-400 border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100'
                  }
                  ${emailError ? (isDark ? 'border-red-500/50' : 'border-red-400') : ''}
                  ${sendStatus === 'sending' ? 'opacity-60 cursor-not-allowed' : ''}
                `}
              />
              {emailError && (
                <p className="absolute -bottom-4 left-0 text-[10px] text-red-400">{emailError}</p>
              )}
            </div>
            <button
              id="send-report-btn"
              onClick={handleSendReport}
              disabled={!emailInput || !!emailError || sendStatus === 'sending'}
              className={`text-xs font-medium px-4 py-2 rounded-lg transition-all duration-200 flex-shrink-0 flex items-center gap-1.5
                ${sendStatus === 'sending'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 cursor-not-allowed'
                  : !emailInput || !!emailError
                  ? isDark
                    ? 'bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed'
                    : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                  : isDark
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                }`}
            >
              {sendStatus === 'sending' ? (
                <><span className="animate-spin inline-block">⏳</span> Sending…</>
              ) : (
                <>✉️ Send Report</>
              )}
            </button>
          </div>
        </div>

        {/* Toast */}
        {sendStatus && sendStatus !== 'sending' && (
          <div className={`mt-2 px-4 py-2.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all duration-300 animate-fade-in
            ${sendStatus === 'success'
              ? isDark ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : isDark ? 'bg-red-500/15 text-red-300 border border-red-500/25' : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {sendStatus === 'success' ? '✅' : '❌'} {sendMsg}
          </div>
        )}
      </div>

      {/* Sprint Overview Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 opacity-0 animate-slide-up stagger-1">
        {/* Donut Chart */}
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="w-24 h-24 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donutData.length ? donutData : [{ name: 'Empty', value: 1 }]} cx="50%" cy="50%" innerRadius={28} outerRadius={42} dataKey="value" stroke="none">
                  {(donutData.length ? donutData : [{ name: 'Empty', value: 1 }]).map((_, i) => (
                    <Cell key={i} fill={donutData.length ? DONUT_COLORS[i] : (isDark ? '#1e293b' : '#E5E7EB')} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="text-xs t-muted font-medium uppercase tracking-wider mb-1">Sprint Health</p>
            <p className="text-3xl font-bold gradient-text">{ss.total_features || 0}</p>
            <p className="text-xs t-faint">Total Features</p>
          </div>
        </div>

        {/* Stats mini cards */}
        <div className="glass-card p-5 grid grid-cols-3 gap-3">
          {[
            { label: 'On Track', val: ss.on_track, color: 'text-emerald-400', emoji: '🟢' },
            { label: 'At Risk', val: ss.at_risk, color: 'text-yellow-400', emoji: '🟡' },
            { label: 'Critical', val: ss.critical, color: 'text-red-400', emoji: '🔴' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="text-lg mb-0.5">{s.emoji}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.val || 0}</p>
              <p className="text-[10px] t-faint">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Risk Flags summary */}
        <div className={`glass-card p-5 ${isDark ? '!bg-gradient-to-br !from-red-500/5 !to-orange-500/5' : ''}`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🚩</span>
            <p className="text-xs font-medium t-muted uppercase tracking-wider">Active Flags</p>
          </div>
          <p className="text-3xl font-bold t-primary">{(data.active_risk_flags || []).length}</p>
          <div className="mt-2 space-y-1">
            {(data.active_risk_flags || []).slice(0, 3).map((f, i) => (
              <p key={i} className="text-[10px] t-secondary truncate">• {f.flag?.replace(/_/g, ' ')} — {f.ticket_id || f.dev || ''}</p>
            ))}
          </div>
        </div>
      </div>

      {/* Team Load */}
      <div className="opacity-0 animate-slide-up stagger-3">
        <h2 className="text-lg font-semibold t-primary mb-3">👥 Team Load</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {(data.team_load || []).map((dev, i) => {
            const cap = capacityColors[dev.capacity_status] || capacityColors.ok;
            return (
              <div key={i} className={`glass-card p-4 border ${isDark ? cap.border : 'border-gray-200'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold ${dev.capacity_status === 'overloaded' ? 'bg-red-500' : dev.capacity_status === 'warning' ? 'bg-yellow-500' : 'bg-emerald-500'}`}>
                    {dev.dev?.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold t-primary truncate">{dev.dev}</p>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${cap.dot}`} />
                      <span className={`text-[10px] font-medium ${isDark ? cap.text : ''}`}>{cap.label}</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className={`rounded-md p-1.5 text-center ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                    <p className="font-bold t-primary">{dev.open_issues_count}</p>
                    <p className="t-faint">Open Issues</p>
                  </div>
                  <div className={`rounded-md p-1.5 text-center ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                    <p className="font-bold t-primary">{dev.overtime_commits_last_3_days}</p>
                    <p className="t-faint">OT (3d)</p>
                  </div>
                </div>
                {dev.modules_active?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {dev.modules_active.slice(0, 3).map(m => (
                      <span key={m} className={`text-[9px] px-1.5 py-0.5 rounded ${isDark ? 'bg-white/5 text-slate-400' : 'bg-gray-100 text-gray-600'}`}>{m}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Feature Grid */}
      {(data.features || []).length > 0 && (
        <div className="opacity-0 animate-slide-up stagger-5">
          <h2 className="text-lg font-semibold t-primary mb-3">🎯 Feature Delivery Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.features.map((f, i) => (
              <div key={i} className={`glass-card p-4 ${f.status === 'critical' ? 'pulse-red-border' : ''}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono t-muted">{f.id}</p>
                    <h3 className="text-sm font-semibold t-primary truncate">{f.title}</h3>
                  </div>
                  <span className={`text-xl flex-shrink-0 ml-2`}>{f.status === 'on_track' ? '🟢' : f.status === 'at_risk' ? '🟡' : '🔴'}</span>
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 h-2 rounded-full bar-bg overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${f.delivery_probability}%`,
                      backgroundColor: f.status === 'on_track' ? '#22C55E' : f.status === 'at_risk' ? '#EAB308' : '#EF4444',
                    }} />
                  </div>
                  <span className="text-xs font-bold t-primary">{f.delivery_probability}%</span>
                </div>
                {f.risk_factors?.length > 0 && (
                  <div className="text-[10px] t-muted space-y-0.5 mb-2">
                    {f.risk_factors.map((r, j) => <p key={j}>⚠ {r}</p>)}
                  </div>
                )}
                {f.top_interventions?.length > 0 && (
                  <div className={`text-[10px] p-2 rounded-md mt-1 ${isDark ? 'bg-accent-blue/5 border border-accent-blue/10' : 'bg-blue-50 border border-blue-100'}`}>
                    <p className="font-semibold text-accent-blue mb-0.5">💡 Recommended</p>
                    {f.top_interventions.map((intv, j) => (
                      <p key={j} className="t-secondary">{intv.type?.replace(/_/g, ' ')} → {intv.to_dev || 'scope adjustment'}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tech Debt */}
      {(data.tech_debt_hotspots || []).length > 0 && (
        <div className="opacity-0 animate-slide-up stagger-7">
          <h2 className="text-lg font-semibold t-primary mb-3">🏗️ Top Tech Debt Hotspots</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {data.tech_debt_hotspots.map((d, i) => (
              <div key={i} className="glass-card p-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-semibold t-primary capitalize">{d.module}</p>
                  <span className="text-xs font-bold gradient-text">{d.debt_score}/100</span>
                </div>
                <div className="w-full h-1.5 rounded-full bar-bg overflow-hidden">
                  <div className="h-full rounded-full" style={{
                    width: `${d.debt_score}%`,
                    backgroundColor: d.debt_score > 60 ? '#EF4444' : d.debt_score > 30 ? '#EAB308' : '#22C55E',
                  }} />
                </div>
                <p className="text-[10px] t-faint mt-1 capitalize">{d.risk_type?.replace(/_/g, ' ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

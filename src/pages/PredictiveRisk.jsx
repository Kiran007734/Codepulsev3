import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useTheme } from '../context/ThemeContext';
import SkeletonLoader from '../components/SkeletonLoader';

/* ─── Status helpers ─── */
const statusConfig = {
  on_track:  { label: 'On Track', emoji: '🟢', colorDark: 'text-emerald-400', colorLight: 'text-green-600', bgDark: 'bg-emerald-500/10', bgLight: 'bg-green-50', borderDark: 'border-emerald-500/20', borderLight: 'border-green-200', bar: '#22C55E' },
  at_risk:   { label: 'At Risk',  emoji: '🟡', colorDark: 'text-yellow-400',  colorLight: 'text-yellow-700', bgDark: 'bg-yellow-500/10',  bgLight: 'bg-yellow-50', borderDark: 'border-yellow-500/20',  borderLight: 'border-yellow-200', bar: '#EAB308' },
  critical:  { label: 'Critical', emoji: '🔴', colorDark: 'text-red-400',     colorLight: 'text-red-600',    bgDark: 'bg-red-500/10',     bgLight: 'bg-red-50',    borderDark: 'border-red-500/20',     borderLight: 'border-red-200', bar: '#EF4444' },
};

const debtTypeLabel = {
  repeated_rewrites: { icon: '🔄', label: 'Repeated Rewrites', color: 'text-red-400' },
  missing_tests: { icon: '🧪', label: 'Missing Tests', color: 'text-yellow-400' },
  rushed_code: { icon: '⚡', label: 'Rushed Code', color: 'text-orange-400' },
  low_risk: { icon: '✅', label: 'Low Risk', color: 'text-emerald-400' },
};

const flagLabels = {
  DELIVERY_AT_RISK: { icon: '🚨', bg: 'from-red-500/10 to-orange-500/10', border: 'border-red-500/20' },
  BURNOUT_AND_DELAY_PROBABLE: { icon: '🔥', bg: 'from-orange-500/10 to-yellow-500/10', border: 'border-orange-500/20' },
  REFACTORING_SPIRAL: { icon: '🌀', bg: 'from-purple-500/10 to-blue-500/10', border: 'border-purple-500/20' },
};

const API_BASE = import.meta.env.PROD
  ? `${import.meta.env.VITE_API_BASE_URL || 'https://vasanth-sjr-codepulse-api.hf.space'}/api`
  : '/api';

export default function PredictiveRisk() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [trajectories, setTrajectories] = useState([]);
  const [flags, setFlags] = useState([]);
  const [techDebt, setTechDebt] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/risk/trajectory`).then(r => r.json()).catch(() => ({ trajectories: [] })),
      fetch(`${API_BASE}/risk/flags`).then(r => r.json()).catch(() => ({ flags: [] })),
      fetch(`${API_BASE}/techdebt`).then(r => r.json()).catch(() => ({ tech_debt: [] })),
    ]).then(([trajData, flagData, debtData]) => {
      setTrajectories(trajData.trajectories || []);
      setFlags(flagData.flags || []);
      setTechDebt(debtData.tech_debt || []);
      setLoading(false);
    }).catch(() => {
      setError('Failed to load predictive risk data');
      setLoading(false);
    });
  }, []);

  if (loading) return <SkeletonLoader />;

  if (error) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold t-primary">Predictive Risk Intelligence</h1>
        <div className={`glass-card p-8 text-center ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          <p className="text-4xl mb-4">🎯</p>
          <p className="text-lg font-medium t-primary mb-2">No Data Available</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  /* ── Summary counts ── */
  const counts = { on_track: 0, at_risk: 0, critical: 0 };
  trajectories.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++; });

  /* ── Chart data ── */
  const chartData = trajectories.map(t => ({
    name: t.key || '–',
    probability: t.delivery_probability || 0,
    status: t.status,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold t-primary">Predictive Risk Intelligence</h1>
        <p className="text-sm t-muted mt-1">Real-time delivery probability & auto-triggered risk detection</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 opacity-0 animate-slide-up stagger-1">
        {Object.entries(counts).map(([key, count]) => {
          const cfg = statusConfig[key];
          return (
            <div key={key} className={`glass-card p-4 flex items-center gap-3 ${isDark ? cfg.bgDark : cfg.bgLight} border ${isDark ? cfg.borderDark : cfg.borderLight}`}>
              <span className="text-2xl">{cfg.emoji}</span>
              <div>
                <span className={`text-3xl font-bold ${isDark ? cfg.colorDark : cfg.colorLight}`}>{count}</span>
                <p className={`text-xs font-medium ${isDark ? cfg.colorDark : cfg.colorLight}`}>{cfg.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delivery Probability Chart */}
      {chartData.length > 0 && (
        <div className="glass-card p-6 opacity-0 animate-slide-up stagger-2">
          <h2 className="text-lg font-semibold t-primary mb-1">Delivery Probability by Ticket</h2>
          <p className="text-xs t-muted mb-5">Higher = more likely to ship on time</p>
          <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 42)}>
            <BarChart data={chartData} layout="vertical" barCategoryGap="20%">
              <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: isDark ? '#64748b' : '#6B7280', fontSize: 12 }} />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} tick={{ fill: isDark ? '#94a3b8' : '#4B5563', fontSize: 11 }} />
              <Tooltip
                content={({ active, payload }) => active && payload?.[0] ? (
                  <div className={`glass-card px-3 py-2 ${isDark ? '!bg-dark-800/95' : '!bg-white/95 shadow-lg'} border ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                    <p className="text-xs t-muted">{payload[0].payload.name}</p>
                    <p className="text-sm font-semibold t-primary">{payload[0].value}% delivery probability</p>
                  </div>
                ) : null}
              />
              <Bar dataKey="probability" radius={[0, 6, 6, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={statusConfig[entry.status]?.bar || '#3B82F6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {trajectories.map((t, i) => {
          const cfg = statusConfig[t.status] || statusConfig.on_track;
          return (
            <div key={t.key || i} className={`glass-card p-5 opacity-0 animate-slide-up stagger-${Math.min(i + 3, 8)} ${t.status === 'critical' ? 'pulse-red-border' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[10px] font-mono t-muted">{t.key}</p>
                  <h3 className="text-sm font-semibold t-primary mt-0.5 line-clamp-2">{t.summary}</h3>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${t.status === 'critical' ? 'badge-high' : t.status === 'at_risk' ? 'badge-medium' : 'badge-low'}`}>
                  {cfg.label}
                </span>
              </div>

              {/* Probability gauge */}
              <div className="mb-3">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="t-faint">Delivery Probability</span>
                  <span className={`font-bold ${isDark ? cfg.colorDark : cfg.colorLight}`}>{t.delivery_probability}%</span>
                </div>
                <div className="w-full h-2.5 rounded-full bar-bg overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${t.delivery_probability}%`, backgroundColor: cfg.bar }} />
                </div>
              </div>

              {/* Risk factors */}
              <div className="space-y-1.5">
                {t.velocity_decay > 0 && (
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                    <span className="t-muted">Velocity ↓{t.velocity_decay}%</span>
                  </div>
                )}
                {t.complexity_score > 30 && (
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                    <span className="t-muted">Complexity: {t.complexity_score}/100</span>
                  </div>
                )}
                {t.churn_score > 20 && (
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    <span className="t-muted">Churn: {t.churn_score}%</span>
                  </div>
                )}
              </div>

              {t.assignee && <p className="text-[10px] t-faint mt-3 pt-2 border-t border-theme">Assignee: {t.assignee}</p>}
            </div>
          );
        })}
      </div>

      {/* Active Risk Flags */}
      {flags.length > 0 && (
        <div className="space-y-3 opacity-0 animate-slide-up stagger-7">
          <h2 className="text-lg font-semibold t-primary flex items-center gap-2">
            🚩 Active Risk Flags
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-red-500/15 text-red-400' : 'bg-red-50 text-red-600'}`}>{flags.length}</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {flags.map((flag, i) => {
              const style = flagLabels[flag.flag] || flagLabels.DELIVERY_AT_RISK;
              return (
                <div key={i} className={`glass-card p-4 border ${isDark ? style.border : 'border-gray-200'} ${isDark ? `!bg-gradient-to-r !${style.bg}` : ''}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{style.icon}</span>
                    <span className="text-xs font-bold t-primary">{flag.flag?.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="text-xs t-secondary leading-relaxed">
                    {flag.ticket_id && <><strong>{flag.ticket_id}</strong> — </>}
                    {flag.ticket_title || flag.file_path || flag.dev || ''}
                    {flag.velocity_decay_percent && <> · Velocity ↓{flag.velocity_decay_percent}%</>}
                    {flag.overtime_days && <> · {flag.overtime_days} overtime days</>}
                    {flag.modification_count && <> · {flag.modification_count} modifications</>}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tech Debt Hotspots */}
      {techDebt.length > 0 && (
        <div className="opacity-0 animate-slide-up stagger-8">
          <h2 className="text-lg font-semibold t-primary mb-3">🏗️ Tech Debt Hotspots</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {techDebt.slice(0, 6).map((d, i) => {
              const typeInfo = debtTypeLabel[d.risk_type] || debtTypeLabel.low_risk;
              return (
                <div key={i} className="glass-card p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-semibold t-primary capitalize">{d.module}</h3>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${d.debt_score > 60 ? 'badge-high' : d.debt_score > 30 ? 'badge-medium' : 'badge-low'}`}>
                      {typeInfo.icon} {typeInfo.label}
                    </span>
                  </div>
                  <div className="mb-2">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="t-faint">Debt Score</span>
                      <span className="font-bold t-primary">{d.debt_score}/100</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bar-bg overflow-hidden">
                      <div className="h-full rounded-full" style={{
                        width: `${d.debt_score}%`,
                        backgroundColor: d.debt_score > 60 ? '#EF4444' : d.debt_score > 30 ? '#EAB308' : '#22C55E',
                      }} />
                    </div>
                  </div>
                  <div className="text-[10px] t-muted space-y-0.5">
                    <p>Churn: {d.churn_rate}x · Complexity: {d.complexity_score}</p>
                    {d.coverage_drop && <p className="text-yellow-500">⚠ No tests updated with code</p>}
                    <p className="t-faint">Last active: {d.last_active_dev}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {trajectories.length === 0 && flags.length === 0 && techDebt.length === 0 && (
        <div className={`glass-card p-10 text-center ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          <p className="text-4xl mb-4">🎯</p>
          <p className="text-lg font-medium t-primary mb-2">No Active Sprint Data</p>
          <p className="text-sm">Configure Jira integration with JIRA_BOARD_ID to start tracking delivery risk.</p>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import SkeletonLoader from '../components/SkeletonLoader';

const typeConfig = {
  pair_programming: { icon: '👥', label: 'Pair Programming', colorDark: 'from-blue-500/10 to-cyan-500/10', borderDark: 'border-blue-500/20', colorLight: 'from-blue-50 to-cyan-50', borderLight: 'border-blue-200' },
  scope_cut: { icon: '✂️', label: 'Scope Cut', colorDark: 'from-orange-500/10 to-red-500/10', borderDark: 'border-orange-500/20', colorLight: 'from-orange-50 to-red-50', borderLight: 'border-orange-200' },
  workload_rebalance: { icon: '⚖️', label: 'Workload Rebalance', colorDark: 'from-purple-500/10 to-violet-500/10', borderDark: 'border-purple-500/20', colorLight: 'from-purple-50 to-violet-50', borderLight: 'border-purple-200' },
};

const API_BASE = import.meta.env.PROD
  ? `${import.meta.env.VITE_API_BASE_URL || 'https://vasanth-sjr-codepulse-api.hf.space'}/api`
  : '/api';

export default function Interventions() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [interventions, setInterventions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/interventions`)
      .then(r => r.json())
      .then(d => {
        setInterventions(d.interventions || []);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load intervention data');
        setLoading(false);
      });
  }, []);

  if (loading) return <SkeletonLoader />;

  if (error) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold t-primary">Autonomous Interventions</h1>
        <div className={`glass-card p-8 text-center ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          <p className="text-4xl mb-4">🤖</p>
          <p className="text-lg font-medium t-primary mb-2">No Data Available</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  /* Group by type */
  const grouped = {};
  interventions.forEach(intv => {
    const type = intv.type || 'pair_programming';
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(intv);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold t-primary">Autonomous Interventions</h1>
        <p className="text-sm t-muted mt-1">AI-recommended actions to prevent delivery failures</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 opacity-0 animate-slide-up stagger-1">
        {Object.entries(typeConfig).map(([key, cfg]) => {
          const count = (grouped[key] || []).length;
          return (
            <div key={key} className={`glass-card p-4 border ${isDark ? cfg.borderDark : cfg.borderLight} ${isDark ? `!bg-gradient-to-r !${cfg.colorDark}` : `!bg-gradient-to-r !${cfg.colorLight}`}`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{cfg.icon}</span>
                <div>
                  <p className="text-2xl font-bold t-primary">{count}</p>
                  <p className="text-[10px] t-muted font-medium">{cfg.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Intervention Cards by Type */}
      {Object.entries(grouped).map(([type, items], gi) => {
        const cfg = typeConfig[type] || typeConfig.pair_programming;
        return (
          <div key={type} className={`space-y-3 opacity-0 animate-slide-up stagger-${Math.min(gi + 2, 8)}`}>
            <h2 className="text-lg font-semibold t-primary flex items-center gap-2">
              {cfg.icon} {cfg.label}
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-white/5 text-slate-400' : 'bg-gray-100 text-gray-600'}`}>{items.length}</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {items.map((intv, i) => (
                <div key={i} className={`glass-card p-5 border ${isDark ? cfg.borderDark : cfg.borderLight}`}>
                  {/* Ticket header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-mono t-muted">{intv.ticket_id}</p>
                      <h3 className="text-sm font-semibold t-primary mt-0.5 line-clamp-2">{intv.ticket_title}</h3>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${intv.delivery_probability < 40 ? 'badge-high' : intv.delivery_probability < 70 ? 'badge-medium' : 'badge-low'}`}>
                      {intv.delivery_probability}%
                    </span>
                  </div>

                  {/* Developer flow */}
                  {intv.from_dev && (
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold bg-red-500`}>
                          {intv.from_dev?.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="t-secondary font-medium">{intv.from_dev}</span>
                      </div>
                      {intv.to_dev && (
                        <>
                          <span className="text-xs gradient-text font-bold">→</span>
                          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold bg-emerald-500`}>
                              {intv.to_dev?.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="t-secondary font-medium">{intv.to_dev}</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Success probability gauge */}
                  <div className="mb-3">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="t-faint">Success Probability</span>
                      <span className="font-bold t-primary">{intv.success_probability}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bar-bg overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{
                        width: `${intv.success_probability}%`,
                        backgroundColor: intv.success_probability >= 60 ? '#22C55E' : intv.success_probability >= 40 ? '#EAB308' : '#EF4444',
                      }} />
                    </div>
                  </div>

                  {/* Reason */}
                  <p className="text-[10px] t-muted leading-relaxed">{intv.reason}</p>

                  {/* Capacity verified badge */}
                  {intv.capacity_verified && (
                    <div className={`mt-3 flex items-center gap-1.5 text-[10px] ${isDark ? 'text-emerald-400' : 'text-green-600'}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="font-medium">Capacity Verified</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Empty state */}
      {interventions.length === 0 && (
        <div className={`glass-card p-10 text-center ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          <p className="text-4xl mb-4">✅</p>
          <p className="text-lg font-medium t-primary mb-2">All Clear</p>
          <p className="text-sm">No interventions needed — all tickets are on track!</p>
        </div>
      )}

      {/* Explanation */}
      <div className={`glass-card p-5 opacity-0 animate-slide-up stagger-8 ${isDark ? '!bg-gradient-to-r !from-accent-blue/5 !to-accent-purple/5' : '!bg-gradient-to-r !from-green-50/80 !to-emerald-50/80'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${isDark ? 'bg-accent-purple/10 border border-accent-purple/20' : 'bg-green-100 border border-green-300'}`}>
            🧮
          </div>
          <div>
            <p className="text-xs t-muted font-medium uppercase tracking-wider">How It Works</p>
            <p className="text-sm t-secondary mt-0.5">
              Interventions are computed from: developer overtime data, open issue counts, module ownership percentages, and velocity trends. Each recommendation passes a 3-check cognitive load verification.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

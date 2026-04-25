import React, { useState, useEffect } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { getKnowledgeRisks } from '../services/api';
import SkeletonLoader from '../components/SkeletonLoader';

const DEV_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#F97316'];

const getRiskClass = (risk) => {
  if (risk === 'HIGH') return 'badge-high';
  if (risk === 'MEDIUM') return 'badge-medium';
  return 'badge-low';
};

const getOwnershipColor = (risk, isDark) => {
  if (risk === 'HIGH') return 'from-red-500 to-red-600';
  if (risk === 'MEDIUM') return isDark ? 'from-yellow-500 to-yellow-600' : 'from-yellow-400 to-yellow-500';
  return isDark ? 'from-emerald-500 to-emerald-600' : 'from-green-500 to-green-600';
};

const CustomTooltip = ({ active, payload, isDark }) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className={`glass-card px-3 py-2 ${isDark ? '!bg-dark-800/95' : '!bg-white/95 shadow-lg'} border ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
        <p className="text-xs t-muted">{d.module} Module</p>
        <p className="text-sm font-semibold t-primary">{d.dev}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--accent-1)' }}>{d.value}% ownership</p>
      </div>
    );
  }
  return null;
};

export default function KnowledgeRisk() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const repoId = localStorage.getItem('codepulse_repo_id');
    if (!repoId) {
      setError('No repository connected yet. Go to Setup to connect a repo.');
      setLoading(false);
      return;
    }

    getKnowledgeRisks(parseInt(repoId))
      .then(data => {
        // Map API response and assign colors
        const devColorMap = {};
        let colorIdx = 0;

        const mapped = data.map((mod, i) => {
          const ownerName = mod.top_developer;
          if (!devColorMap[ownerName]) {
            devColorMap[ownerName] = DEV_COLORS[colorIdx % DEV_COLORS.length];
            colorIdx++;
          }

          // Also assign colors to all developers
          (mod.all_developers || []).forEach(d => {
            if (!devColorMap[d.name]) {
              devColorMap[d.name] = DEV_COLORS[colorIdx % DEV_COLORS.length];
              colorIdx++;
            }
          });

          return {
            id: i + 1,
            name: mod.module.charAt(0).toUpperCase() + mod.module.slice(1),
            risk: mod.risk_level,
            owner: mod.top_developer,
            ownerColor: devColorMap[ownerName],
            ownership: Math.round(mod.ownership_pct),
            totalCommits: mod.total_commits,
            allDevelopers: (mod.all_developers || []).map(d => ({
              ...d,
              color: devColorMap[d.name] || '#3B82F6',
            })),
          };
        });

        setModules(mapped);
        setLoading(false);
      })
      .catch(err => {
        setError(err.detail || err.message || 'Failed to load knowledge risk data');
        setLoading(false);
      });
  }, []);

  if (loading) return <SkeletonLoader />;

  if (error) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold t-primary">Knowledge Concentration Risk</h1>
        <div className={`glass-card p-8 text-center ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          <p className="text-4xl mb-4">⚠️</p>
          <p className="text-lg font-medium t-primary mb-2">No Data Available</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // Compute risk stats
  const highCount = modules.filter(m => m.risk === 'HIGH').length;
  const medCount = modules.filter(m => m.risk === 'MEDIUM').length;
  const lowCount = modules.filter(m => m.risk === 'LOW').length;

  const riskStats = [
    { label: 'High Risk', count: highCount, colorDark: 'text-red-400', colorLight: 'text-red-600', bgDark: 'bg-red-500/10', bgLight: 'bg-red-50', borderDark: 'border-red-500/20', borderLight: 'border-red-200' },
    { label: 'Medium Risk', count: medCount, colorDark: 'text-yellow-400', colorLight: 'text-yellow-700', bgDark: 'bg-yellow-500/10', bgLight: 'bg-yellow-50', borderDark: 'border-yellow-500/20', borderLight: 'border-yellow-200' },
    { label: 'Low Risk', count: lowCount, colorDark: 'text-emerald-400', colorLight: 'text-green-600', bgDark: 'bg-emerald-500/10', bgLight: 'bg-green-50', borderDark: 'border-emerald-500/20', borderLight: 'border-green-200' },
  ];

  // Build scatter/bubble data for ownership matrix
  const moduleNames = [...new Set(modules.map(m => m.name))];
  const allDevNames = [...new Set(modules.flatMap(m => m.allDevelopers.map(d => d.name)))];

  const scatterData = [];
  modules.forEach(mod => {
    mod.allDevelopers.forEach(dev => {
      const x = moduleNames.indexOf(mod.name);
      const y = allDevNames.indexOf(dev.name);
      if (x >= 0 && y >= 0) {
        scatterData.push({
          x,
          y,
          z: dev.pct,
          color: dev.color,
          module: mod.name,
          dev: dev.name,
          value: Math.round(dev.pct),
        });
      }
    });
  });

  // Find HIGH risk modules for AI recommendation
  const highRiskModules = modules.filter(m => m.risk === 'HIGH');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold t-primary">Knowledge Concentration Risk</h1>
        <p className="text-sm t-muted mt-1">Detect single points of failure in your development team</p>
      </div>

      {/* Risk Summary Bar */}
      <div className="grid grid-cols-3 gap-4 opacity-0 animate-slide-up stagger-1">
        {riskStats.map((r) => (
          <div key={r.label} className={`glass-card p-4 flex items-center gap-3 ${isDark ? r.bgDark : r.bgLight} border ${isDark ? r.borderDark : r.borderLight}`}>
            <span className={`text-3xl font-bold ${isDark ? r.colorDark : r.colorLight}`}>{r.count}</span>
            <span className={`text-sm font-medium ${isDark ? r.colorDark : r.colorLight}`}>{r.label}</span>
          </div>
        ))}
      </div>

      {/* Module Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {modules.map((mod, i) => (
          <div
            key={mod.id}
            className={`glass-card p-5 opacity-0 animate-slide-up stagger-${i + 1} ${
              mod.risk === 'HIGH' ? 'pulse-red-border' : ''
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-sm font-semibold t-primary">{mod.name}</h3>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${getRiskClass(mod.risk)}`}>
                {mod.risk}
              </span>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                style={{ backgroundColor: mod.ownerColor }}
              >
                {mod.owner.split(' ').map(n => n[0]).join('')}
              </div>
              <span className="text-xs t-muted">{mod.owner}</span>
            </div>

            {/* Ownership bar */}
            <div className="mb-2">
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="t-faint">Ownership</span>
                <span className={`font-semibold ${
                  mod.risk === 'HIGH' ? 'text-red-400' : mod.risk === 'MEDIUM' ? (isDark ? 'text-yellow-400' : 'text-yellow-600') : 'text-emerald-500'
                }`}>{mod.ownership}%</span>
              </div>
              <div className="w-full h-2 rounded-full bar-bg overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${getOwnershipColor(mod.risk, isDark)}`}
                  style={{ width: `${mod.ownership}%` }}
                ></div>
              </div>
            </div>
            <p className="text-[10px] t-faint">{mod.ownership}% of commits by one developer</p>
          </div>
        ))}
      </div>

      {/* Bubble Chart */}
      {scatterData.length > 0 && (
        <div className="glass-card p-6 opacity-0 animate-slide-up stagger-8">
          <h2 className="text-lg font-semibold t-primary mb-1">Developer × Module Ownership</h2>
          <p className="text-xs t-muted mb-6">Bubble size represents ownership percentage</p>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 10, right: 30, bottom: 10, left: 80 }}>
              <XAxis
                type="number"
                dataKey="x"
                domain={[-0.5, moduleNames.length - 0.5]}
                ticks={moduleNames.map((_, i) => i)}
                tickFormatter={(v) => moduleNames[v] || ''}
                axisLine={false}
                tickLine={false}
                tick={{ fill: isDark ? '#64748b' : '#6B7280', fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                domain={[-0.5, allDevNames.length - 0.5]}
                ticks={allDevNames.map((_, i) => i)}
                tickFormatter={(v) => allDevNames[v] || ''}
                axisLine={false}
                tickLine={false}
                tick={{ fill: isDark ? '#94a3b8' : '#4B5563', fontSize: 11 }}
              />
              <ZAxis type="number" dataKey="z" range={[40, 600]} />
              <Tooltip content={<CustomTooltip isDark={isDark} />} />
              <Scatter data={scatterData}>
                {scatterData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} fillOpacity={isDark ? 0.7 : 0.8} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* AI Recommendation */}
      {highRiskModules.length > 0 && (
        <div className={`glass-card p-5 border opacity-0 animate-slide-up stagger-8 ${
          isDark
            ? '!bg-gradient-to-r !from-red-500/5 !to-yellow-500/5 !border-red-500/20'
            : '!bg-gradient-to-r !from-red-50 !to-orange-50 !border-red-200'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${
              isDark
                ? 'bg-red-500/10 border border-red-500/20'
                : 'bg-red-100 border border-red-200'
            }`}>
              ⚠️
            </div>
            <div>
              <h3 className="text-sm font-semibold t-primary flex items-center gap-2">
                AI Recommendation
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  isDark
                    ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20'
                    : 'bg-green-50 text-green-600 border border-green-300'
                }`}>AI</span>
              </h3>
              <p className="text-sm t-secondary mt-1.5 leading-relaxed">
                {highRiskModules.map((m, i) => (
                  <span key={m.id}>
                    {i > 0 && ' and '}
                    <strong className="text-red-500">{m.name}</strong>
                  </span>
                ))}
                {' '}
                {highRiskModules.length === 1 ? 'is' : 'are'} owned by a single developer
                {highRiskModules.length === 1 && (
                  <> (<strong className="t-primary">{highRiskModules[0].owner}</strong>)</>
                )}.
                {' '}Consider pair programming or knowledge transfer sessions to reduce bus factor risk. Immediate action recommended to prevent knowledge silos.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

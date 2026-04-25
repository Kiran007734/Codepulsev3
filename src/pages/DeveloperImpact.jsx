import React, { useState, useEffect, memo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { getImpactScores, getDashboardSummary } from '../services/api';
import SkeletonLoader from '../components/SkeletonLoader';
import ExplainModal from '../components/ExplainModal';

const getBadgeClass = (badge) => {
  if (badge === 'HIGH IMPACT') return 'badge-high';
  if (badge === 'MEDIUM') return 'badge-medium';
  return 'badge-low';
};

const CustomTooltip = ({ active, payload, isDark }) => {
  if (active && payload && payload.length) {
    return (
      <div className={`glass-card px-3 py-2 ${isDark ? '!bg-dark-800/90' : '!bg-white/95 shadow-lg'} border ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
        <p className="text-sm font-semibold t-primary">{payload[0].payload.name}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--accent-1)' }}>Score: {payload[0].value}</p>
      </div>
    );
  }
  return null;
};

export default function DeveloperImpact() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const sparkLabels = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'];

  const [developers, setDevelopers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [explainModal, setExplainModal] = useState(null); // { sha, message }
  const [commitShas, setCommitShas] = useState({}); // dev name -> first commit sha

  useEffect(() => {
    const repoId = localStorage.getItem('codepulse_repo_id');
    if (!repoId) {
      setError('No repository connected yet. Go to Setup to connect a repo.');
      setLoading(false);
      return;
    }

    // Fetch both impact scores and dashboard summary for commit SHAs
    Promise.all([
      getImpactScores(parseInt(repoId)),
      getDashboardSummary(parseInt(repoId)).catch(() => null),
    ])
      .then(([data, summary]) => {
        const mapped = data.map((dev, i) => ({
          id: i + 1,
          name: dev.name,
          initials: dev.avatar_initials,
          color: dev.color || '#3B82F6',
          score: dev.impact_score,
          commits: dev.commits,
          files: dev.files_changed,
          badge: dev.risk_label,
          sparkline: dev.trend_data || [0, 0, 0, 0, 0, 0, 0, 0],
        }));
        setDevelopers(mapped);

        // Build dev → first commit SHA map from recent activity
        if (summary?.repo_overview?.recent_activity) {
          const shaMap = {};
          for (const act of summary.repo_overview.recent_activity) {
            if (act.author && act.sha && !shaMap[act.author]) {
              shaMap[act.author] = { sha: act.sha, message: act.message };
            }
          }
          setCommitShas(shaMap);
        }
        setLoading(false);
      })
      .catch(err => {
        setError(err.detail || err.message || 'Failed to load developer impact data');
        setLoading(false);
      });
  }, []);

  if (loading) return <SkeletonLoader />;

  if (error) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold t-primary">Developer Contribution Intelligence</h1>
        <div className={`glass-card p-8 text-center ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          <p className="text-4xl mb-4">👥</p>
          <p className="text-lg font-medium t-primary mb-2">No Data Available</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // Build chart data for comparison
  const chartData = developers.map(d => ({ name: d.name, score: d.score }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold t-primary">Developer Contribution Intelligence</h1>
        <p className="text-sm t-muted mt-1">AI-powered impact scoring beyond simple commit counts</p>
      </div>

      {/* Developer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {developers.map((dev, i) => (
          <div
            key={dev.id}
            className={`glass-card p-5 opacity-0 animate-slide-up stagger-${i + 1}`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ backgroundColor: dev.color }}
                >
                  {dev.initials}
                </div>
                <div>
                  <h3 className="text-sm font-semibold t-primary">{dev.name}</h3>
                  <p className="text-xs t-faint">{dev.commits} commits · {dev.files} files</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {commitShas[dev.name] && (
                  <button
                    onClick={() => setExplainModal(commitShas[dev.name])}
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full transition-all duration-200 ${
                      isDark
                        ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20 hover:bg-accent-blue/20'
                        : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'
                    }`}
                  >
                    ✨ Explain
                  </button>
                )}
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${getBadgeClass(dev.badge)}`}>
                  {dev.badge}
                </span>
              </div>
            </div>

            {/* Score */}
            <div className="flex items-end gap-2 mb-4">
              <span className="text-4xl font-bold gradient-text">{dev.score}</span>
              <span className="text-sm t-faint mb-1">/ 10</span>
            </div>

            {/* Breakdown bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-[10px] t-faint mb-1.5">
                <span>Commits weight</span>
                <span>Files weight</span>
              </div>
              <div className="w-full h-2 rounded-full bar-bg overflow-hidden flex">
                <div
                  className="h-full rounded-l-full"
                  style={{ width: `${(dev.commits / (dev.commits + dev.files)) * 100}%`, backgroundColor: 'var(--accent-1)' }}
                ></div>
                <div
                  className="h-full rounded-r-full"
                  style={{ width: `${(dev.files / (dev.commits + dev.files)) * 100}%`, backgroundColor: 'var(--accent-2)' }}
                ></div>
              </div>
            </div>

            {/* Mini sparkline */}
            <div className="h-12">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dev.sparkline.map((v, j) => ({ day: sparkLabels[j], val: v }))}>
                  <Line
                    type="monotone"
                    dataKey="val"
                    stroke={dev.color}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      {/* Comparison Bar Chart */}
      {chartData.length > 0 && (
        <div className="glass-card p-6 opacity-0 animate-slide-up stagger-7">
          <h2 className="text-lg font-semibold t-primary mb-4">Impact Score Comparison</h2>
          <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 45)}>
            <BarChart data={chartData} layout="vertical" barCategoryGap="25%">
              <XAxis type="number" domain={[0, 10]} axisLine={false} tickLine={false} tick={{ fill: isDark ? '#64748b' : '#6B7280', fontSize: 12 }} />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{ fill: isDark ? '#94a3b8' : '#4B5563', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip isDark={isDark} />} cursor={{ fill: isDark ? 'rgba(59,130,246,0.05)' : 'rgba(22,163,74,0.05)' }} />
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={isDark ? '#22c55e' : '#16A34A'} />
                  <stop offset="100%" stopColor={isDark ? '#16a34a' : '#059669'} />
                </linearGradient>
              </defs>
              <Bar dataKey="score" fill="url(#scoreGrad)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Formula */}
      <div className={`glass-card p-5 opacity-0 animate-slide-up stagger-8 ${
        isDark
          ? '!bg-gradient-to-r !from-accent-blue/5 !to-accent-purple/5'
          : '!bg-gradient-to-r !from-green-50/80 !to-emerald-50/80'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
            isDark
              ? 'bg-accent-purple/10 border border-accent-purple/20'
              : 'bg-green-100 border border-green-300'
          }`}>
            🧮
          </div>
          <div>
            <p className="text-xs t-muted font-medium uppercase tracking-wider">Scoring Formula</p>
            <p className="text-sm t-secondary mt-0.5 font-mono">
              Impact = (commits × 0.4) + (files × 0.3) + (modules × 0.2) + (lines × 0.1) / max_score × 10
            </p>
          </div>
        </div>
      </div>
      {/* Explain Modal */}
      {explainModal && (
        <ExplainModal
          commitSha={explainModal.sha}
          commitMessage={explainModal.message}
          repoId={localStorage.getItem('codepulse_repo_id')}
          onClose={() => setExplainModal(null)}
        />
      )}
    </div>
  );
}

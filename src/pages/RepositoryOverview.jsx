import React, { useState, useEffect, memo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { getDashboardSummary, getSprintSummary } from '../services/api';
import SkeletonLoader from '../components/SkeletonLoader';
import ExplainModal from '../components/ExplainModal';

const CustomTooltip = ({ active, payload, label, isDark }) => {
  if (active && payload && payload.length) {
    return (
      <div className={`glass-card px-3 py-2 ${isDark ? '!bg-dark-800/90' : '!bg-white/95 shadow-lg'} border ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
        <p className="text-xs t-muted">{label}</p>
        <p className="text-sm font-semibold" style={{ color: 'var(--accent-1)' }}>{payload[0].value} commits</p>
      </div>
    );
  }
  return null;
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatRelativeDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffHours < 1) return 'just now';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

// Color palette for developer initials
const DEV_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#F97316'];

export default function RepositoryOverview() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sprintSummary, setSprintSummary] = useState(null);
  const [sprintLoading, setSprintLoading] = useState(true);
  const [explainModal, setExplainModal] = useState(null); // { sha, message }

  useEffect(() => {
    const repoId = localStorage.getItem('codepulse_repo_id');
    if (!repoId) {
      setError('No repository connected yet. Go to Setup to connect a repo.');
      setLoading(false);
      return;
    }

    getDashboardSummary(parseInt(repoId))
      .then(res => {
        setData(res);
        setLoading(false);
      })
      .catch(err => {
        setError(err.detail || err.message || 'Failed to load dashboard data');
        setLoading(false);
      });

    // Fetch sprint summary independently
    getSprintSummary(parseInt(repoId))
      .then(res => {
        setSprintSummary(res);
        setSprintLoading(false);
      })
      .catch(() => setSprintLoading(false));
  }, []);

  if (loading) return <SkeletonLoader />;

  if (error) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold t-primary">Repository Overview</h1>
        <div className={`glass-card p-8 text-center ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          <p className="text-4xl mb-4">📭</p>
          <p className="text-lg font-medium t-primary mb-2">No Data Available</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const overview = data.repo_overview;
  const repoName = overview.repo_name || localStorage.getItem('codepulse_repo_name') || 'Repository';

  const stats = [
    { label: 'Total Commits', value: String(overview.total_commits), icon: '📊', change: `${overview.total_commits} total`, color: 'from-green-500 to-emerald-600' },
    { label: 'Active Developers', value: String(overview.active_developers), icon: '👥', change: 'contributors', color: 'from-purple-500 to-violet-600' },
    { label: 'Modules Tracked', value: String(overview.modules_tracked), icon: '📦', change: 'detected', color: 'from-blue-500 to-cyan-600' },
    { label: 'Risk Modules', value: String(overview.risky_modules), icon: '⚠️', change: overview.risky_modules > 0 ? 'Action needed' : 'All clear', color: 'from-red-500 to-red-600' },
  ];

  // Build chart data from commit_activity (last 30 days → show last 7)
  const commitActivity = overview.commit_activity || [];
  const last7 = commitActivity.slice(-7);
  const weeklyCommits = last7.map((count, i) => ({
    day: DAY_LABELS[i % 7],
    commits: count,
  }));

  // Build dev color map from recent activity
  const devColorMap = {};
  let colorIdx = 0;
  (overview.recent_activity || []).forEach(item => {
    if (!devColorMap[item.author]) {
      devColorMap[item.author] = DEV_COLORS[colorIdx % DEV_COLORS.length];
      colorIdx++;
    }
  });

  const recentActivity = (overview.recent_activity || []).map((item, i) => ({
    id: i + 1,
    sha: item.sha || '',
    dev: {
      color: devColorMap[item.author] || '#3B82F6',
      initials: item.author ? item.author.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??',
    },
    message: item.message,
    time: formatRelativeDate(item.date),
    filesChanged: item.files_changed || 0,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold t-primary">Repository Overview</h1>
        <p className="text-sm t-muted mt-1">{repoName} — Real-time development insights</p>
      </div>

      {/* AI Sprint Summary */}
      <div className={`glass-card gradient-border p-5 animate-fade-in ${
        isDark
          ? '!bg-gradient-to-r !from-accent-blue/5 !to-accent-purple/5'
          : '!bg-gradient-to-r !from-green-50/80 !to-emerald-50/80'
      }`}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🧠</span>
          <h2 className="text-base font-semibold t-primary">AI Weekly Summary</h2>
        </div>
        {sprintLoading ? (
          <div className="space-y-2">
            <div className="skeleton h-4 w-full"></div>
            <div className="skeleton h-4 w-4/5"></div>
            <div className="skeleton h-4 w-3/5"></div>
          </div>
        ) : sprintSummary ? (
          <>
            <p className="text-sm t-secondary leading-relaxed"
               dangerouslySetInnerHTML={{
                 __html: (sprintSummary.summary || '').replace(
                   /\*\*(.*?)\*\*/g, '<strong class="t-primary font-semibold">$1</strong>'
                 )
               }}
            />
            {sprintSummary.highlights?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {sprintSummary.highlights.map((h, i) => (
                  <span key={i} className={`text-[10px] font-medium px-2 py-1 rounded-full ${
                    isDark
                      ? 'bg-white/5 text-slate-400 border border-white/10'
                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                  }`}>
                    {h}
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm t-muted">Unable to generate summary at this time.</p>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`glass-card p-5 opacity-0 animate-slide-up stagger-${i + 1}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs t-muted font-medium uppercase tracking-wider">{s.label}</p>
                <p className="text-3xl font-bold t-primary mt-2">{s.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center text-lg`}>
                {s.icon}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1">
              <span className={`text-xs font-medium ${s.label === 'Risk Modules' && overview.risky_modules > 0 ? 'text-red-400' : 'text-emerald-500'}`}>
                {s.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Chart */}
        <div className="lg:col-span-2 glass-card p-6 opacity-0 animate-slide-up stagger-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold t-primary">Commit Activity</h2>
              <p className="text-xs t-muted mt-0.5">Last 7 days</p>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${isDark ? 'bg-dark-700/60 border border-white/5' : 'bg-gray-50 border border-gray-200'}`}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--accent-1)' }}></div>
              <span className="text-xs t-muted">Commits</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={weeklyCommits} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)'} />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#64748b' : '#6B7280', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? '#64748b' : '#6B7280', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip isDark={isDark} />} cursor={{ fill: isDark ? 'rgba(59,130,246,0.05)' : 'rgba(22,163,74,0.05)' }} />
              <defs>
                <linearGradient id="commitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isDark ? '#22c55e' : '#16A34A'} />
                  <stop offset="100%" stopColor={isDark ? '#16a34a' : '#059669'} />
                </linearGradient>
              </defs>
              <Bar dataKey="commits" fill="url(#commitGradient)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Activity Feed */}
        <div className="glass-card p-6 opacity-0 animate-slide-up stagger-6">
          <h2 className="text-lg font-semibold t-primary mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {recentActivity.length > 0 ? recentActivity.map((item) => (
              <div key={item.id} className="flex items-start gap-3 group">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: item.dev.color }}
                >
                  {item.dev.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm t-secondary leading-snug truncate group-hover:t-primary transition-colors">
                    {item.message}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs t-faint">{item.time}</span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      isDark
                        ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/10'
                        : 'bg-green-50 text-green-600 border border-green-200'
                    }`}>
                      {item.filesChanged} files
                    </span>
                  </div>
                </div>
                {item.sha && (
                  <button
                    onClick={() => setExplainModal({ sha: item.sha, message: item.message })}
                    className={`flex-shrink-0 text-[10px] font-medium px-2 py-1 rounded-full transition-all duration-200 opacity-0 group-hover:opacity-100 ${
                      isDark
                        ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20 hover:bg-accent-blue/20'
                        : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'
                    }`}
                  >
                    ✨ Explain
                  </button>
                )}
              </div>
            )) : (
              <p className="text-sm t-muted text-center py-4">No recent activity</p>
            )}
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

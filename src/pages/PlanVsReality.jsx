import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { getPlanVsReality } from '../services/api';
import SkeletonLoader from '../components/SkeletonLoader';

const STATUS_COLORS = {
  complete: { bg: 'bg-emerald-500/15', text: 'text-emerald-500', border: 'border-emerald-500/20', label: 'Complete' },
  partial: { bg: 'bg-yellow-500/15', text: 'text-yellow-500', border: 'border-yellow-500/20', label: 'Partial' },
  'not started': { bg: 'bg-red-500/15', text: 'text-red-500', border: 'border-red-500/20', label: 'Not Started' },
};

export default function PlanVsReality() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const repoId = localStorage.getItem('codepulse_repo_id');
    if (!repoId) {
      setError('No repository connected. Go to Setup to connect a repo.');
      setLoading(false);
      return;
    }

    getPlanVsReality(parseInt(repoId))
      .then(res => {
        setData(res);
        setLoading(false);
      })
      .catch(err => {
        setError(err.detail || err.message || 'Failed to load plan vs reality data');
        setLoading(false);
      });
  }, []);

  if (loading) return <SkeletonLoader />;

  if (error) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold t-primary">Plan vs Reality</h1>
        <div className={`glass-card p-8 text-center ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          <p className="text-4xl mb-4">📋</p>
          <p className="text-lg font-medium t-primary mb-2">No Data Available</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const issues = data?.issues || [];
  const hasData = issues.length > 0;

  const stats = [
    { label: 'Total Tasks', value: data?.totalTasks || 0, icon: '📋', color: 'from-blue-500 to-blue-600' },
    { label: 'Completed', value: data?.completed || 0, icon: '✅', color: 'from-emerald-500 to-emerald-600' },
    { label: 'Partial', value: data?.partial || 0, icon: '🔶', color: 'from-yellow-500 to-yellow-600' },
    { label: 'Not Started', value: data?.notStarted || 0, icon: '❌', color: 'from-red-500 to-red-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold t-primary">Plan vs Reality</h1>
        <p className="text-sm t-muted mt-1">Jira issues matched against GitHub commits</p>
      </div>

      {hasData && data.message && data.message !== "Plan vs reality mapping successful." && (
        <div className={`p-4 rounded-xl text-sm border opacity-0 animate-slide-up ${isDark ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>
          💡 {data.message}
        </div>
      )}

      {!hasData ? (
        <div className={`glass-card p-8 text-center animate-fade-in ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          <p className="text-4xl mb-4">🔗</p>
          <p className="text-lg font-medium t-primary mb-2">No Jira Data</p>
          <p className="text-sm">{data?.message || 'Connect Jira from the Setup page to see plan vs reality analysis.'}</p>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s, i) => (
              <div key={s.label} className={`glass-card p-5 opacity-0 animate-slide-up stagger-${i + 1}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs t-muted font-medium uppercase tracking-wider">{s.label}</p>
                    <p className="text-3xl font-bold t-primary mt-2">{s.value}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center text-lg`}>
                    {s.icon}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Completion Progress */}
          <div className="glass-card p-6 opacity-0 animate-slide-up stagger-5">
            <h2 className="text-lg font-semibold t-primary mb-4">Completion Overview</h2>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className={`w-full h-4 rounded-full overflow-hidden flex ${isDark ? 'bg-dark-700' : 'bg-gray-200'}`}>
                  {data.totalTasks > 0 && (
                    <>
                      <div
                        className="h-full bg-emerald-500 transition-all duration-700"
                        style={{ width: `${(data.completed / data.totalTasks) * 100}%` }}
                      />
                      <div
                        className="h-full bg-yellow-500 transition-all duration-700"
                        style={{ width: `${(data.partial / data.totalTasks) * 100}%` }}
                      />
                      <div
                        className="h-full bg-red-500 transition-all duration-700"
                        style={{ width: `${(data.notStarted / data.totalTasks) * 100}%` }}
                      />
                    </>
                  )}
                </div>
              </div>
              <span className="text-sm font-semibold t-primary whitespace-nowrap">
                {data.totalTasks > 0 ? Math.round((data.completed / data.totalTasks) * 100) : 0}% done
              </span>
            </div>
            <div className="flex items-center gap-6 mt-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="text-xs t-muted">Complete</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="text-xs t-muted">Partial</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-xs t-muted">Not Started</span>
              </div>
            </div>
          </div>

          {/* Issues Table */}
          <div className="glass-card p-6 opacity-0 animate-slide-up stagger-6">
            <h2 className="text-lg font-semibold t-primary mb-4">Issue Details</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                    <th className="text-left py-3 px-3 text-xs font-semibold t-muted uppercase tracking-wider">Issue</th>
                    <th className="text-left py-3 px-3 text-xs font-semibold t-muted uppercase tracking-wider">Summary</th>
                    <th className="text-left py-3 px-3 text-xs font-semibold t-muted uppercase tracking-wider">Assignee</th>
                    <th className="text-left py-3 px-3 text-xs font-semibold t-muted uppercase tracking-wider">Status</th>
                    <th className="text-center py-3 px-3 text-xs font-semibold t-muted uppercase tracking-wider">Commits</th>
                    <th className="text-center py-3 px-3 text-xs font-semibold t-muted uppercase tracking-wider">Confidence</th>
                    <th className="text-center py-3 px-3 text-xs font-semibold t-muted uppercase tracking-wider">Completion</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((issue, idx) => {
                    const statusStyle = STATUS_COLORS[issue.completionStatus] || STATUS_COLORS['not started'];
                    return (
                      <tr
                        key={issue.key || idx}
                        className={`border-b transition-colors ${
                          isDark
                            ? 'border-white/5 hover:bg-white/[0.02]'
                            : 'border-gray-100 hover:bg-gray-50/50'
                        }`}
                      >
                        <td className="py-3 px-3">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-mono font-medium ${
                            isDark
                              ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/10'
                              : 'bg-blue-50 text-blue-600 border border-blue-200'
                          }`}>
                            {issue.key}
                          </span>
                        </td>
                        <td className="py-3 px-3 t-secondary max-w-xs truncate">{issue.summary}</td>
                        <td className="py-3 px-3 t-muted">{issue.assignee}</td>
                        <td className="py-3 px-3 t-muted">{issue.status}</td>
                        <td className="py-3 px-3 text-center t-secondary font-medium">
                          {issue.matchedCommits?.length || 0}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`text-xs font-medium ${
                            issue.confidence >= 0.5 ? 'text-emerald-500'
                              : issue.confidence > 0 ? 'text-yellow-500'
                              : 'text-red-400'
                          }`}>
                            {issue.confidence > 0 ? `${Math.round(issue.confidence * 100)}%` : '—'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${statusStyle.bg} ${statusStyle.text} border ${statusStyle.border}`}>
                            {statusStyle.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

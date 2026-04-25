import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { getDashboardSummary } from '../services/api';
import SkeletonLoader from '../components/SkeletonLoader';

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

export default function RequirementMapping() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [requirements, setRequirements] = useState([]);
  const [selectedReq, setSelectedReq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const repoId = localStorage.getItem('codepulse_repo_id');
    if (!repoId) {
      setError('No repository connected yet. Go to Setup to connect a repo.');
      setLoading(false);
      return;
    }

    getDashboardSummary(parseInt(repoId))
      .then(data => {
        const mappings = data.requirement_mapping || [];
        // Transform API data to component format
        const mapped = mappings.map((m, i) => ({
          id: i + 1,
          title: m.requirement,
          confidence: Math.round(m.confidence),
          matchedCount: m.matched_commits,
          commits: (m.commits || []).map(c => ({
            hash: c.sha?.startsWith('#') ? c.sha : `#${c.sha}`,
            message: c.message,
            dev: c.author,
            date: formatRelativeDate(c.date),
            similarity: Math.round(c.match_score),
          })),
        }));
        setRequirements(mapped);
        if (mapped.length > 0) setSelectedReq(mapped[0]);
        setLoading(false);
      })
      .catch(err => {
        setError(err.detail || err.message || 'Failed to load requirement mapping data');
        setLoading(false);
      });
  }, []);

  if (loading) return <SkeletonLoader />;

  if (error || requirements.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold t-primary">Requirement Traceability Engine</h1>
        <div className={`glass-card p-8 text-center ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          <p className="text-4xl mb-4">🔗</p>
          <p className="text-lg font-medium t-primary mb-2">No Requirements Mapped</p>
          <p className="text-sm">{error || 'Add business requirements in the Setup page to see AI-powered traceability.'}</p>
        </div>

        {/* How it works */}
        <div className={`glass-card p-4 ${
          isDark
            ? '!bg-gradient-to-r !from-accent-blue/5 !to-accent-purple/5'
            : '!bg-gradient-to-r !from-green-50/80 !to-emerald-50/80'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${
              isDark
                ? 'bg-accent-blue/10 border border-accent-blue/20'
                : 'bg-green-100 border border-green-300'
            }`}>
              🧠
            </div>
            <div>
              <p className="text-xs t-muted font-semibold uppercase tracking-wider">How it works</p>
              <p className="text-sm t-secondary mt-1 leading-relaxed">
                NLP Sentence Transformers analyze semantic similarity between requirement text and commit messages, enabling automatic traceability without manual tagging.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold t-primary">Requirement Traceability Engine</h1>
        <p className="text-sm t-muted mt-1">AI matches business requirements to actual commits using NLP similarity</p>
      </div>

      {/* Main two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left — Requirements list */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-xs t-faint font-medium uppercase tracking-wider mb-2">Business Requirements</h2>
          {requirements.map((req, i) => (
            <button
              key={req.id}
              onClick={() => setSelectedReq(req)}
              className={`w-full text-left glass-card p-4 opacity-0 animate-slide-up stagger-${i + 1} transition-all duration-200 ${
                selectedReq?.id === req.id
                  ? isDark
                    ? '!border-accent-blue/40 !bg-accent-blue/5 shadow-lg shadow-accent-blue/5'
                    : '!border-green-400/60 !bg-green-50/80 shadow-lg shadow-green-200/30'
                  : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <h3 className="text-sm font-semibold t-primary leading-snug">{req.title}</h3>
                <span className={`flex-shrink-0 ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isDark
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                    : 'bg-green-50 text-green-600 border border-green-300'
                }`}>
                  {req.confidence}%
                </span>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs t-faint">
                  {req.matchedCount} commits matched
                </span>
                <div className="flex-1 h-1 rounded-full bar-bg overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${req.confidence}%`,
                      background: `linear-gradient(90deg, var(--accent-1), var(--accent-2))`,
                    }}
                  ></div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Right — Matched commits */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs t-faint font-medium uppercase tracking-wider">Matched Commits</h2>
            <span className="text-xs t-faint">{selectedReq?.commits.length || 0} results</span>
          </div>

          {selectedReq && (
            <div className="glass-card p-5 animate-fade-in" key={selectedReq.id}>
              <div className={`flex items-center gap-2 mb-4 pb-4 border-b ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--accent-1)' }}></div>
                <h3 className="text-sm font-semibold t-primary">{selectedReq.title}</h3>
                <span className="ml-auto text-xs font-semibold" style={{ color: 'var(--accent-2)' }}>{selectedReq.confidence}% confidence</span>
              </div>

              <div className="space-y-4">
                {selectedReq.commits.map((commit, i) => (
                  <div
                    key={commit.hash}
                    className={`flex items-start gap-4 p-3 rounded-lg transition-all opacity-0 animate-slide-up stagger-${i + 1} ${
                      isDark
                        ? 'bg-dark-700/30 border border-white/[0.03] hover:border-accent-blue/10'
                        : 'bg-gray-50/60 border border-gray-100 hover:border-green-200'
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-[11px] font-mono font-semibold ${
                        isDark
                          ? 'bg-dark-700 text-accent-blue border border-accent-blue/10'
                          : 'bg-white text-green-600 border border-green-200'
                      }`}>
                        {commit.hash}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm t-secondary font-medium">{commit.message}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs t-faint">{commit.dev}</span>
                        <span className="text-xs t-faint">•</span>
                        <span className="text-xs t-faint">{commit.date}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        commit.similarity >= 90
                          ? isDark ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-green-50 text-green-600 border border-green-300'
                          : isDark ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                      }`}>
                        {commit.similarity}% match
                      </span>
                    </div>
                  </div>
                ))}
                {selectedReq.commits.length === 0 && (
                  <p className="text-sm t-muted text-center py-6">No matching commits found</p>
                )}
              </div>
            </div>
          )}

          {/* How it works */}
          <div className={`glass-card p-4 opacity-0 animate-slide-up stagger-6 ${
            isDark
              ? '!bg-gradient-to-r !from-accent-blue/5 !to-accent-purple/5'
              : '!bg-gradient-to-r !from-green-50/80 !to-emerald-50/80'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${
                isDark
                  ? 'bg-accent-blue/10 border border-accent-blue/20'
                  : 'bg-green-100 border border-green-300'
              }`}>
                🧠
              </div>
              <div>
                <p className="text-xs t-muted font-semibold uppercase tracking-wider">How it works</p>
                <p className="text-sm t-secondary mt-1 leading-relaxed">
                  NLP Sentence Transformers analyze semantic similarity between requirement text and commit messages, enabling automatic traceability without manual tagging.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { getRecommendations } from '../services/api';
import SkeletonLoader from '../components/SkeletonLoader';

const priorityConfig = {
  High: {
    badge: 'badge-high',
    border: 'border-l-red-500',
    glow: 'hover:shadow-red-500/10',
  },
  Medium: {
    badge: 'badge-medium',
    border: 'border-l-yellow-500',
    glow: 'hover:shadow-yellow-500/10',
  },
  Low: {
    badge: 'badge-low',
    border: 'border-l-blue-500',
    glow: 'hover:shadow-blue-500/10',
  },
};

function MarkdownBold({ text }) {
  // Render **bold** markdown in text
  if (!text) return null;
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="t-primary font-semibold">{part}</strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export default function Recommendations() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const repoId = localStorage.getItem('codepulse_repo_id');
    if (!repoId) {
      setError('No repository connected yet. Go to Setup to connect a repo.');
      setLoading(false);
      return;
    }

    getRecommendations(parseInt(repoId))
      .then(data => {
        setRecommendations(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.detail || err.message || 'Failed to load recommendations');
        setLoading(false);
      });
  }, []);

  if (loading) return <SkeletonLoader />;

  if (error) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold t-primary">AI Recommendations</h1>
        <div className={`glass-card p-8 text-center ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          <p className="text-4xl mb-4">💡</p>
          <p className="text-lg font-medium t-primary mb-2">No Data Available</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold t-primary">AI Recommendations</h1>
        <p className="text-sm t-muted mt-1">Actionable insights to improve team health and code quality</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 animate-fade-in">
        {['High', 'Medium', 'Low'].map(p => {
          const count = recommendations.filter(r => r.priority === p).length;
          const cfg = priorityConfig[p];
          return (
            <div key={p} className="glass-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs t-muted font-medium uppercase tracking-wider">{p} Priority</p>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>{count}</span>
              </div>
              <p className="text-2xl font-bold t-primary mt-2">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Recommendation Cards */}
      <div className="space-y-4">
        {recommendations.map((rec, i) => {
          const cfg = priorityConfig[rec.priority] || priorityConfig.Low;
          return (
            <div
              key={i}
              className={`glass-card p-5 border-l-4 ${cfg.border} ${cfg.glow} opacity-0 animate-slide-up stagger-${Math.min(i + 1, 8)}`}
            >
              <div className="flex items-start gap-4">
                <span className="text-2xl flex-shrink-0 mt-0.5">{rec.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-sm font-semibold t-primary">{rec.title}</h3>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.badge}`}>
                      {rec.priority}
                    </span>
                  </div>
                  <p className="text-sm t-secondary leading-relaxed">
                    <MarkdownBold text={rec.text} />
                  </p>
                  {rec.category && (
                    <span className={`inline-block mt-3 text-[10px] font-medium px-2 py-0.5 rounded ${
                      isDark ? 'bg-white/5 text-slate-500' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {rec.category}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

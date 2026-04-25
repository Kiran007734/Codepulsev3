import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { getCommitExplanation } from '../services/api';

export default function ExplainModal({ commitSha, commitMessage, repoId, onClose }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (!commitSha || !repoId) return;
    setLoading(true);
    getCommitExplanation(repoId, commitSha)
      .then(res => {
        setData(res);
        setLoading(false);
      })
      .catch(err => {
        setError(err.detail || err.message || 'Failed to generate explanation');
        setLoading(false);
      });
  }, [commitSha, repoId]);

  const sections = data ? [
    { label: '📋 Summary', text: data.summary },
    { label: '🎯 Purpose', text: data.purpose },
    { label: '💼 Business Impact', text: data.business_impact },
  ].filter(s => s.text) : [];

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`modal-content glass-card p-6 w-full max-w-lg mx-4 ${
        isDark ? '' : '!bg-white/95 shadow-2xl'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="text-lg">✨</span>
            <h3 className="text-lg font-semibold t-primary">AI Explanation</h3>
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            ✕
          </button>
        </div>

        {/* Commit reference */}
        <div className={`text-xs font-mono px-3 py-2 rounded-lg mb-4 truncate ${
          isDark ? 'bg-dark-700/60 text-slate-400 border border-white/5' : 'bg-gray-50 text-gray-500 border border-gray-200'
        }`}>
          {commitMessage || commitSha}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-2">
                <div className="skeleton h-4 w-24"></div>
                <div className="skeleton h-3 w-full"></div>
                <div className="skeleton h-3 w-4/5"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className={`text-sm text-center py-6 ${isDark ? 'text-red-400' : 'text-red-500'}`}>
            <p className="text-2xl mb-2">⚠️</p>
            <p>{error}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sections.map((sec, i) => (
              <div key={i} className={`p-4 rounded-lg ${
                isDark ? 'bg-dark-700/40 border border-white/5' : 'bg-gray-50 border border-gray-100'
              }`}>
                <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${
                  isDark ? 'text-accent-blue' : 'text-green-600'
                }`}>
                  {sec.label}
                </p>
                <p className="text-sm t-secondary leading-relaxed">{sec.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

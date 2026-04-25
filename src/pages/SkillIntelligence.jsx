import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { getDeveloperSkills } from '../services/api';
import SkeletonLoader from '../components/SkeletonLoader';

const SKILL_COLORS = [
  'from-blue-500 to-blue-600',
  'from-purple-500 to-purple-600',
  'from-emerald-500 to-emerald-600',
  'from-amber-500 to-amber-600',
  'from-rose-500 to-rose-600',
  'from-cyan-500 to-cyan-600',
  'from-indigo-500 to-indigo-600',
  'from-pink-500 to-pink-600',
];

const DEV_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#F97316'];

export default function SkillIntelligence() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [developers, setDevelopers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const repoId = localStorage.getItem('codepulse_repo_id');
    if (!repoId) {
      setError('No repository connected yet. Go to Setup to connect a repo.');
      setLoading(false);
      return;
    }

    getDeveloperSkills(parseInt(repoId))
      .then(data => {
        setDevelopers(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.detail || err.message || 'Failed to load skill data');
        setLoading(false);
      });
  }, []);

  if (loading) return <SkeletonLoader />;

  if (error) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold t-primary">Skill Intelligence</h1>
        <div className={`glass-card p-8 text-center ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          <p className="text-4xl mb-4">🧠</p>
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
        <h1 className="text-2xl font-bold t-primary">Skill Intelligence</h1>
        <p className="text-sm t-muted mt-1">Developer expertise mapped from code contributions</p>
      </div>

      {/* Developer Skill Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {developers.map((dev, i) => {
          const initials = dev.name
            ? dev.name.split(/[\s_-]/).map(n => n[0]).join('').toUpperCase().slice(0, 2)
            : '??';
          const color = DEV_COLORS[i % DEV_COLORS.length];

          return (
            <div
              key={dev.name}
              className={`glass-card p-5 opacity-0 animate-slide-up stagger-${Math.min(i + 1, 8)}`}
            >
              {/* Developer info */}
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ backgroundColor: color }}
                >
                  {initials}
                </div>
                <div>
                  <h3 className="text-sm font-semibold t-primary">{dev.name}</h3>
                  <p className="text-xs t-faint">{dev.skills?.length || 0} skills detected</p>
                </div>
              </div>

              {/* Skill bars */}
              <div className="space-y-3">
                {(dev.skills || []).slice(0, 6).map((skill, j) => (
                  <div key={skill.skill}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs t-secondary font-medium">{skill.skill}</span>
                      <span className="text-[10px] t-faint">{skill.percentage}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bar-bg overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${SKILL_COLORS[j % SKILL_COLORS.length]} transition-all duration-700 ease-out`}
                        style={{
                          width: `${skill.percentage}%`,
                          animationDelay: `${j * 0.1}s`,
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Show more if truncated */}
              {(dev.skills || []).length > 6 && (
                <p className="text-[10px] t-faint mt-3 text-center">
                  +{dev.skills.length - 6} more skills
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Info card */}
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
            🧠
          </div>
          <div>
            <p className="text-xs t-muted font-medium uppercase tracking-wider">How It Works</p>
            <p className="text-sm t-secondary mt-0.5">
              Skills are detected by analyzing file extensions, directory structures, and code patterns from actual commits — no AI guessing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

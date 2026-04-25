import React from 'react';
import CodePulseLogo from '../components/CodePulseLogo';
import { useTheme } from '../context/ThemeContext';

const features = [
  {
    icon: '🔗',
    title: 'Requirement Traceability',
    desc: 'AI maps commits to business goals using NLP semantic similarity — never lose track of why code was written.',
    gradient: 'from-blue-500 to-cyan-500',
    gradientLight: 'from-green-500 to-emerald-500',
  },
  {
    icon: '👥',
    title: 'Developer Impact Scoring',
    desc: 'Fair, data-driven contribution scores beyond simple commit counts — measure real engineering impact.',
    gradient: 'from-purple-500 to-pink-500',
    gradientLight: 'from-teal-500 to-green-500',
  },
  {
    icon: '⚠️',
    title: 'Knowledge Risk Detection',
    desc: 'Catch bus-factor risks before they hurt — identify knowledge silos and single points of failure.',
    gradient: 'from-orange-500 to-red-500',
    gradientLight: 'from-lime-500 to-green-600',
  },
];

export default function LandingPage({ onNavigate }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-dark-900' : 'bg-gradient-to-br from-gray-50 to-emerald-50/30'}`}>
      {/* Ambient glow effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full blur-[120px] opacity-20 ${
          isDark ? 'bg-blue-600' : 'bg-green-400'
        }`}></div>
        <div className={`absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full blur-[120px] opacity-15 ${
          isDark ? 'bg-purple-600' : 'bg-emerald-400'
        }`}></div>
      </div>

      {/* Top nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2.5">
          <CodePulseLogo size={36} />
          <span className="text-xl font-bold gradient-text">CodePulse</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg transition-colors ${
              isDark
                ? 'text-slate-400 hover:text-slate-200 hover:bg-dark-600'
                : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
            }`}
            title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          >
            {isDark ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Hero section */}
      <div className="relative z-10 flex flex-col items-center justify-center px-8 pt-16 pb-12 text-center">
        <div className="animate-fade-in">
          <div className="mb-6">
            <CodePulseLogo size={72} />
          </div>
          <h1 className={`text-5xl md:text-6xl font-bold tracking-tight mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Code<span className="gradient-text">Pulse</span>
          </h1>
          <p className={`text-xl md:text-2xl font-medium mb-3 ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
            AI Developer Intelligence Platform
          </p>
          <p className={`text-base max-w-xl mx-auto mb-10 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
            Analyze developer impact, trace business requirements to code changes, and detect knowledge concentration risks — all powered by AI.
          </p>
          <button
            id="start-analysis-btn"
            onClick={() => onNavigate('setup')}
            className={`group relative px-8 py-4 rounded-xl text-base font-semibold text-white transition-all duration-300 transform hover:scale-105 hover:shadow-2xl ${
              isDark
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-blue-500/25'
                : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:shadow-green-500/25'
            }`}
          >
            <span className="relative z-10 flex items-center gap-2">
              Start Analysis
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
          </button>
        </div>
      </div>

      {/* Feature cards */}
      <div className="relative z-10 max-w-5xl mx-auto px-8 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div
              key={f.title}
              className={`glass-card p-6 opacity-0 animate-slide-up stagger-${i + 2} group cursor-default`}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${isDark ? f.gradient : f.gradientLight} flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform`}>
                {f.icon}
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{f.title}</h3>
              <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Bottom tagline */}
        <div className="mt-16 text-center opacity-0 animate-slide-up stagger-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Powered by AI</span>
          </div>
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
            Built with sentence-transformers · Real-time GitHub integration · Smart risk detection
          </p>
        </div>
      </div>
    </div>
  );
}

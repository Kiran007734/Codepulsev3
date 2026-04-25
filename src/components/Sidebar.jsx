import React, { useState, memo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import CodePulseLogo from './CodePulseLogo';
import { useTheme } from '../context/ThemeContext';

const navItems = [
  { id: 'overview', icon: '🏠', label: 'Overview' },
  { id: 'impact', icon: '👥', label: 'Dev Impact' },
  { id: 'skills', icon: '🧠', label: 'Skills' },
  { id: 'mapping', icon: '🔗', label: 'Mapping' },
  { id: 'risk', icon: '⚠️', label: 'Risk' },
  { id: 'recommendations', icon: '💡', label: 'Actions' },
  { id: 'plan-reality', icon: '📋', label: 'Plan vs Real' },
  { id: 'divider', icon: '', label: '' },
  { id: 'predictive-risk', icon: '🎯', label: 'Predictive Risk' },
  { id: 'manager-hub', icon: '📊', label: 'Manager Hub' },
  { id: 'simulator', icon: '🧪', label: 'Simulator' },
  { id: 'interventions', icon: '🤖', label: 'Interventions' },
];


function Sidebar({ onSetup }) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className={`fixed left-0 top-0 h-screen backdrop-blur-xl flex flex-col z-30 transition-all duration-300 ease-out ${
        expanded ? 'w-56' : 'w-[72px]'
      } ${
        isDark
          ? 'bg-dark-800/90 border-r border-white/5'
          : 'bg-white/95 border-r border-black/5 shadow-lg shadow-black/5'
      }`}
    >
      {/* Logo */}
      <div
        className={`px-4 py-4 border-b flex items-center gap-2.5 h-16 lg:h-[72px] cursor-pointer select-none ${isDark ? 'border-white/5' : 'border-black/5'}`}
        onClick={() => navigate('/')}
        title="Go to Home"
      >
        <div className="flex-shrink-0">
          <CodePulseLogo size={30} />
        </div>
        <span className={`text-lg font-bold gradient-text whitespace-nowrap transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
          CodePulse
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-hidden">
        {navItems.map((item) => (
          item.id === 'divider' ? (
            <div key="divider" className={`my-2 mx-3 border-t ${isDark ? 'border-white/5' : 'border-black/5'}`} />
          ) : (
          <NavLink
            key={item.id}
            to={`/dashboard/${item.id}`}
            title={item.label}
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer w-full ${
              isActive
                ? 'active nav-item'
                : isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <span className="text-lg flex-shrink-0 w-6 text-center">{item.icon}</span>
            <span className={`whitespace-nowrap transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
              {item.label}
            </span>
          </NavLink>
          )
        ))}


        {/* Setup button */}
        {onSetup && (
          <button
            onClick={onSetup}
            title="Settings"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer w-full mt-3 ${
              isDark
                ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <span className="text-lg flex-shrink-0 w-6 text-center">⚙️</span>
            <span className={`whitespace-nowrap transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
              Settings
            </span>
          </button>
        )}
      </nav>

      {/* Bottom */}
      <div className={`p-3 border-t ${isDark ? 'border-white/5' : 'border-black/5'}`}>
        <div className={`rounded-lg p-2.5 ${
          isDark
            ? 'bg-gradient-to-r from-green-500/5 to-emerald-500/5 border border-green-500/10'
            : 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100'
        }`}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
            <span className={`text-[10px] font-medium whitespace-nowrap transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'} ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              AI Active
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default memo(Sidebar);

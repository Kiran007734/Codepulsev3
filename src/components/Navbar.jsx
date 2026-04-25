import React, { memo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

function Navbar({ repoName, onSetup }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const { logout, adminEmail } = useAuth();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);

  const handleSignOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayName = repoName || 'No repository connected';

  return (
    <header className={`fixed top-0 left-[72px] right-0 h-16 lg:h-[72px] backdrop-blur-xl flex items-center justify-between px-6 z-20 transition-colors duration-300 ${
      isDark
        ? 'bg-dark-800/60 border-b border-white/5'
        : 'bg-white/70 border-b border-black/5 shadow-sm'
    }`}>
      {/* Left — Breadcrumb */}
      <div className="flex items-center gap-3">
        <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>Dashboard</span>
        <span className={isDark ? 'text-slate-600' : 'text-gray-300'}>/</span>
        <span className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>Analytics</span>
      </div>

      {/* Center — Repository selector */}
      <button
        onClick={onSetup}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors ${
          isDark
            ? 'bg-dark-700/60 border border-white/5 hover:border-green-500/20'
            : 'bg-gray-50 border border-gray-200 hover:border-green-300'
        }`}
      >
        <div className={`w-2 h-2 rounded-full ${repoName ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
        <span className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>{displayName}</span>
        <svg className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Right — Theme toggle + notification + avatar */}
      <div className="flex items-center gap-3">
        {/* Theme Toggle */}
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

        {/* Notifications */}
        <div className="relative" ref={notificationRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className={`relative p-2 rounded-lg transition-colors ${
              isDark
                ? 'text-slate-400 hover:text-slate-200 hover:bg-dark-600'
                : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
            }`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-green-500 border border-transparent"></span>
          </button>

          {/* Messages Dropdown */}
          {showNotifications && (
            <div className={`absolute right-0 mt-2 w-80 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden border z-50 animate-in fade-in slide-in-from-top-2 duration-200 ${isDark ? 'bg-[#1a1f2e] border-white/10' : 'bg-white border-black/5'}`}>
              <div className={`px-4 py-3 border-b flex justify-between items-center ${isDark ? 'border-white/10' : 'border-black/5'}`}>
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>Notifications</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isDark ? 'bg-dark-700 text-green-400' : 'bg-green-50 text-green-600'}`}>2 New</span>
              </div>
              <div className="max-h-[320px] overflow-y-auto">
                <div className={`p-4 border-b transition-colors cursor-pointer ${isDark ? 'border-white/5 hover:bg-white/5' : 'border-black/5 hover:bg-gray-50'}`}>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>Analysis Complete</p>
                      <p className={`text-xs mt-0.5 leading-relaxed ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Repository scan finished successfully across 124 files.</p>
                      <p className={`text-[10px] mt-1.5 font-medium ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>2 mins ago</p>
                    </div>
                  </div>
                </div>
                <div className={`p-4 transition-colors cursor-pointer ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>System Update</p>
                      <p className={`text-xs mt-0.5 leading-relaxed ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>CodePulse models have been updated to v2.1.</p>
                      <p className={`text-[10px] mt-1.5 font-medium ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>1 hour ago</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className={`p-3 text-center text-xs font-medium cursor-pointer transition-colors ${isDark ? 'text-green-400 hover:bg-white/5 bg-[#1a1f2e]' : 'text-green-600 hover:bg-gray-50 bg-white'} border-t ${isDark ? 'border-white/10' : 'border-black/5'}`}>
                View All Activity
              </div>
            </div>
          )}
        </div>

        {/* Avatar + Sign Out */}
        <div className="flex items-center gap-2">
          <div
            title={adminEmail || 'Admin'}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm cursor-pointer"
          >
            {adminEmail ? adminEmail[0].toUpperCase() : 'A'}
          </div>
          <button
            id="navbar-signout-btn"
            onClick={handleSignOut}
            title="Sign Out"
            className={`p-2 rounded-lg transition-colors text-xs font-medium ${
              isDark
                ? 'text-slate-400 hover:text-red-400 hover:bg-red-500/10'
                : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

export default memo(Navbar);

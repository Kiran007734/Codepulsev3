/**
 * DeveloperLogin — Sign In only (accounts are created by Admin).
 * Credentials: username + password (format: username@123 for generated accounts).
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import CodePulseLogo from '../components/CodePulseLogo';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export default function DeveloperLogin() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const { devSignIn } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('Please enter your username and password.'); return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    const result = devSignIn(username.trim(), password);
    setLoading(false);
    if (!result.success) { setError(result.error); return; }
    navigate('/developer-dashboard', { replace: true });
  };

  const inputCls = `w-full px-4 py-3 rounded-lg text-sm outline-none transition-colors ${
    isDark
      ? 'bg-[#1a1f2e] border border-white/8 text-white placeholder-slate-500 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20'
      : 'bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-green-400 focus:ring-1 focus:ring-green-200'
  }`;

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${isDark ? 'bg-[#0b0f19]' : 'bg-gradient-to-br from-gray-50 to-emerald-50/30'}`}>
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full blur-[120px] opacity-15 ${isDark ? 'bg-emerald-700' : 'bg-green-400'}`} />
        <div className={`absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full blur-[120px] opacity-10 ${isDark ? 'bg-teal-800' : 'bg-emerald-300'}`} />
      </div>

      <nav className="relative z-10 flex items-center px-8 py-5">
        <Link to="/" className="flex items-center gap-2.5">
          <CodePulseLogo size={34} />
          <span className="text-xl font-bold gradient-text">CodePulse</span>
        </Link>
      </nav>

      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md animate-fade-in">

          {/* Badge */}
          <div className="text-center mb-7">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4 text-xs font-medium border ${
              isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600'
            }`}>💻 Developer Portal</div>
            <h1 className={`text-3xl font-bold mb-1.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>Developer Sign In</h1>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              Use the credentials provided by your admin
            </p>
          </div>

          {/* Form card */}
          <div className="glass-card p-8 space-y-5 opacity-0 animate-slide-up stagger-1">
            {error && (
              <div className={`p-3 rounded-lg text-sm font-medium ${
                isDark ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-red-50 border border-red-200 text-red-600'
              }`}>⚠️ {error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  GitHub Username
                </label>
                <input id="dev-username" type="text" value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your-github-username"
                  autoComplete="username" className={inputCls} />
              </div>

              <div>
                <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Password
                </label>
                <div className="relative">
                  <input id="dev-password" type={showPass ? 'text' : 'password'} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="username@123"
                    autoComplete="current-password" className={`${inputCls} pr-10`} />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'}`}>
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
                <p className={`text-xs mt-1.5 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                  Default format: <span className={`font-mono font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>username@123</span>
                </p>
              </div>

              <button id="dev-login-btn" type="submit" disabled={loading}
                className={`w-full py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.02] bg-gradient-to-r from-emerald-600 to-green-600 hover:shadow-emerald-500/25 hover:shadow-2xl ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}>
                {loading
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in…</>
                  : '💻 Sign In'
                }
              </button>
            </form>

            {/* Info box */}
            <div className={`p-3 rounded-lg text-xs ${isDark ? 'bg-blue-500/10 border border-blue-500/20 text-blue-300' : 'bg-blue-50 border border-blue-200 text-blue-700'}`}>
              ℹ️ Developer accounts are created by your admin from the GitHub repository contributors list.
            </div>

            <div className="text-center">
              <Link to="/login" className={`text-xs ${isDark ? 'text-slate-500 hover:text-slate-400' : 'text-gray-400 hover:text-gray-600'}`}>
                🛡️ Admin Login →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

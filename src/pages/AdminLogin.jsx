/**
 * AdminLogin — Sign In / Sign Up toggle for admin users.
 * After login:
 *   isSetupComplete == false → /connect-repo
 *   isSetupComplete == true  → /dashboard/overview
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import CodePulseLogo from '../components/CodePulseLogo';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export default function AdminLogin() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const { adminSignIn, adminSignUp } = useAuth();

  const [mode, setMode]         = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const isSignUp = mode === 'signup';

  const switchMode = (m) => { setMode(m); setError(''); setConfirm(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    if (isSignUp && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (isSignUp && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    await new Promise((r) => setTimeout(r, 600)); // simulate async

    const result = isSignUp
      ? adminSignUp(email.trim(), password)
      : adminSignIn(email.trim(), password);

    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    // Route based on setup status
    if (result.user.isSetupComplete) {
      navigate('/dashboard/overview', { replace: true });
    } else {
      navigate('/connect-repo', { replace: true });
    }
  };

  const inputCls = `w-full px-4 py-3 rounded-lg text-sm outline-none transition-colors ${
    isDark
      ? 'bg-dark-700 border border-white/10 text-white placeholder-slate-500 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20'
      : 'bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-200'
  }`;

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${isDark ? 'bg-dark-900' : 'bg-gradient-to-br from-gray-50 to-blue-50/30'}`}>
      {/* Ambient glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full blur-[120px] opacity-15 ${isDark ? 'bg-blue-600' : 'bg-blue-400'}`} />
        <div className={`absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full blur-[120px] opacity-10 ${isDark ? 'bg-purple-600' : 'bg-indigo-400'}`} />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center px-8 py-5">
        <Link to="/" className="flex items-center gap-2.5">
          <CodePulseLogo size={34} />
          <span className="text-xl font-bold gradient-text">CodePulse</span>
        </Link>
      </nav>

      {/* Card */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md animate-fade-in">

          {/* Header */}
          <div className="text-center mb-8">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4 text-xs font-medium border ${
              isDark ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-600'
            }`}>
              🛡️ Admin Portal
            </div>
            <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {isSignUp ? 'Create Admin Account' : 'Admin Sign In'}
            </h1>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              {isSignUp
                ? 'Set up your admin account to get started'
                : 'Sign in to access the command center'}
            </p>
          </div>

          {/* Toggle tabs */}
          <div className={`flex rounded-xl p-1 mb-6 ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
            {['signin', 'signup'].map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  mode === m
                    ? isDark
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'bg-white text-gray-900 shadow-sm'
                    : isDark
                    ? 'text-slate-500 hover:text-slate-300'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {m === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {/* Form card */}
          <div className="glass-card p-8 space-y-4 opacity-0 animate-slide-up stagger-1">
            {error && (
              <div className={`p-3 rounded-lg text-sm font-medium animate-fade-in ${
                isDark ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-red-50 border border-red-200 text-red-600'
              }`}>
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Email Address
                </label>
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@company.com"
                  autoComplete="email"
                  className={inputCls}
                />
              </div>

              {/* Password */}
              <div>
                <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Password
                </label>
                <input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  className={inputCls}
                />
              </div>

              {/* Confirm password (sign up only) */}
              {isSignUp && (
                <div className="animate-fade-in">
                  <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Confirm Password
                  </label>
                  <input
                    id="admin-confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className={inputCls}
                  />
                </div>
              )}

              {/* Submit */}
              <button
                id="admin-auth-btn"
                type="submit"
                disabled={loading}
                className={`w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-all duration-300 transform hover:scale-[1.02] hover:shadow-2xl flex items-center justify-center gap-2 mt-2 ${
                  loading
                    ? 'opacity-70 cursor-not-allowed'
                    : ''
                } bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-blue-500/25`}
              >
                {loading ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {isSignUp ? 'Creating account…' : 'Signing in…'}</>
                ) : (
                  <>{isSignUp ? '🚀 Create Account' : '🛡️ Sign In as Admin'}</>
                )}
              </button>
            </form>

            {/* Switch link */}
            <div className={`pt-4 border-t text-center text-sm ${isDark ? 'border-white/10 text-slate-400' : 'border-gray-100 text-gray-500'}`}>
              {isSignUp ? (
                <>Already have an account?{' '}<button onClick={() => switchMode('signin')} className="font-semibold text-blue-500 hover:text-blue-400 transition-colors">Sign In →</button></>
              ) : (
                <>Don't have an account?{' '}<button onClick={() => switchMode('signup')} className="font-semibold text-blue-500 hover:text-blue-400 transition-colors">Sign Up →</button></>
              )}
            </div>

            {/* Developer portal link */}
            <div className="text-center">
              <Link to="/developer-login" className={`text-xs transition-colors ${isDark ? 'text-slate-500 hover:text-slate-400' : 'text-gray-400 hover:text-gray-600'}`}>
                💻 Developer Login instead →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

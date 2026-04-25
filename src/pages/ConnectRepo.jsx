/**
 * ConnectRepo — First-time admin setup.
 * Fields: GitHub URL, Token, Jira (optional, accordion), Email Notifications (optional, accordion), Requirements.
 * Loading screen matches the dark card design with step rows and spinner.
 * Dynamic steps: Jira step only if jiraBaseUrl given; Email step only if notifyEmail given.
 */
import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import CodePulseLogo from '../components/CodePulseLogo';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { fetchRepository, analyzeRequirements, connectJira, sendEmailReport } from '../services/api';

/* ── base steps (always present) ─────────────────────────────── */
const BASE_STEPS = [
  { key: 'fetch',   label: 'Fetching commits…',           icon: '📡' },
  { key: 'reqs',    label: 'Processing requirements…',    icon: '🧠' },
  { key: 'impact',  label: 'Calculating impact scores…',  icon: '📊' },
  { key: 'risks',   label: 'Detecting risks…',            icon: '⚠️' },
];
const JIRA_STEP  = { key: 'jira',  label: 'Syncing Jira data…',           icon: '🔗' };
const EMAIL_STEP = { key: 'email', label: 'Sending email notifications…', icon: '✉️' };
const DONE_STEP  = { key: 'done',  label: 'Done ✓',                        icon: '✅' };

export default function ConnectRepo() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const { completeSetup, adminEmail, logout } = useAuth();
  const fileInputRef = useRef(null);

  /* ── form state ────────────────────────────────────────────── */
  const [repoUrl,          setRepoUrl]          = useState('');
  const [token,            setToken]            = useState('');
  const [requirementsText, setRequirementsText] = useState('');

  // Jira accordion
  const [jiraOpen,       setJiraOpen]       = useState(false);
  const [jiraBaseUrl,    setJiraBaseUrl]    = useState('');
  const [jiraEmail,      setJiraEmail]      = useState('');
  const [jiraToken,      setJiraToken]      = useState('');
  const [jiraProjectKey, setJiraProjectKey] = useState('');

  // Email accordion
  const [emailOpen,    setEmailOpen]    = useState(false);
  const [notifyEmail,  setNotifyEmail]  = useState('');
  const [sendEmail,    setSendEmail]    = useState(false);

  /* ── loading state ─────────────────────────────────────────── */
  const [isLoading,   setIsLoading]   = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [activeSteps, setActiveSteps] = useState([]);
  const [error,       setError]       = useState('');

  const hasJira  = jiraBaseUrl.trim() && jiraEmail.trim() && jiraToken.trim();
  const hasEmail = sendEmail && notifyEmail.trim();

  /* ── derive step list from inputs ──────────────────────────── */
  const buildSteps = () => {
    const steps = [...BASE_STEPS];
    if (hasJira)  steps.push(JIRA_STEP);
    if (hasEmail) steps.push(EMAIL_STEP);
    steps.push(DONE_STEP);
    return steps;
  };

  /* ── file upload ───────────────────────────────────────────── */
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      if (file.name.endsWith('.csv')) {
        const lines = text.split('\n').map((l) => l.split(',')[0]?.trim()).filter(Boolean);
        setRequirementsText((p) => p ? p + '\n' + lines.join('\n') : lines.join('\n'));
      } else {
        setRequirementsText((p) => p ? p + '\n' + text.trim() : text.trim());
      }
    };
    reader.readAsText(file);
  };

  /* ── submit ────────────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!repoUrl.trim()) { setError('Please enter a GitHub repository URL.'); return; }

    const steps = buildSteps();
    setActiveSteps(steps);
    setIsLoading(true);
    let idx = 0;

    try {
      // Fetch commits
      setCurrentStep(idx++);
      const repoData = await fetchRepository(repoUrl.trim(), token.trim());
      const repoId   = repoData.repo_id;
      localStorage.setItem('codepulse_repo_id',   String(repoId));
      localStorage.setItem('codepulse_repo_url',  repoUrl.trim());
      localStorage.setItem('codepulse_repo_name', repoData.repo);

      // Process requirements
      setCurrentStep(idx++);
      const reqs = requirementsText.split('\n').map((r) => r.trim()).filter(Boolean);
      if (reqs.length > 0) {
        await analyzeRequirements(reqs, repoId);
        localStorage.setItem('codepulse_requirements', JSON.stringify(reqs));
      } else {
        await new Promise((r) => setTimeout(r, 400));
      }

      // Impact scores (simulated)
      setCurrentStep(idx++); await new Promise((r) => setTimeout(r, 600));

      // Risk detection (simulated)
      setCurrentStep(idx++); await new Promise((r) => setTimeout(r, 600));

      // Jira (optional)
      if (hasJira) {
        setCurrentStep(idx++);
        try {
          await connectJira(jiraBaseUrl.trim(), jiraEmail.trim(), jiraToken.trim(), jiraProjectKey.trim() || null, repoId);
          localStorage.setItem('codepulse_jira_connected', 'true');
        } catch {
          localStorage.removeItem('codepulse_jira_connected');
        }
      }

      // Email (optional)
      if (hasEmail) {
        setCurrentStep(idx++);
        try {
          await sendEmailReport(repoId, notifyEmail.trim());
        } catch { /* non-blocking */ }
      }

      // Done
      setCurrentStep(idx);
      completeSetup(repoUrl.trim(), token.trim());
      await new Promise((r) => setTimeout(r, 900));
      navigate('/dashboard/overview', { replace: true });

    } catch (err) {
      setError(err.detail || err.message || 'Something went wrong. Please check your repo URL and try again.');
      setIsLoading(false);
      setCurrentStep(-1);
    }
  };

  /* ── shared classes ────────────────────────────────────────── */
  const inputCls = `w-full px-4 py-3 rounded-lg text-sm outline-none transition-colors ${
    isDark
      ? 'bg-[#1a1f2e] border border-white/8 text-white placeholder-slate-500 focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20'
      : 'bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-green-400 focus:ring-1 focus:ring-green-200'
  }`;

  const cardCls = `rounded-xl border ${
    isDark ? 'bg-[#141824] border-white/8' : 'bg-white border-gray-200'
  }`;

  const labelCls = `block text-sm font-semibold mb-2 ${isDark ? 'text-slate-200' : 'text-gray-800'}`;
  const hintCls  = `text-xs mt-1.5 ${isDark ? 'text-slate-500' : 'text-gray-400'}`;

  /* ── render ────────────────────────────────────────────────── */
  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-[#0b0f19]' : 'bg-gradient-to-br from-gray-50 to-slate-100'}`}>
      {/* ambient glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] rounded-full blur-[160px] opacity-8 bg-blue-700" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full blur-[120px] opacity-6 bg-purple-700" />
      </div>

      {/* nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5">
        <Link to="/" className="flex items-center gap-2.5">
          <CodePulseLogo size={32} />
          <span className="text-lg font-bold gradient-text">CodePulse</span>
        </Link>
        <div className="flex items-center gap-3">
          {adminEmail && (
            <span className={`text-xs font-medium px-3 py-1 rounded-full border ${
              isDark ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-600'
            }`}>🛡️ {adminEmail}</span>
          )}
          <button
            onClick={() => { logout(); navigate('/login', { replace: true }); }}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              isDark ? 'border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5' : 'border-gray-200 text-gray-500 hover:bg-gray-100'
            }`}
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* content */}
      <div className="relative z-10 max-w-2xl mx-auto px-6 pt-4 pb-20">

        {/* header */}
        <div className="mb-8 animate-fade-in">
          <h1 className={`text-[28px] font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Connect your repository
          </h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
            Enter your GitHub repo URL and business requirements to begin AI-powered analysis
          </p>
        </div>

        {/* ═══════════════════ LOADING SCREEN ═══════════════════ */}
        {isLoading && (
          <div className={`${cardCls} p-8 animate-fade-in`}>
            <h3 className={`text-xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Running Analysis...
            </h3>
            <div className="space-y-3">
              {activeSteps.map((s, i) => {
                const isDone    = i < currentStep;
                const isActive  = i === currentStep;
                const isPending = i > currentStep;
                return (
                  <div
                    key={s.key}
                    className={`flex items-center gap-4 px-5 py-3.5 rounded-xl border transition-all duration-500 ${
                      isDone
                        ? isDark ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-green-50 border-green-200'
                        : isActive
                        ? isDark ? 'bg-green-500/15 border-green-500/40 shadow-[0_0_20px_rgba(34,197,94,0.08)]' : 'bg-blue-50 border-blue-300'
                        : isDark ? 'bg-white/3 border-white/6' : 'bg-gray-50 border-gray-100'
                    }`}
                  >
                    <span className={`text-xl flex-shrink-0 transition-opacity duration-300 ${isPending ? 'opacity-30' : 'opacity-100'}`}>
                      {s.icon}
                    </span>
                    <span className={`text-sm font-medium flex-1 transition-colors duration-300 ${
                      isDone || isActive
                        ? isDark ? 'text-white' : 'text-gray-900'
                        : isDark ? 'text-slate-600' : 'text-gray-400'
                    }`}>
                      {s.label}
                    </span>
                    {isDone && (
                      <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {isActive && s.key !== 'done' && (
                      <div className="w-5 h-5 rounded-full border-2 border-t-transparent border-green-400 animate-spin flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* progress bar */}
            <div className={`mt-6 w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/8' : 'bg-gray-200'}`}>
              <div
                className="h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-green-500 to-emerald-400"
                style={{ width: `${Math.max(4, ((currentStep + 1) / activeSteps.length) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* ═══════════════════ FORM ═══════════════════ */}
        {!isLoading && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className={`p-4 rounded-xl text-sm font-medium ${
                isDark ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-red-50 border border-red-200 text-red-600'
              }`}>⚠️ {error}</div>
            )}

            {/* GitHub Repo URL */}
            <div className={`${cardCls} p-5 opacity-0 animate-slide-up stagger-1`}>
              <label className={labelCls}>GitHub Repository URL</label>
              <input
                id="repo-url-input"
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/CopilotForCode"
                className={inputCls}
              />
              <p className={hintCls}>Supports public and private repositories (with token)</p>
            </div>

            {/* GitHub Token */}
            <div className={`${cardCls} p-5 opacity-0 animate-slide-up stagger-2`}>
              <label className={labelCls}>
                GitHub Token{' '}
                <span className={`font-normal text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>(optional)</span>
              </label>
              <input
                id="github-token-input"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxx"
                className={inputCls}
              />
              <p className={hintCls}>Required for private repositories or to increase API rate limits</p>
            </div>

            {/* Jira Integration accordion */}
            <div className={`${cardCls} opacity-0 animate-slide-up stagger-3`}>
              <button
                type="button"
                onClick={() => setJiraOpen(!jiraOpen)}
                className="w-full flex items-center justify-between p-5"
              >
                <div className="text-left">
                  <span className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                    🔗 Jira Integration{' '}
                    <span className={`font-normal text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>(optional)</span>
                  </span>
                  <p className={hintCls}>Connect Jira to enable plan vs reality analysis</p>
                </div>
                <svg className={`w-5 h-5 transition-transform duration-200 flex-shrink-0 ${isDark ? 'text-slate-400' : 'text-gray-400'} ${jiraOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {jiraOpen && (
                <div className={`px-5 pb-5 space-y-3 border-t ${isDark ? 'border-white/6' : 'border-gray-100'}`}>
                  <div className="pt-4">
                    <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Jira Base URL</label>
                    <input id="jira-base-url" type="text" value={jiraBaseUrl} onChange={(e) => setJiraBaseUrl(e.target.value)}
                      placeholder="https://your-domain.atlassian.net" className={inputCls} />
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Jira Email</label>
                    <input id="jira-email" type="email" value={jiraEmail} onChange={(e) => setJiraEmail(e.target.value)}
                      placeholder="user@company.com" className={inputCls} />
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Jira API Token</label>
                    <input id="jira-api-token" type="password" value={jiraToken} onChange={(e) => setJiraToken(e.target.value)}
                      placeholder="••••••••••••••" className={inputCls} />
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                      Project Key <span className={`font-normal ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>(optional)</span>
                    </label>
                    <input id="jira-project-key" type="text" value={jiraProjectKey} onChange={(e) => setJiraProjectKey(e.target.value)}
                      placeholder="PROJ" className={inputCls} />
                  </div>
                </div>
              )}
            </div>

            {/* Email Notifications accordion */}
            <div className={`${cardCls} opacity-0 animate-slide-up stagger-4`}>
              <button
                type="button"
                onClick={() => setEmailOpen(!emailOpen)}
                className="w-full flex items-center justify-between p-5"
              >
                <div className="text-left">
                  <span className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                    ✉️ Email Notifications{' '}
                    <span className={`font-normal text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>(optional)</span>
                  </span>
                  <p className={hintCls}>Get automated project insights delivered to your inbox</p>
                </div>
                <svg className={`w-5 h-5 transition-transform duration-200 flex-shrink-0 ${isDark ? 'text-slate-400' : 'text-gray-400'} ${emailOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {emailOpen && (
                <div className={`px-5 pb-5 space-y-3 border-t ${isDark ? 'border-white/6' : 'border-gray-100'}`}>
                  <div className="pt-4">
                    <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Email Address</label>
                    <input id="notify-email-input" type="email" value={notifyEmail} onChange={(e) => setNotifyEmail(e.target.value)}
                      placeholder="manager@company.com" className={inputCls} />
                  </div>
                  <label htmlFor="send-email-checkbox"
                    className={`flex items-center gap-3 cursor-pointer select-none px-2 py-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/4' : 'hover:bg-gray-50'}`}>
                    <input id="send-email-checkbox" type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)}
                      className="w-4 h-4 rounded accent-green-500 cursor-pointer" />
                    <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Send automated project insights via email</span>
                  </label>
                  {sendEmail && !notifyEmail.trim() && (
                    <p className={`text-xs ${isDark ? 'text-yellow-400/70' : 'text-yellow-600'}`}>⚠️ Please enter an email address</p>
                  )}
                </div>
              )}
            </div>

            {/* Business Requirements */}
            <div className={`${cardCls} p-5 opacity-0 animate-slide-up stagger-4`}>
              <label className={labelCls}>
                Business Requirements{' '}
                <span className={`font-normal text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>(optional)</span>
              </label>
              <textarea
                id="requirements-textarea"
                value={requirementsText}
                onChange={(e) => setRequirementsText(e.target.value)}
                placeholder={`Enter one requirement per line, e.g.:\nAdd user authentication\nImplement payment gateway\nBuild product search feature`}
                rows={5}
                className={`${inputCls} resize-none`}
              />
              <div className="mt-3">
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors border ${
                    isDark ? 'bg-white/4 border-white/8 text-slate-300 hover:bg-white/8' : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'
                  }`}>
                  📎 Upload requirements (.txt / .csv)
                </button>
                <input ref={fileInputRef} type="file" accept=".txt,.csv" onChange={handleFileUpload} className="hidden" />
              </div>
            </div>

            {/* Submit */}
            <div className="opacity-0 animate-slide-up stagger-5 pt-1">
              <button
                id="run-analysis-btn"
                type="submit"
                className="w-full py-4 rounded-xl text-base font-semibold text-white transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl bg-gradient-to-r from-green-600 to-emerald-500 hover:shadow-green-500/30 flex items-center justify-center gap-2"
              >
                🚀 Run Analysis
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import CodePulseLogo from '../components/CodePulseLogo';
import { useTheme } from '../context/ThemeContext';
import { fetchRepository, analyzeRequirements, connectJira, sendEmailReport } from '../services/api';

export default function SetupPage({ onComplete }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const nav = useNavigate();

  const [repoUrl, setRepoUrl] = useState('');
  const [token, setToken] = useState('');
  const [requirementsText, setRequirementsText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  // Jira integration state
  const [jiraBaseUrl, setJiraBaseUrl] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [jiraProjectKey, setJiraProjectKey] = useState('');
  const [jiraExpanded, setJiraExpanded] = useState(false);
  const [jiraError, setJiraError] = useState('');

  // Email notification state
  const [notifyEmail, setNotifyEmail] = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const [emailExpanded, setEmailExpanded] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null); // null | 'sending' | {status, message}

  const hasJiraConfig = jiraBaseUrl.trim() && jiraEmail.trim() && jiraToken.trim();

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      if (file.name.endsWith('.csv')) {
        // Parse CSV — take first column of each row
        const lines = text.split('\n')
          .map(line => line.split(',')[0]?.trim())
          .filter(Boolean);
        setRequirementsText(prev => prev ? prev + '\n' + lines.join('\n') : lines.join('\n'));
      } else {
        setRequirementsText(prev => prev ? prev + '\n' + text.trim() : text.trim());
      }
    };
    reader.readAsText(file);
  };

  // Dynamic steps based on whether Jira is configured
  const getSteps = () => {
    const base = [
      { label: 'Fetching commits...', icon: '📡' },
      { label: 'Processing requirements...', icon: '🧠' },
    ];
    if (hasJiraConfig) {
      base.push({ label: 'Fetching Jira data...', icon: '🔗' });
    }
    base.push(
      { label: 'Calculating impact scores...', icon: '📊' },
      { label: 'Detecting risks...', icon: '⚠️' },
    );
    if (sendEmail && notifyEmail.trim()) {
      base.push({ label: 'Sending email report...', icon: '✉️' });
    }
    base.push(
      { label: 'Done ✓', icon: '✅' },
    );
    return base;
  };

  const activeSteps = getSteps();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setJiraError('');

    if (!repoUrl.trim()) {
      setError('Please enter a GitHub repository URL');
      return;
    }

    setIsLoading(true);
    let stepIdx = 0;

    try {
      // Step 1: Fetch commits
      setCurrentStep(stepIdx++);
      const repoData = await fetchRepository(repoUrl.trim(), token.trim());
      const repoId = repoData.repo_id;

      // Store in localStorage
      localStorage.setItem('codepulse_repo_id', String(repoId));
      localStorage.setItem('codepulse_repo_url', repoUrl.trim());
      localStorage.setItem('codepulse_repo_name', repoData.repo);

      // Step 2: Process requirements (if any)
      setCurrentStep(stepIdx++);
      const requirements = requirementsText
        .split('\n')
        .map(r => r.trim())
        .filter(Boolean);

      if (requirements.length > 0) {
        await analyzeRequirements(requirements, repoId);
        localStorage.setItem('codepulse_requirements', JSON.stringify(requirements));
      }

      // Step 2.5: Jira integration (optional, non-blocking)
      if (hasJiraConfig) {
        setCurrentStep(stepIdx++);
        try {
          const jiraResult = await connectJira(
            jiraBaseUrl.trim(),
            jiraEmail.trim(),
            jiraToken.trim(),
            jiraProjectKey.trim() || null,
            repoId
          );
          if (jiraResult.success) {
            localStorage.setItem('codepulse_jira_connected', 'true');
          } else {
            setJiraError(jiraResult.message || 'Jira connection failed');
            localStorage.removeItem('codepulse_jira_connected');
          }
        } catch (jiraErr) {
          // Jira failure should NOT block the analysis
          setJiraError(jiraErr.detail || jiraErr.message || 'Jira connection failed');
          localStorage.removeItem('codepulse_jira_connected');
        }
      }

      // Step 3: Impact scores (calculated on demand via dashboard)
      setCurrentStep(stepIdx++);
      await new Promise(r => setTimeout(r, 500));

      // Step 4: Risk detection (calculated on demand via dashboard)
      setCurrentStep(stepIdx++);
      await new Promise(r => setTimeout(r, 500));

      // Step 5 (optional): Send email report — awaited, with user feedback
      if (sendEmail && notifyEmail.trim()) {
        setCurrentStep(stepIdx++);
        setEmailStatus('sending');
        try {
          const emailResult = await sendEmailReport(repoId, notifyEmail.trim());
          if (emailResult.status === 'sent') {
            setEmailStatus({ status: 'sent', message: `Report sent to ${notifyEmail.trim()} via ${emailResult.method === 'n8n_webhook' ? 'n8n' : 'SMTP'}` });
          } else if (emailResult.status === 'failed') {
            setEmailStatus({ status: 'failed', message: emailResult.error || 'Email delivery failed' });
          } else {
            setEmailStatus({ status: 'skipped', message: emailResult.reason || 'Email skipped' });
          }
        } catch (emailErr) {
          setEmailStatus({ status: 'failed', message: emailErr.detail || emailErr.message || 'Email delivery failed' });
        }
        await new Promise(r => setTimeout(r, 800));
      }

      // Final step: Done
      setCurrentStep(stepIdx);
      await new Promise(r => setTimeout(r, 800));

      // Navigate to dashboard
      onComplete();
    } catch (err) {
      setError(err.detail || err.message || 'Something went wrong');
      setIsLoading(false);
      setCurrentStep(-1);
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-dark-900' : 'bg-gradient-to-br from-gray-50 to-emerald-50/30'}`}>
      {/* Ambient glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-1/4 right-1/4 w-[500px] h-[500px] rounded-full blur-[120px] opacity-10 ${
          isDark ? 'bg-blue-600' : 'bg-green-400'
        }`}></div>
      </div>

      {/* Top nav */}
      <nav className="relative z-10 flex items-center px-8 py-5">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => nav('/')}>
          <CodePulseLogo size={34} />
          <span className="text-xl font-bold gradient-text">CodePulse</span>
        </div>
      </nav>

      {/* Main content */}
      <div className="relative z-10 max-w-2xl mx-auto px-8 pt-8 pb-20">
        <div className="animate-fade-in mb-8">
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Connect your repository
          </h1>
          <p className={`text-sm mt-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
            Enter your GitHub repo URL and business requirements to begin AI-powered analysis
          </p>
        </div>

        {/* Loading overlay */}
        {isLoading && (
          <div className="glass-card p-8 mb-6 opacity-0 animate-slide-up stagger-1">
            <h3 className={`text-lg font-semibold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Running Analysis...
            </h3>
            <div className="space-y-3">
              {activeSteps.map((step, i) => (
                <div
                  key={step.label}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-500 ${
                    i < currentStep
                      ? isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-green-50 border border-green-200'
                      : i === currentStep
                        ? isDark ? 'bg-green-500/10 border border-green-500/20' : 'bg-blue-50 border border-blue-200'
                        : isDark ? 'bg-dark-700/30 border border-white/5' : 'bg-gray-50 border border-gray-100'
                  }`}
                >
                  <span className="text-lg">{step.icon}</span>
                  <span className={`text-sm font-medium flex-1 ${
                    i <= currentStep
                      ? isDark ? 'text-white' : 'text-gray-900'
                      : isDark ? 'text-slate-500' : 'text-gray-400'
                  }`}>
                    {step.label}
                  </span>
                  {i < currentStep && (
                    <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {i === currentStep && i < activeSteps.length - 1 && (
                    <div className={`w-5 h-5 rounded-full border-2 border-t-transparent animate-spin ${
                      isDark ? 'border-green-400' : 'border-blue-500'
                    }`}></div>
                  )}
                </div>
              ))}
            </div>
            {/* Jira warning (non-blocking) */}
            {jiraError && (
              <div className={`mt-4 p-3 rounded-lg text-xs font-medium ${
                isDark
                  ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
                  : 'bg-yellow-50 border border-yellow-200 text-yellow-700'
              }`}>
                ⚠️ Jira: {jiraError} (GitHub analysis continued)
              </div>
            )}
            {/* Email status feedback */}
            {emailStatus && emailStatus !== 'sending' && (
              <div className={`mt-4 p-3 rounded-lg text-xs font-medium ${
                emailStatus.status === 'sent'
                  ? isDark
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    : 'bg-green-50 border border-green-200 text-green-700'
                  : emailStatus.status === 'failed'
                    ? isDark
                      ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                      : 'bg-red-50 border border-red-200 text-red-700'
                    : isDark
                      ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
                      : 'bg-yellow-50 border border-yellow-200 text-yellow-700'
              }`}>
                {emailStatus.status === 'sent' ? '✅' : emailStatus.status === 'failed' ? '❌' : '⚠️'}{' '}
                Email: {emailStatus.message}
              </div>
            )}
            {/* Progress bar */}
            <div className={`mt-6 w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-dark-700' : 'bg-gray-200'}`}>
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  isDark
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                    : 'bg-gradient-to-r from-green-500 to-emerald-500'
                }`}
                style={{ width: `${((currentStep + 1) / activeSteps.length) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Form */}
        {!isLoading && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error message */}
            {error && (
              <div className={`p-4 rounded-xl text-sm font-medium animate-fade-in ${
                isDark
                  ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                  : 'bg-red-50 border border-red-200 text-red-600'
              }`}>
                ⚠️ {error}
              </div>
            )}

            {/* Repo URL */}
            <div className="glass-card p-6 opacity-0 animate-slide-up stagger-1">
              <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                GitHub Repository URL
              </label>
              <input
                id="repo-url-input"
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/org/repo"
                className={`w-full px-4 py-3 rounded-lg text-sm transition-colors ${
                  isDark
                    ? 'bg-dark-700 border border-white/10 text-white placeholder-slate-500 focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20'
                    : 'bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-green-400 focus:ring-1 focus:ring-green-200'
                } outline-none`}
              />
              <p className={`text-xs mt-2 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                Supports public and private repositories (with token)
              </p>
            </div>

            {/* GitHub Token (optional) */}
            <div className="glass-card p-6 opacity-0 animate-slide-up stagger-2">
              <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                GitHub Token <span className={`font-normal ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>(optional)</span>
              </label>
              <input
                id="github-token-input"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxx"
                className={`w-full px-4 py-3 rounded-lg text-sm transition-colors ${
                  isDark
                    ? 'bg-dark-700 border border-white/10 text-white placeholder-slate-500 focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20'
                    : 'bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-green-400 focus:ring-1 focus:ring-green-200'
                } outline-none`}
              />
              <p className={`text-xs mt-2 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                Required for private repositories or to increase API rate limits
              </p>
            </div>

            {/* Jira Integration (Optional) */}
            <div className="glass-card p-6 opacity-0 animate-slide-up stagger-3">
              <button
                type="button"
                onClick={() => setJiraExpanded(!jiraExpanded)}
                className="w-full flex items-center justify-between"
              >
                <div>
                  <label className={`block text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'} cursor-pointer`}>
                    🔗 Jira Integration <span className={`font-normal ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>(optional)</span>
                  </label>
                  <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                    Connect Jira to enable plan vs reality analysis
                  </p>
                </div>
                <svg
                  className={`w-5 h-5 transition-transform duration-200 ${isDark ? 'text-slate-400' : 'text-gray-500'} ${jiraExpanded ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {jiraExpanded && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                      Jira Base URL
                    </label>
                    <input
                      id="jira-base-url"
                      type="text"
                      value={jiraBaseUrl}
                      onChange={(e) => setJiraBaseUrl(e.target.value)}
                      placeholder="https://your-domain.atlassian.net"
                      className={`w-full px-4 py-3 rounded-lg text-sm transition-colors ${
                        isDark
                          ? 'bg-dark-700 border border-white/10 text-white placeholder-slate-500 focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20'
                          : 'bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-green-400 focus:ring-1 focus:ring-green-200'
                      } outline-none`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                      Jira Email
                    </label>
                    <input
                      id="jira-email"
                      type="email"
                      value={jiraEmail}
                      onChange={(e) => setJiraEmail(e.target.value)}
                      placeholder="user@company.com"
                      className={`w-full px-4 py-3 rounded-lg text-sm transition-colors ${
                        isDark
                          ? 'bg-dark-700 border border-white/10 text-white placeholder-slate-500 focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20'
                          : 'bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-green-400 focus:ring-1 focus:ring-green-200'
                      } outline-none`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                      Jira API Token
                    </label>
                    <input
                      id="jira-api-token"
                      type="password"
                      value={jiraToken}
                      onChange={(e) => setJiraToken(e.target.value)}
                      placeholder="••••••••••••••"
                      className={`w-full px-4 py-3 rounded-lg text-sm transition-colors ${
                        isDark
                          ? 'bg-dark-700 border border-white/10 text-white placeholder-slate-500 focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20'
                          : 'bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-green-400 focus:ring-1 focus:ring-green-200'
                      } outline-none`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                      Project Key <span className={`font-normal ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>(optional)</span>
                    </label>
                    <input
                      id="jira-project-key"
                      type="text"
                      value={jiraProjectKey}
                      onChange={(e) => setJiraProjectKey(e.target.value)}
                      placeholder="PROJ"
                      className={`w-full px-4 py-3 rounded-lg text-sm transition-colors ${
                        isDark
                          ? 'bg-dark-700 border border-white/10 text-white placeholder-slate-500 focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20'
                          : 'bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-green-400 focus:ring-1 focus:ring-green-200'
                      } outline-none`}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Email Notifications (Optional) */}
            <div className="glass-card p-6 opacity-0 animate-slide-up stagger-3">
              <button
                type="button"
                onClick={() => setEmailExpanded(!emailExpanded)}
                className="w-full flex items-center justify-between"
              >
                <div>
                  <label className={`block text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'} cursor-pointer`}>
                    ✉️ Email Notifications <span className={`font-normal ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>(optional)</span>
                  </label>
                  <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                    Get automated project insights delivered to your inbox
                  </p>
                </div>
                <svg
                  className={`w-5 h-5 transition-transform duration-200 ${isDark ? 'text-slate-400' : 'text-gray-500'} ${emailExpanded ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {emailExpanded && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                      Email Address
                    </label>
                    <input
                      id="notify-email-input"
                      type="email"
                      value={notifyEmail}
                      onChange={(e) => setNotifyEmail(e.target.value)}
                      placeholder="manager@company.com"
                      className={`w-full px-4 py-3 rounded-lg text-sm transition-colors ${
                        isDark
                          ? 'bg-dark-700 border border-white/10 text-white placeholder-slate-500 focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20'
                          : 'bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-green-400 focus:ring-1 focus:ring-green-200'
                      } outline-none`}
                    />
                  </div>
                  <label
                    htmlFor="send-email-checkbox"
                    className={`flex items-center gap-3 cursor-pointer select-none px-3 py-2.5 rounded-lg transition-colors ${
                      isDark ? 'hover:bg-dark-700/50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      id="send-email-checkbox"
                      type="checkbox"
                      checked={sendEmail}
                      onChange={(e) => setSendEmail(e.target.checked)}
                      className={`w-4 h-4 rounded border-2 transition-colors cursor-pointer ${
                        isDark
                          ? 'border-white/20 bg-dark-700 accent-blue-500'
                          : 'border-gray-300 bg-white accent-green-600'
                      }`}
                    />
                    <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                      Send automated project insights via email
                    </span>
                  </label>
                  {sendEmail && !notifyEmail.trim() && (
                    <p className={`text-xs px-1 ${isDark ? 'text-yellow-400/70' : 'text-yellow-600'}`}>
                      ⚠️ Please enter an email address to receive notifications
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Business Requirements */}
            <div className="glass-card p-6 opacity-0 animate-slide-up stagger-4">
              <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Business Requirements
              </label>
              <textarea
                id="requirements-textarea"
                value={requirementsText}
                onChange={(e) => setRequirementsText(e.target.value)}
                placeholder="Enter one requirement per line, e.g.:\nAdd user authentication\nImplement payment gateway\nBuild product search feature"
                rows={6}
                className={`w-full px-4 py-3 rounded-lg text-sm resize-none transition-colors ${
                  isDark
                    ? 'bg-dark-700 border border-white/10 text-white placeholder-slate-500 focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20'
                    : 'bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-green-400 focus:ring-1 focus:ring-green-200'
                } outline-none`}
              />

              {/* File upload */}
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isDark
                      ? 'bg-dark-600 border border-white/10 text-slate-300 hover:bg-dark-500'
                      : 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  📎 Upload requirements (.txt / .csv)
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Submit button */}
            <div className="opacity-0 animate-slide-up stagger-5">
              <button
                id="run-analysis-btn"
                type="submit"
                className={`w-full py-4 rounded-xl text-base font-semibold text-white transition-all duration-300 transform hover:scale-[1.02] hover:shadow-2xl ${
                  isDark
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:shadow-green-500/25'
                    : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:shadow-green-500/25'
                }`}
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

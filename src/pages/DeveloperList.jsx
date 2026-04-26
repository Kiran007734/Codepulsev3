/**
 * DevManagement — Admin section: Generate & manage developer accounts from GitHub contributors.
 * Route: /dashboard/developers
 *
 * Email fetching:
 *  - Each developer card fetches email from GitHub API on-demand (lazy, on expand/hover)
 *  - Email is NEVER stored, displayed only, used only for "Send Report"
 *  - "Send Report" is disabled if GitHub email is null/private
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const API = import.meta.env.PROD
  ? `${import.meta.env.VITE_API_BASE_URL || ''}/api`
  : '/api';

function parseRepoPath(url) {
  try {
    const clean = url.replace(/\.git$/, '').replace(/\/$/, '');
    const parts = clean.split('github.com/');
    if (parts.length < 2) return null;
    const segs = parts[1].split('/').filter(Boolean);
    if (segs.length < 2) return null;
    return `${segs[0]}/${segs[1]}`;
  } catch { return null; }
}

/** Fetch a single user's public profile (includes email if public) */
async function fetchGithubProfile(username, token) {
  const url = `${API}/github/proxy/users/${username}`;
  const r = await fetch(url);
  if (r.status === 403) throw new Error("GitHub access denied or rate limit exceeded");
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  return r.json();
}

/** Compute a simple impact score for one contributor */
function computeImpact(profile, contributions) {
  const repoScore  = Math.min(30, (profile?.public_repos || 0) * 1.5);
  const follScore  = Math.min(20, (profile?.followers   || 0) * 0.5);
  const starScore  = 0; // no star data at list level
  const contrScore = Math.min(30, (contributions || 0) * 0.5);
  return Math.round(repoScore + follScore + starScore + contrScore);
}

/** Per-developer row with lazy email fetch + Send Report */
function DevRow({ dev, isDark, repoToken, repoPath, navigate, cardCls, onSuccess, onError }) {
  const [profile,    setProfile]   = useState(null);
  const [emailState, setEmailState] = useState('idle'); // idle | loading | found | missing | error
  const [expanded,   setExpanded]  = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const fetchedRef = useRef(false);

  const githubHandle = dev.githubUsername || dev.username;
  const githubEmail  = profile?.email || null;
  const emailOk      = !!githubEmail && githubEmail.trim() !== '';

  /** Lazy-load GitHub profile when row is expanded */
  const loadProfile = useCallback(async () => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    setEmailState('loading');
    try {
      const prof = await fetchGithubProfile(githubHandle, repoToken);
      let email = prof.email;
      
      // Fallback: If no public email, search recent commits
      if (!email && repoPath) {
        try {
          const commitsUrl = `${API}/github/proxy/repos/${repoPath}/commits?author=${githubHandle}&per_page=50`;
          const commitsResp = await fetch(commitsUrl);
          if (commitsResp.ok) {
            const commits = await commitsResp.json();
            for (const c of commits) {
              const authorEmail = c.commit?.author?.email;
              // Ignore bot emails and noreply
              if (authorEmail && !authorEmail.includes('noreply.github.com') && !authorEmail.includes('[bot]') && authorEmail.includes('@')) {
                email = authorEmail;
                prof.email = email; // Attach to profile so it renders correctly
                break;
              }
            }
          }
        } catch (e) {
          // Silently ignore fallback failure
        }
      }
      
      setProfile(prof);
      setEmailState(email ? 'found' : 'missing');
    } catch {
      setEmailState('error');
    }
  }, [githubHandle, repoToken, repoPath]);

  const handleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) loadProfile();
  };

  const handleSendReport = async (e) => {
    e.stopPropagation();
    if (!emailOk) return;
    setSendingReport(true);
    if (onSuccess) onSuccess('');
    if (onError) onError('');
    try {
      const res = await fetch(`${API}/api/developer/send-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: githubHandle, email: githubEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to send report');
      if (onSuccess) onSuccess(`Report sent successfully to ${githubEmail}`);
    } catch (err) {
      if (onError) onError(err.message || 'Failed to send report');
    } finally {
      setSendingReport(false);
    }
  };



  const emailBadgeCls = emailState === 'found'
    ? isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
    : emailState === 'missing'
    ? isDark ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'    : 'bg-yellow-50 border-yellow-200 text-yellow-700'
    : isDark ? 'bg-white/5 border-white/8 text-slate-500'                 : 'bg-gray-50 border-gray-100 text-gray-400';

  const emailText =
    emailState === 'loading' ? '⏳ Fetching email…'
    : emailState === 'found'   ? `✉️ ${githubEmail}`
    : emailState === 'missing' ? '⚠️ Email not publicly available for this developer'
    : emailState === 'error'   ? '❌ Could not fetch profile'
    : '— Click row to fetch email';

  return (
    <>
      {/* Main row */}
      <tr
        className={`transition-colors cursor-pointer ${isDark ? 'hover:bg-white/3' : 'hover:bg-gray-50/80'} ${expanded ? (isDark ? 'bg-white/4' : 'bg-emerald-50/30') : ''}`}
        onClick={handleExpand}
      >
        {/* Avatar + name */}
        <td className="px-5 py-3">
          <div className="flex items-center gap-3">
            {dev.avatarUrl ? (
              <img src={dev.avatarUrl} alt={dev.username}
                className="w-9 h-9 rounded-full ring-2 ring-emerald-500/20 flex-shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-sm text-white font-bold flex-shrink-0">
                {dev.username[0].toUpperCase()}
              </div>
            )}
            <div>
              <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>{dev.username}</p>
              {dev.autoGenerated && (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${isDark ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                  auto
                </span>
              )}
            </div>
          </div>
        </td>

        {/* GitHub username */}
        <td className="px-5 py-3">
          <code className={`text-xs px-2 py-1 rounded font-mono ${isDark ? 'bg-white/5 text-slate-300' : 'bg-gray-100 text-gray-700'}`}>
            @{githubHandle}
          </code>
        </td>

        {/* Email status badge */}
        <td className="px-5 py-3">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${emailBadgeCls}`}>
            {emailText}
          </span>
        </td>

        {/* Contributions */}
        <td className="px-5 py-3">
          {dev.contributions != null ? (
            <div className="flex items-center gap-2">
              <div className={`w-16 h-1.5 rounded-full ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                <div className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${Math.min(100, (dev.contributions / Math.max(1, dev.contributions)) * 100)}%` }} />
              </div>
              <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                {dev.contributions.toLocaleString()}
              </span>
            </div>
          ) : (
            <span className={`text-xs ${isDark ? 'text-slate-600' : 'text-gray-300'}`}>—</span>
          )}
        </td>

        {/* Actions */}
        <td className="px-5 py-3">
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              disabled={!emailOk || sendingReport}
              onClick={handleSendReport}
              title={!emailOk ? 'No email available' : 'Send PDF report'}
              className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                emailOk && !sendingReport
                  ? isDark
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20'
                    : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                  : 'opacity-50 cursor-not-allowed bg-slate-600/30 text-slate-400 border border-transparent'
              }`}
            >
              {sendingReport ? '⏳ Sending…' : '📧 Send Report'}
            </button>
            {/* View Profile — send/download actions live inside the profile page */}
            <button
              onClick={() => navigate(`/dashboard/developers/${githubHandle}`)}
              className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                isDark
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              👤 View Profile →
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className={isDark ? 'bg-[#0f1420]' : 'bg-emerald-50/20'}>
          <td colSpan={5} className="px-6 py-4">
            <div className="flex flex-wrap items-start gap-4">
              {/* Profile details */}
              {profile && (
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <img src={profile.avatar_url} alt={githubHandle}
                    className="w-12 h-12 rounded-xl ring-2 ring-emerald-500/20 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {profile.name || githubHandle}
                    </p>
                    {profile.bio && (
                      <p className={`text-xs mt-0.5 truncate max-w-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                        {profile.bio}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                      <span>📦 {profile.public_repos} repos</span>
                      <span>👥 {profile.followers} followers</span>
                      {profile.location && <span>📍 {profile.location}</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* Email status (read-only) */}
              <div className="flex flex-col gap-2 flex-shrink-0">
                <div className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${emailBadgeCls}`}>
                  {emailText}
                </div>
                {emailState === 'missing' && (
                  <p className={`text-[10px] ${isDark ? 'text-yellow-400/70' : 'text-yellow-600'}`}>
                    No public email on GitHub.
                  </p>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function DevManagement() {
  const { theme }  = useTheme();
  const isDark     = theme === 'dark';
  const navigate   = useNavigate();
  const { adminUser, generateDevUsers, getAllDevUsers } = useAuth();

  const [devs,       setDevs]       = useState([]);
  const [generating, setGenerating] = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState('');
  const [search,     setSearch]     = useState('');

  const repoUrl   = localStorage.getItem('codepulse_repo_url') || adminUser?.repoUrl || '';
  const repoToken = adminUser?.githubToken || '';
  const repoPath  = parseRepoPath(repoUrl);

  // Load stored devs on mount
  useEffect(() => { setDevs(getAllDevUsers()); }, [getAllDevUsers]);

  const handleGenerate = useCallback(async () => {
    if (!repoPath) { setError('No GitHub repository connected. Please complete setup first.'); return; }
    setGenerating(true); setError(''); setSuccess('');
    try {
      const url = `${API}/github/proxy/repos/${repoPath}/contributors?per_page=100&anon=false`;
      const r = await fetch(url);
      if (r.status === 403) throw new Error("GitHub access denied or rate limit exceeded");
      if (r.status === 404) throw new Error(`Repository "${repoPath}" not found or is private (add a GitHub token in setup).`);
      if (!r.ok) throw new Error(`GitHub API error: ${r.status} ${r.statusText}`);
      const contributors = await r.json();
      if (!Array.isArray(contributors) || contributors.length === 0) {
        throw new Error('No contributors found in this repository.');
      }
      const merged = generateDevUsers(contributors);
      setDevs(merged);
      setSuccess(`Generated ${contributors.length} developer account(s) from ${repoPath}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }, [repoPath, repoToken, generateDevUsers]);

  const filtered = devs.filter((d) =>
    d.username.toLowerCase().includes(search.toLowerCase()) ||
    (d.githubUsername || '').toLowerCase().includes(search.toLowerCase())
  );

  const autoCount   = devs.filter((d) => d.autoGenerated).length;
  const manualCount = devs.filter((d) => !d.autoGenerated).length;

  const cardCls  = `rounded-xl border ${isDark ? 'bg-[#141824] border-white/8' : 'bg-white border-gray-200'}`;
  const inputCls = `px-4 py-2.5 rounded-lg text-sm outline-none w-64 transition-colors ${
    isDark ? 'bg-[#1a1f2e] border border-white/8 text-white placeholder-slate-500 focus:border-emerald-500/40'
           : 'bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-emerald-400'
  }`;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Developer Management
          </h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
            {repoPath
              ? <><span>Connected repo: </span><span className="font-mono font-medium text-emerald-400">{repoPath}</span></>
              : <span className="text-yellow-400">⚠️ No repository connected — complete setup first</span>
            }
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleGenerate} disabled={generating || !repoPath}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg ${
              generating || !repoPath
                ? 'opacity-50 cursor-not-allowed bg-slate-600'
                : 'bg-gradient-to-r from-emerald-600 to-green-600 hover:shadow-emerald-500/20'
            }`}>
            {generating
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Fetching…</>
              : <><span>🚀</span> Generate Developers from GitHub</>
            }
          </button>
          {devs.length > 0 && (
            <button onClick={handleGenerate} disabled={generating}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium border flex items-center gap-2 transition-colors ${
                isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              🔄 Regenerate
            </button>
          )}
        </div>
      </div>

      {/* ── Info banner ── */}
      <div className={`p-3.5 rounded-xl text-xs font-medium border flex items-center gap-2.5 ${
        isDark ? 'bg-blue-500/8 border-blue-500/15 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-700'
      }`}>
        <span className="text-base">🔐</span>
        <span>
          Developer emails are fetched live from the GitHub API. They are <strong>never stored</strong>.
          Click any row to load the email for that developer. "Send Report" is only enabled when a public email exists.
        </span>
      </div>

      {/* ── Alerts ── */}
      {error && (
        <div className={`p-4 rounded-xl text-sm font-medium border ${isDark ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-200 text-red-600'}`}>
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div className={`p-4 rounded-xl text-sm font-medium border ${isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          ✅ {success}
        </div>
      )}

      {/* ── Stats row ── */}
      {devs.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Developers', value: devs.length,  color: 'text-emerald-400' },
            { label: 'Auto-Generated',   value: autoCount,    color: 'text-blue-400'    },
            { label: 'Manual Accounts',  value: manualCount,  color: 'text-purple-400'  },
          ].map((s) => (
            <div key={s.label} className={`${cardCls} p-4 text-center`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Developer list ── */}
      {devs.length > 0 && (
        <div className={cardCls}>
          {/* Table header */}
          <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-white/6' : 'border-gray-100'}`}>
            <div>
              <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Developer Accounts ({filtered.length})
              </h2>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                Click a row to expand and fetch GitHub email
              </p>
            </div>
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search developers…" className={inputCls} />
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                  {['Developer', 'GitHub Handle', 'Email Status', 'Contributions', 'Actions'].map((h) => (
                    <th key={h} className={`px-5 py-3 text-left border-b ${isDark ? 'border-white/6' : 'border-gray-100'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/4">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={`px-5 py-8 text-center text-sm ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                      No developers match your search
                    </td>
                  </tr>
                ) : filtered.map((dev) => (
                  <DevRow
                    key={dev.username}
                    dev={dev}
                    isDark={isDark}
                    repoToken={repoToken}
                    repoPath={repoPath}
                    navigate={navigate}
                    cardCls={cardCls}
                    onSuccess={setSuccess}
                    onError={setError}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {devs.length === 0 && !generating && (
        <div className={`${cardCls} p-14 text-center`}>
          <p className="text-5xl mb-4">👨‍💻</p>
          <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>No developers yet</h3>
          <p className={`text-sm mb-6 max-w-sm mx-auto ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
            Click <strong>"Generate Developers from GitHub"</strong> to automatically create developer accounts from your repository contributors.
          </p>
          {repoPath ? (
            <button onClick={handleGenerate}
              className="px-6 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-green-600 hover:shadow-lg hover:shadow-emerald-500/20 transition-all duration-200 hover:scale-[1.02]">
              🚀 Generate Developers from GitHub
            </button>
          ) : (
            <p className={`text-sm ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
              ⚠️ Connect a repository in Settings first
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * DeveloperView — Admin view of a single developer's GitHub data.
 * Route: /dashboard/developers/:githubUsername
 * Features:
 *  - Fetches email from GitHub API (never stored)
 *  - "Send Report" button disabled + message if email unavailable
 *  - PDF download always available
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

const GH   = 'https://api.github.com';
const API  = '';  // Uses Vite proxy (vite.config.js proxies /api → localhost:8000)

const gh = async (p) => {
  const r = await fetch(`${GH}${p}`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!r.ok) throw new Error(r.status);
  return r.json();
};

const timeAgo = (iso) => {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const EVT_ICON  = { PushEvent: '📝', PullRequestEvent: '🔀', IssuesEvent: '🐛', WatchEvent: '⭐', ForkEvent: '🍴' };
const EVT_LABEL = (e) =>
  ({ PushEvent: `Pushed to ${e.repo?.name}`, PullRequestEvent: `PR ${e.payload?.action} in ${e.repo?.name}`,
     IssuesEvent: `Issue ${e.payload?.action} in ${e.repo?.name}`, WatchEvent: `Starred ${e.repo?.name}`, ForkEvent: `Forked ${e.repo?.name}` }[e.type] || e.type);

const LC = ['bg-emerald-500','bg-blue-500','bg-purple-500','bg-yellow-500','bg-red-500','bg-pink-500'];

/** Compute impact score 0–100 from GitHub data */
function computeImpactScore(profile, repos, events) {
  const commits   = events.filter((e) => e.type === 'PushEvent').reduce((s, e) => s + (e.payload?.commits?.length || 0), 0);
  const stars     = repos.reduce((s, r) => s + r.stargazers_count, 0);
  const repoScore = Math.min(30, (profile?.public_repos || 0) * 1.5);
  const commScore = Math.min(30, commits * 3);
  const starScore = Math.min(20, stars * 0.5);
  const follScore = Math.min(20, (profile?.followers || 0) * 0.5);
  return Math.round(repoScore + commScore + starScore + follScore);
}

/** Build payload for backend API */
function buildPayload(profile, repos, events, langs, githubUsername) {
  const totalStars   = repos.reduce((s, r) => s + r.stargazers_count, 0);
  const totalForks   = repos.reduce((s, r) => s + r.forks_count, 0);
  const commitCount  = events.filter((e) => e.type === 'PushEvent').reduce((s, e) => s + (e.payload?.commits?.length || 0), 0);
  const impactScore  = computeImpactScore(profile, repos, events);
  const topRepos     = [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 8)
    .map((r) => ({ name: r.name, stars: r.stargazers_count, forks: r.forks_count, language: r.language, description: r.description }));
  const recentAct    = events.slice(0, 10).map((e) => ({ type: e.type, repo: e.repo?.name, created_at: e.created_at }));
  const actSummary   = `@${githubUsername} has ${profile?.public_repos || 0} public repositories with ${totalStars} total stars. ` +
    `${commitCount} recent commits were recorded across active repositories. ` +
    `Top languages: ${Object.keys(langs).slice(0, 3).join(', ') || 'N/A'}.`;

  return {
    username: githubUsername, name: profile?.name, bio: profile?.bio,
    location: profile?.location, email: profile?.email || null,
    public_repos: profile?.public_repos || 0, followers: profile?.followers || 0,
    following: profile?.following || 0, total_stars: totalStars, total_forks: totalForks,
    commit_count: commitCount, impact_score: impactScore, activity_summary: actSummary,
    languages: langs, top_repos: topRepos, recent_activity: recentAct,
  };
}

export default function DeveloperView() {
  const { githubUsername } = useParams();
  const { theme } = useTheme();
  const isDark   = theme === 'dark';
  const navigate = useNavigate();

  const [profile,   setProfile]   = useState(null);
  const [repos,     setRepos]     = useState([]);
  const [events,    setEvents]    = useState([]);
  const [langs,     setLangs]     = useState({});
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  // Report state
  const [sending,   setSending]   = useState(false);
  const [sendMsg,   setSendMsg]   = useState('');
  const [sendErr,   setSendErr]   = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!githubUsername) return;
    let cancelled = false;
    (async () => {
      try {
        const [prof, repoList, evts] = await Promise.all([
          gh(`/users/${githubUsername}`),
          gh(`/users/${githubUsername}/repos?per_page=100&sort=updated`),
          gh(`/users/${githubUsername}/events?per_page=30`),
        ]);
        if (cancelled) return;
        setProfile(prof);
        setRepos(repoList);
        setEvents(evts);
        const lm = {};
        repoList.forEach((r) => { if (r.language) lm[r.language] = (lm[r.language] || 0) + 1; });
        setLangs(lm);
      } catch (e) { if (!cancelled) setError(e.message); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [githubUsername]);

  const payload = profile ? buildPayload(profile, repos, events, langs, githubUsername) : null;

  const totalStars  = repos.reduce((s, r) => s + r.stargazers_count, 0);
  const commitCount = events.filter((e) => e.type === 'PushEvent').reduce((s, e) => s + (e.payload?.commits?.length || 0), 0);
  const sortedLangs = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const impactScore = profile ? computeImpactScore(profile, repos, events) : null;
  const impactColor = impactScore >= 70 ? 'text-emerald-400' : impactScore >= 40 ? 'text-yellow-400' : 'text-red-400';
  const impactBg    = impactScore >= 70 ? 'bg-emerald-500' : impactScore >= 40 ? 'bg-yellow-500' : 'bg-red-500';

  // GitHub email status
  const githubEmail    = profile?.email;
  const emailAvailable = !!githubEmail && githubEmail.trim() !== '';

  const handleSendReport = useCallback(async () => {
    if (!payload || !emailAvailable) return;
    setSending(true); setSendMsg(''); setSendErr('');
    try {
      const r = await fetch(`${API}/api/send-dev-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Failed to send report');
      setSendMsg(`Report sent to ${githubEmail}`);
    } catch (e) { setSendErr(e.message); }
    finally { setSending(false); }
  }, [payload, emailAvailable, githubEmail]);

  const handleDownload = useCallback(async () => {
    if (!githubUsername) return;
    setDownloading(true); setSendErr(''); setSendMsg('');
    try {
      // Primary: server-side fetch + PDF generation (no payload needed)
      let r;
      try {
        r = await fetch(`${API}/api/developer/${encodeURIComponent(githubUsername)}/report`);
      } catch (networkErr) {
        console.warn('[Download] GET failed (network):', networkErr.message);
        r = null;
      }

      // Fallback: POST with client data if GET fails or is not reachable
      if ((!r || !r.ok) && payload) {
        r = await fetch(`${API}/api/dev-report/download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      // Check response
      if (!r || !r.ok) {
        let detail = 'Download failed. Please try again.';
        if (r) {
          try {
            const errBody = await r.text();
            try {
              const errJson = JSON.parse(errBody);
              detail = errJson.detail || detail;
            } catch { detail = errBody || detail; }
          } catch {}
        }
        throw new Error(detail);
      }

      // Validate we got a PDF
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('application/pdf')) {
        throw new Error('Server returned an unexpected response (not a PDF).');
      }

      const blob = await r.blob();
      if (blob.size < 100) throw new Error('Generated PDF appears to be empty.');

      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `CodePulse_Dev_${githubUsername}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      console.error('[Download]', e);
      setSendErr(e.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  }, [payload, githubUsername]);

  /* ── shared classes ─── */
  const card = `rounded-xl border p-5 ${isDark ? 'bg-[#141824] border-white/8' : 'bg-white border-gray-200'}`;

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className={`p-6 rounded-xl border ${isDark ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-200 text-red-600'}`}>
      ⚠️ Could not load GitHub data for <strong>@{githubUsername}</strong>: {error}
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Back */}
      <button onClick={() => navigate('/dashboard/developers')}
        className={`flex items-center gap-2 text-sm font-medium transition-colors ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-800'}`}>
        ← Back to Developer Directory
      </button>

      {/* ── Profile + Report Actions ── */}
      <div className={`${card} flex flex-col sm:flex-row items-start gap-5`}>
        <div className="flex items-start gap-4 flex-1 min-w-0">
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt={githubUsername} className="w-20 h-20 rounded-2xl ring-2 ring-emerald-500/30 flex-shrink-0" />
            : <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-2xl text-white font-bold flex-shrink-0">{(githubUsername || 'D')[0].toUpperCase()}</div>
          }
          <div className="min-w-0">
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {profile?.name || githubUsername}
            </h1>
            <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              @{githubUsername}{profile?.location && ` · 📍 ${profile.location}`}
            </p>
            {profile?.bio && <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{profile.bio}</p>}

            {/* Email status — fetched from GitHub, never stored */}
            <div className={`mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border ${
              emailAvailable
                ? isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : isDark ? 'bg-red-500/10 border-red-500/20 text-red-400'            : 'bg-red-50 border-red-200 text-red-600'
            }`}>
              {emailAvailable ? `✉️ ${githubEmail}` : '⚠️ Email not publicly available for this developer'}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2 flex-shrink-0 w-full sm:w-auto">
          {/* Send Report */}
          <button
            id="send-report-btn"
            onClick={handleSendReport}
            disabled={!emailAvailable || sending}
            title={!emailAvailable ? 'Email not publicly available for this developer' : 'Send PDF report to developer'}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 ${
              emailAvailable && !sending
                ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:scale-[1.02] hover:shadow-lg hover:shadow-emerald-500/20'
                : 'opacity-50 cursor-not-allowed bg-slate-600 text-slate-300'
            }`}>
            {sending
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending…</>
              : '📧 Send Report'}
          </button>

          {/* Download PDF — always available */}
          <button
            id="download-report-btn"
            onClick={handleDownload}
            disabled={downloading}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 border ${
              isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
            } ${downloading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {downloading
              ? <><span className="w-4 h-4 border-2 border-slate-400/30 border-t-slate-400 rounded-full animate-spin" /> Downloading…</>
              : '⬇️ Download PDF'}
          </button>

          {!emailAvailable && (
            <p className={`text-xs text-center ${isDark ? 'text-red-400/70' : 'text-red-500'}`}>
              Send Report disabled — no public email
            </p>
          )}
        </div>
      </div>

      {/* Send/error alerts */}
      {sendMsg && (
        <div className={`p-3 rounded-xl text-sm border ${isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          ✅ {sendMsg}
        </div>
      )}
      {sendErr && (
        <div className={`p-3 rounded-xl text-sm border ${isDark ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-200 text-red-600'}`}>
          ⚠️ {sendErr}
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { emoji: '📦', label: 'Public Repos',   value: profile?.public_repos, color: 'text-blue-400'    },
          { emoji: '👥', label: 'Followers',      value: profile?.followers,    color: 'text-purple-400'  },
          { emoji: '⭐', label: 'Total Stars',    value: totalStars,            color: 'text-yellow-400'  },
          { emoji: '📝', label: 'Recent Commits', value: commitCount,           color: 'text-emerald-400' },
        ].map((s) => (
          <div key={s.label} className={`${card} text-center`}>
            <p className="text-2xl mb-1">{s.emoji}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value ?? '—'}</p>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Impact Score ── */}
      {impactScore !== null && (
        <div className={`${card} flex items-center gap-5`}>
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>Impact Score</p>
            <p className={`text-4xl font-bold ${impactColor}`}>{impactScore}<span className="text-lg font-normal opacity-50">/100</span></p>
          </div>
          <div className="flex-1">
            <div className={`w-full h-3 rounded-full ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
              <div className={`h-full rounded-full transition-all duration-1000 ${impactBg}`} style={{ width: `${impactScore}%` }} />
            </div>
            <p className={`text-xs mt-2 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
              Based on repos, commits, stars and followers from GitHub
            </p>
          </div>
        </div>
      )}

      {/* ── Languages + Activity ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={card}>
          <h2 className={`text-sm font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>🧠 Languages</h2>
          {sortedLangs.length === 0 ? <p className="text-xs text-slate-500">No language data.</p> : (
            <div className="space-y-3">
              {sortedLangs.map(([lang, cnt], i) => (
                <div key={lang}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={isDark ? 'text-slate-300' : 'text-gray-700'}>{lang}</span>
                    <span className={isDark ? 'text-slate-500' : 'text-gray-400'}>{cnt} repos</span>
                  </div>
                  <div className={`w-full h-1.5 rounded-full ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                    <div className={`h-full rounded-full ${LC[i] || 'bg-emerald-500'}`}
                      style={{ width: `${Math.round((cnt / repos.length) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={card}>
          <h2 className={`text-sm font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>🕐 Recent Activity</h2>
          {events.length === 0 ? <p className="text-xs text-slate-500">No public activity.</p> : (
            <div className="space-y-2">
              {events.slice(0, 8).map((ev, i) => (
                <div key={i} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg ${isDark ? 'bg-white/3' : 'bg-gray-50'}`}>
                  <span className="text-base">{EVT_ICON[ev.type] || '📌'}</span>
                  <div className="min-w-0">
                    <p className={`text-xs font-medium truncate ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>{EVT_LABEL(ev)}</p>
                    <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{timeAgo(ev.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Top Repos ── */}
      <div>
        <h2 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>📦 Top Repositories</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...repos].sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 6).map((r) => (
            <a key={r.id} href={r.html_url} target="_blank" rel="noreferrer"
              className={`block ${card} transition-all hover:scale-[1.02] hover:shadow-lg`}>
              <div className="flex items-start justify-between gap-2">
                <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{r.name}</p>
                <div className="flex items-center gap-2 text-xs text-slate-500 flex-shrink-0">
                  <span>⭐{r.stargazers_count}</span>
                  <span>🍴{r.forks_count}</span>
                </div>
              </div>
              {r.description && <p className={`text-xs mt-1 line-clamp-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{r.description}</p>}
              {r.language && (
                <span className={`mt-2 inline-block text-[10px] px-2 py-0.5 rounded-full ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>
                  {r.language}
                </span>
              )}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

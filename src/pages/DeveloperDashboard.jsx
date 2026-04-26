/**
 * DeveloperDashboard — self-view for a logged-in developer.
 * Fetches live GitHub data. Email fetched from GitHub API (never stored).
 * "Send Report" disabled + warning if GitHub email not public.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import CodePulseLogo from '../components/CodePulseLogo';

const GH  = 'https://api.github.com';
const API = '';  // Uses Vite proxy (vite.config.js proxies /api → localhost:8000)

async function ghFetch(path) {
  const r = await fetch(`${GH}${path}`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${path}`);
  return r.json();
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  );
}

function StatCard({ emoji, label, value, color = 'text-emerald-400' }) {
  return (
    <div className="glass-card p-5 text-center">
      <p className="text-2xl mb-1">{emoji}</p>
      <p className={`text-2xl font-bold ${color}`}>{value ?? '—'}</p>
      <p className="text-xs mt-1 text-slate-500">{label}</p>
    </div>
  );
}

const LC = ['bg-emerald-500','bg-blue-500','bg-purple-500','bg-yellow-500','bg-red-500','bg-pink-500'];

const eventLabel = (e) => ({
  PushEvent:        `Pushed ${e.payload?.commits?.length || 1} commit(s) to ${e.repo?.name}`,
  PullRequestEvent: `PR ${e.payload?.action} in ${e.repo?.name}`,
  IssuesEvent:      `Issue ${e.payload?.action} in ${e.repo?.name}`,
  WatchEvent:       `Starred ${e.repo?.name}`,
  ForkEvent:        `Forked ${e.repo?.name}`,
}[e.type] || `${e.type} in ${e.repo?.name}`);

const eventIcon = (t) => ({ PushEvent:'📝', PullRequestEvent:'🔀', IssuesEvent:'🐛', WatchEvent:'⭐', ForkEvent:'🍴' }[t] || '📌');

const timeAgo = (iso) => {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
};

function computeImpactScore(profile, repos, events) {
  const commits   = events.filter((e) => e.type === 'PushEvent').reduce((s, e) => s + (e.payload?.commits?.length || 0), 0);
  const stars     = repos.reduce((s, r) => s + r.stargazers_count, 0);
  const repoScore = Math.min(30, (profile?.public_repos || 0) * 1.5);
  const commScore = Math.min(30, commits * 3);
  const starScore = Math.min(20, stars * 0.5);
  const follScore = Math.min(20, (profile?.followers || 0) * 0.5);
  return Math.round(repoScore + commScore + starScore + follScore);
}

export default function DeveloperDashboard() {
  const { theme } = useTheme();
  const isDark  = theme === 'dark';
  const navigate = useNavigate();
  const { devUser, devLogout } = useAuth();

  const [profile,  setProfile]  = useState(null);
  const [repos,    setRepos]    = useState([]);
  const [events,   setEvents]   = useState([]);
  const [langs,    setLangs]    = useState({});
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [extractedEmail, setExtractedEmail] = useState(null);

  const [sending,     setSending]     = useState(false);
  const [sendMsg,     setSendMsg]     = useState('');
  const [sendErr,     setSendErr]     = useState('');

  const githubUsername = devUser?.githubUsername;

  useEffect(() => {
    if (!githubUsername) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const [prof, repoList, evts] = await Promise.all([
          ghFetch(`/users/${githubUsername}`),
          ghFetch(`/users/${githubUsername}/repos?per_page=100&sort=updated`),
          ghFetch(`/users/${githubUsername}/events?per_page=30`),
        ]);
        if (cancelled) return;
        setProfile(prof); setRepos(repoList); setEvents(evts);
        const lm = {};
        repoList.forEach((r) => { if (r.language) lm[r.language] = (lm[r.language] || 0) + 1; });
        setLangs(lm);

        let email = null;
        let fetchedCommitsCount = 0;
        const extractedEmails = [];

        for (const repo of repoList.slice(0, 5)) {
          if (!repo.owner?.login || !repo.name) continue;
          try {
            const commits = await ghFetch(`/repos/${repo.owner.login}/${repo.name}/commits?author=${githubUsername}&per_page=50`);
            if (commits && Array.isArray(commits)) {
              fetchedCommitsCount += commits.length;
              for (const c of commits) {
                const commitAuthorName = c.commit?.author?.name || '';
                const commitAuthorEmail = c.commit?.author?.email || '';
                const authorLogin = c.author?.login || '';
                
                const isMatch = (authorLogin === githubUsername) || 
                                (commitAuthorName.toLowerCase() === githubUsername.toLowerCase()) ||
                                (prof?.name && commitAuthorName.toLowerCase() === prof.name.toLowerCase()) ||
                                (commitAuthorEmail.toLowerCase().includes(githubUsername.toLowerCase()));

                if (isMatch && commitAuthorEmail) {
                  extractedEmails.push(commitAuthorEmail);
                  if (!commitAuthorEmail.includes('noreply.github.com') && !commitAuthorEmail.includes('[bot]') && commitAuthorEmail.includes('@')) {
                    if (!email) {
                      email = commitAuthorEmail;
                    }
                  }
                }
              }
            }
          } catch (e) {
            // ignore commit fetch error
          }
          if (email) break;
        }

        console.log(`[Email Detection] Fetched commits count: ${fetchedCommitsCount}`);
        console.log(`[Email Detection] Extracted emails:`, extractedEmails);
        console.log(`[Email Detection] Selected email: ${email || 'None'}`);

        if (!cancelled) setExtractedEmail(email);

      } catch (e) { if (!cancelled) setError(e.message); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [githubUsername]);

  const handleLogout = () => { devLogout(); navigate('/', { replace: true }); };

  const totalStars  = repos.reduce((s, r) => s + r.stargazers_count, 0);
  const totalForks  = repos.reduce((s, r) => s + r.forks_count, 0);
  const commitCount = events.filter((e) => e.type === 'PushEvent').reduce((s, e) => s + (e.payload?.commits?.length || 0), 0);
  const sortedLangs = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const recentRepos = [...repos].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 6);
  const impactScore = profile ? computeImpactScore(profile, repos, events) : null;
  const impactColor = impactScore >= 70 ? 'text-emerald-400' : impactScore >= 40 ? 'text-yellow-400' : 'text-red-400';
  const impactBg    = impactScore >= 70 ? 'bg-emerald-500' : impactScore >= 40 ? 'bg-yellow-500' : 'bg-red-500';

  // GitHub email (fetched from API, never stored)
  const githubEmail    = extractedEmail;
  const emailAvailable = !!githubEmail && githubEmail.trim() !== '';

  const buildPayload = useCallback(() => {
    if (!profile) return null;
    const topRepos   = [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 8)
      .map((r) => ({ name: r.name, stars: r.stargazers_count, forks: r.forks_count, language: r.language }));
    const recentAct  = events.slice(0, 10).map((e) => ({ type: e.type, repo: e.repo?.name, created_at: e.created_at }));
    const actSummary = `@${githubUsername} has ${profile.public_repos} public repositories with ${totalStars} total stars. `
      + `${commitCount} recent commits recorded. Top languages: ${Object.keys(langs).slice(0, 3).join(', ') || 'N/A'}.`;
    return {
      username: githubUsername, name: profile.name, bio: profile.bio,
      location: profile.location, email: githubEmail || null,
      public_repos: profile.public_repos, followers: profile.followers, following: profile.following,
      total_stars: totalStars, total_forks: totalForks, commit_count: commitCount,
      impact_score: impactScore, activity_summary: actSummary,
      languages: langs, top_repos: topRepos, recent_activity: recentAct,
    };
  }, [profile, repos, events, langs, githubUsername, githubEmail, totalStars, totalForks, commitCount, impactScore]);

  const handleSendReport = useCallback(async () => {
    if (!emailAvailable) return;
    const payload = buildPayload();
    if (!payload) return;
    setSending(true); setSendMsg(''); setSendErr('');
    try {
      const r = await fetch(`${API}/api/send-dev-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Failed');
      setSendMsg(`Report sent to ${githubEmail}`);
    } catch (e) { setSendErr(e.message); }
    finally { setSending(false); }
  }, [emailAvailable, buildPayload, githubEmail]);



  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-[#0b0f19]' : 'bg-gradient-to-br from-gray-50 to-emerald-50/30'}`}>
      {/* Navbar */}
      <nav className={`relative z-10 flex items-center justify-between px-8 py-4 border-b ${isDark ? 'border-white/8' : 'border-gray-200'}`}>
        <Link to="/" className="flex items-center gap-2.5">
          <CodePulseLogo size={30} />
          <span className="text-lg font-bold gradient-text">CodePulse</span>
        </Link>
        <div className="flex items-center gap-3">
          {profile?.avatar_url && (
            <img src={profile.avatar_url} alt={githubUsername} className="w-8 h-8 rounded-full ring-2 ring-emerald-500/40" />
          )}
          <span className={`text-xs font-medium px-3 py-1 rounded-full border ${
            isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}>💻 {devUser?.username}</span>
          <button id="dev-logout-btn" onClick={handleLogout}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              isDark ? 'border-white/10 text-slate-400 hover:text-red-400 hover:bg-red-500/10' : 'border-gray-200 text-gray-500 hover:text-red-500 hover:bg-red-50'
            }`}>Sign Out</button>
        </div>
      </nav>

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className={`p-4 rounded-xl text-sm border ${isDark ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-200 text-red-600'}`}>
            ⚠️ GitHub API error: {error}
          </div>
        )}

        {loading ? <Spinner /> : (
          <>
            {/* Profile header */}
            <div className="animate-fade-in flex flex-col sm:flex-row items-start gap-5">
              <div className="flex items-start gap-4 flex-1 min-w-0">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={githubUsername} className="w-16 h-16 rounded-2xl ring-2 ring-emerald-500/30 flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-2xl text-white font-bold flex-shrink-0">
                    {(devUser?.username || 'D')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{profile?.name || devUser?.username}</h1>
                  <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                    @{githubUsername}{profile?.location && ` · 📍 ${profile.location}`}
                  </p>
                  {profile?.bio && <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{profile.bio}</p>}

                  {/* Email badge */}
                  <div className={`mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                    emailAvailable
                      ? isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : isDark ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'    : 'bg-yellow-50 border-yellow-200 text-yellow-700'
                  }`}>
                    {emailAvailable ? `✉️ ${githubEmail}` : '⚠️ Email not available'}
                  </div>
                </div>
              </div>

              {/* Report actions */}
              <div className="flex flex-col gap-2 flex-shrink-0">
                <button onClick={handleSendReport} disabled={!emailAvailable || sending}
                  title={!emailAvailable ? 'Email not available' : 'Send PDF to your GitHub email'}
                  className={`px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
                    emailAvailable && !sending
                      ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:scale-[1.02] hover:shadow-lg'
                      : 'opacity-50 cursor-not-allowed bg-slate-600 text-slate-300'
                  }`}>
                  {sending ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending…</> : '📧 Send Report'}
                </button>
              </div>
            </div>

            {/* Alerts */}
            {sendMsg && <div className={`p-3 rounded-xl text-sm border ${isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>✅ {sendMsg}</div>}
            {sendErr && <div className={`p-3 rounded-xl text-sm border ${isDark ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-200 text-red-600'}`}>⚠️ {sendErr}</div>}

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 opacity-0 animate-slide-up stagger-1">
              <StatCard emoji="📦" label="Public Repos"   value={profile?.public_repos} color="text-blue-400" />
              <StatCard emoji="👥" label="Followers"      value={profile?.followers}    color="text-purple-400" />
              <StatCard emoji="⭐" label="Total Stars"    value={totalStars}            color="text-yellow-400" />
              <StatCard emoji="📝" label="Recent Commits" value={commitCount}           color="text-emerald-400" />
            </div>

            {/* Impact Score */}
            {impactScore !== null && (
              <div className="glass-card p-5 flex items-center gap-5 opacity-0 animate-slide-up stagger-2">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>Impact Score</p>
                  <p className={`text-4xl font-bold ${impactColor}`}>{impactScore}<span className="text-lg font-normal opacity-50">/100</span></p>
                </div>
                <div className="flex-1">
                  <div className={`w-full h-3 rounded-full ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                    <div className={`h-full rounded-full ${impactBg}`} style={{ width: `${impactScore}%` }} />
                  </div>
                  <p className={`text-xs mt-2 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>Based on repos, commits, stars and followers</p>
                </div>
              </div>
            )}

            {/* Languages + Activity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-0 animate-slide-up stagger-3">
              <div className="glass-card p-5">
                <h2 className={`text-sm font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>🧠 Languages Used</h2>
                {sortedLangs.length === 0 ? <p className="text-xs text-slate-500">No data.</p> : (
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

              <div className="glass-card p-5">
                <h2 className={`text-sm font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>🕐 Recent Activity</h2>
                {events.length === 0 ? <p className="text-xs text-slate-500">No public activity.</p> : (
                  <div className="space-y-2">
                    {events.slice(0, 8).map((ev, i) => (
                      <div key={i} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg ${isDark ? 'bg-white/3 hover:bg-white/5' : 'bg-gray-50 hover:bg-gray-100'} transition-colors`}>
                        <span className="text-base">{eventIcon(ev.type)}</span>
                        <div className="min-w-0">
                          <p className={`text-xs font-medium truncate ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>{eventLabel(ev)}</p>
                          <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{timeAgo(ev.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent repos */}
            <div className="opacity-0 animate-slide-up stagger-4">
              <h2 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>📦 Recent Repositories</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recentRepos.map((r) => (
                  <a key={r.id} href={r.html_url} target="_blank" rel="noreferrer"
                    className="block glass-card p-4 transition-all hover:scale-[1.02] hover:shadow-lg">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{r.name}</p>
                      <div className="flex items-center gap-2 flex-shrink-0 text-xs text-slate-500">
                        <span>⭐{r.stargazers_count}</span>
                        <span>🍴{r.forks_count}</span>
                      </div>
                    </div>
                    {r.description && <p className={`text-xs line-clamp-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{r.description}</p>}
                    {r.language && (
                      <span className={`mt-2 inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>
                        {r.language}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            </div>

            {!githubUsername && (
              <div className="glass-card p-8 text-center">
                <p className="text-3xl mb-3">🔗</p>
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>No GitHub username linked</h3>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

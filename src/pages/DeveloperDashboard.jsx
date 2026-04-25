/**
 * DeveloperDashboard — dynamic dashboard powered by GitHub API.
 * Fetches: profile, repos, events, languages.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import CodePulseLogo from '../components/CodePulseLogo';

const GH = 'https://api.github.com';

async function ghFetch(path) {
  const r = await fetch(`${GH}${path}`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!r.ok) throw new Error(`GitHub API ${r.status}: ${path}`);
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

export default function DeveloperDashboard() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const { devUser, devLogout } = useAuth();

  const [profile,   setProfile]   = useState(null);
  const [repos,     setRepos]     = useState([]);
  const [events,    setEvents]    = useState([]);
  const [langs,     setLangs]     = useState({});
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

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
        setProfile(prof);
        setRepos(repoList);
        setEvents(evts);

        // Aggregate languages across repos
        const langMap = {};
        repoList.forEach((r) => {
          if (r.language) langMap[r.language] = (langMap[r.language] || 0) + 1;
        });
        setLangs(langMap);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [githubUsername]);

  const handleLogout = () => { devLogout(); navigate('/', { replace: true }); };

  // ── stats ─────────────────────────────────────────────────────────────────
  const totalStars = repos.reduce((s, r) => s + r.stargazers_count, 0);
  const totalForks = repos.reduce((s, r) => s + r.forks_count, 0);
  const commitCount = events.filter((e) => e.type === 'PushEvent').reduce((s, e) => s + (e.payload?.commits?.length || 0), 0);
  const sortedLangs = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const recentRepos = [...repos].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 5);
  const recentEvents = events.slice(0, 8);

  const eventLabel = (e) => {
    switch (e.type) {
      case 'PushEvent':        return `Pushed ${e.payload?.commits?.length || 1} commit(s) to ${e.repo?.name}`;
      case 'PullRequestEvent': return `PR ${e.payload?.action} in ${e.repo?.name}`;
      case 'IssuesEvent':      return `Issue ${e.payload?.action} in ${e.repo?.name}`;
      case 'WatchEvent':       return `Starred ${e.repo?.name}`;
      case 'ForkEvent':        return `Forked ${e.repo?.name}`;
      default:                 return `${e.type} in ${e.repo?.name}`;
    }
  };

  const eventIcon = (type) => ({ PushEvent: '📝', PullRequestEvent: '🔀', IssuesEvent: '🐛', WatchEvent: '⭐', ForkEvent: '🍴' }[type] || '📌');

  const timeAgo = (iso) => {
    const s = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s/60)}m ago`;
    if (s < 86400) return `${Math.floor(s/3600)}h ago`;
    return `${Math.floor(s/86400)}d ago`;
  };

  const langColor = ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-yellow-500', 'bg-red-500', 'bg-pink-500'];

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-[#0b0f19]' : 'bg-gradient-to-br from-gray-50 to-emerald-50/30'}`}>
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-40 right-0 w-[600px] h-[600px] rounded-full blur-[140px] opacity-8 ${isDark ? 'bg-emerald-700' : 'bg-green-300'}`} />
      </div>

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
          }`}>💻 {devUser?.username || 'Developer'}</span>
          <button id="dev-logout-btn" onClick={handleLogout}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              isDark ? 'border-white/10 text-slate-400 hover:text-red-400 hover:bg-red-500/10' : 'border-gray-200 text-gray-500 hover:text-red-500 hover:bg-red-50'
            }`}>Sign Out</button>
        </div>
      </nav>

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Error */}
        {error && (
          <div className={`p-4 rounded-xl text-sm border ${isDark ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-200 text-red-600'}`}>
            ⚠️ GitHub API error: {error}. Check your GitHub username in your profile.
          </div>
        )}

        {loading ? <Spinner /> : (
          <>
            {/* Profile header */}
            <div className="animate-fade-in flex items-start gap-5">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={githubUsername} className="w-16 h-16 rounded-2xl ring-2 ring-emerald-500/30" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-2xl text-white font-bold">
                  {(devUser?.username || 'D')[0].toUpperCase()}
                </div>
              )}
              <div>
                <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {profile?.name || devUser?.username}
                </h1>
                <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  @{githubUsername}
                  {profile?.location && ` · 📍 ${profile.location}`}
                </p>
                {profile?.bio && (
                  <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{profile.bio}</p>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 opacity-0 animate-slide-up stagger-1">
              <StatCard emoji="📦" label="Public Repos"    value={profile?.public_repos}  color="text-blue-400" />
              <StatCard emoji="👥" label="Followers"       value={profile?.followers}      color="text-purple-400" />
              <StatCard emoji="⭐" label="Total Stars"     value={totalStars}              color="text-yellow-400" />
              <StatCard emoji="📝" label="Recent Commits"  value={commitCount}             color="text-emerald-400" />
            </div>

            {/* Languages + Activity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-0 animate-slide-up stagger-3">
              {/* Languages */}
              <div className="glass-card p-5">
                <h2 className={`text-sm font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>🧠 Languages Used</h2>
                {sortedLangs.length === 0 ? (
                  <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>No language data available.</p>
                ) : (
                  <div className="space-y-3">
                    {sortedLangs.map(([lang, count], i) => {
                      const pct = Math.round((count / repos.length) * 100);
                      return (
                        <div key={lang}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className={isDark ? 'text-slate-300' : 'text-gray-700'}>{lang}</span>
                            <span className={isDark ? 'text-slate-500' : 'text-gray-400'}>{count} repos</span>
                          </div>
                          <div className={`w-full h-1.5 rounded-full ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                            <div className={`h-full rounded-full ${langColor[i] || 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent Activity */}
              <div className="glass-card p-5">
                <h2 className={`text-sm font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>🕐 Recent Activity</h2>
                {recentEvents.length === 0 ? (
                  <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>No recent public activity.</p>
                ) : (
                  <div className="space-y-2">
                    {recentEvents.map((ev, i) => (
                      <div key={i} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg ${isDark ? 'bg-white/3 hover:bg-white/5' : 'bg-gray-50 hover:bg-gray-100'} transition-colors`}>
                        <span className="text-base flex-shrink-0">{eventIcon(ev.type)}</span>
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

            {/* Recent Repos */}
            <div className="opacity-0 animate-slide-up stagger-5">
              <h2 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>📦 Recent Repositories</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recentRepos.map((r) => (
                  <a key={r.id} href={r.html_url} target="_blank" rel="noreferrer"
                    className={`block glass-card p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{r.name}</p>
                      <div className="flex items-center gap-2 flex-shrink-0 text-xs text-slate-500">
                        <span>⭐ {r.stargazers_count}</span>
                        <span>🍴 {r.forks_count}</span>
                      </div>
                    </div>
                    {r.description && (
                      <p className={`text-xs line-clamp-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{r.description}</p>
                    )}
                    {r.language && (
                      <span className={`mt-2 inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>
                        {r.language}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            </div>

            {/* No GitHub */}
            {!githubUsername && (
              <div className="glass-card p-8 text-center">
                <p className="text-3xl mb-3">🔗</p>
                <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>No GitHub username linked</h3>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Please sign out and sign up again with your GitHub username.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

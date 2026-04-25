/**
 * DeveloperView — Admin view of a single developer's GitHub data.
 * Route: /dashboard/developers/:githubUsername
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

const GH = 'https://api.github.com';
const gh = async (p) => { const r = await fetch(`${GH}${p}`, { headers: { Accept: 'application/vnd.github+json' } }); if (!r.ok) throw new Error(r.status); return r.json(); };
const timeAgo = (iso) => { const s = Math.floor((Date.now() - new Date(iso)) / 1000); if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s/60)}m ago`; if (s < 86400) return `${Math.floor(s/3600)}h ago`; return `${Math.floor(s/86400)}d ago`; };
const eventLabel = (e) => ({ PushEvent: `Pushed to ${e.repo?.name}`, PullRequestEvent: `PR ${e.payload?.action} in ${e.repo?.name}`, IssuesEvent: `Issue ${e.payload?.action} in ${e.repo?.name}`, WatchEvent: `Starred ${e.repo?.name}`, ForkEvent: `Forked ${e.repo?.name}` }[e.type] || `${e.type}`);
const eventIcon = (t) => ({ PushEvent: '📝', PullRequestEvent: '🔀', IssuesEvent: '🐛', WatchEvent: '⭐', ForkEvent: '🍴' }[t] || '📌');
const LC = ['bg-emerald-500','bg-blue-500','bg-purple-500','bg-yellow-500','bg-red-500','bg-pink-500'];

export default function DeveloperView() {
  const { githubUsername } = useParams();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [repos,   setRepos]   = useState([]);
  const [events,  setEvents]  = useState([]);
  const [langs,   setLangs]   = useState({});
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!githubUsername) return;
    let cancelled = false;
    (async () => {
      try {
        const [prof, repoList, evts] = await Promise.all([
          gh(`/users/${githubUsername}`),
          gh(`/users/${githubUsername}/repos?per_page=100&sort=updated`),
          gh(`/users/${githubUsername}/events?per_page=20`),
        ]);
        if (cancelled) return;
        setProfile(prof); setRepos(repoList); setEvents(evts);
        const lm = {};
        repoList.forEach((r) => { if (r.language) lm[r.language] = (lm[r.language] || 0) + 1; });
        setLangs(lm);
      } catch (e) { if (!cancelled) setError(e.message); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [githubUsername]);

  const totalStars = repos.reduce((s, r) => s + r.stargazers_count, 0);
  const commitCnt  = events.filter((e) => e.type === 'PushEvent').reduce((s, e) => s + (e.payload?.commits?.length || 0), 0);
  const sortedLangs = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const isDarkCard = isDark ? 'bg-[#141824] border-white/8' : 'bg-white border-gray-200';
  const card = `rounded-xl border p-5 ${isDarkCard}`;

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className={`p-6 rounded-xl border ${isDark ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-200 text-red-600'}`}>
      ⚠️ Could not load GitHub data for <strong>{githubUsername}</strong>: {error}
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back */}
      <button onClick={() => navigate('/dashboard/developers')}
        className={`flex items-center gap-2 text-sm font-medium transition-colors ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-800'}`}>
        ← Back to Developer Directory
      </button>

      {/* Profile */}
      <div className={`${card} flex items-start gap-5`}>
        {profile?.avatar_url && <img src={profile.avatar_url} alt={githubUsername} className="w-20 h-20 rounded-2xl ring-2 ring-emerald-500/30" />}
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{profile?.name || githubUsername}</h1>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>@{githubUsername}{profile?.location && ` · 📍 ${profile.location}`}</p>
          {profile?.bio && <p className={`text-sm mt-1.5 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>{profile.bio}</p>}
          {profile?.html_url && (
            <a href={profile.html_url} target="_blank" rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-500 hover:text-emerald-400 transition-colors">
              View on GitHub ↗
            </a>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { emoji: '📦', label: 'Public Repos',    value: profile?.public_repos, color: 'text-blue-400'    },
          { emoji: '👥', label: 'Followers',       value: profile?.followers,    color: 'text-purple-400'  },
          { emoji: '⭐', label: 'Total Stars',     value: totalStars,            color: 'text-yellow-400'  },
          { emoji: '📝', label: 'Recent Commits',  value: commitCnt,             color: 'text-emerald-400' },
        ].map((s) => (
          <div key={s.label} className={`${card} text-center`}>
            <p className="text-2xl mb-1">{s.emoji}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value ?? '—'}</p>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Languages + Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={card}>
          <h2 className={`text-sm font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>🧠 Languages</h2>
          {sortedLangs.length === 0 ? <p className="text-xs text-slate-500">No data.</p> : (
            <div className="space-y-3">
              {sortedLangs.map(([lang, cnt], i) => {
                const pct = Math.round((cnt / repos.length) * 100);
                return (
                  <div key={lang}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className={isDark ? 'text-slate-300' : 'text-gray-700'}>{lang}</span>
                      <span className={isDark ? 'text-slate-500' : 'text-gray-400'}>{cnt} repos</span>
                    </div>
                    <div className={`w-full h-1.5 rounded-full ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                      <div className={`h-full rounded-full ${LC[i] || 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={card}>
          <h2 className={`text-sm font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>🕐 Recent Activity</h2>
          {events.length === 0 ? <p className="text-xs text-slate-500">No public activity.</p> : (
            <div className="space-y-2">
              {events.slice(0, 8).map((ev, i) => (
                <div key={i} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg ${isDark ? 'bg-white/3' : 'bg-gray-50'}`}>
                  <span className="text-base">{eventIcon(ev.type)}</span>
                  <div className="min-w-0">
                    <p className={`text-xs font-medium truncate ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>{eventLabel(ev)}</p>
                    <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{timeAgo(ev.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top repos */}
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
              {r.language && <span className={`mt-2 inline-block text-[10px] px-2 py-0.5 rounded-full ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>{r.language}</span>}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

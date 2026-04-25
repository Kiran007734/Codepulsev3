import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CodePulseLogo from '../components/CodePulseLogo';
import LandingNavbar from '../components/LandingNavbar';

/* ═══════════════════════════════════════════════════════════════
   STATIC DATA — ZERO API CALLS
   ═══════════════════════════════════════════════════════════════ */

const problemPoints = [
  'No visibility into developer productivity',
  "Commit counts don't measure real impact",
  'Jira tickets never match actual work done',
  'Knowledge silos go undetected until someone leaves',
];
const solutionPoints = [
  'AI-powered developer impact scoring',
  'Real contribution analysis beyond commits',
  'Automated plan-vs-reality alignment',
  'Proactive bus-factor risk detection',
];

const workflowSteps = [
  { icon: '🔗', title: 'GitHub Data', desc: 'Commits, PRs, file changes' },
  { icon: '🧠', title: 'AI Analysis', desc: 'NLP + Gemini engine' },
  { icon: '📋', title: 'Jira Mapping', desc: 'Semantic matching' },
  { icon: '💡', title: 'Insights', desc: 'Scores & recommendations' },
  { icon: '📊', title: 'Dashboard', desc: 'Visuals & email alerts' },
];

const featureCards = [
  { icon: '📊', title: 'Developer Intelligence', desc: 'Fair, data-driven contribution scoring beyond simple commit counts.' },
  { icon: '🔗', title: 'Requirement Tracing', desc: 'AI maps commits to business requirements using NLP similarity.' },
  { icon: '⚠️', title: 'Bus Factor Detection', desc: 'Detect single points of failure and knowledge concentration risks.' },
  { icon: '💡', title: 'Decision Engine', desc: 'AI-powered recommendations for team health and code quality.' },
];

const marqueeRow1 = ['GitHub', 'Gemini AI', 'Jira', 'VS Code', 'Copilot', 'Claude', 'Cursor'];
const marqueeRow2 = ['Slack', 'Azure DevOps', 'Bitbucket', 'Teams', 'GitLab', 'Linear', 'Notion'];

const futureItems = [
  { icon: '🧠', title: 'Predictive Risk Intelligence', desc: 'Forecast burnout and turnover risks before they happen.' },
  { icon: '🔍', title: 'AI Code Explanation Layer', desc: 'Natural-language explanations for every commit and PR.' },
  { icon: '💓', title: 'Engineering Health Score', desc: 'Real-time dashboards tracking codebase and team health.' },
];

const teamMembers = [
  { initials: 'KM', name: 'KIRANRAJ M', color: 'from-violet-500 to-purple-600' },
  { initials: 'GR', name: 'GOKUL JAYANDHAN R S', color: 'from-teal-500 to-cyan-600' },
  { initials: 'PU', name: 'PUNIT', color: 'from-orange-500 to-red-500' },
  { initials: 'PI', name: 'PIRRANIT', color: 'from-rose-500 to-pink-600' },
];

/* ═══════════════════════════════════════════════════════════════
   HOOKS
   ═══════════════════════════════════════════════════════════════ */

function useReveal(threshold = 0.12) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, vis];
}

/* ═══════════════════════════════════════════════════════════════
   SECTION WRAPPER
   ═══════════════════════════════════════════════════════════════ */

const Section = memo(function Section({ id, children, className = '', bg = '' }) {
  const [ref, vis] = useReveal();
  return (
    <section id={id} ref={ref} className={`${bg} transition-all duration-700 ease-out ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20 md:py-28">
        {children}
      </div>
    </section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   HERO MOCK DASHBOARD (100% static)
   ═══════════════════════════════════════════════════════════════ */

const HeroDashboard = memo(function HeroDashboard() {
  // All data is hardcoded — no API
  const prData = [38, 52, 45, 61, 55, 72, 68, 80, 74, 85, 78, 92];
  const aiUsage = [
    { label: 'Gemini', pct: 78, color: '#22C55E' },
    { label: 'Copilot', pct: 62, color: '#3B82F6' },
    { label: 'Claude', pct: 45, color: '#8B5CF6' },
  ];
  const stats = [
    { label: 'Repos', value: '12' },
    { label: 'Devs', value: '34' },
    { label: 'Commits', value: '2.4k' },
    { label: 'PR Cycle', value: '4.2h' },
  ];

  const maxPr = Math.max(...prData);

  return (
    <div className="relative w-full max-w-[540px] lg:max-w-none">
      {/* Main card */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_20px_60px_rgba(0,0,0,0.08)] p-5 hp-float">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <span className="text-[10px] font-medium text-[#9CA3AF]">codepulse dashboard</span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {stats.map((s) => (
            <div key={s.label} className="bg-[#F8FAFC] rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-[#0B0F19]">{s.value}</p>
              <p className="text-[10px] text-[#9CA3AF] font-medium">{s.label}</p>
            </div>
          ))}
        </div>

        {/* PR graph */}
        <div className="mb-4">
          <p className="text-[11px] font-semibold text-[#6B7280] mb-2 uppercase tracking-wider">PR Throughput</p>
          <div className="flex items-end gap-[5px] h-20">
            {prData.map((v, i) => (
              <div key={i} className="flex-1 rounded-t-[3px] transition-all duration-500" style={{ height: `${(v / maxPr) * 100}%`, backgroundColor: i >= 8 ? '#22C55E' : '#E2E8F0' }} />
            ))}
          </div>
        </div>

        {/* AI usage */}
        <div>
          <p className="text-[11px] font-semibold text-[#6B7280] mb-2 uppercase tracking-wider">AI Usage</p>
          <div className="space-y-2">
            {aiUsage.map((a) => (
              <div key={a.label} className="flex items-center gap-3">
                <span className="text-[11px] font-medium text-[#6B7280] w-14">{a.label}</span>
                <div className="flex-1 h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${a.pct}%`, backgroundColor: a.color }} />
                </div>
                <span className="text-[10px] font-semibold text-[#0B0F19] w-8 text-right">{a.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating accent cards */}
      <div className="absolute -top-4 -right-4 bg-white rounded-xl border border-black/[0.06] shadow-lg p-3 hp-float" style={{ animationDelay: '1s' }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-sm">🚀</div>
          <div>
            <p className="text-[10px] font-semibold text-[#0B0F19]">+23% velocity</p>
            <p className="text-[9px] text-[#9CA3AF]">this sprint</p>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-3 -left-3 bg-white rounded-xl border border-black/[0.06] shadow-lg p-3 hp-float" style={{ animationDelay: '2.5s' }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-sm">⚠️</div>
          <div>
            <p className="text-[10px] font-semibold text-[#0B0F19]">Bus factor: 1</p>
            <p className="text-[9px] text-[#9CA3AF]">auth/ module</p>
          </div>
        </div>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   ACTION DASHBOARD (replaces pricing)
   ═══════════════════════════════════════════════════════════════ */

const ActionDashboard = memo(function ActionDashboard() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Developer Impact */}
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
        <div className="bg-white rounded-2xl border border-black/[0.06] p-6 h-full shadow-sm hover:shadow-md hover:border-black/[0.12] transition-all duration-200">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[13px] font-semibold text-[#0B0F19]">Developer Impact</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">Live</span>
          </div>
          <div className="flex items-end gap-[6px] h-28 mb-3">
            {[65, 48, 82, 55, 70, 60, 90].map((h, i) => (
              <motion.div key={i} initial={{ height: 0 }} whileInView={{ height: `${h}%` }} viewport={{ once: true }} transition={{ delay: i * 0.07, duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                className="flex-1 rounded-t-sm" style={{ backgroundColor: i === 6 ? '#22C55E' : i === 2 ? '#22C55E' : '#E2E8F0' }} />
            ))}
          </div>
          <div className="flex justify-between">
            {['M','T','W','T','F','S','S'].map((d, i) => <span key={i} className="text-[9px] text-[#9CA3AF] flex-1 text-center">{d}</span>)}
          </div>
        </div>
      </motion.div>

      {/* Risk Alerts */}
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1, duration: 0.5 }}>
        <div className="bg-white rounded-2xl border border-black/[0.06] p-6 h-full shadow-sm hover:shadow-md hover:border-black/[0.12] transition-all duration-200">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[13px] font-semibold text-[#0B0F19]">Risk Alerts</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-500 font-medium">2 Critical</span>
          </div>
          <div className="space-y-2.5">
            {[
              { mod: 'auth/', risk: 'HIGH', color: '#EF4444' },
              { mod: 'payments/', risk: 'HIGH', color: '#EF4444' },
              { mod: 'api/', risk: 'MED', color: '#F59E0B' },
              { mod: 'utils/', risk: 'LOW', color: '#22C55E' },
            ].map(r => (
              <div key={r.mod} className="flex items-center gap-3 p-2 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] transition-colors">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                <span className="text-[11px] font-mono font-medium text-[#0B0F19] flex-1">{r.mod}</span>
                <span className="text-[10px] font-bold" style={{ color: r.color }}>{r.risk}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Plan vs Reality */}
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2, duration: 0.5 }}>
        <div className="bg-white rounded-2xl border border-black/[0.06] p-6 h-full shadow-sm hover:shadow-md hover:border-black/[0.12] transition-all duration-200">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[13px] font-semibold text-[#0B0F19]">Plan vs Reality</h3>
            <span className="text-[10px] text-[#9CA3AF]">Sprint 14</span>
          </div>
          <div className="space-y-3.5">
            {[
              { name: 'Auth Module', pct: 100 },
              { name: 'Payment Flow', pct: 65 },
              { name: 'Search API', pct: 40 },
              { name: 'Dashboard UI', pct: 15 },
            ].map((t, i) => (
              <div key={t.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-[#6B7280]">{t.name}</span>
                  <span className={`text-[10px] font-semibold ${t.pct >= 80 ? 'text-green-600' : t.pct >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>{t.pct}%</span>
                </div>
                <div className="w-full h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} whileInView={{ width: `${t.pct}%` }} viewport={{ once: true }} transition={{ delay: i * 0.1 + 0.3, duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
                    className="h-full rounded-full" style={{ backgroundColor: t.pct >= 80 ? '#22C55E' : t.pct >= 50 ? '#F59E0B' : '#EF4444' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   FLIP CARD (team)
   ═══════════════════════════════════════════════════════════════ */

function FlipCard({ front, back, className = '' }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div className={`hp-flip-container cursor-pointer ${className}`} onClick={() => setFlipped(!flipped)}>
      <div className={`hp-flip-inner ${flipped ? 'hp-flipped' : ''}`}>
        <div className="hp-flip-front bg-white border border-black/[0.06] rounded-xl p-6 flex flex-col items-center justify-center text-center h-full shadow-sm">{front}</div>
        <div className="hp-flip-back bg-white border border-black/[0.06] rounded-xl p-6 flex flex-col items-center justify-center text-center h-full shadow-sm">{back}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function HomePage({ onNavigate }) {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <LandingNavbar onNavigate={onNavigate} />

      {/* ════════════════════════════════════════════
          1. HERO — LEFT TEXT + RIGHT DASHBOARD
          ════════════════════════════════════════════ */}
      <header className="relative pt-24 lg:pt-32 pb-16 lg:pb-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* LEFT — text */}
            <div className="max-w-[560px]">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-6 text-[11px] font-medium text-[#6B7280] border border-black/[0.06] bg-[#F8FAFC]">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  AI-Powered Platform
                </div>
              </motion.div>

              <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6 }}
                className="text-[clamp(40px,5.5vw,72px)] font-extrabold text-[#0B0F19] leading-[1.05] tracking-[-0.04em] mb-6">
                Engineering teams track activity.{' '}
                <span className="text-[#22C55E]">CodePulse tracks impact.</span>
              </motion.h1>

              <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}
                className="text-lg text-[#6B7280] leading-[1.7] mb-10 max-w-[480px]">
                Turn GitHub data into actionable engineering intelligence. Measure real developer impact, align plans with reality, and eliminate knowledge risk.
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}
                className="flex flex-wrap gap-3">
                <button onClick={() => onNavigate('setup')}
                  className="group px-7 py-3.5 rounded-lg text-[14px] font-semibold text-white bg-[#0B0F19] hover:bg-[#1a1f2e] transition-all duration-200 hover:scale-[1.02] hover:shadow-xl">
                  <span className="flex items-center gap-2">
                    Get Started
                    <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  </span>
                </button>
                <a href="#how-it-works" className="px-7 py-3.5 rounded-lg text-[14px] font-semibold text-[#0B0F19] border border-black/[0.10] hover:border-black/[0.18] hover:bg-[#F8FAFC] transition-all duration-200">
                  Learn More
                </a>
              </motion.div>
            </div>

            {/* RIGHT — dashboard mock */}
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.7 }}
              className="relative lg:pl-4 group hidden sm:block">
              <HeroDashboard />
            </motion.div>
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════════
          2. INTEGRATIONS MARQUEE
          ════════════════════════════════════════════ */}
      <Section id="integrations" bg="bg-[#F8FAFC]" className="!py-0">
        <div className="py-16 md:py-20">
          <p className="text-center text-sm font-medium text-[#9CA3AF] mb-8 uppercase tracking-wider">Integrates with the tools you love</p>
          {/* Row 1 — left */}
          <div className="overflow-hidden mb-4">
            <div className="marquee-track marquee-left">
              {[...marqueeRow1, ...marqueeRow1].map((t, i) => (
                <span key={i} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-black/[0.06] text-[13px] font-medium text-[#0B0F19] shadow-sm whitespace-nowrap">{t}</span>
              ))}
            </div>
          </div>
          {/* Row 2 — right */}
          <div className="overflow-hidden">
            <div className="marquee-track marquee-right">
              {[...marqueeRow2, ...marqueeRow2].map((t, i) => (
                <span key={i} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-black/[0.06] text-[13px] font-medium text-[#0B0F19] shadow-sm whitespace-nowrap">{t}</span>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ════════════════════════════════════════════
          3. PRODUCT VISUAL
          ════════════════════════════════════════════ */}
      <Section id="product">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <div className="max-w-[500px]">
            <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
              className="text-[clamp(28px,3.5vw,44px)] font-bold text-[#0B0F19] leading-[1.15] tracking-tight mb-5">
              AI productivity platform for engineering teams
            </motion.h2>
            <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1, duration: 0.5 }}
              className="text-base text-[#6B7280] leading-[1.7] mb-8">
              CodePulse combines AI analysis with your development workflow to provide unmatched visibility into engineering impact, team health, and delivery alignment.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2, duration: 0.5 }}
              className="flex flex-col gap-3">
              {['Real-time developer impact scoring', 'Automated Jira ↔ GitHub alignment', 'Knowledge risk detection & alerts'].map((f, i) => (
                <div key={f} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <span className="text-sm text-[#0B0F19] font-medium">{f}</span>
                </div>
              ))}
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
            className="hidden sm:block">
            <HeroDashboard />
          </motion.div>
        </div>
      </Section>

      {/* ════════════════════════════════════════════
          4. PROBLEM vs SOLUTION
          ════════════════════════════════════════════ */}
      <Section id="problem-solution" bg="bg-[#F8FAFC]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Problem */}
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <div className="bg-white rounded-2xl border border-black/[0.06] p-8 lg:p-10 h-full shadow-sm">
              <h3 className="text-2xl font-bold text-[#0B0F19] mb-6">The <span className="text-red-500">Problem</span></h3>
              <div className="space-y-4">
                {problemPoints.map((p, i) => (
                  <motion.div key={p} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.4 }}
                    className="flex items-start gap-3 py-1">
                    <span className="text-red-400 text-base flex-shrink-0 mt-0.5">✕</span>
                    <span className="text-[15px] text-[#6B7280] leading-relaxed">{p}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Solution */}
          <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.1, duration: 0.5 }}>
            <div className="bg-white rounded-2xl border border-black/[0.06] p-8 lg:p-10 h-full shadow-sm">
              <h3 className="text-2xl font-bold text-[#0B0F19] mb-6">The <span className="text-green-600">Solution</span></h3>
              <div className="space-y-4">
                {solutionPoints.map((p, i) => (
                  <motion.div key={p} initial={{ opacity: 0, x: 12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 + 0.15, duration: 0.4 }}
                    className="flex items-start gap-3 py-1">
                    <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    <span className="text-[15px] text-[#6B7280] leading-relaxed">{p}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </Section>

      {/* ════════════════════════════════════════════
          5. HOW IT WORKS — HORIZONTAL FLOW
          ════════════════════════════════════════════ */}
      <Section id="how-it-works">
        <div className="text-center mb-14">
          <p className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-widest mb-3">Pipeline</p>
          <h2 className="text-[clamp(28px,3.5vw,44px)] font-bold text-[#0B0F19] tracking-tight">How It Works</h2>
        </div>

        {/* Workflow — horizontal on desktop, vertical on mobile */}
        <div className="flex flex-col lg:flex-row items-stretch gap-0 justify-center">
          {workflowSteps.map((step, i) => (
            <React.Fragment key={step.title}>
              <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }}
                className="flex-1 min-w-0">
                <div className="bg-[#F8FAFC] rounded-xl border border-black/[0.06] p-5 text-center h-full hover:border-black/[0.12] hover:shadow-sm transition-all duration-200 group">
                  <div className="w-12 h-12 rounded-xl bg-white border border-black/[0.06] flex items-center justify-center text-xl mx-auto mb-3 group-hover:scale-110 transition-transform duration-200 shadow-sm">{step.icon}</div>
                  <h3 className="text-[13px] font-semibold text-[#0B0F19] mb-1">{step.title}</h3>
                  <p className="text-[11px] text-[#9CA3AF]">{step.desc}</p>
                </div>
              </motion.div>
              {/* Connector */}
              {i < workflowSteps.length - 1 && (
                <>
                  {/* Desktop — horizontal dotted arrow */}
                  <div className="hidden lg:flex items-center justify-center w-10 flex-shrink-0">
                    <svg width="32" height="16" viewBox="0 0 32 16" fill="none"><line x1="0" y1="8" x2="24" y2="8" stroke="#D1D5DB" strokeWidth="1.5" className="flow-dot" /><polygon points="22,4 30,8 22,12" fill="#D1D5DB" /></svg>
                  </div>
                  {/* Mobile — vertical dotted arrow */}
                  <div className="flex lg:hidden justify-center py-2">
                    <svg width="16" height="28" viewBox="0 0 16 28" fill="none"><line x1="8" y1="0" x2="8" y2="20" stroke="#D1D5DB" strokeWidth="1.5" className="flow-dot" /><polygon points="4,18 8,26 12,18" fill="#D1D5DB" /></svg>
                  </div>
                </>
              )}
            </React.Fragment>
          ))}
        </div>
      </Section>

      {/* ════════════════════════════════════════════
          6. FEATURES
          ════════════════════════════════════════════ */}
      <Section id="features" bg="bg-[#F8FAFC]">
        <div className="text-center mb-14">
          <h2 className="text-[clamp(28px,3.5vw,44px)] font-bold text-[#0B0F19] tracking-tight mb-4">Platform Features</h2>
          <p className="text-base text-[#6B7280]">Everything you need to understand engineering impact.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featureCards.map((card, i) => (
            <motion.div key={card.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.5 }}>
              <div className="bg-white rounded-2xl border border-black/[0.06] p-6 h-full shadow-sm hover:shadow-md hover:border-black/[0.12] transition-all duration-200 group">
                <div className="w-12 h-12 rounded-xl bg-[#F8FAFC] border border-black/[0.06] flex items-center justify-center text-xl mb-5 group-hover:scale-110 transition-transform duration-200">{card.icon}</div>
                <h3 className="text-[15px] font-semibold text-[#0B0F19] mb-2">{card.title}</h3>
                <p className="text-[13px] text-[#6B7280] leading-relaxed">{card.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ════════════════════════════════════════════
          7. SEE CODEPULSE IN ACTION (replaces pricing)
          ════════════════════════════════════════════ */}
      <Section id="demo-preview">
        <div className="text-center mb-14">
          <p className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-widest mb-3">Live Preview</p>
          <h2 className="text-[clamp(28px,3.5vw,44px)] font-bold text-[#0B0F19] tracking-tight mb-4">See CodePulse in Action</h2>
          <p className="text-base text-[#6B7280] max-w-lg mx-auto">A realistic preview of what your engineering dashboard looks like.</p>
        </div>
        <ActionDashboard />
      </Section>

      {/* ════════════════════════════════════════════
          8. FUTURE TIMELINE
          ════════════════════════════════════════════ */}
      <Section id="future" bg="bg-[#F8FAFC]">
        <div className="text-center mb-14">
          <h2 className="text-[clamp(28px,3.5vw,44px)] font-bold text-[#0B0F19] tracking-tight mb-4">What's Next</h2>
          <p className="text-base text-[#6B7280]">Coming soon to CodePulse.</p>
        </div>
        <div className="relative max-w-lg mx-auto">
          <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-[#D1D5DB] via-[#E5E7EB] to-transparent" />
          <div className="space-y-8">
            {futureItems.map((item, i) => (
              <motion.div key={item.title} initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12, duration: 0.5 }}
                className="relative flex items-start gap-6 pl-2">
                <div className="relative z-10 w-3 h-3 rounded-full bg-[#22C55E] flex-shrink-0 mt-1.5" style={{ boxShadow: '0 0 0 4px white' }} />
                <div className="bg-white rounded-xl border border-black/[0.06] p-5 flex-1 shadow-sm hover:shadow-md hover:border-black/[0.12] transition-all duration-200">
                  <div className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0">{item.icon}</span>
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#0B0F19] mb-1">{item.title}</h3>
                      <p className="text-[12px] text-[#6B7280] leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ════════════════════════════════════════════
          9. TEAM
          ════════════════════════════════════════════ */}
      <Section id="team">
        <h2 className="text-[clamp(28px,3.5vw,44px)] font-bold text-[#0B0F19] tracking-tight text-center mb-3">Our Team</h2>
        <p className="text-center text-sm text-[#9CA3AF] mb-12">The minds behind CodePulse</p>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-3xl mx-auto">
          {teamMembers.map((m) => (
            <FlipCard key={m.name} className="h-48"
              front={<>
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${m.color} flex items-center justify-center text-lg font-bold text-white mb-3 shadow-md`}>{m.initials}</div>
                <p className="text-[11px] text-[#9CA3AF]">Click to reveal</p>
              </>}
              back={<>
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center text-sm font-bold text-white mb-3`}>{m.initials}</div>
                <p className="text-[13px] font-semibold text-[#0B0F19] leading-snug">{m.name}</p>
              </>}
            />
          ))}
        </div>
      </Section>

      {/* ════════════════════════════════════════════
          10. CTA
          ════════════════════════════════════════════ */}
      <Section id="cta" bg="bg-[#F8FAFC]" className="!pb-6">
        <div className="bg-[#0B0F19] rounded-2xl p-10 md:p-16 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Ready to transform your engineering insights?</h2>
          <p className="text-sm text-[#94A3B8] mb-8 max-w-xl mx-auto">Connect your repository and let CodePulse deliver actionable intelligence in minutes.</p>
          <button onClick={() => onNavigate('setup')} className="px-8 py-3.5 rounded-lg text-[14px] font-semibold text-[#0B0F19] bg-white hover:bg-gray-100 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg">
            Get Started — It's Free
          </button>
        </div>
      </Section>

      {/* ════════════════════════════════════════════
          FOOTER
          ════════════════════════════════════════════ */}
      <footer className="border-t border-black/[0.06] py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <CodePulseLogo size={20} />
          <span className="text-sm font-semibold text-[#0B0F19]">CodePulse</span>
        </div>
        <p className="text-[12px] text-[#9CA3AF]">© 2026 CodePulse · AI-Powered Developer Intelligence</p>
      </footer>
    </div>
  );
}

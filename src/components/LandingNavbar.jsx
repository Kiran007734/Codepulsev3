import React, { useState, useEffect, useRef, memo } from 'react';
import CodePulseLogo from './CodePulseLogo';

/* ── dropdown data ── */
const platformItems = [
  { icon: '📊', label: 'Developer Intelligence', desc: 'Impact scoring beyond commit counts' },
  { icon: '📋', label: 'Plan vs Reality', desc: 'Jira tasks matched to GitHub commits' },
  { icon: '🧠', label: 'Skill Intelligence', desc: 'Expertise mapped from code contributions' },
  { icon: '⚠️', label: 'Risk Detection', desc: 'Identify single points of failure' },
];

const whyItems = [
  { icon: '🎯', label: 'For Engineering Leaders', desc: 'Data-driven team management' },
  { icon: '💡', label: 'For Developers', desc: 'Fair, transparent contribution scoring' },
];

const resourceItems = [
  { icon: '📖', label: 'Documentation', desc: 'Guides and API reference' },
  { icon: '🔗', label: 'GitHub', desc: 'Open source repository' },
];

const navLinks = [
  { label: 'Platform', href: '#features', hasDropdown: 'platform' },
  { label: 'Why CodePulse', href: '#problem-solution', hasDropdown: 'why' },
  { label: 'Community', href: '#team' },
  { label: 'Resources', href: '#how-it-works', hasDropdown: 'resources' },
];

const dropdownMap = { platform: platformItems, why: whyItems, resources: resourceItems };

function LandingNavbar({ onNavigate }) {
  const [scrolled, setScrolled] = useState(false);
  const [openDd, setOpenDd] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const ddRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    const fn = (e) => { if (ddRef.current && !ddRef.current.contains(e.target)) setOpenDd(null); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const enter = (id) => { clearTimeout(timerRef.current); setOpenDd(id); };
  const leave = () => { timerRef.current = setTimeout(() => setOpenDd(null), 180); };

  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
      scrolled
        ? 'bg-white/90 backdrop-blur-xl border-b border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
        : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between h-14">
        {/* ── Logo ── */}
        <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({top:0,behavior:'smooth'}); }} className="flex items-center gap-2">
          <CodePulseLogo size={28} />
          <span className="text-base font-bold text-[#0B0F19]">CodePulse</span>
        </a>

        {/* ── Center links (desktop) ── */}
        <div className="hidden lg:flex items-center gap-1" ref={ddRef}>
          {navLinks.map((link) =>
            link.hasDropdown ? (
              <div key={link.label} className="relative" onMouseEnter={() => enter(link.hasDropdown)} onMouseLeave={leave}>
                <button className="flex items-center gap-1 px-3.5 py-2 rounded-lg text-[13px] font-medium text-[#6B7280] hover:text-[#0B0F19] transition-colors">
                  {link.label}
                  <svg className={`w-3.5 h-3.5 transition-transform ${openDd === link.hasDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {/* Dropdown */}
                <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 rounded-xl border border-black/[0.06] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.08)] transition-all duration-200 origin-top ${
                  openDd === link.hasDropdown ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
                } ${link.hasDropdown === 'platform' ? 'w-[360px]' : 'w-[300px]'}`}>
                  <div className="p-2">
                    {dropdownMap[link.hasDropdown]?.map((item) => (
                      <a key={item.label} href={link.href} className="flex items-start gap-3 p-3 rounded-lg hover:bg-[#F8FAFC] transition-colors" onClick={() => setOpenDd(null)}>
                        <span className="text-lg mt-0.5 flex-shrink-0">{item.icon}</span>
                        <div>
                          <p className="text-[13px] font-semibold text-[#0B0F19]">{item.label}</p>
                          <p className="text-[11px] text-[#9CA3AF] mt-0.5">{item.desc}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <a key={link.label} href={link.href} className="px-3.5 py-2 rounded-lg text-[13px] font-medium text-[#6B7280] hover:text-[#0B0F19] transition-colors">
                {link.label}
              </a>
            )
          )}
        </div>

        {/* ── Right actions ── */}
        <div className="hidden lg:flex items-center gap-2.5">
          <button onClick={() => onNavigate('setup')} className="px-4 py-2 text-[13px] font-medium text-[#6B7280] hover:text-[#0B0F19] transition-colors">
            Login
          </button>
          <button onClick={() => onNavigate('setup')} className="px-5 py-2.5 rounded-lg text-[13px] font-semibold text-white bg-[#0B0F19] hover:bg-[#1a1f2e] transition-all duration-200 hover:scale-[1.02] hover:shadow-lg">
            Get Started
          </button>
        </div>

        {/* ── Mobile hamburger ── */}
        <button className="lg:hidden p-2 text-[#6B7280]" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-black/[0.06] px-6 py-4 space-y-1">
          {navLinks.map((l) => (
            <a key={l.label} href={l.href} className="block px-4 py-3 rounded-lg text-sm font-medium text-[#6B7280] hover:bg-[#F8FAFC]" onClick={() => setMobileOpen(false)}>{l.label}</a>
          ))}
          <button onClick={() => { onNavigate('setup'); setMobileOpen(false); }} className="w-full mt-2 py-3 rounded-lg text-sm font-semibold text-white bg-[#0B0F19]">Get Started</button>
        </div>
      )}
    </nav>
  );
}

export default memo(LandingNavbar);

import React, { useState, useEffect, useRef, useCallback } from 'react';

const NAV_GROUPS = [
  {
    label: 'Product',
    children: [
      { label: 'Features',      path: '/features',      icon: '⚡', desc: 'All platform capabilities' },
      { label: 'How it Works',  path: '/how-it-works',  icon: '🔄', desc: 'Architecture & workflow' },
      { label: 'Security',      path: '/security',      icon: '🔒', desc: 'Encryption & compliance' },
      { label: 'Integrations',  path: '/integrations',  icon: '🔗', desc: '65+ connected services' },
    ],
  },
  {
    label: 'Solutions',
    children: [
      { label: 'AI Agents',          path: '/agent-designer',   icon: '🤖', desc: 'Visual no-code agent builder' },
      { label: 'Knowledge Bases',    path: '/knowledge-bases',  icon: '📚', desc: 'RAG with hybrid search' },
      { label: 'Deep Research',      path: '/deep-research',    icon: '🔬', desc: 'Multi-agent research pipeline' },
      { label: 'AI Notebooks',       path: '/ai-notebooks',     icon: '📓', desc: 'NotebookLM-style workspace' },
      { label: 'Meeting Notes',      path: '/meeting-notes',    icon: '🎙️', desc: 'Transcription & AI enrichment' },
      { label: 'Task Automation',    path: '/task-automation',   icon: '⚡', desc: 'Cross-app AI automation' },
      { label: 'Search Engine',      path: '/search-engine',    icon: '🔍', desc: 'Self-hosted AI search' },
      { label: 'MCP Marketplace',    path: '/mcp-marketplace',  icon: '🔌', desc: '65+ tool servers' },
    ],
  },
  {
    label: 'Company',
    children: [
      { label: 'About',    path: '/about',   icon: '🐝', desc: 'Our mission & team' },
      { label: 'Careers',  path: '/careers',  icon: '💼', desc: 'Join the team' },
      { label: 'Contact',  path: '/contact',  icon: '📧', desc: 'Get in touch' },
    ],
  },
];

export default function HomeHeader({ onNavigate, onLoginClick }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [mobileExpandedGroup, setMobileExpandedGroup] = useState(null);
  const dropdownRef = useRef(null);
  const closeTimer = useRef(null);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const currentPath = window.location.pathname;

  const go = (path) => {
    setMenuOpen(false);
    setOpenDropdown(null);
    onNavigate(path);
  };

  const handleMouseEnter = useCallback((label) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenDropdown(label);
  }, []);

  const handleMouseLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpenDropdown(null), 200);
  }, []);

  return (
    <>
      <header className={`hp-header${scrolled ? ' scrolled' : ''}`}>
        <div className="hp-header-inner">
          <button
            className="hp-logo"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onClick={() => go('/')}
          >
            <img src="/bee-flow-logo.svg" alt="Bee Flow" />
            <span>Bee Flow<span className="dot">.</span></span>
          </button>

          <nav className="hp-nav" ref={dropdownRef}>
            {NAV_GROUPS.map((group) => (
              <div
                key={group.label}
                className="hp-nav-group"
                onMouseEnter={() => handleMouseEnter(group.label)}
                onMouseLeave={handleMouseLeave}
              >
                <button
                  className={`hp-nav-trigger${openDropdown === group.label ? ' open' : ''}`}
                  onClick={() => setOpenDropdown(openDropdown === group.label ? null : group.label)}
                >
                  {group.label}
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor" style={{ marginLeft: 4, transition: 'transform .2s', transform: openDropdown === group.label ? 'rotate(180deg)' : 'none' }}>
                    <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                {openDropdown === group.label && (
                  <div className="hp-dropdown" onMouseEnter={() => handleMouseEnter(group.label)} onMouseLeave={handleMouseLeave}>
                    {group.children.map((item) => (
                      <a
                        key={item.path}
                        href={item.path}
                        className={`hp-dropdown-item${currentPath === item.path ? ' active' : ''}`}
                        onClick={(e) => { e.preventDefault(); go(item.path); }}
                      >
                        <span className="hp-dropdown-icon">{item.icon}</span>
                        <div>
                          <div className="hp-dropdown-label">{item.label}</div>
                          <div className="hp-dropdown-desc">{item.desc}</div>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="hp-header-right">
            <button className="hp-btn hp-btn--ghost" onClick={onLoginClick}>Log in</button>
            <button className="hp-btn hp-btn--primary" onClick={onLoginClick}>Get Started</button>
            <button
              className={`hp-hamburger${menuOpen ? ' open' : ''}`}
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Menu"
            >
              <span /><span /><span />
            </button>
          </div>
        </div>
      </header>

      <div className={`hp-mobile-nav${menuOpen ? ' open' : ''}`}>
        <button
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 700, padding: '8px 0' }}
          onClick={() => go('/')}
        >
          Home
        </button>
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="hp-mobile-group">
            <button
              className="hp-mobile-group-trigger"
              onClick={() => setMobileExpandedGroup(mobileExpandedGroup === group.label ? null : group.label)}
            >
              {group.label}
              <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor" style={{ marginLeft: 'auto', transition: 'transform .2s', transform: mobileExpandedGroup === group.label ? 'rotate(180deg)' : 'none' }}>
                <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {mobileExpandedGroup === group.label && (
              <div className="hp-mobile-group-items">
                {group.children.map((item) => (
                  <a key={item.path} href={item.path} onClick={e => { e.preventDefault(); go(item.path); }}>
                    <span style={{ marginRight: 8 }}>{item.icon}</span>{item.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
        <button className="hp-btn hp-btn--primary" onClick={() => { setMenuOpen(false); onLoginClick(); }}>
          Log in →
        </button>
      </div>
    </>
  );
}

import React, { useState, useEffect } from 'react';

const NAV_ITEMS = [
  { label: 'Features',      path: '/features' },
  { label: 'How it Works',  path: '/how-it-works' },
  { label: 'Security',      path: '/security' },
  { label: 'Integrations',  path: '/integrations' },
];

export default function HomeHeader({ onNavigate, onLoginClick }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  const currentPath = window.location.pathname;

  const go = (path) => {
    setMenuOpen(false);
    onNavigate(path);
  };

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

          <nav className="hp-nav">
            {NAV_ITEMS.map(({ label, path }) => (
              <a
                key={path}
                href={path}
                className={currentPath === path ? 'active' : ''}
                onClick={e => { e.preventDefault(); go(path); }}
              >
                {label}
              </a>
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
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 700 }}
          onClick={() => go('/')}
        >
          Home
        </button>
        {NAV_ITEMS.map(({ label, path }) => (
          <a key={path} href={path} onClick={e => { e.preventDefault(); go(path); }}>{label}</a>
        ))}
        <button className="hp-btn hp-btn--primary" onClick={() => { setMenuOpen(false); onLoginClick(); }}>
          Log in →
        </button>
      </div>
    </>
  );
}

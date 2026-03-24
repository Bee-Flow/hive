import React, { useEffect } from 'react';
import HomeHeader from './HomeHeader';
import HomeFooter from './HomeFooter';

/**
 * Shared layout wrapper for all homepage pages.
 * KEY DESIGN: Uses data-revealed attribute (not a CSS class) for scroll animations
 * so React's className updates don't overwrite animation state on interactive elements.
 */
export default function HomeLayout({ children, onNavigate, onLoginClick }) {
  useEffect(() => {
    const html = document.documentElement;
    const prevTheme = html.getAttribute('data-theme');
    html.setAttribute('data-theme', 'light');

    const root = document.getElementById('root');
    const prevOverflow = root?.style.overflow || '';
    if (root) {
      root.style.height = 'auto';
      root.style.minHeight = '100dvh';
      root.style.overflow = 'visible';
    }

    return () => {
      if (prevTheme !== null) html.setAttribute('data-theme', prevTheme);
      else html.removeAttribute('data-theme');
      if (root) {
        root.style.height = '';
        root.style.minHeight = '';
        root.style.overflow = prevOverflow;
      }
    };
  }, []);

  // Scroll reveal — uses data-revealed attribute so React className changes don't erase it
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) e.target.setAttribute('data-revealed', '');
      }),
      { threshold: 0.07 }
    );
    document.querySelectorAll('.hp-reveal:not([data-revealed])').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="hp-page">
      <HomeHeader onNavigate={onNavigate} onLoginClick={onLoginClick} />
      <main style={{ flex: 1, paddingTop: 64 }}>
        {children}
      </main>
      <HomeFooter onNavigate={onNavigate} onLoginClick={onLoginClick} />
    </div>
  );
}

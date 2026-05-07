import React, { useEffect, useState } from 'react';
import Button from '../components/Button';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';

const isPreview = () =>
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('preview');

// In preview mode, anchor clicks should not jump-scroll inside the iframe;
// they'd take the admin's focus away from what they were editing.
const navHandler = (e) => {
    if (isPreview()) e.preventDefault();
};

export default function Header({ data }) {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    if (!data?.enabled) return null;

    const initials = (data.logoText || 'B').slice(0, 1).toUpperCase();

    // Nav fallback: if the user hasn't customized header.nav, auto-generate
    // links from the site's pages. Filtering rules:
    //   1. Exclude the homepage (it's reachable via the logo).
    //   2. Exclude pages where showInNav === false (Sitemap toggle).
    //   3. Sort by navOrder ascending (independent of array/page-creation order).
    // When the user adds explicit navLinks in the Site chrome editor, those
    // win and pages aren't auto-listed.
    const userNav = Array.isArray(data.navLinks) ? data.navLinks : [];
    const allPages = Array.isArray(data.pages) ? data.pages : [];
    const autoNav = allPages
        .filter(p => !p.isHomepage)
        .filter(p => p.showInNav !== false)
        .slice()                                    // don't mutate the upstream array
        .sort((a, b) => (a.navOrder ?? 0) - (b.navOrder ?? 0))
        .map(p => ({
            label: p.title || p.slug,
            // Public site is served at `/` (RootPathGate). Routing per page
            // via `?slug=…` keeps the browser at the root path so the BeeFlow
            // app router doesn't intercept and serve the AI chat.
            href:  `/?slug=${encodeURIComponent(p.slug)}`,
            slug:  p.slug,
        }));
    const navItems = userNav.length > 0 ? userNav : autoNav;
    const activeSlug = data.activeSlug || '';
    const isActive = (href, slug) => {
        if (slug && slug === activeSlug) return true;
        if (href === `/${activeSlug}` && activeSlug) return true;
        return false;
    };

    return (
        <SectionFrame id="header" name="Header" enabled={data.enabled}>
            <header className={`header ${scrolled ? 'scrolled' : ''}`}>
                <div className="header-inner">
                    <a href="#" className="header-logo" onClick={navHandler}>
                        <div className="logo-tile">{initials}</div>
                        <span>
                            <EditableText path="header.logoText" placeholder="Logo">
                                {data.logoText || ''}
                            </EditableText>
                            <span className="logo-dot">.</span>
                        </span>
                    </a>
                    <nav className="header-nav">
                        {navItems.map((link, i) => (
                            <a
                                key={i}
                                href={link.href}
                                onClick={navHandler}
                                className={isActive(link.href, link.slug) ? 'active' : undefined}
                            >
                                {/* Only the user-customized nav is inline-editable
                                    (auto-generated entries are derived from page
                                    titles — edit those in the page meta strip). */}
                                {userNav.length > 0 ? (
                                    <EditableText path={`header.navLinks.${i}.label`} placeholder="Link">
                                        {link.label || ''}
                                    </EditableText>
                                ) : (
                                    link.label || ''
                                )}
                            </a>
                        ))}
                    </nav>
                    <div className="header-actions">
                        <Button variant="login" href="/app">
                            <EditableText path="header.loginLabel" placeholder="Log in">
                                {data.loginLabel || 'Log in'}
                            </EditableText>
                        </Button>
                        <Button variant="primary" href={data.ctaHref || '/app'}>
                            <EditableText path="header.ctaLabel" placeholder="Get started">
                                {data.ctaLabel || 'Get started'}
                            </EditableText>
                        </Button>
                        <button
                            type="button"
                            aria-label="Toggle menu"
                            className={`hamburger ${mobileOpen ? 'active' : ''}`}
                            onClick={() => setMobileOpen(v => !v)}
                        >
                            <span /><span /><span />
                        </button>
                    </div>
                </div>
            </header>
            <div className={`mobile-nav ${mobileOpen ? 'active' : ''}`}>
                <div className="mobile-nav-inner">
                    {navItems.map((link, i) => (
                        <a
                            key={i}
                            href={link.href}
                            onClick={(e) => { navHandler(e); setMobileOpen(false); }}
                            className={isActive(link.href, link.slug) ? 'active' : undefined}
                        >
                            {link.label}
                        </a>
                    ))}
                    <a href="/app" onClick={navHandler}>{data.loginLabel || 'Log in'}</a>
                </div>
            </div>
        </SectionFrame>
    );
}

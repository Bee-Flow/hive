import React, { useEffect, useState } from 'react';
import Button from '../components/Button';

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

    return (
        <>
            <header className={`header ${scrolled ? 'scrolled' : ''}`}>
                <div className="header-inner">
                    <a href="#" className="header-logo">
                        <div className="logo-tile">{initials}</div>
                        <span>{data.logoText}<span className="logo-dot">.</span></span>
                    </a>
                    <nav className="header-nav">
                        {(data.navLinks || []).map((link, i) => (
                            <a key={i} href={link.href}>{link.label}</a>
                        ))}
                    </nav>
                    <div className="header-actions">
                        <Button variant="login" href="/app">{data.loginLabel || 'Log in'}</Button>
                        <Button variant="primary" href={data.ctaHref || '/app'}>{data.ctaLabel || 'Get started'}</Button>
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
                    {(data.navLinks || []).map((link, i) => (
                        <a key={i} href={link.href} onClick={() => setMobileOpen(false)}>{link.label}</a>
                    ))}
                    <a href="/app">{data.loginLabel || 'Log in'}</a>
                </div>
            </div>
        </>
    );
}

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
                        {(data.navLinks || []).map((link, i) => (
                            <a key={i} href={link.href} onClick={navHandler}>
                                <EditableText path={`header.navLinks.${i}.label`} placeholder="Link">
                                    {link.label || ''}
                                </EditableText>
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
                    {(data.navLinks || []).map((link, i) => (
                        <a key={i} href={link.href} onClick={(e) => { navHandler(e); setMobileOpen(false); }}>
                            {link.label}
                        </a>
                    ))}
                    <a href="/app" onClick={navHandler}>{data.loginLabel || 'Log in'}</a>
                </div>
            </div>
        </SectionFrame>
    );
}

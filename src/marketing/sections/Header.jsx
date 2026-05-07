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

    // Logo & brand — `data.logo` is the new shape; we fall back to the
    // legacy data.logoText / letter-avatar so existing sites with no
    // `logo` key still render the original logo.
    const logo       = data.logo || {};
    const brandText  = (logo.text !== undefined ? logo.text : data.logoText) || '';
    const initials   = (brandText || 'B').slice(0, 1).toUpperCase();
    const fontSizePx = logo.fontSize === 'small'  ? 14
                     : logo.fontSize === 'large'  ? 24
                     : logo.fontSize === 'medium' ? 18 : undefined;
    const brandTextStyle = {};
    if (logo.textColor) brandTextStyle.color    = logo.textColor;
    if (fontSizePx)     brandTextStyle.fontSize = `${fontSizePx}px`;

    // Nav is fully owned by the user via Site chrome → Nav links. Pages
    // no longer auto-merge into the nav — adding a page in the Pages
    // panel does NOT make it appear here. To link a page from the nav,
    // add an item with link kind = "Internal page".
    const navItems = Array.isArray(data.navLinks) ? data.navLinks : [];
    const activeSlug = data.activeSlug || '';
    // A nav item is "active" when its href matches the slug of the page
    // currently being viewed. Page-kind links resolve to `/slug` (or `/`
    // for the homepage) via resolveLink / resolvePreviewHref, so a plain
    // string compare is enough.
    const isActive = (href) => {
        if (!activeSlug || !href) return false;
        return href === `/${activeSlug}` || href === `/${encodeURIComponent(activeSlug)}`;
    };

    return (
        <SectionFrame id="header" name="Header" enabled={data.enabled}>
            <header className={`header ${scrolled ? 'scrolled' : ''}`}>
                <div className="header-inner">
                    <a href="#" className="header-logo" onClick={navHandler}>
                        {logo.src ? (
                            // Image logo — uploaded via Site chrome → Logo image.
                            // Constrained to roughly the same vertical footprint
                            // as the letter avatar so the header height doesn't
                            // jump when switching between modes.
                            <img
                                src={logo.src}
                                alt={brandText || 'Logo'}
                                className="logo-image"
                            />
                        ) : (
                            // Letter-avatar fallback for sites without an
                            // uploaded logo image (also covers freshly-created
                            // sites that have no `logo` field at all).
                            <div className="logo-tile">{initials}</div>
                        )}
                        <span style={brandTextStyle}>
                            <EditableText path="header.logo.text" placeholder="Logo">
                                {brandText}
                            </EditableText>
                            <span className="logo-dot">.</span>
                        </span>
                    </a>
                    <nav className="header-nav">
                        {navItems.map((link, i) => {
                            const children = Array.isArray(link.children) ? link.children : [];
                            const hasDropdown = children.length > 0;
                            if (!hasDropdown) {
                                return (
                                    <a
                                        key={i}
                                        href={link.href}
                                        target={link.target}
                                        rel={link.rel}
                                        onClick={navHandler}
                                        className={isActive(link.href) ? 'active' : undefined}
                                    >
                                        <EditableText path={`header.navLinks.${i}.label`} placeholder="Link">
                                            {link.label || ''}
                                        </EditableText>
                                    </a>
                                );
                            }
                            return (
                                <div key={i} className="nav-item has-dropdown">
                                    <a
                                        href={link.href}
                                        target={link.target}
                                        rel={link.rel}
                                        onClick={navHandler}
                                        className={isActive(link.href) ? 'active' : undefined}
                                    >
                                        <EditableText path={`header.navLinks.${i}.label`} placeholder="Link">
                                            {link.label || ''}
                                        </EditableText>
                                    </a>
                                    <ul className="nav-dropdown">
                                        {children.map((child, j) => (
                                            <li key={j}>
                                                <a
                                                    href={child.href}
                                                    target={child.target}
                                                    rel={child.rel}
                                                    onClick={navHandler}
                                                    className={isActive(child.href) ? 'active' : undefined}
                                                >
                                                    <EditableText
                                                        path={`header.navLinks.${i}.children.${j}.label`}
                                                        placeholder="Link"
                                                    >
                                                        {child.label || ''}
                                                    </EditableText>
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        })}
                    </nav>
                    <div className="header-actions">
                        {(data.ctas || []).map((cta, i) => (
                            <Button
                                key={cta.id || i}
                                variant={cta.style || 'primary'}
                                href={cta.href || '/app'}
                                target={cta.target}
                                rel={cta.rel}
                            >
                                <EditableText path={`header.ctas.${i}.label`} placeholder="Button">
                                    {cta.label || ''}
                                </EditableText>
                            </Button>
                        ))}
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
                    {navItems.map((link, i) => {
                        const children = Array.isArray(link.children) ? link.children : [];
                        return (
                            <React.Fragment key={i}>
                                <a
                                    href={link.href}
                                    target={link.target}
                                    rel={link.rel}
                                    onClick={(e) => { navHandler(e); setMobileOpen(false); }}
                                    className={isActive(link.href) ? 'active' : undefined}
                                >
                                    {link.label}
                                </a>
                                {/* Mobile: dropdown children are always visible,
                                    indented under the parent — no hover state on
                                    touch surfaces. */}
                                {children.length > 0 ? (
                                    <div className="mobile-nav-children">
                                        {children.map((child, j) => (
                                            <a
                                                key={j}
                                                href={child.href}
                                                target={child.target}
                                                rel={child.rel}
                                                onClick={(e) => { navHandler(e); setMobileOpen(false); }}
                                                className={isActive(child.href) ? 'active' : undefined}
                                            >
                                                {child.label}
                                            </a>
                                        ))}
                                    </div>
                                ) : null}
                            </React.Fragment>
                        );
                    })}
                    {(data.ctas || []).map((cta, i) => (
                        <a
                            key={cta.id || i}
                            href={cta.href || '/app'}
                            target={cta.target}
                            rel={cta.rel}
                            onClick={(e) => { navHandler(e); setMobileOpen(false); }}
                        >
                            {cta.label || ''}
                        </a>
                    ))}
                </div>
            </div>
        </SectionFrame>
    );
}

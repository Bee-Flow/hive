import React, { useEffect, useRef, useState } from 'react';
import Button from '../components/Button';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { inlineTextStyle } from './textStyle';

// Resolve the dropdown shape regardless of which mode the user picked.
// Returns:
//   { kind: 'columns', columns: [{ heading, items: [...] }] }  — mega menu
//   { kind: 'list',    items:   [{ label, href, ... }]      }  — flat
//   null if the link has no dropdown content at all
function readDropdown(link) {
    if (link?.dropdown?.layout === 'columns'
        && Array.isArray(link.dropdown.columns)
        && link.dropdown.columns.length > 0) {
        return { kind: 'columns', columns: link.dropdown.columns };
    }
    if (Array.isArray(link?.children) && link.children.length > 0) {
        return { kind: 'list', items: link.children };
    }
    return null;
}

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
    // Which top-level nav item currently has its dropdown open (desktop).
    // null = none. The 150ms close-delay lets the cursor traverse the gap
    // between the parent link and the mega panel without flicker.
    const [openNavIdx, setOpenNavIdx] = useState(null);
    // Which mobile accordion section is expanded (one at a time).
    const [mobileOpenIdx, setMobileOpenIdx] = useState(null);
    const closeTimerRef = useRef(null);
    const cancelClose = () => {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
    };
    const scheduleClose = () => {
        cancelClose();
        closeTimerRef.current = setTimeout(() => setOpenNavIdx(null), 150);
    };
    useEffect(() => () => cancelClose(), []);

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
    const url        = logo.url;
    const brandText  = (logo.text !== undefined ? logo.text : data.logoText) || '';
    const initials   = (brandText || 'B').slice(0, 1).toUpperCase();
    // Size: prefer the new numeric `titleSize` (px) from the chrome
    // editor; fall back to the legacy t-shirt-size `fontSize` so blocks
    // stored before the editor refresh still render at the user's
    // previously-picked size.
    const legacySizePx = logo.fontSize === 'small'  ? 14
                       : logo.fontSize === 'large'  ? 24
                       : logo.fontSize === 'medium' ? 18 : 0;
    const effectiveSize = Number.isFinite(logo.titleSize) && logo.titleSize > 0
        ? logo.titleSize
        : legacySizePx;
    const brandTextStyle = {};
    if (logo.textColor) brandTextStyle.color = logo.textColor;
    if (effectiveSize)  brandTextStyle.fontSize = `${effectiveSize}px`;
    // New: font family from the chrome editor's "Title font" picker.
    // Quoted when it contains spaces; always falls back to the page's
    // body stack so the page renders before Google Fonts has loaded.
    if (typeof logo.titleFont === 'string' && logo.titleFont.trim()) {
        const name = logo.titleFont.trim().replace(/"/g, '');
        const quoted = /\s/.test(name) ? `"${name}"` : name;
        brandTextStyle.fontFamily = `${quoted}, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    }

    // Nav is fully owned by the user via Site chrome → Nav links. Pages
    // no longer auto-merge into the nav — adding a page in the Pages
    // panel does NOT make it appear here. To link a page from the nav,
    // add an item with link kind = "Internal page".
    const navItems = Array.isArray(data.navLinks) ? data.navLinks : [];
    const activeSlug = data.activeSlug || '';
    // Master nav-link style from Site chrome → Link style. Returns
    // `undefined` when nothing is set so the inline-style attribute is
    // simply not emitted (CSS file defaults still win).
    const navLinkStyle = inlineTextStyle(data.navStyle);
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
                    <a href={url?.trim() || '/'} className="header-logo" onClick={navHandler}>
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
                            const dropdown = readDropdown(link);
                            if (!dropdown) {
                                return (
                                    <a
                                        key={i}
                                        href={link.href}
                                        target={link.target}
                                        rel={link.rel}
                                        onClick={navHandler}
                                        className={isActive(link.href) ? 'active' : undefined}
                                        style={navLinkStyle}
                                    >
                                        <EditableText path={`header.navLinks.${i}.label`} placeholder="Link">
                                            {link.label || ''}
                                        </EditableText>
                                    </a>
                                );
                            }
                            const isOpen = openNavIdx === i;
                            const isMega = dropdown.kind === 'columns';
                            // Hover/focus open the panel; the 150ms delay
                            // on close lets the cursor traverse the gap
                            // between the parent link and the panel.
                            const open  = () => { cancelClose(); setOpenNavIdx(i); };
                            const close = () => scheduleClose();
                            return (
                                <div
                                    key={i}
                                    className={'nav-item has-dropdown' + (isOpen ? ' is-open' : '') + (isMega ? ' is-mega' : '')}
                                    onMouseEnter={open}
                                    onMouseLeave={close}
                                    onFocus={open}
                                    onBlur={close}
                                >
                                    <a
                                        href={link.href}
                                        target={link.target}
                                        rel={link.rel}
                                        onClick={navHandler}
                                        className={isActive(link.href) || isOpen ? 'active' : undefined}
                                        style={navLinkStyle}
                                    >
                                        <EditableText path={`header.navLinks.${i}.label`} placeholder="Link">
                                            {link.label || ''}
                                        </EditableText>
                                    </a>
                                    {isMega ? (
                                        <div className="nav-mega" role="menu">
                                            <div className="nav-mega-grid">
                                                {dropdown.columns.map((col, ci) => (
                                                    <div className="nav-mega-col" key={ci}>
                                                        {col.heading ? (
                                                            <div className="nav-mega-heading">{col.heading}</div>
                                                        ) : null}
                                                        <ul>
                                                            {(col.items || []).map((mi, mj) => (
                                                                <li key={mj}>
                                                                    <a
                                                                        href={mi.href}
                                                                        target={mi.target}
                                                                        rel={mi.rel}
                                                                        onClick={navHandler}
                                                                        className={'nav-mega-item' + (isActive(mi.href) ? ' active' : '')}
                                                                        style={navLinkStyle}
                                                                    >
                                                                        {mi.icon ? (
                                                                            <span className="nav-mega-item-icon" aria-hidden="true">{mi.icon}</span>
                                                                        ) : null}
                                                                        <span className="nav-mega-item-text">
                                                                            <span className="nav-mega-item-label">
                                                                                <EditableText
                                                                                    path={`header.navLinks.${i}.dropdown.columns.${ci}.items.${mj}.label`}
                                                                                    placeholder="Item"
                                                                                >
                                                                                    {mi.label || ''}
                                                                                </EditableText>
                                                                            </span>
                                                                            {mi.description ? (
                                                                                <span className="nav-mega-item-desc">{mi.description}</span>
                                                                            ) : null}
                                                                        </span>
                                                                    </a>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <ul className="nav-dropdown">
                                            {dropdown.items.map((child, j) => (
                                                <li key={j}>
                                                    <a
                                                        href={child.href}
                                                        target={child.target}
                                                        rel={child.rel}
                                                        onClick={navHandler}
                                                        className={isActive(child.href) ? 'active' : undefined}
                                                        style={navLinkStyle}
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
                                    )}
                                </div>
                            );
                        })}
                    </nav>
                    <div className="header-actions">
                        <LanguageSwitcher />
                        {(data.ctas || []).map((cta, i) => {
                            // Per-button label styling. The Button component
                            // owns the variant background / border / radius;
                            // typography overrides ride on an inner span so
                            // they don't fight the variant's color rules.
                            const labelStyle = inlineTextStyle({
                                fontFamily: cta.labelFont,
                                fontSize:   cta.labelSize,
                                color:      cta.labelColor,
                            });
                            return (
                            <Button
                                key={cta.id || i}
                                variant={cta.style || 'primary'}
                                href={cta.href || '/app'}
                                target={cta.target}
                                rel={cta.rel}
                            >
                                <span style={labelStyle}>
                                    <EditableText path={`header.ctas.${i}.label`} placeholder="Button">
                                        {cta.label || ''}
                                    </EditableText>
                                </span>
                            </Button>
                            );
                        })}
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
                        const dropdown = readDropdown(link);
                        // Mobile: tap parent to toggle the accordion; if
                        // there's no dropdown, the parent link navigates.
                        const rowExpanded = mobileOpenIdx === i;
                        const onParentClick = (e) => {
                            if (dropdown) {
                                e.preventDefault();
                                setMobileOpenIdx(rowExpanded ? null : i);
                                return;
                            }
                            navHandler(e);
                            setMobileOpen(false);
                        };
                        return (
                            <React.Fragment key={i}>
                                <a
                                    href={link.href}
                                    target={link.target}
                                    rel={link.rel}
                                    onClick={onParentClick}
                                    className={(isActive(link.href) || rowExpanded) ? 'active' : undefined}
                                    style={navLinkStyle}
                                    aria-expanded={dropdown ? rowExpanded : undefined}
                                >
                                    {link.label}
                                </a>
                                {/* Mobile dropdown — accordion. For columns
                                    layout we render each column's heading
                                    as a small caption followed by its items.
                                    For list layout we render the items flat
                                    (same as before). */}
                                {dropdown && rowExpanded ? (
                                    <div className="mobile-nav-children">
                                        {dropdown.kind === 'columns' ? (
                                            dropdown.columns.map((col, ci) => (
                                                <React.Fragment key={ci}>
                                                    {col.heading ? (
                                                        <div className="mobile-nav-heading">{col.heading}</div>
                                                    ) : null}
                                                    {(col.items || []).map((mi, mj) => (
                                                        <a
                                                            key={`${ci}-${mj}`}
                                                            href={mi.href}
                                                            target={mi.target}
                                                            rel={mi.rel}
                                                            onClick={(e) => { navHandler(e); setMobileOpen(false); }}
                                                            className={isActive(mi.href) ? 'active' : undefined}
                                                            style={navLinkStyle}
                                                        >
                                                            {mi.icon ? <span aria-hidden="true" style={{ marginRight: 8 }}>{mi.icon}</span> : null}
                                                            {mi.label}
                                                        </a>
                                                    ))}
                                                </React.Fragment>
                                            ))
                                        ) : (
                                            dropdown.items.map((child, j) => (
                                                <a
                                                    key={j}
                                                    href={child.href}
                                                    target={child.target}
                                                    rel={child.rel}
                                                    onClick={(e) => { navHandler(e); setMobileOpen(false); }}
                                                    className={isActive(child.href) ? 'active' : undefined}
                                                    style={navLinkStyle}
                                                >
                                                    {child.label}
                                                </a>
                                            ))
                                        )}
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

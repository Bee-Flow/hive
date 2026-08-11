import React, { useEffect, useRef, useState } from 'react';
import Button from '../components/Button';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';
import LanguageSwitcher from '../components/LanguageSwitcher';
import NavIcon from '../components/NavIcon';
import MobileNav from './MobileNav';
import { readDropdown, navHandler } from './navShared';
import { inlineTextStyle } from './textStyle';
import { resolveAssetUrl } from '../assetUrl';

// `showLanguageSwitcher` deliberately mirrors the FOOTER's chrome flag (one
// switch controls both switchers): offering seven languages while zero pages
// are translated is a dead control, so the site hides both until the
// translation round actually lands.
export default function Header({ data, showLanguageSwitcher = true }) {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    // Which top-level nav item currently has its dropdown open (desktop).
    // null = none. The 150ms close-delay lets the cursor traverse the gap
    // between the parent link and the mega panel without flicker.
    const [openNavIdx, setOpenNavIdx] = useState(null);
    const closeTimerRef = useRef(null);
    const navRef = useRef(null);
    // Whether the panel was open at POINTERDOWN time. The wrapper's
    // onFocus={open} fires between pointerdown and click (mousedown focuses
    // the anchor), so by click time `isOpen` is already true and a naive
    // toggle would close what the same tap just opened — making the panel
    // unreachable on touch. Captured before focus can interfere; null when
    // the click came from the keyboard (no pointerdown), where the live
    // state IS accurate.
    const triggerDownOpenRef = useRef(null);
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

    // Escape closes whatever is open. Without it, a keyboard user who opens
    // a mega menu has to tab through every item in it to get back out.
    useEffect(() => {
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            cancelClose();
            setOpenNavIdx(null);
            setMobileOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    // Close the desktop panel on a click anywhere outside the nav. Hover
    // cannot close it on a touch device — there is no "mouse leave" — so
    // without this a tapped-open panel would stay open indefinitely.
    useEffect(() => {
        if (openNavIdx === null) return undefined;
        const onDown = (e) => {
            if (navRef.current && !navRef.current.contains(e.target)) {
                cancelClose();
                setOpenNavIdx(null);
            }
        };
        document.addEventListener('pointerdown', onDown);
        return () => document.removeEventListener('pointerdown', onDown);
    }, [openNavIdx]);

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
    // currently being viewed. Page-kind links resolve to `/slug` on the
    // published site (resolveLink) but to `/?slug=slug` in the admin preview
    // (resolvePreviewHref keeps pathname '/' so the app router doesn't
    // intercept) — match both forms. The homepage resolves to `/` with an
    // empty activeSlug in both resolvers.
    const isActive = (href) => {
        if (!href) return false;
        if (!activeSlug) return href === '/';
        const enc = encodeURIComponent(activeSlug);
        return href === `/${activeSlug}` || href === `/${enc}`
            || href === `/?slug=${activeSlug}` || href === `/?slug=${enc}`;
    };

    return (
        <SectionFrame id="header" name="Header" enabled={data.enabled}>
            {/* `nav-open` gives the bar a background while a panel or the
                drawer is showing. At the top of the page the header is
                deliberately transparent, which left an opaque panel hanging
                off an invisible bar. */}
            <header className={`header ${scrolled ? 'scrolled' : ''}`
                + (openNavIdx !== null || mobileOpen ? ' nav-open' : '')}>
                <div className="header-inner">
                    <a href={url?.trim() || '/'} className="header-logo" onClick={navHandler}>
                        {logo.src ? (
                            // Image logo — uploaded via Site chrome → Logo image.
                            // Constrained to roughly the same vertical footprint
                            // as the letter avatar so the header height doesn't
                            // jump when switching between modes.
                            <img
                                // resolveAssetUrl, NOT the raw value. A stored
                                // logo is a key like `cms/beeflow-logo.svg`,
                                // which as a bare src is RELATIVE: on /solutions
                                // the browser asked for /solutions/cms/… , hit
                                // the SPA's catch-all, and got index.html back
                                // with content-type text/html. The logo was a
                                // broken-image icon on every page of the site.
                                src={resolveAssetUrl(logo.src)}
                                // Decorative when the brand name is also
                                // rendered beside it — otherwise a screen
                                // reader announces "Bee Flow Bee Flow".
                                alt={brandText ? '' : 'Logo'}
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
                            {/* Opt-in flourish — the always-on "." read as a
                                template artifact on most brand names. */}
                            {logo.showDot === true ? <span className="logo-dot">.</span> : null}
                        </span>
                    </a>
                    <nav className="header-nav" ref={navRef}>
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
                            const closeNow = () => { cancelClose(); setOpenNavIdx(null); };
                            // A trigger that owns a dropdown never navigates:
                            // click (and Enter/Space) toggles the panel. It
                            // used to follow its own href, which sent a click
                            // on "Resources" straight to the first child page
                            // before the panel could be used. Modified clicks
                            // (ctrl/cmd/shift — new tab/window) keep native
                            // link behavior on the href.
                            const onTriggerPointerDown = () => {
                                triggerDownOpenRef.current = isOpen;
                            };
                            const onTriggerClick = (e) => {
                                if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
                                e.preventDefault();
                                // Pointer interactions decide on the state
                                // captured at pointerdown (see the ref note);
                                // keyboard "clicks" use the live state.
                                const wasOpen = triggerDownOpenRef.current !== null
                                    ? triggerDownOpenRef.current
                                    : isOpen;
                                triggerDownOpenRef.current = null;
                                if (wasOpen) closeNow(); else open();
                            };
                            // Enter fires a native click on the anchor; Space
                            // only scrolls unless handled explicitly. Escape
                            // is handled by the window-level listener above.
                            const onTriggerKeyDown = (e) => {
                                if (e.key !== ' ') return;
                                e.preventDefault();
                                if (isOpen) closeNow(); else open();
                            };
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
                                        onPointerDown={onTriggerPointerDown}
                                        onClick={onTriggerClick}
                                        onKeyDown={onTriggerKeyDown}
                                        className={isActive(link.href) || isOpen ? 'active' : undefined}
                                        style={navLinkStyle}
                                        // It behaves as a disclosure button now
                                        // (plain click never navigates), so it
                                        // announces as one.
                                        role="button"
                                        aria-haspopup="true"
                                        aria-expanded={isOpen}
                                    >
                                        <EditableText path={`header.navLinks.${i}.label`} placeholder="Link">
                                            {link.label || ''}
                                        </EditableText>
                                    </a>
                                    {/* No role="menu": that role expects
                                        `menuitem` children and application-
                                        menu arrow-key semantics. This is a
                                        panel of ordinary links, and saying
                                        otherwise made screen readers
                                        announce a menu with no items. */}
                                    {isMega ? (
                                        <div className="nav-mega">
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
                                                                            <span className="nav-mega-item-icon" aria-hidden="true">
                                                                                <NavIcon icon={mi.icon} />
                                                                            </span>
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
                        {showLanguageSwitcher ? <LanguageSwitcher /> : null}
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
            <MobileNav
                open={mobileOpen}
                onClose={() => setMobileOpen(false)}
                navItems={navItems}
                ctas={data.ctas}
                isActive={isActive}
                navLinkStyle={navLinkStyle}
            />
        </SectionFrame>
    );
}

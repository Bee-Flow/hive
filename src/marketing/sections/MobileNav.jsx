import React, { useEffect, useState } from 'react';
import { readDropdown, navHandler } from './navShared';
import NavIcon from '../components/NavIcon';

const Chevron = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
    </svg>
);

/**
 * The slide-down drawer that replaces the nav below 1024px.
 *
 * It owns which accordion section is expanded, because nothing outside it
 * needs to know. Everything else — the link data, the active-slug test, the
 * user's nav-link styling — comes from the header.
 *
 * The scrim is rendered here too, immediately before the drawer, so source
 * order alone keeps it painted underneath.
 */
export default function MobileNav({
    open,
    onClose,
    navItems,
    ctas,
    isActive,
    navLinkStyle,
}) {
    // One section at a time. It deliberately survives a close/reopen: if you
    // went into Product, came back and opened the menu again, you almost
    // certainly want Product still open. (Resetting it from an effect on
    // `open` would also mean a cascading render on every close.)
    const [expandedIdx, setExpandedIdx] = useState(null);

    // Lock the page while the drawer is open. Otherwise the body scrolls
    // underneath it and closing the menu drops you somewhere you never
    // navigated to.
    useEffect(() => {
        if (!open) return undefined;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previous; };
    }, [open]);

    // Every navigating link inside the drawer closes it. In preview mode
    // navHandler swallows the click, so the drawer closing is the only
    // feedback an editor gets — which is why it happens either way.
    const closeAndGo = (e) => { navHandler(e); onClose(); };

    return (
        <>
            {/* Tapping the scrim closes — the only affordance a phone user
                has besides scrolling back up to the hamburger. */}
            <div
                className={`mobile-nav-scrim ${open ? 'active' : ''}`}
                onClick={onClose}
                aria-hidden="true"
            />
            <div className={`mobile-nav ${open ? 'active' : ''}`}>
                <div className="mobile-nav-inner">
                    {navItems.map((link, i) => {
                        const dropdown = readDropdown(link);
                        const expanded = expandedIdx === i;
                        const toggleRow = () => setExpandedIdx(expanded ? null : i);
                        return (
                            <React.Fragment key={i}>
                                {/* The label navigates; the caret expands.
                                    These used to be one control that only
                                    ever expanded, which left a parent page
                                    (Product → /platform) unreachable on a
                                    phone. A parent with no href of its own
                                    falls back to toggling on the label. */}
                                <div className="mobile-nav-row">
                                    {link.href ? (
                                        <a
                                            href={link.href}
                                            target={link.target}
                                            rel={link.rel}
                                            onClick={closeAndGo}
                                            className={isActive(link.href) ? 'active' : undefined}
                                            style={navLinkStyle}
                                        >
                                            {link.label}
                                        </a>
                                    ) : (
                                        <button
                                            type="button"
                                            className="mobile-nav-label"
                                            style={navLinkStyle}
                                            onClick={dropdown ? toggleRow : undefined}
                                        >
                                            {link.label}
                                        </button>
                                    )}
                                    {dropdown ? (
                                        <button
                                            type="button"
                                            className="mobile-nav-caret"
                                            aria-expanded={expanded}
                                            aria-label={`${link.label || 'Menu'} submenu`}
                                            onClick={toggleRow}
                                        >
                                            <Chevron />
                                        </button>
                                    ) : null}
                                </div>
                                {dropdown && expanded ? (
                                    <div className="mobile-nav-children">
                                        {dropdown.kind === 'columns'
                                            ? dropdown.columns.map((col, ci) => (
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
                                                            onClick={closeAndGo}
                                                            className={'mobile-nav-item' + (isActive(mi.href) ? ' active' : '')}
                                                            style={navLinkStyle}
                                                        >
                                                            {mi.icon ? (
                                                                <span className="mobile-nav-item-icon" aria-hidden="true">
                                                                    <NavIcon icon={mi.icon} />
                                                                </span>
                                                            ) : null}
                                                            <span>
                                                                {mi.label}
                                                                {/* The descriptions are what make the
                                                                    mega menu legible; dropping them on
                                                                    mobile left nine bare labels with no
                                                                    way to tell "Assistants" from
                                                                    "Notebooks". */}
                                                                {mi.description ? (
                                                                    <span className="mobile-nav-item-desc">{mi.description}</span>
                                                                ) : null}
                                                            </span>
                                                        </a>
                                                    ))}
                                                </React.Fragment>
                                            ))
                                            : dropdown.items.map((child, j) => (
                                                <a
                                                    key={j}
                                                    href={child.href}
                                                    target={child.target}
                                                    rel={child.rel}
                                                    onClick={closeAndGo}
                                                    className={isActive(child.href) ? 'active' : undefined}
                                                    style={navLinkStyle}
                                                >
                                                    {child.label}
                                                </a>
                                            ))}
                                    </div>
                                ) : null}
                            </React.Fragment>
                        );
                    })}
                    {(ctas || []).map((cta, i) => (
                        <a
                            key={cta.id || i}
                            href={cta.href || '/app'}
                            target={cta.target}
                            rel={cta.rel}
                            onClick={closeAndGo}
                            className={'mobile-nav-cta mobile-nav-cta--'
                                + ((cta.style || 'primary') === 'primary' ? 'primary' : 'secondary')}
                        >
                            {cta.label || ''}
                        </a>
                    ))}
                </div>
            </div>
        </>
    );
}

import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import AppIcon from '../../../../../AppIcon';

/**
 * NavTabs — the top-bar tab row (nav.style 'tabs', the default). Groups are
 * FLATTENED here (navModel's flat order); the underline active treatment is
 * the pre-A2 shell's, byte-for-byte.
 *
 * Overflow: an invisible measure row (aria-hidden, absolute) always renders
 * every tab plus the "Meer" button; a ResizeObserver on the visible row
 * recomputes how many tabs fit and the rest collapse into a "Meer ▾" menu.
 * Unmeasured environments (jsdom, 0-width) show every tab — exactly the old
 * behaviour, which is what the pinned tests assert.
 */

const TAB_CLS = 'inline-flex items-center gap-1.5 px-3 text-sm font-medium self-stretch';

function tabStyle(isActive) {
    return isActive
        ? { color: 'var(--app-primary)', boxShadow: 'inset 0 -2px 0 var(--app-primary)' }
        : { color: 'var(--text-secondary)' };
}

function TabLabel({ screen }) {
    return (
        <>
            {screen.icon ? <AppIcon name={screen.icon} className="w-3.5 h-3.5" /> : null}
            <span>{screen.name}</span>
        </>
    );
}

export default function NavTabs({ screens, screenId, onNavigate }) {
    const navRef = useRef(null);
    const measureRefs = useRef([]);
    const moreMeasureRef = useRef(null);
    const menuRef = useRef(null);
    const [visibleCount, setVisibleCount] = useState(screens.length);
    const [menuOpen, setMenuOpen] = useState(false);

    const measure = useCallback(() => {
        const nav = navRef.current;
        if (!nav) return;
        const available = nav.clientWidth;
        // Unmeasured (jsdom / display:none) — show everything.
        if (!available) { setVisibleCount(screens.length); return; }
        const widths = screens.map((_, i) => measureRefs.current[i]?.offsetWidth || 0);
        const total = widths.reduce((a, b) => a + b, 0);
        if (total <= available) { setVisibleCount(screens.length); return; }
        const moreWidth = moreMeasureRef.current?.offsetWidth || 64;
        let used = moreWidth;
        let count = 0;
        for (const w of widths) {
            if (used + w > available) break;
            used += w;
            count += 1;
        }
        setVisibleCount(count);
    }, [screens]);

    useLayoutEffect(() => { measure(); }, [measure]);

    useEffect(() => {
        const nav = navRef.current;
        if (!nav || typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(() => measure());
        observer.observe(nav);
        return () => observer.disconnect();
    }, [measure]);

    // Close the overflow menu on outside pointerdown / Escape.
    useEffect(() => {
        if (!menuOpen) return undefined;
        const onDown = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
        };
        const onKey = (e) => {
            if (e.key === 'Escape') setMenuOpen(false);
        };
        document.addEventListener('pointerdown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [menuOpen]);

    const shown = screens.slice(0, visibleCount);
    const overflow = screens.slice(visibleCount);
    const overflowActive = overflow.some((s) => s.id === screenId);

    return (
        <nav
            ref={navRef}
            className="relative hidden sm:flex items-center gap-1 self-stretch flex-1 min-w-0"
            aria-label="App screens"
        >
            {/* Measure row: every tab + the "Meer" button, never interactive. */}
            <div
                aria-hidden="true"
                className="absolute left-0 top-0 flex items-center gap-1 invisible pointer-events-none"
                data-app-nav-measure="true"
            >
                {screens.map((s, i) => (
                    <span
                        key={s.id}
                        ref={(el) => { measureRefs.current[i] = el; }}
                        className={TAB_CLS}
                    >
                        <TabLabel screen={s} />
                    </span>
                ))}
                <span ref={moreMeasureRef} className={TAB_CLS}>
                    <span>Meer</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                </span>
            </div>

            {shown.map((s) => {
                const isActive = s.id === screenId;
                return (
                    <button
                        key={s.id}
                        type="button"
                        onClick={() => onNavigate && onNavigate(s.id)}
                        aria-current={isActive ? 'page' : undefined}
                        className={TAB_CLS}
                        style={tabStyle(isActive)}
                    >
                        <TabLabel screen={s} />
                    </button>
                );
            })}

            {overflow.length ? (
                <div ref={menuRef} className="relative self-stretch flex">
                    <button
                        type="button"
                        onClick={() => setMenuOpen((v) => !v)}
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        className={TAB_CLS}
                        style={tabStyle(overflowActive)}
                    >
                        <span>Meer</span>
                        <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    {menuOpen ? (
                        <div
                            role="menu"
                            className="app-nav-popup absolute right-0 top-full z-40 mt-1 w-48 rounded-lg border py-1 shadow-xl"
                        >
                            {overflow.map((s) => {
                                const isActive = s.id === screenId;
                                return (
                                    <button
                                        key={s.id}
                                        type="button"
                                        role="menuitem"
                                        onClick={() => { setMenuOpen(false); onNavigate && onNavigate(s.id); }}
                                        aria-current={isActive ? 'page' : undefined}
                                        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-left app-nav-hover"
                                        style={{ color: isActive ? 'var(--app-primary)' : 'var(--text-primary)' }}
                                    >
                                        {s.icon ? <AppIcon name={s.icon} className="w-3.5 h-3.5 shrink-0" /> : null}
                                        <span className="truncate">{s.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </nav>
    );
}

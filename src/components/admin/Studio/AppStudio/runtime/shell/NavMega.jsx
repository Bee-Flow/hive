import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import AppIcon from '../../../../../AppIcon';

/**
 * NavMega — the top bar whose GROUPS open a panel (nav.style 'mega').
 *
 * Ungrouped screens render as plain links, exactly like a tab. Each group is a
 * trigger that opens a panel listing its screens as icon + name + description —
 * the shape a product's own navigation has, rather than a row of equal-weight
 * words. Descriptions come from screen.description; a screen without one simply
 * shows its name.
 *
 * WITH NO GROUPS THERE IS NO PANEL, and this renders as a plain link row. That
 * is deliberate: picking 'mega' on an app that has not organised its screens
 * yet must not produce an empty bar with nothing to click.
 *
 * Interaction, modelled on the marketing header (which solves the same problem
 * for the public site):
 *   • pointer — hover opens after a short intent delay, and a close delay keeps
 *     the panel alive while the pointer crosses the gap between trigger and
 *     panel. Without that delay the panel dies mid-travel, every time.
 *   • keyboard — the trigger is a real button: Enter/Space toggles, ArrowDown
 *     opens and moves into the panel, Escape closes and returns focus, and Tab
 *     out of the panel closes it (focusout, not blur, so moving BETWEEN items
 *     inside the panel does not count as leaving).
 *   • touch — the first tap opens rather than navigating; the trigger owns no
 *     destination of its own.
 *
 * The panel lays out in columns of at most COLUMN_ROWS items, up to MAX_COLUMNS.
 */

const OPEN_DELAY_MS = 90;
const CLOSE_DELAY_MS = 180;
const COLUMN_ROWS = 6;
const MAX_COLUMNS = 3;

const LINK_CLS = 'inline-flex items-center gap-1.5 px-3 text-sm font-medium self-stretch';

function linkStyle(isActive) {
    return isActive
        ? { color: 'var(--app-primary)', boxShadow: 'inset 0 -2px 0 var(--app-primary)' }
        : { color: 'var(--text-secondary)' };
}

/** Split a group's screens into balanced columns. */
export function megaColumns(screens) {
    const count = Math.min(MAX_COLUMNS, Math.max(1, Math.ceil(screens.length / COLUMN_ROWS)));
    const perColumn = Math.ceil(screens.length / count);
    const columns = [];
    for (let i = 0; i < screens.length; i += perColumn) columns.push(screens.slice(i, i + perColumn));
    return columns;
}

function MegaPanel({ group, screenId, onPick, panelRef }) {
    const columns = megaColumns(group.screens);
    return (
        <div
            ref={panelRef}
            role="menu"
            aria-label={group.label}
            className="app-nav-popup app-nav-mega absolute left-0 top-full z-40 mt-1 rounded-xl border p-2 shadow-xl"
            data-columns={columns.length}
        >
            <div className="app-nav-mega-grid" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
                {columns.map((column, ci) => (
                    <div key={ci} className="flex flex-col">
                        {/* The heading repeats only on the first column: it names
                            the whole panel, not each column. */}
                        {ci === 0 ? (
                            <div
                                className="px-3 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                {group.label}
                            </div>
                        ) : <div className="pt-1 pb-1.5" aria-hidden="true" />}
                        {column.map((screen) => {
                            const isActive = screen.id === screenId;
                            return (
                                <button
                                    key={screen.id}
                                    type="button"
                                    role="menuitem"
                                    onClick={() => onPick(screen.id)}
                                    aria-current={isActive ? 'page' : undefined}
                                    data-active={isActive || undefined}
                                    className="app-nav-mega-item flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left"
                                >
                                    <span className="app-nav-mega-icon shrink-0" aria-hidden="true">
                                        {screen.icon ? <AppIcon name={screen.icon} className="w-4 h-4" /> : null}
                                    </span>
                                    <span className="min-w-0">
                                        <span
                                            className="block text-sm font-medium truncate"
                                            style={{ color: isActive ? 'var(--app-primary)' : 'var(--text-primary)' }}
                                        >
                                            {screen.name}
                                        </span>
                                        {screen.description ? (
                                            <span className="block text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                                                {screen.description}
                                            </span>
                                        ) : null}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function NavMega({ model, screenId, onNavigate }) {
    const [openId, setOpenId] = useState(null);
    const timers = useRef({ open: null, close: null });
    const triggerRefs = useRef({});
    const panelRef = useRef(null);

    const clearTimers = useCallback(() => {
        if (timers.current.open) { clearTimeout(timers.current.open); timers.current.open = null; }
        if (timers.current.close) { clearTimeout(timers.current.close); timers.current.close = null; }
    }, []);

    useEffect(() => clearTimers, [clearTimers]);

    const scheduleOpen = (id) => {
        clearTimers();
        timers.current.open = setTimeout(() => setOpenId(id), OPEN_DELAY_MS);
    };
    const scheduleClose = () => {
        clearTimers();
        timers.current.close = setTimeout(() => setOpenId(null), CLOSE_DELAY_MS);
    };

    // Escape closes and hands focus back to the trigger that opened the panel —
    // otherwise focus is stranded inside a panel that is no longer there.
    useEffect(() => {
        if (!openId) return undefined;
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            setOpenId(null);
            triggerRefs.current[openId]?.focus();
        };
        const onDown = (e) => {
            const trigger = triggerRefs.current[openId];
            if (panelRef.current?.contains(e.target) || trigger?.contains(e.target)) return;
            setOpenId(null);
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('pointerdown', onDown);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('pointerdown', onDown);
        };
    }, [openId]);

    const pick = (id) => {
        clearTimers();
        setOpenId(null);
        if (onNavigate) onNavigate(id);
    };

    const onTriggerKeyDown = (e, groupId) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            clearTimers();
            setOpenId(groupId);
            // The panel mounts on the next commit, so reach for its first item
            // after that rather than in this handler.
            setTimeout(() => panelRef.current?.querySelector('[role="menuitem"]')?.focus(), 0);
        }
    };

    return (
        <nav
            className="relative hidden sm:flex items-center gap-1 self-stretch flex-1 min-w-0"
            aria-label="App screens"
        >
            {model.ungrouped.map((screen) => {
                const isActive = screen.id === screenId;
                return (
                    <button
                        key={screen.id}
                        type="button"
                        onClick={() => pick(screen.id)}
                        aria-current={isActive ? 'page' : undefined}
                        className={LINK_CLS}
                        style={linkStyle(isActive)}
                    >
                        {screen.icon ? <AppIcon name={screen.icon} className="w-3.5 h-3.5" /> : null}
                        <span>{screen.name}</span>
                    </button>
                );
            })}

            {model.groups.map((group) => {
                const isOpen = openId === group.id;
                const holdsActive = group.screens.some((s) => s.id === screenId);
                return (
                    <div
                        key={group.id}
                        className="relative self-stretch flex"
                        data-app-nav-group={group.id}
                        onPointerEnter={() => scheduleOpen(group.id)}
                        onPointerLeave={scheduleClose}
                        // focusout fires when focus leaves the whole group
                        // (trigger + panel); relatedTarget tells us whether it
                        // went somewhere inside, which must NOT close.
                        onFocusCapture={clearTimers}
                        onBlurCapture={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget)) setOpenId(null);
                        }}
                    >
                        <button
                            ref={(el) => { triggerRefs.current[group.id] = el; }}
                            type="button"
                            onClick={() => { clearTimers(); setOpenId(isOpen ? null : group.id); }}
                            onKeyDown={(e) => onTriggerKeyDown(e, group.id)}
                            aria-haspopup="menu"
                            aria-expanded={isOpen}
                            className={LINK_CLS}
                            style={linkStyle(holdsActive)}
                        >
                            {group.icon ? <AppIcon name={group.icon} className="w-3.5 h-3.5" /> : null}
                            <span>{group.label}</span>
                            <ChevronDown
                                className="w-3.5 h-3.5 app-nav-mega-chevron"
                                data-open={isOpen || undefined}
                                aria-hidden="true"
                            />
                        </button>
                        {isOpen ? (
                            <MegaPanel group={group} screenId={screenId} onPick={pick} panelRef={panelRef} />
                        ) : null}
                    </div>
                );
            })}
        </nav>
    );
}

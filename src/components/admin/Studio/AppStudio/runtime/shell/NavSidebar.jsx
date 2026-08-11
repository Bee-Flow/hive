import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import Brand from './Brand';
import UserMenu from './UserMenu';
import AppIcon from '../../../../../AppIcon';

/**
 * NavSidebar — the left-rail shell layout (nav.style 'sidebar'). Brand on
 * top, ungrouped screens as items, then groups as sections with a small
 * uppercase label. Active item = soft tint + primary text + a 2px left rail
 * (app-tokens.css .app-nav-item). The collapse toggle at the bottom shrinks
 * the rail to icon-only (width tokens --app-nav-w / --app-nav-w-collapsed)
 * and persists per app in localStorage — no appId, no persistence.
 *
 * `railed` (nav.style 'rail') is the same component permanently collapsed:
 * icon-only, group labels reduced to separators, and NO expand toggle — a rail
 * is a deliberate choice by the app's author, not a viewer preference, so
 * offering a toggle that contradicts the definition would be a lie. Tooltips
 * carry the screen name and its description.
 *
 * Keyboard: one roving tabindex across all items; ArrowUp/ArrowDown move
 * focus, Enter/Space activate (native button behaviour).
 */

function readCollapsed(storageKey) {
    if (!storageKey) return false;
    try {
        return window.localStorage.getItem(storageKey) === '1';
    } catch {
        return false;
    }
}

export default function NavSidebar({ definition, model, screenId, onNavigate, viewer, appId = null, onExit = null, railed = false }) {
    const storageKey = (appId && !railed) ? `appStudio.nav.collapsed.${appId}` : null;
    const [userCollapsed, setCollapsed] = useState(() => readCollapsed(storageKey));
    const collapsed = railed || userCollapsed;
    const itemRefs = useRef([]);

    // Flat focus order (== visual order) for the roving tabindex.
    const flat = model.flat;
    const activeIndex = Math.max(0, flat.findIndex((s) => s.id === screenId));
    const [focusIndex, setFocusIndex] = useState(null);
    const rovingIndex = focusIndex ?? activeIndex;

    const toggleCollapsed = () => {
        setCollapsed((prev) => {
            const next = !prev;
            if (storageKey) {
                try {
                    if (next) window.localStorage.setItem(storageKey, '1');
                    else window.localStorage.removeItem(storageKey);
                } catch { /* storage unavailable — collapse stays session-only */ }
            }
            return next;
        });
    };

    const onKeyDown = (e) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        const next = (rovingIndex + delta + flat.length) % flat.length;
        setFocusIndex(next);
        itemRefs.current[next]?.focus();
    };

    // index of each screen in the flat focus order
    const flatIndex = useMemo(() => new Map(flat.map((s, i) => [s.id, i])), [flat]);

    const renderItem = (screen) => {
        const isActive = screen.id === screenId;
        const i = flatIndex.get(screen.id);
        return (
            <button
                key={screen.id}
                ref={(el) => { itemRefs.current[i] = el; }}
                type="button"
                onClick={() => onNavigate && onNavigate(screen.id)}
                aria-current={isActive ? 'page' : undefined}
                data-active={isActive || undefined}
                tabIndex={i === rovingIndex ? 0 : -1}
                // Collapsed, the label is gone, so the tooltip carries both the
                // name and what the screen is for.
                title={collapsed
                    ? [screen.name, screen.description].filter(Boolean).join(' — ')
                    : (screen.description || undefined)}
                className="app-nav-item flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-left"
            >
                {screen.icon
                    ? <AppIcon name={screen.icon} className="w-4 h-4 shrink-0" />
                    : <span className="w-4 h-4 shrink-0" aria-hidden="true" />}
                <span className="app-nav-item-label truncate">{screen.name}</span>
            </button>
        );
    };

    return (
        <aside
            className="app-nav-sidebar hidden sm:flex flex-col shrink-0 border-r"
            data-collapsed={collapsed || undefined}
            data-railed={railed || undefined}
            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
        >
            <div className="px-3 shrink-0">
                <Brand definition={definition} />
            </div>

            <nav
                className="flex-1 min-h-0 overflow-y-auto px-2 py-1 flex flex-col gap-0.5"
                aria-label="App screens"
                onKeyDown={onKeyDown}
            >
                {model.ungrouped.map(renderItem)}
                {model.groups.map((group) => (
                    <div key={group.id} className="flex flex-col gap-0.5" data-app-nav-group={group.id}>
                        {railed ? (
                            // No room for a word: the group becomes a rule.
                            <div
                                className="mx-3 my-1.5 border-t"
                                style={{ borderColor: 'var(--border-subtle)' }}
                                role="separator"
                                aria-label={group.label}
                            />
                        ) : (
                            <div
                                className="app-nav-group-label flex items-center gap-1.5 px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                {group.icon ? <AppIcon name={group.icon} className="w-3 h-3 shrink-0" /> : null}
                                <span className="truncate">{group.label}</span>
                            </div>
                        )}
                        {group.screens.map(renderItem)}
                    </div>
                ))}
            </nav>

            <div className="shrink-0 border-t px-2 py-2 flex flex-col gap-1" style={{ borderColor: 'var(--border-subtle)' }}>
                <UserMenu viewer={viewer} onExit={onExit} collapsed={collapsed} direction="up" />
                {railed ? null : (
                    <button
                        type="button"
                        onClick={toggleCollapsed}
                        aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
                        title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
                        className="app-nav-item flex w-full items-center gap-2 px-3 py-1.5 text-sm"
                    >
                        {collapsed
                            ? <ChevronRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                            : <ChevronLeft className="w-4 h-4 shrink-0" aria-hidden="true" />}
                        <span className="app-nav-item-label">Collapse</span>
                    </button>
                )}
            </div>
        </aside>
    );
}

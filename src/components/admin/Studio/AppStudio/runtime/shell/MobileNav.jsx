import { Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import AppIcon from '../../../../../AppIcon';

/**
 * MobileNav — below 640px both shell styles collapse into the same pattern:
 * a trigger (hamburger + current screen name) opening a bottom-sheet drawer
 * that lists every nav screen, grouped with section labels. Replaces the old
 * native <select> for everyone (approved universal-polish item).
 *
 * variant 'inline' — just the trigger, dropped into the tabs top bar
 *                    (the caller wraps it in the sm:hidden right cluster).
 * variant 'bar'    — a full sm:hidden top bar carrying the brand + trigger,
 *                    for sidebar mode (the sidebar itself is desktop-only).
 *
 * An active nav-hidden screen (reached via a navigate action) still shows as
 * the current name on the trigger and as the active row in the drawer — the
 * same guarantee the old dropdown gave.
 *
 * The slide-up uses the app motion tokens, so design.motion 'none' and
 * prefers-reduced-motion both zero it.
 */

export default function MobileNav({ model, activeScreen, onNavigate, variant = 'inline', brand = null }) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);

    const pick = (id) => {
        setOpen(false);
        if (onNavigate) onNavigate(id);
    };

    // The old select appended an active nav-hidden screen as a selectable
    // value; the drawer keeps that parity by appending it to the top list.
    const inModel = activeScreen && model.flat.some((s) => s.id === activeScreen.id);
    const ungrouped = activeScreen && !inModel ? [...model.ungrouped, activeScreen] : model.ungrouped;

    // The drawer is the mobile face of whatever the desktop shows, so it
    // carries screen.description too — on a phone that one line is the only
    // thing standing between "Board" and knowing what Board is.
    const renderRow = (screen) => {
        const isActive = screen.id === (activeScreen?.id || null);
        return (
            <button
                key={screen.id}
                type="button"
                onClick={() => pick(screen.id)}
                aria-current={isActive ? 'page' : undefined}
                data-active={isActive || undefined}
                className="app-nav-item flex w-full items-start gap-2.5 px-4 py-2.5 text-sm font-medium text-left"
            >
                {screen.icon
                    ? <AppIcon name={screen.icon} className="w-4 h-4 shrink-0 mt-0.5" />
                    : <span className="w-4 h-4 shrink-0" aria-hidden="true" />}
                <span className="min-w-0">
                    <span className="block truncate">{screen.name}</span>
                    {screen.description ? (
                        <span className="block text-xs font-normal mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                            {screen.description}
                        </span>
                    ) : null}
                </span>
            </button>
        );
    };

    const trigger = (
        <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm font-medium min-w-0"
            style={{
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
                background: 'var(--bg-primary)',
                borderRadius: 'var(--app-radius)',
            }}
        >
            <Menu className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{activeScreen?.name || 'Menu'}</span>
        </button>
    );

    const drawer = open ? (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="App screens">
            <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setOpen(false)}
                className="absolute inset-0 w-full h-full cursor-default"
                style={{ background: 'color-mix(in srgb, var(--bg-primary) 25%, rgba(0, 0, 0, 0.45))' }}
            />
            <div className="app-nav-drawer relative rounded-t-2xl border-t shadow-xl max-h-[70vh] overflow-y-auto pb-3">
                <div
                    className="mx-auto mt-2 mb-1 h-1 w-9 rounded-full"
                    style={{ background: 'var(--border-default)' }}
                    aria-hidden="true"
                />
                <div className="flex flex-col gap-0.5 px-1 pt-1">
                    {ungrouped.map(renderRow)}
                    {model.groups.map((group) => (
                        <div key={group.id} className="flex flex-col gap-0.5">
                            <div
                                className="flex items-center gap-1.5 px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                {group.icon ? <AppIcon name={group.icon} className="w-3 h-3 shrink-0" /> : null}
                                <span className="truncate">{group.label}</span>
                            </div>
                            {group.screens.map(renderRow)}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    ) : null;

    if (variant === 'bar') {
        // With a single nav screen the trigger has nothing to offer — the bar
        // still renders for the brand (the sidebar is hidden on mobile).
        const hasNav = model.flat.length > 1;
        return (
            <div
                className="sm:hidden flex items-center gap-3 border-b px-4 shrink-0"
                style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
            >
                {brand}
                {hasNav ? <div className="ml-auto py-1.5">{trigger}</div> : null}
                {hasNav ? drawer : null}
            </div>
        );
    }

    return (
        <div className="sm:hidden">
            {trigger}
            {drawer}
        </div>
    );
}

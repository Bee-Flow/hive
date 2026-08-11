import { useEffect, useRef, useState } from 'react';

/**
 * UserMenu — who is looking at this app. A small initials button that opens
 * a popup with the viewer's name, email and role, plus an "Alle apps" link
 * back to the app directory when the host wired an exit (the editor preview
 * passes none, so the link never shows there).
 *
 * Renders NOTHING without a viewer (editor preview without a preview user,
 * anonymous surfaces) — the shell stays byte-stable for those hosts.
 */

function initialsOf(viewer) {
    const name = (viewer?.name || '').trim();
    if (name) {
        const parts = name.split(/\s+/);
        const first = parts[0]?.[0] || '';
        const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
        return (first + last).toUpperCase() || first.toUpperCase();
    }
    const email = (viewer?.email || '').trim();
    return email ? email[0].toUpperCase() : '?';
}

export default function UserMenu({ viewer, onExit = null, collapsed = false, direction = 'down' }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);

    // Close on outside pointerdown / Escape — same pattern as the editor's
    // screen-tab kebab menu.
    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
        };
        const onKey = (e) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('pointerdown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    if (!viewer) return null;

    const roleBadge = viewer.isOwner ? 'Eigenaar' : (viewer.roleKey || null);
    const popPosition = direction === 'up'
        ? 'bottom-full left-0 mb-1'
        : 'top-full right-0 mt-1';

    return (
        <div ref={rootRef} className="relative shrink-0" data-app-user-menu="true">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={`Account: ${viewer.name || viewer.email || 'viewer'}`}
                className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm min-w-0 app-nav-hover"
                style={{ color: 'var(--text-secondary)' }}
            >
                <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold shrink-0"
                    style={{ background: 'var(--app-primary-soft)', color: 'var(--app-primary)' }}
                    aria-hidden="true"
                >
                    {initialsOf(viewer)}
                </span>
                {collapsed ? null : (
                    <span className="hidden sm:inline truncate max-w-[10rem]">{viewer.name || viewer.email}</span>
                )}
            </button>

            {open ? (
                <div
                    role="menu"
                    className={`app-nav-popup absolute z-40 w-56 rounded-lg border py-1 shadow-xl ${popPosition}`}
                >
                    <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                            {viewer.name || viewer.email}
                        </div>
                        {viewer.email ? (
                            <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{viewer.email}</div>
                        ) : null}
                        {roleBadge ? (
                            <span
                                className="mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                                style={{ background: 'var(--app-primary-soft)', color: 'var(--app-primary)' }}
                            >
                                {roleBadge}
                            </span>
                        ) : null}
                    </div>
                    {onExit ? (
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => { setOpen(false); onExit(); }}
                            className="flex w-full items-center px-3 py-1.5 text-sm text-left app-nav-hover"
                            style={{ color: 'var(--text-primary)' }}
                        >
                            Alle apps
                        </button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

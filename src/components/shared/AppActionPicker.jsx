import { Check, Search, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { getIntegrationIcon } from '../../config/integrationIcons';

/**
 * The app menu, shared.
 *
 * One overlay — search + app list on the left, the focused app's ACTIONS on the
 * right — used by every surface that asks "which app, and which of its actions?".
 * It was the agent editor's AppsPicker, then the AI step's ToolPicker grew an
 * actions pane on top of a copy of it, and App Studio connectors had neither
 * (two bare <select>s). Three surfaces, three answers to the same question. This
 * is the one shell all of them render, so an improvement to the app menu lands
 * everywhere at once.
 *
 * Presentational only: no fetching, no catalog knowledge. Callers pass apps
 * already permission-gated by the server and own the selection.
 *
 * Props
 *   apps        [{ id, label, description?, available?, actions: [{ name, label,
 *                 description?, sideEffect?, producesList? }] }]
 *   selected    string[] of selected action names
 *   onToggle    (actionName, app, action) => void
 *   onToggleApp (app, turnOn) => void        — optional "Enable/Disable all"
 *   onClose     () => void
 *   title       heading above the search box
 *   emptyLabel  what to say when there are no apps at all
 *   footer      optional node pinned under the action list (e.g. an Apply bar)
 *   unavailableHint  what "not connected" means on this surface
 *
 * `available: false` apps stay VISIBLE and pickable but are labelled — hiding
 * them is what makes a picker feel broken ("where is Gmail?"), and on some
 * surfaces (a connector set to run as each viewer) an app the author hasn't
 * connected is a legitimate choice.
 */
export default function AppActionPicker({
    apps = [],
    selected = [],
    onToggle,
    onToggleApp,
    onClose,
    title = 'Choose apps & actions',
    emptyLabel = 'No apps available',
    footer = null,
    unavailableHint = 'not connected',
}) {
    const selectedSet = useMemo(() => new Set(selected), [selected]);
    const [search, setSearch] = useState('');
    const [focusedId, setFocusedId] = useState(apps[0]?.id || null);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return apps;
        return apps.filter((app) =>
            (app.label || app.id || '').toLowerCase().includes(q)
            || (app.actions || []).some((a) =>
                (a.label || '').toLowerCase().includes(q)
                || (a.name || '').toLowerCase().includes(q)
                || (a.description || '').toLowerCase().includes(q)),
        );
    }, [apps, search]);

    useEffect(() => {
        if (filtered.length && !filtered.some((app) => app.id === focusedId)) {
            setFocusedId(filtered[0].id);
        }
    }, [filtered, focusedId]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const focused = apps.find((app) => app.id === focusedId) || filtered[0] || null;
    // When a search is active the right pane shows only the matching actions —
    // searching "attachment" should not make you hunt through 15 Gmail actions.
    const q = search.trim().toLowerCase();
    const focusedActions = useMemo(() => {
        const all = focused?.actions || [];
        if (!q) return all;
        const appMatches = (focused?.label || '').toLowerCase().includes(q);
        const hits = all.filter((a) => (a.label || '').toLowerCase().includes(q)
            || (a.name || '').toLowerCase().includes(q)
            || (a.description || '').toLowerCase().includes(q));
        return hits.length ? hits : (appMatches ? all : hits);
    }, [focused, q]);

    const selectedCount = focusedActions.filter((a) => selectedSet.has(a.name)).length;
    const allOn = focusedActions.length > 0 && selectedCount === focusedActions.length;
    const countFor = (app) => (app.actions || []).reduce((n, a) => n + (selectedSet.has(a.name) ? 1 : 0), 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
            <div
                className="w-full max-w-3xl h-[560px] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card,#fff)] shadow-2xl overflow-hidden flex"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label={title}
            >
                {/* Left: search + app list */}
                <div className="w-[40%] flex flex-col border-r border-[var(--border-default)]">
                    <div className="p-3">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search apps and actions"
                                aria-label="Search apps and actions"
                                className="w-full bg-[var(--bg-secondary)] rounded-full pl-9 pr-3 py-2 text-sm outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto px-2 pb-2">
                        {filtered.length === 0 && (
                            <div className="text-xs text-[var(--text-tertiary)] text-center py-6">{emptyLabel}</div>
                        )}
                        {filtered.map((app) => {
                            const isFocus = app.id === focusedId;
                            const count = countFor(app);
                            return (
                                <button
                                    key={app.id}
                                    type="button"
                                    onClick={() => setFocusedId(app.id)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition ${isFocus ? 'bg-[var(--bg-secondary)]' : 'hover:bg-[var(--bg-secondary)]/60'}`}
                                >
                                    <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">{getIntegrationIcon(app.id)}</div>
                                    <span className={`truncate flex-1 ${app.available === false ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}`}>
                                        {app.label || app.id}
                                    </span>
                                    {count > 0 && (
                                        <span
                                            className="text-[10px] font-semibold text-[var(--bg-primary)] bg-[var(--accent)] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center"
                                            aria-label={`${count} selected`}
                                        >
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right: the focused app's actions */}
                <div className="flex-1 flex flex-col relative min-w-0">
                    <button
                        onClick={onClose}
                        className="absolute top-3 right-3 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] z-10"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                    {focused ? (
                        <>
                            <div className="px-6 pt-6 pb-3 border-b border-[var(--border-default)]">
                                <div className="flex items-center gap-3 mb-1">
                                    <div className="w-9 h-9 rounded-xl border border-[var(--border-default)] flex items-center justify-center flex-shrink-0">
                                        <div className="w-5 h-5 flex items-center justify-center">{getIntegrationIcon(focused.id)}</div>
                                    </div>
                                    <h3 className="text-lg font-semibold text-[var(--text-primary)] flex-1 truncate">{focused.label || focused.id}</h3>
                                    {onToggleApp && focusedActions.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => onToggleApp(focused, !allOn, focusedActions)}
                                            className="text-xs font-medium text-[var(--accent)] hover:underline whitespace-nowrap"
                                        >
                                            {allOn ? 'Disable all' : 'Enable all'}
                                        </button>
                                    )}
                                </div>
                                <p className="text-xs text-[var(--text-tertiary)]">
                                    {selectedCount} of {focusedActions.length} action{focusedActions.length === 1 ? '' : 's'} selected
                                </p>
                                {focused.available === false && (
                                    <p className="mt-2 text-xs rounded-md border px-2 py-1.5"
                                        style={{ borderColor: 'rgba(217, 119, 6, 0.4)', background: 'rgba(217, 119, 6, 0.1)', color: '#d97706' }}
                                        role="alert"
                                    >
                                        {focused.label || focused.id} is {unavailableHint}.
                                    </p>
                                )}
                            </div>
                            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
                                {focusedActions.length === 0 && (
                                    <div className="text-xs text-[var(--text-tertiary)] text-center py-6">This app has no matching actions.</div>
                                )}
                                {focusedActions.map((action) => {
                                    const on = selectedSet.has(action.name);
                                    return (
                                        <button
                                            key={action.name}
                                            type="button"
                                            aria-pressed={on}
                                            onClick={() => onToggle?.(action.name, focused, action)}
                                            className="w-full flex items-start gap-3 px-3 py-2 rounded-lg text-left hover:bg-[var(--bg-secondary)] transition"
                                        >
                                            <span className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${on ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--border-default)]'}`}>
                                                {on && <Check size={12} className="text-[var(--bg-primary)]" />}
                                            </span>
                                            <span className="flex-1 min-w-0">
                                                <span className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm text-[var(--text-primary)] truncate">{action.label || action.name}</span>
                                                    {/* A list action is the one that can fill a table — worth
                                                        seeing before you pick, not after. */}
                                                    {action.producesList && (
                                                        <span className="text-[9px] uppercase tracking-wide font-semibold text-[var(--accent)] border border-[var(--accent)]/50 rounded px-1 py-px flex-shrink-0">list</span>
                                                    )}
                                                    {action.sideEffect && (
                                                        <span className="text-[9px] uppercase tracking-wide font-semibold text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-700 rounded px-1 py-px flex-shrink-0">writes</span>
                                                    )}
                                                </span>
                                                {action.description && (
                                                    <span className="block text-xs text-[var(--text-tertiary)] mt-0.5 line-clamp-2">{action.description}</span>
                                                )}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                            {footer ? (
                                <div className="border-t border-[var(--border-default)] px-4 py-3">{footer}</div>
                            ) : null}
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-sm text-[var(--text-tertiary)]">{emptyLabel}</div>
                    )}
                </div>
            </div>
        </div>
    );
}

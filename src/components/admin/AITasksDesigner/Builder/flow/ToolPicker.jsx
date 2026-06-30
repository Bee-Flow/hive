import { Search, X, Check } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { getIntegrationIcon } from '../../../../../config/integrationIcons';

/**
 * Tool picker for the AI step — same visual language as the agent editor's
 * AppsPicker (overlay + left search list + right detail pane), but the detail
 * pane lists an app's individual tools (catalog actions) as toggle rows so the
 * user can pick exactly which functions the AI step may call.
 *
 * `apps` come straight from the automation catalog (`catalog.apps`), already
 * permission-gated server-side — callers pass only entries with `available`.
 * Selection is a list of tool function names (the step's `tools` array).
 *
 * Props:
 *   apps         — [{ id, label, actions: [{ name, label, description, sideEffect, integrationLabel }] }]
 *   selected     — string[] of selected function names
 *   onToggleTool — (name) => void
 *   onToggleApp  — (app, on) => void   // enable/disable all of an app's tools
 *   onClose      — () => void
 */
export default function ToolPicker({ apps = [], selected = [], onToggleTool, onToggleApp, onClose }) {
    const selectedSet = useMemo(() => new Set(selected), [selected]);
    const [search, setSearch] = useState('');
    const [focusedId, setFocusedId] = useState(apps[0]?.id || null);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return apps;
        return apps.filter(app =>
            app.label.toLowerCase().includes(q)
            || (app.actions || []).some(a =>
                (a.label || '').toLowerCase().includes(q)
                || (a.name || '').toLowerCase().includes(q)
                || (a.description || '').toLowerCase().includes(q)),
        );
    }, [apps, search]);

    useEffect(() => {
        if (filtered.length && !filtered.some(app => app.id === focusedId)) {
            setFocusedId(filtered[0].id);
        }
    }, [filtered, focusedId]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const focused = apps.find(app => app.id === focusedId) || filtered[0] || null;
    const focusedActions = focused?.actions || [];
    const focusedSelectedCount = focusedActions.filter(a => selectedSet.has(a.name)).length;
    const allFocusedOn = focusedActions.length > 0 && focusedSelectedCount === focusedActions.length;

    const countFor = (app) => (app.actions || []).reduce((n, a) => n + (selectedSet.has(a.name) ? 1 : 0), 0);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
            onClick={onClose}
        >
            <div
                className="w-full max-w-3xl h-[560px] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card,#fff)] shadow-2xl overflow-hidden flex"
                onClick={(e) => e.stopPropagation()}
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
                                placeholder="Search tools"
                                className="w-full bg-[var(--bg-secondary)] rounded-full pl-9 pr-3 py-2 text-sm outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto px-2 pb-2">
                        {filtered.length === 0 && (
                            <div className="text-xs text-[var(--text-tertiary)] text-center py-6">No tools available</div>
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
                                    <span className="truncate flex-1 text-[var(--text-primary)]">{app.label}</span>
                                    {count > 0 && (
                                        <span className="text-[10px] font-semibold text-[var(--bg-primary)] bg-[var(--accent)] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center" aria-label={`${count} selected`}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right: tool list for the focused app */}
                <div className="flex-1 flex flex-col relative">
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
                                    <h3 className="text-lg font-semibold text-[var(--text-primary)] flex-1 truncate">{focused.label}</h3>
                                    {focusedActions.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => onToggleApp?.(focused, !allFocusedOn)}
                                            className="text-xs font-medium text-[var(--accent)] hover:underline whitespace-nowrap"
                                        >
                                            {allFocusedOn ? 'Disable all' : 'Enable all'}
                                        </button>
                                    )}
                                </div>
                                <p className="text-xs text-[var(--text-tertiary)]">
                                    {focusedSelectedCount} of {focusedActions.length} tool{focusedActions.length === 1 ? '' : 's'} enabled
                                </p>
                            </div>
                            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
                                {focusedActions.length === 0 && (
                                    <div className="text-xs text-[var(--text-tertiary)] text-center py-6">This app has no tools.</div>
                                )}
                                {focusedActions.map((action) => {
                                    const on = selectedSet.has(action.name);
                                    return (
                                        <button
                                            key={action.name}
                                            type="button"
                                            onClick={() => onToggleTool?.(action.name)}
                                            className="w-full flex items-start gap-3 px-3 py-2 rounded-lg text-left hover:bg-[var(--bg-secondary)] transition"
                                        >
                                            <span className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${on ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--border-default)]'}`}>
                                                {on && <Check size={12} className="text-[var(--bg-primary)]" />}
                                            </span>
                                            <span className="flex-1 min-w-0">
                                                <span className="flex items-center gap-2">
                                                    <span className="text-sm text-[var(--text-primary)] truncate">{action.label || action.name}</span>
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
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-sm text-[var(--text-tertiary)]">No tools available</div>
                    )}
                </div>
            </div>
        </div>
    );
}

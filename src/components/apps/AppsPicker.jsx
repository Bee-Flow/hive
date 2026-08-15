/**
 * The composer's Apps button and its overlay: what this workspace can reach,
 * which of it is switched on, and one click to start a sentence with it.
 *
 * Shared by the chat composer and the Cowork composer. In Cowork it matters
 * more, not less: a brief runs unattended against the user's integrations, so
 * "which apps may this touch" is a decision with consequences after you have
 * closed the tab.
 *
 * Renders nothing when the user has no apps at all — an empty overlay behind a
 * button that looks clickable is worse than no button.
 */
import { ChevronDown, ChevronRight, LayoutGrid } from 'lucide-react';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { groupAppsByCategory } from './appCatalog';

export default function AppsPicker({ apps = [], isAppEnabled, toggleApp, onPick }) {
    const wrapRef = useRef(null);
    const panelRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [collapsed, setCollapsed] = useState({});
    // Which way the overlay opens. Above the button is right in the chat
    // composer, which sits at the bottom of the screen; on the Cowork page the
    // composer is near the top, where opening upward runs the panel straight
    // off the viewport. Same measure-and-flip as the When sheet.
    const [dropDown, setDropDown] = useState(false);

    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    useLayoutEffect(() => {
        if (!open) { setDropDown(false); return; }
        const el = panelRef.current;
        if (!el) return;
        // Read where the upward placement actually landed; a clipped top edge
        // is the signal to drop below instead.
        setDropDown(el.getBoundingClientRect().top < 8);
    }, [open]);

    if (apps.length === 0) return null;

    const q = search.trim().toLowerCase();
    const filtered = q
        ? apps.filter(a => a.label.toLowerCase().includes(q) || a.description.toLowerCase().includes(q))
        : apps;
    const { byCat, orderedCats } = groupAppsByCategory(filtered);
    const activeCount = apps.filter(a => a.isStep || isAppEnabled(a.id)).length;

    // Without an `onPick` there is nothing to click a row *into* — the editor
    // opens this purely to switch apps on and off — so the rows stay inert and
    // don't advertise themselves as clickable.
    const pickable = typeof onPick === 'function';
    const pick = (app) => {
        if (!pickable) return;
        if (!app.isStep && !isAppEnabled(app.id)) return;
        setOpen(false);
        onPick(app);
    };

    return (
        <div className="relative" ref={wrapRef}>
            <button
                type="button"
                onClick={() => { setOpen(v => !v); setSearch(''); }}
                className={`p-2 rounded-lg transition-colors flex items-center gap-1 ${open ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}
                title="Apps"
                data-testid="apps-picker-button"
            >
                <LayoutGrid className="w-5 h-5" />
            </button>

            {open && (
                <div
                    ref={panelRef}
                    data-testid="apps-picker-panel"
                    className={`absolute ${dropDown ? 'top-full mt-2' : 'bottom-full mb-2'} left-0 w-80 rounded-xl border shadow-2xl overflow-hidden z-50`}
                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', animation: 'appsOverlayIn .15s ease-out' }}
                >
                    {/* Header */}
                    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Apps</h3>
                            <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                                {activeCount}/{apps.length} active
                            </span>
                        </div>
                        <p className="text-[11px] mb-2.5" style={{ color: 'var(--text-tertiary)' }}>Click to use · Toggle to enable/disable</p>
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search apps..."
                            autoFocus
                            aria-label="Search apps"
                            className="w-full px-3 py-1.5 text-sm rounded-lg border outline-none transition-colors focus:border-[var(--accent-primary)]"
                            style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                        />
                    </div>

                    {/* App list */}
                    <div className="p-1.5 max-h-72 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="text-center py-6 text-sm" style={{ color: 'var(--text-tertiary)' }}>No apps found</div>
                        ) : orderedCats.map(cat => {
                            // Search auto-expands; otherwise honour the collapsed state.
                            const isCollapsed = !q && !!collapsed[cat];
                            return (
                                <div key={cat} className="mb-0.5">
                                    <button
                                        type="button"
                                        onClick={() => setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }))}
                                        className="w-full flex items-center gap-1.5 px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide hover:opacity-80"
                                        style={{ color: 'var(--text-tertiary)' }}
                                    >
                                        {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                        <span className="truncate">{cat}</span>
                                        <span className="ml-auto tabular-nums opacity-70">{byCat[cat].length}</span>
                                    </button>
                                    {!isCollapsed && byCat[cat].map(app => {
                                        // Steps are always on (gated by the Step's own "In chat"
                                        // toggle in the builder) — show a static badge, not a switch.
                                        const enabled = app.isStep ? true : isAppEnabled(app.id);
                                        return (
                                            <div
                                                key={app.id}
                                                data-testid="apps-picker-item"
                                                data-app-id={app.id}
                                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${enabled ? (pickable ? 'cursor-pointer hover:bg-[var(--bg-tertiary)]' : '') : 'opacity-50'}`}
                                                onClick={() => pick(app)}
                                            >
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-[var(--bg-tertiary)]">
                                                    {app.iconSvg('w-5 h-5')}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{app.label}</div>
                                                    <div className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>{app.description}</div>
                                                </div>
                                                {app.isStep ? (
                                                    <span className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>Step</span>
                                                ) : (
                                                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0" onClick={e => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={enabled}
                                                            onChange={() => toggleApp(app.id)}
                                                            aria-label={`Enable ${app.label}`}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                                                    </label>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <style>{`
                @keyframes appsOverlayIn {
                    from { opacity: 0; transform: translateY(4px) scale(0.98); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
}

import { Search, X, Check } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { getIntegrationIcon } from '../../../../../config/integrationIcons';

/**
 * App picker for the "App event" trigger — the same overlay + search list +
 * detail pane the agent editor uses (AgentWizard/pickers/AppsPicker), so
 * choosing what starts a routine looks like choosing what an agent may use.
 *
 * A plain <select> of provider ids gave no logos, no search and no way to see
 * what an app can actually trigger on before picking it. The detail pane lists
 * the app's events for exactly that reason.
 *
 * Single-select: picking an app replaces the trigger's provider, so the primary
 * button reads "Use <app>" rather than the agent editor's Enable/Disable.
 *
 * Props:
 *   providers — [{ id, label, defaultEvent, events: [{ id, label, deliverability }] }]
 *               already availability-gated server-side.
 *   selected  — currently configured provider id (may not be in `providers`).
 *   onPick    — (providerId) => void
 *   onClose   — () => void
 */
export default function TriggerProviderPicker({ providers = [], selected = null, onPick, onClose }) {
    const [search, setSearch] = useState('');
    const [focusedId, setFocusedId] = useState(
        () => (providers.some(p => p.id === selected) ? selected : providers[0]?.id) || null,
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return providers;
        return providers.filter(p =>
            p.label.toLowerCase().includes(q)
            || p.id.toLowerCase().includes(q)
            || (p.events || []).some(e => (e.label || '').toLowerCase().includes(q) || e.id.toLowerCase().includes(q)),
        );
    }, [providers, search]);

    useEffect(() => {
        if (filtered.length && !filtered.some(p => p.id === focusedId)) setFocusedId(filtered[0].id);
    }, [filtered, focusedId]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const focused = providers.find(p => p.id === focusedId) || filtered[0] || null;
    const focusedEvents = focused?.events || [];

    return (
        <div
            className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/40"
            onClick={onClose}
            role="presentation"
        >
            <div
                className="w-full max-w-3xl h-[560px] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-2xl overflow-hidden flex"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Choose an app to trigger on"
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
                                placeholder="Search apps"
                                aria-label="Search apps"
                                className="w-full bg-[var(--bg-secondary)] rounded-full pl-9 pr-3 py-2 text-sm outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto px-2 pb-2 custom-scrollbar" role="listbox" aria-label="Apps">
                        {filtered.length === 0 && (
                            <div className="text-xs text-[var(--text-tertiary)] text-center py-6">No apps match that search.</div>
                        )}
                        {filtered.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                role="option"
                                aria-selected={p.id === focusedId}
                                onClick={() => setFocusedId(p.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition ${
                                    p.id === focusedId ? 'bg-[var(--bg-secondary)]' : 'hover:bg-[var(--bg-secondary)]/60'
                                }`}
                            >
                                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">{getIntegrationIcon(p.id)}</div>
                                <span className="truncate flex-1 text-[var(--text-primary)]">{p.label}</span>
                                {p.id === selected && (
                                    <Check size={14} className="text-[var(--accent-primary)]" aria-label="currently used" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right: what this app can trigger on */}
                <div className="flex-1 flex flex-col relative min-w-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-3 right-3 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] z-10"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                    {focused ? (
                        <>
                            <div className="flex-1 overflow-y-auto px-8 pt-10 pb-4 custom-scrollbar">
                                <div className="w-14 h-14 rounded-2xl border border-[var(--border-default)] flex items-center justify-center mb-5">
                                    <div className="w-9 h-9 flex items-center justify-center">{getIntegrationIcon(focused.id)}</div>
                                </div>
                                <h3 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">{focused.label}</h3>
                                <p className="text-sm text-[var(--text-secondary)] leading-6 mb-5">
                                    {focusedEvents.length === 1
                                        ? 'Starts this routine when the event below happens.'
                                        : `Starts this routine when one of these ${focusedEvents.length} events happens.`}
                                </p>
                                <ul className="space-y-1.5">
                                    {focusedEvents.map(ev => (
                                        <li key={ev.id} className="flex items-baseline gap-2 text-sm">
                                            <span className="text-[var(--text-primary)]">{ev.label}</span>
                                            {ev.deliverability === 'connector' && (
                                                <span className="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400">
                                                    needs connector
                                                </span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="px-8 pb-6 pt-3">
                                <button
                                    type="button"
                                    onClick={() => { onPick(focused.id); onClose(); }}
                                    disabled={focused.id === selected}
                                    className="w-full py-3 rounded-full text-sm font-medium transition bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90 disabled:opacity-40"
                                >
                                    {focused.id === selected ? `Already using ${focused.label}` : `Use ${focused.label}`}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-sm text-[var(--text-tertiary)]">
                            No event sources are available to you yet.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

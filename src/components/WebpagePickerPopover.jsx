import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Globe, Search, Loader2 } from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';

/**
 * Compact popover that lists webpages the user can see (owned + published
 * to their org/groups). Selecting one fires onSelect(id) and closes.
 *
 * Mirrors the click-outside pattern from AgentWizard/pickers/PublishMenu.jsx
 * — same ref dance so two popovers can't fight each other for the document
 * listener.
 */
export default function WebpagePickerPopover({ anchorRef, open, onClose, onSelect }) {
    const popoverRef = useRef(null);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [state, setState] = useState({ loading: true, items: [], error: null });

    // Debounce the search term so each keystroke doesn't re-run the filter
    // (and trigger a fresh useMemo) — irrelevant for small lists, but the
    // picker can show hundreds of pages once an org racks up webpages.
    useEffect(() => {
        const id = setTimeout(() => setDebouncedSearch(search), 120);
        return () => clearTimeout(id);
    }, [search]);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e) => {
            if (popoverRef.current?.contains(e.target)) return;
            if (anchorRef?.current?.contains(e.target)) return;
            onClose();
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open, onClose, anchorRef]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setState({ loading: true, items: [], error: null });
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/webpages`);
                if (!res.ok) throw new Error(`Failed (${res.status})`);
                const data = await res.json();
                const items = Array.isArray(data?.webpages) ? data.webpages : [];
                if (!cancelled) setState({ loading: false, items, error: null });
            } catch (err) {
                if (!cancelled) setState({ loading: false, items: [], error: err.message });
            }
        })();
        return () => { cancelled = true; };
    }, [open]);

    const filtered = useMemo(() => {
        const q = debouncedSearch.trim().toLowerCase();
        if (!q) return state.items;
        return state.items.filter(w => (w.name || '').toLowerCase().includes(q));
    }, [debouncedSearch, state.items]);

    if (!open) return null;

    return (
        <div
            ref={popoverRef}
            className="absolute z-30 right-0 top-full mt-1 w-[320px] rounded-xl border shadow-xl overflow-hidden"
            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)' }}
        >
            <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Open a webpage</div>
                <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                    Choose one to view alongside the chat.
                </div>
            </div>
            <div className="px-2 py-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
                    <input
                        autoFocus
                        type="text"
                        placeholder="Search webpages…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-7 pr-2 py-1.5 text-xs rounded-lg border outline-none"
                        style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
                    />
                </div>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
                {state.loading && (
                    <div className="py-6 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent-primary)' }} />
                    </div>
                )}
                {!state.loading && state.error && (
                    <div className="px-4 py-6 text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
                        {state.error}
                    </div>
                )}
                {!state.loading && !state.error && filtered.length === 0 && (
                    <div className="px-4 py-6 text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
                        {state.items.length === 0
                            ? 'No webpages yet — create one in Studio › Webpages.'
                            : 'No matches.'}
                    </div>
                )}
                {filtered.map(w => (
                    <button
                        key={w.id}
                        onClick={() => { onSelect(w.id); onClose(); }}
                        className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[var(--bg-secondary)] transition-colors"
                    >
                        <Globe className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-primary)' }} />
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{w.name}</div>
                            {w.isPublished && (
                                <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                    Shared{Array.isArray(w.sharedGroups) && w.sharedGroups.length > 0 ? ` · ${w.sharedGroups.length} group${w.sharedGroups.length === 1 ? '' : 's'}` : ''}
                                </div>
                            )}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

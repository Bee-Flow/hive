import { Command, Search, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * App Studio editor — the Cmd+K command palette.
 *
 * Shares the shape of AITasksDesigner/Builder/CommandPalette: the parent
 * supplies `actions` as `{ id, label, hint?, run, group? }` objects; the
 * palette filters by a label/hint/group substring, arrow-navigates the flat
 * result list and fires `run` on Enter/click. Grouped headers are cosmetic —
 * navigation stays over the flat filtered list.
 */
export default function CommandPalette({ open, onClose, actions = [] }) {
    const [query, setQuery] = useState('');
    const [focusIdx, setFocusIdx] = useState(0);
    const listRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        setQuery('');
        setFocusIdx(0);
        const onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose?.(); }
        };
        document.addEventListener('keydown', onKey, true);
        return () => document.removeEventListener('keydown', onKey, true);
    }, [open, onClose]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return actions;
        return actions.filter((a) => {
            const blob = `${a.label || ''} ${a.hint || ''} ${a.group || ''}`.toLowerCase();
            return blob.includes(q);
        });
    }, [actions, query]);

    // Keep the focused row scrolled into view as arrows move it.
    // (optional-call: jsdom has no scrollIntoView)
    useEffect(() => {
        const el = listRef.current?.querySelector(`[data-cmd-idx="${focusIdx}"]`);
        el?.scrollIntoView?.({ block: 'nearest' });
    }, [focusIdx]);

    if (!open) return null;

    const choose = (a) => {
        try { a?.run?.(); } finally { onClose?.(); }
    };

    // Group boundaries for cosmetic headers, computed over the FLAT list so the
    // per-row index still addresses `filtered` for keyboard nav.
    let lastGroup = null;

    return createPortal(
        <div
            className="fixed inset-0 z-[80] flex items-start justify-center pt-[15vh]"
            style={{ background: 'color-mix(in srgb, #000 40%, transparent)' }}
            onClick={onClose}
            data-command-palette=""
        >
            <div
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label="Command palette"
                className="flex w-[560px] max-w-[90vw] flex-col rounded-lg border shadow-xl"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)' }}
            >
                <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: 'var(--border-default)' }}>
                    <Search size={14} style={{ color: 'var(--text-tertiary)' }} aria-hidden="true" />
                    <input
                        autoFocus
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setFocusIdx(0); }}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') { e.preventDefault(); setFocusIdx((i) => Math.min(filtered.length - 1, i + 1)); }
                            else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusIdx((i) => Math.max(0, i - 1)); }
                            else if (e.key === 'Enter' && filtered[focusIdx]) { e.preventDefault(); choose(filtered[focusIdx]); }
                        }}
                        placeholder="Type a command…"
                        aria-label="Command palette search"
                        className="flex-1 bg-transparent text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)]"
                        style={{ color: 'var(--text-primary)' }}
                    />
                    <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        <Command size={10} aria-hidden="true" /> K
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close command palette"
                        style={{ color: 'var(--text-tertiary)' }}
                    >
                        <X size={14} />
                    </button>
                </div>

                <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1 custom-scrollbar">
                    {filtered.length === 0 ? (
                        <div className="px-3 py-4 text-[12px] italic" style={{ color: 'var(--text-tertiary)' }}>
                            No matching commands.
                        </div>
                    ) : filtered.map((a, i) => {
                        const showGroup = a.group && a.group !== lastGroup;
                        lastGroup = a.group || lastGroup;
                        return (
                            <React.Fragment key={a.id}>
                                {showGroup ? (
                                    <div
                                        className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide"
                                        style={{ color: 'var(--text-tertiary)' }}
                                    >
                                        {a.group}
                                    </div>
                                ) : null}
                                <button
                                    type="button"
                                    data-cmd-idx={i}
                                    onMouseEnter={() => setFocusIdx(i)}
                                    onClick={() => choose(a)}
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs"
                                    style={{
                                        background: i === focusIdx ? 'var(--bg-secondary)' : 'transparent',
                                        color: 'var(--text-primary)',
                                    }}
                                >
                                    <span>{a.label}</span>
                                    {a.hint ? (
                                        <span className="ml-auto text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                            {a.hint}
                                        </span>
                                    ) : null}
                                </button>
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>
        </div>,
        document.body,
    );
}

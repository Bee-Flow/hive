import { Command, Search, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Command palette for the builder (§8b scaffolding).
 *
 * Cmd+K toggles a centred dialog that lists registered builder
 * actions (add step, run from selected, open variable picker,
 * diagnose trigger, reveal webhook secret, pin payload, …). Each
 * action is a `{ id, label, hint, run, group }` object the parent
 * supplies via the `actions` prop; the palette filters by label/hint
 * substring as the user types and fires `run` on Enter.
 *
 * Phase 2 work: ergonomic action registration, recent actions,
 * keyboard chord shortcuts. Phase 1 lands the dialog so consumers can
 * already register actions.
 */

export default function CommandPalette({ open, onClose, actions = [] }) {
    const [query, setQuery] = useState('');
    const [focusIdx, setFocusIdx] = useState(0);

    useEffect(() => {
        if (!open) return undefined;
        setQuery('');
        setFocusIdx(0);
        const onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose?.(); }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return actions;
        return actions.filter(a => {
            const blob = `${a.label || ''} ${a.hint || ''} ${a.group || ''}`.toLowerCase();
            return blob.includes(q);
        });
    }, [actions, query]);

    if (!open) return null;

    const choose = (a) => {
        try { a?.run?.(); }
        finally { onClose?.(); }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[80] bg-black/40 flex items-start justify-center pt-[15vh]"
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label="Command palette"
                className="w-[560px] max-w-[90vw] bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg shadow-xl flex flex-col"
            >
                <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-default)]">
                    <Search size={14} className="text-[var(--text-tertiary)]" />
                    <input
                        autoFocus
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setFocusIdx(0); }}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') { e.preventDefault(); setFocusIdx(i => Math.min(filtered.length - 1, i + 1)); }
                            else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusIdx(i => Math.max(0, i - 1)); }
                            else if (e.key === 'Enter' && filtered[focusIdx]) { e.preventDefault(); choose(filtered[focusIdx]); }
                        }}
                        placeholder="Type a command…"
                        className="flex-1 bg-transparent text-sm text-[var(--text-primary)] focus:outline-none"
                    />
                    <span className="text-[10px] text-[var(--text-tertiary)] inline-flex items-center gap-1">
                        <Command size={10} /> K
                    </span>
                    <button onClick={onClose} aria-label="Close" className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                        <X size={14} />
                    </button>
                </div>
                <div className="max-h-[50vh] overflow-y-auto custom-scrollbar py-1">
                    {filtered.length === 0 ? (
                        <div className="px-3 py-4 text-[12px] text-[var(--text-tertiary)] italic">No matching commands.</div>
                    ) : filtered.map((a, i) => (
                        <button
                            key={a.id}
                            type="button"
                            onMouseEnter={() => setFocusIdx(i)}
                            onClick={() => choose(a)}
                            className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 ${i === focusIdx ? 'bg-[var(--bg-secondary)]' : 'hover:bg-[var(--bg-secondary)]'}`}
                        >
                            <span className="text-[var(--text-primary)]">{a.label}</span>
                            {a.hint && <span className="ml-auto text-[10px] text-[var(--text-tertiary)]">{a.hint}</span>}
                        </button>
                    ))}
                </div>
            </div>
        </div>,
        document.body,
    );
}

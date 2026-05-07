import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Sparkles, Bot } from 'lucide-react';

/**
 * Cmd/Ctrl+K command palette for the Routines page.
 *
 * Pure presentational + keyboard handling — the parent owns the data
 * and the selection callbacks. Up/Down arrows move the highlight,
 * Enter activates, Escape closes.
 */
export default function QuickSwitcher({ open, items, onPick, onClose }) {
    const [query, setQuery] = useState('');
    const [highlight, setHighlight] = useState(0);
    const inputRef = useRef(null);

    useEffect(() => {
        if (open) {
            setQuery('');
            setHighlight(0);
            // Focus the search input on open. Defer one tick so the
            // overlay paint completes before we steal focus.
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    }, [open]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return items;
        return items.filter(it =>
            (it.title || '').toLowerCase().includes(q)
            || (it.kindLabel || '').toLowerCase().includes(q)
        );
    }, [items, query]);

    useEffect(() => {
        if (highlight >= filtered.length) setHighlight(0);
    }, [filtered.length, highlight]);

    const onKeyDown = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight(h => Math.min(h + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight(h => Math.max(h - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const pick = filtered[highlight];
            if (pick) onPick(pick);
        }
    };

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[2000] bg-black/40 flex items-start justify-center pt-[15vh] px-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-xl rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-default)]">
                    <Search size={16} className="text-[var(--text-tertiary)] flex-shrink-0" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder="Jump to a routine…"
                        className="flex-1 bg-transparent outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                    />
                    <span className="text-[10px] font-mono text-[var(--text-tertiary)] border border-[var(--border-default)] rounded px-1.5 py-0.5">
                        ESC
                    </span>
                </div>
                <div className="max-h-[60vh] overflow-y-auto py-1">
                    {filtered.length === 0 && (
                        <div className="px-4 py-6 text-center text-sm text-[var(--text-tertiary)]">
                            No routines match "{query}".
                        </div>
                    )}
                    {filtered.map((it, i) => {
                        const isAuto = it.kind === 'automation';
                        return (
                            <button
                                key={`${it.kind}:${it.id}`}
                                onClick={() => onPick(it)}
                                onMouseEnter={() => setHighlight(i)}
                                className={`w-full flex items-center gap-3 px-4 py-2 text-left transition ${
                                    i === highlight
                                        ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                                }`}
                            >
                                {isAuto
                                    ? <Sparkles size={14} className="text-[var(--text-tertiary)] flex-shrink-0" />
                                    : <Bot size={14} className="text-[var(--text-tertiary)] flex-shrink-0" />}
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm truncate">{it.title || 'Untitled'}</div>
                                    {it.subtitle && (
                                        <div className="text-[11px] text-[var(--text-tertiary)] truncate">{it.subtitle}</div>
                                    )}
                                </div>
                                <span className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] flex-shrink-0">
                                    {it.kindLabel}
                                </span>
                            </button>
                        );
                    })}
                </div>
                <div className="px-4 py-2 border-t border-[var(--border-default)] flex items-center gap-3 text-[10px] text-[var(--text-tertiary)]">
                    <span><kbd className="font-mono">↑↓</kbd> navigate</span>
                    <span><kbd className="font-mono">⏎</kbd> open</span>
                    <span className="ml-auto">{filtered.length} of {items.length}</span>
                </div>
            </div>
        </div>
    );
}

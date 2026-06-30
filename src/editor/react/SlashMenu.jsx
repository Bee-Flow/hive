/**
 * SlashMenu — a filterable block-insertion menu that opens when the user types
 * "/" at the start of a text run. Every entry maps to an EXISTING editor command
 * (no new transforms). Keyboard-driven: ArrowUp/Down to move, Enter/Tab to
 * insert, Escape to dismiss — captured while open so the editor doesn't also act.
 *
 * Anchored at the caret rect (passed in), clamped to the viewport.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';

const MENU_W = 256;
const MAX_H = 320;

export default function SlashMenu({ items, query, rect, onSelect, onClose }) {
    const [active, setActive] = useState(0);
    const listRef = useRef(null);

    const filtered = useMemo(() => {
        const q = (query || '').trim().toLowerCase();
        if (!q) return items;
        return items.filter((it) => `${it.label} ${it.keywords || ''}`.toLowerCase().includes(q));
    }, [items, query]);

    useEffect(() => { setActive(0); }, [query]);
    useEffect(() => {
        if (active >= filtered.length) setActive(Math.max(0, filtered.length - 1));
    }, [filtered, active]);

    // Capture navigation keys while the menu is open so the editor ignores them.
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); e.stopImmediatePropagation(); setActive((i) => Math.min(i + 1, filtered.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopImmediatePropagation(); setActive((i) => Math.max(i - 1, 0)); }
            else if (e.key === 'Enter' || e.key === 'Tab') {
                if (filtered[active]) { e.preventDefault(); e.stopImmediatePropagation(); onSelect(filtered[active]); }
            } else if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); onClose(); }
        };
        document.addEventListener('keydown', onKey, true);
        return () => document.removeEventListener('keydown', onKey, true);
    }, [filtered, active, onSelect, onClose]);

    // Keep the active row scrolled into view.
    useEffect(() => {
        const el = listRef.current?.querySelector(`[data-idx="${active}"]`);
        if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
    }, [active]);

    if (!rect) return null;
    if (filtered.length === 0) return null;

    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const left = Math.max(8, Math.min(rect.left, vw - MENU_W - 8));
    const below = rect.top + 4;
    const openUp = below + MAX_H > vh - 8;
    const top = openUp ? Math.max(8, rect.top - MAX_H - 8) : below;

    return (
        <div
            role="listbox"
            aria-label="Insert block"
            className="fixed z-[9999] py-1 rounded-xl shadow-2xl border overflow-y-auto custom-scrollbar"
            style={{ top, left, width: MENU_W, maxHeight: MAX_H, background: 'var(--bg-primary)', borderColor: 'var(--border-default)' }}
            ref={listRef}
            onMouseDown={(e) => e.preventDefault()}
        >
            {filtered.map((it, i) => {
                const Icon = it.icon;
                const isActive = i === active;
                return (
                    <button
                        key={it.key}
                        data-idx={i}
                        role="option"
                        aria-selected={isActive}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => onSelect(it)}
                        className="w-full flex items-center gap-3 px-3 py-1.5 text-left text-[12px] transition-colors"
                        style={{ background: isActive ? 'var(--bg-tertiary)' : 'transparent', color: 'var(--text-primary)' }}
                    >
                        {Icon && (
                            <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: 'var(--bg-tertiary)' }}>
                                <Icon className="w-3.5 h-3.5" strokeWidth={2} style={{ color: 'var(--text-secondary)' }} />
                            </span>
                        )}
                        <span className="flex-1 truncate">{it.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

/**
 * CommandPalette — ⌘K / Ctrl+K palette that surfaces EXISTING actions only
 * (formatting, insert, generate, export, view toggles). Every entry is a thunk
 * over a handler the page already owns — it adds no new capability.
 *
 * Self-contained a11y: role="dialog" + a listbox with aria-activedescendant,
 * arrow-key navigation, Enter to run, Escape / scrim-click to close, focus moves
 * to the filter input on open.
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';

export default function CommandPalette({ open, onClose, commands = [], placeholder = 'Type a command…', emptyText = 'No matching commands' }) {
    const [query, setQuery] = useState('');
    const [activeIdx, setActiveIdx] = useState(0);
    const inputRef = useRef(null);

    useEffect(() => {
        if (open) {
            setQuery('');
            setActiveIdx(0);
            const id = setTimeout(() => inputRef.current?.focus(), 0);
            return () => clearTimeout(id);
        }
    }, [open]);

    const filtered = useMemo(() => {
        const list = commands.filter(c => c.enabled !== false);
        const q = query.trim().toLowerCase();
        if (!q) return list;
        return list.filter(c => `${c.label} ${c.keywords || ''} ${c.group || ''}`.toLowerCase().includes(q));
    }, [commands, query]);

    useEffect(() => { setActiveIdx(0); }, [query]);
    useEffect(() => {
        if (activeIdx >= filtered.length) setActiveIdx(Math.max(0, filtered.length - 1));
    }, [filtered, activeIdx]);

    if (!open) return null;

    const run = (cmd) => {
        if (!cmd) return;
        onClose?.();
        try { cmd.run?.(); } catch (e) { console.error('[CommandPalette] command failed', e); }
    };

    const onKeyDown = (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
        else if (e.key === 'Enter') { e.preventDefault(); run(filtered[activeIdx]); }
        else if (e.key === 'Escape') { e.preventDefault(); onClose?.(); }
    };

    let lastGroup = null;

    return (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center pt-[12vh] px-4" onMouseDown={onClose}>
            <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
            <div
                role="dialog"
                aria-modal="true"
                aria-label={placeholder}
                className="relative w-full max-w-[560px] rounded-2xl border shadow-2xl overflow-hidden flex flex-col"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', maxHeight: '70vh' }}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                    <Search className="w-4 h-4 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder={placeholder}
                        role="combobox"
                        aria-expanded="true"
                        aria-controls="bf-cmd-list"
                        aria-activedescendant={filtered[activeIdx] ? `bf-cmd-${filtered[activeIdx].id}` : undefined}
                        className="flex-1 bg-transparent outline-none text-sm"
                        style={{ color: 'var(--text-primary)' }}
                    />
                </div>
                <div id="bf-cmd-list" role="listbox" className="flex-1 overflow-y-auto custom-scrollbar py-1">
                    {filtered.length === 0 && (
                        <div className="px-4 py-6 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>{emptyText}</div>
                    )}
                    {filtered.map((cmd, i) => {
                        const showGroup = cmd.group && cmd.group !== lastGroup;
                        lastGroup = cmd.group;
                        const Icon = cmd.icon;
                        const active = i === activeIdx;
                        return (
                            <React.Fragment key={cmd.id}>
                                {showGroup && (
                                    <div className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                                        {cmd.group}
                                    </div>
                                )}
                                <button
                                    id={`bf-cmd-${cmd.id}`}
                                    role="option"
                                    aria-selected={active}
                                    onMouseEnter={() => setActiveIdx(i)}
                                    onClick={() => run(cmd)}
                                    className="w-full flex items-center gap-3 px-4 py-2 text-left text-sm transition-colors"
                                    style={{ background: active ? 'var(--bg-tertiary)' : 'transparent', color: 'var(--text-primary)' }}
                                >
                                    {Icon && <Icon className="w-4 h-4 shrink-0" strokeWidth={2} style={{ color: 'var(--text-secondary)' }} />}
                                    <span className="flex-1 truncate">{cmd.label}</span>
                                    {cmd.hint && <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{cmd.hint}</span>}
                                    {active && <CornerDownLeft className="w-3 h-3 shrink-0" style={{ color: 'var(--text-tertiary)' }} />}
                                </button>
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

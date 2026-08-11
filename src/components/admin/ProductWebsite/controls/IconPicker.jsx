import React, { useMemo, useState } from 'react';
import { ICON_CATALOGUE } from './iconCatalogue';
import AppIcon from '../../../AppIcon';
import ModalShell from '../dialogs/ModalShell';

/**
 * IconPicker — modal icon browser for IconField.
 *
 * Curated Lucide names from iconCatalogue.js, grouped by category, filtered
 * by a case-insensitive substring search. Clicking a tile selects and
 * closes. The footer keeps the free-text "any Lucide name" escape hatch for
 * icons outside the curated set (IconField's own text input also survives,
 * so this dialog is additive — the stored value stays a plain PascalCase
 * Lucide name string either way).
 *
 * Escape / backdrop click close via ModalShell.
 *
 * Props:
 *   value    — currently selected icon name (highlights its tile)
 *   onSelect — (name) called with the chosen name; caller closes
 *   onClose  — close without selecting
 */

function IconTile({ name, selected, onSelect }) {
    return (
        <button
            type="button"
            title={name}
            onClick={() => onSelect(name)}
            className={`w-10 h-10 rounded-md flex items-center justify-center border transition-colors
                ${selected
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:border-[var(--border-default)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                }`}
        >
            <AppIcon name={name} className="w-5 h-5" />
        </button>
    );
}

function FreeTextRow({ value, onSelect }) {
    const [draft, setDraft] = useState('');
    const commit = () => { if (draft.trim()) onSelect(draft.trim()); };
    return (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--border-subtle)]">
            <div className="w-8 h-8 shrink-0 rounded-md flex items-center justify-center bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--accent-primary)]">
                {draft.trim()
                    ? <AppIcon name={draft.trim()} className="w-4 h-4" />
                    : <span className="text-xs text-[var(--text-muted)]">?</span>}
            </div>
            <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
                placeholder={`Any Lucide name… (current: ${value || 'none'})`}
                spellCheck={false}
                className="flex-1 px-2 py-1.5 rounded text-xs font-mono border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
            <button
                type="button"
                onClick={commit}
                disabled={!draft.trim()}
                className="px-3 py-1.5 text-xs rounded-md bg-[var(--accent-primary)] text-white disabled:opacity-40"
            >
                Use
            </button>
        </div>
    );
}

export default function IconPicker({ value, onSelect, onClose }) {
    const [query, setQuery] = useState('');

    const groups = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return ICON_CATALOGUE;
        return ICON_CATALOGUE
            .map(g => ({ ...g, icons: g.icons.filter(n => n.toLowerCase().includes(q)) }))
            .filter(g => g.icons.length > 0);
    }, [query]);

    return (
        <ModalShell onClose={onClose} labelledBy="cms-icon-picker-title" width="lg">
            <div className="px-4 pt-4 pb-3 border-b border-[var(--border-subtle)]">
                <h3 id="cms-icon-picker-title" className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                    Choose an icon
                </h3>
                <input
                    autoFocus
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search icons…"
                    spellCheck={false}
                    className="w-full px-3 py-2 rounded-md text-sm border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
            </div>

            <div className="px-4 py-3 max-h-[55vh] overflow-y-auto">
                {groups.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] text-center py-6">
                        No curated icon matches "{query}" — try the free-text field below.
                    </p>
                ) : groups.map(g => (
                    <div key={g.category} className="mb-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                            {g.category}
                        </div>
                        <div className="grid grid-cols-8 gap-1">
                            {g.icons.map(name => (
                                <IconTile key={name} name={name} selected={name === value} onSelect={onSelect} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <FreeTextRow value={value} onSelect={onSelect} />
        </ModalShell>
    );
}

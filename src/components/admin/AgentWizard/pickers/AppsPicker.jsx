import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';

export default function AppsPicker({ items, enabled, onClose, onToggle, t }) {
    // R4: apps off by default. `enabled` is always an array now (legacy null backfilled).
    const isSelected = (id) => Array.isArray(enabled) ? enabled.includes(id) : false;
    const [search, setSearch] = useState('');
    const [focusedId, setFocusedId] = useState(items[0]?.id || null);
    const filtered = items.filter(it =>
        !search.trim() || it.label.toLowerCase().includes(search.toLowerCase()) || (it.description || '').toLowerCase().includes(search.toLowerCase())
    );
    useEffect(() => {
        if (filtered.length && !filtered.some(it => it.id === focusedId)) {
            setFocusedId(filtered[0].id);
        }
    }, [filtered, focusedId]);
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);
    const focused = items.find(it => it.id === focusedId) || filtered[0] || null;
    const focusedSelected = focused ? isSelected(focused.id) : false;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
            onClick={onClose}
        >
            <div
                className="w-full max-w-3xl h-[560px] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card,#fff)] shadow-2xl overflow-hidden flex"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Left: search + list */}
                <div className="w-[40%] flex flex-col border-r border-[var(--border-default)]">
                    <div className="p-3">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={t('agent_wizard.apps.search', 'Search apps')}
                                className="w-full bg-[var(--bg-secondary)] rounded-full pl-9 pr-3 py-2 text-sm outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto px-2 pb-2">
                        {filtered.length === 0 && (
                            <div className="text-xs text-[var(--text-tertiary)] text-center py-6">—</div>
                        )}
                        {filtered.map((item) => {
                            const isFocus = item.id === focusedId;
                            const selected = isSelected(item.id);
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setFocusedId(item.id)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition ${isFocus ? 'bg-[var(--bg-secondary)]' : 'hover:bg-[var(--bg-secondary)]/60'}`}
                                >
                                    <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">{item.iconSvg}</div>
                                    <span className="truncate flex-1 text-[var(--text-primary)]">{item.label}</span>
                                    {selected && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" aria-label="enabled" />}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right: detail pane */}
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
                            <div className="flex-1 overflow-y-auto px-8 pt-10 pb-4">
                                <div className="w-14 h-14 rounded-2xl border border-[var(--border-default)] flex items-center justify-center mb-5">
                                    <div className="w-9 h-9 flex items-center justify-center">{focused.iconSvg}</div>
                                </div>
                                <h3 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">{focused.label}</h3>
                                <p className="text-sm text-[var(--text-secondary)] leading-6">
                                    {focused.description || t('agent_wizard.apps.no_description', 'No description available.')}
                                </p>
                            </div>
                            <div className="px-8 pb-6 pt-3">
                                <button
                                    type="button"
                                    onClick={() => onToggle(focused.id)}
                                    className={`w-full py-3 rounded-full text-sm font-medium transition ${focusedSelected
                                        ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                                        : 'bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90'}`}
                                >
                                    {focusedSelected
                                        ? (t('agent_wizard.apps.disable', 'Disable'))
                                        : (t('agent_wizard.apps.enable', 'Enable'))}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-sm text-[var(--text-tertiary)]">—</div>
                    )}
                </div>
            </div>
        </div>
    );
}

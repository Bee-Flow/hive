// Shared searchable model picker — trigger button + full-screen overlay
// with a search box and provider/family filter chips. Replaces the
// near-identical SearchableModelSelect components that were open-coded in
// ChatModelTiersConfig and AIConfig/WebSearchInferenceConfig (the merge is
// a superset: the WebSearch copy's extra Claude/Gemini family detection AND
// the tiers copy's hidden-model management both live here now).
//
// Usage:
//   <SearchableModelSelect
//       value={modelId /* or { providerId, modelId } for provider-scoped selection */}
//       label={triggerLabel}
//       groups={{ 'Provider name': [{ id, providerId, name }, ...] }}
//       onChange={({ providerId, modelId }) => ...}  // empty strings = cleared
//       title="Select Model"                          // optional overlay heading
//       clearLabel="— Not configured —"               // optional clear-row label
//       hiddenIds={hiddenModelIds}                    // optional: ids to hide
//       onToggleHidden={(modelId) => ...}             // optional: show hide/unhide UI
//   />

import React, { useState, useEffect, useRef } from 'react';
import useOutsideDismiss from '../../../hooks/useOutsideDismiss';
import { getModelMeta, getModelDisplayName, getModelFamily } from '../../../utils/modelMeta';

const SearchableModelSelect = ({
    value,
    label,
    groups,
    onChange,
    title = 'Select Model',
    clearLabel = '— Not configured —',
    hiddenIds = [],
    onToggleHidden,
}) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [activeProvider, setActiveProvider] = useState(null);   // null = all
    const [activeFamily, setActiveFamily] = useState(null);       // null = all
    const [showHidden, setShowHidden] = useState(false);
    const inputRef = useRef(null);
    const panelRef = useRef(null);

    // `value` is either a raw model id string or { providerId, modelId }.
    const selectedId = typeof value === 'string' ? value : (value?.modelId || '');
    const selectedProviderId = typeof value === 'string' ? '' : (value?.providerId || '');
    const hiddenSet = new Set(hiddenIds);

    // Focus search input when opening
    useEffect(() => {
        if (open && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    // Close on Escape or on any interaction outside the panel (backdrop click)
    useOutsideDismiss(panelRef, () => setOpen(false), { enabled: open });

    // Build provider list and family list from all models
    const providerNames = Object.keys(groups);
    const allFamilies = new Set();
    Object.values(groups).flat().forEach(m => allFamilies.add(getModelFamily(m.id)));
    const familyList = [...allFamilies].sort();

    // Filter models by search + provider + family + hidden state
    const lowerSearch = search.toLowerCase();
    const filteredGroups = {};
    Object.entries(groups).forEach(([provName, models]) => {
        // Provider filter
        if (activeProvider && provName !== activeProvider) return;
        const filtered = models.filter(m => {
            // Hidden filter — always show the currently selected model so
            // the picker doesn't lie about its own state, but otherwise
            // hide blocked models unless "Show hidden" is on.
            if (hiddenSet.has(m.id) && m.id !== selectedId && !showHidden) return false;
            // Family filter
            if (activeFamily && getModelFamily(m.id) !== activeFamily) return false;
            // Text search
            if (!lowerSearch) return true;
            const meta = getModelMeta(m.id);
            const name = meta?.name || '';
            const cat = meta?.cat || '';
            return m.id.toLowerCase().includes(lowerSearch)
                || name.toLowerCase().includes(lowerSearch)
                || cat.toLowerCase().includes(lowerSearch);
        });
        if (filtered.length > 0) filteredGroups[provName] = filtered;
    });
    const totalResults = Object.values(filteredGroups).reduce((s, a) => s + a.length, 0);
    const hiddenCount = hiddenIds.length;

    return (
        <>
            {/* Trigger button */}
            <button
                type="button"
                onClick={() => { setOpen(true); setSearch(''); setActiveProvider(null); setActiveFamily(null); }}
                className="w-full px-3 py-2.5 rounded-lg border outline-none text-sm text-left flex items-center justify-between transition-colors hover:border-[var(--accent-primary)]"
                style={{
                    background: 'var(--bg-secondary)',
                    borderColor: 'var(--border-default)',
                    color: selectedId ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
            >
                <span className="truncate">{label}</span>
                <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Overlay modal */}
            {open && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                >
                    <div
                        ref={panelRef}
                        className="w-full max-w-2xl rounded-2xl border shadow-2xl flex flex-col"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', maxHeight: '80vh' }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 pt-5 pb-3">
                            <div>
                                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                    {totalResults} model{totalResults !== 1 ? 's' : ''}{search ? ` matching "${search}"` : ' available'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Search input */}
                        <div className="px-5 pb-3">
                            <div className="relative">
                                <svg className="absolute left-3 top-3 w-5 h-5" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search by name, ID, or category..."
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border outline-none text-sm"
                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                />
                            </div>
                        </div>

                        {/* Filter chips */}
                        <div className="px-5 pb-3 space-y-2">
                            {/* Provider filter */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-semibold uppercase tracking-wider mr-1" style={{ color: 'var(--text-muted)' }}>Provider</span>
                                <button
                                    type="button"
                                    onClick={() => setActiveProvider(null)}
                                    className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                                    style={{
                                        background: !activeProvider ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                        color: !activeProvider ? '#fff' : 'var(--text-muted)',
                                    }}
                                >All</button>
                                {providerNames.map(p => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setActiveProvider(activeProvider === p ? null : p)}
                                        className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                                        style={{
                                            background: activeProvider === p ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                            color: activeProvider === p ? '#fff' : 'var(--text-muted)',
                                        }}
                                    >{p}</button>
                                ))}
                            </div>
                            {/* Hidden toggle — only render when there's something to manage */}
                            {(hiddenCount > 0 || onToggleHidden) && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider mr-1" style={{ color: 'var(--text-muted)' }}>Hidden</span>
                                    <button
                                        type="button"
                                        onClick={() => setShowHidden(s => !s)}
                                        className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                                        style={{
                                            background: showHidden ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                            color: showHidden ? '#fff' : 'var(--text-muted)',
                                        }}
                                        title={hiddenCount === 0 ? 'No models hidden yet' : `${hiddenCount} model${hiddenCount === 1 ? '' : 's'} hidden`}
                                    >
                                        {showHidden ? `Showing hidden (${hiddenCount})` : `Show hidden (${hiddenCount})`}
                                    </button>
                                </div>
                            )}
                            {/* Family filter */}
                            {familyList.length > 1 && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider mr-1" style={{ color: 'var(--text-muted)' }}>Family</span>
                                    <button
                                        type="button"
                                        onClick={() => setActiveFamily(null)}
                                        className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                                        style={{
                                            background: !activeFamily ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                            color: !activeFamily ? '#fff' : 'var(--text-muted)',
                                        }}
                                    >All</button>
                                    {familyList.map(f => (
                                        <button
                                            key={f}
                                            type="button"
                                            onClick={() => setActiveFamily(activeFamily === f ? null : f)}
                                            className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                                            style={{
                                                background: activeFamily === f ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                                color: activeFamily === f ? '#fff' : 'var(--text-muted)',
                                            }}
                                        >{f}</button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Model list */}
                        <div className="flex-1 overflow-y-auto px-2 pb-4" style={{ minHeight: 0 }}>
                            {/* Clear option */}
                            <button
                                type="button"
                                onClick={() => { onChange({ providerId: '', modelId: '' }); setOpen(false); }}
                                className="w-full text-left px-4 py-2.5 rounded-lg text-sm hover:bg-white/5 transition-colors mb-1"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                {clearLabel}
                            </button>

                            {Object.entries(filteredGroups).map(([provName, models]) => (
                                <div key={provName} className="mb-2">
                                    {/* Provider header */}
                                    <div
                                        className="sticky top-0 z-10 px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg mb-1"
                                        style={{ background: 'var(--bg-secondary)', color: 'var(--accent-primary)' }}
                                    >
                                        {provName} ({models.length})
                                    </div>
                                    <div className="grid gap-0.5">
                                        {models.map(m => {
                                            const meta = getModelMeta(m.id);
                                            const displayName = getModelDisplayName(m);
                                            const isSelected = m.id === selectedId
                                                && (!selectedProviderId || m.providerId === selectedProviderId);
                                            const isHidden = hiddenSet.has(m.id);
                                            return (
                                                <div
                                                    key={(m.providerId || '') + ':' + m.id}
                                                    className={`w-full rounded-lg text-sm flex items-stretch transition-all ${isSelected
                                                        ? 'ring-1 ring-[var(--accent-primary)]'
                                                        : 'hover:bg-white/5'
                                                        }`}
                                                    style={{
                                                        background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                                        color: 'var(--text-primary)',
                                                        opacity: isHidden ? 0.55 : 1,
                                                    }}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => { onChange({ providerId: m.providerId || '', modelId: m.id }); setOpen(false); }}
                                                        className="flex-1 min-w-0 text-left px-4 py-2.5 flex items-center gap-3"
                                                    >
                                                        {/* Checkmark */}
                                                        <span className="w-5 text-center shrink-0" style={{ color: 'var(--accent-primary)' }}>
                                                            {isSelected ? '✓' : ''}
                                                        </span>
                                                        {/* Model info */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-medium flex items-center gap-2">
                                                                <span className="truncate">{displayName}</span>
                                                                {isHidden && (
                                                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>Hidden</span>
                                                                )}
                                                            </div>
                                                            {displayName !== m.id && (
                                                                <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{m.id}</div>
                                                            )}
                                                        </div>
                                                        {/* Category badge */}
                                                        {meta?.cat && (
                                                            <span
                                                                className="text-[10px] px-2 py-1 rounded-full shrink-0 font-medium"
                                                                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
                                                            >
                                                                {meta.cat}
                                                            </span>
                                                        )}
                                                    </button>
                                                    {/* Hide / unhide toggle */}
                                                    {onToggleHidden && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); onToggleHidden(m.id); }}
                                                            className="px-3 flex items-center justify-center hover:bg-white/10 rounded-r-lg transition-colors shrink-0"
                                                            style={{ color: 'var(--text-muted)' }}
                                                            title={isHidden ? 'Show this model in tier pickers' : 'Hide this model from tier pickers'}
                                                        >
                                                            {isHidden ? (
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                                </svg>
                                                            ) : (
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                </svg>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            {totalResults === 0 && (
                                <div className="px-4 py-12 text-center" style={{ color: 'var(--text-muted)' }}>
                                    <p className="text-lg mb-1">No models found</p>
                                    <p className="text-sm">{providerNames.length === 0 ? 'Configure a provider in the Providers tab first.' : 'Try a different search term'}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default SearchableModelSelect;

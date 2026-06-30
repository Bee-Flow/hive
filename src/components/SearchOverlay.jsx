import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, X, MessageSquare, Calendar, Bot, Clock } from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';
import { isImageAvatar, resolveAvatarSrc } from '../utils/agentAvatar';
import { formatRelativeDate } from '../utils/dateFormatters';

const RECENT_KEY = 'beeflow.search.recent';
const MAX_RECENT = 5;

const loadRecent = () => {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
    catch { return []; }
};

const saveRecent = (term) => {
    try {
        const existing = loadRecent().filter(t => t !== term);
        const next = [term, ...existing].slice(0, MAX_RECENT);
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        return next;
    } catch { return []; }
};

const highlightSnippet = (snippet, query) => {
    if (!query) return snippet;
    const escaped = snippet
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escaped.replace(regex, '<mark style="background:color-mix(in srgb, var(--accent-primary) 25%, transparent);color:var(--text-primary);border-radius:3px;padding:0 2px;font-weight:600">$1</mark>');
};

const formatDate = (dateStr) => formatRelativeDate(dateStr, {
    fallbackOptions: { year: 'numeric', month: 'short', day: 'numeric' },
});

const SearchOverlay = ({ isOpen, onClose, onSelectResult, agents = [] }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [recent, setRecent] = useState(loadRecent);

    // Filters
    const [source, setSource] = useState('all'); // all, agent, direct
    const [selectedAgent, setSelectedAgent] = useState('all');
    const [dateRange, setDateRange] = useState('all');
    const [sortBy, setSortBy] = useState('date');

    const inputRef = useRef(null);
    const listRef = useRef(null);
    const debounceRef = useRef(null);
    const lastSearchedRef = useRef('');

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
            setRecent(loadRecent());
        } else {
            // Reset on close so next open starts fresh
            setQuery('');
            setResults([]);
            setSelectedIdx(0);
        }
    }, [isOpen]);

    const buildFilters = useCallback(() => {
        const filters = {};
        if (source !== 'all') filters.source = source;
        if (selectedAgent !== 'all' && source !== 'direct') filters.agentId = selectedAgent;
        if (dateRange !== 'all') {
            const past = new Date();
            if (dateRange === '7d') past.setDate(past.getDate() - 7);
            if (dateRange === '30d') past.setDate(past.getDate() - 30);
            if (dateRange === '90d') past.setDate(past.getDate() - 90);
            filters.startDate = past.toISOString();
        }
        return filters;
    }, [source, selectedAgent, dateRange]);

    const processResults = useCallback((conversations, searchTerm) => {
        const processed = [];
        const lowerTerm = searchTerm.toLowerCase();

        conversations.forEach(conv => {
            let messages = [];
            try {
                messages = typeof conv.messages_json === 'string'
                    ? JSON.parse(conv.messages_json)
                    : conv.messages_json || [];
            } catch { /* ignore */ }

            const match = messages.find(m =>
                m.content && typeof m.content === 'string' &&
                m.content.toLowerCase().includes(lowerTerm)
            );

            if (match) {
                const content = match.content;
                const idx = content.toLowerCase().indexOf(lowerTerm);
                const start = Math.max(0, idx - 40);
                const end = Math.min(content.length, idx + searchTerm.length + 80);
                const snippet = (start > 0 ? '…' : '') +
                    content.substring(start, end) +
                    (end < content.length ? '…' : '');
                const relevanceScore = (content.match(new RegExp(lowerTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
                processed.push({ ...conv, snippet, matchRole: match.role, relevanceScore });
            } else {
                processed.push({ ...conv, snippet: 'Matched in conversation title', matchRole: 'title', relevanceScore: 1 });
            }
        });
        return processed;
    }, []);

    const handleSearch = useCallback(async (searchTerm) => {
        if (!searchTerm || searchTerm.length < 2) {
            setResults([]);
            return;
        }
        lastSearchedRef.current = searchTerm;
        setIsLoading(true);
        try {
            const filters = buildFilters();
            const queryParams = new URLSearchParams({ q: searchTerm, ...filters });
            const res = await authFetch(`${API_BASE}/agents/conversations/search?${queryParams.toString()}`);
            if (res.ok) {
                const data = await res.json();
                if (lastSearchedRef.current === searchTerm) {
                    setResults(processResults(data, searchTerm));
                    setSelectedIdx(0);
                }
            }
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setIsLoading(false);
        }
    }, [buildFilters, processResults]);

    useEffect(() => {
        if (query.length >= 2) handleSearch(query);
    }, [source, selectedAgent, dateRange]); // eslint-disable-line

    const handleInput = (e) => {
        const val = e.target.value;
        setQuery(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => handleSearch(val), 300);
    };

    const sortedResults = useMemo(() => {
        return [...results].sort((a, b) => {
            if (sortBy === 'relevance') {
                if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
                return new Date(b.updated_at) - new Date(a.updated_at);
            }
            return new Date(b.updated_at) - new Date(a.updated_at);
        });
    }, [results, sortBy]);

    const handleSelect = useCallback((result) => {
        if (query.trim()) setRecent(saveRecent(query.trim()));
        onSelectResult(result);
    }, [query, onSelectResult]);

    const resetFilters = () => {
        setSource('all');
        setSelectedAgent('all');
        setDateRange('all');
    };

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
            if (sortedResults.length === 0) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIdx(i => Math.min(sortedResults.length - 1, i + 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIdx(i => Math.max(0, i - 1));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const r = sortedResults[selectedIdx];
                if (r) handleSelect(r);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, sortedResults, selectedIdx, onClose, handleSelect]);

    // Scroll selected row into view
    useEffect(() => {
        if (!listRef.current) return;
        const el = listRef.current.querySelector(`[data-idx="${selectedIdx}"]`);
        if (el) el.scrollIntoView({ block: 'nearest' });
    }, [selectedIdx]);

    if (!isOpen) return null;

    const hasFilters = source !== 'all' || selectedAgent !== 'all' || dateRange !== 'all';
    const showRecent = !query && recent.length > 0;

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[max(2rem,8vh)] pb-8 animate-fade-in"
            style={{
                // Themed backdrop — softer than bg-black/60 so it doesn't fight
                // glass surfaces, and the heavy blur lifts the modal forward
                // without making the rest of the app look "cut off".
                background: 'color-mix(in srgb, var(--bg-primary, #0f172a) 55%, rgba(15, 23, 42, 0.45))',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
            }}
            onClick={onClose}
            role="dialog"
            aria-label="Search conversations"
            aria-modal="true"
        >
            <div
                className="w-[720px] max-w-[95vw] max-h-full flex flex-col rounded-2xl shadow-2xl overflow-hidden"
                data-surface="opaque"
                onClick={e => e.stopPropagation()}
                data-testid="search-overlay"
            >
                {/* Header: icon + input + clear + close */}
                <div className="flex-shrink-0 flex items-center gap-3 px-5 h-16 border-b border-[var(--border-subtle)]">
                    <Search className="w-[18px] h-[18px] text-[var(--text-tertiary)] flex-shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={handleInput}
                        placeholder="Search conversations and messages…"
                        className="flex-1 bg-transparent border-none text-[16px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:ring-0 focus:outline-none"
                        data-testid="search-input"
                        aria-label="Search query"
                        aria-controls="search-results"
                        aria-activedescendant={sortedResults[selectedIdx] ? `search-result-${sortedResults[selectedIdx].id}` : undefined}
                    />
                    {query && (
                        <button
                            onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus(); }}
                            className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                            aria-label="Clear search"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                        aria-label="Close search"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Filter bar — all chips share the same pill chrome so it reads as one row */}
                <div
                    className="flex-shrink-0 flex items-center flex-wrap gap-2 px-5 py-3 border-b border-[var(--border-subtle)]"
                >
                    <PillGroup
                        value={source}
                        onChange={setSource}
                        options={[
                            { value: 'all', label: 'All' },
                            { value: 'agent', label: 'Agents' },
                            { value: 'direct', label: 'Direct' },
                        ]}
                        ariaLabel="Source filter"
                    />
                    <FilterPill
                        icon={Bot}
                        value={selectedAgent}
                        onChange={setSelectedAgent}
                        disabled={source === 'direct'}
                        options={[
                            { value: 'all', label: 'All agents' },
                            ...(Array.isArray(agents) ? agents.map(a => ({ value: a.id, label: a.name })) : []),
                        ]}
                    />
                    <FilterPill
                        icon={Clock}
                        value={dateRange}
                        onChange={setDateRange}
                        options={[
                            { value: 'all', label: 'Any time' },
                            { value: '7d', label: 'Last 7 days' },
                            { value: '30d', label: 'Last 30 days' },
                            { value: '90d', label: 'Last 90 days' },
                        ]}
                    />
                    <div className="flex-1" />
                    <PillGroup
                        value={sortBy}
                        onChange={setSortBy}
                        options={[
                            { value: 'relevance', label: 'Relevance' },
                            { value: 'date', label: 'Date' },
                        ]}
                        ariaLabel="Sort by"
                    />
                </div>

                {/* Results */}
                <div ref={listRef} className="flex-1 overflow-y-auto custom-scrollbar" id="search-results" role="listbox">
                    {isLoading && sortedResults.length === 0 ? (
                        <div className="p-2 space-y-1">
                            {[0, 1, 2].map(i => <SkeletonRow key={i} />)}
                        </div>
                    ) : sortedResults.length > 0 ? (
                        <div className="p-2 space-y-0.5">
                            {sortedResults.map((result, idx) => (
                                <ResultRow
                                    key={`${result.kind || 'agent'}-${result.id}`}
                                    result={result}
                                    query={query}
                                    idx={idx}
                                    selected={idx === selectedIdx}
                                    onSelect={handleSelect}
                                    onHover={() => setSelectedIdx(idx)}
                                />
                            ))}
                        </div>
                    ) : query.length >= 2 ? (
                        <EmptyState
                            title={`No matches for "${query}"`}
                            hint={hasFilters ? 'Try removing some filters or changing your query.' : 'Try a different phrase.'}
                            action={hasFilters ? { label: 'Reset filters', onClick: resetFilters } : null}
                        />
                    ) : showRecent ? (
                        <div className="px-5 py-5">
                            <div className="flex items-center gap-2 mb-3">
                                <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Recent searches</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {recent.map(term => (
                                    <button
                                        key={term}
                                        onClick={() => {
                                            setQuery(term);
                                            handleSearch(term);
                                            inputRef.current?.focus();
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3 h-7 rounded-full bg-[var(--bg-tertiary)]/70 hover:bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                    >
                                        <Search className="w-3 h-3 text-[var(--text-tertiary)]" />
                                        {term}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <EmptyState
                            title="Search your conversations"
                            hint="Find messages across agent chats and direct conversations."
                        />
                    )}
                </div>

                {/* Footer */}
                {query.length >= 2 && (
                    <div className="flex-shrink-0 flex items-center justify-end px-4 h-9 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]/30 text-[11px] text-[var(--text-tertiary)]">
                        <span>{sortedResults.length} result{sortedResults.length === 1 ? '' : 's'}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Sub-components ──────────────────────────────────────────────────────────

const PillGroup = ({ value, onChange, options, ariaLabel }) => (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex h-8 bg-[var(--bg-tertiary)]/60 rounded-full p-0.5 border border-[var(--border-subtle)]">
        {options.map(opt => (
            <button
                key={opt.value}
                role="radio"
                aria-checked={value === opt.value}
                onClick={() => onChange(opt.value)}
                className={`px-3 text-[12px] font-medium rounded-full transition-all ${
                    value === opt.value
                        ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                }`}
            >
                {opt.label}
            </button>
        ))}
    </div>
);

/* Pill-shaped filter dropdown — matches the chrome of PillGroup so the whole
   filter row reads as one consistent set of chips. The native <select> sits
   transparently over the pill so the label updates without a custom popup. */
const FilterPill = ({ icon: Icon, value, onChange, options, disabled }) => {
    const active = value !== 'all' && value !== undefined && value !== null;
    return (
        <div
            className={`relative inline-flex items-center h-8 px-3 rounded-full border transition-colors ${
                disabled
                    ? 'opacity-40 pointer-events-none border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/30'
                    : active
                        ? 'border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/60 hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
            }`}
        >
            <Icon className={`w-3.5 h-3.5 mr-1.5 flex-shrink-0 ${active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]'}`} />
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                disabled={disabled}
                className="bg-transparent border-none text-[12px] font-medium focus:ring-0 focus:outline-none cursor-pointer pr-4 appearance-none"
                style={{ color: 'inherit' }}
            >
                {options.map(o => <option key={o.value} value={o.value} style={{ color: 'var(--text-primary)', background: 'var(--bg-card)' }}>{o.label}</option>)}
            </select>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="absolute right-2.5 pointer-events-none opacity-60">
                <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </div>
    );
};

const ResultRow = ({ result, query, idx, selected, onSelect, onHover }) => {
    const isDirect = result.kind === 'direct';
    const agentName = result.agent_name || (isDirect ? 'Direct Chat' : 'Agent');
    const avatar = result.agent_avatar;
    const hasImageAvatar = isImageAvatar(avatar);

    return (
        <button
            id={`search-result-${result.id}`}
            data-idx={idx}
            data-testid={`search-result-${result.id}`}
            role="option"
            aria-selected={selected}
            onClick={() => onSelect(result)}
            onMouseEnter={onHover}
            className={`w-full text-left p-3 rounded-lg transition-colors flex gap-3 ${
                selected
                    ? 'bg-[var(--bg-secondary)]'
                    : 'hover:bg-[var(--bg-secondary)]/60'
            }`}
        >
            {/* Icon / Avatar */}
            <div className="flex-shrink-0 mt-0.5">
                {isDirect ? (
                    <div className="w-8 h-8 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-secondary)]">
                        <MessageSquare className="w-4 h-4" />
                    </div>
                ) : hasImageAvatar ? (
                    <div className="w-8 h-8 rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                        <img src={resolveAvatarSrc(avatar)} alt="" className="w-full h-full object-contain" />
                    </div>
                ) : avatar ? (
                    <div className="w-8 h-8 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] flex items-center justify-center text-base leading-none">
                        {avatar}
                    </div>
                ) : (
                    <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)]/10 border border-[var(--border-subtle)] flex items-center justify-center text-xs font-semibold text-[var(--accent-primary)]">
                        {agentName[0]?.toUpperCase() || '?'}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                        {result.title || 'Untitled Conversation'}
                    </span>
                    <span className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        isDirect
                            ? 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] border border-[var(--border-subtle)]'
                            : 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20'
                    }`}>
                        {isDirect ? (result.model_tier ? `Direct · ${result.model_tier}` : 'Direct') : agentName}
                    </span>
                </div>
                <div
                    className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: highlightSnippet(result.snippet || '', query) }}
                />
                <div className="flex items-center gap-1 mt-1 text-[10px] text-[var(--text-muted)]">
                    <Calendar className="w-2.5 h-2.5" />
                    {formatDate(result.updated_at)}
                </div>
            </div>
        </button>
    );
};

const SkeletonRow = () => (
    <div className="flex gap-3 p-3 animate-pulse">
        <div className="w-8 h-8 rounded-lg bg-[var(--bg-secondary)]" />
        <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 bg-[var(--bg-secondary)] rounded" />
            <div className="h-2.5 w-5/6 bg-[var(--bg-secondary)] rounded" />
            <div className="h-2.5 w-2/3 bg-[var(--bg-secondary)] rounded" />
        </div>
    </div>
);

const EmptyState = ({ title, hint, action }) => (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
        <div className="w-10 h-10 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center mb-3">
            <Search className="w-4 h-4 text-[var(--text-tertiary)]" />
        </div>
        <div className="text-sm font-medium text-[var(--text-secondary)]">{title}</div>
        {hint && <div className="text-xs text-[var(--text-tertiary)] mt-1">{hint}</div>}
        {action && (
            <button
                onClick={action.onClick}
                className="mt-3 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-primary)] transition-colors"
            >
                {action.label}
            </button>
        )}
    </div>
);

export default SearchOverlay;

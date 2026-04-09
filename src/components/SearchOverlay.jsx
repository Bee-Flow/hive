import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, MessageSquare, Calendar, ArrowRight, Filter, SortDesc, Check } from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';
const highlightSnippet = (snippet, query) => {
    if (!query) return snippet;
    // Escape HTML entities in the snippet to prevent XSS
    const escaped = snippet
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    // Bold-highlight each occurrence of the query
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escaped.replace(regex, '<mark style="background:var(--accent-primary);color:var(--bg-primary);border-radius:2px;padding:0 2px;font-weight:600">$1</mark>');
};

const SearchOverlay = ({ isOpen, onClose, onSelectResult, agents = [] }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // Filters
    const [selectedAgent, setSelectedAgent] = useState('all');
    const [dateRange, setDateRange] = useState('all'); // all, 7d, 30d
    const [sortBy, setSortBy] = useState('relevance'); // relevance, date

    const inputRef = useRef(null);
    const debounceRef = useRef(null);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current.focus(), 100);
        }
    }, [isOpen]);

    // Construct backend filters
    const getBackendFilters = () => {
        const filters = {};
        if (selectedAgent !== 'all') filters.agentId = selectedAgent;

        if (dateRange !== 'all') {
            const now = new Date();
            const past = new Date();
            if (dateRange === '7d') past.setDate(now.getDate() - 7);
            if (dateRange === '30d') past.setDate(now.getDate() - 30);
            filters.startDate = past.toISOString();
        }
        return filters;
    };

    const handleSearch = async (searchTerm) => {
        if (!searchTerm || searchTerm.length < 2) {
            setResults([]);
            return;
        }

        setIsLoading(true);
        try {
            const filters = getBackendFilters();
            const queryParams = new URLSearchParams({
                q: searchTerm,
                ...filters
            });

            const res = await authFetch(`${API_BASE}/agents/conversations/search?${queryParams.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setResults(processResults(data, searchTerm));
            }
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Re-run search when filters change
    useEffect(() => {
        if (query.length >= 2) {
            handleSearch(query);
        }
    }, [selectedAgent, dateRange]);

    const processResults = (conversations, searchTerm) => {
        // Parse messages and find matches
        const processed = [];
        const lowerTerm = searchTerm.toLowerCase();

        conversations.forEach(conv => {
            let messages = [];
            try {
                messages = typeof conv.messages_json === 'string'
                    ? JSON.parse(conv.messages_json)
                    : conv.messages_json || [];
            } catch (e) { return; }

            // Find match in messages
            const match = messages.find(m =>
                m.content &&
                typeof m.content === 'string' &&
                m.content.toLowerCase().includes(lowerTerm)
            );

            if (match) {
                // Create match snippet
                const content = match.content;
                const idx = content.toLowerCase().indexOf(lowerTerm);
                const start = Math.max(0, idx - 40);
                const end = Math.min(content.length, idx + searchTerm.length + 60);
                const snippet = (start > 0 ? '...' : '') +
                    content.substring(start, end) +
                    (end < content.length ? '...' : '');

                // Calculate basic relevance score (occurrence count in snippet context)
                const relevanceScore = (content.match(new RegExp(lowerTerm, 'gi')) || []).length;

                processed.push({
                    ...conv,
                    snippet,
                    matchRole: match.role,
                    relevanceScore
                });
            } else {
                // If matched on title but not message content, add it anyway
                processed.push({
                    ...conv,
                    snippet: 'Matched in conversation title',
                    matchRole: 'system',
                    relevanceScore: 1
                });
            }
        });

        return processed;
    };

    const handleInput = (e) => {
        const val = e.target.value;
        setQuery(val);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => handleSearch(val), 500);
    };

    const sortedResults = useMemo(() => {
        return [...results].sort((a, b) => {
            if (sortBy === 'relevance') {
                // Primary: Relevance Score, Secondary: Date
                if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
                return new Date(b.updated_at) - new Date(a.updated_at);
            } else {
                // Date sort
                return new Date(b.updated_at) - new Date(a.updated_at);
            }
        });
    }, [results, sortBy]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div
                className="bg-[var(--bg-primary)] w-[800px] max-w-[95vw] max-h-[85vh] flex flex-col rounded-2xl shadow-2xl border border-[var(--border-subtle)] overflow-hidden"
                onClick={e => e.stopPropagation()}
                data-testid="search-overlay"
            >
                {/* Header / Input */}
                <div className="flex flex-col bg-[var(--bg-secondary)]/30 border-b border-[var(--border-subtle)]">
                    <div className="py-4 px-6 flex items-center gap-4">
                        <Search className="w-5 h-5 text-[var(--text-tertiary)]" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={handleInput}
                            placeholder="Search across all conversations..."
                            className="flex-1 bg-transparent border-none text-lg text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:ring-0 focus:outline-none font-medium"
                            data-testid="search-input"
                        />
                        <button onClick={onClose} className="p-2 hover:bg-[var(--bg-secondary)] rounded-xl transition-colors">
                            <X className="w-5 h-5 text-[var(--text-tertiary)]" />
                        </button>
                    </div>

                    {/* Filters Toolbar */}
                    <div className="px-6 pb-4 flex items-center gap-4">
                        <div className="flex items-center gap-2 group">
                            <Filter className="w-3.5 h-3.5 text-[var(--text-tertiary)] group-hover:text-[var(--accent-primary)] transition-colors" />
                            <select
                                value={selectedAgent}
                                onChange={(e) => setSelectedAgent(e.target.value)}
                                className="bg-transparent border-none text-xs text-[var(--text-secondary)] focus:ring-0 cursor-pointer py-0 pl-0 pr-6 hover:text-[var(--text-primary)] transition-colors font-medium uppercase tracking-tight"
                            >
                                <option value="all">All Agents</option>
                                {(Array.isArray(agents) ? agents : []).map(agent => (
                                    <option key={agent.id} value={agent.id}>{agent.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2 group">
                            <Calendar className="w-3.5 h-3.5 text-[var(--text-tertiary)] group-hover:text-[var(--accent-primary)] transition-colors" />
                            <select
                                value={dateRange}
                                onChange={(e) => setDateRange(e.target.value)}
                                className="bg-transparent border-none text-xs text-[var(--text-secondary)] focus:ring-0 cursor-pointer py-0 pl-0 pr-6 hover:text-[var(--text-primary)] transition-colors font-medium uppercase tracking-tight"
                            >
                                <option value="all">Any Time</option>
                                <option value="7d">Last 7 Days</option>
                                <option value="30d">Last 30 Days</option>
                            </select>
                        </div>

                        <div className="flex-1" />

                        <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">Sort:</span>
                            <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-1 border border-[var(--border-subtle)]">
                                <button
                                    onClick={() => setSortBy('relevance')}
                                    className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${sortBy === 'relevance' ? 'bg-[var(--bg-primary)] text-[var(--accent-primary)] shadow-sm' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
                                >
                                    Relevance
                                </button>
                                <button
                                    onClick={() => setSortBy('date')}
                                    className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${sortBy === 'date' ? 'bg-[var(--bg-primary)] text-[var(--accent-primary)] shadow-sm' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
                                >
                                    Date
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Results */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center p-8 text-[var(--text-tertiary)]">
                            <div className="w-6 h-6 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mb-2"></div>
                            <span className="text-sm">Searching...</span>
                        </div>
                    ) : sortedResults.length > 0 ? (
                        <div className="space-y-1">
                            {sortedResults.map(result => (
                                <button
                                    key={result.id}
                                    onClick={() => onSelectResult(result)}
                                    className="w-full text-left p-4 rounded-xl hover:bg-[var(--bg-secondary)] transition-all group flex flex-col gap-2 border border-transparent hover:border-[var(--border-subtle)] hover:shadow-sm"
                                    data-testid={`search-result-${result.id}`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center text-xs font-bold flex-shrink-0 border border-[var(--accent-primary)]/20 shadow-inner overflow-hidden">
                                                {result.agent_avatar ? (
                                                    <img src={result.agent_avatar} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    result.agent_name?.[0] || '?'
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors line-clamp-1">
                                                        {result.title || 'Untitled Conversation'}
                                                    </span>
                                                    <span className="px-1.5 py-0.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-muted)] text-[9px] uppercase font-bold tracking-tight border border-[var(--border-subtle)] group-hover:bg-[var(--accent-primary)]/10 group-hover:text-[var(--accent-primary)] transition-colors flex-shrink-0">
                                                        {result.agent_name}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] mt-0.5">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(result.updated_at).toLocaleDateString(undefined, {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric'
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pl-12">
                                        <div className={`relative p-3 rounded-lg bg-[var(--bg-tertiary)]/40 group-hover:bg-[var(--bg-tertiary)]/60 transition-colors border-l-2 ${result.matchRole === 'user' ? 'border-[var(--text-muted)]' : 'border-[var(--accent-primary)]'}`}>
                                            <div className="text-sm text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                                                <div className="flex items-center gap-2 mb-1">
                                                    {result.matchRole === 'user' && <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">You</span>}
                                                    {result.matchRole === 'assistant' && <span className="text-[9px] font-black text-[var(--accent-primary)] uppercase tracking-widest">AI</span>}
                                                </div>
                                                <div className="inline">
                                                    <span
                                                        className="text-sm leading-relaxed"
                                                        dangerouslySetInnerHTML={{ __html: highlightSnippet(result.snippet, query) }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : query.length >= 2 ? (
                        <div className="text-center p-8 text-[var(--text-tertiary)]">
                            <p>No matches found for "{query}"</p>
                            {(selectedAgent !== 'all' || dateRange !== 'all') && (
                                <p className="text-sm mt-2">Try adjusting your filters.</p>
                            )}
                        </div>
                    ) : (
                        <div className="text-center p-8 text-[var(--text-tertiary)]">
                            <p>Type to search message history...</p>
                        </div>
                    )}
                </div>

                <div className="p-3 border-t border-[var(--border-subtle)] bg-[var(--bg-tertiary)] text-xs text-[var(--text-tertiary)] flex justify-between">
                    <span>Press ESC to close</span>
                    <span>{sortedResults.length} results found</span>
                </div>
            </div>
        </div>
    );
};

export default SearchOverlay;

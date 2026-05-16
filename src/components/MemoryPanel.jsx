import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE, authFetch } from '../utils/helpers';
import { formatRelativeTime } from '../utils/dateFormatters';

const PAGE_SIZE = 50;

const MemoryPanel = ({ onClose, projectId }) => {
    const [memories, setMemories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editContent, setEditContent] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [newMemory, setNewMemory] = useState({ content: '', type: 'fact' });
    const [filterType, setFilterType] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    // For project-scoped panel we still fetch the full list and filter client-side
    // (project memory backlogs are small and the API doesn't paginate that path).
    const isPaginated = !projectId;

    // Debounce the search input so we don't refetch on every keystroke.
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
        return () => clearTimeout(t);
    }, [searchTerm]);

    const fetchMemories = useCallback(async ({ append = false, offset = 0 } = {}) => {
        try {
            if (append) setLoadingMore(true); else setLoading(true);
            const params = new URLSearchParams();
            if (projectId) {
                params.set('projectId', projectId);
            } else {
                params.set('limit', String(PAGE_SIZE));
                params.set('offset', String(offset));
                if (debouncedSearch) params.set('search', debouncedSearch);
                if (filterType !== 'all') params.set('type', filterType);
            }
            const url = `${API_BASE}/agents/memory?${params.toString()}`;
            const res = await authFetch(url);
            const data = await res.json();
            if (data.memories) {
                setMemories(prev => append ? [...prev, ...data.memories] : data.memories);
                if (isPaginated) {
                    setTotal(typeof data.total === 'number' ? data.total : data.memories.length);
                    setHasMore(!!data.hasMore);
                } else {
                    setTotal(data.memories.length);
                    setHasMore(false);
                }
            }
        } catch (err) {
            setError('Failed to load memories');
            console.error(err);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [projectId, debouncedSearch, filterType, isPaginated]);

    // Reload from the top whenever filter/search changes.
    useEffect(() => {
        fetchMemories({ append: false, offset: 0 });
        // Reset selection so it doesn't reference items no longer in view.
        setSelectedIds(new Set());
    }, [fetchMemories]);

    const handleLoadMore = () => {
        if (!hasMore || loadingMore) return;
        fetchMemories({ append: true, offset: memories.length });
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this memory?')) return;

        try {
            const res = await authFetch(`${API_BASE}/agents/memory/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setMemories(prev => prev.filter(m => m.id !== id));
                setTotal(t => Math.max(0, t - 1));
            }
        } catch (err) {
            console.error('Failed to delete memory:', err);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Delete ${selectedIds.size} selected ${selectedIds.size === 1 ? 'memory' : 'memories'}? This cannot be undone.`)) return;

        try {
            const res = await authFetch(`${API_BASE}/agents/memory/bulk-delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedIds) })
            });
            if (res.ok) {
                const deletedCount = selectedIds.size;
                setMemories(prev => prev.filter(m => !selectedIds.has(m.id)));
                setSelectedIds(new Set());
                setIsSelectMode(false);
                setTotal(t => Math.max(0, t - deletedCount));
            }
        } catch (err) {
            console.error('Failed to bulk delete memories:', err);
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        const ids = filteredMemories.map(m => m.id);
        setSelectedIds(new Set(ids));
    };

    const deselectAll = () => setSelectedIds(new Set());

    const handleEdit = (memory) => {
        setEditingId(memory.id);
        setEditContent(memory.content);
    };

    const handleSaveEdit = async (id) => {
        try {
            const res = await authFetch(`${API_BASE}/agents/memory/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: editContent })
            });
            if (res.ok) {
                setMemories(prev => prev.map(m =>
                    m.id === id ? { ...m, content: editContent } : m
                ));
                setEditingId(null);
            }
        } catch (err) {
            console.error('Failed to update memory:', err);
        }
    };

    const handleAdd = async () => {
        if (!newMemory.content.trim()) return;

        try {
            const payload = { ...newMemory };
            if (projectId) payload.projectId = projectId;
            
            const res = await authFetch(`${API_BASE}/agents/memory`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.id) {
                setMemories(prev => [{
                    id: data.id,
                    content: newMemory.content,
                    type: newMemory.type,
                    created_at: new Date().toISOString()
                }, ...prev]);
                setTotal(t => t + 1);
                setNewMemory({ content: '', type: 'fact' });
                setShowAddForm(false);
            }
        } catch (err) {
            console.error('Failed to add memory:', err);
        }
    };

    const handleClearAll = async () => {
        if (!confirm('Delete ALL memories? This cannot be undone.')) return;

        try {
            const res = await authFetch(`${API_BASE}/agents/memory/clear`, {
                method: 'POST'
            });
            if (res.ok) {
                setMemories([]);
                setTotal(0);
                setHasMore(false);
            }
        } catch (err) {
            console.error('Failed to clear memories:', err);
        }
    };

    const handleExport = async () => {
        try {
            const res = await authFetch(`${API_BASE}/agents/memory/export/all`);
            const data = await res.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'memories.json';
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to export memories:', err);
        }
    };

    const typeConfig = {
        instruction: { icon: '📌', label: 'Instruction', color: '#fb923c', bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.25)' },
        person: { icon: '👤', label: 'Person', color: '#f472b6', bg: 'rgba(236, 72, 153, 0.1)', border: 'rgba(236, 72, 153, 0.25)' },
        project: { icon: '📁', label: 'Project', color: '#38bdf8', bg: 'rgba(14, 165, 233, 0.1)', border: 'rgba(14, 165, 233, 0.25)' },
        preference: { icon: '⚙️', label: 'Preference', color: '#c084fc', bg: 'rgba(168, 85, 247, 0.1)', border: 'rgba(168, 85, 247, 0.25)' },
        workflow: { icon: '🔄', label: 'Workflow', color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.25)' },
        fact: { icon: '📋', label: 'Fact', color: '#60a5fa', bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.25)' },
        context: { icon: '🏢', label: 'Context', color: '#4ade80', bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.25)' },
    };

    // Types available when adding a memory manually, scoped by context:
    // - Project panel: project-relevant types only (no personal/workflow entries)
    // - User-global panel: personal types only (never 'project' — those belong to projects)
    const allowedAddTypes = projectId
        ? ['instruction', 'project', 'fact', 'context']
        : ['instruction', 'person', 'preference', 'workflow', 'fact', 'context'];

    const formatDate = formatRelativeTime;

    // Filtered memories — for the paginated/global view the server has
    // already applied search + type filters, so we just show what was loaded.
    // For project-scoped panels we still filter client-side.
    const filteredMemories = isPaginated
        ? memories
        : memories.filter(m => {
            if (filterType !== 'all' && m.type !== filterType) return false;
            if (searchTerm && !m.content.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            return true;
        });

    // Count per type
    const typeCounts = memories.reduce((acc, m) => {
        acc[m.type] = (acc[m.type] || 0) + 1;
        return acc;
    }, {});

    return (
        <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }} data-testid="memory-panel">
            {/* Header */}
            <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        {onClose && (
                            <button onClick={onClose} className="p-1.5 -ml-1 rounded-lg transition-colors hover:bg-black/5"
                                style={{ color: 'var(--text-muted)' }} title="Back to Settings">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                        )}
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
                            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(99, 102, 241, 0.2))',
                        }}>
                            <svg className="w-5 h-5" style={{ color: '#c084fc' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{projectId ? 'Project Memory' : 'Memory'}</h2>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {isPaginated && total > memories.length
                                    ? `${memories.length} of ${total} ${total === 1 ? 'memory' : 'memories'} loaded`
                                    : `${total || memories.length} ${(total || memories.length) === 1 ? 'memory' : 'memories'} stored`}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { setIsSelectMode(!isSelectMode); setSelectedIds(new Set()); }}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                            style={{
                                background: isSelectMode ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                                color: isSelectMode ? '#818cf8' : 'var(--text-muted)',
                                border: `1px solid ${isSelectMode ? 'rgba(99, 102, 241, 0.3)' : 'var(--border-subtle)'}`,
                            }}
                            title={isSelectMode ? 'Exit select mode' : 'Select multiple'}
                            data-testid="memory-select-toggle"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            {isSelectMode ? 'Cancel' : 'Select'}
                        </button>
                        <button
                            onClick={() => setShowAddForm(!showAddForm)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all"
                            style={{
                                background: showAddForm ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
                                color: showAddForm ? 'var(--text-muted)' : 'white',
                            }}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showAddForm ? "M6 18L18 6M6 6l12 12" : "M12 4v16m8-8H4"} />
                            </svg>
                            {showAddForm ? 'Cancel' : 'Add Memory'}
                        </button>
                    </div>
                </div>

                {/* Search + Filter */}
                <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search memories..."
                            className="input w-full pl-10 text-sm"
                            data-testid="memory-search"
                        />
                    </div>
                    <div className="flex gap-1">
                        <button
                            onClick={() => setFilterType('all')}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                            style={{
                                background: filterType === 'all' ? 'var(--accent-primary)' : 'transparent',
                                color: filterType === 'all' ? 'white' : 'var(--text-muted)',
                            }}
                            data-testid="memory-filter-all"
                        >
                            All
                        </button>
                        {Object.entries(typeConfig).filter(([key]) => allowedAddTypes.includes(key)).map(([key, cfg]) => (
                            typeCounts[key] > 0 && (
                                <button
                                    key={key}
                                    onClick={() => setFilterType(filterType === key ? 'all' : key)}
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
                                    style={{
                                        background: filterType === key ? cfg.bg : 'transparent',
                                        color: filterType === key ? cfg.color : 'var(--text-muted)',
                                        border: filterType === key ? `1px solid ${cfg.border}` : '1px solid transparent',
                                    }}
                                    data-testid={`memory-filter-${key}`}
                                >
                                    <span style={{ fontSize: '11px' }}>{cfg.icon}</span>
                                    {typeCounts[key]}
                                </button>
                            )
                        ))}
                    </div>
                </div>
            </div>

            {/* Add Memory Form */}
            {showAddForm && (
                <div className="p-4 border-b" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-tertiary)' }}>
                    <div className="max-w-2xl mx-auto">
                        <div className="flex gap-2 mb-3">
                            {Object.entries(typeConfig).filter(([key]) => allowedAddTypes.includes(key)).map(([key, cfg]) => (
                                <button
                                    key={key}
                                    onClick={() => setNewMemory(prev => ({ ...prev, type: key }))}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                                    style={{
                                        background: newMemory.type === key ? cfg.bg : 'transparent',
                                        color: newMemory.type === key ? cfg.color : 'var(--text-muted)',
                                        border: `1px solid ${newMemory.type === key ? cfg.border : 'var(--border-subtle)'}`,
                                    }}
                                >
                                    <span>{cfg.icon}</span>
                                    {cfg.label}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newMemory.content}
                                onChange={(e) => setNewMemory(prev => ({ ...prev, content: e.target.value }))}
                                placeholder="Enter something to remember..."
                                className="input text-sm flex-1"
                                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                                autoFocus
                            />
                            <button onClick={handleAdd} className="btn-primary text-sm px-5">
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Memories List */}
            <div className="flex-1 overflow-auto p-5">
                <div className="max-w-2xl mx-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="spinner"></div>
                        </div>
                    ) : error ? (
                        <div className="text-center py-8" style={{ color: '#f87171' }}>{error}</div>
                    ) : filteredMemories.length === 0 ? (
                        <div className="text-center py-16">
                            <div style={{
                                width: '64px', height: '64px', borderRadius: '16px', margin: '0 auto 16px',
                                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(99, 102, 241, 0.15))',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <svg className="w-7 h-7" style={{ color: '#c084fc' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                            </div>
                            {memories.length === 0 ? (
                                <>
                                    <h3 className="text-base font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>No memories yet</h3>
                                    <p className="text-sm" style={{ color: 'var(--text-muted)', maxWidth: '320px', margin: '0 auto', lineHeight: '1.6' }}>
                                        Memories are automatically extracted from conversations. Tell your AI about yourself to start building memory!
                                    </p>
                                </>
                            ) : (
                                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No memories match your filter</p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {/* Bulk select actions bar */}
                            {isSelectMode && filteredMemories.length > 0 && (
                                <div className="flex items-center justify-between px-4 py-2.5 rounded-xl mb-3" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                                    <div className="flex items-center gap-3">
                                        <button onClick={selectedIds.size === filteredMemories.length ? deselectAll : selectAll}
                                            className="text-xs font-medium px-2.5 py-1 rounded-md transition-all"
                                            style={{ color: 'var(--accent-primary)', background: 'rgba(99, 102, 241, 0.1)' }}
                                            data-testid="memory-select-all-btn">
                                            {selectedIds.size === filteredMemories.length ? 'Deselect All' : 'Select All'}
                                        </button>
                                        <span className="text-xs" style={{ color: 'var(--text-muted)' }} data-testid="memory-selected-count">
                                            {selectedIds.size} selected
                                        </span>
                                    </div>
                                    {selectedIds.size > 0 && (
                                        <button onClick={handleBulkDelete}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-red-500/20"
                                            style={{ color: '#f87171' }}
                                            data-testid="memory-bulk-delete-btn">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                            Delete {selectedIds.size}
                                        </button>
                                    )}
                                </div>
                            )}
                            {filteredMemories.map(memory => {
                                const cfg = typeConfig[memory.type] || typeConfig.fact;
                                return (
                                    <div
                                        key={memory.id}
                                        className={`rounded-xl p-4 transition-all group ${isSelectMode ? 'cursor-pointer' : ''}`}
                                        style={{
                                            background: selectedIds.has(memory.id) ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-secondary)',
                                            border: selectedIds.has(memory.id) ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid var(--border-subtle)',
                                            borderLeft: `3px solid ${cfg.color}`,
                                        }}
                                        onClick={isSelectMode ? () => toggleSelect(memory.id) : undefined}
                                        data-testid={`memory-item-${memory.id}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            {isSelectMode && (
                                                <div className="flex items-center mt-1 flex-shrink-0">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(memory.id)}
                                                        onChange={() => toggleSelect(memory.id)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="w-4 h-4 rounded"
                                                        style={{ accentColor: 'var(--accent-primary)' }}
                                                        data-testid={`memory-checkbox-${memory.id}`}
                                                    />
                                                </div>
                                            )}
                                            <div
                                                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                                                style={{ background: cfg.bg, fontSize: '14px' }}
                                            >
                                                {cfg.icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span
                                                        className="text-xs font-semibold uppercase tracking-wider"
                                                        style={{ color: cfg.color, fontSize: '10px' }}
                                                    >
                                                        {cfg.label}
                                                    </span>
                                                    {memory.created_at && (
                                                        <span className="text-xs" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                                                            • {formatDate(memory.created_at)}
                                                        </span>
                                                    )}
                                                    {memory.created_by_name && projectId && (
                                                        <span className="text-xs" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                                                            • by {memory.created_by_name}
                                                        </span>
                                                    )}
                                                </div>
                                                {editingId === memory.id ? (
                                                    <div>
                                                        <input
                                                            type="text"
                                                            value={editContent}
                                                            onChange={(e) => setEditContent(e.target.value)}
                                                            className="input text-sm w-full"
                                                            autoFocus
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleSaveEdit(memory.id);
                                                                if (e.key === 'Escape') setEditingId(null);
                                                            }}
                                                        />
                                                        <div className="flex gap-2 mt-2">
                                                            <button onClick={() => setEditingId(null)} className="btn-secondary text-xs">
                                                                Cancel
                                                            </button>
                                                            <button onClick={() => handleSaveEdit(memory.id)} className="btn-primary text-xs">
                                                                Save
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                                                        {memory.content}
                                                    </p>
                                                )}
                                            </div>
                                            {editingId !== memory.id && (
                                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                    <button
                                                        onClick={() => handleEdit(memory)}
                                                        className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
                                                        style={{ color: 'var(--text-muted)' }}
                                                        title="Edit"
                                                        data-testid={`memory-edit-${memory.id}`}
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(memory.id)}
                                                        className="p-1.5 rounded-lg transition-colors hover:bg-red-500/20"
                                                        style={{ color: 'var(--text-muted)' }}
                                                        title="Delete"
                                                        data-testid={`memory-delete-${memory.id}`}
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {isPaginated && hasMore && (
                                <div className="flex justify-center pt-4">
                                    <button
                                        onClick={handleLoadMore}
                                        disabled={loadingMore}
                                        className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                                        data-testid="memory-load-more"
                                    >
                                        {loadingMore ? 'Loading…' : `Load more (${total - memories.length} remaining)`}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            {memories.length > 0 && (
                <div className="px-5 py-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
                    <button
                        onClick={handleClearAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-red-500/10"
                        style={{ color: '#f87171' }}
                        data-testid="memory-clear-all"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Clear All
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-white/5"
                        style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
                        data-testid="memory-export"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Export JSON
                    </button>
                </div>
            )}
        </div>
    );
};

export default MemoryPanel;

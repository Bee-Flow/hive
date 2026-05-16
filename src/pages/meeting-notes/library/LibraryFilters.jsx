import React, { useMemo } from 'react';
import { Search, LayoutGrid, List, Tag, User, Users } from 'lucide-react';

const SORT_OPTIONS = [
    { id: 'recent', label: 'Newest first' },
    { id: 'oldest', label: 'Oldest first' },
    { id: 'longest', label: 'Longest first' },
    { id: 'title', label: 'Title (A → Z)' },
];

export default function LibraryFilters({
    query, onQueryChange,
    sort, onSortChange,
    owner, onOwnerChange,
    tag, onTagChange,
    view, onViewChange,
    meetings,
    currentUserId,
}) {
    const tags = useMemo(() => {
        const set = new Set();
        meetings.forEach((m) => (m.tags || []).forEach((t) => set.add(t)));
        return Array.from(set).sort();
    }, [meetings]);

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                    <input
                        value={query}
                        onChange={(e) => onQueryChange(e.target.value)}
                        placeholder="Search meetings…"
                        className="w-full pl-9 pr-3 py-2 rounded-xl text-sm border outline-none"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                    />
                </div>
                <select
                    value={sort}
                    onChange={(e) => onSortChange(e.target.value)}
                    className="px-3 py-2 rounded-xl text-sm border outline-none"
                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                >
                    {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                <div className="hidden sm:flex items-center gap-1 rounded-xl border p-0.5" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
                    <button
                        type="button"
                        onClick={() => onViewChange('grid')}
                        aria-label="Grid view"
                        className="p-1.5 rounded-lg transition-colors"
                        style={{
                            background: view === 'grid' ? 'var(--bg-tertiary)' : 'transparent',
                            color: view === 'grid' ? 'var(--accent-primary)' : 'var(--text-muted)',
                        }}
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => onViewChange('list')}
                        aria-label="List view"
                        className="p-1.5 rounded-lg transition-colors"
                        style={{
                            background: view === 'list' ? 'var(--bg-tertiary)' : 'transparent',
                            color: view === 'list' ? 'var(--accent-primary)' : 'var(--text-muted)',
                        }}
                    >
                        <List className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {(currentUserId || tags.length > 0) && (
                <div className="flex flex-wrap items-center gap-1.5">
                    <FilterChip
                        icon={Users}
                        label="All"
                        active={owner === 'all'}
                        onClick={() => onOwnerChange('all')}
                    />
                    <FilterChip
                        icon={User}
                        label="Mine"
                        active={owner === 'mine'}
                        onClick={() => onOwnerChange('mine')}
                    />
                    <FilterChip
                        icon={Users}
                        label="Shared"
                        active={owner === 'shared'}
                        onClick={() => onOwnerChange('shared')}
                    />
                    {tags.length > 0 && <span className="w-px h-5 mx-1" style={{ background: 'var(--border-default)' }} />}
                    {tags.map((t) => (
                        <FilterChip
                            key={t}
                            icon={Tag}
                            label={t}
                            active={tag === t}
                            onClick={() => onTagChange(tag === t ? null : t)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function FilterChip({ icon: Icon, label, active, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors"
            style={{
                background: active ? 'color-mix(in srgb, var(--accent-primary) 14%, transparent)' : 'transparent',
                borderColor: active ? 'var(--accent-primary)' : 'var(--border-default)',
                color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
            }}
        >
            <Icon className="w-3 h-3" />
            {label}
        </button>
    );
}

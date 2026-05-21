import React, { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import MeetingCard from './MeetingCard';
import MeetingRow from './MeetingRow';
import LibraryFilters from './LibraryFilters';
import LibraryEmptyState from './LibraryEmptyState';

export default function MeetingLibrary({ meetings, loading, currentUserId, selectedId, onSelect, onCapture, defaultView = 'grid' }) {
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState('recent');
    const [owner, setOwner] = useState('all');
    const [tag, setTag] = useState(null);
    const [view, setView] = useState(defaultView);

    const filtered = useMemo(() => {
        let arr = meetings.slice();
        if (query) {
            const q = query.toLowerCase();
            arr = arr.filter((m) =>
                (m.title || '').toLowerCase().includes(q) ||
                (m.fileName || '').toLowerCase().includes(q) ||
                (m.tags || []).some((t) => String(t).toLowerCase().includes(q)) ||
                (m.transcriptSnippet || m.fullText || m.transcript || '').toLowerCase().includes(q),
            );
        }
        if (owner === 'mine') arr = arr.filter((m) => m.isOwner !== false && m.ownerId === currentUserId);
        if (owner === 'shared') arr = arr.filter((m) => m.ownerId && m.ownerId !== currentUserId);
        if (tag) arr = arr.filter((m) => (m.tags || []).includes(tag));
        switch (sort) {
            case 'oldest':
                arr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                break;
            case 'longest':
                arr.sort((a, b) => (b.durationSeconds || 0) - (a.durationSeconds || 0));
                break;
            case 'title':
                arr.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
                break;
            case 'recent':
            default:
                arr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        return arr;
    }, [meetings, query, owner, tag, sort, currentUserId]);

    return (
        <div className="h-full flex flex-col">
            <div className="px-4 sm:px-6 pt-4 pb-3 flex flex-col gap-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <LibraryFilters
                    query={query} onQueryChange={setQuery}
                    sort={sort} onSortChange={setSort}
                    owner={owner} onOwnerChange={setOwner}
                    tag={tag} onTagChange={setTag}
                    view={view} onViewChange={setView}
                    meetings={meetings}
                    currentUserId={currentUserId}
                />
            </div>
            <div className="flex-1 overflow-auto px-4 sm:px-6 py-4">
                {loading && meetings.length === 0 && (
                    <div className="h-full flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
                    </div>
                )}
                {!loading && meetings.length === 0 && (
                    <LibraryEmptyState onCapture={onCapture} />
                )}
                {!loading && meetings.length > 0 && filtered.length === 0 && (
                    <div className="text-center text-sm py-12" style={{ color: 'var(--text-muted)' }}>
                        No meetings match your filters.
                    </div>
                )}
                {filtered.length > 0 && view === 'grid' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                        {filtered.map((m) => (
                            <MeetingCard key={m.id} meeting={m} active={m.id === selectedId} onClick={() => onSelect(m.id)} />
                        ))}
                    </div>
                )}
                {filtered.length > 0 && view === 'list' && (
                    <div className="flex flex-col gap-1.5">
                        {filtered.map((m) => (
                            <MeetingRow key={m.id} meeting={m} active={m.id === selectedId} onClick={() => onSelect(m.id)} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

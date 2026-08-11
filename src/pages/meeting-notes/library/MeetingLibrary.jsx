import React, { useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Sparkles, X } from 'lucide-react';
import MeetingCard from './MeetingCard';
import MeetingRow from './MeetingRow';
import LibraryFilters from './LibraryFilters';
import LibraryEmptyState from './LibraryEmptyState';
import ReportModal from './ReportModal';

const REPORT_MAX_NOTES = 10;

export default function MeetingLibrary({ meetings, loading, error, onRetry, currentUserId, selectedId, onSelect, onCapture, defaultView = 'grid' }) {
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState('recent');
    const [owner, setOwner] = useState('all');
    const [tag, setTag] = useState(null);
    const [view, setView] = useState(defaultView);
    // Multi-meeting AI report: select mode turns card clicks into selection.
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [reportOpen, setReportOpen] = useState(false);

    const toggleSelected = (m) => {
        if (m.status === 'processing' || m.status === 'failed') return;
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(m.id)) next.delete(m.id);
            else if (next.size < REPORT_MAX_NOTES) next.add(m.id);
            return next;
        });
    };
    const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); };
    const clickMeeting = (m) => (selectMode ? toggleSelected(m) : onSelect(m.id));
    const isActive = (m) => (selectMode ? selectedIds.has(m.id) : m.id === selectedId);
    const selectedMeetings = meetings.filter((m) => selectedIds.has(m.id));

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
                {/* Stay mounted while select mode is on: the Cancel control
                    lives here, and deleting notes down to one would otherwise
                    strand the user in a mode with no way out. */}
                {(meetings.length > 1 || selectMode) && (
                    <div className="flex items-center gap-2 text-xs">
                        {!selectMode ? (
                            <button
                                type="button"
                                onClick={() => setSelectMode(true)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-colors hover:bg-[var(--bg-tertiary)]"
                                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                AI report
                            </button>
                        ) : (
                            <>
                                <span style={{ color: 'var(--text-muted)' }}>
                                    {selectedIds.size}/{REPORT_MAX_NOTES} selected — click meetings to select
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setReportOpen(true)}
                                    disabled={selectedIds.size === 0}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white font-medium disabled:opacity-40"
                                    style={{ background: 'var(--accent-primary)' }}
                                >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    Ask AI
                                </button>
                                <button
                                    type="button"
                                    onClick={exitSelectMode}
                                    aria-label="Cancel selection"
                                    className="p-1 rounded-full transition-colors hover:bg-[var(--bg-tertiary)]"
                                    style={{ color: 'var(--text-muted)' }}
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
            <div className="flex-1 overflow-auto px-4 sm:px-6 py-4">
                {loading && meetings.length === 0 && (
                    <div className="h-full flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
                    </div>
                )}
                {/* A failed list load is not an empty library. Without this the
                    only signal of a 500 was "No meetings yet — record your
                    first", which reads as "your recordings are gone". */}
                {!loading && error && meetings.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
                        <AlertTriangle className="w-7 h-7" style={{ color: '#ef4444' }} />
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            Couldn&rsquo;t load your meetings
                        </p>
                        <p className="text-xs max-w-xs" style={{ color: 'var(--text-muted)' }}>
                            {error.message || 'Something went wrong.'}
                        </p>
                        {onRetry && (
                            <button
                                onClick={onRetry}
                                className="mt-1 px-4 py-2 rounded-lg text-sm font-medium"
                                style={{ background: 'var(--accent-primary)', color: '#fff' }}
                            >
                                Try again
                            </button>
                        )}
                    </div>
                )}
                {!loading && !error && meetings.length === 0 && (
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
                            <Selectable key={m.id} meeting={m} selectMode={selectMode}>
                                <MeetingCard meeting={m} active={isActive(m)} onClick={() => clickMeeting(m)} />
                            </Selectable>
                        ))}
                    </div>
                )}
                {filtered.length > 0 && view === 'list' && (
                    <div className="flex flex-col gap-1.5">
                        {filtered.map((m) => (
                            <Selectable key={m.id} meeting={m} selectMode={selectMode}>
                                <MeetingRow meeting={m} active={isActive(m)} onClick={() => clickMeeting(m)} />
                            </Selectable>
                        ))}
                    </div>
                )}
            </div>
            <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} meetings={selectedMeetings} />
        </div>
    );
}

/**
 * In select mode a still-transcribing or failed note has no content to report
 * on, so its click is a no-op. Say so visually rather than letting the card
 * look selectable and swallow the click.
 */
function Selectable({ meeting, selectMode, children }) {
    const unusable = selectMode && (meeting.status === 'processing' || meeting.status === 'failed');
    if (!unusable) return children;
    return (
        <div className="opacity-40 cursor-not-allowed" title="This meeting is not ready yet">
            {children}
        </div>
    );
}

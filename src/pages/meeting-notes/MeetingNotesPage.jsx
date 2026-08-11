import React, { useEffect, useState } from 'react';
import { ArrowLeft, Plus, ArrowLeft as Back } from 'lucide-react';
import IconButton from '../../components/shared/IconButton';
import MeetingLibrary from './library/MeetingLibrary';
import UpcomingMeetings from './library/UpcomingMeetings';
import MeetingDetail from './detail/MeetingDetail';
import DetailEmptyState from './detail/DetailEmptyState';
import { useCapture } from './capture/CaptureContext';
import useTranscriptions from './hooks/useTranscriptions';
import useMediaQuery from './hooks/useMediaQuery';
import useMeetingSources from './hooks/useMeetingSources';
import { useRecorder } from './hooks/RecorderContext';

function MeetingNotesInner({ user, onBack }) {
    const { items, loading, error, reload, removeLocal, patchLocal } = useTranscriptions();
    const [selectedId, setSelectedId] = useState(() => {
        if (typeof window !== 'undefined' && window.__beeflowPendingMeetingId) {
            const id = window.__beeflowPendingMeetingId;
            window.__beeflowPendingMeetingId = null;
            return id;
        }
        return null;
    });
    const { openCapture } = useCapture();
    const { version, consumeLastResult, lastResultId } = useRecorder();
    const isMobile = useMediaQuery('(max-width: 767px)');
    const [leftView, setLeftView] = useState('library'); // 'library' | 'upcoming'

    // "Upcoming" only exists when a supported live-meeting source (Nextcloud
    // Talk or Google Meet) is actually connected — an org on e.g. Outlook +
    // Teams gets no tab that could never show a meeting. Hidden until the
    // probe answers, so unsupported setups never see it flash.
    const meetingSources = useMeetingSources();
    const upcomingAvailable = meetingSources.talk || meetingSources.gmeet;
    useEffect(() => {
        if (!meetingSources.loading && !upcomingAvailable && leftView === 'upcoming') {
            setLeftView('library');
        }
    }, [meetingSources.loading, upcomingAvailable, leftView]);

    // When a capture finishes anywhere in the app, refresh the list and
    // auto-select the new transcription if one is pending. If the upload
    // was transparently re-routed to a cloud provider (e.g. because the
    // local CPU model couldn't handle the recording length), surface a
    // soft notice so the user understands why.
    const [fallbackNotice, setFallbackNotice] = useState(null);

    // Handle results that completed while the page was *not* mounted: the
    // upload finished from another route (e.g. the capture modal closed),
    // and the user lands here with a pending id we still need to claim.
    useEffect(() => {
        if (!lastResultId) return;
        reload().then(() => {
            const { id, meta } = consumeLastResult();
            if (id) setSelectedId(id);
            if (meta?.providerFallback) setFallbackNotice(meta.providerFallback);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastResultId]);

    // Bump-driven refresh: catches subsequent uploads that finish while
    // this page is open even if the consumer above already claimed an id.
    useEffect(() => {
        if (version === 0) return;
        reload().then(() => {
            const { id, meta } = consumeLastResult();
            if (id) setSelectedId(id);
            if (meta?.providerFallback) setFallbackNotice(meta.providerFallback);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [version]);

    // Auto-dismiss the soft provider-fallback notice — it's informational,
    // not actionable, so it shouldn't linger.
    useEffect(() => {
        if (!fallbackNotice) return undefined;
        const t = setTimeout(() => setFallbackNotice(null), 10000);
        return () => clearTimeout(t);
    }, [fallbackNotice]);

    const onDeleted = (id) => {
        removeLocal(id);
        if (selectedId === id) setSelectedId(null);
    };

    const onChanged = (id, patch) => {
        patchLocal(id, patch);
    };

    const detailVisible = selectedId && (!isMobile || !!selectedId);
    const showLibrary = !isMobile || !selectedId;

    return (
        <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            {fallbackNotice && (
                <div
                    className="flex items-center justify-between gap-3 px-4 sm:px-6 py-2 text-xs border-b"
                    style={{ background: 'color-mix(in srgb, var(--accent-primary) 8%, var(--bg-secondary))', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                >
                    <span>
                        Your recording was too long for the on-device model — transcribed via <strong>{fallbackNotice.to}</strong> instead.
                    </span>
                    <button
                        type="button"
                        onClick={() => setFallbackNotice(null)}
                        className="text-xs underline opacity-80 hover:opacity-100"
                    >Dismiss</button>
                </div>
            )}
            <div className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                {onBack && <IconButton ariaLabel="Back" onClick={onBack} size="md"><ArrowLeft /></IconButton>}
                <div className="flex-1 min-w-0">
                    <h1 className="text-lg sm:text-xl font-bold truncate" style={{ color: 'var(--text-primary)' }}>Meeting Notes</h1>
                    <p className="text-[11px] hidden sm:block" style={{ color: 'var(--text-muted)' }}>
                        Record or upload audio — get a transcript, summary and action items.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => openCapture()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: 'var(--accent-primary)' }}
                >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">New transcription</span>
                    <span className="sm:hidden">New</span>
                </button>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {showLibrary && (
                    <div className={`${isMobile ? 'w-full' : 'w-[420px] xl:w-[460px] border-r'} flex flex-col overflow-hidden`} style={{ borderColor: 'var(--border-subtle)' }}>
                        {upcomingAvailable && (
                            <div className="flex items-center gap-1 px-3 pt-3">
                                {[['library', 'Library'], ['upcoming', 'Upcoming']].map(([id, label]) => {
                                    const active = leftView === id;
                                    return (
                                        <button
                                            key={id}
                                            type="button"
                                            onClick={() => setLeftView(id)}
                                            className="px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors"
                                            style={{
                                                background: active ? 'color-mix(in srgb, #0082C9 12%, transparent)' : 'transparent',
                                                color: active ? '#0082C9' : 'var(--text-muted)',
                                            }}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        {leftView === 'library' || !upcomingAvailable ? (
                            <MeetingLibrary
                                meetings={items}
                                loading={loading}
                                error={error}
                                onRetry={reload}
                                currentUserId={user?.id}
                                selectedId={selectedId}
                                onSelect={setSelectedId}
                                onCapture={() => openCapture()}
                                defaultView={isMobile ? 'list' : 'grid'}
                            />
                        ) : (
                            <UpcomingMeetings
                                onOpenNote={(id) => { setLeftView('library'); setSelectedId(id); }}
                            />
                        )}
                    </div>
                )}
                {!isMobile && (
                    <div className="flex-1 min-w-0 overflow-hidden">
                        {selectedId ? (
                            <MeetingDetail
                                id={selectedId}
                                currentUserId={user?.id}
                                currentUserName={user?.displayName || user?.username || ''}
                                onChanged={onChanged}
                                onDeleted={onDeleted}
                                onOpenNote={setSelectedId}
                            />
                        ) : (
                            <DetailEmptyState />
                        )}
                    </div>
                )}
                {isMobile && detailVisible && (
                    <div className="absolute inset-0 z-10 flex flex-col" style={{ background: 'var(--bg-primary)' }}>
                        <button
                            type="button"
                            onClick={() => setSelectedId(null)}
                            className="flex items-center gap-2 px-4 py-2 text-sm border-b"
                            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                        >
                            <Back className="w-4 h-4" />
                            Back to library
                        </button>
                        <MeetingDetail
                            id={selectedId}
                            currentUserId={user?.id}
                            currentUserName={user?.displayName || user?.username || ''}
                            onBack={() => setSelectedId(null)}
                            onChanged={onChanged}
                            onDeleted={onDeleted}
                            onOpenNote={setSelectedId}
                        />
                    </div>
                )}
            </div>

        </div>
    );
}

export default function MeetingNotesPage(props) {
    return <MeetingNotesInner {...props} />;
}

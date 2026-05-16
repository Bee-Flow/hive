import React, { useEffect, useState } from 'react';
import { ArrowLeft, Plus, ArrowLeft as Back } from 'lucide-react';
import IconButton from '../../components/shared/IconButton';
import MeetingLibrary from './library/MeetingLibrary';
import MeetingDetail from './detail/MeetingDetail';
import DetailEmptyState from './detail/DetailEmptyState';
import { useCapture } from './capture/CaptureContext';
import useTranscriptions from './hooks/useTranscriptions';
import useMediaQuery from './hooks/useMediaQuery';
import { useRecorder } from './hooks/RecorderContext';

function MeetingNotesInner({ user, onBack }) {
    const { items, loading, reload, removeLocal, patchLocal } = useTranscriptions();
    const [selectedId, setSelectedId] = useState(() => {
        if (typeof window !== 'undefined' && window.__beeflowPendingMeetingId) {
            const id = window.__beeflowPendingMeetingId;
            window.__beeflowPendingMeetingId = null;
            return id;
        }
        return null;
    });
    const { openCapture } = useCapture();
    const { version, consumeLastResult } = useRecorder();
    const isMobile = useMediaQuery('(max-width: 767px)');

    // When a capture finishes anywhere in the app, refresh the list and
    // auto-select the new transcription if one is pending.
    useEffect(() => {
        if (version === 0) return;
        reload().then(() => {
            const id = consumeLastResult();
            if (id) setSelectedId(id);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [version]);

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
            <div className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <IconButton ariaLabel="Back" onClick={onBack} size="md"><ArrowLeft /></IconButton>
                <div className="flex-1 min-w-0">
                    <h1 className="text-lg sm:text-xl font-bold truncate" style={{ color: 'var(--text-primary)' }}>Meeting Notes</h1>
                    <p className="text-[11px] hidden sm:block" style={{ color: 'var(--text-muted)' }}>
                        Record, upload, or send a bot to your meetings — get a transcript, summary and action items.
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
                        <MeetingLibrary
                            meetings={items}
                            loading={loading}
                            currentUserId={user?.id}
                            selectedId={selectedId}
                            onSelect={setSelectedId}
                            onCapture={() => openCapture()}
                            defaultView={isMobile ? 'list' : 'grid'}
                        />
                    </div>
                )}
                {!isMobile && (
                    <div className="flex-1 min-w-0 overflow-hidden">
                        {selectedId ? (
                            <MeetingDetail
                                id={selectedId}
                                currentUserId={user?.id}
                                onChanged={onChanged}
                                onDeleted={onDeleted}
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
                            onBack={() => setSelectedId(null)}
                            onChanged={onChanged}
                            onDeleted={onDeleted}
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

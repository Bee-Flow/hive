import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import MeetingHeader from './MeetingHeader';
import WaveformPlayer from './WaveformPlayer';
import SummaryActionsLayout from './SummaryActionsLayout';
import AssistantSidebar from './AssistantSidebar';
import PublishMenu from './PublishMenu';
import SpeakerEditor from './SpeakerEditor';
import * as api from '../lib/transcriptionsApi';
import useTranscription from '../hooks/useTranscription';
import { parseTimestampToSeconds } from '../lib/format';
import useMediaQuery from '../hooks/useMediaQuery';

export default function MeetingDetail({ id, currentUserId, onBack, onChanged, onDeleted }) {
    const { data, loading, refresh, setLocal } = useTranscription(id);
    const [chatOpen, setChatOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [speakerEditorOpen, setSpeakerEditorOpen] = useState(false);
    const [regenerateOffer, setRegenerateOffer] = useState(false);
    const playerApi = useRef(null);
    const isMobile = useMediaQuery('(max-width: 767px)');

    // Reset transient pane state whenever the user navigates to a different
    // meeting — otherwise a leftover "regenerate?" banner or open speaker
    // editor would apply to the wrong meeting.
    useEffect(() => {
        setChatOpen(false);
        setSpeakerEditorOpen(false);
        setRegenerateOffer(false);
        setBusy(false);
        setRegenerating(false);
    }, [id]);

    const onPlayerReady = useCallback((apiRef) => { playerApi.current = apiRef; }, []);

    const seek = useCallback((tsOrSec) => {
        const sec = typeof tsOrSec === 'number' ? tsOrSec : parseTimestampToSeconds(tsOrSec);
        playerApi.current?.seek(sec);
    }, []);

    const handleRename = async (title) => {
        if (!data) return;
        setLocal((p) => ({ ...p, title }));
        try {
            await api.patchTranscription(data.id, { title });
            onChanged?.(data.id, { title });
        } catch (_) { refresh(); }
    };

    const handleDelete = async () => {
        if (!data) return;
        if (!window.confirm('Delete this meeting? This cannot be undone.')) return;
        try {
            await api.deleteTranscription(data.id);
            onDeleted?.(data.id);
        } catch (err) {
            alert(`Delete failed: ${err.message}`);
        }
    };

    const handleReprocess = async () => {
        if (!data) return;
        if (!window.confirm('Re-transcribe this recording? The existing transcript, summary and action items will be replaced.')) return;
        setBusy(true);
        try {
            await api.reprocessTranscription(data.id);
            await refresh();
            onChanged?.(data.id, {});
        } catch (err) {
            alert(`Reprocess failed: ${err.message}`);
        } finally {
            setBusy(false);
        }
    };

    const handleExport = async (format) => {
        if (!data) return;
        try {
            const blob = await api.exportTranscription(data.id, format);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(data.title || 'meeting').replace(/[^a-zA-Z0-9 ]/g, '')}.${format}`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            alert(`Export failed: ${err.message}`);
        }
    };

    const handleCopyTranscript = async () => {
        if (!data?.transcript) return;
        try { await navigator.clipboard.writeText(data.transcript); } catch (_) { /* ignore */ }
    };

    const handleAddTag = async (tag) => {
        if (!data) return;
        const next = [...(data.tags || []), tag];
        setLocal((p) => ({ ...p, tags: next }));
        try { await api.patchTranscription(data.id, { tags: next }); onChanged?.(data.id, { tags: next }); } catch (_) { refresh(); }
    };

    const handleRemoveTag = async (tag) => {
        if (!data) return;
        const next = (data.tags || []).filter((t) => t !== tag);
        setLocal((p) => ({ ...p, tags: next }));
        try { await api.patchTranscription(data.id, { tags: next }); onChanged?.(data.id, { tags: next }); } catch (_) { refresh(); }
    };

    const handleToggleActionItem = async (itemId) => {
        if (!data) return;
        const next = (data.actionItems || []).map((ai) => (ai.id === itemId ? { ...ai, done: !ai.done } : ai));
        setLocal((p) => ({ ...p, actionItems: next }));
        try { await api.patchTranscription(data.id, { actionItems: next }); } catch (_) { refresh(); }
    };

    const handleEditActionItem = async (itemId, nextText) => {
        if (!data) return;
        const cleaned = String(nextText || '').trim();
        if (!cleaned) return;
        const next = (data.actionItems || []).map((ai) => (ai.id === itemId ? { ...ai, text: cleaned } : ai));
        setLocal((p) => ({ ...p, actionItems: next }));
        try { await api.patchTranscription(data.id, { actionItems: next }); } catch (_) { refresh(); }
    };

    const handleSpeakerEditSave = async ({ renames, merges }) => {
        if (!data) return null;
        const updated = await api.updateSpeakers(data.id, { renames, merges });
        // Replace the local meeting with the fresh server shape.
        setLocal(() => updated);
        onChanged?.(data.id, updated);
        setRegenerateOffer(true);
        return updated;
    };

    const handleRegenerateSummary = async (template) => {
        if (!data) return;
        setRegenerating(true);
        try {
            const res = await api.regenerateSummary(data.id, template);
            setLocal((p) => ({ ...p, summary: res.summary, actionItems: res.actionItems || p.actionItems }));
        } catch (err) {
            alert(`Regenerate failed: ${err.message}`);
        } finally {
            setRegenerating(false);
        }
    };

    if (loading && !data) {
        return <DetailSkeleton />;
    }

    if (!data) return null;

    const isOwner = data.isOwner !== false;
    const publishMenu = (
        <PublishMenu
            transcriptionId={data.id}
            isPublished={!!data.isPublished}
            sharedGroups={data.sharedGroups || []}
            canManage={isOwner}
            onChange={({ isPublished, sharedGroups }) => {
                setLocal((p) => ({ ...p, isPublished, sharedGroups }));
                onChanged?.(data.id, { isPublished, sharedGroups });
            }}
        />
    );

    return (
        <div className="h-full flex">
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                <MeetingHeader
                    meeting={data}
                    onBack={isMobile ? onBack : undefined}
                    onRename={handleRename}
                    onDelete={handleDelete}
                    onReprocess={handleReprocess}
                    onExport={handleExport}
                    onCopyTranscript={handleCopyTranscript}
                    onEditSpeakers={isOwner ? () => setSpeakerEditorOpen(true) : undefined}
                    onToggleChat={() => setChatOpen((o) => !o)}
                    chatVisible={chatOpen}
                    onAddTag={handleAddTag}
                    onRemoveTag={handleRemoveTag}
                    busy={busy}
                    publishMenuSlot={publishMenu}
                />
                {regenerateOffer && (
                    <div
                        className="mx-4 sm:mx-6 mt-3 flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-xs"
                        style={{ background: 'color-mix(in srgb, var(--accent-primary) 6%, var(--bg-secondary))', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                    >
                        <span>Speakers updated. Regenerate the summary with the new names?</span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={async () => { setRegenerateOffer(false); await handleRegenerateSummary('general'); }}
                                disabled={regenerating}
                                className="px-2.5 py-1 rounded-md text-xs font-semibold text-white disabled:opacity-50"
                                style={{ background: 'var(--accent-primary)' }}
                            >
                                {regenerating ? 'Regenerating…' : 'Regenerate'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setRegenerateOffer(false)}
                                aria-label="Dismiss"
                                className="p-1 rounded-md"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )}
                <div className="px-4 sm:px-6 pt-3">
                    <WaveformPlayer audioSrc={api.audioUrl(data.id)} onReady={onPlayerReady} />
                </div>
                <div className="flex-1 overflow-auto px-4 sm:px-6 py-4">
                    <SummaryActionsLayout
                        meeting={data}
                        onSeek={seek}
                        onToggleActionItem={handleToggleActionItem}
                        onEditActionItem={isOwner ? handleEditActionItem : undefined}
                        onRegenerateSummary={handleRegenerateSummary}
                        regenerating={regenerating}
                    />
                </div>
            </div>
            {chatOpen && !isMobile && (
                <div className="w-[380px] flex-shrink-0">
                    <AssistantSidebar meeting={data} open={chatOpen} onClose={() => setChatOpen(false)} />
                </div>
            )}
            {chatOpen && isMobile && (
                <div className="fixed inset-0 z-40 flex flex-col bg-black/60" onClick={(e) => { if (e.target === e.currentTarget) setChatOpen(false); }}>
                    <div className="mt-auto h-[80vh]">
                        <AssistantSidebar meeting={data} open={chatOpen} onClose={() => setChatOpen(false)} />
                    </div>
                </div>
            )}
            <SpeakerEditor
                open={speakerEditorOpen}
                onClose={() => setSpeakerEditorOpen(false)}
                meeting={data}
                onSave={handleSpeakerEditSave}
            />
        </div>
    );
}

function DetailSkeleton() {
    const bar = (w, h = 12) => (
        <div
            className="rounded-md animate-pulse"
            style={{ background: 'var(--bg-tertiary)', width: w, height: h }}
        />
    );
    return (
        <div className="h-full flex flex-col gap-4 px-4 sm:px-6 py-4" aria-busy="true" aria-label="Loading meeting">
            <div className="flex items-start gap-3">
                <div className="flex-1 flex flex-col gap-2">
                    {bar('60%', 22)}
                    <div className="flex gap-2">
                        {bar(60)} {bar(80)} {bar(50)}
                    </div>
                </div>
                {bar(80, 28)}
            </div>
            {bar('100%', 64)}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                    {bar('90%')} {bar('80%')} {bar('95%')} {bar('70%')} {bar('85%')}
                </div>
                <div className="flex flex-col gap-2">
                    {bar('60%', 14)} {bar('100%')} {bar('100%')} {bar('80%')}
                </div>
            </div>
        </div>
    );
}

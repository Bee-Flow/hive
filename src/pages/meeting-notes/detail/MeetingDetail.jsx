import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import MeetingHeader from './MeetingHeader';
import WaveformPlayer from './WaveformPlayer';
import AudioUnavailable, { AudioNotBackedUp } from './AudioUnavailable';
import SummaryActionsLayout from './SummaryActionsLayout';
import AssistantSidebar from './AssistantSidebar';
import PublishMenu from './PublishMenu';
import SeriesPreviousCard from './SeriesPreviousCard';
import SpeakerEditor from './SpeakerEditor';
import TemplateEditor from './TemplateEditor';
import * as api from '../lib/transcriptionsApi';
import useTranscription from '../hooks/useTranscription';
import { parseTimestampToSeconds } from '../lib/format';
import { buildTimelineMarkers, buildMentionMarkers } from '../lib/timelineMarkers';
import { findNameMentions } from '../lib/insightsData';
import useMediaQuery from '../hooks/useMediaQuery';

export default function MeetingDetail({ id, currentUserId, currentUserName, onBack, onChanged, onDeleted, onOpenNote }) {
    const { data, loading, error, refresh, setLocal } = useTranscription(id);
    const [chatOpen, setChatOpen] = useState(false);
    const [seriesPrevious, setSeriesPrevious] = useState(null);
    const [busy, setBusy] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [speakerEditorOpen, setSpeakerEditorOpen] = useState(false);
    const [regenerateOffer, setRegenerateOffer] = useState(false);
    const [templates, setTemplates] = useState(null);
    const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const playerApi = useRef(null);
    const isMobile = useMediaQuery('(max-width: 767px)');

    // Custom summary templates (built-ins + the caller's user/org/group ones)
    // are user-scoped, not per-meeting — load once and refresh after edits.
    const reloadTemplates = useCallback(() => {
        api.listSummaryTemplates().then(setTemplates).catch(() => {});
    }, []);
    useEffect(() => { reloadTemplates(); }, [reloadTemplates]);

    // Reset transient pane state whenever the user navigates to a different
    // meeting — otherwise a leftover "regenerate?" banner or open speaker
    // editor would apply to the wrong meeting.
    useEffect(() => {
        setChatOpen(false);
        setSpeakerEditorOpen(false);
        setRegenerateOffer(false);
        setTemplateEditorOpen(false);
        setBusy(false);
        setRegenerating(false);
        setSeriesPrevious(null);
    }, [id]);

    // Recurring-series context: the previous note from the same Meet code /
    // Talk room. Only fetched for completed notes that carry a series link.
    useEffect(() => {
        if (!data?.id || data.status === 'processing' || data.status === 'failed') return undefined;
        if (!data.meetMeetingCode && !data.talkRoomToken) return undefined;
        let cancelled = false;
        api.getSeriesPrevious(data.id)
            .then((prev) => { if (!cancelled) setSeriesPrevious(prev); })
            .catch(() => { /* context card is best-effort */ });
        return () => { cancelled = true; };
    }, [data?.id, data?.status, data?.meetMeetingCode, data?.talkRoomToken]);

    const openNewTemplate = useCallback(() => { setEditingTemplate(null); setTemplateEditorOpen(true); }, []);
    const openEditTemplate = useCallback((tpl) => { setEditingTemplate(tpl); setTemplateEditorOpen(true); }, []);

    const onPlayerReady = useCallback((apiRef) => { playerApi.current = apiRef; }, []);

    const seek = useCallback((tsOrSec) => {
        const sec = typeof tsOrSec === 'number' ? tsOrSec : parseTimestampToSeconds(tsOrSec);
        playerApi.current?.seek(sec);
    }, []);

    // Pin every extracted "moment" — action items, decisions, raised questions —
    // onto the scrubber so the recording becomes navigable by what happened,
    // rather than by dragging through 100 minutes of audio.
    const timelineMarkers = useMemo(
        () => buildTimelineMarkers(
            [...(data?.actionItems || []), ...(data?.decisions || []), ...(data?.questions || [])],
            data?.durationSeconds,
        ),
        [data?.actionItems, data?.decisions, data?.questions, data?.durationSeconds],
    );

    // Private "my mentions": where someone else spoke the viewer's name.
    // Derived per viewer at render time — never persisted, never shared.
    const mentionMarkers = useMemo(
        () => buildMentionMarkers(findNameMentions(data?.segments, currentUserName), data?.durationSeconds),
        [data?.segments, currentUserName, data?.durationSeconds],
    );

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

    // No audio and nothing to recover it from. Used to gate Re-transcribe, which
    // otherwise leads straight to a dead end.
    const audioGone = !!data?.audio && data.audio.available === false && !data.audio.recoverable;

    const handleReprocess = async () => {
        if (!data) return;
        if (!window.confirm('Re-transcribe this recording? The existing transcript, summary and action items will be replaced.')) return;
        setBusy(true);
        try {
            await api.reprocessTranscription(data.id);
            await refresh();
            onChanged?.(data.id, {});
        } catch (err) {
            // Branch on the server's stable code, not on prose. 503 means the
            // storage service is briefly unreachable and the recording is fine;
            // 410 means it is genuinely gone — and for a browser recording there
            // is no original file to ask for.
            if (err.code === 'audio_storage_unavailable') {
                alert('Audio storage is temporarily unavailable. Try again in a minute — your recording is safe.');
            } else if (err.code === 'audio_gone_recorded' || err.code === 'audio_gone_uploaded') {
                await refresh();   // surfaces the AudioUnavailable panel
                alert(err.message);
            } else {
                alert(`Reprocess failed: ${err.message}`);
            }
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
            // NFKD + combining-mark strip keeps accented letters as their base
            // ("cliëntenraad" → "clientenraad") instead of deleting them.
            const safeTitle = (data.title || 'meeting')
                .normalize('NFKD').replace(/[̀-ͯ]/g, '')
                .replace(/[^\w -]/g, '').trim() || 'meeting';
            a.download = `${safeTitle}.${format}`;
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

    // Re-run AI naming on the stored transcript (no re-transcription). Lets a
    // note stuck on "Guest-1/2/3" be mapped to real names; an attendee list
    // makes it reliable.
    const handleReidentifySpeakers = async (attendees) => {
        if (!data) return null;
        const updated = await api.reidentifySpeakers(data.id, attendees);
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
            setLocal((p) => ({
                ...p,
                summary: res.summary,
                actionItems: res.actionItems || p.actionItems,
                // Regenerate is also the upgrade path for meetings recorded
                // before chapters / decisions / questions existed.
                decisions: res.decisions || p.decisions,
                questions: res.questions || p.questions,
                chapters: res.chapters || p.chapters,
            }));
        } catch (err) {
            alert(`Regenerate failed: ${err.message}`);
        } finally {
            setRegenerating(false);
        }
    };

    if (loading && !data) {
        return <DetailSkeleton />;
    }

    // A failed load must SAY so. `error` was returned by the hook and read by
    // nobody, so a 5xx on this note left the previously-opened note rendered
    // while the library highlighted this one — and every action here (rename,
    // delete, action items) targeted the stale note. Deleting from that state
    // destroyed a different meeting.
    if (error && !data) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <AlertTriangle className="w-8 h-8" style={{ color: '#ef4444' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Couldn&rsquo;t load this meeting
                </p>
                <p className="text-xs max-w-sm" style={{ color: 'var(--text-muted)' }}>
                    {error.status === 404
                        ? 'It may have been deleted, or you no longer have access to it.'
                        : (error.message || 'Something went wrong.')}
                </p>
                {error.status !== 404 && (
                    <button
                        onClick={refresh}
                        className="mt-1 px-4 py-2 rounded-lg text-sm font-medium"
                        style={{ background: 'var(--accent-primary)', color: '#fff' }}
                    >
                        Try again
                    </button>
                )}
            </div>
        );
    }

    if (!data) return null;

    const isOwner = data.isOwner !== false;

    // Async pipeline: a note is created in 'processing' and filled in when the
    // background transcription+diarization finishes. Show a status placeholder
    // instead of an empty player until it's 'completed' (the hook polls).
    if (data.status === 'processing' || data.status === 'failed') {
        const failed = data.status === 'failed';
        return (
            <div className="h-full flex flex-col overflow-hidden">
                <MeetingHeader
                    meeting={data}
                    onBack={isMobile ? onBack : undefined}
                    onRename={handleRename}
                    onDelete={handleDelete}
                    onReprocess={failed ? handleReprocess : undefined}
                    audioGone={audioGone}
                />
                <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-3">
                    {failed ? (
                        <>
                            <AlertTriangle className="w-10 h-10" style={{ color: '#ef4444' }} />
                            <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Transcription failed</p>
                            {data.summary ? (
                                <p className="text-sm max-w-md" style={{ color: '#ef4444' }}>{data.summary}</p>
                            ) : null}
                            <p className="text-sm max-w-md" style={{ color: 'var(--text-muted)' }}>
                                {audioGone
                                    ? 'The audio is no longer available, so this note cannot be retried.'
                                    : 'The recording is saved, so you can retry it.'}
                            </p>
                            {isOwner && (
                                <button
                                    onClick={handleReprocess}
                                    // Without this a double-click fired two runs
                                    // against the same note, doubling the provider
                                    // bill and letting the loser's error overwrite
                                    // the winner's finished note.
                                    disabled={busy || audioGone}
                                    className="mt-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                    style={{ background: 'var(--accent-primary)', color: '#fff' }}
                                >
                                    {busy ? 'Starting…' : 'Retry transcription'}
                                </button>
                            )}
                        </>
                    ) : (
                        <>
                            <Loader2 className="w-10 h-10 animate-spin" style={{ color: 'var(--accent-primary)' }} />
                            <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Transcribing…</p>
                            <p className="text-sm max-w-md" style={{ color: 'var(--text-muted)' }}>
                                This runs in the background — you can close this and come back. Long recordings with speaker
                                labels can take a while on the local diarizer; the note updates automatically when it's ready.
                            </p>
                        </>
                    )}
                </div>
            </div>
        );
    }

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
                    audioGone={audioGone}
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
                    {/* `audio.available === false` is the state that used to
                        render a dead player and only reveal itself when the
                        user pressed Re-transcribe. Say it up front instead. */}
                    {data.audio && data.audio.available === false ? (
                        <AudioUnavailable audio={data.audio} onRetry={refresh} />
                    ) : (
                        <>
                            <WaveformPlayer
                                audioSrc={api.audioUrl(data.id)}
                                onReady={onPlayerReady}
                                markers={timelineMarkers}
                                mentionMarkers={mentionMarkers}
                                segments={data.segments || []}
                                speakers={data.speakers || []}
                                chapters={data.chapters || []}
                                durationSeconds={data.durationSeconds || 0}
                            />
                            {data.audio?.localOnly && data.audio?.storageConfigured && (
                                <div className="mt-2">
                                    <AudioNotBackedUp downloadUrl={api.audioDownloadUrl(data.id)} />
                                </div>
                            )}
                        </>
                    )}
                </div>
                <div className="flex-1 overflow-auto px-4 sm:px-6 py-4">
                    {seriesPrevious && (
                        <div className="mb-4">
                            <SeriesPreviousCard previous={seriesPrevious} onOpenNote={onOpenNote} />
                        </div>
                    )}
                    <SummaryActionsLayout
                        meeting={data}
                        onSeek={seek}
                        onEditSpeakers={isOwner ? () => setSpeakerEditorOpen(true) : undefined}
                        onToggleActionItem={handleToggleActionItem}
                        onEditActionItem={isOwner ? handleEditActionItem : undefined}
                        onRegenerateSummary={isOwner ? handleRegenerateSummary : undefined}
                        regenerating={regenerating}
                        templates={templates}
                        onNewTemplate={isOwner ? openNewTemplate : undefined}
                        onEditTemplate={isOwner ? openEditTemplate : undefined}
                        viewerName={currentUserName}
                        perPersonInsights={data.perPersonInsights !== false}
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
                onAutoDetect={handleReidentifySpeakers}
            />
            <TemplateEditor
                open={templateEditorOpen}
                onClose={() => setTemplateEditorOpen(false)}
                initial={editingTemplate}
                builtins={templates?.builtins || []}
                canManageOrg={!!templates?.canManageOrg}
                onSaved={reloadTemplates}
                onDeleted={reloadTemplates}
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

import React, { useCallback, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import MeetingHeader from './MeetingHeader';
import WaveformPlayer from './WaveformPlayer';
import SummaryActionsLayout from './SummaryActionsLayout';
import AssistantSidebar from './AssistantSidebar';
import ShareDialog from './ShareDialog';
import * as api from '../lib/transcriptionsApi';
import useTranscription from '../hooks/useTranscription';
import { parseTimestampToSeconds } from '../lib/format';
import useMediaQuery from '../hooks/useMediaQuery';

export default function MeetingDetail({ id, currentUserId, onBack, onChanged, onDeleted }) {
    const { data, loading, refresh, setLocal } = useTranscription(id);
    const [chatOpen, setChatOpen] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const playerApi = useRef(null);
    const isMobile = useMediaQuery('(max-width: 767px)');

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
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
        );
    }

    if (!data) return null;

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
                    onShareOpen={() => setShareOpen(true)}
                    onCopyTranscript={handleCopyTranscript}
                    onToggleChat={() => setChatOpen((o) => !o)}
                    chatVisible={chatOpen}
                    onAddTag={handleAddTag}
                    onRemoveTag={handleRemoveTag}
                    busy={busy}
                />
                <div className="px-4 sm:px-6 pt-3">
                    <WaveformPlayer audioSrc={api.audioUrl(data.id)} onReady={onPlayerReady} />
                </div>
                <div className="flex-1 overflow-auto px-4 sm:px-6 py-4">
                    <SummaryActionsLayout
                        meeting={data}
                        onSeek={seek}
                        onToggleActionItem={handleToggleActionItem}
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
            <ShareDialog
                open={shareOpen}
                onClose={() => setShareOpen(false)}
                transcriptionId={data.id}
                currentUserId={currentUserId}
                sharedWith={data.sharedWith || []}
                onShareChange={(sharedWith) => setLocal((p) => ({ ...p, sharedWith }))}
            />
        </div>
    );
}

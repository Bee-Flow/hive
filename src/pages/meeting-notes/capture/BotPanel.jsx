import React, { useEffect, useMemo, useState } from 'react';
import { Bot, Send, Square, Loader2, AlertCircle } from 'lucide-react';
import { detectMeetingPlatform, platformBadge } from '../../../utils/meetingPlatformDetection';
import CaptureControls from './CaptureControls';
import useMeetBotSessions from '../hooks/useMeetBotSessions';
import { useRecorder } from '../hooks/RecorderContext';
import * as api from '../lib/transcriptionsApi';
import { formatDuration } from '../lib/format';

const STATUS_COLORS = {
    pending: { bg: 'rgba(245,158,11,0.12)', fg: '#f59e0b' },
    joining: { bg: 'rgba(245,158,11,0.12)', fg: '#f59e0b' },
    recording: { bg: 'rgba(239,68,68,0.12)', fg: '#ef4444' },
    processing: { bg: 'rgba(99,102,241,0.12)', fg: '#6b7280' },
    completed: { bg: 'rgba(16,185,129,0.12)', fg: '#10b981' },
    failed: { bg: 'rgba(239,68,68,0.12)', fg: '#ef4444' },
};

export default function BotPanel({ serverDefault, localEnabled, onComplete }) {
    const [meetLink, setMeetLink] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);
    const [platforms, setPlatforms] = useState([]);
    const { sessions, stop } = useMeetBotSessions();
    const { settings } = useRecorder();

    useEffect(() => {
        api.listBotPlatforms().then(setPlatforms).catch(() => {});
    }, []);

    const detected = useMemo(() => detectMeetingPlatform(meetLink), [meetLink]);
    const platformOk = useMemo(() => {
        if (!detected) return null;
        const match = platforms.find((p) => p.platform === detected.platform);
        return match?.configured ?? null;
    }, [detected, platforms]);

    const submit = async () => {
        if (!meetLink.trim() || sending) return;
        setSending(true);
        setError(null);
        try {
            await api.joinBotToMeeting({
                meetLink: meetLink.trim(),
                title: `Meeting ${new Date().toLocaleString()}`,
                language: settings.language,
            });
            setMeetLink('');
            onComplete?.();
        } catch (err) {
            setError(err.message);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <CaptureControls serverDefault={serverDefault} localEnabled={localEnabled} />

            <div className="flex gap-2">
                <div className="relative flex-1">
                    <input
                        value={meetLink}
                        onChange={(e) => setMeetLink(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                        placeholder="Paste a Google Meet / Teams / Zoom / Nextcloud link…"
                        className="w-full pl-3 pr-28 py-2.5 rounded-xl text-sm border outline-none"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                    />
                    {detected && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] px-2 py-0.5 rounded-full" style={{
                            background: platformOk === false ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                            color: platformOk === false ? '#ef4444' : '#10b981',
                        }}>
                            {platformBadge(detected) || detected.platform}
                        </span>
                    )}
                </div>
                <button
                    type="button"
                    onClick={submit}
                    disabled={!meetLink.trim() || sending}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: 'var(--accent-primary)' }}
                >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Send bot
                </button>
            </div>

            {detected && platformOk === false && (
                <div className="flex items-center gap-2 text-xs" style={{ color: '#ef4444' }}>
                    <AlertCircle className="w-3.5 h-3.5" />
                    {detected.platform} requires admin to configure bot credentials.
                </div>
            )}
            {error && <div className="text-xs text-rose-500">{error}</div>}

            <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
                    Live sessions
                </div>
                {sessions.length === 0 && (
                    <div className="text-xs px-3 py-4 rounded-xl text-center border border-dashed" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-default)' }}>
                        No bot sessions yet. Send the bot to a meeting above.
                    </div>
                )}
                {sessions.length > 0 && (
                    <div className="flex flex-col gap-2">
                        {sessions.map((s) => {
                            const palette = STATUS_COLORS[s.status] || STATUS_COLORS.processing;
                            const active = ['pending', 'joining', 'recording', 'processing'].includes(s.status);
                            const elapsed = s.startedAt ? Math.max(0, Math.floor((Date.now() - new Date(s.startedAt).getTime()) / 1000)) : 0;
                            return (
                                <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                                    <Bot className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{s.title || s.meetLink}</div>
                                        <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{s.platform} · {formatDuration(elapsed)}</div>
                                    </div>
                                    <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: palette.bg, color: palette.fg }}>
                                        {s.status}
                                    </span>
                                    {active && (
                                        <button
                                            type="button"
                                            onClick={() => stop(s.id)}
                                            className="p-1.5 rounded-lg hover:bg-rose-500/10"
                                            aria-label="Stop bot session"
                                        >
                                            <Square className="w-3.5 h-3.5" style={{ color: '#ef4444' }} fill="currentColor" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

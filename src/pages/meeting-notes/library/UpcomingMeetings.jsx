import React, { useEffect, useState } from 'react';
import { Calendar, Loader2, RefreshCw, Video, Mic, Dot, FileText, AlertCircle } from 'lucide-react';
import { listTalkMeetings, setMeetingRecord, listGoogleMeetMeetings, setGoogleMeetMeetingRecord } from '../lib/transcriptionsApi';
import { openGoogleOAuthPopup } from '../../../lib/googleOAuthPopup';
import { API_BASE, authFetch } from '../../../utils/helpers';

const NC_BLUE = '#0082C9';
const MEET_GREEN = '#00832D';

const Toggle = ({ on, onClick, disabled, color = NC_BLUE }) => (
    <button
        type="button" onClick={onClick} disabled={disabled} aria-pressed={on}
        className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
        style={{ background: on ? color : 'var(--border-default)', opacity: disabled ? 0.45 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
        <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
            style={{ transform: on ? 'translateX(20px)' : 'translateX(0)' }} />
    </button>
);

function fmtWhen(start, end) {
    if (!start) return '';
    const s = new Date(start);
    if (isNaN(s.getTime())) return '';
    const day = s.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    const t = s.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    let range = t;
    if (end) {
        const e = new Date(end);
        if (!isNaN(e.getTime())) range += `–${e.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
    }
    return `${day} · ${range}`;
}

function StatusChip({ status, onOpenNote }) {
    const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium';
    switch (status) {
        case 'recording_now':
            return <span className={base} style={{ background: `color-mix(in srgb, ${NC_BLUE} 14%, transparent)`, color: NC_BLUE }}><Dot className="w-3.5 h-3.5 animate-pulse" /> Recording</span>;
        case 'will_record':
            return <span className={base} style={{ background: `color-mix(in srgb, ${NC_BLUE} 12%, transparent)`, color: NC_BLUE }}>Will record</span>;
        case 'recorded':
            return <button type="button" onClick={onOpenNote} className={base} style={{ background: 'color-mix(in srgb, #059669 12%, transparent)', color: '#059669' }}><FileText className="w-3 h-3" /> Note created</button>;
        case 'not_moderator':
            return <span className={base} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>Not a moderator</span>;
        case 'not_organizer':
            return <span className={base} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>Organizer only</span>;
        case 'manual_record':
            return <span className={base} title="Start the recording in Google Meet — it will be imported afterwards." style={{ background: 'color-mix(in srgb, #f59e0b 12%, transparent)', color: '#f59e0b' }}>Record in Meet</span>;
        default:
            return <span className={base} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>Upcoming</span>;
    }
}

function ProviderChip({ provider }) {
    const color = provider === 'gmeet' ? MEET_GREEN : NC_BLUE;
    return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0"
            style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
            {provider === 'gmeet' ? 'Meet' : 'Talk'}
        </span>
    );
}

// Chip status for a Meet row, derived locally so the optimistic exclusion
// toggle updates the chip without a round-trip (mirrors the server's status
// logic, plus the host-controls-recording refinement).
function gmeetChipStatus(m, autoImport) {
    if (m.status === 'not_organizer') return 'not_organizer';
    if (m.importedNoteId || m.status === 'imported') return 'recorded';
    if (m.excluded || !autoImport) return 'upcoming';
    return m.recordingControlledByHost ? 'manual_record' : 'will_record';
}

function UpcomingMeetingRow({ provider, icon: Icon, title, start, end, status, noteId, onOpenNote, record, toggleDisabled, onToggle, error }) {
    const color = provider === 'gmeet' ? MEET_GREEN : NC_BLUE;
    return (
        <div className="rounded-xl border mb-1.5" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
                    <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{title}</span>
                        <ProviderChip provider={provider} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtWhen(start, end)}</span>
                        <StatusChip status={status} onOpenNote={() => noteId && onOpenNote?.(noteId)} />
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <Toggle on={record} disabled={toggleDisabled} onClick={onToggle} color={color} />
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{record ? 'Record' : 'Skip'}</span>
                </div>
            </div>
            {error && (
                <div className="px-3 pb-2 text-[11px] truncate" style={{ color: '#ef4444' }}>{error}</div>
            )}
        </div>
    );
}

export default function UpcomingMeetings({ onOpenNote }) {
    const [talk, setTalk] = useState({ loading: true, error: null, data: null }); // { recordingEnabled, recordingMode, meetings }
    const [gmeet, setGmeet] = useState({ loading: true, error: null, data: null }); // { connection, autoImport, meetings }
    const [busyKey, setBusyKey] = useState(null);
    const [gmeetRowErrors, setGmeetRowErrors] = useState({}); // eventId → message
    const [reconnecting, setReconnecting] = useState(false);

    const loadTalk = async () => {
        setTalk(s => ({ ...s, loading: true, error: null }));
        try { setTalk({ loading: false, error: null, data: await listTalkMeetings() }); }
        catch (err) { setTalk(s => ({ ...s, loading: false, error: err })); }
    };
    const loadGmeet = async () => {
        setGmeet(s => ({ ...s, loading: true, error: null }));
        try { setGmeet({ loading: false, error: null, data: await listGoogleMeetMeetings() }); }
        catch (err) { setGmeet(s => ({ ...s, loading: false, error: err })); }
    };
    const load = () => { setGmeetRowErrors({}); loadTalk(); loadGmeet(); };
    useEffect(() => { load(); }, []);

    const loading = talk.loading || gmeet.loading;
    const recordingEnabled = !!talk.data?.recordingEnabled;
    const recordingMode = talk.data?.recordingMode || 'audio';
    const connection = gmeet.data?.connection || null;
    const meetScopesGranted = connection?.meetScopesGranted === true;
    const autoImport = !!gmeet.data?.autoImport;

    const talkMeetings = (!talk.loading && !talk.error && talk.data?.meetings) || [];
    const gmeetMeetings = (!gmeet.loading && !gmeet.error && gmeet.data?.meetings) || [];
    const rows = [
        ...talkMeetings.map(m => ({ provider: 'talk', key: `talk:${m.uid || ''}:${m.talkToken}`, start: m.start, m })),
        ...gmeetMeetings.map(m => ({ provider: 'gmeet', key: `gmeet:${m.eventId}`, start: m.start, m })),
    ].sort((a, b) => new Date(a.start || 0).getTime() - new Date(b.start || 0).getTime());

    const toggleTalk = async (m) => {
        const nextRecord = m.excluded; // excluded → turning ON; else turning OFF
        setBusyKey(`talk:${m.talkToken}`);
        // optimistic
        setTalk(s => s.data ? { ...s, data: { ...s.data, meetings: s.data.meetings.map(x => x.talkToken === m.talkToken ? { ...x, excluded: !nextRecord } : x) } } : s);
        try {
            await setMeetingRecord(m.talkToken, nextRecord, m.uid);
        } catch (_) {
            // revert + reload to be safe
            await loadTalk();
        } finally {
            setBusyKey(null);
        }
    };

    const toggleGmeet = async (m) => {
        const nextRecord = m.excluded;
        setBusyKey(`gmeet:${m.eventId}`);
        setGmeetRowErrors(prev => {
            if (!(m.eventId in prev)) return prev;
            const next = { ...prev }; delete next[m.eventId]; return next;
        });
        // optimistic
        setGmeet(s => s.data ? { ...s, data: { ...s.data, meetings: s.data.meetings.map(x => x.eventId === m.eventId ? { ...x, excluded: !nextRecord } : x) } } : s);
        try {
            await setGoogleMeetMeetingRecord(m.eventId, nextRecord, { meetingCode: m.meetingCode });
        } catch (err) {
            if (err?.code) setGmeetRowErrors(prev => ({ ...prev, [m.eventId]: err.message || "Couldn't update this meeting." }));
            // revert by reloading the Meet slice
            await loadGmeet();
        } finally {
            setBusyKey(null);
        }
    };

    const reconnectGoogle = async () => {
        setReconnecting(true);
        try {
            await openGoogleOAuthPopup({ authFetch, apiBase: API_BASE });
            await loadGmeet();
        } catch (_) {
            // popup blocked / auth-url failed — the banner stays, user can retry
        } finally {
            setReconnecting(false);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Your upcoming meetings — toggle which ones to auto-record.
                </span>
                <button
                    type="button" onClick={load} disabled={loading}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-50"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
            </div>

            {!talk.loading && !talk.error && talk.data && !recordingEnabled && (
                <div className="mx-4 mb-2 flex items-start gap-2 px-3 py-2.5 rounded-xl border text-xs" style={{ background: 'color-mix(in srgb, #f59e0b 8%, var(--bg-secondary))', borderColor: '#f59e0b', color: 'var(--text-primary)' }}>
                    <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#f59e0b' }} />
                    <span>The Nextcloud Talk recording backend isn't configured, so auto-record is unavailable. You can still import finished recordings.</span>
                </div>
            )}

            {!gmeet.loading && !gmeet.error && connection?.googleConnected === false && (
                <div className="mx-4 mb-2 flex items-start gap-2 px-3 py-2.5 rounded-xl border text-xs" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                    <Video className="w-4 h-4 flex-shrink-0" style={{ color: MEET_GREEN }} />
                    <span>
                        Connect Google Workspace to see your Meet meetings here —{' '}
                        <a href="/app/settings/integrations" className="underline" style={{ color: 'var(--accent-primary)' }}>Settings → Integrations</a>.
                    </span>
                </div>
            )}

            {!gmeet.loading && !gmeet.error && connection && connection.googleConnected !== false && !meetScopesGranted && (
                <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs" style={{ background: 'color-mix(in srgb, #f59e0b 8%, var(--bg-secondary))', borderColor: '#f59e0b', color: 'var(--text-primary)' }}>
                    <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#f59e0b' }} />
                    <span className="flex-1">Your Google connection doesn't include Meet permissions yet — reconnect to enable auto-import.</span>
                    <button
                        type="button" onClick={reconnectGoogle} disabled={reconnecting}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium border disabled:opacity-50 flex-shrink-0"
                        style={{ borderColor: '#f59e0b', color: '#f59e0b' }}
                    >
                        {reconnecting ? 'Reconnecting…' : 'Reconnect'}
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto px-3 pb-4">
                {loading && (
                    <div className="flex items-center gap-3 px-4 py-6 justify-center">
                        <Loader2 className="w-4 h-4 animate-spin" style={{ color: NC_BLUE }} />
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading meetings…</span>
                    </div>
                )}

                {!talk.loading && talk.error && (
                    <div className="flex flex-col gap-1 px-3 py-3 rounded-xl border text-xs mb-1.5" style={{ background: 'color-mix(in srgb, #ef4444 8%, var(--bg-secondary))', borderColor: '#ef4444', color: 'var(--text-primary)' }}>
                        <div className="font-semibold">Couldn't load Nextcloud Talk meetings</div>
                        <div style={{ color: 'var(--text-secondary)' }}>{talk.error.message}</div>
                    </div>
                )}

                {!gmeet.loading && gmeet.error && (
                    <div className="flex flex-col gap-1 px-3 py-3 rounded-xl border text-xs mb-1.5" style={{ background: 'color-mix(in srgb, #ef4444 8%, var(--bg-secondary))', borderColor: '#ef4444', color: 'var(--text-primary)' }}>
                        <div className="font-semibold">Couldn't load Google Meet meetings</div>
                        <div style={{ color: 'var(--text-secondary)' }}>{gmeet.error.message}</div>
                    </div>
                )}

                {!loading && !talk.error && !gmeet.error && rows.length === 0 && (
                    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `color-mix(in srgb, ${NC_BLUE} 12%, transparent)`, color: NC_BLUE }}>
                            <Calendar className="w-6 h-6" />
                        </div>
                        <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No upcoming meetings</div>
                        <div className="text-xs max-w-xs" style={{ color: 'var(--text-muted)' }}>
                            Meetings in your calendar with a Nextcloud Talk conversation or a Google Meet link show up here.
                        </div>
                    </div>
                )}

                {rows.map(({ provider, key, m }) => provider === 'talk' ? (
                    <UpcomingMeetingRow
                        key={key}
                        provider="talk"
                        icon={recordingMode === 'video' ? Video : Mic}
                        title={m.title}
                        start={m.start} end={m.end}
                        status={m.status}
                        noteId={m.recordedNoteId}
                        onOpenNote={onOpenNote}
                        record={!m.excluded}
                        toggleDisabled={!recordingEnabled || m.isModerator === false || busyKey === `talk:${m.talkToken}`}
                        onToggle={() => toggleTalk(m)}
                    />
                ) : (
                    <UpcomingMeetingRow
                        key={key}
                        provider="gmeet"
                        icon={Video}
                        title={m.title}
                        start={m.start} end={m.end}
                        status={gmeetChipStatus(m, autoImport)}
                        noteId={m.importedNoteId}
                        onOpenNote={onOpenNote}
                        record={!m.excluded}
                        toggleDisabled={!meetScopesGranted || busyKey === `gmeet:${m.eventId}`}
                        onToggle={() => toggleGmeet(m)}
                        error={gmeetRowErrors[m.eventId]}
                    />
                ))}
            </div>
        </div>
    );
}

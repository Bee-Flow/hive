import React, { useEffect, useState } from 'react';
import { Calendar, Loader2, RefreshCw, Video, Mic, Dot, FileText, AlertCircle } from 'lucide-react';
import { listTalkMeetings, setMeetingRecord } from '../lib/transcriptionsApi';

const NC_BLUE = '#0082C9';

const Toggle = ({ on, onClick, disabled }) => (
    <button
        type="button" onClick={onClick} disabled={disabled} aria-pressed={on}
        className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
        style={{ background: on ? NC_BLUE : 'var(--border-default)', opacity: disabled ? 0.45 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
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
        default:
            return <span className={base} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>Upcoming</span>;
    }
}

export default function UpcomingMeetings({ onOpenNote }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null); // { recordingEnabled, recordingMode, meetings }
    const [busyToken, setBusyToken] = useState(null);

    const load = async () => {
        setLoading(true); setError(null);
        try { setData(await listTalkMeetings()); }
        catch (err) { setError(err); }
        finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []);

    const meetings = data?.meetings || [];
    const recordingEnabled = !!data?.recordingEnabled;
    const recordingMode = data?.recordingMode || 'audio';

    const toggleRecord = async (m) => {
        const nextRecord = m.excluded; // excluded → turning ON; else turning OFF
        setBusyToken(m.talkToken);
        // optimistic
        setData(d => ({ ...d, meetings: d.meetings.map(x => x.talkToken === m.talkToken ? { ...x, excluded: !nextRecord } : x) }));
        try {
            await setMeetingRecord(m.talkToken, nextRecord, m.uid);
        } catch (_) {
            // revert + reload to be safe
            await load();
        } finally {
            setBusyToken(null);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Your Nextcloud Talk meetings — toggle which ones to auto-record.
                </span>
                <button
                    type="button" onClick={load} disabled={loading}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-50"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
            </div>

            {!loading && !error && !recordingEnabled && (
                <div className="mx-4 mb-2 flex items-start gap-2 px-3 py-2.5 rounded-xl border text-xs" style={{ background: 'color-mix(in srgb, #f59e0b 8%, var(--bg-secondary))', borderColor: '#f59e0b', color: 'var(--text-primary)' }}>
                    <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#f59e0b' }} />
                    <span>The Nextcloud Talk recording backend isn't configured, so auto-record is unavailable. You can still import finished recordings.</span>
                </div>
            )}

            <div className="flex-1 overflow-y-auto px-3 pb-4">
                {loading && (
                    <div className="flex items-center gap-3 px-4 py-6 justify-center">
                        <Loader2 className="w-4 h-4 animate-spin" style={{ color: NC_BLUE }} />
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading meetings…</span>
                    </div>
                )}

                {!loading && error && (
                    <div className="flex flex-col gap-2 px-3 py-3 rounded-xl border text-xs" style={{ background: 'color-mix(in srgb, #ef4444 8%, var(--bg-secondary))', borderColor: '#ef4444', color: 'var(--text-primary)' }}>
                        <div className="font-semibold">Couldn't load meetings</div>
                        <div style={{ color: 'var(--text-secondary)' }}>{error.message}</div>
                    </div>
                )}

                {!loading && !error && meetings.length === 0 && (
                    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `color-mix(in srgb, ${NC_BLUE} 12%, transparent)`, color: NC_BLUE }}>
                            <Calendar className="w-6 h-6" />
                        </div>
                        <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No upcoming Talk meetings</div>
                        <div className="text-xs max-w-xs" style={{ color: 'var(--text-muted)' }}>
                            Meetings in your Nextcloud calendar that have a Talk conversation show up here.
                        </div>
                    </div>
                )}

                {!loading && !error && meetings.map((m) => {
                    const record = !m.excluded;
                    const toggleDisabled = !recordingEnabled || m.isModerator === false || busyToken === m.talkToken;
                    const ModeIcon = recordingMode === 'video' ? Video : Mic;
                    return (
                        <div key={`${m.uid || ''}:${m.talkToken}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border mb-1.5" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `color-mix(in srgb, ${NC_BLUE} 12%, transparent)`, color: NC_BLUE }}>
                                <ModeIcon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{m.title}</div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtWhen(m.start, m.end)}</span>
                                    <StatusChip status={m.status} onOpenNote={() => m.recordedNoteId && onOpenNote?.(m.recordedNoteId)} />
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <Toggle on={record} disabled={toggleDisabled} onClick={() => toggleRecord(m)} />
                                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{record ? 'Record' : 'Skip'}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

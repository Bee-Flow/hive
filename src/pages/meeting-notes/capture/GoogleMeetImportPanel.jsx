import React, { useEffect, useState } from 'react';
import { Video, Loader2, RefreshCw, Download, Check } from 'lucide-react';
import CaptureControls from './CaptureControls';
import { useRecorder } from '../hooks/RecorderContext';
import useGoogleMeetConnected from '../hooks/useGoogleMeetConnected';
import { listGoogleMeetRecordings } from '../lib/transcriptionsApi';
import { openGoogleOAuthPopup } from '../../../lib/googleOAuthPopup';
import { API_BASE, authFetch } from '../../../utils/helpers';

const MEET_GREEN = '#00832D';

function fmtDate(s) {
    if (!s) return '';
    const d = new Date(s);
    return isNaN(d.getTime()) ? '' : d.toLocaleString();
}

function fmtDuration(start, end) {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (isNaN(s) || isNaN(e) || e <= s) return '';
    const mins = Math.round((e - s) / 60000);
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
}

export default function GoogleMeetImportPanel({ onComplete }) {
    const { importFromGoogleMeet, settings, uploading, uploadStage, uploadError, clearError } = useRecorder();
    const { needsReconsent } = useGoogleMeetConnected(true);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [items, setItems] = useState([]);
    const [busyKey, setBusyKey] = useState(null);
    const [reauthorized, setReauthorized] = useState(false);
    const [reauthBusy, setReauthBusy] = useState(false);
    const [reauthError, setReauthError] = useState(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await listGoogleMeetRecordings();
            setItems(Array.isArray(data?.items) ? data.items : []);
        } catch (err) {
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleImport = async (item) => {
        clearError();
        setBusyKey(item.eventId || item.meetingCode);
        try {
            const outcome = await importFromGoogleMeet(item, { language: settings.language, contextTerms: settings.contextTerms });
            if (outcome?.ok) onComplete?.();
        } finally {
            setBusyKey(null);
        }
    };

    const handleReauthorize = async () => {
        setReauthBusy(true);
        setReauthError(null);
        try {
            const result = await openGoogleOAuthPopup({ authFetch, apiBase: API_BASE });
            if (result?.success) {
                setReauthorized(true);
                load();
            }
        } catch (err) {
            setReauthError(err);
        } finally {
            setReauthBusy(false);
        }
    };

    // Connected before the Meet scopes existed — every recordings request
    // would fail, so show the re-consent explainer instead of the list until
    // the popup succeeds.
    if (needsReconsent && !reauthorized) {
        return (
            <div className="flex flex-col items-center gap-3 px-4 py-10 rounded-xl border text-center" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `color-mix(in srgb, ${MEET_GREEN} 12%, transparent)`, color: MEET_GREEN }}>
                    <Video className="w-6 h-6" />
                </div>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Google Meet needs additional access</div>
                <div className="text-xs max-w-sm" style={{ color: 'var(--text-muted)' }}>
                    Your Google account was connected before Meet recordings were supported. Re-authorize to let Bee Flow list and import your Meet recordings — your other Google integrations keep working.
                </div>
                {reauthError && (
                    <div className="text-xs" style={{ color: '#ef4444' }}>{reauthError.message}</div>
                )}
                <button
                    type="button"
                    onClick={handleReauthorize}
                    disabled={reauthBusy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                    style={{ background: MEET_GREEN }}
                >
                    {reauthBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Re-authorize Google
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <CaptureControls />

            <div className="flex items-center justify-between">
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Pick a recorded Meet call — Bee Flow transcribes it with your configured engine.
                </div>
                <button
                    type="button"
                    onClick={load}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-50"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
            </div>

            {loading && (
                <div className="flex items-center gap-3 px-4 py-6 rounded-xl border justify-center" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: MEET_GREEN }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading Meet recordings…</span>
                </div>
            )}

            {!loading && error && (
                <div className="flex flex-col gap-2 px-3 py-3 rounded-xl border text-xs" style={{ background: 'color-mix(in srgb, #ef4444 8%, var(--bg-secondary))', borderColor: '#ef4444', color: 'var(--text-primary)' }}>
                    <div className="font-semibold">Couldn't load recordings</div>
                    <div style={{ color: 'var(--text-secondary)' }}>{error.message}</div>
                </div>
            )}

            {!loading && !error && items.length === 0 && (
                <div className="flex flex-col items-center gap-2 px-4 py-10 rounded-xl border text-center" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `color-mix(in srgb, ${MEET_GREEN} 12%, transparent)`, color: MEET_GREEN }}>
                        <Video className="w-6 h-6" />
                    </div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No Meet recordings found</div>
                    <div className="text-xs max-w-sm" style={{ color: 'var(--text-muted)' }}>
                        Record a meeting in Google Meet (the host starts the recording). Finished recordings appear here shortly after the meeting ends.
                    </div>
                </div>
            )}

            {!loading && !error && items.length > 0 && (
                <div className="flex flex-col gap-1.5 max-h-[48vh] overflow-y-auto pr-1">
                    {items.map((item) => {
                        const key = item.eventId || item.meetingCode;
                        const busy = uploading && busyKey === key;
                        return (
                            <div
                                key={key}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border"
                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
                            >
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `color-mix(in srgb, ${MEET_GREEN} 12%, transparent)`, color: MEET_GREEN }}>
                                    <Video className="w-4.5 h-4.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{item.title || 'Meet call'}</div>
                                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                        {[fmtDate(item.start), fmtDuration(item.start, item.end)].filter(Boolean).join(' · ')}
                                    </div>
                                </div>
                                {item.importedNoteId ? (
                                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0" style={{ background: `color-mix(in srgb, ${MEET_GREEN} 14%, transparent)`, color: MEET_GREEN }}>
                                        <Check className="w-3.5 h-3.5" /> Note created
                                    </span>
                                ) : item.recordingState === 'available' ? (
                                    <button
                                        type="button"
                                        onClick={() => handleImport(item)}
                                        disabled={uploading}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 flex-shrink-0"
                                        style={{ background: MEET_GREEN }}
                                    >
                                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                        {busy ? 'Transcribing…' : 'Transcribe'}
                                    </button>
                                ) : item.recordingState === 'processing' ? (
                                    <button
                                        type="button"
                                        disabled
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border opacity-60 flex-shrink-0"
                                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                                    >
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing…
                                    </button>
                                ) : (
                                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>No recording</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {(uploading || uploadStage) && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: MEET_GREEN }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{uploadStage || 'Working…'}</span>
                </div>
            )}

            {uploadError && (
                <div className="flex flex-col gap-2 px-3 py-3 rounded-xl border text-xs" style={{ background: 'color-mix(in srgb, #ef4444 8%, var(--bg-secondary))', borderColor: '#ef4444', color: 'var(--text-primary)' }}>
                    <div className="font-semibold">Import failed</div>
                    <div style={{ color: 'var(--text-secondary)' }}>{uploadError.message}</div>
                    <button
                        type="button"
                        onClick={clearError}
                        className="self-start px-3 py-1.5 rounded-lg text-xs font-medium border"
                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                    >
                        Dismiss
                    </button>
                </div>
            )}
        </div>
    );
}

import React, { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { NC_BLUE, LANGS, Toggle, Row, Select } from './shared/settingsPrimitives';

/**
 * Personal Nextcloud Talk → Meeting Notes settings. Rendered for every account
 * that has the Meeting Notes feature; self-hides (renders null) when the
 * feature isn't licensed (the API returns a non-OK status). Org-level settings,
 * when present, take precedence over these per field.
 */
export default function MeetingNotesSection() {
    const [cfg, setCfg] = useState({ autoTranscribe: false, postSummaryBack: false, recordingFolder: '/Talk', language: 'nl', autoRecord: false, autoRecordScope: 'calendar', recordingMode: 'audio' });
    const [available, setAvailable] = useState(true);
    const [connected, setConnected] = useState(false);
    const [recordingEnabled, setRecordingEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/talk-notes-settings/user/me`);
                if (res.ok) {
                    const data = await res.json();
                    setConnected(!!data.nextcloudConnected);
                    setRecordingEnabled(!!data.recordingEnabled);
                    setCfg(prev => ({ ...prev, ...data }));
                } else setAvailable(false); // 403/404 → feature not licensed for this account
            } catch (_) { setAvailable(false); } finally { setLoading(false); }
        })();
    }, []);

    const save = async () => {
        setSaving(true); setMessage(null);
        try {
            const res = await authFetch(`${API_BASE}/api/talk-notes-settings/user/me`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg),
            });
            if (res.ok) setMessage({ type: 'success', text: 'Saved' });
            else { const e = await res.json().catch(() => ({})); setMessage({ type: 'error', text: e.error || `HTTP ${res.status}` }); }
        } catch (e) { setMessage({ type: 'error', text: e.message }); }
        finally { setSaving(false); }
    };

    // Render nothing until we know — avoids flashing the section for accounts
    // that turn out to lack the feature or a Nextcloud connection.
    if (loading) return null;
    if (!available || !connected) return null;

    return (
        <div>
            <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4" style={{ color: NC_BLUE }} />
                <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                    Nextcloud Talk Meeting Notes
                </p>
            </div>
            <p className="text-[12px] mb-3" style={{ color: 'var(--text-muted)' }}>
                Bring your Nextcloud Talk call recordings into Meeting Notes, transcribed by your configured engine.
                Your organisation's settings, where set, take precedence.
            </p>

            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                <Row title="Auto-record my Talk meetings" desc={recordingEnabled ? 'Automatically start recording calls you moderate, then transcribe them.' : 'Unavailable — the Nextcloud recording backend is not configured.'}>
                    <Toggle on={cfg.autoRecord && recordingEnabled} onClick={() => setCfg(c => ({ ...c, autoRecord: !c.autoRecord }))} disabled={saving || !recordingEnabled} />
                </Row>
                {cfg.autoRecord && recordingEnabled && (
                    <>
                        <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                        <Row title="Which calls" desc="Record only scheduled calendar meetings, or every call you moderate.">
                            <Select value={cfg.autoRecordScope} disabled={saving} onChange={e => setCfg(c => ({ ...c, autoRecordScope: e.target.value }))}
                                options={[{ value: 'calendar', label: 'Calendar meetings' }, { value: 'all', label: 'Any call I moderate' }]} />
                        </Row>
                        <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                        <Row title="Recording quality" desc="Audio-only is smaller and faster to transcribe.">
                            <Select value={cfg.recordingMode} disabled={saving} onChange={e => setCfg(c => ({ ...c, recordingMode: e.target.value }))}
                                options={[{ value: 'audio', label: 'Audio-only' }, { value: 'video', label: 'Video' }]} />
                        </Row>
                    </>
                )}
                <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                <Row title="Auto-transcribe my Talk recordings" desc="When a new Talk recording appears, create a Meeting Note automatically.">
                    <Toggle on={cfg.autoTranscribe} onClick={() => setCfg(c => ({ ...c, autoTranscribe: !c.autoTranscribe }))} disabled={saving} />
                </Row>
                <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                <Row title="Post summary back into Talk" desc="After transcription, post the summary + action items into the conversation.">
                    <Toggle on={cfg.postSummaryBack} onClick={() => setCfg(c => ({ ...c, postSummaryBack: !c.postSummaryBack }))} disabled={saving} />
                </Row>
                <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                <Row title="Recordings folder" desc="Nextcloud Files folder where Talk saves your recordings.">
                    <input
                        type="text" value={cfg.recordingFolder}
                        onChange={e => setCfg(c => ({ ...c, recordingFolder: e.target.value }))}
                        disabled={saving} placeholder="/Talk"
                        className="w-40 px-3 py-1.5 rounded-lg border outline-none text-[13px]"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                    />
                </Row>
                <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                <Row title="Default language" desc="Language used when auto-transcribing your Talk recordings.">
                    <select
                        value={cfg.language} onChange={e => setCfg(c => ({ ...c, language: e.target.value }))} disabled={saving}
                        className="w-40 px-3 py-1.5 rounded-lg border outline-none text-[13px]"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                    >
                        {LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                    </select>
                </Row>
            </div>

            <div className="flex items-center gap-3 mt-3">
                <button
                    onClick={save} disabled={saving}
                    className="px-4 py-1.5 rounded-lg text-[13px] font-medium text-white disabled:opacity-40"
                    style={{ background: NC_BLUE }}
                >
                    {saving ? 'Saving…' : 'Save'}
                </button>
                {message && (
                    <span className={`text-[12px] font-medium ${message.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                        {message.type === 'success' ? '✓' : '⚠'} {message.text}
                    </span>
                )}
            </div>
        </div>
    );
}

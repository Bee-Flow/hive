import React, { useEffect, useState } from 'react';
import { MessageSquare, Loader2 } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';

const NC_BLUE = '#0082C9';
const LANGS = [
    { code: 'nl', label: 'Dutch' }, { code: 'en', label: 'English' }, { code: 'de', label: 'German' },
    { code: 'fr', label: 'French' }, { code: 'es', label: 'Spanish' }, { code: 'it', label: 'Italian' }, { code: 'pt', label: 'Portuguese' },
];

const Toggle = ({ on, onClick, disabled }) => (
    <button
        type="button" onClick={onClick} disabled={disabled} aria-pressed={on}
        className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
        style={{ background: on ? NC_BLUE : 'var(--border-default)', opacity: disabled ? 0.6 : 1 }}
    >
        <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
            style={{ transform: on ? 'translateX(20px)' : 'translateX(0)' }} />
    </button>
);

const Row = ({ title, desc, children }) => (
    <div className="flex items-center gap-4 px-5 py-3.5" style={{ background: 'var(--bg-secondary)' }}>
        <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{title}</p>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{desc}</p>
        </div>
        {children}
    </div>
);

/**
 * Personal Nextcloud Talk → Meeting Notes settings. Rendered for every account
 * that has the Meeting Notes feature; self-hides (renders null) when the
 * feature isn't licensed (the API returns a non-OK status). Org-level settings,
 * when present, take precedence over these per field.
 */
export default function MeetingNotesSection() {
    const [cfg, setCfg] = useState({ autoTranscribe: false, postSummaryBack: false, recordingFolder: '/Talk', language: 'nl' });
    const [available, setAvailable] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/talk-notes-settings/user/me`);
                if (res.ok) setCfg(prev => ({ ...prev, ...(await res.json()) }));
                else setAvailable(false); // 403/404 → feature not licensed for this account
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

    if (loading) {
        return (
            <div className="flex items-center gap-2 px-5 py-4 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: NC_BLUE }} />
                <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Loading…</span>
            </div>
        );
    }
    if (!available) return null;

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

import React, { useEffect, useState } from 'react';
import { Video, Loader2 } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { LANGS, Toggle, Row, Select } from '../../pages/settings/shared/settingsPrimitives';

const MEET_GREEN = '#00832D';

/**
 * Org-level Google Meet → Meeting Notes settings. Mirrors the Talk meeting
 * notes admin pattern. Org values take precedence over each member's own
 * settings.
 */
export default function GoogleMeetAdminPanel({ user }) {
    const orgId = user?.organizationId;
    const [cfg, setCfg] = useState({ autoImport: false, autoRecordConfig: false, importScope: 'organizer', language: 'nl' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        if (!orgId) { setLoading(false); return; }
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/gmeet-notes-settings/${orgId}`);
                if (res.ok) { const data = await res.json(); setCfg(prev => ({ ...prev, ...data })); }
            } catch (_) { /* ignore */ } finally { setLoading(false); }
        })();
    }, [orgId]);

    const save = async () => {
        setSaving(true); setMessage(null);
        try {
            const res = await authFetch(`${API_BASE}/api/gmeet-notes-settings/${orgId}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg),
            });
            if (res.ok) setMessage({ type: 'success', text: 'Saved' });
            else { const e = await res.json().catch(() => ({})); setMessage({ type: 'error', text: e.error || `HTTP ${res.status}` }); }
        } catch (e) { setMessage({ type: 'error', text: e.message }); }
        finally { setSaving(false); }
    };

    if (!orgId) return null;

    return (
        <div className="mt-6">
            <div className="flex items-center gap-2 mb-2">
                <Video className="w-4 h-4" style={{ color: MEET_GREEN }} />
                <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                    Google Meet Meeting Notes
                </p>
            </div>
            <p className="text-[12px] mb-3" style={{ color: 'var(--text-muted)' }}>
                Turn recorded Google Meet meetings into Meeting Notes — transcript, summary and action items,
                transcribed by your organisation's configured transcription engine. These org settings override
                each member's personal settings.
            </p>

            {loading ? (
                <div className="flex items-center gap-2 px-5 py-4 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: MEET_GREEN }} />
                    <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Loading…</span>
                </div>
            ) : (
                <>
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                        <Row title="Auto-import recorded Meet meetings" desc="When a recording of a member's Google Meet call appears in Drive, create a Meeting Note automatically. Recording must be started in Meet — requires Google Workspace Business Standard or higher.">
                            <Toggle on={cfg.autoImport} onClick={() => setCfg(c => ({ ...c, autoImport: !c.autoImport }))} disabled={saving} />
                        </Row>
                        <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                        <Row title="Pre-enable auto-recording for meetings members organize" desc="Configure Meet to start recording automatically for meetings members organize, so nothing is missed.">
                            <Toggle on={cfg.autoRecordConfig} onClick={() => setCfg(c => ({ ...c, autoRecordConfig: !c.autoRecordConfig }))} disabled={saving} />
                        </Row>
                        <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                        <Row title="Which meetings" desc="Import only meetings members organize, or every Meet meeting on their calendars.">
                            <Select value={cfg.importScope} disabled={saving} onChange={e => setCfg(c => ({ ...c, importScope: e.target.value }))}
                                options={[{ value: 'organizer', label: 'Meetings they organize' }, { value: 'calendar', label: 'All calendar meetings' }]} />
                        </Row>
                        <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                        <Row title="Default language" desc="Language used when transcribing Meet recordings.">
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
                            style={{ background: MEET_GREEN }}
                        >
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                        {message && (
                            <span className={`text-[12px] font-medium ${message.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                                {message.type === 'success' ? '✓' : '⚠'} {message.text}
                            </span>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

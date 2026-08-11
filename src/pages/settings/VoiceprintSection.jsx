import { Fingerprint, Check, Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { NC_BLUE, Row } from './shared/settingsPrimitives';
import VoiceprintEnrollModal from './VoiceprintEnrollModal';
import { useTranslation } from '../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../utils/helpers';

/**
 * Personal voice profile — lets pyannoteAI put your real name on your turns in
 * meeting transcripts instead of the LLM guessing from the text.
 *
 * SELF-HIDING, and strictly. It renders `null` unless the backend says the
 * feature is genuinely usable (pyannoteAI is the active transcription
 * provider, a key is configured, and the account belongs to an organisation).
 * Someone on a Voxtral deployment must never learn this exists — advertising a
 * biometric feature that cannot be used is worse than not having it.
 *
 * Recording lives in the modal; this section is status + the three actions.
 */
export default function VoiceprintSection() {
    const { t, locale } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [state, setState] = useState(null); // the /availability payload
    const [enrollOpen, setEnrollOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/voiceprints/availability`);
            if (!res.ok) { setState(null); return; }   // 403/404 → not licensed
            setState(await res.json());
        } catch (_) {
            setState(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const remove = async () => {
        setBusy(true);
        try {
            await authFetch(`${API_BASE}/api/voiceprints/me`, { method: 'DELETE' });
            setConfirmDelete(false);
            await load();
        } finally {
            setBusy(false);
        }
    };

    // Render nothing until we know — no flash of a section this account may
    // turn out not to have.
    if (loading) return null;
    if (!state?.available) return null;

    const vp = state.voiceprint;
    const enrolled = !!state.enrolled;
    const failed = vp?.status === 'failed';
    const recordedOn = vp?.createdAt ? new Date(vp.createdAt).toLocaleDateString(locale || undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : null;
    const { enrolled: coverEnrolled = 0, members: coverMembers = 0 } = state.coverage || {};

    return (
        <div>
            <div className="flex items-center gap-2 mb-2">
                <Fingerprint className="w-4 h-4" style={{ color: NC_BLUE }} />
                <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                    {t('voiceprint.title', 'Voice profile')}
                </p>
            </div>
            <p className="text-[12px] mb-3" style={{ color: 'var(--text-muted)' }}>
                {t('voiceprint.desc', 'Record your voice once and your name is put on your own turns automatically in meetings recorded by anyone in your organisation. Only you can record your voice profile.')}
            </p>

            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                <Row
                    title={enrolled
                        ? t('voiceprint.row_active', 'Your voice profile is active')
                        : t('voiceprint.row_none', 'No voice profile yet')}
                    desc={enrolled
                        ? [recordedOn ? t('voiceprint.recorded_on', 'Recorded on {date}', { date: recordedOn }) : null,
                            vp?.lastMatchedAt ? t('voiceprint.recognised_recently', 'Recently recognised in a meeting') : null]
                            .filter(Boolean).join(' · ')
                        : (failed
                            ? t(`voiceprint.error_${vp.errorCode || 'enroll_failed'}`, 'The last attempt failed. Please try again.')
                            : t('voiceprint.row_none_desc', 'Takes about half a minute: you read a short text aloud.'))}
                >
                    {enrolled
                        ? <span className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: '#16a34a' }}><Check className="w-4 h-4" />{t('voiceprint.status_ready', 'Active')}</span>
                        : null}
                </Row>
                {coverMembers > 0 && (
                    <>
                        <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                        <Row
                            title={t('voiceprint.coverage_title', 'In your organisation')}
                            desc={t('voiceprint.coverage', '{enrolled} of {members} colleagues have a voice profile. The more there are, the better speakers are recognised.', { enrolled: coverEnrolled, members: coverMembers })}
                        />
                    </>
                )}
            </div>

            <div className="flex items-center gap-3 mt-3">
                <button
                    type="button"
                    onClick={() => setEnrollOpen(true)}
                    disabled={busy}
                    className="px-4 py-1.5 rounded-lg text-[13px] font-medium text-white disabled:opacity-40"
                    style={{ background: NC_BLUE }}
                >
                    {enrolled ? t('voiceprint.rerecord', 'Record again') : t('voiceprint.record', 'Record voice profile')}
                </button>
                {enrolled && !confirmDelete && (
                    <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-lg text-[13px] border disabled:opacity-40"
                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                    >
                        {t('voiceprint.delete', 'Delete')}
                    </button>
                )}
                {confirmDelete && (
                    <>
                        <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                            {t('voiceprint.delete_confirm', 'Delete your voice profile? Your name will no longer be recognised automatically.')}
                        </span>
                        <button
                            type="button"
                            onClick={remove}
                            disabled={busy}
                            className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-white disabled:opacity-40"
                            style={{ background: '#ef4444' }}
                        >
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : t('voiceprint.delete_confirm_yes', 'Delete')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setConfirmDelete(false)}
                            disabled={busy}
                            className="px-3 py-1.5 rounded-lg text-[13px] border disabled:opacity-40"
                            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                        >
                            {t('voiceprint.delete_confirm_no', 'Cancel')}
                        </button>
                    </>
                )}
            </div>

            <VoiceprintEnrollModal
                open={enrollOpen}
                limits={state.limits}
                onClose={() => setEnrollOpen(false)}
                onEnrolled={async () => { setEnrollOpen(false); await load(); }}
            />
        </div>
    );
}

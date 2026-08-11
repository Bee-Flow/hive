import { Mic, Square, X, Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NC_BLUE } from './shared/settingsPrimitives';
import { passageFor } from './voiceprintPassages';
import Modal from '../../components/shared/Modal';
import { useTranslation } from '../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../utils/helpers';
import useAudioRecorder from '../meeting-notes/hooks/useAudioRecorder';

/**
 * Voice-profile enrollment.
 *
 * The passage on screen is the point of this dialog. pyannoteAI wants ~25
 * seconds of one clear voice and rejects anything over 30; left to improvise,
 * people say "hello, testing" and stop after four. Reading a fixed text keeps
 * them talking naturally for exactly as long as a good template needs.
 *
 * Timing is therefore enforced, not suggested:
 *   • Stop is disabled below `minSeconds` — you cannot submit a clip too short
 *     to enrol.
 *   • Recording HARD-STOPS at `maxSeconds` (28), two seconds under pyannote's
 *     ceiling, because `elapsed` is a wall-clock tick and drifts. The server
 *     re-measures the decoded audio anyway; this just avoids a wasted round
 *     trip and a confusing error.
 *
 * Consent is a separate, unticked gate: a voiceprint is Art. 9 biometric data,
 * so the mic cannot be armed until it is explicitly given.
 */
export default function VoiceprintEnrollModal({ open, onClose, limits, onEnrolled }) {
    const { t, locale } = useTranslation();
    const MIN = limits?.minSeconds ?? 12;
    const TARGET = limits?.targetSeconds ?? 25;
    const MAX = limits?.maxSeconds ?? 28;

    const [consent, setConsent] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const paragraphs = passageFor(locale);

    // `onStopped` fires outside React's render (and survives unmount), so it
    // cannot read `elapsed` off state. Mirroring it into a ref on every tick —
    // rather than stamping the ref at each stop site — means the duration is
    // correct no matter WHY the recorder stopped.
    const elapsedRef = useRef(0);

    const handleStopped = useCallback(async (file) => {
        const seconds = elapsedRef.current;
        if (seconds < MIN) return; // too short to enrol — discard rather than waste a pyannote job
        setUploading(true);
        setError(null);
        try {
            const form = new FormData();
            form.append('audio', file);
            form.append('consent', 'true');
            form.append('language', locale || 'nl');
            form.append('duration_seconds', String(seconds));
            const res = await authFetch(`${API_BASE}/api/voiceprints/me`, { method: 'POST', body: form });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(t(`voiceprint.error_${data.code || 'enroll_failed'}`, 'Recording your voice profile failed. Please try again.'));
                return;
            }
            onEnrolled?.(data.voiceprint);
        } catch (_) {
            setError(t('voiceprint.error_enroll_failed', 'Recording your voice profile failed. Please try again.'));
        } finally {
            setUploading(false);
        }
    }, [MIN, locale, onEnrolled, t]);

    const recorder = useAudioRecorder({ onStopped: handleStopped });
    const { state, elapsed, level, error: micError, start, stop, cancel } = recorder;
    const recording = state === 'recording';
    elapsedRef.current = elapsed;

    // Hard stop. pyannote rejects >30s outright, and `elapsed` ticks on a
    // setInterval that can run late — 28 leaves a full second of slack.
    useEffect(() => {
        if (recording && elapsed >= MAX) stop();
    }, [recording, elapsed, MAX, stop]);

    // Reset when the dialog is reopened after a failure.
    useEffect(() => {
        if (open) { setError(null); setUploading(false); }
    }, [open]);

    const close = () => {
        if (recording || state === 'paused') cancel();
        onClose?.();
    };

    const canStop = elapsed >= MIN;
    const progress = Math.min(elapsed / TARGET, 1) * 100;
    const ringScale = 1 + Math.min(0.5, level * 1.1);
    // Halfway through, dim the first paragraph: a reading cue that needs no
    // speech alignment and cannot be wrong in a distracting way.
    const secondHalf = elapsed > TARGET / 2;

    return (
        <Modal
            open={open}
            onClose={close}
            size="lg"
            title={t('voiceprint.modal_title', 'Record your voice profile')}
            description={t('voiceprint.modal_desc', 'Read the text below aloud at your normal pace. The recording stops on its own.')}
        >
            <div className="flex flex-col gap-5">
                <div
                    className="rounded-xl px-5 py-4 text-[15px] leading-relaxed"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                >
                    {paragraphs.map((p, i) => (
                        <p
                            key={i}
                            className={i > 0 ? 'mt-3' : undefined}
                            style={{ opacity: recording && ((i === 0 && secondHalf) || (i > 0 && !secondHalf)) ? 0.45 : 1, transition: 'opacity 400ms' }}
                        >
                            {p}
                        </p>
                    ))}
                </div>

                <div className="flex flex-col items-center gap-3">
                    <div className="relative flex items-center justify-center" style={{ height: 120 }}>
                        {recording && (
                            <span
                                aria-hidden
                                className="absolute rounded-full transition-transform"
                                style={{
                                    width: 110, height: 110,
                                    background: 'radial-gradient(circle, rgba(255,212,0,0.28) 0%, rgba(255,212,0,0) 70%)',
                                    transform: `scale(${ringScale})`,
                                }}
                            />
                        )}
                        <button
                            type="button"
                            onClick={() => (recording ? stop() : start())}
                            disabled={(!consent && !recording) || uploading || state === 'stopping' || (recording && !canStop)}
                            aria-label={recording ? t('voiceprint.stop', 'Stop recording') : t('voiceprint.start', 'Start recording')}
                            className="relative w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ background: recording ? '#ef4444' : '#ffd400', color: recording ? '#fff' : '#1a1a1a' }}
                        >
                            {uploading
                                ? <Loader2 className="w-8 h-8 animate-spin" />
                                : recording
                                    ? <Square className="w-8 h-8" fill="currentColor" />
                                    : <Mic className="w-8 h-8" />}
                        </button>
                    </div>

                    <div className="w-full max-w-sm">
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                            <div
                                className="h-full transition-[width] duration-300"
                                style={{ width: `${progress}%`, background: canStop ? NC_BLUE : '#f59e0b' }}
                            />
                        </div>
                        <div className="flex items-center justify-between mt-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            <span className="font-mono tabular-nums">
                                {String(Math.floor(elapsed / 60))}:{String(elapsed % 60).padStart(2, '0')} / {String(Math.floor(TARGET / 60))}:{String(TARGET % 60).padStart(2, '0')}
                            </span>
                            <span>
                                {uploading
                                    ? t('voiceprint.state_processing', 'Creating your voice profile…')
                                    : recording
                                        ? (canStop ? t('voiceprint.hint_can_stop', 'You can stop now') : t('voiceprint.hint_keep_reading', 'Keep reading…'))
                                        : t('voiceprint.hint_ready', 'Tap the microphone and start reading')}
                            </span>
                        </div>
                    </div>
                </div>

                {!recording && !uploading && (
                    <label className="flex items-start gap-3 text-[12px] cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                        <input
                            type="checkbox"
                            checked={consent}
                            onChange={e => setConsent(e.target.checked)}
                            className="mt-0.5 flex-shrink-0"
                        />
                        <span>
                            {t('voiceprint.consent_label', 'I agree that a voice profile of my voice is created and stored.')}{' '}
                            <span style={{ color: 'var(--text-muted)' }}>
                                {t('voiceprint.consent_detail', 'This is biometric data. It is used only to recognise me in my own organisation’s meeting notes, the recording itself is not kept, and I can delete my voice profile at any time.')}
                            </span>
                        </span>
                    </label>
                )}

                {micError && (
                    <p className="text-[12px] text-rose-500">
                        {micError.name === 'NotAllowedError'
                            ? t('voiceprint.error_mic_denied', 'Microphone access was denied. Allow it in your browser settings and try again.')
                            : t('voiceprint.error_mic', 'Could not access the microphone.')}
                    </p>
                )}
                {error && <p className="text-[12px] text-rose-500">{error}</p>}

                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={close}
                        disabled={uploading}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] border disabled:opacity-40"
                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                    >
                        <X className="w-4 h-4" />
                        {recording ? t('voiceprint.discard', 'Discard') : t('voiceprint.cancel', 'Cancel')}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

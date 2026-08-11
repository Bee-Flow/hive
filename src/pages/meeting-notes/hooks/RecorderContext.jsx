import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import useAudioRecorder from './useAudioRecorder';
import * as api from '../lib/transcriptionsApi';
import { generateAutoTitle } from '../lib/format';

const RecorderContext = createContext(null);

const STAGES = [
    'Uploading audio…',
    'Converting audio format…',
    'Transcribing speech…',
    'Identifying speakers…',
    'Generating summary…',
    'Finalizing…',
];

/**
 * Capture settings shared by every entry point (record, upload, Talk, Meet).
 * Declared once so the provider and the out-of-provider fallback cannot drift
 * apart — they already had, which is how `attendees` and `numSpeakers` went
 * missing from the fallback and from every consumer's inferred type.
 *
 * @typedef {{ language: string, provider: string, contextTerms: string,
 *             attendees: string, numSpeakers: string }} CaptureSettings
 */

/** @type {CaptureSettings} */
const DEFAULT_SETTINGS = { language: 'nl', provider: '', contextTerms: '', attendees: '', numSpeakers: '' };

/**
 * Shell-level provider. One MediaRecorder for the whole app — survives modal
 * close and page navigation. Pages call `useRecorder()` to read state and
 * trigger start/stop.
 */
export function RecorderProvider({ children }) {
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [uploading, setUploading] = useState(false);
    const [uploadStage, setUploadStage] = useState('');
    const [uploadError, setUploadError] = useState(null);
    const [lastResultId, setLastResultId] = useState(null);
    const [lastResultMeta, setLastResultMeta] = useState(null);
    const [lastFailedFile, setLastFailedFile] = useState(null);
    // Retained alongside the file: a failed RECORDING retried through
    // "switch engine & retry" must not be re-filed as an upload.
    const [lastFailedCapture, setLastFailedCapture] = useState('upload');
    const [version, setVersion] = useState(0); // bumps when a transcription finishes — list listeners refetch

    const handleFileReady = useCallback(async (file, overrideProvider, captureMode = 'upload') => {
        setUploading(true);
        setUploadError(null);
        let stageIdx = 0;
        setUploadStage(STAGES[0]);
        const stageTimer = setInterval(() => {
            stageIdx = Math.min(stageIdx + 1, STAGES.length - 1);
            setUploadStage(STAGES[stageIdx]);
        }, 15000);
        try {
            const isRecording = captureMode === 'recording';
            const title = isRecording ? generateAutoTitle() : file.name.replace(/\.[^/.]+$/, '');
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 600000);
            const provider = overrideProvider || settings.provider || undefined;
            const result = await api.uploadAudio({
                file,
                language: settings.language,
                title,
                contextTerms: settings.contextTerms,
                attendees: settings.attendees,
                numSpeakers: settings.numSpeakers,
                provider,
                // Recorded in the browser vs a file the user picked. The backend
                // stored both as 'upload', so when the audio was later missing it
                // could only say "please upload again" — advice a user with a
                // browser recording cannot possibly follow, because those bytes
                // never existed anywhere else.
                captureMode,
                signal: controller.signal,
            });
            clearTimeout(tid);
            setLastResultId(result.id);
            setLastResultMeta({ providerFallback: result.providerFallback || null });
            setLastFailedFile(null);
            setVersion((v) => v + 1);
            return { ok: true, result };
        } catch (err) {
            setLastFailedFile(file);
            setLastFailedCapture(captureMode);
            setUploadError(err);
            return { ok: false, error: err };
        } finally {
            clearInterval(stageTimer);
            setUploading(false);
            setUploadStage('');
        }
    }, [settings.language, settings.provider, settings.contextTerms, settings.attendees, settings.numSpeakers]);

    const recorder = useAudioRecorder({ onStopped: (file) => handleFileReady(file, undefined, 'recording') });

    const uploadFile = useCallback(async (file) => {
        return handleFileReady(file, undefined, 'upload');
    }, [handleFileReady]);

    const retryWithProvider = useCallback(async (provider) => {
        if (!lastFailedFile) return { ok: false };
        return handleFileReady(lastFailedFile, provider, lastFailedCapture);
    }, [lastFailedFile, lastFailedCapture, handleFileReady]);

    const uploadFromNextcloud = useCallback(async (item) => {
        setUploading(true);
        setUploadError(null);
        setUploadStage(STAGES[0]);
        try {
            const result = await api.uploadFromNextcloud({
                path: item.path,
                language: settings.language,
                provider: settings.provider || undefined,
                title: (item.name || 'meeting').replace(/\.[^/.]+$/, ''),
                contextTerms: settings.contextTerms,
            });
            setLastResultId(result.id);
            setLastResultMeta({ providerFallback: result.providerFallback || null });
            setVersion((v) => v + 1);
            return { ok: true, result };
        } catch (err) {
            setUploadError(err);
            return { ok: false, error: err };
        } finally {
            setUploading(false);
            setUploadStage('');
        }
    }, [settings.language, settings.provider, settings.contextTerms]);

    const importFromGoogleMeet = useCallback(async (item, { language, contextTerms } = {}) => {
        setUploading(true);
        setUploadError(null);
        setUploadStage(STAGES[0]);
        try {
            const result = await api.importGoogleMeetRecording({
                eventId: item.eventId,
                meetingCode: item.meetingCode,
                language: language || settings.language,
                title: item.title || undefined,
                contextTerms: contextTerms ?? settings.contextTerms,
            });
            setLastResultId(result.id);
            setLastResultMeta({ providerFallback: result.providerFallback || null });
            setVersion((v) => v + 1);
            return { ok: true, result };
        } catch (err) {
            setUploadError(err);
            return { ok: false, error: err };
        } finally {
            setUploading(false);
            setUploadStage('');
        }
    }, [settings.language, settings.contextTerms]);

    const consumeLastResult = useCallback(() => {
        const id = lastResultId;
        const meta = lastResultMeta;
        setLastResultId(null);
        setLastResultMeta(null);
        return { id, meta };
    }, [lastResultId, lastResultMeta]);

    const value = useMemo(() => ({
        recorder,
        settings,
        setSettings,
        uploading,
        uploadStage,
        uploadError,
        lastResultId,
        lastResultMeta,
        consumeLastResult,
        uploadFile,
        uploadFromNextcloud,
        importFromGoogleMeet,
        retryWithProvider,
        canRetry: !!lastFailedFile,
        version,
        clearError: () => { setUploadError(null); setLastFailedFile(null); },
    }), [recorder, settings, uploading, uploadStage, uploadError, lastResultId, lastResultMeta, consumeLastResult, uploadFile, uploadFromNextcloud, importFromGoogleMeet, retryWithProvider, lastFailedFile, version]);

    return <RecorderContext.Provider value={value}>{children}</RecorderContext.Provider>;
}

export function useRecorder() {
    const ctx = useContext(RecorderContext);
    if (!ctx) {
        // Safe no-op fallback so components used outside the provider
        // (e.g. Storybook) don't crash.
        //
        // Shares DEFAULT_SETTINGS with the provider so the two shapes cannot
        // drift again — they had, which is how `attendees` and `numSpeakers`
        // went missing here and from every consumer's inferred type.
        return {
            recorder: { state: 'idle', elapsed: 0, level: 0, error: null, start: () => {}, stop: () => {}, pause: () => {}, resume: () => {}, cancel: () => {} },
            settings: DEFAULT_SETTINGS,
            setSettings: /** @type {React.Dispatch<React.SetStateAction<CaptureSettings>>} */ (() => {}),
            uploading: false,
            uploadStage: '',
            uploadError: null,
            lastResultId: null,
            lastResultMeta: null,
            consumeLastResult: () => ({ id: null, meta: null }),
            uploadFile: async () => ({ ok: false }),
            uploadFromNextcloud: async () => ({ ok: false }),
            importFromGoogleMeet: async () => ({ ok: false }),
            retryWithProvider: async () => ({ ok: false }),
            canRetry: false,
            version: 0,
            clearError: () => {},
        };
    }
    return ctx;
}

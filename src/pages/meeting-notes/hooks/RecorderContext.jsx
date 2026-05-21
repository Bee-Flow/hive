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
 * Shell-level provider. One MediaRecorder for the whole app — survives modal
 * close and page navigation. Pages call `useRecorder()` to read state and
 * trigger start/stop.
 */
export function RecorderProvider({ children }) {
    const [settings, setSettings] = useState({ language: 'nl', provider: '', contextTerms: '' });
    const [uploading, setUploading] = useState(false);
    const [uploadStage, setUploadStage] = useState('');
    const [uploadError, setUploadError] = useState(null);
    const [lastResultId, setLastResultId] = useState(null);
    const [lastResultMeta, setLastResultMeta] = useState(null);
    const [lastFailedFile, setLastFailedFile] = useState(null);
    const [version, setVersion] = useState(0); // bumps when a transcription finishes — list listeners refetch

    const handleFileReady = useCallback(async (file, overrideProvider) => {
        setUploading(true);
        setUploadError(null);
        let stageIdx = 0;
        setUploadStage(STAGES[0]);
        const stageTimer = setInterval(() => {
            stageIdx = Math.min(stageIdx + 1, STAGES.length - 1);
            setUploadStage(STAGES[stageIdx]);
        }, 15000);
        try {
            const title = file.name.startsWith('recording.') ? generateAutoTitle() : file.name.replace(/\.[^/.]+$/, '');
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 600000);
            const provider = overrideProvider || settings.provider || undefined;
            const result = await api.uploadAudio({
                file,
                language: settings.language,
                title,
                contextTerms: settings.contextTerms,
                provider,
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
            setUploadError(err);
            return { ok: false, error: err };
        } finally {
            clearInterval(stageTimer);
            setUploading(false);
            setUploadStage('');
        }
    }, [settings.language, settings.provider, settings.contextTerms]);

    const recorder = useAudioRecorder({ onStopped: handleFileReady });

    const uploadFile = useCallback(async (file) => {
        return handleFileReady(file);
    }, [handleFileReady]);

    const retryWithProvider = useCallback(async (provider) => {
        if (!lastFailedFile) return { ok: false };
        return handleFileReady(lastFailedFile, provider);
    }, [lastFailedFile, handleFileReady]);

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
        retryWithProvider,
        canRetry: !!lastFailedFile,
        version,
        clearError: () => { setUploadError(null); setLastFailedFile(null); },
    }), [recorder, settings, uploading, uploadStage, uploadError, lastResultId, lastResultMeta, consumeLastResult, uploadFile, uploadFromNextcloud, retryWithProvider, lastFailedFile, version]);

    return <RecorderContext.Provider value={value}>{children}</RecorderContext.Provider>;
}

export function useRecorder() {
    const ctx = useContext(RecorderContext);
    if (!ctx) {
        // Safe no-op fallback so components used outside the provider
        // (e.g. Storybook) don't crash.
        return {
            recorder: { state: 'idle', elapsed: 0, level: 0, error: null, start: () => {}, stop: () => {}, pause: () => {}, resume: () => {}, cancel: () => {} },
            settings: { language: 'nl', provider: '', contextTerms: '' },
            setSettings: () => {},
            uploading: false,
            uploadStage: '',
            uploadError: null,
            lastResultId: null,
            lastResultMeta: null,
            consumeLastResult: () => ({ id: null, meta: null }),
            uploadFile: async () => ({ ok: false }),
            uploadFromNextcloud: async () => ({ ok: false }),
            retryWithProvider: async () => ({ ok: false }),
            canRetry: false,
            version: 0,
            clearError: () => {},
        };
    }
    return ctx;
}

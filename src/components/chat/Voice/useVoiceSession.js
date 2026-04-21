/**
 * useVoiceSession — Realtime voice conversation hook (Beta v1.2).
 *
 * This revision wires voice into the host chat instead of holding its own
 * isolated history:
 *
 *   - `getHistory` (callback) is called per turn to obtain the chat's
 *     current message list. Messages shown in the main chat become the
 *     context for the voice turn without any duplication.
 *   - `onTurnComplete({ user, assistant })` fires when a voice turn
 *     lands. The host uses it to append the user + assistant messages
 *     to the real chat conversation so they render as regular bubbles.
 *
 * What the hook still owns:
 *   - microphone stream + recorder
 *   - TTS audio playback
 *   - state machine (idle → listening → thinking → speaking → idle)
 *   - per-turn transient UI state (partial transcript, partial reply,
 *     running tool chips) — consumed by the inline voice panel
 *
 * Agent mode: pass `{ agentId }` to `connect()` to run the voice session
 * against a specific agent's system prompt and tool set.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE, authFetch } from '../../../utils/helpers';

const STATES = {
    IDLE: 'idle',
    LISTENING: 'listening',
    THINKING: 'thinking',
    SPEAKING: 'speaking',
    ERROR: 'error',
};

function pickMimeType() {
    const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
    ];
    for (const m of candidates) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(m)) {
            return m;
        }
    }
    return '';
}

/**
 * @param {Object} [options]
 * @param {() => Array<{role:string, content:string}>} [options.getHistory]
 *        Returns the host chat's current messages for use as LLM context.
 *        Called just before each turn — always reads live state.
 * @param {({user, assistant}) => void} [options.onTurnComplete]
 *        Fires after a turn completes with the transcribed user message
 *        and the assistant reply (incl. tool-use summaries). The host is
 *        expected to append these to the chat conversation.
 */
export default function useVoiceSession({ getHistory, onTurnComplete } = {}) {
    const [state, setState] = useState(STATES.IDLE);
    const [session, setSession] = useState(null);
    const [partialReply, setPartialReply] = useState('');
    const [partialTranscript, setPartialTranscript] = useState('');
    const [turnTools, setTurnTools] = useState([]);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [latency, setLatency] = useState(null);

    const mediaStreamRef = useRef(null);
    const recorderRef = useRef(null);
    const chunksRef = useRef([]);
    const audioElRef = useRef(null);
    const abortRef = useRef(null);
    const getHistoryRef = useRef(getHistory);
    const onTurnCompleteRef = useRef(onTurnComplete);

    // Keep callback refs fresh so that re-renders in the host don't require
    // the hook to tear down its in-flight request.
    useEffect(() => { getHistoryRef.current = getHistory; }, [getHistory]);
    useEffect(() => { onTurnCompleteRef.current = onTurnComplete; }, [onTurnComplete]);

    const cleanup = useCallback(() => {
        try { recorderRef.current?.stop(); } catch (_) { /* noop */ }
        try { mediaStreamRef.current?.getTracks().forEach(t => t.stop()); } catch (_) { /* noop */ }
        try { abortRef.current?.abort(); } catch (_) { /* noop */ }
        try { audioElRef.current?.pause(); } catch (_) { /* noop */ }
        recorderRef.current = null;
        mediaStreamRef.current = null;
        abortRef.current = null;
        chunksRef.current = [];
    }, []);

    useEffect(() => () => cleanup(), [cleanup]);

    const connect = useCallback(async (opts = {}) => {
        setError(null);
        try {
            const resp = await authFetch(`${API_BASE}/ai/voice/session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId: opts.agentId || null,
                    voice: opts.voice || null,
                    language: opts.language || null,
                }),
            });
            if (!resp.ok) {
                const j = await resp.json().catch(() => ({}));
                throw new Error(j.message || j.error || `Failed to start voice session (${resp.status})`);
            }
            const data = await resp.json();
            setSession(data);

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            mediaStreamRef.current = stream;
            setState(STATES.IDLE);
            return data;
        } catch (err) {
            console.error('[useVoiceSession] connect error:', err);
            setError(err.message || 'Could not start voice session');
            setState(STATES.ERROR);
            cleanup();
            throw err;
        }
    }, [cleanup]);

    const startListening = useCallback(() => {
        if (!mediaStreamRef.current) {
            setError('Microphone not ready');
            return;
        }
        if (state === STATES.LISTENING) return;

        chunksRef.current = [];
        const mimeType = pickMimeType();
        const recorder = new MediaRecorder(
            mediaStreamRef.current,
            mimeType ? { mimeType } : undefined
        );
        recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onerror = (e) => {
            console.error('[useVoiceSession] recorder error:', e);
            setError('Microphone error');
            setState(STATES.ERROR);
        };
        recorderRef.current = recorder;
        recorder.start();
        setPartialTranscript('');
        setPartialReply('');
        setTurnTools([]);
        setState(STATES.LISTENING);
    }, [state]);

    const stopListening = useCallback(async () => {
        const recorder = recorderRef.current;
        if (!recorder || recorder.state === 'inactive') return;

        await new Promise((resolve) => {
            recorder.onstop = resolve;
            try { recorder.stop(); } catch (_) { resolve(); }
        });

        const chunks = chunksRef.current;
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: mimeType });
        chunksRef.current = [];

        if (!blob.size) {
            setState(STATES.IDLE);
            return;
        }

        await submitTurn(blob, mimeType);
    }, []);

    const submitTurn = useCallback(async (blob, mimeType) => {
        setState(STATES.THINKING);
        setPartialReply('');
        setError(null);

        // Pull the host chat's live message list and sanitize to the
        // minimal { role, content } shape Mistral expects.
        const hostHistory = (getHistoryRef.current?.() || [])
            .filter(m => m && m.role && typeof m.content === 'string')
            .filter(m => !m.isHidden && !m.isStreaming)
            .map(({ role, content }) => ({ role, content }));

        const form = new FormData();
        const ext = (mimeType.split('/')[1] || 'webm').split(';')[0];
        form.append('audio', blob, `turn.${ext}`);
        form.append('history', JSON.stringify(hostHistory));
        if (session?.model) form.append('model', session.model);
        if (session?.voice) form.append('voice', session.voice);
        if (session?.language) form.append('language', session.language);
        if (session?.systemPrompt) form.append('systemPrompt', session.systemPrompt);
        if (session?.agentId) form.append('agentId', session.agentId);

        const controller = new AbortController();
        abortRef.current = controller;
        const startedAt = Date.now();

        let resp;
        try {
            resp = await authFetch(`${API_BASE}/ai/voice/turn`, {
                method: 'POST',
                body: form,
                signal: controller.signal,
            });
        } catch (err) {
            if (err.name === 'AbortError') { setState(STATES.IDLE); return; }
            setError(err.message || 'Network error');
            setState(STATES.ERROR);
            return;
        }

        if (!resp.ok || !resp.body) {
            const j = await resp.json().catch(() => ({}));
            setError(j.message || j.error || `Voice turn failed (${resp.status})`);
            setState(STATES.ERROR);
            return;
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let userText = '';
        let assistantText = '';
        let ttsPlayed = false;
        const turnToolsLocal = [];
        const metrics = { sttMs: null, ttftMs: null, ttsMs: null };

        const upsertTool = (id, patch) => {
            const idx = turnToolsLocal.findIndex(t => t.id === id);
            if (idx === -1) turnToolsLocal.push({ id, ...patch });
            else turnToolsLocal[idx] = { ...turnToolsLocal[idx], ...patch };
            setTurnTools([...turnToolsLocal]);
        };

        const dispatch = (event, dataRaw) => {
            let data = {};
            try { data = JSON.parse(dataRaw); } catch (_) { /* ignore */ }
            switch (event) {
                case 'transcript':
                    userText = data.text || '';
                    metrics.sttMs = data.latencyMs ?? null;
                    setPartialTranscript(userText);
                    break;
                case 'no_speech':
                    break;
                case 'text':
                    if (data.delta) {
                        assistantText += data.delta;
                        setPartialReply(assistantText);
                    }
                    break;
                case 'tool_use':
                    upsertTool(data.id, {
                        name: data.name,
                        input: data.input,
                        status: 'running',
                        round: data.round ?? 0,
                    });
                    break;
                case 'tool_result':
                    upsertTool(data.id, {
                        name: data.name,
                        status: data.ok ? 'done' : 'error',
                        summary: data.summary || (data.ok ? 'ok' : 'failed'),
                    });
                    break;
                case 'llm_done':
                    if (Array.isArray(data.rounds) && data.rounds.length > 0) {
                        metrics.ttftMs = data.rounds[0]?.ttftMs ?? null;
                    } else if (data.ttftMs != null) {
                        metrics.ttftMs = data.ttftMs;
                    }
                    break;
                case 'tts':
                    metrics.ttsMs = data.latencyMs ?? null;
                    if (data.audioBase64) {
                        playTts(data.audioBase64, data.mimeType || 'audio/mpeg');
                        ttsPlayed = true;
                    }
                    break;
                case 'tts_unavailable':
                    if (data.reason === 'no_voice_configured') {
                        setNotice(
                            'Voxtral TTS needs a voice to speak with. ' +
                            'Create one via POST /v1/audio/voices on api.mistral.ai, or add an ElevenLabs API key as a fallback. ' +
                            'Showing transcript only for now.'
                        );
                    } else if (data.reason === 'tts_failed') {
                        setNotice('Voice synthesis failed — showing transcript only. Check server logs for details.');
                    } else {
                        setNotice(
                            'No text-to-speech provider is configured. ' +
                            'Add a Voxtral voice on api.mistral.ai or an ElevenLabs API key in Admin → AI Config.'
                        );
                    }
                    break;
                case 'error':
                    setError(data.message || 'Voice turn failed');
                    setState(STATES.ERROR);
                    break;
                case 'done':
                    // Emit the completed turn to the host chat so the
                    // messages appear as regular chat bubbles.
                    if (userText && onTurnCompleteRef.current) {
                        const frozenTools = turnToolsLocal.map(t => ({ ...t }));
                        onTurnCompleteRef.current({
                            user: { role: 'user', content: userText, source: 'voice' },
                            assistant: assistantText || frozenTools.length
                                ? {
                                    role: 'assistant',
                                    content: assistantText,
                                    source: 'voice',
                                    tools: frozenTools,
                                }
                                : null,
                        });
                    }
                    setPartialTranscript('');
                    setPartialReply('');
                    setTurnTools([]);
                    setLatency({ ...metrics, totalMs: Date.now() - startedAt });
                    if (!ttsPlayed) setState(STATES.IDLE);
                    break;
                default:
                    break;
            }
        };

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let idx;
            while ((idx = buffer.indexOf('\n\n')) !== -1) {
                const frame = buffer.slice(0, idx);
                buffer = buffer.slice(idx + 2);
                const lines = frame.split('\n');
                let event = 'message';
                const dataLines = [];
                for (const line of lines) {
                    if (line.startsWith('event:')) event = line.slice(6).trim();
                    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
                }
                if (dataLines.length) dispatch(event, dataLines.join('\n'));
            }
        }
    }, [session]);

    const playTts = useCallback((b64, mime) => {
        try {
            const bin = atob(b64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            const blob = new Blob([bytes], { type: mime });
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audioElRef.current = audio;
            audio.onplay = () => setState(STATES.SPEAKING);
            const finish = () => {
                URL.revokeObjectURL(url);
                audioElRef.current = null;
                setState(STATES.IDLE);
            };
            audio.onended = finish;
            audio.onerror = finish;
            audio.play().catch(finish);
        } catch (err) {
            console.error('[useVoiceSession] playback error:', err);
            setState(STATES.IDLE);
        }
    }, []);

    const skipPlayback = useCallback(() => {
        if (audioElRef.current) {
            try { audioElRef.current.pause(); } catch (_) { /* noop */ }
            audioElRef.current = null;
        }
        setState(STATES.IDLE);
    }, []);

    const hangup = useCallback(() => {
        cleanup();
        setState(STATES.IDLE);
        setSession(null);
        setPartialReply('');
        setPartialTranscript('');
        setTurnTools([]);
        setError(null);
        setNotice(null);
    }, [cleanup]);

    return {
        state,
        STATES,
        session,
        partialReply,
        partialTranscript,
        turnTools,
        error,
        notice,
        latency,
        connect,
        startListening,
        stopListening,
        skipPlayback,
        hangup,
    };
}

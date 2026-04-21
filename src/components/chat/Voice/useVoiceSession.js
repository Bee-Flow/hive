/**
 * useVoiceSession — Continuous voice conversation hook (Beta v2).
 *
 * This revision removes the push-to-talk model entirely. Voice mode now
 * behaves like a phone call:
 *   - As soon as the session connects, the mic is hot.
 *   - An energy-based VAD (Voice Activity Detector) watches the stream.
 *   - When speech is detected, recording starts automatically.
 *   - When silence persists for SILENCE_MS, the turn is auto-submitted.
 *   - While TTS is playing, speech detection causes barge-in: playback
 *     stops and a new turn begins immediately.
 *
 * The host chat still owns message state — `getHistory` feeds prior
 * messages into each turn, `onTurnComplete` emits completed turns back
 * so they render as regular chat bubbles.
 *
 * Tuning constants at the top of the file. They favor responsiveness
 * over strict gating: a bit of background noise is OK because the
 * min-utterance cutoff discards clips that are too short to be speech,
 * and Voxtral's STT returns empty text for nonsense which the hook
 * treats as a no-op.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE, authFetch } from '../../../utils/helpers';

const STATES = {
    IDLE: 'idle',           // mic hot, waiting for speech
    LISTENING: 'listening', // actively capturing speech
    THINKING: 'thinking',   // STT + LLM in flight
    SPEAKING: 'speaking',   // TTS playing (barge-in enabled)
    ERROR: 'error',
};

// ─── VAD tuning ────────────────────────────────────────────────
const VAD_FFT_SIZE = 1024;              // analyser block size
const VAD_POLL_MS = 50;                 // evaluate energy 20×/s
const VAD_SPEECH_RMS = 0.018;           // start-of-speech threshold
const VAD_SILENCE_RMS = 0.012;          // end-of-speech threshold (hysteresis)
const VAD_SILENCE_MS = 900;             // trailing silence to end a turn
const VAD_MIN_UTTERANCE_MS = 400;       // discard anything shorter
const VAD_MAX_UTTERANCE_MS = 30_000;    // hard cap — always flush at 30s

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
 * @param {({user, assistant}) => void} [options.onTurnComplete]
 */
export default function useVoiceSession({ getHistory, onTurnComplete } = {}) {
    const [state, setState] = useState(STATES.IDLE);
    const [session, setSession] = useState(null);
    const [partialReply, setPartialReply] = useState('');
    const [partialTranscript, setPartialTranscript] = useState('');
    const [turnTools, setTurnTools] = useState([]);
    const [level, setLevel] = useState(0);          // 0..1 mic energy for the UI meter
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [latency, setLatency] = useState(null);

    const mediaStreamRef = useRef(null);
    const audioCtxRef = useRef(null);
    const analyserRef = useRef(null);
    const vadIntervalRef = useRef(null);
    const recorderRef = useRef(null);
    const chunksRef = useRef([]);
    const audioElRef = useRef(null);
    const abortRef = useRef(null);
    const stateRef = useRef(STATES.IDLE);
    const speechStartRef = useRef(0);
    const lastVoiceAtRef = useRef(0);
    const speakingRef = useRef(false);
    const getHistoryRef = useRef(getHistory);
    const onTurnCompleteRef = useRef(onTurnComplete);
    const voiceActiveRef = useRef(false);           // true from connect() until hangup()

    useEffect(() => { getHistoryRef.current = getHistory; }, [getHistory]);
    useEffect(() => { onTurnCompleteRef.current = onTurnComplete; }, [onTurnComplete]);

    const setStateSync = useCallback((next) => {
        stateRef.current = next;
        setState(next);
    }, []);

    const stopVad = useCallback(() => {
        if (vadIntervalRef.current) {
            clearInterval(vadIntervalRef.current);
            vadIntervalRef.current = null;
        }
    }, []);

    const cleanup = useCallback(() => {
        voiceActiveRef.current = false;
        stopVad();
        try { recorderRef.current?.stop(); } catch (_) { /* noop */ }
        try { mediaStreamRef.current?.getTracks().forEach(t => t.stop()); } catch (_) { /* noop */ }
        try { audioCtxRef.current?.close(); } catch (_) { /* noop */ }
        try { abortRef.current?.abort(); } catch (_) { /* noop */ }
        try { audioElRef.current?.pause(); } catch (_) { /* noop */ }
        recorderRef.current = null;
        mediaStreamRef.current = null;
        audioCtxRef.current = null;
        analyserRef.current = null;
        abortRef.current = null;
        audioElRef.current = null;
        chunksRef.current = [];
        speakingRef.current = false;
    }, [stopVad]);

    useEffect(() => () => cleanup(), [cleanup]);

    /* ── Recording helpers ─────────────────────────────────── */

    const startRecording = useCallback(() => {
        if (!mediaStreamRef.current) return;
        if (recorderRef.current && recorderRef.current.state !== 'inactive') return;

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
            setStateSync(STATES.ERROR);
        };
        recorderRef.current = recorder;
        recorder.start();
        speechStartRef.current = performance.now();
        setPartialTranscript('');
        setPartialReply('');
        setTurnTools([]);
        setStateSync(STATES.LISTENING);
    }, [setStateSync]);

    const finishRecording = useCallback(async (submit) => {
        const recorder = recorderRef.current;
        if (!recorder || recorder.state === 'inactive') return;

        const blobPromise = new Promise((resolve) => {
            recorder.onstop = () => {
                const mimeType = recorder.mimeType || 'audio/webm';
                const blob = new Blob(chunksRef.current, { type: mimeType });
                chunksRef.current = [];
                resolve({ blob, mimeType });
            };
            try { recorder.stop(); } catch (_) { resolve({ blob: null, mimeType: 'audio/webm' }); }
        });
        const { blob, mimeType } = await blobPromise;

        if (!submit || !blob || !blob.size) {
            if (voiceActiveRef.current) setStateSync(STATES.IDLE);
            return;
        }
        await submitTurn(blob, mimeType);
        // After submission, state transitions are driven by SSE events and
        // the TTS lifecycle. The VAD keeps polling in the background.
    }, [setStateSync]);

    /* ── VAD loop ──────────────────────────────────────────── */

    const vadTick = useCallback(() => {
        const analyser = analyserRef.current;
        if (!analyser) return;

        const buf = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        setLevel(Math.min(1, rms * 8));

        const now = performance.now();
        const cur = stateRef.current;

        // Barge-in: user starts speaking while TTS plays → interrupt.
        if (cur === STATES.SPEAKING && rms > VAD_SPEECH_RMS) {
            try { audioElRef.current?.pause(); } catch (_) { /* noop */ }
            audioElRef.current = null;
            speakingRef.current = true;
            lastVoiceAtRef.current = now;
            startRecording();
            return;
        }

        // THINKING: server is working, don't capture more audio.
        if (cur === STATES.THINKING) return;

        // IDLE: waiting for speech. Start recording on first voiced frame.
        if (!speakingRef.current) {
            if (rms > VAD_SPEECH_RMS) {
                speakingRef.current = true;
                lastVoiceAtRef.current = now;
                startRecording();
            }
            return;
        }

        // LISTENING: already capturing. Track trailing silence.
        if (rms > VAD_SILENCE_RMS) {
            lastVoiceAtRef.current = now;
        }
        const trailingSilenceMs = now - lastVoiceAtRef.current;
        const utteranceMs = now - speechStartRef.current;

        if (trailingSilenceMs >= VAD_SILENCE_MS || utteranceMs >= VAD_MAX_UTTERANCE_MS) {
            const wasLongEnough = utteranceMs >= VAD_MIN_UTTERANCE_MS;
            speakingRef.current = false;
            if (wasLongEnough) {
                setStateSync(STATES.THINKING);
                finishRecording(true);
            } else {
                // Too short — drop it, resume listening without a turn.
                finishRecording(false);
            }
        }
    }, [finishRecording, startRecording, setStateSync]);

    /* ── Connect / hangup ──────────────────────────────────── */

    const connect = useCallback(async (opts = {}) => {
        setError(null);
        setNotice(null);
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

            // Set up the VAD pipeline.
            // NB: AudioContext sample rate may differ from mic capture rate,
            // but for energy-based VAD the absolute rate doesn't matter — we
            // only care about relative amplitude.
            const AudioCtxCtor = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioCtxCtor();
            audioCtxRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = VAD_FFT_SIZE;
            source.connect(analyser);
            analyserRef.current = analyser;

            voiceActiveRef.current = true;
            speakingRef.current = false;
            setStateSync(STATES.IDLE);
            vadIntervalRef.current = setInterval(vadTick, VAD_POLL_MS);

            return data;
        } catch (err) {
            console.error('[useVoiceSession] connect error:', err);
            setError(err.message || 'Could not start voice session');
            setStateSync(STATES.ERROR);
            cleanup();
            throw err;
        }
    }, [cleanup, setStateSync, vadTick]);

    /* ── Turn submission (SSE stream parser) ───────────────── */

    const submitTurn = useCallback(async (blob, mimeType) => {
        setPartialReply('');

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
            if (err.name === 'AbortError') {
                if (voiceActiveRef.current) setStateSync(STATES.IDLE);
                return;
            }
            setError(err.message || 'Network error');
            setStateSync(STATES.ERROR);
            return;
        }

        if (!resp.ok || !resp.body) {
            const j = await resp.json().catch(() => ({}));
            setError(j.message || j.error || `Voice turn failed (${resp.status})`);
            setStateSync(STATES.ERROR);
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
                    upsertTool(data.id, { name: data.name, input: data.input, status: 'running', round: data.round ?? 0 });
                    break;
                case 'tool_result':
                    upsertTool(data.id, { name: data.name, status: data.ok ? 'done' : 'error', summary: data.summary || (data.ok ? 'ok' : 'failed') });
                    break;
                case 'llm_done':
                    if (Array.isArray(data.rounds) && data.rounds.length > 0) {
                        metrics.ttftMs = data.rounds[0]?.ttftMs ?? null;
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
                        setNotice('Voxtral TTS needs a voice to speak with. Create one via POST /v1/audio/voices on api.mistral.ai, or add an ElevenLabs API key as a fallback. Showing transcript only for now.');
                    } else if (data.reason === 'tts_failed') {
                        setNotice('Voice synthesis failed — showing transcript only. Check server logs for details.');
                    } else {
                        setNotice('No text-to-speech provider is configured. Add a Voxtral voice on api.mistral.ai or an ElevenLabs API key in Admin → AI Config.');
                    }
                    break;
                case 'error':
                    setError(data.message || 'Voice turn failed');
                    setStateSync(STATES.ERROR);
                    break;
                case 'done':
                    if (userText && onTurnCompleteRef.current) {
                        const frozenTools = turnToolsLocal.map(t => ({ ...t }));
                        onTurnCompleteRef.current({
                            user: { role: 'user', content: userText, source: 'voice' },
                            assistant: assistantText || frozenTools.length
                                ? { role: 'assistant', content: assistantText, source: 'voice', tools: frozenTools }
                                : null,
                        });
                    }
                    setPartialTranscript('');
                    setPartialReply('');
                    setTurnTools([]);
                    setLatency({ ...metrics, totalMs: Date.now() - startedAt });
                    if (!ttsPlayed && voiceActiveRef.current) setStateSync(STATES.IDLE);
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
    }, [session, setStateSync]);

    const playTts = useCallback((b64, mime) => {
        try {
            const bin = atob(b64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            const blob = new Blob([bytes], { type: mime });
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audioElRef.current = audio;
            audio.onplay = () => setStateSync(STATES.SPEAKING);
            const finish = () => {
                URL.revokeObjectURL(url);
                audioElRef.current = null;
                if (voiceActiveRef.current) setStateSync(STATES.IDLE);
            };
            audio.onended = finish;
            audio.onerror = finish;
            audio.play().catch(finish);
        } catch (err) {
            console.error('[useVoiceSession] playback error:', err);
            if (voiceActiveRef.current) setStateSync(STATES.IDLE);
        }
    }, [setStateSync]);

    const hangup = useCallback(() => {
        cleanup();
        setStateSync(STATES.IDLE);
        setSession(null);
        setPartialReply('');
        setPartialTranscript('');
        setTurnTools([]);
        setError(null);
        setNotice(null);
        setLevel(0);
    }, [cleanup, setStateSync]);

    return {
        state,
        STATES,
        session,
        partialReply,
        partialTranscript,
        turnTools,
        level,
        error,
        notice,
        latency,
        connect,
        hangup,
    };
}

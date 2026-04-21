/**
 * useVoiceSession — Realtime voice conversation hook (Beta v1.1).
 *
 * Turn-based streaming:
 *   1. Caller starts listening → MediaRecorder captures audio/webm;opus.
 *   2. Caller stops listening → hook POSTs the blob to /ai/voice/turn.
 *   3. Server SSE responds with:
 *        transcript → text deltas → (tool_use + tool_result)* → tts → done.
 *   4. Hook plays the TTS audio and appends transcript + reply + tool
 *      usage to history.
 *
 * The hook owns: microphone stream, recorder, audio playback, history
 * (incl. per-turn tool usage), transport errors, and a compact state
 * machine (idle → listening → thinking → speaking → idle). Components
 * only read state and call start/stop/hangup.
 *
 * Agent mode: pass { agentId, agentName } to connect() to run the voice
 * session against a specific agent's system prompt and tool set.
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
    // Safari still lags on Opus-in-WebM; fall back to mp4/aac if needed.
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

export default function useVoiceSession() {
    const [state, setState] = useState(STATES.IDLE);
    const [session, setSession] = useState(null);
    // history entries:
    //   { role: 'user',      content }
    //   { role: 'assistant', content, tools?: [{id,name,status,summary}] }
    const [history, setHistory] = useState([]);
    const [partialReply, setPartialReply] = useState('');
    const [partialTranscript, setPartialTranscript] = useState('');
    const [turnTools, setTurnTools] = useState([]); // per-turn, cleared on done
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [latency, setLatency] = useState(null);

    const mediaStreamRef = useRef(null);
    const recorderRef = useRef(null);
    const chunksRef = useRef([]);
    const audioElRef = useRef(null);
    const abortRef = useRef(null);

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

    /** Provision a server-side voice session and acquire the microphone. */
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

    /** Start capturing the user's speech. */
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

    /** Stop capturing and submit the turn. */
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

    /** Send the recorded blob and stream the response. */
    const submitTurn = useCallback(async (blob, mimeType) => {
        setState(STATES.THINKING);
        setPartialReply('');
        setError(null);
        // Keep prior `notice` visible until explicitly replaced — a "create a
        // voice" hint should persist across turns until the admin fixes it.

        const form = new FormData();
        const ext = (mimeType.split('/')[1] || 'webm').split(';')[0];
        form.append('audio', blob, `turn.${ext}`);
        // Only the LLM-relevant history is sent back to the server. Tool
        // chips in the UI come from per-turn SSE events; we don't replay
        // them to the server since the tool-call/result pairs live inside
        // the assistant `tool_calls`/tool messages on the server side of
        // each turn's loop, not across turns.
        const serverHistory = history.map(({ role, content }) => ({ role, content }));
        form.append('history', JSON.stringify(serverHistory));
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

        // SSE parsing.
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let userText = '';
        let assistantText = '';
        let ttsPlayed = false;
        const turnToolsLocal = []; // accumulate here, mirror to state for UI
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
                    // Commit history: attach the completed tool list to the
                    // assistant message so chips remain visible between turns.
                    if (userText) {
                        const frozenTools = turnToolsLocal.map(t => ({ ...t }));
                        setHistory(h => [
                            ...h,
                            { role: 'user', content: userText },
                            ...(assistantText || frozenTools.length
                                ? [{ role: 'assistant', content: assistantText, tools: frozenTools }]
                                : []),
                        ]);
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
    }, [history, session]);

    /** Decode and play a base64-encoded TTS audio clip inline. */
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

    /** Skip the current TTS playback (barge-in). */
    const skipPlayback = useCallback(() => {
        if (audioElRef.current) {
            try { audioElRef.current.pause(); } catch (_) { /* noop */ }
            audioElRef.current = null;
        }
        setState(STATES.IDLE);
    }, []);

    /** Tear everything down and return to a clean slate. */
    const hangup = useCallback(() => {
        cleanup();
        setState(STATES.IDLE);
        setSession(null);
        setHistory([]);
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
        history,
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

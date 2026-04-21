/**
 * VoiceCallModal — Beta voice chat UI.
 *
 * A minimal full-screen overlay with:
 *   - a prominent talk button (click to start, click again to send),
 *   - a live transcript of the current turn,
 *   - the assistant's streaming reply,
 *   - a small latency HUD (STT / LLM TTFT / TTS / total),
 *   - hangup.
 *
 * Auto-starts the session on mount. Closes on hangup.
 */

import React, { useEffect, useState } from 'react';
import { Mic, MicOff, PhoneOff, Loader2, Volume2, AlertTriangle } from 'lucide-react';
import useVoiceSession from './useVoiceSession';

export default function VoiceCallModal({ open, onClose, agentName }) {
    const voice = useVoiceSession();
    const [connecting, setConnecting] = useState(false);

    // Auto-connect when the modal opens.
    useEffect(() => {
        if (!open) return;
        setConnecting(true);
        voice.connect()
            .catch(() => { /* error is already in voice.error */ })
            .finally(() => setConnecting(false));
        return () => voice.hangup();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    if (!open) return null;

    const { state, STATES, history, partialReply, partialTranscript, error, latency } = voice;

    const isListening = state === STATES.LISTENING;
    const isThinking = state === STATES.THINKING;
    const isSpeaking = state === STATES.SPEAKING;

    const toggleMic = async () => {
        if (isListening) {
            await voice.stopListening();
        } else if (state === STATES.IDLE || state === STATES.ERROR) {
            voice.startListening();
        } else if (isSpeaking) {
            voice.skipPlayback();
            voice.startListening();
        }
    };

    const handleHangup = () => {
        voice.hangup();
        onClose?.();
    };

    const statusLabel = () => {
        if (connecting) return 'Connecting…';
        if (error) return 'Error';
        if (isListening) return 'Listening — click mic to send';
        if (isThinking) return 'Thinking…';
        if (isSpeaking) return 'Speaking…';
        return 'Click the microphone to speak';
    };

    return (
        <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Voice chat"
        >
            <div className="relative w-full max-w-lg mx-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-primary)] shadow-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            Beta
                        </span>
                        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                            Voice Chat{agentName ? ` — ${agentName}` : ''}
                        </h2>
                    </div>
                    <button
                        onClick={handleHangup}
                        className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]"
                        aria-label="End call"
                    >
                        <PhoneOff className="w-5 h-5" />
                    </button>
                </div>

                {/* Transcript area */}
                <div className="min-h-[160px] max-h-[320px] overflow-y-auto rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] p-4 mb-4 text-sm space-y-3">
                    {history.length === 0 && !partialTranscript && !partialReply && !error && (
                        <p className="text-[var(--text-tertiary)] italic">
                            Start by clicking the microphone and saying hello. Keep replies short — this mode is tuned for natural spoken conversation.
                        </p>
                    )}
                    {history.map((m, i) => (
                        <div key={i} className={m.role === 'user' ? 'text-[var(--text-primary)]' : 'text-[var(--accent-primary)]'}>
                            <span className="font-semibold mr-2">{m.role === 'user' ? 'You' : 'Assistant'}:</span>
                            {m.content}
                        </div>
                    ))}
                    {partialTranscript && state !== STATES.IDLE && (
                        <div className="text-[var(--text-primary)] opacity-70">
                            <span className="font-semibold mr-2">You:</span>
                            {partialTranscript}
                        </div>
                    )}
                    {partialReply && (
                        <div className="text-[var(--accent-primary)]">
                            <span className="font-semibold mr-2">Assistant:</span>
                            {partialReply}
                            {isThinking && <span className="inline-block w-2 h-4 bg-current ml-1 animate-pulse" />}
                        </div>
                    )}
                </div>

                {error && (
                    <div className="mb-4 flex items-start gap-2 text-sm rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 p-3">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Controls */}
                <div className="flex flex-col items-center gap-3">
                    <button
                        onClick={toggleMic}
                        disabled={connecting || isThinking}
                        className={[
                            'relative w-20 h-20 rounded-full flex items-center justify-center transition-all',
                            isListening
                                ? 'bg-red-500 text-white shadow-[0_0_0_8px_rgba(239,68,68,0.15)]'
                                : isThinking
                                    ? 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] cursor-not-allowed'
                                    : isSpeaking
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-[var(--accent-primary)] text-white hover:scale-105',
                        ].join(' ')}
                        aria-label={isListening ? 'Send' : 'Record'}
                    >
                        {connecting || isThinking ? (
                            <Loader2 className="w-8 h-8 animate-spin" />
                        ) : isListening ? (
                            <MicOff className="w-8 h-8" />
                        ) : isSpeaking ? (
                            <Volume2 className="w-8 h-8" />
                        ) : (
                            <Mic className="w-8 h-8" />
                        )}
                        {isListening && (
                            <span className="absolute inset-0 rounded-full animate-ping bg-red-500/40" />
                        )}
                    </button>
                    <p className="text-sm text-[var(--text-tertiary)]">{statusLabel()}</p>
                </div>

                {/* Latency HUD */}
                {latency && (
                    <div className="mt-4 flex items-center justify-center gap-4 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                        {latency.sttMs != null && <span>STT {latency.sttMs}ms</span>}
                        {latency.ttftMs != null && <span>TTFT {latency.ttftMs}ms</span>}
                        {latency.ttsMs != null && <span>TTS {latency.ttsMs}ms</span>}
                        {latency.totalMs != null && <span>Total {latency.totalMs}ms</span>}
                    </div>
                )}

                <p className="mt-4 text-center text-[10px] text-[var(--text-tertiary)]">
                    Audio is processed via Mistral Voxtral. Voice chat is a Beta feature — your feedback shapes v2.
                </p>
            </div>
        </div>
    );
}

/**
 * VoiceInlinePanel — Embedded voice UI that replaces the textarea inside
 * the composer while voice mode is active.
 *
 * Design choices:
 *   - No overlay / no backdrop. The panel mounts inline inside InputArea
 *     so the host chat remains visible above it.
 *   - Completed voice turns do NOT render here — they flow up to the
 *     chat via `onTurnComplete` and render as regular MessageItem bubbles.
 *     This panel only shows the IN-FLIGHT turn: partial transcript,
 *     running tool chips, partial reply.
 *   - Matches the composer's rounded-2xl card so it feels like the same
 *     input surface, just a different mode.
 */

import React, { useEffect, useState } from 'react';
import {
    Mic, MicOff, PhoneOff, Loader2, Volume2, AlertTriangle,
    Info, Wrench, Check, X,
} from 'lucide-react';
import useVoiceSession from './useVoiceSession';

function ToolChip({ tool }) {
    const running = tool.status === 'running';
    const ok = tool.status === 'done';
    const failed = tool.status === 'error';

    const label = tool.name?.replace(/_/g, ' ') || 'tool';
    const title = tool.summary ? `${tool.name} — ${tool.summary}` : tool.name || '';

    const colorClasses = running
        ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
        : ok
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : failed
                ? 'bg-red-500/10 border-red-500/30 text-red-300'
                : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)] text-[var(--text-tertiary)]';

    return (
        <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${colorClasses}`}
            title={title}
        >
            {running ? <Loader2 className="w-3 h-3 animate-spin" />
                : ok ? <Check className="w-3 h-3" />
                    : failed ? <X className="w-3 h-3" />
                        : <Wrench className="w-3 h-3" />}
            <span className="font-mono">{label}</span>
            {tool.summary && (ok || failed) && (
                <span className="opacity-70 ml-1 truncate max-w-[160px]">· {tool.summary}</span>
            )}
        </span>
    );
}

export default function VoiceInlinePanel({
    agentId = null,
    agentName = null,
    getHistory,
    onTurnComplete,
    onExit,
    isMobile = false,
}) {
    const voice = useVoiceSession({ getHistory, onTurnComplete });
    const [connecting, setConnecting] = useState(false);

    // Auto-connect on mount. Hangup on unmount releases the mic.
    useEffect(() => {
        setConnecting(true);
        voice.connect({ agentId: agentId || null })
            .catch(() => { /* surfaced via voice.error */ })
            .finally(() => setConnecting(false));
        return () => voice.hangup();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agentId]);

    const {
        state, STATES, partialReply, partialTranscript, turnTools,
        error, notice, latency, session,
    } = voice;

    const isListening = state === STATES.LISTENING;
    const isThinking = state === STATES.THINKING;
    const isSpeaking = state === STATES.SPEAKING;
    const resolvedAgentName = agentName || session?.agentName || null;

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
        onExit?.();
    };

    const statusLabel = () => {
        if (connecting) return 'Connecting…';
        if (error) return 'Error — click the phone to exit.';
        if (isListening) return 'Listening — click the mic to send.';
        if (isThinking) {
            const running = turnTools.filter(t => t.status === 'running');
            if (running.length) return `Running ${running.map(t => t.name).join(', ')}…`;
            return 'Thinking…';
        }
        if (isSpeaking) return 'Speaking — click the mic to interrupt.';
        return 'Click the microphone to speak.';
    };

    const showLiveTurn =
        !!partialTranscript ||
        !!partialReply ||
        turnTools.length > 0;

    return (
        <div
            className="relative flex flex-col bg-[var(--bg-secondary)] rounded-2xl border border-emerald-500/30 shadow-md ring-1 ring-emerald-500/10"
            role="region"
            aria-label="Voice chat mode"
        >
            {/* Header strip — shows we're in voice mode */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-2 text-xs">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        Beta
                    </span>
                    <span className="text-[var(--text-secondary)] font-medium">
                        Voice mode{resolvedAgentName ? ` — ${resolvedAgentName}` : ''}
                    </span>
                    <span className="text-[var(--text-tertiary)] hidden sm:inline">· using chat history</span>
                </div>
                <button
                    onClick={handleHangup}
                    className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-red-400 transition-colors"
                    title="Exit voice mode"
                    aria-label="Exit voice mode"
                >
                    <PhoneOff className="w-4 h-4" />
                </button>
            </div>

            {/* Live turn preview — transient, cleared on turn-complete */}
            {showLiveTurn && (
                <div className="px-4 py-3 text-sm space-y-2 border-b border-[var(--border-subtle)]">
                    {partialTranscript && state !== STATES.IDLE && (
                        <div className="text-[var(--text-primary)] opacity-80">
                            <span className="font-semibold mr-2">You:</span>
                            {partialTranscript}
                        </div>
                    )}
                    {turnTools.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {turnTools.map(t => <ToolChip key={t.id} tool={t} />)}
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
            )}

            {/* Banners */}
            {error && (
                <div className="mx-4 mt-3 flex items-start gap-2 text-xs rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 p-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}
            {notice && !error && (
                <div className="mx-4 mt-3 flex items-start gap-2 text-xs rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 p-2.5">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{notice}</span>
                </div>
            )}

            {/* Mic + status row */}
            <div className={`flex items-center gap-4 ${isMobile ? 'px-3 py-3' : 'px-4 py-4'}`}>
                <button
                    onClick={toggleMic}
                    disabled={connecting || isThinking}
                    className={[
                        'relative flex items-center justify-center rounded-full transition-all shrink-0',
                        isMobile ? 'w-12 h-12' : 'w-14 h-14',
                        isListening
                            ? 'bg-red-500 text-white shadow-[0_0_0_6px_rgba(239,68,68,0.15)]'
                            : isThinking
                                ? 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] cursor-not-allowed'
                                : isSpeaking
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-[var(--accent-primary)] text-white hover:scale-105',
                    ].join(' ')}
                    aria-label={isListening ? 'Send voice turn' : 'Start recording'}
                >
                    {connecting || isThinking ? (
                        <Loader2 className={isMobile ? 'w-5 h-5 animate-spin' : 'w-6 h-6 animate-spin'} />
                    ) : isListening ? (
                        <MicOff className={isMobile ? 'w-5 h-5' : 'w-6 h-6'} />
                    ) : isSpeaking ? (
                        <Volume2 className={isMobile ? 'w-5 h-5' : 'w-6 h-6'} />
                    ) : (
                        <Mic className={isMobile ? 'w-5 h-5' : 'w-6 h-6'} />
                    )}
                    {isListening && (
                        <span className="absolute inset-0 rounded-full animate-ping bg-red-500/40" />
                    )}
                </button>

                <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-primary)] font-medium">{statusLabel()}</p>
                    {latency && (
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] uppercase tracking-wider text-[var(--text-tertiary)]">
                            {latency.sttMs != null && <span>STT {latency.sttMs}ms</span>}
                            {latency.ttftMs != null && <span>TTFT {latency.ttftMs}ms</span>}
                            {latency.ttsMs != null && <span>TTS {latency.ttsMs}ms</span>}
                            {latency.totalMs != null && <span>Total {latency.totalMs}ms</span>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

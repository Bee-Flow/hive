/**
 * VoiceInlinePanel — Embedded, always-on voice UI (Beta v2).
 *
 * The mic is hot from the moment voice mode starts. A client-side VAD
 * in useVoiceSession auto-detects utterance boundaries and submits each
 * turn without any click. This panel is purely visual feedback:
 *   - a live energy ring that pulses with mic activity,
 *   - a status line that mirrors the hook's state machine,
 *   - the in-flight transcript / reply / tool chips for the current turn,
 *   - a single hangup button to exit voice mode.
 *
 * Completed voice turns do NOT render here — they flow up to the chat
 * via onTurnComplete and appear as regular MessageItem bubbles.
 */

import React, { useEffect, useState } from 'react';
import {
    Mic, PhoneOff, Loader2, Volume2, AlertTriangle,
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

/**
 * Live energy halo — pulses with mic amplitude. Cheap visual substitute
 * for a waveform that costs ~no CPU and reads instantly.
 */
function LevelIndicator({ level, state, STATES, isMobile }) {
    const isThinking = state === STATES.THINKING;
    const isSpeaking = state === STATES.SPEAKING;
    const isListening = state === STATES.LISTENING;
    const isError = state === STATES.ERROR;

    // Outer ring scales up to ~1.8× on loud input.
    const ringScale = 1 + Math.min(0.8, level * 1.2);
    // Core icon color reflects state.
    const coreClasses = isError
        ? 'bg-red-500 text-white'
        : isThinking
            ? 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
            : isSpeaking
                ? 'bg-emerald-500 text-white'
                : isListening
                    ? 'bg-red-500 text-white'
                    : 'bg-[var(--accent-primary)] text-white';

    const size = isMobile ? 'w-12 h-12' : 'w-14 h-14';

    return (
        <div className="relative flex items-center justify-center shrink-0" style={{ width: isMobile ? 56 : 72, height: isMobile ? 56 : 72 }}>
            {/* Outer pulsing ring — energy-driven */}
            <span
                className={`absolute inset-0 rounded-full transition-transform duration-75 ease-out ${
                    isListening ? 'bg-red-500/25'
                        : isSpeaking ? 'bg-emerald-500/25'
                            : isThinking ? 'bg-blue-500/15'
                                : 'bg-[var(--accent-primary)]/20'
                }`}
                style={{ transform: `scale(${ringScale})` }}
            />
            {/* Secondary steady ring */}
            <span
                className={`absolute inset-1 rounded-full ${
                    isListening ? 'bg-red-500/40 animate-pulse'
                        : isSpeaking ? 'bg-emerald-500/40 animate-pulse'
                            : 'bg-[var(--accent-primary)]/30'
                }`}
            />
            {/* Core */}
            <div className={`relative ${size} rounded-full flex items-center justify-center ${coreClasses}`}>
                {isThinking ? (
                    <Loader2 className={isMobile ? 'w-5 h-5 animate-spin' : 'w-6 h-6 animate-spin'} />
                ) : isSpeaking ? (
                    <Volume2 className={isMobile ? 'w-5 h-5' : 'w-6 h-6'} />
                ) : (
                    <Mic className={isMobile ? 'w-5 h-5' : 'w-6 h-6'} />
                )}
            </div>
        </div>
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
        level, error, notice, latency, session,
    } = voice;

    const resolvedAgentName = agentName || session?.agentName || null;

    const handleHangup = () => {
        voice.hangup();
        onExit?.();
    };

    const statusLabel = () => {
        if (connecting) return 'Connecting the line…';
        if (error) return 'Error — tap the phone to exit.';
        switch (state) {
            case STATES.LISTENING: return 'Hearing you…';
            case STATES.THINKING: {
                const running = turnTools.filter(t => t.status === 'running');
                return running.length
                    ? `Running ${running.map(t => t.name).join(', ')}…`
                    : 'Thinking…';
            }
            case STATES.SPEAKING: return 'Speaking — just start talking to interrupt.';
            default: return 'Listening — just start speaking.';
        }
    };

    const showLiveTurn = !!partialTranscript || !!partialReply || turnTools.length > 0;

    return (
        <div
            className="relative flex flex-col bg-[var(--bg-secondary)] rounded-2xl border border-emerald-500/30 shadow-md ring-1 ring-emerald-500/10"
            role="region"
            aria-label="Voice mode"
        >
            {/* Header strip */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-2 text-xs">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        Beta
                    </span>
                    <span className="text-[var(--text-secondary)] font-medium">
                        Voice mode{resolvedAgentName ? ` — ${resolvedAgentName}` : ''}
                    </span>
                    <span className="text-[var(--text-tertiary)] hidden sm:inline">· live · using chat history</span>
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

            {/* Live turn preview */}
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
                            {state === STATES.THINKING && (
                                <span className="inline-block w-2 h-4 bg-current ml-1 animate-pulse" />
                            )}
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

            {/* Live energy indicator + status */}
            <div className={`flex items-center gap-4 ${isMobile ? 'px-3 py-3' : 'px-4 py-4'}`}>
                <LevelIndicator level={level} state={state} STATES={STATES} isMobile={isMobile} />

                <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-primary)] font-medium">{statusLabel()}</p>
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                        The mic stays on. Just start speaking — I’ll pick it up automatically.
                    </p>
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

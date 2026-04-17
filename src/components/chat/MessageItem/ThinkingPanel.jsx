import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Brain, ChevronRight, Lock } from 'lucide-react';

// Normalise whatever shape we have for msg.thinking / msg.thinkingParts into a
// uniform array. Handles three cases:
//   1. Live streaming: msg.thinkingParts populated by useChatEngine.
//   2. Reloaded from history, new shape: msg.thinking is an array of parts.
//   3. Reloaded from history, legacy shape: msg.thinking is a string.
function resolveParts(msg) {
    if (Array.isArray(msg.thinkingParts) && msg.thinkingParts.length > 0) {
        return msg.thinkingParts;
    }
    if (Array.isArray(msg.thinking) && msg.thinking.length > 0) {
        return msg.thinking;
    }
    if (typeof msg.thinking === 'string' && msg.thinking) {
        return [{ id: 'legacy-0', text: msg.thinking, startedAt: null, endedAt: null }];
    }
    return [];
}

function computeDurationMs(parts, msg) {
    // Prefer top-level timestamps (set on stream start/end) — they're accurate
    // even when individual parts don't carry timing (legacy / redacted-only runs).
    if (msg.thinkingStartedAt && msg.thinkingEndedAt) {
        return Math.max(0, msg.thinkingEndedAt - msg.thinkingStartedAt);
    }
    const starts = parts.map(p => p.startedAt).filter(Boolean);
    const ends = parts.map(p => p.endedAt).filter(Boolean);
    if (starts.length === 0 || ends.length === 0) return null;
    return Math.max(0, Math.max(...ends) - Math.min(...starts));
}

function formatDuration(ms) {
    if (ms == null) return '';
    const sec = ms / 1000;
    if (sec < 60) return `${sec.toFixed(sec < 10 ? 1 : 0)}s`;
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}m ${s}s`;
}

export function ThinkingPanel({ msg }) {
    const parts = useMemo(() => resolveParts(msg), [msg.thinkingParts, msg.thinking]);
    const isStreaming = !!msg.isStreaming && parts.some(p => !p.endedAt);
    const hasContent = parts.length > 0 && (parts.some(p => p.text) || parts.some(p => p.redacted));

    // Live ticking elapsed counter. Uses thinkingStartedAt as anchor; if missing
    // (legacy reload), fall back to earliest part.startedAt.
    const [nowTick, setNowTick] = useState(() => Date.now());
    useEffect(() => {
        if (!isStreaming) return;
        const id = setInterval(() => setNowTick(Date.now()), 500);
        return () => clearInterval(id);
    }, [isStreaming]);

    // Auto-collapse shortly after streaming ends — keeps the final state visible
    // for a beat so the user sees the last tokens before it snaps shut.
    const [userOpened, setUserOpened] = useState(null); // null = auto, true/false = user-set
    const [autoOpen, setAutoOpen] = useState(true);
    const prevStreaming = useRef(isStreaming);
    useEffect(() => {
        if (prevStreaming.current && !isStreaming) {
            const t = setTimeout(() => setAutoOpen(false), 800);
            return () => clearTimeout(t);
        }
        if (!prevStreaming.current && isStreaming) {
            setAutoOpen(true);
        }
        prevStreaming.current = isStreaming;
    }, [isStreaming]);
    const open = userOpened ?? (isStreaming ? true : autoOpen);

    // Live-scroll the body to bottom while streaming.
    const bodyRef = useRef(null);
    useEffect(() => {
        if (isStreaming && bodyRef.current) {
            bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
        }
    });

    // A11y: announce only state transitions, never per-token. The body itself is
    // aria-hidden; a visually-hidden status div carries the transition announcements.
    const [a11yStatus, setA11yStatus] = useState('');
    useEffect(() => {
        if (isStreaming) {
            setA11yStatus('Thinking started');
        } else if (prevStreaming.current === false && a11yStatus === '') {
            // No-op on initial mount
        } else if (hasContent && !isStreaming) {
            const dur = computeDurationMs(parts, msg);
            setA11yStatus(`Thought for ${formatDuration(dur)}, answer ready`);
        }
    }, [isStreaming]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!hasContent && !isStreaming) return null;

    const totalDurationMs = computeDurationMs(parts, msg) ?? (
        isStreaming && msg.thinkingStartedAt ? nowTick - msg.thinkingStartedAt : null
    );

    const headerLabel = isStreaming
        ? 'Thinking…'
        : totalDurationMs != null
            ? `Thought for ${formatDuration(totalDurationMs)}`
            : 'Reasoning';

    const isRedactedOnly = parts.length > 0 && parts.every(p => p.redacted);

    return (
        <div
            className="mb-3"
            role="log"
            aria-live="polite"
            aria-atomic="false"
            aria-label="Model thinking"
        >
            {/* State-change announcements for screen readers. Never mutates per-token. */}
            <div className="sr-only" role="status">{a11yStatus}</div>

            <details
                className="group/thinking rounded-lg border border-purple-500/15 bg-purple-500/5"
                open={open}
                onToggle={(e) => setUserOpened(e.currentTarget.open)}
            >
                <summary
                    className="flex items-center gap-2 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden px-3 py-2"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    <Brain
                        className={`w-3.5 h-3.5 text-purple-400 flex-shrink-0 ${isStreaming ? 'animate-pulse' : ''}`}
                    />
                    <span className="text-xs font-medium">{headerLabel}</span>

                    {isStreaming && (
                        <>
                            <span className="flex items-center gap-0.5 ml-0.5" aria-hidden="true">
                                <span className="w-1 h-1 rounded-full bg-purple-400 animate-bounce" />
                                <span className="w-1 h-1 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '75ms' }} />
                                <span className="w-1 h-1 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                            </span>
                            {totalDurationMs != null && totalDurationMs > 1000 && (
                                <span className="text-[10px] text-purple-400/70 ml-1">
                                    · {formatDuration(totalDurationMs)}
                                </span>
                            )}
                        </>
                    )}

                    {isRedactedOnly && (
                        <Lock className="w-3 h-3 text-purple-400/60 ml-1" aria-label="Redacted" />
                    )}

                    <ChevronRight
                        className="w-3 h-3 ml-auto opacity-40 transition-transform group-open/thinking:rotate-90"
                        aria-hidden="true"
                    />
                </summary>

                {/* Skip-to-answer link only while streaming */}
                {isStreaming && (
                    <a
                        href="#answer-start"
                        className="sr-only focus:not-sr-only focus:block focus:px-3 focus:py-1 focus:text-xs focus:text-purple-300 focus:underline"
                    >
                        Skip to answer
                    </a>
                )}

                <div
                    ref={bodyRef}
                    className="px-3 pb-2.5 max-h-[280px] overflow-y-auto custom-scrollbar"
                    aria-hidden="true"
                >
                    {parts.map((part, idx) => (
                        <ThinkingPart
                            key={part.id || idx}
                            part={part}
                            showDivider={idx > 0}
                            isLive={isStreaming && !part.endedAt}
                        />
                    ))}
                </div>
            </details>
        </div>
    );
}

function ThinkingPart({ part, showDivider, isLive }) {
    if (part.redacted && !part.text) {
        return (
            <div className={`flex items-center gap-2 py-2 ${showDivider ? 'border-t border-purple-500/10 mt-2' : ''}`}>
                <Lock className="w-3 h-3 text-purple-400/60" />
                <span className="text-[11px] italic text-[var(--text-tertiary)]">
                    Thinking summary hidden by provider
                </span>
            </div>
        );
    }
    return (
        <div className={showDivider ? 'border-t border-purple-500/10 pt-2 mt-2' : ''}>
            {part.phase && (
                <span className="inline-block text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 font-semibold uppercase tracking-wider mb-1">
                    {part.phase}
                </span>
            )}
            <div
                className="text-xs whitespace-pre-wrap leading-relaxed"
                style={{ fontStyle: 'italic', opacity: 0.8, color: 'var(--text-secondary)' }}
            >
                {part.text}
                {isLive && (
                    <span className="inline-block w-1.5 h-3.5 bg-purple-400/60 ml-0.5 animate-pulse align-text-bottom" />
                )}
            </div>
        </div>
    );
}

export default ThinkingPanel;

import React, { useEffect, useRef, useState } from 'react';
import { Brain, ChevronRight } from 'lucide-react';

/**
 * Collapsible reasoning block for the builder chat — parity with direct/agent
 * chat's ThinkingPanel, but styled with the builder's neutral tokens (no
 * purple). Reads the same message shape: thinkingParts[{id,text,startedAt,
 * endedAt,redacted}] + thinkingStartedAt/thinkingEndedAt + isStreaming.
 */
export default function BuilderThinkingBlock({ msg }) {
    const parts = Array.isArray(msg.thinkingParts) ? msg.thinkingParts : [];
    const isStreaming = !!msg.isStreaming && parts.some(p => !p.endedAt);
    const hasContent = parts.some(p => (p.text && p.text.trim()) || p.redacted);

    const [userOpen, setUserOpen] = useState(null); // null = auto
    const [autoOpen, setAutoOpen] = useState(true);
    const [nowTs, setNowTs] = useState(() => Date.now()); // ticks the live elapsed counter
    const prevStreaming = useRef(isStreaming);
    const bodyRef = useRef(null);

    useEffect(() => {
        if (!isStreaming) return;
        const id = setInterval(() => setNowTs(Date.now()), 500);
        return () => clearInterval(id);
    }, [isStreaming]);

    useEffect(() => {
        // Auto-collapse shortly after streaming ends. While streaming, `open`
        // is forced true below, so no need to re-open here (avoids a
        // synchronous setState in the effect).
        if (prevStreaming.current && !isStreaming) {
            const t = setTimeout(() => setAutoOpen(false), 800);
            prevStreaming.current = isStreaming;
            return () => clearTimeout(t);
        }
        prevStreaming.current = isStreaming;
    }, [isStreaming]);

    useEffect(() => {
        if (isStreaming && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    });

    if (!hasContent && !isStreaming) return null;

    const open = userOpen ?? (isStreaming ? true : autoOpen);
    const endTs = msg.thinkingEndedAt || (isStreaming ? nowTs : null);
    const durMs = (msg.thinkingStartedAt && endTs) ? (endTs - msg.thinkingStartedAt) : null;
    const durLabel = durMs == null ? ''
        : durMs < 60000 ? `${(durMs / 1000).toFixed(durMs < 10000 ? 1 : 0)}s`
            : `${Math.floor(durMs / 60000)}m ${Math.round((durMs % 60000) / 1000)}s`;
    const label = isStreaming ? 'Thinking…' : (durMs != null ? `Thought for ${durLabel}` : 'Reasoning');
    const text = parts.map(p => (p.redacted && !p.text ? '[reasoning hidden by provider]' : p.text)).join('\n\n');

    return (
        <details
            className="group/think mb-2 w-full max-w-3xl rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)]/50"
            open={open}
            onToggle={(e) => setUserOpen(e.currentTarget.open)}
        >
            <summary
                className="flex items-center gap-2 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden px-3 py-2 text-[var(--text-secondary)]"
            >
                <Brain size={13} className={`flex-shrink-0 ${isStreaming ? 'animate-pulse' : ''}`} />
                <span className="text-xs font-medium">{label}</span>
                {isStreaming && (
                    <span className="flex items-center gap-0.5 ml-0.5" aria-hidden="true">
                        <span className="w-1 h-1 rounded-full bg-[var(--text-tertiary)] animate-bounce" />
                        <span className="w-1 h-1 rounded-full bg-[var(--text-tertiary)] animate-bounce" style={{ animationDelay: '75ms' }} />
                        <span className="w-1 h-1 rounded-full bg-[var(--text-tertiary)] animate-bounce" style={{ animationDelay: '150ms' }} />
                    </span>
                )}
                <ChevronRight size={12} className="ml-auto opacity-40 transition-transform group-open/think:rotate-90" />
            </summary>
            <div
                ref={bodyRef}
                className="px-3 pb-2.5 max-h-[260px] overflow-y-auto custom-scrollbar text-xs whitespace-pre-wrap leading-relaxed text-[var(--text-secondary)]"
                style={{ fontStyle: 'italic', opacity: 0.85 }}
            >
                {text}
                {isStreaming && <span className="inline-block w-1.5 h-3 bg-[var(--text-tertiary)] ml-0.5 animate-pulse align-text-bottom" />}
            </div>
        </details>
    );
}

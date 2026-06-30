import React from 'react';
import MarkdownRenderer from '../../../../MarkdownRenderer';
import { tierLabel } from '../../../../tierMeta';
import BuilderThinkingBlock from './BuilderThinkingBlock';
import ToolCallChip from './ToolCallChip';

/**
 * Message bubble styled to match direct/agent chat:
 *   - 900px centered column (same as MessageItem outer container).
 *   - User: light grey #e8e8eb pill capped at 85%, bottom-right corner squared.
 *   - Assistant: no background — body sits directly on the chat surface, the
 *     same way direct chat renders so long markdown reads naturally instead
 *     of being trapped in a small grey bubble. Bottom-left corner squared
 *     to mirror the speech-bubble feel.
 *   - Markdown is rendered for assistant turns; user content is plain text
 *     with whitespace preserved.
 */
export default function MessageBubble({ msg }) {
    const isUser = msg.role === 'user';
    return (
        <div className={`flex flex-col w-full ${isUser ? 'items-end' : 'items-start'}`}>
            {!isUser && <BuilderThinkingBlock msg={msg} />}
            <div
                className={`relative rounded-2xl p-4 transition-all duration-200 overflow-hidden text-sm ${isUser
                    ? 'max-w-[85%] bg-[var(--user-bubble-bg,#e8e8eb)] text-[var(--user-bubble-fg,#000)] rounded-br-none whitespace-pre-wrap'
                    : 'max-w-3xl text-[var(--text-primary)] rounded-bl-none'}`}
            >
                {isUser ? msg.content : <MarkdownRenderer content={msg.content || ''} />}
            </div>
            {/* Auto-tier badge — same shape as direct chat's MessageItem.
                Shown only when the server resolved 'auto' to a real tier
                so the user knows which model produced this turn. */}
            {!isUser && msg.autoSelectedTier && (
                <div className="mt-1 text-[11px] text-[var(--text-tertiary)] px-1">
                    Auto → {tierLabel(msg.autoSelectedTier)}
                </div>
            )}
            {!isUser && Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0 && (
                <div className="mt-1.5 flex flex-col gap-1 w-full max-w-3xl">
                    {msg.toolCalls.map((tc, i) => <ToolCallChip key={i} tc={tc} />)}
                </div>
            )}
        </div>
    );
}

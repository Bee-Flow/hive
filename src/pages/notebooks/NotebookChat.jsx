import React, { useRef, useEffect, useState, useCallback } from 'react';
import { FileText, ArrowDown, Info, MessageSquare, Sparkles } from 'lucide-react';
import MessageItem from '../../components/chat/MessageItem';
import InputArea from '../../components/InputArea';
import EmptyState from '../../components/shared/EmptyState';
import CitationChips from './CitationChips';
import useTranslation from '../../hooks/useTranslation';

/* ── NotebookChat — AI chat panel for right side ─────────────── */
export default function NotebookChat({
    messages, isLoading, onSend, onStop, onRetry, onEdit,
    modelTiers, selectedTier, onTierChange,
    onInsertToDocument, kbSourcesLookup, onCitationClick,
    locked = false,
}) {
    const { t } = useTranslation();
    const endRef = useRef(null);
    const containerRef = useRef(null);
    const [copied, setCopied] = useState(false);
    const [chatInput, setChatInput] = useState('');

    /**
     * Follow the stream, but only while the user is already at the bottom.
     *
     * This fired on every `messages` change — i.e. every streamed token — with
     * no check, so scrolling back to re-read an earlier answer yanked you to
     * the bottom again a few milliseconds later. `containerRef` existed for
     * exactly this and was unused.
     */
    const stickToBottomRef = useRef(true);
    const onScroll = useCallback(() => {
        const el = containerRef.current;
        if (!el) return;
        // 40px of slack so a smooth-scroll landing just short still counts.
        stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    }, []);

    useEffect(() => {
        if (!stickToBottomRef.current) return;
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // A new turn always scrolls down, wherever the user was reading.
    useEffect(() => {
        if (!isLoading) return;
        stickToBottomRef.current = true;
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [isLoading]);

    const handleCopy = (content) => {
        navigator.clipboard.writeText(content).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col h-full">
            {/* Chat header (Studio-aligned: icon + title + subtitle) */}
            <div className="shrink-0 px-3 py-2 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
                <MessageSquare className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('notebooks.ai_chat', 'AI Chat')}</span>
                <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    {t('notebooks.chat_subtitle', 'Ask questions about your sources')}
                </span>
            </div>

            {/* Messages */}
            <div ref={containerRef} onScroll={onScroll} className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3 space-y-3">
                {/* Encrypted history without a session key: say so, instead of
                    implying an empty thread. Sending is blocked too — the
                    server would refuse to persist over the locked envelope. */}
                {locked && (
                    <div
                        className="flex items-start gap-2 px-3 py-2 rounded-xl border text-xs"
                        style={{ background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.25)', color: 'var(--text-secondary)' }}
                        role="status"
                    >
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#3b82f6' }} />
                        <span>{t('notebooks.history_locked', 'Chat history is locked — sign in again to continue this conversation.')}</span>
                    </div>
                )}
                {messages.length === 0 && !locked && (
                    <EmptyState
                        icon={<Sparkles className="w-7 h-7" strokeWidth={2} />}
                        title={t('notebooks.chat_empty_title', 'Ask me anything')}
                        description={t('notebooks.chat_empty_body', "I'll use your notebook sources to provide accurate answers with citations.")}
                    />
                )}
                {messages.map((msg, idx) => (
                    <div key={msg.id ?? `${msg.role || 'm'}-${idx}-${msg.timestamp || msg.createdAt || ''}`} className="relative group/msg">
                        <MessageItem
                            msg={msg}
                            idx={idx}
                            isUser={msg.role === 'user'}
                            onCopy={handleCopy}
                            allMessages={messages}
                            modelTiers={modelTiers || {}}
                            onRetry={onRetry}
                            onEditMessage={onEdit}
                        />
                        {/* Knowledge-base citations → click opens CitationOverlay */}
                        {msg.role === 'assistant' && msg.kbSources?.length > 0 && (
                            <CitationChips sources={msg.kbSources} onCitationClick={onCitationClick} t={t} />
                        )}
                        {/* Insert to document button for assistant messages */}
                        {msg.role === 'assistant' && msg.content && !msg.isStreaming && onInsertToDocument && (
                            <button
                                onClick={() => onInsertToDocument(msg.content)}
                                className="absolute -bottom-1 right-0 opacity-0 group-hover/msg:opacity-100 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all"
                                style={{ background: 'var(--accent-primary)', color: 'white' }}
                                title={t('notebooks.insert_into_document', 'Insert into document')}
                            >
                                <ArrowDown className="w-2.5 h-2.5" /> {t('notebooks.insert', 'Insert')}
                            </button>
                        )}
                    </div>
                ))}
                <div ref={endRef} />
            </div>

            {/* Input — inert while the history is locked (InputArea has no
                disabled prop; pointer-events blocks the mouse, the guard in
                onSendMessage blocks Enter from an already-focused textarea). */}
            <div
                className="shrink-0 px-2 py-2 border-t"
                style={{ borderColor: 'var(--border-subtle)', ...(locked ? { opacity: 0.55, pointerEvents: 'none' } : {}) }}
                aria-disabled={locked || undefined}
            >
                <InputArea
                    input={chatInput}
                    setInput={setChatInput}
                    onSendMessage={(text, attachments) => {
                        if (locked) return;
                        onSend(text, attachments);
                        setChatInput('');
                    }}
                    isLoading={isLoading}
                    onStopGenerating={onStop}
                    directMode={true}
                    modelTiers={modelTiers}
                    selectedTier={selectedTier}
                    onTierChange={onTierChange}
                    placeholder={t('notebooks.chat_input_placeholder', 'Ask about your sources...')}
                    compact={true}
                />
            </div>
        </div>
    );
}

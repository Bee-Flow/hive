import React, { useRef, useEffect, useState } from 'react';
import { FileText, ArrowDown, MessageSquare, Sparkles } from 'lucide-react';
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
}) {
    const { t } = useTranslation();
    const endRef = useRef(null);
    const containerRef = useRef(null);
    const [copied, setCopied] = useState(false);
    const [chatInput, setChatInput] = useState('');

    // Auto-scroll
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

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
            <div ref={containerRef} className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3 space-y-3">
                {messages.length === 0 && (
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

            {/* Input */}
            <div className="shrink-0 px-2 py-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <InputArea
                    input={chatInput}
                    setInput={setChatInput}
                    onSendMessage={(text, attachments) => {
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

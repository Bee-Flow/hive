import React, { useRef, useEffect, useState } from 'react';
import { FileText, ArrowDown } from 'lucide-react';
import MessageItem from '../../components/chat/MessageItem';
import InputArea from '../../components/InputArea';

/* ── NotebookChat — AI chat panel for right side ─────────────── */
export default function NotebookChat({
    messages, isLoading, onSend, onStop, onRetry, onEdit,
    modelTiers, selectedTier, onTierChange,
    submittedFormIds, setSubmittedFormIds,
    onInsertToDocument, kbSourcesLookup, onCitationClick,
}) {
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

    const handleFormSubmit = (msg, formSubmission, formKey) => {
        if (setSubmittedFormIds) {
            setSubmittedFormIds(prev => new Set([...prev, formKey]));
        }
        setChatInput(formSubmission.text || 'Form submitted');
    };

    return (
        <div className="flex flex-col h-full">
            {/* Chat header */}
            <div className="shrink-0 px-3 py-2 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>💬 AI Chat</span>
                <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    Ask questions about your sources
                </span>
            </div>

            {/* Messages */}
            <div ref={containerRef} className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3 space-y-3">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                            style={{ background: 'var(--brand-gradient)' }}>
                            <span className="text-lg">🤖</span>
                        </div>
                        <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                            Ask me anything
                        </p>
                        <p className="text-[10px] mt-1 max-w-[200px]" style={{ color: 'var(--text-tertiary)' }}>
                            I'll use your notebook sources to provide accurate answers with citations
                        </p>
                    </div>
                )}
                {messages.map((msg, idx) => (
                    <div key={msg.id || idx} className="relative group/msg">
                        <MessageItem
                            msg={msg}
                            idx={idx}
                            isUser={msg.role === 'user'}
                            onCopy={handleCopy}
                            handleFormSubmit={handleFormSubmit}
                            isFormSubmitted={submittedFormIds?.has(`form-${msg.id || idx}`)}
                            allMessages={messages}
                            modelTiers={modelTiers || {}}
                            onRetry={onRetry}
                            onEditMessage={onEdit}
                        />
                        {/* Insert to document button for assistant messages */}
                        {msg.role === 'assistant' && msg.content && !msg.isStreaming && onInsertToDocument && (
                            <button
                                onClick={() => onInsertToDocument(msg.content)}
                                className="absolute -bottom-1 right-0 opacity-0 group-hover/msg:opacity-100 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all"
                                style={{ background: 'var(--accent-primary)', color: 'white' }}
                                title="Insert into document"
                            >
                                <ArrowDown className="w-2.5 h-2.5" /> Insert
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
                    placeholder="Ask about your sources..."
                    compact={true}
                />
            </div>
        </div>
    );
}

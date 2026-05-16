import React, { useRef, useEffect, useState } from 'react';
import { MousePointer2, X, Plus } from 'lucide-react';
import MessageItem from '../../components/chat/MessageItem';
import InputArea from '../../components/InputArea';
import WebpageDiffCard from '../../components/WebpageDiffCard';
import WebpagePlanCard from '../../components/WebpagePlanCard';
import WebpageChatModePicker from '../../components/WebpageChatModePicker';

const QUICK_STARTS = [
    'Landing page for a bakery — hero, menu grid, contact form.',
    'Personal portfolio site with project gallery and about section.',
    'Form that saves user signups to a database, with a thank-you screen.',
    'Dashboard with a few stat cards and a simple chart.',
];

/**
 * AI chat panel scoped to a single webpage. Mirrors NotebookChat — receives
 * messages from useChatEngine and forwards them to MessageItem; the parent
 * WebpagesPage owns the chat-engine wiring and the SSE event handling for
 * webpage_doc_update / webpage_source_added.
 */
export default function WebpageChat({
    messages, isLoading, onSend, onStop, onRetry, onEdit,
    modelTiers, selectedTier, onTierChange,
    onPlanApprove, onPlanReject, onNewChat,
    chatMode = 'auto', onChatModeChange,
    attachedSelection, onSelectionClear,
    placeholder = 'Describe the webpage you want…',
}) {
    const endRef = useRef(null);
    const containerRef = useRef(null);
    const [copyToast, setCopyToast] = useState(null); // 'copied' | 'failed' | null
    const [chatInput, setChatInput] = useState('');
    // Track whether the user is "pinned" to the bottom so streamed tokens
    // don't yank them upwards mid-read. Updated on each scroll; if they're
    // within ~80px of the bottom we treat them as pinned.
    const pinnedToBottomRef = useRef(true);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const onScroll = () => {
            const slack = 80;
            pinnedToBottomRef.current = (el.scrollTop + el.clientHeight + slack) >= el.scrollHeight;
        };
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => el.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        if (!pinnedToBottomRef.current) return;
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleCopy = (content) => {
        navigator.clipboard.writeText(content)
            .then(() => {
                setCopyToast('copied');
                setTimeout(() => setCopyToast(null), 2000);
            })
            .catch((err) => {
                console.warn('[WebpageChat] clipboard write failed:', err?.message);
                setCopyToast('failed');
                setTimeout(() => setCopyToast(null), 2500);
            });
    };

    return (
        <div className="flex flex-col h-full" style={{ background: 'var(--vsc-editor-bg)', color: 'var(--vsc-fg)' }}>
            <div className="shrink-0 px-3 py-1.5 border-b flex items-center gap-2" style={{ borderColor: 'var(--vsc-border)' }}>
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--vsc-fg-muted)', letterSpacing: '0.06em' }}>
                    AI Chat
                </span>
                {copyToast && (
                    <span
                        role="status"
                        aria-live="polite"
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={{
                            color: copyToast === 'copied' ? 'var(--accent-primary)' : 'var(--text-error, #ef4444)',
                            background: 'color-mix(in srgb, currentColor 10%, transparent)',
                        }}
                    >
                        {copyToast === 'copied' ? 'Copied' : 'Copy failed'}
                    </span>
                )}
                <span className="flex-1" />
                {onChatModeChange && (
                    <WebpageChatModePicker value={chatMode} onChange={onChatModeChange} />
                )}
                {onNewChat && (
                    <button
                        type="button"
                        onClick={() => {
                            if (messages.length === 0) return;
                            if (window.confirm('Start a new chat? The current conversation will be cleared.')) {
                                onNewChat();
                            }
                        }}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] hover:opacity-100 transition-opacity"
                        style={{
                            color: 'var(--vsc-fg-muted)',
                            opacity: messages.length === 0 ? 0.4 : 0.8,
                            cursor: messages.length === 0 ? 'default' : 'pointer',
                        }}
                        disabled={messages.length === 0}
                        title={messages.length === 0 ? 'No conversation to clear' : 'Start a new chat'}
                    >
                        <Plus size={11} /> New chat
                    </button>
                )}
            </div>

            <div ref={containerRef} className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3 space-y-3">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-start h-full text-center py-8 px-2">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                             style={{ background: 'var(--brand-gradient)' }}>
                            <span className="text-lg">🌐</span>
                        </div>
                        <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                            Describe a page, get a webpage
                        </p>
                        <p className="text-[10px] mt-1 mb-4 max-w-[240px]" style={{ color: 'var(--text-tertiary)' }}>
                            Tell me what you want. I'll scaffold the files, wire them up, and keep iterating with you.
                        </p>
                        <div className="flex flex-col gap-1.5 w-full max-w-[260px]">
                            {QUICK_STARTS.map((text) => (
                                <button
                                    key={text}
                                    type="button"
                                    onClick={() => onSend(text, [])}
                                    disabled={isLoading}
                                    className="flex items-start gap-2 px-2.5 py-1.5 rounded-md text-[11px] text-left border transition-colors hover:bg-[var(--vsc-hover-bg)] disabled:opacity-50"
                                    style={{
                                        borderColor: 'var(--vsc-border)',
                                        color: 'var(--text-secondary)',
                                        background: 'var(--vsc-editor-bg)',
                                    }}
                                >
                                    <span>{text}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {messages.map((msg, idx) => (
                    <div key={msg.id || idx} className="relative group/msg">
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
                        {msg.webpagePlan && (
                            <div className="mt-1 ml-1">
                                <WebpagePlanCard
                                    plan={msg.webpagePlan.plan}
                                    planId={msg.webpagePlan.planId}
                                    status={msg.webpagePlan.status || 'pending'}
                                    onApprove={onPlanApprove}
                                    onReject={onPlanReject}
                                />
                            </div>
                        )}
                        {Array.isArray(msg.webpageEdits) && msg.webpageEdits.length > 0 && (
                            <div className="mt-1 ml-1">
                                {msg.webpageEdits.map((edit, ei) => (
                                    <WebpageDiffCard
                                        key={`${idx}-${ei}-${edit.file}`}
                                        file={edit.file}
                                        diff={edit.diff}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ))}
                <div ref={endRef} />
            </div>

            <div className="shrink-0 px-2 py-2 border-t" style={{ borderColor: 'var(--vsc-border)' }}>
                {attachedSelection && (
                    <div
                        className="mb-1.5 flex items-start gap-1.5 px-2 py-1 rounded-md text-[11px]"
                        style={{
                            background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--accent-primary) 35%, transparent)',
                            color: 'var(--text-primary)',
                        }}
                        title="This selection will be sent with your next message so the AI knows what you mean by 'this'."
                    >
                        <MousePointer2 size={11} className="mt-0.5 shrink-0" style={{ color: 'var(--accent-primary)' }} />
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--accent-primary)', opacity: 0.85 }}>
                                Selection from preview{attachedSelection.tagName ? ` · <${attachedSelection.tagName}>` : ''}
                            </div>
                            <div className="truncate">
                                {attachedSelection.text.length > 140 ? attachedSelection.text.slice(0, 140) + '…' : attachedSelection.text}
                            </div>
                        </div>
                        <button
                            onClick={onSelectionClear}
                            className="shrink-0 p-0.5 rounded hover:bg-black/10"
                            title="Remove selection"
                        >
                            <X size={11} />
                        </button>
                    </div>
                )}
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
                    placeholder={placeholder}
                    compact={true}
                />
            </div>
        </div>
    );
}

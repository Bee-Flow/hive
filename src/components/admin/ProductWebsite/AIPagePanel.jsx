import React, { useRef, useState } from 'react';
import AppIcon from '../../AppIcon';
import { requestGeneratedPage } from './aiPageApi';

export default function AIPagePanel({ activeSiteId, activeLocale, onSaveAsNewPage }) {
    const [prompt, setPrompt] = useState('');
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [pendingPage, setPendingPage] = useState(null);
    const [saving, setSaving] = useState(false);
    const scrollRef = useRef(null);

    const scrollToBottom = () => {
        requestAnimationFrame(() => {
            const el = scrollRef.current;
            if (el) el.scrollTop = el.scrollHeight;
        });
    };

    const handleSend = async () => {
        const text = prompt.trim();
        if (!text || isLoading) return;

        setError(null);
        setMessages(prev => [...prev, { role: 'user', text }]);
        setPrompt('');
        setIsLoading(true);
        scrollToBottom();

        try {
            const { page, summary } = await requestGeneratedPage({
                prompt: text,
                locale: activeLocale,
            });
            setMessages(prev => [...prev, { role: 'assistant', summary, page }]);
            setPendingPage(page);
        } catch (e) {
            setError(e?.message || 'Generation failed');
        } finally {
            setIsLoading(false);
            scrollToBottom();
        }
    };

    const handleSave = async () => {
        if (!pendingPage || saving) return;
        setSaving(true);
        setError(null);
        try {
            await onSaveAsNewPage(pendingPage);
            setPendingPage(null);
            setMessages(prev => [...prev, {
                role: 'assistant',
                summary: 'Page saved. You can now find it in the page list.',
            }]);
        } catch (e) {
            setError(e?.message || 'Failed to save page');
        } finally {
            setSaving(false);
            scrollToBottom();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-primary)]">
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-3"
            >
                {messages.length === 0 ? (
                    <div className="text-xs text-[var(--text-muted)] text-center py-8">
                        Describe the page you want to generate.
                        <br />
                        For example: <em>"Landing page for our pricing"</em>.
                    </div>
                ) : null}

                {messages.map((m, i) => (
                    m.role === 'user' ? (
                        <div key={i} className="flex justify-end">
                            <div className="max-w-[85%] rounded-lg px-3 py-2 text-xs bg-[var(--accent-primary)] text-white whitespace-pre-wrap">
                                {m.text}
                            </div>
                        </div>
                    ) : (
                        <div key={i} className="flex justify-start">
                            <div className="max-w-[95%] w-full rounded-lg px-3 py-2 text-xs bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-subtle)]">
                                <div className={m.page ? 'mb-2' : ''}>{m.summary}</div>
                                {m.page ? (
                                    <details>
                                        <summary className="cursor-pointer text-[var(--text-muted)] select-none">
                                            Show generated JSON
                                        </summary>
                                        <pre className="mt-2 p-2 rounded bg-[var(--bg-primary)] border border-[var(--border-subtle)] overflow-x-auto text-[10px] leading-snug">
{JSON.stringify(m.page, null, 2)}
                                        </pre>
                                    </details>
                                ) : null}
                            </div>
                        </div>
                    )
                ))}

                {isLoading ? (
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                        <AppIcon name="Loader" className="w-3.5 h-3.5 animate-spin" />
                        Generating...
                    </div>
                ) : null}

                {error ? (
                    <div className="text-xs text-red-500 border border-red-500/30 bg-red-500/5 rounded px-2 py-1.5">
                        {error}
                    </div>
                ) : null}
            </div>

            <div className="border-t border-[var(--border-subtle)] p-3 space-y-2 shrink-0">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={3}
                    placeholder="Describe the page you want to generate..."
                    disabled={isLoading}
                    className="w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] resize-none disabled:opacity-60"
                />
                <div className="flex items-center justify-between gap-2">
                    {pendingPage ? (
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="px-3 py-1.5 text-xs font-medium rounded border border-[var(--accent-primary)] text-[var(--accent-primary)] bg-transparent hover:bg-[var(--accent-primary)]/10 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {saving ? 'Saving...' : 'Save as new page'}
                        </button>
                    ) : <span />}
                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={isLoading || !prompt.trim()}
                        className="px-3 py-1.5 text-xs font-medium rounded bg-[var(--accent-primary)] text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                        <AppIcon name="Send" className="w-3.5 h-3.5" />
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}

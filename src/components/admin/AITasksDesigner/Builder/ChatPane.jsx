import React, { useEffect, useRef, useState } from 'react';
import { Send, Wrench } from 'lucide-react';
import MarkdownRenderer from '../../../MarkdownRenderer';

/**
 * Minimal chat pane for the automation builder. Renders the
 * useAutomationBuilderStream `messages` array with tool-call chips
 * inline, plus an input box at the bottom.
 *
 * The diagram + summary live in the parent (BuilderShell), so this
 * component is purely text + tool-call timeline.
 */
export default function ChatPane({ messages, running, onSend }) {
    const [input, setInput] = useState('');
    const scrollerRef = useRef(null);

    useEffect(() => {
        if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }, [messages]);

    const submit = (e) => {
        e.preventDefault();
        if (!input.trim() || running) return;
        onSend(input.trim());
        setInput('');
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            <div ref={scrollerRef} style={{ flex: 1, overflowY: 'auto', padding: 16, gap: 12, display: 'flex', flexDirection: 'column' }}>
                {messages.length === 0 && (
                    <div style={{ color: '#6b7280', textAlign: 'center', padding: '40px 16px' }}>
                        Tell the builder what automation you want.<br/>
                        Example: <em>"Every Monday at 9am, get my unread Gmail labelled invoices, summarise each, post to #finance."</em>
                    </div>
                )}
                {messages.map((m, i) => (
                    <MessageBubble key={i} msg={m} />
                ))}
                {running && <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>Thinking…</div>}
            </div>
            <form onSubmit={submit} style={{ borderTop: '1px solid #e5e7eb', padding: 12, display: 'flex', gap: 8 }}>
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder={running ? 'Working…' : 'Describe a step, ask a question, or say "run it"'}
                    disabled={running}
                    style={{ flex: 1, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}
                />
                <button type="submit" disabled={running || !input.trim()} style={{ padding: '10px 14px', borderRadius: 8, background: '#4f46e5', color: '#fff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Send size={16} /> Send
                </button>
            </form>
        </div>
    );
}

function MessageBubble({ msg }) {
    const isUser = msg.role === 'user';
    return (
        <div style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            <div style={{
                background: isUser ? '#4f46e5' : '#f3f4f6',
                color: isUser ? '#fff' : '#111827',
                padding: '10px 14px',
                borderRadius: 12,
                whiteSpace: 'pre-wrap',
                fontSize: 14,
            }}>
                {isUser ? msg.content : <MarkdownRenderer content={msg.content || ''} />}
            </div>
            {!isUser && Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0 && (
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {msg.toolCalls.map((tc, i) => <ToolCallChip key={i} tc={tc} />)}
                </div>
            )}
        </div>
    );
}

function ToolCallChip({ tc }) {
    const [open, setOpen] = useState(false);
    return (
        <div style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, fontSize: 12 }}>
            <button type="button" onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Wrench size={12} /> <code>{tc.name}</code>
            </button>
            {open && (
                <pre style={{ marginTop: 6, background: '#fff', padding: 8, borderRadius: 6, overflow: 'auto', maxHeight: 240, whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify({ args: tc.arguments, result: tc.result }, null, 2)}
                </pre>
            )}
        </div>
    );
}

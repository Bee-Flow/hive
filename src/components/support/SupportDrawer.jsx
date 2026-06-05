/**
 * Support drawer parts — reusable building blocks for the user-side support
 * surface. The floating Help-button drawer was retired in favour of an
 * AdvancedSettings → "Help & Support" section; HelpSupportSection imports
 * NewThreadForm + ThreadDetail from this module and composes them into the
 * settings page layout.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Send, ArrowLeft, Bot, User, AlertTriangle } from 'lucide-react';
import { authFetch, API_BASE } from '../../utils/helpers';

export const STATUS_LABELS = {
    open: 'Open',
    ai_responding: 'AI replying',
    awaiting_user: 'Reply from Bee Flow',
    awaiting_agent: 'Waiting on Bee Flow',
    resolved: 'Resolved',
    closed: 'Closed',
};

export function formatRelative(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const m = Math.round((Date.now() - d.getTime()) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    return d.toLocaleDateString();
}

export function NewThreadForm({ onCreated, onCancel }) {
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState(null);

    const submit = async () => {
        setErr(null);
        if (!subject.trim() || !message.trim()) {
            setErr('Subject and message are required');
            return;
        }
        setSubmitting(true);
        try {
            const res = await authFetch(`${API_BASE}/api/support/threads`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject: subject.trim(), message: message.trim(), source: 'in_app' }),
            });
            const data = await res.json();
            if (!res.ok) {
                setErr(data?.error || 'Could not submit. Please try again.');
                return;
            }
            onCreated && onCreated(data.threadId);
        } catch (e) {
            setErr(e.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="p-4 space-y-3">
            <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="What's this about?"
                maxLength={200}
                className="w-full px-3 py-2 rounded-md border text-sm"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
            />
            <textarea
                rows={6}
                value={message}
                onChange={e => setMessage(e.target.value)}
                // Auto-grow up to a cap so a long message isn't cramped in a
                // fixed box, plus a visible counter — the box reads as "not
                // resizable / limit unclear" otherwise (BFSF-198).
                onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 360) + 'px'; }}
                placeholder="Describe what you need help with. The Bee Flow AI assistant will reply first and hand off to a human if needed."
                maxLength={10000}
                className="w-full px-3 py-2 rounded-md border text-sm resize-y"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', maxHeight: 360 }}
            />
            <div className="text-[10px] text-right" style={{ color: 'var(--text-muted)' }}>{message.length} / 10000</div>
            {err && <div className="text-xs" style={{ color: '#dc2626' }}>{err}</div>}
            <div className="flex justify-end gap-2">
                <button onClick={onCancel} className="px-3 py-1.5 rounded-md text-sm border" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>Cancel</button>
                <button onClick={submit} disabled={submitting} className="px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 disabled:opacity-50" style={{ background: 'var(--accent-primary)', color: 'white' }}>
                    <Send className="w-3.5 h-3.5" /> {submitting ? 'Sending…' : 'Send to Bee Flow'}
                </button>
            </div>
        </div>
    );
}

export function ThreadDetail({ threadId, onBack, onChanged }) {
    const [thread, setThread] = useState(null);
    const [messages, setMessages] = useState([]);
    const [reply, setReply] = useState('');
    const [sending, setSending] = useState(false);

    const load = useCallback(async () => {
        const res = await authFetch(`${API_BASE}/api/support/threads/${threadId}`);
        if (res.ok) {
            const data = await res.json();
            setThread(data.thread);
            setMessages(data.messages || []);
        }
    }, [threadId]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        const id = setInterval(load, 10000);
        return () => clearInterval(id);
    }, [load]);

    const send = async () => {
        const body = reply.trim();
        if (!body) return;
        setSending(true);
        try {
            const res = await authFetch(`${API_BASE}/api/support/threads/${threadId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ body }),
            });
            if (res.ok) {
                setReply('');
                await load();
                onChanged && onChanged();
            }
        } finally {
            setSending(false);
        }
    };

    if (!thread) return <div className="p-4 text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>;

    return (
        <div className="flex flex-col h-full">
            <div className="px-3 py-2 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-default)' }}>
                <button onClick={onBack} className="p-1 rounded hover:bg-[var(--bg-tertiary)]" style={{ color: 'var(--text-secondary)' }}><ArrowLeft className="w-4 h-4" /></button>
                <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{thread.subject}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{STATUS_LABELS[thread.status] || thread.status}</div>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {messages.map(m => {
                    const isMe = m.author_kind === 'requester';
                    const isAI = m.author_kind === 'ai';
                    const isSystem = m.author_kind === 'system';
                    return (
                        <div key={m.id} className="rounded-lg p-2.5 text-sm" style={{
                            background: isMe ? 'var(--bg-tertiary)' : isAI ? 'rgba(14,165,233,0.08)' : isSystem ? 'var(--bg-secondary)' : 'rgba(16,185,129,0.08)',
                            border: '1px solid var(--border-default)',
                            color: 'var(--text-primary)',
                        }}>
                            <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                                {isAI ? <Bot className="w-3 h-3" /> : isSystem ? <AlertTriangle className="w-3 h-3" /> : <User className="w-3 h-3" />}
                                <span>{m.author_display || (isMe ? 'You' : m.author_kind)}</span>
                                <span className="ml-auto">{formatRelative(m.created_at)}</span>
                            </div>
                            <div className="whitespace-pre-wrap">{m.body}</div>
                        </div>
                    );
                })}
            </div>
            {thread.status !== 'resolved' && thread.status !== 'closed' && (
                <div className="border-t p-2" style={{ borderColor: 'var(--border-default)' }}>
                    <textarea
                        rows={4}
                        value={reply}
                        onChange={e => setReply(e.target.value)}
                        // Auto-grow + explicit cap so over-limit input is prevented
                        // client-side instead of silently failing the server cap (BFSF-198).
                        onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 240) + 'px'; }}
                        placeholder="Reply…"
                        maxLength={10000}
                        className="w-full px-2 py-1.5 rounded-md border text-sm resize-y"
                        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', maxHeight: 240 }}
                    />
                    {reply.length > 0 && <div className="text-[10px] text-right mt-0.5" style={{ color: 'var(--text-muted)' }}>{reply.length} / 10000</div>}
                    <div className="mt-1.5 flex justify-end">
                        <button onClick={send} disabled={sending || !reply.trim()} className="px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 disabled:opacity-50" style={{ background: 'var(--accent-primary)', color: 'white' }}>
                            <Send className="w-3 h-3" /> {sending ? 'Sending…' : 'Send'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// The floating-drawer default export was retired in iteration 2. The
// settings-side surface lives in HelpSupportSection.jsx and imports
// NewThreadForm + ThreadDetail directly from this module.

import { Send, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MarkdownBlocks } from './AppMarkdown';
import { API_BASE, authFetch } from '../../../../../../utils/helpers';
import { useDataContext } from '../DataContext';
import { useRuntime } from '../RuntimeContext';

/**
 * App Studio runtime — 'ai_chat'. Spec: server/appStudio/componentSpecs.js.
 *
 * A chat surface for the app's viewers. Every turn POSTs the transcript to
 * POST /api/studio-apps/:id/ai/chat and streams the answer back over SSE; the
 * model tier, system prompt and knowledge bases live in the DEFINITION and are
 * read server-side, so nothing about the model is client-controlled.
 *
 * Answers render through MarkdownBlocks — the same escaped, no-raw-HTML subset
 * the markdown component uses (never the chat MarkdownRenderer: model output in
 * a published app must not be able to smuggle HTML or remote images).
 *
 * Transcript state is per-session (v1): nothing is persisted. `mode:'assistant'`
 * sends each question on its own instead of carrying the conversation.
 * In edit mode the component renders an inert preview.
 */

export default function AppAiChat({ node }) {
    const { mode } = useRuntime();
    // `draft` picks which definition the server resolves this node against —
    // the editor preview runs the unsaved draft, a published page the frozen
    // published definition (mirrors useActionRunner's ?draft=1).
    const { appId, draft } = useDataContext();
    const props = node.props || {};
    const singleTurn = props.mode === 'assistant';
    const starters = Array.isArray(props.starters) ? props.starters.filter(Boolean) : [];

    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const listRef = useRef(null);
    const live = mode === 'run' && !!appId;

    useEffect(() => {
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }, [messages]);

    const send = async (text) => {
        const content = String(text ?? '').trim();
        if (!content || busy || !live) return;
        setError(null);
        setInput('');
        // An assistant-mode turn starts fresh; a chat-mode turn carries history.
        const outgoing = [...(singleTurn ? [] : messages), { role: 'user', content }];
        setMessages([...outgoing, { role: 'assistant', content: '' }]);
        setBusy(true);
        try {
            const qs = draft ? '?draft=1' : '';
            const res = await authFetch(`${API_BASE}/api/studio-apps/${encodeURIComponent(appId)}/ai/chat${qs}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nodeId: node.id, messages: outgoing }),
            });
            if (!res.ok || !res.body) {
                let body = null;
                try { body = await res.json(); } catch { /* not JSON */ }
                throw new Error(body?.error || `The assistant is unavailable (${res.status})`);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let answer = '';
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const frames = buffer.split('\n\n');
                buffer = frames.pop() || '';
                for (const frame of frames) {
                    const line = frame.split('\n').find((l) => l.startsWith('data:'));
                    if (!line) continue;
                    let evt = null;
                    try { evt = JSON.parse(line.slice(5).trim()); } catch { continue; }
                    if (evt.type === 'text') {
                        answer += evt.text || '';
                        setMessages((m) => {
                            const copy = [...m];
                            copy[copy.length - 1] = { role: 'assistant', content: answer };
                            return copy;
                        });
                    } else if (evt.type === 'error') {
                        throw new Error(evt.error || 'The assistant failed to respond.');
                    }
                }
            }
            if (!answer.trim()) {
                setMessages((m) => {
                    const copy = [...m];
                    copy[copy.length - 1] = { role: 'assistant', content: '_No answer was returned._' };
                    return copy;
                });
            }
        } catch (e) {
            setError(e?.message || 'The assistant failed to respond.');
            setMessages((m) => m.slice(0, -1)); // drop the pending assistant bubble
        } finally {
            setBusy(false);
        }
    };

    const empty = messages.length === 0;

    return (
        <div
            className="flex flex-col h-full min-h-[18rem] overflow-hidden border"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', borderRadius: 'var(--app-radius)' }}
            data-app-ai-chat="true"
        >
            <div ref={listRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                {empty ? (
                    <div className="m-auto text-center px-4">
                        <Sparkles className="w-5 h-5 mx-auto mb-2" style={{ color: 'var(--accent-primary)' }} aria-hidden="true" />
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {props.greeting || 'Ask me anything.'}
                        </p>
                    </div>
                ) : messages.map((m, i) => (
                    m.role === 'user' ? (
                        <div key={i} className="self-end max-w-[85%] px-3 py-2 text-sm"
                            style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--app-radius)', color: 'var(--text-primary)' }}>
                            {m.content}
                        </div>
                    ) : (
                        <div key={i} className="self-start max-w-[95%] text-sm" style={{ color: 'var(--text-primary)' }}>
                            {m.content
                                ? <div className="flex flex-col gap-2"><MarkdownBlocks text={m.content} /></div>
                                : <span className="opacity-60">…</span>}
                        </div>
                    )
                ))}
            </div>

            {empty && starters.length > 0 && (
                <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                    {starters.map((s, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => send(s)}
                            disabled={!live || busy}
                            className="px-2.5 py-1 text-xs border transition-colors disabled:opacity-50"
                            style={{ borderColor: 'var(--border-default)', borderRadius: 'var(--app-radius)', color: 'var(--text-secondary)' }}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            )}

            {error && (
                <p className="px-3 pb-1 text-xs" style={{ color: 'var(--error)' }} role="alert">{error}</p>
            )}

            <form
                className="flex items-center gap-2 p-2 border-t"
                style={{ borderColor: 'var(--border-default)' }}
                onSubmit={(e) => { e.preventDefault(); send(input); }}
            >
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={props.placeholder || 'Ask a question…'}
                    disabled={!live || busy}
                    aria-label="Message"
                    className="flex-1 px-3 py-2 text-sm border outline-none disabled:opacity-60"
                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', borderRadius: 'var(--app-radius)', color: 'var(--text-primary)' }}
                />
                <button
                    type="submit"
                    disabled={!live || busy || !input.trim()}
                    aria-label="Send"
                    // This button is inside the RENDERED app, so it takes the
                    // app's own primary and its paired foreground — not the
                    // platform accent, which is a light grey in the default
                    // themes and left a white icon on it at about 2.5:1.
                    className="p-2 disabled:opacity-50"
                    style={{
                        background: 'var(--app-primary)',
                        color: 'var(--app-primary-contrast)',
                        borderRadius: 'var(--app-radius)',
                    }}
                >
                    <Send className="w-4 h-4" />
                </button>
            </form>
        </div>
    );
}

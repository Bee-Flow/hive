import React, { useState, useRef, useEffect } from 'react';
import MessageItem from '../components/chat/MessageItem';
import WelcomeScreen from '../components/WelcomeScreen';
import InputArea from '../components/InputArea';
import { Sun, Moon } from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';
import { isImageAvatar, resolveAvatarSrc, pickAgentAvatar } from '../utils/agentAvatar';

const getInitialTheme = () => {
    // 1. Check URL param (?theme=light or ?theme=dark) — allows iframe embedder to control
    const params = new URLSearchParams(window.location.search);
    const urlTheme = params.get('theme');
    if (urlTheme === 'light' || urlTheme === 'dark') return urlTheme;
    // 2. Fall back to system preference
    if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
    return 'dark';
};

const EmbedChat = ({ agentId }) => {
    const [theme, setTheme] = useState(getInitialTheme);
    const [agent, setAgent] = useState(null);
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState(null);
    // InputArea expects input/setInput as controlled props.
    const [input, setInput] = useState('');
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const shouldForceScrollRef = useRef(false);

    // ── Gmail extension bridge ──────────────────────────────────────────────
    // When hosted in the Chrome extension's side-panel iframe
    // (?source=gmail-extension), accept email-thread context from the parent
    // and emit the agent's final response back so the extension can auto-draft.
    const isGmailEmbed = new URLSearchParams(window.location.search).get('source') === 'gmail-extension';
    const [gmailContext, setGmailContext] = useState(null);
    const gmailContextRef = useRef(null);
    useEffect(() => { gmailContextRef.current = gmailContext; }, [gmailContext]);

    useEffect(() => {
        if (!isGmailEmbed) return;
        const onMessage = (event) => {
            if (!event.origin.startsWith('chrome-extension://')) return;
            const msg = event.data;
            if (!msg || typeof msg !== 'object' || !msg.type?.startsWith?.('beeflow:')) return;
            if (msg.type === 'beeflow:gmail_context' && msg.thread) {
                setGmailContext(msg.thread);
            }
        };
        window.addEventListener('message', onMessage);
        // Announce readiness so the extension re-sends the latest thread.
        try { window.parent.postMessage({ type: 'beeflow:ready' }, '*'); } catch {}
        return () => window.removeEventListener('message', onMessage);
    }, [isGmailEmbed]);

    // Apply theme to document
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    // Read embed customization from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const [customWarning] = useState(() => urlParams.get('warning') || '');

    // Apply font & color customization from URL params
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const font = params.get('font');
        const fontSize = params.get('fontSize');
        const lineHeight = params.get('lineHeight');
        const userColor = params.get('userColor');
        const assistantColor = params.get('assistantColor');

        if (font) {
            // Load Google Font dynamically
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@300;400;500;600;700&display=swap`;
            document.head.appendChild(link);
        }

        // Inject overriding styles
        const style = document.createElement('style');
        const rules = [];

        // Font family
        if (font) rules.push(`html, body, body * { font-family: '${font}', sans-serif !important; }`);

        // Font size & line height
        if (fontSize || lineHeight) {
            const textOverrides = [];
            if (fontSize) textOverrides.push(`font-size: ${fontSize}px !important`);
            if (lineHeight) textOverrides.push(`line-height: ${lineHeight} !important`);
            rules.push(`body, .markdown-content, .markdown-content p, .markdown-content li, .markdown-content span, textarea, input { ${textOverrides.join('; ')}; }`);
        }

        // Bubble colors — override CSS variables used by MessageItem
        if (userColor) {
            rules.push(`:root { --accent-primary: ${userColor} !important; --accent-primary-hover: ${userColor} !important; }`);
        }
        if (assistantColor) {
            rules.push(`:root { --bg-secondary: ${assistantColor} !important; }`);
        }

        if (rules.length) {
            style.textContent = rules.join('\n');
            document.head.appendChild(style);
        }
    }, []);

    const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

    // Fetch agent metadata
    useEffect(() => {
        const fetchAgent = async () => {
            try {
                const res = await authFetch(`${API_BASE}/agents/${agentId}/embed`);
                if (!res.ok) {
                    if (res.status === 403) setError('This agent is not available for embedding.');
                    else if (res.status === 404) setError('Agent not found.');
                    else setError('Failed to load agent.');
                    setIsLoading(false);
                    return;
                }
                const data = await res.json();
                // Map embed response to agent shape expected by WelcomeScreen/MessageItem
                setAgent({
                    id: data.id,
                    name: data.name,
                    description: data.description,
                    avatar: data.avatar,
                    starter_prompts: data.starterPrompts || [],
                    copy_enabled: data.copyEnabled ? 1 : 0
                });
                setIsLoading(false);
            } catch (err) {
                setError('Failed to connect to server.');
                setIsLoading(false);
            }
        };
        fetchAgent();
    }, [agentId]);

    // Smart auto-scroll: force on send, respect user scroll-back during streaming
    const scrollToBottom = (behavior = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    };

    useEffect(() => {
        // Force-scroll when user just sent a message
        if (shouldForceScrollRef.current) {
            shouldForceScrollRef.current = false;
            scrollToBottom('auto');
            return;
        }

        // Smart scroll: only auto-scroll if user is near the bottom
        const container = messagesContainerRef.current;
        if (container) {
            const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
            const isNearBottom = distanceFromBottom < 300;
            if (isNearBottom) {
                const lastMsg = messages[messages.length - 1];
                const streaming = lastMsg?.isStreaming;
                scrollToBottom(streaming ? 'auto' : 'smooth');
            }
        } else {
            scrollToBottom('smooth');
        }
    }, [messages]);

    const sendMessage = async (text, attachments = []) => {
        if (!text.trim() || isStreaming) return;

        const msgId = `embed-${Date.now()}`;
        const assistantMsgId = `embed-${Date.now() + 1}`;

        const userDisplayText = text.trim();

        // If hosted in the Gmail extension and a thread has been posted from
        // the parent, prepend context to the agent-facing message. The UI
        // still shows only the user's original text.
        //
        // Strategy: we give the agent enough info to find & read the full
        // thread via its Gmail API tools (gmail_search / gmail_read). The
        // body snippets we scrape from the DOM are only a hint — they may
        // be truncated, clipped, or missing entirely for hidden messages.
        let agentMessage = userDisplayText;
        const gCtx = gmailContextRef.current;
        if (isGmailEmbed && gCtx) {
            const msgs = gCtx.messages || [];
            const anyClipped = msgs.some(m => m.clipped);
            const knownMessageIds = msgs.map(m => m.messageId).filter(Boolean);

            const threadBlock = msgs.map((m, i, arr) => {
                const header = `--- Message ${i + 1} of ${arr.length} ---`;
                const meta = `From: ${m.from || 'unknown'}  Date: ${m.date || 'unknown'}` +
                    (m.messageId ? `  messageId: ${m.messageId}` : '') +
                    (m.clipped ? '  [CLIPPED — fetch full content via gmail_read]' : '');
                return `${header}\n${meta}\n${m.body || '(body not available from DOM — use gmail_read)'}`;
            }).join('\n\n');

            const lastMessageId = [...msgs].reverse().find(m => m.messageId)?.messageId || null;
            const lastSender = [...msgs].reverse().find(m => m.from)?.from || '';
            const subjectEscaped = (gCtx.subject || '').replace(/"/g, '\\"');

            const instructions = [
                `You are helping the user with a Gmail thread currently open in their browser. Reply in the same language as the thread.`,
                ``,
                `IMPORTANT — Use your Gmail tools to get the full conversation:`,
                `  • The body snippets below come from scraping the Gmail DOM and may be partial, clipped, or missing for hidden messages.`,
                `  • You have gmail_search and gmail_read available. When a message is marked [CLIPPED] or looks truncated, call gmail_read with its messageId to fetch the full content.`,
                `  • If no messageId is available, use gmail_search with query like: subject:"${subjectEscaped}" to find the thread, then gmail_read on each message.`,
                ``,
                `DRAFTING replies / new emails:`,
                `  • When the user asks you to write, draft, reply to, or forward an email, DO NOT write the reply as prose in the chat. Call gmail_compose so the user gets a real Gmail draft card with Send / Save-as-Draft buttons.`,
                `  • For a reply: set replyToMessageId to the messageId of the message you are replying to (usually the last one in the thread) and prefix subject with "Re: ".`,
                `  • For a forward: prefix subject with "Fwd: " and include the original body.`,
                `  • Use the sender address and subject from the thread metadata below — don't invent contacts.`,
                ``,
                `Thread metadata:`,
                `  Subject: ${gCtx.subject || '(no subject)'}`,
                `  Participants: ${(gCtx.participants || []).join(', ')}`,
                `  Message count: ${msgs.length}`,
                lastSender ? `  Last sender (likely reply target): ${lastSender}` : null,
                lastMessageId ? `  Suggested replyToMessageId: ${lastMessageId}` : null,
                gCtx.threadId ? `  Gmail URL thread id (UI id, not API id): ${gCtx.threadId}` : null,
                knownMessageIds.length ? `  Known API message IDs: ${knownMessageIds.join(', ')}` : null,
                anyClipped ? `  ⚠ One or more messages are CLIPPED — you MUST call gmail_read to get the full text.` : null,
            ].filter(Boolean).join('\n');

            agentMessage =
                `${instructions}\n\n` +
                `Thread (oldest → newest, DOM-scraped hint only):\n${threadBlock}\n\n` +
                `---\nUser request: ${userDisplayText}`;
        }

        const userMessage = { id: msgId, role: 'user', content: userDisplayText, attachments };
        const assistantMessage = { id: assistantMsgId, role: 'assistant', content: '', isStreaming: true };

        setMessages(prev => [...prev, userMessage, assistantMessage]);
        setIsStreaming(true);

        try {
            const response = await authFetch(`${API_BASE}/agents/${agentId}/chat/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: agentMessage,
                    // Include full history WITH current message, since historyOverride
                    // replaces conversation messages entirely in the runtime
                    history: [
                        ...messages.map(m => ({ role: m.role, content: m.content })),
                        { role: 'user', content: agentMessage }
                    ],
                    attachments,
                    // Normal public embed conversations are ephemeral (not persisted).
                    // In the Gmail extension the user is session-authed via
                    // X-Session-Token, so we can persist like the direct chat does.
                    ...(isGmailEmbed ? {} : { ephemeral: true })
                })
            });

            if (!response.ok) throw new Error('Failed to send message');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantContent = '';
            let buffer = '';
            let currentEvent = '';
            // Set when the agent fires an email_draft event during this turn —
            // used to suppress the prose DOM-fallback on `done`, otherwise we'd
            // double-insert into Gmail compose.
            let emailDraftEmittedThisTurn = false;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7).trim();
                    } else if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6);
                        try {
                            const data = JSON.parse(dataStr);

                            if (currentEvent === 'content' && data.text) {
                                assistantContent += data.text;
                                setMessages(prev => prev.map(m =>
                                    m.id === assistantMsgId ? { ...m, content: assistantContent } : m
                                ));
                            } else if (currentEvent === 'content_replace' && data.text !== undefined) {
                                assistantContent = data.text;
                                setMessages(prev => prev.map(m =>
                                    m.id === assistantMsgId ? { ...m, content: assistantContent } : m
                                ));
                            } else if (currentEvent === 'content_redact') {
                                // Redact: show warning first, then update user message with redacted version after delay
                                const seconds = data.autoRedactSeconds || 5;
                                setMessages(prev => prev.map(m =>
                                    m.id === msgId ? { ...m, isGuardrailViolation: true, deleteIn: seconds, willRedact: true } : m
                                ));
                                // Schedule redaction after countdown
                                setTimeout(() => {
                                    setMessages(prev => prev.map(m =>
                                        m.id === msgId ? { ...m, content: data.redactedMessage, isGuardrailViolation: false, isRedacted: true, willRedact: false } : m
                                    ));
                                }, seconds * 1000);
                            } else if (currentEvent === 'guardrail_violation') {
                                // Mark user message for deletion warning, then replace content after countdown
                                const seconds = data.autoDeleteSeconds || 5;
                                setMessages(prev => prev.map(m =>
                                    m.id === msgId ? { ...m, isGuardrailViolation: true, deleteIn: seconds } : m
                                ));
                                // Replace user message content after countdown
                                setTimeout(() => {
                                    setMessages(prev => prev.map(m =>
                                        m.id === msgId ? { ...m, content: '[Message removed - policy violation]', isGuardrailViolation: false, isDeleted: true } : m
                                    ));
                                }, seconds * 1000);
                            } else if (currentEvent === 'tool_start') {
                                setMessages(prev => prev.map(m => {
                                    if (m.id === assistantMsgId) {
                                        const update = { ...m, toolCall: { name: data.name, status: 'running' } };
                                        if (data.name === 'sequentialthinking' && data.args?.thought) {
                                            const steps = [...(m.thinkingSteps || [])];
                                            steps.push({
                                                thought: data.args.thought,
                                                thoughtNumber: data.args.thoughtNumber,
                                                totalThoughts: data.args.totalThoughts,
                                                isRevision: data.args.isRevision,
                                                branchFromThought: data.args.branchFromThought,
                                                branchId: data.args.branchId,
                                                status: 'running'
                                            });
                                            update.thinkingSteps = steps;
                                        }
                                        return update;
                                    }
                                    return m;
                                }));
                            } else if (currentEvent === 'tool_end') {
                                setMessages(prev => prev.map(m => {
                                    if (m.id === assistantMsgId) {
                                        const trs = m.toolResults || [];
                                        const update = {
                                            ...m,
                                            toolResults: [...trs, { name: data.name, result: data.result }],
                                            toolCall: null
                                        };
                                        if (data.name === 'sequentialthinking' && m.thinkingSteps?.length > 0) {
                                            const steps = [...m.thinkingSteps];
                                            const lastRunning = steps.findLastIndex(s => s.status === 'running');
                                            if (lastRunning >= 0) steps[lastRunning] = { ...steps[lastRunning], status: 'done' };
                                            update.thinkingSteps = steps;
                                        }
                                        return update;
                                    }
                                    return m;
                                }));
                            } else if (currentEvent === 'thinking') {
                                if (data.text) {
                                    setMessages(prev => prev.map(m =>
                                        m.id === assistantMsgId ? { ...m, thinking: (m.thinking || '') + data.text } : m
                                    ));
                                }
                            } else if (currentEvent === 'email_draft') {
                                const draftKey = JSON.stringify({ to: data.to, subject: data.subject, body: data.body });
                                setMessages(prev => prev.map(m => {
                                    if (m.id !== assistantMsgId) return m;
                                    const existing = m.emailDrafts || [];
                                    if (existing.some(d => JSON.stringify({ to: d.to, subject: d.subject, body: d.body }) === draftKey)) return m;
                                    return { ...m, emailDrafts: [...existing, { ...data, status: 'pending' }] };
                                }));
                                // Gmail-extension-only: also open the draft directly in Gmail's
                                // compose window via the content script. The user gets both the
                                // side-panel card (API-backed Send/Save) and the inline Gmail
                                // draft they can edit.
                                if (isGmailEmbed && data.body) {
                                    emailDraftEmittedThisTurn = true;
                                    try {
                                        window.parent.postMessage(
                                            { type: 'beeflow:email_draft', draft: data },
                                            '*'
                                        );
                                    } catch { /* parent closed */ }
                                }
                            } else if (currentEvent === 'calendar_draft') {
                                const draftKey = JSON.stringify({ summary: data.summary, start: data.start, end: data.end });
                                setMessages(prev => prev.map(m => {
                                    if (m.id !== assistantMsgId) return m;
                                    const existing = m.calendarDrafts || [];
                                    if (existing.some(d => JSON.stringify({ summary: d.summary, start: d.start, end: d.end }) === draftKey)) return m;
                                    return { ...m, calendarDrafts: [...existing, { ...data, status: 'pending' }] };
                                }));
                            } else if (currentEvent === 'linkedin_draft') {
                                setMessages(prev => prev.map(m =>
                                    m.id === assistantMsgId ? { ...m, linkedInDrafts: [...(m.linkedInDrafts || []), { ...data, status: 'pending' }] } : m
                                ));
                            } else if (currentEvent === 'whatsapp_draft') {
                                const draftKey = JSON.stringify({ to: data.to, message: data.message });
                                setMessages(prev => prev.map(m => {
                                    if (m.id !== assistantMsgId) return m;
                                    const existing = m.whatsappDrafts || [];
                                    if (existing.some(d => JSON.stringify({ to: d.to, message: d.message }) === draftKey)) return m;
                                    return { ...m, whatsappDrafts: [...existing, { ...data, status: 'pending' }] };
                                }));
                            } else if (currentEvent === 'contacts_draft') {
                                const draftKey = JSON.stringify({ name: data.name, email: data.email, phone: data.phone });
                                setMessages(prev => prev.map(m => {
                                    if (m.id !== assistantMsgId) return m;
                                    const existing = m.contactsDrafts || [];
                                    if (existing.some(d => JSON.stringify({ name: d.name, email: d.email, phone: d.phone }) === draftKey)) return m;
                                    return { ...m, contactsDrafts: [...existing, { ...data, status: 'pending' }] };
                                }));
                            } else if (currentEvent === 'keep_draft') {
                                const draftKey = JSON.stringify({ title: data.title, content: data.content });
                                setMessages(prev => prev.map(m => {
                                    if (m.id !== assistantMsgId) return m;
                                    const existing = m.keepDrafts || [];
                                    if (existing.some(d => JSON.stringify({ title: d.title, content: d.content }) === draftKey)) return m;
                                    return { ...m, keepDrafts: [...existing, { ...data, status: 'pending' }] };
                                }));
                            } else if (currentEvent === 'kb_sources') {
                                if (data.sources) {
                                    setMessages(prev => prev.map(m => {
                                        if (m.id !== assistantMsgId) return m;
                                        const existing = m.kbSources || [];
                                        const existingContentKeys = new Set(existing.map(s => (s.content || '').slice(0, 100)));
                                        const newSources = data.sources.filter(s => !existingContentKeys.has((s.content || '').slice(0, 100)));
                                        return { ...m, kbSources: [...existing, ...newSources] };
                                    }));
                                }
                            } else if (currentEvent === 'map_embed') {
                                setMessages(prev => prev.map(m =>
                                    m.id === assistantMsgId ? { ...m, mapEmbeds: [...(m.mapEmbeds || []), data] } : m
                                ));
                            } else if (currentEvent === 'image') {
                                if (data.data && data.mimeType) {
                                    setMessages(prev => prev.map(m =>
                                        m.id === assistantMsgId ? { ...m, images: [...(m.images || []), { data: data.data, mimeType: data.mimeType }] } : m
                                    ));
                                }
                            } else if (currentEvent === 'audio') {
                                if (data.url) {
                                    setMessages(prev => prev.map(m =>
                                        m.id === assistantMsgId ? { ...m, audioFiles: [...(m.audioFiles || []), { url: data.url, mimeType: data.mimeType || 'audio/mpeg', source: data.source || 'elevenlabs' }] } : m
                                    ));
                                }
                            } else if (currentEvent === 'video') {
                                if (data.url && data.mimeType) {
                                    setMessages(prev => prev.map(m =>
                                        m.id === assistantMsgId ? { ...m, videoFiles: [...(m.videoFiles || []), { url: data.url, mimeType: data.mimeType }] } : m
                                    ));
                                }
                            } else if (currentEvent === 'error') {
                                setMessages(prev => prev.map(m =>
                                    m.id === assistantMsgId ? { ...m, content: data.error, isStreaming: false, isError: true } : m
                                ));
                            } else if (currentEvent === 'done') {
                                // Prose-fallback: if the agent didn't call gmail_compose,
                                // push its final text into Gmail's compose via the
                                // content script. Skip if an email_draft already fired —
                                // that was handled by the email_draft branch above.
                                if (isGmailEmbed && !emailDraftEmittedThisTurn && assistantContent.trim()) {
                                    try {
                                        window.parent.postMessage(
                                            { type: 'beeflow:agent_response', text: assistantContent },
                                            '*'
                                        );
                                    } catch {}
                                }
                            }
                        } catch { }
                    }
                }
            }
        } catch (err) {
            setMessages(prev => prev.map(m =>
                m.id === assistantMsgId ? { ...m, content: 'Sorry, something went wrong. Please try again.', isError: true } : m
            ));
        } finally {
            setIsStreaming(false);
            setMessages(prev => prev.map(m =>
                m.id === assistantMsgId ? { ...m, isStreaming: false } : m
            ));
        }
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-[var(--bg-primary)]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-3 border-[var(--border-default)] border-t-[var(--accent-primary)] rounded-full animate-spin" />
                    <p className="text-sm text-[var(--text-muted)]">Loading...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-[var(--bg-primary)]">
                <div className="flex flex-col items-center gap-3 p-6 text-center">
                    <div className="text-3xl">⚠️</div>
                    <p className="text-sm text-red-400">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-full flex flex-col bg-[var(--bg-primary)] overflow-hidden">
            {/* Minimal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex-shrink-0">
                <div className="flex items-center gap-3">
                    {(() => {
                        const av = pickAgentAvatar(agent);
                        if (isImageAvatar(av)) {
                            return (
                                <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shadow-md">
                                    <img src={resolveAvatarSrc(av)} alt="" className="w-full h-full object-cover" />
                                </div>
                            );
                        }
                        if (av) {
                            return (
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center text-xl shadow-md">
                                    {av}
                                </div>
                            );
                        }
                        return (
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center text-sm font-semibold text-white shadow-md">
                                {(agent.name || 'A').charAt(0).toUpperCase()}
                            </div>
                        );
                    })()}
                    <div>
                        <div className="text-sm font-semibold text-[var(--text-primary)]">{agent.name}</div>
                        {agent.description && (
                            <div className="text-xs text-[var(--text-muted)] truncate max-w-[200px]">{agent.description}</div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={toggleTheme}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-tertiary)]"
                        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    >
                        {theme === 'dark' ? (
                            <Sun className="w-4 h-4 text-[var(--text-muted)]" />
                        ) : (
                            <Moon className="w-4 h-4 text-[var(--text-muted)]" />
                        )}
                    </button>
                    <div className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] font-medium opacity-50">
                        <span>🐝</span>
                        <span>Bee Flow</span>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {messages.length === 0 ? (
                    <WelcomeScreen
                        agent={agent}
                        onSendMessage={(text) => { shouldForceScrollRef.current = true; sendMessage(text); }}
                    />
                ) : (
                    <div className="max-w-3xl mx-auto space-y-6 pb-4">
                        {messages.filter(m => !m.parentId).map((msg, idx) => (
                            <MessageItem
                                key={msg.id || idx}
                                idx={idx}
                                msg={msg}
                                selectedAgent={agent}
                                onCopy={(txt) => navigator.clipboard.writeText(txt)}
                            />
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {isGmailEmbed && gmailContext && (
                <div className="px-3 pt-2 text-xs text-[var(--text-muted)] flex items-center gap-1">
                    <span>📧</span>
                    <span>Email thread attached ({(gmailContext.messages || []).length} message{(gmailContext.messages || []).length === 1 ? '' : 's'})</span>
                </div>
            )}

            {/* Input Area - same as main app */}
            <InputArea
                onSendMessage={(text, attachments) => { shouldForceScrollRef.current = true; sendMessage(text, attachments); }}
                isLoading={isStreaming}
                selectedAgent={agent}
                warningText={customWarning}
                input={input}
                setInput={setInput}
            />
        </div>
    );
};

export default EmbedChat;

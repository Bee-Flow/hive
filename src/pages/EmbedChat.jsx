import React, { useState, useRef, useEffect } from 'react';
import MessageItem from '../components/chat/MessageItem';
import WelcomeScreen from '../components/WelcomeScreen';
import InputArea from '../components/InputArea';
import { Sun, Moon } from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';

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
    const [submittedFormIds, setSubmittedFormIds] = useState(new Set());
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
        // the parent, prepend it to the agent-facing message. The UI still
        // shows only the user's original text.
        let agentMessage = userDisplayText;
        const gCtx = gmailContextRef.current;
        if (isGmailEmbed && gCtx) {
            const threadBlock = (gCtx.messages || [])
                .map((m, i, arr) =>
                    `--- Message ${i + 1} of ${arr.length} ---\nFrom: ${m.from || 'unknown'}  Date: ${m.date || 'unknown'}\n${m.body || ''}`)
                .join('\n\n');
            agentMessage =
                `You are helping the user with the following Gmail thread. Reply in the same language as the thread.\n\n` +
                `Subject: ${gCtx.subject || '(no subject)'}\n` +
                `Participants: ${(gCtx.participants || []).join(', ')}\n\n` +
                `Thread (oldest → newest):\n${threadBlock}\n\n` +
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
                            } else if (currentEvent === 'error') {
                                setMessages(prev => prev.map(m =>
                                    m.id === assistantMsgId ? { ...m, content: data.error, isStreaming: false, isError: true } : m
                                ));
                            } else if (currentEvent === 'done') {
                                // Notify the Chrome extension parent so it can
                                // auto-open a Gmail draft when the agent
                                // didn't already emit an email_draft event.
                                if (isGmailEmbed && assistantContent.trim()) {
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

    const handleFormSubmit = (formId, formData) => {
        setSubmittedFormIds(prev => new Set([...prev, formId]));
        sendMessage(`Form submitted: ${JSON.stringify(formData)}`);
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
                    {agent.avatar ? (
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center text-xl shadow-md">
                            {agent.avatar}
                        </div>
                    ) : (
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center text-sm font-semibold text-white shadow-md">
                            {(agent.name || 'A').charAt(0).toUpperCase()}
                        </div>
                    )}
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
                                handleFormSubmit={handleFormSubmit}
                                isFormSubmitted={submittedFormIds.has(`form-${msg.id || idx}`)}
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
            />
        </div>
    );
};

export default EmbedChat;

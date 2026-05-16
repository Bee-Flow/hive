import React, { useState, useRef, useEffect } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import {
    Globe, Bell, RefreshCw, Database, Cloud, FileCode,
    Send, RotateCcw, X, AlertTriangle,
    Wrench, Code, Settings, Package, Eye, Clock, Bot, User,
    Loader2, CheckCircle2, Search, Cpu, FileText, Zap
} from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';

// ---------- Template Cards Data ----------
const TEMPLATES = [
    {
        icon: Globe, label: 'API Integration', color: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)',
        prompt: 'Create a REST API integration component that fetches data from an external API. It should accept a URL, method, headers, and body as inputs and return the parsed JSON response.',
        description: 'Connect to any REST API'
    },
    {
        icon: Bell, label: 'Notification', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
        prompt: 'Create a Slack notification component that sends a message to a Slack channel using a webhook URL. It should accept webhookUrl, channel, and message as inputs.',
        description: 'Slack, Email, Webhook'
    },
    {
        icon: RefreshCw, label: 'Data Transformer', color: '#10b981', gradient: 'linear-gradient(135deg, #10b981, #059669)',
        prompt: 'Create a data transformer component that takes JSON input and transforms it using a JSONPath expression or field mapping. It should support filtering, renaming fields, and restructuring data.',
        description: 'JSON, CSV, mapping'
    },
    {
        icon: Database, label: 'Database Query', color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
        prompt: 'Create a database query component that connects to a PostgreSQL database and executes a SQL query. It should accept host, port, database, user, password, and query as inputs.',
        description: 'SQL, PostgreSQL, MySQL'
    },
    {
        icon: Cloud, label: 'Nextcloud', color: '#0082c9', gradient: 'linear-gradient(135deg, #0082c9, #0064a0)',
        prompt: 'Create a Nextcloud component that lists files in a given folder path. It should use the injected _nextcloudUrl and _accessToken credentials.',
        description: 'Files, shares, calendar'
    },
    {
        icon: FileCode, label: 'File Processing', color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444, #dc2626)',
        prompt: 'Create a file processing component that reads a text file content from input, parses it (CSV or JSON), and returns the structured data with row count and column names.',
        description: 'Parse, convert, validate'
    }
];

const SUGGESTION_CHIPS = [
    'Weather API fetcher', 'Slack notifier', 'CSV to JSON converter',
    'OpenAI text summarizer', 'Email sender via SMTP', 'YouTrack issue reader'
];

// Icon map for progress event types
const PROGRESS_ICONS = {
    thinking: Cpu,
    tool: Wrench,
    finalizing: Zap,
};

// ---------- Styles ----------
const S = {
    // Adaptive background that works in both themes
    assistantBubble: {
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderLeft: '3px solid var(--accent-primary)',
        boxShadow: 'var(--shadow-sm)',
    },
    userBubble: {
        background: 'var(--user-bubble-bg, #e8e8eb)',
        color: 'var(--user-bubble-fg, #000)',
        border: 'none',
        boxShadow: 'var(--shadow-sm)',
    },
    header: {
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-default)',
        backdropFilter: 'blur(12px)',
    },
    inputArea: {
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-default)',
    },
    messageArea: {
        background: 'var(--bg-primary)',
    },
};

const AIComponentDesigner = ({ onComponentCreated, onClose }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [pendingComponent, setPendingComponent] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [currentToolCalls, setCurrentToolCalls] = useState([]);
    const [showTemplates, setShowTemplates] = useState(true);
    const [previewTab, setPreviewTab] = useState('overview');
    const [progressSteps, setProgressSteps] = useState([]); // real-time SSE progress
    const [elapsedTime, setElapsedTime] = useState(0);
    const [expandedSteps, setExpandedSteps] = useState(new Set()); // tracks which steps have their details expanded
    const [changeRequestInput, setChangeRequestInput] = useState('');
    const [showChangeInput, setShowChangeInput] = useState(false);


    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const changeInputRef = useRef(null);
    const loadingStartRef = useRef(null);

    const hasUserMessages = messages.some(m => m.role === 'user' && !m.isHidden);

    useEffect(() => {
        inputRef.current?.focus();
        authFetch(`${API_BASE}/ai/clear`, { method: 'POST' }).catch(console.error);
    }, []);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
    useEffect(() => { if (hasUserMessages) setShowTemplates(false); }, [hasUserMessages]);

    // Elapsed time counter — only tracks wall-clock time while loading
    useEffect(() => {
        if (!isLoading) { setElapsedTime(0); return; }
        loadingStartRef.current = Date.now();
        const c = setInterval(() => setElapsedTime(Math.floor((Date.now() - loadingStartRef.current) / 1000)), 1000);
        return () => clearInterval(c);
    }, [isLoading]);

    useEffect(() => { if (showChangeInput) changeInputRef.current?.focus(); }, [showChangeInput]);

    // ---------- Actions ----------

    // SSE stream reader helper — shared between multi-agent and legacy endpoints
    const readSSEStream = async (res) => {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalData = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop();

            let currentEvent = null;
            for (const line of lines) {
                if (line.startsWith('event: ')) {
                    currentEvent = line.slice(7).trim();
                } else if (line.startsWith('data: ') && currentEvent) {
                    try {
                        const payload = JSON.parse(line.slice(6));
                        if (currentEvent === 'progress') {
                            const p = payload;
                            setProgressSteps(prev => {
                                const steps = [...prev];

                                // — Phase transitions —
                                if (p.type === 'phase_start') {
                                    steps.push({ type: 'phase', text: `Phase ${p.phase}: ${p.name}`, detail: p.message, done: false, phase: p.phase });
                                } else if (p.type === 'phase_done') {
                                    const idx = steps.findLastIndex(s => s.type === 'phase' && s.phase === p.phase);
                                    if (idx >= 0) steps[idx] = { ...steps[idx], done: true, elapsed: p.elapsed, skipped: p.skipped };
                                    // Add outcome summary below the phase header
                                    if (p.outcome) {
                                        steps.push({
                                            type: 'outcome', done: true,
                                            text: p.skipped ? `⏭️ ${p.outcome}` : `📝 ${p.outcome}`,
                                            isError: p.success === false
                                        });
                                    }
                                }
                                // — Orchestrator events —
                                else if (p.type === 'orchestrator_start') {
                                    steps.push({ type: 'orchestrator', text: '🎯 Orchestrator analyzing request...', done: false });
                                } else if (p.type === 'orchestrator_plan') {
                                    const last = steps.findLastIndex(s => s.type === 'orchestrator');
                                    if (last >= 0) steps[last] = { ...steps[last], done: true, text: '🎯 Orchestrator plan ready' };
                                    const planDetail = [
                                        p.intent ? `Intent: ${p.intent}` : null,
                                        p.componentId ? `Component: ${p.componentId}` : null,
                                        ...(p.goals || []).map(g => `• ${g}`)
                                    ].filter(Boolean).join('\n');
                                    steps.push({
                                        type: 'plan', done: true,
                                        text: `📋 Workers: ${(p.workers || []).join(', ')}`,
                                        detail: planDetail || null,
                                        workers: p.workers || []
                                    });
                                } else if (p.type === 'orchestrator_synthesize') {
                                    steps.push({ type: 'synthesize', text: `🧬 ${p.researchResults} research results synthesized`, done: true });
                                }
                                // — Worker events —
                                else if (p.type === 'worker_start') {
                                    steps.push({ type: 'worker', text: `${p.name} researching...`, worker: p.worker, done: false });
                                } else if (p.type === 'worker_done') {
                                    const idx = steps.findLastIndex(s => s.type === 'worker' && s.worker === p.worker);
                                    if (idx >= 0) steps[idx] = { ...steps[idx], done: true, text: `${p.name} (${(p.elapsed / 1000).toFixed(1)}s)`, output: p.output };
                                } else if (p.type === 'worker_error') {
                                    const idx = steps.findLastIndex(s => s.type === 'worker' && s.worker === p.worker);
                                    if (idx >= 0) steps[idx] = { ...steps[idx], done: true, isError: true, text: `❌ ${p.name}: ${p.error}` };
                                    else steps.push({ type: 'worker', text: `❌ ${p.name}: ${p.error}`, done: true, isError: true });
                                } else if (p.type === 'worker_tool') {
                                    steps.push({ type: 'tool', text: `🔧 ${p.worker} → ${p.tool}`, done: false, worker: p.worker, toolName: p.tool });
                                } else if (p.type === 'worker_tool_result') {
                                    // Update the matching tool step with the result
                                    const idx = steps.findLastIndex(s => s.type === 'tool' && s.worker === p.worker && s.toolName === p.tool && !s.hasResult);
                                    if (idx >= 0) {
                                        steps[idx] = {
                                            ...steps[idx], done: true, hasResult: true,
                                            text: `🔧 ${p.worker} → ${p.tool}${p.length ? ` (${(p.length / 1024).toFixed(1)}KB)` : ''}`,
                                            detail: p.preview || null,
                                            isError: p.isError || false
                                        };
                                    }
                                }
                                // — Orchestrator ↔ Worker interaction —
                                else if (p.type === 'orchestrator_to_worker') {
                                    steps.push({
                                        type: 'interaction', done: true,
                                        text: `🎯→ ${p.instruction}`,
                                        detail: p.context || null,
                                        worker: p.worker
                                    });
                                } else if (p.type === 'worker_to_orchestrator') {
                                    steps.push({
                                        type: 'interaction', done: true,
                                        text: `←🎯 ${p.name}: ${p.summary}`,
                                        detail: p.fullResult || (p.resultKeys?.length ? `Result fields: ${p.resultKeys.join(', ')}` : null),
                                        worker: p.worker
                                    });
                                }
                                // — Build + Test events —
                                else if (p.type === 'assemble_start') {
                                    steps.push({ type: 'build', text: `📦 Assembling ${p.name || p.componentId}...`, done: false });
                                } else if (p.type === 'assemble_done') {
                                    const idx = steps.findLastIndex(s => s.type === 'build');
                                    if (idx >= 0) steps[idx] = { ...steps[idx], done: true, text: `📦 Assembled ${p.componentId}` };
                                } else if (p.type === 'assemble_error') {
                                    steps.push({ type: 'error', text: `❌ Assembly failed: ${p.error}`, done: true, isError: true });
                                } else if (p.type === 'test_start') {
                                    steps.push({ type: 'test', text: `🧪 Testing ${p.componentId}...`, done: false });
                                } else if (p.type === 'test_result') {
                                    const idx = steps.findLastIndex(s => s.type === 'test');
                                    if (idx >= 0) steps[idx] = {
                                        ...steps[idx], done: true, isError: !p.success,
                                        text: p.success ? `✅ Test passed: ${p.componentId}` : `❌ Test failed: ${p.error || 'see details'}`
                                    };
                                } else if (p.type === 'build_retry') {
                                    steps.push({ type: 'retry', text: `🔄 Retry ${p.attempt}/${p.maxRetries}: ${p.error}`, done: true, isError: true });
                                }
                                else if (p.type === 'orchestrator_eval') {
                                    steps.push({ type: 'eval', text: `🎯 ${p.message}`, done: false });
                                } else if (p.type === 'orchestrator_eval_result') {
                                    const idx = steps.findLastIndex(s => s.type === 'eval');
                                    if (idx >= 0) steps[idx] = {
                                        ...steps[idx], done: true,
                                        text: p.decision === 'proceed'
                                            ? `✅ ${p.phase} phase approved: ${p.reason}`
                                            : `🔄 ${p.phase} phase retry: ${p.reason}`
                                    };
                                }

                                // — Done —
                                else if (p.type === 'done') {
                                    steps.push({ type: 'done', text: `🎉 ${p.success !== false ? 'Complete' : 'Finished with errors'}: ${p.componentId} (${(p.totalElapsed / 1000).toFixed(1)}s)`, done: true, isError: p.success === false });
                                }
                                return steps;
                            });
                        } else if (currentEvent === 'done') {
                            finalData = payload;
                        } else if (currentEvent === 'error') {
                            setProgressSteps(prev => [...prev, { type: 'error', text: `❌ ${payload.error}`, done: true, isError: true }]);
                            throw new Error(payload.error || 'Unknown stream error');
                        }
                    } catch (e) {
                        if (currentEvent === 'error') throw e;
                        console.warn('SSE parse error:', e);
                    }
                    currentEvent = null;
                }
            }
        }

        if (!finalData) throw new Error('Stream ended without a response');
        return finalData;
    };

    const sendMessage = async (userMessage, isHidden = false) => {
        if (!userMessage.trim() || isLoading) return;
        setMessages(prev => [...prev, { role: 'user', content: userMessage, isHidden }]);
        setIsLoading(true);
        setCurrentToolCalls([]);
        setProgressSteps([{ type: 'thinking', text: 'Starting...', done: false }]);

        try {
            const endpoint = `${API_BASE}/ai/chat-stream`;
            const body = { message: userMessage };

            const res = await authFetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const rawText = await res.text();
                let errMsg;
                try { const d = JSON.parse(rawText); errMsg = d.error; } catch { }
                errMsg = errMsg || `Server error ${res.status}`;
                setMessages(prev => [...prev, {
                    role: 'assistant', content: errMsg, isError: true,
                    errorDetails: { message: errMsg, raw: rawText.slice(0, 500) || null }
                }]);
                return;
            }

            const finalData = await readSSEStream(res);

            if (finalData.error) {
                setMessages(prev => [...prev, {
                    role: 'assistant', content: finalData.error, isError: true,
                    errorDetails: { message: finalData.error, raw: null }
                }]);
            } else {
                if (finalData.toolCalls?.length > 0) {
                    setCurrentToolCalls(finalData.toolCalls);
                    const visible = finalData.toolCalls.filter(t => t.name !== 'configure_outputs_interaction');
                    if (visible.length > 0) {
                        setMessages(prev => [...prev, {
                            role: 'system',
                            content: `Used ${visible.length} tool(s): ${visible.map(t => t.name.replace(/_/g, ' ')).join(', ')}`,
                            isToolInfo: true, toolCalls: visible
                        }]);
                    }
                }
                setMessages(prev => [...prev, { role: 'assistant', content: finalData.message, toolCalls: finalData.toolCalls }]);
                if (finalData.component) { setPendingComponent(finalData.component); setPreviewTab('overview'); }
            }
        } catch (error) {
            setMessages(prev => [...prev, {
                role: 'assistant', content: `Failed to connect to AI: ${error.message}`,
                isError: true, errorDetails: { message: error.message, raw: null }
            }]);
            setCurrentToolCalls([]);
        } finally {
            setIsLoading(false);
            setProgressSteps([]);
        }
    };

    const handleSubmit = async (e) => { e.preventDefault(); if (!input.trim() || isLoading) return; const m = input.trim(); setInput(''); await sendMessage(m); };
    const handleTemplateClick = (t) => { setShowTemplates(false); sendMessage(t.prompt); };
    const handleChipClick = (c) => sendMessage(`Create a ${c} component`);

    const handleCreateComponent = async () => {
        if (!pendingComponent) return;
        setIsCreating(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/create-component`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ component: pendingComponent })
            });
            const data = await res.json();
            if (data.error) {
                setMessages(prev => [...prev, { role: 'assistant', content: `Failed to create component: ${data.error}`, isError: true, errorDetails: { message: data.error } }]);
            } else {
                setMessages(prev => [...prev, { role: 'assistant', content: `✅ **Component "${pendingComponent.name}" created successfully!**\n\nVerifying output and defining structured outputs...` }]);
                const id = pendingComponent.id;
                setPendingComponent(null);
                onComponentCreated?.(id);
                setTimeout(() => sendMessage(`I have created the component '${id}'. Please use the 'execute_component' tool to run it with some sample inputs (infer them from the inputs schema). Display the result to me, and then ask me which fields from the output should be part of the official 'outputs' schema.`, true), 1000);
            }
        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', content: `Failed to create component: ${error.message}`, isError: true, errorDetails: { message: error.message } }]);
        } finally { setIsCreating(false); }
    };

    const handleRequestChanges = () => setShowChangeInput(true);
    const submitChangeRequest = () => {
        const t = changeRequestInput.trim();
        if (!t) return;
        sendMessage(`Please modify the component: ${t}. Generate the updated component JSON.`);
        setPendingComponent(null); setShowChangeInput(false); setChangeRequestInput('');
    };

    const handleAutoFix = (msg) => sendMessage(`The previous operation failed with error: "${msg}". Please investigate, search for documentation if needed, and fix the issue.`, true);
    const handleOutputsSelected = (o) => sendMessage(`I have configured the outputs. The schema is: ${JSON.stringify(o, null, 2)}\n\nPlease use the 'update_component_outputs' tool to save this configuration.`, true);

    const handleClearChat = async () => {
        try {
            await authFetch(`${API_BASE}/ai/clear`, { method: 'POST' });
            setMessages([]); setPendingComponent(null); setShowTemplates(true);
            setShowChangeInput(false); setChangeRequestInput('');
        } catch (e) { console.error('Failed to clear chat:', e); }
    };

    // ---------- Render Helpers ----------

    const renderToolInfo = (msg, index) => (
        <div key={index} className="flex justify-center my-1.5" style={{ animation: 'fadeSlideIn 0.3s ease-out' }}>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium"
                style={{ background: 'rgba(99, 102, 241, 0.08)', color: 'var(--accent-primary)', border: '1px solid rgba(99, 102, 241, 0.12)' }}>
                <Wrench className="w-3 h-3" style={{ opacity: 0.7 }} />
                {msg.content}
            </div>
        </div>
    );

    const renderErrorMessage = (msg, index) => (
        <div key={index} className="flex gap-2.5 mb-3 items-start" style={{ animation: 'fadeSlideIn 0.3s ease-out' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(239, 68, 68, 0.12)' }}>
                <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'var(--error)' }} />
            </div>
            <div className="flex-1 max-w-[75%] rounded-xl overflow-hidden"
                style={{ background: 'var(--bg-card)', border: '1px solid rgba(239, 68, 68, 0.2)', borderLeft: '3px solid var(--error)', boxShadow: 'var(--shadow-sm)' }}>
                <div className="px-3 py-1.5" style={{ background: 'rgba(239, 68, 68, 0.06)', borderBottom: '1px solid rgba(239, 68, 68, 0.1)' }}>
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--error)' }}>Something went wrong</span>
                </div>
                <div className="px-3 py-2.5">
                    <p className="text-[12px] mb-2" style={{ color: 'var(--text-primary)', lineHeight: 1.4 }}>{msg.content}</p>
                    {msg.errorDetails?.raw && (
                        <details className="mb-2">
                            <summary className="text-[11px] cursor-pointer select-none font-medium"
                                style={{ color: 'var(--text-muted)' }}>Show details ▸</summary>
                            <pre className="mt-1.5 p-2 rounded-lg text-[10px] overflow-x-auto leading-relaxed"
                                style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                                {typeof msg.errorDetails.raw === 'object' ? JSON.stringify(msg.errorDetails.raw, null, 2) : msg.errorDetails.raw}
                            </pre>
                        </details>
                    )}
                    <button onClick={() => handleAutoFix(msg.content)} disabled={isLoading}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                        style={{ background: 'rgba(239, 68, 68, 0.08)', color: 'var(--error)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                        <Wrench className="w-3 h-3" /> Auto-Fix
                    </button>
                </div>
            </div>
        </div>
    );

    const renderMessage = (msg, index) => {
        const isUser = msg.role === 'user';
        if (msg.isToolInfo) return renderToolInfo(msg, index);
        if (msg.isError) return renderErrorMessage(msg, index);

        return (
            <div key={index} className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''} mb-3 items-start`}
                style={{ animation: 'fadeSlideIn 0.3s ease-out' }}>
                {/* Avatar */}
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={isUser ? {
                        background: 'var(--accent-primary)',
                        color: 'var(--accent-primary-fg, #fff)',
                        boxShadow: '0 0 0 1px var(--border-subtle), 0 2px 6px var(--accent-glow)',
                    } : {
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-default)',
                    }}>
                    {isUser
                        ? <User className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary-fg, #fff)' }} />
                        : <Bot className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />}
                </div>
                {/* Bubble */}
                <div className="max-w-[75%] rounded-xl px-3.5 py-2.5"
                    style={isUser ? {
                        ...S.userBubble,
                        borderRadius: '14px 14px 4px 14px',
                    } : {
                        ...S.assistantBubble,
                        borderRadius: '14px 14px 14px 4px',
                    }}>
                    <div className="text-[12.5px] leading-[1.5] markdown-content compact-chat"
                        style={{ color: isUser ? 'var(--user-bubble-fg, #000)' : 'var(--text-primary)' }}>
                        <MarkdownRenderer content={msg.content} />
                    </div>
                    {/* Output Selector */}
                    {msg.toolCalls?.some(t => t.name === 'configure_outputs_interaction') && (() => {
                        try {
                            const tc = msg.toolCalls.find(t => t.name === 'configure_outputs_interaction');
                            const args = typeof tc.args === 'object' ? tc.args : typeof tc.arguments === 'string' ? JSON.parse(tc.arguments) : tc.arguments;
                            return <OutputSelector sampleOutput={args?.sampleOutput} onSubmit={handleOutputsSelected} />;
                        } catch (e) { console.error('configure_outputs parse error:', e); return null; }
                    })()}
                </div>
            </div>
        );
    };

    const renderLoadingIndicator = () => {
        const phaseNames = { 1: 'Research', 2: 'User Questions', 3: 'Build + Test', 4: 'Deploy' };
        const phaseIcons = { 1: '📚', 2: '🔑', 3: '🔨', 4: '🚀' };
        const phaseColors = { 1: '#8b5cf6', 2: '#ef4444', 3: '#10b981', 4: '#3b82f6' };

        // Group steps by phase for visual structure
        const groups = [];
        for (const step of progressSteps) {
            if (step.type === 'phase') {
                groups.push({ phase: step.phase, name: step.text, detail: step.detail, done: step.done, elapsed: step.elapsed, steps: [] });
            } else if (groups.length > 0) {
                groups[groups.length - 1].steps.push(step);
            } else {
                // Steps before any phase (initial pipeline start)
                if (!groups.length || groups[0]?.phase) groups.unshift({ phase: 0, name: '🐝 Pipeline', steps: [step], done: false });
                else groups[0].steps.push(step);
            }
        }

        return (
            <div className="flex gap-2.5 mb-3 items-start" style={{ animation: 'fadeSlideIn 0.3s ease-out' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)' }}>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--accent-primary)' }} />
                </div>
                <div className="rounded-xl px-3.5 py-2.5"
                    style={{ ...S.assistantBubble, borderRadius: '14px 14px 14px 4px', minWidth: '280px', maxWidth: '480px' }}>

                    {groups.map((group, gi) => (
                        <div key={gi} style={{ marginBottom: gi < groups.length - 1 ? '8px' : 0 }}>
                            {/* Phase header */}
                            {group.phase > 0 && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '4px 8px', marginBottom: '4px', borderRadius: '6px',
                                    background: group.done ? 'transparent' : `${phaseColors[group.phase]}15`,
                                    borderLeft: `3px solid ${group.done ? 'var(--success)' : (phaseColors[group.phase] || 'var(--accent-primary)')}`
                                }}>
                                    <span style={{ fontSize: '13px' }}>{phaseIcons[group.phase] || '▶️'}</span>
                                    <span style={{
                                        fontSize: '12px', fontWeight: 600,
                                        color: group.done ? 'var(--text-muted)' : 'var(--text-primary)'
                                    }}>
                                        Phase {group.phase}: {phaseNames[group.phase] || group.name}
                                    </span>
                                    {group.done && group.elapsed && (
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto', fontFamily: 'monospace' }}>
                                            {(group.elapsed / 1000).toFixed(1)}s
                                        </span>
                                    )}
                                    {!group.done && (
                                        <Loader2 className="w-3 h-3 animate-spin" style={{ color: phaseColors[group.phase], marginLeft: 'auto' }} />
                                    )}
                                </div>
                            )}

                            {/* Steps within this phase */}
                            <div style={{ paddingLeft: group.phase > 0 ? '16px' : '0' }}>
                                {group.steps.map((step, si) => {
                                    // Build a unique key for expand/collapse tracking
                                    const stepKey = `${gi}-${si}`;
                                    const isExpanded = expandedSteps.has(stepKey);
                                    const hasDetail = !!step.detail;
                                    const toggleExpand = () => {
                                        setExpandedSteps(prev => {
                                            const next = new Set(prev);
                                            next.has(stepKey) ? next.delete(stepKey) : next.add(stepKey);
                                            return next;
                                        });
                                    };
                                    return (
                                        <div key={si} style={{
                                            display: 'flex', alignItems: 'flex-start', gap: '6px',
                                            padding: step.type === 'interaction' ? '3px 0' : '2px 0',
                                            opacity: step.done && !step.isError && step.type !== 'interaction' ? 0.7 : 1,
                                            transition: 'opacity 0.3s',
                                            ...(step.type === 'interaction' ? { borderLeft: '2px solid var(--accent-primary)', paddingLeft: '8px', marginLeft: '2px', marginTop: '2px' } : {}),
                                            ...(hasDetail ? { cursor: 'pointer' } : {})
                                        }}
                                            onClick={hasDetail ? toggleExpand : undefined}
                                        >
                                            {step.done ? (
                                                step.isError
                                                    ? <AlertTriangle className="w-3 h-3 shrink-0" style={{ color: 'var(--error, #ef4444)', marginTop: '2px' }} />
                                                    : <CheckCircle2 className="w-3 h-3 shrink-0" style={{ color: 'var(--success)', marginTop: '2px' }} />
                                            ) : (
                                                <Loader2 className="w-3 h-3 animate-spin shrink-0" style={{ color: 'var(--accent-primary)', marginTop: '2px' }} />
                                            )}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <span style={{
                                                    fontSize: step.type === 'interaction' ? '10.5px' : '11px', lineHeight: '16px',
                                                    color: step.isError ? 'var(--error, #ef4444)'
                                                        : step.type === 'interaction' ? 'var(--text-secondary, #9ca3af)'
                                                            : step.done ? 'var(--text-muted)' : 'var(--text-primary)',
                                                    fontWeight: step.type === 'interaction' ? 500 : (!step.done ? 600 : 400)
                                                }}>
                                                    {hasDetail && <span style={{ fontSize: '8px', marginRight: '4px', color: 'var(--text-muted)' }}>{isExpanded ? '▾' : '▸'}</span>}
                                                    {step.text}
                                                </span>
                                                {/* Collapsible detail */}
                                                {step.detail && isExpanded && (
                                                    <div style={{
                                                        fontSize: '10px',
                                                        color: step.isError ? 'var(--error, #ef4444)'
                                                            : step.type === 'interaction' || step.type === 'tool' ? 'var(--text-secondary, #9ca3af)' : 'var(--text-muted)',
                                                        marginTop: '4px', lineHeight: '14px',
                                                        fontStyle: 'normal',
                                                        whiteSpace: 'pre-wrap',
                                                        wordBreak: 'break-word',
                                                        fontFamily: (step.type === 'tool' || (step.type === 'interaction' && step.text?.startsWith('←')))
                                                            ? 'ui-monospace, SFMono-Regular, Consolas, monospace' : 'inherit',
                                                        maxHeight: '200px',
                                                        overflowY: 'auto',
                                                        padding: (step.type === 'tool' || step.type === 'interaction') ? '6px 8px' : '2px 0',
                                                        background: (step.type === 'tool' || step.type === 'interaction') ? 'var(--bg-tertiary, rgba(0,0,0,0.05))' : 'transparent',
                                                        borderRadius: '4px',
                                                        animation: 'fadeSlideIn 0.2s ease-out'
                                                    }}>
                                                        {step.detail}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {/* Timer */}
                    {elapsedTime > 2 && (
                        <div className="flex items-center gap-1.5 mt-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                            <Clock className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                            <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{elapsedTime}s</span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // ---------- Main Render ----------

    return (
        <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3" style={S.header}>
                <div className="flex items-center gap-3">
                    <div>
                        <h2 className="font-bold text-[14px]" style={{ color: 'var(--text-primary)' }}>AI Component Designer</h2>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Describe what you need, get production-ready code</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleClearChat} title="New conversation"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                        style={{ color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)' }}>
                        <RotateCcw className="w-3.5 h-3.5" /> New Chat
                    </button>
                    {onClose && (
                        <button onClick={onClose} title="Close"
                            className="p-2 rounded-lg transition-all hover:scale-[1.05]"
                            style={{ color: 'var(--text-muted)', background: 'var(--bg-tertiary)' }}>
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Messages Area — shrink when credential form is filling the space */}
            <div className="flex-1 overflow-auto px-5 py-4" style={S.messageArea}>
                {/* Welcome & Templates */}
                {showTemplates && !hasUserMessages && (
                    <div className="max-w-xl mx-auto mb-8" style={{ animation: 'fadeSlideIn 0.4s ease-out' }}>
                        <div className="text-center mb-6">
                            <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                                What would you like to build?
                            </h3>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                Pick a template or describe your component
                            </p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            {TEMPLATES.map((tmpl, idx) => {
                                const Icon = tmpl.icon;
                                return (
                                    <button key={tmpl.label} onClick={() => handleTemplateClick(tmpl)}
                                        className="group p-3.5 rounded-xl text-left transition-all hover:scale-[1.03] active:scale-[0.97]"
                                        style={{
                                            background: 'var(--bg-card)',
                                            border: '1px solid var(--border-default)',
                                            boxShadow: 'var(--shadow-sm)',
                                            animation: `fadeSlideIn 0.3s ease-out ${idx * 60}ms backwards`,
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = tmpl.color;
                                            e.currentTarget.style.boxShadow = `var(--shadow-md), 0 0 20px ${tmpl.color}18`;
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.borderColor = 'var(--border-default)';
                                            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                                        }}>
                                        <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2.5"
                                            style={{ background: tmpl.gradient, boxShadow: `0 2px 8px ${tmpl.color}30` }}>
                                            <Icon className="text-white" style={{ width: 16, height: 16 }} />
                                        </div>
                                        <p className="text-[13px] font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>
                                            {tmpl.label}
                                        </p>
                                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                            {tmpl.description}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Chat Messages */}
                {messages.filter(m => !m.isHidden).map((m, i) => renderMessage(m, i))}

                {/* Loading */}
                {isLoading && renderLoadingIndicator()}

                <div ref={messagesEndRef} />
            </div>

            {/* Pending Component Preview */}
            {pendingComponent && (
                <div className="mx-4 mb-3 rounded-xl overflow-hidden" style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--accent-primary)',
                    boxShadow: '0 0 24px rgba(99, 102, 241, 0.1), var(--shadow-md)',
                    maxHeight: '45vh',
                    animation: 'fadeSlideIn 0.3s ease-out'
                }}>
                    <div className="flex items-center justify-between px-4 py-2.5" style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-default)' }}>
                        <div className="flex items-center gap-2">
                            <Package className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{pendingComponent.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono text-white"
                                style={{ background: 'var(--accent-primary)' }}>{pendingComponent.id}</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                            Ready to Create
                        </span>
                    </div>

                    <div className="flex" style={{ borderBottom: '1px solid var(--border-default)' }}>
                        {[
                            { id: 'overview', label: 'Overview', icon: Eye },
                            { id: 'code', label: 'Code', icon: Code },
                            { id: 'config', label: 'Config', icon: Settings },
                        ].map(tab => {
                            const TabIcon = tab.icon;
                            const active = previewTab === tab.id;
                            return (
                                <button key={tab.id} onClick={() => setPreviewTab(tab.id)}
                                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors border-b-2"
                                    style={{
                                        color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
                                        borderColor: active ? 'var(--accent-primary)' : 'transparent',
                                        background: active ? 'rgba(99, 102, 241, 0.05)' : 'transparent'
                                    }}>
                                    <TabIcon className="w-3.5 h-3.5" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="overflow-auto" style={{ maxHeight: '25vh' }}>
                        {previewTab === 'overview' && (
                            <div className="p-4">
                                <p className="text-[13px] mb-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{pendingComponent.description}</p>
                                <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                                    <span>📂 {pendingComponent.category}</span>
                                    <span>📥 {Object.keys(pendingComponent.inputs || {}).length} inputs</span>
                                    <span>📤 {Object.keys(pendingComponent.outputs || {}).length} outputs</span>
                                    <span>📦 {Object.keys(pendingComponent.dependencies || {}).length} deps</span>
                                </div>
                                {Object.keys(pendingComponent.inputs || {}).length > 0 && (
                                    <div className="mt-3">
                                        <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Inputs:</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {Object.entries(pendingComponent.inputs || {}).map(([k, v]) => (
                                                <span key={k} className="text-[11px] px-2 py-0.5 rounded-md font-mono"
                                                    style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                                                    {k}: <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{typeof v === 'string' ? v : v?.type || 'any'}</span>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {previewTab === 'code' && (
                            <pre className="p-4 text-xs overflow-auto font-mono leading-relaxed"
                                style={{ color: 'var(--text-primary)', background: 'var(--bg-primary)', margin: 0 }}>
                                <code>{pendingComponent.code || '// No code generated'}</code>
                            </pre>
                        )}
                        {previewTab === 'config' && (
                            <div className="p-4 space-y-3">
                                <div>
                                    <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Dependencies</p>
                                    <pre className="p-3 rounded-lg text-xs font-mono"
                                        style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
                                        {JSON.stringify(pendingComponent.dependencies || {}, null, 2)}
                                    </pre>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Outputs Schema</p>
                                    <pre className="p-3 rounded-lg text-xs font-mono"
                                        style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
                                        {JSON.stringify(pendingComponent.outputs || {}, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-3" style={{ borderTop: '1px solid var(--border-default)' }}>
                        {showChangeInput && (
                            <div className="flex gap-2 mb-2.5">
                                <input ref={changeInputRef} type="text" value={changeRequestInput}
                                    onChange={(e) => setChangeRequestInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && submitChangeRequest()}
                                    placeholder="Describe what to change..."
                                    className="flex-1 px-3 py-2 rounded-lg text-[13px]"
                                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', outline: 'none' }} />
                                <button onClick={submitChangeRequest} disabled={!changeRequestInput.trim()}
                                    className="btn-primary px-3 py-2"><Send className="w-3.5 h-3.5" /></button>
                                <button onClick={() => { setShowChangeInput(false); setChangeRequestInput(''); }}
                                    className="p-2 rounded-lg" style={{ color: 'var(--text-muted)', background: 'var(--bg-tertiary)' }}>
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <button onClick={handleCreateComponent} disabled={isCreating}
                                className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 py-2.5">
                                {isCreating
                                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
                                    : <>Create Component</>}
                            </button>
                            {!showChangeInput && (
                                <button onClick={handleRequestChanges} disabled={isCreating}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all hover:scale-[1.02]"
                                    style={{ color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)' }}>
                                    Request Changes
                                </button>
                            )}
                            <button onClick={() => { setPendingComponent(null); setShowChangeInput(false); }} disabled={isCreating}
                                className="px-3 py-2 rounded-lg text-xs font-semibold transition-all hover:scale-[1.02]"
                                style={{ color: 'var(--text-muted)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            )}



            {/* Input Area */}
            <div style={S.inputArea}>
                {!hasUserMessages && (
                    <div className="px-5 pt-3 pb-0 flex flex-wrap gap-1.5">
                        {SUGGESTION_CHIPS.map(chip => (
                            <button key={chip} onClick={() => handleChipClick(chip)} disabled={isLoading}
                                className="px-3 py-1 rounded-full text-[11px] font-medium transition-all hover:scale-[1.03] active:scale-[0.97]"
                                style={{ border: '1px solid var(--border-default)', color: 'var(--text-secondary)', background: 'var(--bg-tertiary)' }}>
                                {chip}
                            </button>
                        ))}
                    </div>
                )}
                <form onSubmit={handleSubmit} className="p-3 px-5">
                    <div className="flex gap-2 items-center p-1 rounded-xl"
                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
                        <input ref={inputRef} type="text" value={input}
                            onChange={(e) => setInput(e.target.value)} disabled={isLoading}
                            placeholder={
                                hasUserMessages
                                    ? 'Ask for changes or describe another component...'
                                    : 'Describe the component you want to create...'
                            }
                            className="flex-1 bg-transparent border-none outline-none px-3 py-2 text-[13px]"
                            style={{ color: 'var(--text-primary)' }} />
                        <button type="submit" disabled={isLoading || !input.trim()}
                            className="p-2.5 rounded-lg transition-all hover:scale-[1.05] active:scale-[0.95] disabled:opacity-30"
                            style={{ background: input.trim() ? 'linear-gradient(135deg, var(--accent-primary), #818cf8)' : 'var(--bg-tertiary)', color: input.trim() ? '#fff' : 'var(--text-muted)' }}>
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </form>
            </div>

            <style>{`
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .compact-chat h1 { font-size: 15px !important; margin: 0.5rem 0 0.25rem !important; }
                .compact-chat h2 { font-size: 14px !important; margin: 0.4rem 0 0.2rem !important; }
                .compact-chat h3 { font-size: 13px !important; margin: 0.3rem 0 0.15rem !important; }
                .compact-chat h4 { font-size: 12.5px !important; margin: 0.25rem 0 0.1rem !important; }
                .compact-chat p { margin: 0.25rem 0 !important; }
                .compact-chat p:first-child { margin-top: 0 !important; }
                .compact-chat p:last-child { margin-bottom: 0 !important; }
                .compact-chat .code-block { padding: 0.6rem !important; margin: 0.4rem 0 !important; font-size: 11px !important; }
                .compact-chat ul, .compact-chat ol { margin: 0.25rem 0 !important; padding-left: 1.2rem !important; }
                .compact-chat li { margin: 0.1rem 0 !important; }
                .compact-chat .inline-code { font-size: 0.8em !important; padding: 0.1rem 0.3rem !important; }
            `}</style>
        </div>
    );
};

export default AIComponentDesigner;

// --- Subcomponent: Output Selector ---
const OutputSelector = ({ sampleOutput, onSubmit }) => {
    const [selectedFields, setSelectedFields] = useState({});

    useEffect(() => {
        const init = {};
        if (sampleOutput && typeof sampleOutput === 'object') {
            Object.keys(sampleOutput).forEach(k => {
                init[k] = { selected: k === 'result' || Object.keys(sampleOutput).length === 1, rename: k, type: typeof sampleOutput[k] };
            });
        }
        setSelectedFields(init);
    }, [sampleOutput]);

    const toggle = (k) => setSelectedFields(p => ({ ...p, [k]: { ...p[k], selected: !p[k].selected } }));
    const rename = (k, n) => setSelectedFields(p => ({ ...p, [k]: { ...p[k], rename: n } }));

    const submit = () => {
        const outputs = {};
        let n = 0;
        Object.keys(selectedFields).forEach(k => {
            if (selectedFields[k].selected) {
                outputs[selectedFields[k].rename || k] = { type: selectedFields[k].type, description: `Output ${selectedFields[k].rename || k}` };
                n++;
            }
        });
        if (n === 0) return;
        onSubmit(outputs);
    };

    return (
        <div className="mt-3 p-3 rounded-xl" style={{ background: 'rgba(99, 102, 241, 0.06)', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
            <h4 className="text-[13px] font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>Select Outputs</h4>
            <p className="text-[11px] mb-3" style={{ color: 'var(--text-muted)' }}>Choose which fields to expose as component outputs.</p>
            <div className="space-y-1.5 mb-3">
                {Object.keys(selectedFields).map(k => (
                    <div key={k} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                        <input type="checkbox" checked={selectedFields[k]?.selected || false} onChange={() => toggle(k)}
                            style={{ accentColor: 'var(--accent-primary)' }} />
                        <div className="flex-1 flex gap-2 items-center min-w-0">
                            <span className="text-[11px] font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>{k}</span>
                            <span style={{ color: 'var(--text-muted)', opacity: 0.4, fontSize: 11 }}>→</span>
                            <input type="text" value={selectedFields[k]?.rename || ''} onChange={(e) => rename(k, e.target.value)}
                                placeholder={k} disabled={!selectedFields[k]?.selected}
                                className="flex-1 font-mono min-w-0 px-2 py-0.5 rounded bg-transparent border-none outline-none"
                                style={{ fontSize: 11, color: 'var(--text-primary)' }} />
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                                {selectedFields[k]?.type}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
            <button onClick={submit} className="btn-primary w-full text-xs py-2">Save Output Configuration</button>
        </div>
    );
};

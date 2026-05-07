import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Power, Eye, Sparkles, Wrench, ChevronDown } from 'lucide-react';
import { API_BASE, authFetch } from '../../../../utils/helpers';
import scopedStorage from '../../../../utils/scopedStorage';
import InputArea from '../../../InputArea';
import MarkdownRenderer from '../../../MarkdownRenderer';
import { tierLabel } from '../../../tierMeta';
import DiagramPane from './DiagramPane';
import StepInspector from './StepInspector';
import RunHistory from './RunHistory';
import DryRunPanel from './DryRunPanel';
import useAutomationApi from '../../../../hooks/useAutomationApi';
import useAutomationBuilderStream from '../../../../hooks/useAutomationBuilderStream';

/**
 * Split-view conversational builder.
 *
 * Reuses the EXACT same <InputArea> as direct chat (directMode=true) so
 * users get apps menu, model-tier selector, web search toggle, and file
 * attachments. State (tier, web-search, disabled media) lives in
 * scopedStorage so it persists across sessions just like direct chat.
 */
export default function BuilderShell({ automationId, onBack, user }) {
    const api = useAutomationApi();
    const { state, send, hydrate } = useAutomationBuilderStream({ automationId });
    const [serverAutomation, setServerAutomation] = useState(null);
    const [selectedStepId, setSelectedStepId] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [hasHydrated, setHasHydrated] = useState(false);

    // ── InputArea state (mirrors direct chat) ────────────────────────────
    const [chatInput, setChatInput] = useState('');
    const [modelTiers, setModelTiers] = useState({});
    const [selectedTier, setSelectedTier] = useState(() => scopedStorage.getItem('automationBuilderTier') || 'auto');

    useEffect(() => {
        scopedStorage.setItem('automationBuilderTier', selectedTier);
    }, [selectedTier]);

    // Load model tiers (same endpoint direct chat uses).
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const r = await authFetch(`${API_BASE}/ai/config/tiers-for-user?taskType=direct_chat`);
                if (r.ok && alive) setModelTiers(await r.json());
            } catch (_) { /* silent */ }
        })();
        return () => { alive = false; };
    }, []);

    // Stale-tier fallback: when scopedStorage held a tier the server no
    // longer returns for this user (beta revoked, custom tier deleted),
    // snap back to 'auto' so the picker doesn't show an undefined slot.
    // Mirrors AgentHub.jsx:974-980 for direct chat.
    useEffect(() => {
        const keys = Object.keys(modelTiers || {});
        if (keys.length === 0) return;
        if (!keys.includes(selectedTier)) {
            setSelectedTier(keys.includes('auto') ? 'auto' : keys[0]);
        }
    }, [modelTiers, selectedTier]);

    const messagesContainerRef = useRef(null);
    const messagesEndRef = useRef(null);
    useEffect(() => {
        if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }, [state.messages.length, state.running]);

    const effectiveDef = state.draft || serverAutomation?.definition || null;

    useEffect(() => {
        const aid = state.automationId || automationId;
        if (!aid) return;
        let alive = true;
        api.getAutomation(aid).then(d => { if (alive) setServerAutomation(d.automation); }).catch(() => {});
        return () => { alive = false; };
    }, [state.automationId, automationId, state.dryRun, state.finalizedId]); // eslint-disable-line

    // One-shot snapshot rehydration. On mount with an existing automation
    // id, fetch the latest builder-session snapshot and hydrate so the
    // chat panel + draft + summary survive a refresh or SSE drop.
    useEffect(() => {
        const aid = state.automationId || automationId;
        if (!aid || hasHydrated) return;
        let alive = true;
        (async () => {
            try {
                const r = await authFetch(`${API_BASE}/api/automation/builder/session/${aid}`);
                if (!alive) return;
                if (r.ok) {
                    const j = await r.json();
                    if (j?.snapshot) hydrate(j.snapshot);
                }
            } catch (_) { /* silent — snapshot is optional */ }
            if (alive) setHasHydrated(true);
        })();
        return () => { alive = false; };
    }, [state.automationId, automationId, hasHydrated, hydrate]);

    const allSteps = useMemo(() => {
        if (!effectiveDef) return [];
        return [effectiveDef.trigger, ...(effectiveDef.steps || [])].filter(Boolean);
    }, [effectiveDef]);

    const selectedStep = useMemo(() => allSteps.find(s => s.id === selectedStepId) || null, [allSteps, selectedStepId]);
    const selectedRunStep = useMemo(() => (state.steps || []).find(s => s.stepId === selectedStepId) || null, [state.steps, selectedStepId]);

    // InputArea calls onSendMessage(text, attachments, parentId).
    // We read webSearchEnabled / disabledMedia from scopedStorage so the
    // toggles in the input UI are picked up automatically.
    const onSend = (text, attachments) => {
        setError(null);
        const webSearchEnabled = scopedStorage.getItem('webSearchEnabled') !== 'false';
        const disabledMedia = scopedStorage.getJSON('disabledMedia', {}) || {};
        send({
            message: text,
            modelTier: selectedTier || 'auto',
            attachments: attachments || [],
            webSearchEnabled,
            disabledMedia,
        });
    };

    const onActivate = async () => {
        const aid = state.automationId || serverAutomation?.id;
        if (!aid) return;
        setBusy(true);
        try { const r = await api.activate(aid); setServerAutomation(r.automation); }
        catch (e) { setError(e.message); }
        setBusy(false);
    };
    const onDeactivate = async () => {
        const aid = state.automationId || serverAutomation?.id;
        if (!aid) return;
        setBusy(true);
        try { const r = await api.deactivate(aid); setServerAutomation(r.automation); }
        catch (e) { setError(e.message); }
        setBusy(false);
    };
    const onDryRun = async () => {
        const aid = state.automationId || serverAutomation?.id;
        if (!aid) return;
        setBusy(true); setError(null);
        try { await api.dryRun(aid); }
        catch (e) { setError(e.message); }
        setBusy(false);
    };

    // Unsaved-changes guard. The builder persists every mutation to the
    // server so the only "unsaved" window is between the local SSE-driven
    // draft update and the server's snapshot persistence at end-of-turn.
    // We block accidental tab-close while the SSE turn is mid-flight or
    // the local draft diverges from the last server snapshot.
    useEffect(() => {
        const handler = (e) => {
            if (!state.running && JSON.stringify(state.draft || null) === JSON.stringify(serverAutomation?.definition || null)) return;
            e.preventDefault();
            // Modern browsers ignore the custom string but require setting returnValue.
            e.returnValue = '';
            return '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [state.running, state.draft, serverAutomation]);

    const onSaveStep = async (nextDef) => {
        const aid = state.automationId || serverAutomation?.id;
        if (!aid) throw new Error('No automation id — save once via the chat first.');
        const r = await api.updateAutomation(aid, { definition: nextDef });
        setServerAutomation(r.automation || r);
    };

    const isActive = !!serverAutomation?.isActive;
    const isDraft = !!serverAutomation?.isDraft;
    const title = serverAutomation?.title || 'New automation';
    const statusLabel = isDraft ? 'Draft' : (isActive ? 'Live' : 'Paused');
    const statusBadgeClass = isDraft
        ? 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
        : isActive
            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400';

    return (
        <div className="flex flex-col h-full min-h-0 bg-[var(--bg-primary)]">
            {/* Top header — matches the agent editor's chrome. */}
            <div className="flex items-center gap-3 px-6 py-3 border-b border-[var(--border-default)]">
                <button
                    onClick={onBack}
                    className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition"
                    title="Back"
                >
                    <ArrowLeft size={18} />
                </button>
                <div className="w-9 h-9 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center text-lg flex-shrink-0">
                    <Sparkles size={16} className="text-[var(--accent)]" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-base font-semibold text-[var(--text-primary)] truncate">{title}</div>
                    {serverAutomation?.needsFirstRunConfirm && !isDraft && (
                        <div className="text-xs text-amber-600 dark:text-amber-400">Awaiting first-run confirmation</div>
                    )}
                </div>
                <span className={`text-[11px] uppercase tracking-wide font-medium px-2 py-1 rounded-full ${statusBadgeClass}`}>
                    {statusLabel}
                </span>
                <button
                    onClick={onDryRun}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition disabled:opacity-50"
                >
                    <Eye size={14} /> Dry-run
                </button>
                {isActive ? (
                    <button
                        onClick={onDeactivate}
                        disabled={busy}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium bg-[var(--accent)]/15 text-[var(--accent)] ring-1 ring-[var(--accent)]/40 hover:bg-[var(--accent)]/25 transition disabled:opacity-50"
                    >
                        <Power size={14} /> Pause
                        <ChevronDown size={12} className="opacity-60" />
                    </button>
                ) : (
                    <button
                        onClick={onActivate}
                        disabled={busy}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium bg-[var(--accent)] text-white hover:opacity-90 ring-1 ring-[var(--accent)] transition disabled:opacity-50 shadow-sm"
                    >
                        <Power size={14} /> Activate
                    </button>
                )}
            </div>

            <BuilderErrorBanner
                fatalError={error || state.error}
                validation={state.validation}
                aborted={state.aborted}
                onDismiss={() => setError(null)}
            />


            <div className="flex-1 flex min-h-0 relative">
                {/* Chat side — same composer as direct chat, custom message timeline */}
                <div className="flex-1 min-w-0 border-r border-[var(--border-default)] flex flex-col">
                    <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        {state.messages.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-center px-4">
                                <div className="w-12 h-12 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center mb-3">
                                    <Sparkles size={20} className="text-[var(--accent)]" />
                                </div>
                                <div className="text-sm font-medium text-[var(--text-primary)] mb-1">Build an automation with AI</div>
                                <div className="text-xs text-[var(--text-tertiary)] mb-5 max-w-xs">
                                    Describe the trigger and what should happen. I'll wire the steps for you.
                                </div>
                                <div className="flex flex-col gap-2 w-full max-w-sm">
                                    {[
                                        'Every Monday at 9am, summarise unread Gmail labelled "invoices" to #finance',
                                        'When a new GitHub issue is created with label "bug", send a Slack DM',
                                        'Every weekday at 18:00, email me a digest of today\'s calendar events',
                                    ].map((p) => (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => setChatInput(p)}
                                            className="text-left text-xs px-3 py-2 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="flex flex-col gap-3">
                            {state.messages.map((m, i) => <MessageBubble key={i} msg={m} />)}
                            {state.running && <div className="text-xs italic text-[var(--text-tertiary)]">Thinking…</div>}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>
                    <div className="w-full flex flex-col flex-shrink-0">
                        <InputArea
                            onSendMessage={onSend}
                            onStopGenerating={() => { /* SSE abort happens automatically when send is re-issued */ }}
                            isLoading={state.running}
                            directMode={true}
                            modelTiers={modelTiers}
                            selectedTier={selectedTier}
                            onTierChange={setSelectedTier}
                            input={chatInput}
                            setInput={setChatInput}
                            user={user}
                            messages={state.messages}
                        />
                    </div>
                </div>
                {/* Diagram + summary + dry-run + run history */}
                <div className="flex-1 min-w-0 overflow-y-auto">
                    {state.summary && (
                        <div className="p-4 border-b border-[var(--border-default)]">
                            <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] mb-2">What this automation does</div>
                            <div className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{state.summary}</div>
                        </div>
                    )}
                    <DryRunPanel run={state.dryRun} steps={state.steps} />
                    <div className="border-t border-[var(--border-default)] min-h-[420px]">
                        <DiagramPane
                            definition={effectiveDef}
                            runSteps={state.steps}
                            onNodeClick={setSelectedStepId}
                            validation={state.validation}
                        />
                    </div>
                    {(state.automationId || automationId) && (
                        <div className="border-t border-[var(--border-default)]">
                            <div className="px-4 py-2 text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Run history</div>
                            <RunHistory automationId={state.automationId || automationId} />
                        </div>
                    )}
                </div>
                {selectedStep && (
                    <StepInspector
                        step={selectedStep}
                        runStep={selectedRunStep}
                        onClose={() => setSelectedStepId(null)}
                        definition={effectiveDef}
                        onSaveStep={onSaveStep}
                        validation={state.validation}
                    />
                )}
            </div>
        </div>
    );
}

function MessageBubble({ msg }) {
    const isUser = msg.role === 'user';
    return (
        <div className={`max-w-[85%] ${isUser ? 'self-end' : 'self-start'}`}>
            <div
                className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${isUser
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'}`}
            >
                {isUser ? msg.content : <MarkdownRenderer content={msg.content || ''} />}
            </div>
            {/* Auto-tier badge — same shape as direct chat's MessageItem.
                Shown only when the server resolved 'auto' to a real tier
                so the user knows which model produced this turn. */}
            {!isUser && msg.autoSelectedTier && (
                <div className="mt-1 text-[11px] text-[var(--text-tertiary)] px-1">
                    Auto → {tierLabel(msg.autoSelectedTier)}
                </div>
            )}
            {!isUser && Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0 && (
                <div className="mt-1.5 flex flex-col gap-1">
                    {msg.toolCalls.map((tc, i) => <ToolCallChip key={i} tc={tc} />)}
                </div>
            )}
        </div>
    );
}

/**
 * Consolidated error banner. Replaces the two independent banners that
 * used to render `error` and `state.error` separately so users couldn't
 * tell which failed. Renders, in priority order:
 *
 *   1. fatalError       — a network / API failure (red)
 *   2. aborted          — builder ran out of iterations (amber)
 *   3. validation.errors — structured records, only shown when present
 *
 * Each structured record renders {code, message, hint} so the user (and,
 * via the LLM feedback loop, the model) gets actionable text instead of
 * a wall of free-form prose.
 */
function BuilderErrorBanner({ fatalError, validation, aborted, onDismiss }) {
    const errors = (validation?.errors || []);
    const warnings = (validation?.warnings || []);
    if (!fatalError && !aborted && errors.length === 0 && warnings.length === 0) return null;

    return (
        <div className="border-b border-[var(--border-default)]">
            {fatalError && (
                <div className="bg-red-500/10 text-red-600 dark:text-red-400 px-4 py-2 text-sm flex items-start gap-2">
                    <span className="flex-1">{fatalError}</span>
                    {onDismiss && (
                        <button onClick={onDismiss} className="text-xs underline hover:no-underline opacity-80">dismiss</button>
                    )}
                </div>
            )}
            {aborted && (
                <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-4 py-2 text-sm">
                    Builder stopped after {aborted.iterations} iterations without finalizing — review the validation issues below and ask the builder to fix them.
                </div>
            )}
            {(errors.length > 0 || warnings.length > 0) && (
                <div className="px-4 py-2 text-xs bg-[var(--bg-secondary)] max-h-40 overflow-y-auto">
                    {errors.map((e, i) => <BannerRecord key={`e-${i}`} record={e} />)}
                    {warnings.map((w, i) => <BannerRecord key={`w-${i}`} record={w} />)}
                </div>
            )}
        </div>
    );
}

function BannerRecord({ record }) {
    const isErr = record.severity === 'error';
    return (
        <div className={`mb-1 ${isErr ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
            <span className="font-mono text-[10px] mr-1.5 opacity-70">{record.code}</span>
            <span className="text-[var(--text-tertiary)] mr-1">{record.path}</span>
            {record.message}
            {record.hint && <span className="text-[var(--text-tertiary)]"> — {record.hint}</span>}
        </div>
    );
}

function ToolCallChip({ tc }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="bg-[var(--bg-secondary)]/60 border border-[var(--border-default)] rounded-lg p-2 text-xs">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
            >
                <Wrench size={12} /> <code className="font-mono">{tc.name}</code>
            </button>
            {open && (
                <pre className="mt-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-md p-2 max-h-60 overflow-auto whitespace-pre-wrap text-[var(--text-primary)]">
                    {JSON.stringify({ args: tc.arguments, result: tc.result }, null, 2)}
                </pre>
            )}
        </div>
    );
}

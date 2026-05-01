import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Power, Eye, Sparkles, Wrench } from 'lucide-react';
import { API_BASE, authFetch } from '../../../../utils/helpers';
import scopedStorage from '../../../../utils/scopedStorage';
import InputArea from '../../../InputArea';
import MarkdownRenderer from '../../../MarkdownRenderer';
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
    const { state, send } = useAutomationBuilderStream({ automationId });
    const [serverAutomation, setServerAutomation] = useState(null);
    const [selectedStepId, setSelectedStepId] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

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

    const isActive = !!serverAutomation?.isActive;
    const title = serverAutomation?.title || 'New automation';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            <div style={{ borderBottom: '1px solid #e5e7eb', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><ArrowLeft size={18} /></button>
                <Sparkles size={16} color="#7c3aed" />
                <div style={{ fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
                <span style={{ fontSize: 12, color: '#6b7280' }}>
                    {serverAutomation?.isDraft ? 'Draft' : (isActive ? 'Active' : 'Inactive')}
                    {serverAutomation?.needsFirstRunConfirm && !serverAutomation.isDraft && ' · awaiting first-run confirm'}
                </span>
                <button onClick={onDryRun} disabled={busy} style={btnSecondary}><Eye size={14}/> Dry-run</button>
                {isActive
                    ? <button onClick={onDeactivate} disabled={busy} style={btnSecondary}><Power size={14}/> Deactivate</button>
                    : <button onClick={onActivate} disabled={busy} style={btnPrimary}><Power size={14}/> Activate</button>}
            </div>

            {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 8, fontSize: 13 }}>{error}</div>}
            {state.error && <div style={{ background: '#fef3c7', color: '#92400e', padding: 8, fontSize: 13 }}>{state.error}</div>}

            <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
                {/* Chat side ─ same composer as direct chat, custom message timeline */}
                <div style={{ flex: 1, minWidth: 0, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
                    <div ref={messagesContainerRef} style={{ flex: 1, overflowY: 'auto', padding: 16 }} className="custom-scrollbar">
                        {state.messages.length === 0 && (
                            <div style={{ color: '#6b7280', textAlign: 'center', padding: '40px 16px', fontSize: 14 }}>
                                Tell the builder what automation you want.<br/>
                                <em>Example: "Every Monday at 9am, get my unread Gmail labelled invoices, summarise each, post to #finance."</em>
                            </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {state.messages.map((m, i) => <MessageBubble key={i} msg={m} />)}
                            {state.running && <div style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: 13 }}>Thinking…</div>}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
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
                <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
                    {state.summary && (
                        <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb', fontSize: 13 }}>
                            <div style={{ fontWeight: 600, marginBottom: 6 }}>What this automation does</div>
                            <div style={{ whiteSpace: 'pre-wrap' }}>{state.summary}</div>
                        </div>
                    )}
                    <DryRunPanel run={state.dryRun} steps={state.steps} />
                    <div style={{ borderTop: '1px solid #f3f4f6' }}>
                        <DiagramPane definition={effectiveDef} runSteps={state.steps} onNodeClick={setSelectedStepId} />
                    </div>
                    {(state.automationId || automationId) && (
                        <div style={{ borderTop: '1px solid #e5e7eb' }}>
                            <div style={{ padding: '8px 12px', fontWeight: 600, fontSize: 13 }}>Run history</div>
                            <RunHistory automationId={state.automationId || automationId} />
                        </div>
                    )}
                </div>
                {selectedStep && <StepInspector step={selectedStep} runStep={selectedRunStep} onClose={() => setSelectedStepId(null)} />}
            </div>
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

const btnPrimary = {
    background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px',
    display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer',
};
const btnSecondary = {
    background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px',
    display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer',
};

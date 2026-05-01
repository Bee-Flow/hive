import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Power, Eye, Sparkles } from 'lucide-react';
import ChatPane from './ChatPane';
import DiagramPane from './DiagramPane';
import StepInspector from './StepInspector';
import RunHistory from './RunHistory';
import DryRunPanel from './DryRunPanel';
import useAutomationApi from '../../../../hooks/useAutomationApi';
import useAutomationBuilderStream from '../../../../hooks/useAutomationBuilderStream';

/**
 * Split-view conversational builder.
 *
 *   ┌── header (back, title, status) ─────────────────────────────┐
 *   │ ┌─────── chat (50%) ──────┬──── diagram (50%) ────────────┐ │
 *   │ │                         │                                │ │
 *   │ │                         │   summary                      │ │
 *   │ │                         │   dry-run preview              │ │
 *   │ │                         │   diagram (mermaid)            │ │
 *   │ │                         │   run history                  │ │
 *   │ └─────────────────────────┴────────────────────────────────┘ │
 *   │ footer: Activate / Dry-run                                   │
 *   └──────────────────────────────────────────────────────────────┘
 */
export default function BuilderShell({ automationId, onBack }) {
    const api = useAutomationApi();
    const { state, send } = useAutomationBuilderStream({ automationId });
    const [serverAutomation, setServerAutomation] = useState(null);
    const [selectedStepId, setSelectedStepId] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

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

    const onSend = async (text) => {
        setError(null);
        await send({ message: text, modelTier: 'fast' });
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
                <div style={{ flex: 1, minWidth: 0, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
                    <ChatPane messages={state.messages} running={state.running} onSend={onSend} />
                </div>
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

const btnPrimary = {
    background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px',
    display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer',
};
const btnSecondary = {
    background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px',
    display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer',
};

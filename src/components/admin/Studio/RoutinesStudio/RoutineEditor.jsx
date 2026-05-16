import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ListChecks, Code2, Play, Save, Power, PowerOff, Settings2 } from 'lucide-react';
import scopedStorage from '../../../../utils/scopedStorage';
import useAutomationApi from '../../../../hooks/useAutomationApi';
import BuilderShell from '../../AITasksDesigner/Builder/BuilderShell';
import DiagramPane from '../../AITasksDesigner/Builder/DiagramPane';
import JsonTab from '../../AITasksDesigner/Builder/JsonTab';
import RunHistory from '../../AITasksDesigner/Builder/RunHistory';
import QuickEditForm from './QuickEditForm';
import VersionHistoryPanel from './VersionHistoryPanel';
import WebhookPanel from './WebhookPanel';

/**
 * Wrapper around BuilderShell that introduces three view modes:
 *
 *   • Quick — structured form for trigger + one action. The 80%-case.
 *   • Build with AI — the existing conversational builder, unchanged.
 *   • Expert — raw JSON editor + version history + webhook management.
 *
 * The diagram pane is always visible (read-only in Quick / Expert) so the
 * user can see what they're about to save before they hit Activate.
 *
 * Save / Dry-run / Activate live in a sticky footer that mirrors the
 * publish bar on the Agents tab. Quick mode debounces saves on every
 * change; AI mode delegates entirely to BuilderShell (which manages its
 * own save semantics through the SSE stream).
 */
export default function RoutineEditor({
    automationId,
    user,
    agents = [],
    onBack,
    initialChatInput = '',
}) {
    const api = useAutomationApi();
    const isNew = !automationId;

    const [automation, setAutomation] = useState(null);
    const [loading, setLoading] = useState(!isNew);
    const [savingState, setSavingState] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
    const [saveError, setSaveError] = useState(null);
    const [activateError, setActivateError] = useState(null);
    const [dryRunError, setDryRunError] = useState(null);
    const [tab, setTab] = useState('build'); // 'build' | 'history'

    const [mode, setMode] = useState(() => {
        const saved = scopedStorage.getItem('routinesEditorMode');
        return saved === 'ai' || saved === 'quick' || saved === 'expert' ? saved : 'quick';
    });
    const [expertMode, setExpertMode] = useState(() => scopedStorage.getItem('routineExpertMode') === '1');

    useEffect(() => { scopedStorage.setItem('routinesEditorMode', mode); }, [mode]);
    useEffect(() => { scopedStorage.setItem('routineExpertMode', expertMode ? '1' : '0'); }, [expertMode]);

    // Local definition mirror for Quick / Expert mode. AI mode owns its own
    // draft state through BuilderShell (we don't fight it).
    const [localDef, setLocalDef] = useState(null);
    const dirtyRef = useRef(false);
    const debounceRef = useRef(null);
    const savedFlashRef = useRef(null);

    // Clear pending timers on unmount or when switching to a different
    // automation — otherwise a debounced save fires against a row that is
    // no longer mounted, and the "saved → idle" flash flips state after
    // the component is gone.
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            if (savedFlashRef.current) clearTimeout(savedFlashRef.current);
        };
    }, [automationId]);

    // Load automation row.
    useEffect(() => {
        if (isNew) {
            setLoading(false);
            // Seed an empty draft so the diagram doesn't show "(empty draft)".
            const draft = { trigger: { id: 'trg', type: 'trigger', kind: 'manual' }, steps: [], edges: [] };
            setLocalDef(draft);
            return;
        }
        let alive = true;
        setLoading(true);
        api.getAutomation(automationId)
            .then(d => {
                if (!alive) return;
                const a = d?.automation || null;
                setAutomation(a);
                setLocalDef(a?.definition || { trigger: { id: 'trg', type: 'trigger', kind: 'manual' }, steps: [], edges: [] });
            })
            .catch(() => {})
            .finally(() => alive && setLoading(false));
        return () => { alive = false; };
    }, [automationId]); // eslint-disable-line react-hooks/exhaustive-deps

    const flashSaved = () => {
        if (savedFlashRef.current) clearTimeout(savedFlashRef.current);
        setSavingState('saved');
        savedFlashRef.current = setTimeout(() => {
            setSavingState((s) => (s === 'saved' ? 'idle' : s));
            savedFlashRef.current = null;
        }, 1200);
    };

    // Debounced PUT when the user mutates the draft in Quick mode.
    const onDraftChange = (next) => {
        setLocalDef(next);
        dirtyRef.current = true;
        if (isNew) return; // can't PUT against a non-existent row; AI mode handles new-from-scratch
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setSavingState('saving');
        debounceRef.current = setTimeout(async () => {
            try {
                const r = await api.updateAutomation(automationId, { definition: next });
                if (r?.automation) setAutomation(r.automation);
                dirtyRef.current = false;
                flashSaved();
            } catch (e) {
                setSavingState('error');
                setSaveError(e.message || 'Save failed');
            }
        }, 600);
    };

    const onTitleChange = async (next) => {
        if (!automation) return;
        const prevTitle = automation.title;
        setAutomation({ ...automation, title: next });
        if (isNew) return;
        try {
            await api.updateAutomation(automationId, { title: next });
        } catch (e) {
            // Revert local state so what the user sees matches what's on the
            // server, and surface the error in the same place save failures show up.
            setAutomation((a) => (a ? { ...a, title: prevTitle } : a));
            setSavingState('error');
            setSaveError(`Title save failed: ${e.message || 'unknown error'}`);
        }
    };

    // Per-row in-flight guard for the activate/deactivate toggle. The
    // ref-backed check survives the brief window between click and
    // useState flushing so a double-click can't fire two PATCHes.
    const activateInflightRef = useRef(false);
    const [activating, setActivating] = useState(false);
    const onActivate = async () => {
        if (!automation) return;
        if (activateInflightRef.current) return;
        if (savingState === 'saving') return;
        activateInflightRef.current = true;
        setActivating(true);
        setActivateError(null);
        try {
            const r = automation.isActive
                ? await api.deactivate(automation.id)
                : await api.activate(automation.id);
            if (r?.automation) setAutomation(r.automation);
        } catch (e) {
            setActivateError(e.message || 'Toggle failed');
        } finally {
            activateInflightRef.current = false;
            setActivating(false);
        }
    };

    const onDryRun = async () => {
        if (!automation) return;
        setDryRunError(null);
        try {
            await api.dryRun(automation.id, {});
            // Result lives in run history; flick to the History tab to surface it.
            setTab('history');
        } catch (e) {
            setDryRunError(`Dry run failed: ${e.message || 'unknown error'}`);
        }
    };

    const onSaveNow = async () => {
        if (!automation || !localDef) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setSavingState('saving');
        try {
            const r = await api.updateAutomation(automation.id, { definition: localDef });
            if (r?.automation) setAutomation(r.automation);
            dirtyRef.current = false;
            flashSaved();
        } catch (e) {
            setSavingState('error');
            setSaveError(e.message || 'Save failed');
        }
    };

    // Stable reference for the diagram preview. Without useMemo, every
    // unrelated re-render (e.g. savingState transitions, title typing, the
    // `setAutomation(r.automation)` after a debounced save) produces a new
    // expression result, even though the underlying object is unchanged.
    // ReactFlow's `fitView` then re-runs its animation, producing a
    // visible flicker in the Preview pane. Memoising on the actual sources
    // keeps the prop reference stable across cosmetic re-renders.
    const effectiveDef = useMemo(
        () => localDef || automation?.definition || null,
        [localDef, automation?.definition],
    );

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center text-[var(--text-tertiary)] text-sm">
                Loading…
            </div>
        );
    }

    // For brand-new automations there's nothing to PUT against yet — fall
    // straight into AI mode so BuilderShell can create + finalise the row
    // through its existing flow.
    if (isNew) {
        return (
            <BuilderShell
                automationId={null}
                onBack={onBack}
                user={user}
                initialChatInput={initialChatInput}
            />
        );
    }

    const ModeButton = ({ value, label, icon }) => (
        <button
            onClick={() => setMode(value)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition ${
                mode === value
                    ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
        >
            {icon}
            {label}
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)]">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--border-default)] bg-[var(--bg-card)] flex-shrink-0">
                <button
                    onClick={onBack}
                    className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
                    title="Back to list"
                >
                    <ArrowLeft size={16} />
                </button>
                <input
                    type="text"
                    value={automation?.title || ''}
                    onChange={(e) => onTitleChange(e.target.value)}
                    placeholder="Untitled automation"
                    className="flex-1 min-w-0 bg-transparent text-[15px] font-semibold text-[var(--text-primary)] outline-none"
                />
                <div className="text-[11px] text-[var(--text-tertiary)] mr-2">
                    {savingState === 'saving' && 'Saving…'}
                    {savingState === 'saved' && 'Saved'}
                    {savingState === 'error' && <span className="text-red-500">Save failed</span>}
                </div>
                {/* Mode pills */}
                <div className="flex items-center bg-[var(--bg-secondary)] rounded-lg p-0.5">
                    <ModeButton value="quick" label="Quick" icon={<ListChecks size={12} />} />
                    <ModeButton value="ai" label="Build with AI" />
                    {expertMode && <ModeButton value="expert" label="Expert" icon={<Code2 size={12} />} />}
                </div>
                <button
                    onClick={() => setExpertMode(v => !v)}
                    title={expertMode ? 'Hide expert tools' : 'Show expert tools'}
                    className={`p-1.5 rounded-lg transition ${
                        expertMode
                            ? 'text-[var(--accent-primary)] bg-[var(--bg-secondary)]'
                            : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)]'
                    }`}
                >
                    <Settings2 size={14} />
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 flex">
                {mode === 'ai' ? (
                    /* AI mode — BuilderShell renders its own diagram + chat,
                       so we don't double-render the diagram pane. */
                    <div className="flex-1 min-w-0">
                        <BuilderShell
                            key={automation?.id || 'new'}
                            automationId={automation?.id || null}
                            onBack={onBack}
                            user={user}
                            initialChatInput={initialChatInput}
                        />
                    </div>
                ) : mode === 'expert' ? (
                    /* Expert mode — JSON editor + side panels */
                    <div className="flex-1 min-w-0 grid grid-cols-3 gap-px bg-[var(--border-default)] overflow-hidden">
                        <div className="col-span-2 bg-[var(--bg-primary)] flex flex-col">
                            <JsonTab
                                automation={automation}
                                editable
                                onSaved={(a) => { if (a) setAutomation(a); setLocalDef(a?.definition || null); }}
                            />
                        </div>
                        <div className="col-span-1 bg-[var(--bg-primary)] overflow-y-auto p-4 space-y-6">
                            <VersionHistoryPanel
                                automation={automation}
                                onRestored={(a) => { if (a) { setAutomation(a); setLocalDef(a.definition || null); } }}
                            />
                            <WebhookPanel automation={automation} />
                        </div>
                    </div>
                ) : (
                    /* Quick mode — structured form on the left, read-only
                       diagram on the right so the user sees what'll save. */
                    <div className="flex-1 min-w-0 grid grid-cols-2 gap-px bg-[var(--border-default)] overflow-hidden">
                        <div className="bg-[var(--bg-primary)] overflow-y-auto">
                            <QuickEditForm
                                definition={effectiveDef}
                                onChange={onDraftChange}
                                expert={expertMode}
                                agents={agents}
                                modelTiers={{}}
                            />
                            {expertMode && (
                                <div className="px-4 pb-6 space-y-6">
                                    <VersionHistoryPanel
                                        automation={automation}
                                        onRestored={(a) => { if (a) { setAutomation(a); setLocalDef(a.definition || null); } }}
                                    />
                                    <WebhookPanel automation={automation} />
                                </div>
                            )}
                        </div>
                        <div className="bg-[var(--bg-primary)] flex flex-col">
                            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
                                <div className="text-xs text-[var(--text-tertiary)]">Preview</div>
                                <button
                                    onClick={() => setTab('history')}
                                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                >
                                    Run history →
                                </button>
                            </div>
                            <div className="flex-1 min-h-0">
                                {tab === 'history' && automation?.id ? (
                                    <div className="h-full overflow-y-auto">
                                        <div className="p-2 flex items-center justify-between border-b border-[var(--border-default)]">
                                            <div className="text-[12px] font-medium text-[var(--text-primary)]">Recent runs</div>
                                            <button
                                                onClick={() => setTab('build')}
                                                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                            >
                                                ← Back to diagram
                                            </button>
                                        </div>
                                        <RunHistory automationId={automation.id} />
                                    </div>
                                ) : (
                                    <DiagramPane definition={effectiveDef} readOnly />
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Sticky footer (hidden in AI mode — BuilderShell has its own controls) */}
            {mode !== 'ai' && (
                <div className="border-t border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-2.5 flex items-center gap-2 flex-shrink-0">
                    {(saveError || activateError || dryRunError) && (
                        <div className="text-[12px] text-red-600 mr-auto truncate">
                            {saveError || activateError || dryRunError}
                        </div>
                    )}
                    {!saveError && !activateError && !dryRunError && <div className="flex-1" />}
                    <button
                        onClick={onDryRun}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
                    >
                        <Play size={14} /> Dry run
                    </button>
                    <button
                        onClick={onSaveNow}
                        disabled={savingState === 'saving'}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] text-[var(--text-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-60"
                    >
                        <Save size={14} /> Save
                    </button>
                    <button
                        onClick={onActivate}
                        disabled={activating || savingState === 'saving'}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                        style={{ background: automation?.isActive ? '#f59e0b' : 'var(--accent-primary)' }}
                    >
                        {automation?.isActive ? <PowerOff size={14} /> : <Power size={14} />}
                        {automation?.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                </div>
            )}
        </div>
    );
}

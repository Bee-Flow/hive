import { Wrench, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BuilderHeader from './BuilderHeader';
import DiagramPane, { applyAddNode } from './DiagramPane';
import DryRunPanel from './DryRunPanel';
import FloatingValidationPill from './FloatingValidationPill';
import AddNodeFab from './flow/AddNodeFab';
import NodePalette from './flow/NodePalette';
import useRoutineDraftHistory from './flow/useRoutineDraftHistory';
import JsonTab from './JsonTab';
import RunHistoryTab from './RunHistoryTab';
import SettingsTab from './SettingsTab';
import StepInspector from './StepInspector';
import TriggerDiagnosePanel from './TriggerDiagnosePanel';
import useBuilderHotkeys from './useBuilderHotkeys';
import useAutomationApi from '../../../../hooks/useAutomationApi';
import useAutomationBuilderStream from '../../../../hooks/useAutomationBuilderStream';
import { API_BASE, authFetch } from '../../../../utils/helpers';
import scopedStorage from '../../../../utils/scopedStorage';
import InputArea from '../../../InputArea';
import MarkdownRenderer from '../../../MarkdownRenderer';
import { toast } from '../../../shared/Toast';
import { tierLabel } from '../../../tierMeta';

/**
 * Split-view conversational builder.
 *
 * Reuses the EXACT same <InputArea> as direct chat (directMode=true) so
 * users get apps menu, model-tier selector, web search toggle, and file
 * attachments. State (tier, web-search, disabled media) lives in
 * scopedStorage so it persists across sessions just like direct chat.
 */
export default function BuilderShell({ automationId, onBack, user, initialChatInput = '' }) {
    const api = useAutomationApi();
    const { state, send, hydrate, setDraft, markServerConfirmed, acceptExternalDraft, dismissExternalDraft, executeStep, retryFromStep, stopRun, pollRunProgress } = useAutomationBuilderStream({ automationId });
    const [serverAutomation, setServerAutomation] = useState(null);
    const [selectedStepId, setSelectedStepId] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [hasHydrated, setHasHydrated] = useState(false);

    // Tab navigation. Default to Build — the chat + diagram is what users
    // open the builder to do; the other tabs are jump-points for specific
    // tasks (settings, history, raw JSON).
    const [tab, setTab] = useState('build');

    // Focus mode collapses the chat column for max diagram real estate.
    // Persisted in scopedStorage so it survives reload — power users who
    // turn it on tend to leave it on for many sessions.
    const [focusMode, setFocusMode] = useState(() => scopedStorage.getItem('routinesFocusMode') === '1');
    useEffect(() => {
        scopedStorage.setItem('routinesFocusMode', focusMode ? '1' : '0');
    }, [focusMode]);

    // Resizable chat column — drag the gutter between chat and diagram.
    // Persisted so the user's chosen width survives reloads. Bounds match
    // AgentWizard/BuilderSplit's resize handle (240–600px).
    const [chatWidth, setChatWidth] = useState(() => {
        const raw = parseInt(scopedStorage.getItem('routinesChatWidth') || '', 10);
        return Number.isFinite(raw) && raw >= 240 && raw <= 600 ? raw : 460;
    });
    useEffect(() => {
        scopedStorage.setItem('routinesChatWidth', String(chatWidth));
    }, [chatWidth]);
    const dragStartX = useRef(0);
    const dragStartW = useRef(0);
    const onChatResizeStart = useCallback((e) => {
        dragStartX.current = e.clientX;
        dragStartW.current = chatWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        const onMove = (ev) => {
            const delta = ev.clientX - dragStartX.current;
            setChatWidth(Math.min(600, Math.max(240, dragStartW.current + delta)));
        };
        const onUp = () => {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, [chatWidth]);

    // Inline-rename saving state. Three transitions:
    //   idle → saving → saved → idle (after 1.5s)
    //   idle → saving → error
    const [savingState, setSavingState] = useState('idle');
    const savedTimer = useRef(null);

    // Diagnose button anchor — the popover positions itself just below
    // this element instead of floating in a fixed top-right corner.
    const diagnoseAnchorRef = useRef(null);

    // ── InputArea state (mirrors direct chat) ────────────────────────────
    const [chatInput, setChatInput] = useState(initialChatInput || '');
    const [modelTiers, setModelTiers] = useState({});
    const [selectedTier, setSelectedTier] = useState(() => scopedStorage.getItem('automationBuilderTier') || 'auto');

    // Re-seed when the parent passes a new example prompt — only when the
    // input is currently empty so we don't clobber what the user is typing.
    useEffect(() => {
        if (initialChatInput && !chatInput) setChatInput(initialChatInput);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialChatInput]);

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
        setBusy(true);
        try {
            const aid = await ensureAutomationCreated();
            if (!aid) { setError('Add a trigger and at least one step before activating.'); return; }
            const r = await api.activate(aid);
            setServerAutomation(r.automation);
        }
        catch (e) { setError(e.message); }
        setBusy(false);
    };
    const onDeactivate = async () => {
        setBusy(true);
        try {
            const aid = state.automationId || serverAutomation?.id;
            if (!aid) return;
            const r = await api.deactivate(aid);
            setServerAutomation(r.automation);
        }
        catch (e) { setError(e.message); }
        setBusy(false);
    };
    const onDryRun = async () => {
        setBusy(true); setError(null);
        try {
            const aid = await ensureAutomationCreated();
            if (!aid) { setError('Add a trigger and at least one step before running.'); return; }
            await api.dryRun(aid);
        }
        catch (e) { setError(e.message); }
        setBusy(false);
    };

    // Trigger health-check panel state. Only shown when the user opens it,
    // so a healthy automation never has visual noise.
    const [diagnoseOpen, setDiagnoseOpen] = useState(false);
    const [diagnoseLoading, setDiagnoseLoading] = useState(false);
    const [diagnoseError, setDiagnoseError] = useState(null);
    const [diagnoseResult, setDiagnoseResult] = useState(null);
    const onDiagnose = async () => {
        const aid = state.automationId || serverAutomation?.id;
        if (!aid) return;
        setDiagnoseOpen(true);
        setDiagnoseLoading(true);
        setDiagnoseError(null);
        setDiagnoseResult(null);
        try {
            const r = await api.diagnoseTrigger(aid);
            setDiagnoseResult(r);
        } catch (e) {
            setDiagnoseError(e.message);
        }
        setDiagnoseLoading(false);
    };

    // Unsaved-changes guard. The builder persists every mutation to the
    // server so the only "unsaved" window is between the local SSE-driven
    // draft update and the server's snapshot persistence at end-of-turn.
    // We block accidental tab-close while the SSE turn is mid-flight or
    // the local draft diverges from the last server snapshot.
    useEffect(() => {
        const handler = (e) => {
            // Block if a chat turn is mid-flight or the local draft hasn't
            // been confirmed by the server yet. We prefer `state.lastServerDraft`
            // (set by markServerConfirmed after each PUT) over the HTTP-side
            // serverAutomation.definition because the HTTP path can lag the
            // SSE path during a save round-trip.
            const baseline = state.lastServerDraft || serverAutomation?.definition || null;
            if (!state.running && deepEqualDef(state.draft || null, baseline)) return;
            e.preventDefault();
            // Modern browsers ignore the custom string but require setting returnValue.
            e.returnValue = '';
            return '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [state.running, state.draft, state.lastServerDraft, serverAutomation]);

    const onSaveStep = async (nextDef) => {
        // Lazy-create when the user clicked Save in the inspector before
        // any other persist round-trip happened (e.g. they only added
        // nodes via the palette, then opened the inspector to set inputs
        // / mappings, then hit Save). The visual-edit debounce may not
        // have fired yet, so we must create here too.
        const aid = await ensureAutomationCreated(nextDef);
        if (!aid) throw new Error('Could not create automation. Refresh and try again.');
        const r = await api.updateAutomation(aid, { definition: nextDef });
        const persisted = r.automation || r;
        setServerAutomation(persisted);
        // Sync the SSE-hook's draft + baseline with what the server now
        // holds. Without this, a later SSE `draft` event would see a
        // local/baseline mismatch and surface a phantom conflict.
        const persistedDef = persisted?.definition || nextDef;
        setDraft(persistedDef);
        markServerConfirmed(persistedDef);
    };

    /**
     * Lazy-create the automation when the user starts building via the
     * visual editor (palette / drag) before sending a chat message.
     * Returns the resolved aid. Re-entrant safe: concurrent callers
     * share the same in-flight create promise so the user can't end up
     * with two stub automations from a flurry of clicks.
     */
    const createInflightRef = useRef(null);
    const ensureAutomationCreated = useCallback(async (defForCreate) => {
        const existing = state.automationId || serverAutomation?.id;
        if (existing) return existing;
        if (createInflightRef.current) return createInflightRef.current;
        const body = {
            title: serverAutomation?.title || 'Untitled automation',
            definition: defForCreate || state.draft || serverAutomation?.definition || null,
        };
        createInflightRef.current = (async () => {
            try {
                const r = await api.createAutomation(body);
                const created = r.automation || r;
                setServerAutomation(created);
                hydrate({ automationId: created.id });
                return created.id;
            } finally {
                createInflightRef.current = null;
            }
        })();
        return createInflightRef.current;
    }, [api, state.automationId, state.draft, serverAutomation, hydrate]);

    /**
     * Visual-editor write path. Updates the local draft immediately so the
     * canvas stays responsive, then debounces the actual PUT so a 5-pixel
     * drag doesn't fire five round-trips. Mirrors the saving pill states
     * used by onSaveAutomation so the user sees the same feedback.
     *
     * When no automation exists yet we lazy-create one (the user clicked
     * a node in the palette but never sent a chat message). After creation
     * subsequent edits flow through the normal PUT round-trip.
     *
     * `applyVisualDraft` is the shared apply path used by both onVisualEdit
     * and the undo/redo history hook — every local-edit path goes through
     * here so undos auto-persist to the server too. A save failure surfaces
     * as a toast; the local draft stays so the user doesn't lose work.
     */
    const visualSaveTimer = useRef(null);
    const performVisualSave = useCallback(async (nextDef) => {
        try {
            const aid = await ensureAutomationCreated(nextDef);
            if (!aid) { setSavingState('error'); return; }
            const r = await api.updateAutomation(aid, { definition: nextDef });
            const persisted = r.automation || r;
            setServerAutomation(persisted);
            markServerConfirmed(persisted?.definition || nextDef);
            setSavingState('saved');
            if (savedTimer.current) clearTimeout(savedTimer.current);
            savedTimer.current = setTimeout(() => setSavingState('idle'), 1500);
        } catch (e) {
            console.warn('[BuilderShell] visual save failed:', e.message);
            setSavingState('error');
            toast.error(`Save failed — your edits are still on the canvas. ${e.message || ''}`.trim());
        }
    }, [api, ensureAutomationCreated, markServerConfirmed]);

    const applyVisualDraft = useCallback((nextDef) => {
        setDraft(nextDef);
        if (visualSaveTimer.current) clearTimeout(visualSaveTimer.current);
        setSavingState('saving');
        visualSaveTimer.current = setTimeout(() => performVisualSave(nextDef), 500);
    }, [setDraft, performVisualSave]);

    const draftHistory = useRoutineDraftHistory({
        currentDraft: effectiveDef,
        apply: applyVisualDraft,
    });

    const onVisualEdit = useCallback((nextDef) => {
        draftHistory.commit(nextDef);
    }, [draftHistory]);

    /**
     * Force-flush any pending debounced save. Lets Cmd+S behave the way
     * users expect ("save it now") without waiting for the 500ms timer
     * to elapse. No-op when nothing is dirty.
     */
    const forceSaveNow = useCallback(() => {
        if (!visualSaveTimer.current) return;
        clearTimeout(visualSaveTimer.current);
        visualSaveTimer.current = null;
        if (effectiveDef) performVisualSave(effectiveDef);
    }, [effectiveDef, performVisualSave]);

    /**
     * Escape closes whichever modal/panel is on top, in priority order.
     * Returning early on each branch keeps the precedence explicit and
     * keeps Esc context-aware without a separate focus tracker.
     */
    const onEscape = useCallback(() => {
        if (selectedStepId) {
            setSelectedStepId(null);
        }
    }, [selectedStepId]);

    useBuilderHotkeys({
        enabled: true,
        onUndo: draftHistory.undo,
        onRedo: draftHistory.redo,
        onSave: forceSaveNow,
        onDryRun,
        onEscape,
    });

    useEffect(() => () => {
        if (visualSaveTimer.current) clearTimeout(visualSaveTimer.current);
    }, []);

    /**
     * Save automation-level fields (title / description / definition).
     * Used by:
     *   - inline rename in BuilderHeader (`onRename` → `onSaveAutomation({title})`)
     *   - SettingsTab apply
     * Drives the saving pill state machine.
     */
    const onSaveAutomation = async (patch) => {
        const aid = await ensureAutomationCreated();
        if (!aid) throw new Error('Could not create automation. Refresh and try again.');
        if (savedTimer.current) { clearTimeout(savedTimer.current); savedTimer.current = null; }
        setSavingState('saving');
        try {
            const r = await api.updateAutomation(aid, patch);
            const persisted = r.automation || r;
            setServerAutomation(persisted);
            if (persisted?.definition) markServerConfirmed(persisted.definition);
            setSavingState('saved');
            savedTimer.current = setTimeout(() => setSavingState('idle'), 1500);
        } catch (e) {
            setSavingState('error');
            throw e;
        }
    };

    const onRename = async (nextTitle) => {
        try { await onSaveAutomation({ title: nextTitle }); }
        catch (e) { console.warn('[BuilderShell] rename failed:', e.message); }
    };

    const isActive = !!serverAutomation?.isActive;
    const isDraft = !!serverAutomation?.isDraft;
    const title = serverAutomation?.title || 'New automation';
    // Diagnose button only makes sense for app_event triggers — schedule
    // and manual triggers have nothing to probe externally.
    const isAppEventTrigger = effectiveDef?.trigger?.kind === 'app_event';
    const statusLabel = isDraft ? 'Draft' : (isActive ? 'Live' : 'Paused');
    const statusBadgeClass = isDraft
        ? 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
        : isActive
            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400';

    const triggerKind = effectiveDef?.trigger?.kind || serverAutomation?.triggerType;
    const aidForHistory = state.automationId || automationId;

    return (
        <div className="flex flex-col h-full min-h-0">
            <BuilderHeader
                title={title}
                triggerKind={triggerKind}
                isActive={isActive}
                isDraft={isDraft}
                statusLabel={statusLabel}
                statusBadgeClass={statusBadgeClass}
                canDiagnose={isAppEventTrigger}
                busy={busy}
                onBack={onBack}
                onActivate={onActivate}
                onDeactivate={onDeactivate}
                onDryRun={onDryRun}
                onDiagnose={onDiagnose}
                onRename={onRename}
                diagnoseAnchorRef={diagnoseAnchorRef}
                savingState={savingState}
                tab={tab}
                onTabChange={setTab}
                onUndo={draftHistory.undo}
                onRedo={draftHistory.redo}
                canUndo={draftHistory.canUndo}
                canRedo={draftHistory.canRedo}
            />

            {diagnoseOpen && (
                <TriggerDiagnosePanel
                    result={diagnoseResult}
                    loading={diagnoseLoading}
                    error={diagnoseError}
                    onClose={() => setDiagnoseOpen(false)}
                    anchorRef={diagnoseAnchorRef}
                />
            )}

            <div className="flex-1 min-h-0 relative">
                {tab === 'build' && (
                    <BuildTab
                        focusMode={focusMode}
                        setFocusMode={setFocusMode}
                        chatWidth={chatWidth}
                        onChatResizeStart={onChatResizeStart}
                        state={state}
                        effectiveDef={effectiveDef}
                        chatInput={chatInput}
                        setChatInput={setChatInput}
                        modelTiers={modelTiers}
                        selectedTier={selectedTier}
                        setSelectedTier={setSelectedTier}
                        user={user}
                        onSend={onSend}
                        messagesContainerRef={messagesContainerRef}
                        messagesEndRef={messagesEndRef}
                        onNodeClick={setSelectedStepId}
                        selectedStep={selectedStep}
                        selectedRunStep={selectedRunStep}
                        onCloseInspector={() => setSelectedStepId(null)}
                        onSaveStep={onSaveStep}
                        onVisualEdit={onVisualEdit}
                        onExecuteStep={executeStep}
                        onRetryFromStep={retryFromStep}
                        onStopRun={stopRun}
                        pollRunProgress={pollRunProgress}
                        fatalError={error || state.error}
                        onDismissFatal={() => setError(null)}
                        onDiagnose={onDiagnose}
                    />
                )}
                {tab === 'settings' && (
                    <SettingsTab
                        automation={serverAutomation}
                        onSave={onSaveAutomation}
                    />
                )}
                {tab === 'history' && (
                    <RunHistoryTab automationId={aidForHistory} automation={serverAutomation} />
                )}
                {tab === 'json' && (
                    <JsonTab automation={serverAutomation} />
                )}
            </div>
        </div>
    );
}

/**
 * Build tab body — extracted so BuilderShell stays compact and the
 * floating validation pill, focus-mode toggle, and inspector overlay
 * have a clear scope.
 *
 * Owns the slide-in NodePalette state because three different events
 * open it (auto on empty draft, FAB click, edge-end-drop) and they all
 * need to round-trip through the same handler that runs
 * `applyAddNode(definition, payload, position, sourceId)`.
 */
function BuildTab({
    focusMode, setFocusMode,
    chatWidth, onChatResizeStart,
    state, effectiveDef,
    chatInput, setChatInput, modelTiers, selectedTier, setSelectedTier, user,
    onSend, messagesContainerRef, messagesEndRef,
    onNodeClick, selectedStep, selectedRunStep, onCloseInspector, onSaveStep,
    onVisualEdit,
    onExecuteStep, onRetryFromStep, onStopRun, pollRunProgress,
    fatalError, onDismissFatal,
    onDiagnose = null,
}) {
    const isAppEventTrigger = effectiveDef?.trigger?.kind === 'app_event';
    // Imperative handle to DiagramPane — we need getCenter() for the
    // click-to-add path (when the user clicks rather than drags an item).
    const diagramRef = useRef(null);

    // Palette state. `position` and `edgeSource` are populated only when
    // the panel was opened via React Flow's onConnectEnd (edge dragged
    // into empty space) — both null means "open from FAB or auto-open"
    // and the parent inserts at canvas centre with no source edge.
    const [palette, setPalette] = useState({ open: false, position: null, edgeSource: null });
    const paletteMode = effectiveDef?.trigger ? 'step' : 'trigger';

    // Auto-open the palette ONCE per session when there is no trigger
    // yet — covers both fresh automations (effectiveDef still null
    // because no chat / server snapshot has populated it) and loaded
    // automations whose draft has no trigger. After the user closes
    // it (or places a trigger) we don't re-open automatically — they
    // have the empty-state CTA and the FAB if they want to come back.
    const autoOpenedRef = useRef(false);
    useEffect(() => {
        if (autoOpenedRef.current) return;
        if (effectiveDef?.trigger) return; // already has a trigger → nothing to pick
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPalette(p => p.open ? p : { open: true, position: null, edgeSource: null });
        autoOpenedRef.current = true;
    }, [effectiveDef]);

    const closePalette = useCallback(() => {
        setPalette({ open: false, position: null, edgeSource: null });
    }, []);

    const openPaletteFromFab = useCallback(() => {
        // FAB always opens "blank" — no edge anchor, no drop position.
        setPalette({ open: true, position: null, edgeSource: null });
    }, []);

    const onRequestAddNodeFromEdge = useCallback(({ sourceId, position }) => {
        // Clear any inspector overlay so the panel slot isn't already
        // occupied (both slide in from the right).
        setPalette({ open: true, position, edgeSource: sourceId });
    }, []);

    // Live-run polling. While a dry-run is in flight (status='running'),
    // hit /runs/:id/steps every 750ms so the diagram's edges animate and
    // the progress banner updates as each step completes. Stops as soon
    // as the run is no longer running.
    const liveRunInFlight = state.dryRun?.status === 'running' || state.dryRun?.status === 'queued';
    useEffect(() => {
        if (!liveRunInFlight || !state.dryRun?.id || typeof pollRunProgress !== 'function') return;
        let alive = true;
        const tick = async () => {
            if (!alive) return;
            await pollRunProgress(state.dryRun.id);
        };
        const handle = setInterval(tick, 750);
        tick();
        return () => { alive = false; clearInterval(handle); };
    }, [liveRunInFlight, state.dryRun?.id, pollRunProgress]);

    // Triggered by the n8n-style "+" hover button on each node. Opens
    // the palette in step-mode with `edgeSource` set so the next pick
    // is auto-wired to the clicked node. No drop position — the
    // handleAddNode below derives it from the source node's position.
    const onRequestAddAfter = useCallback((nodeId) => {
        if (!nodeId) return;
        setPalette({ open: true, position: null, edgeSource: nodeId });
    }, []);

    const handleAddNode = useCallback((payload) => {
        if (!payload) return;
        // Fresh automations have no draft and no server snapshot yet —
        // the user is adding their first node. Seed a minimal skeleton
        // so applyAddNode has something to attach to. onVisualEdit will
        // setDraft regardless and the chat flow can save it later.
        const baseDef = effectiveDef || { trigger: null, steps: [], edges: [] };

        let position = palette.position;
        const sourceId = palette.edgeSource;

        if (!position) {
            // Edge-aware positioning. Three fallbacks in order:
            //   1. If we're wiring from a specific source node (n8n
            //      "+ next step" button or edge-drop), drop just to the
            //      right of THAT node so the new step lines up with its
            //      origin, not whichever node happens to be rightmost.
            //   2. Otherwise (FAB / auto-open / search), drop to the
            //      right of the rightmost existing node so we don't
            //      stack on top of anything.
            //   3. Triggers and bare-canvas additions fall through to
            //      the canvas centre.
            if (sourceId) {
                const src = [baseDef.trigger, ...(baseDef.steps || [])]
                    .find(n => n?.id === sourceId);
                if (src?.position) {
                    position = { x: src.position.x + 280, y: src.position.y };
                }
            }
            if (!position && payload.kind !== 'trigger') {
                const allNodes = [baseDef.trigger, ...(baseDef.steps || [])].filter(Boolean);
                const rightmost = allNodes.reduce((acc, n) => {
                    const x = n?.position?.x;
                    if (typeof x !== 'number') return acc;
                    return (!acc || x > acc.position.x) ? n : acc;
                }, null);
                if (rightmost?.position) {
                    position = { x: rightmost.position.x + 280, y: rightmost.position.y };
                }
            }
            if (!position) {
                position = diagramRef.current?.getCenter?.() || { x: 0, y: 0 };
            }
        }

        const next = applyAddNode(baseDef, payload, position, sourceId);
        onVisualEdit?.(next);

        // Keep the panel open so the user can add multiple nodes in a
        // row without re-opening it each time. Edge-drop continuation
        // is the only case that closes (single insert is the goal).
        if (sourceId) closePalette();
        else setPalette(p => ({ ...p, position: null, edgeSource: null }));
    }, [effectiveDef, palette.position, palette.edgeSource, onVisualEdit, closePalette]);

    // Clicking a node opens the inspector — close the palette first so
    // they don't fight for the right edge.
    const onNodeClickWrapped = useCallback((id) => {
        if (palette.open) closePalette();
        onNodeClick?.(id);
    }, [palette.open, closePalette, onNodeClick]);

    // Opening the palette must close any open inspector (same reason).
    useEffect(() => {
        if (palette.open && selectedStep) onCloseInspector?.();
    }, [palette.open, selectedStep, onCloseInspector]);

    return (
        <div className="flex h-full">
            {/* Chat column — collapses entirely in Focus mode. The expand
                handle lives at the top of the diagram column when collapsed. */}
            {!focusMode && (
                <div
                    style={{ width: chatWidth }}
                    className="flex flex-col bg-[var(--bg-secondary)] border-r border-[var(--border-default)] flex-shrink-0 min-w-[240px] max-w-[600px]"
                    data-surface="subtle"
                >
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border-default)]">
                        <div className="text-[10px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)]">
                            Chat
                        </div>
                        <button
                            onClick={() => setFocusMode(true)}
                            title="Focus mode (hide chat)"
                            className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                        >
                            <PanelLeftClose size={14} />
                        </button>
                    </div>
                    <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar">
                        {state.messages.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-center px-4">
                                <div className="text-sm font-medium text-[var(--text-primary)] mb-1">Describe what you want</div>
                                <div className="text-xs text-[var(--text-tertiary)] max-w-xs">
                                    The builder wires the trigger and steps for you.
                                </div>
                            </div>
                        )}
                        <div className="flex flex-col gap-4 w-full max-w-[900px] mx-auto">
                            {state.messages.map((m, i) => <MessageBubble key={i} msg={m} />)}
                            {state.running && (
                                <div className="self-start text-xs italic text-[var(--text-tertiary)] px-1">
                                    Thinking…
                                </div>
                            )}
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
            )}

            {!focusMode && (
                <div
                    onMouseDown={onChatResizeStart}
                    className="w-1 flex-shrink-0 cursor-col-resize hover:bg-[var(--accent)]/40 active:bg-[var(--accent)]/60 transition-colors z-10"
                />
            )}

            {/* Diagram column — fills remaining width and (most of) the height.
                Summary + DryRunPanel sit on top so they don't compete with the
                canvas for vertical space. */}
            <div className="flex-1 min-w-0 flex flex-col relative bg-[var(--bg-primary)]">
                {focusMode && (
                    <button
                        onClick={() => setFocusMode(false)}
                        title="Exit focus mode (show chat)"
                        className="absolute left-3 top-3 z-20 p-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] shadow-sm"
                    >
                        <PanelLeftOpen size={14} />
                    </button>
                )}
                {state.summary && (
                    <div className="px-4 py-2 border-b border-[var(--border-default)] flex-shrink-0">
                        <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1">What this automation does</div>
                        <div className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap line-clamp-3">{state.summary}</div>
                    </div>
                )}
                {state.pendingExternalDraft && (
                    <div className="px-4 py-2 border-b border-amber-500/30 bg-amber-500/10 flex items-center justify-between gap-3 flex-shrink-0">
                        <div className="text-xs text-amber-700 dark:text-amber-400">
                            The chat assistant proposed changes while you were editing. Accept them, or keep your local edits.
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={dismissExternalDraft}
                                className="px-2 py-1 text-xs rounded text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                            >
                                Keep mine
                            </button>
                            <button
                                onClick={acceptExternalDraft}
                                className="px-2 py-1 text-xs rounded bg-[var(--accent)] text-white hover:opacity-90"
                            >
                                Accept chat changes
                            </button>
                        </div>
                    </div>
                )}
                {state.dryRun && (
                    <div className="flex-shrink-0">
                        <DryRunPanel run={state.dryRun} steps={state.steps} />
                    </div>
                )}
                <div className="flex-1 min-h-0">
                    <DiagramPane
                        ref={diagramRef}
                        definition={effectiveDef}
                        runSteps={state.steps}
                        onNodeClick={onNodeClickWrapped}
                        validation={state.validation}
                        editable
                        structuralEditsBlocked={state.running}
                        onDefinitionChange={onVisualEdit}
                        onRequestAddNode={onRequestAddNodeFromEdge}
                        onRequestOpenPalette={openPaletteFromFab}
                        onRequestAddAfter={onRequestAddAfter}
                        onExecuteStep={onExecuteStep}
                        executingStepId={state.executingStepId}
                        runInFlight={liveRunInFlight}
                        onDiagnose={isAppEventTrigger ? onDiagnose : null}
                    />
                </div>
                {liveRunInFlight && (
                    <RunProgressBanner
                        run={state.dryRun}
                        steps={state.steps}
                        onStop={() => state.dryRun?.id && onStopRun?.(state.dryRun.id)}
                    />
                )}
                <FloatingValidationPill
                    fatalError={fatalError}
                    validation={state.validation}
                    aborted={state.aborted}
                    onDismissFatal={onDismissFatal}
                />
                {effectiveDef?.trigger && !palette.open && !selectedStep && (
                    <AddNodeFab onClick={openPaletteFromFab} disabled={state.running} />
                )}
                <NodePalette
                    open={palette.open}
                    onClose={closePalette}
                    mode={paletteMode}
                    disabled={state.running}
                    onAddNode={handleAddNode}
                />
                {selectedStep && (
                    <StepInspector
                        step={selectedStep}
                        runStep={selectedRunStep}
                        onClose={onCloseInspector}
                        definition={effectiveDef}
                        onSaveStep={onSaveStep}
                        validation={state.validation}
                        modelTiers={modelTiers}
                        onExecuteStep={onExecuteStep}
                        onRetryFromStep={onRetryFromStep}
                        runInFlight={liveRunInFlight}
                        executingStep={state.executingStepId === selectedStep.id}
                    />
                )}
            </div>
        </div>
    );
}

/**
 * Sticky banner shown while a run is in flight — n8n's "Workflow is
 * executing…" pill with live step count and a Stop button. Anchored at
 * the top of the diagram column.
 */
function RunProgressBanner({ run, steps, onStop }) {
    const total = steps?.length || 0;
    const done = (steps || []).filter(s => s.status === 'success' || s.status === 'skipped' || s.status === 'pinned').length;
    const failed = (steps || []).some(s => s.status === 'error');
    const startedAt = run?.startedAt ? new Date(run.startedAt).getTime() : null;
    const [elapsed, setElapsed] = useState(startedAt ? Date.now() - startedAt : 0);
    useEffect(() => {
        if (!startedAt) return;
        const h = setInterval(() => setElapsed(Date.now() - startedAt), 250);
        return () => clearInterval(h);
    }, [startedAt]);
    return (
        <div className="absolute left-1/2 -translate-x-1/2 top-3 z-30 flex items-center gap-3 px-3 py-1.5 rounded-full bg-[var(--bg-card,#fff)] border border-[var(--border-default)] shadow-md text-xs">
            <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${failed ? 'bg-red-500' : 'bg-[var(--accent)]'}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${failed ? 'bg-red-500' : 'bg-[var(--accent)]'}`} />
            </span>
            <span className="font-medium text-[var(--text-primary)]">
                {failed ? 'Run failing' : 'Running'} — {done}/{total || '?'} steps
            </span>
            <span className="text-[var(--text-tertiary)] tabular-nums">
                {Math.floor(elapsed / 1000)}.{Math.floor((elapsed % 1000) / 100)}s
            </span>
            <button
                onClick={onStop}
                title="Stop this run"
                className="ml-1 px-2 py-0.5 rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-red-600 transition"
            >
                Stop
            </button>
        </div>
    );
}

/**
 * Message bubble styled to match direct/agent chat:
 *   - 900px centered column (same as MessageItem outer container).
 *   - User: light grey #e8e8eb pill capped at 85%, bottom-right corner squared.
 *   - Assistant: no background — body sits directly on the chat surface, the
 *     same way direct chat renders so long markdown reads naturally instead
 *     of being trapped in a small grey bubble. Bottom-left corner squared
 *     to mirror the speech-bubble feel.
 *   - Markdown is rendered for assistant turns; user content is plain text
 *     with whitespace preserved.
 */
function MessageBubble({ msg }) {
    const isUser = msg.role === 'user';
    return (
        <div className={`flex flex-col w-full ${isUser ? 'items-end' : 'items-start'}`}>
            <div
                className={`relative rounded-2xl p-4 transition-all duration-200 overflow-hidden text-sm ${isUser
                    ? 'max-w-[85%] bg-[var(--user-bubble-bg,#e8e8eb)] text-[var(--user-bubble-fg,#000)] rounded-br-none whitespace-pre-wrap'
                    : 'max-w-3xl text-[var(--text-primary)] rounded-bl-none'}`}
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
                <div className="mt-1.5 flex flex-col gap-1 w-full max-w-3xl">
                    {msg.toolCalls.map((tc, i) => <ToolCallChip key={i} tc={tc} />)}
                </div>
            )}
        </div>
    );
}

// BuilderErrorBanner moved to FloatingValidationPill.jsx — the redesign
// surfaces these records as a sticky bottom-right pill on the Build tab
// instead of a top-of-canvas row that pushes content down.

/**
 * Cheap structural-equality check between two automation definitions.
 * Used by the beforeunload guard to detect unsaved changes without
 * tripping over JSON.stringify's key-ordering instability.
 */
function deepEqualDef(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
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

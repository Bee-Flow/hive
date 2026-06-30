import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BuilderHeader from './BuilderHeader';
import { applyAddNode } from './DiagramPane';
import {
    getScopedGraph, setScopedGraph, deleteLayerFromDefinition,
    renameLayer, countLayerRefs,
} from './flow/flowletScope';
import useRoutineDraftHistory from './flow/useRoutineDraftHistory';
import ExecutionsPanel from '../../Studio/Executions/ExecutionsPanel';
import SettingsTab from './SettingsTab';
import TriggerDiagnosePanel from './TriggerDiagnosePanel';
import useBuilderHotkeys from './useBuilderHotkeys';
import useAutoLabelSteps from './useAutoLabelSteps';
import useAutomationApi from '../../../../hooks/useAutomationApi';
import useAutomationBuilderStream from '../../../../hooks/useAutomationBuilderStream';
import useFlowletAgentStream from '../../../../hooks/useFlowletAgentStream';
import { API_BASE, authFetch } from '../../../../utils/helpers';
import scopedStorage from '../../../../utils/scopedStorage';
import InputArea from '../../../InputArea';
import { toast } from '../../../shared/Toast';
import BuildTab from './BuildTab';

/**
 * Split-view conversational builder.
 *
 * Reuses the EXACT same <InputArea> as direct chat (directMode=true) so
 * users get apps menu, model-tier selector, web search toggle, and file
 * attachments. State (tier, web-search, disabled media) lives in
 * scopedStorage so it persists across sessions just like direct chat.
 */
/**
 * Whether the builder should auto-fire an `autoSendInput` spec ("Build it
 * directly" from a suggestion card). Only on a brand-new builder (no
 * automationId) with no existing conversation — never into an automation the
 * user is already editing. Pure so it can be unit-tested without the shell.
 */
export function canAutoSend({ autoSendInput, automationId, messageCount }) {
    return !!autoSendInput && !automationId && (messageCount || 0) === 0;
}

// A fresh Step's root graph: a single layer_input trigger (its input contract)
// + a single layer_output step (its return). Same shape as an inline Flowlet,
// but at the document root. Seeded so the canvas is usable immediately.
function makeBlockSkeleton() {
    return {
        schemaVersion: 2,
        trigger: { id: 'trg', type: 'trigger', kind: 'layer_input', params: [] },
        steps: [{ id: 'out', type: 'layer_output', fields: {} }],
        edges: [],
    };
}

export default function BuilderShell({ automationId, onBack, user, initialChatInput = '', autoSendInput = null, onAutomationIdResolved = null, initialScopeKey = null, onScopeChange = null, mode = 'automation', onPublished = null, initialTab = null }) {
    const api = useAutomationApi();
    // Step mode (kind='block'): same builder, but persistence targets the
    // /api/step router, the root is an input/output contract (no real trigger),
    // and there's no activate/run/AI-chat — you Publish to roll changes out.
    const isStep = mode === 'step';
    const apiGetOne = isStep ? api.getStep : api.getAutomation;
    const apiCreateOne = isStep ? api.createStep : api.createAutomation;
    const apiUpdateOne = isStep ? api.updateStep : api.updateAutomation;
    const unwrapRow = (r) => (r && (r.automation || r.step)) || r;
    const { state, send, hydrate, setDraft, markServerConfirmed, acceptExternalDraft, dismissExternalDraft, executeStep, retryFromStep, stopRun, pollRunProgress, setRunResult, watchActiveRun, clearDryRun } = useAutomationBuilderStream({ automationId });
    const [serverAutomation, setServerAutomation] = useState(null);
    // Node Detail View (NDV) — the focused Input|Parameters|Output editor for
    // ONE step. `ndvStepId` is the step being edited (null = closed). Replaces
    // the old node-anchored peek + multi-pin dock.
    const [ndvStepId, setNdvStepId] = useState(null);
    const openNdv = useCallback((id) => { if (id) setNdvStepId(id); }, []);
    const closeNdv = useCallback(() => setNdvStepId(null), []);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [hasHydrated, setHasHydrated] = useState(false);

    // Executing a step (from the node's ▶ or the NDV) opens its NDV so the
    // result lands in the Output column where the user can see it.
    const handleExecuteStep = useCallback((stepId, opts) => {
        if (stepId) setNdvStepId(stepId);
        return executeStep(stepId, opts);
    }, [executeStep]);

    // Tab navigation. Default to Build — the chat + diagram is what users
    // open the builder to do; the other tabs are jump-points for specific
    // tasks (settings, history, raw JSON).
    const [tab, setTab] = useState(initialTab || 'build');

    // The AI assistant is a summonable, right-docked panel — the canvas is
    // full-width by default (assistant closed). Persisted so the choice
    // survives reload.
    const [assistantOpen, setAssistantOpen] = useState(() => scopedStorage.getItem('routinesAssistantOpen') === '1');
    useEffect(() => {
        scopedStorage.setItem('routinesAssistantOpen', assistantOpen ? '1' : '0');
    }, [assistantOpen]);

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
            // Gutter is on the RIGHT edge of the left-docked assistant, so
            // dragging right (positive delta) GROWS the panel.
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

    // Step mode: the sharing menu offers "specific groups" within the org, so
    // load the caller's org groups (same /auth/groups endpoint as KBs/Agents).
    const [orgGroups, setOrgGroups] = useState([]);
    useEffect(() => {
        if (!isStep) return;
        let alive = true;
        (async () => {
            try {
                const r = await authFetch(`${API_BASE}/auth/groups`);
                if (r.ok && alive) {
                    const data = await r.json();
                    setOrgGroups(Array.isArray(data) ? data : []);
                }
            } catch (_) { /* silent — menu falls back to Personal/Org only */ }
        })();
        return () => { alive = false; };
    }, [isStep]);

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

    // Step mode seeds a block skeleton so a brand-new Step opens with its
    // input + output contract already on the canvas (there is no trigger
    // picker step for Steps).
    const blockSeed = useMemo(() => (isStep ? makeBlockSkeleton() : null), [isStep]);
    const effectiveDef = state.draft || serverAutomation?.definition || blockSeed;

    // ── Flowlet scope ──────────────────────────────────────────────────────
    // null = root canvas; a flowlet key = drilled into definition.layers[key].
    // Edits made while scoped are wrapped back into the WHOLE document
    // before history-commit/persist — undo and the server only ever see
    // complete definitions.
    const [scopeKey, setScopeKey] = useState(null);
    const scopedDef = useMemo(() => getScopedGraph(effectiveDef, scopeKey), [effectiveDef, scopeKey]);

    // Scope guard: snap back to root when the flowlet disappears out from
    // under us (undo, AI rewrite, JSON save, version restore, hydrate).
    useEffect(() => {
        if (scopeKey && !effectiveDef?.layers?.[scopeKey]) setScopeKey(null);
    }, [scopeKey, effectiveDef]);

    // ── Flowlet scope ↔ URL ────────────────────────────────────────────────
    // Sync FROM the URL: adopt `initialScopeKey` on first load and on browser
    // back/forward. We wait until the definition actually has that flowlet
    // (the draft hydrates async), and never override the user's own drilling
    // (their setScopeKey already matches by the time the URL echo arrives).
    const lastScopeSyncRef = useRef(null);
    useEffect(() => {
        const want = initialScopeKey || null;
        if (want === lastScopeSyncRef.current) return;
        // Hold off until the target flowlet exists, so the scope-guard above
        // can't immediately snap us back to root.
        if (want && !effectiveDef?.layers?.[want]) return;
        lastScopeSyncRef.current = want;
        setScopeKey(want);
    }, [initialScopeKey, effectiveDef]);

    // Report scope changes UP so the parent can mirror them in the path. Skips
    // the initial value (the parent already knows it from the URL) and reports
    // every change after, including the user drilling in/out.
    const reportedScopeRef = useRef(undefined);
    useEffect(() => {
        if (reportedScopeRef.current === scopeKey) return;
        const first = reportedScopeRef.current === undefined;
        reportedScopeRef.current = scopeKey;
        if (first) return;
        onScopeChange?.(scopeKey);
    }, [scopeKey, onScopeChange]);

    // The NDV is per-canvas — a step id is only meaningful within its scope,
    // so close it when the user drills into / out of a flowlet.
    useEffect(() => {
        setNdvStepId(null);
    }, [scopeKey]);

    useEffect(() => {
        const aid = state.automationId || automationId;
        if (!aid) return;
        let alive = true;
        apiGetOne(aid).then(d => { if (alive) setServerAutomation(unwrapRow(d)); }).catch(() => {});
        return () => { alive = false; };
    }, [state.automationId, automationId, state.dryRun, state.finalizedId]); // eslint-disable-line

    // Report the resolved automation id upward so the parent can reflect it in
    // the URL path. Covers the lazy-create flow where a brand-new automation
    // only gets an id after the first save (chat turn or visual edit).
    useEffect(() => {
        const aid = state.automationId || automationId;
        if (aid) onAutomationIdResolved?.(aid);
    }, [state.automationId, automationId, onAutomationIdResolved]);

    // One-shot snapshot rehydration. On mount with an existing automation
    // id, fetch the latest builder-session snapshot and hydrate so the
    // chat panel + draft + summary survive a refresh or SSE drop.
    useEffect(() => {
        const aid = state.automationId || automationId;
        if (!aid || hasHydrated) return;
        // Steps have no AI-chat builder session to rehydrate (v1 visual build).
        if (isStep) { setHasHydrated(true); return; }
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
        if (!scopedDef) return [];
        return [scopedDef.trigger, ...(scopedDef.steps || [])].filter(Boolean);
    }, [scopedDef]);

    // Per-id lookups for the node-attached panels (settings / output).
    const stepById = useCallback((id) => allSteps.find(s => s.id === id) || null, [allSteps]);
    const runStepById = useCallback((id) => (state.steps || []).find(s => s.stepId === id && !s.parentStepId) || null, [state.steps]);

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
            // Which canvas the user is looking at — lets the server hint
            // the model's default `scope` for builder tool calls.
            canvasScope: scopeKey,
        });
    };

    // "Build it directly" — when the parent opens a fresh builder with an
    // autoSendInput spec (from a suggestion card), fire it once automatically
    // so the user watches the builder construct the automation instead of
    // having to press Send. Guarded so React StrictMode's double-mount and
    // re-renders can't double-fire; only on a brand-new builder with no
    // existing conversation. The fresh `key` mount per open resets the ref.
    const autoSentRef = useRef(false);
    useEffect(() => {
        if (autoSentRef.current) return;
        if (!canAutoSend({ autoSendInput, automationId, messageCount: (state.messages || []).length })) return;
        autoSentRef.current = true;
        onSend(autoSendInput);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoSendInput, automationId]);

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
        let stopWatch = () => {};
        try {
            const aid = await ensureAutomationCreated();
            if (!aid) { setError('Add a trigger and at least one step before running.'); return; }
            stopWatch = watchActiveRun(aid); // live progress while it runs
            const r = await api.dryRun(aid);
            setRunResult(r.run, r.steps);
            toast.success('Dry-run complete — open a step to see its output.');
        }
        catch (e) { setError(e.message); }
        finally { stopWatch(); setBusy(false); }
    };

    // Live full-flow run from the editor (the "Run live" option in the Run
    // menu). Unlike Dry-run this performs every side-effect for real, so we
    // gate it behind a confirm. Results land in each node's Run tab via
    // setRunResult, exactly like the dry-run path.
    const onRunLive = async () => {
        if (typeof window !== 'undefined' && !window.confirm(
            'Run the whole automation for real now? This performs every step — sending messages, writing data, and any other actions in the flow.'
        )) return;
        setBusy(true); setError(null);
        let stopWatch = () => {};
        try {
            const aid = await ensureAutomationCreated();
            if (!aid) { setError('Add a trigger and at least one step before running.'); return; }
            stopWatch = watchActiveRun(aid); // live progress while it runs
            const r = await api.run(aid);
            if (r?.skipped) {
                clearDryRun();
                toast.success(r.message || 'Nothing to run against yet.');
            } else if (r?.pending) {
                // Run outlived the request window; hand off to Run history and
                // clear the live stub so the progress banner doesn't hang.
                clearDryRun();
                toast.success('Run started — results will appear in Run history shortly.');
            } else {
                setRunResult(r.run, r.steps);
                toast.success('Live run complete — open a step to see its output.');
            }
        }
        catch (e) { setError(e.message); }
        finally { stopWatch(); setBusy(false); }
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

    const onSaveStep = async (nextGraph) => {
        // The inspector edits the SCOPED graph — wrap it back into the
        // whole document before persisting so the server always receives
        // a complete definition.
        const nextDef = setScopedGraph(effectiveDef, scopeKey, nextGraph);
        // Lazy-create when the user clicked Save in the inspector before
        // any other persist round-trip happened (e.g. they only added
        // nodes via the palette, then opened the inspector to set inputs
        // / mappings, then hit Save). The visual-edit debounce may not
        // have fired yet, so we must create here too.
        const aid = await ensureAutomationCreated(nextDef);
        if (!aid) throw new Error('Could not create automation. Refresh and try again.');
        const r = await apiUpdateOne(aid, { definition: nextDef });
        const persisted = unwrapRow(r);
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
            title: serverAutomation?.title || (isStep ? 'Untitled Step' : 'Untitled automation'),
            definition: defForCreate || state.draft || serverAutomation?.definition || (isStep ? makeBlockSkeleton() : null),
        };
        createInflightRef.current = (async () => {
            try {
                const r = await apiCreateOne(body);
                const created = unwrapRow(r);
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

    /**
     * Whole-document commit (history entry + debounced persist). Used by
     * scope-spanning edits (create flowlet + insert call_layer, delete flowlet,
     * rename flowlet) that already operate on the full definition.
     */
    const onVisualEditRoot = useCallback((nextDef) => {
        draftHistory.commit(nextDef);
    }, [draftHistory]);

    // Auto-name newly added steps (label + symbol) with the fast tier, debounced
    // on structural changes and never touching a field the user set by hand.
    useAutoLabelSteps({ def: effectiveDef, api, apply: onVisualEditRoot });

    // ── AI flowlet builder (separate from chat) ─────────────────────────────
    // Drives the Flowlets panel's "Build a flowlet with AI" / "Refine with AI".
    // The endpoint already persists the new def server-side; we mirror it
    // into the local draft + history via onVisualEditRoot (one undo entry),
    // exactly like every other flowlet edit. Returns true on success so the
    // panel can collapse its composer.
    const layerAgent = useFlowletAgentStream();
    const onBuildLayer = useCallback(async (instruction) => {
        if (!instruction || !instruction.trim()) return false;
        const aid = await ensureAutomationCreated();
        if (!aid) { toast.error('Could not save the automation. Try again.'); return false; }
        const r = await layerAgent.send({ automationId: aid, instruction, mode: 'create' });
        if (r.error) { toast.error(`Couldn't build the flowlet. ${r.error}`.trim()); return false; }
        if (r.draft) {
            onVisualEditRoot(r.draft);
            if (r.layerKey) setScopeKey(r.layerKey); // drill into the new flowlet
            toast.success('Flowlet built.');
            return true;
        }
        return false;
    }, [ensureAutomationCreated, layerAgent, onVisualEditRoot]);

    const onRefineLayer = useCallback(async (layerKey, instruction) => {
        if (!layerKey || !instruction || !instruction.trim()) return false;
        const aid = await ensureAutomationCreated();
        if (!aid) { toast.error('Could not save the automation. Try again.'); return false; }
        const r = await layerAgent.send({ automationId: aid, instruction, mode: 'refine', layerKey });
        if (r.error) { toast.error(`Couldn't refine the flowlet. ${r.error}`.trim()); return false; }
        if (r.draft) { onVisualEditRoot(r.draft); toast.success('Flowlet updated.'); return true; }
        return false;
    }, [ensureAutomationCreated, layerAgent, onVisualEditRoot]);

    /**
     * Canvas write path. The diagram/palette hand us the graph for the
     * CURRENT scope — wrap it back into the whole document before the
     * history commit so one undo entry covers the edit and persistence
     * always sees complete definitions.
     */
    const onVisualEdit = useCallback((nextGraph) => {
        draftHistory.commit(setScopedGraph(effectiveDef, scopeKey, nextGraph));
    }, [draftHistory, effectiveDef, scopeKey]);

    /**
     * Sync local state after an out-of-band whole-document replacement
     * (raw JSON save, version restore). Without setDraft the stale SSE
     * draft keeps overriding the saved definition on the canvas, and
     * undoing across a wholesale replacement is incoherent — so the
     * history resets too.
     */
    const syncServerRow = useCallback((a) => {
        if (!a) return;
        setServerAutomation(a);
        if (a.definition) {
            setDraft(a.definition);
            markServerConfirmed(a.definition);
        }
        draftHistory.reset();
        // A wholesale replacement may have removed the flowlet we were
        // looking at — exit to root rather than risk a dead scope.
        setScopeKey(null);
    }, [setDraft, markServerConfirmed, draftHistory]);

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
        if (ndvStepId) {
            closeNdv();
        }
    }, [ndvStepId, closeNdv]);

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
            const r = await apiUpdateOne(aid, patch);
            const persisted = unwrapRow(r);
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
        // While drilled into a flowlet the inline title edits the FLOWLET's
        // title — a definition edit, not an automation-row PATCH.
        if (scopeKey) {
            if (effectiveDef?.layers?.[scopeKey]) {
                onVisualEditRoot(renameLayer(effectiveDef, scopeKey, nextTitle));
            }
            return;
        }
        try { await onSaveAutomation({ title: nextTitle }); }
        catch (e) { console.warn('[BuilderShell] rename failed:', e.message); }
    };

    // Header scope descriptor + delete-flowlet action. refCount blocks the
    // delete button while any call_layer (root or sibling flowlet) still
    // references this flowlet.
    const scope = useMemo(() => {
        if (!scopeKey) return null;
        const layer = effectiveDef?.layers?.[scopeKey];
        if (!layer) return null;
        return {
            key: scopeKey,
            title: layer.title || scopeKey,
            refCount: countLayerRefs(effectiveDef, scopeKey),
        };
    }, [scopeKey, effectiveDef]);

    const onExitScope = useCallback(() => setScopeKey(null), []);

    const onDeleteLayer = useCallback(() => {
        if (!scopeKey || !effectiveDef?.layers?.[scopeKey]) return;
        if (countLayerRefs(effectiveDef, scopeKey) > 0) return;
        onVisualEditRoot(deleteLayerFromDefinition(effectiveDef, scopeKey));
        setScopeKey(null);
    }, [scopeKey, effectiveDef, onVisualEditRoot]);

    // ── Step publish / sharing / chat-exposure (mode='step') ──────────────
    const onPublishStep = async () => {
        setBusy(true); setError(null);
        try {
            const aid = await ensureAutomationCreated();
            if (!aid) { setError('Add an input and a return before publishing.'); return; }
            const r = await api.publishStep(aid);
            setServerAutomation(unwrapRow(r));
            onPublished?.(aid);
            toast.success('Step published — automations and chats using it pick up the change.');
        } catch (e) { setError(e.message); }
        setBusy(false);
    };
    const onSetStepSharing = async (sharing) => {
        const aid = await ensureAutomationCreated();
        if (!aid) return;
        const r = await api.setStepSharing(aid, sharing);
        setServerAutomation(unwrapRow(r));
    };
    const onSetStepExpose = async (exposeAsTool) => {
        const aid = await ensureAutomationCreated();
        if (!aid) return;
        const r = await api.setStepExpose(aid, exposeAsTool);
        setServerAutomation(unwrapRow(r));
    };
    const onSetStepIcon = async (icon) => {
        const aid = await ensureAutomationCreated();
        if (!aid) return;
        const r = await api.updateStep(aid, { icon: icon || null });
        setServerAutomation(unwrapRow(r));
    };
    const onSetStepCategory = async (category) => {
        const aid = await ensureAutomationCreated();
        if (!aid) return;
        const r = await api.updateStep(aid, { category: category || '' });
        setServerAutomation(unwrapRow(r));
    };

    const isActive = !!serverAutomation?.isActive;
    const isDraft = !!serverAutomation?.isDraft;
    const title = serverAutomation?.title || (isStep ? 'New Step' : 'New automation');
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

    // Header props bundled so the SAME header renders either at the shell level
    // (Settings / Run history) or inside BuildTab (Build tab, where it also hosts
    // the add-step ribbon) — one unified top bar in both cases.
    const headerProps = {
        title, triggerKind, isActive, isDraft, statusLabel, statusBadgeClass,
        canDiagnose: isAppEventTrigger, busy, onBack, onActivate, onDeactivate,
        onDryRun, onRunLive, onDiagnose, onRename, mode,
        step: isStep ? serverAutomation : null, orgGroups, onPublishStep,
        onSetStepSharing, onSetStepExpose, onSetStepIcon, onSetStepCategory, scope, onExitScope,
        onDeleteLayer, diagnoseAnchorRef, savingState, tab, onTabChange: setTab,
        onUndo: draftHistory.undo, onRedo: draftHistory.redo,
        canUndo: draftHistory.canUndo, canRedo: draftHistory.canRedo,
    };

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* On Build, BuildTab renders this same header (with the add-step
                ribbon embedded in it); on the other tabs the shell renders it. */}
            {tab !== 'build' && <BuilderHeader {...headerProps} />}

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
                        headerProps={headerProps}
                        mode={mode}
                        assistantOpen={assistantOpen}
                        setAssistantOpen={setAssistantOpen}
                        chatWidth={chatWidth}
                        onChatResizeStart={onChatResizeStart}
                        state={state}
                        rootDef={effectiveDef}
                        scopedDef={scopedDef}
                        scopeKey={scopeKey}
                        setScopeKey={setScopeKey}
                        onVisualEditRoot={onVisualEditRoot}
                        chatInput={chatInput}
                        setChatInput={setChatInput}
                        modelTiers={modelTiers}
                        selectedTier={selectedTier}
                        setSelectedTier={setSelectedTier}
                        user={user}
                        onSend={onSend}
                        messagesContainerRef={messagesContainerRef}
                        messagesEndRef={messagesEndRef}
                        ndvStepId={ndvStepId}
                        openNdv={openNdv}
                        closeNdv={closeNdv}
                        stepById={stepById}
                        runStepById={runStepById}
                        onSaveStep={onSaveStep}
                        onVisualEdit={onVisualEdit}
                        onExecuteStep={handleExecuteStep}
                        onRetryFromStep={retryFromStep}
                        onStopRun={stopRun}
                        pollRunProgress={pollRunProgress}
                        fatalError={error || state.error}
                        onDismissFatal={() => setError(null)}
                        onDiagnose={onDiagnose}
                        acceptExternalDraft={acceptExternalDraft}
                        dismissExternalDraft={dismissExternalDraft}
                        onBuildLayer={onBuildLayer}
                        onRefineLayer={onRefineLayer}
                        layerAgentState={layerAgent.state}
                    />
                )}
                {tab === 'settings' && (
                    <SettingsTab
                        automation={serverAutomation}
                        onSave={onSaveAutomation}
                        onRestored={syncServerRow}
                    />
                )}
                {tab === 'history' && (
                    <ExecutionsPanel
                        scope={isStep ? 'step' : 'automation'}
                        automationId={isStep ? undefined : aidForHistory}
                        stepId={isStep ? aidForHistory : undefined}
                        onOpenEditor={() => setTab('build')}
                    />
                )}
            </div>
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

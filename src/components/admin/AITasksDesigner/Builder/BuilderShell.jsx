import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BuilderHeader from './BuilderHeader';
import { applyAddNode } from './DiagramPane';
import {
    getScopedGraph, setScopedGraph, deleteLayerFromDefinition, deleteLayerAndCalls,
    isLayerEmpty, renameLayer, countLayerRefs,
} from './flow/flowletScope';
import { normalizeDefinitionShape, isBlankDefinition } from './flow/normalizeDefinition';
import { densityForOpen } from './flow/settings/formDensity';
import useFormModePreference from './flow/settings/useFormModePreference';
import useRoutineDraftHistory from './flow/useRoutineDraftHistory';
import ExecutionsPanel from '../../Studio/Executions/ExecutionsPanel';
import SettingsTab from './SettingsTab';
import VersionHistoryPanel from './VersionHistoryPanel';
import { BuilderConfirmProvider } from './BuilderConfirmContext';
import useConfirm from '../../../shared/useConfirm';
import TriggerDiagnosePanel from './TriggerDiagnosePanel';
import useBuilderHotkeys from './useBuilderHotkeys';
import useAutoLabelSteps from './useAutoLabelSteps';
import useAutomationApi from '../../../../hooks/useAutomationApi';
import useAutomationBuilderStream from '../../../../hooks/useAutomationBuilderStream';
import useFlowletAgentStream from '../../../../hooks/useFlowletAgentStream';
import useModelTierSelection from '../../../../hooks/useModelTierSelection';
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

export default function BuilderShell({ automationId, onBack, user, initialChatInput = '', autoSendInput = null, onAutomationIdResolved = null, initialScopeKey = null, onScopeChange = null, mode = 'automation', onPublished = null, initialTab = null, initialRunId = null, initialRunStepId = null, onBuilderStateChange = null }) {
    const api = useAutomationApi();
    // Step mode (kind='block'): same builder, but persistence targets the
    // /api/step router, the root is an input/output contract (no real trigger),
    // and there's no activate/run/AI-chat — you Publish to roll changes out.
    const isStep = mode === 'step';
    const apiGetOne = isStep ? api.getStep : api.getAutomation;
    const apiCreateOne = isStep ? api.createStep : api.createAutomation;
    const apiUpdateOne = isStep ? api.updateStep : api.updateAutomation;
    const unwrapRow = (r) => (r && (r.automation || r.step)) || r;
    const { state, send, hydrate, hydrateLastRun, setDraft, markServerConfirmed, acceptExternalDraft, dismissExternalDraft, executeStep, retryFromStep, stopRun, pollRunProgress, setRunResult, watchActiveRun, clearDryRun, settleRun } = useAutomationBuilderStream({ automationId });
    const [serverAutomation, setServerAutomation] = useState(null);
    // One in-app confirm for the whole builder — published through
    // BuilderConfirmContext so panels and hooks alike can ask a question
    // without falling back to the browser's own dialog.
    const { confirm, confirmDialog } = useConfirm();
    // Node Detail View (NDV) — the focused Input|Parameters|Output editor for
    // ONE step. `ndvStepId` is the step being edited (null = closed). Replaces
    // the old node-anchored peek + multi-pin dock.
    const [ndvStepId, setNdvStepId] = useState(null);
    // How much of the step to show: a single click opens the SMALL editor
    // (just the settings the step needs), a double click the full
    // Input|Parameters|Output workspace.
    //
    // The GESTURE decides, every time — an earlier version remembered the last
    // choice, which meant that once you had expanded anything, single and
    // double click did the same thing. Inside an open dialog the ⤢ / simple
    // buttons still switch freely.
    const [ndvDensity, setNdvDensity] = useState('quick');
    // How much of the step's FORM exists (Simple / All options) — the user's
    // persisted choice, orthogonal to the gesture-owned density above.
    const { mode: ndvMode, setMode: setNdvMode } = useFormModePreference();
    const openNdv = useCallback((id, density) => {
        if (!id) return;
        setNdvStepId(id);
        setNdvDensity(densityForOpen(density));
    }, []);
    const closeNdv = useCallback(() => setNdvStepId(null), []);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [hasHydrated, setHasHydrated] = useState(false);

    // Executing a step does NOT open its editor. Hitting ▶ on the canvas is a
    // question about DATA — "how much came out, and what goes to the next
    // node" — and the answer now lands on the connection itself (see
    // flow/dataSummary.js + the chip in flow/edges.jsx). Covering the canvas
    // with a settings dialog buried exactly the thing being asked for. The
    // Execute buttons inside the editor still work; it is already open there.
    const handleExecuteStep = useCallback((stepId, opts) => executeStep(stepId, opts), [executeStep]);

    // Tab navigation. Default to Build — the chat + diagram is what users
    // open the builder to do; the other tabs are jump-points for specific
    // tasks (settings, history, raw JSON).
    const [tab, setTab] = useState(initialTab || 'build');

    // Adopt a CHANGED initialTab (browser Back/Forward moving ?view=). The
    // guard ignores null on purpose: a cleared prop (URL back to the default
    // Editor view elsewhere in the tree) must never yank the user off Runs.
    const lastInitialTabRef = useRef(initialTab);
    useEffect(() => {
        if (initialTab !== lastInitialTabRef.current) {
            lastInitialTabRef.current = initialTab;
            if (initialTab) setTab(initialTab);
        }
    }, [initialTab]);

    // ── URL reporter (?view/run/step) ───────────────────────────────────
    // The shell owns the VIEW word; the runs panel reports the open run and
    // selected step through reportBuilderState. Pure navigation — no save
    // side effects (the PUT count is a test contract).
    const TAB_TO_VIEW = { build: 'build', settings: 'settings', history: 'runs', versions: 'versions' };
    const tabForUrlRef = useRef(tab);
    tabForUrlRef.current = tab;
    const runUrlStateRef = useRef({ runId: initialRunId || null, stepId: initialRunStepId || null });
    const reportBuilderState = useCallback((patch = {}, opts = {}) => {
        if ('runId' in patch || 'stepId' in patch) {
            runUrlStateRef.current = {
                runId: 'runId' in patch ? (patch.runId || null) : runUrlStateRef.current.runId,
                stepId: 'stepId' in patch ? (patch.stepId || null) : runUrlStateRef.current.stepId,
            };
        }
        onBuilderStateChange?.({
            view: TAB_TO_VIEW[tabForUrlRef.current] || null,
            runId: runUrlStateRef.current.runId,
            stepId: runUrlStateRef.current.stepId,
            replace: opts.replace !== false,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onBuilderStateChange]);
    const prevTabRef = useRef(tab);
    useEffect(() => {
        if (prevTabRef.current === tab) return; // mount — the URL already says this
        prevTabRef.current = tab;
        // Leaving Runs drops the open run from the URL with the view change.
        if (tab !== 'history') reportBuilderState({ runId: null, stepId: null }, { replace: true });
        else reportBuilderState({}, { replace: true });
    }, [tab, reportBuilderState]);

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
    // taskType 'automation' (C27): the AI-step tier dropdown was fed the
    // direct-chat list, offering Flow/Swarm — tiers execAiStep silently
    // degrades to one plain chat call (and now refuses at run time).
    const { modelTiers, selectedTier, setSelectedTier } = useModelTierSelection({ storageKey: 'automationBuilderTier', taskType: 'automation' });

    // Re-seed when the parent passes a new example prompt — only when the
    // input is currently empty so we don't clobber what the user is typing.
    useEffect(() => {
        if (initialChatInput && !chatInput) setChatInput(initialChatInput);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialChatInput]);

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

    const messagesContainerRef = useRef(null);
    const messagesEndRef = useRef(null);
    useEffect(() => {
        if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }, [state.messages.length, state.running]);

    // Step mode seeds a block skeleton so a brand-new Step opens with its
    // input + output contract already on the canvas (there is no trigger
    // picker step for Steps).
    const blockSeed = useMemo(() => (isStep ? makeBlockSkeleton() : null), [isStep]);
    // `isBlankDefinition` rather than a truthiness check: a routine whose row
    // was poisoned with `{}` (see BFSF-318) would otherwise be adopted as a
    // real definition and defeat the seed, leaving the canvas unable to
    // produce a well-formed graph. Treating it as absent lets the normal seed
    // path win, and the next save writes a valid definition — so affected
    // routines self-heal on open.
    const effectiveDef = !isBlankDefinition(state.draft) ? state.draft
        : !isBlankDefinition(serverAutomation?.definition) ? serverAutomation.definition
        : blockSeed;

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

    // Run data lives only in memory; the snapshot deliberately excludes it
    // (step outputs can be 256 KB each and the server already stores them).
    // Restore the LAST run lazily so edge chips, real samples and the pin
    // button survive a refresh. hydrateLastRun never clobbers live rows.
    useEffect(() => {
        const aid = state.automationId || automationId;
        if (!aid || !hasHydrated) return;
        hydrateLastRun(aid);
    }, [state.automationId, automationId, hasHydrated, hydrateLastRun]);

    const allSteps = useMemo(() => {
        if (!scopedDef) return [];
        // definition.triggers[] (scoped multi-trigger slice — webhook/app_event
        // additional entry points) must resolve here too, or clicking a
        // secondary trigger node opens an empty inspector.
        return [scopedDef.trigger, ...(scopedDef.triggers || []), ...(scopedDef.steps || [])].filter(Boolean);
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
        // `watchActiveRun` may already have surfaced a 'running' progress stub
        // by the time the request throws, and nothing else will ever settle it:
        // no run record is coming. Left running, `liveRunInFlight` stays true
        // and every ▶ Execute button is disabled for the rest of the session —
        // one of the mechanisms behind BFSF-360 ("Execute does nothing").
        catch (e) { setError(e.message); settleRun(); }
        finally { stopWatch(); setBusy(false); }
    };

    // Live full-flow run from the editor (the "Run live" option in the Run
    // menu). Unlike Dry-run this performs every side-effect for real, so we
    // gate it behind a confirm. Results land in each node's Run tab via
    // setRunResult, exactly like the dry-run path.
    const onRunLive = async () => {
        const ok = await confirm({
            title: 'Run this routine for real?',
            description: 'Every step performs its action — sending messages, writing data, and anything else in the flow.',
            confirmLabel: 'Run it',
            destructive: true,
        });
        if (!ok) return;
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
        // Same as onDryRun: settle the live progress stub so a failed run-start
        // can't strand the builder in "running" forever (BFSF-360).
        catch (e) { setError(e.message); settleRun(); }
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
            // A null local draft means the user hasn't made any local edits yet
            // — that's NOT unsaved work, so don't warn (deepEqualDef(null,
            // baseline) would otherwise report a false "unsaved changes" on a
            // freshly-opened automation the user only viewed).
            if (!state.running && (state.draft == null || deepEqualDef(state.draft, baseline))) return;
            e.preventDefault();
            // Modern browsers ignore the custom string but require setting returnValue.
            e.returnValue = '';
            return '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [state.running, state.draft, state.lastServerDraft, serverAutomation]);

    /**
     * Adopt a definition the server has just persisted for a WHOLE-DOCUMENT
     * write: point the local draft at it AND move the "last confirmed by the
     * server" baseline to it.
     *
     * The two always belong together, and getting it half right is silent data
     * loss rather than an error: `markServerConfirmed` alone leaves `state.draft`
     * on the pre-write definition, and the next canvas edit is committed on top
     * of that stale draft — so the write that just succeeded is PUT away again
     * (this is exactly how a saved Settings tab lost its notificationSettings /
     * manualTriggerPayload the moment the user added a step). One helper so a
     * future fourth call site can't repeat it.
     *
     * NOT used by the debounced visual-save path: there the local draft is
     * already the newest thing there is (applyVisualDraft set it before the PUT
     * was even scheduled), and re-adopting the server's echo would revert edits
     * made while the request was in flight. That path confirms only.
     */
    const adoptPersistedDefinition = useCallback((def) => {
        if (!def) return;
        setDraft(def);
        markServerConfirmed(def);
    }, [setDraft, markServerConfirmed]);

    /**
     * @param {object} nextGraph      the edited SCOPED graph
     * @param {object|null} layerPatches  flowlets edited in the same pass, when
     *        the inspector was showing a step inside an expanded flowlet
     *        (see BuildTab's onSaveStepFlat / flow/inlineFlowlets.js)
     */
    const onSaveStep = async (nextGraph, layerPatches = null) => {
        // The inspector edits the SCOPED graph — wrap it back into the
        // whole document before persisting so the server always receives
        // a complete definition.
        let whole = setScopedGraph(effectiveDef, scopeKey, nextGraph);
        if (layerPatches && Object.keys(layerPatches).length) {
            whole = { ...whole, layers: { ...(whole.layers || {}), ...layerPatches } };
        }
        const nextDef = normalizeDefinitionShape(whole);
        // Record the inspector's edit as an undo/redo entry. It used to write
        // the draft straight through, so the edit never entered the history
        // stack — a Redo afterwards popped a `future` snapshot captured BEFORE
        // it and silently reverted the inspector's work.
        //
        // `commit` applies through applyVisualDraft, which also schedules its
        // own debounced PUT. We persist below — awaited, so the caller can
        // surface a save error, and via the /api/step router when mode='step',
        // which the visual-save path does not do — so that second write is
        // suppressed instead of duplicated. `commit` runs `apply` synchronously,
        // so the flag can't leak past this call.
        suppressVisualPersistRef.current = true;
        try { draftHistory.commit(nextDef); }
        finally { suppressVisualPersistRef.current = false; }
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
        adoptPersistedDefinition(persisted?.definition || nextDef);
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
            definition: normalizeDefinitionShape(
                defForCreate || state.draft || serverAutomation?.definition || (isStep ? makeBlockSkeleton() : null),
            ),
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
    // Set for the duration of ONE draftHistory.commit whose caller persists the
    // definition itself (onSaveStep). applyVisualDraft then updates the draft
    // but skips its debounced PUT — see the comment at that commit.
    const suppressVisualPersistRef = useRef(false);
    // Serialize saves so overlapping PUTs can't reorder: a stale (older) draft's
    // response arriving AFTER a newer one would otherwise overwrite the newer
    // definition on the server. If a save is in flight, stash only the LATEST
    // pending def and run it once the current PUT resolves (coalescing).
    const saveInFlightRef = useRef(false);
    const queuedSaveRef = useRef(undefined);
    const _doVisualSave = useCallback(async (nextDef) => {
        // Belt-and-braces with applyVisualDraft's guard — this is the last hop
        // before the wire, and a null here becomes a stored `{}` (BFSF-318).
        if (!nextDef) return;
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
    const performVisualSave = useCallback(async (nextDef) => {
        if (saveInFlightRef.current) { queuedSaveRef.current = nextDef; return; }
        saveInFlightRef.current = true;
        try {
            await _doVisualSave(nextDef);
        } finally {
            saveInFlightRef.current = false;
            if (queuedSaveRef.current !== undefined) {
                const q = queuedSaveRef.current;
                queuedSaveRef.current = undefined;
                performVisualSave(q); // drain the latest queued def
            }
        }
    }, [_doVisualSave]);

    // Holds the last draft that has a debounced save in flight but not yet
    // persisted, plus the current save fn — so the unmount effect (which has
    // stale [] closures) can FLUSH it instead of silently dropping the last
    // <500ms of edits when the user navigates away in-app.
    const pendingSaveRef = useRef({ def: null, perform: performVisualSave });
    pendingSaveRef.current.perform = performVisualSave;

    const applyVisualDraft = useCallback((nextDef) => {
        // Never apply/persist an absent definition. `forceSaveNow` and
        // `syncServerRow` already guard this; without the same guard here an
        // undo back to the pre-first-edit state pushed `definition: null` to
        // the server, which stored it as `{}` and wedged the builder
        // (BFSF-318).
        if (!nextDef) return;
        setDraft(nextDef);
        // History-only apply: the committing caller writes this same definition
        // to the server itself, so don't schedule a second (and, for Steps,
        // wrongly-routed) PUT for it.
        if (suppressVisualPersistRef.current) return;
        if (visualSaveTimer.current) clearTimeout(visualSaveTimer.current);
        setSavingState('saving');
        pendingSaveRef.current.def = nextDef;
        visualSaveTimer.current = setTimeout(() => {
            pendingSaveRef.current.def = null; // save is firing — nothing left pending
            performVisualSave(nextDef);
        }, 500);
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
        adoptPersistedDefinition(a.definition);
        draftHistory.reset();
        // A wholesale replacement may have removed the flowlet we were
        // looking at — exit to root rather than risk a dead scope.
        setScopeKey(null);
    }, [adoptPersistedDefinition, draftHistory]);

    /**
     * Force-flush any pending debounced save. Lets Cmd+S behave the way
     * users expect ("save it now") without waiting for the 500ms timer
     * to elapse. No-op when nothing is dirty.
     */
    const forceSaveNow = useCallback(() => {
        if (!visualSaveTimer.current) return;
        clearTimeout(visualSaveTimer.current);
        visualSaveTimer.current = null;
        pendingSaveRef.current.def = null; // flushing now — nothing left pending
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
        if (visualSaveTimer.current) {
            clearTimeout(visualSaveTimer.current);
            visualSaveTimer.current = null;
            // Flush the pending debounced save on unmount so an edit made in
            // the last 500ms before in-app navigation isn't silently lost.
            // Fire-and-forget: the component is going away, but the API call
            // still completes (and errors are already toasted inside).
            const { def, perform } = pendingSaveRef.current;
            if (def && typeof perform === 'function') { try { perform(def); } catch (_) { /* best-effort */ } }
        }
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
            if (persisted?.definition) {
                if (patch?.definition) {
                    // The patch REWROTE the definition (SettingsTab apply). The
                    // local draft has to move with it, or the next canvas edit
                    // is committed on top of the pre-Settings draft and PUTs the
                    // just-saved notificationSettings / manualTriggerPayload
                    // away again — silently, with no error anywhere.
                    adoptPersistedDefinition(persisted.definition);
                } else {
                    // Title/description-only PATCH (inline rename). Confirm the
                    // baseline but do NOT touch the draft: a visual edit whose
                    // debounced save hasn't fired yet is newer than the row we
                    // just read back, and adopting it would revert the canvas.
                    markServerConfirmed(persisted.definition);
                }
            }
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
    // references this flowlet — unless the flowlet is EMPTY, in which case
    // there is nothing to lose and the call sites go with it (BFSF-340).
    const scope = useMemo(() => {
        if (!scopeKey) return null;
        const layer = effectiveDef?.layers?.[scopeKey];
        if (!layer) return null;
        return {
            key: scopeKey,
            title: layer.title || scopeKey,
            refCount: countLayerRefs(effectiveDef, scopeKey),
            empty: isLayerEmpty(effectiveDef, scopeKey),
        };
    }, [scopeKey, effectiveDef]);

    const onExitScope = useCallback(() => setScopeKey(null), []);

    const onDeleteLayer = useCallback(async () => {
        if (!scopeKey || !effectiveDef?.layers?.[scopeKey]) return;
        const refs = countLayerRefs(effectiveDef, scopeKey);
        if (refs > 0) {
            if (!isLayerEmpty(effectiveDef, scopeKey)) return;
            const label = effectiveDef.layers[scopeKey].title || scopeKey;
            const ok = await confirm({
                title: `Delete the empty flowlet “${label}”?`,
                description: `Its ${refs} “Call flowlet” ${refs === 1 ? 'step' : 'steps'} on the canvas ${refs === 1 ? 'is' : 'are'} removed too; the steps around ${refs === 1 ? 'it' : 'them'} reconnect.`,
                confirmLabel: 'Delete',
                destructive: true,
            });
            if (!ok) return;
            onVisualEditRoot(deleteLayerAndCalls(effectiveDef, scopeKey));
            setScopeKey(null);
            return;
        }
        onVisualEditRoot(deleteLayerFromDefinition(effectiveDef, scopeKey));
        setScopeKey(null);
    }, [scopeKey, effectiveDef, onVisualEditRoot, confirm]);

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

    // Whether the Activate control is enabled. A DRAFT can be activated as soon
    // as it's structurally complete (a trigger + at least one step) — the server
    // /activate route finalises (isDraft:false) AND validates the definition, so
    // it's the real gate. This decouples going-live from a successful chat
    // `builder_finalize` turn (which can be interrupted, e.g. by a connector
    // gateway timeout, leaving an otherwise-complete workflow stuck in Draft).
    const canActivate = !isStep
        && !!effectiveDef?.trigger
        && Array.isArray(effectiveDef?.steps) && effectiveDef.steps.length > 0;

    // Header props bundled so the SAME header renders either at the shell level
    // (Settings / Run history / Version history) or inside BuildTab (the Editor
    // view, where it also hosts the add-step ribbon) — one unified top bar in
    // both cases. The view's id stays `build`; only its label reads "Editor".
    const headerProps = {
        title, triggerKind, isActive, isDraft, statusLabel, statusBadgeClass, canActivate,
        canDiagnose: isAppEventTrigger, busy, onBack, onActivate, onDeactivate,
        onDryRun, onRunLive, onDiagnose, onRename, mode,
        step: isStep ? serverAutomation : null, orgGroups, onPublishStep,
        onSetStepSharing, onSetStepExpose, onSetStepIcon, onSetStepCategory, scope, onExitScope,
        onDeleteLayer, diagnoseAnchorRef, savingState, tab, onTabChange: setTab,
        // Undo/redo act on the CANVAS draft — pressing them from Settings or
        // Runs used to mutate a definition the user could not see. Jump to
        // the Editor first, so the change lands in view.
        onUndo: () => { if (tab !== 'build') setTab('build'); draftHistory.undo(); },
        onRedo: () => { if (tab !== 'build') setTab('build'); draftHistory.redo(); },
        canUndo: draftHistory.canUndo, canRedo: draftHistory.canRedo,
    };

    return (
        <BuilderConfirmProvider value={confirm}>
        <div className="flex flex-col h-full min-h-0">
            {/* Every confirmation in the builder renders here, in the product's
                own chrome — `window.confirm` put the question in a browser box
                titled "localhost:5176 says". */}
            {confirmDialog}
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
                        // The persisted row — the webhook trigger's node panel
                        // needs its id to list/create webhook URLs (BFSF-320).
                        automation={serverAutomation}
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
                        ndvDensity={ndvDensity}
                        setNdvDensity={setNdvDensity}
                        ndvMode={ndvMode}
                        onNdvModeChange={setNdvMode}
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
                    />
                )}
                {/* Its own view rather than the last section of Settings —
                    it needs the room, and buried there nobody found it
                    (BFSF-344). */}
                {tab === 'versions' && (
                    <div className="h-full overflow-y-auto custom-scrollbar px-6 py-5">
                        <div className="max-w-3xl">
                            {serverAutomation?.id ? (
                                <VersionHistoryPanel automation={serverAutomation} onRestored={syncServerRow} />
                            ) : (
                                <div className="text-sm text-[var(--text-tertiary)]">
                                    Versions appear here once this routine has been saved for the first time.
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {/* Mounted HIDDEN rather than conditionally: a run open on the
                    canvas view would otherwise unmount and lose its scroll,
                    zoom and filters every time the user peeks at the Editor.
                    `active` gates fetching/streaming, so the hidden panel
                    costs nothing. */}
                <div className={tab === 'history' ? 'h-full' : 'hidden'}>
                    {aidForHistory ? (
                        <ExecutionsPanel
                            scope={isStep ? 'step' : 'automation'}
                            automationId={isStep ? undefined : aidForHistory}
                            stepId={isStep ? aidForHistory : undefined}
                            active={tab === 'history'}
                            initialRunId={initialRunId}
                            initialStepId={initialRunStepId}
                            onRunStateChange={reportBuilderState}
                            onOpenEditor={() => setTab('build')}
                        />
                    ) : (
                        // Never fire GET /api/automation/null/runs for a draft
                        // that has no server row yet.
                        tab === 'history' && (
                            <div className="h-full flex flex-col items-center justify-center gap-2 px-6 text-center">
                                <div className="text-sm text-[var(--text-primary)] font-medium">This routine hasn't run yet.</div>
                                <div className="text-xs text-[var(--text-secondary)]">Run a test to see what happens, step by step.</div>
                                <button
                                    type="button"
                                    onClick={() => { setTab('build'); onDryRun?.(); }}
                                    className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
                                >
                                    Run a test
                                </button>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
        </BuilderConfirmProvider>
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

// §WS5 — BuildTab body, extracted verbatim from BuilderShell.jsx. The shell
// keeps orchestration state; BuildTab is the build-tab UI (canvas, ribbon,
// chat column, inspector overlay). Its prop list is fully explicit.
import { Sparkles, Layers, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBuilderConfirm } from './BuilderConfirmContext';
import BuilderHeader from './BuilderHeader';
import BuilderPlanChecklist from './BuilderPlanChecklist';
import { AutomationSummary, AssistantWelcome, RunProgressBanner, MessageBubble } from './chat';
import DiagramPane, { applyAddNode } from './DiagramPane';
import FloatingValidationPill from './FloatingValidationPill';
import NodeDetailView from './NodeDetailView';
import Tabs from '../../../shared/Tabs';
import AddStepMenu from './flow/AddStepMenu';
import AddStepRibbon, { ribbonTabsForScope, RibbonSearch } from './flow/AddStepRibbon';
import { branchFromHandle, spliceStepIntoEdge } from './flow/branchEdges';
import {
    getScopedGraph, setScopedGraph, createLayerInDefinition,
    deleteLayerFromDefinition, deleteLayerAndCalls, isLayerEmpty, renameLayer, countLayerRefs,
    setLayerDescription, listLayers, layerKeysThatReach,
} from './flow/flowletScope';
import {
    composeInlineGraph, decomposeInlineGraph, shiftForExpansion, useExpandedFlowlets,
    flowToScopePosition, prefixAddedStep, parseInlineId, isInlineId,
} from './flow/inlineFlowlets';
import { seedPositions } from './flow/layout';
import { applyDeleteNodes, applyDuplicateNode } from './flow/nodeOps';
import { normalizeDefinitionShape, emptyGraph } from './flow/normalizeDefinition';
import { isRouteStep, routePorts } from './flow/routeModel';
import { itemForKey } from './flow/stepPalette';
import { recordStep, readUsage, readTransitions, topFrequentKeys, scoreSuggestions } from './flow/stepUsage';
import { defaultTriggerLabel } from './flow/triggerLabels';
import FlowletsPanel from './FlowletsPanel';
import { applyAutoMapToStep } from './mapping/autoMapInputs';
import { buildRealOutputMap } from './mapping/realOutputs';
import useAutomationApi from '../../../../hooks/useAutomationApi';
import { useTranslation } from '../../../../hooks/useTranslation';
import scopedStorage from '../../../../utils/scopedStorage';
import InputArea from '../../../InputArea';
import { toast } from '../../../shared/Toast';

/**
 * Best-effort guess of whether a step's output is a list — biases the
 * "Suggested next" recommendations (array → Loop / Filter / Aggregate).
 * Heuristic only: collection ops emit arrays; an integration action is
 * array-ish when its catalog outputSample is, or contains, an array.
 */
function stepOutputIsArray(step, catalog) {
    if (!step) return false;
    const kind = step.kind || step.type;
    if (kind === 'filter' || kind === 'limit' || kind === 'dedupe' || kind === 'aggregate') return true;
    if (kind === 'integration_action' && step.tool) {
        for (const a of (catalog?.apps || [])) {
            const act = (a.actions || []).find(x => x.name === step.tool);
            if (!act) continue;
            const s = act.outputSample;
            if (Array.isArray(s)) return true;
            if (s && typeof s === 'object') return Object.values(s).some(v => Array.isArray(v));
            return false;
        }
    }
    return false;
}

/**
 * Kinds that cannot live inside a loop's body, and what to tell the user.
 *
 * Each mirrors a rule the server already enforces (automation/validate.js): a
 * form page has no resumable address inside an iteration, a body has no trigger
 * of its own, and Return belongs to a flowlet. Refusing at the gesture beats
 * accepting the step and surfacing a red banner two edits later.
 */
const LOOP_BODY_REFUSALS = {
    trigger: 'A routine starts in one place. The loop already runs once per item — you can\'t start a new flow inside it.',
    form_page: 'Form steps can\'t run inside a loop: one page, one visitor, one answer. Put the form before or after the loop.',
    layer_output: 'Return hands data back from a flowlet. A loop keeps its results for the steps after it instead.',
};

/** Toast copy after an auto-map, noting when the step now iterates per item. */
function autoMapToastMessage(count, forEachEnabled) {
    const base = count
        ? `Auto-mapped ${count} input${count === 1 ? '' : 's'}`
        : 'Set up iteration';
    return forEachEnabled ? `${base} · runs once per item` : base;
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
export default function BuildTab({
    headerProps = null,
    mode = 'automation',
    assistantOpen, setAssistantOpen,
    chatWidth, onChatResizeStart,
    state, automation = null, rootDef, scopedDef, scopeKey, setScopeKey, onVisualEditRoot,
    chatInput, setChatInput, modelTiers, selectedTier, setSelectedTier, user,
    onSend, messagesContainerRef, messagesEndRef,
    ndvStepId, ndvDensity = 'full', setNdvDensity = null, openNdv, closeNdv, stepById, runStepById, onSaveStep,
    onVisualEdit,
    onExecuteStep, onRetryFromStep, onStopRun, pollRunProgress,
    fatalError, onDismissFatal,
    onDiagnose = null,
    acceptExternalDraft = null,
    dismissExternalDraft = null,
    onBuildLayer = null,
    onRefineLayer = null,
    layerAgentState = null,
}) {
    // Inside a flowlet the trigger is a layer_input — never app_event, so
    // Confirmations render in the product's own dialog (BuilderShell mounts
    // it), not in the browser's "localhost says" box.
    const confirmAction = useBuilderConfirm();
    // Diagnose naturally disappears while scoped.
    const isAppEventTrigger = scopedDef?.trigger?.kind === 'app_event';
    // Imperative handle to DiagramPane — we need getCenter() for the
    // click-to-add path (when the user clicks rather than drags an item),
    // and focusStep() for click-an-issue-to-jump-to-its-node below.
    const diagramRef = useRef(null);

    // Briefly rings the node a clicked validation issue is about, then
    // clears itself — see FloatingValidationPill's onFocusStep.
    const [highlightedStepId, setHighlightedStepId] = useState(null);
    const highlightTimerRef = useRef(null);
    const onFocusStep = useCallback((stepId) => {
        if (!stepId) return;
        openNdv?.(stepId);
        diagramRef.current?.focusStep?.(stepId);
        setHighlightedStepId(stepId);
        clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = setTimeout(() => setHighlightedStepId(null), 2000);
    }, [openNdv]);
    useEffect(() => () => clearTimeout(highlightTimerRef.current), []);

    // Tool catalog — fetched once so auto-mapping (and the palette) can see
    // tool input/output schemas. Same source the inspector uses.
    const builderApi = useAutomationApi();
    // The step catalog's labels/descriptions are translatable (routines.node.*);
    // stepPalette is a plain module, so the translator rides in on `scope`.
    const { t } = useTranslation();
    const [catalog, setCatalog] = useState(null);
    useEffect(() => {
        let alive = true;
        builderApi.getCatalog().then(c => { if (alive) setCatalog(c); }).catch(() => {});
        return () => { alive = false; };
    }, [builderApi]);

    // ── Expanded flowlets ───────────────────────────────────────────────────
    //
    // A `call_layer` node can be opened in place so the flowlet it runs is
    // drawn, and edited, inside the flow that uses it. `flatDef` is the canvas
    // graph with those flowlets folded in; `inlineSidecar` says what came from
    // where, and every edit is split back out by `onVisualEditFlat`.
    //
    // When nothing is expanded, `flatDef === scopedDef` and every path below is
    // exactly the one that existed before.
    const inlineFlowlets = useExpandedFlowlets(automation?.id || state.automationId, scopeKey);
    const { graph: flatDef, sidecar: inlineSidecar } = useMemo(
        () => composeInlineGraph(scopedDef, rootDef, inlineFlowlets.expanded, { scopeLayerKey: scopeKey }),
        [scopedDef, rootDef, inlineFlowlets.expanded, scopeKey],
    );
    const inlineShift = useMemo(() => shiftForExpansion(flatDef, inlineSidecar), [flatDef, inlineSidecar]);
    const onToggleInline = useCallback(
        (nodeId, layerKey) => inlineFlowlets.toggle(nodeId, layerKey, inlineSidecar),
        [inlineFlowlets, inlineSidecar],
    );
    // How many call sites each flowlet has — an expanded container says so,
    // because editing it changes every one of them. (A loop's body belongs to
    // one step and is never shared, so it has no key and no count.)
    const layerRefCounts = useMemo(() => {
        const out = {};
        for (const entry of inlineSidecar.values()) {
            if (entry.layerKey) out[entry.layerKey] = countLayerRefs(rootDef, entry.layerKey);
        }
        return out;
    }, [inlineSidecar, rootDef]);

    /**
     * "Edit on canvas", from a Loop's own editor: draw its body inside the node
     * and get out of the way. Expands rather than toggles — the user asked for
     * the canvas, and closing the panel onto an unchanged card would read as a
     * dead button.
     */
    const expandOnCanvas = useCallback((stepId) => {
        if (!stepId) return;
        if (!inlineFlowlets.expanded.has(stepId)) inlineFlowlets.toggle(stepId, null, inlineSidecar);
        closeNdv?.();
        diagramRef.current?.focusStep?.(stepId);
    }, [inlineFlowlets, inlineSidecar, closeNdv]);

    /**
     * The one write path for canvas edits. Splits the edited flat graph back
     * into this scope's graph plus one patch per expanded flowlet, and commits
     * the lot as a single whole-document update so it is one undo entry.
     */
    const onVisualEditFlat = useCallback((nextFlat) => {
        if (!inlineSidecar.size) { onVisualEdit?.(nextFlat); return; }
        const { graph, layerPatches } = decomposeInlineGraph(nextFlat, inlineSidecar);
        let root = setScopedGraph(rootDef, scopeKey, seedPositions(graph));
        if (Object.keys(layerPatches).length) {
            root = { ...root, layers: { ...(root.layers || {}), ...layerPatches } };
        }
        onVisualEditRoot?.(root);
    }, [inlineSidecar, onVisualEdit, onVisualEditRoot, rootDef, scopeKey]);

    // What each node ACTUALLY produced (pinned > last run, hygiene-filtered) —
    // the single map that makes auto-map, the pickers and the node editor see
    // real data instead of placeholders (mapping/realOutputs.js).
    const realOutputById = useMemo(
        () => buildRealOutputMap(scopedDef, state.steps),
        [scopedDef, state.steps],
    );

    // The "what this does" summary starts folded — a title + one-line preview —
    // so it doesn't eat canvas height. Click to expand to the full description.
    // Persisted so the user's choice sticks across reloads.
    // Active ribbon tab (Home/Apps/Reusable), persisted per-user. Rendered in
    // the BuilderHeader bar (tabsSlot) so it shares the row with the title; the
    // AddStepRibbon below then shows just the active tab's groups.
    const [ribbonTabRaw, setRibbonTab] = useState(() => scopedStorage.getItem('routinesRibbonTab') || 'home');
    useEffect(() => { scopedStorage.setItem('routinesRibbonTab', ribbonTabRaw); }, [ribbonTabRaw]);

    // Auto-map-on-connect preference (on by default), per-user — read on mount.
    // The toggle now lives on the Settings tab; switching tabs remounts BuildTab,
    // so a change there is picked up here on return.
    const [autoMapEnabled] = useState(
        () => scopedStorage.getItem('autoMapOnConnect') !== '0',
    );

    // Flowlets manager drawer (bottom-left button → docked right drawer).
    const [layersOpen, setLayersOpen] = useState(false);
    // Which flowlet's AI summary is currently generating (one at a time).
    const [summarizingKey, setSummarizingKey] = useState(null);
    // The main flow (root) gets its own summary flag.
    const [summarizingRoot, setSummarizingRoot] = useState(false);
    // AI flowlet summaries are opt-in and OFF by default — no LLM call ever
    // fires unless the user ticks this. Persisted per-user, mirrors the
    // auto-map-on-connect toggle.
    const [aiSummaryEnabled, setAiSummaryEnabled] = useState(
        () => scopedStorage.getItem('layerAiSummaries') === '1',
    );
    const toggleAiSummary = useCallback(() => {
        setAiSummaryEnabled(v => {
            const next = !v;
            scopedStorage.setItem('layerAiSummaries', next ? '1' : '0');
            return next;
        });
    }, []);

    // Palette state. `position` and `edgeSource` are populated only when
    // the panel was opened via React Flow's onConnectEnd (edge dragged
    // into empty space) — both null means "open from FAB or auto-open"
    // and the parent inserts at canvas centre with no source edge.
    const [palette, setPalette] = useState({ open: false, position: null, edgeSource: null });
    // Inside a flowlet there is always a layer_input trigger, so the mode
    // is 'step' whenever we're scoped.
    const paletteMode = scopedDef?.trigger ? 'step' : 'trigger';

    // Flowlet rows for the palette — always computed from the ROOT def
    // (flowlets live only at root). When scoped, hide any flowlet whose call
    // closure reaches the current one (including itself) so the user
    // can't wire a reference cycle from the palette.
    const paletteLayers = useMemo(() => {
        const all = listLayers(rootDef);
        if (!scopeKey) return all;
        const blocked = layerKeysThatReach(rootDef, scopeKey);
        return all.filter(l => !blocked.has(l.key));
    }, [rootDef, scopeKey]);

    // AI/human flowlet descriptions keyed by flowlet key, surfaced on call_layer
    // nodes via NodeRuntimeContext. Empty descriptions are omitted.
    const layerSummaries = useMemo(() => {
        const m = {};
        for (const [k, l] of Object.entries(rootDef?.layers || {})) {
            if (l?.description) m[k] = l.description;
        }
        return m;
    }, [rootDef]);

    // The "Add step" ribbon above the canvas is always visible (it shows
    // trigger choices when there's no trigger yet), so there's no auto-open
    // drawer anymore. The `palette` state below now only drives the small
    // anchored popover used for context-adds (edge-drop / add-after /
    // insert-on-edge), where a step must land at a specific spot.
    const closePalette = useCallback(() => {
        setPalette({ open: false, position: null, edgeSource: null, edgeTarget: null });
    }, []);

    const onRequestAddNodeFromEdge = useCallback(({ sourceId, position, sourceHandle }) => {
        // Clear any inspector overlay so the panel slot isn't already
        // occupied (both slide in from the right). `edgeSourceHandle` carries
        // the branch port (then/else/case) so the new step is wired to it.
        setPalette({ open: true, position, edgeSource: sourceId, edgeSourceHandle: sourceHandle || null });
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

    // Triggered by the "+" button ON an edge. Opens the palette with both
    // ends recorded so handleAddNode splices the picked step BETWEEN them
    // (source→new→target) and drops the original source→target edge.
    const onRequestInsertOnEdge = useCallback(({ sourceId, targetId, position, sourceHandle, label = null, caseName = null }) => {
        if (!sourceId || !targetId) return;
        // edgeLabel/edgeCaseName carry the clicked DEFINITION edge's identity
        // so the splice removes exactly that edge and re-stamps the branch on
        // source→new. The handle stays as fallback: without identity the old
        // pair-based splice dropped every parallel branch edge between the
        // same two nodes (B3) and lost the routing label.
        setPalette({
            open: true, position: position || null,
            edgeSource: sourceId, edgeTarget: targetId,
            edgeSourceHandle: sourceHandle || null,
            edgeLabel: label ?? null, edgeCaseName: caseName ?? null,
        });
    }, []);

    // ── Smart Add-step: per-user frequency + context-aware suggestions ────────
    // `usageTick` bumps after each add so the memos below re-read scopedStorage.
    const [usageTick, setUsageTick] = useState(0);
    const recordUsage = useCallback((payload, sourceStep) => {
        recordStep(payload, sourceStep || null);
        setUsageTick(t => t + 1);
    }, []);
    // The user's recency-weighted favourites, resolved to render-ready items.
    const frequentItems = useMemo(
        () => topFrequentKeys(readUsage(), 8)
            .map(k => itemForKey(k, { catalog, layers: paletteLayers }))
            .filter(Boolean),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [catalog, paletteLayers, usageTick],
    );
    // Context "Suggested next" for the edge-drop / node-"+" popover (it knows
    // the source step). Empty unless the popover is open.
    const suggestedItems = useMemo(() => {
        if (!palette.open) return [];
        const src = palette.edgeSource
            ? [scopedDef?.trigger, ...(scopedDef?.steps || [])].find(n => n?.id === palette.edgeSource)
            : null;
        const ranked = scoreSuggestions({
            sourceKind: src ? (src.kind || src.type) : null,
            sourceOutputIsArray: stepOutputIsArray(src, catalog),
            usage: readUsage(),
            transitions: readTransitions(),
            limit: 5,
        });
        const seen = new Set();
        return ranked
            .map(s => {
                const it = itemForKey(s.key, { catalog, layers: paletteLayers });
                return it ? { ...it, context: s.reason } : null;
            })
            .filter(it => it && !seen.has(it.key) && seen.add(it.key));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [palette.open, palette.edgeSource, scopedDef, catalog, paletteLayers, usageTick]);

    /**
     * The one insert path. Every add-a-step surface funnels through here with
     * an explicit target description, so positioning, edge-splicing, auto-map,
     * usage telemetry and the create-flowlet meta-action behave identically
     * whether the step came from the ribbon (click OR drag), the search box,
     * the node "+", the edge "+", or an edge dropped on empty canvas.
     *
     * opts: { position?, sourceId?, targetId?, sourceHandle?, label?, caseName? }
     *   - sourceId alone            → wire source→new (append after)
     *   - sourceId + targetId       → splice new INTO that connection
     *   - label/caseName            → which branch of the source it rides on
     */
    const addStepAt = useCallback((payload, opts = {}) => {
        if (!payload) return;
        // Fresh automations have no draft and no server snapshot yet —
        // the user is adding their first node. Seed a minimal skeleton
        // so applyAddNode has something to attach to. onVisualEdit will
        // setDraft regardless and the chat flow can save it later.
        // Shape-normalise, don't just null-check: a poisoned `{}` definition is
        // truthy and used to slip through here, and applyAddNode's trigger
        // branch would then emit a graph with no steps/edges (BFSF-318).
        const baseDef = normalizeDefinitionShape(flatDef) || emptyGraph();

        // Triggers are searchable and browsable now that a routine already has
        // one (BFSF-325). Five of the seven kinds can only be the ONE primary
        // trigger — the validator rejects them in `definition.triggers[]` — so
        // picking one replaces what is there. That is a destructive answer to a
        // search, and it asks first — then re-enters with the answer, because
        // the in-app dialog is a promise and this function is synchronous.
        if (payload.kind === 'trigger' && !payload.asSecondaryTrigger && !payload.__confirmedReplace && baseDef.trigger
            && (baseDef.trigger.kind || 'manual') !== payload.triggerKind) {
            const from = defaultTriggerLabel(baseDef.trigger.kind || 'manual');
            const to = defaultTriggerLabel(payload.triggerKind || 'manual');
            confirmAction({
                title: `Replace the ${from} trigger with ${to}?`,
                description: 'A routine can only have one trigger of these kinds, so the current one and its settings are replaced.',
                confirmLabel: 'Replace',
                destructive: true,
            }).then((ok) => { if (ok) addStepAt({ ...payload, __confirmedReplace: true }, opts); });
            return;
        }

        let position = opts.position || null;
        // Canvas coordinates, before any flowlet-scope conversion — the
        // create-flowlet branch below adds its call node to the SCOPE graph, so
        // it wants the position in that graph's space.
        const canvasPosition = position;
        // A trigger is never wired FROM something — applyAddNode replaces (or
        // appends to) the graph's entry points and adds no edge, so honouring
        // a drop target here would splice/auto-map whatever step happened to
        // be last in the array instead.
        const wirable = payload.kind !== 'trigger';
        const sourceId = (wirable && opts.sourceId) || null;
        const targetId = (wirable && opts.targetId) || null;
        const sourceHandle = (wirable && opts.sourceHandle) || null;

        // Which graph is this going into? The canvas says so explicitly when
        // the step was dropped inside an expanded flowlet; otherwise the thing
        // it is being wired to decides, since a connection never crosses a
        // flowlet boundary. Triggers always belong to the canvas's own graph.
        const scopePrefix = wirable
            ? (opts.scopePrefix ?? parseInlineId(sourceId || targetId || '').prefix)
            : '';
        // Not everything can live inside a loop. The validator says so after
        // the fact (`form_page.nested_forbidden`, and a body has no trigger and
        // no Return) — say it at the gesture instead, so the user finds out
        // when they drop the step rather than from a red banner two edits later.
        if (scopePrefix && inlineSidecar.get(scopePrefix)?.kind === 'loop') {
            const refusal = LOOP_BODY_REFUSALS[payload.kind];
            if (refusal) { toast.info(refusal); return; }
        }
        // A position that came from the canvas is in canvas coordinates; inside
        // a flowlet the graph has its own origin.
        if (scopePrefix && position) {
            position = flowToScopePosition(scopePrefix, position, flatDef, inlineSidecar, inlineShift);
        }

        // Record usage (frequency + source→step transition) for the smart
        // Add-step recommender before the normal add proceeds.
        recordUsage(payload, sourceId ? [baseDef.trigger, ...(baseDef.steps || [])].find(n => n?.id === sourceId) : null);

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

        // "Create flowlet" — a scope-spanning insert: register the new flowlet
        // on the WHOLE document, drop a call_layer step referencing it
        // into the CURRENT canvas (wired from edgeSource when set), commit
        // both in ONE history entry, then drill straight into the flowlet.
        if (payload.kind === 'create_layer') {
            const { definition: withLayer, layerKey } = createLayerInDefinition(rootDef, payload.title || 'New flowlet');
            const currentGraph = getScopedGraph(withLayer, scopeKey) || baseDef;
            const layerTitle = withLayer.layers[layerKey]?.title || 'New flowlet';
            const nextGraph = applyAddNode(
                currentGraph,
                { kind: 'call_layer', layerKey, label: layerTitle },
                // The call node joins the CANVAS's graph, not whichever flowlet
                // the pointer happened to be over.
                canvasPosition || position,
                scopePrefix ? null : sourceId,
                scopePrefix ? null : sourceHandle,
            );
            onVisualEditRoot?.(setScopedGraph(withLayer, scopeKey, nextGraph));
            setScopeKey?.(layerKey);
            return;
        }

        let next = applyAddNode(baseDef, payload, position, sourceId, sourceHandle);
        // Edge-insert: when we were asked to splice between two nodes, rewire
        // the freshly added step to sit on the original edge — identity-
        // matched, so ONLY the clicked edge is replaced and parallel branch
        // edges between the same pair survive (B3). The branch label rides on
        // source→new (the routing decision point); new→target leaves by the
        // inserted step's FIRST output — for a Filter that is `then`, and an
        // unlabelled edge there would never fire.
        if (sourceId && targetId && next.steps?.length) {
            const inserted = next.steps[next.steps.length - 1];
            const insertedId = inserted.id;
            const identity = (opts.label != null || opts.caseName != null)
                ? { label: opts.label, caseName: opts.caseName }
                : branchFromHandle(sourceHandle || null);
            // applyAddNode already appended source→new (stamped from the
            // handle) — drop it and let spliceStepIntoEdge emit the canonical
            // trio, which also covers labels the handle can't express
            // (e.g. on_error).
            const withoutAuto = (next.edges || []).filter(e => !(e.from === sourceId && e.to === insertedId));
            const firstPort = isRouteStep(inserted) ? routePorts(inserted)[0] : null;
            next = { ...next, edges: spliceStepIntoEdge(withoutAuto, insertedId, sourceId, targetId, identity, firstPort) };
        }
        // Auto-map the new step's inputs from its upstream source (only when
        // wired from a source node — a bare add has no upstream to map from).
        let finalDef = next;
        if (autoMapEnabled && sourceId && next.steps?.length) {
            const insertedId = next.steps[next.steps.length - 1].id;
            if (catalog) {
                const { definition: mappedDef, mappedKeys, forEachEnabled } = applyAutoMapToStep(next, insertedId, catalog, { realOutputById });
                finalDef = mappedDef;
                if (mappedKeys.length || forEachEnabled) {
                    toast.success(autoMapToastMessage(mappedKeys.length, forEachEnabled));
                }
            } else {
                // Catalog still loading (a step added within ~1s of page load).
                // This used to silently skip auto-map; queue the id and let the
                // drain effect below map it once the catalog lands — safe to
                // run late because auto-map never overwrites non-empty bindings.
                // Only for the canvas's own graph: the drain effect below works
                // off the scoped definition and knows nothing about prefixes.
                if (!scopePrefix) pendingAutoMapRef.current.push(insertedId);
            }
        }
        // Last: move the new step into the flowlet it was added to. Everything
        // above addressed it by its bare id (splice, auto-map), and the ids in
        // the bindings auto-map just wrote are flat ids that decompose turns
        // back into local ones.
        if (scopePrefix && finalDef.steps?.length) {
            finalDef = prefixAddedStep(finalDef, next.steps[next.steps.length - 1].id, scopePrefix);
        }
        onVisualEditFlat?.(finalDef);
     
    // itself after the replace-trigger confirm resolves; listing it would be
    // circular, and the identity it closes over is the same one on both passes.
    }, [flatDef, inlineSidecar, inlineShift, rootDef, scopeKey, setScopeKey, onVisualEditFlat, onVisualEditRoot, autoMapEnabled, catalog, realOutputById, recordUsage, confirmAction]);

    // Latest scoped definition + real-output map for the catalog drain effect —
    // by the time the catalog arrives, `scopedDef` from the add-time closure
    // is stale.
    const pendingAutoMapRef = useRef([]);
    const scopedDefRef = useRef(flatDef);
    const realOutputRef = useRef(realOutputById);
    useEffect(() => { scopedDefRef.current = flatDef; realOutputRef.current = realOutputById; });
    useEffect(() => {
        if (!catalog || !pendingAutoMapRef.current.length) return;
        const ids = pendingAutoMapRef.current.splice(0);
        let def = scopedDefRef.current;
        if (!def) return;
        let mappedAny = false, keysTotal = 0, anyForEach = false;
        for (const id of ids) {
            const r = applyAutoMapToStep(def, id, catalog, { realOutputById: realOutputRef.current });
            if (r.mappedKeys.length || r.forEachEnabled) {
                def = r.definition;
                mappedAny = true;
                keysTotal += r.mappedKeys.length;
                anyForEach = anyForEach || !!r.forEachEnabled;
            }
        }
        if (mappedAny) {
            onVisualEditFlat?.(def);
            toast.success(autoMapToastMessage(keysTotal, anyForEach));
        }
    }, [catalog, onVisualEditFlat]);

    // The context popover's pick handler: run the insert with whatever target
    // that popover was opened for, then manage its own open/closed state.
    // Keep the panel open so the user can add multiple nodes in a row without
    // re-opening it; a wired insert is a single-shot action and closes.
    const handleAddNode = useCallback((payload) => {
        if (!payload) return;
        addStepAt(payload, {
            position: palette.position,
            sourceId: palette.edgeSource,
            targetId: palette.edgeTarget,
            sourceHandle: palette.edgeSourceHandle || null,
            label: palette.edgeLabel ?? null,
            caseName: palette.edgeCaseName ?? null,
        });
        if (palette.edgeSource || payload.kind === 'create_layer') closePalette();
        else setPalette(p => ({ ...p, position: null, edgeSource: null, edgeTarget: null, edgeLabel: null, edgeCaseName: null }));
    }, [addStepAt, palette.position, palette.edgeSource, palette.edgeTarget, palette.edgeSourceHandle, palette.edgeLabel, palette.edgeCaseName, closePalette]);

    // A step dragged onto the canvas from the ribbon / add-step menu. The
    // canvas already resolved WHERE it landed (a connection → splice, a node →
    // append after it, empty canvas → unconnected).
    const handleDropStep = useCallback((payload, target = {}) => {
        addStepAt(payload, target);
    }, [addStepAt]);

    // Node delete / duplicate for the DETAIL VIEW's header buttons (BFSF-319).
    // The canvas's own surfaces (Delete key, hover chrome, right-click menu) go
    // through DiagramPane's copies of these; both call the same pure transforms
    // and write through the same `onVisualEdit`, so the result is identical
    // whichever surface the user reaches for.
    const onDeleteStep = useCallback((stepId) => {
        if (!flatDef || state.running || !stepId) return;
        const next = applyDeleteNodes(flatDef, stepId);
        if (next === flatDef) return; // primary trigger / unknown id
        onVisualEditFlat?.(next);
    }, [flatDef, state.running, onVisualEditFlat]);

    const onDuplicateStep = useCallback((stepId) => {
        if (!flatDef || state.running || !stepId) return;
        const { definition: next, newStepId } = applyDuplicateNode(flatDef, stepId);
        if (!newStepId) return; // triggers aren't duplicable
        // The copy of a step inside an expanded flowlet belongs to that
        // flowlet, not to the flow around it.
        const { prefix } = parseInlineId(stepId);
        onVisualEditFlat?.(prefix ? prefixAddedStep(next, newStepId, prefix) : next);
    }, [flatDef, state.running, onVisualEditFlat]);

    // Clicking a node pins/unpins its panels — close the palette first so a
    // pin doesn't appear behind it. Panels are node-anchored (not on the right
    // edge), so once pinned they coexist fine with the palette.
    // Clicking a node opens its focused Node Detail View (NDV).
    const onNodeClickWrapped = useCallback((id) => {
        if (palette.open) closePalette();
        openNdv?.(id);
    }, [palette.open, closePalette, openNdv]);

    // Double-click means "show me everything about this step". No click timer
    // is needed: the single click already opened the small editor, and this
    // just grows it in place.
    const onNodeExpand = useCallback((id) => {
        if (palette.open) closePalette();
        openNdv?.(id, 'full');
    }, [palette.open, closePalette, openNdv]);

    // The step currently open in the NDV (null = closed). A node inside an
    // expanded flowlet only exists in the flat graph, so it is looked up there.
    const ndvStep = ndvStepId
        ? (isInlineId(ndvStepId)
            ? ((flatDef?.steps || []).find(s => s.id === ndvStepId) || null)
            : stepById(ndvStepId))
        : null;
    // Sub-step run rows are namespaced `<callStepId>/<subStepId>` — the same id
    // the inline node carries — so an expanded flowlet's steps show their own
    // run data instead of the call step's.
    const ndvRunStep = useCallback((id) => (isInlineId(id)
        ? ((state.steps || []).find(s => s.stepId === id) || null)
        : runStepById(id)), [state.steps, runStepById]);

    /**
     * The inspector saves the whole graph it was handed. When that graph has
     * flowlets folded into it, split them back out first — otherwise a step
     * with a prefixed id would be persisted into the parent flow.
     */
    const onSaveStepFlat = useCallback((nextFlat) => {
        if (!inlineSidecar.size) return onSaveStep(nextFlat);
        const { graph, layerPatches } = decomposeInlineGraph(nextFlat, inlineSidecar);
        return onSaveStep(graph, layerPatches);
    }, [inlineSidecar, onSaveStep]);

    // ── Flowlets manager wiring ─────────────────────────────────────────────
    // All edits go through onVisualEditRoot (whole-document commit) so they
    // share the builder's undo/autosave path. Reuses the same pure helpers
    // the palette + header already use. The popover is bottom-left, so it
    // doesn't conflict with the right-edge palette/inspector.
    const refCountFor = useCallback((key) => countLayerRefs(rootDef, key), [rootDef]);

    const handleCreateLayer = useCallback(() => {
        const { definition: withLayer, layerKey } = createLayerInDefinition(rootDef, 'New flowlet');
        onVisualEditRoot?.(withLayer);
        // Drill straight into the fresh flowlet so the user can start building.
        // (Unlike the palette's "Create flowlet", this does NOT drop a
        // call_layer node — the manager creates the reusable flowlet itself;
        // the user wires a call where they want it via the palette.)
        setScopeKey?.(layerKey);
    }, [rootDef, onVisualEditRoot, setScopeKey]);

    const handleRenameLayer = useCallback((key, title) => {
        onVisualEditRoot?.(renameLayer(rootDef, key, title));
    }, [rootDef, onVisualEditRoot]);

    const handleDeleteLayer = useCallback(async (key) => {
        const refs = countLayerRefs(rootDef, key);
        // A flowlet with steps in it and callers on the canvas stays protected —
        // deleting it would silently break those flows. An EMPTY one is a
        // different story: the palette's "Create flowlet" drops a call node as
        // part of creating it, so a brand-new flowlet was born un-deletable
        // (BFSF-340). Nothing is lost, so the call sites go with it.
        if (refs > 0) {
            if (!isLayerEmpty(rootDef, key)) return;
            const label = rootDef?.layers?.[key]?.title || key;
            const ok = await confirmAction({
                title: `Delete the empty flowlet “${label}”?`,
                description: `Its ${refs} “Call flowlet” ${refs === 1 ? 'step' : 'steps'} on the canvas ${refs === 1 ? 'is' : 'are'} removed too; the steps around ${refs === 1 ? 'it' : 'them'} reconnect.`,
                confirmLabel: 'Delete',
                destructive: true,
            });
            if (!ok) return;
            onVisualEditRoot?.(deleteLayerAndCalls(rootDef, key));
            if (scopeKey === key) setScopeKey?.(null);
            return;
        }
        onVisualEditRoot?.(deleteLayerFromDefinition(rootDef, key));
        if (scopeKey === key) setScopeKey?.(null);
    }, [rootDef, onVisualEditRoot, scopeKey, setScopeKey, confirmAction]);

    const handleSummarizeLayer = useCallback(async (key) => {
        const layer = rootDef?.layers?.[key];
        if (!layer) return;
        setSummarizingKey(key);
        try {
            const r = await builderApi.summariseLayer(layer);
            const summary = (r?.summary || '').trim();
            if (summary) onVisualEditRoot?.(setLayerDescription(rootDef, key, summary));
            else toast.error('No summary was generated — try again.');
        } catch (e) {
            toast.error(`Could not summarise flowlet. ${e.message || ''}`.trim());
        } finally {
            setSummarizingKey(null);
        }
    }, [rootDef, builderApi, onVisualEditRoot]);

    // AI summary of the WHOLE automation (the main/root flow). The summarise
    // endpoint takes any flow shape, so we pass the root definition and store
    // the one-liner on definition.description (mirrors flowlet descriptions).
    const handleSummarizeRoot = useCallback(async () => {
        if (!rootDef?.trigger) return;
        setSummarizingRoot(true);
        try {
            const flow = { ...rootDef, steps: Array.isArray(rootDef.steps) ? rootDef.steps : [] };
            const r = await builderApi.summariseLayer(flow);
            const summary = (r?.summary || '').trim();
            if (summary) onVisualEditRoot?.({ ...rootDef, description: summary });
            else toast.error('No summary was generated — try again.');
        } catch (e) {
            toast.error(`Could not summarise the main flow. ${e.message || ''}`.trim());
        } finally {
            setSummarizingRoot(false);
        }
    }, [rootDef, builderApi, onVisualEditRoot]);

    // The assistant is summonable: shown only when opened, and never in step
    // mode (v1 Steps are built visually — no AI chat).
    const showChat = assistantOpen && mode !== 'step';

    // Which graph the positioned palette is adding to: a "+" on a node or an
    // edge inside an expanded flowlet is adding to THAT flowlet, so it gets the
    // in-flowlet catalogue (no triggers, nothing that pauses the run).
    const palettePrefix = parseInlineId(palette.edgeSource || palette.edgeTarget || '').prefix;
    const paletteInLayer = !!scopeKey || !!palettePrefix;
    const paletteCanAddLayerOutput = paletteInLayer && !(flatDef?.steps || []).some(
        s => s?.type === 'layer_output' && parseInlineId(s.id).prefix === palettePrefix,
    );

    // The scope shared by the ribbon + its tab strip (rendered up in the header).
    // The ribbon is a browse surface with no target yet, so it stays on the
    // canvas's own scope; the positioned palette below narrows further.
    const paletteScope = {
        catalog,
        layers: paletteLayers,
        inLayer: !!scopeKey,
        canAddLayerOutput: !!scopeKey && !(scopedDef?.steps || []).some(s => s?.type === 'layer_output'),
        isBlockRoot: mode === 'step',
        mode: paletteMode,
        frequent: frequentItems,
        // The form steps ride on the routine's own public form URL, so the
        // validator rejects them outright without a form trigger. Same test it
        // applies (`form_page.no_form_trigger`): the primary trigger or any
        // secondary one.
        hasFormTrigger: [scopedDef?.trigger, ...(scopedDef?.triggers || [])].some(tr => tr?.kind === 'form'),
        t,
    };
    const ribbonTabItems = ribbonTabsForScope(paletteScope);
    const ribbonTab = ribbonTabItems.some(t => t.id === ribbonTabRaw) ? ribbonTabRaw : 'home';

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Command bar: back · Build▾ · ribbon tabs · title · run · assistant
                — one Word-style row (tabs left, title to their right). */}
            {headerProps && (
                <BuilderHeader
                    {...headerProps}
                    flush
                    tabsSlot={(
                        <div className="flex items-center gap-2 min-w-0">
                            <Tabs
                                size="sm"
                                ariaLabel="Add-step categories"
                                items={ribbonTabItems}
                                value={ribbonTab}
                                onChange={setRibbonTab}
                            />
                            <RibbonSearch scope={paletteScope} onAdd={handleAddNode} disabled={state.running} />
                        </div>
                    )}
                    infoSlot={(
                        <AutomationSummary
                            label={(scopeKey && rootDef?.layers?.[scopeKey]) ? 'What this flowlet does' : 'What this automation does'}
                            text={(scopeKey && rootDef?.layers?.[scopeKey])
                                ? (rootDef.layers[scopeKey].description || '')
                                : (state.summary || rootDef?.description || '')}
                        />
                    )}
                />
            )}
            {/* Office-style "Add step" ribbon — the active tab's category groups,
                with undo/redo at the start and Search/auto-map at the end. */}
            <AddStepRibbon
                embedded
                activeTab={ribbonTab}
                scope={paletteScope}
                hasTrigger={!!scopedDef?.trigger}
                disabled={state.running}
                onAddNode={handleAddNode}
                frequentItems={frequentItems}
                onUndo={headerProps?.onUndo}
                onRedo={headerProps?.onRedo}
                canUndo={headerProps?.canUndo}
                canRedo={headerProps?.canRedo}
            />
            <div className="flex flex-1 min-h-0">
            {/* Chat column — collapses entirely in Focus mode. The expand
                handle lives at the top of the diagram column when collapsed. */}
            {showChat && (
                <div
                    style={{ width: chatWidth }}
                    className="flex flex-col bg-[var(--bg-secondary)] border-r border-[var(--border-default)] flex-shrink-0 min-w-[240px] max-w-[600px]"
                    data-surface="subtle"
                >
                    <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-[var(--border-default)]">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="w-7 h-7 rounded-lg bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center flex-shrink-0">
                                <Sparkles size={14} />
                            </span>
                            <span className="text-sm font-semibold text-[var(--text-primary)] truncate">Assistant</span>
                        </div>
                        <button
                            onClick={() => setAssistantOpen(false)}
                            title="Close the assistant"
                            aria-label="Close the assistant"
                            className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                        >
                            <X size={15} />
                        </button>
                    </div>
                    <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar">
                        {state.messages.length === 0 && (
                            <AssistantWelcome
                                triggerKind={scopedDef?.trigger?.kind}
                                onPick={(text) => setChatInput(text)}
                            />
                        )}
                        <div className="flex flex-col gap-4 w-full max-w-[900px] mx-auto">
                            {Array.isArray(state.todos) && state.todos.length > 0 && (
                                <div className="sticky top-0 z-10 -mx-1 px-1 pb-2 bg-[var(--bg-secondary)]/95 backdrop-blur-sm">
                                    <BuilderPlanChecklist todos={state.todos} running={state.running} />
                                </div>
                            )}
                            {state.messages.map((m, i) => <MessageBubble key={i} msg={m} />)}
                            {(() => {
                                // Only show the bare "Thinking…" placeholder before
                                // anything has streamed in. Once reasoning, text or a
                                // tool call lands on the in-flight assistant message,
                                // those render the live state instead.
                                if (!state.running) return null;
                                const last = state.messages[state.messages.length - 1];
                                const started = last && last.role === 'assistant'
                                    && ((last.content && last.content.length)
                                        || (last.thinkingParts && last.thinkingParts.length)
                                        || (last.toolCalls && last.toolCalls.length));
                                if (started) return null;
                                return (
                                    <div className="self-start text-xs italic text-[var(--text-tertiary)] px-1">
                                        Thinking…
                                    </div>
                                );
                            })()}
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

            {showChat && (
                <div
                    onMouseDown={onChatResizeStart}
                    className="w-1 flex-shrink-0 cursor-col-resize hover:bg-[var(--accent)]/40 active:bg-[var(--accent)]/60 transition-colors z-10"
                />
            )}

            {/* Diagram column — fills remaining width and (most of) the height.
                The summary sits on top so it doesn't compete with the canvas
                for vertical space. */}
            <div className="flex-1 min-w-0 flex flex-col relative bg-[var(--bg-primary)]">
                {/* Summon launcher: when the assistant is closed, a slim rail on
                    the canvas's left edge re-opens it (pulses while building). */}
                {!showChat && mode !== 'step' && (
                    <button
                        onClick={() => setAssistantOpen(true)}
                        title="Open the AI assistant"
                        aria-label="Open the AI assistant"
                        className={`absolute left-0 top-1/2 -translate-y-1/2 z-20 flex items-center px-1.5 py-3 rounded-r-lg bg-[var(--accent)]/15 text-[var(--accent)] ring-1 ring-[var(--accent)]/40 hover:bg-[var(--accent)]/25 shadow-sm transition ${state.running ? 'animate-pulse' : ''}`}
                    >
                        <Sparkles size={16} />
                    </button>
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
                {/* The add-step ribbon now lives embedded in the BuilderHeader
                    bar above (one unified toolbar); the canvas takes this row. */}
                <div className="flex-1 min-h-0 flex relative">
                    {/* Canvas + its canvas-anchored overlays live in a relative
                        wrapper so the pinned dock (right sibling) shrinks the
                        canvas instead of being overlapped by the FAB/pill. The
                        full-height right drawers (palette/flowlets) sit OUTSIDE
                        this wrapper, anchored to the row, so they hide off the
                        true screen edge. */}
                    <div className="relative flex-1 min-w-0">
                    <DiagramPane
                        // Remount per scope: fitView re-runs on the new graph
                        // and the drag-mirror state can't leak across scopes.
                        key={scopeKey || 'root'}
                        ref={diagramRef}
                        definition={flatDef}
                        runSteps={state.steps}
                        onNodeClick={onNodeClickWrapped}
                        onNodeExpand={onNodeExpand}
                        validation={state.validation}
                        editable
                        structuralEditsBlocked={state.running}
                        onDefinitionChange={onVisualEditFlat}
                        onStepAdded={recordUsage}
                        onRequestAddNode={onRequestAddNodeFromEdge}
                        // The empty canvas's "Choose a trigger" button. With no
                        // trigger yet `paletteMode` is already 'trigger', so the
                        // picker opens on the seven trigger kinds.
                        onRequestOpenPalette={() => setPalette({ open: true, position: null, edgeSource: null })}
                        onRequestAddAfter={onRequestAddAfter}
                        onRequestInsertOnEdge={onRequestInsertOnEdge}
                        onDropStep={handleDropStep}
                        onExecuteStep={onExecuteStep}
                        executingStepId={state.executingStepId}
                        runInFlight={liveRunInFlight}
                        onDiagnose={isAppEventTrigger ? onDiagnose : null}
                        catalog={catalog}
                        realOutputById={realOutputById}
                        autoMapEnabled={autoMapEnabled}
                        onAutoMapped={(_id, count, forEachEnabled) => {
                            if (count || forEachEnabled) toast.success(autoMapToastMessage(count, forEachEnabled));
                        }}
                        onOpenLayer={(k) => setScopeKey?.(k)}
                        layerSummaries={layerSummaries}
                        highlightedStepId={highlightedStepId}
                        sidecar={inlineSidecar}
                        shiftById={inlineShift}
                        onToggleInline={onToggleInline}
                        layerRefCounts={layerRefCounts}
                    />
                {liveRunInFlight && (
                    <RunProgressBanner
                        run={state.dryRun}
                        steps={state.steps}
                        onStop={() => state.dryRun?.id && onStopRun?.(state.dryRun.id)}
                    />
                )}
                {/* Run results no longer float in a bottom drawer — each step's
                    output lands in its own node's Run tab (open a node to see it). */}
                <FloatingValidationPill
                    fatalError={fatalError}
                    validation={state.validation}
                    aborted={state.aborted}
                    onDismissFatal={onDismissFatal}
                    def={scopedDef}
                    onFocusStep={onFocusStep}
                />
                {scopedDef?.trigger && (
                    <button
                        type="button"
                        data-layers-toggle
                        onClick={() => setLayersOpen(o => !o)}
                        title="Flowlets — manage reusable sub-flows"
                        className={`absolute bottom-4 left-14 z-20 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border shadow-sm text-xs font-medium transition ${
                            layersOpen
                                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-default)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                    >
                        <Layers size={14} /> Flowlets
                        {Object.keys(rootDef?.layers || {}).length > 0 && (
                            <span className={`text-[10px] leading-none px-1 py-0.5 rounded-full ${layersOpen ? 'bg-white/20' : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'}`}>
                                {Object.keys(rootDef.layers).length}
                            </span>
                        )}
                    </button>
                )}
                {/* Context-add popover: wiring a step from an edge drop / node
                    "+" / edge "+" must land it at a specific spot. The ribbon
                    handles browse/add-anywhere; this small picker handles the
                    positioned case. The new node lands at palette.position. */}
                {palette.open && (
                    <>
                        <div className="absolute inset-0 z-30" onMouseDown={closePalette} />
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 w-[360px] max-h-[70vh] flex flex-col rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-2xl overflow-hidden">
                            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-default)]">
                                <span className="text-sm font-semibold text-[var(--text-primary)]">Add a step here</span>
                                <button type="button" onClick={closePalette} aria-label="Close" className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"><X size={14} /></button>
                            </div>
                            <AddStepMenu
                                scope={{
                                    catalog,
                                    layers: paletteLayers,
                                    inLayer: paletteInLayer,
                                    canAddLayerOutput: paletteCanAddLayerOutput,
                                    isBlockRoot: mode === 'step',
                                    mode: paletteMode,
                                    suggested: suggestedItems,
                                    frequent: frequentItems,
                                }}
                                showSearch
                                autoFocus
                                onAdd={handleAddNode}
                                onAfterAdd={closePalette}
                            />
                        </div>
                    </>
                )}
                    </div>
                    {/* The step options inspector now renders ANCHORED to the
                        selected node (see DiagramPane's NodeToolbar) instead of a
                        fixed right-side drawer. */}
                    {layersOpen && (
                        <FlowletsPanel
                            onClose={() => setLayersOpen(false)}
                            rootDef={rootDef}
                            currentScopeKey={scopeKey}
                            onOpenLayer={(k) => setScopeKey?.(k)}
                            onRenameLayer={handleRenameLayer}
                            onDeleteLayer={handleDeleteLayer}
                            refCountFor={refCountFor}
                            onCreateLayer={handleCreateLayer}
                            aiEnabled={aiSummaryEnabled}
                            onToggleAi={toggleAiSummary}
                            onSummarize={handleSummarizeLayer}
                            summarizingKey={summarizingKey}
                            rootDescription={rootDef?.description || ''}
                            onSummarizeRoot={handleSummarizeRoot}
                            summarizingRoot={summarizingRoot}
                            onBuildLayer={onBuildLayer}
                            onRefineLayer={onRefineLayer}
                            layerAgentState={layerAgentState}
                        />
                    )}
                </div>
            </div>
            </div>
            {ndvStep && (
                <NodeDetailView
                    key={ndvStep.id}
                    density={ndvDensity}
                    onDensityChange={setNdvDensity}
                    step={ndvStep}
                    runStep={ndvRunStep(ndvStep.id)}
                    runSteps={state.steps}
                    realOutputById={realOutputById}
                    catalog={catalog}
                    definition={flatDef}
                    rootDefinition={rootDef}
                    automation={automation}
                    blocksCatalog={catalog?.steps || []}
                    onSaveStep={onSaveStepFlat}
                    validation={state.validation}
                    modelTiers={modelTiers}
                    onExecuteStep={onExecuteStep}
                    onRetryFromStep={onRetryFromStep}
                    runInFlight={liveRunInFlight}
                    executingStep={state.executingStepId === ndvStep.id}
                    onDeleteStep={onDeleteStep}
                    onDuplicateStep={onDuplicateStep}
                    // Page to another node without a round trip through the
                    // canvas (BFSF-332). The `key` above remounts the panel,
                    // which is what flushes any in-flight autosave.
                    onNavigate={(id) => openNdv(id, ndvDensity)}
                    onExpandOnCanvas={expandOnCanvas}
                    onClose={closeNdv}
                />
            )}
        </div>
    );
}

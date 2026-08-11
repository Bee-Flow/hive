import { createContext, useContext } from 'react';

/**
 * Per-node runtime state surfaced to every step-node via context so we
 * don't have to thread these props through 17 per-type node components.
 *
 * Provided by DiagramPane based on the current definition + run state:
 *   - pinnedById      : Set<stepId> — which nodes have pinnedOutput set
 *   - disabledById    : Set<stepId> — which nodes are user-disabled
 *   - onExecuteStep   : (stepId) => void — fires the partial-run endpoint
 *   - executingStepId : stepId|null — node currently mid-partial-execute
 *   - runInFlight     : boolean — a global dry/full run is going
 *   - runIndexById    : Map<stepId, number> — 1-based completion ordinal
 *   - runTotal        : number|null — total dispatched steps in run
 *   - onOpenLayer     : (layerKey) => void — drill into an inline flowlet
 *   - layerSummaries  : Record<layerKey, string> — AI/human one-liners,
 *                       so a call_layer node can show what the flowlet does
 *   - highlightedStepId : stepId|null — briefly ringed (e.g. after the user
 *                       clicks a validation issue to jump to its node)
 *   - onDetachNode    : (stepId) => void — unwire a step but keep it on canvas
 *   - attachedIds     : Set<stepId> — nodes touched by at least one edge, so
 *                       the Disconnect affordance is hidden on loose cards
 *   - onToggleInline  : (nodeId, layerKey) => void — expand/collapse a
 *                       call_layer node's flowlet in place on this canvas
 *   - inlineExpanded  : Set<nodeId> — which call_layer nodes are expanded
 *   - layerRefCounts  : Record<layerKey, number> — how many call sites a
 *                       flowlet has, so an expanded container can warn that
 *                       editing it changes every one of them
 *
 * Defaults give read-only inspector contexts (executions drawer) sane
 * behaviour without provider wiring.
 */
export const NodeRuntimeContext = createContext({
    pinnedById: new Set(),
    disabledById: new Set(),
    onExecuteStep: null,
    executingStepId: null,
    runInFlight: false,
    runIndexById: new Map(),
    runTotal: null,
    onOpenLayer: null,
    layerSummaries: {},
    highlightedStepId: null,
    onDetachNode: null,
    attachedIds: new Set(),
    onToggleInline: null,
    inlineExpanded: new Set(),
    layerRefCounts: {},
    undeletableIds: new Set(),
});

export function useNodeRuntime() {
    return useContext(NodeRuntimeContext);
}

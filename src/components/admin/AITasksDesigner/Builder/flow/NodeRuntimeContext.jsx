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
});

export function useNodeRuntime() {
    return useContext(NodeRuntimeContext);
}

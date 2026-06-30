import { useMemo } from 'react';
import { computeUpstreamGroups } from '../components/admin/AITasksDesigner/Builder/mapping/upstream';

/**
 * React wrapper around `computeUpstreamGroups` (the pure discovery logic
 * lives in Builder/mapping/upstream.js so the auto-mapper can reuse the
 * exact same candidate set the user sees in the VariableTree).
 *
 * See upstream.js for the full output shape. Returns [] when
 * definition / currentStepId is missing.
 */
export default function useUpstreamVariables(definition, currentStepId, catalog) {
    return useMemo(
        () => computeUpstreamGroups(definition, currentStepId, catalog),
        [definition, currentStepId, catalog],
    );
}

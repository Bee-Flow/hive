/**
 * "Where the run is" — the top-centre canvas banner.
 *
 * A status border and a pulsing node say "something is happening"; they don't
 * say WHAT, or WHERE, and on a flow bigger than the viewport the active node is
 * often off-screen entirely. This names the step, counts the progress, and
 * offers to jump to it.
 *
 * BFSF-364 — extracted out of DiagramPane so the reconciliation below can be
 * tested. It used to read the last run's rows and the CURRENT graph as if they
 * described the same thing, and they do not: `runSteps` is a snapshot of a run
 * that already finished, while `definition` is whatever the author has on the
 * canvas right now. Delete the node that failed and the two disagree —
 *
 *   • `failed` still found the deleted step's row, so the banner kept claiming
 *     "Run failed at …" for a node that is no longer on the canvas, and only a
 *     hard refresh (which drops runSteps) sometimes cleared it;
 *   • `label` looked the step up in the definition, missed, and fell back to
 *     the raw id — hence the reported "Run failed at act_8de46880", an internal
 *     id shown to a user;
 *   • `done` counted rows (including the deleted node's) while `total` counted
 *     live graph nodes, which is how a 6-node flow reported "7/6".
 *
 * The rule: the banner may only ever talk about steps that exist on the canvas
 * right now. Reconciling the rows against the live graph fixes all three at
 * once, and makes `done > total` unrepresentable rather than merely unlikely.
 */

// Rows in these states have finished their work and count toward progress.
const DONE_STATES = ['success', 'skipped', 'pinned'];

// The nodes that exist on the canvas right now, trigger first — the order the
// banner counts in.
function liveGraph(definition) {
    return [definition?.trigger, ...(definition?.steps || [])].filter(Boolean);
}

function labelOf(step, stepId) {
    if (!step) return stepId || '';
    return step.label || step.tool || stepId || '';
}

/**
 * @param {object}   params
 * @param {Array}    [params.runSteps]    Rows from the last/current run ({stepId, status}).
 * @param {boolean}  [params.runInFlight] A run is currently executing.
 * @param {object}   [params.definition]  The graph as it is on the canvas NOW.
 * @returns {{stepId:string|null, label:string, done:number, total:number,
 *            state:'running'|'error'}|null} null when there is nothing to show.
 */
export function computeRunFocus({ runSteps, runInFlight = false, definition } = {}) {
    const graph = liveGraph(definition);
    const liveIds = new Set(graph.map(s => s.id).filter(Boolean));

    // BFSF-364: a row whose step has been deleted describes a graph that no
    // longer exists. Drop it before anything is derived from it — every field
    // below (target, label, done) read stale rows otherwise.
    const rows = (runSteps || []).filter(s => s?.stepId && liveIds.has(s.stepId));

    const running = rows.find(s => s.status === 'running');
    const failed = rows.find(s => s.status === 'error');
    const target = running || (runInFlight ? null : failed);
    if (!target?.stepId && !runInFlight) return null;

    const done = rows.filter(s => DONE_STATES.includes(s.status)).length;
    const stepId = target?.stepId || null;
    const step = stepId ? graph.find(s => s.id === stepId) : null;

    return {
        stepId,
        // `step` is now guaranteed present whenever stepId is — the id came out
        // of liveIds — so the raw-id fallback is defence only, never the path a
        // user sees.
        label: labelOf(step, stepId),
        done,
        total: graph.length,
        state: running ? 'running' : (failed ? 'error' : 'running'),
    };
}

export default computeRunFocus;

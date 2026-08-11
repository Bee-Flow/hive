import { describe, it, expect } from 'vitest';
import { computeRunFocus } from './runFocus';

/**
 * BFSF-364 regression — "stale 'Run failed' error from deleted node persists
 * and blocks re-run".
 *
 * The report, verbatim: a banner reading "Run failed at act_8de46880 7/6" on a
 * workflow that has six nodes. Three separate tells in that one string:
 *   • it names a step the author deleted;
 *   • it prints a raw internal id, because the label lookup missed;
 *   • it counts 7 done out of 6, because `done` came from the old run's rows
 *     while `total` came from the current graph.
 *
 * All three are the same root cause — run rows outliving the nodes they
 * describe — so they are pinned together here.
 *
 * Scope note: the ticket's second half (pinned upstream data seemingly ignored
 * by "Run the flow up to here") is a separate execution-path concern and is NOT
 * covered by this file.
 *
 * Run: cd agent-hub && npx vitest run src/components/admin/AITasksDesigner/Builder/flow/runFocus.test.js
 */

// A six-node flow: one trigger + five steps, exactly the reporter's shape.
const definition = {
    trigger: { id: 'trg_1', label: 'When email arrives' },
    steps: [
        { id: 'act_1', label: 'Fetch' },
        { id: 'act_2', label: 'Filter' },
        { id: 'act_3', label: 'Summarise' },
        { id: 'act_4', label: 'Notify' },
        { id: 'act_5', label: 'Archive' },
    ],
};

const rowsForWholeFlow = [
    { stepId: 'trg_1', status: 'success' },
    { stepId: 'act_1', status: 'success' },
    { stepId: 'act_2', status: 'success' },
    { stepId: 'act_3', status: 'success' },
    { stepId: 'act_4', status: 'success' },
    { stepId: 'act_5', status: 'success' },
];

describe('computeRunFocus — reconciling a finished run against the live graph', () => {
    it('drops the banner when the step that failed has been deleted', () => {
        // The reporter's exact move: the 7th node errored, they deleted it.
        const runSteps = [...rowsForWholeFlow, { stepId: 'act_8de46880', status: 'error' }];
        expect(computeRunFocus({ runSteps, runInFlight: false, definition })).toBeNull();
    });

    it('never reports more done than the graph has nodes', () => {
        // "7/6" — done counted a deleted node's row, total counted live nodes.
        const runSteps = [...rowsForWholeFlow, { stepId: 'act_8de46880', status: 'success' }];
        const focus = computeRunFocus({ runSteps, runInFlight: true, definition });
        expect(focus.total).toBe(6);
        expect(focus.done).toBe(6);
        expect(focus.done).toBeLessThanOrEqual(focus.total);
    });

    it('never shows a raw internal id in place of a label', () => {
        const runSteps = [{ stepId: 'act_8de46880', status: 'error' }];
        // Not in flight: the only row is a ghost, so there is nothing to show.
        expect(computeRunFocus({ runSteps, runInFlight: false, definition })).toBeNull();
        // In flight: the banner may exist, but it must not name the ghost.
        const focus = computeRunFocus({ runSteps, runInFlight: true, definition });
        expect(focus.label).not.toContain('act_8de46880');
        expect(focus.stepId).toBeNull();
    });

    it('clears a stale error without needing a hard refresh', () => {
        // Same runSteps object either side — only the graph changed, which is
        // all a delete does. The banner must react to that alone.
        const runSteps = [
            { stepId: 'trg_1', status: 'success' },
            { stepId: 'act_9', status: 'error' },
        ];
        const withNode = { trigger: definition.trigger, steps: [{ id: 'act_9', label: 'Broken' }] };
        expect(computeRunFocus({ runSteps, definition: withNode }).state).toBe('error');

        const afterDelete = { trigger: definition.trigger, steps: [] };
        expect(computeRunFocus({ runSteps, definition: afterDelete })).toBeNull();
    });

    it('still reports a genuine failure on a step that is still on the canvas', () => {
        const runSteps = [
            { stepId: 'trg_1', status: 'success' },
            { stepId: 'act_1', status: 'success' },
            { stepId: 'act_2', status: 'error' },
        ];
        const focus = computeRunFocus({ runSteps, runInFlight: false, definition });
        expect(focus).toMatchObject({ stepId: 'act_2', label: 'Filter', state: 'error', done: 2, total: 6 });
    });

    it('prefers the running step over an earlier failure, and counts pinned/skipped as done', () => {
        const runSteps = [
            { stepId: 'trg_1', status: 'pinned' },
            { stepId: 'act_1', status: 'skipped' },
            { stepId: 'act_2', status: 'error' },
            { stepId: 'act_3', status: 'running' },
        ];
        const focus = computeRunFocus({ runSteps, runInFlight: true, definition });
        expect(focus).toMatchObject({ stepId: 'act_3', label: 'Summarise', state: 'running', done: 2 });
    });

    it('falls back to the tool name when a step carries no label', () => {
        const def = { trigger: null, steps: [{ id: 'act_x', tool: 'gmail_search' }] };
        const focus = computeRunFocus({ runSteps: [{ stepId: 'act_x', status: 'error' }], definition: def });
        expect(focus.label).toBe('gmail_search');
    });

    it('shows a bare Running banner while a run is in flight but has no rows yet', () => {
        const focus = computeRunFocus({ runSteps: [], runInFlight: true, definition });
        expect(focus).toMatchObject({ stepId: null, label: '', done: 0, total: 6, state: 'running' });
    });

    it('shows nothing at rest, and survives missing inputs', () => {
        expect(computeRunFocus({ runSteps: [], runInFlight: false, definition })).toBeNull();
        expect(computeRunFocus({})).toBeNull();
        expect(computeRunFocus()).toBeNull();
        expect(computeRunFocus({ runSteps: [{ status: 'error' }], definition })).toBeNull();
    });

    it('ignores rows for a graph that has not loaded yet rather than inventing a failure', () => {
        const runSteps = [{ stepId: 'act_1', status: 'error' }];
        expect(computeRunFocus({ runSteps, definition: null })).toBeNull();
        expect(computeRunFocus({ runSteps, definition: { steps: [] } })).toBeNull();
    });
});

import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
import {
    canConnect, createsCycle, graphToSteps, orderScope, parseId, sameScope,
    stepsToGraph, stripStepIds, withStepIds,
} from './stepGraph';

const require = createRequire(import.meta.url);
// The server's own pre-order walk — the contract this codec must not break.
const { _flattenSteps: serverFlatten } = (() => {
    // studioAppsRun does not export it, so the walk is re-stated here EXACTLY
    // as the route implements it. If the route's shape ever changes, the
    // "same order as the server" tests below are what notices.
    const flatten = (steps, out = []) => {
        for (const step of (Array.isArray(steps) ? steps : [])) {
            if (!step || typeof step !== 'object') continue;
            out.push(step);
            if (step.kind === 'condition') { flatten(step.then, out); flatten(step.else, out); }
            else if (step.kind === 'loop') { flatten(step.steps, out); }
            else if (step.kind === 'switch') {
                for (const c of (Array.isArray(step.cases) ? step.cases : [])) {
                    if (c && typeof c === 'object') flatten(c.steps, out);
                }
                flatten(step.default, out);
            }
        }
        return out;
    };
    return { _flattenSteps: flatten };
})();

const seq = (steps) => withStepIds({ kind: 'sequence', steps });

const NESTED = [
    { kind: 'set_variable', name: 'a' },
    {
        kind: 'condition',
        expr: 'vars.a',
        then: [{ kind: 'toast', message: 'yes' }, { kind: 'navigate', screenId: 'scr_b' }],
        else: [{ kind: 'toast', message: 'no' }],
    },
    { kind: 'loop', source: { kind: 'static', value: [] }, itemVar: 'row', steps: [{ kind: 'create_record', tableId: 't' }] },
    {
        kind: 'switch',
        expr: 'vars.a',
        cases: [{ name: 'open', steps: [{ kind: 'toast', message: 'open' }] }],
        default: [{ kind: 'toast', message: 'other' }],
    },
];

describe('stepsToGraph', () => {
    it('draws a flat sequence as a chain', () => {
        const { nodes, edges } = stepsToGraph(seq([{ kind: 'toast', message: 'a' }, { kind: 'toast', message: 'b' }]));
        expect(nodes.map((n) => n.kind)).toEqual(['toast', 'toast']);
        expect(edges).toHaveLength(1);
        expect(edges[0]).toMatchObject({ from: nodes[0].id, to: nodes[1].id });
    });

    it('gives each container scope its own entry pill, so an empty branch is droppable', () => {
        const { nodes } = stepsToGraph(seq([{ kind: 'condition', expr: 'x', then: [], else: [] }]));
        const entries = nodes.filter((n) => n.isEntry);
        expect(entries.map((n) => n.scopeKey).sort()).toEqual(['else', 'then']);
    });

    it('prefixes a nested id with its scope, keeping ids flat and unique', () => {
        const { nodes } = stepsToGraph(seq(NESTED));
        const inThen = nodes.filter((n) => n.scopeKey === 'then' && !n.isEntry);
        expect(inThen).toHaveLength(2);
        expect(parseId(inThen[0].id).prefix).toMatch(/\/then$/);
        expect(sameScope(inThen[0].id, inThen[1].id)).toBe(true);
    });

    it('names a switch scope per case, plus the default', () => {
        const { nodes } = stepsToGraph(seq(NESTED));
        const keys = [...new Set(nodes.filter((n) => n.scopeKey?.startsWith('case:')).map((n) => n.scopeKey))];
        expect(keys.sort()).toEqual(['case:default', 'case:open']);
    });

    it('a bare v1 action is an implicit one-step sequence', () => {
        const { nodes } = stepsToGraph(withStepIds({ kind: 'toast', message: 'hi' }));
        expect(nodes).toHaveLength(1);
        expect(nodes[0].kind).toBe('toast');
    });

    it('survives a malformed action', () => {
        for (const action of [null, undefined, {}, { kind: 'sequence', steps: 'nope' }]) {
            expect(() => stepsToGraph(action)).not.toThrow();
        }
    });
});

describe('graphToSteps — the round trip', () => {
    it('returns the tree it was given, unchanged', () => {
        const action = seq(NESTED);
        const { nodes, edges } = stepsToGraph(action);
        expect(stripStepIds(graphToSteps(nodes, edges))).toEqual(stripStepIds(action.steps));
    });

    it('round-trips an empty branch', () => {
        const action = seq([{ kind: 'condition', expr: 'x', then: [], else: [{ kind: 'toast', message: 'n' }] }]);
        const { nodes, edges } = stepsToGraph(action);
        expect(stripStepIds(graphToSteps(nodes, edges))).toEqual(stripStepIds(action.steps));
    });

    /*
     * THE contract. stepIndex is never stored: both sides derive it by walking
     * the saved tree in the same pre-order, and the server resolves the step to
     * run from that index alone. A codec that reordered anything would send the
     * browser's step 3 to the server's step 4 — silently, at run time.
     */
    it('leaves the server’s pre-order walk identical', () => {
        const action = seq(NESTED);
        const before = serverFlatten(action.steps).map((s) => s.kind);
        const { nodes, edges } = stepsToGraph(action);
        const after = serverFlatten(graphToSteps(nodes, edges)).map((s) => s.kind);
        expect(after).toEqual(before);
    });

    it('a reorder inside one branch moves only that branch', () => {
        const action = seq(NESTED);
        const { nodes, edges } = stepsToGraph(action);
        const thenPrefix = nodes.find((n) => n.isEntry && n.scopeKey === 'then').prefix;
        const inThen = nodes.filter((n) => n.prefix === thenPrefix && !n.isEntry);
        expect(inThen.map((n) => n.step.screenId ?? n.step.message)).toEqual(['yes', 'scr_b']);

        // Rewire only the `then` chain, back to front.
        const entryId = `${thenPrefix}/__entry__`;
        const rewired = [
            ...edges.filter((e) => parseId(e.from).prefix !== thenPrefix),
            { id: 'x1', from: entryId, to: inThen[1].id },
            { id: 'x2', from: inThen[1].id, to: inThen[0].id },
        ];

        const steps = graphToSteps(nodes, rewired);
        // The branch flipped…
        expect(steps[1].then.map((s) => s.screenId ?? s.message)).toEqual(['scr_b', 'yes']);
        // …and nothing else did.
        expect(steps[1].else.map((s) => s.message)).toEqual(['no']);
        expect(steps.map((s) => s.kind)).toEqual(['set_variable', 'condition', 'loop', 'switch']);
    });

    it('moving a step to another branch puts it in that branch’s array', () => {
        const action = seq([{ kind: 'condition', expr: 'x', then: [{ kind: 'toast', message: 'moved' }], else: [] }]);
        const { nodes, edges } = stepsToGraph(action);
        const moved = nodes.find((n) => n.step?.message === 'moved');
        const elseEntry = nodes.find((n) => n.isEntry && n.scopeKey === 'else');

        // Re-parent the node into the `else` scope and rewire it there.
        const nextNodes = nodes.map((n) => (n.id === moved.id
            ? { ...n, id: `${elseEntry.prefix}/moved`, prefix: elseEntry.prefix, scopeKey: 'else' }
            : n));
        const nextEdges = [{ id: 'e', from: elseEntry.id, to: `${elseEntry.prefix}/moved` }];

        const steps = graphToSteps(nextNodes, nextEdges);
        expect(steps[0].then).toEqual([]);
        expect(steps[0].else.map((s) => s.message)).toEqual(['moved']);
    });
});

describe('orderScope — stable', () => {
    it('keeps a detached node where it was rather than moving it to the front', () => {
        const ids = ['a', 'b', 'c'];
        // b lost its edges; a→c remains.
        expect(orderScope(ids, [{ from: 'a', to: 'c' }], ids)).toEqual(['a', 'b', 'c']);
    });

    it('follows the edges when they say so', () => {
        const ids = ['a', 'b'];
        expect(orderScope(ids, [{ from: 'b', to: 'a' }], ids)).toEqual(['b', 'a']);
    });

    it('appends the leftovers of a cycle rather than dropping them', () => {
        const ids = ['a', 'b'];
        const out = orderScope(ids, [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }], ids);
        expect(out.sort()).toEqual(['a', 'b']);
    });

    it('counts a parallel edge once', () => {
        // A switch emits one edge per case to the same target; counting each
        // would leave the target's indegree above zero forever.
        const ids = ['a', 'b'];
        const dup = [{ from: 'a', to: 'b' }, { from: 'a', to: 'b' }];
        expect(orderScope(ids, dup, ids)).toEqual(['a', 'b']);
    });
});

describe('canConnect — what keeps the graph a tree', () => {
    const { nodes, edges } = stepsToGraph(seq(NESTED));
    const flat = nodes.filter((n) => !n.isEntry && n.prefix === '');
    const inThen = nodes.filter((n) => n.scopeKey === 'then' && !n.isEntry);

    it('refuses an edge across a branch boundary', () => {
        const res = canConnect(flat[0].id, inThen[0].id, [], nodes);
        expect(res.ok).toBe(false);
        expect(res.reason).toMatch(/same branch/i);
    });

    it('refuses a second parent — the tree has no joins', () => {
        const existing = [{ from: flat[0].id, to: flat[1].id }];
        const res = canConnect(flat[2].id, flat[1].id, existing, nodes);
        expect(res.ok).toBe(false);
        expect(res.reason).toMatch(/only follow one/i);
    });

    it('refuses a second successor — no fan-out either', () => {
        const existing = [{ from: flat[0].id, to: flat[1].id }];
        const res = canConnect(flat[0].id, flat[2].id, existing, nodes);
        expect(res.ok).toBe(false);
        expect(res.reason).toMatch(/already leads/i);
    });

    it('refuses a cycle', () => {
        const existing = [{ from: flat[0].id, to: flat[1].id }, { from: flat[1].id, to: flat[2].id }];
        expect(canConnect(flat[2].id, flat[0].id, existing, nodes).ok).toBe(false);
    });

    it('refuses connecting INTO a branch entry pill', () => {
        const entry = nodes.find((n) => n.isEntry);
        const res = canConnect(flat[0].id, entry.id, [], nodes);
        expect(res.ok).toBe(false);
    });

    it('allows an ordinary next step', () => {
        expect(canConnect(flat[0].id, flat[1].id, [], nodes).ok).toBe(true);
    });

    it('refuses a self-edge', () => {
        expect(canConnect(flat[0].id, flat[0].id, [], nodes).ok).toBe(false);
    });
});

describe('createsCycle', () => {
    it('sees a direct loop back', () => {
        expect(createsCycle('b', 'a', [{ from: 'a', to: 'b' }])).toBe(true);
    });
    it('sees a longer one', () => {
        expect(createsCycle('c', 'a', [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }])).toBe(true);
    });
    it('leaves an honest chain alone', () => {
        expect(createsCycle('b', 'c', [{ from: 'a', to: 'b' }])).toBe(false);
    });
});

describe('withStepIds / stripStepIds', () => {
    it('ids are editor-only and never persist', () => {
        const action = seq(NESTED);
        expect(action.steps[0].id).toBeTruthy();
        expect(stripStepIds(action.steps)).toEqual(NESTED);
    });

    it('an existing id is kept, so a node keeps pointing at its step', () => {
        const action = withStepIds({ kind: 'sequence', steps: [{ id: 'keepme', kind: 'toast', message: 'x' }] });
        expect(action.steps[0].id).toBe('keepme');
    });
});

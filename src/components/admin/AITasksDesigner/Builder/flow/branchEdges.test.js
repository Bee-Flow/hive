import { describe, it, expect } from 'vitest';
import {
    branchFromHandle as branchFromHandleDirect,
    copyExtraEdgeKeys, edgeKey, edgeIdentity, matchesEdgeIdentity, spliceStepIntoEdge, removeEdgesByIdentity,
} from './branchEdges';
import { buildLayout } from './layout';
import { branchFromHandle, applyAddNode } from '../DiagramPane';

/**
 * Per-branch wiring: branch nodes (condition/switch) expose one source port
 * per branch. Dragging from a port must stamp the edge `label`/`caseName`
 * the runtime routes on, and the layout must send each edge out of the
 * matching React Flow source handle.
 */
describe('branchFromHandle (DiagramPane onConnect mapping)', () => {
    it('maps then/else condition handles to the branch label', () => {
        expect(branchFromHandle('then')).toEqual({ label: 'then' });
        expect(branchFromHandle('else')).toEqual({ label: 'else' });
    });

    it('maps switch case handles to label + caseName', () => {
        expect(branchFromHandle('case:urgent')).toEqual({ label: 'case:urgent', caseName: 'urgent' });
        expect(branchFromHandle('case:default')).toEqual({ label: 'case:default', caseName: 'default' });
    });

    it('leaves a plain handle unlabelled', () => {
        expect(branchFromHandle(null)).toEqual({});
        expect(branchFromHandle(undefined)).toEqual({});
        expect(branchFromHandle('whatever')).toEqual({});
    });

    it('maps the loop on_error handle to its label (drag-authorable error branch)', () => {
        expect(branchFromHandle('on_error')).toEqual({ label: 'on_error' });
    });

    it('DiagramPane re-export is the same function as the module export', () => {
        expect(branchFromHandle).toBe(branchFromHandleDirect);
    });
});

/**
 * Edge identity (node-audit B0/B3/B4): a definition edge's identity is
 * (from, to, label, caseName) — matching on the bare pair silently takes
 * parallel branch edges along with any delete/splice.
 */
describe('matchesEdgeIdentity', () => {
    it('matches case edges across the three legacy shapes', () => {
        const want = { label: 'case:vip', caseName: 'vip' };
        expect(matchesEdgeIdentity({ from: 'a', to: 'b', label: 'case:vip', caseName: 'vip' }, want)).toBe(true);
        expect(matchesEdgeIdentity({ from: 'a', to: 'b', label: 'case:vip' }, want)).toBe(true);        // label-only
        expect(matchesEdgeIdentity({ from: 'a', to: 'b', caseName: 'vip' }, want)).toBe(true);          // caseName-only
        expect(matchesEdgeIdentity({ from: 'a', to: 'b', label: 'case:normal', caseName: 'normal' }, want)).toBe(false);
    });

    it('caseName-only identity still matches label-only rows', () => {
        expect(matchesEdgeIdentity({ label: 'case:vip' }, { caseName: 'vip' })).toBe(true);
    });

    it('plain identity matches only truly unlabelled edges', () => {
        expect(matchesEdgeIdentity({ from: 'a', to: 'b' }, {})).toBe(true);
        expect(matchesEdgeIdentity({ from: 'a', to: 'b', label: 'then' }, {})).toBe(false);
    });

    it('then/else/on_error identities are exact', () => {
        expect(matchesEdgeIdentity({ label: 'then' }, { label: 'then' })).toBe(true);
        expect(matchesEdgeIdentity({ label: 'else' }, { label: 'then' })).toBe(false);
        expect(matchesEdgeIdentity({ label: 'on_error' }, { label: 'on_error' })).toBe(true);
    });
});

describe('spliceStepIntoEdge', () => {
    const edges = [
        { from: 'sw', to: 'send', label: 'case:vip', caseName: 'vip' },
        { from: 'sw', to: 'send', label: 'case:normal', caseName: 'normal' },
    ];

    it('splices only the identity-matched edge; the sibling branch survives', () => {
        const out = spliceStepIntoEdge(edges, 'newStep', 'sw', 'send', { label: 'case:vip', caseName: 'vip' });
        expect(out).toContainEqual({ from: 'sw', to: 'send', label: 'case:normal', caseName: 'normal' });
        expect(out).toContainEqual({ from: 'sw', to: 'newStep', label: 'case:vip', caseName: 'vip' });
        expect(out).toContainEqual({ from: 'newStep', to: 'send' });
        expect(out.some(e => e.from === 'sw' && e.to === 'send' && e.caseName === 'vip')).toBe(false);
    });

    it('leaves by the inserted step\'s first port when it is a brancher', () => {
        // A Filter routes on labels only, so an unlabelled continuation would
        // never fire — dropping one onto a connection used to produce exactly
        // that dead edge.
        const out = spliceStepIntoEdge([{ from: 'a', to: 'b' }], 'flt', 'a', 'b', {}, { slot: 0, label: 'then' });
        expect(out).toContainEqual({ from: 'a', to: 'flt' });
        expect(out).toContainEqual({ from: 'flt', to: 'b', label: 'then' });
    });

    it('carries a case name onto the continuation when the first port is a case', () => {
        const out = spliceStepIntoEdge([{ from: 'a', to: 'b' }], 'sw', 'a', 'b', {}, { slot: 0, label: 'case:vip', caseName: 'vip' });
        expect(out).toContainEqual({ from: 'sw', to: 'b', label: 'case:vip', caseName: 'vip' });
    });

    it('keeps an on_error label on the source→new edge', () => {
        const out = spliceStepIntoEdge([{ from: 'lp', to: 'alert', label: 'on_error' }], 'n', 'lp', 'alert', { label: 'on_error' });
        expect(out).toContainEqual({ from: 'lp', to: 'n', label: 'on_error' });
        expect(out).toContainEqual({ from: 'n', to: 'alert' });
    });

    it('plain identity splices a plain edge without inventing labels', () => {
        const out = spliceStepIntoEdge([{ from: 'a', to: 'b' }], 'n', 'a', 'b', {});
        expect(out).toEqual([{ from: 'a', to: 'n' }, { from: 'n', to: 'b' }]);
    });
});

describe('removeEdgesByIdentity', () => {
    it('removes exactly the named edge; parallel siblings survive', () => {
        const edges = [
            { from: 'c', to: 'x', label: 'then' },
            { from: 'c', to: 'x', label: 'else' },
        ];
        const out = removeEdgesByIdentity(edges, [{ from: 'c', to: 'x', label: 'then' }]);
        expect(out).toEqual([{ from: 'c', to: 'x', label: 'else' }]);
    });

    it('edgeKey/edgeIdentity round out the module surface', () => {
        expect(edgeKey({ from: 'a', to: 'b', label: 'then' })).toBe('a->b|then|');
        expect(edgeIdentity({ label: 'case:v', caseName: 'v' })).toEqual({ label: 'case:v', caseName: 'v' });
        expect(edgeIdentity({})).toEqual({ label: null, caseName: null });
    });
});

describe('buildLayout — loop on_error edge is distinct (B10)', () => {
    const def = {
        trigger: { id: 'trg', kind: 'manual', position: { x: 0, y: 0 } },
        steps: [
            { id: 'lp', type: 'loop', overRef: 'trigger.output.items', itemVar: 'item', body: [], position: { x: 200, y: 0 } },
            { id: 'ok', type: 'notification', title: 'ok', position: { x: 400, y: 0 } },
            { id: 'alert', type: 'notification', title: 'alert', position: { x: 400, y: 120 } },
        ],
        edges: [
            { from: 'trg', to: 'lp' },
            { from: 'lp', to: 'ok' },
            { from: 'lp', to: 'alert', label: 'on_error' },
        ],
    };
    const { edges } = buildLayout(def, {});
    const find = (from, to) => edges.find((e) => e.source === from && e.target === to);

    it('routes on_error out of its own port with its own chip — not the Done port', () => {
        expect(find('lp', 'alert').sourceHandle).toBe('on_error');
        expect(find('lp', 'alert').data.kind).toBe('on_error');
        expect(find('lp', 'ok').sourceHandle).toBe('done');
        expect(find('lp', 'ok').data.kind).toBeNull();
    });

    it('carries the on_error identity so the ✕ control can delete exactly that edge', () => {
        expect(find('lp', 'alert').data.defLabel).toBe('on_error');
    });
});

describe('buildLayout — unlabelled brancher edge is marked unrouted (B5)', () => {
    const def = {
        trigger: { id: 'trg', kind: 'manual', position: { x: 0, y: 0 } },
        steps: [
            { id: 'c', type: 'condition', expr: 'true', position: { x: 200, y: 0 } },
            { id: 'n', type: 'notification', title: 'n', position: { x: 400, y: 0 } },
        ],
        edges: [
            { from: 'trg', to: 'c' },
            { from: 'c', to: 'n' }, // no label — the runtime never follows this
        ],
    };
    const { edges } = buildLayout(def, {});

    it('flags the dead edge instead of letting it masquerade as a working connection', () => {
        const dead = edges.find((e) => e.source === 'c' && e.target === 'n');
        expect(dead.data.kind).toBe('unrouted');
    });

    it('a plain edge from a NON-brancher stays unmarked', () => {
        const plain = edges.find((e) => e.source === 'trg' && e.target === 'c');
        expect(plain.data.kind).toBeNull();
    });
});

describe('buildLayout — definition identity in edge data (B0)', () => {
    const def = {
        trigger: { id: 'trg', kind: 'manual', position: { x: 0, y: 0 } },
        steps: [
            { id: 'sw', type: 'switch', expr: 'x', cases: [{ name: 'a', value: 'a' }], position: { x: 200, y: 0 } },
            { id: 'n1', type: 'notification', title: 'a', position: { x: 400, y: 0 } },
        ],
        edges: [
            { from: 'trg', to: 'sw' },
            { from: 'sw', to: 'n1', label: 'case:a', caseName: 'a' },
        ],
    };
    const { edges } = buildLayout(def, {});
    const find = (from, to) => edges.find((e) => e.source === from && e.target === to);

    it('carries defLabel/defCaseName for branch edges', () => {
        expect(find('sw', 'n1').data.defLabel).toBe('case:a');
        expect(find('sw', 'n1').data.defCaseName).toBe('a');
    });

    it('normalises absent identity to nulls on plain edges', () => {
        expect(find('trg', 'sw').data.defLabel).toBeNull();
        expect(find('trg', 'sw').data.defCaseName).toBeNull();
    });
});

describe('buildLayout — edge sourceHandle', () => {
    const def = {
        trigger: { id: 'trg', kind: 'manual', position: { x: 0, y: 0 } },
        steps: [
            { id: 'sw', type: 'switch', expr: 'x', cases: [{ name: 'a', value: 'a' }], position: { x: 200, y: 0 } },
            { id: 'c', type: 'condition', expr: 'true', position: { x: 200, y: 200 } },
            { id: 'n1', type: 'notification', title: 'a', position: { x: 400, y: 0 } },
            { id: 'n2', type: 'notification', title: 'd', position: { x: 400, y: 100 } },
            { id: 'n3', type: 'notification', title: 't', position: { x: 400, y: 200 } },
        ],
        edges: [
            { from: 'trg', to: 'sw' },
            { from: 'sw', to: 'n1', label: 'case:a', caseName: 'a' },
            { from: 'sw', to: 'n2', label: 'case:default', caseName: 'default' },
            { from: 'c', to: 'n3', label: 'then' },
        ],
    };
    const { edges } = buildLayout(def, {});
    const find = (from, to) => edges.find((e) => e.source === from && e.target === to);

    it('routes switch case edges out of their case port', () => {
        expect(find('sw', 'n1').sourceHandle).toBe('case:a');
        expect(find('sw', 'n2').sourceHandle).toBe('case:default');
    });

    it('routes a condition then-edge out of the then port', () => {
        expect(find('c', 'n3').sourceHandle).toBe('then');
    });

    it('leaves a plain edge with no sourceHandle (default port)', () => {
        expect(find('trg', 'sw').sourceHandle).toBeUndefined();
    });

    it('carries sourceHandle in edge data so the insert control can thread it', () => {
        expect(find('sw', 'n1').data.sourceHandle).toBe('case:a');
        expect(find('c', 'n3').data.sourceHandle).toBe('then');
        expect(find('trg', 'sw').data.sourceHandle).toBeNull();
    });
});

describe('buildLayout — Loop\'s outgoing edge always maps to the "done" port', () => {
    // Inferred by the SOURCE STEP'S TYPE, not the edge label, so today's
    // existing saved automations (whose loop→next edge is unlabelled) render
    // correctly with zero data migration.
    const loopDef = {
        trigger: { id: 'trg', kind: 'manual', position: { x: 0, y: 0 } },
        steps: [
            { id: 'lp', type: 'loop', overRef: 'trigger.output.items', itemVar: 'item', body: [], position: { x: 200, y: 0 } },
            { id: 'n1', type: 'notification', title: 'after', position: { x: 400, y: 0 } },
        ],
        edges: [{ from: 'trg', to: 'lp' }, { from: 'lp', to: 'n1' }],
    };
    const { edges } = buildLayout(loopDef, {});
    const find = (from, to) => edges.find((e) => e.source === from && e.target === to);

    it('maps the unlabelled loop→next edge to sourceHandle "done"', () => {
        expect(find('lp', 'n1').sourceHandle).toBe('done');
    });

    it('a future explicitly-labelled "done" edge still maps correctly (not a regression trap)', () => {
        const labelled = { ...loopDef, edges: [{ from: 'trg', to: 'lp' }, { from: 'lp', to: 'n1', label: 'done' }] };
        const { edges: e2 } = buildLayout(labelled, {});
        expect(e2.find((e) => e.source === 'lp' && e.target === 'n1').sourceHandle).toBe('done');
    });
});

describe('applyAddNode — inserting a step on a branch edge preserves the branch label', () => {
    // Regression: the "+" on a then/else/case edge used to splice the new step
    // in WITHOUT the branch label, silently breaking If/Switch runtime routing.
    // The label must land on the source→new edge (the branch decision point);
    // new→target is a plain continuation.
    const baseDef = {
        trigger: { id: 'trg', kind: 'manual', position: { x: 0, y: 0 } },
        steps: [
            { id: 'c', type: 'condition', expr: 'true', position: { x: 200, y: 0 } },
            { id: 'n3', type: 'notification', title: 't', position: { x: 400, y: 0 } },
        ],
        edges: [{ from: 'trg', to: 'c' }, { from: 'c', to: 'n3', label: 'then' }],
    };

    it('threads then/else through applyAddNode onto the source→new edge', () => {
        // Splice a step on the c--(then)-->n3 edge: pass sourceHandle 'then'.
        const withNode = applyAddNode(baseDef, { kind: 'notification', title: 'x' }, { x: 300, y: 0 }, 'c', 'then');
        const insertedId = withNode.steps[withNode.steps.length - 1].id;
        const srcToNew = withNode.edges.find((e) => e.from === 'c' && e.to === insertedId);
        expect(srcToNew).toBeTruthy();
        expect(srcToNew.label).toBe('then');
    });
});

/**
 * Pressing ▶ on a node no longer opens its editor, so the canvas has to answer
 * "what goes to the next step" by itself — a chip on the connection.
 */
describe('buildLayout — run data summary per connection', () => {
    const def = {
        trigger: { id: 'trg', type: 'trigger', kind: 'manual', position: { x: 0, y: 0 } },
        steps: [
            { id: 'g1', type: 'integration_action', tool: 'gmail_search', position: { x: 1, y: 0 } },
            { id: 'sw', type: 'switch', cases: [{ name: 'isv', expr: 'x' }], position: { x: 2, y: 0 } },
            { id: 'a', type: 'notification', position: { x: 3, y: 0 } },
            { id: 'b', type: 'notification', position: { x: 4, y: 0 } },
        ],
        edges: [
            { from: 'trg', to: 'g1' },
            { from: 'g1', to: 'sw' },
            { from: 'sw', to: 'a', label: 'case:isv', caseName: 'isv' },
            { from: 'sw', to: 'b', label: 'case:default', caseName: 'default' },
        ],
    };
    const runByStep = new Map([
        ['g1', { status: 'success', output: { total: 2, results: [{ id: 1 }, { id: 2 }] } }],
        ['sw', { status: 'success', output: { mode: 'collection', matchesByCase: { isv: [{ id: 1 }], default: [{ id: 2 }] } } }],
    ]);

    it('labels each connection with what actually travelled down it', () => {
        const { edges } = buildLayout(def, { runByStep });
        const byPair = (from, to) => edges.find(e => e.source === from && e.target === to);
        expect(byPair('g1', 'sw').data.dataSummary.label).toBe('2 records');
        // Per-branch, not the switch's whole input.
        expect(byPair('sw', 'a').data.dataSummary.label).toBe('1 record');
        expect(byPair('sw', 'b').data.dataSummary.label).toBe('1 record');
        // A step that hasn't run says nothing.
        expect(byPair('trg', 'g1').data.dataSummary).toBe(null);
    });

    it('carries no summary at all when nothing has run', () => {
        const { edges } = buildLayout(def, {});
        expect(edges.every(e => e.data.dataSummary === null)).toBe(true);
    });
});

/**
 * Coloured connections: edge.color (a palette key) is definition data. It
 * must survive every helper that rebuilds edge objects, forward into the
 * rendered edge's data, and never be part of edge identity.
 */
describe('copyExtraEdgeKeys', () => {
    it('copies everything except the identity keys', () => {
        const out = copyExtraEdgeKeys(
            { from: 'a', to: 'b', label: 'then', caseName: null, color: 'red', note: 'x' },
            { from: 'c', to: 'd' },
        );
        expect(out).toEqual({ from: 'c', to: 'd', color: 'red', note: 'x' });
    });

    it('tolerates null sources', () => {
        expect(copyExtraEdgeKeys(null, { from: 'a', to: 'b' })).toEqual({ from: 'a', to: 'b' });
    });
});

describe('edge colour survives graph surgery', () => {
    it('spliceStepIntoEdge carries the colour onto the source→new edge', () => {
        const edges = [{ from: 'a', to: 'b', label: 'then', color: 'cyan' }];
        const next = spliceStepIntoEdge(edges, 'mid', 'a', 'b', { label: 'then' }, null);
        const sourceToNew = next.find(e => e.from === 'a' && e.to === 'mid');
        const newToTarget = next.find(e => e.from === 'mid' && e.to === 'b');
        expect(sourceToNew.color).toBe('cyan');
        expect(sourceToNew.label).toBe('then');
        expect(newToTarget.color).toBeUndefined(); // continuation starts clean
    });
});

describe('buildLayout — colour + parallel-lane forwarding', () => {
    const def = {
        trigger: { id: 'trg', kind: 'manual', position: { x: 0, y: 0 } },
        steps: [
            {
                id: 'sw', type: 'switch', expr: 'x', position: { x: 200, y: 0 },
                cases: [{ name: 'pdf', value: 'pdf' }, { name: 'word', value: 'word' }],
            },
            { id: 'n1', type: 'notification', title: 'a', position: { x: 400, y: 0 } },
        ],
        edges: [
            { from: 'trg', to: 'sw', color: 'slate' },
            { from: 'sw', to: 'n1', label: 'case:pdf', caseName: 'pdf', color: 'red' },
            { from: 'sw', to: 'n1', label: 'case:word', caseName: 'word' },
        ],
    };
    const { edges } = buildLayout(def, {});
    const byId = (id) => edges.find(e => e.id === id);

    it('forwards the persisted colour as data.defColor', () => {
        expect(byId('trg->sw||').data.defColor).toBe('slate');
        expect(byId('sw->n1|case:pdf|pdf').data.defColor).toBe('red');
        expect(byId('sw->n1|case:word|word').data.defColor).toBeNull();
    });

    it('stamps caseIndex from the case order (drives the auto colours)', () => {
        expect(byId('sw->n1|case:pdf|pdf').data.caseIndex).toBe(0);
        expect(byId('sw->n1|case:word|word').data.caseIndex).toBe(1);
        expect(byId('trg->sw||').data.caseIndex).toBeNull();
    });

    it('assigns fan-out lanes only to parallel edges between the same pair', () => {
        const pdf = byId('sw->n1|case:pdf|pdf');
        const word = byId('sw->n1|case:word|word');
        expect(pdf.data.parallelCount).toBe(2);
        expect(word.data.parallelCount).toBe(2);
        expect(new Set([pdf.data.parallelIndex, word.data.parallelIndex])).toEqual(new Set([0, 1]));
        expect(byId('trg->sw||').data.parallelCount).toBeUndefined();
    });

    it('edge ids are the definition identity, stable across reorders', () => {
        const reordered = { ...def, edges: [def.edges[2], def.edges[0], def.edges[1]] };
        const { edges: e2 } = buildLayout(reordered, {});
        expect(new Set(e2.map(e => e.id))).toEqual(new Set(edges.map(e => e.id)));
    });

    it('true duplicate rows still get unique ReactFlow ids', () => {
        const dup = { ...def, edges: [...def.edges, { from: 'trg', to: 'sw', color: 'slate' }] };
        const { edges: e2 } = buildLayout(dup, {});
        const ids = e2.map(e => e.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toContain('trg->sw||#dup1');
    });
});

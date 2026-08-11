import { describe, it, expect } from 'vitest';
import {
    composeInlineGraph,
    decomposeInlineGraph,
    containerKind,
    CONTAINER_HEADER,
    CONTAINER_PAD,
} from './inlineFlowlets.js';
import { LOOP_ENTRY_ID } from './loopBodyEdges.js';
import { applyDeleteNodes } from './nodeOps.js';

/**
 * The loop half of inlineFlowlets (the flowlet half lives in
 * inlineFlowlets.test.js). A loop body is a bare ARRAY with no edges — the
 * canvas draws it as a chain and reads the chain back — so these tests care
 * mostly about the two directions agreeing and about what must NOT change on
 * the way through: bindings, ids, and the order of steps nobody touched.
 */

const DIMS = { width: 240, height: 96 };

/** trg → lp1 (body: a → b) → after */
const loopDef = (body = null) => ({
    trigger: { id: 'trg', type: 'trigger', kind: 'manual', position: { x: 0, y: 0 } },
    steps: [
        {
            id: 'lp1',
            type: 'loop',
            label: 'Repeat for each',
            overRef: 'steps.src.output.results',
            itemVar: 'item',
            position: { x: 400, y: 0 },
            body: body ?? [
                { id: 'a', type: 'set', label: 'A', fields: { x: { kind: 'ref', path: 'loop.item.name' } } },
                { id: 'b', type: 'notification', label: 'B', body: 'hi {{steps.a.output.x}}' },
            ],
        },
        { id: 'after', type: 'ai_step', position: { x: 800, y: 0 } },
    ],
    edges: [{ from: 'trg', to: 'lp1' }, { from: 'lp1', to: 'after' }],
});

const compose = (def, expanded = ['lp1']) =>
    composeInlineGraph(def, def, new Set(expanded), { dims: DIMS });

const idsOf = (graph) => (graph.steps || []).map(s => s.id);
const loopIn = (graph, id = 'lp1') => (graph.steps || []).find(s => s.id === id);

describe('containerKind', () => {
    it('names both kinds and nothing else', () => {
        expect(containerKind({ type: 'loop' })).toBe('loop');
        expect(containerKind({ type: 'call_layer', layerKey: 'enrich' })).toBe('layer');
        // A call_layer with no target has nothing to draw.
        expect(containerKind({ type: 'call_layer' })).toBe(null);
        expect(containerKind({ type: 'set' })).toBe(null);
        expect(containerKind(null)).toBe(null);
    });
});

describe('composeInlineGraph — loop body', () => {
    it('folds the body in behind an "Each item" entry node', () => {
        const { graph, sidecar, expanded } = compose(loopDef());
        expect([...expanded]).toEqual(['lp1']);
        expect(idsOf(graph)).toEqual(['lp1', 'after', `lp1/${LOOP_ENTRY_ID}`, 'lp1/a', 'lp1/b']);

        const entry = graph.steps.find(s => s.id === `lp1/${LOOP_ENTRY_ID}`);
        expect(entry.type).toBe('loop_item');
        expect(entry.itemVar).toBe('item');
        expect(entry.overRef).toBe('steps.src.output.results');

        const e = sidecar.get('lp1');
        expect(e.kind).toBe('loop');
        expect(e.layerKey).toBe(null);
        expect(e.triggerId).toBe(`lp1/${LOOP_ENTRY_ID}`);
        expect(e.childIds).toEqual([`lp1/${LOOP_ENTRY_ID}`, 'lp1/a', 'lp1/b']);
    });

    it('chains the body and links the container to its entry', () => {
        const { graph } = compose(loopDef());
        expect(graph.edges).toContainEqual({ from: `lp1/${LOOP_ENTRY_ID}`, to: 'lp1/a' });
        expect(graph.edges).toContainEqual({ from: 'lp1/a', to: 'lp1/b' });
        // Not drawn (layout.js filters it) but present so the variable picker
        // can see past the container into the flow before it.
        expect(graph.edges).toContainEqual({ from: 'lp1', to: `lp1/${LOOP_ENTRY_ID}`, __containerEntry: true });
    });

    it('rewrites sibling references but leaves loop.<item> and trigger alone', () => {
        const def = loopDef([
            { id: 'a', type: 'set', fields: { x: { kind: 'ref', path: 'loop.item.name' } } },
            {
                id: 'b',
                type: 'notification',
                body: 'from {{steps.a.output.x}} and {{trigger.output.who}}',
            },
        ]);
        const { graph } = compose(def);
        const a = graph.steps.find(s => s.id === 'lp1/a');
        const b = graph.steps.find(s => s.id === 'lp1/b');
        // The per-item variable is valid verbatim inside the flat graph.
        expect(a.fields.x.path).toBe('loop.item.name');
        expect(b.body).toContain('{{steps.lp1/a.output.x}}');
        // `trigger` inside a loop body means the AUTOMATION's trigger — unlike a
        // flowlet, where it means the flowlet's own input.
        expect(b.body).toContain('{{trigger.output.who}}');
    });

    it('expands an empty loop into a container with just the entry pill', () => {
        const { graph, sidecar } = compose(loopDef([]));
        expect(idsOf(graph)).toEqual(['lp1', 'after', `lp1/${LOOP_ENTRY_ID}`]);
        expect(sidecar.get('lp1').childIds).toEqual([`lp1/${LOOP_ENTRY_ID}`]);
    });

    it('sizes the container around its contents', () => {
        const { sidecar } = compose(loopDef());
        const { size } = sidecar.get('lp1');
        expect(size.height).toBeGreaterThan(CONTAINER_HEADER + CONTAINER_PAD);
        expect(size.width).toBeGreaterThanOrEqual(240);
    });

    it('needs no flowlets in the document', () => {
        // The old early return bailed out whenever `layers` was absent, which
        // would have made loops unexpandable in the great majority of routines.
        const def = loopDef();
        expect(def.layers).toBeUndefined();
        expect(compose(def).sidecar.size).toBe(1);
    });

    it('keeps the user\'s body positions instead of re-running dagre', () => {
        const def = loopDef([
            { id: 'a', type: 'set', position: { x: 500, y: 120 } },
            { id: 'b', type: 'set', position: { x: 900, y: 120 } },
        ]);
        const { graph } = compose(def);
        expect(graph.steps.find(s => s.id === 'lp1/a').position).toEqual({ x: 500, y: 120 });
        // The entry pill has nowhere to be stored, so it is derived: one card
        // to the left of the leftmost body step.
        expect(graph.steps.find(s => s.id === `lp1/${LOOP_ENTRY_ID}`).position)
            .toEqual({ x: 500 - (DIMS.width + 40), y: 120 });
    });

    it('lays a body out when positions are missing (AI-built definitions)', () => {
        const { graph } = compose(loopDef([{ id: 'a', type: 'set' }, { id: 'b', type: 'set' }]));
        for (const id of [`lp1/${LOOP_ENTRY_ID}`, 'lp1/a', 'lp1/b']) {
            const p = graph.steps.find(s => s.id === id).position;
            expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
        }
    });

    it('leaves the graph untouched when nothing is expanded', () => {
        const def = loopDef();
        const { graph, sidecar } = composeInlineGraph(def, def, new Set(), { dims: DIMS });
        expect(graph).toBe(def);
        expect(sidecar.size).toBe(0);
    });
});

describe('decomposeInlineGraph — loop body', () => {
    it('round-trips an untouched body byte for byte', () => {
        const def = loopDef();
        const { graph, sidecar } = compose(def);
        const { graph: out, layerPatches } = decomposeInlineGraph(graph, sidecar);
        expect(layerPatches).toEqual({});
        expect(idsOf(out)).toEqual(['lp1', 'after']);
        const body = loopIn(out).body;
        expect(body.map(s => s.id)).toEqual(['a', 'b']);
        expect(body[0].fields.x.path).toBe('loop.item.name');
        expect(body[1].body).toBe('hi {{steps.a.output.x}}');
    });

    it('drops the entry pill — it is never part of the definition', () => {
        const { graph, sidecar } = compose(loopDef());
        const { graph: out } = decomposeInlineGraph(graph, sidecar);
        expect(loopIn(out).body.some(s => s.id === LOOP_ENTRY_ID)).toBe(false);
        expect(JSON.stringify(out)).not.toContain(LOOP_ENTRY_ID);
    });

    it('reads the body order off the drawn chain', () => {
        const { graph, sidecar } = compose(loopDef());
        // The user dragged b in front of a.
        const rewired = {
            ...graph,
            edges: graph.edges.map((e) => {
                if (e.from === `lp1/${LOOP_ENTRY_ID}` && e.to === 'lp1/a') return { ...e, to: 'lp1/b' };
                if (e.from === 'lp1/a' && e.to === 'lp1/b') return { from: 'lp1/b', to: 'lp1/a' };
                return e;
            }),
        };
        const { graph: out } = decomposeInlineGraph(rewired, sidecar);
        expect(loopIn(out).body.map(s => s.id)).toEqual(['b', 'a']);
    });

    it('keeps a body step that lost its edges where it was', () => {
        const { graph, sidecar } = compose(loopDef());
        const detached = { ...graph, edges: graph.edges.filter(e => e.to !== 'lp1/b') };
        const { graph: out } = decomposeInlineGraph(detached, sidecar);
        expect(loopIn(out).body.map(s => s.id)).toEqual(['a', 'b']);
    });

    it('carries a new body step, its position and its bindings back', () => {
        const { graph, sidecar } = compose(loopDef());
        const withNew = {
            ...graph,
            steps: [...graph.steps, {
                id: 'lp1/c',
                type: 'set',
                position: { x: 40, y: 8 },
                fields: { y: { kind: 'ref', path: 'steps.lp1/a.output.x' } },
            }],
            edges: [...graph.edges, { from: 'lp1/b', to: 'lp1/c' }],
        };
        const { graph: out } = decomposeInlineGraph(withNew, sidecar);
        const body = loopIn(out).body;
        expect(body.map(s => s.id)).toEqual(['a', 'b', 'c']);
        expect(body[2].position).toEqual({ x: 40, y: 8 });
        expect(body[2].fields.y.path).toBe('steps.a.output.x');
    });

    it('drops the whole body when the loop step itself is deleted', () => {
        const { graph, sidecar } = compose(loopDef());
        const { graph: out } = decomposeInlineGraph(applyDeleteNodes(graph, 'lp1'), sidecar);
        expect(idsOf(out)).toEqual(['after']);
        expect(JSON.stringify(out)).not.toContain('lp1/');
    });

    it('deletes one body step without touching its siblings', () => {
        const { graph, sidecar } = compose(loopDef());
        const { graph: out } = decomposeInlineGraph(applyDeleteNodes(graph, 'lp1/a'), sidecar);
        expect(loopIn(out).body.map(s => s.id)).toEqual(['b']);
    });
});

describe('loops nested in other containers', () => {
    /** trg → lp1 (body: outerA, lp2 (body: innerA)) */
    const nestedDef = () => ({
        trigger: { id: 'trg', type: 'trigger', kind: 'manual', position: { x: 0, y: 0 } },
        steps: [{
            id: 'lp1',
            type: 'loop',
            overRef: 'trigger.output.rows',
            position: { x: 300, y: 0 },
            body: [
                { id: 'outerA', type: 'set' },
                { id: 'lp2', type: 'loop', overRef: 'loop.item.lines', itemVar: 'line', body: [{ id: 'innerA', type: 'set' }] },
            ],
        }],
        edges: [{ from: 'trg', to: 'lp1' }],
    });

    it('expands a loop inside a loop', () => {
        const def = nestedDef();
        const { graph, sidecar } = composeInlineGraph(def, def, new Set(['lp1', 'lp1/lp2']), { dims: DIMS });
        expect(sidecar.get('lp1/lp2').kind).toBe('loop');
        expect(sidecar.get('lp1/lp2').parentPrefix).toBe('lp1');
        expect(idsOf(graph)).toContain('lp1/lp2/innerA');

        const { graph: out } = decomposeInlineGraph(graph, sidecar);
        const inner = out.steps[0].body.find(s => s.id === 'lp2');
        expect(inner.body.map(s => s.id)).toEqual(['innerA']);
        expect(out.steps[0].body.map(s => s.id)).toEqual(['outerA', 'lp2']);
    });

    it('writes a loop expanded inside a flowlet into that flowlet\'s patch', () => {
        const def = {
            schemaVersion: 2,
            trigger: { id: 'trg', type: 'trigger', kind: 'manual', position: { x: 0, y: 0 } },
            steps: [{ id: 'cl1', type: 'call_layer', layerKey: 'enrich', position: { x: 300, y: 0 } }],
            edges: [{ from: 'trg', to: 'cl1' }],
            layers: {
                enrich: {
                    title: 'Enrich',
                    trigger: { id: 'ltrg', type: 'trigger', kind: 'layer_input', params: [], position: { x: 0, y: 0 } },
                    steps: [{ id: 'lp9', type: 'loop', overRef: 'trigger.rows', position: { x: 300, y: 0 }, body: [{ id: 'z', type: 'set' }] }],
                    edges: [{ from: 'ltrg', to: 'lp9' }],
                },
            },
        };
        const { graph, sidecar } = composeInlineGraph(def, def, new Set(['cl1', 'cl1/lp9']), { dims: DIMS });
        expect(idsOf(graph)).toContain('cl1/lp9/z');

        const { graph: out, layerPatches } = decomposeInlineGraph(graph, sidecar);
        // The main flow is untouched; the body rides in the flowlet patch.
        expect(idsOf(out)).toEqual(['cl1']);
        const loopStep = layerPatches.enrich.steps.find(s => s.id === 'lp9');
        expect(loopStep.body.map(s => s.id)).toEqual(['z']);
        // The flowlet's own input reference survived both unrewrites.
        expect(loopStep.overRef).toBe('trigger.rows');
    });
});

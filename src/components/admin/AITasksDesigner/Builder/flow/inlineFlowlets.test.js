import { describe, it, expect } from 'vitest';
import {
    composeInlineGraph,
    decomposeInlineGraph,
    shiftForExpansion,
    toDisplayPosition,
    fromDisplayPosition,
    parseInlineId,
    makeInlineId,
    isInlineId,
    sameInlineScope,
    layerKeyForNode,
    nextExpanded,
    containerAbsolutePosition,
    flowToScopePosition,
    prefixAddedStep,
    CONTAINER_PAD,
    CONTAINER_HEADER,
    MAX_INLINE_DEPTH,
} from './inlineFlowlets.js';
import { buildLayout, seedPositions } from './layout.js';
import { applyDeleteNodes } from './nodeOps.js';
import { applyAddNode } from '../DiagramPane.jsx';

const DIMS = { width: 240, height: 96 };

/**
 * root:   trg → cl1 (calls `enrich`) → after
 * enrich: ltrg → s1 → out
 */
const baseDef = () => ({
    schemaVersion: 2,
    trigger: { id: 'trg', type: 'trigger', kind: 'manual', position: { x: 0, y: 0 } },
    steps: [
        { id: 'cl1', type: 'call_layer', layerKey: 'enrich', label: 'Enrich', position: { x: 400, y: 0 } },
        { id: 'after', type: 'ai_step', label: 'After', position: { x: 800, y: 0 } },
    ],
    edges: [{ from: 'trg', to: 'cl1' }, { from: 'cl1', to: 'after' }],
    layers: {
        enrich: {
            title: 'Enrich contact',
            description: 'looks things up',
            trigger: { id: 'ltrg', type: 'trigger', kind: 'layer_input', params: [{ name: 'email' }], position: { x: 0, y: 0 } },
            steps: [
                { id: 's1', type: 'integration_action', tool: 'hubspot_lookup', position: { x: 300, y: 0 } },
                { id: 'out', type: 'layer_output', fields: {}, position: { x: 600, y: 0 } },
            ],
            edges: [{ from: 'ltrg', to: 's1' }, { from: 's1', to: 'out' }],
        },
    },
});

describe('inline id helpers', () => {
    it('round-trips a prefix and a local id', () => {
        expect(makeInlineId('cl1', 's1')).toBe('cl1/s1');
        expect(makeInlineId('', 's1')).toBe('s1');
        expect(parseInlineId('cl1/cl2/s7')).toEqual({ prefix: 'cl1/cl2', localId: 's7' });
        expect(parseInlineId('s7')).toEqual({ prefix: '', localId: 's7' });
        expect(isInlineId('cl1/s1')).toBe(true);
        expect(isInlineId('s1')).toBe(false);
    });

    it('sameInlineScope only pairs nodes of the same graph', () => {
        expect(sameInlineScope('a', 'b')).toBe(true);
        expect(sameInlineScope('cl1/a', 'cl1/b')).toBe(true);
        expect(sameInlineScope('cl1/a', 'b')).toBe(false);
        expect(sameInlineScope('cl1/a', 'cl1/cl2/b')).toBe(false);
    });
});

describe('composeInlineGraph', () => {
    it('returns the graph untouched when nothing is expanded', () => {
        const def = baseDef();
        const { graph, sidecar } = composeInlineGraph(def, def, new Set(), { dims: DIMS });
        expect(graph).toBe(def);
        expect(sidecar.size).toBe(0);
    });

    it('folds the flowlet in with prefixed ids and edges', () => {
        const def = baseDef();
        const { graph, sidecar, expanded } = composeInlineGraph(def, def, new Set(['cl1']), { dims: DIMS });
        expect(expanded).toEqual(new Set(['cl1']));
        const ids = graph.steps.map(s => s.id);
        expect(ids).toContain('cl1');                       // the container step stays
        expect(ids).toEqual(expect.arrayContaining(['cl1/ltrg', 'cl1/s1', 'cl1/out']));
        expect(graph.edges).toEqual(expect.arrayContaining([
            { from: 'trg', to: 'cl1' },
            { from: 'cl1', to: 'after' },
            { from: 'cl1/ltrg', to: 'cl1/s1' },
            { from: 'cl1/s1', to: 'cl1/out' },
        ]));
        // Original definition untouched.
        expect(def.steps).toHaveLength(2);
        expect(def.layers.enrich.steps).toHaveLength(2);

        const entry = sidecar.get('cl1');
        expect(entry.layerKey).toBe('enrich');
        expect(entry.parentPrefix).toBe('');
        expect(entry.triggerId).toBe('cl1/ltrg');
        expect(entry.childIds).toEqual(['cl1/ltrg', 'cl1/s1', 'cl1/out']);
    });

    it('sizes the container from its contents', () => {
        const def = baseDef();
        const { sidecar } = composeInlineGraph(def, def, new Set(['cl1']), { dims: DIMS });
        const { size } = sidecar.get('cl1');
        // rightmost child sits at x=600 → 600 + PAD + card width + PAD
        expect(size.width).toBe(600 + CONTAINER_PAD + DIMS.width + CONTAINER_PAD);
        expect(size.height).toBe(CONTAINER_HEADER + CONTAINER_PAD + DIMS.height + CONTAINER_PAD);
    });

    it('lays a flowlet out with dagre when its nodes have no saved positions', () => {
        const def = baseDef();
        delete def.layers.enrich.trigger.position;
        for (const s of def.layers.enrich.steps) delete s.position;
        const { graph } = composeInlineGraph(def, def, new Set(['cl1']), { dims: DIMS });
        for (const id of ['cl1/ltrg', 'cl1/s1', 'cl1/out']) {
            const step = graph.steps.find(s => s.id === id);
            expect(Number.isFinite(step.position.x)).toBe(true);
            expect(Number.isFinite(step.position.y)).toBe(true);
        }
    });

    it('nests: a flowlet expanded inside a flowlet', () => {
        const def = baseDef();
        def.layers.enrich.steps.push({ id: 'cl2', type: 'call_layer', layerKey: 'score', position: { x: 300, y: 200 } });
        def.layers.score = {
            title: 'Score',
            trigger: { id: 'trg2', type: 'trigger', kind: 'layer_input', params: [], position: { x: 0, y: 0 } },
            steps: [{ id: 'o2', type: 'layer_output', fields: {}, position: { x: 300, y: 0 } }],
            edges: [{ from: 'trg2', to: 'o2' }],
        };
        const { graph, sidecar } = composeInlineGraph(def, def, new Set(['cl1', 'cl1/cl2']), { dims: DIMS });
        expect(graph.steps.map(s => s.id)).toEqual(expect.arrayContaining(['cl1/cl2', 'cl1/cl2/trg2', 'cl1/cl2/o2']));
        expect(sidecar.get('cl1/cl2').parentPrefix).toBe('cl1');
        expect(sidecar.get('cl1/cl2').depth).toBe(1);
        // The nested container grew, so its parent had to grow around it.
        const inner = sidecar.get('cl1/cl2').size;
        expect(sidecar.get('cl1').size.height).toBeGreaterThan(inner.height);
    });

    it('refuses to expand a flowlet already on the expansion path (cycle)', () => {
        const def = baseDef();
        def.layers.enrich.steps.push({ id: 'cl2', type: 'call_layer', layerKey: 'enrich', position: { x: 300, y: 200 } });
        const { sidecar } = composeInlineGraph(def, def, new Set(['cl1', 'cl1/cl2']), { dims: DIMS });
        expect(sidecar.has('cl1')).toBe(true);
        expect(sidecar.has('cl1/cl2')).toBe(false);
    });

    it('stops at MAX_INLINE_DEPTH', () => {
        // A chain l0 → l1 → … each calling the next, all expanded.
        const def = { trigger: { id: 'trg', type: 'trigger', kind: 'manual', position: { x: 0, y: 0 } }, steps: [], edges: [], layers: {} };
        const chain = MAX_INLINE_DEPTH + 3;
        def.steps.push({ id: 'c0', type: 'call_layer', layerKey: 'l0', position: { x: 0, y: 0 } });
        for (let i = 0; i < chain; i++) {
            def.layers[`l${i}`] = {
                title: `l${i}`,
                trigger: { id: 't', type: 'trigger', kind: 'layer_input', params: [], position: { x: 0, y: 0 } },
                steps: i + 1 < chain
                    ? [{ id: 'c', type: 'call_layer', layerKey: `l${i + 1}`, position: { x: 300, y: 0 } }]
                    : [{ id: 'out', type: 'layer_output', fields: {}, position: { x: 300, y: 0 } }],
                edges: [],
            };
        }
        const expanded = new Set();
        let prefix = 'c0';
        expanded.add(prefix);
        for (let i = 0; i < chain; i++) { prefix = `${prefix}/c`; expanded.add(prefix); }
        const { sidecar } = composeInlineGraph(def, def, expanded, { dims: DIMS });
        expect(sidecar.size).toBe(MAX_INLINE_DEPTH);
    });

    it('ignores an expanded key whose flowlet no longer exists', () => {
        const def = baseDef();
        delete def.layers.enrich;
        const { graph, sidecar } = composeInlineGraph(def, def, new Set(['cl1']), { dims: DIMS });
        expect(sidecar.size).toBe(0);
        expect(graph).toBe(def);
    });
});

describe('binding rewrites', () => {
    const withRefs = () => {
        const def = baseDef();
        const layer = def.layers.enrich;
        layer.steps[0].inputs = {
            email: { kind: 'ref', path: 'trigger.output.email' },
            note: { kind: 'template', template: 'for {{trigger.output.email}} — see the trigger. docs' },
        };
        layer.steps[1].fields = { score: { kind: 'ref', path: 'steps.s1.output.score' } };
        layer.steps.push({
            id: 'c1', type: 'condition', position: { x: 450, y: 0 },
            expr: 'steps.s1.output.score > 0 && trigger.output.email != ""',
            prompt: 'Look at {{steps.s1.output.score}} carefully',
        });
        return def;
    };

    it('re-points a flowlet\'s refs at the flat ids, including its input node', () => {
        const def = withRefs();
        const { graph } = composeInlineGraph(def, def, new Set(['cl1']), { dims: DIMS });
        const s1 = graph.steps.find(s => s.id === 'cl1/s1');
        expect(s1.inputs.email.path).toBe('steps.cl1/ltrg.output.email');
        // Only the placeholder is rewritten — the prose "trigger." is not.
        expect(s1.inputs.note.template).toBe('for {{steps.cl1/ltrg.output.email}} — see the trigger. docs');
        const out = graph.steps.find(s => s.id === 'cl1/out');
        expect(out.fields.score.path).toBe('steps.cl1/s1.output.score');
        const c1 = graph.steps.find(s => s.id === 'cl1/c1');
        expect(c1.expr).toBe('steps.cl1/s1.output.score > 0 && steps.cl1/ltrg.output.email != ""');
        expect(c1.prompt).toBe('Look at {{steps.cl1/s1.output.score}} carefully');
    });

    it('leaves the root graph\'s own refs alone', () => {
        const def = withRefs();
        def.steps[1].inputs = { x: { kind: 'ref', path: 'trigger.output.who' } };
        const { graph } = composeInlineGraph(def, def, new Set(['cl1']), { dims: DIMS });
        expect(graph.steps.find(s => s.id === 'after').inputs.x.path).toBe('trigger.output.who');
    });

    it('restores the local refs on decompose', () => {
        const def = withRefs();
        const { graph, sidecar } = composeInlineGraph(def, def, new Set(['cl1']), { dims: DIMS });
        const { layerPatches } = decomposeInlineGraph(graph, sidecar);
        expect(layerPatches.enrich.steps).toEqual(def.layers.enrich.steps);
    });

    it('turns a ref auto-mapped from the container\'s input node back into `trigger`', () => {
        const def = withRefs();
        const { graph, sidecar } = composeInlineGraph(def, def, new Set(['cl1']), { dims: DIMS });
        // What applyAutoMapToStep would write when wiring from the flowlet input.
        const edited = {
            ...graph,
            steps: graph.steps.map(s => (s.id === 'cl1/out'
                ? { ...s, fields: { ...s.fields, who: { kind: 'ref', path: 'steps.cl1/ltrg.output.email' } } }
                : s)),
        };
        const { layerPatches } = decomposeInlineGraph(edited, sidecar);
        expect(layerPatches.enrich.steps.find(s => s.id === 'out').fields.who.path).toBe('trigger.output.email');
    });
});

describe('coordinate transforms', () => {
    it('offsets inline nodes by the container chrome and inverts exactly', () => {
        const def = baseDef();
        const { sidecar } = composeInlineGraph(def, def, new Set(['cl1']), { dims: DIMS });
        const stored = { x: 300, y: 40 };
        const display = toDisplayPosition('cl1/s1', stored, sidecar);
        expect(display).toEqual({ x: 300 + CONTAINER_PAD, y: 40 + CONTAINER_HEADER + CONTAINER_PAD });
        expect(fromDisplayPosition('cl1/s1', display, sidecar)).toEqual(stored);
    });

    it('keeps every child inside the box when a flowlet node sits at negative coordinates', () => {
        const def = baseDef();
        def.layers.enrich.steps[0].position = { x: -120, y: -60 };
        const { sidecar } = composeInlineGraph(def, def, new Set(['cl1']), { dims: DIMS });
        const display = toDisplayPosition('cl1/s1', { x: -120, y: -60 }, sidecar);
        expect(display.x).toBe(CONTAINER_PAD);
        expect(display.y).toBe(CONTAINER_HEADER + CONTAINER_PAD);
        expect(fromDisplayPosition('cl1/s1', display, sidecar)).toEqual({ x: -120, y: -60 });
    });

    it('applies and inverts the neighbour shift on top-level nodes', () => {
        const def = baseDef();
        const { graph, sidecar } = composeInlineGraph(def, def, new Set(['cl1']), { dims: DIMS });
        const shift = shiftForExpansion(graph, sidecar, DIMS);
        const display = toDisplayPosition('after', { x: 800, y: 0 }, sidecar, shift);
        expect(display.x).toBeGreaterThan(800);
        expect(fromDisplayPosition('after', display, sidecar, shift)).toEqual({ x: 800, y: 0 });
    });
});

describe('shiftForExpansion', () => {
    it('pushes only the nodes the container grew into', () => {
        const def = baseDef();
        // `before` sits left of the container and must not move.
        def.steps.push({ id: 'before', type: 'ai_step', position: { x: 100, y: 0 } });
        const { graph, sidecar } = composeInlineGraph(def, def, new Set(['cl1']), { dims: DIMS });
        const shift = shiftForExpansion(graph, sidecar, DIMS);
        const grown = sidecar.get('cl1').size.width - DIMS.width;
        expect(shift.get('after')).toEqual({ dx: grown, dy: 0 });
        expect(shift.has('before')).toBe(false);
        expect(shift.has('trg')).toBe(false);
        expect(shift.has('cl1')).toBe(false);
    });

    it('pushes downward too, and accumulates over several containers', () => {
        const def = baseDef();
        def.steps.push({ id: 'below', type: 'ai_step', position: { x: 400, y: 400 } });
        def.steps.push({ id: 'cl3', type: 'call_layer', layerKey: 'enrich', position: { x: 0, y: 200 } });
        const { graph, sidecar } = composeInlineGraph(def, def, new Set(['cl1', 'cl3']), { dims: DIMS });
        const shift = shiftForExpansion(graph, sidecar, DIMS);
        const dh1 = sidecar.get('cl1').size.height - DIMS.height;
        const dh3 = sidecar.get('cl3').size.height - DIMS.height;
        // `below` is under both containers, so it takes both pushes.
        expect(shift.get('below').dy).toBe(dh1 + dh3);
    });

    it('is empty when nothing is expanded', () => {
        const def = baseDef();
        expect(shiftForExpansion(def, new Map(), DIMS).size).toBe(0);
    });
});

describe('decomposeInlineGraph', () => {
    it('round-trips an unedited compose back to the original graphs', () => {
        const def = baseDef();
        const { graph, sidecar } = composeInlineGraph(def, def, new Set(['cl1']), { dims: DIMS });
        const { graph: scope, layerPatches } = decomposeInlineGraph(graph, sidecar);
        expect(scope.steps).toEqual(def.steps);
        expect(scope.edges).toEqual(def.edges);
        expect(layerPatches.enrich.trigger).toEqual(def.layers.enrich.trigger);
        expect(layerPatches.enrich.steps).toEqual(def.layers.enrich.steps);
        expect(layerPatches.enrich.edges).toEqual(def.layers.enrich.edges);
        // Metadata the canvas never touches survives.
        expect(layerPatches.enrich.title).toBe('Enrich contact');
        expect(layerPatches.enrich.description).toBe('looks things up');
    });

    it('routes an edit inside the container to the flowlet, not the root', () => {
        const def = baseDef();
        const { graph, sidecar } = composeInlineGraph(def, def, new Set(['cl1']), { dims: DIMS });
        const edited = applyDeleteNodes(graph, ['cl1/s1']);
        const { graph: scope, layerPatches } = decomposeInlineGraph(edited, sidecar);
        expect(scope.steps.map(s => s.id)).toEqual(['cl1', 'after']);
        expect(layerPatches.enrich.steps.map(s => s.id)).toEqual(['out']);
        // applyDeleteNodes healed the flowlet's own wiring around the deletion.
        expect(layerPatches.enrich.edges).toEqual([{ from: 'ltrg', to: 'out' }]);
    });

    it('deleting the container removes the call site but keeps the flowlet', () => {
        const def = baseDef();
        const { graph, sidecar } = composeInlineGraph(def, def, new Set(['cl1']), { dims: DIMS });
        const edited = applyDeleteNodes(graph, ['cl1']);
        const { graph: scope, layerPatches } = decomposeInlineGraph(edited, sidecar);
        expect(scope.steps.map(s => s.id)).toEqual(['after']);
        // No orphaned `cl1/...` steps leaked into the root graph…
        expect(scope.steps.some(s => isInlineId(s.id))).toBe(false);
        expect(scope.edges.some(e => isInlineId(e.from) || isInlineId(e.to))).toBe(false);
        // …and no patch was emitted, so definition.layers.enrich stays as it was.
        expect(layerPatches).toEqual({});
    });

    it('drops a nested flowlet patch when its parent call site is deleted', () => {
        const def = baseDef();
        def.layers.enrich.steps.push({ id: 'cl2', type: 'call_layer', layerKey: 'score', position: { x: 300, y: 200 } });
        def.layers.score = {
            title: 'Score',
            trigger: { id: 'trg2', type: 'trigger', kind: 'layer_input', params: [], position: { x: 0, y: 0 } },
            steps: [{ id: 'o2', type: 'layer_output', fields: {}, position: { x: 300, y: 0 } }],
            edges: [],
        };
        const { graph, sidecar } = composeInlineGraph(def, def, new Set(['cl1', 'cl1/cl2']), { dims: DIMS });
        const { layerPatches } = decomposeInlineGraph(applyDeleteNodes(graph, ['cl1']), sidecar);
        expect(layerPatches).toEqual({});
    });

    it('drops an edge that somehow crosses a container boundary', () => {
        const def = baseDef();
        const { graph, sidecar } = composeInlineGraph(def, def, new Set(['cl1']), { dims: DIMS });
        const edited = { ...graph, edges: [...graph.edges, { from: 'cl1/s1', to: 'after' }] };
        const { graph: scope, layerPatches } = decomposeInlineGraph(edited, sidecar);
        expect(scope.edges).toEqual(def.edges);
        expect(layerPatches.enrich.edges).toEqual(def.layers.enrich.edges);
    });

    it('keeps the previous trigger if the flowlet input node went missing', () => {
        const def = baseDef();
        const { graph, sidecar } = composeInlineGraph(def, def, new Set(['cl1']), { dims: DIMS });
        const edited = { ...graph, steps: graph.steps.filter(s => s.id !== 'cl1/ltrg') };
        const { layerPatches } = decomposeInlineGraph(edited, sidecar);
        expect(layerPatches.enrich.trigger).toEqual(def.layers.enrich.trigger);
    });

    it('is a no-op without a sidecar', () => {
        const def = baseDef();
        expect(decomposeInlineGraph(def, new Map())).toEqual({ graph: def, layerPatches: {} });
    });
});

describe('layerKeyForNode', () => {
    it('names the flowlet an inline node belongs to', () => {
        const def = baseDef();
        const { sidecar } = composeInlineGraph(def, def, new Set(['cl1']), { dims: DIMS });
        expect(layerKeyForNode('cl1/s1', sidecar)).toBe('enrich');
        expect(layerKeyForNode('after', sidecar)).toBe(null);
    });
});

describe('buildLayout — inline flowlets', () => {
    const layout = (def, expanded) => {
        const { graph, sidecar } = composeInlineGraph(def, def, expanded, { dims: DIMS });
        const shiftById = shiftForExpansion(graph, sidecar, DIMS);
        return {
            sidecar,
            ...buildLayout(graph, { runByStep: new Map(), issuesByStep: new Map(), dims: DIMS, sidecar, shiftById }),
        };
    };

    it('renders the container as a sized parent and its contents as children', () => {
        const def = baseDef();
        const { nodes, sidecar } = layout(def, new Set(['cl1']));
        const container = nodes.find(n => n.id === 'cl1');
        expect(container.type).toBe('call_layer');
        expect(container.style).toEqual(sidecar.get('cl1').size);
        expect(container.data.inlineExpanded.layerKey).toBe('enrich');
        expect(container.parentId).toBeUndefined();

        for (const id of ['cl1/ltrg', 'cl1/s1', 'cl1/out']) {
            const child = nodes.find(n => n.id === id);
            expect(child.parentId).toBe('cl1');
            expect(child.extent).toBe('parent');
            expect(child.data.inlineParent.layerKey).toBe('enrich');
        }
    });

    it('emits parents before their children (React Flow requires it)', () => {
        const def = baseDef();
        def.layers.enrich.steps.push({ id: 'cl2', type: 'call_layer', layerKey: 'score', position: { x: 300, y: 200 } });
        def.layers.score = {
            title: 'Score',
            trigger: { id: 'trg2', type: 'trigger', kind: 'layer_input', params: [], position: { x: 0, y: 0 } },
            steps: [{ id: 'o2', type: 'layer_output', fields: {}, position: { x: 300, y: 0 } }],
            edges: [],
        };
        const { nodes } = layout(def, new Set(['cl1', 'cl1/cl2']));
        const at = (id) => nodes.findIndex(n => n.id === id);
        expect(at('cl1')).toBeLessThan(at('cl1/cl2'));
        expect(at('cl1/cl2')).toBeLessThan(at('cl1/cl2/o2'));
    });

    it("treats a flowlet's layer_input as a trigger node but not the diagnosable one", () => {
        const def = baseDef();
        const { nodes } = layout(def, new Set(['cl1']));
        const input = nodes.find(n => n.id === 'cl1/ltrg');
        expect(input.type).toBe('trigger');
        expect(input.data.isTrigger).toBe(true);
        expect(input.deletable).toBe(false);
        expect(input.data.onDiagnose).toBe(null);
    });

    it('draws the flowlet edges and keeps the parent edges on the container', () => {
        const def = baseDef();
        const { edges } = layout(def, new Set(['cl1']));
        const pairs = edges.map(e => `${e.source}->${e.target}`);
        expect(pairs).toEqual(expect.arrayContaining([
            'trg->cl1', 'cl1->after', 'cl1/ltrg->cl1/s1', 'cl1/s1->cl1/out',
        ]));
    });

    it('shifts the downstream neighbour without touching the stored position', () => {
        const def = baseDef();
        const { nodes } = layout(def, new Set(['cl1']));
        expect(nodes.find(n => n.id === 'after').position.x).toBeGreaterThan(800);
        expect(def.steps.find(s => s.id === 'after').position).toEqual({ x: 800, y: 0 });
    });

    it('never dagre-mixes inline coordinates when a top-level node lacks a position', () => {
        const def = baseDef();
        delete def.steps.find(s => s.id === 'after').position;
        const { nodes } = layout(def, new Set(['cl1']));
        // The flowlet's own nodes keep their layer-space coordinates (offset by
        // the container chrome only) rather than being re-laid-out with the root.
        expect(nodes.find(n => n.id === 'cl1/s1').position)
            .toEqual({ x: 300 + CONTAINER_PAD, y: CONTAINER_HEADER + CONTAINER_PAD });
    });

    it('seedPositions leaves inline steps alone', () => {
        const def = baseDef();
        delete def.steps.find(s => s.id === 'after').position;
        const { graph } = composeInlineGraph(def, def, new Set(['cl1']), { dims: DIMS });
        const seeded = seedPositions(graph, DIMS);
        expect(seeded.steps.find(s => s.id === 'cl1/s1').position).toEqual({ x: 300, y: 0 });
        expect(seeded.steps.find(s => s.id === 'after').position).toBeDefined();
    });
});

describe('adding a step inside an expanded flowlet', () => {
    it('places a dropped step where it was dropped, in the flowlet\'s own space', () => {
        const def = baseDef();
        const { graph, sidecar } = composeInlineGraph(def, def, new Set(['cl1']), { dims: DIMS });
        const shift = shiftForExpansion(graph, sidecar, DIMS);
        // The container sits at x=400; its contents start PAD/HEADER inside it.
        expect(containerAbsolutePosition('cl1', graph, sidecar, shift)).toEqual({ x: 400, y: 0 });
        const dropped = { x: 400 + CONTAINER_PAD + 150, y: CONTAINER_HEADER + CONTAINER_PAD + 40 };
        expect(flowToScopePosition('cl1', dropped, graph, sidecar, shift)).toEqual({ x: 150, y: 40 });
        // A drop outside any container is already in the right space.
        expect(flowToScopePosition('', dropped, graph, sidecar, shift)).toBe(dropped);
    });

    it('lands the new step in the flowlet, wired to the node it was dropped on', () => {
        const def = baseDef();
        const { graph, sidecar } = composeInlineGraph(def, def, new Set(['cl1']), { dims: DIMS });
        // What BuildTab.addStepAt does for a drop onto `cl1/s1` inside the box.
        const added = applyAddNode(graph, { kind: 'set', label: 'Shape it' }, { x: 300, y: 150 }, 'cl1/s1', null);
        const newId = added.steps[added.steps.length - 1].id;
        const next = prefixAddedStep(added, newId, 'cl1');
        const { graph: scope, layerPatches } = decomposeInlineGraph(next, sidecar);

        // Nothing leaked into the flow around the flowlet…
        expect(scope.steps.map(s => s.id)).toEqual(['cl1', 'after']);
        // …and the flowlet gained the step, wired from s1, at the dropped spot.
        const local = layerPatches.enrich.steps.find(s => s.id === newId);
        expect(local).toBeTruthy();
        expect(local.position).toEqual({ x: 300, y: 150 });
        expect(layerPatches.enrich.edges).toEqual(expect.arrayContaining([{ from: 's1', to: newId }]));
    });

    it('leaves a step added to the flow around the flowlet alone', () => {
        const def = baseDef();
        const { graph, sidecar } = composeInlineGraph(def, def, new Set(['cl1']), { dims: DIMS });
        const added = applyAddNode(graph, { kind: 'set', label: 'Shape it' }, { x: 1200, y: 0 }, 'after', null);
        const { graph: scope, layerPatches } = decomposeInlineGraph(added, sidecar);
        expect(scope.steps).toHaveLength(3);
        expect(layerPatches.enrich.steps.map(s => s.id)).toEqual(['s1', 'out']);
    });
});

describe('nextExpanded', () => {
    it('collapsing a container collapses everything nested in it', () => {
        const prev = new Set(['cl1', 'cl1/cl2', 'other']);
        expect(nextExpanded(prev, 'cl1')).toEqual(new Set(['other']));
    });

    it('expanding one call site collapses another of the same flowlet', () => {
        const sidecar = new Map([
            ['clA', { prefix: 'clA', layerKey: 'enrich' }],
            ['clB', { prefix: 'clB', layerKey: 'enrich' }],
            ['clC', { prefix: 'clC', layerKey: 'other' }],
        ]);
        const prev = new Set(['clA', 'clC']);
        expect(nextExpanded(prev, 'clB', 'enrich', sidecar)).toEqual(new Set(['clC', 'clB']));
    });
});

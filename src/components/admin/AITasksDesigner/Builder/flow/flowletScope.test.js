import { describe, it, expect } from 'vitest';
import { setLayerDescription, listLayers, renameLayer, getLayerDependencies, isLayerEmpty, deleteLayerAndCalls, layerCallScopes } from './flowletScope.js';

const baseDef = () => ({
    trigger: { id: 'trg', type: 'trigger', kind: 'manual' },
    steps: [],
    edges: [],
    layers: {
        enrich: {
            title: 'Enrich contact',
            trigger: { id: 'trg', type: 'trigger', kind: 'layer_input', params: [{ name: 'email', required: true }, { name: 'name' }] },
            steps: [
                { id: 's1', type: 'integration_action', tool: 'hubspot_lookup', label: 'Look up' },
                { id: 's2', type: 'ai_step', label: 'Score' },
                { id: 'out', type: 'layer_output', fields: { score: { kind: 'literal', value: 1 }, tier: { kind: 'literal', value: 'a' } } },
            ],
            edges: [],
        },
    },
});

describe('setLayerDescription', () => {
    it('sets the description on the target layer without mutating the input', () => {
        const def = baseDef();
        const next = setLayerDescription(def, 'enrich', 'Looks up a contact and scores them.');
        expect(next.layers.enrich.description).toBe('Looks up a contact and scores them.');
        // Immutability: original untouched, new object identity.
        expect(def.layers.enrich.description).toBeUndefined();
        expect(next).not.toBe(def);
        expect(next.layers.enrich).not.toBe(def.layers.enrich);
        // Other layer fields preserved.
        expect(next.layers.enrich.title).toBe('Enrich contact');
        expect(next.layers.enrich.steps).toBe(def.layers.enrich.steps);
    });

    it('is a no-op (returns the same def) when the key does not exist', () => {
        const def = baseDef();
        expect(setLayerDescription(def, 'missing', 'x')).toBe(def);
    });

    it('coerces a nullish description to an empty string', () => {
        const def = baseDef();
        expect(setLayerDescription(def, 'enrich', null).layers.enrich.description).toBe('');
        expect(setLayerDescription(def, 'enrich', undefined).layers.enrich.description).toBe('');
    });

    it('does not disturb renameLayer round-trips', () => {
        let def = baseDef();
        def = setLayerDescription(def, 'enrich', 'desc');
        def = renameLayer(def, 'enrich', 'New name');
        expect(def.layers.enrich.title).toBe('New name');
        expect(def.layers.enrich.description).toBe('desc');
    });
});

describe('listLayers (extended shape)', () => {
    it('surfaces description, stepCount (excluding layer_output), params and outputFields', () => {
        const def = baseDef();
        def.layers.enrich.description = 'A summary.';
        const [row] = listLayers(def);
        expect(row.key).toBe('enrich');
        expect(row.title).toBe('Enrich contact');
        expect(row.description).toBe('A summary.');
        expect(row.params).toHaveLength(2);
        expect(row.outputFields).toEqual(['score', 'tier']);
        // stepCount excludes the terminal layer_output (it's plumbing).
        expect(row.stepCount).toBe(2);
    });

    it('defaults description to "" and tolerates missing/empty layers map', () => {
        const [row] = listLayers(baseDef());
        expect(row.description).toBe('');
        expect(listLayers(null)).toEqual([]);
        expect(listLayers({})).toEqual([]);
    });
});

describe('getLayerDependencies', () => {
    // Main flow calls `digest`; `digest` calls `enrich` (one inside a loop body).
    const depDef = () => ({
        trigger: { id: 'trg', type: 'trigger', kind: 'manual' },
        steps: [{ id: 'cl0', type: 'call_layer', layerKey: 'digest' }],
        edges: [],
        layers: {
            enrich: {
                title: 'Enrich',
                trigger: { id: 'trg', type: 'trigger', kind: 'layer_input', params: [] },
                steps: [{ id: 'out', type: 'layer_output', fields: {} }],
                edges: [],
            },
            digest: {
                title: 'Digest',
                trigger: { id: 'trg', type: 'trigger', kind: 'layer_input', params: [] },
                steps: [
                    { id: 'loop1', type: 'loop', body: [{ id: 'd1', type: 'call_layer', layerKey: 'enrich' }] },
                    { id: 'out', type: 'layer_output', fields: {} },
                ],
                edges: [],
            },
        },
    });

    it('reports what a layer calls (descending into loop bodies) and who calls it', () => {
        const def = depDef();
        expect(getLayerDependencies(def, 'digest')).toEqual({ calls: ['enrich'], callers: ['root'] });
        expect(getLayerDependencies(def, 'enrich')).toEqual({ calls: [], callers: ['digest'] });
    });

    it('does not list a self-reference and dedups repeats', () => {
        const def = {
            steps: [],
            layers: {
                a: { steps: [
                    { id: 'x', type: 'call_layer', layerKey: 'a' },   // self — ignored
                    { id: 'y', type: 'call_layer', layerKey: 'b' },
                    { id: 'z', type: 'call_layer', layerKey: 'b' },   // dup
                    { id: 'out', type: 'layer_output', fields: {} },
                ] },
                b: { steps: [{ id: 'out', type: 'layer_output', fields: {} }] },
            },
        };
        expect(getLayerDependencies(def, 'a').calls).toEqual(['b']);
    });

    it('tolerates missing def / unknown key', () => {
        expect(getLayerDependencies(null, 'x')).toEqual({ calls: [], callers: [] });
        expect(getLayerDependencies({ layers: {} }, 'nope')).toEqual({ calls: [], callers: [] });
    });
});

describe('isLayerEmpty / deleteLayerAndCalls (BFSF-340)', () => {
    // The palette's "Create flowlet" drops a call_layer node as part of
    // creating one, so a brand-new flowlet is instantly "in use" and its
    // delete button greys out. An empty one is safe to remove wholesale.
    const defWithCalls = () => ({
        trigger: { id: 'trg', type: 'trigger', kind: 'manual' },
        steps: [
            { id: 'a', type: 'ai_step' },
            { id: 'cl0', type: 'call_layer', layerKey: 'fresh' },
            { id: 'z', type: 'notification' },
            { id: 'lp', type: 'loop', body: [{ id: 'cl1', type: 'call_layer', layerKey: 'fresh' }] },
        ],
        edges: [
            { from: 'trg', to: 'a' }, { from: 'a', to: 'cl0' }, { from: 'cl0', to: 'z' },
        ],
        layers: {
            fresh: { title: 'New flowlet', trigger: { id: 'trg', type: 'trigger', kind: 'layer_input', params: [] }, steps: [{ id: 'out', type: 'layer_output', fields: {} }], edges: [] },
            other: { title: 'Other', trigger: { id: 'trg', type: 'trigger', kind: 'layer_input', params: [] }, steps: [{ id: 'o1', type: 'call_layer', layerKey: 'fresh' }, { id: 'out', type: 'layer_output', fields: {} }], edges: [] },
        },
    });

    it('treats a skeleton flowlet (layer_output only) as empty', () => {
        const def = defWithCalls();
        expect(isLayerEmpty(def, 'fresh')).toBe(true);
        expect(isLayerEmpty(def, 'other')).toBe(false);
        expect(isLayerEmpty(def, 'nope')).toBe(false);
    });

    it('drops the flowlet and every call site, healing the graph around them', () => {
        const next = deleteLayerAndCalls(defWithCalls(), 'fresh');
        expect(next.layers.fresh).toBeUndefined();
        expect(next.steps.map(s => s.id)).toEqual(['a', 'z', 'lp']);
        // The neighbours of the removed call node reconnect.
        expect(next.edges).toContainEqual(expect.objectContaining({ from: 'a', to: 'z' }));
        // …in nested bodies and in sibling flowlets too.
        expect(next.steps.find(s => s.id === 'lp').body).toEqual([]);
        expect(next.layers.other.steps.map(s => s.id)).toEqual(['out']);
    });

    it('leaves the definition alone for an unknown key', () => {
        const def = defWithCalls();
        expect(deleteLayerAndCalls(def, 'nope').steps.map(s => s.id)).toEqual(['a', 'cl0', 'z', 'lp']);
    });

    it('names each call site by scope', () => {
        expect(layerCallScopes(defWithCalls(), 'fresh').sort()).toEqual(['other', 'root', 'root']);
    });
});

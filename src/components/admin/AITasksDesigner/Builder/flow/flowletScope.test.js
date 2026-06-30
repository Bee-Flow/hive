import { describe, it, expect } from 'vitest';
import { setLayerDescription, listLayers, renameLayer, getLayerDependencies } from './flowletScope.js';

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

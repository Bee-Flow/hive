import { describe, it, expect } from 'vitest';
import { applyAddNode } from './DiagramPane';

/**
 * BFSF-318 regression: adding a trigger to a shapeless base definition must
 * still yield a graph the server validator accepts.
 *
 * The failure this locks out: `applyAddNode`'s `__replaceTrigger` branch is a
 * key-preserving spread, and `seedPositions` early-returns once every node has
 * a position (a freshly built trigger always does). Given a poisoned `{}` base
 * — which a `PUT { definition: null }` used to persist and which reads back as
 * truthy — it emitted `{ trigger }` with no `steps`/`edges`, and the save
 * failed with "'steps' must be an array.; 'edges' must be an array."
 *
 * The pre-existing applyAddNode tests (multiTrigger.test.js,
 * flow/branchEdges.test.js) only ever pass a fully-formed definition, so this
 * path had no coverage at all.
 */
const TRIGGER_PAYLOAD = { kind: 'trigger', triggerKind: 'schedule', label: 'Schedule' };

const wellFormed = (def) => Array.isArray(def.steps) && Array.isArray(def.edges);

describe('applyAddNode — shape normalisation of the base definition', () => {
    for (const [name, base] of [
        ['a poisoned empty object', {}],
        ['a trigger-only object', { trigger: { id: 'trg', type: 'trigger', kind: 'manual', position: { x: 0, y: 0 } } }],
        ['steps present but edges missing', { steps: [] }],
        ['edges present but steps missing', { edges: [] }],
    ]) {
        it(`yields steps+edges arrays when replacing the trigger on ${name}`, () => {
            const next = applyAddNode(base, TRIGGER_PAYLOAD, { x: 10, y: 20 });
            expect(wellFormed(next)).toBe(true);
            expect(next.trigger.kind).toBe('schedule');
        });

        it(`yields steps+edges arrays when adding a step to ${name}`, () => {
            const next = applyAddNode(base, { kind: 'condition', label: 'If' }, { x: 10, y: 20 });
            expect(wellFormed(next)).toBe(true);
            expect(next.steps).toHaveLength(1);
        });
    }

    it('yields steps+edges arrays when appending a secondary trigger to {}', () => {
        const next = applyAddNode(
            {},
            { kind: 'trigger', triggerKind: 'webhook', label: 'Webhook', asSecondaryTrigger: true },
            { x: 0, y: 0 },
        );
        expect(wellFormed(next)).toBe(true);
        expect(next.triggers).toHaveLength(1);
    });

    it('preserves the existing trigger id when replacing the kind', () => {
        const base = { trigger: { id: 'trg_keep', type: 'trigger', kind: 'manual', position: { x: 0, y: 0 } } };
        const next = applyAddNode(base, TRIGGER_PAYLOAD, { x: 0, y: 0 });
        expect(next.trigger.id).toBe('trg_keep');
        expect(wellFormed(next)).toBe(true);
    });

    it('does not mutate the base definition', () => {
        const base = {};
        applyAddNode(base, TRIGGER_PAYLOAD, { x: 0, y: 0 });
        expect(base).toEqual({});
    });
});

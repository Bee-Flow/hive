import { describe, it, expect } from 'vitest';
import { computeUpstreamGroups } from './upstream';
import { computeLoopBodyGroups } from './upstream';
import { composeInlineGraph } from '../flow/inlineFlowlets';

/**
 * What a step INSIDE an expanded loop can bind to.
 *
 * The same step is authorable from two surfaces — the canvas (this file) and
 * the inspector's list editor (computeLoopBodyGroups) — and a path that works
 * in one but not the other is indistinguishable from a broken binding. So the
 * two are checked against each other here, not just individually.
 */

const CATALOG = {
    apps: [{
        id: 'gmail',
        actions: [{ name: 'gmail_search', outputSample: { results: [{ subject: 'Hi', from: 'a@b.c' }] } }],
    }],
};

/** trg → src (gmail_search) → lp1 (body: a → b) → after */
const DEF = {
    trigger: { id: 'trg', type: 'trigger', kind: 'manual', position: { x: 0, y: 0 } },
    steps: [
        { id: 'src', type: 'integration_action', tool: 'gmail_search', label: 'Search email', position: { x: 200, y: 0 } },
        {
            id: 'lp1', type: 'loop', label: 'Repeat for each',
            overRef: 'steps.src.output.results', itemVar: 'invoice',
            position: { x: 400, y: 0 },
            body: [
                { id: 'a', type: 'set', label: 'A', fields: {} },
                { id: 'b', type: 'set', label: 'B', fields: {} },
            ],
        },
        { id: 'after', type: 'ai_step', prompt: 'x', position: { x: 800, y: 0 } },
    ],
    edges: [{ from: 'trg', to: 'src' }, { from: 'src', to: 'lp1' }, { from: 'lp1', to: 'after' }],
};

const flat = (def = DEF) => composeInlineGraph(def, def, new Set(['lp1'])).graph;
const groupsFor = (stepId, def = DEF) => computeUpstreamGroups(flat(def), stepId, CATALOG);
const byId = (groups, id) => groups.find(g => g.id === id) || null;

describe('a step inside an expanded loop', () => {
    it('is offered the current item, under the name the loop gave it', () => {
        const item = byId(groupsFor('lp1/b'), 'lp1/__item__');
        expect(item).toBeTruthy();
        expect(item.label).toBe('Current item (loop.invoice)');
        expect(item.basePath).toBe('loop.invoice');
        // Fields come from the loop's SOURCE, resolved through the catalog —
        // the same resolution the list editor does.
        expect(item.fields.map(f => f.path)).toContain('loop.invoice.subject');
    });

    it('sees everything that runs before the loop', () => {
        const ids = groupsFor('lp1/b').map(g => g.id);
        expect(ids).toContain('trg');
        expect(ids).toContain('src');
    });

    it('sees its earlier siblings in the body', () => {
        expect(groupsFor('lp1/b').map(g => g.id)).toContain('lp1/a');
    });

    it('is NOT offered the loop\'s own output', () => {
        // `steps.lp1.output.results` only exists once every item has run. Inside
        // the body it resolves to nothing, so offering it in the picker would be
        // a path that is wrong by construction.
        expect(byId(groupsFor('lp1/b'), 'lp1')).toBe(null);
    });

    it('offers no item FIELDS when the loop binds a batch', () => {
        // execLoop binds a SLICE when batchSize > 1, so `loop.<var>.subject`
        // would resolve to nothing — same rule as computeLoopBodyGroups.
        const batched = { ...DEF, steps: DEF.steps.map(s => (s.id === 'lp1' ? { ...s, batchSize: 5 } : s)) };
        const item = byId(groupsFor('lp1/b', batched), 'lp1/__item__');
        expect(item.label).toBe('Current batch (loop.invoice)');
        expect(item.fields).toEqual([]);
        expect(Array.isArray(item.sample)).toBe(true);
    });

    it('agrees with the inspector\'s list editor about the item', () => {
        // Given the same knowledge of the source data, both surfaces must offer
        // the same paths — the same body step is authorable from either, and a
        // path that works in one and not the other reads as a broken binding.
        // (The list editor resolves only through the NDV's merged sample root,
        // so it is handed one here; the canvas also falls back to the catalog.)
        const loop = DEF.steps.find(s => s.id === 'lp1');
        const previewSample = { steps: { src: { output: { results: [{ subject: 'Hi', from: 'a@b.c' }] } } } };
        const outer = computeUpstreamGroups(DEF, 'lp1', CATALOG);
        const fromList = computeLoopBodyGroups(loop, 1, outer, previewSample, CATALOG, DEF)
            .find(g => g.id === '__loop_item');
        const fromCanvas = byId(groupsFor('lp1/b'), 'lp1/__item__');
        expect(fromCanvas.basePath).toBe(fromList.basePath);
        expect(fromCanvas.label).toBe(fromList.label);
        expect(fromCanvas.fields.map(f => f.path).sort()).toEqual(fromList.fields.map(f => f.path).sort());
    });
});

describe('the loop itself is unaffected', () => {
    it('still sees its own upstream and not its body', () => {
        const ids = groupsFor('lp1').map(g => g.id);
        expect(ids).toContain('src');
        expect(ids).not.toContain('lp1/a');
    });

    it('still offers the envelope to steps AFTER it', () => {
        const after = byId(groupsFor('after'), 'lp1');
        expect(after.basePath).toBe('steps.lp1.output');
        expect(after.fields.map(f => f.key)).toContain('iterations');
    });
});

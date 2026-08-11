import { describe, it, expect } from 'vitest';
import { buildIssuesByStep, matchValidationToStep } from './matchValidationToStep';
import { composeInlineGraph } from './inlineFlowlets';

/**
 * A node inside an expanded container carries a PREFIXED id (`lp1/a`, `cl1/s1`)
 * that appears in no validation path — the server names the step by its local
 * id, inside a scope of its own. Without the translation here, a broken step
 * inside a container gets no badge at all: the error is reported in the
 * validation panel and the node on the canvas looks fine.
 */

const DEF = {
    trigger: { id: 'trg', type: 'trigger', kind: 'manual', position: { x: 0, y: 0 } },
    steps: [{
        id: 'lp1', type: 'loop', overRef: 'trigger.output.rows', position: { x: 300, y: 0 },
        body: [{ id: 'a', type: 'set' }, { id: 'b', type: 'notification' }],
    }],
    edges: [{ from: 'trg', to: 'lp1' }],
};

const err = (path, code = 'x') => ({ code, severity: 'error', path, message: 'nope' });

describe('matchValidationToStep', () => {
    it('filters a step\'s own records by id', () => {
        const v = { errors: [err('steps[a].fields')], warnings: [err('steps[b].title')] };
        expect(matchValidationToStep(v, 'a').errors).toHaveLength(1);
        expect(matchValidationToStep(v, 'a').warnings).toHaveLength(0);
    });
});

describe('buildIssuesByStep — loop bodies', () => {
    const { sidecar } = composeInlineGraph(DEF, DEF, new Set(['lp1']));

    it('lands a body step\'s error on that step\'s node', () => {
        const v = { errors: [err('steps[lp1].body.steps[b].title', 'notification.empty')], warnings: [] };
        const out = buildIssuesByStep(v, DEF, sidecar);
        expect(out.get('lp1/b')?.errors).toHaveLength(1);
        expect(out.get('lp1/a')).toBeUndefined();
    });

    it('does not spill a body error onto a same-named step elsewhere', () => {
        // Narrowed to `steps[lp1].body.` FIRST — matching the local id against
        // the whole record set would put every `a` error on every `a` node.
        const v = { errors: [err('steps[a].fields')], warnings: [] };
        const out = buildIssuesByStep(v, DEF, sidecar);
        expect(out.get('lp1/a')).toBeUndefined();
    });

    it('finds a body error on a loop nested inside a flowlet', () => {
        const withLayer = {
            schemaVersion: 2,
            trigger: { id: 'trg', type: 'trigger', kind: 'manual', position: { x: 0, y: 0 } },
            steps: [{ id: 'cl1', type: 'call_layer', layerKey: 'enrich', position: { x: 300, y: 0 } }],
            edges: [{ from: 'trg', to: 'cl1' }],
            layers: {
                enrich: {
                    trigger: { id: 'ltrg', type: 'trigger', kind: 'layer_input', params: [], position: { x: 0, y: 0 } },
                    steps: [{ id: 'lp9', type: 'loop', overRef: 'trigger.rows', position: { x: 300, y: 0 }, body: [{ id: 'z', type: 'set' }] }],
                    edges: [{ from: 'ltrg', to: 'lp9' }],
                },
            },
        };
        const nested = composeInlineGraph(withLayer, withLayer, new Set(['cl1', 'cl1/lp9'])).sidecar;
        // The server reports it under the flowlet AND the loop — the loop scope
        // is matched with `includes` for exactly this shape.
        const v = { errors: [err('layers.enrich.steps[lp9].body.steps[z].fields')], warnings: [] };
        const out = buildIssuesByStep(v, withLayer, nested);
        expect(out.get('cl1/lp9/z')?.errors).toHaveLength(1);
    });

    it('leaves the flowlet path working', () => {
        const withLayer = {
            schemaVersion: 2,
            trigger: { id: 'trg', type: 'trigger', kind: 'manual', position: { x: 0, y: 0 } },
            steps: [{ id: 'cl1', type: 'call_layer', layerKey: 'enrich', position: { x: 300, y: 0 } }],
            edges: [{ from: 'trg', to: 'cl1' }],
            layers: {
                enrich: {
                    trigger: { id: 'ltrg', type: 'trigger', kind: 'layer_input', params: [], position: { x: 0, y: 0 } },
                    steps: [{ id: 's1', type: 'set', position: { x: 300, y: 0 } }],
                    edges: [{ from: 'ltrg', to: 's1' }],
                },
            },
        };
        const sc = composeInlineGraph(withLayer, withLayer, new Set(['cl1'])).sidecar;
        const v = { errors: [err('layers.enrich.steps[s1].fields')], warnings: [] };
        expect(buildIssuesByStep(v, withLayer, sc).get('cl1/s1')?.errors).toHaveLength(1);
    });
});

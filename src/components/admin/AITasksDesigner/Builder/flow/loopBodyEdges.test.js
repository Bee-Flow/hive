// @vitest-environment node
//
// The canvas draws a loop's body as a chain. The runtime BUILDS that chain, per
// iteration, in engine.js's `buildLinearEdges`. If the two disagree the canvas
// shows a flow that isn't the one that runs — so half of this file pins the
// pure behaviour, and half reads engine.js as source to prove the rule it
// mirrors is still there.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { LOOP_ENTRY_ID, loopBodyEdges, orderLoopBody } from './loopBodyEdges';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.resolve(HERE, '../../../../../../../server/core/automationRunner/engine.js');

const step = (id, type = 'set', extra = {}) => ({ id, type, ...extra });

describe('loopBodyEdges', () => {
    it('returns nothing for an empty body — the entry pill stands alone', () => {
        expect(loopBodyEdges([])).toEqual([]);
        expect(loopBodyEdges(null)).toEqual([]);
        expect(loopBodyEdges(undefined)).toEqual([]);
    });

    it('chains the body from the entry node', () => {
        expect(loopBodyEdges([step('a'), step('b'), step('c')])).toEqual([
            { from: LOOP_ENTRY_ID, to: 'a' },
            { from: 'a', to: 'b' },
            { from: 'b', to: 'c' },
        ]);
    });

    it('labels the edge after a condition `then` — else ends the iteration', () => {
        expect(loopBodyEdges([step('c1', 'condition'), step('b')])).toEqual([
            { from: LOOP_ENTRY_ID, to: 'c1' },
            { from: 'c1', to: 'b', label: 'then' },
        ]);
    });

    it('passes a switch through on every case plus the default port', () => {
        const body = [step('sw', 'switch', { cases: [{ name: 'vip' }, { name: 'rest' }] }), step('b')];
        expect(loopBodyEdges(body)).toEqual([
            { from: LOOP_ENTRY_ID, to: 'sw' },
            { from: 'sw', to: 'b', label: 'case:vip', caseName: 'vip' },
            { from: 'sw', to: 'b', label: 'case:rest', caseName: 'rest' },
            { from: 'sw', to: 'b', label: 'case:default', caseName: 'default' },
        ]);
    });

    it('a switch with no declared cases still reaches the next step', () => {
        const edges = loopBodyEdges([step('sw', 'switch'), step('b')]);
        expect(edges).toContainEqual({ from: 'sw', to: 'b', label: 'case:default', caseName: 'default' });
    });

    it('skips malformed rows rather than emitting an edge to nowhere', () => {
        expect(loopBodyEdges([null, step('a'), { type: 'set' }])).toEqual([
            { from: LOOP_ENTRY_ID, to: 'a' },
        ]);
    });

    it('takes the entry id from the caller', () => {
        expect(loopBodyEdges([step('a')], 'lp1/__item__')[0].from).toBe('lp1/__item__');
    });
});

describe('orderLoopBody', () => {
    it('is the inverse of loopBodyEdges', () => {
        const body = [step('a'), step('b'), step('c')];
        expect(orderLoopBody([...body].reverse(), loopBodyEdges(body)).map(s => s.id))
            .toEqual(['a', 'b', 'c']);
    });

    it('follows a rewired chain', () => {
        const steps = [step('a'), step('b'), step('c')];
        const rewired = [{ from: 'c', to: 'a' }, { from: 'a', to: 'b' }];
        expect(orderLoopBody(steps, rewired).map(s => s.id)).toEqual(['c', 'a', 'b']);
    });

    it('counts a switch\'s parallel case edges once', () => {
        // Three edges between the same pair: naive indegree counting leaves the
        // target permanently blocked and the whole body falls out of the sort.
        const body = [step('sw', 'switch', { cases: [{ name: 'x' }, { name: 'y' }] }), step('b')];
        expect(orderLoopBody([...body].reverse(), loopBodyEdges(body)).map(s => s.id))
            .toEqual(['sw', 'b']);
    });

    it('keeps an edge-less node where it was instead of hoisting it', () => {
        const steps = [step('a'), step('loose'), step('b')];
        const edges = [{ from: 'a', to: 'b' }];
        expect(orderLoopBody(steps, edges).map(s => s.id)).toEqual(['a', 'loose', 'b']);
    });

    it('keeps every step when the edges form a cycle', () => {
        const steps = [step('a'), step('b')];
        const cyclic = [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }];
        expect(orderLoopBody(steps, cyclic).map(s => s.id).sort()).toEqual(['a', 'b']);
    });

    it('ignores edges pointing outside the container', () => {
        const steps = [step('a'), step('b')];
        expect(orderLoopBody(steps, [{ from: 'elsewhere', to: 'b' }, { from: 'a', to: 'b' }]).map(s => s.id))
            .toEqual(['a', 'b']);
    });

    it('passes 0 and 1 step through untouched', () => {
        expect(orderLoopBody([], [])).toEqual([]);
        expect(orderLoopBody([step('a')], []).map(s => s.id)).toEqual(['a']);
    });
});

describe('lockstep with the runtime', () => {
    // Reads engine.js as SOURCE: buildLinearEdges isn't exported, and the thing
    // under test is the routing rule, not a callable. Asserted piece by piece so
    // a rule that DISAPPEARS fails here rather than in production.
    const body = (() => {
        const src = fs.readFileSync(ENGINE, 'utf8');
        const at = src.indexOf('function buildLinearEdges');
        expect(at, 'engine.js no longer defines buildLinearEdges').toBeGreaterThan(-1);
        return src.slice(at, at + 1200);
    })();

    it('still ends the iteration on a condition\'s else, continuing on then', () => {
        expect(body).toMatch(/prev\.type === 'condition'/);
        expect(body).toMatch(/label: 'then'/);
    });

    it('still passes a switch through on every case and the default port', () => {
        expect(body).toMatch(/prev\.type === 'switch'/);
        expect(body).toMatch(/case:\$\{c\.name\}/);
        expect(body).toMatch(/case:default/);
    });

    it('still chains everything else plainly', () => {
        expect(body).toMatch(/edges\.push\(\{ from: prev\.id, to \}\)/);
    });
});

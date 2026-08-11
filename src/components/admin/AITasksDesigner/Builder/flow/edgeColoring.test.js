import { describe, it, expect } from 'vitest';
import { CHART_SERIES, STATUS_COLORS } from '../../../../../constants/palette';
import { decorateRunEdges, identityColorForEdge } from './edgeColoring';
import { PII_GROUP_COLORS } from './edgeColors';

describe('identityColorForEdge', () => {
    it('a manual colour wins in every mode', () => {
        const data = { defColor: 'red', caseIndex: 2 };
        for (const mode of ['off', 'branches', 'pii']) {
            expect(identityColorForEdge(data, mode, { piiSummary: { groups: { Contact: 5 } } }))
                .toBe(STATUS_COLORS.red);
        }
    });

    it("mode 'branches' auto-colours case edges by their case index", () => {
        expect(identityColorForEdge({ caseIndex: 0 }, 'branches')).toBe(CHART_SERIES[0]);
        expect(identityColorForEdge({ caseIndex: 1 }, 'branches')).toBe(CHART_SERIES[1]);
        // then/else/default/on_error edges carry no caseIndex → semantic look.
        expect(identityColorForEdge({ caseIndex: null, kind: 'then' }, 'branches')).toBe(null);
    });

    it("mode 'pii' colours by the source's dominant PII group", () => {
        const run = { piiSummary: { groups: { Contact: 3, Personal: 1 } } };
        expect(identityColorForEdge({}, 'pii', run)).toBe(PII_GROUP_COLORS.Contact);
        expect(identityColorForEdge({}, 'pii', { piiSummary: null })).toBe(null);
        expect(identityColorForEdge({}, 'pii', null)).toBe(null);
    });

    it("a routine's own PII colour rules override the default group map", () => {
        const run = { piiSummary: { groups: { Contact: 3 } } };
        const overridden = { ...PII_GROUP_COLORS, Contact: STATUS_COLORS.orange };
        expect(identityColorForEdge({}, 'pii', run, overridden)).toBe(STATUS_COLORS.orange);
        // Manual edge colour still beats the rule map.
        expect(identityColorForEdge({ defColor: 'red' }, 'pii', run, overridden)).toBe(STATUS_COLORS.red);
    });

    it("mode 'off' shows only manual colours", () => {
        expect(identityColorForEdge({ caseIndex: 1 }, 'off', { piiSummary: { groups: { Contact: 1 } } })).toBe(null);
        expect(identityColorForEdge({ defColor: 'cyan' }, 'off')).toBe(STATUS_COLORS.cyan);
    });

    it('an unknown persisted colour key falls back to neutral, never a raw value', () => {
        expect(identityColorForEdge({ defColor: 'purple' }, 'off')).toBe(null);
        expect(identityColorForEdge({ defColor: '#123456' }, 'off')).toBe(null);
    });
});

describe('decorateRunEdges', () => {
    const edge = (over = {}) => ({
        id: 'a->b||', source: 'a', target: 'b', style: { stroke: STATUS_COLORS.red, strokeWidth: 2 },
        data: { identityColor: STATUS_COLORS.red }, ...over,
    });
    const plainEdge = (over = {}) => ({ id: 'a->b||', source: 'a', target: 'b', data: {}, ...over });
    const run = (rows) => new Map(Object.entries(rows));

    it('no runs, nothing in flight → untouched', () => {
        const edges = [edge()];
        expect(decorateRunEdges(edges, { runByStep: new Map(), runInFlight: false })).toBe(edges);
    });

    it('error red beats a custom colour', () => {
        const [e] = decorateRunEdges([edge()], {
            runByStep: run({ a: { status: 'success' }, b: { status: 'error' } }),
        });
        expect(e.style.stroke).toBe('#ef4444');
    });

    it('a traversed coloured edge keeps its colour and bumps width; uncoloured turns green', () => {
        const rows = run({ a: { status: 'success' }, b: { status: 'pinned' } });
        const [coloured] = decorateRunEdges([edge()], { runByStep: rows });
        expect(coloured.style.stroke).toBe(STATUS_COLORS.red);
        expect(coloured.style.strokeWidth).toBe(2.5);
        const [plain] = decorateRunEdges([plainEdge()], { runByStep: rows });
        expect(plain.style.stroke).toBe('#10b981');
    });

    it('in-flight animates and keeps the identity colour when there is one', () => {
        const rows = run({ a: { status: 'success' } });
        const [coloured] = decorateRunEdges([edge()], { runByStep: rows, runInFlight: true });
        expect(coloured.animated).toBe(true);
        expect(coloured.style.stroke).toBe(STATUS_COLORS.red);
        const [plain] = decorateRunEdges([plainEdge()], { runByStep: rows, runInFlight: true });
        expect(plain.style.stroke).toBe('var(--accent)');
    });

    it('pinned-only rows decorate too (the pin stub from runStatus.js)', () => {
        const rows = run({ a: { status: 'pinned' }, b: { status: 'pinned' } });
        const [e] = decorateRunEdges([plainEdge()], { runByStep: rows });
        expect(e.style.stroke).toBe('#10b981');
    });
});

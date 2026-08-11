import { describe, it, expect } from 'vitest';
import { STATUS_COLORS } from '../../../../../constants/palette';
import { applyCaseColor, applyPiiGroupColor, caseColorOf, resolvePiiGroupColors } from './edgeColorOps';
import { PII_GROUP_COLORS } from './edgeColors';

const DEF = {
    trigger: { id: 'trg', kind: 'manual' },
    steps: [
        { id: 'sw', type: 'switch', expr: 'x', cases: [{ name: 'pdf', value: 'pdf' }, { name: 'word', value: 'word' }] },
    ],
    edges: [
        { from: 'trg', to: 'sw' },
        { from: 'sw', to: 'a', label: 'case:pdf', caseName: 'pdf' },
        { from: 'sw', to: 'b', label: 'case:pdf', caseName: 'pdf' },   // same case, second edge
        { from: 'sw', to: 'c', label: 'case:word' },                    // legacy label-only shape
    ],
};

describe('applyCaseColor / caseColorOf', () => {
    it('colours every edge of the case — and only those', () => {
        const next = applyCaseColor(DEF, 'sw', 'pdf', 'red');
        const pdf = next.edges.filter(e => e.caseName === 'pdf');
        expect(pdf.every(e => e.color === 'red')).toBe(true);
        expect(next.edges.find(e => e.from === 'trg').color).toBeUndefined();
        expect(next.edges.find(e => e.to === 'c').color).toBeUndefined();
        expect(caseColorOf(next, 'sw', 'pdf')).toBe('red');
    });

    it('matches the legacy label-only case shape', () => {
        const next = applyCaseColor(DEF, 'sw', 'word', 'blue');
        expect(next.edges.find(e => e.to === 'c').color).toBe('blue');
        expect(caseColorOf(next, 'sw', 'word')).toBe('blue');
    });

    it('clearing removes the key entirely (never persists color:null)', () => {
        const coloured = applyCaseColor(DEF, 'sw', 'pdf', 'red');
        const cleared = applyCaseColor(coloured, 'sw', 'pdf', null);
        expect(cleared.edges.every(e => !('color' in e) || e.caseName !== 'pdf')).toBe(true);
        expect(caseColorOf(cleared, 'sw', 'pdf')).toBe(null);
    });

    it('is a no-op (same object) when nothing matches or changes', () => {
        expect(applyCaseColor(DEF, 'sw', 'ghost', 'red')).toBe(DEF);
        expect(applyCaseColor(DEF, 'sw', 'pdf', null)).toBe(DEF);
    });

    it('caseColorOf is null when the case edges disagree', () => {
        const one = { ...DEF, edges: DEF.edges.map(e => (e.to === 'a' ? { ...e, color: 'red' } : e)) };
        expect(caseColorOf(one, 'sw', 'pdf')).toBe(null);
    });
});

describe('applyPiiGroupColor / resolvePiiGroupColors', () => {
    it('sets and clears overrides; the empty map is dropped from the definition', () => {
        const withOne = applyPiiGroupColor(DEF, 'Contact', 'orange');
        expect(withOne.piiLineColors).toEqual({ Contact: 'orange' });
        const cleared = applyPiiGroupColor(withOne, 'Contact', null);
        expect('piiLineColors' in cleared).toBe(false);
        expect(applyPiiGroupColor(DEF, 'Contact', null)).toBe(DEF); // no-op stays same object
    });

    it('resolves overrides over the defaults; junk is ignored', () => {
        const def = { ...DEF, piiLineColors: { Contact: 'orange', Ghost: 'red', Personal: '#123456' } };
        const map = resolvePiiGroupColors(def);
        expect(map.Contact).toBe(STATUS_COLORS.orange);          // overridden
        expect(map.Personal).toBe(PII_GROUP_COLORS.Personal);    // bad value → default
        expect('Ghost' in map).toBe(false);                      // unknown group ignored
        expect(map.Financial).toBe(PII_GROUP_COLORS.Financial);  // untouched default
    });

    it('without overrides the defaults come back verbatim', () => {
        expect(resolvePiiGroupColors(DEF)).toEqual(PII_GROUP_COLORS);
        expect(resolvePiiGroupColors(null)).toEqual(PII_GROUP_COLORS);
    });
});

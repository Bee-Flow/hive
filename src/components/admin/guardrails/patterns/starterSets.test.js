/**
 * The shipped starter patterns, checked against the engine that will run them.
 *
 * server/core/guardrails.js compiles each pattern with `new RegExp(p, 'i')` and
 * SILENTLY SKIPS anything that throws. So a typo in a shipped template does not
 * fail loudly — it produces a rule that appears in the admin UI, appears bound to
 * an organisation, and detects nothing. That is the failure this file exists to
 * make impossible.
 *
 * The empty-string check matters just as much in the other direction: a pattern
 * that matches "" matches at every position, so `replace(re, '[REDACTED: …]')`
 * destroys the whole message. One `*` where a `+` was meant does it.
 */

import { describe, it, expect } from 'vitest';

import { STARTER_SETS, STARTER_RULES, applyStarterSet } from './starterSets';

const allRules = Object.values(STARTER_RULES);

describe('starter pattern library', () => {
    it('every pattern compiles under the engine\'s exact flags', () => {
        for (const r of allRules) {
            expect(() => new RegExp(r.pattern, 'i'), `${r.id}: ${r.pattern}`).not.toThrow();
            // The redaction path recompiles with 'gi'.
            expect(() => new RegExp(r.pattern, 'gi'), `${r.id}: ${r.pattern}`).not.toThrow();
        }
    });

    it('no pattern matches the empty string', () => {
        for (const r of allRules) {
            expect(new RegExp(r.pattern, 'i').test(''), `${r.id} redacts everything`).toBe(false);
        }
    });

    it('no pattern uses a unicode property escape', () => {
        // The `u` flag is never passed, so \p{...} is a syntax error there and a
        // literal `p` here — silently wrong either way.
        for (const r of allRules) {
            expect(r.pattern, r.id).not.toMatch(/\\p\{/);
        }
    });

    it('no pattern relies on an inline flag the engine strips', () => {
        for (const r of allRules) {
            expect(r.pattern, r.id).not.toMatch(/^\(\?[a-z-]/);
        }
    });

    it('rule names are unique and human-readable', () => {
        // The name is rendered to the END USER inside `[REDACTED: <name>]`, and
        // the server rejects duplicates case-insensitively.
        const seen = new Set();
        for (const r of allRules) {
            const key = r.name.toLowerCase();
            expect(seen.has(key), `duplicate name: ${r.name}`).toBe(false);
            seen.add(key);
            expect(r.name).not.toMatch(/[_\\{}[\]]/);
        }
    });

    it('every set references rules that exist', () => {
        for (const set of STARTER_SETS) {
            expect(set.ruleIds.length, `${set.id} is empty`).toBeGreaterThan(0);
            for (const id of set.ruleIds) {
                expect(STARTER_RULES[id], `${set.id} -> unknown rule ${id}`).toBeTruthy();
            }
        }
    });

    it('set ids and names are unique', () => {
        expect(new Set(STARTER_SETS.map(s => s.id)).size).toBe(STARTER_SETS.length);
        expect(new Set(STARTER_SETS.map(s => s.name)).size).toBe(STARTER_SETS.length);
    });
});

describe('starter patterns actually match what they claim', () => {
    const cases = [
        ['nl_bsn', '123456782', 'BSN 123456782 hier'],
        ['nl_btw', 'NL123456789B01', 'BTW NL123456789B01'],
        ['nl_plate', '12-AB-34', 'kenteken 12-AB-34'],
        ['be_natid', '85.07.30-033.28', 'nummer 85.07.30-033.28'],
        ['be_vat', 'BE0123456789', 'BTW BE0123456789'],
        ['de_vat', 'DE123456789', 'USt DE123456789'],
        ['fr_nir', '2 69 05 49 588 157 80', 'NIR 2 69 05 49 588 157 80'],
        ['es_dni', '12345678Z', 'DNI 12345678Z'],
        ['it_cf', 'RSSMRA85M01H501Z', 'CF RSSMRA85M01H501Z'],
        ['se_personnummer', '811218-9876', 'pnr 811218-9876'],
        ['at_svnr', '1237 010180', 'SVNR 1237 010180'],
        ['us_ssn', '123-45-6789', 'SSN 123-45-6789'],
        ['us_itin', '912-78-1234', 'ITIN 912-78-1234'],
        ['iban', 'NL91ABNA0417164300', 'IBAN NL91ABNA0417164300'],
        ['credit_card', '4111111111111111', 'card 4111111111111111'],
        ['key_openai', 'sk-abcdefghijklmnopqrstuvwx', 'key sk-abcdefghijklmnopqrstuvwx'],
        ['key_aws', 'AKIAIOSFODNN7EXAMPLE', 'AKIAIOSFODNN7EXAMPLE'],
        ['key_jwt',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk',
            'token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk here'],
    ];

    it.each(cases)('%s matches %s', (id, value, text) => {
        const re = new RegExp(STARTER_RULES[id].pattern, 'i');
        const m = text.match(re);
        expect(m, `${id} did not match`).toBeTruthy();
        expect(m[0]).toBe(value);
    });

    it('leaves ordinary prose alone', () => {
        // Not a claim of perfect precision — shape-only patterns over-match by
        // design. It is a floor: a sentence with no identifiers in it must come
        // through untouched, or every message gets mangled.
        const prose = 'Hallo, kun je de offerte van vorige week nog eens nakijken? Dank!';
        for (const r of allRules) {
            expect(new RegExp(r.pattern, 'i').test(prose), `${r.id} matched prose`).toBe(false);
        }
    });
});

describe('applying a starter set', () => {
    it('adds the rules and a collection that references them', () => {
        const set = STARTER_SETS.find(s => s.id === 'nl');
        const out = applyStarterSet(set, [], []);
        expect(out.addedRules).toBe(set.ruleIds.length);
        expect(out.addedCollection).toBe(true);
        expect(out.collections).toHaveLength(1);
        for (const id of out.collections[0].ruleIds) {
            expect(out.rules.some(r => r.id === id)).toBe(true);
        }
    });

    it('is idempotent — applying twice does not duplicate', () => {
        const set = STARTER_SETS.find(s => s.id === 'nl');
        const once = applyStarterSet(set, [], []);
        const twice = applyStarterSet(set, once.rules, once.collections);
        expect(twice.rules).toHaveLength(once.rules.length);
        expect(twice.collections).toHaveLength(once.collections.length);
        expect(twice.addedRules).toBe(0);
        expect(twice.addedCollection).toBe(false);
    });

    it('shares a rule between overlapping sets instead of duplicating it', () => {
        // "Netherlands" and "EU VAT numbers" both contain Dutch VAT. Two copies
        // under two ids would be invisible in the UI and double the redaction
        // work on every message.
        const nl = STARTER_SETS.find(s => s.id === 'nl');
        const vat = STARTER_SETS.find(s => s.id === 'eu_vat');
        const a = applyStarterSet(nl, [], []);
        const b = applyStarterSet(vat, a.rules, a.collections);
        const btw = b.rules.filter(r => r.id === STARTER_RULES.nl_btw.id);
        expect(btw).toHaveLength(1);
        expect(b.collections).toHaveLength(2);
    });

    it('never overwrites a pattern the admin edited', () => {
        const set = STARTER_SETS.find(s => s.id === 'nl');
        const edited = { ...STARTER_RULES.nl_bsn, pattern: '\\bMINE\\b' };
        const out = applyStarterSet(set, [edited], []);
        expect(out.rules.find(r => r.id === edited.id).pattern).toBe('\\bMINE\\b');
    });

    it('does not mutate the arrays it was given', () => {
        const rules = [];
        const collections = [];
        applyStarterSet(STARTER_SETS[0], rules, collections);
        expect(rules).toHaveLength(0);
        expect(collections).toHaveLength(0);
    });
});

import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
import { STEP_CATALOG, STEP_GROUPS, newStep, paletteGroups, stepMeta } from './stepCatalog';

const require = createRequire(import.meta.url);
const specs = require('../../../../../../../server/appStudio/componentSpecs.js');

/**
 * A step kind the server ships and the catalog has never heard of shows up in
 * the palette as an unlabelled grey box with no description — which is exactly
 * how a new feature gets built and then looks broken. This is the guard.
 */

describe('stepCatalog — every server step kind is presentable', () => {
    it('has an entry for each kind, in a real group', () => {
        for (const kind of specs.STEP_KINDS) {
            const meta = STEP_CATALOG[kind];
            expect(meta, `no catalog entry for step kind "${kind}"`).toBeTruthy();
            expect(meta.label.length).toBeGreaterThan(0);
            expect(meta.blurb.length, `"${kind}" has no description`).toBeGreaterThan(0);
            expect(STEP_GROUPS).toContain(meta.group);
        }
    });

    it('invents no kind the server does not have', () => {
        for (const kind of Object.keys(STEP_CATALOG)) {
            expect(specs.STEP_KINDS, `catalog has unknown kind "${kind}"`).toContain(kind);
        }
    });

    it('marks exactly the server-run kinds as server steps', () => {
        const marked = Object.entries(STEP_CATALOG).filter(([, m]) => m.server).map(([k]) => k).sort();
        expect(marked).toEqual([...specs.DATA_MUTATING_STEP_KINDS].sort());
    });

    it('marks exactly the kinds that hold other steps as containers', () => {
        const marked = Object.entries(STEP_CATALOG).filter(([, m]) => m.container).map(([k]) => k).sort();
        expect(marked).toEqual(['condition', 'loop', 'switch']);
    });

    it('the palette offers every kind exactly once', () => {
        const offered = paletteGroups().flatMap((g) => g.kinds.map((k) => k.kind)).sort();
        expect(offered).toEqual([...specs.STEP_KINDS].sort());
    });

    it('an unknown kind still reads as something', () => {
        expect(stepMeta('what_is_this').label).toBe('what is this');
    });
});

describe('newStep — a fresh step is valid the moment it lands', () => {
    // Anything the spec marks required must be present, or the author opens the
    // editor to a validation error they did not cause.
    for (const kind of specs.STEP_KINDS) {
        it(`${kind} carries every required field`, () => {
            const step = newStep(kind, { screenId: 'scr_a', modalId: 'cmp_m' });
            expect(step.kind).toBe(kind);
            for (const [field, fs] of Object.entries(specs.STEP_SPECS[kind].fields)) {
                if (!fs.required) continue;
                // `steps`/`switchCases` are the container's own children — the
                // canvas fills them, and an empty branch is legal.
                if (fs.type === 'steps' || fs.type === 'switchCases') continue;
                expect(step[field], `${kind}.${field} is required but missing`).not.toBe(undefined);
            }
        });
    }

    it('writes no field the spec does not know', () => {
        for (const kind of specs.STEP_KINDS) {
            const legal = new Set([...Object.keys(specs.STEP_SPECS[kind].fields), 'kind', 'resultVar', 'onError']);
            for (const key of Object.keys(newStep(kind))) {
                expect(legal.has(key), `${kind}: unknown field "${key}"`).toBe(true);
            }
        }
    });
});

/**
 * A "Depending on…" step built on the canvas has to be able to TAKE a case.
 *
 * The seed used to be `cases: [{ name: 'first', steps: [] }]`. canonicalize
 * keeps exactly { value, steps } and drops everything else, and the runner
 * compares against `case.value` — so the field the editor filled in was deleted
 * on the first save and the field the runner reads was never set. Every
 * hand-built switch fell through to "Otherwise", for every input, silently.
 */
describe('newStep(switch) — a case the runtime can actually match', () => {
    const { canonicalizeAppDefinition } = require('../../../../../../../server/appStudio/canonicalize.js');

    /** One switch action, through the real canonicalizer, back out again. */
    function stored(step) {
        const def = {
            schemaVersion: 2,
            meta: { name: 'T' },
            homeScreenId: 'scr_t',
            screens: [{ id: 'scr_t', name: 'T', sections: [{ id: 'sec_t', children: [] }] }],
            actions: { act_a: { kind: 'sequence', steps: [step] } },
        };
        // canonicalize regenerates ids that do not match its format, so read
        // the one action back by position rather than by the key we gave it.
        return Object.values(canonicalizeAppDefinition(def).def.actions)[0].steps[0];
    }

    it('seeds a case keyed on `value`, the field the runner reads', () => {
        const step = newStep('switch', {});
        expect(step.cases[0]).toHaveProperty('value');
        expect(step.cases[0]).not.toHaveProperty('name');
    });

    it('the case survives a save with its value intact', () => {
        const step = { ...newStep('switch', {}), expr: 'vars.status' };
        step.cases = [{ value: 'paid', steps: [] }];
        expect(stored(step).cases).toEqual([{ value: 'paid', steps: [] }]);
    });

    it('a `name`-keyed case is exactly what the server throws away', () => {
        // The shape the editor used to produce, for the record.
        const step = { kind: 'switch', expr: 'vars.status', cases: [{ name: 'paid', steps: [] }], default: [] };
        expect(stored(step).cases[0]).not.toHaveProperty('name');
        expect(stored(step).cases[0].value).toBeUndefined();
    });
});

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

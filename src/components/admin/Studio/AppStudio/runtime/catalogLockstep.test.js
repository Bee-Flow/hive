/**
 * Catalog lockstep — kills the mirror tax.
 *
 * server/appStudio/componentSpecs.js is the single source of truth for the
 * component catalog; the frontend keeps two hand-mirrors so the palette and
 * inspector render offline:
 *   - runtime/componentRegistry.jsx  (renderer + label/category/defaults)
 *   - inspector/styleKnobMeta.js     (style knobs / events / input types)
 *
 * This test imports the SERVER file directly (CJS via createRequire — it is
 * dependency-free plain data) and asserts both mirrors agree per type, so any
 * catalog drift becomes a CI failure instead of a silent inspector gap.
 */

import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
import { APP_COMPONENT_TYPES, PALETTE_CATEGORIES } from './componentRegistry';
import {
    COLOR_ROLES as FE_COLOR_ROLES,
    STYLE_KNOBS as FE_STYLE_KNOBS,
    SECTION_STYLE_KNOBS as FE_SECTION_STYLE_KNOBS,
    SECTION_STYLE_DEFAULTS as FE_SECTION_STYLE_DEFAULTS,
    TYPE_EVENT_LISTS,
    TYPE_EVENTS,
    INPUT_TYPES as FE_INPUT_TYPES,
    SCREEN_ENUMS as FE_SCREEN_ENUMS,
    SCREEN_DEFAULTS as FE_SCREEN_DEFAULTS,
    FORMULA_SCOPE_ROOTS as FE_FORMULA_SCOPE_ROOTS,
    getKnobsForType,
} from '../inspector/styleKnobMeta';

const require = createRequire(import.meta.url);
const specs = require('../../../../../../../server/appStudio/componentSpecs.js');

const {
    COMPONENT_SPECS,
    COMPONENT_TYPES,
    INPUT_TYPES,
    EVENT_NAMES,
    STYLE_KNOBS,
    COLOR_ROLES,
    SECTION_STYLE_KNOBS,
    SECTION_STYLE_DEFAULTS,
    SCREEN_SPEC,
} = specs;

/** The spec's per-prop defaults — exactly what canonicalize fills in. */
function specDefaultProps(spec) {
    const out = {};
    for (const [key, fs] of Object.entries(spec.props || {})) {
        out[key] = fs.default === undefined ? null : fs.default;
    }
    return out;
}

describe('catalog lockstep — componentRegistry.jsx mirrors componentSpecs.js', () => {
    it('has a registry entry for every catalog type, and no extras', () => {
        expect(Object.keys(APP_COMPONENT_TYPES).sort()).toEqual([...COMPONENT_TYPES].sort());
    });

    for (const type of Object.keys(COMPONENT_SPECS)) {
        const spec = COMPONENT_SPECS[type];
        it(`${type}: label/category/container/isInput/defaults match the server spec`, () => {
            const entry = APP_COMPONENT_TYPES[type];
            expect(entry, `missing registry entry for ${type}`).toBeTruthy();
            expect(typeof entry.Component).toBe('function');
            expect(entry.icon, `${type} needs a palette icon`).toBeTruthy();
            expect(entry.label).toBe(spec.label);
            expect(entry.category).toBe(spec.category);
            expect(!!entry.container).toBe(!!spec.container);
            expect(!!entry.isInput).toBe(!!spec.isInput);
            expect(entry.defaultProps).toEqual(specDefaultProps(spec));
            expect(entry.defaultStyle).toEqual(spec.defaultStyle);
        });
    }

    it('palette categories cover every spec category', () => {
        const cats = new Set(Object.values(COMPONENT_SPECS).map((s) => s.category));
        for (const c of cats) expect(PALETTE_CATEGORIES).toContain(c);
    });
});

describe('catalog lockstep — styleKnobMeta.js mirrors componentSpecs.js', () => {
    for (const type of Object.keys(COMPONENT_SPECS)) {
        const spec = COMPONENT_SPECS[type];
        it(`${type}: style knobs and events match the server spec`, () => {
            expect(getKnobsForType(type)).toEqual(spec.styleKnobs);
            if (spec.events && spec.events.length) {
                expect(TYPE_EVENT_LISTS[type]).toEqual(spec.events);
            } else {
                expect(TYPE_EVENT_LISTS[type]).toBeUndefined();
            }
        });
    }

    it('TYPE_EVENTS (the wireable slot) is a subset of the spec events', () => {
        for (const [type, ev] of Object.entries(TYPE_EVENTS)) {
            expect(COMPONENT_SPECS[type], `TYPE_EVENTS has unknown type ${type}`).toBeTruthy();
            expect(COMPONENT_SPECS[type].events || []).toContain(ev);
        }
    });

    it('INPUT_TYPES matches the spec isInput classification exactly', () => {
        expect([...FE_INPUT_TYPES].sort()).toEqual([...INPUT_TYPES].sort());
    });

    it('STYLE_KNOBS / COLOR_ROLES / section knob mirrors are verbatim', () => {
        expect(FE_STYLE_KNOBS).toEqual(STYLE_KNOBS);
        expect(FE_COLOR_ROLES).toEqual(COLOR_ROLES);
        expect(FE_SECTION_STYLE_KNOBS).toEqual(SECTION_STYLE_KNOBS);
        expect(FE_SECTION_STYLE_DEFAULTS).toEqual(SECTION_STYLE_DEFAULTS);
    });

    it('SCREEN_ENUMS mirrors the enum-valued SCREEN_SPEC fields', () => {
        // The screen settings UI is new; without this it would be a fresh drift
        // surface with no guard, in a file whose entire job is guarding them.
        for (const [key, values] of Object.entries(FE_SCREEN_ENUMS)) {
            const spec = SCREEN_SPEC[key];
            expect(spec, `SCREEN_SPEC has no ${key}`).toBeTruthy();
            expect(spec.type).toBe('enum');
            expect(values).toEqual(spec.values);
            expect(FE_SCREEN_DEFAULTS[key]).toEqual(spec.default);
        }
    });

    // The expression editor's inline autocomplete completes exactly these, so a
    // root added server-side but missing here silently stops autocompleting —
    // the failure mode is "the feature looks broken for the new root", which is
    // invisible until someone reports it.
    it('FORMULA_SCOPE_ROOTS is a verbatim mirror', () => {
        expect(FE_FORMULA_SCOPE_ROOTS).toEqual(specs.FORMULA_SCOPE_ROOTS);
    });

    it('every event a spec declares is in the global EVENT_NAMES vocabulary', () => {
        for (const [type, spec] of Object.entries(COMPONENT_SPECS)) {
            for (const ev of spec.events || []) {
                expect(EVENT_NAMES, `${type} event ${ev}`).toContain(ev);
            }
        }
        expect(EVENT_NAMES).toContain('onCardMove');
    });
});

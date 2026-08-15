import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { NODE_DEFS, NODE_TYPE_KEYS, PALETTE_ABSENT, SYNTHETIC_TYPES, FLAT, nodeTypeLabel, nodeDefaultLabel } from './nodeDefs';
import { NODE_TYPES } from '../DiagramPane';
import { buildStepGroups, buildSearchResults } from './stepPalette';

/**
 * The completeness net.
 *
 * Every user-visible bug this file guards against was the same shape: one more
 * per-type map somewhere in the builder that forgot a step type, failing
 * quietly because each map had a "reasonable" fallback.
 *
 *   - NodeDetailView's STEP_TYPE_LABEL had no guard/tokenize/untokenize, so the
 *     three privacy nodes headed their own editor with the raw type name.
 *   - sectionForIssue's TAXONOMY had no guard/tokenize/untokenize/call_block,
 *     so a validation error on one returned an empty section set. Nothing
 *     force-opened, and at quick density the Advanced band holding the broken
 *     control is not rendered at all — error reported, fix unreachable.
 *   - It routed filter/switch's arrayRef to a section named 'source' that
 *     RouteFields never renders.
 *   - DiagramPane's NODE_TYPES has no approval/parallel, so a definition
 *     carrying one renders as a bare React Flow default node.
 *
 * Centralising the data into nodeDefs.js fixes those four. THIS is what stops
 * the fifth.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Types the canvas draws but no one can add and nothing can save (the expanded
 * loop's "Each item" pill). They have no editor, so the three editor-shaped
 * requirements below do not apply — but they still have to be NAMED and
 * EXPLAINED, and they still have to be declared, so a real step type cannot
 * reach the exemption by accident.
 */
const STEP_TYPE_KEYS = NODE_TYPE_KEYS.filter(t => !SYNTHETIC_TYPES[t]);

describe('nodeDefs — every type is fully described', () => {
    for (const type of NODE_TYPE_KEYS) {
        it(`${type} has a complete record`, () => {
            const def = NODE_DEFS[type];
            expect(def.typeLabel, 'typeLabel').toBeTruthy();
            expect(def.help, 'help').toBeTruthy();
            if (SYNTHETIC_TYPES[type]) return;
            expect(def.defaultLabel, 'defaultLabel').toBeTruthy();
            expect(Array.isArray(def.sectionKeys) && def.sectionKeys.length > 0, 'sectionKeys').toBe(true);
            expect(def.issueSections?.fallback, 'issueSections.fallback').toBeTruthy();
            expect(typeof def.issueSections?.map, 'issueSections.map').toBe('object');
        });
    }

    it('every synthetic type is drawn, exempted once, and never addable', () => {
        for (const [type, reason] of Object.entries(SYNTHETIC_TYPES)) {
            expect(NODE_DEFS[type], `${type} is exempted but has no record`).toBeTruthy();
            expect(typeof reason === 'string' && reason.length > 10, `${type}: give a real reason`).toBe(true);
            // It is canvas-only, so it must HAVE a canvas component…
            expect(NODE_TYPES[type], `${type} has no canvas component`).toBeTruthy();
            // …and must not also claim to be a type with no component.
            expect(PALETTE_ABSENT[type], `${type} cannot be both synthetic and palette-absent`).toBeUndefined();
        }
    });

    it('no typeLabel is the raw-type fallback in disguise', () => {
        // NodeDetailView still has `String(type).replace(/_/g,' ')` as a last
        // resort. If a record's label merely reproduces it, the record is
        // decorative and the jargon is still on screen.
        const lazy = NODE_TYPE_KEYS.filter(t => NODE_DEFS[t].typeLabel === t.replace(/_/g, ' '));
        expect(lazy).toEqual([]);
    });

    it('help reads as a sentence, not a label', () => {
        for (const type of NODE_TYPE_KEYS) {
            const help = NODE_DEFS[type].help;
            expect(help.length, `${type}: too terse to explain anything`).toBeGreaterThan(30);
            expect(help.endsWith('.'), `${type}: help should be a sentence`).toBe(true);
        }
    });
});

describe('nodeDefs — issue sections point at sections that exist', () => {
    for (const type of STEP_TYPE_KEYS) {
        it(`${type} routes every issue to one of its own sections`, () => {
            const { sectionKeys, issueSections } = NODE_DEFS[type];
            const named = [
                issueSections.fallback,
                ...Object.values(issueSections.map).filter(v => v !== FLAT),
            ];
            for (const section of named) {
                expect(sectionKeys, `${type}: '${section}' is not a section this editor renders`).toContain(section);
            }
        });
    }

    it('the declared sectionKeys match the AccordionSections SettingsForm renders', () => {
        // Scans the real source rather than trusting the list, so adding a
        // section without declaring it here is caught. Only covers the types
        // whose editor names its stepType literally — the dynamic ones
        // (RouteFields, GuardFields, the shared fields/contract editors) pass
        // a variable and are covered by the per-type assertion above plus the
        // SettingsForm.*.test.jsx suites.
        const src = fs.readFileSync(path.join(HERE, 'SettingsForm.jsx'), 'utf8');
        const found = new Map();
        for (const m of src.matchAll(/stepType="([a-z_]+)"\s+sectionKey="([a-z_]+)"/g)) {
            if (!found.has(m[1])) found.set(m[1], new Set());
            found.get(m[1]).add(m[2]);
        }
        expect(found.size, 'the scan itself must find something').toBeGreaterThan(5);

        for (const [type, sections] of found) {
            const declared = new Set(NODE_DEFS[type]?.sectionKeys || []);
            for (const s of sections) {
                expect(declared, `${type}: SettingsForm renders section '${s}' but nodeDefs does not declare it`).toContain(s);
            }
        }
    });
});

describe('nodeDefs — the type list agrees with the canvas and the palette', () => {
    it('every renderable node type has a presentation record', () => {
        const missing = Object.keys(NODE_TYPES).filter(t => !NODE_DEFS[t]);
        expect(missing).toEqual([]);
    });

    it('every record is renderable, or documented as not', () => {
        const orphans = NODE_TYPE_KEYS.filter(t => !NODE_TYPES[t] && !PALETTE_ABSENT[t]);
        expect(orphans, 'add a canvas component, or say why there is none in PALETTE_ABSENT').toEqual([]);
    });

    it('no synthetic type is offered by the palette', () => {
        const results = buildSearchResults('item', { catalog: { flags: { code: true } } });
        for (const r of results) {
            expect(SYNTHETIC_TYPES[r.payload?.kind], `${r.payload?.kind} is canvas-only`).toBeUndefined();
        }
    });

    it('every PALETTE_ABSENT entry carries a reason', () => {
        for (const [type, reason] of Object.entries(PALETTE_ABSENT)) {
            expect(NODE_DEFS[type], `${type} is exempted but has no record`).toBeTruthy();
            expect(typeof reason === 'string' && reason.length > 10, `${type}: give a real reason`).toBe(true);
        }
    });

    it('every step the palette can add has a presentation record', () => {
        const kinds = new Set();
        const collect = (items) => {
            for (const it of items || []) {
                const kind = it.payload?.kind;
                // Triggers and the create-flowlet meta-action are not step types.
                if (kind && kind !== 'trigger' && kind !== 'create_layer') kinds.add(kind);
            }
        };
        for (const group of buildStepGroups({ catalog: { flags: { code: true } } })) {
            collect(group.items);
            for (const sec of group.sections || []) collect(sec.items);
        }
        collect(buildSearchResults('e', { catalog: { flags: { code: true } } }).map(r => ({ payload: r.payload })));

        expect(kinds.size, 'the palette walk must find something').toBeGreaterThan(8);
        expect([...kinds].filter(k => !NODE_DEFS[k])).toEqual([]);
    });
});

describe('nodeDefs — accessors', () => {
    it('answer in English with no translator', () => {
        expect(nodeTypeLabel('tokenize')).toBe('Hide personal data');
        expect(nodeDefaultLabel('dedupe')).toBe('Remove duplicates');
    });

    it('the three privacy nodes no longer read as raw type names', () => {
        for (const type of ['guard', 'tokenize', 'untokenize']) {
            expect(nodeTypeLabel(type)).not.toBe(type);
            expect(nodeTypeLabel(type)).not.toMatch(/token/i);
        }
    });

    it('route through t() when one is supplied, English as the fallback arg', () => {
        const seen = [];
        const t = (key, fallback) => { seen.push([key, fallback]); return `NL:${fallback}`; };
        expect(nodeTypeLabel('summarize', t)).toBe('NL:Add up or count');
        expect(seen[0][0]).toBe('routines.node.summarize.typeLabel');
    });

    it('an unknown type yields empty string, never undefined', () => {
        expect(nodeTypeLabel('no_such_type')).toBe('');
        expect(nodeDefaultLabel('no_such_type')).toBe('');
    });
});

describe('nodeDefs — simpleSections (what Simple mode shows)', () => {
    // The per-type Simple view can only SHOW sections the editor actually
    // renders — a typo here would silently hide a section in Simple with no
    // way in but the mode toggle.
    for (const type of STEP_TYPE_KEYS) {
        const simple = NODE_DEFS[type].simpleSections;
        if (!simple) continue;
        it(`${type}: every simpleSection is a real section, and the list is non-empty`, () => {
            expect(simple.length, `${type}: an EMPTY simpleSections would hide the whole editor`).toBeGreaterThan(0);
            for (const s of simple) {
                expect(NODE_DEFS[type].sectionKeys, `${type}: simpleSections names '${s}' which sectionKeys does not declare`).toContain(s);
            }
        });
    }

    it('types without a per-type list fall through to the global advanced rule', async () => {
        // approval / parallel are engine-only and deliberately unlisted —
        // the fallback is the documented default, not an omission.
        const { hiddenInSimple, isAdvancedSection } = await import('./settings/formDensity');
        for (const type of ['approval', 'parallel']) {
            expect(NODE_DEFS[type].simpleSections).toBeUndefined();
            for (const key of ['config', 'advanced', 'options']) {
                expect(hiddenInSimple(type, key)).toBe(isAdvancedSection(key));
            }
        }
    });

    it('per-type lists override the global rule in both directions', async () => {
        const { hiddenInSimple } = await import('./settings/formDensity');
        // http_request: 'headers' is globally advanced AND per-type hidden;
        // 'body' is globally advanced but per-type SIMPLE (a POST without a
        // body is not a simpler POST, it is a broken one).
        expect(hiddenInSimple('http_request', 'headers')).toBe(true);
        expect(hiddenInSimple('http_request', 'body')).toBe(false);
        // ai_step hides its structured-output section in Simple even though
        // nothing global says 'output' is advanced for every type.
        expect(hiddenInSimple('ai_step', 'output')).toBe(true);
        expect(hiddenInSimple('ai_step', 'inputs')).toBe(false);
    });
});

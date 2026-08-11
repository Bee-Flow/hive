import { describe, it, expect } from 'vitest';
import {
    autoMapInputs, autoMapStep, applyAutoMapToStep,
    normalizeKey, sampleType, isSecretLikeKey, nearestArrayRef,
} from './autoMapInputs';
import { computeUpstreamGroups, inferLoopItemSample, buildToolOutputMap } from './upstream';

// Two upstream groups in topological order (nearest last), matching the
// computeUpstreamGroups shape.
const groups = [
    {
        id: 'trg', label: 'Trigger', kind: 'trigger', basePath: 'trigger.output',
        fields: [
            { key: 'text', path: 'trigger.output.text', sample: 'hello' },
            { key: 'count', path: 'trigger.output.count', sample: 3 },
        ],
    },
    {
        id: 's1', label: 'Gmail', kind: 'integration_action', basePath: 'steps.s1.output',
        fields: [
            { key: 'query', path: 'steps.s1.output.query', sample: 'q' },
            { key: 'results', path: 'steps.s1.output.results', sample: [{ id: 1 }] },
        ],
    },
];

describe('small helpers', () => {
    it('normalizeKey strips case + separators', () => {
        expect(normalizeKey('emailAddress')).toBe('emailaddress');
        expect(normalizeKey('max_results')).toBe('maxresults');
    });
    it('sampleType classifies values', () => {
        expect(sampleType([])).toBe('array');
        expect(sampleType(null)).toBe('null');
        expect(sampleType(2)).toBe('number');
        expect(sampleType('s')).toBe('string');
    });
    it('isSecretLikeKey flags credentials', () => {
        expect(isSecretLikeKey('apiKey')).toBe(true);
        expect(isSecretLikeKey('password')).toBe(true);
        expect(isSecretLikeKey('query')).toBe(false);
    });
    it('nearestArrayRef prefers the nearest array field', () => {
        expect(nearestArrayRef(groups)).toBe('steps.s1.output.results');
    });
});

describe('autoMapInputs (conservative)', () => {
    it('exact name match wins, preferring the nearest source', () => {
        const schema = { properties: { query: { type: 'string' } }, required: ['query'] };
        const patch = autoMapInputs(schema, {}, groups);
        // both trigger (no 'query') and s1 (has 'query') — exact match on s1.
        expect(patch.query).toEqual({ kind: 'ref', path: 'steps.s1.output.query' });
    });

    it('normalized name match (snake/camel)', () => {
        const schema = { properties: { maxResults: { type: 'number' } } };
        const g = [{ id: 'a', fields: [{ key: 'max_results', path: 'steps.a.output.max_results', sample: 5 }] }];
        const patch = autoMapInputs(schema, {}, g);
        expect(patch.maxResults).toEqual({ kind: 'ref', path: 'steps.a.output.max_results' });
    });

    it('never overwrites a field the user already set', () => {
        const schema = { properties: { query: { type: 'string' } } };
        const existing = { query: { kind: 'literal', value: 'mine' } };
        expect(autoMapInputs(schema, existing, groups)).toEqual({});
    });

    it('skips secret-like keys', () => {
        const schema = { properties: { apiKey: { type: 'string' } } };
        const g = [{ id: 'a', fields: [{ key: 'apiKey', path: 'steps.a.output.apiKey', sample: 'x' }] }];
        expect(autoMapInputs(schema, {}, g)).toEqual({});
    });

    it('respects the type gate (no number←array)', () => {
        const schema = { properties: { results: { type: 'number' } } };
        // only candidate named results is an array → rejected
        expect(autoMapInputs(schema, {}, groups)).toEqual({});
    });

    it('generic mode only fills existing keys, never invents them', () => {
        const existing = { text: { kind: 'literal', value: '' } }; // empty → eligible
        const patch = autoMapInputs(null, existing, groups);
        expect(patch.text).toEqual({ kind: 'ref', path: 'trigger.output.text' });
        expect(Object.keys(patch)).toEqual(['text']);
    });
});

describe('autoMapStep + applyAutoMapToStep', () => {
    const definition = {
        trigger: { id: 'trg', type: 'trigger', kind: 'manual' },
        steps: [
            { id: 's1', type: 'integration_action', tool: 'gmail_search', inputs: {} },
            { id: 's2', type: 'loop', overRef: 'trigger.output.items', itemVar: 'item' },
        ],
        edges: [{ from: 'trg', to: 's1' }, { from: 's1', to: 's2' }],
    };
    const catalog = {
        apps: [{ actions: [{ name: 'gmail_search', outputSample: { results: [{ id: 1 }] } }] }],
        triggerOutputs: { __manual: { fields: [], sample: {} } },
    };

    it('loop gets overRef from nearest upstream array when still scaffold default', () => {
        const { step, mappedKeys } = autoMapStep(definition.steps[1], definition, catalog);
        expect(mappedKeys).toEqual(['overRef']);
        expect(step.overRef).toBe('steps.s1.output.results');
    });

    it('applyAutoMapToStep records mapped input keys on step.autoMapped (not array refs)', () => {
        const out = applyAutoMapToStep(definition, 's2', catalog);
        const s2 = out.definition.steps.find(s => s.id === 's2');
        // overRef isn't an input → no autoMapped marker, but it is in mappedKeys
        expect(out.mappedKeys).toEqual(['overRef']);
        expect(s2.autoMapped).toBeUndefined();
    });
});

/**
 * C20 — Lists nodes never got their source list auto-mapped: the palette
 * seeded the literal 'trigger.output.items' and autoMapStep bailed on ANY
 * truthy arrayRef. Both the new empty seed and the legacy literal now count
 * as scaffold; a user-chosen ref is never overridden.
 */
describe('collection-op arrayRef auto-map (C20)', () => {
    const mkDef = (listStep) => ({
        trigger: { id: 'trg', type: 'trigger', kind: 'manual' },
        steps: [
            { id: 's1', type: 'integration_action', tool: 'gmail_search', inputs: {} },
            listStep,
        ],
        edges: [{ from: 'trg', to: 's1' }, { from: 's1', to: listStep.id }],
    });
    const catalog = {
        apps: [{ actions: [{ name: 'gmail_search', outputSample: { results: [{ id: 1 }] } }] }],
        triggerOutputs: { __manual: { fields: [], sample: {} } },
    };

    it('an empty arrayRef (new palette seed) maps to the nearest upstream array', () => {
        for (const type of ['filter', 'limit', 'dedupe', 'aggregate', 'summarize']) {
            const listStep = { id: 'ls', type, arrayRef: '' };
            const { step, mappedKeys } = autoMapStep(listStep, mkDef(listStep), catalog);
            expect(mappedKeys, type).toEqual(['arrayRef']);
            expect(step.arrayRef, type).toBe('steps.s1.output.results');
        }
    });

    it('the legacy scaffold literal is healed on re-connect', () => {
        const listStep = { id: 'ls', type: 'filter', arrayRef: 'trigger.output.items', expr: 'true' };
        const { step, mappedKeys } = autoMapStep(listStep, mkDef(listStep), catalog);
        expect(mappedKeys).toEqual(['arrayRef']);
        expect(step.arrayRef).toBe('steps.s1.output.results');
    });

    it('a user-chosen arrayRef is never overridden', () => {
        const listStep = { id: 'ls', type: 'filter', arrayRef: 'steps.other.output.rows', expr: 'true' };
        const { mappedKeys } = autoMapStep(listStep, mkDef(listStep), catalog);
        expect(mappedKeys).toEqual([]);
    });

    it('no upstream array → arrayRef stays empty (visible warning, not a silent guess)', () => {
        const listStep = { id: 'ls', type: 'limit', arrayRef: '', count: 5 };
        const def = {
            trigger: { id: 'trg', type: 'trigger', kind: 'manual' },
            steps: [listStep],
            edges: [{ from: 'trg', to: 'ls' }],
        };
        const { step, mappedKeys } = autoMapStep(listStep, def, catalog);
        expect(mappedKeys).toEqual([]);
        expect(step.arrayRef).toBe('');
    });
});

/**
 * The Condition node decides what it works on instead of asking. A freshly
 * dropped one is a `condition` (the whole run); wired below a step that hands
 * it a list it becomes a list-mode `filter` with the source already bound.
 */
describe('Condition node — list mode is detected, not configured', () => {
    const catalog = {
        apps: [{ actions: [{ name: 'gmail_search', outputSample: { results: [{ id: 1, subject: 'x' }] } }] }],
        triggerOutputs: { __manual: { fields: [], sample: {} } },
    };
    const mkDef = (routeStep, extraEdges = []) => ({
        trigger: { id: 'trg', type: 'trigger', kind: 'manual' },
        steps: [
            { id: 's1', type: 'integration_action', tool: 'gmail_search', inputs: {} },
            routeStep,
            { id: 'after', type: 'notification', title: 'x' },
        ],
        edges: [{ from: 'trg', to: 's1' }, { from: 's1', to: routeStep.id }, ...extraEdges],
    });

    it('a fresh condition below a list becomes a list-mode filter', () => {
        const routeStep = { id: 'r1', type: 'condition', expr: 'true' };
        const { step, mappedKeys } = autoMapStep(routeStep, mkDef(routeStep), catalog);
        expect(mappedKeys).toEqual(['arrayRef']);
        expect(step.type).toBe('filter');
        expect(step.arrayRef).toBe('steps.s1.output.results');
    });

    it('a condition the user already configured is left alone', () => {
        const routeStep = { id: 'r1', type: 'condition', expr: 'trigger.output.amount > 10' };
        const { step, mappedKeys } = autoMapStep(routeStep, mkDef(routeStep), catalog);
        expect(mappedKeys).toEqual([]);
        expect(step.type).toBe('condition');
    });

    it('no list upstream → it stays a whole-run condition', () => {
        const routeStep = { id: 'r1', type: 'condition', expr: 'true' };
        const def = {
            trigger: { id: 'trg', type: 'trigger', kind: 'manual' },
            steps: [routeStep],
            edges: [{ from: 'trg', to: 'r1' }],
        };
        const { step, mappedKeys } = autoMapStep(routeStep, def, catalog);
        expect(mappedKeys).toEqual([]);
        expect(step.type).toBe('condition');
    });

    it('the type flip re-points the outgoing edge in the same commit', () => {
        // A node spliced ONTO a connection already has an outgoing edge when
        // auto-map runs; `then` is not a port a filter has.
        const routeStep = { id: 'r1', type: 'condition', expr: 'true' };
        const def = mkDef(routeStep, [{ from: 'r1', to: 'after', label: 'then' }]);
        const { definition } = applyAutoMapToStep(def, 'r1', catalog);
        expect(definition.steps.find(s => s.id === 'r1').type).toBe('filter');
        expect(definition.edges).toContainEqual({ from: 'r1', to: 'after' });
        expect(definition.edges.some(e => e.label === 'then')).toBe(false);
    });

    it('a branch-mode switch never gets a source list bound behind the user\'s back', () => {
        const routeStep = { id: 'r1', type: 'switch', cases: [{ name: 'a', expr: 'x' }] };
        const { mappedKeys } = autoMapStep(routeStep, mkDef(routeStep), catalog);
        expect(mappedKeys).toEqual([]);
    });

    it('a switch already in list mode gets its blank source bound', () => {
        const routeStep = { id: 'r1', type: 'switch', arrayRef: '', cases: [{ name: 'a', expr: 'x' }] };
        const { step, mappedKeys } = autoMapStep(routeStep, mkDef(routeStep), catalog);
        expect(mappedKeys).toEqual(['arrayRef']);
        expect(step.arrayRef).toBe('steps.s1.output.results');
    });
});

/**
 * Same trust pattern for "Edit data" (set): a pristine scaffold below a list
 * becomes a list-mode step with the source bound; anything the user touched
 * is left alone.
 */
describe('Edit data (set) — list mode is detected, not configured', () => {
    const catalog = {
        apps: [{ actions: [{ name: 'gmail_search', outputSample: { results: [{ id: 1, subject: 'x' }] } }] }],
        triggerOutputs: { __manual: { fields: [], sample: {} } },
    };
    const mkDef = (setStep) => ({
        trigger: { id: 'trg', type: 'trigger', kind: 'manual' },
        steps: [
            { id: 's1', type: 'integration_action', tool: 'gmail_search', inputs: {} },
            setStep,
        ],
        edges: [{ from: 'trg', to: 's1' }, { from: 's1', to: setStep.id }],
    });

    it('a pristine set below a list becomes a list-mode set', () => {
        const setStep = { id: 'e1', type: 'set', fields: {} };
        const { step, mappedKeys } = autoMapStep(setStep, mkDef(setStep), catalog);
        expect(mappedKeys).toEqual(['arrayRef']);
        expect(step.arrayRef).toBe('steps.s1.output.results');
        expect(step.type).toBe('set'); // no type flip — same runtime type, new mode
    });

    it('any user touch disables the detection: fields, forEach, or existing arrayRef', () => {
        for (const touched of [
            { id: 'e1', type: 'set', fields: { a: { kind: 'literal', value: 1 } } },
            { id: 'e1', type: 'set', fields: {}, forEach: { overRef: 'steps.s1.output.results', itemVar: 'item' } },
            { id: 'e1', type: 'set', fields: {}, arrayRef: 'steps.s1.output.results' },
            { id: 'e1', type: 'set', fields: {}, operations: [{ op: 'rowId', target: 'id' }] },
        ]) {
            const { mappedKeys } = autoMapStep(touched, mkDef(touched), catalog);
            expect(mappedKeys, JSON.stringify(touched)).toEqual([]);
        }
    });

    it('a blank source flipped on under Advanced still gets bound', () => {
        // arrayRef '' = list mode chosen but unsourced — treated like the
        // collection ops' scaffold.
        const setStep = { id: 'e1', type: 'set', fields: { a: { kind: 'literal', value: 1 } }, arrayRef: '' };
        const { step, mappedKeys } = autoMapStep(setStep, mkDef(setStep), catalog);
        expect(mappedKeys).toEqual(['arrayRef']);
        expect(step.arrayRef).toBe('steps.s1.output.results');
    });

    it('no upstream list → stays a single-record step', () => {
        const setStep = { id: 'e1', type: 'set', fields: {} };
        const def = {
            trigger: { id: 'trg', type: 'trigger', kind: 'manual' },
            steps: [setStep],
            edges: [{ from: 'trg', to: 'e1' }],
        };
        const { step, mappedKeys } = autoMapStep(setStep, def, catalog);
        expect(mappedKeys).toEqual([]);
        expect(typeof step.arrayRef).not.toBe('string');
    });
});

describe('iteration auto-detection (run once per item)', () => {
    // gmail search (array of emails) → gmail read attachment (scalar inputs).
    const definition = {
        trigger: { id: 'trg', type: 'trigger', kind: 'manual' },
        steps: [
            { id: 's1', type: 'integration_action', tool: 'gmail_search', inputs: {} },
            { id: 's2', type: 'integration_action', tool: 'gmail_read_attachment', inputs: {} },
        ],
        edges: [{ from: 'trg', to: 's1' }, { from: 's1', to: 's2' }],
    };
    const catalog = {
        apps: [{
            actions: [
                { name: 'gmail_search', outputSample: { query: 'q', total: 1, results: [{ id: 'm1', subject: 's', from: 'a@b.c' }] } },
                {
                    name: 'gmail_read_attachment',
                    inputSchema: { properties: { messageId: { type: 'string' }, attachmentId: { type: 'string' } }, required: ['messageId', 'attachmentId'] },
                    outputSample: { data: '...' },
                },
            ],
        }],
        triggerOutputs: { __manual: { fields: [], sample: {} } },
    };

    it('enables forEach over the nearest array and binds <entity>Id → loop.<item>.id', () => {
        const { step, mappedKeys, forEachEnabled } = autoMapStep(definition.steps[1], definition, catalog);
        expect(forEachEnabled).toBe(true);
        expect(step.forEach).toEqual({ overRef: 'steps.s1.output.results', itemVar: 'result', maxIterations: 100 });
        expect(step.inputs.messageId).toEqual({ kind: 'ref', path: 'loop.result.id' });
        // No attachment id exists in the search element → left empty for the user.
        expect(step.inputs.attachmentId).toBeUndefined();
        expect(mappedKeys).toContain('messageId');
    });

    it('applyAutoMapToStep persists forEach + marks the bound input as auto', () => {
        const out = applyAutoMapToStep(definition, 's2', catalog);
        const s2 = out.definition.steps.find(s => s.id === 's2');
        expect(out.forEachEnabled).toBe(true);
        expect(s2.forEach.overRef).toBe('steps.s1.output.results');
        expect(s2.autoMapped).toContain('messageId');
    });

    it('binds an exact element-name match directly (no id-affinity needed)', () => {
        const def = {
            ...definition,
            steps: [
                { id: 's1', type: 'integration_action', tool: 'gmail_search', inputs: {} },
                { id: 's2', type: 'integration_action', tool: 'reader', inputs: {} },
            ],
        };
        const cat = {
            apps: [{
                actions: [
                    { name: 'gmail_search', outputSample: { results: [{ messageId: 'm1', subject: 's' }] } },
                    { name: 'reader', inputSchema: { properties: { messageId: { type: 'string' } }, required: ['messageId'] } },
                ],
            }],
            triggerOutputs: { __manual: { fields: [], sample: {} } },
        };
        const { step, forEachEnabled } = autoMapStep(def.steps[1], def, cat);
        expect(forEachEnabled).toBe(true);
        expect(step.inputs.messageId).toEqual({ kind: 'ref', path: 'loop.result.messageId' });
    });

    it('does NOT iterate when a scalar upstream already satisfies the required input', () => {
        const def = {
            trigger: { id: 'trg', type: 'trigger', kind: 'manual' },
            steps: [
                { id: 's1', type: 'integration_action', tool: 'get_one', inputs: {} },
                { id: 's2', type: 'integration_action', tool: 'reader', inputs: {} },
            ],
            edges: [{ from: 'trg', to: 's1' }, { from: 's1', to: 's2' }],
        };
        const cat = {
            apps: [{
                actions: [
                    // top-level scalar messageId + an unrelated array
                    { name: 'get_one', outputSample: { messageId: 'm1', results: [{ id: 'x' }] } },
                    { name: 'reader', inputSchema: { properties: { messageId: { type: 'string' } }, required: ['messageId'] } },
                ],
            }],
            triggerOutputs: { __manual: { fields: [], sample: {} } },
        };
        const { step, forEachEnabled } = autoMapStep(def.steps[1], def, cat);
        expect(forEachEnabled).toBeFalsy();
        expect(step.forEach).toBeUndefined();
        expect(step.inputs.messageId).toEqual({ kind: 'ref', path: 'steps.s1.output.messageId' });
    });

    it('iterates a forEach step\'s attachments via results[*].output (nested loop)', () => {
        // search → read (forEach over results) → read_attachment. read's real
        // output is the forEach envelope, so the attachment iterable lives at
        // steps.s2.output.results[*].output.attachments — NOT steps.s2.output.attachments.
        const def = {
            trigger: { id: 'trg', type: 'trigger', kind: 'manual' },
            steps: [
                { id: 's1', type: 'integration_action', tool: 'gmail_search', inputs: {} },
                {
                    id: 's2', type: 'integration_action', tool: 'gmail_read', inputs: { messageId: { kind: 'ref', path: 'loop.result.id' } },
                    forEach: { overRef: 'steps.s1.output.results', itemVar: 'result', maxIterations: 100 },
                },
                { id: 's3', type: 'integration_action', tool: 'gmail_read_attachment', inputs: {} },
            ],
            edges: [{ from: 'trg', to: 's1' }, { from: 's1', to: 's2' }, { from: 's2', to: 's3' }],
        };
        const cat = {
            apps: [{
                actions: [
                    { name: 'gmail_search', outputSample: { results: [{ id: 'm1' }], total: 1 } },
                    { name: 'gmail_read', outputSample: { id: 'm1', threadId: 't1', subject: 's', attachments: [{ attachmentId: 'a1', filename: 'x.pdf', mimeType: 'application/pdf', size: 10, canOCR: true, messageId: 'm1', threadId: 't1' }] } },
                    { name: 'gmail_read_attachment', inputSchema: { properties: { messageId: { type: 'string' }, attachmentId: { type: 'string' }, mimeType: { type: 'string' } }, required: ['messageId', 'attachmentId'] }, outputSample: { content: '...' } },
                ],
            }],
            triggerOutputs: { __manual: { fields: [], sample: {} } },
        };

        // The read group exposes the flattened iterable, not the flat path.
        const groups = computeUpstreamGroups(def, 's3', cat);
        const readGroup = groups.find(g => g.id === 's2');
        const arrField = (readGroup.fields || []).find(f => Array.isArray(f.sample));
        expect(arrField.path).toBe('steps.s2.output.results[*].output.attachments');

        // inferLoopItemSample resolves that path to the attachment element.
        const el = inferLoopItemSample('steps.s2.output.results[*].output.attachments', def, buildToolOutputMap(cat));
        expect(el.attachmentId).toBeDefined();
        expect(el.messageId).toBeDefined();

        // Auto-map fans out over the attachments with both ids bound from the item.
        const { step, forEachEnabled } = autoMapStep(def.steps[2], def, cat);
        expect(forEachEnabled).toBe(true);
        expect(step.forEach.overRef).toBe('steps.s2.output.results[*].output.attachments');
        expect(step.forEach.itemVar).toBe('attachment');
        expect(step.inputs.messageId).toEqual({ kind: 'ref', path: 'loop.attachment.messageId' });
        expect(step.inputs.attachmentId).toEqual({ kind: 'ref', path: 'loop.attachment.attachmentId' });
    });

    it('respects an existing user-set forEach (never overrides)', () => {
        const def = {
            ...definition,
            steps: [
                definition.steps[0],
                { ...definition.steps[1], forEach: { overRef: 'steps.s1.output.results', itemVar: 'x', maxIterations: 5 } },
            ],
        };
        const { step } = autoMapStep(def.steps[1], def, catalog);
        expect(step.forEach.itemVar).toBe('x');
        expect(step.forEach.maxIterations).toBe(5);
    });
});

describe('regression: [*] element children never auto-map into scalar params', () => {
    // A collection group (e.g. Filter) exposes the element fields as
    // items[*].<key> children whose SAMPLE is a scalar — but at runtime the
    // [*] flatten resolves to an ARRAY. Auto-mapping one into a scalar
    // string input would silently bind an array. They must be skipped even
    // on an exact name + type match.
    const collectionGroups = [
        {
            id: 'B', label: 'Filter', kind: 'collection', basePath: 'steps.B.output',
            fields: [
                {
                    key: 'items', path: 'steps.B.output.items', sample: [{ email: 'a@b.c' }],
                    children: [{ key: 'email', path: 'steps.B.output.items[*].email', sample: 'a@b.c' }],
                },
                { key: 'count', path: 'steps.B.output.count', sample: 0 },
            ],
        },
    ];

    it('leaves a scalar string param named after a [*] child unmapped', () => {
        const schema = { properties: { email: { type: 'string' } }, required: ['email'] };
        const patch = autoMapInputs(schema, {}, collectionGroups);
        expect(patch.email).toBeUndefined();
        expect(patch).toEqual({});
    });

    it('still maps a non-wildcard field from the same group', () => {
        const schema = { properties: { email: { type: 'string' }, count: { type: 'number' } } };
        const patch = autoMapInputs(schema, {}, collectionGroups);
        expect(patch.email).toBeUndefined();
        expect(patch.count).toEqual({ kind: 'ref', path: 'steps.B.output.count' });
    });
});

/**
 * The run/pinned-data gap: a step that just produced 10 real records upstream
 * of a freshly added node used to auto-map as if it produced nothing, because
 * the catalog had no outputSample for its tool. With opts.realOutputById the
 * real output IS the sample.
 */
describe('auto-map with real run/pinned data', () => {
    // Tool unknown to the catalog — the design-time group is empty.
    const definition = {
        trigger: { id: 'trg', type: 'trigger', kind: 'manual' },
        steps: [
            { id: 's1', type: 'integration_action', tool: 'mystery_tool', inputs: {} },
            { id: 'f1', type: 'filter', arrayRef: '' },
        ],
        edges: [{ from: 'trg', to: 's1' }, { from: 's1', to: 'f1' }],
    };
    const catalog = { apps: [], triggerOutputs: {} };
    const realOutputById = new Map([['s1', { results: [{ id: 7, subject: 'hi' }] }]]);

    it('without real data the source stays unbound (the old failure)', () => {
        const { mappedKeys } = autoMapStep(definition.steps[1], definition, catalog);
        expect(mappedKeys).toEqual([]);
    });

    it('a collection op binds its arrayRef from the real output', () => {
        const { step, mappedKeys } = autoMapStep(definition.steps[1], definition, catalog, { realOutputById });
        expect(mappedKeys).toEqual(['arrayRef']);
        expect(step.arrayRef).toBe('steps.s1.output.results');
    });

    it('a pristine condition flips to list-mode filter on real rows', () => {
        const def = {
            ...definition,
            steps: [definition.steps[0], { id: 'c1', type: 'condition', expr: '' }],
            edges: [{ from: 'trg', to: 's1' }, { from: 's1', to: 'c1' }],
        };
        const { step } = autoMapStep(def.steps[1], def, catalog, { realOutputById });
        expect(step.type).toBe('filter');
        expect(step.arrayRef).toBe('steps.s1.output.results');
    });

    it('iteration auto-detection reads the element shape from real rows', () => {
        const def = {
            ...definition,
            steps: [
                definition.steps[0],
                { id: 'act', type: 'integration_action', tool: 'read_message', inputs: {} },
            ],
            edges: [{ from: 'trg', to: 's1' }, { from: 's1', to: 'act' }],
        };
        const cat = {
            apps: [{ actions: [{ name: 'read_message', inputSchema: { properties: { messageId: { type: 'number' } }, required: ['messageId'] } }] }],
            triggerOutputs: {},
        };
        const { step, forEachEnabled } = autoMapStep(def.steps[1], def, cat, { realOutputById });
        expect(forEachEnabled).toBe(true);
        expect(step.forEach.overRef).toBe('steps.s1.output.results');
        expect(step.inputs.messageId).toEqual({ kind: 'ref', path: 'loop.result.id' });
    });

    it('applyAutoMapToStep forwards realOutputById through opts', () => {
        const out = applyAutoMapToStep(definition, 'f1', catalog, { realOutputById });
        expect(out.mappedKeys).toEqual(['arrayRef']);
        expect(out.definition.steps.find(s => s.id === 'f1').arrayRef).toBe('steps.s1.output.results');
    });
});

describe('guard — the source is bound on arrival, not asked for', () => {
    // A guard dropped below a step means "check what that step just produced".
    // Leaving it unbound is how you get a node that greets you with a warning,
    // and — before the validator was softened — one the definition could not
    // even save, so Execute failed with "step not found in definition".
    const guard = (over = {}) => ({ id: 'g1', type: 'guard', ...over });
    const mkDef = (g, upstream) => ({
        trigger: { id: 'trg', type: 'trigger', kind: 'manual' },
        steps: [upstream, g],
        edges: [{ from: 'trg', to: upstream.id }, { from: upstream.id, to: g.id }],
    });
    const catalogWith = (outputSample) => ({
        apps: [{ actions: [{ name: 'gmail_read', outputSample }] }],
        triggerOutputs: { __manual: { fields: [], sample: {} } },
    });
    const reader = { id: 's1', type: 'integration_action', tool: 'gmail_read', inputs: {} };

    it('prefers a field that holds the text a person wrote', () => {
        const g = guard();
        const catalog = catalogWith({ id: 'm1', subject: 'Hi', body: 'Dear Jan, …' });
        const { step, mappedKeys } = autoMapStep(g, mkDef(g, reader), catalog);
        expect(step.sourceRef).toBe('steps.s1.output.body');
        expect(mappedKeys).toEqual(['sourceRef']);
    });

    it('falls back to any upstream text', () => {
        const g = guard();
        const catalog = catalogWith({ id: 'm1', headline: 'Quarterly figures' });
        expect(autoMapStep(g, mkDef(g, reader), catalog).step.sourceRef).toBe('steps.s1.output.id');
    });

    it('falls back to the whole nearest output when nothing is a string', () => {
        // An object is scanned as its JSON, so "everything that step produced"
        // is a real answer rather than a guess.
        const g = guard();
        const catalog = catalogWith({ total: 4, unread: true });
        expect(autoMapStep(g, mkDef(g, reader), catalog).step.sourceRef).toBe('steps.s1.output');
    });

    it('never overrides a source the author already chose', () => {
        const g = guard({ sourceRef: 'trigger.output.text' });
        const catalog = catalogWith({ body: 'Dear Jan, …' });
        const { step, mappedKeys } = autoMapStep(g, mkDef(g, reader), catalog);
        expect(step.sourceRef).toBe('trigger.output.text');
        expect(mappedKeys).toEqual([]);
    });
});

describe('the restore step binds itself to what was hidden', () => {
    // The pairing that matters: drop "Show real values again" after "Hide
    // personal data" and it should already point at that step's output.text.
    it('auto-binds to the tokenize step above it', () => {
        const def = {
            trigger: { id: 'trg', type: 'trigger', kind: 'manual' },
            steps: [
                { id: 'tok', type: 'tokenize', sourceRef: 'trigger.output.body' },
                { id: 'un', type: 'untokenize' },
            ],
            edges: [{ from: 'trg', to: 'tok' }, { from: 'tok', to: 'un' }],
        };
        const catalog = { apps: [], triggerOutputs: { __manual: { fields: [], sample: {} } } };
        const { step, mappedKeys } = autoMapStep({ id: 'un', type: 'untokenize' }, def, catalog);
        expect(step.sourceRef).toBe('steps.tok.output.text');
        expect(mappedKeys).toEqual(['sourceRef']);
    });
});

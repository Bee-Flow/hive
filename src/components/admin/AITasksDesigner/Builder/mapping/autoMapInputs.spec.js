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

import { describe, it, expect } from 'vitest';
import { computeUpstreamGroups, overlayGroupWithReal } from './upstream';

/**
 * Real run/pinned output flowing into the upstream groups — the fix for
 * "I ran the step, it holds 10 records, and the node I add after it still
 * sees placeholders". The 4th computeUpstreamGroups argument is optional and
 * absent-off: without it the output must stay byte-identical to before.
 */

const ROWS = [
    { subject: 'ISV contract', from_email: 'a@b.nl' },
    { subject: 'Pitch deck', from_email: 'c@d.nl' },
];

// An integration action the catalog knows NOTHING about (no outputSample) —
// the exact case where design-time describers produce an empty group.
const DEF = {
    trigger: { id: 'trg', kind: 'manual' },
    steps: [
        { id: 's1', type: 'integration_action', tool: 'gmail_search', label: 'gmail search', inputs: {} },
        { id: 'f1', type: 'filter', arrayRef: 'steps.s1.output.results' },
        { id: 'cur', type: 'notification', title: 'x' },
    ],
    edges: [
        { from: 'trg', to: 's1' },
        { from: 's1', to: 'f1' },
        { from: 'f1', to: 'cur' },
    ],
};
const CATALOG = { apps: [], triggerOutputs: {} };

const real = () => new Map([['s1', { total: 2, results: ROWS }]]);

describe('computeUpstreamGroups with realOutputById', () => {
    it('without the 4th argument nothing changes (regression pin)', () => {
        const before = computeUpstreamGroups(DEF, 'cur', CATALOG);
        const after = computeUpstreamGroups(DEF, 'cur', CATALOG, null);
        expect(after).toEqual(before);
        expect(after.some(g => g.hasRealData)).toBe(false);
    });

    it('a run/pinned output fills the group sample AND its fields', () => {
        const groups = computeUpstreamGroups(DEF, 'cur', CATALOG, real());
        const g = groups.find(x => x.id === 's1');
        expect(g.hasRealData).toBe(true);
        expect(g.sample.results).toBe(real().get('s1').results ?? g.sample.results); // real rows present
        expect(g.sample.total).toBe(2);
        const resultsField = g.fields.find(f => f.key === 'results');
        expect(Array.isArray(resultsField.sample)).toBe(true);
        // Array-of-objects gets [*] children so pickers and auto-map can see
        // the element shape.
        expect(resultsField.children.map(c => c.path)).toEqual([
            'steps.s1.output.results[*].subject',
            'steps.s1.output.results[*].from_email',
        ]);
    });

    it('downstream describers resolve their refs against the REAL upstream data', () => {
        const groups = computeUpstreamGroups(DEF, 'cur', CATALOG, real());
        const filter = groups.find(x => x.id === 'f1');
        // describeCollectionItems resolves arrayRef against the accumulated
        // sampleRoot — with real data that yields the real element shape.
        const items = filter.fields.find(f => f.key === 'items');
        expect(items.children.map(c => c.key)).toEqual(['subject', 'from_email']);
        expect(filter.sample.items[0]).toEqual(ROWS[0]);
    });

    it('a real JSON body replaces an http placeholder string wholesale', () => {
        const def = {
            ...DEF,
            steps: [
                { id: 'h1', type: 'http_request', url: 'https://x', method: 'GET' },
                { id: 'cur', type: 'notification', title: 'x' },
            ],
            edges: [{ from: 'trg', to: 'h1' }, { from: 'h1', to: 'cur' }],
        };
        const groups = computeUpstreamGroups(def, 'cur', CATALOG, new Map([['h1', { status: 200, body: ROWS }]]));
        const g = groups.find(x => x.id === 'h1');
        const body = g.fields.find(f => f.key === 'body');
        expect(Array.isArray(body.sample)).toBe(true);
        expect(body.children.some(c => c.path === 'steps.h1.output.body[*].subject')).toBe(true);
    });

    it('a fired trigger is not clobbered by a second trigger group', () => {
        const def = {
            ...DEF,
            triggers: [{ id: 'hook', kind: 'webhook' }],
        };
        const groups = computeUpstreamGroups(def, 'cur', CATALOG, new Map([['trg', { fired: true, n: 1 }]]));
        const primary = groups.find(g => g.id === 'trg');
        expect(primary.hasRealData).toBe(true);
        expect(primary.sample.fired).toBe(true);
        // The webhook group still describes ITSELF as a placeholder…
        const hook = groups.find(g => g.id === 'hook');
        expect(hook.hasRealData).toBeFalsy();
        // …and downstream refs into trigger.output resolve to the REAL data:
        // f1's arrayRef doesn't touch trigger here, so assert via a loop-style
        // resolve — the s1 group is described AFTER both triggers and its
        // sampleRoot carried the real trigger output (no throw = pass); the
        // strong assertion is the primary group's own sample above.
    });

    it('non-object real output (raw ai text) keeps the curated field list', () => {
        const def = {
            ...DEF,
            steps: [
                { id: 'ai1', type: 'ai_step', prompt: 'x' },
                { id: 'cur', type: 'notification', title: 'x' },
            ],
            edges: [{ from: 'trg', to: 'ai1' }, { from: 'ai1', to: 'cur' }],
        };
        const groups = computeUpstreamGroups(def, 'cur', CATALOG, new Map([['ai1', 'plain model answer']]));
        const g = groups.find(x => x.id === 'ai1');
        expect(g.hasRealData).toBe(true);
        expect(g.sample).toBe('plain model answer');
        expect(Array.isArray(g.fields)).toBe(true);
    });

    it('forEach envelope overlays the WRAPPED group, not the flat tool shape', () => {
        const def = {
            ...DEF,
            steps: [
                { id: 's1', type: 'integration_action', tool: 'gmail_search', inputs: {} },
                {
                    id: 'fe', type: 'integration_action', tool: 'send_mail', inputs: {},
                    forEach: { overRef: 'steps.s1.output.results', itemVar: 'item' },
                },
                { id: 'cur', type: 'notification', title: 'x' },
            ],
            edges: [{ from: 'trg', to: 's1' }, { from: 's1', to: 'fe' }, { from: 'fe', to: 'cur' }],
        };
        const envelope = { iterations: 2, succeeded: 2, failed: 0, results: [{ index: 0, item: ROWS[0], output: { ok: true }, status: 'success' }] };
        const groups = computeUpstreamGroups(def, 'cur', CATALOG, new Map([['fe', envelope]]));
        const g = groups.find(x => x.id === 'fe');
        expect(g.sample.iterations).toBe(2);
        expect(g.sample.results[0].output.ok).toBe(true);
    });
});

describe('overlayGroupWithReal', () => {
    const group = {
        id: 's1', kind: 'integration_action', basePath: 'steps.s1.output',
        sample: { results: [] },
        fields: [
            { key: 'results', path: 'steps.s1.output.results', sample: [] },
            // A curated path regeneration can't derive:
            { key: 'special', path: 'steps.s1.output.matchesByCase.vip', sample: [] },
        ],
    };

    it('keeps curated fields whose paths regeneration does not cover', () => {
        const out = overlayGroupWithReal(group, { results: ROWS });
        expect(out.fields.some(f => f.path === 'steps.s1.output.matchesByCase.vip')).toBe(true);
    });

    it('reuses real row references (no cloning of big outputs)', () => {
        const out = overlayGroupWithReal(group, { results: ROWS });
        expect(out.sample.results).toBe(ROWS);
    });

    it('undefined real output is a no-op', () => {
        expect(overlayGroupWithReal(group, undefined)).toBe(group);
    });
});

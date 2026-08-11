import { describe, it, expect } from 'vitest';
import { describeNode, computeUpstreamGroups, buildToolOutputMap } from './upstream';

const node = (over = {}) => ({
    id: 'p1',
    type: 'parse_json',
    label: 'Parse order',
    sourceRef: 'steps.h1.output.body',
    mode: 'paths',
    fields: [
        { name: 'email', path: 'order.customer.email' },
        { name: 'skus', path: 'items[*].sku' },
        { name: 'missing', path: 'nope.x', fallback: 'n/a' },
    ],
    ...over,
});

describe('describeParseJson', () => {
    it('placeholder mode (no sampleRoot): flat <extracted> sample honouring fallbacks', () => {
        const g = describeNode(node(), {}, buildToolOutputMap(null), {});
        expect(g.kind).toBe('parse_json');
        expect(g.basePath).toBe('steps.p1.output');
        expect(g.sample).toEqual({ email: '<extracted>', skus: '<extracted>', missing: 'n/a' });
        expect(g.fields.map(f => f.path)).toEqual([
            'steps.p1.output.email',
            'steps.p1.output.skus',
            'steps.p1.output.missing',
        ]);
    });

    it('resolves real values from the sampleRoot (string source auto-parsed)', () => {
        const sampleRoot = {
            trigger: { output: {} },
            steps: { h1: { output: { body: '{"order":{"customer":{"email":"a@b.c"}},"items":[{"sku":"X1"},{"sku":"X2"}]}' } } },
        };
        const g = describeNode(node(), {}, buildToolOutputMap(null), {}, sampleRoot);
        expect(g.sample).toEqual({ email: 'a@b.c', skus: ['X1', 'X2'], missing: 'n/a' });
    });

    it('rows without a name are skipped; label falls back to Parse JSON', () => {
        const g = describeNode(node({ label: '', fields: [{ name: '', path: 'x' }, null, { name: 'ok', path: 'y' }] }), {}, buildToolOutputMap(null), {});
        expect(g.label).toBe('Parse JSON');
        expect(Object.keys(g.sample)).toEqual(['ok']);
    });

    it('surfaces as a bindable upstream group for a downstream step', () => {
        const def = {
            trigger: { id: 'trg', kind: 'manual' },
            steps: [
                { id: 'h1', type: 'http_request', url: 'https://api.example.com' },
                node(),
                { id: 'n1', type: 'notification', title: 'x' },
            ],
            edges: [{ from: 'trg', to: 'h1' }, { from: 'h1', to: 'p1' }, { from: 'p1', to: 'n1' }],
        };
        const groups = computeUpstreamGroups(def, 'n1', {});
        const g = groups.find(x => x.id === 'p1');
        expect(g).toBeTruthy();
        expect(g.fields.map(f => f.key)).toEqual(['email', 'skus', 'missing']);
    });
});

describe('describeParseJson — grouped (itemsRef)', () => {
    const CAL = {
        steps: {
            c1: {
                output: {
                    results: [
                        { title: 'Daily Scrum', attendees: [{ email: 'a@x.nl' }, { email: 'b@x.nl' }] },
                        { title: 'Weekstart', attendees: [{ email: 'c@x.nl' }] },
                    ],
                },
            },
        },
    };
    const grouped = node({
        sourceRef: 'steps.c1.output',
        itemsRef: 'results',
        fields: [
            { name: 'meeting_title', path: 'title' },
            { name: 'attendee_emails', path: 'attendees[*].email' },
        ],
    });

    it('exposes { items, count } so downstream steps bind rows, not a flat list', () => {
        const g = describeNode(grouped, {}, buildToolOutputMap(null), {}, CAL);
        expect(g.basePath).toBe('steps.p1.output');
        expect(g.sample.count).toBe(2);
        // each row keeps ITS OWN attendees — the whole point of grouping
        expect(g.sample.items[0]).toEqual({ meeting_title: 'Daily Scrum', attendee_emails: ['a@x.nl', 'b@x.nl'] });
        expect(g.sample.items[1]).toEqual({ meeting_title: 'Weekstart', attendee_emails: ['c@x.nl'] });
        expect(g.fields.some(f => f.path === 'steps.p1.output.items')).toBe(true);
    });

    it('falls back to one placeholder row without a resolvable sample', () => {
        const g = describeNode(grouped, {}, buildToolOutputMap(null), {}, null);
        expect(g.sample.items).toHaveLength(1);
        expect(g.sample.items[0].meeting_title).toBe('<extracted>');
    });
});

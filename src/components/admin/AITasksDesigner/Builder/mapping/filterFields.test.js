import { describe, it, expect } from 'vitest';
import { filterFields, filterGroups } from './filterFields';

const FIELDS = [
    { key: 'count', path: 'steps.s1.output.count' },
    {
        key: 'results',
        path: 'steps.s1.output.results',
        children: [
            { key: 'subject', path: 'steps.s1.output.results[*].subject' },
            { key: 'from_email', path: 'steps.s1.output.results[*].from_email' },
        ],
    },
];

describe('filterFields', () => {
    it('returns the input untouched for an empty query', () => {
        expect(filterFields(FIELDS, '')).toBe(FIELDS);
        expect(filterFields(FIELDS, null)).toBe(FIELDS);
    });

    it('matches on the key', () => {
        expect(filterFields(FIELDS, 'count').map(f => f.key)).toEqual(['count']);
    });

    it('matches on the path even when the key does not contain the query', () => {
        expect(filterFields(FIELDS, 'steps.s1').map(f => f.key)).toEqual(['count', 'results']);
    });

    it('keeps a parent as a PATH to its matching children only', () => {
        const out = filterFields(FIELDS, 'subject');
        expect(out).toHaveLength(1);
        expect(out[0].key).toBe('results');
        expect(out[0].children.map(c => c.key)).toEqual(['subject']);
    });

    it('keeps every child when the parent itself matches', () => {
        const out = filterFields(FIELDS, 'results');
        expect(out[0].children).toHaveLength(2);
    });

    it('never mutates the input', () => {
        const before = JSON.stringify(FIELDS);
        filterFields(FIELDS, 'subject');
        expect(JSON.stringify(FIELDS)).toBe(before);
    });

    it('is case-insensitive', () => {
        expect(filterFields(FIELDS, 'COUNT').map(f => f.key)).toEqual(['count']);
    });
});

const GROUPS = [
    { id: 'trg', label: 'Trigger', fields: [{ key: 'email', path: 'trigger.output.email' }] },
    { id: 's1', label: 'Gmail search', fields: FIELDS },
];

describe('filterGroups', () => {
    it('drops groups with no match at all', () => {
        expect(filterGroups(GROUPS, 'trigger.output').map(g => g.id)).toEqual(['trg']);
    });

    it('matches a nested field in one group and the top level in another', () => {
        // `email` hits trigger.output.email AND results[*].from_email.
        const out = filterGroups(GROUPS, 'email');
        expect(out.map(g => g.id)).toEqual(['trg', 's1']);
        expect(out[1].fields[0].children.map(c => c.key)).toEqual(['from_email']);
    });

    it('keeps a group whose LABEL matches in full', () => {
        const out = filterGroups(GROUPS, 'gmail');
        expect(out).toHaveLength(1);
        expect(out[0].fields).toBe(FIELDS);
    });

    it('keeps only the fields that matched otherwise', () => {
        const out = filterGroups(GROUPS, 'subject');
        expect(out).toHaveLength(1);
        expect(out[0].id).toBe('s1');
        expect(out[0].fields[0].children.map(c => c.key)).toEqual(['subject']);
    });

    it('passes everything through for an empty query', () => {
        expect(filterGroups(GROUPS, '  ')).toBe(GROUPS);
    });
});

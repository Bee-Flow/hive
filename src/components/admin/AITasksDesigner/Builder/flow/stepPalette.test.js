import { describe, it, expect } from 'vitest';
import { buildStepGroups, buildSearchResults, pickItem, LOGIC_ITEMS, groupBlocksByCategory } from './stepPalette';

const catalog = {
    apps: [
        { id: 'gmail', label: 'Gmail', available: true, connected: true, actions: [
            { name: 'gmail_send', label: 'Send email', description: 'Send a message', integrationId: 'gmail', sideEffect: true },
            { name: 'gmail_search', label: 'Search email', integrationId: 'gmail' },
        ] },
    ],
    steps: [{ id: 'b1', title: 'Send Invoice', params: [{}], outputFields: [{}], available: true }],
    flags: { code: true },
};

describe('stepPalette — buildStepGroups', () => {
    it('returns the core ordered groups, plus Steps when present', () => {
        const keys = buildStepGroups({ catalog }).map(g => g.key);
        expect(keys).toEqual(['ai', 'action', 'flow', 'flowlets', 'steps']);
    });

    it('consolidates flow control, data, lists (and code) into the Flow group', () => {
        const flow = buildStepGroups({ catalog }).find(g => g.key === 'flow');
        expect(flow.kind).toBe('sections');
        expect(flow.sections.map(s => s.key)).toEqual(['flow_control', 'data', 'lists', 'code']);
    });

    it('omits the Steps group while building a Step (isBlockRoot)', () => {
        const keys = buildStepGroups({ catalog, isBlockRoot: true }).map(g => g.key);
        expect(keys).not.toContain('steps');
    });

    it('omits the Code section when the flag is off', () => {
        const flow = buildStepGroups({ catalog: { apps: [], flags: {} } }).find(g => g.key === 'flow');
        expect(flow.sections.some(s => s.key === 'code')).toBe(false);
    });

    it('the action group carries category→app structure', () => {
        const action = buildStepGroups({ catalog }).find(g => g.key === 'action');
        expect(action.kind).toBe('apps');
        const apps = action.categories.flatMap(c => c.apps);
        expect(apps.find(a => a.id === 'gmail')).toBeTruthy();
    });

    it('flowlets group always offers Create flowlet + inline flowlets', () => {
        const fl = buildStepGroups({ catalog, layers: [{ key: 'l1', title: 'My flowlet', params: [] }] }).find(g => g.key === 'flowlets');
        const labels = fl.items.map(i => i.label);
        expect(labels).toContain('Create flowlet');
        expect(labels).toContain('My flowlet');
    });
});

describe('stepPalette — buildSearchResults', () => {
    it('ranks an exact-ish label match high and finds app actions', () => {
        const res = buildSearchResults('send email', { catalog });
        expect(res[0].label.toLowerCase()).toContain('send email');
        expect(res.some(r => r.payload?.tool === 'gmail_send')).toBe(true);
    });

    it('matches on keywords (loop → Loop Over Items)', () => {
        const res = buildSearchResults('iterate', { catalog });
        expect(res.some(r => r.payload?.kind === 'loop')).toBe(true);
    });

    it('returns [] for an empty query', () => {
        expect(buildSearchResults('', { catalog })).toEqual([]);
    });
});

describe('stepPalette — pickItem', () => {
    it('finds an item by id', () => {
        expect(pickItem(LOGIC_ITEMS, 'loop').payload.kind).toBe('loop');
        expect(pickItem(LOGIC_ITEMS, 'nope')).toBeNull();
    });
});

describe('stepPalette — Flow group contains If / Loop / Edit fields', () => {
    it('keeps If, Loop and Edit fields in the consolidated Flow group', () => {
        const flow = buildStepGroups({ catalog }).find(g => g.key === 'flow');
        const ids = flow.sections.flatMap(s => s.items.map(it => it.id));
        expect(ids).toContain('condition'); // If
        expect(ids).toContain('loop');
        expect(ids).toContain('set');       // Edit fields
        expect(ids).toContain('datetime');
    });
});

describe('stepPalette — Steps grouped by category', () => {
    const cat = (steps) => ({ catalog: { apps: [], flags: {}, steps } });

    it('renders a single uncategorised bucket flat (no sub-headings)', () => {
        const g = buildStepGroups(cat([{ id: 'b1', title: 'A', params: [], outputFields: [], available: true }])).find(x => x.key === 'steps');
        expect(g.kind).toBeUndefined();
        expect(g.items.map(i => i.label)).toEqual(['A']);
    });

    it('splits into category sections, named categories alpha then Uncategorised last', () => {
        const g = buildStepGroups(cat([
            { id: 'b1', title: 'Send', category: 'Sales', params: [], outputFields: [], available: true },
            { id: 'b2', title: 'Tag', category: 'Admin', params: [], outputFields: [], available: true },
            { id: 'b3', title: 'Misc', params: [], outputFields: [], available: true },
        ])).find(x => x.key === 'steps');
        expect(g.kind).toBe('sections');
        expect(g.sections.map(s => s.title)).toEqual(['Admin', 'Sales', 'Uncategorised']);
    });

    it('hides integration-unavailable Steps from the menu', () => {
        const g = buildStepGroups(cat([
            { id: 'b1', title: 'Ok', category: 'X', params: [], outputFields: [], available: true },
            { id: 'b2', title: 'NoInt', category: 'X', params: [], outputFields: [], available: false },
        ])).find(x => x.key === 'steps');
        const labels = (g.items || g.sections.flatMap(s => s.items)).map(i => i.label);
        expect(labels).toEqual(['Ok']);
    });

    it('groupBlocksByCategory sorts steps within a category by title', () => {
        const sections = groupBlocksByCategory([
            { id: 'b1', title: 'Zebra', category: 'C', params: [], outputFields: [] },
            { id: 'b2', title: 'Apple', category: 'C', params: [], outputFields: [] },
        ]);
        expect(sections[0].items.map(i => i.label)).toEqual(['Apple', 'Zebra']);
    });
});

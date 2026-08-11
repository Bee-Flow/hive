import { describe, it, expect } from 'vitest';
import { buildStepGroups, buildSearchResults, pickItem, itemForKey, LOGIC_ITEMS, DATA_ITEMS, COLLECTION_ITEMS, EDIT_DATA_ITEM, groupBlocksByCategory, TRIGGERS, SECONDARY_TRIGGERS } from './stepPalette';

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

describe('stepPalette — trigger catalog', () => {
    it('offers the app_trigger ("From a Studio App") as a primary trigger', () => {
        const t = TRIGGERS.find(x => x.id === 'app_trigger');
        expect(t).toBeTruthy();
        expect(t.payload).toEqual({ kind: 'trigger', triggerKind: 'app_trigger', label: 'Studio App' });
        expect(t.keywords).toContain('studio');
    });

    it('app_trigger is primary-only — never a secondary trigger', () => {
        expect(SECONDARY_TRIGGERS.some(t => t.payload.triggerKind === 'app_trigger')).toBe(false);
    });
});

describe('stepPalette — buildStepGroups', () => {
    it('returns the core ordered groups, plus Steps when present', () => {
        const keys = buildStepGroups({ catalog }).map(g => g.key);
        expect(keys).toEqual(['triggers', 'ai', 'action', 'flow', 'flowlets', 'steps']);
    });

    it('leaves triggers out of a flowlet or a loop body', () => {
        // A flowlet's trigger IS its input contract, and buildStepFromPayload
        // rejects trigger payloads in a loop body (BFSF-325).
        expect(buildStepGroups({ catalog, inLayer: true }).map(g => g.key)).not.toContain('triggers');
        expect(buildStepGroups({ catalog, isBlockRoot: true }).map(g => g.key)).not.toContain('triggers');
    });

    it('consolidates flow control, data & lists (and code) into the Flow group', () => {
        const flow = buildStepGroups({ catalog }).find(g => g.key === 'flow');
        expect(flow.kind).toBe('sections');
        // BFSF-361: "Data" and "Lists" were two adjacent headings for the same
        // job — reshape what I've got — so they are ONE section now. Two places
        // to fail to find the same step is one place too many.
        expect(flow.sections.map(s => s.key)).toEqual(['flow_control', 'data', 'code']);
        expect(flow.sections.find(s => s.key === 'data').title).toBe('Data & lists');
    });

    it('the merged Data & lists section keeps every step from both old groups', () => {
        const flow = buildStepGroups({ catalog }).find(g => g.key === 'flow');
        const ids = flow.sections.find(s => s.key === 'data').items.map(i => i.id);
        // records-first, then the whole-list operations
        expect(ids).toEqual(['set', 'datetime', 'http_request', 'limit', 'dedupe', 'aggregate', 'summarize']);
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

describe('stepPalette — Flow group contains Filter / Loop / Edit data', () => {
    it('keeps the deciding step, Loop and Edit data in the consolidated Flow group', () => {
        const flow = buildStepGroups({ catalog }).find(g => g.key === 'flow');
        const ids = flow.sections.flatMap(s => s.items.map(it => it.id));
        // If / Switch / Filter(route) / Filter(collection) merged into one item.
        expect(ids).toContain('route');
        expect(ids).not.toContain('condition');
        expect(ids).not.toContain('switch');
        expect(ids).not.toContain('filter');
        expect(ids).toContain('loop');
        expect(ids).toContain('set');       // Edit data
        expect(ids).toContain('datetime');
        // Parse JSON merged INTO Edit data — no separate palette entry left.
        expect(ids).not.toContain('parse_json');
    });

    it('the Edit data item carries the final display name (label + payload agree)', () => {
        // One literal canary so a stray rename in stepDisplayName.js is loud.
        expect(EDIT_DATA_ITEM.label).toBe('Edit data');
        expect(EDIT_DATA_ITEM.payload).toEqual({ kind: 'set', label: 'Edit data' });
    });
});

describe('stepPalette — Parse JSON retirement', () => {
    it('searching "parse json" lands on Edit data', () => {
        const res = buildSearchResults('parse json', { catalog });
        expect(res.some(r => r.payload?.kind === 'set')).toBe(true);
        expect(res.some(r => r.payload?.kind === 'parse_json')).toBe(false);
    });

    it('recorded usage keys keep resolving: step:parse_json → the Edit data item', () => {
        const hit = itemForKey('step:parse_json', { catalog });
        expect(hit).toBeTruthy();
        expect(hit.payload.kind).toBe('set');
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

describe('stepPalette — form pages', () => {
    const catalog = { apps: [] };
    // A form page needs the routine to start with a form trigger — without one
    // the server rejects it outright, so the palette hides it. These cases are
    // about the pages themselves, so they assume the trigger is there.
    const flowItems = (opts = {}) => {
        const g = buildStepGroups({ catalog, hasFormTrigger: true, ...opts }).find(x => x.key === 'flow');
        return (g?.sections || []).flatMap(s => s.items).concat(g?.items || []);
    };

    it('offers the two form pages as separate things to reach for', () => {
        // One step type underneath, but "ask something else" and "say what
        // happened" are different jobs, so they are two palette entries.
        const ids = flowItems().map(i => i.id);
        expect(ids).toContain('form_page');
        expect(ids).toContain('form_ending');

        const items = flowItems();
        expect(items.find(i => i.id === 'form_page').payload).toMatchObject({ kind: 'form_page', mode: 'input' });
        expect(items.find(i => i.id === 'form_ending').payload).toMatchObject({ kind: 'form_page', mode: 'ending' });
    });

    /** Search results carry the payload, not the palette id. */
    const modesFound = (query, opts = {}) => buildSearchResults(query, { catalog, hasFormTrigger: true, ...opts })
        .filter(r => r.payload?.kind === 'form_page')
        .map(r => r.payload.mode);

    it('both are findable by what an author would actually type', () => {
        expect(modesFound('form')).toEqual(expect.arrayContaining(['input', 'ending']));
        expect(modesFound('second page')).toContain('input');
        expect(modesFound('summary')).toContain('ending');
        expect(modesFound('thanks')).toContain('ending');
    });

    it('neither is offered inside a flowlet — a pause there has no resumable address', () => {
        // Same rule the server enforces (validate.js layer.form_page_forbidden),
        // applied where the author would otherwise reach for it.
        const kinds = flowItems({ inLayer: true }).map(i => i.payload?.kind);
        expect(kinds).not.toContain('form_page');
        expect(kinds).not.toContain('approval');

        expect(modesFound('form', { inLayer: true })).toEqual([]);
    });
});

describe('stepPalette — triggers are findable once a routine has one (BFSF-325)', () => {
    // The search used to return TRIGGERS only in mode:'trigger', which is the
    // empty-canvas state — so on any real routine "trigger", "click" and
    // "webhook" all returned nothing and the only way in was a two-entry menu.
    const labels = (q, opts = {}) => buildSearchResults(q, { catalog, ...opts }).map(r => r.label);

    it('finds a trigger by the word "trigger"', () => {
        expect(labels('trigger').length).toBeGreaterThan(0);
    });

    it('finds them by the words a user actually types', () => {
        expect(labels('click')).toContain('Trigger manually');
        expect(labels('manual')).toContain('Trigger manually');
        expect(labels('webhook')).toContain('On webhook call');
        expect(labels('schedule')).toContain('On a schedule');
    });

    it('adds an entry point for the two kinds the validator allows there, and replaces for the rest', () => {
        const byId = Object.fromEntries(buildSearchResults('trigger', { catalog }).map(r => [r.key, r]));
        expect(byId.webhook.payload.asSecondaryTrigger).toBe(true);
        expect(byId.app_event.payload.asSecondaryTrigger).toBe(true);
        expect(byId.schedule.payload.asSecondaryTrigger).toBeUndefined();
        expect(byId.manual.payload.asSecondaryTrigger).toBeUndefined();
        // …and each says which it is, so a search result is never a surprise.
        expect(byId.webhook.secondary).toMatch(/Adds another way/);
        expect(byId.schedule.secondary).toMatch(/Replaces/);
    });

    it('offers none inside a flowlet or a loop body', () => {
        expect(labels('trigger', { inLayer: true })).toEqual([]);
        expect(labels('trigger', { isBlockRoot: true })).toEqual([]);
    });

    it('still seeds the primary trigger on an empty canvas', () => {
        const res = buildSearchResults('trigger', { catalog, mode: 'trigger' });
        expect(res.length).toBe(TRIGGERS.length);
        expect(res.every(r => !r.payload.asSecondaryTrigger)).toBe(true);
    });

    it('resolves a recorded trigger back into a Frequently-used item', () => {
        // itemForKey returned null for `trigger:*`, so a trigger someone
        // reaches for daily could never come back as a suggestion.
        const hit = itemForKey('trigger:schedule', { catalog });
        expect(hit.label).toBe('On a schedule');
        expect(hit.payload.triggerKind).toBe('schedule');
        expect(itemForKey('trigger:nope', { catalog })).toBeNull();
    });
});

describe('stepPalette — the form steps need a form trigger', () => {
    // server/automation/validate.js rejects a form page with
    // `form_page.no_form_trigger` when the routine doesn't start with a form
    // trigger — adding it anyway sells the author a guaranteed error.
    //
    // They used to be filtered out entirely, which answered "you can't have
    // this" with silence: the step was undiscoverable and the rule behind it
    // unknowable (BFSF-348). They are now offered inert, carrying the reason.
    const flowItems = (opts) => buildStepGroups({ catalog, ...opts })
        .find(g => g.key === 'flow').sections.find(s => s.key === 'flow_control').items;
    const flowIds = (opts) => flowItems(opts).map(i => i.id);

    it('shows them disabled, with the reason, when there is no form trigger', () => {
        const items = flowItems({ hasFormTrigger: false });
        const ids = items.map(i => i.id);
        expect(ids).toContain('form_page');
        expect(ids).toContain('form_ending');
        for (const id of ['form_page', 'form_ending']) {
            const it = items.find(x => x.id === id);
            expect(it.disabled).toBe(true);
            expect(it.disabledReason).toMatch(/form/i);
        }
        // The rest of Flow control is untouched — and stays addable.
        expect(ids).toContain('wait');
        expect(items.find(i => i.id === 'wait').disabled).toBeUndefined();
    });

    it('offers them for real once a form trigger exists', () => {
        const items = flowItems({ hasFormTrigger: true });
        const ids = items.map(i => i.id);
        expect(ids).toContain('form_page');
        expect(ids).toContain('form_ending');
        expect(items.find(i => i.id === 'form_page').disabled).toBeUndefined();
    });

    it('says so in search too, rather than returning nothing', () => {
        const search = (opts) => buildSearchResults('form', { catalog, ...opts });
        const blocked = search({ hasFormTrigger: false }).find(r => r.key === 'form_page');
        expect(blocked).toBeTruthy();
        expect(blocked.disabled).toBe(true);
        expect(blocked.disabledReason).toMatch(/form/i);
        expect(search({ hasFormTrigger: true }).find(r => r.key === 'form_page').disabled).toBeUndefined();
    });

    /**
     * BFSF-348 remainder. `hasFormTrigger` defaulted to `false`, so a surface
     * that simply didn't pass it — the "Add step here" popover — told the
     * author a form step was impossible even when the routine started with a
     * form trigger. "You can't have this" is a claim; a caller that doesn't
     * know must not make it. Only a definite `false` disables.
     */
    it('does not claim the step is impossible when the caller never said (tri-state)', () => {
        const items = flowItems({});           // no hasFormTrigger key at all
        expect(items.find(i => i.id === 'form_page').disabled).toBeUndefined();
        expect(buildSearchResults('form', { catalog }).find(r => r.key === 'form_page').disabled).toBeUndefined();
    });

    it('still hides them inside a flowlet — a pause there has no resumable address', () => {
        expect(flowIds({ inLayer: true, hasFormTrigger: true })).not.toContain('form_page');
    });

    it('names them so the author can tell they are about a form', () => {
        const items = flowItems({ hasFormTrigger: true });
        expect(items.find(i => i.id === 'form_page').label).toMatch(/^Form:/);
        expect(items.find(i => i.id === 'form_ending').label).toMatch(/^Form:/);
    });
});

/**
 * The Lists and Data nodes were renamed out of n8n vocabulary ("Aggregate" →
 * "Collect one field", "Summarize" → "Add up or count", "Limit" → "Shorten
 * list", "HTTP Request" → "Call a web service", "Loop Over Items" → "Repeat for
 * each"). Two things must survive that:
 *
 *   1. SEARCH. The ranker matches keywords at its lowest bucket, so the old
 *      word has to keep finding the node. A user who knows only "aggregate" —
 *      because that is what every other tool calls it — must not hit a dead end.
 *   2. USAGE KEYS. stepUsage records `step:<id>` / `step:<payload.kind>`, and
 *      itemForKey resolves those back for "Frequently used". Ids and payload
 *      kinds are therefore FROZEN; labels are not.
 */
describe('the plain-language rename', () => {
    const catalog = { apps: [], steps: [], flags: {} };
    const find = (q) => buildSearchResults(q, { catalog });

    it('still finds each renamed node by the word it used to be called', () => {
        for (const [oldWord, kind] of [
            ['aggregate', 'aggregate'],
            ['summarize', 'summarize'],
            ['summarise', 'summarize'],
            ['limit', 'limit'],
            ['dedupe', 'dedupe'],
            ['http', 'http_request'],
            ['api', 'http_request'],
            ['loop', 'loop'],
            ['foreach', 'loop'],
            ['stop', 'stop_error'],
            // The privacy nodes: "check" was in the old label, not the keywords.
            ['check', 'guard'],
            ['pii', 'guard'],
        ]) {
            const hit = find(oldWord).find(r => r.payload?.kind === kind);
            expect(hit, `searching "${oldWord}" must still reach the ${kind} node`).toBeTruthy();
        }
    });

    it('finds them by the new plain words too', () => {
        for (const [word, kind] of [
            ['collect', 'aggregate'],
            ['add up', 'summarize'],
            ['count', 'summarize'],
            ['shorten', 'limit'],
            ['duplicates', 'dedupe'],
            ['web service', 'http_request'],
            ['repeat', 'loop'],
            ['find personal', 'guard'],
        ]) {
            const hit = find(word).find(r => r.payload?.kind === kind);
            expect(hit, `searching "${word}" must reach the ${kind} node`).toBeTruthy();
        }
    });

    it('keeps every recorded usage key resolvable', () => {
        for (const key of [
            'step:limit', 'step:dedupe', 'step:aggregate', 'step:summarize',
            'step:loop', 'step:wait', 'step:stop_error', 'step:notification',
            'step:guard', 'step:tokenize', 'step:untokenize',
            'step:set', 'step:datetime', 'step:http_request',
            // The merged deciding steps and the retired Parse JSON node.
            'step:condition', 'step:switch', 'step:filter', 'step:parse_json',
        ]) {
            expect(itemForKey(key, { catalog }), `${key} no longer resolves`).toBeTruthy();
        }
    });

    it('gives the deciding node an icon that is not the Lists funnel', () => {
        // It was lucide's `Filter`, the visual language of the group this node
        // was renamed away from. Nothing in Lists may share it.
        const route = LOGIC_ITEMS.find(i => i.id === 'route');
        const listIcons = COLLECTION_ITEMS.map(i => i.icon);
        expect(route).toBeTruthy();
        expect(listIcons).not.toContain(route.icon);
    });

    it('names the node and the palette entry consistently', () => {
        // The palette label may differ from the node's own name (an invitation
        // vs a name), but where they are meant to be the same they must be.
        for (const it of [...COLLECTION_ITEMS, ...DATA_ITEMS]) {
            expect(it.payload.label, `${it.id} has no default node name`).toBeTruthy();
            expect(it.label, `${it.id} has no palette label`).toBeTruthy();
        }
    });
});

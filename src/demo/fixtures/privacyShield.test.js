/**
 * The Privacy Shield demo shows an administrator two things a marketing page
 * cannot: the rules an organisation can actually enforce, and a month of what
 * those rules caught. Both are only worth showing if the numbers survive
 * being read.
 *
 * What is pinned here is what a VISITOR CAN CHECK BY LOOKING. The "What
 * happened" tab puts a headline next to the rows it is made of — 586 events
 * over a timeline, 355 of them personal data across seven categories, a
 * sovereignty score beside the destinations it is computed from. Any of those
 * can disagree with the others without erroring, and a compliance-adjacent
 * demo whose arithmetic is wrong is worse than no demo.
 *
 * The other half is the CONTRACT with the editor: shapes come from the server
 * (`normaliseDoc` in useOrgShield, `getGuardrailOverview` in the store), and a
 * near-miss field name renders a silent zero rather than a failure.
 *
 * Run: cd agent-hub && npx vitest run src/demo/fixtures/privacyShield.test.js
 */
import { describe, it, expect } from 'vitest';
import { PII_CATEGORIES } from '../../config/piiCategories';
import { DEMO_CAPABILITIES } from './common';
import { ROUTES, createState, shieldDoc, _internals } from './privacyShield';

const VALID_CATEGORY_IDS = new Set(PII_CATEGORIES.map(c => c.id));
const ctx = (over = {}) => ({
    state: createState(), query: new URLSearchParams(), params: { orgId: 'org_demo_vandael' }, body: null, ...over,
});
const num = (v) => Number(v || 0);

describe('the shield document', () => {
    it('every watched category is a real category id', () => {
        // useOrgShield filters piiDetectionCategories against this list. An id
        // that is not in it does not error — it silently disappears, and the
        // Overview's "N of 21" quietly counts one fewer than the file says.
        for (const id of shieldDoc().piiDetectionCategories) {
            expect(VALID_CATEGORY_IDS.has(id), `unknown category "${id}"`).toBe(true);
        }
        expect(PII_CATEGORIES.length).toBe(21);
    });

    it('every category named in a tool policy is real too', () => {
        const doc = shieldDoc();
        const named = [
            ...doc.toolPiiPolicy.external.blockCategories,
            ...doc.toolPiiPolicy.internal.blockCategories,
            ...doc.webSearchGuardPiiCategories,
        ];
        expect(named.length).toBeGreaterThan(0);
        for (const id of named) expect(VALID_CATEGORY_IDS.has(id), `unknown category "${id}"`).toBe(true);
    });

    it('the shield is on, and looking for something', () => {
        const doc = shieldDoc();
        expect(doc.enabled).toBe(true);
        // derivePosture flags an enabled shield with zero categories as a
        // warning, because everything below it is then decoration. A demo
        // must not open on its own warning state.
        expect(doc.piiDetectionCategories.length).toBeGreaterThan(0);
    });

    it('grants the capabilities the document needs, or two controls render as locks', () => {
        const doc = shieldDoc();
        if (doc.piiDetectionAction === 'tokenize') expect(DEMO_CAPABILITIES).toContain('pii_tokenize');
        if (doc.webSearchGuardEnabled) expect(DEMO_CAPABILITIES).toContain('web_search_guard');
        expect(DEMO_CAPABILITIES).toContain('advanced_usage_monitoring');
    });

    it('the configuration and the evidence tell one story', () => {
        // The whole point of the activity tab in this demo: EU-only routing is
        // off, and the tab reports the consequence. If someone switches the
        // document to euModeEnabled the alert becomes a lie about the sample.
        expect(shieldDoc().euModeEnabled).toBe(false);
        expect(_internals.PII_NON_EU).toBeGreaterThan(0);
    });
});

describe('saving', () => {
    it('a save is readable back — the panel is not a prop', async () => {
        const c = ctx();
        await ROUTES['PUT /api/org-privacy-shield/:orgId']({ ...c, body: { ...c.state.shield, piiDetectionAction: 'block' } });
        expect(ROUTES['GET /api/org-privacy-shield/:orgId'](c).piiDetectionAction).toBe('block');
    });

    it('reports no clamps and no rejected terms', async () => {
        const c = ctx();
        const res = await ROUTES['PUT /api/org-privacy-shield/:orgId']({ ...c, body: c.state.shield });
        // Either being absent renders "Saved, with notes" over a clean save.
        expect(res.clamped_fields).toEqual([]);
        expect(res.termErrors).toEqual([]);
    });
});

describe('the rows the Overview only exists to summarise', () => {
    it('offers the two rows that depend on other endpoints', () => {
        // "Web search protection" appears only when /ai/config names a search
        // provider; "EU-hosted AI only" only when the EU model map is
        // non-empty. Both are on the screenshot this demo is standing in for,
        // and both vanish silently when these come back empty.
        expect(ROUTES['GET /ai/config']().searchProvider).toBeTruthy();
        expect(Object.keys(ROUTES['GET /ai/config/chat-models-eu']()).length).toBeGreaterThan(0);
    });

    it('answers the organisation list even though the picker is hidden', () => {
        const orgs = ROUTES['GET /auth/organizations']();
        expect(Array.isArray(orgs)).toBe(true);
        expect(orgs[0].id).toBe(shieldDoc().organization_id);
    });
});

describe('"What happened" — the numbers reconcile', () => {
    const guard = () => ROUTES['GET /api/usage/guardrails/overview'](ctx());
    const integ = () => ROUTES['GET /api/usage/integrations/overview'](ctx());

    it('the timeline sums to the headline', () => {
        const g = guard();
        expect(g.timeline.reduce((s, r) => s + num(r.total), 0)).toBe(num(g.summary.total_events));
        expect(g.timeline.reduce((s, r) => s + num(r.pii), 0)).toBe(num(g.summary.pii_count));
    });

    it('the breakdown cards sum to the headline', () => {
        const g = guard();
        expect(g.top_categories.reduce((s, r) => s + num(r.count), 0)).toBe(num(g.summary.pii_count));
        expect(g.by_surface.reduce((s, r) => s + num(r.count), 0)).toBe(num(g.summary.total_events));
        expect(g.by_action.reduce((s, r) => s + num(r.count), 0)).toBe(num(g.summary.total_events));
        expect(g.top_users.reduce((s, r) => s + num(r.total), 0)).toBe(num(g.summary.total_events));
    });

    it('carries by_surface, which the hook does not default', () => {
        // EMPTY_GUARD in useShieldActivity has no by_surface key, so the
        // "Where it happened" card is the one that disappears without a sound.
        expect(guard().by_surface.length).toBeGreaterThan(0);
    });

    it('the destinations sum to the call count, and some of them left Europe', () => {
        const i = integ();
        const dests = i.top.destinations;
        expect(dests.reduce((s, d) => s + num(d.total), 0)).toBe(num(i.summary.total_calls));
        const nonEu = dests.filter(d => !d.is_eu);
        expect(nonEu.length).toBeGreaterThan(0);
        expect(i.top.non_eu_destinations.map(d => d.dest_host).sort())
            .toEqual(nonEu.map(d => d.dest_host).sort());
    });

    it('the sovereignty score matches the split it is computed from', () => {
        const i = integ();
        const total = num(i.summary.total_calls);
        const nonEu = i.top.destinations.filter(d => !d.is_eu).reduce((s, d) => s + num(d.total), 0);
        // Calls that stayed score full marks; personal data leaving counts
        // double against the score. A score above the EU share would tell an
        // administrator the opposite of what the rows below it say.
        const expected = Math.max(0, Math.round(100 - ((nonEu + num(i.summary.pii_non_eu_count)) / total) * 100));
        expect(num(i.summary.sovereignty_score)).toBe(expected);
        expect(num(i.summary.sovereignty_score)).toBeLessThan(Math.round(((total - nonEu) / total) * 100) + 1);
    });

    it('personal data that left Europe cannot exceed the calls that left', () => {
        const i = integ();
        const nonEu = i.top.destinations.filter(d => !d.is_eu).reduce((s, d) => s + num(d.total), 0);
        expect(num(i.summary.pii_non_eu_count)).toBeLessThanOrEqual(nonEu);
    });

    it('one destination is the organisation\'s own server, at no egress', () => {
        // The row worth looking at: real traffic that never left the network.
        expect(integ().top.destinations.some(d => d.is_local && d.is_eu)).toBe(true);
    });
});

describe('"What happened" — the drill-downs are not empty', () => {
    it('every category card can be drilled into', () => {
        // The tab filters this axis CLIENT-side against `violation_categories`,
        // so a card with no matching row opens an empty table under a heading
        // that names the category — which reads as a product bug.
        const rows = ROUTES['GET /api/usage/guardrails/recent'](ctx());
        for (const c of ROUTES['GET /api/usage/guardrails/overview'](ctx()).top_categories.slice(0, 5)) {
            const hit = rows.some(r => String(r.violation_categories).toLowerCase().includes(c.category.toLowerCase()));
            expect(hit, `no sample event carries category "${c.category}"`).toBe(true);
        }
    });

    it('every destination card can be drilled into', () => {
        const rows = ROUTES['GET /api/usage/integrations/egress'](ctx());
        for (const d of ROUTES['GET /api/usage/integrations/overview'](ctx()).top.non_eu_destinations) {
            expect(rows.some(r => r.dest_host === d.dest_host), `no sample call to "${d.dest_host}"`).toBe(true);
        }
    });

    it('every person card can be drilled into', () => {
        for (const u of ROUTES['GET /api/usage/guardrails/overview'](ctx()).top_users.slice(0, 5)) {
            const rows = ROUTES['GET /api/usage/guardrails/recent']({
                ...ctx(), query: new URLSearchParams(`user=${u.user_id}`),
            });
            expect(rows.length, `no sample event for ${u.user_id}`).toBeGreaterThan(0);
            expect(rows.every(r => r.user_id === u.user_id)).toBe(true);
        }
    });

    it('the "outside Europe" drill returns only calls that left Europe', () => {
        // `query` is a URLSearchParams. Reading it as a plain object returns
        // undefined, the filter passes everything, and the fold renders EU
        // rows under the heading "Outside Europe".
        const rows = ROUTES['GET /api/usage/integrations/egress']({
            ...ctx(), query: new URLSearchParams('eu=false'),
        });
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every(r => r.is_eu === false)).toBe(true);
    });

    it('honours the row limit', () => {
        expect(ROUTES['GET /api/usage/guardrails/recent']({
            ...ctx(), query: new URLSearchParams('limit=3'),
        })).toHaveLength(3);
    });
});

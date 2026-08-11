import { describe, it, expect } from 'vitest';
import { createState, ROUTES } from './compliance';
import { CHECK_DEFS, ISO_CONTROLS } from './complianceCatalog';
import { DEMO_CAPABILITIES } from './common';

/**
 * What these pin is the class of bug that does not throw.
 *
 * Writing this fixture, three of the six check ids I referenced by hand were
 * wrong — `ISO27001-A.8.8-vulnerability-management` instead of
 * `ISO27001-A.8.8-vuln-mgmt`, and two more like it. Nothing failed. The
 * override simply did not match, the check fell through to "pass", and the
 * demo rendered a flawless 100/100 compliance score with no failing items —
 * the single least believable thing a compliance demo could show, and it
 * would have shipped looking deliberate.
 *
 * So: every id must resolve, and the arithmetic must agree with itself.
 */

const ctx = (over = {}) => ({ state: createState(), query: new URLSearchParams(), params: {}, body: {}, ...over });
const call = (route, over) => ROUTES[route](ctx(over));

const CHECK_IDS = new Set(CHECK_DEFS.map(d => d.check_id));

describe('compliance fixture — catalog agreement', () => {
    it('every check row is a real check definition', () => {
        for (const row of call('GET /api/compliance/checks')) {
            expect(CHECK_IDS.has(row.check_id), `${row.check_id} is not in the registry`).toBe(true);
            expect(row.titleKey, `${row.check_id} needs a titleKey`).toBeTruthy();
            expect(['pass', 'warn', 'fail', 'not_applicable']).toContain(row.status);
        }
    });

    it('the demo is not a clean sheet — it shows real failures', () => {
        // A 100/100 score is what a fixture with mistyped check ids produces,
        // and it is also the least persuasive thing this page could claim.
        const rows = call('GET /api/compliance/checks');
        expect(rows.filter(r => r.status === 'fail').length).toBeGreaterThan(0);
        expect(rows.filter(r => r.status === 'warn').length).toBeGreaterThan(0);
        const overall = call('GET /api/compliance/overview').overall;
        expect(overall.score).toBeGreaterThan(60);
        expect(overall.score).toBeLessThan(100);
    });

    it('every failing or warning check explains itself', () => {
        // A red row with an empty "details" column tells a visitor nothing,
        // and the real product always writes one.
        for (const r of call('GET /api/compliance/checks')) {
            if (r.status === 'fail' || r.status === 'warn') {
                expect(r.details, `${r.check_id} is ${r.status} with no details`).toBeTruthy();
            }
        }
    });

    it('the SoA covers the real Annex A catalog and cross-references real checks', () => {
        const soa = call('GET /api/compliance/iso/soa');
        expect(soa.controls.length).toBe(ISO_CONTROLS.length);
        for (const c of soa.controls) {
            for (const id of c.checks) {
                expect(CHECK_IDS.has(id), `${c.ref} points at unknown check ${id}`).toBe(true);
            }
        }
        // At least one control must actually be evidenced by a check, or the
        // SoA's "how is this verified" column is empty for all 93 rows.
        expect(soa.controls.filter(c => c.checks.length > 0).length).toBeGreaterThan(5);
    });
});

describe('compliance fixture — arithmetic that is visible on screen', () => {
    it('the headline score is the score of the checks below it', () => {
        const o = call('GET /api/compliance/overview');
        const rows = call('GET /api/compliance/checks');
        const W = { critical: 3, high: 2, medium: 1, low: 0.5 };
        let earned = 0, max = 0;
        for (const r of rows) {
            if (r.status === 'not_applicable') continue;
            const w = W[r.severity] || 1;
            max += w;
            if (r.status === 'pass') earned += w;
            else if (r.status === 'warn') earned += w * 0.5;
        }
        expect(o.overall.score).toBe(Math.round((earned / max) * 100));
        expect(o.overall.pass + o.overall.warn + o.overall.fail + o.overall.na).toBe(rows.length);
        expect(o.total_checks).toBe(rows.length);
    });

    it('the trend line ends where the headline score is', () => {
        // A chart whose last point disagrees with the number beside it is the
        // first thing anyone notices.
        const o = call('GET /api/compliance/overview');
        const history = call('GET /api/compliance/score-history');
        expect(history.length).toBeGreaterThan(5);
        expect(history[history.length - 1].overall_score).toBe(o.overall.score);
        const values = history.map(h => h.overall_score);
        expect(Math.max(...values)).toBeGreaterThan(Math.min(...values));
    });

    it('the SoA stats add up to the control count', () => {
        const { stats, controls } = call('GET /api/compliance/iso/soa');
        expect(stats.approved + stats.reviewed + stats.excluded + stats.todo).toBe(stats.total);
        expect(stats.total).toBe(controls.length);
        // A row with a decision must carry the entry the table reads; a row
        // without one must be null, not an empty object.
        for (const c of controls) {
            if (c.entry) expect(c.entry.status).toBeTruthy();
        }
    });

    it('every excluded control carries a justification', () => {
        // An exclusion without a reason is the one thing an ISO auditor will
        // always pick up, so the demo must not model it.
        for (const c of call('GET /api/compliance/iso/soa').controls) {
            if (c.entry?.status === 'excluded') {
                expect(c.entry.justification?.length, `${c.ref} excluded with no justification`).toBeGreaterThan(20);
            }
        }
    });

    it('readiness nests its counters under `controls`, where the page reads them', () => {
        // IsoOverviewPage does `readiness?.controls || {}`. A flat
        // `{ verified: 41 }` renders every tile as 0 without an error.
        const r = call('GET /api/compliance/iso/readiness');
        for (const k of ['verifiable_total', 'verified', 'failing', 'unchecked', 'catalog_total']) {
            expect(r.controls[k], `readiness.controls.${k}`).toBeTypeOf('number');
        }
        expect(r.controls.verified + r.controls.failing + r.controls.unchecked)
            .toBeLessThanOrEqual(r.controls.verifiable_total);
        expect(r.controls.catalog_total).toBe(ISO_CONTROLS.length);
        expect(r.soa.total).toBeGreaterThan(0);
        expect(r.history_points.length).toBeGreaterThan(0);
    });

    it('risk scores are likelihood × impact, and the stats match the rows', () => {
        const { risks, stats } = call('GET /api/compliance/iso/risks');
        for (const r of risks) expect(r.score).toBe(r.likelihood * r.impact);
        expect(stats.total).toBe(risks.length);
        expect(stats.open).toBe(risks.filter(r => r.status === 'open' || r.status === 'treating').length);
        expect(stats.high).toBe(risks.filter(r => r.score >= 9 && r.status !== 'closed').length);
    });
});

describe('compliance fixture — the states the pages need to render', () => {
    it('the org is onboarded, or the wizard covers the whole demo', () => {
        // ComplianceHub: `if (!o?.onboarded) setShowWizard(true)`. A visitor
        // would land on a four-step setup form instead of the hub.
        expect(call('GET /api/compliance/overview').onboarded).toBe(true);
    });

    it('the breach deadline is exactly detected_at + 72 hours', () => {
        // incidentStore's rule (Art. 33(1)). The countdown on screen is
        // computed from this, so a typed-in deadline shows a wrong clock.
        for (const i of call('GET /api/compliance/incidents')) {
            const delta = new Date(i.deadline_at).getTime() - new Date(i.detected_at).getTime();
            expect(delta, `${i.id}`).toBe(72 * 3_600_000);
        }
    });

    it('the register shows a breach inside its window and one already notified', () => {
        const list = call('GET /api/compliance/incidents');
        expect(list.some(i => i.status !== 'closed' && new Date(i.deadline_at).getTime() > Date.now())).toBe(true);
        expect(list.some(i => i.authority_notified_at && i.authority_reference)).toBe(true);
    });

    it('the DSR inbox covers every status the page renders a pill for', () => {
        const statuses = new Set(call('GET /api/dsr/requests').map(r => r.status));
        for (const s of ['pending', 'in_progress', 'fulfilled', 'rejected']) {
            expect(statuses.has(s), `no DSR with status ${s}`).toBe(true);
        }
        // A resolved request with no summary is a row that says nothing.
        for (const r of call('GET /api/dsr/requests')) {
            if (r.status === 'fulfilled' || r.status === 'rejected') {
                expect(r.result_summary, `${r.id} resolved with no summary`).toBeTruthy();
            }
        }
    });

    it('the ROPA names its processors and flags the transfers out of the EEA', () => {
        const ropa = call('GET /api/compliance/ropa');
        expect(ropa.controller.name).toBeTruthy();
        expect(ropa.processors.length).toBeGreaterThan(2);
        const nonEu = ropa.processors.filter(p => p.is_eu === false);
        expect(nonEu.length, 'a ROPA with no third-country transfer proves nothing').toBeGreaterThan(0);
        for (const p of ropa.processors) {
            expect(typeof p.is_eu, `${p.operator}.is_eu must be a strict boolean`).toBe('boolean');
        }
        // Each activity lists those same transfers, or the column is blank.
        for (const a of ropa.activities) {
            expect(a.transfers.length).toBe(nonEu.length);
        }
    });

    it('personnel cannot have acknowledged more policies than exist', () => {
        for (const p of call('GET /api/compliance/iso/training').personnel) {
            expect(p.policy_acks).toBeLessThanOrEqual(p.policy_total);
            expect(p.displayName).toBeTruthy();
        }
    });

    it('the licence capability the hub is gated on is granted', () => {
        expect(DEMO_CAPABILITIES).toContain('compliance_hub_gdpr');
    });
});

describe('compliance fixture — writes stay in the tab', () => {
    it('marking the ROPA reviewed updates the settings the page reads back', () => {
        const c = ctx();
        const before = ROUTES['GET /api/compliance/ropa'](c).last_reviewed_at;
        const res = ROUTES['POST /api/compliance/ropa/review'](c);
        expect(res.reviewed_at).toBeTruthy();
        expect(c.state.settings.ropa_reviewed_at).not.toBe(before);
    });

    it('recording an incident starts a real 72-hour clock', () => {
        const c = ctx({ body: { title: 'Test', severity: 'low' } });
        const created = ROUTES['POST /api/compliance/incidents'](c);
        const delta = new Date(created.deadline_at).getTime() - new Date(created.detected_at).getTime();
        expect(delta).toBe(72 * 3_600_000);
        expect(ROUTES['GET /api/compliance/incidents'](c)[0].id).toBe(created.id);
    });

    it('notifying recipients says nothing was actually sent', () => {
        // The demo has no network. A silent success would tell a visitor an
        // email went out to a breach-notification list.
        const c = ctx({ params: { id: 'inc_31' } });
        expect(ROUTES['POST /api/compliance/incidents/:id/notify-recipients'](c).demo_not_sent).toBe(true);
    });
});

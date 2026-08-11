import { describe, it, expect } from 'vitest';
import { createState, ROUTES } from './monitoring';
import { DEMO_CAPABILITIES } from './common';

/**
 * The first version of this fixture returned `tokens` and `cost` while the
 * component reads `total_tokens`, `prompt_tokens`, `completion_tokens`,
 * `estimated_cost` and `billed_cost`. Every token and cost column rendered 0
 * next to correct call counts, and both trend charts drew flat lines.
 *
 * Nothing caught it. The DemoHost test asserts a model NAME appears on screen,
 * which it did — sitting next to a zero. `Number(undefined) || 0` is a silent
 * zero, so a wrong field name is invisible until someone reads the screenshot.
 *
 * These tests assert the two things that were actually broken: the field names
 * the component reads, and that the figures reconcile.
 */

const ctx = () => ({ state: createState(), query: new URLSearchParams() });
const call = (route) => ROUTES[route](ctx());

describe('monitoring fixture shape', () => {
    it('summary uses the field names the component reads', () => {
        const s = call('GET /api/usage/summary');
        for (const key of [
            'total_calls', 'total_tokens', 'total_estimated_cost',
            'billed_cost', 'total_input_cost', 'total_output_cost', 'unique_users',
        ]) {
            expect(s[key], `summary.${key}`).toBeTypeOf('number');
        }
        expect(s.total_tokens).toBeGreaterThan(0);
        expect(s.total_estimated_cost).toBeGreaterThan(0);
    });

    it.each([
        ['GET /api/usage/models', 'model'],
        ['GET /api/usage/users', 'user_id'],
        ['GET /api/usage/agents', 'agent_id'],
        ['GET /api/usage/sources', 'source'],
    ])('%s rows carry non-zero total_tokens', (route) => {
        const rows = call(route);
        expect(Array.isArray(rows)).toBe(true);
        expect(rows.length).toBeGreaterThan(0);
        for (const r of rows) {
            expect(r.total_tokens, JSON.stringify(r)).toBeGreaterThan(0);
            expect(r.billed_cost).toBeTypeOf('number');
            expect(r.estimated_cost).toBeTypeOf('number');
        }
    });

    it('timeline drives the trend charts, which read total_tokens/billed_cost', () => {
        const tl = call('GET /api/usage/timeline');
        expect(tl.length).toBe(7);
        // A flat line is what a broken fixture looks like, so assert variation.
        const values = tl.map(t => t.total_tokens);
        expect(Math.max(...values)).toBeGreaterThan(Math.min(...values));
        for (const t of tl) {
            expect(t.total_tokens).toBeGreaterThan(0);
            expect(t.billed_cost).toBeTypeOf('number');
        }
    });

    it('the numbers reconcile — per-model and timeline both sum to the summary', () => {
        const s = call('GET /api/usage/summary');
        const models = call('GET /api/usage/models');
        const tl = call('GET /api/usage/timeline');

        expect(models.reduce((a, m) => a + m.calls, 0)).toBe(s.total_calls);
        expect(models.reduce((a, m) => a + m.total_tokens, 0)).toBe(s.total_tokens);
        expect(tl.reduce((a, t) => a + t.total_tokens, 0)).toBe(s.total_tokens);
        expect(tl.reduce((a, t) => a + t.calls, 0)).toBe(s.total_calls);

        const tlCost = tl.reduce((a, t) => a + Math.round(t.billed_cost * 100), 0);
        expect(tlCost).toBe(Math.round(s.total_estimated_cost * 100));
    });

    /**
     * The Safety & Guardrails and Integrations tabs are gated on
     * `hasLicenseFeature('advanced_usage_monitoring')` in UsageSection. Without
     * the capability the tab bar renders Overview alone — the fixtures for
     * those tabs still load and are simply never shown, which is
     * indistinguishable from the fixtures being absent.
     */
    it('the licence capability that reveals the other tabs is granted', () => {
        expect(DEMO_CAPABILITIES).toContain('advanced_usage_monitoring');
    });

    it('the guardrail fixtures never carry the matched text', () => {
        // The real audit log records the category, direction and action and
        // never the offending string, because a log holding the sensitive text
        // is a second copy of the leak. The demo must not imply otherwise.
        const events = ROUTES['GET /api/usage/guardrails/recent'](ctx());
        expect(events.length).toBeGreaterThan(0);
        for (const ev of events) {
            expect(ev.violation_categories).toBeTruthy();
            expect(ev.action_taken).toBeTruthy();
            for (const banned of ['matched_text', 'matched_content', 'content', 'text', 'snippet']) {
                expect(ev[banned], `guardrail event must not carry ${banned}`).toBeUndefined();
            }
        }
    });

    it('egress rows use strict booleans for is_eu / is_local', () => {
        // IntegrationsTab counts EU with `r.is_eu === true`. A numeric 1 puts
        // every row in the non-EU bucket, which collapsed the sovereignty
        // score to 22/100 "RISKY" on traffic that was almost entirely EU.
        const rows = ROUTES['GET /api/usage/integrations/egress'](ctx());
        for (const r of rows) {
            expect(typeof r.is_eu, `is_eu on ${r.tool_name}`).toBe('boolean');
            expect(typeof r.is_local, `is_local on ${r.tool_name}`).toBe('boolean');
        }
    });

    it('the egress fixture includes non-EEA traffic, or it proves nothing', () => {
        const rows = ROUTES['GET /api/usage/integrations/egress'](ctx());
        expect(rows.some(r => r.is_eu === false)).toBe(true);
        expect(rows.some(r => r.is_local === true)).toBe(true);
        // At least one non-EU row must carry PII, or the "PII leaks abroad"
        // callout never appears and the tab's sharpest feature is invisible.
        expect(rows.some(r => !r.is_eu && !r.is_local && (r.pii_categories_detected || '').trim())).toBe(true);
    });

    it('sovereignty rows use the *_count names the row component reads', () => {
        for (const axis of ['user', 'integration', 'agent', 'pii']) {
            const rows = ROUTES['GET /api/usage/integrations/sovereignty']({
                ...ctx(), query: new URLSearchParams(`dimension=${axis}`),
            });
            expect(rows.length, axis).toBeGreaterThan(0);
            for (const r of rows) {
                // `eu` / `local` / `non` scored every row 0 — the component
                // reads eu_count / local_count / non_eu_count.
                expect(r.total, `${axis}.total`).toBeGreaterThan(0);
                expect(r.eu_count, `${axis}.eu_count`).toBeTypeOf('number');
                expect(r.local_count, `${axis}.local_count`).toBeTypeOf('number');
                expect(r.non_eu_count, `${axis}.non_eu_count`).toBeTypeOf('number');
                // Disjoint buckets — see the score test below.
                expect(r.eu_count + r.local_count + r.non_eu_count).toBe(r.total);
            }
        }
    });

    it('the sovereignty timeline has its own shape, not the usage timeline', () => {
        const tl = ROUTES['GET /api/usage/integrations/timeline'](ctx());
        expect(tl.length).toBeGreaterThan(0);
        for (const t of tl) {
            expect(t.eu_count).toBeTypeOf('number');
            expect(t.local_count).toBeTypeOf('number');
            expect(t.non_eu_count).toBeTypeOf('number');
            expect(t.pii_non_eu_count).toBeTypeOf('number');
        }
    });

    it('no sovereignty row can score above 100', () => {
        // eu/local/non-EU are disjoint: the tab computes
        // `nonEu = total - eu - local` and scores `(eu + local) / total`.
        // Counting local traffic inside eu_count produced 148/100 on screen.
        const check = (rows, where) => {
            for (const r of rows) {
                expect(r.eu_count + r.local_count + r.non_eu_count, `${where}: ${r.key} buckets must sum to total`)
                    .toBe(r.total);
                const score = Math.round(((r.eu_count + r.local_count) / (r.total + r.pii_non_eu_count)) * 100);
                expect(score, `${where}: ${r.key} scored ${score}`).toBeLessThanOrEqual(100);
            }
        };
        for (const axis of ['user', 'integration', 'agent', 'pii']) {
            check(ROUTES['GET /api/usage/integrations/sovereignty']({
                ...ctx(), query: new URLSearchParams(`dimension=${axis}`),
            }), axis);
        }
        check(ROUTES['GET /api/usage/integrations/by-type'](ctx()), 'by-type');
    });

    it('integration rows are labelled — the table reads integration_type', () => {
        // `key` and `label` are not read. Six rows all said "Unknown".
        for (const r of ROUTES['GET /api/usage/integrations/by-type'](ctx())) {
            expect(r.integration_type, `${r.key} needs integration_type`).toBeTruthy();
            expect(r.last_used, `${r.key} needs last_used`).toBeTruthy();
        }
    });

    it('PII chips carry a category name, not just a count', () => {
        const rows = ROUTES['GET /api/usage/integrations/pii-summary'](ctx());
        expect(rows.length).toBeGreaterThan(0);
        for (const p of rows) {
            expect(p.pii_category, 'chips render p.pii_category').toBeTruthy();
            expect(p.count).toBeGreaterThan(0);
        }
    });

    it('keeps a local model at zero provider cost — the page makes that claim', () => {
        const local = call('GET /api/usage/models').find(m => m.model.includes('local'));
        expect(local, 'a local model row must exist').toBeTruthy();
        expect(local.total_tokens).toBeGreaterThan(0);
        expect(local.estimated_cost).toBe(0);
        expect(local.billed_cost).toBe(0);
    });
});

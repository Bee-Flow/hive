/**
 * BFSF-241 — hasPaidBillingRelationship predicate matrix.
 *
 * The client predicate and the server gate (PORTAL_ELIGIBLE_PAYMENT_STATUSES
 * in server/routes/stripe.js) must agree — drift means "button visible but
 * 403". This test pins the client half; the server half is pinned by
 * routes/stripe.portal.test.js.
 *
 * Run: cd agent-hub && npx vitest run src/utils/billing.test.js
 */
import { describe, it, expect } from 'vitest';
import { hasPaidBillingRelationship, PORTAL_ELIGIBLE_PAYMENT_STATUSES } from './billing';

const sub = (payment_status, customer = 'cus_1') => ({ stripe_customer_id: customer, payment_status });

describe('hasPaidBillingRelationship', () => {
    it.each([
        ['paid', true],
        ['past_due', true],
        ['paused', true],
        ['disputed', true],
        // 'failed' is set by invoice.payment_failed for genuinely-paying
        // dunning customers (ordering vs past_due is nondeterministic) —
        // they must keep portal access to fix their payment method.
        ['failed', true],
        // 'refunded' can sit on a still-ACTIVE subscription after a partial/
        // goodwill refund — those are paying customers.
        ['refunded', true],
        ['trialing', false],
        ['cancelled', false],
        [undefined, false],
        [null, false],
    ])('payment_status=%s → %s', (status, expected) => {
        expect(hasPaidBillingRelationship(sub(status))).toBe(expected);
    });

    it('no Stripe customer id → never eligible, regardless of status', () => {
        expect(hasPaidBillingRelationship(sub('paid', null))).toBe(false);
        expect(hasPaidBillingRelationship(null)).toBe(false);
        expect(hasPaidBillingRelationship(undefined)).toBe(false);
    });

    it('the exported status list matches the predicate', () => {
        for (const status of PORTAL_ELIGIBLE_PAYMENT_STATUSES) {
            expect(hasPaidBillingRelationship(sub(status))).toBe(true);
        }
    });
});

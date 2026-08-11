/**
 * Billing eligibility helpers (BFSF-241).
 *
 * Single home for the "may this customer open the Stripe Customer Portal?"
 * predicate — previously the same array literal was inlined in
 * ConsumerLicenseSection and OrgInfoPanel, and the SERVER had no gate at all
 * (a direct POST /api/stripe/portal opened an empty, payment-method-mismatched
 * portal for trial/free users). Keep this list in sync with
 * PORTAL_ELIGIBLE_PAYMENT_STATUSES in server/routes/stripe.js — a drift means
 * "button visible but 403", the exact bugginess this fix removes.
 *
 * 'failed' is deliberately included: invoice.payment_failed sets
 * payment_status='failed' for genuinely-paying dunning customers (webhook
 * ordering vs 'past_due' is nondeterministic) — they need the portal to fix
 * their payment method. 'refunded' likewise: a partial/goodwill refund on a
 * still-active subscription must not lock a paying customer out of billing.
 */

export const PORTAL_ELIGIBLE_PAYMENT_STATUSES = ['paid', 'past_due', 'paused', 'disputed', 'failed', 'refunded'];

/**
 * True when the subscription represents a real (paid-ish) billing
 * relationship: a Stripe customer exists AND the payment status indicates
 * money has moved or is actively being collected.
 */
export function hasPaidBillingRelationship(sub) {
    if (!sub?.stripe_customer_id) return false;
    return PORTAL_ELIGIBLE_PAYMENT_STATUSES.includes(sub.payment_status);
}

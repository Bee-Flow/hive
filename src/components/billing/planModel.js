/**
 * One shape and one formatter for subscription plans.
 *
 * Plans arrive from three endpoints with three different casings —
 * `/api/billing/public-plans` (camelCase), `/api/stripe/plans` and the admin
 * `/api/subscriptions/plans` (snake_case DB rows) — and each consumer grew its
 * own price formatter and currency-symbol map. Those copies disagreed: one
 * rendered "€ 29,-", another "€29/mo", a third "29 EUR per month", and only one
 * of them handled per-seat plans.
 *
 * normalizePlan() is the seam. Everything downstream (PlanCard, PlanGrid, the
 * signup wizard's plan step, the billing page) reads the normalized shape.
 */

const CURRENCY_SYMBOLS = { eur: '€', usd: '$', gbp: '£' };

/** @returns {string} the symbol for a currency code, or the upper-cased code. */
export function currencySymbol(currency) {
    const c = String(currency || 'eur').toLowerCase();
    return CURRENCY_SYMBOLS[c] || c.toUpperCase();
}

/**
 * Fold any of the three plan wire-shapes into one.
 *
 * @returns {{
 *   id: string, name: string, description: string,
 *   price: number, currency: string, interval: 'month'|'year',
 *   planType: 'organization'|'consumer',
 *   tier: string|null, perSeat: boolean, billingModel: string,
 *   trialDays: number, isDefault: boolean, isPublic: boolean,
 *   features: string[], stripePriceId: string|null, isFree: boolean,
 *   raw: object,
 * }}
 */
export function normalizePlan(raw) {
    if (!raw) return null;
    const price = Number(raw.price ?? raw.amount ?? 0) || 0;
    const features = Array.isArray(raw.features)
        ? raw.features
        : (typeof raw.features === 'string' ? safeParseArray(raw.features) : []);

    return {
        id: raw.id ?? raw.plan_id ?? raw.planId,
        name: raw.name ?? raw.plan_name ?? raw.planName ?? '',
        description: raw.description ?? '',
        price,
        currency: String(raw.currency ?? 'eur').toLowerCase(),
        interval: normalizeInterval(raw.interval ?? raw.billing_interval ?? raw.billingInterval),
        planType: (raw.planType ?? raw.plan_type) === 'consumer' ? 'consumer' : 'organization',
        tier: raw.tier ?? raw.plan_tier ?? null,
        perSeat: !!(raw.perSeat ?? raw.per_seat),
        billingModel: raw.billingModel ?? raw.billing_model ?? 'fixed',
        trialDays: Number(raw.trialDays ?? raw.trial_days ?? 0) || 0,
        isDefault: !!(raw.isDefault ?? raw.is_default),
        isPublic: (raw.isPublic ?? raw.is_public) !== false,
        features,
        stripePriceId: raw.stripePriceId ?? raw.stripe_price_id ?? null,
        isFree: price <= 0,
        raw,
    };
}

function safeParseArray(s) {
    try {
        const v = JSON.parse(s);
        return Array.isArray(v) ? v : [];
    } catch { return []; }
}

function normalizeInterval(v) {
    const s = String(v || 'month').toLowerCase();
    return (s === 'year' || s === 'yearly' || s === 'annual') ? 'year' : 'month';
}

/**
 * Render a plan's price. Returns the parts rather than a single string so a card
 * can size the amount differently from the period — callers that just want text
 * can join them.
 *
 * @param {object} plan  a normalized plan
 * @param {(key: string, fallback: string) => string} t
 */
export function formatPrice(plan, t) {
    if (!plan) return { amount: '', period: '', free: false };
    if (plan.isFree) {
        return { amount: t('billing.free', 'Free'), period: '', free: true };
    }

    const sym = currencySymbol(plan.currency);
    // Whole amounts read better without trailing zeroes; 9.99 must keep them.
    const n = Number.isInteger(plan.price) ? String(plan.price) : plan.price.toFixed(2);
    const per = plan.interval === 'year'
        ? t('billing.per_year', '/year')
        : t('billing.per_month', '/month');
    const seat = plan.perSeat ? ` ${t('billing.per_seat', 'per seat')}` : '';

    return {
        amount: `${sym}${n}`,
        period: `${per}${seat}`,
        free: false,
        metered: plan.billingModel === 'metered',
    };
}

/** Single-string form, for aria-labels and compact contexts. */
export function formatPriceText(plan, t) {
    const p = formatPrice(plan, t);
    return p.free ? p.amount : `${p.amount}${p.period}`;
}

/**
 * Split a plan list into the two audiences. Used by the billing page and the
 * signup wizard's plan step, which each only ever show one group.
 */
export function groupPlans(plans) {
    const list = (plans || []).map(normalizePlan).filter(Boolean);
    return {
        organization: list.filter(p => p.planType === 'organization'),
        consumer: list.filter(p => p.planType === 'consumer'),
    };
}

/** Plans a given account type can actually buy, cheapest first. */
export function plansFor(plans, accountType) {
    const groups = groupPlans(plans);
    const list = accountType === 'consumer' ? groups.consumer : groups.organization;
    return list.filter(p => p.isPublic).sort((a, b) => a.price - b.price);
}

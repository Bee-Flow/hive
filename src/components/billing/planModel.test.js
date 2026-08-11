/**
 * Plans arrive from three endpoints in three casings, and four components each
 * grew their own price formatter that disagreed about currency symbols, per-seat
 * plans and trailing decimals. normalizePlan is the single seam.
 */
import { describe, it, expect } from 'vitest';
import {
    normalizePlan, formatPrice, formatPriceText, groupPlans, plansFor, currencySymbol,
} from './planModel';

const t = (_key, fallback) => fallback;

describe('normalizePlan', () => {
    it('reads the camelCase shape from /api/billing/public-plans', () => {
        expect(normalizePlan({ id: 'p1', name: 'Pro', price: 29, planType: 'consumer', perSeat: false }))
            .toMatchObject({ id: 'p1', name: 'Pro', price: 29, planType: 'consumer', perSeat: false });
    });

    it('reads the snake_case DB row shape', () => {
        expect(normalizePlan({ id: 'p1', name: 'Team', price: 15, plan_type: 'organization', per_seat: true, trial_days: 14 }))
            .toMatchObject({ planType: 'organization', perSeat: true, trialDays: 14 });
    });

    it('reads a joined row that exposes plan_name / plan_tier', () => {
        expect(normalizePlan({ plan_id: 'p1', plan_name: 'Biz', plan_tier: 'enterprise' }))
            .toMatchObject({ id: 'p1', name: 'Biz', tier: 'enterprise' });
    });

    it('defaults an unknown plan_type to organization', () => {
        expect(normalizePlan({ id: 'p' }).planType).toBe('organization');
    });

    it('normalises interval aliases', () => {
        for (const v of ['year', 'yearly', 'annual']) {
            expect(normalizePlan({ id: 'p', interval: v }).interval).toBe('year');
        }
        expect(normalizePlan({ id: 'p' }).interval).toBe('month');
    });

    it('parses a JSON-encoded features string without throwing on junk', () => {
        expect(normalizePlan({ id: 'p', features: '["a","b"]' }).features).toEqual(['a', 'b']);
        expect(normalizePlan({ id: 'p', features: 'not json' }).features).toEqual([]);
    });

    it('marks a zero or missing price as free', () => {
        expect(normalizePlan({ id: 'p' }).isFree).toBe(true);
        expect(normalizePlan({ id: 'p', price: 0 }).isFree).toBe(true);
        expect(normalizePlan({ id: 'p', price: 1 }).isFree).toBe(false);
    });

    it('is null-safe', () => {
        expect(normalizePlan(null)).toBeNull();
    });
});

describe('formatPrice', () => {
    const p = (over) => normalizePlan({ id: 'p', price: 29, currency: 'eur', ...over });

    it('renders a free plan as a word, not "€0"', () => {
        expect(formatPrice(p({ price: 0 }), t)).toMatchObject({ amount: 'Free', free: true });
    });

    it('drops trailing zeroes on whole amounts but keeps real cents', () => {
        expect(formatPrice(p({ price: 29 }), t).amount).toBe('€29');
        expect(formatPrice(p({ price: 9.99 }), t).amount).toBe('€9.99');
    });

    it('uses the right currency symbol and falls back to the code', () => {
        expect(formatPrice(p({ currency: 'usd' }), t).amount).toBe('$29');
        expect(formatPrice(p({ currency: 'gbp' }), t).amount).toBe('£29');
        expect(formatPrice(p({ currency: 'sek' }), t).amount).toBe('SEK29');
    });

    it('appends the period and the per-seat qualifier', () => {
        expect(formatPrice(p({ interval: 'year' }), t).period).toBe('/year');
        expect(formatPrice(p({ perSeat: true }), t).period).toBe('/month per seat');
    });

    it('flags metered billing so the card can explain it', () => {
        expect(formatPrice(p({ billing_model: 'metered' }), t).metered).toBe(true);
    });

    it('formatPriceText joins the parts', () => {
        expect(formatPriceText(p(), t)).toBe('€29/month');
        expect(formatPriceText(p({ price: 0 }), t)).toBe('Free');
    });
});

describe('groupPlans / plansFor', () => {
    const plans = [
        { id: 'free', name: 'Free', price: 0, plan_type: 'consumer' },
        { id: 'c2', name: 'Personal Pro', price: 9, plan_type: 'consumer' },
        { id: 'o1', name: 'Team', price: 29, plan_type: 'organization' },
        { id: 'hidden', name: 'Legacy', price: 5, plan_type: 'organization', is_public: false },
    ];

    it('splits by audience', () => {
        const g = groupPlans(plans);
        expect(g.consumer.map(p => p.id)).toEqual(['free', 'c2']);
        expect(g.organization.map(p => p.id)).toEqual(['o1', 'hidden']);
    });

    it('plansFor hides non-public plans and sorts cheapest first', () => {
        expect(plansFor(plans, 'consumer').map(p => p.id)).toEqual(['free', 'c2']);
        expect(plansFor(plans, 'organization').map(p => p.id)).toEqual(['o1']);
    });

    it('handles an empty or missing list', () => {
        expect(plansFor([], 'consumer')).toEqual([]);
        expect(plansFor(undefined, 'organization')).toEqual([]);
    });
});

describe('currencySymbol', () => {
    it('maps the supported currencies and upper-cases the rest', () => {
        expect(currencySymbol('eur')).toBe('€');
        expect(currencySymbol('USD')).toBe('$');
        expect(currencySymbol('nok')).toBe('NOK');
        expect(currencySymbol(undefined)).toBe('€');
    });
});

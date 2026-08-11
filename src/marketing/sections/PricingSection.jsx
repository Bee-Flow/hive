import React, { useEffect, useState, useMemo } from 'react';
import SectionFrame from '../components/SectionFrame';
import { sectionBgClass } from './sectionBg';
import { inlineTextStyle } from './textStyle';
import { featureLabel } from '../../shared/featureCatalog';

/**
 * Pricing block — dynamic. Fetches published subscription plans from
 * `GET /api/billing/public-plans` and renders one card per plan,
 * filtered by:
 *   - `data.planType`        — 'organization' or 'consumer' (audience)
 *   - active billing interval — 'monthly' or 'yearly'
 *
 * The monthly/yearly switch is a visitor-facing segmented control above
 * the cards. Admins control its initial side and label text from the
 * editor. Admins manage the plans themselves in /app/admin/subscriptions;
 * any plan with `is_public = true` shows up here automatically.
 *
 * Data shape — see the `pricing` entry in
 * server/i18n/defaults/cmsDefaults.js. The renderer is self-contained
 * (no marketing.css additions), only reuses the shared `container`
 * layout class.
 */

// inlineTextStyle resolves font-family / size / color / text-align. Font
// weight isn't part of that shared helper, so it's merged on here from
// the same {field}Style blob the editor writes.
function fieldTextStyle(style, align) {
    const out = { ...(inlineTextStyle(style, align) || {}) };
    if (style && Number.isFinite(style.fontWeight) && style.fontWeight > 0) {
        out.fontWeight = style.fontWeight;
    }
    return out;
}

// Intl-based currency formatter, falls back to a plain "€X" rendering
// when the currency code is unknown to the runtime (rare). Whole-euro
// amounts render without trailing ",00" so cards stay scannable.
function formatPrice(amount, currency) {
    if (amount === null || amount === undefined || amount === '') return '';
    const num = Number(amount);
    if (!Number.isFinite(num)) return '';
    const code = (currency || 'EUR').toUpperCase();
    const hasFraction = Math.round(num * 100) % 100 !== 0;
    try {
        return new Intl.NumberFormat('nl-NL', {
            style: 'currency',
            currency: code,
            minimumFractionDigits: hasFraction ? 2 : 0,
            maximumFractionDigits: 2,
        }).format(num);
    } catch (_) {
        const symbol = code === 'EUR' ? '€' : code === 'USD' ? '$' : `${code} `;
        return `${symbol}${hasFraction ? num.toFixed(2) : num}`;
    }
}

// Suffix shown after the formatted price. Editor-configurable via
// `suffixMonthly` / `suffixYearly`; the old Dutch literals stay as the
// absent-field fallback so existing sites render byte-identically.
function intervalSuffix(interval, data) {
    if (interval === 'yearly')  return data?.suffixYearly  || '/jaar';
    if (interval === 'monthly') return data?.suffixMonthly || '/maand';
    return '';
}

// Pill-style segmented control above the cards — token-driven classes
// in marketing.css (.pricing-toggle).
function MonthlyYearlyToggle({ monthlyLabel, yearlyLabel, value, onChange }) {
    const isYearly = value === 'yearly';
    return (
        <div className="pricing-toggle-row">
            <div role="group" aria-label="Billing period" className="pricing-toggle">
                <button type="button" aria-pressed={!isYearly} onClick={() => onChange('monthly')}>
                    {monthlyLabel}
                </button>
                <button type="button" aria-pressed={isYearly} onClick={() => onChange('yearly')}>
                    {yearlyLabel}
                </button>
            </div>
        </div>
    );
}

// Card for a single plan. All visible text comes from the plan record
// returned by the public-plans endpoint — admins edit it via the
// /app/admin/subscriptions page, never inside the CMS. `featured` +
// `featuredStyle` drive the emphasis treatment; `ctaFilled` is true for
// the featured tier, or for every card while no featured tier is chosen
// (the legacy look).
function PlanCard({ plan, data, ctaLabel, featured, ctaFilled }) {
    const price = formatPrice(plan.price, plan.currency);
    const suffix = price ? intervalSuffix(plan.billingInterval, data) : '';
    const tagline = plan.tagline || plan.description || '';
    const features = Array.isArray(plan.allowedFeatures) ? plan.allowedFeatures : [];
    const hasTrial = Number(plan.trialDays) > 0;
    const ctaHref = `/app/billing?plan=${encodeURIComponent(plan.id)}`;
    const customPriceText = data?.customPriceText || 'Op aanvraag';
    const trialTemplate = data?.trialText || '{days} dagen gratis proberen';
    const featuredStyle = data?.featuredStyle === 'flip' ? 'flip' : 'border';

    const cardClass = [
        'pricing-card',
        featured ? 'pricing-card--featured' : '',
        featured && featuredStyle === 'flip' ? 'pricing-card--flip' : '',
    ].filter(Boolean).join(' ');

    return (
        <div className={cardClass}>
            <h3 className="pricing-name">{plan.name}</h3>

            {price ? (
                <div className="pricing-price-row">
                    <span className="pricing-price">{price}</span>
                    {suffix ? <span className="pricing-suffix">{suffix}</span> : null}
                </div>
            ) : (
                <div className="pricing-custom">{customPriceText}</div>
            )}

            {tagline ? <p className="pricing-tagline">{tagline}</p> : null}

            {hasTrial ? (
                <div className="pricing-trial">
                    {trialTemplate.replace('{days}', String(plan.trialDays))}
                </div>
            ) : null}

            {features.length ? (
                <ul className="pricing-features">
                    {features.map((f, i) => (
                        <li key={i} className="pricing-feature">
                            <span aria-hidden="true" className="check">✓</span>
                            <span>{featureLabel(f)}</span>
                        </li>
                    ))}
                </ul>
            ) : null}

            <a href={ctaHref} className={`pricing-cta${ctaFilled ? ' pricing-cta--filled' : ''}`}>
                {ctaLabel}
            </a>
        </div>
    );
}

// Skeleton placeholder shown during the initial fetch. Three columns so
// the page doesn't reflow noticeably once real plans land.
function SkeletonCards() {
    return (
        <>
            {[0, 1, 2].map(i => (
                <div key={i} className="pricing-col">
                    <div className="pricing-skeleton" aria-hidden="true" />
                </div>
            ))}
        </>
    );
}

export default function Pricing({ data }) {
    // The block is mounted by ProductWebsite's SECTION_REGISTRY only when
    // its type matches, so we always want to render *something*. The
    // `enabled` check is the visibility toggle the editor exposes — applied
    // as an early return below the hooks so hook order stays stable across
    // renders (eslint react-hooks/rules-of-hooks).
    const isDisabled = data && data.enabled === false;

    const planType        = data?.planType === 'consumer' ? 'consumer' : 'organization';
    const defaultInterval = data?.defaultInterval === 'yearly' ? 'yearly' : 'monthly';
    const enableToggle    = data?.enableToggle !== false;
    const heading         = typeof data?.heading === 'string' ? data.heading : '';
    const subheading      = typeof data?.subheading === 'string' ? data.subheading : '';
    const ctaLabel        = data?.ctaLabel || 'Kies plan';
    const emptyText       = data?.emptyText || 'Geen plannen beschikbaar';
    const toggleMonthly   = data?.toggleLabelMonthly || 'Maandelijks';
    const toggleYearly    = data?.toggleLabelYearly || 'Jaarlijks';
    const featuredPlanId  = typeof data?.featuredPlanId === 'string' ? data.featuredPlanId.trim() : '';

    // Avoid shadowing window.setInterval — the visitor-facing toggle is
    // billing-interval, not a timer.
    const [activeInterval, setActiveInterval] = useState(defaultInterval);
    // Honour an editor change to the default — but only while the visitor
    // hasn't flipped it themselves; once they interact, their choice
    // sticks. Tracking "user-touched" is overkill for a marketing block,
    // so we just reset on data change like the legacy block did.
    useEffect(() => { setActiveInterval(defaultInterval); }, [defaultInterval]);

    const [state, setState] = useState({ loading: true, error: null, plans: [] });

    useEffect(() => {
        let cancelled = false;
        setState(s => ({ ...s, loading: true, error: null }));
        fetch('/api/billing/public-plans', { credentials: 'omit' })
            .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
            .then(payload => {
                if (cancelled) return;
                const plans = Array.isArray(payload?.plans) ? payload.plans : [];
                setState({ loading: false, error: null, plans });
            })
            .catch(err => {
                if (cancelled) return;
                // Silent on the page (no broken error UI) — log so it
                // surfaces during preview/development. `warn`, not `error`:
                // this is a degraded state the page handles (the section
                // hides), and a console.error here is what Lighthouse's
                // best-practices audit flags as "browser errors were logged".
                console.warn('[pricing] public-plans fetch failed:', err.message);
                setState({ loading: false, error: err.message || 'fetch failed', plans: [] });
            });
        return () => { cancelled = true; };
    }, []);

    // Every plan for this audience, regardless of interval — the basis for
    // deciding whether the monthly/yearly switch has anything to switch.
    const audiencePlans = useMemo(
        () => state.plans.filter(p => p?.planType === planType),
        [state.plans, planType],
    );

    // Which billing intervals those plans actually cover. Interval-less
    // plans (Free / Custom) surface on the monthly side, mirroring the
    // visibility filter below.
    const availableIntervals = useMemo(() => {
        const set = new Set();
        for (const p of audiencePlans) {
            set.add(p?.billingInterval === 'yearly' ? 'yearly' : 'monthly');
        }
        return set;
    }, [audiencePlans]);

    // Honest UI: with a single plan (or every plan on the same interval)
    // the toggle switches between "the plans" and "nothing" — so it only
    // renders when both sides genuinely exist. One interval also implies
    // the ≤1-plan case (a single plan can't cover two intervals).
    const hasIntervalChoice = availableIntervals.size > 1;

    // When there is no real choice, pin the interval to the one that
    // exists — otherwise an editor-configured `defaultInterval: 'yearly'`
    // hides the only (monthly / interval-less) plan behind an invisible
    // toggle the visitor can no longer reach.
    const effectiveInterval = hasIntervalChoice
        ? activeInterval
        : (availableIntervals.has('yearly') ? 'yearly' : 'monthly');

    // Filter to the audience + effective billing interval. Plans without
    // an interval (e.g. Free / Custom) only match when monthly is
    // active, so they don't get hidden when the visitor flips to yearly
    // and they remain reachable.
    const visible = useMemo(() => {
        return audiencePlans.filter(p => {
            const pi = p?.billingInterval;
            if (!pi) return effectiveInterval === 'monthly';
            return pi === effectiveInterval;
        });
    }, [audiencePlans, effectiveInterval]);

    // Hidden while loading too: the skeleton phase doesn't yet know whether
    // there is anything to toggle, and a control that appears only to
    // vanish reads worse than one that fades in with the cards.
    const showToggle = enableToggle && !state.loading && hasIntervalChoice;

    if (isDisabled) return null;

    return (
        <SectionFrame id="pricing" name="Pricing" enabled={data?.enabled !== false}>
            <section id="pricing" className={sectionBgClass(data, 'alt-bg')}>
                <div className="container">
                    {heading ? (
                        <h2
                            className="content-el-heading"
                            style={{ textAlign: 'center', marginBottom: subheading ? '12px' : '32px', ...fieldTextStyle(data?.headingStyle, 'center') }}
                        >
                            {heading}
                        </h2>
                    ) : null}
                    {subheading ? (
                        <p
                            style={{
                                textAlign: 'center',
                                margin: '0 auto 32px',
                                maxWidth: '640px',
                                color: 'var(--text-secondary)',
                                lineHeight: 1.6,
                                ...fieldTextStyle(data?.subheadingStyle, 'center'),
                            }}
                        >
                            {subheading}
                        </p>
                    ) : null}

                    {showToggle ? (
                        <MonthlyYearlyToggle
                            monthlyLabel={toggleMonthly}
                            yearlyLabel={toggleYearly}
                            value={activeInterval}
                            onChange={setActiveInterval}
                        />
                    ) : null}

                    <div className="pricing-grid">
                        {state.loading ? (
                            <SkeletonCards />
                        ) : visible.length ? (
                            visible.map(plan => {
                                const featured = !!featuredPlanId && plan.id === featuredPlanId;
                                // Filled CTA on the featured tier only — but
                                // while no featured tier is chosen, every CTA
                                // stays filled (the legacy look).
                                const ctaFilled = featuredPlanId ? featured : true;
                                return (
                                    <div key={plan.id} className="pricing-col">
                                        <PlanCard
                                            plan={plan}
                                            data={data}
                                            ctaLabel={ctaLabel}
                                            featured={featured}
                                            ctaFilled={ctaFilled}
                                        />
                                    </div>
                                );
                            })
                        ) : (
                            <p className="pricing-empty">{emptyText}</p>
                        )}
                    </div>
                </div>
            </section>
        </SectionFrame>
    );
}

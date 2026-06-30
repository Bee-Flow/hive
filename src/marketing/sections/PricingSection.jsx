import React, { useEffect, useState, useMemo } from 'react';
import SectionFrame from '../components/SectionFrame';
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

// Suffix shown after the formatted price ("/maand" or "/jaar"). Kept in
// Dutch to match the rest of the marketing site's voice. If the plan
// has no price (custom / "Contact us"), the suffix is suppressed.
function intervalSuffix(interval) {
    if (interval === 'yearly')  return '/jaar';
    if (interval === 'monthly') return '/maand';
    return '';
}

// Pill-style segmented control above the cards. Identical look-and-feel
// to the prior static block's toggle — just wired to the new interval
// state instead of a 3D flip.
function MonthlyYearlyToggle({ monthlyLabel, yearlyLabel, value, onChange }) {
    const opt = (active) => ({
        appearance: 'none',
        WebkitAppearance: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '8px 20px',
        borderRadius: '9999px',
        fontSize: '0.9rem',
        fontWeight: 600,
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? '#FFFFFF' : 'var(--text-secondary)',
        transition: 'background 0.2s ease, color 0.2s ease',
    });
    const isYearly = value === 'yearly';
    return (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '40px' }}>
            <div
                role="group"
                aria-label="Billing period"
                style={{
                    display: 'inline-flex',
                    gap: '4px',
                    padding: '4px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '9999px',
                }}
            >
                <button type="button" style={opt(!isYearly)} aria-pressed={!isYearly} onClick={() => onChange('monthly')}>
                    {monthlyLabel}
                </button>
                <button type="button" style={opt(isYearly)} aria-pressed={isYearly} onClick={() => onChange('yearly')}>
                    {yearlyLabel}
                </button>
            </div>
        </div>
    );
}

const cardInner = {
    height: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    padding: '30px 26px',
    background: 'var(--bg-primary, #ffffff)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg, 16px)',
    boxShadow: 'var(--shadow-card, 0 10px 30px -12px rgba(15,23,42,0.15))',
};

const columnOuter = { flex: '1 1 260px', maxWidth: '380px', minWidth: 0 };

// Card for a single plan. All visible text comes from the plan record
// returned by the public-plans endpoint — admins edit it via the
// /app/admin/subscriptions page, never inside the CMS.
function PlanCard({ plan, ctaLabel }) {
    const price = formatPrice(plan.price, plan.currency);
    const suffix = price ? intervalSuffix(plan.billingInterval) : '';
    const tagline = plan.tagline || plan.description || '';
    const features = Array.isArray(plan.allowedFeatures) ? plan.allowedFeatures : [];
    const hasTrial = Number(plan.trialDays) > 0;
    const ctaHref = `/app/billing?plan=${encodeURIComponent(plan.id)}`;

    return (
        <div style={cardInner}>
            <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, lineHeight: 1.25, color: 'var(--text-primary)' }}>
                {plan.name}
            </h3>

            {price ? (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '2.2rem', fontWeight: 800, lineHeight: 1.15, color: 'var(--text-primary)' }}>
                        {price}
                    </span>
                    {suffix ? (
                        <span style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>{suffix}</span>
                    ) : null}
                </div>
            ) : (
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Op aanvraag
                </div>
            )}

            {tagline ? (
                <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.5, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                    {tagline}
                </p>
            ) : null}

            {hasTrial ? (
                <div
                    style={{
                        alignSelf: 'flex-start',
                        padding: '4px 12px',
                        borderRadius: '9999px',
                        background: 'var(--accent-muted, rgba(245, 166, 35, 0.12))',
                        color: 'var(--accent, #F5A623)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                    }}
                >
                    {plan.trialDays} dagen gratis proberen
                </div>
            ) : null}

            {features.length ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {features.map((f, i) => (
                        <li
                            key={i}
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '8px',
                                fontSize: '0.92rem',
                                color: 'var(--text-secondary)',
                                lineHeight: 1.5,
                            }}
                        >
                            <span aria-hidden="true" style={{ color: 'var(--accent, #F5A623)', flex: 'none' }}>✓</span>
                            <span>{featureLabel(f)}</span>
                        </li>
                    ))}
                </ul>
            ) : null}

            <a
                href={ctaHref}
                style={{
                    marginTop: 'auto',
                    display: 'block',
                    textAlign: 'center',
                    background: 'var(--accent, #F5A623)',
                    color: '#FFFFFF',
                    padding: '13px 22px',
                    borderRadius: '9999px',
                    fontSize: '0.98rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    lineHeight: 1.2,
                }}
            >
                {ctaLabel}
            </a>
        </div>
    );
}

// Skeleton placeholder shown during the initial fetch. Three columns so
// the page doesn't reflow noticeably once real plans land.
function SkeletonCards() {
    const block = {
        ...cardInner,
        background: 'var(--bg-secondary, #F7F8FA)',
        border: '1px dashed var(--border-subtle)',
        minHeight: 280,
    };
    return (
        <>
            {[0, 1, 2].map(i => (
                <div key={i} style={columnOuter}>
                    <div style={block} aria-hidden="true" />
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
                // surfaces during preview/development.
                console.error('[pricing] public-plans fetch failed:', err.message);
                setState({ loading: false, error: err.message || 'fetch failed', plans: [] });
            });
        return () => { cancelled = true; };
    }, []);

    // Filter to the audience + active billing interval. Plans without
    // an interval (e.g. Free / Custom) only match when monthly is
    // active, so they don't get hidden when the visitor flips to yearly
    // and they remain reachable.
    const visible = useMemo(() => {
        return state.plans.filter(p => {
            if (p?.planType !== planType) return false;
            const pi = p?.billingInterval;
            if (!pi) return activeInterval === 'monthly';
            return pi === activeInterval;
        });
    }, [state.plans, planType, activeInterval]);

    const showToggle = enableToggle;

    if (isDisabled) return null;

    return (
        <SectionFrame id="pricing" name="Pricing" enabled={data?.enabled !== false}>
            <section id="pricing" className="alt-bg">
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

                    <div
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '24px',
                            alignItems: 'stretch',
                            justifyContent: 'center',
                        }}
                    >
                        {state.loading ? (
                            <SkeletonCards />
                        ) : visible.length ? (
                            visible.map(plan => (
                                <div key={plan.id} style={columnOuter}>
                                    <PlanCard plan={plan} ctaLabel={ctaLabel} />
                                </div>
                            ))
                        ) : (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                                {emptyText}
                            </p>
                        )}
                    </div>
                </div>
            </section>
        </SectionFrame>
    );
}

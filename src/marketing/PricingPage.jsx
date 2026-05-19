import React, { useEffect, useState } from 'react';
import { API_BASE } from '../utils/helpers';

// Public /pricing page. Fetches plans flagged `is_public` from the
// no-auth /api/billing/public-plans endpoint and renders a card grid
// for each `planType` so organisation and consumer plans stay visually
// separate. Reachable when the admin flips "Visible on public pricing
// page" on a plan in the admin Plans panel. Visual chrome mirrors
// HomePage and LegalPage so the three public pages feel like one site.

// Order matters: teams first (B2B-positioned product), individuals
// second. Anything missing a known planType is treated as an
// organisation plan, matching the server-side default.
const SECTIONS = [
    {
        type: 'organization',
        heading: 'For teams',
        subtitle: 'Designed for organisations running Bee Flow at work.',
    },
    {
        type: 'consumer',
        heading: 'For individuals',
        subtitle: 'Personal plans — bring your own model usage where applicable.',
    },
];

const BRAND = {
    primary: '#F5A623',
    text: '#1F2937',
    muted: '#6B7280',
    border: '#E5E7EB',
    bg: '#FFFFFF',
    soft: '#FAFAFA',
    badgeBg: '#FFF4DC',
    badgeText: '#8A5A00',
    pillBg: '#1F2937',
    pillText: '#FFFFFF',
};

const CURRENCY_SYMBOL = { EUR: '€', USD: '$', GBP: '£' };

function formatPrice(price, currency, billingInterval) {
    const symbol = CURRENCY_SYMBOL[currency] || `${currency} `;
    const suffix = billingInterval === 'yearly' ? '/year' : '/month';
    if (price == null) return { amount: 'Contact us', suffix: '' };
    const amount = Number(price);
    if (!Number.isFinite(amount)) return { amount: 'Contact us', suffix: '' };
    if (amount === 0) return { amount: 'Free', suffix: '' };
    const formatted = Number.isInteger(amount)
        ? `${symbol}${amount}`
        : `${symbol}${amount.toFixed(2)}`;
    return { amount: formatted, suffix };
}

function formatLimit(value, singular, plural) {
    if (value == null) return null;
    const word = value === 1 ? singular : (plural || `${singular}s`);
    return `${value.toLocaleString()} ${word}`;
}

export default function PricingPage() {
    const [state, setState] = useState({ status: 'loading', plans: [] });

    useEffect(() => {
        const prev = document.title;
        document.title = 'Pricing — Bee Flow';
        let cancelled = false;
        fetch(`${API_BASE}/api/billing/public-plans`)
            .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
            .then(data => {
                if (cancelled) return;
                setState({ status: 'ok', plans: Array.isArray(data?.plans) ? data.plans : [] });
            })
            .catch(() => {
                // Don't surface fetch errors to anonymous visitors — fall
                // through to the same friendly empty state.
                if (cancelled) return;
                setState({ status: 'error', plans: [] });
            });
        return () => {
            cancelled = true;
            document.title = prev;
        };
    }, []);

    return (
        <div style={pageStyle}>
            <style>{cssRules}</style>

            <header style={headerStyle}>
                <a href="/" style={brandStyle}>
                    <img
                        src="/bee-flow-logo.svg"
                        alt="Bee Flow"
                        style={{ height: 28, width: 'auto' }}
                    />
                </a>
                <a href="/app" style={ctaButtonStyle}>Open the app →</a>
            </header>

            <main style={mainStyle}>
                <section style={heroStyle}>
                    <h1 style={heroTitleStyle}>Pricing</h1>
                    <p style={heroLeadStyle}>
                        Choose the plan that fits. Cancel any time.
                    </p>
                </section>

                {state.status === 'loading' ? (
                    <section style={gridStyle}>
                        <div style={skeletonCardStyle} aria-hidden="true" />
                    </section>
                ) : state.plans.length === 0 ? (
                    <section style={emptyStyle}>
                        <p style={emptyTitle}>Pricing details are coming soon.</p>
                        <p style={emptyBody}>
                            Email us at{' '}
                            <a href="mailto:info@beeflow.nl" style={emptyLink}>
                                info@beeflow.nl
                            </a>
                            {' '}for an early conversation.
                        </p>
                    </section>
                ) : (
                    <PlanSections plans={state.plans} />
                )}
            </main>

            <footer style={footerStyle}>
                <div style={footerInner}>
                    <span style={{ color: BRAND.muted }}>
                        © {new Date().getFullYear()} Bee Flow B.V.
                    </span>
                    <nav style={footerNav}>
                        <a href="/privacy" style={footerLinkStyle}>Privacy</a>
                        <a href="/terms" style={footerLinkStyle}>Terms</a>
                        <a href="mailto:info@beeflow.nl" style={footerLinkStyle}>Contact</a>
                    </nav>
                </div>
            </footer>
        </div>
    );
}

function PlanSections({ plans }) {
    // Group by planType, preserving server-side sort_order within each
    // group. SECTIONS drives the visible order; unknown types collapse
    // into the organisation bucket so we don't silently drop plans.
    const groups = new Map(SECTIONS.map(s => [s.type, []]));
    plans.forEach(plan => {
        const key = groups.has(plan.planType) ? plan.planType : 'organization';
        groups.get(key).push(plan);
    });
    const visibleSections = SECTIONS
        .map(s => ({ ...s, plans: groups.get(s.type) || [] }))
        .filter(s => s.plans.length > 0);
    const showHeadings = visibleSections.length > 1;

    return (
        <>
            {visibleSections.map((section, i) => (
                <section
                    key={section.type}
                    style={i === 0 ? sectionStyle : sectionStyleSpaced}
                >
                    {showHeadings ? (
                        <header style={sectionHeaderStyle}>
                            <h2 style={sectionHeadingStyle}>{section.heading}</h2>
                            <p style={sectionSubtitleStyle}>{section.subtitle}</p>
                        </header>
                    ) : null}
                    <div style={gridStyle}>
                        {section.plans.map(plan => (
                            <PlanCard key={plan.id} plan={plan} />
                        ))}
                    </div>
                </section>
            ))}
        </>
    );
}

function PlanCard({ plan }) {
    const { amount, suffix } = formatPrice(plan.price, plan.currency, plan.billingInterval);
    const limits = [
        formatLimit(plan.maxUsers, 'user'),
        formatLimit(plan.maxAgents, 'agent'),
        plan.maxMessagesPerMonth != null
            ? `${plan.maxMessagesPerMonth.toLocaleString()} messages / month`
            : null,
        formatLimit(plan.maxKnowledgeSources, 'knowledge source'),
    ].filter(Boolean);

    const features = Array.isArray(plan.allowedFeatures) ? plan.allowedFeatures : [];
    const visibleFeatures = features.slice(0, 6);
    const extraFeatureCount = Math.max(0, features.length - visibleFeatures.length);

    const showRecommended = plan.ncRecommended || plan.isDefault;

    return (
        <article style={cardStyle}>
            <header style={cardHeaderStyle}>
                <div style={cardTitleRowStyle}>
                    <h2 style={cardNameStyle}>{plan.name}</h2>
                    {showRecommended ? (
                        <span style={recommendedPillStyle}>Recommended</span>
                    ) : null}
                </div>
                {plan.tagline ? (
                    <p style={cardTaglineStyle}>{plan.tagline}</p>
                ) : null}
            </header>

            <div style={priceBlockStyle}>
                <span style={priceAmountStyle}>{amount}</span>
                {suffix ? <span style={priceSuffixStyle}>{suffix}</span> : null}
            </div>

            {plan.trialDays > 0 ? (
                <span style={trialBadgeStyle}>
                    {plan.trialDays}-day free trial
                </span>
            ) : null}

            {plan.description ? (
                <p style={descriptionStyle}>{plan.description}</p>
            ) : null}

            {limits.length > 0 ? (
                <ul style={listStyle}>
                    {limits.map(l => (
                        <li key={l} style={listItemStyle}>{l}</li>
                    ))}
                </ul>
            ) : null}

            {visibleFeatures.length > 0 ? (
                <ul style={listStyle}>
                    {visibleFeatures.map(f => (
                        <li key={f} style={listItemStyle}>{f}</li>
                    ))}
                    {extraFeatureCount > 0 ? (
                        <li style={{ ...listItemStyle, color: BRAND.muted }}>
                            +{extraFeatureCount} more
                        </li>
                    ) : null}
                </ul>
            ) : null}

            <a
                href={`/app?plan=${encodeURIComponent(plan.id)}`}
                style={planCtaStyle}
            >
                Get started
            </a>
        </article>
    );
}

const pageStyle = {
    minHeight: '100vh',
    background: BRAND.bg,
    color: BRAND.text,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    display: 'flex',
    flexDirection: 'column',
};

const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: `1px solid ${BRAND.border}`,
    background: BRAND.bg,
};

const brandStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    textDecoration: 'none',
    color: BRAND.text,
};

const ctaButtonStyle = {
    background: BRAND.primary,
    color: '#1F2937',
    padding: '10px 18px',
    borderRadius: 8,
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: 14,
};

const mainStyle = {
    flex: 1,
    maxWidth: 1080,
    width: '100%',
    margin: '0 auto',
    padding: '64px 24px 96px',
};

const heroStyle = {
    textAlign: 'center',
    marginBottom: 48,
};

const heroTitleStyle = {
    fontSize: 44,
    lineHeight: 1.1,
    margin: '0 0 12px',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: BRAND.text,
};

const heroLeadStyle = {
    fontSize: 17,
    color: BRAND.muted,
    margin: 0,
};

const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 20,
};

const sectionStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
};

const sectionStyleSpaced = {
    ...({
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
    }),
    marginTop: 64,
};

const sectionHeaderStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
};

const sectionHeadingStyle = {
    fontSize: 22,
    fontWeight: 700,
    margin: 0,
    color: BRAND.text,
    letterSpacing: '-0.01em',
};

const sectionSubtitleStyle = {
    fontSize: 14,
    color: BRAND.muted,
    margin: 0,
};

const cardStyle = {
    border: `1px solid ${BRAND.border}`,
    borderRadius: 14,
    padding: 28,
    background: BRAND.bg,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
};

const skeletonCardStyle = {
    border: `1px solid ${BRAND.border}`,
    borderRadius: 14,
    minHeight: 360,
    background: BRAND.soft,
};

const cardHeaderStyle = { display: 'flex', flexDirection: 'column', gap: 6 };

const cardTitleRowStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
};

const cardNameStyle = {
    fontSize: 20,
    fontWeight: 700,
    margin: 0,
    color: BRAND.text,
};

const cardTaglineStyle = {
    fontSize: 14,
    color: BRAND.muted,
    margin: 0,
    lineHeight: 1.5,
};

const recommendedPillStyle = {
    fontSize: 11,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 999,
    background: BRAND.pillBg,
    color: BRAND.pillText,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
};

const priceBlockStyle = {
    display: 'flex',
    alignItems: 'baseline',
    gap: 6,
};

const priceAmountStyle = {
    fontSize: 36,
    fontWeight: 700,
    color: BRAND.text,
    letterSpacing: '-0.01em',
};

const priceSuffixStyle = {
    fontSize: 15,
    color: BRAND.muted,
    fontWeight: 500,
};

const trialBadgeStyle = {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 999,
    background: BRAND.badgeBg,
    color: BRAND.badgeText,
};

const descriptionStyle = {
    fontSize: 14,
    lineHeight: 1.6,
    color: BRAND.text,
    margin: 0,
};

const listStyle = {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
};

const listItemStyle = {
    fontSize: 14,
    lineHeight: 1.5,
    color: BRAND.text,
};

const planCtaStyle = {
    marginTop: 'auto',
    background: BRAND.primary,
    color: '#1F2937',
    padding: '12px 18px',
    borderRadius: 8,
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: 15,
    textAlign: 'center',
};

const emptyStyle = {
    textAlign: 'center',
    padding: '64px 24px',
    border: `1px dashed ${BRAND.border}`,
    borderRadius: 14,
    background: BRAND.soft,
};

const emptyTitle = {
    fontSize: 18,
    fontWeight: 600,
    margin: '0 0 8px',
    color: BRAND.text,
};

const emptyBody = {
    fontSize: 15,
    color: BRAND.muted,
    margin: 0,
};

const emptyLink = {
    color: BRAND.primary,
    textDecoration: 'underline',
    fontWeight: 500,
};

const footerStyle = {
    borderTop: `1px solid ${BRAND.border}`,
    background: BRAND.soft,
    padding: '24px',
};

const footerInner = {
    maxWidth: 1080,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 14,
    flexWrap: 'wrap',
    gap: 12,
};

const footerNav = {
    display: 'flex',
    gap: 20,
};

const footerLinkStyle = {
    color: BRAND.text,
    textDecoration: 'none',
    fontWeight: 500,
};

const cssRules = `
@media (max-width: 600px) {
    h1[data-pricing-title] { font-size: 32px !important; }
}
`;

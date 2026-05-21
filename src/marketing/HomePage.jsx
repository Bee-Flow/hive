import React, { useEffect, useState } from 'react';
import {
    Bot, FileText, FilePlus2, Sparkles, Plug, ShieldCheck,
    Search, Mic, PenLine, ArrowRight,
} from 'lucide-react';
import { API_BASE } from '../utils/helpers';
import ContactSection from './sections/ContactSection';

// Public landing page shown at the root of the application domain
// (beeflow.ai, and beeflow.nl when used) while the CMS-managed Product
// Website is still being built. Self-contained: inline styles only, no
// dependency on marketing.css or the CMS Hero/Features/Steps components.
// When the CMS is later enabled with a real homepage, RootPathGate in
// App.jsx routes "/" to ProductWebsite and this page is no longer
// reached — so this stays a temporary stop-gap, not the long-term site.

const BRAND = {
    primary: '#F5A623',
    primaryDark: '#E0941A',
    accent: '#FFD166',
    text: '#1F2937',
    textOnPrimary: '#1F2937',
    muted: '#6B7280',
    border: '#E5E7EB',
    bg: '#FFFFFF',
    soft: '#FAFAFA',
    tile: '#FFF4DC',
    tileText: '#8A5A00',
    gradientStart: '#FFF4DC',
    gradientEnd: '#FFFFFF',
};

const CAPABILITIES = [
    {
        Icon: Bot,
        title: 'Build assistants that know your business',
        body: 'Upload handbooks, contracts, and project files. Bee Flow turns them into assistants that answer with the right context — and shows you the source.',
    },
    {
        Icon: FileText,
        title: 'Notes that take themselves',
        body: 'Auto-transcribed meeting notes with action items, decisions, and summaries — linked back to the right project space.',
    },
    {
        Icon: FilePlus2,
        title: 'Documents that fill themselves in',
        body: 'Drop in a template. Bee Flow pulls the right facts from your files. You review and send.',
    },
    {
        Icon: Sparkles,
        title: 'Spot work worth automating',
        body: 'Bee Flow watches your inbox, calendar and project tools for repeating tasks — and proposes ways to handle them.',
    },
    {
        Icon: Plug,
        title: 'Works with the tools you already use',
        body: 'Google Workspace, Microsoft 365, GitHub, YouTrack, Fireflies, Nextcloud, and more. No painful migration.',
    },
    {
        Icon: ShieldCheck,
        title: 'Built for European privacy',
        body: 'Hosted in the EU on Scaleway. Your data stays yours. We don’t train on your content.',
    },
];

const STEPS = [
    {
        n: 1,
        title: 'Sign up and connect',
        body: 'One account for the whole team. Link Google or Microsoft in a click.',
    },
    {
        n: 2,
        title: 'Bring your knowledge',
        body: 'Drop in your documents. Bee Flow indexes and references — but never trains on — your content.',
    },
    {
        n: 3,
        title: 'Roll it out',
        body: 'Build a tailored assistant for any team (sales, HR, support, legal) and share it.',
    },
];

const USE_CASES = [
    {
        Icon: Search,
        eyebrow: 'Sales',
        body: 'Reps stop hunting through Drive. They ask "what are our terms on this?" and get a sourced answer in seconds.',
    },
    {
        Icon: Mic,
        eyebrow: 'Operations',
        body: 'Stand-ups, customer calls and supplier meetings are captured, summarised and routed to the right project.',
    },
    {
        Icon: PenLine,
        eyebrow: 'Knowledge work',
        body: 'Letters, contracts and ticket responses are drafted from your templates — humans review, machines do the typing.',
    },
];

export default function HomePage() {
    const [hasPublicPlans, setHasPublicPlans] = useState(false);

    useEffect(() => {
        const prev = document.title;
        document.title = 'Bee Flow — AI assistants that know your business';
        return () => { document.title = prev; };
    }, []);

    useEffect(() => {
        let cancelled = false;
        fetch(`${API_BASE}/api/billing/public-plans`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
            .then(data => {
                if (cancelled) return;
                if (Array.isArray(data?.plans) && data.plans.length > 0) {
                    setHasPublicPlans(true);
                }
            });
        return () => { cancelled = true; };
    }, []);

    return (
        <div style={pageStyle}>
            <style>{cssRules}</style>

            <header style={headerStyle}>
                <div style={headerInnerStyle}>
                    <a href="/" style={brandStyle}>
                        <img
                            src="/bee-flow-logo.svg"
                            alt="Bee Flow"
                            style={{ height: 28, width: 'auto' }}
                        />
                    </a>
                    <nav style={topNavStyle}>
                        {hasPublicPlans ? (
                            <a href="/pricing" style={topNavLinkStyle}>Pricing</a>
                        ) : null}
                        <a href="/privacy" style={topNavLinkStyle}>Privacy</a>
                        <a href="/app" style={ctaButtonStyle}>Open the app →</a>
                    </nav>
                </div>
            </header>

            <main>
                {/* Hero */}
                <section style={heroSectionStyle}>
                    <div style={heroInnerStyle} className="bf-hero-grid">
                        <div style={heroCopyStyle}>
                            <span style={pillStyle}>
                                Privacy-first AI workspace · Hosted in the EU
                            </span>
                            <h1 style={heroTitleStyle} className="bf-hero-title">
                                AI assistants that know your business — and keep it private.
                            </h1>
                            <p style={heroLeadStyle}>
                                Bee Flow turns your documents, meetings and tools
                                into assistants your team can use straight away.
                                Hosted in the EU. Your data stays yours.
                            </p>
                            <div style={heroActionsStyle}>
                                <a href="/app" style={primaryButtonStyle}>
                                    Open the app
                                    <ArrowRight size={16} aria-hidden="true" />
                                </a>
                                {hasPublicPlans ? (
                                    <a href="/pricing" style={secondaryButtonStyle}>
                                        View pricing
                                    </a>
                                ) : null}
                                <a href="/privacy" style={textLinkStyle}>
                                    Read our privacy policy
                                </a>
                            </div>
                        </div>
                        <ChatPreview />
                    </div>
                </section>

                {/* Capabilities */}
                <section style={sectionStyle}>
                    <div style={sectionInnerStyle}>
                        <header style={sectionHeaderStyle}>
                            <h2 style={sectionTitleStyle}>
                                Everything your team needs from AI, in one workspace.
                            </h2>
                            <p style={sectionLeadStyle}>
                                One platform that handles the busywork around your
                                documents, meetings, and day-to-day tools — without
                                forcing anyone to learn a new way of working.
                            </p>
                        </header>
                        <div style={capabilityGridStyle}>
                            {CAPABILITIES.map(({ Icon, title, body }) => (
                                <article key={title} style={cardStyle}>
                                    <div style={iconTileStyle}>
                                        <Icon size={20} strokeWidth={2} />
                                    </div>
                                    <h3 style={cardTitleStyle}>{title}</h3>
                                    <p style={cardBodyStyle}>{body}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                {/* How it works */}
                <section style={sectionAltStyle}>
                    <div style={sectionInnerStyle}>
                        <header style={sectionHeaderStyle}>
                            <h2 style={sectionTitleStyle}>
                                From signup to ready-to-use in an afternoon.
                            </h2>
                            <p style={sectionLeadStyle}>
                                You don’t need an IT project to get started. Most teams
                                are up and running on the same day.
                            </p>
                        </header>
                        <ol style={stepsStyle}>
                            {STEPS.map(({ n, title, body }) => (
                                <li key={n} style={stepStyle}>
                                    <div style={stepNumberStyle}>{n}</div>
                                    <h3 style={stepTitleStyle}>{title}</h3>
                                    <p style={stepBodyStyle}>{body}</p>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                {/* Use cases */}
                <section style={sectionStyle}>
                    <div style={sectionInnerStyle}>
                        <header style={sectionHeaderStyle}>
                            <h2 style={sectionTitleStyle}>Bee Flow at work.</h2>
                            <p style={sectionLeadStyle}>
                                A few of the everyday moments where Bee Flow earns
                                its keep.
                            </p>
                        </header>
                        <div style={useCaseGridStyle}>
                            {USE_CASES.map(({ Icon, eyebrow, body }) => (
                                <article key={eyebrow} style={useCaseCardStyle}>
                                    <div style={useCaseHeaderStyle}>
                                        <div style={useCaseIconStyle}>
                                            <Icon size={18} strokeWidth={2} />
                                        </div>
                                        <span style={useCaseEyebrowStyle}>{eyebrow}</span>
                                    </div>
                                    <p style={useCaseBodyStyle}>{body}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Trust block */}
                <section style={trustSectionStyle}>
                    <div style={trustInnerStyle}>
                        <h2 style={sectionTitleStyle}>Your data is your data.</h2>
                        <p style={trustBodyStyle}>
                            Bee Flow is built and operated in the Netherlands by
                            Bee Flow B.V. Prompts and documents stay in EU data
                            centres on Scaleway. The major US AI model providers
                            we use — Anthropic, OpenAI, Microsoft and Google —
                            are all certified under the EU-US Data Privacy
                            Framework. We don’t sell your data, and we don’t use
                            it to train anyone’s model.
                        </p>
                        <div style={trustActionsStyle}>
                            <a href="/privacy" style={trustButtonStyle}>
                                Read the privacy policy
                            </a>
                            <a href="/terms" style={trustButtonStyle}>
                                Read the terms
                            </a>
                        </div>
                    </div>
                </section>

                {/* Final CTA */}
                <section style={finalCtaSectionStyle}>
                    <div style={finalCtaInnerStyle}>
                        <h2 style={finalCtaTitleStyle}>
                            Bring AI into your team — without the lock-in.
                        </h2>
                        <p style={finalCtaLeadStyle}>
                            Start free. Upgrade when you’re ready. Cancel any time.
                        </p>
                        <div style={heroActionsStyle}>
                            <a href="/app" style={primaryButtonStyle}>
                                Open the app
                                <ArrowRight size={16} aria-hidden="true" />
                            </a>
                            <a href="#contact" style={secondaryButtonStyle}>
                                Talk to us
                            </a>
                        </div>
                    </div>
                </section>

                <ContactSection />
            </main>

            <footer style={footerStyle}>
                <div style={footerInnerStyle}>
                    <span style={{ color: BRAND.muted }}>
                        © {new Date().getFullYear()} Bee Flow B.V. · Bovenkerkerweg 6 unit 1.12, 1185 XE Amstelveen · KvK 97632430
                    </span>
                    <nav style={footerNavStyle}>
                        <a href="/privacy" style={footerLinkStyle}>Privacy</a>
                        <a href="/terms" style={footerLinkStyle}>Terms</a>
                        {hasPublicPlans ? (
                            <a href="/pricing" style={footerLinkStyle}>Pricing</a>
                        ) : null}
                        <a href="#contact" style={footerLinkStyle}>Contact</a>
                    </nav>
                </div>
            </footer>
        </div>
    );
}

function ChatPreview() {
    return (
        <div style={chatWrapStyle} aria-hidden="true">
            <div style={chatWindowStyle}>
                <div style={chatHeaderStyle}>
                    <div style={chatHeaderDotsStyle}>
                        <span style={{ ...chatDotStyle, background: '#F87171' }} />
                        <span style={{ ...chatDotStyle, background: '#FBBF24' }} />
                        <span style={{ ...chatDotStyle, background: '#34D399' }} />
                    </div>
                    <span style={chatHeaderLabelStyle}>Bee Flow · Sales assistant</span>
                </div>
                <div style={chatBodyStyle}>
                    <div style={chatBubbleUserStyle}>
                        What’s our cancellation policy for annual contracts?
                    </div>
                    <div style={chatBubbleAiStyle}>
                        Annual contracts can be cancelled with 30 days’ notice
                        before the renewal date.
                        <div style={chatCitationStyle}>
                            Source: master-agreement.pdf · clause 7.2
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────

const pageStyle = {
    minHeight: '100vh',
    background: BRAND.bg,
    color: BRAND.text,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    display: 'flex',
    flexDirection: 'column',
};

const headerStyle = {
    borderBottom: `1px solid ${BRAND.border}`,
    background: BRAND.bg,
    position: 'sticky',
    top: 0,
    zIndex: 10,
};

const headerInnerStyle = {
    maxWidth: 1160,
    margin: '0 auto',
    padding: '16px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
};

const brandStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    textDecoration: 'none',
    color: BRAND.text,
};

const topNavStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 24,
};

const topNavLinkStyle = {
    color: BRAND.text,
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 500,
};

const ctaButtonStyle = {
    background: BRAND.primary,
    color: BRAND.textOnPrimary,
    padding: '10px 18px',
    borderRadius: 8,
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: 14,
};

const heroSectionStyle = {
    background: `radial-gradient(ellipse at top, ${BRAND.gradientStart} 0%, ${BRAND.gradientEnd} 60%)`,
    padding: '80px 24px 96px',
};

const heroInnerStyle = {
    maxWidth: 1160,
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: '1.05fr 0.95fr',
    gap: 56,
    alignItems: 'center',
};

const heroCopyStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: 22,
};

const pillStyle = {
    alignSelf: 'flex-start',
    display: 'inline-block',
    background: BRAND.tile,
    color: BRAND.tileText,
    padding: '6px 14px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.01em',
};

const heroTitleStyle = {
    fontSize: 56,
    lineHeight: 1.06,
    fontWeight: 700,
    letterSpacing: '-0.025em',
    color: BRAND.text,
    margin: 0,
};

const heroLeadStyle = {
    fontSize: 19,
    lineHeight: 1.6,
    color: BRAND.muted,
    margin: 0,
    maxWidth: 540,
};

const heroActionsStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 16,
    alignItems: 'center',
};

const primaryButtonStyle = {
    background: BRAND.primary,
    color: BRAND.textOnPrimary,
    padding: '14px 22px',
    borderRadius: 10,
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: 15,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    boxShadow: '0 1px 0 rgba(31,41,55,0.04), 0 8px 24px rgba(245,166,35,0.25)',
};

const secondaryButtonStyle = {
    background: BRAND.bg,
    color: BRAND.text,
    padding: '14px 22px',
    borderRadius: 10,
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: 15,
    border: `1px solid ${BRAND.border}`,
};

const textLinkStyle = {
    color: BRAND.primary,
    textDecoration: 'none',
    fontWeight: 500,
    fontSize: 14,
};

// Chat preview ─────────────────────────────────────────────────────────────

const chatWrapStyle = {
    display: 'flex',
    justifyContent: 'center',
};

const chatWindowStyle = {
    width: '100%',
    maxWidth: 440,
    background: BRAND.bg,
    border: `1px solid ${BRAND.border}`,
    borderRadius: 18,
    boxShadow: '0 30px 60px -30px rgba(31,41,55,0.25)',
    overflow: 'hidden',
};

const chatHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    borderBottom: `1px solid ${BRAND.border}`,
    background: BRAND.soft,
};

const chatHeaderDotsStyle = { display: 'flex', gap: 6 };

const chatDotStyle = {
    width: 10,
    height: 10,
    borderRadius: 999,
    display: 'inline-block',
};

const chatHeaderLabelStyle = {
    fontSize: 12,
    color: BRAND.muted,
    fontWeight: 500,
};

const chatBodyStyle = {
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    background: BRAND.bg,
};

const chatBubbleUserStyle = {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    padding: '10px 14px',
    borderRadius: '14px 14px 4px 14px',
    background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryDark})`,
    color: '#1F2937',
    fontSize: 14,
    lineHeight: 1.5,
    fontWeight: 500,
};

const chatBubbleAiStyle = {
    alignSelf: 'flex-start',
    maxWidth: '90%',
    padding: '12px 14px',
    borderRadius: '14px 14px 14px 4px',
    background: BRAND.bg,
    color: BRAND.text,
    fontSize: 14,
    lineHeight: 1.55,
    border: `1px solid ${BRAND.border}`,
    boxShadow: '0 1px 2px rgba(31,41,55,0.04)',
};

const chatCitationStyle = {
    marginTop: 8,
    fontSize: 12,
    color: BRAND.muted,
    paddingTop: 8,
    borderTop: `1px dashed ${BRAND.border}`,
};

// Generic sections ────────────────────────────────────────────────────────

const sectionStyle = {
    padding: '96px 24px',
    background: BRAND.bg,
};

const sectionAltStyle = {
    padding: '96px 24px',
    background: BRAND.soft,
};

const sectionInnerStyle = {
    maxWidth: 1160,
    margin: '0 auto',
};

const sectionHeaderStyle = {
    textAlign: 'center',
    maxWidth: 720,
    margin: '0 auto 56px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
};

const sectionTitleStyle = {
    fontSize: 36,
    lineHeight: 1.15,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: BRAND.text,
    margin: 0,
};

const sectionLeadStyle = {
    fontSize: 17,
    lineHeight: 1.6,
    color: BRAND.muted,
    margin: 0,
};

// Capability cards ────────────────────────────────────────────────────────

const capabilityGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 20,
};

const cardStyle = {
    background: BRAND.bg,
    border: `1px solid ${BRAND.border}`,
    borderRadius: 14,
    padding: 28,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
};

const iconTileStyle = {
    width: 44,
    height: 44,
    borderRadius: 10,
    background: BRAND.tile,
    color: BRAND.tileText,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
};

const cardTitleStyle = {
    fontSize: 17,
    fontWeight: 700,
    color: BRAND.text,
    margin: 0,
    lineHeight: 1.35,
};

const cardBodyStyle = {
    fontSize: 15,
    lineHeight: 1.6,
    color: BRAND.muted,
    margin: 0,
};

// Steps ───────────────────────────────────────────────────────────────────

const stepsStyle = {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 24,
    counterReset: 'bf-step',
};

const stepStyle = {
    background: BRAND.bg,
    border: `1px solid ${BRAND.border}`,
    borderRadius: 14,
    padding: 28,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
};

const stepNumberStyle = {
    width: 36,
    height: 36,
    borderRadius: 999,
    background: BRAND.primary,
    color: BRAND.textOnPrimary,
    fontWeight: 700,
    fontSize: 16,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(245,166,35,0.3)',
};

const stepTitleStyle = {
    fontSize: 18,
    fontWeight: 700,
    margin: 0,
    color: BRAND.text,
};

const stepBodyStyle = {
    fontSize: 15,
    lineHeight: 1.6,
    color: BRAND.muted,
    margin: 0,
};

// Use cases ───────────────────────────────────────────────────────────────

const useCaseGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 20,
};

const useCaseCardStyle = {
    background: BRAND.soft,
    border: `1px solid ${BRAND.border}`,
    borderRadius: 14,
    padding: 26,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
};

const useCaseHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
};

const useCaseIconStyle = {
    width: 36,
    height: 36,
    borderRadius: 8,
    background: BRAND.bg,
    color: BRAND.tileText,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `1px solid ${BRAND.border}`,
};

const useCaseEyebrowStyle = {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: BRAND.tileText,
};

const useCaseBodyStyle = {
    fontSize: 15,
    lineHeight: 1.6,
    color: BRAND.text,
    margin: 0,
};

// Trust block ─────────────────────────────────────────────────────────────

const trustSectionStyle = {
    padding: '80px 24px',
    background: BRAND.soft,
    borderTop: `1px solid ${BRAND.border}`,
    borderBottom: `1px solid ${BRAND.border}`,
};

const trustInnerStyle = {
    maxWidth: 760,
    margin: '0 auto',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    alignItems: 'center',
};

const trustBodyStyle = {
    fontSize: 16,
    lineHeight: 1.7,
    color: BRAND.text,
    margin: 0,
};

const trustActionsStyle = {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 4,
};

const trustButtonStyle = {
    background: BRAND.bg,
    color: BRAND.text,
    padding: '10px 18px',
    borderRadius: 8,
    textDecoration: 'none',
    fontWeight: 500,
    fontSize: 14,
    border: `1px solid ${BRAND.border}`,
};

// Final CTA ───────────────────────────────────────────────────────────────

const finalCtaSectionStyle = {
    padding: '96px 24px',
    background: BRAND.bg,
};

const finalCtaInnerStyle = {
    maxWidth: 720,
    margin: '0 auto',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    alignItems: 'center',
};

const finalCtaTitleStyle = {
    fontSize: 36,
    lineHeight: 1.15,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: BRAND.text,
    margin: 0,
};

const finalCtaLeadStyle = {
    fontSize: 17,
    lineHeight: 1.6,
    color: BRAND.muted,
    margin: 0,
};

// Footer ──────────────────────────────────────────────────────────────────

const footerStyle = {
    borderTop: `1px solid ${BRAND.border}`,
    background: BRAND.soft,
    padding: '24px',
};

const footerInnerStyle = {
    maxWidth: 1160,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 13,
    flexWrap: 'wrap',
    gap: 12,
};

const footerNavStyle = {
    display: 'flex',
    gap: 20,
};

const footerLinkStyle = {
    color: BRAND.text,
    textDecoration: 'none',
    fontWeight: 500,
};

// Responsive overrides + a couple of hover effects. Inline styles can't
// express media queries, so they live in a single <style> block.
const cssRules = `
@media (max-width: 960px) {
    .bf-hero-title { font-size: 44px !important; }
}
@media (max-width: 880px) {
    .bf-hero-grid {
        grid-template-columns: 1fr !important;
        gap: 40px !important;
    }
}
@media (max-width: 600px) {
    .bf-hero-title { font-size: 34px !important; line-height: 1.1 !important; }
    h2 { font-size: 28px !important; }
}
`;

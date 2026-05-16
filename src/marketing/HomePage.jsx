import React, { useEffect } from 'react';

// Public landing page shown at the root of the application domain
// (beeflow.ai, and beeflow.nl when used) when the CMS-managed Product
// Website is disabled. Intentionally an "under construction" placeholder
// — its purpose is to be a no-login URL that (a) signals to visitors
// that the public marketing site is on the way and (b) gives Google's
// OAuth consent-screen verifier the things it requires: visible privacy
// and terms links, contact details, and a path into the application.
// If the CMS is later enabled with a real homepage, ProductWebsite takes
// over and this page is no longer reached.

const BRAND = {
    primary: '#F5A623',
    text: '#1F2937',
    muted: '#6B7280',
    border: '#E5E7EB',
    bg: '#FFFFFF',
    soft: '#FAFAFA',
    badgeBg: '#FFF4DC',
    badgeText: '#8A5A00',
};

export default function HomePage() {
    useEffect(() => {
        const prev = document.title;
        document.title = 'Bee Flow — Website under construction';
        return () => { document.title = prev; };
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
                <span style={badgeStyle}>Website under construction</span>

                <h1 style={titleStyle}>Bee Flow</h1>
                <p style={taglineStyle}>
                    AI agents and workflows for your business.
                </p>

                <p style={bodyStyle}>
                    Our public website is being rebuilt. In the meantime, you can
                    sign in to the Bee Flow application, read our policies, or
                    get in touch.
                </p>

                <div style={actionsStyle}>
                    <a href="/app" style={primaryButtonStyle}>Open the app</a>
                    <a href="/privacy" style={secondaryButtonStyle}>Privacy Policy</a>
                    <a href="/terms" style={secondaryButtonStyle}>Terms of Service</a>
                    <a href="mailto:info@beeflow.nl" style={secondaryButtonStyle}>Contact</a>
                </div>

                <p style={fineprintStyle}>
                    Operated by Bee Flow B.V., Bovenkerkerweg 6 unit 1.12,
                    1185 XE Amstelveen, the Netherlands · KvK 97632430 ·
                    BTW NL868147011B01
                </p>
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
    maxWidth: 680,
    width: '100%',
    margin: '0 auto',
    padding: '96px 24px 64px',
    textAlign: 'center',
};

const badgeStyle = {
    display: 'inline-block',
    background: BRAND.badgeBg,
    color: BRAND.badgeText,
    padding: '6px 14px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.02em',
    marginBottom: 24,
};

const titleStyle = {
    fontSize: 56,
    lineHeight: 1.05,
    margin: '0 0 12px',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: BRAND.text,
};

const taglineStyle = {
    fontSize: 20,
    color: BRAND.text,
    margin: '0 0 24px',
    fontWeight: 500,
};

const bodyStyle = {
    fontSize: 16,
    lineHeight: 1.7,
    color: BRAND.muted,
    margin: '0 auto 40px',
    maxWidth: 520,
};

const actionsStyle = {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 56,
};

const primaryButtonStyle = {
    background: BRAND.primary,
    color: '#1F2937',
    padding: '12px 22px',
    borderRadius: 8,
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: 15,
};

const secondaryButtonStyle = {
    background: BRAND.bg,
    color: BRAND.text,
    padding: '12px 22px',
    borderRadius: 8,
    textDecoration: 'none',
    fontWeight: 500,
    fontSize: 15,
    border: `1px solid ${BRAND.border}`,
};

const fineprintStyle = {
    fontSize: 13,
    color: BRAND.muted,
    lineHeight: 1.6,
    margin: 0,
};

const footerStyle = {
    borderTop: `1px solid ${BRAND.border}`,
    background: BRAND.soft,
    padding: '24px',
};

const footerInner = {
    maxWidth: 680,
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
    h1[data-home-title] { font-size: 40px !important; }
}
`;

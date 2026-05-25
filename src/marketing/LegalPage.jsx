import React, { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import beeFlowLogo from '../assets/bee-flow-logo.svg';

// Self-contained public legal page. Renders a markdown source string with a
// minimal header/footer that doesn't depend on the CMS data shape — so these
// pages always resolve, even when the marketing site (ProductWebsite) is
// disabled or unreachable. Used for /privacy and /terms, which are linked
// from the Google OAuth consent screen and therefore must remain stable
// public URLs.

const BRAND = {
    primary: '#F5A623',
    text: '#1F2937',
    muted: '#6B7280',
    border: '#E5E7EB',
    bg: '#FFFFFF',
    soft: '#FAFAFA',
};

export default function LegalPage({ title, source, lastUpdated }) {
    useEffect(() => {
        const prev = document.title;
        document.title = `${title} — Bee Flow`;
        return () => { document.title = prev; };
    }, [title]);

    return (
        <div style={pageStyle}>
            <style>{cssRules}</style>
            <header style={headerStyle}>
                <a href="/" style={brandStyle}>
                    <img
                        src={beeFlowLogo}
                        alt="Bee Flow"
                        style={{ height: 28, width: 'auto' }}
                    />
                </a>
                <a href="/app" style={backLinkStyle}>Back to app →</a>
            </header>
            <main className="legal-content" style={mainStyle}>
                <h1 style={titleStyle}>{title}</h1>
                {lastUpdated ? (
                    <p style={caption}>Last updated: {lastUpdated}</p>
                ) : null}
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {source}
                </ReactMarkdown>
            </main>
            <footer style={footerStyle}>
                <div style={footerInner}>
                    <span style={{ color: BRAND.muted }}>
                        © {new Date().getFullYear()} Bee Flow B.V.
                    </span>
                    <nav style={footerNav}>
                        <a href="/privacy" style={footerLinkStyle}>Privacy</a>
                        <a href="/terms" style={footerLinkStyle}>Terms</a>
                        <a href="/app" style={footerLinkStyle}>App</a>
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

const backLinkStyle = {
    color: BRAND.primary,
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: 14,
};

const mainStyle = {
    flex: 1,
    maxWidth: 760,
    width: '100%',
    margin: '0 auto',
    padding: '48px 24px 96px',
    lineHeight: 1.7,
    fontSize: 16,
};

const titleStyle = {
    fontSize: 36,
    lineHeight: 1.2,
    margin: '0 0 8px',
    fontWeight: 700,
    color: BRAND.text,
};

const caption = {
    color: BRAND.muted,
    fontSize: 14,
    margin: '0 0 32px',
};

const footerStyle = {
    borderTop: `1px solid ${BRAND.border}`,
    background: BRAND.soft,
    padding: '24px',
};

const footerInner = {
    maxWidth: 760,
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
    gap: 16,
};

const footerLinkStyle = {
    color: BRAND.text,
    textDecoration: 'none',
    fontWeight: 500,
};

const cssRules = `
.legal-content h2 {
    font-size: 22px;
    font-weight: 700;
    margin: 40px 0 12px;
    color: ${BRAND.text};
}
.legal-content h3 {
    font-size: 18px;
    font-weight: 600;
    margin: 28px 0 8px;
    color: ${BRAND.text};
}
.legal-content p { margin: 0 0 16px; }
.legal-content a {
    color: ${BRAND.primary};
    text-decoration: underline;
    text-underline-offset: 2px;
}
.legal-content a:hover { text-decoration: none; }
.legal-content strong { color: ${BRAND.text}; }
.legal-content ul, .legal-content ol {
    margin: 0 0 16px;
    padding-left: 24px;
}
.legal-content li { margin: 4px 0; }
.legal-content blockquote {
    margin: 0 0 24px;
    padding: 16px 20px;
    border-left: 4px solid ${BRAND.primary};
    background: #FFF8EC;
    border-radius: 4px;
    color: ${BRAND.text};
}
.legal-content blockquote p:last-child { margin-bottom: 0; }
.legal-content table {
    border-collapse: collapse;
    width: 100%;
    margin: 0 0 24px;
    font-size: 14px;
}
.legal-content th, .legal-content td {
    border: 1px solid ${BRAND.border};
    padding: 8px 12px;
    text-align: left;
    vertical-align: top;
}
.legal-content th {
    background: ${BRAND.soft};
    font-weight: 600;
}
.legal-content code {
    background: #F3F4F6;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.92em;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.legal-content hr {
    border: 0;
    border-top: 1px solid ${BRAND.border};
    margin: 32px 0;
}
@media (max-width: 600px) {
    .legal-content h1 { font-size: 28px !important; }
    .legal-content h2 { font-size: 20px; }
    .legal-content { font-size: 15px; }
}
`;

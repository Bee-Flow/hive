import React from 'react';
import AppIcon from '../../components/AppIcon';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';
import { inlineTextStyle } from './textStyle';

const isPreview = () =>
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('preview');

export default function Footer({ data, isDark, onToggleTheme }) {
    if (!data?.enabled) return null;
    const showThemeSwitcher = !!data.themeSwitcher?.enabled;
    // Master footer-link style — applied to every column link and every
    // social link. Returns undefined when nothing is set so the style
    // attribute is omitted entirely (CSS file defaults still win).
    const linkStyle = inlineTextStyle(data.linkStyle);
    // Accountability row — the footer is a trust surface. Hidden entirely
    // while every field is empty so old sites are untouched.
    const acc = data.accountability || {};
    const accLinks = Array.isArray(acc.links) ? acc.links.filter(l => l && l.label) : [];
    const showAccountability =
        !!(acc.address || acc.registration || acc.vat || accLinks.length) || isPreview();
    // The brand "." flourish is now opt-in (showDot === true); it read as
    // a template artifact on brands whose name doesn't want it.
    const showDot = data.brand?.showDot === true;
    return (
        <SectionFrame id="footer" name="Footer" enabled={data.enabled}>
            <footer className="site-footer">
                <div className="container">
                    <div className="footer-grid">
                        <div className="footer-brand">
                            {data.brand?.logoText !== undefined ? (
                                <div className="header-logo" style={{ marginBottom: 12 }}>
                                    <span>
                                        <EditableText path="footer.brand.logoText" placeholder="Logo">
                                            {data.brand.logoText || ''}
                                        </EditableText>
                                        {showDot ? <span className="logo-dot">.</span> : null}
                                    </span>
                                </div>
                            ) : null}
                            <EditableText
                                as="p"
                                path="footer.brand.blurb"
                                multiline
                                placeholder="Short description"
                            >
                                {data.brand?.blurb || ''}
                            </EditableText>
                        </div>
                        {(data.columns || []).map((col, i) => (
                            <div key={i} className="footer-col">
                                <EditableText
                                    as="h4"
                                    path={`footer.columns.${i}.heading`}
                                    placeholder="Heading"
                                >
                                    {col.heading || ''}
                                </EditableText>
                                <ul>
                                    {(col.links || []).map((link, j) => (
                                        <li key={j}>
                                            <a
                                                href={link.href}
                                                target={link.target}
                                                rel={link.rel}
                                                onClick={(e) => isPreview() && e.preventDefault()}
                                                style={linkStyle}
                                            >
                                                <EditableText
                                                    path={`footer.columns.${i}.links.${j}.label`}
                                                    placeholder="Link"
                                                >
                                                    {link.label || ''}
                                                </EditableText>
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                    {/* Accountability and copyright are ONE row, not two stacked
                        ones. They were separate rows with their own rules, which
                        gave the footer three horizontal lines and a lot of empty
                        space for what is really a single strip of small print:
                        who we are, where we are, the legal links, the locale.
                        `footer-legal` wraps, so this is one line on desktop and
                        a tidy stack on a phone — not a promise to overflow. */}
                    <div className="footer-legal">
                        {showAccountability ? (
                            <>
                                <EditableText path="footer.accountability.address" placeholder="Street 1, 1234 AB City, Netherlands">
                                    {acc.address || ''}
                                </EditableText>
                                <EditableText path="footer.accountability.registration" placeholder="KvK 12345678">
                                    {acc.registration || ''}
                                </EditableText>
                                <EditableText path="footer.accountability.vat" placeholder="VAT NL123456789B01">
                                    {acc.vat || ''}
                                </EditableText>
                                {accLinks.map((l, i) => (
                                    <a
                                        key={i}
                                        href={l.href || '#'}
                                        onClick={(e) => isPreview() && e.preventDefault()}
                                    >
                                        {l.label}
                                    </a>
                                ))}
                            </>
                        ) : null}
                        <EditableText path="footer.copyright" placeholder="© Company">
                            {data.copyright || ''}
                        </EditableText>
                        <div className="footer-bottom-right">
                            {data.showLanguageSwitcher ? <FooterLocaleToggle /> : null}
                            {data.socials?.length ? (
                                <div className="footer-socials">
                                    {data.socials.map((s, i) => (
                                        <a
                                            key={i}
                                            href={s.href}
                                            target={s.target}
                                            rel={s.rel}
                                            aria-label={s.platform}
                                            onClick={(e) => isPreview() && e.preventDefault()}
                                            style={linkStyle}
                                        >
                                            <AppIcon
                                                name={
                                                    s.platform === 'github'   ? 'Github' :
                                                    s.platform === 'twitter'  ? 'Twitter' :
                                                    s.platform === 'linkedin' ? 'Linkedin' : 'Link'
                                                }
                                                className="w-5 h-5"
                                            />
                                        </a>
                                    ))}
                                </div>
                            ) : null}
                            {showThemeSwitcher && onToggleTheme ? (
                                <ThemeSwitcher isDark={!!isDark} onToggle={onToggleTheme} />
                            ) : null}
                        </div>
                    </div>
                </div>
            </footer>
        </SectionFrame>
    );
}

// Text-only EN / NL locale toggle (flags are banned — language names as
// text is the international register). Navigates with ?locale= which
// RootPathGate reads and persists; a full navigation is correct here
// because the whole content payload is locale-resolved server-side.
function FooterLocaleToggle() {
    const current = (() => {
        try {
            const p = new URLSearchParams(window.location.search).get('locale');
            const v = (p || window.localStorage.getItem('beeflow_locale') || navigator.language || 'en');
            return v.toLowerCase().split('-')[0] === 'nl' ? 'nl' : 'en';
        } catch { return 'en'; }
    })();
    const go = (loc) => (e) => {
        e.preventDefault();
        if (isPreview() || loc === current) return;
        const url = new URL(window.location.href);
        url.searchParams.set('locale', loc);
        window.location.assign(url.toString());
    };
    const cls = (loc) => (loc === current
        ? { fontWeight: 600, color: 'var(--text-primary)' }
        : { color: 'var(--text-muted)' });
    return (
        <span className="footer-locale-toggle" style={{ display: 'inline-flex', gap: 6, fontSize: '0.85rem' }}>
            <a href="?locale=en" onClick={go('en')} style={cls('en')} aria-current={current === 'en' ? 'true' : undefined}>EN</a>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <a href="?locale=nl" onClick={go('nl')} style={cls('nl')} aria-current={current === 'nl' ? 'true' : undefined}>NL</a>
        </span>
    );
}

// Single-button day/night toggle. The icon shows the CURRENT mode; clicking
// flips to the other. No system option — keep the affordance to one button.
function ThemeSwitcher({ isDark, onToggle }) {
    const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    return (
        <button
            type="button"
            className="cms-theme-toggle"
            aria-label={label}
            title={label}
            onClick={onToggle}
        >
            <AppIcon name={isDark ? 'Moon' : 'Sun'} className="w-4 h-4" />
        </button>
    );
}

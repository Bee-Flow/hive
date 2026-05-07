import React from 'react';
import AppIcon from '../../components/AppIcon';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';

const isPreview = () =>
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('preview');

export default function Footer({ data, isDark, onToggleTheme }) {
    if (!data?.enabled) return null;
    const showThemeSwitcher = !!data.themeSwitcher?.enabled;
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
                                        <span className="logo-dot">.</span>
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
                    <div className="footer-bottom">
                        <EditableText path="footer.copyright" placeholder="© Company">
                            {data.copyright || ''}
                        </EditableText>
                        <div className="footer-bottom-right">
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

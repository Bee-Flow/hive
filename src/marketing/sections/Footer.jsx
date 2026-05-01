import React from 'react';
import AppIcon from '../../components/AppIcon';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';

const isPreview = () =>
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('preview');

export default function Footer({ data }) {
    if (!data?.enabled) return null;
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
                                            <a href={link.href} onClick={(e) => isPreview() && e.preventDefault()}>
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
                        {data.socials?.length ? (
                            <div className="footer-socials">
                                {data.socials.map((s, i) => (
                                    <a
                                        key={i}
                                        href={s.href}
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
                    </div>
                </div>
            </footer>
        </SectionFrame>
    );
}

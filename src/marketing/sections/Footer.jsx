import React from 'react';
import AppIcon from '../../components/AppIcon';

export default function Footer({ data }) {
    if (!data?.enabled) return null;
    return (
        <footer className="site-footer">
            <div className="container">
                <div className="footer-grid">
                    <div className="footer-brand">
                        {data.brand?.logoText ? (
                            <div className="header-logo" style={{ marginBottom: 12 }}>
                                <span>{data.brand.logoText}<span className="logo-dot">.</span></span>
                            </div>
                        ) : null}
                        {data.brand?.blurb ? <p>{data.brand.blurb}</p> : null}
                    </div>
                    {(data.columns || []).map((col, i) => (
                        <div key={i} className="footer-col">
                            <h4>{col.heading}</h4>
                            <ul>
                                {(col.links || []).map((link, j) => (
                                    <li key={j}><a href={link.href}>{link.label}</a></li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
                <div className="footer-bottom">
                    <span>{data.copyright}</span>
                    {data.socials?.length ? (
                        <div className="footer-socials">
                            {data.socials.map((s, i) => (
                                <a key={i} href={s.href} aria-label={s.platform}>
                                    <AppIcon name={s.platform === 'github' ? 'Github' : s.platform === 'twitter' ? 'Twitter' : s.platform === 'linkedin' ? 'Linkedin' : 'Link'} className="w-5 h-5" />
                                </a>
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>
        </footer>
    );
}

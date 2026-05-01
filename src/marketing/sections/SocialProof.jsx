import React from 'react';

export default function SocialProof({ data }) {
    if (!data?.enabled) return null;
    const logos = data.logos || [];
    return (
        <section className="social-proof">
            <div className="container">
                {data.eyebrow ? <div className="social-proof-eyebrow"><span className="label">{data.eyebrow}</span></div> : null}
                <div className="social-proof-logos">
                    {logos.map((logo, i) => logo.src ? (
                        <img key={i} src={logo.src} alt={logo.alt || ''} />
                    ) : (
                        <div key={i} className="logo-placeholder">{logo.alt || `Logo ${i + 1}`}</div>
                    ))}
                </div>
            </div>
        </section>
    );
}

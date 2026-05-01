import React from 'react';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';

export default function SocialProof({ data }) {
    if (!data?.enabled) return null;
    const logos = data.logos || [];
    return (
        <SectionFrame id="socialProof" name="Social proof" enabled={data.enabled}>
            <section className="social-proof">
                <div className="container">
                    <div className="social-proof-eyebrow">
                        <EditableText path="socialProof.eyebrow" placeholder="Eyebrow" className="label">
                            {data.eyebrow || ''}
                        </EditableText>
                    </div>
                    <div className="social-proof-logos">
                        {logos.map((logo, i) => logo.src ? (
                            <img key={i} src={logo.src} alt={logo.alt || ''} />
                        ) : (
                            <EditableText
                                key={i}
                                as="div"
                                path={`socialProof.logos.${i}.alt`}
                                placeholder={`Logo ${i + 1}`}
                                className="logo-placeholder"
                            >
                                {logo.alt || `Logo ${i + 1}`}
                            </EditableText>
                        ))}
                    </div>
                </div>
            </section>
        </SectionFrame>
    );
}

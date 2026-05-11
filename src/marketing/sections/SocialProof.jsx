import React from 'react';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';
import { inlineTextStyle } from './textStyle';

const isEditable = () =>
    typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).has('preview');

export default function SocialProof({ data }) {
    if (!data?.enabled) return null;
    const logos        = data.logos || [];
    const eyebrowStyle = inlineTextStyle(data.eyebrowStyle);
    const titleStyle   = inlineTextStyle(data.titleStyle);
    const showTitle    = !!(data.title || isEditable());
    const showEyebrow  = !!(data.eyebrow || isEditable());

    return (
        <SectionFrame id="socialProof" name="Social proof" enabled={data.enabled}>
            <section className="social-proof">
                <div className="container">
                    {showEyebrow ? (
                        <div className="social-proof-eyebrow">
                            <EditableText
                                path="socialProof.eyebrow"
                                placeholder="Eyebrow"
                                className="label"
                                style={eyebrowStyle}
                            >
                                {data.eyebrow || ''}
                            </EditableText>
                        </div>
                    ) : null}
                    {showTitle ? (
                        <div className="social-proof-title">
                            <EditableText
                                as="h2"
                                path="socialProof.title"
                                placeholder="Title (optional)"
                                style={titleStyle}
                            >
                                {data.title || ''}
                            </EditableText>
                        </div>
                    ) : null}
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

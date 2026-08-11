import React from 'react';
import EditableText from '../components/EditableText';
import FramedMedia from '../components/FramedMedia';
import SectionFrame from '../components/SectionFrame';
import SectionHeader from '../components/SectionHeader';
import { resolveAssetUrl } from '../assetUrl';
import { sectionBgClass } from './sectionBg';

// 28px round avatar — photo when avatarSrc is set, otherwise the person's
// initial in an accent-tinted chip so the attribution row never collapses.
function Avatar({ item }) {
    const src = typeof item.avatarSrc === 'string' ? item.avatarSrc.trim() : '';
    if (src) {
        return <img className="testimonial-avatar" src={resolveAssetUrl(src)} alt="" loading="lazy" />;
    }
    const initial = (item.name || '').trim().charAt(0).toUpperCase();
    return (
        <span className="testimonial-avatar testimonial-avatar--initial" aria-hidden="true">
            {initial || '·'}
        </span>
    );
}

// Name / role / company attribution — quantified-proof register (never star
// ratings). Shared by all three variants so EditableText paths stay
// byte-identical when the layout switches.
function Attribution({ item, i, withAvatar = true }) {
    const logoSrc = typeof item.logoSrc === 'string' ? item.logoSrc.trim() : '';
    return (
        <div className="testimonial-attrib">
            {withAvatar ? <Avatar item={item} /> : null}
            <div className="testimonial-attrib-text">
                <EditableText
                    as="span"
                    path={`testimonials.items.${i}.name`}
                    placeholder="Name"
                    className="testimonial-attrib-name"
                >
                    {item.name || ''}
                </EditableText>
                <span className="testimonial-attrib-meta">
                    <EditableText path={`testimonials.items.${i}.role`} placeholder="Role">
                        {item.role || ''}
                    </EditableText>
                    {', '}
                    <EditableText path={`testimonials.items.${i}.company`} placeholder="Company">
                        {item.company || ''}
                    </EditableText>
                </span>
            </div>
            {logoSrc ? (
                <img className="testimonial-logo" src={resolveAssetUrl(logoSrc)} alt="" loading="lazy" />
            ) : null}
        </div>
    );
}

export default function Testimonials({ data }) {
    if (!data?.enabled) return null;
    const items = data.items || [];
    // 'quotes' is the default/fallback (this type has no legacy layout):
    // 3-up hairline cards. 'case' leads each card with an oversized metric;
    // 'spotlight' renders ONE oversized 5/7 photo + quote split (first item).
    const variant = ['case', 'spotlight'].includes(data.variant) ? data.variant : 'quotes';
    const spotlightItem = variant === 'spotlight' ? items[0] : null;

    return (
        <SectionFrame id="testimonials" name="Testimonials" enabled={data.enabled}>
            <section id="testimonials" className={sectionBgClass(data)}>
                <div className="container">
                    <SectionHeader
                        pathPrefix="testimonials"
                        eyebrow={data.eyebrow} title={data.title}
                        eyebrowStyle={data.eyebrowStyle} titleStyle={data.titleStyle}
                        eyebrowAlign={data.eyebrowAlign} titleAlign={data.titleAlign} align={data.align}
                    />
                    {variant === 'spotlight' && spotlightItem ? (
                        <div className="testimonial-spotlight reveal">
                            <div className="testimonial-spotlight-media">
                                <FramedMedia
                                    media={{
                                        src: spotlightItem.avatarSrc || '',
                                        alt: spotlightItem.name || '',
                                        frame: 'none',
                                        kind: 'image',
                                    }}
                                    glow={false}
                                />
                            </div>
                            <div className="testimonial-spotlight-body">
                                <blockquote className="testimonial-spotlight-quote">
                                    <EditableText
                                        as="p"
                                        path="testimonials.items.0.quote"
                                        multiline
                                        placeholder="Quote"
                                    >
                                        {spotlightItem.quote || ''}
                                    </EditableText>
                                </blockquote>
                                <Attribution item={spotlightItem} i={0} withAvatar={false} />
                            </div>
                        </div>
                    ) : (
                        <div className={`testimonials-grid${variant === 'case' ? ' testimonials-grid--case' : ''}`}>
                            {items.map((item, i) => (
                                <figure
                                    key={i}
                                    className={`testimonial-card reveal reveal-delay-${Math.min(i + 1, 6)}`}
                                >
                                    {variant === 'case' ? (
                                        <div className="testimonial-metric-head">
                                            <EditableText
                                                as="span"
                                                path={`testimonials.items.${i}.metric.number`}
                                                placeholder="2.4×"
                                                className="testimonial-metric tnum"
                                            >
                                                {item.metric?.number || ''}
                                            </EditableText>
                                            <EditableText
                                                as="span"
                                                path={`testimonials.items.${i}.metric.label`}
                                                placeholder="Metric label"
                                                className="testimonial-metric-label eyebrow-mono"
                                            >
                                                {item.metric?.label || ''}
                                            </EditableText>
                                        </div>
                                    ) : null}
                                    <blockquote className="testimonial-quote">
                                        <EditableText
                                            as="p"
                                            path={`testimonials.items.${i}.quote`}
                                            multiline
                                            placeholder="Quote"
                                        >
                                            {item.quote || ''}
                                        </EditableText>
                                    </blockquote>
                                    <figcaption>
                                        <Attribution item={item} i={i} />
                                    </figcaption>
                                </figure>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </SectionFrame>
    );
}

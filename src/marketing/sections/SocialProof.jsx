import React, { useLayoutEffect, useRef, useState } from 'react';
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
    const titleStyle   = inlineTextStyle(data.titleStyle, data.titleAlign || data.align);
    // The eyebrow renders as an inline <span>, so its own text-align is
    // inert — alignment is applied to its block wrapper instead.
    const eyebrowAlign = data.eyebrowAlign || data.align || null;
    const showTitle    = !!(data.title || isEditable());
    const showEyebrow  = !!(data.eyebrow || isEditable());
    // Grayscale + sepia tint amount (0–80). Used as a CSS variable on
    // the strip so the filter rule reads it without rebuilding styles.
    const tint = Number.isFinite(data.logoTint) ? data.logoTint : 0;

    // 'numbers' variant: a hard-numbers row (stars, users, uptime — the
    // OSS trust stack) renders above the logo wall. Absent/unknown ⇒
    // classic wall only.
    const variant = data.variant === 'numbers' ? 'numbers' : 'classic';
    const stats = Array.isArray(data.stats) ? data.stats : [];
    const showStats = variant === 'numbers' && (stats.length > 0 || isEditable());

    return (
        <SectionFrame id="socialProof" name="Social proof" enabled={data.enabled}>
            <section className="social-proof">
                <div className="container">
                    {showStats ? (
                        <div className="social-proof-stats reveal">
                            {stats.map((s, i) => (
                                <div key={i} className="social-proof-stat">
                                    <EditableText
                                        as="div"
                                        path={`socialProof.stats.${i}.number`}
                                        placeholder="4.7★"
                                        className="social-proof-stat-number tnum"
                                    >
                                        {s.number || ''}
                                    </EditableText>
                                    <EditableText
                                        as="div"
                                        path={`socialProof.stats.${i}.label`}
                                        placeholder="G2 rating"
                                        className="social-proof-stat-label"
                                    >
                                        {s.label || ''}
                                    </EditableText>
                                </div>
                            ))}
                        </div>
                    ) : null}
                    {showEyebrow ? (
                        <div
                            className="social-proof-eyebrow"
                            style={eyebrowAlign ? { textAlign: eyebrowAlign } : undefined}
                        >
                            <EditableText
                                path="socialProof.eyebrow"
                                multiline
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
                                multiline
                                placeholder="Title (optional)"
                                style={titleStyle}
                            >
                                {data.title || ''}
                            </EditableText>
                        </div>
                    ) : null}
                    <SocialProofLogos logos={logos} tint={tint} />
                </div>
            </section>
        </SectionFrame>
    );
}

// Single-line logo strip.
//
// The strip always renders the original set of logos. A duplicate copy
// is rendered conditionally — only when the natural width of the
// originals exceeds the viewport width — and is aria-hidden. When the
// duplicate is present the strip animates the -50% translate for a
// seamless loop; otherwise the logos sit centered with no animation.
function SocialProofLogos({ logos, tint }) {
    const viewportRef  = useRef(null);
    const originalsRef = useRef(null);
    const [isScrolling, setIsScrolling] = useState(false);

    // Measure on layout, then keep checking on resize. We compare the
    // originals' offsetWidth (one full set of logos, gap-included) to
    // the viewport's offsetWidth. If the originals don't fit, we need
    // the marquee + duplicate; otherwise we center statically.
    useLayoutEffect(() => {
        const measure = () => {
            const v = viewportRef.current;
            const o = originalsRef.current;
            if (!v || !o) return;
            setIsScrolling(o.offsetWidth > v.offsetWidth);
        };
        measure();
        if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(measure);
        if (viewportRef.current) ro.observe(viewportRef.current);
        if (originalsRef.current) ro.observe(originalsRef.current);
        // Also react to images finishing decoding — until then the
        // originals' width is the placeholder size, not the final size.
        const imgs = originalsRef.current?.querySelectorAll('img') || [];
        imgs.forEach(img => {
            if (!img.complete) img.addEventListener('load', measure, { once: true });
        });
        return () => ro.disconnect();
    }, [logos]);

    const renderLogo = (logo, i, fromDuplicate = false) => {
        const keyPrefix = fromDuplicate ? `dup-${i}` : `orig-${i}`;
        if (logo.src) {
            return (
                <img
                    key={keyPrefix}
                    src={logo.src}
                    alt={fromDuplicate ? '' : (logo.alt || '')}
                    aria-hidden={fromDuplicate ? 'true' : undefined}
                />
            );
        }
        // Placeholder rendering — the duplicate drops EditableText so
        // it doesn't double-bind to the same storage path.
        if (fromDuplicate) {
            return (
                <div key={keyPrefix} className="logo-placeholder" aria-hidden="true">
                    {logo.alt || `Logo ${i + 1}`}
                </div>
            );
        }
        return (
            <EditableText
                key={keyPrefix}
                as="div"
                path={`socialProof.logos.${i}.alt`}
                placeholder={`Logo ${i + 1}`}
                className="logo-placeholder"
            >
                {logo.alt || `Logo ${i + 1}`}
            </EditableText>
        );
    };

    // The CSS variable drives the sepia() component of the filter chain
    // declared in marketing.css. Renderer never builds the filter string.
    const viewportStyle = { '--logo-tint': `${Math.max(0, Math.min(80, tint))}%` };

    return (
        <div
            ref={viewportRef}
            className={'social-proof-logos' + (isScrolling ? ' is-scrolling' : '')}
            style={viewportStyle}
        >
            <div className="social-proof-logos-track">
                <div ref={originalsRef} className="social-proof-logos-half">
                    {logos.map((logo, i) => renderLogo(logo, i, false))}
                </div>
                {isScrolling ? (
                    <div className="social-proof-logos-half" aria-hidden="true">
                        {logos.map((logo, i) => renderLogo(logo, i, true))}
                    </div>
                ) : null}
            </div>
        </div>
    );
}


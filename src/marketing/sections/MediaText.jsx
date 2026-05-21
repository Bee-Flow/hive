import React from 'react';
import Button from '../components/Button';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';
import { inlineTextStyle } from './textStyle';

/**
 * Media + Text section. Side-by-side layout pairing an image OR video
 * with copy. Three layout knobs:
 *   mediaPosition  — 'left' | 'right'
 *   mediaSize      — 'half' | 'third' | 'two-thirds'  (proportion of media column)
 *   backgroundVariant — 'default' | 'surface' | 'primary' | 'dark'
 *
 * Inline-editable: heading, subheading, body, cta.label.
 * Panel-only:      media (kind/src/alt), CTA destination, all three knobs.
 *
 * On screens <768px the row collapses to a stacked column with media on
 * top regardless of mediaPosition (markup keeps media first in source).
 *
 * EditableText paths use the block type as root:
 *   media-text.heading
 *   media-text.subheading
 *   media-text.body
 *   media-text.cta.label
 */
export default function MediaText({ data }) {
    if (!data?.enabled) return null;

    const heading           = data.heading || '';
    const subheading        = data.subheading;             // null = hidden
    const body              = data.body || '';
    const cta               = data.cta;                    // null = hidden
    const media             = data.media || { kind: 'image', src: '', alt: '' };
    const mediaPosition     = data.mediaPosition     || 'left';
    const mediaSize         = data.mediaSize         || 'half';
    const backgroundVariant = data.backgroundVariant || 'default';

    // legacyifyLinks (admin preview) flattens cta.link → cta.href; the
    // public path leaves cta.link.href. Read both so we work in both.
    const ctaHref = cta?.href || cta?.link?.href || '#';
    // Per-text inline overrides — empty = inherit CSS / Design tab. The
    // second arg is the field's own `{field}Align` (text-align applied
    // straight on the element, independent of the side-by-side layout).
    const headingStyle    = inlineTextStyle(data.headingStyle,    data.headingAlign);
    const subheadingStyle = inlineTextStyle(data.subheadingStyle, data.subheadingAlign);
    const bodyStyle       = inlineTextStyle(data.bodyStyle,       data.bodyAlign);
    const ctaStyle        = inlineTextStyle(data.ctaStyle);

    const sectionClass = [
        'media-text-block',
        backgroundVariant !== 'default' ? `cms-bg--${backgroundVariant}` : '',
    ].filter(Boolean).join(' ');

    const innerClass = [
        'media-text-block-inner',
        `media-text-block-inner--position-${mediaPosition}`,
        `media-text-block-inner--size-${mediaSize}`,
    ].join(' ');

    return (
        <SectionFrame id="media-text" name="Media + Text" enabled={data.enabled}>
            <section className={sectionClass}>
                <div className="container">
                    <div className={innerClass}>
                        <div className="media-text-block-media">
                            {renderMedia(media, heading)}
                        </div>

                        <div className="media-text-block-text">
                            <EditableText
                                path="media-text.heading"
                                as="h2"
                                multiline
                                placeholder="Heading"
                                className="headline-md media-text-block-heading"
                                style={headingStyle}
                            >
                                {heading}
                            </EditableText>

                            {subheading != null ? (
                                <EditableText
                                    path="media-text.subheading"
                                    as="p"
                                    multiline
                                    placeholder="Subheading"
                                    className="media-text-block-subheading"
                                    style={subheadingStyle}
                                >
                                    {subheading}
                                </EditableText>
                            ) : null}

                            <EditableText
                                path="media-text.body"
                                as="p"
                                multiline
                                placeholder="Body text"
                                className="media-text-block-body"
                                style={bodyStyle}
                            >
                                {body}
                            </EditableText>

                            {cta ? (
                                <div className="media-text-block-cta">
                                    <Button variant={cta.style || 'primary'} href={ctaHref}>
                                        <EditableText
                                            path="media-text.cta.label"
                                            placeholder="Button label"
                                            style={ctaStyle}
                                        >
                                            {cta.label || ''}
                                        </EditableText>
                                    </Button>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            </section>
        </SectionFrame>
    );
}

// Pick the right element for the user's chosen media kind. GIFs animate
// natively inside <img>; video-silent uses an autoplay/muted/loop <video>
// — same affordance sim.ai uses for short demo loops, lightweight and
// without controls. `kind: 'video'` still routes to an iframe embed for
// YouTube/Vimeo URLs. Falls back to <img> for legacy data with no kind
// or unknown values.
function renderMedia(media, heading) {
    const src = media?.src || '';
    const alt = media?.alt || '';
    const kind = media?.kind || 'image';

    if (kind === 'video') {
        if (!src) {
            return (
                <div className="media-text-block-media-placeholder">
                    <span>Add a video embed URL in the panel</span>
                </div>
            );
        }
        return (
            <div className="media-text-block-video">
                <iframe
                    src={src}
                    title={heading || 'Embedded video'}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                />
            </div>
        );
    }

    if (kind === 'video-silent') {
        if (!src) {
            return (
                <div className="media-text-block-media-placeholder">
                    <span>Upload a video (no audio) in the panel</span>
                </div>
            );
        }
        // playsInline is REQUIRED for iOS Safari autoplay; muted is what
        // browsers actually gate autoplay on (audio policy).
        return (
            <video
                src={src}
                autoPlay
                loop
                muted
                playsInline
                aria-label={alt || undefined}
            />
        );
    }

    // 'image', 'gif', or anything legacy/unknown — all render as <img>.
    // GIFs and animated WebPs animate inside <img> with no extra work.
    if (!src) {
        return (
            <div className="media-text-block-media-placeholder">
                <span>Add an image in the panel</span>
            </div>
        );
    }
    return <img src={src} alt={alt} />;
}

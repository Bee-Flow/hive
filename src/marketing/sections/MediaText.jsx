import React from 'react';
import Button from '../components/Button';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';

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
                            {media.kind === 'video' ? (
                                media.src ? (
                                    <div className="media-text-block-video">
                                        <iframe
                                            src={media.src}
                                            title={heading || 'Embedded video'}
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                        />
                                    </div>
                                ) : (
                                    <div className="media-text-block-media-placeholder">
                                        <span>Add a video embed URL in the panel</span>
                                    </div>
                                )
                            ) : (
                                media.src ? (
                                    <img src={media.src} alt={media.alt || ''} />
                                ) : (
                                    <div className="media-text-block-media-placeholder">
                                        <span>Add an image in the panel</span>
                                    </div>
                                )
                            )}
                        </div>

                        <div className="media-text-block-text">
                            <EditableText
                                path="media-text.heading"
                                as="h2"
                                placeholder="Heading"
                                className="headline-md media-text-block-heading"
                            >
                                {heading}
                            </EditableText>

                            {subheading != null ? (
                                <EditableText
                                    path="media-text.subheading"
                                    as="p"
                                    placeholder="Subheading"
                                    className="media-text-block-subheading"
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
                            >
                                {body}
                            </EditableText>

                            {cta ? (
                                <div className="media-text-block-cta">
                                    <Button variant="primary" href={ctaHref}>
                                        <EditableText
                                            path="media-text.cta.label"
                                            placeholder="Button label"
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

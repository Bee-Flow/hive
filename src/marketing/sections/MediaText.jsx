import React from 'react';
import Button from '../components/Button';
import EditableText from '../components/EditableText';
import FramedMedia from '../components/FramedMedia';
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

    // A block with no image renders TEXT-ONLY on the published site.
    //
    // Every branch of renderMedia() draws something — a framed skeleton or an
    // "Add an image in the panel" box — so an author who writes a Media+Text
    // without art was publishing a placeholder to the public internet with no
    // warning. Features and Steps already guard on `src`; this brings
    // Media+Text in line.
    //
    // The editor keeps the placeholder: that is where it belongs, because it
    // is the affordance telling you an image can go here.
    const hasMedia = typeof media?.src === 'string' && media.src.trim() !== '';
    const showMedia = hasMedia || isEditable();

    const innerClass = [
        'media-text-block-inner',
        `media-text-block-inner--position-${mediaPosition}`,
        `media-text-block-inner--size-${mediaSize}`,
        showMedia ? '' : 'media-text-block-inner--no-media',
    ].filter(Boolean).join(' ');

    return (
        <SectionFrame id="media-text" name="Media + Text" enabled={data.enabled}>
            <section className={sectionClass}>
                <div className="container">
                    <div className={innerClass}>
                        {showMedia ? (
                            <div className="media-text-block-media">
                                {renderMedia(media, heading)}
                            </div>
                        ) : null}

                        <div className="media-text-block-text">
                            {/* Same rule as the media column: the published
                                site never renders an empty <h2> (a nameless
                                heading in the outline); the editor keeps the
                                placeholder as the affordance. */}
                            {(heading || isEditable()) ? (
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
                            ) : null}

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

    // Opt-in premium frame: when `frame` is 'hairline' or 'browser' the
    // image renders through FramedMedia (hairline border + radius + glow,
    // light/dark pair via srcDark, skeleton when src is empty). Absent /
    // '' / 'none' keeps the legacy bare <img> so stored pages render
    // byte-identically.
    const frame = media?.frame;
    if (frame === 'hairline' || frame === 'browser') {
        return <FramedMedia media={{ ...media, kind: 'image' }} />;
    }
    if (!src) {
        return (
            <div className="media-text-block-media-placeholder">
                <span>Add an image in the panel</span>
            </div>
        );
    }
    // Unframed legacy path: same dimension attributes as FramedMedia, plus
    // lazy loading it never had — this element sits mid-page, never above
    // the fold.
    const dims = media?.width > 0 && media?.height > 0
        ? { width: Math.round(media.width), height: Math.round(media.height) }
        : {};
    return <img src={src} alt={alt} {...dims} loading="lazy" />;
}

/**
 * True inside the CMS editor's preview iframe (?preview), where placeholders
 * are an affordance rather than a defect. Same one-liner the Content section
 * uses — kept local so a marketing section never imports admin code.
 */
function isEditable() {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has('preview');
}

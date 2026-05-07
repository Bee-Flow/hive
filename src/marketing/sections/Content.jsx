import React from 'react';
import Button from '../components/Button';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';

/**
 * Generic flexible content section. Three layout knobs (imagePosition,
 * textAlign, backgroundVariant) plus three optional fields (subheading,
 * image, cta) make this the "starting point" block — most one-off
 * sections users build will be a Content with the right knobs set.
 *
 * Inline-editable: heading, subheading, body, cta.label.
 * Panel-only:      image (src + alt), cta destination, all three knobs.
 *
 * Path notes for inline edits (consumed by applyIframeEdit in the panel):
 *   content.heading
 *   content.subheading
 *   content.body
 *   content.cta.label
 */
export default function Content({ data }) {
    if (!data?.enabled) return null;

    const heading           = data.heading || '';
    const subheading        = data.subheading;            // null when toggled off
    const body              = data.body || '';
    const image             = data.image;                 // null when toggled off
    const cta               = data.cta;                   // null when toggled off
    const imagePosition     = data.imagePosition     || 'below';
    const textAlign         = data.textAlign         || 'left';
    const backgroundVariant = data.backgroundVariant || 'default';

    // legacyifyLinks (admin preview path) flattens cta.link → cta.href as a
    // string. resolveLinksInTree (public site path) leaves it as
    // cta.link.href. Read both so the same component works on both paths.
    const ctaHref = cta?.href || cta?.link?.href || '#';

    const sectionClass = [
        'content-block',
        `content-block--bg-${backgroundVariant}`,
        `content-block--align-${textAlign}`,
    ].join(' ');

    const innerClass = [
        'content-block-inner',
        `content-block-inner--image-${imagePosition}`,
    ].join(' ');

    return (
        <SectionFrame id="content" name="Content" enabled={data.enabled}>
            <section className={sectionClass}>
                <div className="container">
                    <div className={innerClass}>
                        {image ? (
                            <div className="content-block-image">
                                {image.src ? (
                                    <img src={image.src} alt={image.alt || ''} />
                                ) : (
                                    <div className="content-block-image-placeholder">
                                        <span>Add an image URL in the panel</span>
                                    </div>
                                )}
                            </div>
                        ) : null}

                        <div className="content-block-text">
                            <EditableText
                                path="content.heading"
                                as="h2"
                                placeholder="Heading"
                                className="headline-md content-block-heading"
                            >
                                {heading}
                            </EditableText>

                            {subheading != null ? (
                                <EditableText
                                    path="content.subheading"
                                    as="p"
                                    placeholder="Subheading"
                                    className="content-block-subheading"
                                >
                                    {subheading}
                                </EditableText>
                            ) : null}

                            <EditableText
                                path="content.body"
                                as="p"
                                multiline
                                placeholder="Body text"
                                className="content-block-body"
                            >
                                {body}
                            </EditableText>

                            {cta ? (
                                <div className="content-block-cta">
                                    <Button variant="primary" href={ctaHref}>
                                        <EditableText
                                            path="content.cta.label"
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

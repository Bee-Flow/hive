import React from 'react';
import Button from '../components/Button';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';

/**
 * CTA Banner — louder Conversion section. Two layouts (centered vs split),
 * always-rendered primary CTA, optional secondary CTA, four background
 * variants (default / surface / primary / dark).
 *
 * Inline-editable: heading, subheading.
 * Panel-only:      CTA labels (TextField) + destinations (LinkField), all
 *                  three layout knobs.
 *
 * Path roots for inline edits:
 *   cta-banner.heading
 *   cta-banner.subheading
 */
export default function CtaBanner({ data }) {
    if (!data?.enabled) return null;

    const heading           = data.heading    || '';
    const subheading        = data.subheading || '';
    const layout            = data.layout            || 'centered';
    const backgroundVariant = data.backgroundVariant || 'primary';
    const primary           = data.primaryCta   || null;
    const secondary         = data.secondaryCta;

    // legacyifyLinks (admin preview) flattens cta.link → cta.href.
    // resolveLinksInTree (public path) leaves cta.link.href. Read both.
    const primaryHref   = primary?.href   || primary?.link?.href   || '#';
    const secondaryHref = secondary?.href || secondary?.link?.href || '#';

    const sectionClass = [
        'cta-banner-block',
        backgroundVariant !== 'default' ? `cms-bg--${backgroundVariant}` : '',
    ].filter(Boolean).join(' ');

    const innerClass = [
        'cta-banner-block-inner',
        `cta-banner-block-inner--layout-${layout}`,
    ].join(' ');

    return (
        <SectionFrame id="cta-banner" name="CTA Banner" enabled={data.enabled}>
            <section className={sectionClass}>
                <div className="container">
                    <div className={innerClass}>
                        <div className="cta-banner-block-text">
                            <EditableText
                                path="cta-banner.heading"
                                as="h2"
                                placeholder="Heading"
                                className="headline-md cta-banner-block-heading"
                            >
                                {heading}
                            </EditableText>

                            <EditableText
                                path="cta-banner.subheading"
                                as="p"
                                multiline
                                placeholder="Subheading"
                                className="cta-banner-block-subheading"
                            >
                                {subheading}
                            </EditableText>
                        </div>

                        <div className="cta-banner-block-actions">
                            {primary ? (
                                <Button variant="primary" href={primaryHref}>
                                    {primary.label || 'Get started'}
                                </Button>
                            ) : null}
                            {secondary ? (
                                <Button variant="secondary" href={secondaryHref}>
                                    {secondary.label || 'Learn more'}
                                </Button>
                            ) : null}
                        </div>
                    </div>
                </div>
            </section>
        </SectionFrame>
    );
}

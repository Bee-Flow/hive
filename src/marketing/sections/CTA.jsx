import React from 'react';
import Button from '../components/Button';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';
import { sectionBgClass } from './sectionBg';
import { inlineTextStyle } from './textStyle';

// True inside the CMS editor's preview iframe (?preview) — empty fields keep
// their clickable placeholder there, but never on the published site.
const isEditable = () =>
    typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).has('preview');

export default function CTA({ data }) {
    if (!data?.enabled) return null;
    // Page-closing band: the hex-motif echo (accent line-art at whisper
    // opacity) is on by default but suppressible; an optional ghost
    // secondary CTA joins the filled primary (never two filled buttons).
    const showMotif = data.showMotif !== false;
    const secondary = data.secondaryCta;
    const sectionClass = [
        'cta-section',
        showMotif ? 'cms-motif-hex' : '',
        sectionBgClass(data),
    ].filter(Boolean).join(' ');
    return (
        <SectionFrame id="cta" name="Call to action" enabled={data.enabled}>
            <section className={sectionClass}>
                <div className="container">
                    <div className="cta-content reveal">
                        {/* Published site: an empty title/lead renders nothing —
                            an empty <h2> is a nameless entry in the heading
                            outline. The editor keeps both as placeholders. */}
                        {(data.title || isEditable()) ? (
                            <EditableText
                                as="h2"
                                path="cta.title"
                                multiline
                                placeholder="CTA title"
                                className="headline-lg"
                                style={inlineTextStyle(undefined, data.titleAlign || data.align)}
                            >
                                {data.title || ''}
                            </EditableText>
                        ) : null}
                        {(data.lead || isEditable()) ? (
                            <EditableText
                                as="p"
                                path="cta.lead"
                                multiline
                                placeholder="CTA lead"
                                className="body-lg"
                                style={inlineTextStyle(undefined, data.leadAlign || data.align)}
                            >
                                {data.lead || ''}
                            </EditableText>
                        ) : null}
                        <div className="cta-actions">
                            {data.button ? (
                                <Button variant="primary" href={data.button.href || '/app'}>
                                    <EditableText path="cta.button.label" placeholder="Button">
                                        {data.button.label || ''}
                                    </EditableText>
                                </Button>
                            ) : null}
                            {secondary && secondary.label !== undefined ? (
                                <Button variant="secondary" href={secondary.href || secondary.link?.href || '#'}>
                                    <EditableText path="cta.secondaryCta.label" placeholder="Secondary">
                                        {secondary.label || ''}
                                    </EditableText>
                                </Button>
                            ) : null}
                        </div>
                    </div>
                </div>
            </section>
        </SectionFrame>
    );
}

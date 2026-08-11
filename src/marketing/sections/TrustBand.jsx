import React from 'react';
import AppIcon from '../../components/AppIcon';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';
import { sectionBgClass } from './sectionBg';
import { inlineTextStyle } from './textStyle';

// True inside the CMS editor's preview iframe (?preview) — empty fields keep
// their clickable placeholder there, but never on the published site.
const isEditable = () =>
    typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).has('preview');

// One chip — monochrome institutional register (ink icon, mono-caps label).
// A chip with an href renders as an external link (new tab); the editable
// guard keeps inline editing from triggering navigation in the preview.
function Chip({ chip, i, detailed }) {
    const href = typeof chip.href === 'string' ? chip.href.trim() : '';
    const Tag = href ? 'a' : 'div';
    const linkProps = href
        ? {
            href,
            target: '_blank',
            rel: 'noopener noreferrer',
            onClick: (e) => {
                if (e.target.closest && e.target.closest('.cms-editable')) e.preventDefault();
            },
        }
        : {};
    const body = (
        <>
            {chip.icon ? <AppIcon name={chip.icon} className="trust-chip-icon" /> : null}
            <EditableText
                as="span"
                path={`trust-band.chips.${i}.label`}
                placeholder="Label"
                className="trust-chip-label"
            >
                {chip.label || ''}
            </EditableText>
        </>
    );
    return (
        <Tag className={`trust-chip reveal reveal-delay-${Math.min(i + 1, 6)}`} {...linkProps}>
            {detailed ? <span className="trust-chip-top">{body}</span> : body}
            {detailed ? (
                <EditableText
                    as="span"
                    path={`trust-band.chips.${i}.sublabel`}
                    multiline
                    placeholder="Sublabel"
                    className="trust-chip-sub"
                >
                    {chip.sublabel || ''}
                </EditableText>
            ) : null}
        </Tag>
    );
}

export default function TrustBand({ data }) {
    if (!data?.enabled) return null;
    const chips = data.chips || [];
    // 'chips' is the default/fallback (no legacy layout): a centered row of
    // monochrome chips, sublabels hidden. 'detailed' grows each chip into a
    // small card that shows its sublabel. Bright institutional by design —
    // dark treatments come from style.band, never baked in here.
    const detailed = data.variant === 'detailed';

    // The title is genuinely optional here ("Title (optional)"), so on the
    // published site an eyebrow-only band was shipping an empty <h2> — a
    // nameless heading in the document outline. Editor keeps both fields.
    const editing     = isEditable();
    const showEyebrow = !!(data.eyebrow || editing);
    const showTitle   = !!(data.title || editing);

    return (
        <SectionFrame id="trust-band" name="Trust band" enabled={data.enabled}>
            <section id="trust-band" className={`trust-band ${sectionBgClass(data)}`.trim()}>
                <div className="container">
                    {(showEyebrow || showTitle) ? (
                        <div className="trust-band-head reveal">
                            {showEyebrow ? (
                                <EditableText
                                    as="span"
                                    path="trust-band.eyebrow"
                                    multiline
                                    placeholder="Eyebrow"
                                    className="eyebrow-mono"
                                    style={inlineTextStyle(data.eyebrowStyle, data.eyebrowAlign || data.align)}
                                >
                                    {data.eyebrow || ''}
                                </EditableText>
                            ) : null}
                            {showTitle ? (
                                <EditableText
                                    as="h2"
                                    path="trust-band.title"
                                    multiline
                                    placeholder="Title (optional)"
                                    className="trust-band-title headline-lg"
                                    style={inlineTextStyle(data.titleStyle, data.titleAlign || data.align)}
                                >
                                    {data.title || ''}
                                </EditableText>
                            ) : null}
                        </div>
                    ) : null}
                    <div className={`trust-chips${detailed ? ' trust-chips--detailed' : ''}`}>
                        {chips.map((chip, i) => (
                            <Chip key={i} chip={chip} i={i} detailed={detailed} />
                        ))}
                    </div>
                </div>
            </section>
        </SectionFrame>
    );
}

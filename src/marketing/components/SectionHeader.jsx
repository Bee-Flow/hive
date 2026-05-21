import React from 'react';
import EditableText from './EditableText';
import { inlineTextStyle } from '../sections/textStyle';

/**
 * Section eyebrow + headline + lead. Pass a `pathPrefix` (e.g. "features")
 * and each piece becomes a click-to-edit text node in preview mode.
 *
 * Optional `eyebrowStyle` / `titleStyle` / `leadStyle` blobs come from the
 * editor's StyleTriplet — each holds `{ fontFamily?, fontSize?, color? }`.
 * Empty/missing values fall through to CSS / Design-tab defaults; the
 * `style` attribute is omitted entirely when nothing is set.
 */
export default function SectionHeader({
    pathPrefix,
    eyebrow,
    title,
    lead,
    eyebrowStyle,
    titleStyle,
    leadStyle,
    // Per-field alignment (`{field}Align` on the block data). `align` is
    // the block's legacy single value, used as the fallback so headers
    // that haven't been aligned per-field keep their current look.
    eyebrowAlign,
    titleAlign,
    leadAlign,
    align,
}) {
    const eyebrowCss = inlineTextStyle(eyebrowStyle, eyebrowAlign || align);
    const titleCss   = inlineTextStyle(titleStyle,   titleAlign   || align);
    const leadCss    = inlineTextStyle(leadStyle,    leadAlign    || align);
    return (
        <div className="section-header reveal">
            {(eyebrow || pathPrefix) ? (
                <EditableText
                    as="span"
                    path={`${pathPrefix}.eyebrow`}
                    multiline
                    placeholder="Eyebrow"
                    className="label"
                    style={eyebrowCss}
                >
                    {eyebrow || ''}
                </EditableText>
            ) : null}
            {(title || pathPrefix) ? (
                <EditableText
                    as="h2"
                    path={`${pathPrefix}.title`}
                    multiline
                    placeholder="Section title"
                    className="headline-lg"
                    style={titleCss}
                >
                    {title || ''}
                </EditableText>
            ) : null}
            {(lead || pathPrefix) ? (
                <EditableText
                    as="p"
                    path={`${pathPrefix}.lead`}
                    multiline
                    placeholder="Lead paragraph (optional)"
                    className="body-lg"
                    style={leadCss}
                >
                    {lead || ''}
                </EditableText>
            ) : null}
        </div>
    );
}

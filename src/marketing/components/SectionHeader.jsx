import React from 'react';
import EditableText from './EditableText';
import { inlineTextStyle } from '../sections/textStyle';

// True inside the CMS editor's preview iframe (?preview), where empty
// fields must keep rendering as clickable placeholders. Same one-liner the
// SocialProof section uses — local so this never imports admin code.
const isEditable = () =>
    typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).has('preview');

/**
 * Section eyebrow + headline + lead. Pass a `pathPrefix` (e.g. "features")
 * and each piece becomes a click-to-edit text node in preview mode.
 *
 * Published site: an empty field renders NOTHING — an empty <h2> is an
 * accessibility defect (a heading with no name in the document outline)
 * and empty eyebrow/lead elements leave phantom margins. In the editor
 * preview every field stays rendered so it remains findable/clickable —
 * the `showTitle = !!(title || isEditable())` pattern from SocialProof.
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
    // Editor keeps every field; the public site only gets the filled ones.
    // `pathPrefix` stays required either way — without it there is no
    // storage path, so there is nothing to edit AND nothing to render.
    const editing     = isEditable();
    const showEyebrow = !!(eyebrow || (pathPrefix && editing));
    const showTitle   = !!(title   || (pathPrefix && editing));
    const showLead    = !!(lead    || (pathPrefix && editing));
    // Nothing to show at all → no header. Otherwise the empty
    // .section-header div still spends its margin as a phantom gap.
    if (!showEyebrow && !showTitle && !showLead) return null;
    return (
        <div className="section-header reveal">
            {showEyebrow ? (
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
            {showTitle ? (
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
            {showLead ? (
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

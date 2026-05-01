import React from 'react';
import EditableText from './EditableText';

/**
 * Section eyebrow + headline + lead. Pass a `pathPrefix` (e.g. "features")
 * and each piece becomes a click-to-edit text node in preview mode.
 */
export default function SectionHeader({ pathPrefix, eyebrow, title, lead }) {
    return (
        <div className="section-header reveal">
            {(eyebrow || pathPrefix) ? (
                <EditableText
                    as="span"
                    path={`${pathPrefix}.eyebrow`}
                    placeholder="Eyebrow"
                    className="label"
                >
                    {eyebrow || ''}
                </EditableText>
            ) : null}
            {(title || pathPrefix) ? (
                <EditableText
                    as="h2"
                    path={`${pathPrefix}.title`}
                    placeholder="Section title"
                    className="headline-lg"
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
                >
                    {lead || ''}
                </EditableText>
            ) : null}
        </div>
    );
}

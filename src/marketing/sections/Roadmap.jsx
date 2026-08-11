import React from 'react';
import SectionHeader from '../components/SectionHeader';
import AppIcon from '../../components/AppIcon';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';
import { sectionBgClass } from './sectionBg';
import { inlineTextStyle } from './textStyle';

/**
 * Public roadmap — items grouped into status buckets.
 *
 * TWO RULES, both load-bearing:
 *
 * 1. The grouping is DERIVED here, every render. `data.items` stays in
 *    whatever order the editor typed it. Locale overrides address array
 *    items by numeric index, so persisting a sort would drag every Dutch
 *    translation onto a different item (translatable.js:234-252 only warns
 *    about this — it cannot fix it).
 *
 * 2. An item whose `status` is missing or unrecognised is NOT dropped. It
 *    falls into the last bucket. Silently vanishing from a public page is
 *    the worst possible failure for a roadmap, and it is exactly what a
 *    translated status value or a typo would otherwise cause.
 */

// The vocabulary, in display order. Mirrors BLOCK_DEFAULTS.roadmap in
// server/i18n/defaults/cmsDefaults.js.
export const ROADMAP_STATUSES = ['shipped', 'beta', 'building', 'exploring'];
const FALLBACK_STATUS = 'exploring';

const DEFAULT_LABELS = {
    shipped:   'Available now',
    beta:      'In beta',
    building:  'In development',
    exploring: 'Exploring',
};

export function groupByStatus(items) {
    const buckets = new Map(ROADMAP_STATUSES.map(s => [s, []]));
    for (const [i, item] of (items || []).entries()) {
        const status = ROADMAP_STATUSES.includes(item?.status) ? item.status : FALLBACK_STATUS;
        // The original index rides along: EditableText paths must address
        // the item where it actually lives in `data.items`, not where it
        // ended up on screen.
        buckets.get(status).push({ item, index: i });
    }
    return ROADMAP_STATUSES
        .map(status => ({ status, entries: buckets.get(status) }))
        .filter(g => g.entries.length > 0);
}

export default function Roadmap({ data }) {
    if (!data?.enabled) return null;

    const items = Array.isArray(data.items) ? data.items : [];
    const groups = groupByStatus(items);
    const labelFor = (status) =>
        (data.statusLabels && data.statusLabels[status]) || DEFAULT_LABELS[status] || status;

    return (
        <SectionFrame id="roadmap" name="Roadmap" enabled={data.enabled}>
            <section id="roadmap" className={sectionBgClass(data)}>
                <div className="container">
                    <SectionHeader
                        pathPrefix="roadmap"
                        eyebrow={data.eyebrow} title={data.title} lead={data.lead}
                        eyebrowStyle={data.eyebrowStyle} titleStyle={data.titleStyle} leadStyle={data.leadStyle}
                        eyebrowAlign={data.eyebrowAlign} titleAlign={data.titleAlign} leadAlign={data.leadAlign} align={data.align}
                    />

                    {/* The legend is a key for the dots on the cards, so it
                        lists only the statuses actually in use. An entry for
                        an empty bucket is a colour swatch that appears
                        nowhere on the page — and on a roadmap where nothing
                        is finished, an unused "Available now" chip reads as
                        a claim rather than a key. */}
                    {data.showLegend !== false && groups.length > 0 ? (
                        <ul className="roadmap-legend" aria-label="Status key">
                            {groups.map(({ status }) => (
                                <li key={status} className={`roadmap-legend-item roadmap--${status}`}>
                                    <span className="roadmap-dot" aria-hidden="true" />
                                    <EditableText path={`roadmap.statusLabels.${status}`} placeholder={status}>
                                        {labelFor(status)}
                                    </EditableText>
                                </li>
                            ))}
                        </ul>
                    ) : null}

                    {groups.map(({ status, entries }) => (
                        <div key={status} className={`roadmap-group roadmap--${status}`}>
                            <h3 className="roadmap-group-heading">
                                <span className="roadmap-dot" aria-hidden="true" />
                                {labelFor(status)}
                                <span className="roadmap-group-count tnum">{entries.length}</span>
                            </h3>
                            <div className="roadmap-grid">
                                {entries.map(({ item, index }) => (
                                    <article key={item.id || index} className="roadmap-card reveal">
                                        <div className="roadmap-card-head">
                                            {item.icon ? (
                                                <span className="roadmap-card-icon" aria-hidden="true">
                                                    <AppIcon name={item.icon} className="w-5 h-5" />
                                                </span>
                                            ) : null}
                                            <EditableText
                                                as="h4"
                                                path={`roadmap.items.${index}.title`}
                                                multiline
                                                placeholder="Item title"
                                                className="roadmap-card-title"
                                                style={inlineTextStyle(undefined, item.titleAlign)}
                                            >
                                                {item.title || ''}
                                            </EditableText>
                                        </div>
                                        <EditableText
                                            as="p"
                                            path={`roadmap.items.${index}.body`}
                                            multiline
                                            placeholder="What this is"
                                            className="roadmap-card-body"
                                            style={inlineTextStyle(undefined, item.bodyAlign)}
                                        >
                                            {item.body || ''}
                                        </EditableText>
                                        {/* `note` carries the honest caveat — which tier
                                            it needs, that it is Dutch-law only, that it
                                            is desktop-only. Rendered quieter than the
                                            body but never hidden. */}
                                        {item.note ? (
                                            <EditableText
                                                as="p"
                                                path={`roadmap.items.${index}.note`}
                                                multiline
                                                placeholder=""
                                                className="roadmap-card-note"
                                            >
                                                {item.note}
                                            </EditableText>
                                        ) : null}
                                        {item.href ? (
                                            <a
                                                className="roadmap-card-link"
                                                href={item.href}
                                                target={item.target}
                                                rel={item.rel}
                                            >
                                                {item.linkLabel || 'Read more'}
                                            </a>
                                        ) : null}
                                    </article>
                                ))}
                            </div>
                        </div>
                    ))}

                    {data.disclaimer ? (
                        <EditableText
                            as="p"
                            path="roadmap.disclaimer"
                            multiline
                            placeholder="Disclaimer"
                            className="roadmap-disclaimer"
                        >
                            {data.disclaimer}
                        </EditableText>
                    ) : null}
                </div>
            </section>
        </SectionFrame>
    );
}

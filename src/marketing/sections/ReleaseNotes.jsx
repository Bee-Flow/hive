import React, { useEffect, useState } from 'react';
import { Sparkles, Wrench, ArrowUpCircle, ExternalLink } from 'lucide-react';
import SectionHeader from '../components/SectionHeader';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';
import { sectionBgClass } from './sectionBg';
import './releaseNotes.css';

/**
 * Release notes — the published changelog. Content shape (see BLOCK_DEFAULTS
 * 'release-notes' in server/i18n/defaults/cmsDefaults.js):
 *
 *   { variant: 'compact' | 'full', eyebrow, title, lead, limit,
 *     kindLabels: { feature, improvement, fix }, emptyText, linkLabel, linkUrl }
 *
 * ── The entries are NOT block content ──────────────────────────────────────
 *
 * They come from `GET /api/release-notes/public`, the same arrangement the
 * `github-stats` block uses. Two reasons this matters and is not incidental:
 * CMS draft/publish is site-wide, so a machine-written note living in block
 * content would go live on the next unrelated publish; and locale overrides
 * address block array items by numeric index, so a generator rewriting an
 * `items` array would silently re-point every existing translation.
 *
 * Only PUBLISHED entries are served — the endpoint filters in the store, so
 * this component cannot accidentally show a draft.
 *
 * FAIL-SOFT is the contract: on an empty or failed fetch the published site
 * renders nothing at all, while the editor still shows the scaffold so the
 * block can be positioned and styled before the first release exists.
 *
 * Inline-edit paths (type-rooted, like every section):
 *   release-notes.eyebrow / .title / .lead / .emptyText / .linkLabel
 */

const KIND_ORDER = ['feature', 'improvement', 'fix'];

const KIND_ICONS = {
    feature: Sparkles,
    improvement: ArrowUpCircle,
    fix: Wrench,
};

const DEFAULT_KIND_LABELS = {
    feature: 'New',
    improvement: 'Improved',
    fix: 'Fixed',
};

/** Editor-only affordances: empty fields stay clickable behind `?preview`. */
const isEditable = () =>
    typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).has('preview');

/**
 * Bucket one entry's items by kind.
 *
 * DERIVED EVERY RENDER, never persisted — the same rule Roadmap.jsx documents.
 * An unknown kind falls into the last bucket rather than being dropped: losing
 * a real change because the generator wrote something unexpected is worse than
 * showing it under a slightly wrong heading.
 */
export function groupByKind(items) {
    const buckets = new Map(KIND_ORDER.map(k => [k, []]));
    for (const it of Array.isArray(items) ? items : []) {
        if (!it || typeof it !== 'object') continue;
        const kind = KIND_ORDER.includes(it.kind) ? it.kind : KIND_ORDER[KIND_ORDER.length - 1];
        buckets.get(kind).push(it);
    }
    return KIND_ORDER
        .map(kind => ({ kind, items: buckets.get(kind) }))
        .filter(g => g.items.length > 0);
}

/** Month + year — a changelog wants "when roughly", not a timestamp. */
export function formatReleaseDate(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    try {
        return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
    } catch {
        return null;
    }
}

export default function ReleaseNotes({ data }) {
    // Hooks before the enabled-check (Rules of Hooks) — same pattern as
    // GitHubStats and Pricing, the other sections that fetch on mount.
    const isDisabled = data && data.enabled === false;

    const [entries, setEntries] = useState(null);

    useEffect(() => {
        let cancelled = false;
        fetch('/api/release-notes/public', { credentials: 'omit' })
            .then(r => (r.ok ? r.json() : null))
            .then(payload => {
                if (cancelled || !payload || !Array.isArray(payload.entries)) return;
                setEntries(payload.entries);
            })
            // Fail-soft: no console.error — a handled degradation is not an error.
            .catch(() => {});
        return () => { cancelled = true; };
    }, []);

    if (isDisabled) return null;

    const editing = isEditable();
    const variant = data?.variant === 'full' ? 'full' : 'compact';
    const limitRaw = Number(data?.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.floor(limitRaw)
        : (variant === 'full' ? 20 : 1);

    const kindLabels = { ...DEFAULT_KIND_LABELS, ...(data?.kindLabels || {}) };
    const shown = (entries || []).slice(0, limit);

    // Nothing published yet. The live site renders nothing rather than an
    // empty shell; the editor keeps the scaffold so the block stays placeable.
    if (!shown.length && !editing) return null;

    const linkLabel = data?.linkLabel || '';
    const linkUrl = (typeof data?.linkUrl === 'string' && data.linkUrl.trim()) ? data.linkUrl.trim() : '';

    return (
        <SectionFrame id="release-notes" name="Release notes" enabled={data?.enabled !== false}>
            <section id="release-notes" className={`release-notes-block release-notes-${variant} ${sectionBgClass(data)}`.trim()}>
                <div className="container">
                    <SectionHeader
                        pathPrefix="release-notes"
                        eyebrow={data?.eyebrow} title={data?.title} lead={data?.lead}
                        eyebrowStyle={data?.eyebrowStyle} titleStyle={data?.titleStyle} leadStyle={data?.leadStyle}
                        eyebrowAlign={data?.eyebrowAlign} titleAlign={data?.titleAlign} leadAlign={data?.leadAlign} align={data?.align}
                    />

                    {shown.length === 0 ? (
                        <p className="release-notes-empty">
                            <EditableText path="release-notes.emptyText" placeholder="No releases published yet">
                                {data?.emptyText || ''}
                            </EditableText>
                        </p>
                    ) : (
                        <ol className="release-notes-list reveal">
                            {shown.map(entry => (
                                <li className="release-notes-entry" key={entry.id || entry.version}>
                                    <div className="release-notes-entry-head">
                                        {entry.version ? (
                                            <span className="release-notes-version">{entry.version}</span>
                                        ) : null}
                                        {formatReleaseDate(entry.publishedAt) ? (
                                            <span className="release-notes-date">{formatReleaseDate(entry.publishedAt)}</span>
                                        ) : null}
                                    </div>
                                    {entry.title ? <h3 className="release-notes-title">{entry.title}</h3> : null}
                                    {entry.lead ? <p className="release-notes-lead">{entry.lead}</p> : null}

                                    {groupByKind(entry.items).map(group => {
                                        const Icon = KIND_ICONS[group.kind] || ArrowUpCircle;
                                        return (
                                            <div className="release-notes-group" key={group.kind}>
                                                <h4 className="release-notes-group-label">
                                                    <Icon aria-hidden="true" />
                                                    {kindLabels[group.kind]}
                                                </h4>
                                                <ul className="release-notes-items">
                                                    {group.items.map((it, i) => (
                                                        <li key={i}>
                                                            {it.title ? <strong>{it.title}</strong> : null}
                                                            {it.title && it.body ? ' — ' : null}
                                                            {it.body || null}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        );
                                    })}
                                </li>
                            ))}
                        </ol>
                    )}

                    {(linkUrl && (linkLabel || editing)) ? (
                        <a
                            className="release-notes-more"
                            href={linkUrl}
                            onClick={(e) => {
                                // Editing the label must not navigate away — the
                                // same guard the GitHubStats and TrustBand chips use.
                                if (e.target.closest && e.target.closest('.cms-editable')) e.preventDefault();
                            }}
                        >
                            <EditableText path="release-notes.linkLabel" placeholder="See all releases">
                                {linkLabel}
                            </EditableText>
                            <ExternalLink aria-hidden="true" />
                        </a>
                    ) : null}
                </div>
            </section>
        </SectionFrame>
    );
}

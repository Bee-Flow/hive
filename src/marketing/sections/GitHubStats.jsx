import React, { useEffect, useState } from 'react';
import { Star, Tag, ExternalLink } from 'lucide-react';
import SectionHeader from '../components/SectionHeader';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';
import { sectionBgClass } from './sectionBg';
import './githubStats.css';

/**
 * GitHub-stats band — a compact chip row with live repo numbers. Content
 * shape (see BLOCK_DEFAULTS 'github-stats' in
 * server/i18n/defaults/cmsDefaults.js):
 *
 *   { eyebrow, title, lead,
 *     repoUrl: 'https://github.com/Bee-Flow/Bee-Flow-AI',
 *     linkLabel: 'Source on GitHub' }
 *
 * Numbers come from `GET /api/public/github-stats` →
 * `{ stars, forks, latestRelease: { tag, publishedAt } | null, url }`,
 * fetched once on mount. FAIL-SOFT is the contract: the endpoint may 404
 * or 503 (rate-limited upstream), and in that case the band renders ONLY
 * the repo-link chip — no zeroes, no error UI, no lingering spinner.
 *
 * Inline-edit paths (type-rooted, like every section):
 *   github-stats.eyebrow / .title / .lead / .linkLabel
 * The repoUrl is panel-only (it is a link, not prose).
 */

// The count reads as a badge ("12,345"), grouped in the visitor's own
// locale convention. Non-finite input → null so the chip doesn't render.
function formatCount(n) {
    if (!Number.isFinite(n)) return null;
    try {
        return new Intl.NumberFormat().format(n);
    } catch {
        return String(n);
    }
}

// Release date next to the tag — month + year is enough context for
// "actively maintained"; the full date is noise at chip size.
function formatReleaseDate(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    try {
        return new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(d);
    } catch {
        return null;
    }
}

export default function GitHubStats({ data }) {
    // Hooks before the enabled-check (Rules of Hooks) — same pattern as the
    // Pricing block, the other section that fetches on mount.
    const isDisabled = data && data.enabled === false;

    const [stats, setStats] = useState(null);

    useEffect(() => {
        let cancelled = false;
        fetch('/api/public/github-stats', { credentials: 'omit' })
            .then(r => (r.ok ? r.json() : null))
            .then(payload => {
                if (cancelled || !payload || typeof payload !== 'object') return;
                setStats(payload);
            })
            // Fail-soft: the link chip alone is the degraded rendering. No
            // console.error — a handled degradation is not a browser error.
            .catch(() => {});
        return () => { cancelled = true; };
    }, []);

    if (isDisabled) return null;

    const repoUrl   = (typeof data?.repoUrl === 'string' && data.repoUrl.trim())
        ? data.repoUrl.trim()
        : 'https://github.com/Bee-Flow/Bee-Flow-AI';
    const linkLabel = data?.linkLabel || 'Source on GitHub';

    const starsText   = formatCount(stats?.stars);
    const release     = stats?.latestRelease;
    const releaseTag  = (release && typeof release.tag === 'string' && release.tag.trim())
        ? release.tag.trim()
        : null;
    const releaseDate = releaseTag ? formatReleaseDate(release.publishedAt) : null;

    return (
        <SectionFrame id="github-stats" name="GitHub stats" enabled={data?.enabled !== false}>
            <section id="github-stats" className={`github-stats-block ${sectionBgClass(data)}`.trim()}>
                <div className="container">
                    <SectionHeader
                        pathPrefix="github-stats"
                        eyebrow={data?.eyebrow} title={data?.title} lead={data?.lead}
                        eyebrowStyle={data?.eyebrowStyle} titleStyle={data?.titleStyle} leadStyle={data?.leadStyle}
                        eyebrowAlign={data?.eyebrowAlign} titleAlign={data?.titleAlign} leadAlign={data?.leadAlign} align={data?.align}
                    />
                    <div className="github-stats-row reveal">
                        {starsText ? (
                            <span className="github-stats-chip">
                                <Star aria-hidden="true" />
                                <span className="github-stats-value">{starsText}</span>
                                <span className="github-stats-muted">stars</span>
                            </span>
                        ) : null}
                        {releaseTag ? (
                            <span className="github-stats-chip">
                                <Tag aria-hidden="true" />
                                <span className="github-stats-value">{releaseTag}</span>
                                {releaseDate ? (
                                    <span className="github-stats-muted">{releaseDate}</span>
                                ) : null}
                            </span>
                        ) : null}
                        <a
                            className="github-stats-chip"
                            href={repoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            // Editing the label in the preview must not open
                            // the repo — same guard the TrustBand chips use.
                            onClick={(e) => {
                                if (e.target.closest && e.target.closest('.cms-editable')) e.preventDefault();
                            }}
                        >
                            <ExternalLink aria-hidden="true" />
                            <EditableText path="github-stats.linkLabel" placeholder="Source on GitHub">
                                {linkLabel}
                            </EditableText>
                        </a>
                    </div>
                </div>
            </section>
        </SectionFrame>
    );
}

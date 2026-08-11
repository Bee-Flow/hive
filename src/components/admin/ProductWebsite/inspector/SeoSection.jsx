import React from 'react';
import { ImageField, resolveCmsAssetUrl } from '../fields';

/**
 * SeoSection — the SEO half of the page-settings strip (PageMetaSection).
 *
 * All fields flow through `onSeoChange(field, value)` → updatePageSeo →
 * the debounced PageDoc save; the server already persists seo.metaTitle,
 * seo.metaDescription, seo.ogImage and seo.noIndex (useCmsHead reads them
 * on the public site) — this panel just finally exposes them all.
 *
 * The SERP / social-card previews are static mocks that update live as the
 * user types; the counters are advisory only and never block input.
 */

const TITLE_LIMIT = 60;
const DESC_LIMIT  = 155;

const inputCls =
    'w-full px-2 py-1 rounded text-xs border bg-[var(--bg-tertiary)] ' +
    'border-[var(--border-default)] text-[var(--text-primary)] ' +
    'focus:outline-none focus:border-[var(--accent-primary)]';

// Subtle right-aligned character counter — green inside the limit, amber
// above it. Purely advisory (search engines truncate, they don't reject).
function CharCounter({ value, limit }) {
    const len = (value || '').length;
    return (
        <span
            className={`ml-auto text-[10px] tabular-nums ${len > limit ? 'text-amber-500' : 'text-emerald-500'}`}
            title={`Recommended max ${limit} characters`}
        >
            {len}/{limit}
        </span>
    );
}

function previewDomain() {
    return (typeof window !== 'undefined' && window.location?.hostname) || 'beeflow.nl';
}

// Static Google-result mock — breadcrumb, blue-ish title, gray snippet.
function SerpPreview({ page }) {
    const domain = previewDomain();
    const title  = page.seo?.metaTitle || page.title || '(untitled)';
    const desc   = page.seo?.metaDescription || '';
    const crumb  = page.isHomepage ? domain : `${domain} › ${page.slug || ''}`;
    return (
        <div>
            <span className="text-[10px] text-[var(--text-muted)]">Search preview</span>
            <div className="mt-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-3 py-2.5">
                <p className="text-[11px] text-[var(--text-secondary)] truncate">{crumb}</p>
                <p className="text-sm text-blue-500 truncate leading-snug">{title}</p>
                <p className="text-xs text-[var(--text-muted)] leading-snug line-clamp-2">
                    {desc || 'Add a meta description to control this snippet.'}
                </p>
            </div>
        </div>
    );
}

// Static social-card (Open Graph) mock — 1.91:1 image, domain caption,
// bold title. cms/… asset keys resolve the same way ImageField previews do.
function SocialCardPreview({ page }) {
    const domain = previewDomain();
    const img    = page.seo?.ogImage || '';
    const title  = page.seo?.metaTitle || page.title || '(untitled)';
    return (
        <div>
            <span className="text-[10px] text-[var(--text-muted)]">Social card preview</span>
            <div className="mt-1 rounded-md border border-[var(--border-subtle)] overflow-hidden bg-[var(--bg-tertiary)]">
                <div className="w-full aspect-[1.91/1] overflow-hidden flex bg-[var(--bg-primary)]">
                    {img ? (
                        <img src={resolveCmsAssetUrl(img)} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <div className="flex-1 m-2 rounded border border-dashed border-[var(--border-default)] flex items-center justify-center text-[10px] text-[var(--text-muted)]">
                            No social image yet
                        </div>
                    )}
                </div>
                <div className="px-3 py-2 border-t border-[var(--border-subtle)]">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] truncate">{domain}</p>
                    <p className="text-xs font-bold text-[var(--text-primary)] truncate">{title}</p>
                </div>
            </div>
        </div>
    );
}

export default function SeoSection({ page, onSeoChange }) {
    const seo = page.seo || {};
    return (
        <div className="space-y-2.5">
            {/* Meta title + counter */}
            <div className="flex flex-col gap-0.5">
                <span className="flex items-center text-[10px] text-[var(--text-muted)]">
                    Meta title
                    <CharCounter value={seo.metaTitle} limit={TITLE_LIMIT} />
                </span>
                <input
                    type="text"
                    value={seo.metaTitle || ''}
                    onChange={e => onSeoChange('metaTitle', e.target.value)}
                    placeholder={page.title || ''}
                    className={inputCls}
                />
            </div>

            {/* Meta description + counter */}
            <div className="flex flex-col gap-0.5">
                <span className="flex items-center text-[10px] text-[var(--text-muted)]">
                    Meta description
                    <CharCounter value={seo.metaDescription} limit={DESC_LIMIT} />
                </span>
                <textarea
                    rows={3}
                    value={seo.metaDescription || ''}
                    onChange={e => onSeoChange('metaDescription', e.target.value)}
                    placeholder="One or two sentences shown under the title in search results."
                    className={`${inputCls} resize-y`}
                />
            </div>

            {/* Social image (og:image) — shared upload + URL + thumbnail */}
            <ImageField
                label="Social image (og:image)"
                value={seo.ogImage || ''}
                onChange={v => onSeoChange('ogImage', v)}
            />

            {/* noIndex toggle + warning */}
            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--text-secondary)]">
                <input
                    type="checkbox"
                    checked={!!seo.noIndex}
                    onChange={e => onSeoChange('noIndex', e.target.checked)}
                    className="accent-[var(--accent-primary)]"
                />
                Hide from search engines (noindex)
            </label>
            {seo.noIndex ? (
                <p className="flex items-start gap-1.5 text-[10px] leading-tight text-amber-500/90 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1.5">
                    ⚠ This page asks search engines not to index it.
                </p>
            ) : null}

            <SerpPreview page={page} />
            <SocialCardPreview page={page} />
        </div>
    );
}

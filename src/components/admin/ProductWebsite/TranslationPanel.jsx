import React, { useMemo } from 'react';
import AppIcon from '../../AppIcon';
import { BLOCK_EDITORS } from './editors';
import { getLocalePath } from './localeMerge';

/**
 * TranslationPanel — the dedicated per-locale translation list shown in Pane B
 * when the editor is in a non-default locale ("translation mode").
 *
 * It enumerates every translatable string for the active page (block content +
 * SEO + title) or the site chrome (header/footer/page-titles) and renders each
 * as a source → translation row. Editing a row writes a sparse text override
 * via the on*Leaf callbacks; an empty input re-inherits the source text.
 *
 * The denylist of structural (non-text) keys is kept in sync with
 * server/core/cmsTranslate.js so the manual list and the AI translate cover the
 * same fields.
 */

// Keys whose value (and subtree) are structural — never translatable.
const DENY_KEYS = new Set([
    'id', 'kind', 'type', 'slug', 'src', 'href', 'url', 'link', 'anchor',
    'path', 'pageId', 'page', 'target', 'rel', 'icon', 'platform',
    'code', 'codeRight', 'popupEmbed', 'embed', 'iframe',
    'planType', 'defaultInterval', 'enableToggle', 'interval',
    'layout', 'columnLayout', 'verticalAlign', 'mediaPosition', 'mediaSize',
    'backgroundVariant', 'background', 'gradient', 'theme', 'radius',
    'number', 'enabled', 'noIndex', 'ogImage', 'favicon', 'role', 'value',
    'style', 'align', 'variant',
]);
const DENY_SUFFIX = /(Style|Color|Font|Align|Size|Variant|Url|Src|Id|Link)$/;

function isDeniedKey(k) {
    if (typeof k !== 'string') return false;
    return DENY_KEYS.has(k) || DENY_SUFFIX.test(k);
}

function isTranslatableValue(s) {
    const t = s.trim();
    if (!t) return false;
    if (/^#[0-9a-fA-F]{3,8}$/.test(t)) return false;
    if (/^(https?:|mailto:|tel:|data:|\/|#)/i.test(t)) return false;
    return true;
}

// Walk content emitting { fieldPath, source } for every translatable leaf.
function collectStrings(node, path, out) {
    if (Array.isArray(node)) {
        node.forEach((el, i) => collectStrings(el, [...path, i], out));
        return;
    }
    if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) {
            if (isDeniedKey(k)) continue;
            collectStrings(v, [...path, k], out);
        }
        return;
    }
    if (typeof node === 'string' && isTranslatableValue(node)) out.push({ fieldPath: path, source: node });
}

function humanize(key) {
    return String(key)
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/^\w/, c => c.toUpperCase());
}

// "Title (#3)" / "Text (#1)" — last string key, with array positions.
function labelForPath(fieldPath) {
    const lastKey = [...fieldPath].reverse().find(s => typeof s === 'string');
    const indices = fieldPath.filter(s => typeof s === 'number');
    const base = lastKey ? humanize(lastKey) : 'Text';
    return indices.length ? `${base} (#${indices.map(i => i + 1).join('·')})` : base;
}

function isMultiline(s) {
    return typeof s === 'string' && (s.length > 64 || s.includes('\n'));
}

function TranslationRow({ label, source, value, onChange, onFocus }) {
    const multi = isMultiline(source);
    const common = {
        value: value || '',
        placeholder: source,
        onFocus,
        onChange: (e) => onChange(e.target.value),
        className: 'w-full px-2 py-1.5 rounded-md text-xs border bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none',
    };
    return (
        <div className="px-4 py-2 border-b border-[var(--border-subtle)]">
            <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">{label}</div>
            <div
                className="text-[11px] text-[var(--text-secondary)] mb-1 whitespace-pre-wrap"
                style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                title={source}
            >
                {source}
            </div>
            {multi
                ? <textarea rows={3} {...common} />
                : <input type="text" {...common} />}
        </div>
    );
}

export default function TranslationPanel({
    scope, site, page, localeName, defaultLocaleName,
    pageOverride, siteOverride, aiStatus,
    onPageLeaf, onPageSeo, onChromeLeaf, onSelectBlock, onAiTranslate,
}) {
    // Build the row groups (data only — onChange is dispatched at render).
    const groups = useMemo(() => {
        if (scope === 'site') return buildSiteGroups(site, siteOverride);
        return buildPageGroups(page, pageOverride, siteOverride);
    }, [scope, site, page, pageOverride, siteOverride]);

    // Route a row's edit to the right override writer based on its target.
    const dispatch = (target, v) => {
        if (target.type === 'block') onPageLeaf?.(target.blockId, target.fieldPath, v);
        else if (target.type === 'seo') onPageSeo?.(target.field, v);
        else if (target.type === 'chrome') onChromeLeaf?.(target.path, v);
    };

    const total = groups.reduce((n, g) => n + g.rows.length, 0);
    const done = groups.reduce((n, g) => n + g.rows.filter(r => (r.value || '').trim()).length, 0);
    const pct = total ? Math.round((done / total) * 100) : 0;
    const running = aiStatus?.state === 'running';

    return (
        <div className="flex flex-col h-full">
            {/* mode banner */}
            <div className="px-4 py-2 bg-[var(--accent-primary)]/10 border-b border-[var(--accent-primary)]/30 shrink-0">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                    <AppIcon name="Languages" className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    Translating {localeName}
                </div>
                <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 leading-snug">
                    Text only — structure, layout, links and design are shared from {defaultLocaleName}.
                    Empty fields fall back to the source text.
                </p>
            </div>

            {/* coverage + AI */}
            <div className="px-4 py-2 border-b border-[var(--border-subtle)] shrink-0">
                <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] mb-1">
                    <span>Translated {done}/{total}</span>
                    <span>{pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                    <div className="h-full bg-[var(--accent-primary)]" style={{ width: `${pct}%` }} />
                </div>
                <button
                    type="button"
                    onClick={onAiTranslate}
                    disabled={running || total === 0}
                    className="mt-2 w-full px-2 py-1.5 rounded-md text-xs font-medium border border-[var(--accent-primary)]/50 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                    <AppIcon name={running ? 'Loader' : 'Sparkles'} className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
                    {running
                        ? 'Translating…'
                        : `AI translate ${scope === 'site' ? 'site chrome' : 'page'} to ${localeName}`}
                </button>
                {aiStatus?.state === 'done' && (
                    <p className="text-[10px] text-emerald-500 mt-1 text-center">
                        AI filled {aiStatus.translated} field(s) — review &amp; refine below.
                    </p>
                )}
            </div>

            {/* rows */}
            <div className="flex-1 overflow-y-auto">
                {total === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] text-center py-8 px-4">
                        Nothing to translate here yet.
                    </p>
                ) : groups.map(g => (
                    <div key={g.key}>
                        <button
                            type="button"
                            onClick={() => g.blockId && onSelectBlock?.(g.blockId)}
                            className="w-full flex items-center gap-2 px-4 py-2 bg-[var(--bg-tertiary)]/60 border-b border-[var(--border-subtle)] text-left"
                        >
                            <AppIcon name={g.icon || 'Type'} className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                            <span className="text-xs font-semibold text-[var(--text-primary)]">{g.title}</span>
                            <span className="ml-auto text-[10px] text-[var(--text-muted)]">
                                {g.rows.filter(r => (r.value || '').trim()).length}/{g.rows.length}
                            </span>
                        </button>
                        {g.rows.map((r) => (
                            <TranslationRow
                                key={r.key}
                                label={r.label}
                                source={r.source}
                                value={r.value}
                                onFocus={() => g.blockId && onSelectBlock?.(g.blockId)}
                                onChange={(v) => dispatch(r.target, v)}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── group builders (pure — rows carry a `target` descriptor, no closures) ──

function buildPageGroups(page, pageOverride, siteOverride) {
    if (!page) return [];
    const groups = [];

    // Page & SEO group. Title lives in the SITE override (pageTitles); SEO in
    // the PAGE override — both routed via their target descriptors.
    const metaRows = [];
    if (typeof page.title === 'string' && page.title.trim()) {
        metaRows.push({
            key: 'page:title',
            label: 'Page title',
            source: page.title,
            value: getLocalePath(siteOverride, ['pageTitles', page.id]),
            target: { type: 'chrome', path: ['pageTitles', page.id] },
        });
    }
    for (const f of ['metaTitle', 'metaDescription']) {
        const src = page.seo?.[f];
        if (typeof src === 'string' && src.trim()) {
            metaRows.push({
                key: `seo:${f}`,
                label: f === 'metaTitle' ? 'Meta title' : 'Meta description',
                source: src,
                value: getLocalePath(pageOverride, ['seo', f]),
                target: { type: 'seo', field: f },
            });
        }
    }
    if (metaRows.length) groups.push({ key: 'meta', title: 'Page & SEO', icon: 'FileText', rows: metaRows });

    for (const block of page.blocks || []) {
        const found = [];
        collectStrings(block.content, [], found);
        if (!found.length) continue;
        const def = BLOCK_EDITORS[block.type] || {};
        groups.push({
            key: block.id,
            blockId: block.id,
            title: def.label || humanize(block.type),
            icon: def.icon || 'Square',
            rows: found.map((f, i) => ({
                key: `${block.id}:${f.fieldPath.join('.')}:${i}`,
                label: labelForPath(f.fieldPath),
                source: f.source,
                value: getLocalePath(pageOverride, ['blocks', block.id, 'content', ...f.fieldPath]),
                target: { type: 'block', blockId: block.id, fieldPath: f.fieldPath },
            })),
        });
    }
    return groups;
}

function buildSiteGroups(site, siteOverride) {
    const groups = [];
    for (const region of ['header', 'footer']) {
        const node = site?.[region];
        if (!node) continue;
        const found = [];
        collectStrings(node, [], found);
        if (!found.length) continue;
        groups.push({
            key: region,
            title: region === 'header' ? 'Header' : 'Footer',
            icon: region === 'header' ? 'PanelTop' : 'PanelBottom',
            rows: found.map((f, i) => ({
                key: `${region}:${f.fieldPath.join('.')}:${i}`,
                label: labelForPath(f.fieldPath),
                source: f.source,
                value: getLocalePath(siteOverride, [region, ...f.fieldPath]),
                target: { type: 'chrome', path: [region, ...f.fieldPath] },
            })),
        });
    }
    const titleRows = [];
    for (const p of site?.pages || []) {
        if (typeof p.title === 'string' && p.title.trim()) {
            titleRows.push({
                key: `title:${p.id}`,
                label: p.title,
                source: p.title,
                value: getLocalePath(siteOverride, ['pageTitles', p.id]),
                target: { type: 'chrome', path: ['pageTitles', p.id] },
            });
        }
    }
    if (titleRows.length) groups.push({ key: 'pageTitles', title: 'Page titles', icon: 'Files', rows: titleRows });
    return groups;
}

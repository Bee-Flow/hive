import React, { useMemo, useState } from 'react';
import AppIcon from '../../AppIcon';
import AiTranslateControl from '../AiTranslateControl';
import { buildPageGroups, buildSiteGroups } from './translatable';

/**
 * TranslationPanel — the translate-mode inspector, shown when the editor is
 * in a non-default locale.
 *
 * It enumerates every translatable string for the active page (block content +
 * SEO + title) or the site chrome (header/footer/page-titles) and renders each
 * as a source → translation row. Editing a row writes a sparse text override
 * via the on*Leaf callbacks; an empty input re-inherits the source text.
 *
 * Field-enumeration rules live in ./translatable.js (single client copy,
 * kept in sync with server/core/cmsTranslate.js).
 *
 * Honesty rules (deferred D3): a filled field is NOT necessarily fresh — the
 * override doesn't know when the source text changed. Coverage wording stays
 * soft, and per-block "Clear & retranslate" is the recovery path.
 */

function isMultiline(s) {
    return typeof s === 'string' && (s.length > 64 || s.includes('\n'));
}

function TranslationRow({ label, source, value, onChange, onFocus, disabled }) {
    const multi = isMultiline(source);
    const common = {
        value: value || '',
        placeholder: source,
        onFocus,
        disabled,
        onChange: (e) => onChange(e.target.value),
        className: 'w-full px-2 py-1.5 rounded-md text-xs border bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none disabled:opacity-50 disabled:cursor-not-allowed',
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
    tier = 'fast', onTierChange,
    onPageLeaf, onPageSeo, onChromeLeaf, onSelectBlock, onAiTranslate,
    onClearAndRetranslateBlock,     // (blockId) — D3 recovery, optional
    onResetTranslations,            // () — remove every override for this scope, optional
}) {
    const [search, setSearch] = useState('');
    const [onlyUntranslated, setOnlyUntranslated] = useState(false);
    // Group collapse — keyed by group key; default: groups with every field
    // filled start collapsed (review-on-demand), unfinished ones open.
    const [collapsed, setCollapsed] = useState({});

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

    const q = search.trim().toLowerCase();
    const visibleGroups = groups
        .map(g => {
            let rows = g.rows;
            if (onlyUntranslated) rows = rows.filter(r => !(r.value || '').trim());
            if (q) {
                rows = rows.filter(r =>
                    (r.source || '').toLowerCase().includes(q)
                    || (r.label || '').toLowerCase().includes(q)
                    || (r.value || '').toLowerCase().includes(q));
            }
            return { ...g, visibleRows: rows };
        })
        .filter(g => g.visibleRows.length > 0);

    const isCollapsed = (g) => {
        if (q || onlyUntranslated) return false; // filters override collapse
        if (g.key in collapsed) return collapsed[g.key];
        const groupDone = g.rows.every(r => (r.value || '').trim());
        return groupDone; // fully-filled groups start collapsed
    };

    return (
        <div className="flex flex-col h-full">
            {/* mode banner */}
            <div className="px-4 py-2 bg-[var(--accent-primary)]/10 border-b border-[var(--accent-primary)]/30 shrink-0">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                    <AppIcon name="Languages" className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    Translating {localeName}
                    {onResetTranslations && (
                        <button
                            type="button"
                            onClick={onResetTranslations}
                            disabled={running || done === 0}
                            className="ml-auto text-[10px] font-normal text-[var(--text-muted)] hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed"
                            title={`Remove every ${localeName} translation for this ${scope === 'site' ? 'site chrome' : 'page'} — fields fall back to ${defaultLocaleName}`}
                        >
                            Reset…
                        </button>
                    )}
                </div>
                <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 leading-snug">
                    Text only — structure, layout, links and design are shared from {defaultLocaleName}.
                    Empty fields fall back to the source text.
                </p>
            </div>

            {/* coverage + AI */}
            <div className="px-4 py-2 border-b border-[var(--border-subtle)] shrink-0">
                <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] mb-1">
                    <span>{done} of {total} fields have a translation</span>
                    <span>{pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                    <div className="h-full bg-[var(--accent-primary)]" style={{ width: `${pct}%` }} />
                </div>
                {pct === 100 && total > 0 && (
                    <p
                        className="text-[10px] text-[var(--text-muted)] mt-1"
                        title="Translations don't update automatically when you change the source text — use a block's Clear & retranslate after editing the source."
                    >
                        All fields filled — review after source edits.
                    </p>
                )}
                <div className="mt-2">
                    <AiTranslateControl
                        tier={tier}
                        onTierChange={onTierChange}
                        onTranslate={onAiTranslate}
                        translating={running}
                        missing={total - done}
                        gradient={false}
                        className="flex items-center gap-1.5 w-full [&>button]:flex-1 [&>button]:justify-center"
                    />
                </div>
                {aiStatus?.state === 'done' && (
                    <p className="text-[10px] text-emerald-500 mt-1 text-center">
                        AI filled {aiStatus.translated} field(s) — review &amp; refine below.
                    </p>
                )}
            </div>

            {/* search + filter */}
            {total > 0 && (
                <div className="px-4 py-2 border-b border-[var(--border-subtle)] shrink-0 flex items-center gap-2">
                    <div className="flex-1 relative">
                        <AppIcon name="Search" className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search fields…"
                            className="w-full pl-6 pr-2 py-1 rounded-md text-xs border bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none"
                        />
                    </div>
                    <label className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)] cursor-pointer whitespace-nowrap">
                        <input
                            type="checkbox"
                            checked={onlyUntranslated}
                            onChange={e => setOnlyUntranslated(e.target.checked)}
                            className="accent-[var(--accent-primary)]"
                        />
                        Only untranslated
                    </label>
                </div>
            )}

            {/* rows */}
            <div className="flex-1 overflow-y-auto">
                {total === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] text-center py-8 px-4">
                        Nothing to translate here yet.
                    </p>
                ) : visibleGroups.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] text-center py-8 px-4">
                        No fields match.
                    </p>
                ) : visibleGroups.map(g => {
                    const groupDone = g.rows.filter(r => (r.value || '').trim()).length;
                    const closed = isCollapsed(g);
                    return (
                        <div key={g.key}>
                            <div className="w-full flex items-center gap-2 px-4 py-2 bg-[var(--bg-tertiary)]/60 border-b border-[var(--border-subtle)]">
                                <button
                                    type="button"
                                    onClick={() => setCollapsed(c => ({ ...c, [g.key]: !closed }))}
                                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                                    title={closed ? 'Expand' : 'Collapse'}
                                >
                                    <AppIcon name={closed ? 'ChevronRight' : 'ChevronDown'} className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                                    <AppIcon name={g.icon || 'Type'} className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
                                    <span className="text-xs font-semibold text-[var(--text-primary)] truncate">{g.title}</span>
                                </button>
                                {g.blockId && (
                                    <button
                                        type="button"
                                        onClick={() => onSelectBlock?.(g.blockId)}
                                        className="shrink-0 text-[var(--text-muted)] hover:text-[var(--accent-primary)]"
                                        title="Show this block in the preview"
                                    >
                                        <AppIcon name="Crosshair" className="w-3 h-3" />
                                    </button>
                                )}
                                {g.blockId && onClearAndRetranslateBlock && (
                                    <button
                                        type="button"
                                        onClick={() => onClearAndRetranslateBlock(g.blockId)}
                                        disabled={running}
                                        className="shrink-0 text-[var(--text-muted)] hover:text-[var(--accent-primary)] disabled:opacity-40"
                                        title="Clear this block's translations and let AI retranslate them (use after changing the source text)"
                                    >
                                        <AppIcon name="RefreshCw" className="w-3 h-3" />
                                    </button>
                                )}
                                <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
                                    {groupDone}/{g.rows.length}
                                </span>
                            </div>
                            {!closed && g.visibleRows.map((r) => (
                                <TranslationRow
                                    key={r.key}
                                    label={r.label}
                                    source={r.source}
                                    value={r.value}
                                    onFocus={() => g.blockId && onSelectBlock?.(g.blockId)}
                                    onChange={(v) => dispatch(r.target, v)}
                                    disabled={running}
                                />
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

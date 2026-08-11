import React, { useEffect, useState } from 'react';
import AppIcon from '../../../AppIcon';
import { Toggle } from '../fields';
import { BLOCK_EDITORS } from '../editors';
import BlockStyleEditor from '../BlockStyleEditor';
import SeoSection from './SeoSection';
import { slugIssues } from '../../../../utils/cmsPublicRouting';

function SubTabBtn({ label, active, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px
                ${active
                    ? 'border-[var(--accent-primary)] text-[var(--text-primary)]'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
        >
            {label}
        </button>
    );
}

function MetaInput({ label, value, onChange, mono }) {
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-[var(--text-muted)]">{label}</span>
            <input
                type="text"
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                className={`w-full px-2 py-1 rounded text-xs border bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] ${mono ? 'font-mono' : ''}`}
            />
        </div>
    );
}

function MetaToggle({ label, value, onChange }) {
    return (
        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--text-secondary)]">
            <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} className="accent-[var(--accent-primary)]" />
            {label}
        </label>
    );
}

// Slug field — buffered (commit on blur / Enter, Escape reverts) so we can
// validate BEFORE the PUT /meta round-trip. Reserved slugs and duplicates
// block the commit (the server rejects reserved and would silently
// -2-suffix a duplicate); `_` slugs warn but stay allowed (legacy data).
function SlugField({ value, allSlugs, onCommit }) {
    const [draft, setDraft] = useState(value || '');
    useEffect(() => { setDraft(value || ''); }, [value]);

    const normalized = draft.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const issue = slugIssues(normalized, { existingSlugs: allSlugs, currentSlug: value });

    const commit = () => {
        const next = normalized.trim();
        if (!next || next === value) { setDraft(value || ''); return; }
        if (issue?.blocking) { setDraft(value || ''); return; }
        onCommit(next);
    };

    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-[var(--text-muted)]">URL slug</span>
            <input
                type="text"
                value={draft}
                spellCheck={false}
                onChange={e => setDraft(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === 'Enter')  { e.preventDefault(); commit(); }
                    if (e.key === 'Escape') { e.preventDefault(); setDraft(value || ''); }
                }}
                className={`w-full px-2 py-1 rounded text-xs font-mono border bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:outline-none ${issue?.blocking ? 'border-red-400' : 'border-[var(--border-default)] focus:border-[var(--accent-primary)]'}`}
            />
            {issue ? (
                <p className={`text-[10px] leading-tight ${issue.blocking ? 'text-red-400' : 'text-amber-500/90'}`}>
                    ⚠ {issue.message}{issue.blocking ? ' (Esc reverts)' : ''}
                </p>
            ) : null}
        </div>
    );
}

/**
 * Page settings section — the re-housed PageMetaStrip. Meta fields flow
 * through `onMetaChange` → savePageMeta (PUT /meta — the ONLY safe path for
 * index-entry fields); SEO fields through `onSeoChange` → the debounced
 * PageDoc save. Same wiring as before, wider column.
 */
export function PageMetaSection({ page, allSlugs, onMetaChange, onSeoChange }) {
    const [open, setOpen] = useState(false);

    return (
        <div className="border-b border-[var(--border-subtle)] shrink-0">
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
            >
                <span className="flex items-center gap-2">
                    <AppIcon name={page.isHomepage ? 'Home' : 'FileText'} className="w-3.5 h-3.5" />
                    <span className="font-medium">{page.title || '(untitled)'}</span>
                    <span className="text-[var(--text-muted)]">/{page.slug}</span>
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[var(--text-muted)]">Page settings & SEO</span>
                    <AppIcon name={open ? 'ChevronUp' : 'ChevronDown'} className="w-3.5 h-3.5" />
                </span>
            </button>
            {open && (
                <div className="px-4 pb-3 space-y-2 max-h-[60vh] overflow-y-auto">
                    <MetaInput label="Page title" value={page.title} onChange={v => onMetaChange('title', v)} />
                    <SlugField value={page.slug} allSlugs={allSlugs} onCommit={v => onMetaChange('slug', v)} />
                    <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                        <MetaToggle label="Hide header" value={page.hideHeader} onChange={v => onMetaChange('hideHeader', v)} />
                        <MetaToggle label="Hide footer" value={page.hideFooter} onChange={v => onMetaChange('hideFooter', v)} />
                        <MetaToggle label="Exclude from analytics" value={page.noAnalytics} onChange={v => onMetaChange('noAnalytics', v)} />
                    </div>
                    {/* SEO — metaTitle/metaDescription/ogImage/noIndex +
                        SERP/social previews. Same onSeoChange → debounced
                        PageDoc save the two old MetaInputs used. */}
                    <div className="pt-2 mt-1 border-t border-[var(--border-subtle)]">
                        <SeoSection page={page} onSeoChange={onSeoChange} />
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Page inspector — page settings strip + the block editor for the active
 * block (Content | Style sub-tabs). Contracts unchanged: block editors get
 * `(data, pages, onChange)`, style edits go to BlockStyleEditor.
 */
export default function PageInspector({
    page,
    pageIndex,      // [{id, slug, title, isHomepage}] — LinkField pickers + slug lint
    activeBlock,
    blockEditorTab,
    onBlockEditorTab,
    siteDesign,
    onMetaChange,
    onSeoChange,
    onBlockContentChange,   // (nextContent)
    onBlockStyleChange,     // (nextStyle)
    onToggleBlock,          // (blockId)
}) {
    const BlockEditor = activeBlock ? BLOCK_EDITORS[activeBlock.type]?.component : null;

    return (
        <div className="h-full flex flex-col min-h-0">
            <PageMetaSection
                page={page}
                allSlugs={(pageIndex || []).map(p => p.slug)}
                onMetaChange={onMetaChange}
                onSeoChange={onSeoChange}
            />

            <div className="flex-1 overflow-y-auto">
                {activeBlock && BlockEditor ? (
                    <>
                        <div className="px-4 pt-4 flex items-center gap-2">
                            <AppIcon name={BLOCK_EDITORS[activeBlock.type]?.icon || 'Square'} className="w-4 h-4 text-[var(--accent-primary)]" />
                            <span className="text-sm font-semibold text-[var(--text-primary)]">
                                {BLOCK_EDITORS[activeBlock.type]?.label}
                            </span>
                            <div className="ml-auto">
                                <Toggle
                                    label=""
                                    value={!!activeBlock.enabled}
                                    onChange={() => onToggleBlock(activeBlock.id)}
                                />
                            </div>
                        </div>

                        {/* Content / Style sub-tabs */}
                        <div className="px-4 mt-3 flex items-center border-b border-[var(--border-subtle)]">
                            <SubTabBtn label="Content" active={blockEditorTab === 'content'} onClick={() => onBlockEditorTab('content')} />
                            <SubTabBtn label="Style" active={blockEditorTab === 'style'} onClick={() => onBlockEditorTab('style')} />
                        </div>

                        {blockEditorTab === 'content' ? (
                            <div className="px-4 pt-4 pb-6">
                                <BlockEditor
                                    data={activeBlock.content}
                                    pages={pageIndex}
                                    onChange={onBlockContentChange}
                                />
                            </div>
                        ) : (
                            <BlockStyleEditor
                                style={activeBlock.style}
                                enabled={activeBlock.enabled !== false}
                                design={siteDesign}
                                blockType={activeBlock.type}
                                onChange={onBlockStyleChange}
                                onToggleEnabled={() => onToggleBlock(activeBlock.id)}
                            />
                        )}
                    </>
                ) : (
                    <p className="text-xs text-[var(--text-muted)] text-center py-8 px-4">
                        {page.blocks?.length
                            ? 'Select a block to edit its settings, or click text in the preview.'
                            : 'Add a block to get started.'}
                    </p>
                )}
            </div>

            {/* hint */}
            <div className="px-4 py-2 border-t border-[var(--border-subtle)] shrink-0">
                <p className="text-xs text-[var(--text-muted)]">
                    Click any text in the preview to edit inline.
                </p>
            </div>
        </div>
    );
}

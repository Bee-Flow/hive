import React from 'react';
import AppIcon from '../../../AppIcon';
import PageList from '../PageList';
import BlockList from '../BlockList';
import {
    DESIGN_VIRTUAL_ID, HEADER_VIRTUAL_ID, FOOTER_VIRTUAL_ID, COOKIE_VIRTUAL_ID,
    ANNOUNCE_VIRTUAL_ID, ANALYTICS_VIRTUAL_ID,
} from '../sentinels';

const SITE_ENTRIES = [
    { id: DESIGN_VIRTUAL_ID,    label: 'Design',            icon: 'Palette' },
    { id: HEADER_VIRTUAL_ID,    label: 'Header',            icon: 'LayoutTemplate' },
    { id: FOOTER_VIRTUAL_ID,    label: 'Footer',            icon: 'PanelBottom' },
    { id: ANNOUNCE_VIRTUAL_ID,  label: 'Announcement bar',  icon: 'Megaphone' },
    { id: COOKIE_VIRTUAL_ID,    label: 'Cookie banner',     icon: 'Cookie' },
    { id: ANALYTICS_VIRTUAL_ID, label: 'Analytics',         icon: 'BarChart3' },
];

function Caption({ children }) {
    return (
        <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] shrink-0">
            {children}
        </div>
    );
}

/**
 * Left navigator — everything you can select to edit, in one panel:
 *
 *   SITE    Design / Header / Footer / Announcement bar / Cookie banner /
 *           Analytics (virtual entries)
 *   PAGES   the existing PageList (dnd reorder, row menu, templates, import)
 *   BLOCKS  the existing BlockList for the active page — full remaining
 *           height (the old 35%-cap double-scroll-well is gone)
 */
export default function NavigatorPanel({
    activeEntryId,          // normalized activePageId (virtual ids resolved)
    onSelectEntry,          // (id) — virtual id or page id
    pageListProps,          // spread into <PageList/> (activePageId/onSelect included)
    blockListProps,         // spread into <BlockList/>; null hides the BLOCKS zone
}) {
    return (
        <div className="h-full flex flex-col min-h-0 bg-[var(--bg-secondary)]">
            {/* SITE */}
            <Caption>Site</Caption>
            <div className="shrink-0">
                {SITE_ENTRIES.map(entry => (
                    <button
                        key={entry.id}
                        type="button"
                        onClick={() => onSelectEntry(entry.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 text-sm w-full text-left
                            ${activeEntryId === entry.id
                                ? 'bg-[var(--accent-primary)]/10 text-[var(--text-primary)]'
                                : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]'}`}
                    >
                        <AppIcon name={entry.icon} className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{entry.label}</span>
                    </button>
                ))}
            </div>

            {/* PAGES — own scroll region, capped so blocks keep room */}
            <div className="border-t border-[var(--border-subtle)] mt-2 flex flex-col min-h-0 shrink-0" style={{ maxHeight: '45%' }}>
                <div className="flex-1 min-h-0 overflow-hidden">
                    <PageList {...pageListProps} />
                </div>
            </div>

            {/* BLOCKS — the rest of the column */}
            {blockListProps ? (
                <div className="border-t border-[var(--border-subtle)] flex-1 min-h-0 overflow-y-auto">
                    <BlockList {...blockListProps} />
                </div>
            ) : (
                <div className="border-t border-[var(--border-subtle)] flex-1 min-h-0 flex items-start justify-center pt-6">
                    <p className="text-[11px] text-[var(--text-muted)] px-4 text-center">
                        Select a page to see its blocks.
                    </p>
                </div>
            )}
        </div>
    );
}

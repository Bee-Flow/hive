import { useDraggable } from '@dnd-kit/core';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PALETTE_PREFIX, buildNode } from './dnd';
import { useCatalogComponents } from '../inspector/panels/SpecPanel';
import { APP_COMPONENT_TYPES, PALETTE_CATEGORIES, PALETTE_STARTERS } from '../runtime/componentRegistry';
import { useAppEditor } from '../state/AppEditorContext';
import { findNode, findScreen, insertNode } from '../state/definitionOps';
import RibbonCluster from '../../../../shared/ribbon/RibbonCluster';
import CmdButton from '../../../../shared/ribbon/CmdButton';
import Tabs from '../../../../shared/Tabs';
import scopedStorage from '../../../../../utils/scopedStorage';

const RIBBON_TAB_KEY = 'appStudioRibbonTab';
const STARTER_TAB = 'Start here';
// One strip with every cluster in it. The tabs alone made findability worse
// than it looks on paper: 'Basics' and 'AI' hold ONE component each while
// 'Data' holds sixteen, so whichever tab you land on, most of the catalog is
// behind a tab you have no reason to click.
const ALL_TAB = 'All';

/**
 * App Studio editor — the always-visible component RIBBON.
 *
 * A persistent strip below the screen tabs (edit mode only), built from the
 * SAME shared ribbon primitives as the routines/automations "Add step" ribbon
 * (shared/ribbon/RibbonCluster + CmdButton). Like that ribbon, categories are
 * split across CATEGORY TABS (shared/Tabs) so only one section's clusters show
 * at a time — the whole palette fits on a laptop without horizontal overflow.
 * A compact search box lives in the tab strip; while a query is active the tab
 * filter is bypassed so matches surface across every category.
 *
 * The FIRST tab, "Start here", is a shortcut view of PALETTE_STARTERS — the
 * eight things most apps begin with, gathered from wherever they live. It is
 * the default tab because opening on a category that happens to hold one
 * component makes the palette look empty. Every category tab still lists its
 * own components, and search still spans the whole catalog.
 *
 * Every card is BOTH:
 *   - a useDraggable ('palette:<type>') the shell's DndContext resolves onto
 *     the canvas (drop position via computeDragEnd), and
 *   - click-to-add: insert after the selected node (inside its parent), else
 *     append to the LAST section of the current screen; then select + pulse.
 *
 * Only the pointer listener is spread on cards — Enter/Space stay native button
 * clicks (keyboard users add by click; keyboard drag would swallow the key).
 */
export default function ComponentRibbon({ onCommit }) {
    const { definition, screenId, selectedNodeId, streamLock, dispatch } = useAppEditor();
    // componentSpecs has carried a one-line description per component all
    // along, /catalog serves it, the inspector caches it for the session — and
    // the palette rendered a bare label. "Pane" tells a first-time author
    // nothing; the description is the only place that explains what it is for.
    const catalog = useCatalogComponents();
    const [query, setQuery] = useState('');
    const [tab, setTab] = useState(() => scopedStorage.getItem(RIBBON_TAB_KEY) || STARTER_TAB);

    // "Start here" first, then one tab per category that actually has
    // components (an empty category — e.g. 'AI' before its first component
    // ships — never shows a dead tab).
    const tabs = useMemo(() => {
        const present = new Set(Object.values(APP_COMPONENT_TYPES).map((e) => e.category));
        return [
            { id: STARTER_TAB, label: STARTER_TAB },
            { id: ALL_TAB, label: ALL_TAB },
            ...PALETTE_CATEGORIES.filter((c) => present.has(c)).map((c) => ({ id: c, label: c })),
        ];
    }, []);
    const tabIds = tabs.map((t) => t.id);
    const activeTab = tabIds.includes(tab) ? tab : STARTER_TAB;

    const starterGroup = useMemo(() => ({
        category: STARTER_TAB,
        entries: PALETTE_STARTERS
            .filter((type) => APP_COMPONENT_TYPES[type])
            .map((type) => ({ type, entry: APP_COMPONENT_TYPES[type] })),
    }), []);

    useEffect(() => { scopedStorage.setItem(RIBBON_TAB_KEY, activeTab); }, [activeTab]);

    const searching = query.trim().length > 0;
    const groups = useMemo(() => {
        const q = query.trim().toLowerCase();
        return PALETTE_CATEGORIES.map((category) => ({
            category,
            entries: Object.entries(APP_COMPONENT_TYPES)
                .filter(([, entry]) => entry.category === category)
                .filter(([type, entry]) => !q
                    || entry.label.toLowerCase().includes(q)
                    || type.toLowerCase().includes(q))
                .map(([type, entry]) => ({ type, entry })),
        })).filter((group) => group.entries.length > 0);
    }, [query]);

    // While searching, show every matching category (the starter view is left
    // out so a match never appears twice); otherwise just the active tab.
    let visibleGroups;
    if (searching) visibleGroups = groups;
    else if (activeTab === STARTER_TAB) visibleGroups = [starterGroup];
    else if (activeTab === ALL_TAB) visibleGroups = groups;
    else visibleGroups = groups.filter((group) => group.category === activeTab);

    const addByClick = (type) => {
        if (streamLock) return;
        const node = buildNode(type);
        if (!node) return;

        // After the selected node inside ITS parent (section or container) —
        // but only while that node is on the screen being looked at, otherwise
        // the component would land out of sight on the previous screen. With
        // nothing usable selected, append to the current screen's last section.
        let parentId = null;
        let index;
        const selected = selectedNodeId ? findNode(definition, selectedNodeId) : null;
        const found = selected && selected.screen.id === screenId ? selected : null;
        if (found) {
            parentId = found.parent.id;
            index = found.index + 1;
        } else {
            const screen = findScreen(definition, screenId) || definition?.screens?.[0];
            const sections = screen?.sections || [];
            parentId = sections[sections.length - 1]?.id || null;
        }
        if (!parentId) return;

        const { def, nodeId } = insertNode(definition, { parentId, index, node });
        if (!nodeId) return;
        onCommit?.(def);
        dispatch({ type: 'select_node', nodeId });
        dispatch({ type: 'set_recent_ids', ids: [nodeId] });
    };

    return (
        <div
            role="toolbar"
            aria-label="Add a component"
            className="flex shrink-0 flex-col border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/40"
        >
            <div className="flex items-center gap-2 px-3 pt-1">
                <Tabs
                    size="sm"
                    ariaLabel="Component categories"
                    value={activeTab}
                    onChange={setTab}
                    items={tabs}
                    className="flex-1 min-w-0"
                />
                <div className="relative flex shrink-0 items-center self-center">
                    <Search
                        className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]"
                        aria-hidden="true"
                    />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search…"
                        aria-label="Search components"
                        className="w-36 rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] py-1.5 pl-7 pr-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                </div>
            </div>

            <div className="flex items-start gap-2 px-3 py-1.5">
                <div className="flex-1 min-w-0 flex flex-wrap items-stretch content-start gap-1.5">
                    {visibleGroups.length === 0 ? (
                        <div className="flex items-center px-3 text-xs italic text-[var(--text-tertiary)]">
                            No components match “{query}”
                        </div>
                    ) : visibleGroups.map(({ category, entries }) => (
                        <RibbonCluster key={category} caption={category}>
                            {entries.map(({ type, entry }) => (
                                <PaletteCard
                                    key={type}
                                    type={type}
                                    entry={entry}
                                    description={catalog?.[type]?.description || null}
                                    disabled={streamLock}
                                    onAdd={addByClick}
                                />
                            ))}
                        </RibbonCluster>
                    ))}
                </div>
            </div>
        </div>
    );
}

/**
 * One draggable + click-to-add component card — a thin dnd-kit wrapper around
 * the shared CmdButton (presentation lives there). Only onPointerDown is
 * spread; Enter/Space stay native clicks.
 */
function PaletteCard({ type, entry, description, disabled, onAdd }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `${PALETTE_PREFIX}${type}`,
        data: { type: 'palette', componentType: type },
        disabled,
    });

    return (
        <CmdButton
            icon={entry.icon}
            label={entry.label}
            // The description first: it is the part the author does not already
            // know from the label they are looking at.
            title={description
                ? `${entry.label} — ${description}\n\nClick to add, or drag onto the canvas.`
                : `${entry.label} — click to add, or drag onto the canvas`}
            onClick={() => onAdd(type)}
            disabled={disabled}
            dragging={isDragging}
            grabbable
            buttonRef={setNodeRef}
            onPointerDown={listeners?.onPointerDown}
            aria-describedby={attributes['aria-describedby']}
        />
    );
}

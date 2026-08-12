import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, Wand2, ChevronsUpDown, LayoutGrid, Boxes, Home, Undo2, Redo2, Webhook, MoreHorizontal } from 'lucide-react';
import AddStepMenu from './AddStepMenu';
import IntegrationLogo from './nodes/IntegrationLogo';
import Tabs from '../../../../shared/Tabs';
import RibbonCluster from '../../../../shared/ribbon/RibbonCluster';
import CmdButton from '../../../../shared/ribbon/CmdButton';
import RibbonDropdown from '../../../../shared/ribbon/RibbonDropdown';
import InlineButton from '../../../../shared/ribbon/InlineButton';
import { buildStepGroups, orderedAppCategories, AI_STEP, TRIGGERS, additionalTriggerItems } from './stepPalette';
import { actionLabelMap, uiDescription } from './appLabels';
import { denseInputClass } from './settings/formStyles';
import { stepDragProps } from './stepDrag';
import { getIntegrationById } from '../../../../../config/integrationCatalog';
import scopedStorage from '../../../../../utils/scopedStorage';

/**
 * Office-style "Add step" ribbon — AI step inline + grouped dropdowns
 * (Action / Flow / Flowlets / Steps) + search. Two modes:
 *   standalone (default) — its own bordered toolbar above the canvas, with a
 *     collapse-to-reclaim-the-row affordance (persisted).
 *   embedded — a full-width Office-style ribbon STRIP (its own row under the
 *     builder header): visible command buttons grouped into captioned
 *     categories (Frequent · AI · Flow control · Data · Lists · Apps ·
 *     Flowlets · Steps) + a Find cluster (search + auto-map). Galleries with
 *     too many items (Apps, Steps) collapse to a "Browse" command that opens
 *     the shared dropdown menu.
 *
 * Props:
 *   scope     — { catalog, layers, inLayer, canAddLayerOutput, isBlockRoot }
 *   hasTrigger — when false, the ribbon shows trigger choices instead
 *   disabled  — greyed while the AI stream is patching the definition
 *   onAddNode(payload) — the shared BuilderShell add handler
 *   autoMapEnabled / onToggleAutoMap — the auto-map-inputs toggle
 *   embedded  — render bare (no bar chrome / collapse) for the header slot
 */
// Shown as its own line in the screen tip rather than glued onto the end of
// the description, where it used to run the two together.
const DRAG_HINT = 'Click to add, or drag it onto the canvas.';

/**
 * How many CELLS a category cluster may fill before the rest of its apps fold
 * into one "more" command (which then takes the last cell itself).
 *
 * A cluster is a 2-row grid, so this is really "at most six columns". Twelve
 * keeps every category that existed before this cap unchanged (the largest was
 * Google Workspace at eight) and bites only on Nextcloud, whose fourteen apps
 * were on their own wide enough to push the Apps strip onto a second row —
 * doubling the height of the ribbon on every screen under ~2000px.
 */
export const RIBBON_APPS_PER_CLUSTER = 12;

export default function AddStepRibbon({
    scope = {},
    hasTrigger = true,
    disabled = false,
    onAddNode,
    autoMapEnabled = true,
    onToggleAutoMap = null,
    embedded = false,
    // Personal "frequently used" steps (search-result-shaped); surfaced as
    // inline one-click quick-adds in embedded mode.
    frequentItems = [],
    // Controlled active tab. When provided (BuildTab renders the tab strip up in
    // the header bar), this component shows only that tab's groups and skips its
    // own internal tab strip. When null it owns the tab strip itself.
    activeTab = null,
    // Undo/redo — rendered at the start of the ribbon groups row (Word-style)
    // when the tab strip is controlled (i.e. on the Build screen).
    onUndo = null,
    onRedo = null,
    canUndo = false,
    canRedo = false,
}) {
    // Collapse only exists in standalone mode (the header bar never collapses).
    const [collapsed, setCollapsed] = useState(() => !embedded && scopedStorage.getItem('routinesRibbonOpen') === '0');
    useEffect(() => { if (!embedded) scopedStorage.setItem('routinesRibbonOpen', collapsed ? '0' : '1'); }, [collapsed, embedded]);

    const [openKey, setOpenKey] = useState(null); // which dropdown/search popover is open
    const rowRef = useRef(null);
    useEffect(() => {
        if (!openKey) return undefined;
        const onDown = (e) => {
            if (rowRef.current && rowRef.current.contains(e.target)) return;
            // The dropdown panel is portalled to <body>, so it's outside rowRef.
            // Ignore clicks landing inside it, or item-selection unmounts the
            // portal before the click registers.
            if (e.target.closest && e.target.closest('[data-ribbon-dropdown]')) return;
            setOpenKey(null);
        };
        const onKey = (e) => { if (e.key === 'Escape') setOpenKey(null); };
        // Capture phase: the React Flow canvas (d3-drag) calls stopPropagation
        // on mousedown, so a bubble-phase listener never sees clicks on the
        // canvas. Capturing fires before that and reliably closes the dropdown.
        document.addEventListener('mousedown', onDown, true);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onDown, true); document.removeEventListener('keydown', onKey); };
    }, [openKey]);

    // Active ribbon tab when UNcontrolled (no `activeTab` prop): Home / Apps /
    // Reusable, persisted per-user. When controlled, BuildTab owns + persists
    // the tab, so we neither track nor write it here (avoids a double writer).
    const controlledTab = activeTab != null;
    const [internalTab, setInternalTab] = useState(() => scopedStorage.getItem('routinesRibbonTab') || 'home');
    useEffect(() => {
        if (!controlledTab) scopedStorage.setItem('routinesRibbonTab', internalTab);
    }, [internalTab, controlledTab]);

    const groups = useMemo(() => buildStepGroups(scope), [scope]);
    const add = (payload) => { onAddNode?.(payload); setOpenKey(null); };
    // Every command is also a drag source: dropping it on a connection splices
    // it in, dropping it on a node wires it from there, dropping it on empty
    // canvas leaves it loose (see flow/stepDrag.js + DiagramPane's onDrop).

    // Bar chrome only in standalone mode; embedded is bare so it sits flush
    // inside the header row.
    const barChrome = embedded ? '' : 'px-3 py-1.5 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/40';

    // Trigger state: no trigger yet → offer the trigger choices.
    // This branch returns before the embedded layout, so it can't lean on
    // `barChrome` (empty when embedded) for its padding — without the explicit
    // row padding the caption sat flush against the pane edge (BFSF-327).
    if (!hasTrigger) {
        return (
            <div ref={rowRef} className={`flex items-center gap-1.5 flex-wrap px-3 py-2 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/40 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mr-1">Start with a trigger</span>
                {TRIGGERS.map(t => (
                    <InlineButton key={t.id} icon={t.icon} label={t.label} onClick={() => add(t.payload)} {...stepDragProps(t.payload)} />
                ))}
            </div>
        );
    }

    if (collapsed) {
        return (
            <div className="flex items-center gap-2 px-3 py-1 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/40">
                <button
                    type="button"
                    onClick={() => setCollapsed(false)}
                    disabled={disabled}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-40"
                >
                    <Plus size={14} /> Add step
                </button>
                <span className="text-[10px] text-[var(--text-tertiary)]">Ribbon hidden</span>
            </div>
        );
    }

    // Dropdown groups (skip 'ai' — the one inline shortcut). Everything else,
    // including If / Loop / Edit fields, lives in the consolidated Flow menu.
    // 'triggers' is skipped too: the ribbon already has a dedicated "+ Trigger"
    // cluster below, and the group exists for the edge-drop popover's browse
    // list, which has no such cluster.
    const dropdownGroups = groups.filter(g => g.key !== 'ai' && g.key !== 'triggers');

    // The three control clusters, shared by both layouts.
    const aiButton = <InlineButton icon={AI_STEP.icon} label="AI step" onClick={() => add(AI_STEP.payload)} {...stepDragProps(AI_STEP.payload)} />;
    const stepDropdowns = dropdownGroups.map(g => (
        <RibbonDropdown
            key={g.key}
            label={g.title}
            open={openKey === g.key}
            onToggle={() => setOpenKey(k => (k === g.key ? null : g.key))}
        >
            <AddStepMenu scope={scope} group={g} showSearch={false} onAdd={add} onAfterAdd={() => setOpenKey(null)} />
        </RibbonDropdown>
    ));
    // The "+ Trigger" cluster. Webhook/app_event are APPENDED to
    // definition.triggers[]; the other five can only be the one primary
    // trigger, so picking one replaces it (BuildTab.addStepAt confirms first).
    // See DiagramPane.jsx's buildStepFromPayload/applyAddNode
    // (asSecondaryTrigger → __addTrigger) and automation/validate.js's
    // `triggers[]` rules (schedule/manual rejected there).
    //
    // It used to list only the two additive kinds, which — together with a
    // search that returned no triggers at all — left five of the seven with no
    // way in on an existing routine (BFSF-325).
    //
    // NOT inside a flowlet or a reusable Step (C8): triggers[] is root-only —
    // the validator rejects it on a layer graph (`triggers.not_supported_here`),
    // so offering the cluster there wrote an instantly-unsaveable definition.
    const allowTriggers = !scope?.inLayer && !scope?.isBlockRoot;
    const addTriggerGroup = { key: 'add_trigger', title: 'Trigger', items: additionalTriggerItems() };
    const addTriggerDropdown = (
        <RibbonDropdown
            label="+ Trigger"
            icon={Webhook}
            open={openKey === '__addTrigger'}
            onToggle={() => setOpenKey(k => (k === '__addTrigger' ? null : '__addTrigger'))}
        >
            <AddStepMenu scope={scope} group={addTriggerGroup} showSearch={false} onAdd={add} onAfterAdd={() => setOpenKey(null)} />
        </RibbonDropdown>
    );
    const searchDropdown = (
        <RibbonDropdown
            label="Search"
            icon={Search}
            open={openKey === '__search'}
            onToggle={() => setOpenKey(k => (k === '__search' ? null : '__search'))}
            align={embedded ? 'left' : 'right'}
            width={340}
        >
            <AddStepMenu scope={scope} showSearch autoFocus onAdd={add} onAfterAdd={() => setOpenKey(null)} />
        </RibbonDropdown>
    );
    const autoMapToggle = onToggleAutoMap ? (
        <label
            className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)] cursor-pointer select-none px-1"
            title="Automatically map a new step's inputs from upstream output when you connect it"
        >
            <input type="checkbox" checked={!!autoMapEnabled} onChange={onToggleAutoMap} />
            <Wand2 size={12} /> Auto-map
        </label>
    ) : null;

    // Personal "frequently used" steps as inline quick-adds (excl. AI step,
    // already its own prominent command). Cap at 4 for the ribbon's Frequent
    // cluster (a 2-row grid → two columns).
    const freqInline = (frequentItems || []).filter(it => it && it.payload?.kind !== 'ai_step').slice(0, 4);

    // Embedded: an Office-style ribbon with TABS (Home · Apps · Reusable). When
    // controlled, the tab strip lives in the header bar (BuildTab) and this just
    // renders the active tab's groups; uncontrolled, it renders its own strip.
    if (embedded) {
        const flowGroup = groups.find(g => g.key === 'flow');
        const flowSections = (flowGroup?.sections || []).filter(s => (s.items || []).length > 0);
        const flowletGroup = groups.find(g => g.key === 'flowlets');
        const stepsGroup = groups.find(g => g.key === 'steps');
        const appCategories = orderedAppCategories(scope.catalog);
        // Normalise reusable Steps into category sections (so they list by
        // category like Apps, as direct buttons — no gallery dropdown).
        const stepSections = !stepsGroup
            ? []
            : stepsGroup.kind === 'sections'
                ? (stepsGroup.sections || []).filter(s => (s.items || []).length > 0)
                : ((stepsGroup.items || []).length > 0 ? [{ key: 'steps', title: 'Steps', items: stepsGroup.items }] : []);
        const hasApps = appCategories.length > 0;

        const tabs = ribbonTabsForScope(scope);
        const tabIds = tabs.map(t => t.id);
        const rawTab = controlledTab ? activeTab : internalTab;
        const tab = tabIds.includes(rawTab) ? rawTab : 'home';

        return (
            <div
                ref={rowRef}
                className={`relative flex flex-col border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/40 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
            >
                {/* Uncontrolled mode renders its own tab strip; controlled mode's
                    tabs live up in the header bar. */}
                {!controlledTab && (
                    <div className="flex items-center gap-2 px-3 pt-1">
                        <Tabs
                            size="sm"
                            ariaLabel="Add-step categories"
                            value={tab}
                            onChange={setInternalTab}
                            items={tabs}
                            className="flex-1 min-w-0"
                        />
                    </div>
                )}

                {/* Groups row: undo/redo (left, Word-style) · active tab clusters
                    (wrap to use the full width — no horizontal scroll) · Find (right). */}
                <div className="flex items-stretch gap-2 px-3 py-1.5">
                    {(onUndo || onRedo) && (
                        <div className="flex flex-col items-center justify-center self-stretch pr-1">
                            <button
                                type="button"
                                onClick={onUndo}
                                disabled={!canUndo}
                                title="Undo (⌘Z)"
                                aria-label="Undo"
                                className="p-1 rounded text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition disabled:opacity-40 disabled:hover:bg-transparent"
                            >
                                <Undo2 size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={onRedo}
                                disabled={!canRedo}
                                title="Redo (⌘⇧Z)"
                                aria-label="Redo"
                                className="p-1 rounded text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition disabled:opacity-40 disabled:hover:bg-transparent"
                            >
                                <Redo2 size={14} />
                            </button>
                        </div>
                    )}

                    <div className="flex-1 min-w-0 flex flex-wrap items-stretch content-start gap-1.5">
                    {tab === 'home' && (
                        <>
                            {freqInline.length > 0 && (
                                <RibbonCluster caption="Frequent">
                                    {freqInline.map(it => (
                                        <CmdButton
                                            key={`${it.key}:${it.label}`}
                                            icon={it.Icon}
                                            glyph={<IntegrationLogo integrationId={it.integrationId} tool={it.tool} size={14} />}
                                            label={it.label}
                                            desc={it.secondary || 'You use this a lot.'}
                                            tipFooter={DRAG_HINT}
                                            onClick={() => add(it.payload)}
                                            grabbable
                                            {...stepDragProps(it.payload)}
                                        />
                                    ))}
                                </RibbonCluster>
                            )}
                            <RibbonCluster caption="AI" single>
                                <CmdButton big accent icon={AI_STEP.icon} label={AI_STEP.label} desc={AI_STEP.desc} tipFooter={DRAG_HINT} onClick={() => add(AI_STEP.payload)} grabbable {...stepDragProps(AI_STEP.payload)} />
                            </RibbonCluster>
                            {flowSections.map(sec => (
                                <RibbonCluster key={sec.key || sec.title} caption={sec.title}>
                                    {sec.items.map(item => (
                                        // A step this graph can't accept stays on the
                                        // ribbon, greyed, with the reason as its tooltip —
                                        // and isn't draggable either (BFSF-348).
                                        <CmdButton
                                            key={item.id}
                                            icon={item.icon}
                                            label={item.label}
                                            desc={item.disabled ? item.disabledReason : item.desc}
                                            tipFooter={item.disabled ? null : DRAG_HINT}
                                            onClick={() => add(item.payload)}
                                            disabled={!!item.disabled}
                                            grabbable={!item.disabled}
                                            {...(item.disabled ? null : stepDragProps(item.payload))}
                                        />
                                    ))}
                                </RibbonCluster>
                            ))}
                            {/* One button, not seven. A routine already HAS a
                                trigger by the time this ribbon shows, so
                                changing or adding one is a rare act — laying
                                all seven out cost a whole second ribbon row
                                for something nobody reaches for daily. The
                                full list is one click away here, and search
                                and browse both carry it too (BFSF-325). */}
                            {allowTriggers && (
                                <RibbonCluster caption="Trigger" single>
                                    <RibbonDropdown
                                        label="Change or add"
                                        icon={Webhook}
                                        open={openKey === '__addTrigger'}
                                        onToggle={() => setOpenKey(k => (k === '__addTrigger' ? null : '__addTrigger'))}
                                    >
                                        <AddStepMenu scope={scope} group={addTriggerGroup} showSearch={false} onAdd={add} onAfterAdd={() => setOpenKey(null)} />
                                    </RibbonDropdown>
                                </RibbonCluster>
                            )}
                        </>
                    )}

                    {tab === 'apps' && hasApps && (
                        appCategories.map(({ category, apps }) => {
                            // A cluster is a 2-row grid, so its width is half
                            // its item count. Nextcloud alone contributes
                            // fourteen apps — seven columns, which is what
                            // pushed the strip onto a second row and doubled
                            // the ribbon's height. Past the cap the rest fold
                            // into one "more" command that opens the same
                            // browse list search and the edge-drop menu use.
                            // The "more" command takes a cell of its own, so it
                            // displaces the last app rather than adding a
                            // thirteenth cell and a seventh column with it.
                            const over = apps.length > RIBBON_APPS_PER_CLUSTER;
                            const shown = over ? apps.slice(0, RIBBON_APPS_PER_CLUSTER - 1) : apps;
                            const hidden = over ? apps.slice(RIBBON_APPS_PER_CLUSTER - 1) : [];
                            return (
                                <RibbonCluster key={category} caption={category}>
                                    {shown.map(app => (
                                        <AppCommand key={app.id} app={app} openKey={openKey} setOpenKey={setOpenKey} onAdd={add} />
                                    ))}
                                    {hidden.length > 0 && (
                                        <MoreAppsCommand
                                            category={category}
                                            apps={hidden}
                                            scope={scope}
                                            open={openKey === `more:${category}`}
                                            onToggle={() => setOpenKey(k => (k === `more:${category}` ? null : `more:${category}`))}
                                            onAdd={add}
                                        />
                                    )}
                                </RibbonCluster>
                            );
                        })
                    )}

                    {tab === 'reusable' && (
                        <>
                            {flowletGroup && (flowletGroup.items || []).length > 0 && (
                                <RibbonCluster caption="Flowlets">
                                    {flowletGroup.items.map(item => (
                                        <CmdButton key={item.id} icon={item.icon} label={item.label} desc={item.desc} tipFooter={DRAG_HINT} onClick={() => add(item.payload)} grabbable {...stepDragProps(item.payload)} />
                                    ))}
                                </RibbonCluster>
                            )}
                            {stepSections.map(sec => (
                                <RibbonCluster key={sec.key || sec.title} caption={sec.title}>
                                    {sec.items.map(item => (
                                        // A step this graph can't accept stays on the
                                        // ribbon, greyed, with the reason as its tooltip —
                                        // and isn't draggable either (BFSF-348).
                                        <CmdButton
                                            key={item.id}
                                            icon={item.icon}
                                            label={item.label}
                                            desc={item.disabled ? item.disabledReason : item.desc}
                                            tipFooter={item.disabled ? null : DRAG_HINT}
                                            onClick={() => add(item.payload)}
                                            disabled={!!item.disabled}
                                            grabbable={!item.disabled}
                                            {...(item.disabled ? null : stepDragProps(item.payload))}
                                        />
                                    ))}
                                </RibbonCluster>
                            ))}
                        </>
                    )}
                    </div>
                </div>
            </div>
        );
    }

    // Standalone: its own bordered toolbar with the collapse affordance.
    return (
        <div ref={rowRef} className={`relative flex items-center gap-1.5 flex-wrap ${barChrome} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <span className="text-[var(--text-tertiary)] mr-0.5"><Plus size={14} /></span>
            {aiButton}
            <span className="mx-1 h-5 w-px bg-[var(--border-default)]" />
            {stepDropdowns}
            {allowTriggers && addTriggerDropdown}
            <div className="ml-auto flex items-center gap-1.5">
                {searchDropdown}
                {autoMapToggle}
                <button
                    type="button"
                    onClick={() => setCollapsed(true)}
                    title="Hide the ribbon"
                    aria-label="Hide the ribbon"
                    className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                >
                    <ChevronsUpDown size={14} />
                </button>
            </div>
        </div>
    );
}

/**
 * Available ribbon tabs for a scope — Home always, Apps when the catalog has
 * integrations, Reusable when there are flowlets or reusable Steps. Exported so
 * BuildTab can render the tab strip in the header bar (controlled mode) using
 * the SAME availability logic the ribbon uses to pick which groups to show.
 */
export function ribbonTabsForScope(scope = {}) {
    const groups = buildStepGroups(scope);
    const flowletGroup = groups.find(g => g.key === 'flowlets');
    const stepsGroup = groups.find(g => g.key === 'steps');
    const hasApps = orderedAppCategories(scope.catalog).length > 0;
    const stepHasItems = !!stepsGroup && (stepsGroup.kind === 'sections'
        ? (stepsGroup.sections || []).some(s => (s.items || []).length > 0)
        : (stepsGroup.items || []).length > 0);
    const hasReusable = (flowletGroup?.items || []).length > 0 || stepHasItems;
    return [
        { id: 'home', label: 'Home', icon: <Home size={13} /> },
        ...(hasApps ? [{ id: 'apps', label: 'Apps', icon: <LayoutGrid size={13} /> }] : []),
        ...(hasReusable ? [{ id: 'reusable', label: 'Reusable', icon: <Boxes size={13} /> }] : []),
    ];
}

/**
 * Standalone "Search steps" control — a self-contained dropdown (own open state
 * + outside-click/Escape) so it can live next to the ribbon tabs in the header
 * bar rather than in the ribbon row. Searches across every addable step.
 */
export function RibbonSearch({ scope = {}, onAdd, disabled = false }) {
    const [open, setOpen] = useState(false);
    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => {
            if (e.target.closest && (e.target.closest('[data-ribbon-search]') || e.target.closest('[data-ribbon-dropdown]'))) return;
            setOpen(false);
        };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDown, true);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onDown, true); document.removeEventListener('keydown', onKey); };
    }, [open]);
    const add = (p) => { onAdd?.(p); setOpen(false); };
    return (
        <span data-ribbon-search className={disabled ? 'opacity-50 pointer-events-none' : ''}>
            <RibbonDropdown
                label="Search"
                icon={Search}
                align="right"
                width={340}
                open={open}
                onToggle={() => setOpen(o => !o)}
            >
                <AddStepMenu scope={scope} showSearch autoFocus onAdd={add} onAfterAdd={() => setOpen(false)} />
            </RibbonDropdown>
        </span>
    );
}

/**
 * What an app IS, in the author's words. The integration catalog carries a
 * curated one-liner per integration ("Chat rooms, messages, reactions"); the
 * action count is the other half of the answer, because it tells you whether
 * clicking opens a menu or adds a step.
 */
function appTip(app) {
    const n = (app.actions || []).length;
    const known = getIntegrationById(app.integrationId) || getIntegrationById(app.id);
    const what = known?.description || `Actions from ${app.label}.`;
    return { title: app.label, desc: what, footer: n === 1 ? DRAG_HINT : `${n} actions — pick one.` };
}

/**
 * Apps-tab command. A single-action app adds that action directly (no
 * dropdown); a multi-action app opens its action list. Either way it shows the
 * app's logo + its SHORT name — the cluster caption above already says
 * NEXTCLOUD, so the button says "Talk".
 */
function AppCommand({ app, openKey, setOpenKey, onAdd }) {
    const actions = app.actions || [];
    const tip = appTip(app);
    if (actions.length === 1) {
        const a = actions[0];
        // The PAYLOAD keeps the full name: a node on the canvas has no cluster
        // caption above it to supply the vendor.
        const payload = { kind: 'integration_action', tool: a.tool, label: app.label, appId: a.integrationId, sideEffect: a.sideEffect };
        return (
            <CmdButton
                glyph={<IntegrationLogo integrationId={app.integrationId} size={14} />}
                label={app.shortLabel || app.label}
                tipTitle={app.label}
                desc={uiDescription(a.description) || tip.desc}
                tipFooter={DRAG_HINT}
                onClick={() => onAdd(payload)}
                grabbable
                {...stepDragProps(payload)}
            />
        );
    }
    const key = `app:${app.id}`;
    return (
        <AppButton
            app={app}
            open={openKey === key}
            onToggle={() => setOpenKey(k => (k === key ? null : key))}
            onAdd={onAdd}
        />
    );
}

/**
 * Multi-action app: the logo + name opens a dropdown of that app's actions, so
 * the exact operation is one extra click.
 */
function AppButton({ app, open, onToggle, onAdd }) {
    const tip = appTip(app);
    return (
        <RibbonDropdown
            glyph={<IntegrationLogo integrationId={app.integrationId} size={16} />}
            label={app.shortLabel || app.label}
            tipTitle={tip.title}
            desc={tip.desc}
            tipFooter={tip.footer}
            width={320}
            open={open}
            onToggle={onToggle}
        >
            <AppActionsList app={app} onAdd={onAdd} />
        </RibbonDropdown>
    );
}

/**
 * The apps a cluster had no room for, behind one command. It reuses AddStepMenu
 * rather than repeating the ribbon's own list, so the folded-away apps get the
 * SAME category → app → action tree (with descriptions) that search and the
 * edge-drop popover show — being past the cap costs a click, not detail.
 */
function MoreAppsCommand({ category, apps, scope, open, onToggle, onAdd }) {
    const group = { key: `more_${category}`, title: category, kind: 'apps', categories: [{ category, apps }] };
    return (
        <RibbonDropdown
            icon={MoreHorizontal}
            label={`${apps.length} more`}
            desc={`${apps.map(a => a.shortLabel || a.label).join(', ')}.`}
            tipFooter={`More ${category} apps than fit on the ribbon.`}
            width={320}
            open={open}
            onToggle={onToggle}
        >
            {/* No onAfterAdd: the ribbon's own `add` already clears openKey,
                and toggling on top of that would flip the panel back open. */}
            <AddStepMenu scope={scope} group={group} showSearch={false} onAdd={onAdd} />
        </RibbonDropdown>
    );
}

// Past this, an app's action list is long enough that reading it top to bottom
// is slower than typing the verb you came for (Files has 34, Talk 18).
const ACTION_FILTER_THRESHOLD = 8;

/**
 * The action list shown when an Apps-tab logo is opened.
 *
 * This used to render the raw tool name and nothing else — "nextcloud talk list
 * rooms", under a heading already reading NEXTCLOUD TALK, with the description
 * that would have explained it passed as `desc`/`tipFooter` props on a plain
 * <button>, where React drops them. So the one surface whose whole job is
 * "which of these 18 do I want" answered with three copies of the app name.
 */
function AppActionsList({ app, onAdd }) {
    const actions = app.actions || [];
    const [q, setQ] = useState('');
    const labels = useMemo(() => actionLabelMap(actions), [actions]);
    const rows = useMemo(() => actions.map(a => ({
        action: a,
        label: labels.get(a.tool) || a.label,
        desc: uiDescription(a.description),
    })), [actions, labels]);
    const needle = q.trim().toLowerCase();
    const visible = needle
        ? rows.filter(r => r.label.toLowerCase().includes(needle)
            || r.desc.toLowerCase().includes(needle)
            || r.action.tool.toLowerCase().includes(needle))
        : rows;

    return (
        <div className="flex flex-col min-h-0">
            <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                {app.label}
            </div>
            {actions.length > ACTION_FILTER_THRESHOLD && (
                <div className="px-2 pb-2">
                    <div className="relative">
                        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                        <input
                            type="text"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder={`Filter ${actions.length} actions…`}
                            className={denseInputClass('w-full pl-7 pr-2')}
                        />
                    </div>
                </div>
            )}
            <div className="flex-1 py-1 overflow-y-auto custom-scrollbar min-h-0">
                {visible.length === 0 ? (
                    <div className="px-3 py-2 text-[11px] text-[var(--text-tertiary)] italic">
                        {actions.length === 0 ? 'No actions available.' : `No action matches “${q}”.`}
                    </div>
                ) : visible.map(({ action, label, desc }) => {
                    // The payload label stays the catalog's full name so the
                    // node on the canvas still says which app it belongs to.
                    const payload = { kind: 'integration_action', tool: action.tool, label: action.label, appId: action.integrationId, sideEffect: action.sideEffect };
                    return (
                        <button
                            key={action.tool}
                            type="button"
                            onClick={() => onAdd(payload)}
                            {...stepDragProps(payload)}
                            title={desc || label}
                            className="w-full text-left flex items-start gap-2.5 px-3 py-1.5 hover:bg-[var(--bg-secondary)] transition"
                        >
                            <span className="shrink-0 mt-0.5 h-6 w-6 rounded-md bg-[var(--bg-secondary)] flex items-center justify-center">
                                <IntegrationLogo integrationId={action.integrationId} tool={action.tool} size={14} />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm text-[var(--text-primary)] truncate">{label}</span>
                                {desc && <span className="block text-[11px] leading-snug text-[var(--text-tertiary)] line-clamp-2">{desc}</span>}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}


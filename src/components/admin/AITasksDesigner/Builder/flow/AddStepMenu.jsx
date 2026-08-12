import React, { useMemo, useRef, useState } from 'react';
import { Search, ChevronDown, ChevronRight, Plus, Layers } from 'lucide-react';
import IntegrationLogo from './nodes/IntegrationLogo';
import { buildStepGroups, buildSearchResults, gated } from './stepPalette';
import { actionLabelMap, uiDescription } from './appLabels';
import { stepDragProps } from './stepDrag';
import { denseInputClass } from './settings/formStyles';

/**
 * Shared "add step" list content — rows, the apps category→app→action tree,
 * and search. Presentation only; positioning/outside-click are owned by the
 * caller (AddStepRibbon dropdown or the edge-drop popover in BuilderShell).
 *
 * Props:
 *   scope      — { catalog, layers, inLayer, canAddLayerOutput, isBlockRoot, mode }
 *   group      — a single group descriptor from buildStepGroups (ribbon dropdown).
 *                Omit to render the FULL menu (all groups, used by the popover).
 *   showSearch — show the search box (default: true when no single `group`)
 *   onAdd(payload) — insert the step
 *   onAfterAdd()   — called after a click-add so the caller can close
 *   autoFocus  — focus the search box on mount
 */
export default function AddStepMenu({ scope = {}, group = null, showSearch, onAdd, onAfterAdd, autoFocus = false }) {
    const [query, setQuery] = useState('');
    const searchRef = useRef(null);
    const searchable = showSearch ?? !group;

    const add = (payload) => { if (!payload) return; onAdd?.(payload); onAfterAdd?.(); };

    const results = useMemo(
        () => (query ? buildSearchResults(query, scope) : []),
        [query, scope],
    );
    const groups = useMemo(
        () => (group ? [group] : buildStepGroups(scope)),
        [group, scope],
    );
    // Smart sections (full menu only): context "Suggested next" + personal
    // "Frequently used", supplied by the caller via scope.
    //
    // Two things happen here that the caller (BuildTab) can't do, because it
    // builds the two lists independently and neither knows about the other:
    //
    //  · DEDUP (BFSF-361). The same step turning up in both blocks read as two
    //    different offers stacked on top of each other. "Suggested next" wins
    //    the tie and keeps its place: it is derived from what THIS graph needs
    //    next, so it is the more specific of the two, and it renders first —
    //    dropping the later copy leaves the rows the eye already scanned
    //    exactly where they were.
    //  · GATING (BFSF-348). These rows bypassed `gated()` entirely, so the
    //    "add a form step without a form trigger → guaranteed validation
    //    error" path was still fully reachable through them.
    const recoGroups = useMemo(() => {
        if (group) return [];
        const out = [];
        const seen = new Set();
        const take = (items) => (Array.isArray(items) ? items : [])
            .filter((r) => {
                const id = recoIdentity(r);
                if (seen.has(id)) return false;
                seen.add(id);
                return true;
            })
            .map(r => gated(r, scope.hasFormTrigger));

        const suggested = take(scope.suggested);
        if (suggested.length) out.push({ key: '__suggested', title: 'Suggested next', accent: true, items: suggested });
        const frequent = take(scope.frequent);
        if (frequent.length) out.push({ key: '__frequent', title: 'Frequently used', accent: false, items: frequent });
        return out;
    }, [group, scope]);

    return (
        <div className="flex flex-col min-h-0">
            {searchable && (
                <div className="p-2 border-b border-[var(--border-default)]">
                    <div className="relative">
                        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                        <input
                            ref={searchRef}
                            type="text"
                            autoFocus={autoFocus}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search steps…"
                            className={denseInputClass('w-full pl-7 pr-2')}
                        />
                    </div>
                </div>
            )}
            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                {query ? (
                    <SearchResults results={results} q={query} onAdd={add} />
                ) : (
                    <>
                        {recoGroups.map(g => (
                            <RecoBlock key={g.key} title={g.title} accent={g.accent} items={g.items} onAdd={add} />
                        ))}
                        {groups.map(g => (
                            <GroupBlock key={g.key} group={g} singleGroup={!!group} onAdd={add} />
                        ))}
                    </>
                )}
            </div>
        </div>
    );
}

/**
 * What makes two reco rows THE SAME offer. Compared on the payload rather than
 * the row's `key`, because the two lists are built by different resolvers and
 * a step id ('set') and a flowlet key can collide there — the payload is what
 * actually gets added, so payloads that would add the same thing are the same
 * thing.
 */
function recoIdentity(r) {
    const p = r?.payload || {};
    const what = p.tool || p.layerKey || p.blockId || p.triggerKind || p.mode || '';
    return `${p.kind || ''}:${what}:${what ? '' : (r?.key || '')}`;
}

/** Smart "Suggested next" / "Frequently used" section (search-result rows). */
function RecoBlock({ title, accent, items, onAdd }) {
    return (
        <div className="border-b border-[var(--border-default)] last:border-b-0">
            <div className={`px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide ${accent ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`}>
                {title}
            </div>
            <div className="py-1">
                {items.map((r, idx) => <SearchResultRow key={`${r.key}:${idx}`} result={r} q="" onAdd={onAdd} />)}
            </div>
        </div>
    );
}

function GroupBlock({ group, singleGroup, onAdd }) {
    // A consolidated group (Flow) renders its category sub-headings directly —
    // they're descriptive enough, so the group title is omitted to avoid a
    // redundant "Flow › Flow control" double heading.
    if (group.kind === 'sections') {
        return (
            <div className="border-b border-[var(--border-default)] last:border-b-0">
                {(group.sections || []).filter(s => (s.items || []).length > 0).map(sec => (
                    <div key={sec.key || sec.title}>
                        <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                            {sec.title}
                        </div>
                        <div className="pb-1.5">
                            {sec.items.map(item => <SimpleRow key={item.id} item={item} onAdd={onAdd} />)}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    const body = group.kind === 'apps'
        ? <AppsTree categories={group.categories || []} onAdd={onAdd} />
        : (group.items || []).map(item => <SimpleRow key={item.id} item={item} onAdd={onAdd} />);
    const empty = group.kind === 'apps' ? (group.categories || []).length === 0 : (group.items || []).length === 0;

    // A single-group dropdown skips the section heading (the dropdown button
    // already names it); the full menu shows headings to separate sections.
    return (
        <div className="border-b border-[var(--border-default)] last:border-b-0">
            {!singleGroup && (
                <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                    {group.title}
                </div>
            )}
            <div className="pb-1.5">
                {empty
                    ? <div className="px-3 py-2 text-[11px] text-[var(--text-tertiary)] italic">Nothing here yet.</div>
                    : body}
            </div>
        </div>
    );
}

function ItemIcon({ item, size = 18 }) {
    if (item?.payload?.kind === 'create_layer') {
        return (
            <span className="relative inline-flex">
                <Layers size={size} />
                <Plus size={Math.max(10, Math.round(size * 0.55))} className="absolute -right-1.5 -bottom-1 rounded-full bg-[var(--bg-secondary)]" />
            </span>
        );
    }
    const Icon = item.icon || Layers;
    return <Icon size={size} />;
}

/**
 * A step the current graph can't accept (stepPalette stamps `disabled` +
 * `disabledReason` — today only the form pages, which need a form trigger).
 * It stays on the list: filtering it out answered "you can't have this" with
 * silence, so neither the step nor the rule behind it was discoverable
 * (BFSF-348). Inert to click, Enter, Space and drag; the reason shows in place
 * of the description.
 */
function SimpleRow({ item, onAdd }) {
    const disabled = !!item.disabled;
    const add = () => { if (!disabled) onAdd(item.payload); };
    return (
        <div
            {...(disabled ? null : stepDragProps(item.payload))}
            onClick={add}
            role="button"
            aria-disabled={disabled || undefined}
            tabIndex={0}
            title={disabled ? item.disabledReason : undefined}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); add(); } }}
            className={`group flex items-center gap-3 px-3 py-2 select-none focus:outline-none ${
                disabled
                    ? 'cursor-not-allowed opacity-55'
                    : 'cursor-pointer hover:bg-[var(--bg-secondary)] focus:bg-[var(--bg-secondary)]'
            }`}
        >
            <div className={`shrink-0 h-8 w-8 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)] ${disabled ? '' : 'group-hover:text-[var(--accent)]'}`}>
                <ItemIcon item={item} size={16} />
            </div>
            {/* Both descriptions get two lines. The enabled one used to get
                `truncate` while the DISABLED one got `line-clamp-2`, so the
                step you can actually add was the one cut mid-sentence — and
                the longest descriptions belong to the steps that most need
                explaining ("Swap personal data for placeholders; the real
                values come back on their own"). */}
            <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-[var(--text-primary)] truncate">{item.label}</div>
                {disabled
                    ? <div className="text-xs text-[var(--text-tertiary)] italic line-clamp-2">{item.disabledReason}</div>
                    : item.desc && <div className="text-xs text-[var(--text-tertiary)] line-clamp-2">{item.desc}</div>}
            </div>
        </div>
    );
}

function AppsTree({ categories, onAdd }) {
    const [openCat, setOpenCat] = useState(categories.length === 1 ? categories[0].category : null);
    const [openApp, setOpenApp] = useState(null);
    if (categories.length === 0) {
        return <div className="px-3 py-2 text-[11px] text-[var(--text-tertiary)] italic">No apps available.</div>;
    }
    return (
        <div>
            {categories.map(({ category, apps }) => (
                <div key={category}>
                    <button
                        type="button"
                        onClick={() => { setOpenCat(c => (c === category ? null : category)); setOpenApp(null); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--bg-secondary)]"
                    >
                        {openCat === category ? <ChevronDown size={14} className="text-[var(--text-tertiary)]" /> : <ChevronRight size={14} className="text-[var(--text-tertiary)]" />}
                        <span className="text-[var(--text-secondary)] font-semibold">{category}</span>
                        <span className="ml-auto text-xs text-[var(--text-tertiary)] tabular-nums">{apps.length}</span>
                    </button>
                    {openCat === category && (
                        <div className="pb-1">
                            {apps.map(app => (
                                <AppRow key={app.id} app={app} isOpen={openApp === app.id} onToggle={() => setOpenApp(a => (a === app.id ? null : app.id))} onAdd={onAdd} />
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

function AppRow({ app, isOpen, onToggle, onAdd }) {
    const notConnected = app.connected === false;
    const primary = app.actions[0];
    // The category row directly above already names the vendor, so the app is
    // shown by its short name here too ("Talk", not "Nextcloud Talk").
    const shownName = app.shortLabel || app.label;
    const labels = useMemo(() => actionLabelMap(app.actions), [app.actions]);
    const appPayload = primary
        ? { kind: 'integration_action', tool: primary.tool, label: app.label, appId: app.integrationId, sideEffect: primary.sideEffect }
        : null;
    return (
        <div>
            <div className="w-full flex items-center gap-2.5 pl-7 pr-2 py-1.5 text-sm hover:bg-[var(--bg-secondary)]">
                {/* The disclosure chevron leads the row, exactly like the
                    category row above it (BFSF-337). It used to sit on the far
                    RIGHT here, so drilling from a category into an app made the
                    eye and the pointer jump across the panel and back for every
                    level of nesting. Left at every depth = one scan column. */}
                <button
                    type="button"
                    onClick={onToggle}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                    title={notConnected ? `${app.label} — connect your account to use these actions at runtime.` : `${app.label} — choose an operation, or + to add it.`}
                >
                    {isOpen
                        ? <ChevronDown size={13} className="shrink-0 text-[var(--text-tertiary)]" />
                        : <ChevronRight size={13} className="shrink-0 text-[var(--text-tertiary)]" />}
                    <IntegrationLogo integrationId={app.integrationId} size={18} />
                    <span className={`truncate font-medium ${notConnected ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>{shownName}</span>
                    {notConnected && (
                        <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] uppercase tracking-wide bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">Connect</span>
                    )}
                    <span className="ml-auto shrink-0 text-xs text-[var(--text-tertiary)] tabular-nums">{app.actions.length}</span>
                </button>
                {appPayload && (
                    <button
                        type="button"
                        {...stepDragProps(appPayload)}
                        onClick={(e) => { e.stopPropagation(); onAdd(appPayload); }}
                        title={`Add ${app.label}`}
                        className="shrink-0 h-6 w-6 rounded-md flex items-center justify-center text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent)]"
                    >
                        <Plus size={14} />
                    </button>
                )}
            </div>
            {/* Indented to line up under the app's LOGO, one step further in
                than the app row's own chevron — so the three levels read as a
                single left-anchored ladder. */}
            {isOpen && app.actions.length > 0 && (
                <div className="pl-11 pr-2 pb-1">
                    {app.actions.map(action => <ActionRow key={action.tool} action={action} labels={labels} onAdd={onAdd} />)}
                </div>
            )}
        </div>
    );
}

/**
 * One operation of an app.
 *
 * Both strings shown here are cleaned up first (see ./appLabels): the catalog
 * labels actions mechanically from the tool name, so this row would otherwise
 * read "nextcloud talk list rooms" directly underneath a row already saying
 * "Nextcloud Talk"; and the description is the LLM tool-schema text, which
 * carries instructions written at the model rather than at the author.
 */
function ActionRow({ action, labels, onAdd }) {
    // The payload keeps the catalog's full label — the node it creates sits on
    // a canvas with no app row above it to say which app this came from.
    const payload = { kind: 'integration_action', tool: action.tool, label: action.label, appId: action.integrationId, sideEffect: action.sideEffect };
    const shown = labels?.get(action.tool) || action.label;
    const description = uiDescription(action.description);
    const hasDistinctDesc = description
        && description.trim().toLowerCase() !== String(shown || '').trim().toLowerCase();
    return (
        <div
            {...stepDragProps(payload)}
            onClick={() => onAdd(payload)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAdd(payload); } }}
            title={description || shown}
            className="flex items-start gap-2.5 px-2 py-1.5 rounded-md cursor-pointer select-none hover:bg-[var(--bg-tertiary)] focus:bg-[var(--bg-tertiary)] focus:outline-none"
        >
            <div className="shrink-0 mt-0.5 h-6 w-6 rounded-md bg-[var(--bg-secondary)] flex items-center justify-center">
                <IntegrationLogo integrationId={action.integrationId} tool={action.tool} size={13} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-[var(--text-primary)]">{shown}</div>
                {/* Two lines, not `truncate`: these descriptions are the only
                    thing on the row that says what the action does, and one
                    clipped line of "List the Nextcloud Tables the user can…"
                    is barely more use than none. */}
                {hasDistinctDesc && <div className="text-xs leading-snug text-[var(--text-tertiary)] line-clamp-2">{description}</div>}
            </div>
        </div>
    );
}

function SearchResults({ results, q, onAdd }) {
    if (results.length === 0) {
        return <div className="px-3 py-6 text-xs text-[var(--text-tertiary)] italic text-center">No matches for &ldquo;{q}&rdquo;</div>;
    }
    return (
        <div className="py-1">
            {results.map((r, i) => <SearchResultRow key={`${r.key}:${i}`} result={r} q={q} onAdd={onAdd} />)}
        </div>
    );
}

function SearchResultRow({ result, q, onAdd }) {
    const Icon = result.Icon;
    // Same rule as SimpleRow: a result the graph can't accept is findable and
    // explains itself rather than not being a result at all.
    const disabled = !!result.disabled;
    const add = () => { if (!disabled) onAdd(result.payload); };
    return (
        <div
            {...(disabled ? null : stepDragProps(result.payload))}
            onClick={add}
            role="button"
            aria-disabled={disabled || undefined}
            tabIndex={0}
            title={disabled ? result.disabledReason : undefined}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); add(); } }}
            className={`group flex items-center gap-3 px-3 py-2 select-none focus:outline-none ${
                disabled
                    ? 'cursor-not-allowed opacity-55'
                    : 'cursor-pointer hover:bg-[var(--bg-secondary)] focus:bg-[var(--bg-secondary)]'
            }`}
        >
            <div className="shrink-0 h-8 w-8 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)]">
                {Icon ? <Icon size={16} /> : <IntegrationLogo integrationId={result.integrationId} tool={result.tool} size={16} />}
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-sm text-[var(--text-primary)] truncate">{highlightMatch(result.label, q)}</div>
                {disabled
                    ? <div className="text-xs text-[var(--text-tertiary)] italic line-clamp-2">{result.disabledReason}</div>
                    : result.secondary && <div className="text-xs text-[var(--text-tertiary)] truncate">{result.secondary}</div>}
            </div>
            {result.context && <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">{result.context}</span>}
        </div>
    );
}

function highlightMatch(text, q) {
    if (!q || !text) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
        <>
            {text.slice(0, idx)}
            <mark className="bg-transparent font-semibold text-[var(--text-primary)]">{text.slice(idx, idx + q.length)}</mark>
            {text.slice(idx + q.length)}
        </>
    );
}

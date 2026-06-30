import React, { useMemo, useRef, useState } from 'react';
import { Search, ChevronDown, ChevronRight, Plus, Layers } from 'lucide-react';
import IntegrationLogo from './nodes/IntegrationLogo';
import { buildStepGroups, buildSearchResults } from './stepPalette';

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
    const recoGroups = useMemo(() => {
        if (group) return [];
        const out = [];
        if (Array.isArray(scope.suggested) && scope.suggested.length) {
            out.push({ key: '__suggested', title: 'Suggested next', accent: true, items: scope.suggested });
        }
        if (Array.isArray(scope.frequent) && scope.frequent.length) {
            out.push({ key: '__frequent', title: 'Frequently used', accent: false, items: scope.frequent });
        }
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
                            className="w-full pl-7 pr-2 py-1.5 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
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

function SimpleRow({ item, onAdd }) {
    const onDragStart = (e) => {
        e.dataTransfer.setData('application/x-automation-step', JSON.stringify(item.payload));
        e.dataTransfer.effectAllowed = 'move';
    };
    return (
        <div
            draggable
            onDragStart={onDragStart}
            onClick={() => onAdd(item.payload)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAdd(item.payload); } }}
            className="group flex items-center gap-3 px-3 py-2 cursor-pointer select-none hover:bg-[var(--bg-secondary)] focus:bg-[var(--bg-secondary)] focus:outline-none"
        >
            <div className="shrink-0 h-8 w-8 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)] group-hover:text-[var(--accent)]">
                <ItemIcon item={item} size={16} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-[var(--text-primary)] truncate">{item.label}</div>
                {item.desc && <div className="text-xs text-[var(--text-tertiary)] truncate">{item.desc}</div>}
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
    const appPayload = primary
        ? { kind: 'integration_action', tool: primary.tool, label: app.label, appId: app.integrationId, sideEffect: primary.sideEffect }
        : null;
    const onAppDragStart = (e) => {
        if (!appPayload) return;
        e.dataTransfer.setData('application/x-automation-step', JSON.stringify(appPayload));
        e.dataTransfer.effectAllowed = 'move';
    };
    return (
        <div>
            <div className="w-full flex items-center gap-2.5 pl-7 pr-2 py-1.5 text-sm hover:bg-[var(--bg-secondary)]">
                <button
                    type="button"
                    onClick={onToggle}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                    title={notConnected ? `${app.label} — connect your account to use these actions at runtime.` : `${app.label} — choose an operation, or + to add it.`}
                >
                    <IntegrationLogo integrationId={app.integrationId} size={18} />
                    <span className={`truncate font-medium ${notConnected ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>{app.label}</span>
                    {notConnected && (
                        <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] uppercase tracking-wide bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">Connect</span>
                    )}
                    <span className="ml-auto text-xs text-[var(--text-tertiary)] tabular-nums">{app.actions.length}</span>
                    {isOpen ? <ChevronDown size={13} className="text-[var(--text-tertiary)]" /> : <ChevronRight size={13} className="text-[var(--text-tertiary)]" />}
                </button>
                {appPayload && (
                    <button
                        type="button"
                        draggable
                        onDragStart={onAppDragStart}
                        onClick={(e) => { e.stopPropagation(); onAdd(appPayload); }}
                        title={`Add ${app.label}`}
                        className="shrink-0 h-6 w-6 rounded-md flex items-center justify-center text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent)]"
                    >
                        <Plus size={14} />
                    </button>
                )}
            </div>
            {isOpen && app.actions.length > 0 && (
                <div className="pl-9 pr-2 pb-1">
                    {app.actions.map(action => <ActionRow key={action.tool} action={action} onAdd={onAdd} />)}
                </div>
            )}
        </div>
    );
}

function ActionRow({ action, onAdd }) {
    const payload = { kind: 'integration_action', tool: action.tool, label: action.label, appId: action.integrationId, sideEffect: action.sideEffect };
    const onDragStart = (e) => {
        e.dataTransfer.setData('application/x-automation-step', JSON.stringify(payload));
        e.dataTransfer.effectAllowed = 'move';
    };
    const hasDistinctDesc = action.description
        && action.description.trim().toLowerCase() !== (action.label || '').trim().toLowerCase();
    return (
        <div
            draggable
            onDragStart={onDragStart}
            onClick={() => onAdd(payload)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAdd(payload); } }}
            title={action.description || action.label}
            className="flex items-start gap-2.5 px-2 py-1.5 rounded-md cursor-pointer select-none hover:bg-[var(--bg-tertiary)] focus:bg-[var(--bg-tertiary)] focus:outline-none"
        >
            <div className="shrink-0 mt-0.5 h-6 w-6 rounded-md bg-[var(--bg-secondary)] flex items-center justify-center">
                <IntegrationLogo integrationId={action.integrationId} tool={action.tool} size={13} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-[var(--text-primary)]">{action.label}</div>
                {hasDistinctDesc && <div className="truncate text-xs text-[var(--text-tertiary)]">{action.description}</div>}
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
    const onDragStart = (e) => {
        e.dataTransfer.setData('application/x-automation-step', JSON.stringify(result.payload));
        e.dataTransfer.effectAllowed = 'move';
    };
    const Icon = result.Icon;
    return (
        <div
            draggable
            onDragStart={onDragStart}
            onClick={() => onAdd(result.payload)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAdd(result.payload); } }}
            className="group flex items-center gap-3 px-3 py-2 cursor-pointer select-none hover:bg-[var(--bg-secondary)] focus:bg-[var(--bg-secondary)] focus:outline-none"
        >
            <div className="shrink-0 h-8 w-8 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)]">
                {Icon ? <Icon size={16} /> : <IntegrationLogo integrationId={result.integrationId} tool={result.tool} size={16} />}
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-sm text-[var(--text-primary)] truncate">{highlightMatch(result.label, q)}</div>
                {result.secondary && <div className="text-xs text-[var(--text-tertiary)] truncate">{result.secondary}</div>}
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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Sparkles, GitBranch, Repeat, Code, Bell, Webhook, Clock, MousePointer2, Zap,
    Search, X, ChevronDown, ChevronRight,
    Pencil, Hourglass, OctagonX, Split, Filter, ChevronsDown, Copy, Layers, Sigma,
} from 'lucide-react';
import useAutomationApi from '../../../../../hooks/useAutomationApi';
import IntegrationLogo from './nodes/IntegrationLogo';
import { resolveIntegrationFromTool } from '../../../../../utils/integrationIcons';
import { INTEGRATION_CATALOG, CATEGORY_ORDER as INTEGRATION_CATEGORY_ORDER } from '../../../../../config/integrationCatalog';

/**
 * Right-side slide-in node palette modeled after n8n's add-node panel.
 *
 * Two contextual modes:
 *   - mode='trigger':  empty canvas → vertical list of trigger types
 *                      with name + description (mirrors n8n's "What
 *                      triggers this workflow?" picker).
 *   - mode='step':     trigger exists → AI step + Apps (collapsible per
 *                      category) + Logic + Code (when flag enabled).
 *
 * Search input filters across triggers, integrations, actions, and
 * logic. Empty query renders the categorised tree; non-empty query
 * collapses into a flat ranked result list with the matched substring
 * highlighted via <mark>.
 *
 * Every row supports BOTH drag (HTML5 dataTransfer with the existing
 * `application/x-automation-step` MIME — DiagramPane.onDrop handles it)
 * AND click (calls onAddNode(payload), parent inserts at canvas centre).
 *
 * Open paths (all routed through BuilderShell):
 *   a. Auto-open on empty draft.
 *   b. AddNodeFab "+" button bottom-right.
 *   c. Edge-end-drop → DiagramPane.onConnectEnd → onRequestAddNode.
 *
 * `disabled=true` greys the panel out while the SSE stream is patching
 * the definition — a human edit racing the AI patch would tear the draft.
 */
export default function NodePalette({
    open,
    onClose,
    mode = 'step',
    disabled = false,
    onAddNode,
}) {
    const api = useAutomationApi();
    const [catalog, setCatalog] = useState(null);
    const [query, setQuery] = useState('');
    const [openCategory, setOpenCategory] = useState(null);
    const [openApp, setOpenApp] = useState(null);
    const searchRef = useRef(null);
    const panelRef = useRef(null);

    useEffect(() => {
        let alive = true;
        api.getCatalog().then(c => { if (alive) setCatalog(c); }).catch(() => {});
        return () => { alive = false; };
    }, [api]);

    // Focus the search input when the panel opens. Reset transient
    // browse state too — opening fresh shouldn't restore an old expand.
    useEffect(() => {
        if (!open) return;
        const t = setTimeout(() => searchRef.current?.focus(), 50);
        return () => clearTimeout(t);
    }, [open]);

    // Reset query / expand state on close so re-opening starts clean.
    // Intentional: synchronising local UI state with the controlled
    // `open` prop is exactly what useEffect is for here.
    useEffect(() => {
        if (!open) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setQuery('');
            setOpenCategory(null);
            setOpenApp(null);
        }
    }, [open]);

    // Keyboard:
    //   Esc with text in search → clear search (don't surprise users out).
    //   Esc with empty search   → close panel.
    //   "/" anywhere           → focus search (n8n pattern).
    useEffect(() => {
        if (!open) return;
        function onKey(e) {
            if (e.key === 'Escape') {
                if (query) { setQuery(''); }
                else { onClose?.(); }
            } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                e.preventDefault();
                searchRef.current?.focus();
            }
        }
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, query, onClose]);

    // Click-outside: close when clicking outside the panel AND outside
    // the FAB (the FAB has data-node-fab; clicking it should toggle, not
    // re-open instantly via this handler).
    useEffect(() => {
        if (!open) return;
        function onDown(e) {
            if (!panelRef.current) return;
            if (panelRef.current.contains(e.target)) return;
            if (e.target.closest?.('[data-node-fab]')) return;
            onClose?.();
        }
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open, onClose]);

    const handleAdd = (payload) => {
        if (!payload) return;
        // Whether to close after the add is the parent's call — for
        // edge-drop continuation we want to close (single insert), but
        // for FAB / auto-open we want to keep the panel up so the user
        // can stack multiple nodes without re-opening it.
        onAddNode?.(payload);
    };

    // Drag path: leave panel open. The parent can close via onAddNode
    // semantics if needed. A successful drop already triggers the
    // parent's onVisualEdit which renders the new node on the canvas.
    const handleDragEnd = () => {};

    return (
        <aside
            ref={panelRef}
            aria-hidden={!open}
            aria-label="Add node"
            className={`absolute top-0 right-0 h-full w-[360px] z-30 flex flex-col
                bg-[var(--bg-primary)] border-l border-[var(--border-default)]
                shadow-[-6px_0_16px_rgba(0,0,0,0.08)]
                transition-transform duration-200 ease-out
                ${open ? 'translate-x-0' : 'translate-x-full pointer-events-none'}
                ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        >
            <PanelHeader mode={mode} onClose={onClose} />
            <PanelSearch ref={searchRef} value={query} onChange={setQuery} />
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {query ? (
                    <SearchResults
                        q={query}
                        catalog={catalog}
                        mode={mode}
                        onAdd={handleAdd}
                        onDragEnd={handleDragEnd}
                    />
                ) : mode === 'trigger' ? (
                    <TriggerPickerView
                        onAdd={handleAdd}
                        onDragEnd={handleDragEnd}
                    />
                ) : (
                    <StepPickerView
                        catalog={catalog}
                        openCategory={openCategory}
                        setOpenCategory={setOpenCategory}
                        openApp={openApp}
                        setOpenApp={setOpenApp}
                        onAdd={handleAdd}
                        onDragEnd={handleDragEnd}
                    />
                )}
            </div>
            <PanelFooter />
        </aside>
    );
}

// ─── Header / Search / Footer ────────────────────────────────────────

function PanelHeader({ mode, onClose }) {
    const isTrigger = mode === 'trigger';
    return (
        <div className="px-4 pt-3 pb-2 border-b border-[var(--border-default)]">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                        {isTrigger ? 'What triggers this workflow?' : 'Add a step'}
                    </h3>
                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                        {isTrigger
                            ? 'A trigger is a step that starts your workflow'
                            : 'Pick an action, logic, or AI step to continue'}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    title="Close"
                    aria-label="Close panel"
                    className="shrink-0 p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                >
                    <X size={14} />
                </button>
            </div>
        </div>
    );
}

const PanelSearch = React.forwardRef(function PanelSearch({ value, onChange }, ref) {
    return (
        <div className="px-3 py-2 border-b border-[var(--border-default)]">
            <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <input
                    ref={ref}
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="Search nodes…"
                    className="w-full pl-7 pr-2 py-1.5 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
            </div>
        </div>
    );
});

function PanelFooter() {
    return (
        <div className="px-3 py-2 border-t border-[var(--border-default)] text-[10px] text-[var(--text-tertiary)]">
            Drag onto the canvas or click to add
        </div>
    );
}

// ─── Trigger picker (empty canvas) ──────────────────────────────────

const TRIGGERS = [
    {
        id: 'manual',
        icon: MousePointer2,
        label: 'Trigger manually',
        desc: 'Run from a button click',
        keywords: 'manual click run button',
        payload: { kind: 'trigger', triggerKind: 'manual', label: 'Manual' },
    },
    {
        id: 'schedule',
        icon: Clock,
        label: 'On a schedule',
        desc: 'Run on a recurring time (cron)',
        keywords: 'schedule cron time recurring daily hourly',
        payload: { kind: 'trigger', triggerKind: 'schedule', label: 'Schedule' },
    },
    {
        id: 'webhook',
        icon: Webhook,
        label: 'On webhook call',
        desc: 'Run when an HTTP request arrives',
        keywords: 'webhook http post request inbound',
        payload: { kind: 'trigger', triggerKind: 'webhook', label: 'Webhook' },
    },
    {
        id: 'app_event',
        icon: Zap,
        label: 'On app event',
        desc: 'Run when something happens in Gmail, Calendar, Drive, Nextcloud',
        keywords: 'app event push gmail nextcloud github calendar drive',
        payload: { kind: 'trigger', triggerKind: 'app_event', label: 'App event' },
    },
];

function TriggerPickerView({ onAdd, onDragEnd }) {
    return (
        <div className="py-1">
            {TRIGGERS.map(t => (
                <TriggerRow key={t.id} trigger={t} onAdd={onAdd} onDragEnd={onDragEnd} />
            ))}
        </div>
    );
}

function TriggerRow({ trigger, onAdd, onDragEnd }) {
    const Icon = trigger.icon;
    const onDragStart = (e) => {
        e.dataTransfer.setData('application/x-automation-step', JSON.stringify(trigger.payload));
        e.dataTransfer.effectAllowed = 'move';
    };
    return (
        <div
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={() => onAdd(trigger.payload)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAdd(trigger.payload); } }}
            className="group flex items-start gap-3 px-4 py-3 cursor-pointer select-none hover:bg-[var(--bg-secondary)] focus:bg-[var(--bg-secondary)] focus:outline-none"
        >
            <div className="shrink-0 mt-0.5 h-10 w-10 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)] group-hover:text-[var(--accent)]">
                <Icon size={20} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-[var(--text-primary)]">{trigger.label}</div>
                <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{trigger.desc}</div>
            </div>
            <ChevronRight size={16} className="shrink-0 self-center text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100" />
        </div>
    );
}

// ─── Step picker (trigger exists) ───────────────────────────────────

// Flow control / branching primitives. Two of them are aliases of the
// existing `condition` step type — different palette labels for clarity,
// same step type under the hood.
const LOGIC_ITEMS = [
    { id: 'condition',  icon: GitBranch, label: 'If',           desc: 'Route items to then/else branches',
      keywords: 'condition branch if else expression conditional', payload: { kind: 'condition', label: 'If' } },
    { id: 'switch',     icon: Split,     label: 'Switch',       desc: 'Multi-way branch by case name',
      keywords: 'switch case route multiway match',               payload: { kind: 'switch', label: 'Switch' } },
    { id: 'filter_route', icon: Filter,  label: 'Filter (route)', desc: 'Drop the run when expression is false',
      keywords: 'filter route stop drop guard',                   payload: { kind: 'condition', label: 'Filter (route)' } },
    { id: 'loop',       icon: Repeat,    label: 'Loop Over Items', desc: 'Iterate over an array',
      keywords: 'loop foreach iterate array items',               payload: { kind: 'loop', label: 'Loop Over Items' } },
    { id: 'wait',       icon: Hourglass, label: 'Wait',         desc: 'Pause the run for N seconds',
      keywords: 'wait sleep delay pause timer',                   payload: { kind: 'wait', label: 'Wait' } },
    { id: 'stop_error', icon: OctagonX,  label: 'Stop and Error', desc: 'Halt the run with an error message',
      keywords: 'stop error throw halt fail abort guardrail',     payload: { kind: 'stop_error', label: 'Stop and error' } },
    { id: 'notification', icon: Bell,    label: 'Notification', desc: 'Send a message or alert',
      keywords: 'notification notify alert message',              payload: { kind: 'notification', label: 'Notification' } },
];

// Data manipulation primitives — Set + DateTime.
const DATA_ITEMS = [
    { id: 'set',      icon: Pencil, label: 'Edit Fields (Set)', desc: 'Build an object from explicit field bindings',
      keywords: 'set edit fields assign rename restructure mapping', payload: { kind: 'set', label: 'Edit fields' } },
    { id: 'datetime', icon: Clock,  label: 'Date & Time',       desc: 'Now, parse, format, add/subtract, diff, extract',
      keywords: 'date time datetime format parse add days hours minutes diff extract', payload: { kind: 'datetime', label: 'Date & Time' } },
];

// Collection operations — all take an array ref.
const COLLECTION_ITEMS = [
    { id: 'filter',    icon: Filter,       label: 'Filter (collection)', desc: 'Keep items matching a condition',
      keywords: 'filter where keep items collection array',                payload: { kind: 'filter', label: 'Filter' } },
    { id: 'limit',     icon: ChevronsDown, label: 'Limit',               desc: 'First or last N items of an array',
      keywords: 'limit take first last slice top',                         payload: { kind: 'limit', label: 'Limit' } },
    { id: 'dedupe',    icon: Copy,         label: 'Remove Duplicates',   desc: 'Drop duplicate items (by field or deep-equal)',
      keywords: 'dedupe duplicates unique distinct',                       payload: { kind: 'dedupe', label: 'Remove duplicates' } },
    { id: 'aggregate', icon: Layers,       label: 'Aggregate',           desc: 'Pull one field across items into a flat list',
      keywords: 'aggregate collect pluck pick field values',               payload: { kind: 'aggregate', label: 'Aggregate' } },
    { id: 'summarize', icon: Sigma,        label: 'Summarize',           desc: 'Sum, count, avg, min, or max of a field',
      keywords: 'summarize sum count avg min max statistics aggregate',    payload: { kind: 'summarize', label: 'Summarize' } },
];

const AI_STEP = {
    id: 'ai_step', icon: Sparkles, label: 'AI step', desc: 'Reason and call tools with Claude',
    keywords: 'ai prompt llm claude reason',
    payload: { kind: 'ai_step', label: 'AI step' },
};

const CODE_ITEM = {
    id: 'code', icon: Code, label: 'Code', desc: 'Run custom JavaScript',
    keywords: 'code javascript js script custom',
    payload: { kind: 'code', label: 'Code' },
};

// Mirror the shared integration section order, then a trailing 'Other' bucket
// for apps that fell through buildCategoryMap().
const CATEGORY_ORDER = [...INTEGRATION_CATEGORY_ORDER, 'Other'];

function StepPickerView({ catalog, openCategory, setOpenCategory, openApp, setOpenApp, onAdd, onDragEnd }) {
    const grouped = useMemo(() => groupAppsByCategory(catalog), [catalog]);

    return (
        <div>
            <Section title="AI">
                <SimpleRow item={AI_STEP} onAdd={onAdd} onDragEnd={onDragEnd} />
            </Section>

            <Section title="Actions in app">
                {!catalog && (
                    <div className="px-4 py-2 text-[11px] text-[var(--text-tertiary)] italic">Loading apps…</div>
                )}
                {catalog && Object.entries(grouped).length === 0 && (
                    <div className="px-4 py-2 text-[11px] text-[var(--text-tertiary)] italic">No apps available.</div>
                )}
                {catalog && CATEGORY_ORDER.map(cat => {
                    const apps = grouped[cat];
                    if (!apps || apps.length === 0) return null;
                    return (
                        <CategoryGroup
                            key={cat}
                            category={cat}
                            apps={apps}
                            isOpen={openCategory === cat}
                            onToggle={() => {
                                setOpenCategory(prev => prev === cat ? null : cat);
                                setOpenApp(null);
                            }}
                            openApp={openApp}
                            setOpenApp={setOpenApp}
                            onAdd={onAdd}
                            onDragEnd={onDragEnd}
                        />
                    );
                })}
            </Section>

            <Section title="Data">
                {DATA_ITEMS.map(item => (
                    <SimpleRow key={item.id} item={item} onAdd={onAdd} onDragEnd={onDragEnd} />
                ))}
            </Section>

            <Section title="Collection">
                {COLLECTION_ITEMS.map(item => (
                    <SimpleRow key={item.id} item={item} onAdd={onAdd} onDragEnd={onDragEnd} />
                ))}
            </Section>

            <Section title="Flow">
                {LOGIC_ITEMS.map(item => (
                    <SimpleRow key={item.id} item={item} onAdd={onAdd} onDragEnd={onDragEnd} />
                ))}
            </Section>

            {catalog?.flags?.code && (
                <Section title="Code">
                    <SimpleRow item={CODE_ITEM} onAdd={onAdd} onDragEnd={onDragEnd} />
                </Section>
            )}
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div className="border-b border-[var(--border-default)] last:border-b-0">
            <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                {title}
            </div>
            <div className="pb-2">{children}</div>
        </div>
    );
}

function SimpleRow({ item, onAdd, onDragEnd }) {
    const Icon = item.icon;
    const onDragStart = (e) => {
        e.dataTransfer.setData('application/x-automation-step', JSON.stringify(item.payload));
        e.dataTransfer.effectAllowed = 'move';
    };
    return (
        <div
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={() => onAdd(item.payload)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAdd(item.payload); } }}
            className="group flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none hover:bg-[var(--bg-secondary)] focus:bg-[var(--bg-secondary)] focus:outline-none"
        >
            <div className="shrink-0 h-9 w-9 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)] group-hover:text-[var(--accent)]">
                <Icon size={18} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-[var(--text-primary)]">{item.label}</div>
                <div className="text-xs text-[var(--text-tertiary)] truncate">{item.desc}</div>
            </div>
        </div>
    );
}

function CategoryGroup({ category, apps, isOpen, onToggle, openApp, setOpenApp, onAdd, onDragEnd }) {
    return (
        <div>
            <button
                type="button"
                onClick={onToggle}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-[var(--bg-secondary)]"
            >
                {isOpen ? <ChevronDown size={14} className="text-[var(--text-tertiary)]" /> : <ChevronRight size={14} className="text-[var(--text-tertiary)]" />}
                <span className="text-[var(--text-secondary)] font-semibold">{category}</span>
                <span className="ml-auto text-xs text-[var(--text-tertiary)] tabular-nums">{apps.length}</span>
            </button>
            {isOpen && (
                <div className="pb-1">
                    {apps.map(app => (
                        <AppRow
                            key={app.id}
                            app={app}
                            isOpen={openApp === app.id}
                            onToggle={() => setOpenApp(prev => prev === app.id ? null : app.id)}
                            onAdd={onAdd}
                            onDragEnd={onDragEnd}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function AppRow({ app, isOpen, onToggle, onAdd, onDragEnd }) {
    const notConnected = app.connected === false;
    return (
        <div>
            <button
                type="button"
                onClick={onToggle}
                className="w-full flex items-center gap-2.5 pl-8 pr-3 py-2 text-sm hover:bg-[var(--bg-secondary)]"
                title={notConnected ? `${app.label} — connect your account to use these actions at runtime.` : app.label}
            >
                <IntegrationLogo integrationId={app.integrationId} size={18} />
                <span className={`truncate font-medium ${notConnected ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>{app.label}</span>
                {notConnected && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] uppercase tracking-wide bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                        Connect
                    </span>
                )}
                <span className="ml-auto text-xs text-[var(--text-tertiary)] tabular-nums">{app.actions.length}</span>
                {isOpen ? <ChevronDown size={13} className="text-[var(--text-tertiary)]" /> : <ChevronRight size={13} className="text-[var(--text-tertiary)]" />}
            </button>
            {isOpen && app.actions.length > 0 && (
                <div className="pl-10 pr-2 pb-1">
                    {app.actions.map(action => (
                        <ActionRow key={action.tool} action={action} onAdd={onAdd} onDragEnd={onDragEnd} />
                    ))}
                </div>
            )}
        </div>
    );
}

function ActionRow({ action, onAdd, onDragEnd }) {
    const payload = { kind: 'integration_action', tool: action.tool, label: action.label };
    const onDragStart = (e) => {
        e.dataTransfer.setData('application/x-automation-step', JSON.stringify(payload));
        e.dataTransfer.effectAllowed = 'move';
    };
    // Only show description as secondary text when it's actually
    // different from the label — otherwise it's just visual noise
    // (e.g. action.label="webpages list", action.tool="webpages_list").
    const hasDistinctDesc = action.description
        && action.description.trim().toLowerCase() !== (action.label || '').trim().toLowerCase();
    return (
        <div
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={() => onAdd(payload)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAdd(payload); } }}
            title={action.description ? `${action.tool}\n\n${action.description}` : action.tool}
            className="flex items-start gap-2.5 px-2 py-2 rounded-md cursor-pointer select-none hover:bg-[var(--bg-tertiary)] focus:bg-[var(--bg-tertiary)] focus:outline-none"
        >
            <div className="shrink-0 mt-0.5 h-7 w-7 rounded-md bg-[var(--bg-secondary)] flex items-center justify-center">
                <IntegrationLogo integrationId={action.integrationId} tool={action.tool} size={14} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-[var(--text-primary)]">{action.label}</div>
                {hasDistinctDesc && (
                    <div className="truncate text-xs text-[var(--text-tertiary)]">{action.description}</div>
                )}
            </div>
        </div>
    );
}

// ─── Search ──────────────────────────────────────────────────────────

function SearchResults({ q, catalog, mode, onAdd, onDragEnd }) {
    const results = useMemo(() => buildSearchResults(q, catalog, mode), [q, catalog, mode]);
    if (results.length === 0) {
        return (
            <div className="px-4 py-6 text-xs text-[var(--text-tertiary)] italic text-center">
                No matches for &ldquo;{q}&rdquo;
            </div>
        );
    }
    return (
        <div className="py-1">
            {results.map((r, i) => (
                <SearchResultRow key={`${r.kind}:${r.key}:${i}`} result={r} q={q} onAdd={onAdd} onDragEnd={onDragEnd} />
            ))}
        </div>
    );
}

function SearchResultRow({ result, q, onAdd, onDragEnd }) {
    const onDragStart = (e) => {
        e.dataTransfer.setData('application/x-automation-step', JSON.stringify(result.payload));
        e.dataTransfer.effectAllowed = 'move';
    };
    return (
        <div
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={() => onAdd(result.payload)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAdd(result.payload); } }}
            className="group flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none hover:bg-[var(--bg-secondary)] focus:bg-[var(--bg-secondary)] focus:outline-none"
        >
            <div className="shrink-0 h-9 w-9 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center">
                {result.icon}
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-sm text-[var(--text-primary)] truncate">{highlightMatch(result.label, q)}</div>
                {result.secondary && (
                    <div className="text-xs text-[var(--text-tertiary)] truncate">{result.secondary}</div>
                )}
            </div>
            {result.context && (
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
                    {result.context}
                </span>
            )}
        </div>
    );
}

function highlightMatch(text, q) {
    if (!q || !text) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + q.length);
    const after = text.slice(idx + q.length);
    return (
        <>
            {before}<mark className="bg-transparent font-semibold text-[var(--text-primary)]">{match}</mark>{after}
        </>
    );
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Build the lookup from catalog `app.id` to category by joining the
 * runtime catalog (server's TOOL_REGISTRY) with the static
 * INTEGRATION_CATALOG metadata. IDs are normalised to underscore form
 * so 'google-calendar' (catalog) matches 'google_calendar' (registry).
 */
function buildCategoryMap() {
    const map = new Map();
    for (const entry of INTEGRATION_CATALOG) {
        map.set(normalizeId(entry.id), entry.category || 'Other');
    }
    return map;
}

function normalizeId(id) {
    return String(id || '').toLowerCase().replace(/-/g, '_');
}

function groupAppsByCategory(catalog) {
    if (!catalog?.apps) return {};
    const catMap = buildCategoryMap();
    const out = {};
    for (const a of catalog.apps) {
        // n8n-style: every app the org allows shows in the palette, even
        // before the user has connected credentials. The `connected` flag
        // (true when the user can invoke the tool RIGHT NOW) drives a
        // "Connect to use" badge on the card. `available` (legacy union of
        // connected || org-enabled) is the gate.
        if (!a.available) continue;
        const allActions = (a.actions || []).map(act => ({
            kind: 'integration_action',
            tool: act.name,
            label: act.label || prettifyToolName(act.name),
            description: act.description,
            integrationId: act.integrationId || resolveIntegrationFromTool(act.name) || a.id,
        }));
        if (allActions.length === 0) continue;
        const integrationId = allActions[0].integrationId || a.id;
        const category = catMap.get(normalizeId(a.id)) || catMap.get(normalizeId(integrationId)) || 'Other';
        if (category === 'Other' && import.meta.env?.DEV) {
            // Surfaces apps that fell through the static INTEGRATION_CATALOG
            // category map — usually a missing entry we should backfill.
            // eslint-disable-next-line no-console
            console.debug(`[NodePalette] no category for app "${a.id}" — falling back to "Other".`);
        }
        const entry = {
            id: a.id,
            label: a.label,
            integrationId,
            actions: allActions,
            // Surface "not yet connected" so the row can render a hint.
            // `connected` is missing for older server builds — default true
            // (don't render the badge) to stay backward-compatible.
            connected: a.connected !== false,
        };
        (out[category] = out[category] || []).push(entry);
    }
    // Stable alphabetical order within each category.
    for (const k of Object.keys(out)) {
        out[k].sort((x, y) => x.label.localeCompare(y.label));
    }
    return out;
}

/**
 * Build the flat ranked search result list. Buckets:
 *   0 = exact label match
 *   1 = label starts with q
 *   2 = label contains q
 *   3 = description / keywords / tool name contains q
 * Within each bucket items keep their iteration order.
 */
function buildSearchResults(query, catalog, mode) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const candidates = collectAllCandidates(catalog, mode);
    const ranked = [];
    for (const c of candidates) {
        const label = (c.label || '').toLowerCase();
        const desc = (c.secondary || c.description || '').toLowerCase();
        const tool = (c.tool || '').toLowerCase();
        const kw = (c.keywords || '').toLowerCase();
        let bucket = -1;
        if (label === q) bucket = 0;
        else if (label.startsWith(q)) bucket = 1;
        else if (label.includes(q)) bucket = 2;
        else if (desc.includes(q) || kw.includes(q) || tool.includes(q)) bucket = 3;
        if (bucket === -1) continue;
        ranked.push({ ...c, _bucket: bucket });
    }
    ranked.sort((a, b) => a._bucket - b._bucket);
    return ranked;
}

function collectAllCandidates(catalog, mode) {
    const out = [];

    // Triggers — only relevant when picking a trigger. In step mode the
    // user can't add another trigger, so don't surface them in search.
    if (mode === 'trigger') {
        for (const t of TRIGGERS) {
            const Icon = t.icon;
            out.push({
                kind: 'trigger', key: t.id,
                label: t.label, secondary: t.desc, keywords: t.keywords,
                icon: <Icon size={16} className="text-[var(--text-secondary)]" />,
                context: 'Trigger',
                payload: t.payload,
            });
        }
        return out;
    }

    // AI step
    {
        const Icon = AI_STEP.icon;
        out.push({
            kind: 'ai', key: AI_STEP.id,
            label: AI_STEP.label, secondary: AI_STEP.desc, keywords: AI_STEP.keywords,
            icon: <Icon size={16} className="text-[var(--text-secondary)]" />,
            context: 'AI',
            payload: AI_STEP.payload,
        });
    }

    // Data
    for (const it of DATA_ITEMS) {
        const Icon = it.icon;
        out.push({
            kind: 'data', key: it.id,
            label: it.label, secondary: it.desc, keywords: it.keywords,
            icon: <Icon size={16} className="text-[var(--text-secondary)]" />,
            context: 'Data',
            payload: it.payload,
        });
    }

    // Collection
    for (const it of COLLECTION_ITEMS) {
        const Icon = it.icon;
        out.push({
            kind: 'collection', key: it.id,
            label: it.label, secondary: it.desc, keywords: it.keywords,
            icon: <Icon size={16} className="text-[var(--text-secondary)]" />,
            context: 'Collection',
            payload: it.payload,
        });
    }

    // Logic
    for (const it of LOGIC_ITEMS) {
        const Icon = it.icon;
        out.push({
            kind: 'logic', key: it.id,
            label: it.label, secondary: it.desc, keywords: it.keywords,
            icon: <Icon size={16} className="text-[var(--text-secondary)]" />,
            context: 'Flow',
            payload: it.payload,
        });
    }

    // Code (if flagged)
    if (catalog?.flags?.code) {
        const Icon = CODE_ITEM.icon;
        out.push({
            kind: 'code', key: CODE_ITEM.id,
            label: CODE_ITEM.label, secondary: CODE_ITEM.desc, keywords: CODE_ITEM.keywords,
            icon: <Icon size={16} className="text-[var(--text-secondary)]" />,
            context: 'Code',
            payload: CODE_ITEM.payload,
        });
    }

    // Apps (action level — typing "send mail" should surface
    // gmail_send and outlook_send_mail, not just the apps).
    if (catalog?.apps) {
        for (const a of catalog.apps) {
            if (!a.available) continue;
            for (const act of (a.actions || [])) {
                const integrationId = act.integrationId || resolveIntegrationFromTool(act.name) || a.id;
                out.push({
                    kind: 'action', key: act.name,
                    label: act.label || prettifyToolName(act.name),
                    secondary: a.label,
                    description: act.description,
                    tool: act.name,
                    icon: <IntegrationLogo integrationId={integrationId} tool={act.name} size={16} />,
                    context: a.label,
                    payload: { kind: 'integration_action', tool: act.name, label: act.label || prettifyToolName(act.name) },
                });
            }
        }
    }

    return out;
}

function prettifyToolName(name) {
    if (!name) return '';
    return String(name).replace(/_/g, ' ');
}

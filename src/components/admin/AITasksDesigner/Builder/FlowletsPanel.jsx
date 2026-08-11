import {
    Layers, X, Plus, Trash2, Sparkles, Loader2,
    ChevronRight, ChevronDown, Pencil, Workflow, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { listLayers, getLayerDependencies } from './flow/flowletScope';

/**
 * Flowlets manager — a compact popover that opens UPWARD from the Flowlets
 * button in the bottom-left corner of the canvas. Lists the main flow + the
 * reusable sub-flows in definition.layers; click an entry to open (drill
 * into) it, rename a flowlet via the pencil, preview its steps, see its
 * dependencies (what it calls / who calls it) and jump between them, or
 * delete it.
 *
 * Flowlet CRUD is delegated to the parent (BuilderShell) so every edit flows
 * through the same whole-document commit / undo / autosave path as the rest
 * of the builder. This component owns only view state (which row is being
 * renamed, which previews are expanded) + closing on click-away / Esc.
 *
 * AI summaries are opt-in: the footer checkbox (off by default) gates the ✨
 * affordance entirely — when off, no Summarize button renders and no LLM
 * call is ever made. The deterministic step preview is always available.
 *
 * `onOpenLayer(null)` navigates to the main/root flow; a flowlet key drills in.
 */

// Friendly, non-technical labels for the step-type chips in the preview.
const STEP_TYPE_LABELS = {
    integration_action: 'Action',
    ai_step: 'AI',
    condition: 'Condition',
    loop: 'Loop',
    code: 'Code',
    notification: 'Notification',
    http_request: 'HTTP Request',
    form_page: 'Form page',
    call_layer: 'Flowlet',
    set: 'Edit data',
    datetime: 'Date & time',
    wait: 'Wait',
    stop_error: 'Stop',
    // All three are the ONE deciding step — same name everywhere.
    switch: 'Condition',
    filter: 'Condition',
    limit: 'Limit',
    dedupe: 'Dedupe',
    aggregate: 'Aggregate',
    summarize: 'Summarize',
};

const ROOT = 'root';

/** Flatten a flowlet's steps (excluding the terminal Return) into preview rows. */
function previewRows(layer) {
    const steps = Array.isArray(layer?.steps) ? layer.steps : [];
    return steps
        .filter(s => s && s.type !== 'layer_output')
        .map(s => ({
            id: s.id,
            type: STEP_TYPE_LABELS[s.type] || s.type,
            label: s.label || s.tool || STEP_TYPE_LABELS[s.type] || s.type,
            layerKey: s.type === 'call_layer' ? (s.layerKey || null) : null,
        }));
}

export default function FlowletsPanel({
    onClose,
    rootDef,
    currentScopeKey = null,
    onOpenLayer,
    onRenameLayer,
    onDeleteLayer,
    refCountFor,
    onCreateLayer,
    aiEnabled = false,
    onToggleAi,
    onSummarize,
    summarizingKey = null,
    rootDescription = '',
    onSummarizeRoot,
    summarizingRoot = false,
    // AI flowlet builder (separate from chat). onBuildLayer/onRefineLayer return
    // a Promise<boolean> (true = success). layerAgentState drives live progress.
    onBuildLayer,
    onRefineLayer,
    layerAgentState = null,
}) {
    const layers = useMemo(() => listLayers(rootDef), [rootDef]);
    const popoverRef = useRef(null);
    const [buildOpen, setBuildOpen] = useState(false);

    const creating = !!layerAgentState?.running && layerAgentState?.mode === 'create';

    // Dependency graph + a key→title lookup (root included), computed once.
    const depsByKey = useMemo(() => {
        const m = {};
        for (const l of layers) m[l.key] = getLayerDependencies(rootDef, l.key);
        return m;
    }, [rootDef, layers]);
    const titleByKey = useMemo(() => {
        const m = { [ROOT]: 'Main flow' };
        for (const l of layers) m[l.key] = l.title;
        return m;
    }, [layers]);
    // What the main flow itself calls = flowlets whose callers include 'root'.
    const rootCalls = useMemo(
        () => layers.filter(l => depsByKey[l.key]?.callers.includes(ROOT)).map(l => l.key),
        [layers, depsByKey],
    );

    // ROOT sentinel → null (the main flow); a flowlet key → that flowlet.
    const navTo = (key) => onOpenLayer?.(key === ROOT ? null : key);

    // Esc + click-away close (it's a floating popover, not a docked panel).
    // Clicks on the toggle button itself are ignored here so its own onClick
    // owns the open/close — otherwise the two fight and it never opens.
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        const onDown = (e) => {
            if (popoverRef.current?.contains(e.target)) return;
            if (e.target?.closest?.('[data-layers-toggle]')) return;
            onClose?.();
        };
        window.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onDown);
        return () => {
            window.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', onDown);
        };
    }, [onClose]);

    return (
        <div
            ref={popoverRef}
            data-surface="default"
            className="absolute bottom-14 left-4 z-30 w-[380px] max-w-[calc(100vw-2rem)] max-h-[min(64vh,460px)] flex flex-col rounded-xl border border-[var(--border-default)] shadow-lg bg-[var(--bg-primary)] overflow-hidden"
        >
            {/* Header. The explanation of what a flowlet IS used to live only
                in the empty state, so it disappeared the moment you had one —
                exactly when you start needing it (BFSF-340). */}
            <div className="flex items-start justify-between px-3 py-2 border-b border-[var(--border-default)] flex-shrink-0">
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <Layers size={14} className="text-[var(--text-primary)] flex-shrink-0" />
                        <span className="text-xs font-semibold text-[var(--text-primary)] truncate">Flowlets</span>
                        <span className="text-[10px] text-[var(--text-tertiary)] flex-shrink-0">{layers.length}</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-[var(--text-tertiary)] leading-snug">
                        Reusable sub-flows. Build one once, then call it from the main flow — or from another flowlet — with a “Call flowlet” step.
                    </div>
                </div>
                <div className="flex items-center gap-0.5">
                    <button
                        type="button"
                        onClick={() => onCreateLayer?.()}
                        title="Create a new flowlet"
                        className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-medium bg-[var(--accent)] text-white hover:opacity-90"
                    >
                        <Plus size={12} /> Create
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        title="Close"
                        aria-label="Close flowlets panel"
                        className="p-1 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 flex flex-col gap-1">
                {/* Build a brand-new flowlet from a natural-language instruction
                    (a thinking-model sub-agent builds it, separate from chat). */}
                {onBuildLayer && (
                    <div className="rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/5 px-2 py-1.5">
                        {buildOpen || creating ? (
                            <>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[11px] font-semibold text-[var(--text-primary)] inline-flex items-center gap-1">
                                        <Sparkles size={12} className="text-[var(--accent)]" /> Build a flowlet with AI
                                    </span>
                                    {!creating && (
                                        <button type="button" onClick={() => setBuildOpen(false)} aria-label="Close" className="p-0.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                                <LayerAiComposer
                                    onSubmit={async (text) => { const ok = await onBuildLayer(text); if (ok) setBuildOpen(false); }}
                                    running={creating}
                                    progress={creating ? agentProgressText(layerAgentState) : ''}
                                    placeholder="Describe the flowlet — e.g. “Look up a contact by email and return their company and a 0–100 score.”"
                                    autoFocus
                                />
                            </>
                        ) : (
                            <button type="button" onClick={() => setBuildOpen(true)} className="w-full inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--accent)] hover:underline">
                                <Sparkles size={12} /> Build a flowlet with AI
                            </button>
                        )}
                    </div>
                )}

                {/* Main flow (root) — always present so you can jump back here
                    when drilled into a flowlet. */}
                <MainFlowRow
                    isCurrent={currentScopeKey == null}
                    calls={rootCalls}
                    titleByKey={titleByKey}
                    onOpen={() => navTo(ROOT)}
                    onNavigate={navTo}
                    aiEnabled={aiEnabled}
                    description={rootDescription}
                    onSummarize={onSummarizeRoot}
                    summarizing={summarizingRoot}
                />

                {layers.length === 0 ? (
                    <div className="px-2 py-3 text-center">
                        <div className="text-[11px] text-[var(--text-tertiary)]">
                            No flowlets yet — reusable sub-flows you can call from anywhere.
                        </div>
                    </div>
                ) : (
                    layers.map((layer) => (
                        <LayerRow
                            key={layer.key}
                            layer={layer}
                            steps={previewRows(rootDef?.layers?.[layer.key])}
                            deps={depsByKey[layer.key] || { calls: [], callers: [] }}
                            titleByKey={titleByKey}
                            isCurrent={layer.key === currentScopeKey}
                            refCount={refCountFor?.(layer.key) || 0}
                            onOpen={() => onOpenLayer?.(layer.key)}
                            onNavigate={navTo}
                            onRename={(title) => onRenameLayer?.(layer.key, title)}
                            onDelete={() => onDeleteLayer?.(layer.key)}
                            aiEnabled={aiEnabled}
                            onSummarize={() => onSummarize?.(layer.key)}
                            summarizing={summarizingKey === layer.key}
                            onRefine={onRefineLayer ? (text) => onRefineLayer(layer.key, text) : null}
                            refining={!!layerAgentState?.running && layerAgentState?.mode === 'refine' && layerAgentState?.activeKey === layer.key}
                            refineProgress={agentProgressText(layerAgentState)}
                        />
                    ))
                )}
            </div>

            {/* Footer — AI opt-in toggle (off by default). */}
            <div className="px-3 py-2 border-t border-[var(--border-default)] flex-shrink-0">
                <label
                    className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] cursor-pointer select-none"
                    title="When on, you can generate a one-line AI summary of what each flowlet does. Off by default — no AI is used unless you turn this on."
                >
                    <input type="checkbox" checked={!!aiEnabled} onChange={() => onToggleAi?.()} />
                    <Sparkles size={12} className="text-[var(--text-tertiary)]" />
                    AI flowlet summaries
                </label>
            </div>
        </div>
    );
}

/** Stop a control click from bubbling to a row's open-on-click handler. */
const stop = (fn) => (e) => { e.stopPropagation(); fn?.(e); };

// The two directions read as jargon on their own — say which way each points.
const DEP_HINT = {
    'Used by': 'The flows that call this flowlet. Listed once per flow, however many times it calls in.',
    Calls: 'The other flowlets this one calls.',
};

/** A line of clickable dependency targets ("Used by" / "Calls"). */
function DepLine({ icon: Icon, label, targets, titleByKey, onNavigate }) {
    if (!targets || targets.length === 0) return null;
    return (
        <div className="mt-0.5 pl-5 flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] min-w-0">
            <Icon size={10} className="flex-shrink-0" />
            <span className="flex-shrink-0 cursor-help" title={DEP_HINT[label]}>{label}</span>
            <div className="flex flex-wrap gap-1 min-w-0">
                {targets.map((k) => (
                    <button
                        key={k}
                        type="button"
                        onClick={stop(() => onNavigate?.(k))}
                        title={`Go to ${titleByKey[k] || k}`}
                        className="px-1 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition max-w-[120px] truncate"
                    >
                        {titleByKey[k] || k}
                    </button>
                ))}
            </div>
        </div>
    );
}

function MainFlowRow({
    isCurrent, calls, titleByKey, onOpen, onNavigate,
    aiEnabled, description, onSummarize, summarizing,
}) {
    return (
        <div
            onClick={onOpen}
            title="Go to the main flow"
            className={`rounded-lg border px-2 py-1.5 cursor-pointer transition-colors ${
                isCurrent
                    ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                    : 'border-[var(--border-default)] hover:bg-[var(--bg-secondary)]'
            }`}
        >
            <div className="flex items-center gap-1.5 min-w-0">
                <Workflow size={13} className="text-[var(--text-secondary)] flex-shrink-0" />
                <span className="flex-1 min-w-0 text-xs font-medium text-[var(--text-primary)] truncate">Main flow</span>
                {isCurrent && (
                    <span className="text-[8px] uppercase tracking-wide font-semibold px-1 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] flex-shrink-0">
                        Current
                    </span>
                )}
            </div>
            <DepLine icon={ArrowDownRight} label="Calls" targets={calls} titleByKey={titleByKey} onNavigate={onNavigate} />

            {/* AI summary of the whole automation — only when the opt-in toggle is on */}
            {aiEnabled && (
                <div className="mt-1 pl-5">
                    {description && (
                        <div className="text-[10px] text-[var(--text-secondary)] italic mb-0.5">{description}</div>
                    )}
                    <button
                        type="button"
                        onClick={stop(onSummarize)}
                        disabled={summarizing}
                        className="inline-flex items-center gap-1 text-[10px] text-[var(--accent)] hover:underline disabled:opacity-60 disabled:no-underline"
                    >
                        {summarizing
                            ? <><Loader2 size={10} className="animate-spin" /> Summarizing…</>
                            : <><Sparkles size={10} /> {description ? 'Regenerate' : 'Summarize'}</>}
                    </button>
                </div>
            )}
        </div>
    );
}

function LayerRow({
    layer, steps, deps, titleByKey, isCurrent, refCount,
    onOpen, onNavigate, onRename, onDelete,
    aiEnabled, onSummarize, summarizing,
    onRefine = null, refining = false, refineProgress = '',
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(layer.title);
    const [expanded, setExpanded] = useState(false);
    const [refineOpen, setRefineOpen] = useState(false);
    const inputRef = useRef(null);
    // Keep the composer mounted while its run is in flight so progress shows.
    const showRefine = refineOpen || refining;

    useEffect(() => { if (!editing) setDraft(layer.title); }, [layer.title, editing]);
    useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

    const commit = () => {
        const next = (draft || '').trim();
        setEditing(false);
        if (!next || next === layer.title) { setDraft(layer.title); return; }
        onRename?.(next);
    };
    const onKey = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        else if (e.key === 'Escape') { e.stopPropagation(); setDraft(layer.title); setEditing(false); }
    };

    // An EMPTY flowlet stays deletable even when something calls it: the
    // palette's "Create flowlet" drops a call node as part of creating one, so
    // a brand-new flowlet was born un-deletable and the user had to hunt down
    // that node first (BFSF-340). Deleting it takes the call sites with it.
    const inUse = refCount > 0 && layer.stepCount > 0;
    const deleteTitle = inUse
        ? `Used by ${refCount} step${refCount === 1 ? '' : 's'} — open it and remove those first`
        : (refCount > 0
            ? `Delete this empty flowlet (and the ${refCount} “Call flowlet” step${refCount === 1 ? '' : 's'} that use${refCount === 1 ? 's' : ''} it)`
            : 'Delete this flowlet');
    const metaParts = [
        `${layer.stepCount} step${layer.stepCount === 1 ? '' : 's'}`,
        `${layer.params.length} in`,
        `${layer.outputFields.length} out`,
    ];

    return (
        <div
            onClick={editing ? undefined : onOpen}
            title={editing ? undefined : 'Open this flowlet'}
            className={`rounded-lg border px-2 py-1.5 transition-colors ${editing ? '' : 'cursor-pointer'} ${
                isCurrent
                    ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                    : 'border-[var(--border-default)] hover:bg-[var(--bg-secondary)]'
            }`}
        >
            {/* Title row */}
            <div className="flex items-center gap-1 min-w-0">
                <button
                    type="button"
                    onClick={stop(() => setExpanded(v => !v))}
                    title={expanded ? 'Hide steps' : 'Show steps'}
                    aria-label={expanded ? 'Hide steps' : 'Show steps'}
                    className="p-0.5 -ml-0.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] flex-shrink-0"
                >
                    {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
                {editing ? (
                    <input
                        ref={inputRef}
                        value={draft}
                        onClick={stop()}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={commit}
                        onKeyDown={onKey}
                        className="flex-1 min-w-0 text-xs font-medium bg-transparent border-b border-[var(--accent)] outline-none text-[var(--text-primary)]"
                    />
                ) : (
                    <span className="flex-1 min-w-0 text-xs font-medium text-[var(--text-primary)] truncate">
                        {layer.title}
                    </span>
                )}
                {isCurrent && (
                    <span className="text-[8px] uppercase tracking-wide font-semibold px-1 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] flex-shrink-0">
                        Current
                    </span>
                )}
                {!editing && onRefine && (
                    <button
                        type="button"
                        onClick={stop(() => setRefineOpen(v => !v))}
                        title="Refine this flowlet with AI"
                        aria-label="Refine with AI"
                        className={`p-0.5 rounded transition flex-shrink-0 hover:bg-[var(--bg-tertiary)] ${showRefine ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:text-[var(--accent)]'}`}
                    >
                        <Sparkles size={11} />
                    </button>
                )}
                {!editing && (
                    <button
                        type="button"
                        onClick={stop(() => setEditing(true))}
                        title="Rename"
                        aria-label="Rename flowlet"
                        className="p-0.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition flex-shrink-0"
                    >
                        <Pencil size={11} />
                    </button>
                )}
                <button
                    type="button"
                    onClick={inUse ? stop() : stop(onDelete)}
                    disabled={inUse}
                    title={deleteTitle}
                    aria-label="Delete flowlet"
                    className="p-0.5 rounded text-[var(--text-tertiary)] hover:text-red-600 hover:bg-[var(--bg-tertiary)] transition disabled:opacity-40 disabled:hover:text-[var(--text-tertiary)] disabled:hover:bg-transparent flex-shrink-0"
                >
                    <Trash2 size={11} />
                </button>
            </div>

            {/* At-a-glance meta */}
            <div className="mt-0.5 pl-5 text-[10px] text-[var(--text-tertiary)]">
                {metaParts.join(' · ')}
            </div>

            {/* Dependencies — who calls this flowlet, and what it calls. Click a
                target to jump there. */}
            <DepLine icon={ArrowUpRight} label="Used by" targets={deps.callers} titleByKey={titleByKey} onNavigate={onNavigate} />
            <DepLine icon={ArrowDownRight} label="Calls" targets={deps.calls} titleByKey={titleByKey} onNavigate={onNavigate} />

            {/* Deterministic step preview (always available, no AI) */}
            {expanded && (
                <div className="mt-1 ml-5 flex flex-col gap-0.5 border-l border-[var(--border-default)]">
                    {steps.length === 0 ? (
                        <div className="text-[10px] italic text-[var(--text-tertiary)] pl-2">Empty flowlet — no steps yet.</div>
                    ) : (
                        steps.map((s, i) => (
                            <div key={s.id || i} className="flex items-center gap-1.5 text-[10px] pl-2 min-w-0">
                                <span className="uppercase tracking-wide text-[var(--text-tertiary)] flex-shrink-0 w-14 truncate">{s.type}</span>
                                {s.layerKey ? (
                                    <button
                                        type="button"
                                        onClick={stop(() => onNavigate?.(s.layerKey))}
                                        title={`Go to ${titleByKey[s.layerKey] || s.layerKey}`}
                                        className="text-[var(--accent)] hover:underline truncate text-left"
                                    >
                                        {titleByKey[s.layerKey] || s.label}
                                    </button>
                                ) : (
                                    <span className="text-[var(--text-secondary)] truncate">{s.label}</span>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* AI summary — only when the opt-in toggle is on */}
            {aiEnabled && (
                <div className="mt-1 pl-5">
                    {layer.description && (
                        <div className="text-[10px] text-[var(--text-secondary)] italic mb-0.5">{layer.description}</div>
                    )}
                    <button
                        type="button"
                        onClick={stop(onSummarize)}
                        disabled={summarizing}
                        className="inline-flex items-center gap-1 text-[10px] text-[var(--accent)] hover:underline disabled:opacity-60 disabled:no-underline"
                    >
                        {summarizing
                            ? <><Loader2 size={10} className="animate-spin" /> Summarizing…</>
                            : <><Sparkles size={10} /> {layer.description ? 'Regenerate' : 'Summarize'}</>}
                    </button>
                </div>
            )}

            {/* Refine-with-AI composer — extend/fix this flowlet from an instruction */}
            {showRefine && onRefine && (
                <div className="mt-1.5 pl-5" onClick={(e) => e.stopPropagation()}>
                    <LayerAiComposer
                        compact
                        autoFocus
                        running={refining}
                        progress={refining ? refineProgress : ''}
                        placeholder={`Refine “${layer.title}” — e.g. “also return the company size” or “handle a missing email.”`}
                        submitLabel="Refine"
                        onSubmit={async (text) => { const ok = await onRefine(text); if (ok) setRefineOpen(false); }}
                    />
                </div>
            )}
        </div>
    );
}

/** One-line live-progress label for a running flowlet agent. */
function agentProgressText(st) {
    if (!st || !st.running) return '';
    const n = Array.isArray(st.toolCalls) ? st.toolCalls.length : 0;
    const last = n ? st.toolCalls[n - 1]?.name : null;
    const pretty = last ? String(last).replace(/^builder_(add_)?/, '').replace(/_/g, ' ') : 'thinking';
    return `Working… ${n} step${n === 1 ? '' : 's'} · ${pretty}`;
}

/**
 * A small instruction box (textarea + submit) for the AI flowlet builder.
 * Used for both "build new" (top of the panel) and per-row "refine".
 * onSubmit(text) may return a Promise; the parent decides whether to close.
 */
function LayerAiComposer({ onSubmit, running = false, progress = '', placeholder = '', submitLabel = 'Build', autoFocus = false, compact = false }) {
    const [text, setText] = useState('');
    const submit = () => {
        const t = text.trim();
        if (!t || running) return;
        onSubmit?.(t);
    };
    return (
        <div className="flex flex-col gap-1">
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
                    else if (e.key === 'Escape') { e.stopPropagation(); }
                }}
                placeholder={placeholder}
                rows={compact ? 2 : 3}
                disabled={running}
                autoFocus={autoFocus}
                className="w-full text-[11px] rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1.5 outline-none focus:border-[var(--accent)] resize-none disabled:opacity-60 text-[var(--text-primary)]"
            />
            <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] text-[var(--text-tertiary)] truncate min-w-0">{progress}</div>
                <button
                    type="button"
                    onClick={submit}
                    disabled={running || !text.trim()}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 flex-shrink-0"
                >
                    {running
                        ? <><Loader2 size={11} className="animate-spin" /> Building…</>
                        : <><Sparkles size={11} /> {submitLabel}</>}
                </button>
            </div>
        </div>
    );
}

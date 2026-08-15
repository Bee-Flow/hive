import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { AlertCircle, AlertTriangle, Plus, Play, Pin, Loader2, Repeat, Copy as CopyIcon, Trash2, Unlink } from 'lucide-react';
import { useNodeRuntime } from '../NodeRuntimeContext';
import { StepIcon } from '../stepIcons';

/**
 * Shared chrome for every step-type node. Per-type files supply
 * `icon`, `typeLabel`, `body`, and optional right-corner `badges`.
 *
 * Renders:
 *   - left edge bar driven by run status (idle / running pulse / success / error)
 *   - icon + type label header
 *   - body slot (per-type)
 *   - right-corner badges
 *   - validation badge bottom-right when {errors|warnings} are non-empty
 *   - connection handles (visible on hover, n8n-style) and a "+"
 *     quick-add button right of the node when `onAddAfter` is supplied.
 *
 * Hovering reveals the action chrome (run / duplicate / disconnect / delete)
 * and nothing else. There used to be a popover summarising the step's tool and
 * bindings, but at 280px it covered the neighbouring nodes and the very buttons
 * hovering was meant to expose. That detail lives in the node detail view.
 */
export default function StepNodeBase({
    // `typeLabel` is not RENDERED — the card leads with the title/description,
    // not the node type, for a cleaner, less technical read. It is used as the
    // card's native tooltip together with `help`, which is the one explanation
    // the canvas can offer without painting over its neighbours. The real
    // answer to "what does this node do?" lives at the top of the step's own
    // editor (flow/settings/NodePurpose) and in the ribbon's screen tips.
    icon, typeLabel = null, help = null, body, badges = null,
    // Accepted and ignored: the per-type nodes still compute a `hoverDetail`
    // summary, but the popover that rendered it covered the neighbouring cards
    // and the buttons above them, so the card no longer shows one.
    hoverDetail: _hoverDetail = null,
    runStep, issues, dim = false,
    nodeId = null, onAddAfter = null,
    // Branch steps (condition / switch) pass an array of
    // `{ id, label, tone }` so each branch gets its own connectable output
    // port. When omitted the node renders the usual single source handle.
    sourceHandles = null,
    // false = the source handle stays in the DOM (legacy edges keep their
    // anchor and stay deletable) but refuses NEW connections. Used by
    // stop_error, whose outgoing edges are dead by definition (B9).
    sourceConnectable = true,
    // `{ handleId, label, count }` — a second output at the BOTTOM of the card
    // that carries something other than the flow. Only the AI step uses it
    // today (its tools). Rendered as a labelled, always-visible drop zone
    // rather than a bare handle: it is a target for a drag that starts in the
    // ribbon, so it has to be findable before the drag begins.
    bottomPort = null,
}) {
    const branchHandles = Array.isArray(sourceHandles) && sourceHandles.length > 0 ? sourceHandles : null;

    // Runtime context — provided by DiagramPane. Per-step flags are
    // looked up from sets so we don't change the call-site of any of the
    // 17 existing per-type node components.
    // Node chrome (run / duplicate / disconnect / delete / add-after) appears
    // while the pointer is over the card and is hidden otherwise — resting it
    // visible turns a real flow into a field of icons.
    //
    // Driven by React state rather than Tailwind's `group-hover`, because these
    // buttons sit ABOVE the card (-top-3) and half of each one is outside the
    // card's own box. State set from the card's mouse events covers the buttons
    // too (they are DOM children, so moving onto one never fires mouseleave),
    // and unlike a CSS-only rule it can be proven in a test.
    const [hovered, setHovered] = useState(false);
    const chromeVisibility = hovered
        ? 'opacity-100 transition-opacity duration-150'
        : 'opacity-0 pointer-events-none transition-opacity duration-150';

    const rt = useNodeRuntime();
    const pinned = nodeId ? rt.pinnedById?.has?.(nodeId) : false;
    const disabled = nodeId ? rt.disabledById?.has?.(nodeId) : false;
    // A user-chosen symbol (Lucide icon name) overrides the default type icon.
    const customIconName = nodeId ? rt.customIconById?.get?.(nodeId) : null;
    const effectiveIcon = customIconName ? <StepIcon name={customIconName} size={15} fallback={icon} /> : icon;
    const onExecuteStep = rt.onExecuteStep;
    const executingThis = nodeId && rt.executingStepId === nodeId;
    const runInFlight = !!rt.runInFlight;
    const runIndex = nodeId ? rt.runIndexById?.get?.(nodeId) : null;
    const runTotal = rt.runTotal ?? null;
    // Briefly ringed after the user clicks a validation issue to jump to
    // this node — additive to (not replacing) the status border below, so
    // an errored node being focused still reads as errored underneath.
    const highlighted = nodeId && rt.highlightedStepId === nodeId;
    const errCount = issues?.errors?.length || 0;
    const warnCount = issues?.warnings?.length || 0;

    // The live run status of THIS step. This was previously never declared, so
    // the identifier below resolved to the legacy global `window.status` — an
    // always-empty string. Every comparison was false, which silently disabled
    // the status border AND the run-ordinal chip on every node. (It failed
    // quietly rather than throwing precisely because `window.status` exists.)
    // The edge decoration in DiagramPane always did this correctly via
    // `runByStep`, which is why edges animated during a run but nodes didn't.
    const status = runStep?.status;

    // Node actions from the canvas (BFSF-319). Both are null on a read-only
    // canvas, and the primary trigger is never removable — the runtime
    // requires exactly one — so it gets no delete button rather than one that
    // silently does nothing.
    const isPrimaryTrigger = nodeId && rt.primaryTriggerId === nodeId;
    const isAnyTrigger = nodeId ? !!rt.triggerIds?.has?.(nodeId) : false;
    const showDelete = !!rt.onDeleteNode && !!nodeId && !isPrimaryTrigger && !rt.undeletableIds?.has?.(nodeId);
    // Triggers are never duplicable: the primary is unique, and secondary ones
    // go through the ribbon's "add another trigger" affordance, which enforces
    // the webhook/app_event-only rule the validator applies to triggers[].
    const showDuplicate = !!rt.onDuplicateNode && !!nodeId && !isAnyTrigger;
    // "Take this step out of the flow, but keep it." Only offered when the step
    // is actually wired to something — on a loose card the button would do
    // nothing. Its neighbours reconnect, so the flow never dead-ends.
    const showDetach = !!rt.onDetachNode && !!nodeId && !isAnyTrigger && !!rt.attachedIds?.has?.(nodeId);

    // Status is shown by tinting the WHOLE node border (+ a soft same-tone
    // ring) rather than a floating left bar — cleaner and more intentional.
    // Only applied when there's a real run status; idle nodes keep the
    // default neutral border. Cyan flags a pinned node; amber-dashed is
    // "disabled". An active run status outranks the pinned tint so the user
    // sees the *live* state. `running` gently pulses to read as in-flight.
    const statusBorder = status === 'success' ? 'border-emerald-500 ring-1 ring-emerald-500/25'
        : status === 'pinned' ? 'border-cyan-500 ring-1 ring-cyan-500/25'
        : status === 'error' ? 'border-red-500 ring-1 ring-red-500/25'
        // Amber, not var(--accent): the accent defaults to the product's
        // GREY, which made a running node's border invisible in light themes.
        : status === 'running' ? 'border-amber-500 ring-1 ring-amber-500/30 animate-[pulse_1.2s_ease-in-out_infinite]'
        : status === 'skipped' ? 'border-dashed border-[var(--border-default)] opacity-70'
        : status === 'handled_error' ? 'border-amber-500 ring-1 ring-amber-500/25'
        : (status === 'awaiting_approval' || status === 'awaiting_confirm' || status === 'awaiting_form') ? 'border-amber-500 ring-1 ring-amber-500/25'
        : status === 'cancelled' ? 'border-[var(--border-default)]'
        : pinned ? 'border-cyan-500 ring-1 ring-cyan-500/25'
        : null;

    // n8n-style handles: 12px circles, invisible at rest, fade in on
    // node-hover and brighten to accent when the handle itself is
    // hovered. The `!` prefix overrides React Flow's default handle CSS.
    const handleClass = [
        '!w-3 !h-3 !rounded-full !border-2',
        '!bg-[var(--bg-primary)] !border-[var(--text-tertiary)]',
        // Same state as the action chrome — React Flow renders handles into the
        // card, so a CSS-only rule here would drift from the buttons above.
        hovered ? '!opacity-100' : '!opacity-0',
        'transition-opacity duration-150',
        'hover:!border-[var(--accent)] hover:!scale-110',
    ].join(' ');

    return (
        <div
            className={`group relative w-[240px] rounded-lg border bg-[var(--bg-secondary)] shadow-sm hover:shadow-md transition-shadow duration-150 cursor-pointer ${dim || disabled ? 'opacity-60' : ''} ${disabled ? 'border-dashed border-amber-500/60' : (statusBorder || 'border-[var(--border-default)]')} ${highlighted ? 'ring-2 ring-offset-2 ring-offset-[var(--bg-primary)] ring-[var(--accent)] animate-[pulse_1s_ease-in-out_2]' : ''}`}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <Handle type="target" position={Position.Left} className={handleClass} style={{ left: -6 }} />
            {branchHandles ? (
                // One source port per branch, stacked down the right edge,
                // each labelled with where it routes to. The labels used to
                // reveal on hover, which meant a branching flow read as a
                // wall of anonymous ports until you went looking — the one
                // thing you need to see at a glance is which way is which.
                branchHandles.map((h, i) => {
                    const top = `${((i + 1) / (branchHandles.length + 1)) * 100}%`;
                    return (
                        <React.Fragment key={h.id}>
                            <Handle
                                type="source"
                                id={h.id}
                                position={Position.Right}
                                className={handleClass}
                                style={{ right: -6, top }}
                            />
                            <span
                                className={`absolute pointer-events-none -translate-y-1/2 max-w-[120px] truncate text-[9px] leading-none px-1 py-0.5 rounded border ${branchTone(h.tone)}`}
                                style={{ left: 'calc(100% + 10px)', top }}
                                title={h.label}
                            >
                                {h.label}
                            </span>
                        </React.Fragment>
                    );
                })
            ) : (
                <Handle type="source" position={Position.Right} className={handleClass} style={{ right: -6 }} isConnectable={sourceConnectable} />
            )}

            {/* Bottom port (AI step: tools). `data-tool-port` is what the
                ribbon's drop hit-test looks for — see flow/stepDrag.js — so
                releasing an app here attaches it as a tool instead of adding a
                step to the flow. It stays visible at rest, unlike the flow
                handles: an invisible drop target is not a target. */}
            {bottomPort && nodeId && (
                <>
                    <Handle
                        type="source"
                        id={bottomPort.handleId}
                        position={Position.Bottom}
                        isConnectable={false}
                        className="!w-2.5 !h-2.5 !rounded-full !border-2 !bg-[var(--bg-primary)] !border-[var(--text-tertiary)] !opacity-70"
                        style={{ bottom: -5 }}
                    />
                    <span
                        data-tool-port={nodeId}
                        title={bottomPort.hint || undefined}
                        // NOT pointer-events-none: `elementFromPoint` skips
                        // such elements, and this pill IS the drop target.
                        className={`absolute left-1/2 -translate-x-1/2 -bottom-6 z-10 inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-[9px] whitespace-nowrap ${
                            bottomPort.active
                                ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]'
                                : 'border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-tertiary)]'
                        }`}
                    >
                        {bottomPort.label}
                    </span>
                </>
            )}

            {/* Hover toolbar — execute, duplicate, disconnect, delete. Before
                this, delete existed ONLY as the Delete/Backspace key and
                duplicate not at all, so neither was discoverable (BFSF-319).
                Same actions are on the right-click menu and in the node detail
                view.

                ONE centred row, not two clusters: Execute used to sit centred
                and the rest right-anchored, and since the right-hand group
                grows and shrinks per step type (a trigger has no duplicate, a
                loose card no disconnect) the chrome visibly jumped from node to
                node (BFSF-346). */}
            {(onExecuteStep || showDuplicate || showDetach || showDelete) && nodeId && (
                <div
                    className={`absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 ${chromeVisibility}`}
                    data-testid="node-hover-toolbar"
                >
                    {/* n8n's classic ▶ — "run the flow up to here". Everything
                        before this step executes for real; a step with a
                        pinned output serves its pin instead of re-running,
                        which is the escape hatch for the slow or expensive
                        one. (Running JUST this step lives in the node editor,
                        where its input and output are on screen to read.)
                        Disabled during a full run so we don't fire
                        conflicting executions. */}
                    {onExecuteStep && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onExecuteStep(nodeId, { mode: 'upTo' }); }}
                            onMouseDown={(e) => e.stopPropagation()}
                            disabled={runInFlight || executingThis}
                            title={runInFlight ? 'Run in progress' : 'Run the flow up to here (pinned steps reuse their data)'}
                            className="h-6 w-6 rounded-full bg-[var(--bg-primary)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] shadow disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Execute step"
                        >
                            {executingThis ? <Loader2 size={12} className="animate-spin" /> : <Play size={11} fill="currentColor" />}
                        </button>
                    )}
                    {showDuplicate && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); rt.onDuplicateNode(nodeId); }}
                            onMouseDown={(e) => e.stopPropagation()}
                            title="Duplicate this step"
                            aria-label="Duplicate step"
                            className="h-6 w-6 rounded-full bg-[var(--bg-primary)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] shadow"
                        >
                            <CopyIcon size={11} />
                        </button>
                    )}
                    {showDetach && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); rt.onDetachNode(nodeId); }}
                            onMouseDown={(e) => e.stopPropagation()}
                            title="Take this step out of the flow (it stays on the canvas, its neighbours reconnect)"
                            aria-label="Disconnect step"
                            className="h-6 w-6 rounded-full bg-[var(--bg-primary)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] shadow"
                        >
                            <Unlink size={11} />
                        </button>
                    )}
                    {showDelete && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); rt.onDeleteNode(nodeId); }}
                            onMouseDown={(e) => e.stopPropagation()}
                            title="Delete this step (reconnects its neighbours)"
                            aria-label="Delete step"
                            className="h-6 w-6 rounded-full bg-[var(--bg-primary)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-secondary)] hover:border-red-500 hover:text-red-500 shadow"
                        >
                            <Trash2 size={11} />
                        </button>
                    )}
                </div>
            )}

            {/* Quick-add "+" button — sits past the right handle so the
                user can click instead of dragging. Only rendered when
                the host wires `onAddAfter` (editable mode). Suppressed on
                branch nodes, where "add after" is ambiguous — the user drags
                from a specific branch port instead. */}
            {onAddAfter && nodeId && !branchHandles && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onAddAfter(nodeId); }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className={`absolute top-1/2 -translate-y-1/2 -right-8 h-5 w-5 rounded-full bg-[var(--bg-primary)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-secondary)] ${chromeVisibility} hover:border-[var(--accent)] hover:text-[var(--accent)] shadow-sm`}
                    title="Add next step"
                    aria-label="Add next step"
                >
                    <Plus size={12} />
                </button>
            )}

            <div className="pl-3 pr-2 py-2">
                {/* Single row: icon leads the title/description; pin / run
                    progress / per-type badges sit top-right on the SAME row.
                    The node TYPE label is intentionally omitted, and there is
                    no separate header line, so the card stays compact. */}
                <div
                    className="flex items-start gap-2"
                    // Native, so it cannot cover the neighbouring cards or the
                    // hover toolbar the way the old popover did. A last resort,
                    // not the answer: the step's own editor says it properly.
                    title={[typeLabel, help].filter(Boolean).join(' — ') || undefined}
                >
                    <span className="text-[var(--text-secondary)] flex-shrink-0 mt-0.5">{effectiveIcon}</span>
                    <div className="text-xs text-[var(--text-primary)] leading-snug min-w-0 flex-1">
                        {body}
                    </div>
                    {(pinned || (runIndex != null && runTotal != null && status === 'running') || badges) && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                            {pinned && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30" title="Output is pinned">
                                    <Pin size={9} />
                                </span>
                            )}
                            {runIndex != null && runTotal != null && status === 'running' && (
                                <span className="text-[10px] font-mono text-[var(--accent)] tabular-nums" title="Run progress">
                                    {runIndex}/{runTotal}
                                </span>
                            )}
                            {badges}
                        </div>
                    )}
                </div>
            </div>

            {/* Validation badge — bottom-right corner. */}
            {(errCount > 0 || warnCount > 0) && (
                <div
                    className={`absolute -bottom-1.5 -right-1.5 rounded-full border-2 border-[var(--bg-primary)] flex items-center justify-center text-[10px] font-bold leading-none w-5 h-5 ${
                        errCount > 0
                            ? 'bg-red-500 text-white'
                            : 'bg-amber-500 text-white'
                    }`}
                    title={
                        [...(issues.errors || []), ...(issues.warnings || [])]
                            .map(r => `${r.code}: ${r.message}`)
                            .join('\n')
                    }
                >
                    {errCount > 0 ? <AlertCircle size={12} /> : <AlertTriangle size={12} />}
                </div>
            )}

        </div>
    );
}

/**
 * Tone classes for a branch port label. Mirrors the edge-chip palette in
 * `flow/edges.jsx` so a `then`/`else`/`default`/case port reads the same as
 * the edge it spawns. No purple, per house style.
 */
function branchTone(tone) {
    return tone === 'then'
        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
        : tone === 'else'
            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40'
            : tone === 'default'
                ? 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] border-[var(--border-default)] italic'
                : tone === 'error'
                    ? 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40'
                    : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-default)]';
}

/** Small reusable chip — used by per-type nodes for tier / channel pills. */
export function NodeChip({ children, tone = 'neutral', title }) {
    const cls = tone === 'accent'
        ? 'bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/30'
        : tone === 'warn'
            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
            : tone === 'danger'
                ? 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30'
                : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-default)]';
    return (
        <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border ${cls}`} title={title}>
            {children}
        </span>
    );
}

/**
 * The "for each" chip shown when a leaf step iterates over an upstream array
 * via per-step `forEach` (no wrapping loop). Shared so every leaf node renders
 * it identically — mirrors the inline chip in IntegrationActionNode.
 */
export function ForEachBadge({ step }) {
    if (!step?.forEach?.overRef) return null;
    return (
        <NodeChip tone="accent" title={`Runs once per item in ${step.forEach.overRef}`}>
            <Repeat size={10} /> for each
        </NodeChip>
    );
}

/**
 * Render up to 4 of the resolved input keys (top-level only) into the
 * hover popover. Inputs are binding objects (`{kind:'literal',value:…}`
 * etc.) — we only show the user-meaningful values, not the wrapping kind.
 */
export function renderInputsPreview(inputs) {
    if (!inputs || typeof inputs !== 'object') return null;
    const entries = Object.entries(inputs).slice(0, 4);
    if (entries.length === 0) return null;
    return (
        <div className="mt-1 space-y-0.5">
            {entries.map(([k, v]) => (
                <div key={k} className="truncate">
                    <span className="text-[var(--text-tertiary)]">{k}:</span>{' '}
                    <span className="font-mono text-[10px]">{previewBinding(v)}</span>
                </div>
            ))}
        </div>
    );
}

function previewBinding(v) {
    if (v == null) return '—';
    if (typeof v !== 'object') return String(v).slice(0, 40);
    if (v.kind === 'literal') return JSON.stringify(v.value).slice(0, 40);
    if (v.kind === 'ref') return `→ ${v.path}`;
    if (v.kind === 'template') return `"${(v.value || '').slice(0, 40)}"`;
    if (v.kind === 'expr') return `expr: ${v.value || ''}`;
    return JSON.stringify(v).slice(0, 40);
}

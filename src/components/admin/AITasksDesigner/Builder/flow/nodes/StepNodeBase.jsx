import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { AlertCircle, AlertTriangle, Plus, Play, Pin, Loader2, Repeat } from 'lucide-react';
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
 *   - hover popover with the longer label + key fields
 *   - connection handles (visible on hover, n8n-style) and a "+"
 *     quick-add button right of the node when `onAddAfter` is supplied.
 *
 * Hover popover uses inline CSS only — no external popover lib.
 */
export default function StepNodeBase({
    // `typeLabel` is accepted (every per-type node passes it) but intentionally
    // not rendered — the card leads with the title/description, not the node
    // type, for a cleaner, less technical read.
    icon, typeLabel: _typeLabel, body, badges = null, hoverDetail = null,
    runStep, issues, dim = false,
    nodeId = null, onAddAfter = null,
}) {
    const [hover, setHover] = useState(false);

    // Runtime context — provided by DiagramPane. Per-step flags are
    // looked up from sets so we don't change the call-site of any of the
    // 17 existing per-type node components.
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

    const status = runStep?.status || 'idle';
    const errCount = issues?.errors?.length || 0;
    const warnCount = issues?.warnings?.length || 0;

    // Status is shown by tinting the WHOLE node border (+ a soft same-tone
    // ring) rather than a floating left bar — cleaner and more intentional.
    // Only applied when there's a real run status; idle nodes keep the
    // default neutral border. Cyan flags a pinned node; amber-dashed is
    // "disabled". An active run status outranks the pinned tint so the user
    // sees the *live* state. `running` gently pulses to read as in-flight.
    const statusBorder = status === 'success' ? 'border-emerald-500 ring-1 ring-emerald-500/25'
        : status === 'pinned' ? 'border-cyan-500 ring-1 ring-cyan-500/25'
        : status === 'error' ? 'border-red-500 ring-1 ring-red-500/25'
        : status === 'running' ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]/30 animate-[pulse_1.2s_ease-in-out_infinite]'
        : pinned ? 'border-cyan-500 ring-1 ring-cyan-500/25'
        : null;

    // n8n-style handles: 12px circles, invisible at rest, fade in on
    // node-hover and brighten to accent when the handle itself is
    // hovered. The `!` prefix overrides React Flow's default handle CSS.
    const handleClass = [
        '!w-3 !h-3 !rounded-full !border-2',
        '!bg-[var(--bg-primary)] !border-[var(--text-tertiary)]',
        'opacity-0 group-hover:opacity-100 transition-opacity duration-150',
        'hover:!border-[var(--accent)] hover:!scale-110',
    ].join(' ');

    return (
        <div
            className={`group relative w-[240px] rounded-lg border bg-[var(--bg-secondary)] shadow-sm hover:shadow-md transition-shadow duration-150 cursor-pointer ${dim || disabled ? 'opacity-60' : ''} ${disabled ? 'border-dashed border-amber-500/60' : (statusBorder || 'border-[var(--border-default)]')}`}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
        >
            <Handle type="target" position={Position.Left} className={handleClass} style={{ left: -6 }} />
            <Handle type="source" position={Position.Right} className={handleClass} style={{ right: -6 }} />

            {/* Per-node "Execute Step" button — n8n's classic ▶. Hovers
                just above the node. Only shown in editable mode (when
                an onExecuteStep callback is wired). Disabled during a
                full run so we don't fire conflicting partial executions. */}
            {onExecuteStep && nodeId && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onExecuteStep(nodeId); }}
                    onMouseDown={(e) => e.stopPropagation()}
                    disabled={runInFlight || executingThis}
                    title={runInFlight ? 'Run in progress' : 'Execute this step only'}
                    className="absolute -top-3 left-1/2 -translate-x-1/2 h-6 w-6 rounded-full bg-[var(--bg-primary)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)] shadow disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Execute step"
                >
                    {executingThis ? <Loader2 size={12} className="animate-spin" /> : <Play size={11} fill="currentColor" />}
                </button>
            )}

            {/* Quick-add "+" button — sits past the right handle so the
                user can click instead of dragging. Only rendered when
                the host wires `onAddAfter` (editable mode). */}
            {onAddAfter && nodeId && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onAddAfter(nodeId); }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="absolute top-1/2 -translate-y-1/2 -right-8 h-5 w-5 rounded-full bg-[var(--bg-primary)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)] shadow-sm"
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
                <div className="flex items-start gap-2">
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

            {/* Hover popover — inline, theme-tokened. */}
            {hover && hoverDetail && (
                <div
                    className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-20 w-[280px] rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-lg p-2.5 text-[11px] text-[var(--text-primary)] pointer-events-none"
                >
                    {hoverDetail}
                </div>
            )}
        </div>
    );
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

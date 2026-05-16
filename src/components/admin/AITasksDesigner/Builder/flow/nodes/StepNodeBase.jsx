import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { AlertCircle, AlertTriangle, Plus, Play, Pin, Loader2 } from 'lucide-react';
import { useNodeRuntime } from '../NodeRuntimeContext';

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
    icon, typeLabel, body, badges = null, hoverDetail = null,
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
    const onExecuteStep = rt.onExecuteStep;
    const executingThis = nodeId && rt.executingStepId === nodeId;
    const runInFlight = !!rt.runInFlight;
    const runIndex = nodeId ? rt.runIndexById?.get?.(nodeId) : null;
    const runTotal = rt.runTotal ?? null;

    const status = runStep?.status || 'idle';
    const errCount = issues?.errors?.length || 0;
    const warnCount = issues?.warnings?.length || 0;

    // Only render the left status bar when there's a real run status —
    // the idle grey was visual noise on every node. Cyan flags a pinned
    // node; amber-dashed is "disabled". They have lower priority than
    // an active run status (the user wants to see the *live* state).
    const barTone = status === 'success' ? 'bg-emerald-500'
        : status === 'pinned' ? 'bg-cyan-500'
        : status === 'error' ? 'bg-red-500'
        : status === 'running' ? 'bg-[var(--accent)] animate-[pulse_1.2s_ease-in-out_infinite]'
        : pinned ? 'bg-cyan-500'
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
            className={`group relative w-[240px] rounded-lg border bg-[var(--bg-secondary)] shadow-sm hover:shadow-md transition-shadow duration-150 cursor-pointer ${dim || disabled ? 'opacity-60' : ''} ${disabled ? 'border-dashed border-amber-500/60' : 'border-[var(--border-default)]'}`}
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

            {/* Left status bar — only shown when there's an active run status. */}
            {barTone && (
                <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${barTone}`} />
            )}

            <div className="pl-3 pr-2 py-2">
                {/* Header row: icon + type label + right badges */}
                <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[var(--text-secondary)] flex-shrink-0">{icon}</span>
                        <span className="text-[10px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)] truncate">
                            {typeLabel}
                        </span>
                    </div>
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
                </div>
                {/* Body slot */}
                <div className="text-xs text-[var(--text-primary)] leading-snug">
                    {body}
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

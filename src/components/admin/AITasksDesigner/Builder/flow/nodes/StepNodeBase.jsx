import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { AlertCircle, AlertTriangle, Plus } from 'lucide-react';

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

    const status = runStep?.status || 'idle';
    const errCount = issues?.errors?.length || 0;
    const warnCount = issues?.warnings?.length || 0;

    // Only render the left status bar when there's a real run status —
    // the idle grey was visual noise on every node.
    const barTone = status === 'success' ? 'bg-emerald-500'
        : status === 'error' ? 'bg-red-500'
        : status === 'running' ? 'bg-[var(--accent)] animate-[pulse_1.2s_ease-in-out_infinite]'
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
            className={`group relative w-[240px] rounded-lg border bg-[var(--bg-secondary)] border-[var(--border-default)] shadow-sm hover:shadow-md transition-shadow duration-150 cursor-pointer ${dim ? 'opacity-60' : ''}`}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
        >
            <Handle type="target" position={Position.Left} className={handleClass} style={{ left: -6 }} />
            <Handle type="source" position={Position.Right} className={handleClass} style={{ right: -6 }} />

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
                    {badges && <div className="flex items-center gap-1 flex-shrink-0">{badges}</div>}
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

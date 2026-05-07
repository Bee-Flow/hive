import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { AlertCircle, AlertTriangle } from 'lucide-react';

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
 *
 * Hover popover uses inline CSS only — no external popover lib.
 */
export default function StepNodeBase({
    icon, typeLabel, body, badges = null, hoverDetail = null,
    runStep, issues, dim = false,
}) {
    const [hover, setHover] = useState(false);

    const status = runStep?.status || 'idle';
    const errCount = issues?.errors?.length || 0;
    const warnCount = issues?.warnings?.length || 0;

    const barTone = status === 'success' ? 'bg-emerald-500'
        : status === 'error' ? 'bg-red-500'
        : status === 'running' ? 'bg-[var(--accent)] animate-[pulse_1.2s_ease-in-out_infinite]'
        : 'bg-[var(--border-default)]';

    return (
        <div
            className={`relative w-[240px] rounded-lg border bg-[var(--bg-secondary)] border-[var(--border-default)] shadow-sm hover:shadow-md transition cursor-pointer ${dim ? 'opacity-60' : ''}`}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
        >
            {/* React Flow connection points (we don't let users draw edges
                manually but the handles need to exist for edges to render). */}
            <Handle type="target" position={Position.Left} style={{ background: 'transparent', border: 0, width: 1, height: 1 }} />
            <Handle type="source" position={Position.Right} style={{ background: 'transparent', border: 0, width: 1, height: 1 }} />

            {/* Left status bar */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${barTone}`} />

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

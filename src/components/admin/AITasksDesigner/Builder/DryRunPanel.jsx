import { Eye, ChevronDown, ChevronUp, X } from 'lucide-react';
import React, { useMemo } from 'react';
import OutputView from './OutputView';
import { humanizeToolName } from './flow/displayHelpers';

/**
 * Dry-run preview, rendered as a collapsible, dismissible drawer that
 * floats over the bottom of the canvas (mounted absolutely by BuilderShell)
 * so it no longer steals diagram height. Shows per-step "would have called
 * X with Y" plus any synthesised side-effect outputs.
 *
 * Step outputs are rendered with the same collapsible/colour-coded JsonTree
 * the step inspector uses (instead of a raw JSON dump) so a payload is
 * compact and scannable: top-level keys are visible, nested arrays/objects
 * collapse, and long string leaves truncate with a hover tooltip.
 *
 * Uses theme tokens (`--bg-secondary`, accent text) instead of hardcoded
 * yellows so the panel works under both light and dark themes.
 */
export default function DryRunPanel({ run, steps, definition = null, collapsed = false, onToggleCollapse, onClose }) {
    // Map every step id → a friendly name (label / tool / flowlet title) so the
    // preview shows real step NAMES, not ids. Built from the whole definition
    // (root steps + each flowlet's steps).
    const nameMap = useMemo(() => buildNameMap(definition), [definition]);
    const nameFor = (stepId) => {
        if (!stepId) return 'Step';
        const bare = stepId.includes('/') ? stepId.split('/').pop() : stepId;
        return nameMap.get(stepId) || nameMap.get(bare) || stepId;
    };

    // Only show TOP-LEVEL steps. A `call_layer` records the flowlet's own
    // sub-steps with a `parentStepId`; hiding those leaves just the call_layer
    // row, whose output IS the flowlet's return — i.e. "only the flowlet output".
    const stepList = (Array.isArray(steps) ? steps : []).filter(s => s && !s.parentStepId);

    if (!run) return null;

    return (
        <div className="m-3 rounded-lg border border-amber-500/30 bg-amber-500/5 backdrop-blur-sm shadow-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 text-sm">
                <button
                    type="button"
                    onClick={onToggleCollapse}
                    className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-400 min-w-0 flex-1 text-left"
                    title={collapsed ? 'Expand dry-run preview' : 'Collapse dry-run preview'}
                >
                    <Eye size={16} className="shrink-0" />
                    <span className="truncate">Dry-run preview ({run.status})</span>
                    <span className="text-[var(--text-tertiary)] font-normal shrink-0">· {stepList.length} step{stepList.length === 1 ? '' : 's'}</span>
                    {collapsed ? <ChevronUp size={15} className="shrink-0" /> : <ChevronDown size={15} className="shrink-0" />}
                </button>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        title="Dismiss dry-run preview"
                        className="shrink-0 p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                    >
                        <X size={15} />
                    </button>
                )}
            </div>
            {!collapsed && (
                <div className="px-3 pb-3">
                    {run.summary && (
                        <div className="text-xs text-[var(--text-secondary)] mb-2 whitespace-pre-wrap line-clamp-2">{run.summary}</div>
                    )}
                    {/* Cap the step list so a many-step dry-run scrolls internally
                        instead of growing without bound. */}
                    <div className="flex flex-col gap-1.5 max-h-[40vh] overflow-y-auto pr-1">
                        {stepList.map((s, idx) => {
                            if (!s) return null;
                            const out = s.output || null;
                            const wouldNotify = out && out.wouldNotify;
                            const wouldCall = out && out._dryRun;
                            const isSynthesised = out && out._dryRunSynthesised;
                            return (
                                <div
                                    key={`${s.stepId || 'step'}-${s.attempts ?? idx}`}
                                    className="rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] p-2 text-xs"
                                >
                                    <div className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                                        <span className="truncate" title={s.stepId}>{nameFor(s.stepId)}</span>
                                        <span className="text-[var(--text-tertiary)] font-normal shrink-0">({s.stepType})</span>
                                        {isSynthesised && (
                                            <span
                                                title={out._dryRunFallback === 'live_failed'
                                                    ? 'The live read failed, so a sample shape was used for this preview.'
                                                    : out._dryRunFallback === 'live_empty'
                                                        ? 'The live read returned nothing, so a sample shape was used for this preview.'
                                                        : 'Synthesized preview — sample data, not a live result.'}
                                                className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/30"
                                            >
                                                Sample data
                                            </span>
                                        )}
                                    </div>
                                    {wouldNotify && (
                                        <div className="text-amber-700 dark:text-amber-400 mt-1">
                                            Would notify on <strong>{(wouldNotify.channels || []).join(', ')}</strong>:{' '}
                                            <em>{wouldNotify.title}</em>
                                        </div>
                                    )}
                                    {wouldCall && !wouldNotify && (
                                        <>
                                            <div className="text-amber-700 dark:text-amber-400 mt-1">
                                                Would call <code className="font-mono">{out.wouldHaveCalled}</code>
                                            </div>
                                            {out.withArgs != null && <OutputView value={out.withArgs} />}
                                        </>
                                    )}
                                    {out && !wouldNotify && !wouldCall && (
                                        <OutputView value={stripDryRunMeta(out)} />
                                    )}
                                    {s.error && (
                                        <div className="text-red-600 dark:text-red-400 mt-1 whitespace-pre-wrap">{s.error}</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// Friendly display name for a step: its label, else a sensible per-type
// fallback (humanised tool name, flowlet title, or type).
function friendlyStepName(step, definition) {
    if (!step) return null;
    if (step.type === 'trigger') return step.label || 'Trigger';
    if (step.type === 'call_layer') {
        const title = definition?.layers?.[step.layerKey]?.title;
        return step.label || title || 'Flowlet';
    }
    if (step.label && step.label.trim()) return step.label;
    if (step.type === 'integration_action' && step.tool) return humanizeToolName(step.tool);
    if (step.type === 'layer_output') return 'Return';
    return (step.type || 'step').replace(/_/g, ' ');
}

/**
 * Build `stepId → friendly name` from the whole definition: the root trigger,
 * every root step, and every flowlet's steps (keyed by their own id so a
 * namespaced `callId/innerId` resolves via its bare suffix).
 */
function buildNameMap(definition) {
    const map = new Map();
    if (!definition || typeof definition !== 'object') return map;
    const add = (step) => { if (step?.id) map.set(step.id, friendlyStepName(step, definition)); };
    if (definition.trigger) add(definition.trigger);
    for (const s of (definition.steps || [])) add(s);
    const layers = (definition.layers && typeof definition.layers === 'object') ? definition.layers : {};
    for (const layer of Object.values(layers)) {
        if (layer?.trigger) add(layer.trigger);
        for (const s of (layer?.steps || [])) add(s);
    }
    return map;
}

// Plumbing flags the runner injects onto a synthesised output. They're
// already surfaced by the "Sample data" badge, so showing them raw in the
// tree is just noise — strip them (top-level only, where they're injected)
// before rendering. Returns the value untouched when none are present.
const DRY_RUN_META_KEYS = ['_dryRun', '_dryRunSynthesised', '_dryRunFallback'];

function stripDryRunMeta(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    if (!DRY_RUN_META_KEYS.some(k => k in value)) return value;
    const cleaned = { ...value };
    for (const k of DRY_RUN_META_KEYS) delete cleaned[k];
    return cleaned;
}

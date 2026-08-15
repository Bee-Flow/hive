import {
    Plus, Trash2, ChevronUp, ChevronDown, ChevronRight,
    Sparkles, Zap, GitBranch, Split, Repeat, Hourglass, OctagonX, Bell,
    Pencil, Clock, Filter, ChevronsDown, Copy, Layers, Sigma, Code, Box, Globe,
    ClipboardList,
} from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import AddStepMenu from '../flow/AddStepMenu';
import { FormDensityContext } from '../flow/settings/formDensity';
import SettingsForm from '../flow/SettingsForm';
import { VariablePickerProvider } from './VariablePickerContext';
import { computeLoopBodyGroups } from './upstream';
import { buildStepFromPayload } from '../DiagramPane';

// The nested SettingsForm always renders every section — see the comment at
// its mount. Module-level so the provider value is referentially stable.
const FORCED_ADVANCED = { density: 'full', mode: 'advanced', onHiddenSection: null, onShownSection: null };

const TYPE_ICON = {
    ai_step: Sparkles, integration_action: Zap, condition: GitBranch, switch: Split,
    loop: Repeat, wait: Hourglass, stop_error: OctagonX, notification: Bell,
    set: Pencil, datetime: Clock, filter: Filter, limit: ChevronsDown, dedupe: Copy,
    aggregate: Layers, summarize: Sigma, code: Code, call_layer: Layers, call_block: Box,
    http_request: Globe,
    form_page: ClipboardList,
};

function rowLabel(step) {
    if (step.label) return step.label;
    if (step.type === 'integration_action' && step.tool) return step.tool;
    return String(step.type || 'step').replace(/_/g, ' ');
}

/**
 * Real step-list editor for a Loop's `body[]` — the steps that run per item
 * (or per batch, when batchSize>1). Body steps are NOT canvas nodes (execLoop
 * runs them via a synthetic per-iteration sub-DAG, never individually
 * recorded — see engine.js), so this is inspector-only authoring: add /
 * reorder / remove rows, each expandable into its own full SettingsForm
 * (recursive reuse — every field type, including PathField/ConditionBuilder/
 * BindingField pickers, works exactly as it does for a top-level step).
 *
 * Props:
 *   loopStep       — the Loop step (for overRef/itemVar/batchSize context)
 *   onChange(next) — (nextBody: []) => void — replaces the whole body array
 *   outerGroups    — upstream groups OUTSIDE the loop (from the Loop's own
 *                    `groups` prop) — every body step also sees these
 *   previewSample  — the NDV's merged sample root
 *   catalog, modelTiers, rootDefinition, blocksCatalog — forwarded verbatim
 *                    to the nested SettingsForm/computeLoopBodyGroups
 *   onFocusField   — forwarded to nested picker fields
 */
export default function LoopBodyEditor({
    loopStep, onChange, outerGroups = [], previewSample = null,
    catalog = null, modelTiers = {}, rootDefinition = null, blocksCatalog = [],
    onFocusField,
}) {
    const body = Array.isArray(loopStep.body) ? loopStep.body : [];
    const [expandedId, setExpandedId] = useState(null);
    const [addOpen, setAddOpen] = useState(false);

    // Fresh body for late-firing closures (B7): a nested SettingsForm's
    // unmount FLUSH (autosave debounce) runs with a closure captured before a
    // delete/reorder — an index-based patch against the stale array literally
    // RESURRECTED a just-deleted step (the flush wrote the pre-delete body
    // back). Patching by id against the current ref drops a flush for a
    // deleted id and always lands on the right row after a reorder.
    const bodyRef = useRef(body);
    bodyRef.current = body;

    const addStep = (payload) => {
        const scaffold = buildStepFromPayload(payload, { x: 0, y: 0 });
        // Triggers/meta-actions (create_layer → null) can't live in a body.
        // ALWAYS close the menu — a null payload used to leave it hanging
        // open as a dead click (B8).
        if (!scaffold || scaffold.__replaceTrigger || scaffold.__addTrigger) { setAddOpen(false); return; }
        const { position: _position, __replaceTrigger: _t, __addTrigger: _t2, ...step } = scaffold;
        onChange([...bodyRef.current, step]);
        setAddOpen(false);
        setExpandedId(step.id);
    };
    const removeStep = (id) => {
        onChange(bodyRef.current.filter((s) => s.id !== id));
        if (expandedId === id) setExpandedId(null);
    };
    const moveStep = (i, dir) => {
        const cur = bodyRef.current;
        const j = i + dir;
        if (j < 0 || j >= cur.length) return;
        const next = cur.slice();
        [next[i], next[j]] = [next[j], next[i]];
        onChange(next);
    };
    const patchStepById = (id) => (patch) => {
        const cur = Array.isArray(bodyRef.current) ? bodyRef.current : [];
        const idx = cur.findIndex((s) => s.id === id);
        if (idx === -1) return; // step was deleted — drop the stale flush
        const next = cur.slice();
        next[idx] = { ...next[idx], ...patch };
        onChange(next);
    };

    return (
        <div className="space-y-2">
            {body.length === 0 && (
                <div className="text-[11px] text-[var(--text-tertiary)] italic">
                    No steps yet — add at least one to run per item.
                </div>
            )}
            <div className="space-y-1.5">
                {body.map((step, i) => {
                    const Icon = TYPE_ICON[step.type] || Box;
                    const expanded = expandedId === step.id;
                    const bodyGroups = computeLoopBodyGroups(loopStep, i, outerGroups, previewSample, catalog, rootDefinition);
                    return (
                        <div key={step.id} className="rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]/40 overflow-hidden">
                            <div className="flex items-center gap-1.5 px-2 py-1.5">
                                <button
                                    type="button"
                                    onClick={() => setExpandedId(expanded ? null : step.id)}
                                    className="flex-1 min-w-0 flex items-center gap-1.5 text-left"
                                >
                                    {expanded ? <ChevronDown size={12} className="shrink-0 text-[var(--text-tertiary)]" /> : <ChevronRight size={12} className="shrink-0 text-[var(--text-tertiary)]" />}
                                    <Icon size={13} className="shrink-0 text-[var(--text-secondary)]" />
                                    <span className="truncate text-xs font-medium text-[var(--text-primary)]">{i + 1}. {rowLabel(step)}</span>
                                </button>
                                <button type="button" onClick={() => moveStep(i, -1)} disabled={i === 0} title="Move up" className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-30 disabled:pointer-events-none">
                                    <ChevronUp size={12} />
                                </button>
                                <button type="button" onClick={() => moveStep(i, 1)} disabled={i === body.length - 1} title="Move down" className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-30 disabled:pointer-events-none">
                                    <ChevronDown size={12} />
                                </button>
                                <button type="button" onClick={() => removeStep(step.id)} title="Remove step" className="p-1 rounded text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10">
                                    <Trash2 size={12} />
                                </button>
                            </div>
                            {expanded && (
                                <div className="border-t border-[var(--border-default)] bg-[var(--bg-primary)]">
                                    <VariablePickerProvider groups={bodyGroups} previewSample={previewSample} stepLabelById={new Map(bodyGroups.map(g => [g.id, g.label]))}>
                                        {/* Inner steps are FORCED to All options: they have
                                            no mode toggle of their own, so inheriting
                                            Simple from the outer editor would hide
                                            sections with no way in. */}
                                        <FormDensityContext.Provider value={FORCED_ADVANCED}>
                                        <div className="max-h-[420px] overflow-y-auto">
                                            <SettingsForm
                                                step={step}
                                                modelTiers={modelTiers}
                                                stepIssues={{ errors: [], warnings: [] }}
                                                saving={false}
                                                saveError={null}
                                                onPatch={patchStepById(step.id)}
                                                onFocusField={onFocusField}
                                                previewSample={previewSample}
                                                catalog={catalog}
                                                groups={bodyGroups}
                                                rootDefinition={rootDefinition}
                                                blocksCatalog={blocksCatalog}
                                            />
                                        </div>
                                        </FormDensityContext.Provider>
                                    </VariablePickerProvider>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <button
                type="button"
                onClick={() => setAddOpen((o) => !o)}
                className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] px-2 py-1 rounded transition"
            >
                <Plus size={12} /> Add step
            </button>
            {addOpen && (
                <div className="rounded border border-[var(--border-default)] bg-[var(--bg-primary)] max-h-[320px] flex flex-col">
                    <AddStepMenu
                        scope={{ catalog, layers: [], inLayer: true, canAddLayerOutput: false, isBlockRoot: true, canCreateLayer: false }}
                        onAdd={addStep}
                        autoFocus
                    />
                </div>
            )}
        </div>
    );
}


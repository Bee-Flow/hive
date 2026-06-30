import {
    X, Play, Pin, PinOff, Power, RotateCw, Loader2, Check, AlertCircle,
    PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
    ChevronDown, ChevronRight, GripVertical,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ApprovalActionBar from './approvals/ApprovalActionBar';
import RunTabContainer from './debug/RunTabContainer';
import { buildStepLabelMap } from './flow/displayHelpers';
import { matchValidationToStep } from './flow/matchValidationToStep';
import SettingsForm from './flow/SettingsForm';
import { VariablePickerProvider } from './mapping/VariablePickerContext';
import OutputView from './OutputView';
import useAutomationApi from '../../../../hooks/useAutomationApi';
import useUpstreamVariables from '../../../../hooks/useUpstreamVariables';
import { walkPath } from '../../../../utils/bindingHelpers';
import scopedStorage from '../../../../utils/scopedStorage';

/**
 * Node Detail View (NDV) — an n8n-style focused editor for a single step.
 * Opens as a centered overlay that dims the canvas and lays the step out as
 * three columns: INPUT (upstream data) | PARAMETERS (the settings form) |
 * OUTPUT (run result). Replaces the old node-anchored hover-peek + side dock.
 *
 * It reuses every existing building block — VariableTree (input, drag/click to
 * map), SettingsForm (parameters, with accordions + step-name chips),
 * RunTabContainer (output) — and the same save/groups/preview core the old
 * inspector used. One node at a time; close with X / Esc / backdrop.
 */
const STEP_TYPE_LABEL = {
    trigger: 'Trigger', ai_step: 'AI step', integration_action: 'Action',
    condition: 'Condition', loop: 'Loop', code: 'Code', notification: 'Notification',
    call_layer: 'Flowlet', call_block: 'Step', layer_output: 'Return', set: 'Set fields',
    datetime: 'Date / time', wait: 'Wait', stop_error: 'Stop', switch: 'Switch',
    filter: 'Filter', limit: 'Limit', dedupe: 'Dedupe', aggregate: 'Aggregate', summarize: 'Summarize',
};
function stepTypeLabel(step) {
    if (!step) return '';
    if (step.type === 'trigger' && step.kind === 'layer_input') return 'Flowlet input';
    return STEP_TYPE_LABEL[step.type] || String(step.type || '').replace(/_/g, ' ');
}

export default function NodeDetailView({
    step, runStep, runSteps = [], definition, rootDefinition = null, blocksCatalog = [], onSaveStep,
    validation, modelTiers = {}, onExecuteStep, onRetryFromStep,
    runInFlight = false, executingStep = false, onClose,
}) {
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [saveStatus, setSaveStatus] = useState('idle');
    const savedFadeRef = useRef(null);
    const wasSavingRef = useRef(false);
    useEffect(() => {
        if (saving) { wasSavingRef.current = true; setSaveStatus('saving'); return; }
        if (saveError) { wasSavingRef.current = false; setSaveStatus('error'); return; }
        if (wasSavingRef.current) {
            wasSavingRef.current = false;
            setSaveStatus('saved');
            if (savedFadeRef.current) clearTimeout(savedFadeRef.current);
            savedFadeRef.current = setTimeout(() => setSaveStatus('idle'), 1500);
        }
    }, [saving, saveError]);
    useEffect(() => () => { if (savedFadeRef.current) clearTimeout(savedFadeRef.current); }, []);

    // Catalog (tool schemas) fetched once; upstream groups + preview sample
    // derived from the definition + this step.
    const api = useAutomationApi();
    const [catalog, setCatalog] = useState(null);
    useEffect(() => {
        let alive = true;
        api.getCatalog().then(c => { if (alive) setCatalog(c); }).catch(() => {});
        return () => { alive = false; };
    }, [api]);

    const groups = useUpstreamVariables(definition, step?.id, catalog);
    const previewSample = useMemo(
        () => buildSampleRoot(groups, definition, runSteps),
        [groups, definition, runSteps],
    );
    const stepLabelById = useMemo(() => buildStepLabelMap(definition), [definition]);

    // Active field <-> Input tree wiring (click/drag a field to insert it).
    const activeFieldRef = useRef(null);
    const [activeLabel, setActiveLabel] = useState(null);
    const onFocusField = (handle) => { activeFieldRef.current = handle; setActiveLabel(handle?.label || null); };
    const onInsertFromTree = (path) => { activeFieldRef.current?.insert?.(path); };

    const stepIssues = useMemo(() => matchValidationToStep(validation, step?.id), [step, validation]);

    // Collapsible Input / Output columns (persisted per-user).
    const [inputOpen, setInputOpen] = useState(() => scopedStorage.getItem('ndvInputOpen') !== '0');
    const [outputOpen, setOutputOpen] = useState(() => scopedStorage.getItem('ndvOutputOpen') !== '0');
    useEffect(() => { scopedStorage.setItem('ndvInputOpen', inputOpen ? '1' : '0'); }, [inputOpen]);
    useEffect(() => { scopedStorage.setItem('ndvOutputOpen', outputOpen ? '1' : '0'); }, [outputOpen]);

    // Resizable Input / Output column widths (persisted). Drag the inner edge
    // of either column to make it wider/narrower (Parameters takes the rest).
    const COL_MIN = 220, COL_MAX = 900;
    const clampW = (v, d) => { const n = Number(v); return Number.isFinite(n) && n >= COL_MIN && n <= COL_MAX ? n : d; };
    const [inputW, setInputW] = useState(() => clampW(scopedStorage.getItem('ndvInputWidth'), 320));
    const [outputW, setOutputW] = useState(() => clampW(scopedStorage.getItem('ndvOutputWidth'), 440));
    useEffect(() => { scopedStorage.setItem('ndvInputWidth', String(inputW)); }, [inputW]);
    useEffect(() => { scopedStorage.setItem('ndvOutputWidth', String(outputW)); }, [outputW]);
    const dragRef = useRef(null);
    const onColResizeDown = (setW, sign, curW) => (e) => {
        dragRef.current = { setW, sign, startX: e.clientX, startW: curW };
        e.currentTarget.setPointerCapture?.(e.pointerId);
        e.preventDefault();
    };
    const onColResizeMove = (e) => {
        const d = dragRef.current;
        if (!d) return;
        d.setW(Math.min(COL_MAX, Math.max(COL_MIN, d.startW + (e.clientX - d.startX) * d.sign)));
    };
    const onColResizeUp = (e) => { if (dragRef.current) { dragRef.current = null; e.currentTarget.releasePointerCapture?.(e.pointerId); } };
    const colResizeHandle = (side, setW, sign, curW) => (
        <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize column"
            onPointerDown={onColResizeDown(setW, sign, curW)}
            onPointerMove={onColResizeMove}
            onPointerUp={onColResizeUp}
            className={`absolute top-0 ${side === 'right' ? 'right-0' : 'left-0'} h-full w-1.5 cursor-col-resize z-10 hover:bg-[var(--accent)]/30 transition-colors`}
        />
    );

    // Esc to close.
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); } };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    // Coalesced step save (same contract the old inspector used).
    const saveInflightRef = useRef(null);
    const saveQueuedRef = useRef(null);
    const definitionRef = useRef(definition);
    const stepRef = useRef(step);
    const onSaveStepRef = useRef(onSaveStep);
    useEffect(() => { definitionRef.current = definition; stepRef.current = step; onSaveStepRef.current = onSaveStep; });
    const persistStepPatch = useCallback(async (patch) => {
        if (!definition || typeof onSaveStep !== 'function' || !step) return undefined;
        if (saveInflightRef.current) { saveQueuedRef.current = patch; return saveInflightRef.current; }
        const doSave = async (currentPatch) => {
            const next = { ...definition };
            const merged = { ...step, ...currentPatch, id: step.id };
            if (definition.trigger?.id === step.id) next.trigger = merged;
            else next.steps = (definition.steps || []).map(s => s.id === step.id ? merged : s);
            setSaving(true);
            setSaveError(null);
            try { await onSaveStep(next); } catch (e) { setSaveError(e.message || 'Save failed'); }
            setSaving(false);
        };
        saveInflightRef.current = (async () => {
            try { await doSave(patch); }
            finally {
                const queued = saveQueuedRef.current;
                saveQueuedRef.current = null;
                saveInflightRef.current = null;
                if (queued) await persistStepPatch(queued);
            }
        })();
        return saveInflightRef.current;
    }, [definition, step, onSaveStep]);

    // Flush a queued patch on unmount (close within the autosave debounce).
    useEffect(() => () => {
        const queued = saveQueuedRef.current;
        if (!queued) return;
        saveQueuedRef.current = null;
        const def = definitionRef.current, stp = stepRef.current, save = onSaveStepRef.current;
        if (!def || !stp || typeof save !== 'function') return;
        const next = { ...def };
        const merged = { ...stp, ...queued, id: stp.id };
        if (def.trigger?.id === stp.id) next.trigger = merged;
        else next.steps = (def.steps || []).map(s => s.id === stp.id ? merged : s);
        Promise.resolve(save(next)).catch(err => console.warn('[NodeDetailView] flush on unmount failed:', err?.message || err));
    }, []);

    if (!step) return null;
    if (typeof document === 'undefined') return null;

    const isTrigger = definition?.trigger?.id === step.id;
    const outputPinned = step.pinnedOutput !== undefined && step.pinnedOutput !== null;
    const iconBtn = 'p-1.5 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition';

    return createPortal(
        <div
            role="presentation"
            onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        >
            <div
                data-surface="default"
                role="dialog"
                aria-modal="true"
                aria-label={`Edit ${step.label || step.type}`}
                className="relative w-full max-w-[1600px] h-[88vh] flex flex-col rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-2xl overflow-hidden"
            >
                {/* Header — identity + per-step actions + column toggles + close */}
                <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border-default)] flex-shrink-0">
                    <div className="min-w-0 flex items-center gap-2">
                        <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)]">{stepTypeLabel(step)}</div>
                            <div className="text-sm font-semibold text-[var(--text-primary)] truncate leading-tight">{step.label || step.tool || step.id}</div>
                        </div>
                        <SaveStatusChip status={saveStatus} error={saveError} />
                    </div>

                    {!isTrigger && (
                        <div className="flex items-center gap-1 ml-2">
                            {typeof onExecuteStep === 'function' && (
                                <button
                                    onClick={() => onExecuteStep(step.id)}
                                    disabled={runInFlight || executingStep}
                                    title="Execute this step only (uses upstream replay / pinned data)"
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-40 transition"
                                >
                                    {executingStep ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} fill="currentColor" />}
                                    Execute
                                </button>
                            )}
                            <button
                                onClick={async () => {
                                    if (outputPinned) await persistStepPatch({ pinnedOutput: null, pinnedAt: null });
                                    else if (runStep?.output != null) await persistStepPatch({ pinnedOutput: runStep.output, pinnedAt: new Date().toISOString() });
                                }}
                                disabled={!runStep?.output && !outputPinned}
                                title={outputPinned ? 'Unpin output (re-enable live execution)' : 'Pin this output (skip live execution; reuse the latest output)'}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition disabled:opacity-30 ${
                                    outputPinned
                                        ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40'
                                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
                            >
                                {outputPinned ? <PinOff size={11} /> : <Pin size={11} />}
                                {outputPinned ? 'Pinned' : 'Pin'}
                            </button>
                            <button
                                onClick={() => persistStepPatch({ disabled: !step.disabled })}
                                title={step.disabled ? 'Re-enable this node' : 'Disable this node (skipped during execution)'}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition ${
                                    step.disabled
                                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40'
                                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
                            >
                                <Power size={11} />
                                {step.disabled ? 'Disabled' : 'Disable'}
                            </button>
                            {typeof onRetryFromStep === 'function' && runStep?.status === 'error' && (
                                <button
                                    onClick={() => onRetryFromStep(step.id)}
                                    disabled={runInFlight}
                                    title="Retry this step and continue downstream from here"
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-40 transition border border-amber-500/30"
                                >
                                    <RotateCw size={11} /> Retry
                                </button>
                            )}
                        </div>
                    )}

                    <div className="ml-auto flex items-center gap-1">
                        <button onClick={() => setInputOpen(o => !o)} title={inputOpen ? 'Hide input' : 'Show input'} aria-label={inputOpen ? 'Hide input' : 'Show input'} className={iconBtn}>
                            {inputOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
                        </button>
                        <button onClick={() => setOutputOpen(o => !o)} title={outputOpen ? 'Hide output' : 'Show output'} aria-label={outputOpen ? 'Hide output' : 'Show output'} className={iconBtn}>
                            {outputOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
                        </button>
                        <button onClick={onClose} aria-label="Close" className={iconBtn}><X size={17} /></button>
                    </div>
                </div>

                {runStep?.status === 'awaiting_approval' && runStep?.runId && (
                    <ApprovalActionBar runId={runStep.runId} stepId={step?.id} />
                )}

                {/* Body — INPUT | PARAMETERS | OUTPUT */}
                <div className="flex-1 min-h-0 flex">
                    {inputOpen && (
                        <aside style={{ width: inputW }} className="relative flex-shrink-0 border-r border-[var(--border-default)] bg-[var(--bg-secondary)]/30 min-h-0 flex flex-col">
                            <ColumnHeader>
                                Input
                                {activeLabel && <span className="ml-auto normal-case font-normal text-[var(--text-secondary)] truncate max-w-[55%]">→ {activeLabel}</span>}
                            </ColumnHeader>
                            <InputDataPanel groups={groups} previewSample={previewSample} onPick={onInsertFromTree} />
                            {colResizeHandle('right', setInputW, 1, inputW)}
                        </aside>
                    )}

                    <div className="flex-1 min-w-0 min-h-0 flex flex-col">
                        <ColumnHeader>Parameters</ColumnHeader>
                        <VariablePickerProvider groups={groups} previewSample={previewSample} stepLabelById={stepLabelById}>
                            <SettingsForm
                                key={step.id}
                                step={step}
                                modelTiers={modelTiers}
                                stepIssues={stepIssues}
                                saving={saving}
                                saveError={saveError}
                                onPatch={persistStepPatch}
                                onFocusField={onFocusField}
                                previewSample={previewSample}
                                catalog={catalog}
                                groups={groups}
                                rootDefinition={rootDefinition || definition}
                                blocksCatalog={blocksCatalog}
                            />
                        </VariablePickerProvider>
                    </div>

                    {outputOpen && (
                        <aside style={{ width: outputW }} className="relative flex-shrink-0 border-l border-[var(--border-default)] min-h-0 flex flex-col">
                            {colResizeHandle('left', setOutputW, -1, outputW)}
                            <ColumnHeader>
                                Output
                                {!isTrigger && typeof onExecuteStep === 'function' && (
                                    <button
                                        onClick={() => onExecuteStep(step.id)}
                                        disabled={runInFlight || executingStep}
                                        className="ml-auto inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] disabled:opacity-40 transition"
                                    >
                                        {executingStep ? <Loader2 size={11} className="animate-spin" /> : <Play size={10} fill="currentColor" />} Execute
                                    </button>
                                )}
                            </ColumnHeader>
                            <div className="flex-1 min-h-0">
                                <RunTabContainer step={step} runStep={runStep} />
                            </div>
                        </aside>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
}

function ColumnHeader({ children }) {
    return (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-default)] flex-shrink-0 text-[10px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)]">
            {children}
        </div>
    );
}

/**
 * Input panel — one collapsible section per upstream step, each rendering that
 * step's REAL output as the friendly Table/JSON view (OutputView). Every field,
 * column and cell is drag- and click-to-map into the current step's parameters;
 * the section header maps the whole output (`steps.<id>.output`).
 */
function InputDataPanel({ groups = [], previewSample = null, onPick }) {
    if (!groups.length) {
        return (
            <div className="flex-1 px-4 py-6 text-xs text-[var(--text-tertiary)] italic">
                No upstream data yet. Connect this step to a previous one to see its output here.
            </div>
        );
    }
    return (
        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
            {groups.map(g => (
                <InputNodeSection key={g.id} group={g} previewSample={previewSample} onPick={onPick} />
            ))}
            <div className="px-3 py-2 text-[10px] text-[var(--text-tertiary)]">
                Drag a value into a field (or the prompt), or click to insert. A column maps every row;
                open a column (›) to map a single field, e.g. just <span className="font-mono">content</span>.
            </div>
        </div>
    );
}

function InputNodeSection({ group, previewSample, onPick }) {
    const [open, setOpen] = useState(true);
    const value = walkPath(group.basePath, previewSample);
    const data = value === undefined ? group.sample : value;
    const dragWhole = (e) => {
        e.dataTransfer.setData('text/plain', group.basePath);
        e.dataTransfer.setData('application/x-binding-path', group.basePath);
        e.dataTransfer.effectAllowed = 'copy';
    };
    return (
        <div className="border-b border-[var(--border-default)] last:border-b-0 group/sec">
            <div
                draggable
                onDragStart={dragWhole}
                onClick={() => setOpen(o => !o)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); } }}
                title={`Drag to use the whole output (${group.basePath})`}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs hover:bg-[var(--bg-secondary)] cursor-grab active:cursor-grabbing select-none"
            >
                <GripVertical size={11} className="shrink-0 text-[var(--text-tertiary)] opacity-0 group-hover/sec:opacity-60" />
                {open ? <ChevronDown size={12} className="shrink-0 text-[var(--text-tertiary)]" /> : <ChevronRight size={12} className="shrink-0 text-[var(--text-tertiary)]" />}
                <span className="text-[var(--text-primary)] font-medium truncate">{group.label}</span>
                <span className="ml-auto text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide">output</span>
            </div>
            {open && (
                <div className="px-2 pb-2">
                    <OutputView
                        value={data}
                        basePath={group.basePath}
                        enableDrag
                        onPickPath={onPick}
                        emptyMessage="No data yet — run the upstream step to capture it."
                    />
                </div>
            )}
        </div>
    );
}

/**
 * Merge every upstream group's sample into a single root tree shaped like the
 * runtime resolver's runState — so walkPath('steps.s1.output.x') resolves to
 * the right placeholder. Powers BindingField / TemplateField preview lines.
 */
function buildSampleRoot(groups, definition = null, runSteps = []) {
    const root = { trigger: { output: {} }, steps: {}, loop: {} };
    const stepById = new Map();
    if (definition?.trigger?.id) stepById.set(definition.trigger.id, definition.trigger);
    for (const s of (definition?.steps || [])) if (s?.id) stepById.set(s.id, s);
    const realOutputFor = (id) => {
        const node = stepById.get(id);
        if (node && node.pinnedOutput !== undefined && node.pinnedOutput !== null) return node.pinnedOutput;
        const run = (runSteps || []).find(r => r && r.stepId === id && !r.parentStepId && r.output != null);
        return run ? run.output : undefined;
    };
    const withReal = (sample, real) => (real === undefined ? (sample || {}) : deepOverlay(sample, real));
    for (const g of groups || []) {
        if (g.kind === 'trigger') {
            root.trigger.output = withReal(g.sample, realOutputFor(definition?.trigger?.id));
        } else if (g.kind === 'loop') {
            const tail = String(g.basePath || '').split('.').slice(1).join('.');
            if (tail) root.loop[tail] = g.sample || {};
        } else {
            root.steps[g.id] = { output: withReal(g.sample, realOutputFor(g.id)) };
        }
    }
    return root;
}

function deepOverlay(base, real) {
    if (real === null || typeof real !== 'object' || Array.isArray(real)) return real;
    if (base === null || typeof base !== 'object' || Array.isArray(base)) return real;
    const out = { ...base };
    for (const k of Object.keys(real)) out[k] = (k in base) ? deepOverlay(base[k], real[k]) : real[k];
    return out;
}

function SaveStatusChip({ status, error }) {
    if (status === 'saving') return <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]"><Loader2 size={11} className="animate-spin" /> Saving…</span>;
    if (status === 'saved') return <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400"><Check size={11} /> Saved</span>;
    if (status === 'error') return <span className="inline-flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400" title={error || 'Save failed'}><AlertCircle size={11} /> Save failed</span>;
    return null;
}

import {
    X, Play, Pin, PinOff, Power, RotateCw, Loader2,
    PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
    ChevronDown, ChevronLeft, ChevronRight, Copy as CopyIcon, Trash2,
    Maximize2, Minimize2, ArrowRight,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ApprovalActionBar from './approvals/ApprovalActionBar';
import RunTabContainer from './debug/RunTabContainer';
import { summariseData } from './flow/dataSummary';
import { actionDisplayLabel, buildStepLabelMap } from './flow/displayHelpers';
import IntegrationLogo from './flow/nodes/IntegrationLogo';
import { defaultTriggerLabel, triggerTypeLabel } from './flow/triggerLabels';
import { matchValidationToStep } from './flow/matchValidationToStep';
import { flowPosition } from './flow/flowOrder';
import { nodeTypeLabel } from './flow/nodeDefs';
import { normalizeDefinitionShape } from './flow/normalizeDefinition';
import { mergeStepPatchIntoDefinition } from './flow/switchCaseOps';
import { FormDensityContext } from './flow/settings/formDensity';
import SettingsHost from './flow/settings/SettingsHost';
import InputDataPanel from './mapping/InputDataPanel';
import { buildRealOutputMap, buildSampleRoot, isTruncatedOutput } from './mapping/realOutputs';
import { VariablePickerProvider } from './mapping/VariablePickerContext';
import SaveStatus from '../../../shared/SaveStatus';
import useAutomationApi from '../../../../hooks/useAutomationApi';
import useSavingState from '../../../../hooks/useSavingState';
import useUpstreamVariables from '../../../../hooks/useUpstreamVariables';
import { walkPath } from '../../../../utils/bindingHelpers';
import scopedStorage from '../../../../utils/scopedStorage';

/**
 * Node Detail View (NDV) — the focused editor for a single step, at two
 * densities:
 *
 *   'quick' (a single click on a node) — a small centred dialog with just the
 *      fields that make the step work, plus a one-line "what goes in, what
 *      comes out". Most steps are one or two fields; a full-screen
 *      three-column editor for `query: nextcloud` is noise.
 *   'full'  (a double click, or "More options") — the n8n-style three columns:
 *      INPUT (upstream data) | PARAMETERS | OUTPUT (run result).
 *
 * Both are the SAME component and the same save path, so switching between
 * them mid-edit can't lose anything. Which sections the quick view leaves out
 * is declared once in flow/settings/formDensity.js.
 *
 * It reuses every existing building block — OutputView (input, drag/click to
 * map), SettingsForm (parameters, with accordions + step-name chips),
 * RunTabContainer (output) — and the same save/groups/preview core the old
 * inspector used. One node at a time; close with X / Esc / backdrop.
 */
/**
 * What KIND of node this is, for the header kicker. The map this used to hold
 * had no `guard` / `tokenize` / `untokenize` entry, so the three privacy nodes
 * fell through to the raw-type fallback below and headed their own editor
 * "guard", "tokenize", "untokenize" — precisely the jargon those nodes were
 * renamed away from. It also disagreed with the palette in three more places
 * ("Dedupe" vs "Remove duplicates", "Stop" vs "Stop and error", "Date / time"
 * vs "Date & Time"). It now reads from flow/nodeDefs.js, which a completeness
 * test keeps exhaustive; the fallback stays as a belt-and-braces and is
 * asserted unreachable.
 */
function stepTypeLabel(step, t = null) {
    if (!step) return '';
    if (step.type === 'trigger') return triggerTypeLabel(step);
    return nodeTypeLabel(step.type, t) || String(step.type || '').replace(/_/g, ' ');
}

/**
 * What the header calls this node. `step.label || step.tool || step.id` used
 * to put a raw `gmail_search` — or, for a trigger, the bare `trg` — in the one
 * place the user looks to check they opened the right node (BFSF-333).
 */
function headerTitle(step, catalog) {
    if (!step) return '';
    if (step.label) return step.label;
    if (step.type === 'trigger') return defaultTriggerLabel(step.kind || 'manual');
    if (step.tool) return actionDisplayLabel(step.tool, catalog);
    return stepTypeLabel(step) || step.id;
}

export default function NodeDetailView({
    step, runStep, runSteps = [], definition, rootDefinition = null, blocksCatalog = [], onSaveStep,
    validation, modelTiers = {}, onExecuteStep, onRetryFromStep,
    runInFlight = false, executingStep = false, onClose,
    // 'quick' | 'full' — owned by the shell so the canvas gestures can set it
    // (click vs double-click) and the choice persists per user.
    density = 'full',
    onDensityChange = null,
    // The persisted automation row. Only the webhook trigger's settings need
    // it (to list/create this node's webhook URLs — BFSF-320); null before the
    // routine has been saved for the first time.
    automation = null,
    // Node actions, shared with the canvas hover chrome and context menu
    // (BFSF-319). Omitted on read-only surfaces (e.g. the run viewer).
    onDeleteStep = null,
    onDuplicateStep = null,
    // Real run/pinned outputs (mapping/realOutputs buildRealOutputMap) — folds
    // real data into the upstream groups so pickers and previews show real
    // values. Optional: surfaces that don't track runs simply omit it.
    realOutputById = null,
    // Tool catalog from the owner (BuildTab). When absent this component
    // fetches its own copy — kept as a fallback for stand-alone mounts.
    catalog: catalogProp = null,
    // Open another node of the same graph without going back to the canvas
    // (BFSF-332). Omitted on read-only surfaces.
    onNavigate = null,
    // (stepId) => void — draw this step's contents on the canvas instead of
    // editing them as a list in here. Loop only, and only where there IS a
    // canvas (BuildTab); the button is not rendered otherwise.
    onExpandOnCanvas = null,
}) {
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    // This chip is the ONLY lasting signal that an auto-save landed: the Save
    // button simply greys out, which looks identical whether the save
    // succeeded or failed silently in the background (BFSF-338). So it keeps
    // a timestamp and stays on screen at rest ("Saved 2m ago"), and its error
    // state offers a retry. The machine itself is the shared one.
    const { state: saveStatus, setSaving: markSaving, setSaved: markSaved, setError: markSaveError } = useSavingState();
    const [lastSavedAt, setLastSavedAt] = useState(null);
    const failedPatchRef = useRef(null);

    // Catalog (tool schemas): use the owner's copy when provided (BuildTab
    // already fetched it — no duplicate request); fetch only as a fallback
    // for stand-alone mounts. Upstream groups + preview sample derive from
    // the definition + this step.
    const api = useAutomationApi();
    const [fetchedCatalog, setFetchedCatalog] = useState(null);
    useEffect(() => {
        if (catalogProp) return undefined;
        let alive = true;
        api.getCatalog().then(c => { if (alive) setFetchedCatalog(c); }).catch(() => {});
        return () => { alive = false; };
    }, [api, catalogProp]);
    const catalog = catalogProp || fetchedCatalog;

    // Secondary triggers (definition.triggers[]) may only be webhook/app_event
    // — the validator hard-rejects everything else there. The kind <select>
    // needs to know, or it offers schedule/manual and the pick 400s (C7).
    const isSecondaryTrigger = !!step && (definition?.triggers || []).some(t => t?.id === step.id);

    // Which of a switch node's cases have an outgoing edge on the canvas —
    // the Cases editor tells the user a rename keeps that connection and a
    // removal drops it (node-audit B1).
    const wiredCaseNames = useMemo(() => {
        if (step?.type !== 'switch') return null;
        const names = new Set();
        for (const e of (definition?.edges || [])) {
            if (e.from !== step.id) continue;
            if (e.caseName != null) names.add(e.caseName);
            else if (typeof e.label === 'string' && e.label.startsWith('case:')) names.add(e.label.slice(5));
        }
        return names;
    }, [step?.type, step?.id, definition?.edges]);

    // This step's outgoing edges. The Privacy Shield mode selector uses them to
    // name the connections a mode switch would drop (a check branches, a hide
    // does not), before the switch costs them — flow/privacyModel.js.
    const stepEdges = useMemo(
        () => (definition?.edges || []).filter(e => e?.from === step?.id),
        [step?.id, definition?.edges],
    );

    // Real outputs: prefer the owner's map; derive locally for stand-alone
    // mounts. The overlay happens inside computeUpstreamGroups, so groups,
    // pickers and the preview root all agree on what the real data is.
    const effectiveRealOutputs = useMemo(
        () => realOutputById ?? buildRealOutputMap(definition, runSteps),
        [realOutputById, definition, runSteps],
    );
    const groups = useUpstreamVariables(definition, step?.id, catalog, effectiveRealOutputs);
    const previewSample = useMemo(() => buildSampleRoot(groups), [groups]);
    const stepLabelById = useMemo(() => buildStepLabelMap(definition), [definition]);

    // Active field <-> Input tree wiring (click/drag a field to insert it).
    const activeFieldRef = useRef(null);
    const [activeLabel, setActiveLabel] = useState(null);
    const onFocusField = (handle) => { activeFieldRef.current = handle; setActiveLabel(handle?.label || null); };
    const onInsertFromTree = (path) => { activeFieldRef.current?.insert?.(path); };

    const stepIssues = useMemo(() => matchValidationToStep(validation, step?.id), [step, validation]);

    // ── Quick vs full ────────────────────────────────────────────────────
    const quick = density === 'quick';
    const goFull = useCallback(() => onDensityChange?.('full'), [onDensityChange]);
    const goQuick = useCallback(() => onDensityChange?.('quick'), [onDensityChange]);

    // Sections the quick view is holding back, reported by AccordionSection so
    // the button can name a real number instead of promising something that
    // may not exist for this step type.
    //
    // Keyed by step+density rather than reset in an effect: child effects run
    // BEFORE the parent's, so a reset here would wipe what the sections just
    // reported on the very render that mounted them. The callback identity
    // stays stable — every section subscribes to it through a context.
    const hiddenKey = `${step?.id || ''}:${density}`;
    const hiddenKeyRef = useRef(hiddenKey);
    hiddenKeyRef.current = hiddenKey;
    const [hiddenByKey, setHiddenByKey] = useState({});
    const onHiddenSection = useCallback((sectionKey) => {
        setHiddenByKey((prev) => {
            const k = hiddenKeyRef.current;
            const cur = prev[k];
            if (cur?.has(sectionKey)) return prev;
            const next = new Set(cur || []);
            next.add(sectionKey);
            return { ...prev, [k]: next };
        });
    }, []);
    const hiddenCount = hiddenByKey[hiddenKey]?.size || 0;
    const densityValue = useMemo(() => ({ density, onHiddenSection }), [density, onHiddenSection]);

    // "What goes in, what comes out" — the quick view's one line of data, and
    // the header of the full view's Output column.
    const inSummary = useMemo(() => {
        const nearest = groups[groups.length - 1];
        if (!nearest) return null;
        return summariseData(walkPath(nearest.basePath, previewSample) ?? nearest.sample);
    }, [groups, previewSample]);
    const outSummary = useMemo(() => {
        const out = runStep?.output ?? (step?.pinnedOutput ?? null);
        return summariseData(out);
    }, [runStep?.output, step?.pinnedOutput]);

    // Collapsible Input / Output columns (persisted per-user).
    const [inputOpen, setInputOpen] = useState(() => scopedStorage.getItem('ndvInputOpen') !== '0');
    const [outputOpen, setOutputOpen] = useState(() => scopedStorage.getItem('ndvOutputOpen') !== '0');
    useEffect(() => { scopedStorage.setItem('ndvInputOpen', inputOpen ? '1' : '0'); }, [inputOpen]);
    useEffect(() => { scopedStorage.setItem('ndvOutputOpen', outputOpen ? '1' : '0'); }, [outputOpen]);
    // The quick view's own output strip. Separate from the full view's column:
    // pressing Execute here used to produce nothing on screen at all — the
    // result landed in a column this dialog does not render — so the only way to
    // see what a step returned was to expand to the full view.
    const [quickOutputOpen, setQuickOutputOpen] = useState(() => scopedStorage.getItem('ndvQuickOutput') !== '0');
    useEffect(() => { scopedStorage.setItem('ndvQuickOutput', quickOutputOpen ? '1' : '0'); }, [quickOutputOpen]);

    // Resizable Input / Output column widths (persisted). Drag the inner edge
    // of either column to make it wider/narrower (Parameters takes the rest).
    const COL_MIN = 220, COL_MAX = 900;
    const clampW = (v, d) => { const n = Number(v); return Number.isFinite(n) && n >= COL_MIN && n <= COL_MAX ? n : d; };
    // 420, not 320: the input column carries a field tree with a value column,
    // and 320 forced every row to truncate to almost nothing (BFSF-329).
    const [inputW, setInputW] = useState(() => clampW(scopedStorage.getItem('ndvInputWidth'), 420));
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

    // Where this node sits in the flow, and what comes either side of it. The
    // full view used to have no way out but closing and clicking another node
    // on the canvas, and nothing said whether you were at the start, the end,
    // or somewhere in between (BFSF-332).
    const position = useMemo(() => flowPosition(definition, step?.id), [definition, step?.id]);
    const canNavigate = typeof onNavigate === 'function' && position.index > 0 && position.total > 1;
    const goPrev = useCallback(() => { if (position.prevId) onNavigate?.(position.prevId); }, [onNavigate, position.prevId]);
    const goNext = useCallback(() => { if (position.nextId) onNavigate?.(position.nextId); }, [onNavigate, position.nextId]);

    // Esc to close; Alt+←/→ to page through the flow. Alt-modified so the bare
    // arrows keep belonging to whichever field has focus.
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); return; }
            if (!canNavigate || !e.altKey || e.ctrlKey || e.metaKey) return;
            if (e.key === 'ArrowLeft' && position.prevId) { e.preventDefault(); e.stopPropagation(); goPrev(); }
            else if (e.key === 'ArrowRight' && position.nextId) { e.preventDefault(); e.stopPropagation(); goNext(); }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose, canNavigate, position.prevId, position.nextId, goPrev, goNext]);

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
            // Normalize before patching: when the edited node IS the trigger we
            // only assign `next.trigger`, so a base definition missing
            // `steps`/`edges` would be PUT as a trigger-only graph and rejected
            // by the server validator (BFSF-318). The merge itself (incl. the
            // switch-case edge reconcile that keeps `case:<name>` edges and
            // defaultBranch in step with a rename/delete — node-audit C1) is
            // shared with the unmount flush below via
            // mergeStepPatchIntoDefinition.
            const next = mergeStepPatchIntoDefinition(
                normalizeDefinitionShape(definition) || definition, step, currentPatch,
            );
            setSaving(true);
            setSaveError(null);
            markSaving();
            try {
                await onSaveStep(next);
                failedPatchRef.current = null;
                setLastSavedAt(new Date());
                markSaved();
            } catch (e) {
                setSaveError(e.message || 'Save failed');
                // Kept so the chip's retry has something to re-send — the
                // form's own draft may already have moved on.
                failedPatchRef.current = currentPatch;
                markSaveError(e);
                // Re-throw: the caller (SettingsForm.flushNow) advances its
                // baseline only when this promise RESOLVES and leaves the form
                // dirty on rejection. Swallowing the error here made every
                // failed save look successful, so the form dropped its dirty
                // state and the edit was silently lost despite the error chip.
                throw e;
            } finally {
                setSaving(false);
            }
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
    }, [definition, step, onSaveStep, markSaving, markSaved, markSaveError]);

    // "Save failed" is only useful if it comes with a way out. Rejections are
    // swallowed here on purpose: the chip already reports the outcome.
    const retrySave = useCallback(() => {
        const patch = failedPatchRef.current;
        if (!patch) return;
        persistStepPatch(patch)?.catch(() => {});
    }, [persistStepPatch]);

    // Flush a queued patch on unmount (close within the autosave debounce).
    useEffect(() => () => {
        const queued = saveQueuedRef.current;
        if (!queued) return;
        saveQueuedRef.current = null;
        const def = definitionRef.current, stp = stepRef.current, save = onSaveStepRef.current;
        if (!def || !stp || typeof save !== 'function') return;
        const next = mergeStepPatchIntoDefinition(normalizeDefinitionShape(def) || def, stp, queued);
        Promise.resolve(save(next)).catch(err => console.warn('[NodeDetailView] flush on unmount failed:', err?.message || err));
    }, []);

    if (!step) return null;
    if (typeof document === 'undefined') return null;

    // step.type is authoritative (matches how layout.js/validate.js decide
    // "is a trigger") — covers the primary trigger, any secondary trigger in
    // definition.triggers[], and a flowlet's own layer_input trigger alike.
    const isTrigger = step.type === 'trigger';
    const outputPinned = step.pinnedOutput !== undefined && step.pinnedOutput !== null;
    // A truncated output is a server sentinel, not data — pinning it would
    // freeze the step on a placeholder.
    const canPin = !!runStep?.output && !isTruncatedOutput(runStep.output);
    const togglePin = async () => {
        if (outputPinned) await persistStepPatch({ pinnedOutput: null, pinnedAt: null });
        else if (canPin) await persistStepPatch({ pinnedOutput: runStep.output, pinnedAt: new Date().toISOString() });
    };
    const pinTitle = outputPinned
        ? 'Unpin output (re-enable live execution)'
        : 'Pin this output (skip live execution; reuse the latest output)';
    // One word for how the last run went, for the quick dialog's output header.
    // Success is the boring case and says so quietly; a failure is the reason
    // someone opened this panel, so it keeps its colour.
    const quickStatus = QUICK_STATUS[runStep?.status] || (outputPinned && !runStep ? QUICK_STATUS.pinned : null);
    const iconBtn = 'p-1.5 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition';

    // The one line of data the small dialog shows, plus the way into everything
    // it left out. Rendered by SettingsForm on the left of its action bar (see
    // footerLeft) so the dialog ends in a single footer. Both buttons open the
    // full view, so nothing here is a dead end.
    const quickFooterInfo = (
        <>
            <button
                type="button"
                onClick={goFull}
                title="Open the full view to see the data"
                className="inline-flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] min-w-0"
            >
                <span className="text-[var(--text-tertiary)]">In</span>
                <span className="truncate">{inSummary?.label || '—'}</span>
                <ArrowRight size={11} className="text-[var(--text-tertiary)] shrink-0" />
                <span className="text-[var(--text-tertiary)]">Out</span>
                <span className="truncate">{outSummary?.label || (isTrigger ? '—' : 'not run yet')}</span>
            </button>
            <button
                type="button"
                onClick={goFull}
                className="inline-flex items-center gap-1 shrink-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium"
            >
                {hiddenCount > 0 ? `More options (${hiddenCount})` : 'More options'} <ChevronRight size={12} />
            </button>
        </>
    );

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
                // Quick is a small dialog that grows with its content; full is
                // the wide three-column workspace.
                //
                // No background utility here on purpose: data-surface="default"
                // is painted by an unlayered rule in index.css (--bg-card in the
                // solid themes, a frosted tier under glass) which wins over a
                // Tailwind utility. Setting one here only looks like it works.
                className={`relative flex flex-col rounded-xl border border-[var(--border-default)] shadow-2xl overflow-hidden ${
                    quick ? 'w-full max-w-[640px] max-h-[80vh]' : 'w-full max-w-[1600px] h-[88vh]'
                }`}
            >
                {/* Header — identity + per-step actions + column toggles + close.
                    Chrome tier (--bg-secondary) so the form area below reads as
                    the content. Obsidian defines the two the same and falls back
                    to the border alone, which suits that theme's hairline look. */}
                <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border-default)] bg-[var(--bg-secondary)] flex-shrink-0">
                    {/* Identity. The action name is the focal point of this
                        header — it is how you check you opened the node you
                        meant to (BFSF-333) — so it carries the weight and the
                        type sits above it as a muted kicker. */}
                    <div className="min-w-0 flex items-center gap-2">
                        {step.type === 'integration_action' && step.tool && (
                            <span className="shrink-0 inline-flex"><IntegrationLogo tool={step.tool} size={22} /></span>
                        )}
                        <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)]">{stepTypeLabel(step)}</div>
                            <div data-testid="ndv-title" className="text-base font-semibold text-[var(--text-primary)] truncate leading-tight" title={step.tool || undefined}>
                                {headerTitle(step, catalog)}
                            </div>
                        </div>
                        <SaveStatus
                            saveState={saveStatus}
                            lastSavedAt={lastSavedAt}
                            onRetry={saveError ? retrySave : null}
                            showWhenIdle
                            size={10}
                            className="shrink-0"
                        />
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
                            {/* Pin / disable / duplicate / delete are step
                                PLUMBING, not configuration — the quick view
                                leaves them out (they also live on the node's
                                hover chrome and its right-click menu). */}
                            {!quick && (<>
                            <button
                                onClick={togglePin}
                                disabled={!canPin && !outputPinned}
                                title={pinTitle}
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
                            {/* Duplicate / delete — the third surface for these
                                actions alongside the node's hover chrome and
                                the canvas context menu (BFSF-319). The panel
                                closes after either, since the step it is
                                inspecting is gone or superseded. */}
                            {typeof onDuplicateStep === 'function' && (
                                <button
                                    onClick={() => { onDuplicateStep(step.id); onClose?.(); }}
                                    title="Duplicate this step and its settings"
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition"
                                >
                                    <CopyIcon size={11} /> Duplicate
                                </button>
                            )}
                            {typeof onDeleteStep === 'function' && (
                                <button
                                    onClick={() => { onDeleteStep(step.id); onClose?.(); }}
                                    title="Delete this step (reconnects its neighbours)"
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md text-red-500 hover:bg-red-500/10 transition"
                                >
                                    <Trash2 size={11} /> Delete
                                </button>
                            )}
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
                            </>)}
                        </div>
                    )}

                    <div className="ml-auto flex items-center gap-1">
                        {/* Page through the flow in execution order, and say
                            where you are while doing it (BFSF-332). Full view
                            only — the quick dialog is a one-node glance. */}
                        {!quick && canNavigate && (
                            <div className="flex items-center gap-0.5 mr-1">
                                <button
                                    onClick={goPrev}
                                    disabled={!position.prevId}
                                    title="Previous step in the flow (Alt+←)"
                                    aria-label="Previous step"
                                    className={`${iconBtn} disabled:opacity-30 disabled:hover:bg-transparent`}
                                >
                                    <ChevronLeft size={15} />
                                </button>
                                <span className="text-[11px] text-[var(--text-tertiary)] tabular-nums whitespace-nowrap px-0.5">
                                    Step {position.index} of {position.total}
                                </span>
                                <button
                                    onClick={goNext}
                                    disabled={!position.nextId}
                                    title="Next step in the flow (Alt+→)"
                                    aria-label="Next step"
                                    className={`${iconBtn} disabled:opacity-30 disabled:hover:bg-transparent`}
                                >
                                    <ChevronRight size={15} />
                                </button>
                            </div>
                        )}
                        {quick ? (
                            <button onClick={goFull} title="Show everything — input data, all options, output" aria-label="Expand to the full view" className={iconBtn}>
                                <Maximize2 size={15} />
                            </button>
                        ) : (
                            <>
                                {onDensityChange && (
                                    <button onClick={goQuick} title="Simple view — just the settings this step needs" aria-label="Simple view" className={iconBtn}>
                                        <Minimize2 size={15} />
                                    </button>
                                )}
                                <button onClick={() => setInputOpen(o => !o)} title={inputOpen ? 'Hide input' : 'Show input'} aria-label={inputOpen ? 'Hide input' : 'Show input'} className={iconBtn}>
                                    {inputOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
                                </button>
                                <button onClick={() => setOutputOpen(o => !o)} title={outputOpen ? 'Hide output' : 'Show output'} aria-label={outputOpen ? 'Hide output' : 'Show output'} className={iconBtn}>
                                    {outputOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
                                </button>
                            </>
                        )}
                        <button onClick={onClose} aria-label="Close" className={iconBtn}><X size={17} /></button>
                    </div>
                </div>

                {runStep?.status === 'awaiting_approval' && runStep?.runId && (
                    <ApprovalActionBar runId={runStep.runId} stepId={step?.id} />
                )}

                {/* Body — quick: parameters only. full: INPUT | PARAMETERS | OUTPUT */}
                <div className="flex-1 min-h-0 flex">
                    {!quick && inputOpen && (
                        <aside style={{ width: inputW }} className="relative flex-shrink-0 border-r border-[var(--border-default)] bg-[var(--bg-secondary)] min-h-0 flex flex-col">
                            <ColumnHeader>
                                Input
                                {activeLabel && <span className="ml-auto normal-case font-normal text-[var(--text-secondary)] truncate max-w-[55%]">→ {activeLabel}</span>}
                            </ColumnHeader>
                            <InputDataPanel groups={groups} previewSample={previewSample} onPick={onInsertFromTree} />
                            {colResizeHandle('right', setInputW, 1, inputW)}
                        </aside>
                    )}

                    <div className="flex-1 min-w-0 min-h-0 flex flex-col">
                        {!quick && <ColumnHeader>Parameters</ColumnHeader>}
                        <FormDensityContext.Provider value={densityValue}>
                            <VariablePickerProvider groups={groups} previewSample={previewSample} stepLabelById={stepLabelById}>
                                <SettingsHost
                                    key={step.id}
                                    // The quick dialog used to stack its own
                                    // In/Out strip under the form's Reset/Save
                                    // bar: two chrome bars, two opacities of one
                                    // token. Handing the strip down puts both in
                                    // one bar without moving the save lifecycle
                                    // out of the form.
                                    footerLeft={quick ? quickFooterInfo : null}
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
                                    automation={automation}
                                    blocksCatalog={blocksCatalog}
                                    wiredCaseNames={wiredCaseNames}
                                    stepEdges={stepEdges}
                                    isSecondaryTrigger={isSecondaryTrigger}
                                    onExpandOnCanvas={onExpandOnCanvas}
                                />
                            </VariablePickerProvider>
                        </FormDensityContext.Provider>
                    </div>

                    {!quick && outputOpen && (
                        <aside style={{ width: outputW }} className="relative flex-shrink-0 border-l border-[var(--border-default)] bg-[var(--bg-secondary)] min-h-0 flex flex-col">
                            {colResizeHandle('left', setOutputW, -1, outputW)}
                            <ColumnHeader>
                                Output
                                {outSummary && (
                                    <span className="normal-case font-normal text-[var(--text-secondary)]">· {outSummary.label}</span>
                                )}
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

                {/* Quick view: what came back, under the settings that produced
                    it. The full view puts this in a column the small dialog
                    doesn't render, so Execute here used to show nothing at all.
                    Collapsed state is remembered, so the dialog stays small for
                    people who only came to change a setting. */}
                {quick && !isTrigger && (
                    <div
                        data-testid="ndv-quick-output"
                        className="flex-shrink-0 flex flex-col min-h-0 border-t border-[var(--border-default)] bg-[var(--bg-secondary)]"
                    >
                        <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--text-secondary)]">
                            <button
                                type="button"
                                onClick={() => setQuickOutputOpen(o => !o)}
                                aria-expanded={quickOutputOpen}
                                className="inline-flex items-center gap-1.5 hover:text-[var(--text-primary)] min-w-0"
                            >
                                {quickOutputOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                Output
                                {/* Status and size live HERE and nowhere else in
                                    this dialog: the panel below used to repeat
                                    both in a strip of its own, so a one-record
                                    result cost two bands to say once. */}
                                {quickStatus && (
                                    <span className={`normal-case font-normal tracking-normal ${quickStatus.color}`}>
                                        · {quickStatus.label}
                                    </span>
                                )}
                                {outSummary && (
                                    <span className="normal-case font-normal tracking-normal text-[var(--text-tertiary)] truncate">
                                        · {outSummary.label}
                                    </span>
                                )}
                            </button>
                            {/* Pinning is what makes this panel more than a
                                readout: it freezes the result so the steps
                                downstream can be built against real data
                                without re-running this one every time. */}
                            <button
                                type="button"
                                onClick={togglePin}
                                disabled={!canPin && !outputPinned}
                                title={pinTitle}
                                className={`ml-auto inline-flex items-center gap-1 normal-case tracking-normal px-2 py-0.5 rounded border text-[11px] transition disabled:opacity-30 ${
                                    outputPinned
                                        ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/40'
                                        : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}
                            >
                                {outputPinned ? <PinOff size={11} /> : <Pin size={11} />}
                                {outputPinned ? 'Pinned' : 'Pin'}
                            </button>
                        </div>
                        {quickOutputOpen && (
                            // Capped so a large result cannot push the settings
                            // off the top of an 80vh dialog.
                            <div className="min-h-[7rem] max-h-[34vh] overflow-hidden flex flex-col border-t border-[var(--border-default)]">
                                <RunTabContainer step={step} runStep={runStep} compact />
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>,
        document.body,
    );
}

const QUICK_STATUS = {
    success: { label: 'Success', color: 'text-[var(--text-tertiary)]' },
    error: { label: 'Failed', color: 'text-red-600 dark:text-red-400' },
    failed: { label: 'Failed', color: 'text-red-600 dark:text-red-400' },
    running: { label: 'Running…', color: 'text-amber-600 dark:text-amber-400' },
    awaiting_approval: { label: 'Waiting for approval', color: 'text-amber-600 dark:text-amber-400' },
    pinned: { label: 'Pinned', color: 'text-cyan-600 dark:text-cyan-400' },
};

function ColumnHeader({ children }) {
    return (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-default)] bg-[var(--bg-secondary)] flex-shrink-0 text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--text-secondary)]">
            {children}
        </div>
    );
}


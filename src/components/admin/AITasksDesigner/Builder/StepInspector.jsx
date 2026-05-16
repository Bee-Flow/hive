import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Save, RotateCcw, PanelRightClose, PanelRightOpen, Loader2, Check, AlertCircle, Play, Pin, PinOff, RotateCw, Power } from 'lucide-react';
import { matchValidationToStep } from './flow/matchValidationToStep';
import SettingsForm from './flow/SettingsForm';
import VariableTree from './mapping/VariableTree';
import useUpstreamVariables from '../../../../hooks/useUpstreamVariables';
import useAutomationApi from '../../../../hooks/useAutomationApi';
import scopedStorage from '../../../../utils/scopedStorage';

/**
 * Right-side detail panel for a step.
 *
 * Tabs:
 *   - Definition  — JSON editor (Monaco lazy-loaded; textarea fallback) with
 *                   parse-validation on blur. Save dispatches a full-definition
 *                   PUT through onSave so the existing /api/automation/:id
 *                   endpoint runs the structured validator.
 *   - Last run    — input/output/error from the most recent dry-run.
 *
 * Lazy Monaco import mirrors WebpageEditor.jsx so we share the bundle and
 * fall back to a plain textarea when the editor fails to load (offline,
 * extension blocking, etc.).
 */
export default function StepInspector({ step, runStep, onClose, definition, onSaveStep, validation, modelTiers = {}, onExecuteStep, onRetryFromStep, runInFlight = false, executingStep = false }) {
    // Settings-first by default — most edits are tweaking the prompt or
    // model tier. The Definition (JSON) tab stays one click away for power
    // users who need to touch fields the form doesn't expose.
    const [tab, setTab] = useState('settings');
    const [editorText, setEditorText] = useState(() => safeStringify(step));
    const [parseError, setParseError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    // Toast-style status: 'idle' | 'saving' | 'saved' | 'error'. Drives the
    // small chip in the inspector header so the user always knows whether
    // their last edit landed. Auto-fades from 'saved' back to 'idle'.
    //
    // We track the *previous* saving flag in a ref instead of reading
    // `saveStatus` inside the effect — that read was the reason the
    // exhaustive-deps lint was disabled, and a parent re-render between
    // two `saving=true` ticks could swallow the saved transition.
    const [saveStatus, setSaveStatus] = useState('idle');
    const savedFadeRef = useRef(null);
    const wasSavingRef = useRef(false);
    useEffect(() => {
        if (saving) {
            wasSavingRef.current = true;
            setSaveStatus('saving');
            return;
        }
        if (saveError) {
            wasSavingRef.current = false;
            setSaveStatus('error');
            return;
        }
        if (wasSavingRef.current) {
            wasSavingRef.current = false;
            setSaveStatus('saved');
            if (savedFadeRef.current) clearTimeout(savedFadeRef.current);
            savedFadeRef.current = setTimeout(() => setSaveStatus('idle'), 1500);
        }
    }, [saving, saveError]);
    useEffect(() => () => { if (savedFadeRef.current) clearTimeout(savedFadeRef.current); }, []);
    const [Monaco, setMonaco] = useState(null);
    const [monacoFailed, setMonacoFailed] = useState(false);
    const lastStepIdRef = useRef(step?.id);

    // Mapping side panel state. Catalog is fetched once; groups are
    // derived from the definition + current step. activeField holds the
    // most recently focused BindingField/TemplateField so VariableTree
    // clicks know where to insert.
    const api = useAutomationApi();
    const [catalog, setCatalog] = useState(null);
    useEffect(() => {
        let alive = true;
        api.getCatalog().then(c => { if (alive) setCatalog(c); }).catch(() => {});
        return () => { alive = false; };
    }, [api]);

    const groups = useUpstreamVariables(definition, step?.id, catalog);
    const previewSample = useMemo(() => buildSampleRoot(groups), [groups]);

    const activeFieldRef = useRef(null);
    const [activeLabel, setActiveLabel] = useState(null);
    const onFocusField = (handle) => {
        activeFieldRef.current = handle;
        setActiveLabel(handle?.label || null);
    };
    const onInsertFromTree = (path) => {
        const handle = activeFieldRef.current;
        if (handle?.insert) handle.insert(path);
    };
    // The active field handle lives on a Settings-tab input. When the user
    // switches tabs that input unmounts, but the ref keeps pointing at the
    // stale handle — a click in the VariableTree would then "insert" into
    // a detached field. Reset whenever the tab changes.
    useEffect(() => {
        activeFieldRef.current = null;
        setActiveLabel(null);
    }, [tab]);

    // VariableTree can be collapsed for users who prefer pure JSON work.
    // Preference persists via scopedStorage.
    const [treeOpen, setTreeOpen] = useState(() => scopedStorage.getItem('inspectorVariableTreeOpen') !== '0');
    useEffect(() => {
        scopedStorage.setItem('inspectorVariableTreeOpen', treeOpen ? '1' : '0');
    }, [treeOpen]);

    // Reset editor when the user clicks a different step.
    useEffect(() => {
        if (step?.id !== lastStepIdRef.current) {
            setEditorText(safeStringify(step));
            setParseError(null);
            setSaveError(null);
            lastStepIdRef.current = step?.id;
        }
    }, [step]);

    // Lazy load Monaco only when this panel actually mounts.
    useEffect(() => {
        let alive = true;
        import('@monaco-editor/react')
            .then(mod => { if (alive) setMonaco(() => mod.default); })
            .catch(() => { if (alive) setMonacoFailed(true); });
        return () => { alive = false; };
    }, []);

    // Step-scoped validation records (filtered from the global validation
    // payload so the inspector shows only what's wrong with THIS step).
    // Matcher is shared with the diagram via flow/matchValidationToStep.
    const stepIssues = useMemo(
        () => matchValidationToStep(validation, step?.id),
        [step, validation],
    );

    /**
     * Merge `patch` onto the existing step, preserving id. Used by the
     * Settings form — only the fields the user touches are overwritten;
     * everything else (inputs map, edges, outputSchema, etc.) stays intact.
     *
     * Concurrency: rapid autosaves used to race here — two PUTs against
     * different `step` baselines could clobber each other. We now
     * serialize: if a save is in flight we stash the latest patch in
     * `queuedRef` (coalesced — only the newest pending patch survives)
     * and fire it once the current save resolves.
     */
    const saveInflightRef = useRef(null);
    const saveQueuedRef = useRef(null);
    // Latest-state refs so the unmount flusher can still issue the queued
    // patch with the current definition/step/save-fn. Without these the
    // closure captured at mount would refer to stale references after a
    // step switch or definition refresh.
    const definitionRef = useRef(definition);
    const stepRef = useRef(step);
    const onSaveStepRef = useRef(onSaveStep);
    useEffect(() => { definitionRef.current = definition; stepRef.current = step; onSaveStepRef.current = onSaveStep; });
    const persistStepPatch = useCallback(async (patch) => {
        if (!definition || typeof onSaveStep !== 'function' || !step) return;
        if (saveInflightRef.current) {
            saveQueuedRef.current = patch;
            return saveInflightRef.current;
        }
        const doSave = async (currentPatch) => {
            const next = { ...definition };
            const merged = { ...step, ...currentPatch, id: step.id };
            if (definition.trigger?.id === step.id) {
                next.trigger = merged;
            } else {
                next.steps = (definition.steps || []).map(s => s.id === step.id ? merged : s);
            }
            setSaving(true);
            setSaveError(null);
            try {
                await onSaveStep(next);
                setEditorText(safeStringify(merged));
            } catch (e) {
                setSaveError(e.message || 'Save failed');
            }
            setSaving(false);
        };
        saveInflightRef.current = (async () => {
            try {
                await doSave(patch);
            } finally {
                const queued = saveQueuedRef.current;
                saveQueuedRef.current = null;
                saveInflightRef.current = null;
                if (queued) {
                    // Tail-call the next coalesced patch.
                    await persistStepPatch(queued);
                }
            }
        })();
        return saveInflightRef.current;
    }, [definition, step, onSaveStep]);

    // On unmount, drain any patch that was queued behind an in-flight save.
    // Without this, switching steps (or closing the inspector) within the
    // debounce window silently dropped the most recent edit. We fire it
    // detached because the component is going away — the caller's onSaveStep
    // is responsible for surfacing failures through its own toast/logger.
    useEffect(() => () => {
        const queued = saveQueuedRef.current;
        if (!queued) return;
        saveQueuedRef.current = null;
        const def = definitionRef.current;
        const stp = stepRef.current;
        const save = onSaveStepRef.current;
        if (!def || !stp || typeof save !== 'function') return;
        const next = { ...def };
        const merged = { ...stp, ...queued, id: stp.id };
        if (def.trigger?.id === stp.id) next.trigger = merged;
        else next.steps = (def.steps || []).map(s => s.id === stp.id ? merged : s);
        Promise.resolve(save(next)).catch(err => {
            console.warn('[StepInspector] queued patch flush on unmount failed:', err?.message || err);
        });
    }, []);

    if (!step) return null;

    const dirty = editorText !== safeStringify(step);

    const handleBlur = () => {
        try {
            JSON.parse(editorText);
            setParseError(null);
        } catch (e) {
            setParseError(e.message);
        }
    };

    const handleReset = () => {
        setEditorText(safeStringify(step));
        setParseError(null);
        setSaveError(null);
    };

    const handleSave = async () => {
        let parsed;
        try { parsed = JSON.parse(editorText); }
        catch (e) { setParseError(e.message); return; }
        if (!parsed || typeof parsed !== 'object') { setParseError('Step must be a JSON object.'); return; }
        if (parsed.id && parsed.id !== step.id) { setParseError('Cannot change step id from the editor — remove and re-add the step instead.'); return; }
        await persistFullStep(parsed);
    };

    /**
     * Replace this step entirely with `replacement` (preserving id). Used by
     * the JSON editor — if the user removed a field from the JSON, that
     * field is GONE from the persisted step.
     */
    const persistFullStep = async (replacement) => {
        if (!definition || typeof onSaveStep !== 'function') return;
        const next = { ...definition };
        const replaced = { ...replacement, id: step.id };
        if (definition.trigger?.id === step.id) {
            next.trigger = replaced;
        } else {
            next.steps = (definition.steps || []).map(s => s.id === step.id ? replaced : s);
        }
        setSaving(true);
        setSaveError(null);
        try {
            await onSaveStep(next);
            setEditorText(safeStringify(replaced));
        } catch (e) {
            setSaveError(e.message || 'Save failed');
        }
        setSaving(false);
    };

    const inspectorWidth = treeOpen ? 'w-[720px]' : 'w-[420px]';

    return (
        // Drawer-style overlay sitting over the diagram on the Build tab.
        // z-15 keeps it above the diagram (z-0) and the floating validation
        // pill (z-20 — pill should still be reachable when inspector is
        // open but to the right of it). Width is 720px when the variable
        // tree is open (split: 420 form + 300 tree), 420px when collapsed.
        <div
            data-surface="default"
            className={`absolute top-0 right-0 h-full ${inspectorWidth} z-[15] flex flex-col border-l border-[var(--border-default)] shadow-[-6px_0_16px_rgba(0,0,0,0.08)] overflow-hidden transition-[width] duration-150`}
        >
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-default)]">
                <div className="min-w-0 flex-1 flex items-center gap-2">
                    <div className="min-w-0">
                        <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">{step.type}</div>
                        <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{step.label || step.tool || step.id}</div>
                    </div>
                    <SaveStatusChip status={saveStatus} error={saveError} />
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setTreeOpen(o => !o)}
                        title={treeOpen ? 'Hide variables panel' : 'Show variables panel'}
                        aria-label={treeOpen ? 'Hide variables panel' : 'Show variables panel'}
                        className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                    >
                        {treeOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                        aria-label="Close inspector"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>
            {/* n8n-style action bar: Execute · Pin · Disable · Retry.
                Pin/Disable persist into the step definition; Execute and
                Retry call back into the parent to hit the partial-run API. */}
            {step?.id && definition?.trigger?.id !== step.id && (
                <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/40">
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
                            if (step.pinnedOutput !== undefined && step.pinnedOutput !== null) {
                                await persistStepPatch({ pinnedOutput: null, pinnedAt: null });
                            } else if (runStep?.output != null) {
                                await persistStepPatch({ pinnedOutput: runStep.output, pinnedAt: new Date().toISOString() });
                            }
                        }}
                        disabled={!runStep?.output && !(step.pinnedOutput !== undefined && step.pinnedOutput !== null)}
                        title={step.pinnedOutput != null ? 'Unpin output (re-enable live execution)' : 'Pin this output (skip live execution; use the latest output verbatim)'}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition disabled:opacity-30 ${
                            step.pinnedOutput != null
                                ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40'
                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                    >
                        {step.pinnedOutput != null ? <PinOff size={11} /> : <Pin size={11} />}
                        {step.pinnedOutput != null ? 'Pinned' : 'Pin'}
                    </button>
                    <button
                        onClick={() => persistStepPatch({ disabled: !step.disabled })}
                        title={step.disabled ? 'Re-enable this node' : 'Disable this node (skipped during execution)'}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition ${
                            step.disabled
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40'
                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                        }`}
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
                            <RotateCw size={11} /> Retry from here
                        </button>
                    )}
                </div>
            )}
            <div className="flex border-b border-[var(--border-default)] text-xs">
                <TabBtn active={tab === 'settings'} onClick={() => setTab('settings')}>Settings</TabBtn>
                <TabBtn active={tab === 'definition'} onClick={() => setTab('definition')}>JSON</TabBtn>
                <TabBtn active={tab === 'last_run'} onClick={() => setTab('last_run')} disabled={!runStep}>
                    Last run{runStep ? ` — ${runStep.status}` : ''}
                </TabBtn>
            </div>

            <div className="flex-1 min-h-0 flex">
                <div className="flex-1 min-w-0 min-h-0 flex flex-col">
                {tab === 'settings' && step?.id && (
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
                    />
                )}
                {tab === 'definition' && (
                    <div className="flex flex-col h-full">
                        {(stepIssues.errors.length > 0 || stepIssues.warnings.length > 0) && (
                            <div className="px-3 py-2 border-b border-[var(--border-default)]">
                                {stepIssues.errors.map((e, i) => (
                                    <ValidationLine key={`e-${i}`} record={e} />
                                ))}
                                {stepIssues.warnings.map((w, i) => (
                                    <ValidationLine key={`w-${i}`} record={w} />
                                ))}
                            </div>
                        )}
                        <div className="flex-1 min-h-[280px]">
                            {Monaco && !monacoFailed ? (
                                <Monaco
                                    height="100%"
                                    defaultLanguage="json"
                                    value={editorText}
                                    onChange={(v) => setEditorText(v ?? '')}
                                    onMount={(editor) => { editor.onDidBlurEditorText(handleBlur); }}
                                    options={{
                                        minimap: { enabled: false },
                                        fontSize: 12,
                                        wordWrap: 'on',
                                        scrollBeyondLastLine: false,
                                        formatOnPaste: true,
                                        renderLineHighlight: 'gutter',
                                    }}
                                    theme="vs-dark"
                                />
                            ) : (
                                <textarea
                                    value={editorText}
                                    onChange={(e) => setEditorText(e.target.value)}
                                    onBlur={handleBlur}
                                    spellCheck={false}
                                    className="w-full h-full bg-[var(--bg-secondary)] text-[var(--text-primary)] font-mono text-xs p-3 outline-none resize-none border-0"
                                />
                            )}
                        </div>
                        {(parseError || saveError) && (
                            <div className="px-3 py-2 text-xs text-red-600 dark:text-red-400 border-t border-[var(--border-default)] bg-red-500/5">
                                {parseError || saveError}
                            </div>
                        )}
                        <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-[var(--border-default)] bg-[var(--bg-secondary)]">
                            <button
                                onClick={handleReset}
                                disabled={!dirty || saving}
                                className="flex items-center gap-1.5 px-3 py-1 text-xs rounded text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-40 transition"
                            >
                                <RotateCcw size={12} /> Reset
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!dirty || saving || !!parseError || typeof onSaveStep !== 'function'}
                                className="flex items-center gap-1.5 px-3 py-1 text-xs rounded bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-40 transition"
                            >
                                <Save size={12} /> {saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                )}
                {tab === 'last_run' && runStep && (
                    <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 text-xs">
                        <KV label="Status" value={runStep.status} />
                        {runStep.error && <ErrPre value={runStep.error} />}
                        <Section title="Input"><Pre value={runStep.input} /></Section>
                        <Section title="Output"><Pre value={runStep.output} /></Section>
                    </div>
                )}
                {tab === 'last_run' && !runStep && (
                    <div className="p-4 text-xs text-[var(--text-tertiary)]">No run output for this step yet — try a dry-run.</div>
                )}
                </div>
                {treeOpen && (
                    <div className="w-[300px] flex-shrink-0 border-l border-[var(--border-default)] bg-[var(--bg-secondary)]/40 min-h-0">
                        <VariableTree
                            groups={groups}
                            onInsert={onInsertFromTree}
                            activeFieldLabel={activeLabel}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Merge every upstream group's sample into a single root tree shaped
 * like the runtime resolver's runState — so walkPath('steps.s1.output.x')
 * resolves to the right placeholder. Used by BindingField / TemplateField
 * preview lines.
 */
function buildSampleRoot(groups) {
    const root = { trigger: { output: {} }, steps: {}, loop: {} };
    for (const g of groups || []) {
        if (g.kind === 'trigger') {
            root.trigger.output = g.sample || {};
        } else if (g.kind === 'loop') {
            // groups id of a loop step is the loop step id; basePath uses
            // loop.<itemVar>. Mirror that into the root.
            const tail = String(g.basePath || '').split('.').slice(1).join('.');
            if (tail) root.loop[tail] = g.sample || {};
        } else {
            root.steps[g.id] = { output: g.sample || {} };
        }
    }
    return root;
}

function TabBtn({ active, onClick, disabled, children }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`px-3 py-2 transition ${active
                ? 'border-b-2 border-[var(--accent)] text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
            {children}
        </button>
    );
}

function ValidationLine({ record }) {
    const isErr = record.severity === 'error';
    return (
        <div className={`text-xs ${isErr ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'} mb-1`}>
            <span className="font-mono text-[10px] mr-1.5 opacity-70">{record.code}</span>
            {record.message}
            {record.hint && <div className="text-[var(--text-tertiary)] mt-0.5">→ {record.hint}</div>}
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-tertiary)] mb-1">{title}</div>
            {children}
        </div>
    );
}
function KV({ label, value }) {
    return <div><span className="text-[var(--text-tertiary)]">{label}:</span> <span className="text-[var(--text-primary)]">{String(value ?? '—')}</span></div>;
}
function Pre({ value }) {
    return <pre className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-md p-2 text-xs overflow-auto max-h-72 text-[var(--text-primary)]">{JSON.stringify(value, null, 2)}</pre>;
}
function ErrPre({ value }) {
    return <pre className="bg-red-500/10 text-red-600 dark:text-red-400 rounded-md p-2 text-xs whitespace-pre-wrap">{value}</pre>;
}

function safeStringify(step) {
    try { return JSON.stringify(step, null, 2); } catch { return ''; }
}

/**
 * Small status chip rendered next to the step title. Tells the user
 * whether their last edit was persisted — answers the recurring "did
 * my change actually save?" question without needing a Network panel.
 */
function SaveStatusChip({ status, error }) {
    if (status === 'idle') return null;
    if (status === 'saving') {
        return (
            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
                <Loader2 size={11} className="animate-spin" />
                Saving…
            </span>
        );
    }
    if (status === 'saved') {
        return (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                <Check size={11} />
                Saved
            </span>
        );
    }
    if (status === 'error') {
        return (
            <span
                className="inline-flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400"
                title={error || 'Save failed'}
            >
                <AlertCircle size={11} />
                Save failed
            </span>
        );
    }
    return null;
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Save, RotateCcw } from 'lucide-react';
import { matchValidationToStep } from './flow/matchValidationToStep';
import SettingsForm from './flow/SettingsForm';

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
export default function StepInspector({ step, runStep, onClose, definition, onSaveStep, validation, modelTiers = {} }) {
    // Settings-first by default — most edits are tweaking the prompt or
    // model tier. The Definition (JSON) tab stays one click away for power
    // users who need to touch fields the form doesn't expose.
    const [tab, setTab] = useState('settings');
    const [editorText, setEditorText] = useState(() => safeStringify(step));
    const [parseError, setParseError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [Monaco, setMonaco] = useState(null);
    const [monacoFailed, setMonacoFailed] = useState(false);
    const lastStepIdRef = useRef(step?.id);

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

    /**
     * Merge `patch` onto the existing step, preserving id. Used by the
     * Settings form — only the fields the user touches are overwritten;
     * everything else (inputs map, edges, outputSchema, etc.) stays intact.
     */
    const persistStepPatch = async (patch) => {
        if (!definition || typeof onSaveStep !== 'function') return;
        const next = { ...definition };
        const merged = { ...step, ...patch, id: step.id };
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

    return (
        // Drawer-style overlay sitting over the diagram on the Build tab.
        // z-15 keeps it above the diagram (z-0) and the floating validation
        // pill (z-20 — pill should still be reachable when inspector is
        // open but to the right of it). Width starts at 400px so prompt
        // text and JSON breathe.
        <div className="absolute top-0 right-0 h-full w-[400px] z-[15] flex flex-col bg-[var(--bg-primary)] border-l border-[var(--border-default)] shadow-[-6px_0_16px_rgba(0,0,0,0.08)] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-default)]">
                <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">{step.type}</div>
                    <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{step.label || step.tool || step.id}</div>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                    aria-label="Close inspector"
                >
                    <X size={16} />
                </button>
            </div>
            <div className="flex border-b border-[var(--border-default)] text-xs">
                <TabBtn active={tab === 'settings'} onClick={() => setTab('settings')}>Settings</TabBtn>
                <TabBtn active={tab === 'definition'} onClick={() => setTab('definition')}>JSON</TabBtn>
                <TabBtn active={tab === 'last_run'} onClick={() => setTab('last_run')} disabled={!runStep}>
                    Last run{runStep ? ` — ${runStep.status}` : ''}
                </TabBtn>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
                {tab === 'settings' && (
                    <SettingsForm
                        step={step}
                        modelTiers={modelTiers}
                        stepIssues={stepIssues}
                        saving={saving}
                        saveError={saveError}
                        onPatch={persistStepPatch}
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
                    <div className="p-3 space-y-3 text-xs">
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
        </div>
    );
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

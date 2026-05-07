import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Save, RotateCcw } from 'lucide-react';
import { matchValidationToStep } from './flow/matchValidationToStep';
import { tierLabel } from '../../../tierMeta';

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
        <div className="absolute top-0 right-0 h-full w-[380px] z-10 flex flex-col bg-[var(--bg-primary)] border-l border-[var(--border-default)] shadow-[-4px_0_12px_rgba(0,0,0,0.06)] overflow-hidden">
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

/**
 * Form-based editor for the most common per-step fields. Per-type, exposes:
 *
 *   ai_step             — label, prompt, systemPrompt, modelTier, allowTools
 *   integration_action  — label (tool stays read-only — change requires
 *                         remove + re-add to refresh inputs / catalog)
 *   trigger             — label
 *   condition           — label, expr
 *   notification        — label, title, body
 *   loop / code         — label only (rest belongs in JSON)
 *
 * Edits are local-only until the user clicks Save, which calls onPatch
 * with the diff against the original step. That keeps the PUT round-trips
 * predictable and lets the validator run once per save instead of on
 * every keystroke.
 */
function SettingsForm({ step, modelTiers, stepIssues, saving, saveError, onPatch }) {
    const [draft, setDraft] = useState(() => extractFormState(step));

    // Re-seed when the user clicks a different step.
    useEffect(() => { setDraft(extractFormState(step)); }, [step?.id]); // eslint-disable-line

    const dirty = useMemo(() => {
        const original = extractFormState(step);
        for (const k of Object.keys(draft)) {
            if (JSON.stringify(draft[k]) !== JSON.stringify(original[k])) return true;
        }
        return false;
    }, [draft, step]);

    const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));

    const onSave = async () => {
        // Convert form fields into the persisted-step shape.
        const patch = {};
        if ('label' in draft) patch.label = draft.label || null;
        if (step.type === 'ai_step') {
            patch.prompt = draft.prompt || '';
            patch.systemPrompt = draft.systemPrompt?.trim() ? draft.systemPrompt.trim() : null;
            patch.modelTier = draft.modelTier || 'auto';
            patch.allowTools = !!draft.allowTools;
        }
        if (step.type === 'condition') patch.expr = draft.expr || '';
        if (step.type === 'notification') {
            patch.title = draft.title || '';
            patch.body = draft.body || '';
        }
        await onPatch(patch);
    };

    return (
        <div className="flex flex-col h-full">
            {(stepIssues.errors.length > 0 || stepIssues.warnings.length > 0) && (
                <div className="px-3 py-2 border-b border-[var(--border-default)]">
                    {stepIssues.errors.map((e, i) => <ValidationLine key={`e-${i}`} record={e} />)}
                    {stepIssues.warnings.map((w, i) => <ValidationLine key={`w-${i}`} record={w} />)}
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 space-y-4">
                <FormRow label="Label">
                    <input
                        type="text"
                        value={draft.label || ''}
                        onChange={(e) => set('label', e.target.value)}
                        placeholder={step.tool || step.type}
                        className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded px-2 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                </FormRow>

                {step.type === 'ai_step' && (
                    <>
                        <FormRow label="Prompt" hint="The instruction the AI runs. {{from}}, {{subject}} etc. interpolate input values.">
                            <textarea
                                rows={6}
                                value={draft.prompt || ''}
                                onChange={(e) => set('prompt', e.target.value)}
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded px-2 py-1.5 text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-y"
                            />
                        </FormRow>
                        <FormRow label="System prompt" hint="Optional. Overrides the default 'You are a step inside a no-code automation' framing — set a tone, role, or domain.">
                            <textarea
                                rows={3}
                                value={draft.systemPrompt || ''}
                                onChange={(e) => set('systemPrompt', e.target.value)}
                                placeholder="(default: a generic automation-step system prompt)"
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded px-2 py-1.5 text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-y"
                            />
                        </FormRow>
                        <FormRow label="Model tier">
                            <select
                                value={draft.modelTier || 'auto'}
                                onChange={(e) => set('modelTier', e.target.value)}
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded px-2 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                            >
                                {Object.keys(modelTiers || {}).length === 0 && (
                                    <option value={draft.modelTier || 'auto'}>{draft.modelTier || 'auto'}</option>
                                )}
                                {Object.entries(modelTiers || {}).map(([id, meta]) => (
                                    <option key={id} value={id}>
                                        {meta?.label || tierLabel(id) || id}
                                    </option>
                                ))}
                            </select>
                        </FormRow>
                        <FormRow label="Allow tool use" hint="When on, the AI can call integrations the user has rights to (Gmail, Drive, web search…) during this step.">
                            <label className="inline-flex items-center gap-2 text-sm text-[var(--text-primary)] cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={!!draft.allowTools}
                                    onChange={(e) => set('allowTools', e.target.checked)}
                                />
                                {draft.allowTools ? 'Tools enabled' : 'Tools disabled'}
                            </label>
                        </FormRow>
                    </>
                )}

                {step.type === 'integration_action' && (
                    <FormRow label="Tool" hint="To switch tool, remove this step and add a new one — different tools have different inputs.">
                        <div className="text-sm font-mono text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded px-2 py-1.5">
                            {step.tool || '—'}
                        </div>
                    </FormRow>
                )}

                {step.type === 'condition' && (
                    <FormRow label="Expression" hint="Restricted JS. Examples: steps.x.output.amount > 1000, loop.email.subject == 'Urgent'.">
                        <textarea
                            rows={3}
                            value={draft.expr || ''}
                            onChange={(e) => set('expr', e.target.value)}
                            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded px-2 py-1.5 text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-y"
                        />
                    </FormRow>
                )}

                {step.type === 'notification' && (
                    <>
                        <FormRow label="Title">
                            <input
                                type="text"
                                value={draft.title || ''}
                                onChange={(e) => set('title', e.target.value)}
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded px-2 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                            />
                        </FormRow>
                        <FormRow label="Body" hint="Templates: {{steps.x.output.y}} interpolates upstream output.">
                            <textarea
                                rows={4}
                                value={draft.body || ''}
                                onChange={(e) => set('body', e.target.value)}
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded px-2 py-1.5 text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-y"
                            />
                        </FormRow>
                    </>
                )}

                <div className="text-[11px] text-[var(--text-tertiary)]">
                    Need to edit inputs, edges, or outputSchema? Switch to the JSON tab.
                </div>
            </div>

            {saveError && (
                <div className="px-3 py-2 text-xs text-red-600 dark:text-red-400 border-t border-[var(--border-default)] bg-red-500/5">
                    {saveError}
                </div>
            )}
            <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-[var(--border-default)] bg-[var(--bg-secondary)]">
                <button
                    onClick={() => setDraft(extractFormState(step))}
                    disabled={!dirty || saving}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs rounded text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-40 transition"
                >
                    <RotateCcw size={12} /> Reset
                </button>
                <button
                    onClick={onSave}
                    disabled={!dirty || saving}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs rounded bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-40 transition"
                >
                    <Save size={12} /> {saving ? 'Saving…' : 'Save'}
                </button>
            </div>
        </div>
    );
}

function FormRow({ label, hint, children }) {
    return (
        <div>
            <div className="text-[11px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)] mb-1">{label}</div>
            {children}
            {hint && <div className="text-[11px] text-[var(--text-tertiary)] mt-1 leading-snug">{hint}</div>}
        </div>
    );
}

function extractFormState(step) {
    if (!step) return {};
    const base = { label: step.label || '' };
    if (step.type === 'ai_step') {
        return {
            ...base,
            prompt: step.prompt || '',
            systemPrompt: step.systemPrompt || '',
            modelTier: step.modelTier || 'auto',
            allowTools: !!step.allowTools,
        };
    }
    if (step.type === 'condition')    return { ...base, expr: step.expr || '' };
    if (step.type === 'notification') return { ...base, title: step.title || '', body: step.body || '' };
    return base;
}

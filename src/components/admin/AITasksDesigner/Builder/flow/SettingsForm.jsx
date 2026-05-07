import React, { useEffect, useMemo, useState } from 'react';
import { Save, RotateCcw, Plus, Trash2 } from 'lucide-react';
import { tierLabel } from '../../../../tierMeta';

/**
 * Per-step-type form-based editor. Each subcomponent owns its own draft
 * state, computes a patch on Save, and dispatches via `onPatch(patch)`
 * which the inspector merges onto the existing step. Reset reverts to
 * whatever is currently persisted in the step.
 *
 * Field coverage by type:
 *   trigger             — label, kind, schedule (cron/tz), Gmail mail.new filter
 *   integration_action  — label, inputs (key/kind/value editor), tool (read-only)
 *   ai_step             — label, prompt, systemPrompt, modelTier, allowTools, inputs
 *   condition           — label, expr
 *   loop                — label, overRef, itemVar, maxIterations
 *   code                — label, code source
 *   notification        — label, title, body
 *
 * Validation banner + Save/Reset live at the bottom of the form so every
 * type shares the same chrome.
 */
export default function SettingsForm({ step, modelTiers, stepIssues, saving, saveError, onPatch }) {
    const [draft, setDraft] = useState(() => extractFormState(step));
    useEffect(() => { setDraft(extractFormState(step)); }, [step?.id]); // eslint-disable-line

    const dirty = useMemo(() => {
        const original = extractFormState(step);
        return JSON.stringify(draft) !== JSON.stringify(original);
    }, [draft, step]);

    const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
    const setNested = (parent, k, v) => setDraft(d => ({ ...d, [parent]: { ...(d[parent] || {}), [k]: v } }));

    const onSave = async () => {
        const patch = buildPatch(step, draft);
        await onPatch(patch);
    };

    const reset = () => setDraft(extractFormState(step));

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
                        placeholder={defaultLabelPlaceholder(step)}
                        className={inputClass()}
                    />
                </FormRow>

                {step.type === 'trigger' && (
                    <TriggerFields draft={draft} set={set} setNested={setNested} />
                )}

                {step.type === 'ai_step' && (
                    <AiStepFields draft={draft} set={set} modelTiers={modelTiers} />
                )}

                {step.type === 'integration_action' && (
                    <IntegrationActionFields step={step} draft={draft} set={set} />
                )}

                {step.type === 'condition' && (
                    <FormRow label="Expression" hint="Restricted JS. Examples: steps.x.output.amount > 1000, loop.email.subject == 'Urgent'.">
                        <textarea
                            rows={3}
                            value={draft.expr || ''}
                            onChange={(e) => set('expr', e.target.value)}
                            className={textareaClass()}
                        />
                    </FormRow>
                )}

                {step.type === 'loop' && (
                    <LoopFields draft={draft} set={set} />
                )}

                {step.type === 'code' && (
                    <CodeFields draft={draft} set={set} />
                )}

                {step.type === 'notification' && (
                    <NotificationFields draft={draft} set={set} />
                )}

                <div className="text-[11px] text-[var(--text-tertiary)]">
                    Anything not on this form lives in the JSON tab.
                </div>
            </div>

            {saveError && (
                <div className="px-3 py-2 text-xs text-red-600 dark:text-red-400 border-t border-[var(--border-default)] bg-red-500/5">
                    {saveError}
                </div>
            )}
            <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-[var(--border-default)] bg-[var(--bg-secondary)]">
                <button
                    onClick={reset}
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

// ── Per-type field groups ──────────────────────────────────────────────

function TriggerFields({ draft, set, setNested }) {
    const kind = draft.kind || 'manual';
    return (
        <>
            <FormRow label="Trigger kind">
                <select
                    value={kind}
                    onChange={(e) => set('kind', e.target.value)}
                    className={inputClass()}
                >
                    <option value="manual">Manual — runs only when you click Run</option>
                    <option value="schedule">Schedule — cron timer</option>
                    <option value="webhook">Webhook — inbound HTTPS POST</option>
                    <option value="app_event">App event — e.g. new Gmail email</option>
                </select>
            </FormRow>
            {kind === 'schedule' && (
                <>
                    <FormRow label="Cron expression" hint="Five-field cron: min hour dom month dow. Example: 0 9 * * 1 = every Monday at 09:00.">
                        <input
                            type="text"
                            value={draft.scheduleCron || ''}
                            onChange={(e) => set('scheduleCron', e.target.value)}
                            placeholder="0 9 * * 1"
                            className={inputClass() + ' font-mono'}
                        />
                    </FormRow>
                    <FormRow label="Timezone">
                        <input
                            type="text"
                            value={draft.scheduleTz || 'Europe/Amsterdam'}
                            onChange={(e) => set('scheduleTz', e.target.value)}
                            className={inputClass() + ' font-mono'}
                        />
                    </FormRow>
                </>
            )}
            {kind === 'app_event' && (
                <>
                    <FormRow label="Provider">
                        <select
                            value={draft.appProvider || 'gmail'}
                            onChange={(e) => set('appProvider', e.target.value)}
                            className={inputClass()}
                        >
                            <option value="gmail">Gmail</option>
                        </select>
                    </FormRow>
                    <FormRow label="Event">
                        <select
                            value={draft.appEventName || 'mail.new'}
                            onChange={(e) => set('appEventName', e.target.value)}
                            className={inputClass()}
                        >
                            <option value="mail.new">New email</option>
                        </select>
                    </FormRow>
                    {draft.appProvider === 'gmail' && draft.appEventName === 'mail.new' && (
                        <GmailFilterFields filter={draft.filter || {}} setFilter={(k, v) => setNested('filter', k, v)} />
                    )}
                </>
            )}
        </>
    );
}

function GmailFilterFields({ filter, setFilter }) {
    return (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 space-y-3">
            <div className="text-[11px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)]">Gmail filter (all optional, AND across keys)</div>
            <FormRow label="From contains">
                <input type="text" value={filter.from || ''} onChange={(e) => setFilter('from', e.target.value || undefined)}
                    placeholder="boss@example.com" className={inputClass()} />
            </FormRow>
            <FormRow label="To contains">
                <input type="text" value={filter.to || ''} onChange={(e) => setFilter('to', e.target.value || undefined)} className={inputClass()} />
            </FormRow>
            <FormRow label="Subject contains">
                <input type="text" value={filter.subjectContains || ''} onChange={(e) => setFilter('subjectContains', e.target.value || undefined)} className={inputClass()} />
            </FormRow>
            <FormRow label="Subject regex" hint="JS regex. Capped at 200 chars; invalid patterns fail closed.">
                <input type="text" value={filter.subjectRegex || ''} onChange={(e) => setFilter('subjectRegex', e.target.value || undefined)} className={inputClass() + ' font-mono'} />
            </FormRow>
            <FormRow label="Has attachment">
                <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={filter.hasAttachment === true} onChange={(e) => setFilter('hasAttachment', e.target.checked || undefined)} />
                    Only emails with attachments
                </label>
            </FormRow>
            <FormRow label="Exclude self-sent">
                <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={filter.excludeFromSelf === true} onChange={(e) => setFilter('excludeFromSelf', e.target.checked || undefined)} />
                    Skip emails I sent
                </label>
            </FormRow>
            <FormRow label="Max age (minutes)" hint="Drop messages older than this. Useful so a long-paused poller doesn't flood with backlog on resume.">
                <input
                    type="number"
                    value={filter.maxAgeMinutes ?? ''}
                    min={1}
                    onChange={(e) => setFilter('maxAgeMinutes', e.target.value === '' ? undefined : Number(e.target.value))}
                    className={inputClass()}
                />
            </FormRow>
        </div>
    );
}

function AiStepFields({ draft, set, modelTiers }) {
    return (
        <>
            <FormRow label="Prompt" hint="The instruction the AI runs. {{from}}, {{subject}} etc. interpolate input values for the model to read.">
                <textarea rows={6} value={draft.prompt || ''} onChange={(e) => set('prompt', e.target.value)} className={textareaClass()} />
            </FormRow>
            <FormRow label="System prompt" hint="Optional. Overrides the default 'You are a step inside a no-code automation' framing — set a tone, role, or domain.">
                <textarea rows={3} value={draft.systemPrompt || ''} onChange={(e) => set('systemPrompt', e.target.value)} placeholder="(default: a generic automation-step system prompt)" className={textareaClass()} />
            </FormRow>
            <FormRow label="Model tier">
                <select value={draft.modelTier || 'auto'} onChange={(e) => set('modelTier', e.target.value)} className={inputClass()}>
                    {Object.keys(modelTiers || {}).length === 0 && (
                        <option value={draft.modelTier || 'auto'}>{draft.modelTier || 'auto'}</option>
                    )}
                    {Object.entries(modelTiers || {}).map(([id, meta]) => (
                        <option key={id} value={id}>{meta?.label || tierLabel(id) || id}</option>
                    ))}
                </select>
            </FormRow>
            <FormRow label="Allow tool use" hint="When on, the AI can call integrations the user has rights to (Gmail, Drive, web search…) during this step.">
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={!!draft.allowTools} onChange={(e) => set('allowTools', e.target.checked)} />
                    {draft.allowTools ? 'Tools enabled' : 'Tools disabled'}
                </label>
            </FormRow>
            <BindingsEditor
                label="Inputs"
                hint="Variables the AI step reads. Reference them in the prompt as {{key}}."
                inputs={draft.inputs || {}}
                onChange={(next) => set('inputs', next)}
            />
        </>
    );
}

function IntegrationActionFields({ step, draft, set }) {
    return (
        <>
            <FormRow label="Tool" hint="To switch tool, remove this step and add a new one — different tools have different inputs.">
                <div className="text-sm font-mono text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded px-2 py-1.5">
                    {step.tool || '—'}
                </div>
            </FormRow>
            <BindingsEditor
                label="Inputs"
                hint="Field values passed to the tool. Each row is a binding: literal | ref | template."
                inputs={draft.inputs || {}}
                onChange={(next) => set('inputs', next)}
            />
        </>
    );
}

function LoopFields({ draft, set }) {
    return (
        <>
            <FormRow label="Iterate over" hint="Ref path to an upstream array, e.g. steps.search.output.items.">
                <input type="text" value={draft.overRef || ''} onChange={(e) => set('overRef', e.target.value)} placeholder="steps.x.output.items" className={inputClass() + ' font-mono'} />
            </FormRow>
            <FormRow label="Item variable" hint="Name to use inside the body to refer to the current item, e.g. 'email' → loop.email.subject.">
                <input type="text" value={draft.itemVar || ''} onChange={(e) => set('itemVar', e.target.value)} placeholder="email" className={inputClass()} />
            </FormRow>
            <FormRow label="Max iterations" hint="Safety cap. 1–1000.">
                <input type="number" min={1} max={1000} value={draft.maxIterations ?? 100} onChange={(e) => set('maxIterations', Number(e.target.value))} className={inputClass()} />
            </FormRow>
        </>
    );
}

function CodeFields({ draft, set }) {
    return (
        <FormRow label="JavaScript code" hint="Define `async function main(inputs, ctx) { ... return result; }`. Sandboxed.">
            <textarea
                rows={14}
                value={draft.code || ''}
                onChange={(e) => set('code', e.target.value)}
                className={textareaClass() + ' font-mono'}
                spellCheck={false}
            />
        </FormRow>
    );
}

function NotificationFields({ draft, set }) {
    return (
        <>
            <FormRow label="Title">
                <input type="text" value={draft.title || ''} onChange={(e) => set('title', e.target.value)} className={inputClass()} />
            </FormRow>
            <FormRow label="Body" hint="Templates: {{steps.x.output.y}} interpolates upstream output.">
                <textarea rows={4} value={draft.body || ''} onChange={(e) => set('body', e.target.value)} className={textareaClass()} />
            </FormRow>
        </>
    );
}

// ── Bindings editor ────────────────────────────────────────────────────

/**
 * Edits a step's `inputs` map as a friendly table:
 *   key   | kind dropdown | value (depends on kind)
 *
 * Kinds:
 *   literal   — typed value (string by default; toggle JSON parsing)
 *   ref       — path string (steps.x.output.y)
 *   template  — string with {{...}}
 *   expr      — restricted JS expression
 *
 * Removing the empty input row keeps the JSON minimal — empty literals
 * are stripped on save.
 */
function BindingsEditor({ label, hint, inputs, onChange }) {
    const entries = Object.entries(inputs || {});

    const update = (key, partial) => {
        const next = { ...(inputs || {}) };
        next[key] = { ...next[key], ...partial };
        onChange(next);
    };
    const rename = (oldKey, newKey) => {
        if (!newKey || newKey === oldKey) return;
        const next = {};
        for (const [k, v] of Object.entries(inputs || {})) next[k === oldKey ? newKey : k] = v;
        onChange(next);
    };
    const remove = (key) => {
        const next = { ...(inputs || {}) };
        delete next[key];
        onChange(next);
    };
    const add = () => {
        const baseName = 'newField';
        let name = baseName;
        let i = 1;
        while (Object.prototype.hasOwnProperty.call(inputs || {}, name)) name = `${baseName}${++i}`;
        onChange({ ...(inputs || {}), [name]: { kind: 'literal', value: '' } });
    };

    return (
        <FormRow label={label} hint={hint}>
            <div className="space-y-2">
                {entries.length === 0 && (
                    <div className="text-[11px] text-[var(--text-tertiary)] italic">No inputs yet.</div>
                )}
                {entries.map(([key, binding]) => (
                    <BindingRow
                        key={key}
                        bindingKey={key}
                        binding={binding}
                        onRename={(nk) => rename(key, nk)}
                        onChange={(partial) => update(key, partial)}
                        onRemove={() => remove(key)}
                    />
                ))}
                <button
                    type="button"
                    onClick={add}
                    className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] px-2 py-1 rounded transition"
                >
                    <Plus size={12} /> Add input
                </button>
            </div>
        </FormRow>
    );
}

function BindingRow({ bindingKey, binding, onRename, onChange, onRemove }) {
    const kind = binding?.kind || 'literal';
    return (
        <div className="rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] p-2 space-y-1.5">
            <div className="flex items-center gap-1.5">
                <input
                    type="text"
                    defaultValue={bindingKey}
                    onBlur={(e) => onRename(e.target.value)}
                    className="flex-1 min-w-0 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded px-2 py-1 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    placeholder="key"
                />
                <select
                    value={kind}
                    onChange={(e) => onChange({ kind: e.target.value, ...convertValue(binding, kind, e.target.value) })}
                    className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded px-1.5 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
                >
                    <option value="literal">literal</option>
                    <option value="ref">ref</option>
                    <option value="template">template</option>
                    <option value="expr">expr</option>
                </select>
                <button
                    type="button"
                    onClick={onRemove}
                    className="p-1 rounded text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10"
                    title="Remove"
                >
                    <Trash2 size={12} />
                </button>
            </div>
            {kind === 'literal' && (
                <input
                    type="text"
                    value={typeof binding?.value === 'string' ? binding.value : JSON.stringify(binding?.value ?? '')}
                    onChange={(e) => onChange({ value: e.target.value })}
                    placeholder="value"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-default)] rounded px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
            )}
            {kind === 'ref' && (
                <input
                    type="text"
                    value={binding?.path || ''}
                    onChange={(e) => onChange({ path: e.target.value })}
                    placeholder="trigger.output.subject  |  steps.<id>.output.<field>"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-default)] rounded px-2 py-1 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
            )}
            {kind === 'template' && (
                <textarea
                    rows={2}
                    value={binding?.value || ''}
                    onChange={(e) => onChange({ value: e.target.value })}
                    placeholder="Re: {{trigger.output.subject}}"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-default)] rounded px-2 py-1 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-y"
                />
            )}
            {kind === 'expr' && (
                <input
                    type="text"
                    value={binding?.value || ''}
                    onChange={(e) => onChange({ value: e.target.value })}
                    placeholder="steps.x.output.amount > 1000"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-default)] rounded px-2 py-1 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
            )}
        </div>
    );
}

/** Move the previous binding's value into the new shape so the user
 *  doesn't lose what they typed when toggling kind. */
function convertValue(binding, fromKind, toKind) {
    if (!binding) return {};
    if (fromKind === toKind) return {};
    const carry = binding.value ?? binding.path ?? '';
    if (toKind === 'literal')  return { value: typeof carry === 'string' ? carry : String(carry), path: undefined };
    if (toKind === 'ref')      return { path: typeof carry === 'string' ? carry : '', value: undefined };
    if (toKind === 'template') return { value: typeof carry === 'string' ? carry : '', path: undefined };
    if (toKind === 'expr')     return { value: typeof carry === 'string' ? carry : '', path: undefined };
    return {};
}

// ── Chrome helpers ─────────────────────────────────────────────────────

function FormRow({ label, hint, children }) {
    return (
        <div>
            <div className="text-[11px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)] mb-1">{label}</div>
            {children}
            {hint && <div className="text-[11px] text-[var(--text-tertiary)] mt-1 leading-snug">{hint}</div>}
        </div>
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

function inputClass() {
    return 'w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded px-2 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]';
}
function textareaClass() {
    return 'w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded px-2 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-y';
}

// ── Form ↔ step shape helpers ──────────────────────────────────────────

function defaultLabelPlaceholder(step) {
    if (step.type === 'integration_action') return step.tool || step.type;
    if (step.type === 'trigger') return 'Trigger';
    return step.type;
}

function extractFormState(step) {
    if (!step) return {};
    const base = { label: step.label || '' };
    if (step.type === 'trigger') {
        return {
            ...base,
            kind: step.kind || 'manual',
            scheduleCron: step.schedule?.cron || '',
            scheduleTz:   step.schedule?.tz || 'Europe/Amsterdam',
            appProvider:  step.appEvent?.provider || 'gmail',
            appEventName: step.appEvent?.event || 'mail.new',
            filter:       step.appEvent?.filter || {},
        };
    }
    if (step.type === 'ai_step') {
        return {
            ...base,
            prompt: step.prompt || '',
            systemPrompt: step.systemPrompt || '',
            modelTier: step.modelTier || 'auto',
            allowTools: !!step.allowTools,
            inputs: step.inputs || {},
        };
    }
    if (step.type === 'integration_action') {
        return { ...base, inputs: step.inputs || {} };
    }
    if (step.type === 'condition')    return { ...base, expr: step.expr || '' };
    if (step.type === 'loop')         return { ...base, overRef: step.overRef || '', itemVar: step.itemVar || '', maxIterations: step.maxIterations ?? 100 };
    if (step.type === 'code')         return { ...base, code: step.code || '' };
    if (step.type === 'notification') return { ...base, title: step.title || '', body: step.body || '' };
    return base;
}

/**
 * Translate the form draft back into the persisted-step shape. We only
 * include keys that this form actually edits — everything else (id,
 * outputSchema, side-effect flag, etc.) is preserved by the inspector's
 * patch-merge.
 */
function buildPatch(step, draft) {
    const patch = { label: draft.label || null };

    if (step.type === 'trigger') {
        patch.kind = draft.kind || 'manual';
        // Preserve any existing schedule/appEvent objects so we don't
        // wipe sibling fields the form doesn't know about.
        if (draft.kind === 'schedule') {
            patch.schedule = { ...(step.schedule || {}), cron: draft.scheduleCron || '', tz: draft.scheduleTz || 'Europe/Amsterdam' };
            patch.appEvent = null;
        } else if (draft.kind === 'app_event') {
            const cleanedFilter = stripUndefined(draft.filter || {});
            patch.appEvent = {
                ...(step.appEvent || {}),
                provider: draft.appProvider || 'gmail',
                event: draft.appEventName || 'mail.new',
                filter: Object.keys(cleanedFilter).length ? cleanedFilter : null,
            };
            patch.schedule = null;
        } else {
            patch.schedule = null;
            patch.appEvent = null;
        }
    }

    if (step.type === 'ai_step') {
        patch.prompt = draft.prompt || '';
        patch.systemPrompt = draft.systemPrompt?.trim() ? draft.systemPrompt.trim() : null;
        patch.modelTier = draft.modelTier || 'auto';
        patch.allowTools = !!draft.allowTools;
        patch.inputs = sanitizeInputs(draft.inputs || {});
    }
    if (step.type === 'integration_action') {
        patch.inputs = sanitizeInputs(draft.inputs || {});
    }
    if (step.type === 'condition')    patch.expr = draft.expr || '';
    if (step.type === 'loop') {
        patch.overRef = draft.overRef || '';
        patch.itemVar = draft.itemVar || '';
        patch.maxIterations = clamp(Number(draft.maxIterations) || 100, 1, 1000);
    }
    if (step.type === 'code')         patch.code = draft.code || '';
    if (step.type === 'notification') {
        patch.title = draft.title || '';
        patch.body = draft.body || '';
    }
    return patch;
}

/** Drop bindings that have neither a value nor a path so we don't
 *  persist a half-edited row that fails validation. */
function sanitizeInputs(inputs) {
    const out = {};
    for (const [k, v] of Object.entries(inputs || {})) {
        if (!v || typeof v !== 'object') continue;
        if (v.kind === 'literal' && (v.value === '' || v.value == null)) continue;
        if (v.kind === 'ref' && !v.path) continue;
        if ((v.kind === 'template' || v.kind === 'expr') && !v.value) continue;
        out[k] = v;
    }
    return out;
}

function stripUndefined(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj || {})) {
        if (v !== undefined && v !== null && v !== '') out[k] = v;
    }
    return out;
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

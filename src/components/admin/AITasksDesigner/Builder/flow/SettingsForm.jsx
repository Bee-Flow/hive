import { Save, RotateCcw, Plus, Trash2, Sparkles, Repeat, ChevronUp, ChevronDown, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import AccordionSection from './AccordionSection';
import CollapsibleSection from './CollapsibleSection';
import FieldHint from './FieldHint';
import { getLayerContract } from './flowletScope';
import ScheduleBuilder from './ScheduleBuilder';
import ToolPicker from './ToolPicker';
import { sectionsWithErrors } from './sectionForIssue';
import { IconPicker } from './stepIcons';
import { paramsToSchema, schemaToParams } from './triggerSchemaUtils';
import useAutomationApi from '../../../../../hooks/useAutomationApi';
import { tierLabel, configuredTierKeys } from '../../../../tierMeta';
import { autoMapInputs } from '../mapping/autoMapInputs';
import { humanizeToolName } from './displayHelpers';
import BindingField from '../mapping/BindingField';
import ConditionBuilder from '../mapping/ConditionBuilder';
import LoopOverPicker from '../mapping/LoopOverPicker';
import TemplateField from '../mapping/TemplateField';
import ToolInputForm from '../mapping/ToolInputForm';
import { inputClass, textareaClass, FormRow, ValidationLine } from './settings/formPrimitives';
import { convertValue, defaultLabelPlaceholder, extractFormState, buildPatch, deepEqual, OUTPUT_FIELD_TYPES, COLUMN_TYPES } from './settings/formState';
export { schemaToFields, fieldsToSchema } from './settings/formState';
import {
    GmailFilterFields, GmailLabelFilterFields, CalendarChangedFilterFields,
    CalendarUpcomingFilterFields, DriveFileNewFilterFields, NextcloudFileFilterFields,
    NextcloudShareFilterFields, NextcloudActivityFilterFields, NextcloudNotificationFilterFields,
    TicketAssistantTicketFilterFields, TicketAssistantSyncFilterFields,
} from './settings/triggerFilters';

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
export default function SettingsForm({
    step, modelTiers, stepIssues, saving, saveError, onPatch,
    onFocusField = null, previewSample = null, catalog = null, groups = [],
    // Whole automation document (incl. the root-only `layers` map).
    // Needed by CallLayerFields to derive a flowlet's live contract — the
    // scoped `definition` the inspector binds against has no layers map.
    rootDefinition = null,
    // Published Steps catalog [{id,title,params,outputFields}] — CallStepFields
    // derives an external Step's contract from this (the Step lives in another
    // row, so there's no local layers entry to read).
    blocksCatalog = [],
}) {
    // Baseline ref tracks "what the server has". We diverge from baseline
    // when the user edits; we resync whenever the parent passes back step
    // content that matches a patch we just sent (= save round-tripped).
    //
    // The parent keys SettingsForm by step.id, so switching steps unmounts
    // this instance (with its closures over the OUTGOING step intact) and
    // mounts a fresh one — no in-component step-id transition to handle.
    const [baseline, setBaseline] = useState(() => extractFormState(step));
    const baselineRef = useRef(baseline);
    useEffect(() => { baselineRef.current = baseline; }, [baseline]);
    const [draft, setDraft] = useState(() => extractFormState(step));

    // Latest-state refs so the unmount flusher always sees the current
    // step+draft. Closures captured at mount would be stale.
    const onPatchRef = useRef(onPatch);
    const stepRef = useRef(step);
    const draftRef = useRef(draft);
    useEffect(() => { onPatchRef.current = onPatch; stepRef.current = step; draftRef.current = draft; });

    const dirty = useMemo(() => !deepEqual(draft, baseline), [draft, baseline]);

    // Which accordion sections hold a validation error — those are forced
    // open so an error is never hidden behind a collapsed section. Cheap
    // enough to compute each render (the React Compiler memoizes it).
    const errorSections = sectionsWithErrors(step, stepIssues);

    // Same-id content sync: when the parent re-renders with new step
    // content (e.g. server confirmed our last save, or chat updated the
    // label), adopt the incoming state IF the user has no local edits.
    // If the user IS mid-edit, just slide baseline forward so `dirty`
    // stays accurate against the new server state — the user's edits
    // remain in `draft` and the next autosave reconciles.
    //
    // We read `draft` via `draftRef.current` rather than including `draft`
    // in deps: this effect must only react to step-content changes, not
    // every keystroke. The ref read is intentional (not a dep), so we
    // declare the dep array explicitly with just `step`.
    useEffect(() => {
        const incoming = extractFormState(step);
        if (deepEqual(incoming, baselineRef.current)) return;
        const userHasEdits = !deepEqual(draftRef.current, baselineRef.current);
        baselineRef.current = incoming;
        setBaseline(incoming);
        if (!userHasEdits) setDraft(incoming);
    }, [step]);

    const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
    const setNested = (parent, k, v) => setDraft(d => ({ ...d, [parent]: { ...(d[parent] || {}), [k]: v } }));

    const flushNow = () => {
        if (deepEqual(draftRef.current, baselineRef.current)) return false;
        const sending = draftRef.current;
        const patch = buildPatch(stepRef.current, sending);
        // Advance baseline only on success. If the PUT fails the form
        // stays dirty so autosave (or manual Save) can retry. Concurrent
        // flushes are coalesced upstream in StepInspector.persistStepPatch.
        Promise.resolve(onPatchRef.current?.(patch))
            .then(() => { baselineRef.current = sending; setBaseline(sending); })
            .catch(() => {});
        return true;
    };

    const onSave = async () => {
        if (deepEqual(draft, baseline)) return;
        const sending = draft;
        const patch = buildPatch(step, sending);
        try {
            await onPatch(patch);
            baselineRef.current = sending;
            setBaseline(sending);
        } catch {
            // Leave baseline alone — dirty stays true, user can retry.
        }
    };

    const reset = () => setDraft(baseline);

    // Debounced auto-save — 600ms after user stops typing. After a save
    // failure we back off to 5s so a broken network doesn't get hammered
    // 100 times/min; the user can still hit the manual Save button to
    // retry immediately, and a new keystroke also restarts the timer.
    useEffect(() => {
        if (!dirty || saving) return;
        const delay = saveError ? 5000 : 600;
        const t = setTimeout(() => { flushNow(); }, delay);
        return () => clearTimeout(t);
    }, [draft, dirty, saving, saveError]);  

    // Flush on unmount — covers step change (parent re-keys us), panel
    // close, page navigation. Without this, clicking another node within
    // 600ms of typing would silently discard the edit.
    useEffect(() => () => { flushNow(); }, []);  

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            {(stepIssues.errors.length > 0 || stepIssues.warnings.length > 0) && (
                <div className="flex-shrink-0 px-3 py-2 border-b border-[var(--border-default)]">
                    {stepIssues.errors.map((e, i) => <ValidationLine key={`e-${i}`} record={e} />)}
                    {stepIssues.warnings.map((w, i) => <ValidationLine key={`w-${i}`} record={w} />)}
                </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
                <FormRow label="Label" hint="A name and an optional symbol for this step, shown on its node.">
                    <div className="flex items-center gap-2">
                        <IconPicker
                            value={draft.icon || ''}
                            onChange={(name) => set('icon', name)}
                            title="Choose a symbol for this step"
                        />
                        <input
                            type="text"
                            value={draft.label || ''}
                            onChange={(e) => set('label', e.target.value)}
                            placeholder={defaultLabelPlaceholder(step)}
                            className={inputClass() + ' flex-1'}
                        />
                    </div>
                </FormRow>

                {step.type === 'trigger' && (
                    <TriggerFields draft={draft} set={set} setNested={setNested} errorSections={errorSections} />
                )}

                {step.type === 'ai_step' && (
                    <AiStepFields
                        draft={draft} set={set} modelTiers={modelTiers}
                        catalog={catalog} groups={groups}
                        onFocusField={onFocusField} previewSample={previewSample}
                        errorSections={errorSections}
                    />
                )}

                {step.type === 'integration_action' && (
                    <IntegrationActionFields
                        step={step} draft={draft} set={set}
                        catalog={catalog} groups={groups}
                        onFocusField={onFocusField} previewSample={previewSample}
                        errorSections={errorSections}
                    />
                )}

                {step.type === 'condition' && (
                    <AccordionSection stepType="condition" sectionKey="condition" title="Condition" defaultOpen forceOpen={errorSections.has('condition')}>
                        <FormRow label="Condition" hint="Pick a field, an operator, and a value — or switch to Advanced to write your own expression.">
                            <ConditionBuilder
                                value={draft.expr || ''}
                                onChange={(next) => set('expr', next)}
                                onFocusField={onFocusField}
                                previewSample={previewSample}
                            />
                        </FormRow>
                    </AccordionSection>
                )}

                {step.type === 'loop' && (
                    <LoopFields
                        draft={draft} set={set}
                        groups={groups} onFocusField={onFocusField}
                        errorSections={errorSections}
                    />
                )}

                {step.type === 'code' && (
                    <CodeFields draft={draft} set={set} errorSections={errorSections} />
                )}

                {step.type === 'notification' && (
                    <NotificationFields
                        draft={draft} set={set}
                        onFocusField={onFocusField} previewSample={previewSample}
                        errorSections={errorSections}
                    />
                )}

                {step.type === 'call_layer' && (
                    <CallLayerFields step={step} draft={draft} set={set} groups={groups} onFocusField={onFocusField} previewSample={previewSample} rootDefinition={rootDefinition} errorSections={errorSections} />
                )}
                {step.type === 'call_block' && (
                    <CallStepFields step={step} draft={draft} set={set} groups={groups} onFocusField={onFocusField} previewSample={previewSample} blocksCatalog={blocksCatalog} errorSections={errorSections} />
                )}
                {step.type === 'layer_output' && (
                    <LayerOutputFields draft={draft} set={set} onFocusField={onFocusField} previewSample={previewSample} errorSections={errorSections} />
                )}

                {step.type === 'set' && (
                    <SetFields draft={draft} set={set} onFocusField={onFocusField} previewSample={previewSample} errorSections={errorSections} />
                )}
                {step.type === 'datetime' && (
                    <DateTimeFields draft={draft} set={set} groups={groups} errorSections={errorSections} />
                )}
                {step.type === 'wait' && (
                    <WaitFields draft={draft} set={set} errorSections={errorSections} />
                )}
                {step.type === 'stop_error' && (
                    <StopErrorFields draft={draft} set={set} onFocusField={onFocusField} previewSample={previewSample} errorSections={errorSections} />
                )}
                {step.type === 'switch' && (
                    <SwitchFields draft={draft} set={set} onFocusField={onFocusField} previewSample={previewSample} errorSections={errorSections} />
                )}
                {step.type === 'filter' && (
                    <FilterFields draft={draft} set={set} groups={groups} onFocusField={onFocusField} previewSample={previewSample} errorSections={errorSections} />
                )}
                {step.type === 'limit' && (
                    <LimitFields draft={draft} set={set} groups={groups} onFocusField={onFocusField} errorSections={errorSections} />
                )}
                {step.type === 'dedupe' && (
                    <DedupeFields draft={draft} set={set} groups={groups} onFocusField={onFocusField} errorSections={errorSections} />
                )}
                {step.type === 'aggregate' && (
                    <AggregateFields draft={draft} set={set} groups={groups} onFocusField={onFocusField} errorSections={errorSections} />
                )}
                {step.type === 'summarize' && (
                    <SummarizeFields draft={draft} set={set} groups={groups} onFocusField={onFocusField} errorSections={errorSections} />
                )}

                <div className="text-[11px] text-[var(--text-tertiary)]">
                    Advanced options are available in the JSON view.
                </div>
            </div>

            {saveError && (
                <div className="flex-shrink-0 px-3 py-2 text-xs text-red-600 dark:text-red-400 border-t border-[var(--border-default)] bg-red-500/5">
                    {saveError}
                </div>
            )}
            <div className="flex-shrink-0 flex items-center justify-end gap-2 px-3 py-2 border-t border-[var(--border-default)] bg-[var(--bg-secondary)]">
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

function TriggerFields({ draft, set, setNested, errorSections = new Set() }) {
    const kind = draft.kind || 'manual';
    // A flowlet's trigger declares its input contract instead of firing — no
    // schedule/manual/webhook switch, just the params editor.
    if (kind === 'layer_input') {
        return (
            <AccordionSection stepType="trigger" sectionKey="inputs" title="Inputs" defaultOpen forceOpen={errorSections.has('config')}>
                <LayerInputFields draft={draft} set={set} />
            </AccordionSection>
        );
    }
    const hasKindForm = kind === 'agent_call' || kind === 'schedule' || kind === 'app_event';
    const kindTitle = kind === 'agent_call' ? 'Agent tool' : kind === 'schedule' ? 'Schedule' : 'Event';
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
                    <option value="agent_call">Agent — callable from chat</option>
                </select>
            </FormRow>
            {hasKindForm && (
                <AccordionSection stepType="trigger" sectionKey="config" title={kindTitle} defaultOpen forceOpen={errorSections.has('config') || errorSections.has('event')}>
                    {kind === 'agent_call' && (
                        <AgentCallFields draft={draft} set={set} />
                    )}
                    {kind === 'schedule' && (
                        <ScheduleBuilder
                            cron={draft.scheduleCron || ''}
                            tz={draft.scheduleTz || 'Europe/Amsterdam'}
                            onChange={({ cron, tz }) => {
                                set('scheduleCron', cron);
                                set('scheduleTz', tz);
                            }}
                        />
                    )}
                    {kind === 'app_event' && (
                        <AppEventFields draft={draft} set={set} setNested={setNested} />
                    )}
                </AccordionSection>
            )}
        </>
    );
}

/**
 * Provider + event selects with per-event filter sub-form. Switching the
 * provider auto-snaps the event to a sensible default for that provider
 * AND clears the filter — different events have incompatible filter
 * shapes, so carrying old fields over would just produce validation warnings.
 */
function AppEventFields({ draft, set, setNested }) {
    const provider = draft.appProvider || 'gmail';
    const event = draft.appEventName || DEFAULT_EVENT[provider] || 'mail.new';

    const onProviderChange = (next) => {
        set('appProvider', next);
        const nextEvent = DEFAULT_EVENT[next] || 'mail.new';
        set('appEventName', nextEvent);
        set('filter', {});
    };
    const onEventChange = (next) => {
        set('appEventName', next);
        set('filter', {});
    };

    const setF = (k, v) => setNested('filter', k, v);
    const filter = draft.filter || {};

    return (
        <>
            <FormRow label="Provider">
                <select value={provider} onChange={(e) => onProviderChange(e.target.value)} className={inputClass()}>
                    <option value="gmail">Gmail</option>
                    <option value="google-calendar">Google Calendar</option>
                    <option value="google-drive">Google Drive</option>
                    <option value="nextcloud">Nextcloud</option>
                    <option value="ticket-assistant">Ticket Assistant</option>
                </select>
            </FormRow>
            <FormRow label="Event">
                <select value={event} onChange={(e) => onEventChange(e.target.value)} className={inputClass()}>
                    {EVENTS_BY_PROVIDER[provider].map(([id, label]) => (
                        <option key={id} value={id}>{label}</option>
                    ))}
                </select>
            </FormRow>

            {provider === 'gmail' && event === 'mail.new' && (
                <GmailFilterFields filter={filter} setFilter={setF} />
            )}
            {provider === 'gmail' && event === 'label.added' && (
                <GmailLabelFilterFields filter={filter} setFilter={setF} />
            )}
            {provider === 'google-calendar' && event === 'event.changed' && (
                <CalendarChangedFilterFields filter={filter} setFilter={setF} />
            )}
            {provider === 'google-calendar' && event === 'event.upcoming' && (
                <CalendarUpcomingFilterFields filter={filter} setFilter={setF} />
            )}
            {provider === 'google-drive' && event === 'file.new' && (
                <DriveFileNewFilterFields filter={filter} setFilter={setF} />
            )}
            {provider === 'nextcloud' && (event === 'file.new' || event === 'file.changed') && (
                <NextcloudFileFilterFields filter={filter} setFilter={setF} />
            )}
            {provider === 'nextcloud' && event === 'share.received' && (
                <NextcloudShareFilterFields filter={filter} setFilter={setF} />
            )}
            {provider === 'nextcloud' && event === 'activity.new' && (
                <NextcloudActivityFilterFields filter={filter} setFilter={setF} />
            )}
            {provider === 'nextcloud' && event === 'notification.new' && (
                <NextcloudNotificationFilterFields filter={filter} setFilter={setF} />
            )}
            {provider === 'ticket-assistant' && event === 'ticket.new' && (
                <TicketAssistantTicketFilterFields filter={filter} setFilter={setF} />
            )}
            {provider === 'ticket-assistant' && event === 'sync.completed' && (
                <TicketAssistantSyncFilterFields filter={filter} setFilter={setF} />
            )}
        </>
    );
}

const DEFAULT_EVENT = {
    'gmail': 'mail.new',
    'google-calendar': 'event.changed',
    'google-drive': 'file.new',
    'nextcloud': 'file.new',
    'ticket-assistant': 'ticket.new',
};
const EVENTS_BY_PROVIDER = {
    'gmail': [
        ['mail.new',     'New email'],
        ['label.added',  'Label added'],
    ],
    'google-calendar': [
        ['event.changed',  'Event changed'],
        ['event.upcoming', 'Event upcoming (lead-time before start)'],
    ],
    'google-drive': [
        ['file.new', 'New file'],
    ],
    'nextcloud': [
        ['file.new',         'New file'],
        ['file.changed',     'File changed'],
        ['share.received',   'Share received'],
        ['activity.new',     'Any activity (advanced)'],
        ['notification.new', 'Notification received'],
    ],
    'ticket-assistant': [
        ['ticket.new',      'New ticket ingested'],
        ['sync.completed',  'Sync run finished'],
    ],
};

function AiStepFields({ draft, set, modelTiers, catalog = null, groups = [], onFocusField, previewSample, errorSections }) {
    const hasInputs = Object.keys(draft.inputs || {}).length > 0;
    const hasOutput = (draft.outputFields || []).length > 0;
    return (
        <>
            <FormRow label="Prompt" hint="What the AI should do. Drag data from the Input panel (or use the {} button) to drop in a value from a previous step — it's filled in with the real value when the step runs.">
                <TemplateField
                    value={draft.prompt || ''}
                    onChange={(next) => set('prompt', next)}
                    rows={4}
                    onFocusField={onFocusField}
                    previewSample={previewSample}
                    placeholder="Summarise this email and decide if it needs an urgent reply."
                />
            </FormRow>
            {/* Keep the existing `aiStep.advanced` key so current users' Advanced
                preference isn't reset by the new inspector.* scheme. */}
            <CollapsibleSection title="Advanced" persistKey="aiStep.advanced">
                <FormRow label="System prompt" hint="Optional. Overrides the default 'You are a step inside a no-code automation' framing — set a tone, role, or domain.">
                    <textarea rows={3} value={draft.systemPrompt || ''} onChange={(e) => set('systemPrompt', e.target.value)} placeholder="(default: a generic automation-step system prompt)" className={textareaClass()} />
                </FormRow>
                <FormRow label="Model tier">
                    {(() => {
                        // Only list the tiers the chat actually offers — same
                        // configured-tier filter the ModelTierSelector uses, so
                        // the two pickers never drift apart.
                        const keys = configuredTierKeys(modelTiers || {});
                        const current = draft.modelTier || 'auto';
                        // Keep a previously-saved tier selectable even if it's no
                        // longer offered (e.g. beta revoked) so we don't silently
                        // change the step's model on open.
                        const options = keys.includes(current) ? keys : [current, ...keys];
                        return (
                            <select value={current} onChange={(e) => set('modelTier', e.target.value)} className={inputClass()}>
                                {options.length === 0 && (
                                    <option value={current}>{current}</option>
                                )}
                                {options.map((id) => (
                                    <option key={id} value={id}>{modelTiers?.[id]?.label || tierLabel(id, modelTiers) || id}</option>
                                ))}
                            </select>
                        );
                    })()}
                </FormRow>
                <FormRow label="Tools" hint="Choose which tools the AI may call during this step. Only tools you have permission for are listed. Leave empty for a pure text answer.">
                    <AiStepToolSelect draft={draft} set={set} catalog={catalog} />
                </FormRow>
                <FormRow label="Iteration" hint="Off by default: the AI runs once and sees all mapped data at once. Turn on to run the prompt once per item of an upstream list (then reference {{loop.item…}}).">
                    <ForEachSection draft={draft} set={set} groups={groups} onFocusField={onFocusField} />
                </FormRow>
            </CollapsibleSection>
            <AccordionSection stepType="ai_step" sectionKey="inputs" title="Inputs" defaultOpen={hasInputs} forceOpen={errorSections.has('inputs')}>
                <FormRow label="Inputs" hint="Named values the AI can read alongside the prompt. Mention a name in the prompt to use it.">
                    <ToolInputForm
                        inputs={draft.inputs || {}}
                        onChange={(next) => set('inputs', next)}
                        inputSchema={null}
                        onFocusField={onFocusField}
                        previewSample={previewSample}
                    />
                </FormRow>
            </AccordionSection>
            <AccordionSection stepType="ai_step" sectionKey="output" title="Structured output" defaultOpen={hasOutput} forceOpen={errorSections.has('output')}>
                <FormRow label="Structured output" hint="Define the JSON fields the AI should return. Downstream steps can then reference them by name. Leave empty for free-form text.">
                    <StructuredOutputFields
                        fields={draft.outputFields || []}
                        onChange={(next) => set('outputFields', next)}
                    />
                </FormRow>
            </AccordionSection>
        </>
    );
}

/**
 * Tool selector for the AI step. Mirrors the agent editor's app picker but at
 * per-tool granularity: the user picks individual catalog actions, stored as
 * `tools` (function names). `allowTools` is derived from the selection.
 *
 * Legacy steps carry `allowTools: true` with no `tools` array — that means
 * "every permitted tool". We surface that as an "All available tools" state and
 * only convert it to an explicit list once the user opens the picker.
 */
function AiStepToolSelect({ draft, set, catalog }) {
    const [open, setOpen] = useState(false);

    // Apps the user can actually use (catalog is already permission-gated
    // server-side; `available === false` means hidden/not entitled).
    const apps = useMemo(
        () => (catalog?.apps || []).filter(a => a.available !== false && (a.actions || []).length > 0),
        [catalog],
    );
    // Flat lookup: function name -> { action, app } for chip labels.
    const actionIndex = useMemo(() => {
        const m = new Map();
        for (const app of apps) for (const a of (app.actions || [])) m.set(a.name, { action: a, app });
        return m;
    }, [apps]);
    const allNames = useMemo(() => apps.flatMap(a => (a.actions || []).map(x => x.name)), [apps]);

    // null/undefined `tools` + allowTools on = legacy "all tools".
    const isExplicit = Array.isArray(draft.tools);
    const legacyAll = !isExplicit && !!draft.allowTools;
    const selected = isExplicit ? draft.tools : [];

    const setSelected = (next) => set('tools', next);
    const toggleTool = (name) => {
        const base = isExplicit ? draft.tools : [];
        setSelected(base.includes(name) ? base.filter(n => n !== name) : [...base, name]);
    };
    const toggleApp = (app, on) => {
        const names = (app.actions || []).map(a => a.name);
        const base = new Set(isExplicit ? draft.tools : []);
        if (on) names.forEach(n => base.add(n)); else names.forEach(n => base.delete(n));
        setSelected([...base]);
    };
    // Converting legacy "all" → explicit: start from every available tool so the
    // current behaviour is preserved and the user can untick what they don't need.
    const chooseSpecific = () => { setSelected([...allNames]); setOpen(true); };

    const chipLabel = (name) => {
        const hit = actionIndex.get(name);
        if (!hit) return humanizeToolName(name);
        const app = hit.app.label || hit.action.integrationLabel || '';
        const act = hit.action.label || humanizeToolName(name);
        return app ? `${app}: ${act}` : act;
    };

    if (legacyAll) {
        return (
            <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-default)] px-2.5 py-1 text-xs">
                        <Sparkles size={12} className="text-[var(--accent)]" />
                        All available tools
                    </span>
                </div>
                <button
                    type="button"
                    onClick={chooseSpecific}
                    className="text-xs font-medium text-[var(--accent)] hover:underline"
                >
                    Choose specific tools…
                </button>
                {open && (
                    <ToolPicker
                        apps={apps}
                        selected={selected}
                        onToggleTool={toggleTool}
                        onToggleApp={toggleApp}
                        onClose={() => setOpen(false)}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
            >
                <Plus size={14} />
                Browse tools
            </button>
            {selected.length === 0 ? (
                <p className="text-xs text-[var(--text-tertiary)]">No tools — the AI step answers from its prompt only.</p>
            ) : (
                <div className="flex flex-wrap gap-1.5">
                    {selected.map((name) => (
                        <span
                            key={name}
                            className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-default)] pl-2.5 pr-1 py-0.5 text-xs text-[var(--text-primary)]"
                        >
                            <span className="truncate max-w-[180px]">{chipLabel(name)}</span>
                            <button
                                type="button"
                                onClick={() => toggleTool(name)}
                                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                                aria-label={`Remove ${chipLabel(name)}`}
                            >
                                <X size={12} />
                            </button>
                        </span>
                    ))}
                </div>
            )}
            {open && (
                <ToolPicker
                    apps={apps}
                    selected={selected}
                    onToggleTool={toggleTool}
                    onToggleApp={toggleApp}
                    onClose={() => setOpen(false)}
                />
            )}
        </div>
    );
}

function IntegrationActionFields({ step, draft, set, catalog, groups = [], onFocusField, previewSample, errorSections = new Set() }) {
    // Track the live tool from the draft so switching operation updates the
    // inputs form immediately (before the patch round-trips and step.tool
    // catches up).
    const currentTool = draft.tool || step.tool;
    const { action, siblings } = useMemo(
        () => findActionAndSiblings(catalog, currentTool, draft.appId || step.appId),
        [catalog, currentTool, draft.appId, step.appId],
    );
    const inputSchema = action?.inputSchema || null;
    const onAutoMap = () => {
        const patch = autoMapInputs(inputSchema, draft.inputs || {}, groups || []);
        if (Object.keys(patch).length) set('inputs', { ...(draft.inputs || {}), ...patch });
    };
    // Same app = one node with a switchable operation (n8n-style). Keep the
    // inputs that also exist in the new operation; drop the rest.
    const onChangeOperation = (e) => {
        const newTool = e.target.value;
        if (!newTool || newTool === currentTool) return;
        const next = siblings.find(a => a.name === newTool);
        const allowed = next?.inputSchema?.properties ? new Set(Object.keys(next.inputSchema.properties)) : null;
        const prevInputs = draft.inputs || {};
        const keptInputs = allowed
            ? Object.fromEntries(Object.entries(prevInputs).filter(([k]) => allowed.has(k)))
            : prevInputs;
        set('tool', newTool);
        set('label', next?.label || humanizeToolName(newTool));
        set('inputs', keptInputs);
        if (next?.sideEffect != null) set('sideEffect', next.sideEffect);
    };
    const canSwitch = siblings.length > 1;
    return (
        <>
            <AccordionSection stepType="integration_action" sectionKey="basics" title="Basics" defaultOpen forceOpen={errorSections.has('basics')}>
                <FormRow label="Operation" hint={canSwitch ? 'Switch which action this node runs. Inputs shared with the new operation are kept.' : 'The action this node runs.'}>
                    {canSwitch ? (
                        <select value={currentTool} onChange={onChangeOperation} className={inputClass()}>
                            {siblings.map(a => (
                                <option key={a.name} value={a.name}>{a.label || humanizeToolName(a.name)}</option>
                            ))}
                        </select>
                    ) : (
                        <div className="text-sm font-mono text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded px-2 py-1.5">
                            {currentTool || '—'}
                        </div>
                    )}
                </FormRow>
            </AccordionSection>
            <AccordionSection stepType="integration_action" sectionKey="inputs" title="Inputs" defaultOpen forceOpen={errorSections.has('inputs')}>
                <FormRow label="Inputs" hint={inputSchema ? 'Field values passed to the tool. Pick a variable from the right panel to bind upstream output.' : 'No schema found for this tool — using generic key/value rows.'}>
                    <ToolInputForm
                        inputs={draft.inputs || {}}
                        onChange={(next) => set('inputs', next)}
                        inputSchema={inputSchema}
                        onFocusField={onFocusField}
                        previewSample={previewSample}
                        autoMappedKeys={step.autoMapped || []}
                        onAutoMap={onAutoMap}
                        // Only let the user add ad-hoc fields when the tool can
                        // actually accept them: a fixed schema (gmail_search etc.)
                        // doesn't, so hide "Add custom field"; a tool with no
                        // schema needs the generic key/value rows.
                        allowExtraFields={inputSchema ? inputSchema.additionalProperties === true : true}
                    />
                </FormRow>
            </AccordionSection>
            <AccordionSection stepType="integration_action" sectionKey="advanced" title="Advanced" defaultOpen={!!draft.forEach} forceOpen={errorSections.has('advanced')}>
                <ForEachSection draft={draft} set={set} groups={groups} onFocusField={onFocusField} />
            </AccordionSection>
        </>
    );
}

/**
 * "Run once per item" — turns a step into a per-item iterator over an
 * upstream array (`step.forEach`). The runner runs the step once per
 * element with `loop.<itemVar>` bound; auto-map sets this up automatically
 * when you wire an array source into a step whose inputs match the elements.
 */
function ForEachSection({ draft, set, groups, onFocusField }) {
    const fe = draft.forEach || null;
    const enabled = !!fe;
    const toggle = (on) => set('forEach', on
        ? { overRef: fe?.overRef || '', itemVar: fe?.itemVar || 'item', maxIterations: fe?.maxIterations ?? 100 }
        : null);
    return (
        <div className="rounded-lg border border-[var(--border-default)] p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={enabled} onChange={(e) => toggle(e.target.checked)} />
                <span className="inline-flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
                    <Repeat size={13} /> Run once per item
                </span>
            </label>
            <p className="text-[11px] text-[var(--text-tertiary)]">
                Iterate over an upstream array — this step runs once per element. Reference each one as{' '}
                <code className="font-mono">loop.{fe?.itemVar || 'item'}</code>.
            </p>
            {enabled && (
                <div className="space-y-3 pt-1">
                    <LoopOverPicker
                        overRef={fe.overRef || ''}
                        itemVar={fe.itemVar || 'item'}
                        onChange={(patch) => set('forEach', { ...fe, ...patch })}
                        groups={groups}
                        onFocusField={onFocusField}
                    />
                    <FormRow label="Max iterations" hint="Safety cap. 1–1000.">
                        <input
                            type="number" min={1} max={1000}
                            value={fe.maxIterations ?? 100}
                            onChange={(e) => set('forEach', { ...fe, maxIterations: Number(e.target.value) })}
                            className={inputClass()}
                        />
                    </FormRow>
                </div>
            )}
        </div>
    );
}

/**
 * Locate the catalog action for `toolName` and all sibling actions of the
 * same app (used by the operation switcher). Falls back to `appId` when the
 * tool itself isn't in the catalog (e.g. the app isn't connected) so the
 * operation list still renders.
 */
function findActionAndSiblings(catalog, toolName, appId) {
    if (!catalog?.apps) return { action: null, siblings: [] };
    for (const app of catalog.apps) {
        const action = (app.actions || []).find(a => a.name === toolName);
        if (action) return { action, siblings: app.actions || [] };
    }
    if (appId) {
        const app = catalog.apps.find(a => a.id === appId
            || (a.actions || []).some(x => (x.integrationId || a.id) === appId));
        if (app) return { action: null, siblings: app.actions || [] };
    }
    return { action: null, siblings: [] };
}

function LoopFields({ draft, set, groups, onFocusField, errorSections = new Set() }) {
    return (
        <AccordionSection stepType="loop" sectionKey="loop" title="Loop" defaultOpen forceOpen={errorSections.has('loop')}>
            <LoopOverPicker
                overRef={draft.overRef || ''}
                itemVar={draft.itemVar || 'item'}
                onChange={(patch) => {
                    if ('overRef' in patch) set('overRef', patch.overRef);
                    if ('itemVar' in patch) set('itemVar', patch.itemVar);
                }}
                groups={groups}
                onFocusField={onFocusField}
            />
            <FormRow label="Max iterations" hint="Safety cap. 1–1000.">
                <input type="number" min={1} max={1000} value={draft.maxIterations ?? 100} onChange={(e) => set('maxIterations', Number(e.target.value))} className={inputClass()} />
            </FormRow>
        </AccordionSection>
    );
}

function CodeFields({ draft, set, errorSections = new Set() }) {
    return (
        <AccordionSection stepType="code" sectionKey="code" title="Code" defaultOpen forceOpen={errorSections.has('code')}>
            <FormRow label="JavaScript code" hint="Define `async function main(inputs, ctx) { ... return result; }`. Sandboxed.">
                <textarea
                    rows={14}
                    value={draft.code || ''}
                    onChange={(e) => set('code', e.target.value)}
                    className={textareaClass() + ' font-mono'}
                    spellCheck={false}
                />
            </FormRow>
        </AccordionSection>
    );
}

function NotificationFields({ draft, set, onFocusField, previewSample, errorSections = new Set() }) {
    return (
        <AccordionSection stepType="notification" sectionKey="message" title="Message" defaultOpen forceOpen={errorSections.has('message')}>
            <FormRow label="Title">
                <TemplateField
                    value={draft.title || ''}
                    onChange={(next) => set('title', next)}
                    rows={1}
                    onFocusField={onFocusField}
                    previewSample={previewSample}
                    placeholder="New invoice received"
                />
            </FormRow>
            <FormRow label="Body" hint="Click a value in the right panel to insert it.">
                <TemplateField
                    value={draft.body || ''}
                    onChange={(next) => set('body', next)}
                    rows={4}
                    onFocusField={onFocusField}
                    previewSample={previewSample}
                    placeholder="From: {{trigger.output.from}}\nSubject: {{trigger.output.subject}}"
                />
            </FormRow>
        </AccordionSection>
    );
}

// ── n8n-style utility node forms ──────────────────────────────────────

function SetFields({ draft, set, onFocusField, previewSample, errorSections = new Set() }) {
    return (
        <AccordionSection stepType="set" sectionKey="fields" title="Fields" defaultOpen forceOpen={errorSections.has('fields')}>
            <FormRow label="Fields" hint="Build the output object from explicit field bindings.">
                <ToolInputForm
                    inputs={draft.fields || {}}
                    onChange={(next) => set('fields', next)}
                    inputSchema={null}
                    keepEmptyFields
                    onFocusField={onFocusField}
                    previewSample={previewSample}
                />
            </FormRow>
        </AccordionSection>
    );
}

// ── Flowlets ──────────────────────────────────────────────────────────────

/**
 * Editor for a call_layer step. The flowlet's contract derives LIVE from
 * `rootDefinition.layers[step.layerKey]` (params from the layer_input
 * trigger, returns from the layer_output fields) — editing the flowlet
 * immediately updates this form. The user edits the input mapping (one
 * BindingField per declared param).
 */
function CallLayerFields({ step, draft, set, groups, onFocusField, previewSample, rootDefinition = null, errorSections = new Set() }) {
    const { params: contract, outputFields } = getLayerContract(rootDefinition, step.layerKey);
    const layerTitle = rootDefinition?.layers?.[step.layerKey]?.title || null;
    const inputs = draft.inputs || {};
    const autoMapped = Array.isArray(step.autoMapped) ? step.autoMapped : [];

    const setInput = (name, binding) => {
        const next = { ...inputs };
        if (!binding || (binding.kind === 'literal' && (binding.value === '' || binding.value == null))) delete next[name];
        else next[name] = binding;
        set('inputs', next);
    };
    const onAutoMap = () => {
        const schema = {
            properties: Object.fromEntries(contract.map(p => [p.name, { type: p.type }])),
            required: contract.filter(p => p.required).map(p => p.name),
        };
        const patch = autoMapInputs(schema, inputs, groups || []);
        if (Object.keys(patch).length) set('inputs', { ...inputs, ...patch });
    };

    return (
        <>
            <AccordionSection stepType="call_layer" sectionKey="flowlet" title="Flowlet" defaultOpen forceOpen={errorSections.has('flowlet')}>
                <FormRow label="Flowlet">
                    <div className="text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded px-2 py-1.5 truncate">
                        {layerTitle || step.layerKey || '—'}
                    </div>
                    {!layerTitle && step.layerKey && (
                        <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                            Flowlet “{step.layerKey}” was not found in this automation.
                        </div>
                    )}
                </FormRow>
            </AccordionSection>
            <AccordionSection stepType="call_layer" sectionKey="inputs" title="Inputs" defaultOpen={contract.length > 0} forceOpen={errorSections.has('inputs')}>
                <FormRow label="Inputs" hint="Map each flowlet parameter to an upstream value.">
                    {contract.length === 0 ? (
                        <div className="text-[11px] text-[var(--text-tertiary)] italic">This flowlet has no declared inputs.</div>
                    ) : (
                        <div className="space-y-3">
                            {groups && groups.length > 0 && (
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={onAutoMap}
                                        className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition"
                                    >
                                        <Sparkles size={12} /> Auto-map
                                    </button>
                                </div>
                            )}
                            {contract.map(p => (
                                <BindingField
                                    key={p.name}
                                    label={p.name}
                                    required={!!p.required}
                                    hint={p.description}
                                    value={inputs[p.name] ?? null}
                                    onChange={(b) => setInput(p.name, b)}
                                    onFocusField={onFocusField}
                                    previewSample={previewSample}
                                    autoMapped={autoMapped.includes(p.name)}
                                />
                            ))}
                        </div>
                    )}
                </FormRow>
            </AccordionSection>
            {outputFields.length > 0 && (
                <AccordionSection stepType="call_layer" sectionKey="returns" title="Returns">
                    <FormRow label="Returns" hint="These fields are available to downstream steps by name.">
                        <div className="text-[11px] text-[var(--text-secondary)] font-mono">{outputFields.join(', ')}</div>
                    </FormRow>
                </AccordionSection>
            )}
        </>
    );
}

/**
 * Editor for a call_block step. The Step's contract comes from the published
 * Steps catalog (the Step is a separate row), not the local layers map.
 * The user maps each declared param to an upstream value.
 */
function CallStepFields({ step, draft, set, groups, onFocusField, previewSample, blocksCatalog = [], errorSections = new Set() }) {
    const block = (blocksCatalog || []).find(b => b.id === step.blockId) || null;
    const contract = block?.params || [];
    const outputFields = block?.outputFields || [];
    const blockTitle = block?.title || null;
    const inputs = draft.inputs || {};
    const autoMapped = Array.isArray(step.autoMapped) ? step.autoMapped : [];

    const setInput = (name, binding) => {
        const next = { ...inputs };
        if (!binding || (binding.kind === 'literal' && (binding.value === '' || binding.value == null))) delete next[name];
        else next[name] = binding;
        set('inputs', next);
    };
    const onAutoMap = () => {
        const schema = {
            properties: Object.fromEntries(contract.map(p => [p.name, { type: p.type }])),
            required: contract.filter(p => p.required).map(p => p.name),
        };
        const patch = autoMapInputs(schema, inputs, groups || []);
        if (Object.keys(patch).length) set('inputs', { ...inputs, ...patch });
    };

    return (
        <>
            <AccordionSection stepType="call_block" sectionKey="step" title="Step" defaultOpen forceOpen={errorSections.has('step')}>
                <FormRow label="Step">
                    <div className="text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded px-2 py-1.5 truncate">
                        {blockTitle || step.label || step.blockId || '—'}
                    </div>
                    {!block && step.blockId && (
                        <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                            This Step is unpublished, deleted, or not shared with you.
                        </div>
                    )}
                </FormRow>
            </AccordionSection>
            <AccordionSection stepType="call_block" sectionKey="inputs" title="Inputs" defaultOpen={contract.length > 0} forceOpen={errorSections.has('inputs')}>
                <FormRow label="Inputs" hint="Map each Step input to an upstream value.">
                    {contract.length === 0 ? (
                        <div className="text-[11px] text-[var(--text-tertiary)] italic">This Step has no declared inputs.</div>
                    ) : (
                        <div className="space-y-3">
                            {groups && groups.length > 0 && (
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={onAutoMap}
                                        className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition"
                                    >
                                        <Sparkles size={12} /> Auto-map
                                    </button>
                                </div>
                            )}
                            {contract.map(p => (
                                <BindingField
                                    key={p.name}
                                    label={p.name}
                                    required={!!p.required}
                                    hint={p.description}
                                    value={inputs[p.name] ?? null}
                                    onChange={(b) => setInput(p.name, b)}
                                    onFocusField={onFocusField}
                                    previewSample={previewSample}
                                    autoMapped={autoMapped.includes(p.name)}
                                />
                            ))}
                        </div>
                    )}
                </FormRow>
            </AccordionSection>
            {outputFields.length > 0 && (
                <AccordionSection stepType="call_block" sectionKey="returns" title="Returns">
                    <FormRow label="Returns" hint="These fields are available to downstream steps by name.">
                        <div className="text-[11px] text-[var(--text-secondary)] font-mono">{outputFields.join(', ')}</div>
                    </FormRow>
                </AccordionSection>
            )}
        </>
    );
}

/** Editor for a layer_output step — the object the flowlet returns. */
function LayerOutputFields({ draft, set, onFocusField, previewSample, errorSections = new Set() }) {
    return (
        <AccordionSection stepType="layer_output" sectionKey="fields" title="Return fields" defaultOpen forceOpen={errorSections.has('fields')}>
            <FormRow label="Return fields" hint="The object this flowlet returns to its caller. Bind each field to a value produced inside the flowlet.">
                <ToolInputForm
                    inputs={draft.fields || {}}
                    onChange={(next) => set('fields', next)}
                    inputSchema={null}
                    keepEmptyFields
                    onFocusField={onFocusField}
                    previewSample={previewSample}
                />
            </FormRow>
        </AccordionSection>
    );
}

/** Editor for a flowlet's input contract (trigger kind 'layer_input'). */
function LayerInputFields({ draft, set }) {
    const params = Array.isArray(draft.params) ? draft.params : [];
    const update = (i, patch) => { const next = params.slice(); next[i] = { ...next[i], ...patch }; set('params', next); };
    const add = () => set('params', [...params, { name: `input${params.length + 1}`, type: 'string', required: false }]);
    const remove = (i) => set('params', params.filter((_, idx) => idx !== i));
    return (
        <FormRow label="Flowlet inputs" hint="Parameters this flowlet accepts. Inside the flowlet, bind to them as trigger.output.<name>.">
            <div className="space-y-2">
                {params.length === 0 && <div className="text-[11px] text-[var(--text-tertiary)] italic">No inputs yet — the flowlet will receive an empty payload.</div>}
                {params.map((p, i) => (
                    <div key={i} className="rounded border border-[var(--border-default)] bg-[var(--bg-primary)] p-2 space-y-1.5">
                        <div className="flex items-center gap-1">
                            <input
                                type="text"
                                value={p.name || ''}
                                onChange={(e) => update(i, { name: e.target.value })}
                                placeholder="name"
                                className="flex-1 min-w-0 px-2 py-1 text-xs font-mono rounded border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                            />
                            <select
                                value={p.type || 'string'}
                                onChange={(e) => update(i, { type: e.target.value })}
                                className="px-1.5 py-1 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
                            >
                                <option value="string">string</option>
                                <option value="number">number</option>
                                <option value="boolean">boolean</option>
                                <option value="object">object</option>
                                <option value="array">array</option>
                            </select>
                            <button type="button" onClick={() => remove(i)} aria-label="Remove input" className="shrink-0 p-1 rounded text-[var(--text-tertiary)] hover:text-red-500 hover:bg-[var(--bg-secondary)]">
                                <Trash2 size={12} />
                            </button>
                        </div>
                        <label className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] cursor-pointer">
                            <input type="checkbox" checked={!!p.required} onChange={(e) => update(i, { required: e.target.checked })} /> required
                        </label>
                    </div>
                ))}
                <button type="button" onClick={add} className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                    <Plus size={12} /> Add input
                </button>
            </div>
        </FormRow>
    );
}

/**
 * Agent trigger — the routine is exposed to the model as a function tool
 * (trigger.kind === 'agent_call'). The author declares the tool name, a
 * description the model reads to decide when to call it, and the input
 * parameters (rendered with the same row editor as flowlet inputs, plus an
 * optional per-param description).
 */
function AgentCallFields({ draft, set }) {
    const params = Array.isArray(draft.params) ? draft.params : [];
    const update = (i, patch) => { const next = params.slice(); next[i] = { ...next[i], ...patch }; set('params', next); };
    const add = () => set('params', [...params, { name: `arg${params.length + 1}`, type: 'string', required: false, description: '' }]);
    const remove = (i) => set('params', params.filter((_, idx) => idx !== i));
    return (
        <>
            <FormRow label="Tool name" hint="What the agent calls. Lowercased & sanitized; blank → automation_<id>.">
                <input
                    type="text"
                    value={draft.toolName || ''}
                    onChange={(e) => set('toolName', e.target.value)}
                    placeholder="summarise_inbox"
                    className={inputClass() + ' font-mono'}
                />
            </FormRow>
            <FormRow label="Description" hint="The agent reads this to decide when to call the routine.">
                <textarea
                    value={draft.description || ''}
                    onChange={(e) => set('description', e.target.value)}
                    rows={2}
                    placeholder="Summarise the user's unread email and return the highlights."
                    className={inputClass()}
                />
            </FormRow>
            <FormRow label="Input parameters" hint="Arguments the agent passes. Bind to them in steps as trigger.output.<name>.">
                <div className="space-y-2">
                    {params.length === 0 && <div className="text-[11px] text-[var(--text-tertiary)] italic">No inputs — the agent calls it with no arguments.</div>}
                    {params.map((p, i) => (
                        <div key={i} className="rounded border border-[var(--border-default)] bg-[var(--bg-primary)] p-2 space-y-1.5">
                            <div className="flex items-center gap-1">
                                <input
                                    type="text"
                                    value={p.name || ''}
                                    onChange={(e) => update(i, { name: e.target.value })}
                                    placeholder="name"
                                    className="flex-1 min-w-0 px-2 py-1 text-xs font-mono rounded border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                                />
                                <select
                                    value={p.type || 'string'}
                                    onChange={(e) => update(i, { type: e.target.value })}
                                    className="px-1.5 py-1 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
                                >
                                    <option value="string">string</option>
                                    <option value="number">number</option>
                                    <option value="boolean">boolean</option>
                                    <option value="object">object</option>
                                    <option value="array">array</option>
                                </select>
                                <button type="button" onClick={() => remove(i)} aria-label="Remove parameter" className="shrink-0 p-1 rounded text-[var(--text-tertiary)] hover:text-red-500 hover:bg-[var(--bg-secondary)]">
                                    <Trash2 size={12} />
                                </button>
                            </div>
                            <input
                                type="text"
                                value={p.description || ''}
                                onChange={(e) => update(i, { description: e.target.value })}
                                placeholder="description (helps the agent fill this in)"
                                className="w-full px-2 py-1 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                            />
                            <label className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] cursor-pointer">
                                <input type="checkbox" checked={!!p.required} onChange={(e) => update(i, { required: e.target.checked })} /> required
                            </label>
                        </div>
                    ))}
                    <button type="button" onClick={add} className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                        <Plus size={12} /> Add parameter
                    </button>
                </div>
            </FormRow>
        </>
    );
}

function DateTimeFields({ draft, set, groups, errorSections = new Set() }) {
    const op = draft.op || 'now';
    const needsInput = op !== 'now';
    const needsInput2 = op === 'diff';
    const needsAmount = op === 'addDays' || op === 'addHours' || op === 'addMinutes';
    return (
        <AccordionSection stepType="datetime" sectionKey="config" title="Configuration" defaultOpen forceOpen={errorSections.has('config')}>
            <FormRow label="Operation">
                <select value={op} onChange={(e) => set('op', e.target.value)} className={inputClass()}>
                    <option value="now">Now (current time)</option>
                    <option value="parse">Parse string to ISO</option>
                    <option value="format">Format to string</option>
                    <option value="addDays">Add days</option>
                    <option value="addHours">Add hours</option>
                    <option value="addMinutes">Add minutes</option>
                    <option value="diff">Difference between two dates</option>
                    <option value="extract">Extract part (year/month/...)</option>
                </select>
            </FormRow>
            {needsInput && (
                <FormRow label="Input date" hint="Path to a date value (ISO string or epoch ms).">
                    <RefInput value={draft.input || ''} onChange={(v) => set('input', v)} groups={groups} placeholder="trigger.output.timestamp" />
                </FormRow>
            )}
            {needsInput2 && (
                <FormRow label="Second date" hint="Difference is calculated as input2 − input.">
                    <RefInput value={draft.input2 || ''} onChange={(v) => set('input2', v)} groups={groups} placeholder="trigger.output.endsAt" />
                </FormRow>
            )}
            {needsAmount && (
                <FormRow label="Amount" hint="Positive to add, negative to subtract.">
                    <input type="number" value={draft.amount ?? 0} onChange={(e) => set('amount', Number(e.target.value))} className={inputClass()} />
                </FormRow>
            )}
            {op === 'format' && (
                <FormRow label="Format" hint="Tokens: yyyy, MM, dd, HH, mm, ss.">
                    <input type="text" value={draft.format || ''} onChange={(e) => set('format', e.target.value)} placeholder="yyyy-MM-dd HH:mm" className={inputClass() + ' font-mono'} />
                </FormRow>
            )}
            {op === 'extract' && (
                <FormRow label="Part">
                    <select value={draft.part || 'year'} onChange={(e) => set('part', e.target.value)} className={inputClass()}>
                        <option value="year">year</option>
                        <option value="month">month</option>
                        <option value="day">day</option>
                        <option value="hour">hour</option>
                        <option value="minute">minute</option>
                        <option value="second">second</option>
                        <option value="dayOfWeek">dayOfWeek (0=Sun)</option>
                    </select>
                </FormRow>
            )}
            {op === 'diff' && (
                <FormRow label="Unit">
                    <select value={draft.unit || 'days'} onChange={(e) => set('unit', e.target.value)} className={inputClass()}>
                        <option value="days">days</option>
                        <option value="hours">hours</option>
                        <option value="minutes">minutes</option>
                        <option value="seconds">seconds</option>
                    </select>
                </FormRow>
            )}
        </AccordionSection>
    );
}

function WaitFields({ draft, set, errorSections = new Set() }) {
    return (
        <AccordionSection stepType="wait" sectionKey="config" title="Configuration" defaultOpen forceOpen={errorSections.has('config')}>
            <FormRow label="Seconds" hint="1..86400 (24h max). Dry-run skips the wait.">
                <input
                    type="number"
                    min={1}
                    max={86400}
                    value={draft.seconds ?? 5}
                    onChange={(e) => set('seconds', Number(e.target.value))}
                    className={inputClass()}
                />
            </FormRow>
        </AccordionSection>
    );
}

function StopErrorFields({ draft, set, onFocusField, previewSample, errorSections = new Set() }) {
    return (
        <AccordionSection stepType="stop_error" sectionKey="config" title="Configuration" defaultOpen forceOpen={errorSections.has('config')}>
            <FormRow label="Error message" hint="Surfaced as the run error. Template-interpolated.">
                <TemplateField
                    value={draft.message || ''}
                    onChange={(next) => set('message', next)}
                    rows={3}
                    onFocusField={onFocusField}
                    previewSample={previewSample}
                    placeholder="Budget exceeded by {{steps.calc.output.delta}}"
                />
            </FormRow>
        </AccordionSection>
    );
}

function SwitchFields({ draft, set, onFocusField, previewSample, errorSections = new Set() }) {
    const cases = Array.isArray(draft.cases) ? draft.cases : [];
    const addCase = () => set('cases', [...cases, { name: `case${cases.length + 1}`, value: '' }]);
    const updateCase = (i, patch) => {
        const next = cases.slice();
        next[i] = { ...next[i], ...patch };
        set('cases', next);
    };
    const removeCase = (i) => {
        const next = cases.slice();
        next.splice(i, 1);
        set('cases', next);
    };
    return (
        <>
            <AccordionSection stepType="switch" sectionKey="basics" title="Basics" defaultOpen forceOpen={errorSections.has('basics')}>
                <FormRow label="Expression" hint="Evaluated once; the value is matched against each case below (loose equality).">
                    <ConditionBuilder
                        value={draft.expr || ''}
                        onChange={(next) => set('expr', next)}
                        onFocusField={onFocusField}
                        previewSample={previewSample}
                    />
                </FormRow>
            </AccordionSection>
            <AccordionSection stepType="switch" sectionKey="cases" title="Cases" defaultOpen={cases.length > 0} forceOpen={errorSections.has('cases')}>
            <FormRow label="Cases" hint="First matching case wins. Wire each case's outgoing edge in the canvas.">
                <div className="space-y-2">
                    {cases.length === 0 && (
                        <div className="text-[11px] text-[var(--text-tertiary)] italic">No cases yet — add at least one.</div>
                    )}
                    {cases.map((c, i) => (
                        <div key={i} className="rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] p-2 space-y-1.5">
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="text"
                                    value={c.name || ''}
                                    onChange={(e) => updateCase(i, { name: e.target.value })}
                                    placeholder="case name"
                                    className="flex-1 min-w-0 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded px-2 py-1 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeCase(i)}
                                    className="p-1 rounded text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10"
                                    title="Remove case"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                            <input
                                type="text"
                                value={typeof c.value === 'string' ? c.value : (c.value == null ? '' : String(c.value))}
                                onChange={(e) => updateCase(i, { value: e.target.value })}
                                placeholder="value to match (string or number)"
                                className="w-full bg-[var(--bg-primary)] border border-[var(--border-default)] rounded px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                            />
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={addCase}
                        className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] px-2 py-1 rounded transition"
                    >
                        <Plus size={12} /> Add case
                    </button>
                </div>
            </FormRow>
            </AccordionSection>
            <AccordionSection stepType="switch" sectionKey="advanced" title="Advanced" forceOpen={errorSections.has('advanced')}>
                <FormRow label="Default branch" hint="Optional case name to route to when no other case matches.">
                    <input type="text" value={draft.defaultBranch || ''} onChange={(e) => set('defaultBranch', e.target.value)} placeholder="(no default — unmatched dead-ends)" className={inputClass() + ' font-mono'} />
                </FormRow>
            </AccordionSection>
        </>
    );
}

function CollectionArrayRefField({ draft, set, groups }) {
    // Minimal array-only picker — same look as LoopOverPicker's first
    // section but without the itemVar input (collection ops have no
    // per-element binding; they output a wrapper object).
    const arrayFields = useMemo(() => {
        const out = [];
        for (const g of groups || []) {
            const sample = g.sample;
            if (!sample || typeof sample !== 'object') continue;
            for (const [k, v] of Object.entries(sample)) {
                if (Array.isArray(v)) out.push({ key: k, path: `${g.basePath}.${k}` });
            }
        }
        return out;
    }, [groups]);

    return (
        <FormRow label="Source array" hint="Pick an upstream array (or type a path manually).">
            <div className="space-y-1">
                <input
                    type="text"
                    value={draft.arrayRef || ''}
                    onChange={(e) => set('arrayRef', e.target.value)}
                    placeholder="steps.s1.output.results"
                    className={inputClass() + ' font-mono'}
                />
                {arrayFields.length > 0 && (
                    <div className="rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]/40 divide-y divide-[var(--border-default)]">
                        <div className="px-2 py-1 text-[10px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)]">Arrays detected upstream</div>
                        {arrayFields.map(f => (
                            <button
                                key={f.path}
                                type="button"
                                onClick={() => set('arrayRef', f.path)}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-[var(--bg-secondary)] ${draft.arrayRef === f.path ? 'bg-[var(--bg-secondary)]' : ''}`}
                            >
                                <span className="font-mono text-[var(--text-primary)] truncate">{f.path}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </FormRow>
    );
}

function FilterFields({ draft, set, groups, onFocusField, previewSample, errorSections = new Set() }) {
    return (
        <AccordionSection stepType="filter" sectionKey="config" title="Configuration" defaultOpen forceOpen={errorSections.has('config')}>
            <CollectionArrayRefField draft={draft} set={set} groups={groups} />
            <FormRow label="Keep when" hint="Restricted expression. The current element is bound as `item`, e.g. `item.amount > 1000`.">
                <ConditionBuilder
                    value={draft.expr || ''}
                    onChange={(next) => set('expr', next)}
                    onFocusField={onFocusField}
                    previewSample={previewSample}
                />
            </FormRow>
        </AccordionSection>
    );
}

function LimitFields({ draft, set, groups, errorSections = new Set() }) {
    return (
        <AccordionSection stepType="limit" sectionKey="config" title="Configuration" defaultOpen forceOpen={errorSections.has('config')}>
            <CollectionArrayRefField draft={draft} set={set} groups={groups} />
            <FormRow label="Count">
                <input type="number" min={0} value={draft.count ?? 10} onChange={(e) => set('count', Number(e.target.value))} className={inputClass()} />
            </FormRow>
            <FormRow label="Mode">
                <select value={draft.mode || 'first'} onChange={(e) => set('mode', e.target.value)} className={inputClass()}>
                    <option value="first">First N items</option>
                    <option value="last">Last N items</option>
                </select>
            </FormRow>
        </AccordionSection>
    );
}

function DedupeFields({ draft, set, groups, errorSections = new Set() }) {
    return (
        <AccordionSection stepType="dedupe" sectionKey="config" title="Configuration" defaultOpen forceOpen={errorSections.has('config')}>
            <CollectionArrayRefField draft={draft} set={set} groups={groups} />
            <FormRow label="Key field" hint="Optional. Without it, items are compared by deep equality.">
                <input type="text" value={draft.keyField || ''} onChange={(e) => set('keyField', e.target.value)} placeholder="id" className={inputClass() + ' font-mono'} />
            </FormRow>
        </AccordionSection>
    );
}

function AggregateFields({ draft, set, groups, errorSections = new Set() }) {
    return (
        <AccordionSection stepType="aggregate" sectionKey="config" title="Configuration" defaultOpen forceOpen={errorSections.has('config')}>
            <CollectionArrayRefField draft={draft} set={set} groups={groups} />
            <FormRow label="Field" hint="Field to read from every item — output.values is the flat list.">
                <input type="text" value={draft.field || ''} onChange={(e) => set('field', e.target.value)} placeholder="email" className={inputClass() + ' font-mono'} />
            </FormRow>
        </AccordionSection>
    );
}

function SummarizeFields({ draft, set, groups, errorSections = new Set() }) {
    return (
        <AccordionSection stepType="summarize" sectionKey="config" title="Configuration" defaultOpen forceOpen={errorSections.has('config')}>
            <CollectionArrayRefField draft={draft} set={set} groups={groups} />
            <FormRow label="Field">
                <input type="text" value={draft.field || ''} onChange={(e) => set('field', e.target.value)} placeholder="amount" className={inputClass() + ' font-mono'} />
            </FormRow>
            <FormRow label="Operator">
                <select value={draft.op || 'sum'} onChange={(e) => set('op', e.target.value)} className={inputClass()}>
                    <option value="sum">sum</option>
                    <option value="count">count (length of array)</option>
                    <option value="avg">average</option>
                    <option value="min">min</option>
                    <option value="max">max</option>
                </select>
            </FormRow>
        </AccordionSection>
    );
}

/**
 * Plain ref-path input with a one-click "browse variables" hint. Keeps
 * the inspector consistent for fields that take a single path (no fx
 * toggle, no template interpolation, like DateTime's input refs).
 */
function RefInput({ value, onChange, groups, placeholder }) {
    return (
        <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || 'trigger.output.<field>'}
            className={inputClass() + ' font-mono'}
            // Suppress unused-var warning on `groups`; reserved for a
            // future inline picker UI.
            data-groups-count={groups?.length || 0}
        />
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

function StructuredOutputFields({ fields, onChange }) {
    const update = (i, partial) => {
        const next = fields.slice();
        next[i] = { ...next[i], ...partial };
        onChange(next);
    };
    const remove = (i) => {
        const next = fields.slice();
        next.splice(i, 1);
        onChange(next);
    };
    const add = () => {
        const baseName = 'field';
        const taken = new Set(fields.map(f => f.key));
        let name = baseName, i = 1;
        while (taken.has(name)) name = `${baseName}${++i}`;
        onChange([...fields, { key: name, type: 'string', description: '' }]);
    };

    return (
        <div className="space-y-2">
            {fields.length === 0 && (
                <div className="text-[11px] text-[var(--text-tertiary)] italic">
                    No fields yet — the AI will return free-form text. Add fields to get a structured JSON response.
                </div>
            )}
            {fields.map((f, i) => (
                <div key={i} className="rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] p-2 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                        <input
                            type="text"
                            value={f.key || ''}
                            onChange={(e) => update(i, { key: e.target.value })}
                            placeholder="fieldName"
                            className="flex-1 min-w-0 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded px-2 py-1 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                        />
                        <select
                            value={f.type || 'string'}
                            onChange={(e) => update(i, { type: e.target.value })}
                            className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded px-1.5 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
                        >
                            {OUTPUT_FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <button
                            type="button"
                            onClick={() => remove(i)}
                            className="p-1 rounded text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10"
                            title="Remove field"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                    <input
                        type="text"
                        value={f.description || ''}
                        onChange={(e) => update(i, { description: e.target.value })}
                        placeholder="Description (optional) — guides the model on what to put here"
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-default)] rounded px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                    {f.type === 'array' && (
                        <ColumnsEditor
                            columns={f.columns || []}
                            onChange={(next) => update(i, { columns: next })}
                        />
                    )}
                </div>
            ))}
            <button
                type="button"
                onClick={add}
                className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] px-2 py-1 rounded transition"
            >
                <Plus size={12} /> Add output field
            </button>
        </div>
    );
}

// Column editor for a table (array-of-objects) output field. Each column is a
// { key, type } pair; together they become the array item's typed properties,
// so the model returns rows the Output panel renders as a real table. With no
// columns the array stays free-form (the model infers the shape).
function ColumnsEditor({ columns, onChange }) {
    const update = (i, partial) => {
        const next = columns.slice();
        next[i] = { ...next[i], ...partial };
        onChange(next);
    };
    const remove = (i) => {
        const next = columns.slice();
        next.splice(i, 1);
        onChange(next);
    };
    const add = () => {
        const taken = new Set(columns.map(c => c.key));
        let name = 'column', i = 1;
        while (taken.has(name)) name = `column${++i}`;
        onChange([...columns, { key: name, type: 'string' }]);
    };
    // Reorder a column — the schema (and therefore the output table) follows
    // this order, so up/down lets the user arrange the headers.
    const move = (i, dir) => {
        const j = i + dir;
        if (j < 0 || j >= columns.length) return;
        const next = columns.slice();
        [next[i], next[j]] = [next[j], next[i]];
        onChange(next);
    };

    return (
        <div className="mt-1 rounded border border-dashed border-[var(--border-default)] p-2 space-y-1.5">
            <div className="text-[10px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)]">
                Columns
            </div>
            {columns.length === 0 && (
                <div className="text-[11px] text-[var(--text-tertiary)] italic">
                    No columns — the AI infers the table shape. Add columns to fix the headers, their types, and order.
                </div>
            )}
            {columns.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5">
                    <div className="flex flex-col -my-0.5">
                        <button
                            type="button"
                            onClick={() => move(i, -1)}
                            disabled={i === 0}
                            className="p-0.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move up"
                            aria-label="Move column up"
                        >
                            <ChevronUp size={11} />
                        </button>
                        <button
                            type="button"
                            onClick={() => move(i, 1)}
                            disabled={i === columns.length - 1}
                            className="p-0.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move down"
                            aria-label="Move column down"
                        >
                            <ChevronDown size={11} />
                        </button>
                    </div>
                    <input
                        type="text"
                        value={c.key || ''}
                        onChange={(e) => update(i, { key: e.target.value })}
                        placeholder="columnName"
                        className="flex-1 min-w-0 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded px-2 py-1 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                    <select
                        value={c.type || 'string'}
                        onChange={(e) => update(i, { type: e.target.value })}
                        className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded px-1.5 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
                    >
                        {COLUMN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button
                        type="button"
                        onClick={() => remove(i)}
                        className="p-1 rounded text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10"
                        title="Remove column"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            ))}
            <button
                type="button"
                onClick={add}
                className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] px-2 py-1 rounded transition"
            >
                <Plus size={12} /> Add column
            </button>
        </div>
    );
}

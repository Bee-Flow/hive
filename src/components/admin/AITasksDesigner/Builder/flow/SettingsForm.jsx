import { Save, RotateCcw, Plus, Trash2, Sparkles, Repeat, ChevronUp, ChevronDown, Workflow, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import AccordionSection from './AccordionSection';
import NodePurpose from './settings/NodePurpose';
import { WAIT_UNIT_FACTOR, clampWaitSeconds, waitUnitFor } from './waitDuration';
import CallContractFields from './CallContractFields';
import ChannelPills from '../ChannelPills';
import { normalizeChannels, stepChannelsToUi } from '../notificationDefaults';
import { humanizeToolName, humanizeFieldKey } from './displayHelpers';
import FieldHint from './FieldHint';
import { getLayerContract } from './flowletScope';
import { isPrivacyStep, readPrivacy, PRIVACY_MODES, modeScans, modeBranches, modeHides, droppedEdgesOnModeChange } from './privacyModel';
import ScheduleBuilder from './ScheduleBuilder';
import TriggerProviderPicker from './TriggerProviderPicker';
import { getIntegrationIcon } from '../../../../../config/integrationIcons';
import { sectionsWithErrors } from './sectionForIssue';
import { useFormDensity } from './settings/formDensity';
import { inputClass, textareaClass, rowInputClass, cardClass, subLabelClass, controlSurfaceClass, FormRow, ValidationLine } from './settings/formPrimitives';
import HttpAuthPicker from './settings/HttpAuthPicker';
import ParseJsonFields, { parseSampleSource, suggestFieldName } from './settings/ParseJsonFields';
import SetOperationsEditor from './settings/SetOperationsEditor';
import { convertValue, defaultLabelPlaceholder, extractFormState, buildPatch, deepEqual, OUTPUT_FIELD_TYPES, COLUMN_TYPES } from './settings/formState';
import { IconPicker } from './stepIcons';
import ToolPicker from './ToolPicker';
import { isRouteStep, readRoute, uniqueRuleName } from './routeModel';
import { defaultTriggerLabel, isGeneratedTriggerLabel } from './triggerLabels';
import { paramsToSchema, schemaToParams } from './triggerSchemaUtils';
import useInputMapping from './useInputMapping';
import TriggerWebhookPanel from '../webhooks/TriggerWebhookPanel';
import FormTriggerFields from './settings/FormTriggerFields';
import FormBuilderFields, { defaultFormPageDeclaration, defaultFormEndingDeclaration } from './settings/FormBuilderFields';
import useAutomationApi from '../../../../../hooks/useAutomationApi';
import { useTranslation } from '../../../../../hooks/useTranslation';
// The SAME category list the Org Shield editor shows — a guard step offering
// a different set from the policy it narrows would be its own bug.
import { piiCategoriesLocalized } from '../../../../../config/piiCategories';
import { API_BASE, authFetch } from '../../../../../utils/helpers';
import { walkPath } from '../../../../../utils/bindingHelpers';
import { tierLabel, configuredTierKeys } from '../../../../tierMeta';
import { autoMapInputs } from '../mapping/autoMapInputs';
import ConditionBuilder from '../mapping/ConditionBuilder';
import FieldKeyCombobox from '../mapping/FieldKeyCombobox';
import LoopBodyEditor from '../mapping/LoopBodyEditor';
import LoopOverPicker from '../mapping/LoopOverPicker';
import JsonTreePicker from '../mapping/JsonTreePicker';
import PathField from '../mapping/PathField';
import TemplateField from '../mapping/TemplateField';
import ToolInputForm from '../mapping/ToolInputForm';
import { collectArrayPaths, resolveElementSample, elementFieldOptions, sampleToFields } from '../mapping/upstream';
import { VariablePickerProvider, useVariablePickerContext } from '../mapping/VariablePickerContext';
import { inferType } from '../utils/conditionModel';
export { schemaToFields, fieldsToSchema } from './settings/formState';
import { FILTER_FORM_BY_KEY } from './settings/triggerFilters';

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
    // The persisted automation row. Only the webhook trigger uses it, to show
    // that node's inbound URL inline instead of burying it in Settings
    // (BFSF-320). Null until the routine has been saved once.
    automation = null,
    // Published Steps catalog [{id,title,params,outputFields}] — CallStepFields
    // derives an external Step's contract from this (the Step lives in another
    // row, so there's no local layers entry to read).
    blocksCatalog = [],
    // For a switch node: the case names that currently have an outgoing edge
    // on the canvas (NodeDetailView derives it from definition.edges). The
    // Cases editor uses it to tell the user a rename keeps the connection and
    // a removal drops it (node-audit B1).
    wiredCaseNames = null,
    // This step's outgoing edges — the Privacy Shield mode selector needs them
    // to say which connections a mode switch would cost before it happens.
    stepEdges = [],
    // True when the edited node lives in definition.triggers[] (a SECONDARY
    // trigger) — only webhook/app_event are legal there, so the kind <select>
    // must not offer the four kinds the validator hard-rejects (C7).
    isSecondaryTrigger = false,
    // Optional host content for the left of the action bar. The quick NDV puts
    // its "In … → Out …" summary here so the dialog ends in one footer instead
    // of stacking a second chrome bar underneath this one. Null everywhere
    // else, including the SettingsForm nested inside a loop body.
    footerLeft = null,
    // (stepId) => void — open this step's contents on the canvas instead.
    // Only a Loop uses it today; supplied by BuildTab, absent everywhere the
    // canvas is not in view (the nested form inside LoopBodyEditor, tests), and
    // the button is simply not rendered then.
    onExpandOnCanvas = null,
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
    const { density } = useFormDensity();

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

            {/* space-y-4 between sections against space-y-2.5 within one (the
                rail in CollapsibleSection) — grouping by proximity, which the
                surface tokens are too close together to carry on their own. */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 space-y-4">
                {/* Above the name field on purpose: "what is this step" comes
                    before "what shall I call it". Shown at BOTH densities —
                    the quick view is where a first-time author lands, and it
                    is the one place in the builder that can afford to say. */}
                <NodePurpose step={step} />

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
                            aria-label="Step name"
                            className={inputClass() + ' flex-1'}
                        />
                    </div>
                </FormRow>

                {step.type === 'trigger' && (
                    <TriggerFields draft={draft} set={set} setNested={setNested} errorSections={errorSections} catalog={catalog} automation={automation} stepId={step.id} isSecondaryTrigger={isSecondaryTrigger} />
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

                {/* If / Switch / Filter (route) / Filter (collection) are one
                    node with one editor — see flow/routeModel.js. */}
                {isRouteStep(step) && (
                    <RouteFields
                        step={step} draft={draft} set={set} groups={groups}
                        onFocusField={onFocusField} previewSample={previewSample}
                        errorSections={errorSections} wiredCaseNames={wiredCaseNames}
                    />
                )}

                {step.type === 'loop' && (
                    <LoopFields
                        draft={draft} set={set}
                        groups={groups} onFocusField={onFocusField}
                        previewSample={previewSample} catalog={catalog}
                        modelTiers={modelTiers} rootDefinition={rootDefinition}
                        blocksCatalog={blocksCatalog}
                        errorSections={errorSections}
                        onExpandOnCanvas={onExpandOnCanvas ? () => onExpandOnCanvas(step.id) : null}
                    />
                )}

                {step.type === 'code' && (
                    <CodeFields draft={draft} set={set} groups={groups} onFocusField={onFocusField} errorSections={errorSections} />
                )}

                {step.type === 'notification' && (
                    <NotificationFields
                        draft={draft} set={set} groups={groups}
                        onFocusField={onFocusField} previewSample={previewSample}
                        errorSections={errorSections}
                    />
                )}

                {step.type === 'http_request' && (
                    <HttpRequestFields
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
                    <SetFields step={step} draft={draft} set={set} groups={groups} onFocusField={onFocusField} previewSample={previewSample} errorSections={errorSections} />
                )}
                {step.type === 'parse_json' && (
                    <ParseJsonFields step={step} draft={draft} set={set} groups={groups} onFocusField={onFocusField} previewSample={previewSample} errorSections={errorSections} />
                )}
                {step.type === 'datetime' && (
                    <DateTimeFields draft={draft} set={set} onFocusField={onFocusField} previewSample={previewSample} errorSections={errorSections} />
                )}
                {step.type === 'wait' && (
                    <WaitFields draft={draft} set={set} errorSections={errorSections} />
                )}
                {isPrivacyStep(step) && (
                    <PrivacyShieldFields
                        step={step} draft={draft} set={set} groups={groups}
                        onFocusField={onFocusField} previewSample={previewSample}
                        errorSections={errorSections} stepEdges={stepEdges}
                    />
                )}
                {step.type === 'stop_error' && (
                    <StopErrorFields draft={draft} set={set} onFocusField={onFocusField} previewSample={previewSample} errorSections={errorSections} />
                )}
                {step.type === 'form_page' && (
                    <FormPageFields draft={draft} set={set} stepId={step.id} onFocusField={onFocusField} previewSample={previewSample} errorSections={errorSections} />
                )}
                {step.type === 'limit' && (
                    <LimitFields draft={draft} set={set} groups={groups} onFocusField={onFocusField} previewSample={previewSample} errorSections={errorSections} />
                )}
                {step.type === 'dedupe' && (
                    <DedupeFields draft={draft} set={set} groups={groups} onFocusField={onFocusField} previewSample={previewSample} errorSections={errorSections} />
                )}
                {step.type === 'aggregate' && (
                    <AggregateFields draft={draft} set={set} groups={groups} onFocusField={onFocusField} previewSample={previewSample} errorSections={errorSections} />
                )}
                {step.type === 'summarize' && (
                    <SummarizeFields draft={draft} set={set} groups={groups} onFocusField={onFocusField} previewSample={previewSample} errorSections={errorSections} />
                )}

                {/* Not in the quick view: that panel's whole point is that it
                    doesn't talk about JSON. Its own "More options" button is
                    the way deeper. */}
                {density !== 'quick' && (
                    <div className="text-[11px] text-[var(--text-tertiary)]">
                        Advanced options are available in the JSON view.
                    </div>
                )}
            </div>

            {saveError && (
                <div className="flex-shrink-0 px-3 py-2 text-xs text-red-600 dark:text-red-400 border-t border-[var(--border-default)] bg-red-500/5">
                    {saveError}
                </div>
            )}
            <div className="flex-shrink-0 flex items-center gap-3 px-3 py-2 border-t border-[var(--border-default)] bg-[var(--bg-secondary)] text-[11px]">
                {footerLeft}
                <div className="ml-auto flex items-center gap-2">
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
                        className="flex items-center gap-1.5 px-3 py-1 text-xs rounded bg-[var(--accent)] text-[var(--accent-primary-fg,#ffffff)] hover:opacity-90 disabled:opacity-40 transition"
                    >
                        <Save size={12} /> {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Per-type field groups ──────────────────────────────────────────────

function TriggerFields({ draft, set, setNested, errorSections = new Set(), catalog = null, automation = null, stepId = null, isSecondaryTrigger = false }) {
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
    const hasKindForm = kind === 'agent_call' || kind === 'schedule' || kind === 'app_event' || kind === 'app_trigger' || kind === 'webhook' || kind === 'form';
    const kindTitle = kind === 'agent_call' ? 'Agent tool'
        : kind === 'schedule' ? 'Schedule'
        : kind === 'app_trigger' ? 'App inputs'
        : kind === 'webhook' ? 'Endpoint'
        : kind === 'form' ? 'Form'
        : 'Event';
    return (
        <>
            <FormRow label="Trigger kind" hint={isSecondaryTrigger ? 'Additional triggers can only be webhooks or app events — schedule/manual can only be the primary trigger.' : undefined}>
                <select
                    value={kind}
                    onChange={(e) => {
                        const next = e.target.value;
                        // Rename the node along with its kind unless the user
                        // named it by hand. Without this the canvas node and
                        // this modal's own header both kept reading "Manual"
                        // after a switch to Schedule (BFSF-339).
                        if (isGeneratedTriggerLabel(draft.label)) set('label', defaultTriggerLabel(next));
                        set('kind', next);
                    }}
                    className={inputClass()}
                >
                    {/* A SECONDARY trigger (definition.triggers[]) may only be
                        webhook/app_event — the validator hard-rejects the other
                        four kinds there, so offering them made every pick fail
                        the save with a confusing error (C7). A legacy invalid
                        kind stays visible-but-disabled: opening the panel must
                        never silently change routing. */}
                    {!isSecondaryTrigger && <option value="manual">Manual — runs only when you click Run</option>}
                    {!isSecondaryTrigger && <option value="form">Form — a public page people fill in</option>}
                    {!isSecondaryTrigger && <option value="schedule">Schedule — runs on a timer</option>}
                    <option value="webhook">Webhook — inbound HTTPS POST</option>
                    <option value="app_event">App event — e.g. new Gmail email</option>
                    {!isSecondaryTrigger && <option value="agent_call">Agent — callable from chat</option>}
                    {!isSecondaryTrigger && <option value="app_trigger">Studio App — called by an app action</option>}
                    {isSecondaryTrigger && kind !== 'webhook' && kind !== 'app_event' && (
                        <option value={kind} disabled>(unsupported here) {kind}</option>
                    )}
                </select>
            </FormRow>
            {hasKindForm && (
                <AccordionSection stepType="trigger" sectionKey="config" title={kindTitle} defaultOpen forceOpen={errorSections.has('config')}>
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
                        <AppEventFields draft={draft} set={set} setNested={setNested} catalog={catalog} />
                    )}
                    {kind === 'app_trigger' && (
                        <AppTriggerFields draft={draft} set={set} />
                    )}
                    {kind === 'webhook' && (
                        <TriggerWebhookPanel automation={automation} stepId={stepId} />
                    )}
                    {kind === 'form' && (
                        <FormTriggerFields draft={draft} set={set} automation={automation} stepId={stepId} />
                    )}
                </AccordionSection>
            )}
        </>
    );
}

// Labels for providers that can appear in SAVED configs but are absent from
// the dynamic catalog list (hidden, e.g. github; or availability revoked).
// Fallback for anything else: the raw id. Never used to LIST a provider.
const LEGACY_PROVIDER_LABELS = {
    'gmail': 'Gmail',
    'google-calendar': 'Google Calendar',
    'google-drive': 'Google Drive',
    'nextcloud': 'Nextcloud',
    'ticket-assistant': 'Ticket Assistant',
    'support': 'Support Inbox',
    'msgraph': 'Microsoft 365 (Outlook)',
    'github': 'GitHub',
};

/**
 * Provider + event selects with per-event filter sub-form. The provider list
 * is dynamic — only providers the backend catalog reports as available to
 * this user. A configured-but-unlisted provider renders as a preserved
 * "(not available)" option and is never blanked or mutated. Switching the
 * provider auto-snaps the event to that provider's default AND clears the
 * filter — different events have incompatible filter shapes, so carrying old
 * fields over would just produce validation warnings.
 */
function AppEventFields({ draft, set, setNested, catalog = null }) {
    // Normalizer: tolerate a stale/cached backend that still serves string[].
    const rawProviders = catalog?.triggers?.find(t => t.kind === 'app_event')?.providers || [];
    const providerDefs = rawProviders.map(p =>
        typeof p === 'string' ? { id: p, label: p, defaultEvent: '', events: [] } : p);

    const [pickerOpen, setPickerOpen] = useState(false);
    const provider = draft.appProvider || '';
    const currentDef = providerDefs.find(p => p.id === provider) || null;
    const events = currentDef?.events || [];
    const event = draft.appEventName || currentDef?.defaultEvent || '';
    const knownEvent = events.some(ev => ev.id === event);
    const selectedEvent = events.find(ev => ev.id === event) || null;

    const onProviderChange = (next) => {
        const def = providerDefs.find(p => p.id === next);
        set('appProvider', next);
        set('appEventName', def?.defaultEvent || def?.events?.[0]?.id || '');
        set('filter', {});
    };
    const onEventChange = (next) => {
        set('appEventName', next);
        set('filter', {});
    };

    // One-shot auto-snap: a fresh trigger starts with no provider; pick the
    // first available one once the catalog is present. Ref-guarded so a
    // subsequent manual clear-to-'' can't retrigger it.
    const snappedRef = useRef(false);
    useEffect(() => {
        if (snappedRef.current) return;
        if (!draft.appProvider && providerDefs.length > 0) {
            snappedRef.current = true;
            onProviderChange(providerDefs[0].id);
        }
    });

    if (!provider && providerDefs.length === 0) {
        return (
            <div className="text-[11px] text-[var(--text-tertiary)] leading-snug">
                No event sources are available to you yet. Connect an app (e.g. Gmail or Nextcloud) in Settings → Integrations first.
            </div>
        );
    }

    const providerListed = !!currentDef;
    const setF = (k, v) => setNested('filter', k, v);
    const filter = draft.filter || {};
    const FilterForm = FILTER_FORM_BY_KEY[`${provider}.${event}`] || null;

    return (
        <>
            <FormRow label="App">
                {/* An app picker rather than a dropdown of ids: same overlay the
                    agent editor uses, so it carries the app's logo and shows
                    what that app can trigger on before you commit to it. */}
                <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    aria-label="Choose the app to trigger on"
                    className={`${inputClass()} flex items-center gap-2 text-left hover:bg-[var(--bg-tertiary)]`}
                >
                    {provider && (
                        <span className="w-5 h-5 flex items-center justify-center shrink-0">{getIntegrationIcon(provider)}</span>
                    )}
                    <span className="truncate flex-1">
                        {provider
                            ? (currentDef?.label || LEGACY_PROVIDER_LABELS[provider] || provider)
                            : 'Choose an app…'}
                        {provider && !providerListed && ' (not available)'}
                    </span>
                    <ChevronDown size={14} className="shrink-0 text-[var(--text-tertiary)]" />
                </button>
                {pickerOpen && (
                    <TriggerProviderPicker
                        providers={providerDefs}
                        selected={provider}
                        onPick={onProviderChange}
                        onClose={() => setPickerOpen(false)}
                    />
                )}
                {provider && !providerListed && (
                    <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 leading-snug">
                        This app isn't available to you right now (integration not connected or not permitted for your account). The trigger is kept as configured, but it may not fire.
                    </div>
                )}
            </FormRow>
            <FormRow label="Event">
                <select value={event} onChange={(e) => onEventChange(e.target.value)} className={inputClass()}>
                    {event && !knownEvent && (
                        <option value={event}>{event}{providerListed ? ' (unknown event)' : ''}</option>
                    )}
                    {events.map(ev => (
                        <option key={ev.id} value={ev.id}>{ev.label}</option>
                    ))}
                </select>
            </FormRow>
            {/* The explanation travels with the event that needs it — this used
                to name Nextcloud regardless of which provider was selected. */}
            {selectedEvent?.deliverability === 'connector' && (
                <div className="text-[11px] text-amber-600 dark:text-amber-400 leading-snug">
                    {selectedEvent.deliverabilityNote
                        || 'This event needs an extra connector that isn’t available yet — it will not fire.'}
                </div>
            )}

            {FilterForm && <FilterForm filter={filter} setFilter={setF} />}
        </>
    );
}

function AiStepFields({ draft, set, modelTiers, catalog = null, groups = [], onFocusField, previewSample, errorSections = new Set() }) {
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
            {/* AccordionSection, not a bare CollapsibleSection: only the former
                honours the quick/full density, and this block (system prompt,
                model tier, tool allowlist) is the definition of "advanced".
                Cost of the switch is one reset collapse preference. */}
            <AccordionSection stepType="ai_step" sectionKey="advanced" title="Advanced" forceOpen={errorSections.has('advanced')}>
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
            </AccordionSection>
            {/* The band already names the section, so the field inside it
                carries only its hint — repeating the name read as two
                headings stacked on each other. */}
            <AccordionSection
                stepType="ai_step" sectionKey="inputs" title="Inputs"
                defaultOpen={hasInputs} forceOpen={errorSections.has('inputs')}
                meta={<FieldHint title="About Inputs">Named values the AI can read alongside the prompt. Mention a name in the prompt to use it.</FieldHint>}
            >
                <ToolInputForm
                    inputs={draft.inputs || {}}
                    onChange={(next) => set('inputs', next)}
                    inputSchema={null}
                    onFocusField={onFocusField}
                    previewSample={previewSample}
                />
            </AccordionSection>
            <AccordionSection
                stepType="ai_step" sectionKey="output" title="Structured output"
                defaultOpen={hasOutput} forceOpen={errorSections.has('output')}
                meta={<FieldHint title="About Structured output">Define the JSON fields the AI should return. Downstream steps can then reference them by name. Leave empty for free-form text.</FieldHint>}
            >
                <StructuredOutputFields
                    fields={draft.outputFields || []}
                    onChange={(next) => set('outputFields', next)}
                />
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
            {/* meta is titled "About Inputs", not "Inputs": Info derives its
                aria-label from the title, and the band's own toggle button is
                already named after the section. */}
            <AccordionSection
                stepType="integration_action" sectionKey="inputs" title="Inputs"
                defaultOpen forceOpen={errorSections.has('inputs')}
                meta={<FieldHint title="About Inputs">{inputSchema ? 'Field values passed to the tool. Pick a variable from the right panel to bind upstream output.' : 'No schema found for this tool — using generic key/value rows.'}</FieldHint>}
            >
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

function LoopFields({
    draft, set, groups, onFocusField, previewSample, catalog, modelTiers,
    rootDefinition, blocksCatalog, errorSections = new Set(), onExpandOnCanvas = null,
}) {
    return (
        <>
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
                <FormRow label="Batch size" hint="Items per iteration. 1 = one at a time; higher values bind an ARRAY of that many items to loop.<name> instead of a single item.">
                    <input type="number" min={1} max={1000} value={draft.batchSize ?? 1} onChange={(e) => set('batchSize', Number(e.target.value))} className={inputClass()} />
                </FormRow>
                <FormRow label="Max iterations" hint="Safety cap. 1–1000.">
                    <input type="number" min={1} max={1000} value={draft.maxIterations ?? 100} onChange={(e) => set('maxIterations', Number(e.target.value))} className={inputClass()} />
                </FormRow>
            </AccordionSection>
            <AccordionSection stepType="loop" sectionKey="body" title="Steps inside the loop" defaultOpen forceOpen={errorSections.has('body')}>
                {/* Nothing here used to say the body is SEQUENTIAL, and the
                    list's up/down arrows are the only hint that order matters
                    at all. It does: the runtime chains these steps and runs
                    them top to bottom for each item (engine.js). */}
                <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-[11px] text-[var(--text-tertiary)]">
                        These run once per item, top to bottom.
                    </p>
                    {onExpandOnCanvas && (
                        <button
                            type="button"
                            onClick={onExpandOnCanvas}
                            title="Open these steps on the canvas, inside the loop"
                            className="shrink-0 inline-flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline"
                        >
                            <Workflow size={11} /> Edit on canvas
                        </button>
                    )}
                </div>
                <LoopBodyEditor
                    loopStep={draft}
                    onChange={(nextBody) => set('body', nextBody)}
                    outerGroups={groups}
                    previewSample={previewSample}
                    catalog={catalog}
                    modelTiers={modelTiers}
                    rootDefinition={rootDefinition}
                    blocksCatalog={blocksCatalog}
                    onFocusField={onFocusField}
                />
            </AccordionSection>
        </>
    );
}

function CodeFields({ draft, set, groups = [], onFocusField = null, errorSections = new Set() }) {
    return (
        <>
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
            {/* Run-once-per-item: the runner + validator have always allowed
                forEach here, but only integration_action had the editor —
                a code step's fan-out was set-once-by-auto-map, then invisible
                and unremovable (C16/C18). */}
            <AccordionSection stepType="code" sectionKey="advanced" title="Advanced" defaultOpen={!!draft.forEach} forceOpen={errorSections.has('advanced')}>
                <ForEachSection draft={draft} set={set} groups={groups} onFocusField={onFocusField} />
            </AccordionSection>
        </>
    );
}

function NotificationFields({ draft, set, groups = [], onFocusField, previewSample, errorSections = new Set() }) {
    return (
        <>
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
            {/* Where it goes. The runner has honoured `channels` all along but
                nothing ever showed it, so the step could say what to send and
                never where — and email was reachable only via the JSON tab
                (BFSF-350). */}
            <FormRow label="Send to">
                <ChannelPills
                    caption={null}
                    channels={stepChannelsToUi(draft.channels)}
                    onToggle={(key) => {
                        const cur = stepChannelsToUi(draft.channels);
                        const next = cur.includes(key) ? cur.filter(c => c !== key) : [...cur, key];
                        set('channels', normalizeChannels(next));
                    }}
                />
                {/* Stated in the open, not behind a hint icon: "where does this
                    even go?" was the whole of the report. */}
                <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                    In-app lands in the Bee Flow notification centre — the bell in the top bar.
                    Email goes to the person this routine belongs to.
                </div>
            </FormRow>
            </AccordionSection>
            <AccordionSection stepType="notification" sectionKey="advanced" title="Advanced" defaultOpen={!!draft.forEach} forceOpen={errorSections.has('advanced')}>
                <ForEachSection draft={draft} set={set} groups={groups} onFocusField={onFocusField} />
            </AccordionSection>
        </>
    );
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'];
const HTTP_WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function HttpRequestFields({ draft, set, onFocusField, previewSample, errorSections = new Set() }) {
    const method = (draft.method || 'GET').toUpperCase();
    const headers = draft.headers || {};
    const headerEntries = Object.entries(headers);
    const blockPrivateTargets = draft.blockPrivateTargets !== false;

    const renameHeader = (oldKey, newKey) => {
        if (!newKey || newKey === oldKey) return;
        const next = {};
        for (const [k, v] of headerEntries) next[k === oldKey ? newKey : k] = v;
        set('headers', next);
    };
    const setHeaderValue = (key, value) => set('headers', { ...headers, [key]: value });
    const removeHeader = (key) => {
        const next = { ...headers };
        delete next[key];
        set('headers', next);
    };
    const addHeader = () => {
        let name = 'Header';
        let i = 1;
        while (Object.prototype.hasOwnProperty.call(headers, name)) name = `Header-${i++}`;
        set('headers', { ...headers, [name]: '' });
    };

    return (
        <>
            <AccordionSection stepType="http_request" sectionKey="request" title="Request" defaultOpen forceOpen={errorSections.has('request')}>
                <FormRow label="URL" hint="Click a value in the right panel to insert it, e.g. https://api.example.com/users/{{trigger.output.id}}.">
                    <TemplateField
                        value={draft.url || ''}
                        onChange={(next) => set('url', next)}
                        rows={1}
                        onFocusField={onFocusField}
                        previewSample={previewSample}
                        placeholder="https://api.example.com/endpoint"
                    />
                </FormRow>
                <FormRow label="Method">
                    <select value={method} onChange={(e) => set('method', e.target.value)} className={inputClass()}>
                        {HTTP_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </FormRow>
            </AccordionSection>

            <AccordionSection
                stepType="http_request"
                sectionKey="auth"
                title="Authentication"
                defaultOpen={!!(draft.auth && draft.auth.connectionId)}
                forceOpen={errorSections.has('auth')}
            >
                <FormRow label="Credential">
                    <HttpAuthPicker
                        value={draft.auth?.connectionId || ''}
                        onChange={(connectionId) => set('auth', connectionId ? { connectionId } : null)}
                    />
                </FormRow>
            </AccordionSection>

            <AccordionSection stepType="http_request" sectionKey="headers" title="Headers" forceOpen={errorSections.has('headers')}>
                {headerEntries.length === 0 && (
                    <div className="text-xs text-[var(--text-tertiary)] italic mb-2">No headers set.</div>
                )}
                {headerEntries.map(([key, value]) => (
                    <div key={key} className="flex items-start gap-2 mb-2">
                        <input
                            type="text"
                            defaultValue={key}
                            onBlur={(e) => renameHeader(key, e.target.value)}
                            className={inputClass() + ' w-36 shrink-0 font-mono'}
                            placeholder="Header-Name"
                        />
                        <div className="flex-1">
                            <TemplateField
                                value={value}
                                onChange={(next) => setHeaderValue(key, next)}
                                rows={1}
                                onFocusField={onFocusField}
                                previewSample={previewSample}
                                placeholder="value"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => removeHeader(key)}
                            title="Remove header"
                            className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-red-500 hover:bg-[var(--bg-tertiary)] transition"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ))}
                <button
                    type="button"
                    onClick={addHeader}
                    className="flex items-center gap-1 text-xs text-[var(--accent)] hover:opacity-80 transition"
                >
                    <Plus size={12} /> Add header
                </button>
            </AccordionSection>

            {HTTP_WRITE_METHODS.has(method) && (
                <AccordionSection stepType="http_request" sectionKey="body" title="Body" forceOpen={errorSections.has('body')}>
                    <FormRow label="Body" hint="Raw text or JSON. Click a value in the right panel to insert it.">
                        <TemplateField
                            value={draft.body || ''}
                            onChange={(next) => set('body', next)}
                            rows={6}
                            onFocusField={onFocusField}
                            previewSample={previewSample}
                            placeholder={'{"key": "{{trigger.output.value}}"}'}
                        />
                    </FormRow>
                </AccordionSection>
            )}

            <AccordionSection stepType="http_request" sectionKey="options" title="Options" forceOpen={errorSections.has('options')}>
                <FormRow label="Timeout (ms)">
                    <input
                        type="number"
                        min={1000}
                        max={60_000}
                        step={500}
                        value={draft.timeoutMs ?? 10_000}
                        onChange={(e) => set('timeoutMs', Number(e.target.value))}
                        className={inputClass()}
                    />
                </FormRow>
                <FormRow label="Security">
                    <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                        <input
                            type="checkbox"
                            checked={blockPrivateTargets}
                            onChange={(e) => set('blockPrivateTargets', e.target.checked)}
                        />
                        Block requests to private/internal network addresses
                    </label>
                    <div className="text-xs text-[var(--text-tertiary)] mt-1">
                        Recommended: on. Only turn this off if this step specifically needs to reach an
                        internal service (e.g. on your own self-hosted network) — disabling it lets this
                        step reach localhost, private IP ranges, and cloud metadata endpoints.
                    </div>
                </FormRow>
            </AccordionSection>
        </>
    );
}

// ── n8n-style utility node forms ──────────────────────────────────────

/**
 * Shared "fields" section for the two `draft.fields`-backed editors (`set`
 * and `layer_output`): a keep-empty ToolInputForm inside an AccordionSection.
 * Only the stepType, title/label, and hint differ.
 */
function FieldsSection({
    draft, set, stepType, title, hint, onFocusField, previewSample,
    errorSections = new Set(), footer = null, inputProps = null,
}) {
    return (
        <AccordionSection stepType={stepType} sectionKey="fields" title={title} defaultOpen forceOpen={errorSections.has('fields')}>
            {/* The hint is a plain sentence, not a FormRow with a (?) icon: the
                accordion header already carries the title, so a FormRow here
                printed the same words twice and hid the explanation behind a
                tooltip nobody opens. */}
            {hint && <p className="text-[11px] text-[var(--text-tertiary)] mb-2">{hint}</p>}
            <ToolInputForm
                inputs={draft.fields || {}}
                onChange={(next) => set('fields', next)}
                inputSchema={null}
                keepEmptyFields
                onFocusField={onFocusField}
                previewSample={previewSample}
                {...(inputProps || {})}
            />
            {footer}
        </AccordionSection>
    );
}

/**
 * The "Edit data" (set) editor. Two modes, derived — never stored — from the
 * presence of `arrayRef` (the same convention the Condition node uses):
 *
 *   single — today's form, untouched: a fields map building one object.
 *   list   — the step works through an upstream table/list: a one-line
 *            source summary, per-row Fields with the row in scope as
 *            "Current row", and whole-table "Table tools" (number rows,
 *            shared IDs, rename/keep/remove, sort).
 *
 * Mode detection happens on wire (mapping/autoMapInputs.js) and stays
 * overridable under Advanced. `forEach` remains for legacy single-mode steps
 * only — in list mode it's superseded and cleared on save (formState.js).
 */
function SetFields({ step, draft, set, groups = [], onFocusField, previewSample, errorSections = new Set() }) {
    const pickerCtx = useVariablePickerContext();
    const { density } = useFormDensity();
    // Quick view = "only what you need". Which list this step walks through is
    // detected on wire and is right the overwhelming majority of the time, so
    // it belongs with the other overrides — UNLESS it's still unset, in which
    // case the step can't run and hiding the control would be a dead end.
    const compact = density === 'quick';
    const listMode = typeof draft.arrayRef === 'string';
    const elementSample = useElementSample(listMode ? draft.arrayRef : '', previewSample);

    // Scope the per-row field editors to the CURRENT ROW — the exact
    // RouteFields recipe: an `item` group so the {} picker offers "Current
    // row", plus a preview root so `item.*` refs/exprs resolve to examples.
    const itemScope = useMemo(() => {
        if (!listMode || elementSample == null) return null;
        const isObj = typeof elementSample === 'object' && !Array.isArray(elementSample);
        const itemGroup = {
            id: '__set_item',
            label: 'Current row',
            kind: 'loop',
            basePath: 'item',
            sample: elementSample,
            fields: isObj ? sampleToFields(elementSample, 'item') : [],
        };
        return {
            groups: [itemGroup, ...(pickerCtx.groups || [])],
            previewSample: { ...(previewSample || {}), item: elementSample, _index: 0 },
        };
    }, [listMode, elementSample, pickerCtx.groups, previewSample]);
    const effectivePreview = itemScope ? itemScope.previewSample : previewSample;

    // Columns BEFORE any table tool runs: the source row's own keys (a scalar
    // list reads as its `value` wrap — runtime row rule 1) plus the computed
    // fields above. Each op card then folds the EARLIER ops on top.
    const baseColumns = useMemo(() => {
        const cols = [];
        if (elementSample != null && typeof elementSample === 'object' && !Array.isArray(elementSample)) cols.push(...Object.keys(elementSample));
        else if (elementSample != null) cols.push('value');
        cols.push(...Object.keys(draft.fields || {}));
        return [...new Set(cols)];
    }, [elementSample, draft.fields]);
    const columnSamples = useMemo(() => {
        if (elementSample != null && typeof elementSample === 'object' && !Array.isArray(elementSample)) return elementSample;
        return elementSample != null ? { value: elementSample } : {};
    }, [elementSample]);

    const scoped = (node) => (itemScope ? (
        <VariablePickerProvider
            groups={itemScope.groups}
            previewSample={itemScope.previewSample}
            stepLabelById={pickerCtx.stepLabelById}
        >
            {node}
        </VariablePickerProvider>
    ) : node);

    const ops = Array.isArray(draft.operations) ? draft.operations : [];

    return (
        <>
            {listMode && !draft.arrayRef && (
                <SourceSummaryRow
                    hint="This step has no list to work through yet — pick the step whose results it should edit."
                    source={draft.arrayRef}
                    maxItems={draft.maxItems}
                    onPatch={(p) => ('source' in p ? set('arrayRef', p.source) : set('maxItems', p.maxItems))}
                    groups={groups}
                    onFocusField={onFocusField}
                    previewSample={previewSample}
                />
            )}
            {scoped(
                <FieldsSection
                    draft={draft}
                    set={set}
                    stepType="set"
                    title={listMode ? 'Fields added to each row' : 'Fields'}
                    hint={listMode
                        ? 'Every row keeps its own data. The fields below are worked out for each row — reuse a name to overwrite that column.'
                        : 'One record, built field by field.'}
                    onFocusField={onFocusField}
                    previewSample={effectivePreview}
                    errorSections={errorSections}
                    inputProps={{
                        visualValues: true,
                        nameLabel: listMode ? 'Column name' : 'Field name',
                        valueLabel: 'What goes in it',
                        namePlaceholder: listMode ? 'e.g. status' : 'e.g. customer',
                        valuePlaceholder: 'Type a value…',
                        allowRawValues: !compact,
                    }}
                    footer={(
                        <JsonExtractSection
                            draft={draft}
                            set={set}
                            listMode={listMode}
                            elementSample={elementSample}
                            previewSample={effectivePreview}
                        />
                    )}
                />,
            )}
            {listMode && (
                <AccordionSection stepType="set" sectionKey="table" title="Table tools" defaultOpen forceOpen={errorSections.has('table')}>
                    <p className="text-[11px] text-[var(--text-tertiary)] mb-2">
                        Applied to the whole table, top to bottom, after the fields above.
                    </p>
                    <SetOperationsEditor
                        ops={ops}
                        onChange={(next) => set('operations', next)}
                        baseColumns={baseColumns}
                        columnSamples={columnSamples}
                        onFocusField={onFocusField}
                    />
                </AccordionSection>
            )}
            <AccordionSection stepType="set" sectionKey="advanced" title="Advanced" defaultOpen={!listMode && !!draft.forEach} forceOpen={errorSections.has('advanced')}>
                <FormRow label="Works on" hint="Detected from the step above — override it here if the guess is wrong.">
                    <select
                        value={listMode ? 'items' : 'single'}
                        onChange={(e) => set('arrayRef', e.target.value === 'items' ? (draft.arrayRef ?? '') : null)}
                        className={inputClass()}
                    >
                        <option value="items">Each row of a list</option>
                        <option value="single">The whole run</option>
                    </select>
                    {listMode && ops.length > 0 && (
                        <div className="mt-1 text-[10px] text-[var(--text-tertiary)]">
                            Switching to “The whole run” also removes the table tools.
                        </div>
                    )}
                </FormRow>
                {/* Which list this step walks lives HERE, not above the fields:
                    it is detected on wire, right nearly always, and reading
                    `steps.act_4d…output.results` taught the user nothing. The
                    summary names the step and the field; `change` reveals the
                    same path editor the other collection steps use. */}
                {listMode && !!draft.arrayRef && (
                    <SourceSummaryRow
                        hint="Detected from the step above. The fields are computed for each row of this list."
                        source={draft.arrayRef}
                        maxItems={draft.maxItems}
                        onPatch={(p) => ('source' in p ? set('arrayRef', p.source) : set('maxItems', p.maxItems))}
                        groups={groups}
                        onFocusField={onFocusField}
                        previewSample={previewSample}
                    />
                )}
                {!listMode && <ForEachSection draft={draft} set={set} groups={groups} onFocusField={onFocusField} />}
                {listMode && step?.forEach && (
                    <div className="text-[11px] text-amber-600 dark:text-amber-400">
                        List mode replaces “Run once per item” — saving removes the old per-item setting.
                    </div>
                )}
            </AccordionSection>
        </>
    );
}

/**
 * "Some of this data is JSON text · Pick fields from it" — the Parse JSON
 * node's successor, folded into Edit data. Rendered only when an upstream
 * sample (or, in list mode, a field of the current row) is a string that
 * parses to a JSON object/array. A pick appends a computed field whose value
 * is a `parseJson(<source>, "<path>")` expression — deterministic, free at
 * run time, and visible/editable like any other field.
 */
function JsonExtractSection({ draft, set, listMode, elementSample, previewSample }) {
    const pickerCtx = useVariablePickerContext();
    const [open, setOpen] = useState(false);
    const [changing, setChanging] = useState(false);
    const [customSource, setCustomSource] = useState(null);

    const PREFERRED = /body|content|text|json|payload|raw/i;
    const jsonish = (v) => {
        if (typeof v !== 'string') return false;
        const parsed = parseSampleSource(v);
        return parsed !== undefined && parsed !== null && typeof parsed === 'object';
    };

    const candidates = useMemo(() => {
        const found = [];
        if (listMode) {
            if (elementSample && typeof elementSample === 'object' && !Array.isArray(elementSample)) {
                for (const [k, v] of Object.entries(elementSample)) {
                    if (jsonish(v)) found.push({ path: `item.${k}`, label: `each row · ${humanizeFieldKey(k)}`, preferred: PREFERRED.test(k) });
                }
            }
        } else {
            // Nearest upstream step first (groups are in execution order).
            const gs = pickerCtx.groups || [];
            for (let i = gs.length - 1; i >= 0; i--) {
                const g = gs[i];
                for (const f of (g.fields || [])) {
                    if (jsonish(f.sample)) found.push({ path: f.path, label: `${g.label} · ${humanizeFieldKey(f.key)}`, preferred: PREFERRED.test(f.key) });
                    for (const c of (f.children || [])) {
                        if (jsonish(c.sample)) found.push({ path: c.path, label: `${g.label} · ${humanizeFieldKey(c.key)}`, preferred: PREFERRED.test(c.key) });
                    }
                }
            }
        }
        return found.sort((a, b) => (b.preferred ? 1 : 0) - (a.preferred ? 1 : 0));
    }, [listMode, elementSample, pickerCtx.groups]);

    const sourcePath = customSource ?? candidates[0]?.path ?? '';
    const sourceLabel = candidates.find(c => c.path === sourcePath)?.label || sourcePath;
    const parsed = useMemo(() => {
        if (!sourcePath || !previewSample) return undefined;
        return parseSampleSource(walkPath(sourcePath, previewSample));
    }, [sourcePath, previewSample]);

    if (!candidates.length && customSource == null) return null;

    const addField = (relPath) => {
        const fields = draft.fields || {};
        const name = suggestFieldName(relPath, Object.keys(fields));
        // The expr grammar has no backslash escapes — pick whichever quote
        // style the path doesn't contain (a path needing both is unpickable
        // upstream in JsonTreePicker for the same reason).
        const quoted = relPath.includes('"') ? `'${relPath}'` : `"${relPath}"`;
        set('fields', { ...fields, [name]: { kind: 'expr', value: `parseJson(${sourcePath}, ${quoted})` } });
    };

    if (!open) {
        return (
            <div className="mt-2 text-[11px] text-[var(--text-secondary)]">
                Some of this data is JSON text ·{' '}
                <button type="button" onClick={() => setOpen(true)} className="text-[var(--accent)] hover:underline">
                    Pick fields from it
                </button>
            </div>
        );
    }

    return (
        <div className="mt-2 rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]/40 p-2 space-y-2">
            <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                <span className="truncate">From <span className="text-[var(--text-primary)]">{sourceLabel}</span></span>
                <button type="button" onClick={() => setChanging(c => !c)} className="ml-auto shrink-0 text-[10px] text-[var(--accent)] hover:underline">
                    {changing ? 'done' : 'change'}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="shrink-0 text-[10px] text-[var(--text-tertiary)] hover:underline">
                    hide
                </button>
            </div>
            {changing && (
                <PathField
                    value={sourcePath}
                    onChange={(v) => setCustomSource(v)}
                    previewSample={previewSample}
                    placeholder={listMode ? 'item.body' : 'steps.step1.output.body'}
                />
            )}
            {parsed !== undefined ? (
                <>
                    <JsonTreePicker value={parsed} onPick={addField} />
                    <div className="text-[10px] text-[var(--text-tertiary)]">
                        Click a value to add it as a field. Extraction is exact and free — no AI involved.
                    </div>
                </>
            ) : (
                <div className="text-[11px] italic text-[var(--text-tertiary)]">
                    This doesn’t look like JSON text — pick another source.
                </div>
            )}
        </div>
    );
}

/**
 * The one-line "Working through ‹gmail search› · Results — 10 items" row with
 * its `change` reveal. Shared by the Condition editor (RouteFields) and the Edit
 * data editor so the two list-mode steps read identically on screen.
 */
function SourceSummaryRow({ hint, source, maxItems, onPatch, groups, onFocusField, previewSample }) {
    const pickerCtx = useVariablePickerContext();
    const [open, setOpen] = useState(false);
    const summary = useMemo(
        () => describeSourceList(source, pickerCtx.groups, previewSample),
        [source, pickerCtx.groups, previewSample],
    );
    return (
        <FormRow label="Working through" hint={hint}>
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                {summary ? (
                    <span className="truncate">
                        <span className="text-[var(--text-primary)]">{summary.stepLabel}</span>
                        <span className="text-[var(--text-tertiary)]"> · </span>
                        <span className="text-[var(--text-primary)]">{summary.fieldLabel}</span>
                        {summary.count != null && (
                            <span className="text-[var(--text-tertiary)]"> — {summary.count} item{summary.count === 1 ? '' : 's'}</span>
                        )}
                    </span>
                ) : (
                    <span className="text-amber-600 dark:text-amber-400 truncate">
                        {source || 'No list picked yet'}
                    </span>
                )}
                <button
                    type="button"
                    onClick={() => setOpen(o => !o)}
                    aria-label={open ? 'Done changing the source list' : 'Change the source list'}
                    className="ml-auto shrink-0 text-[10px] text-[var(--accent)] hover:underline"
                >
                    {open ? 'done' : 'change'}
                </button>
            </div>
            {open && (
                <div className="mt-2">
                    <CollectionArrayRefField
                        draft={{ arrayRef: source || '', maxItems }}
                        set={(k, v) => onPatch(k === 'arrayRef' ? { source: v } : { maxItems: v })}
                        groups={groups}
                        onFocusField={onFocusField}
                        previewSample={previewSample}
                    />
                </div>
            )}
        </FormRow>
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
    const { setInput, onAutoMap } = useInputMapping({ inputs, contract, groups, onChange: (next) => set('inputs', next) });

    return (
        <CallContractFields
            step={step}
            stepType="call_layer"
            headerSectionKey="flowlet"
            headerTitle="Flowlet"
            displayTitle={layerTitle || step.layerKey || '—'}
            warning={!layerTitle && step.layerKey ? `Flowlet “${step.layerKey}” was not found in this automation.` : null}
            contract={contract}
            inputs={inputs}
            setInput={setInput}
            onAutoMap={onAutoMap}
            groups={groups}
            onFocusField={onFocusField}
            previewSample={previewSample}
            inputsHint="Map each flowlet parameter to an upstream value."
            emptyInputsLabel="This flowlet has no declared inputs."
            outputFields={outputFields}
            errorSections={errorSections}
        />
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
    const { setInput, onAutoMap } = useInputMapping({ inputs, contract, groups, onChange: (next) => set('inputs', next) });

    return (
        <CallContractFields
            step={step}
            stepType="call_block"
            headerSectionKey="step"
            headerTitle="Step"
            displayTitle={blockTitle || step.label || step.blockId || '—'}
            warning={!block && step.blockId ? 'This Step is unpublished, deleted, or not shared with you.' : null}
            contract={contract}
            inputs={inputs}
            setInput={setInput}
            onAutoMap={onAutoMap}
            groups={groups}
            onFocusField={onFocusField}
            previewSample={previewSample}
            inputsHint="Map each Step input to an upstream value."
            emptyInputsLabel="This Step has no declared inputs."
            outputFields={outputFields}
            errorSections={errorSections}
        />
    );
}

/** Editor for a layer_output step — the object the flowlet returns. */
function LayerOutputFields({ draft, set, onFocusField, previewSample, errorSections = new Set() }) {
    return (
        <FieldsSection
            draft={draft}
            set={set}
            stepType="layer_output"
            title="Return fields"
            hint="The object this flowlet returns to its caller. Bind each field to a value produced inside the flowlet."
            onFocusField={onFocusField}
            previewSample={previewSample}
            errorSections={errorSections}
        />
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
                    <div key={i} className={cardClass()}>
                        <div className="flex items-center gap-1">
                            <input
                                type="text"
                                value={p.name || ''}
                                onChange={(e) => update(i, { name: e.target.value })}
                                placeholder="name"
                                className={rowInputClass('flex-1 min-w-0 font-mono')}
                            />
                            <select
                                value={p.type || 'string'}
                                onChange={(e) => update(i, { type: e.target.value })}
                                className={rowInputClass('px-1.5')}
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
                        <div key={i} className={cardClass()}>
                            <div className="flex items-center gap-1">
                                <input
                                    type="text"
                                    value={p.name || ''}
                                    onChange={(e) => update(i, { name: e.target.value })}
                                    placeholder="name"
                                    className={rowInputClass('flex-1 min-w-0 font-mono')}
                                />
                                <select
                                    value={p.type || 'string'}
                                    onChange={(e) => update(i, { type: e.target.value })}
                                    className={rowInputClass('px-1.5')}
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
                                className={rowInputClass('w-full')}
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

/**
 * Studio App trigger (trigger.kind === 'app_trigger') — the routine is fired
 * by a Studio App action with DECLARED TYPED INPUTS. Same row editor as the
 * flowlet/agent params, plus the `file` type: a file input arrives at run
 * time as { fileId, name, mime, size, url } (bind .url into steps that fetch
 * the file). Server contract: server/automation/appTriggerContract.js —
 * identifier names, no leading underscore.
 */
function AppTriggerFields({ draft, set }) {
    const params = Array.isArray(draft.params) ? draft.params : [];
    const update = (i, patch) => { const next = params.slice(); next[i] = { ...next[i], ...patch }; set('params', next); };
    const add = () => set('params', [...params, { name: `input${params.length + 1}`, type: 'string', required: false, description: '' }]);
    const remove = (i) => set('params', params.filter((_, idx) => idx !== i));
    const nameProblem = (name) => {
        if (!name) return null;
        if (/^[_0-9]/.test(name)) return 'Names must start with a letter (no leading _ or digit).';
        return null;
    };
    return (
        <FormRow label="App inputs" hint="Inputs the app action must provide. Bind them in steps as trigger.output.<name>; a file input arrives as { fileId, name, mime, size, url }.">
            <div className="space-y-2">
                {params.length === 0 && <div className="text-[11px] text-[var(--text-tertiary)] italic">No inputs yet — the app calls it with an empty payload.</div>}
                {params.map((p, i) => (
                    <div key={i} className={cardClass()}>
                        <div className="flex items-center gap-1">
                            <input
                                type="text"
                                value={p.name || ''}
                                onChange={(e) => update(i, { name: e.target.value.replace(/[^A-Za-z0-9_]/g, '') })}
                                placeholder="name"
                                className={rowInputClass('flex-1 min-w-0 font-mono')}
                            />
                            <select
                                value={p.type || 'string'}
                                onChange={(e) => update(i, { type: e.target.value })}
                                className={rowInputClass('px-1.5')}
                            >
                                <option value="string">text</option>
                                <option value="number">number</option>
                                <option value="boolean">boolean</option>
                                <option value="array">array</option>
                                <option value="object">json</option>
                                <option value="file">file (pdf / word / excel / image)</option>
                            </select>
                            <button type="button" onClick={() => remove(i)} aria-label="Remove input" className="shrink-0 p-1 rounded text-[var(--text-tertiary)] hover:text-red-500 hover:bg-[var(--bg-secondary)]">
                                <Trash2 size={12} />
                            </button>
                        </div>
                        {nameProblem(p.name) && (
                            <div className="text-[11px] text-amber-600">{nameProblem(p.name)}</div>
                        )}
                        <input
                            type="text"
                            value={p.description || ''}
                            onChange={(e) => update(i, { description: e.target.value })}
                            placeholder="description (shown to the app builder)"
                            className={rowInputClass('w-full')}
                        />
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

function DateTimeFields({ draft, set, onFocusField, previewSample, errorSections = new Set() }) {
    const op = draft.op || 'now';
    const needsInput = op !== 'now';
    const needsInput2 = op === 'diff';
    const needsAmount = op === 'addDays' || op === 'addHours' || op === 'addMinutes';
    return (
        <AccordionSection stepType="datetime" sectionKey="config" title="Configuration" defaultOpen forceOpen={errorSections.has('config')}>
            <FormRow label="Operation">
                <select value={op} onChange={(e) => set('op', e.target.value)} className={inputClass()}>
                    <option value="now">Today’s date and time</option>
                    <option value="parse">Read a date out of text</option>
                    <option value="format">Reformat a date</option>
                    <option value="addDays">Add days</option>
                    <option value="addHours">Add hours</option>
                    <option value="addMinutes">Add minutes</option>
                    <option value="diff">Time between two dates</option>
                    <option value="extract">Take one part of a date</option>
                </select>
            </FormRow>
            {needsInput && (
                <FormRow label="Input date" hint="Pick a date from a previous step, or type a fixed date like 2026-07-01.">
                    <PathField
                        value={draft.input || ''}
                        onChange={(v) => set('input', v)}
                        allowLiteral="date"
                        onFocusField={onFocusField}
                        previewSample={previewSample}
                        placeholder="trigger.output.timestamp"
                    />
                </FormRow>
            )}
            {needsInput2 && (
                <FormRow label="Second date" hint="Difference is calculated as second date − input date.">
                    <PathField
                        value={draft.input2 || ''}
                        onChange={(v) => set('input2', v)}
                        allowLiteral="date"
                        onFocusField={onFocusField}
                        previewSample={previewSample}
                        placeholder="trigger.output.endsAt"
                    />
                </FormRow>
            )}
            {needsAmount && (
                <FormRow label="Amount" hint="Positive to add, negative to subtract.">
                    <input type="number" value={draft.amount ?? 0} onChange={(e) => set('amount', Number(e.target.value))} className={inputClass()} />
                </FormRow>
            )}
            {op === 'format' && (
                <FormRow label="Format" hint="How the date should be written. Building blocks: yyyy (year), MM (month), dd (day), HH, mm, ss.">
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
                        <option value="dayOfWeek">day of the week</option>
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

// Moved to flow/waitDuration.js so the canvas card renders the SAME unit this
// editor opens on — the node used to print "7200s" for a Wait set to 2 hours.
function WaitFields({ draft, set, errorSections = new Set() }) {
    const seconds = clampWaitSeconds(Number(draft.seconds ?? 5) || 5);
    // Display unit is derived ONCE on mount and held locally — switching the
    // unit only re-interprets the display; the stored value stays `seconds`
    // and is never re-emitted on mount (no autosave churn on open).
    const [unit, setUnit] = useState(() => waitUnitFor(seconds));
    const factor = WAIT_UNIT_FACTOR[unit] || 1;
    // While the field is being edited the user's raw text wins. Clamping on
    // every keystroke made the field unusable: emptying it gives
    // `Number('') === 0` — not NaN, so the old guard never fired — and
    // `Math.max(1, 0)` snapped it straight back to 1, so you could never
    // clear-and-retype (BFSF-345).
    const [typed, setTyped] = useState(null);
    const display = typed ?? String(Math.round((seconds / factor) * 100) / 100);

    const commit = (raw) => {
        const n = Number(raw);
        if (raw == null || String(raw).trim() === '' || !Number.isFinite(n) || n <= 0) return false;
        set('seconds', clampWaitSeconds(n * factor));
        return true;
    };
    const onValue = (e) => {
        setTyped(e.target.value);
        commit(e.target.value);
    };
    // Dropping the raw text on blur is what restores the last stored value
    // when the field was left empty or nonsense.
    const onBlur = () => { setTyped(null); };
    // Switching the unit keeps the number the user is looking at and
    // re-interprets it (5 seconds → 5 minutes), instead of rescaling it into
    // a rounded-to-zero 0.08 that sits below the field's own minimum.
    const onUnit = (e) => {
        const next = e.target.value;
        const n = Number(display);
        setUnit(next);
        setTyped(null);
        if (Number.isFinite(n) && n > 0) set('seconds', clampWaitSeconds(n * (WAIT_UNIT_FACTOR[next] || 1)));
    };

    // `inputClass()` bakes in `w-full`; adding `w-auto` next to it leaves two
    // utilities racing for one property (won by stylesheet order, not class
    // order — see formStyles.js), which let the unit select eat the whole row
    // and collapsed the number field to its spinner. Both controls carry
    // their own width instead.
    const controlSize = 'px-2 py-1.5 text-sm';
    return (
        <AccordionSection stepType="wait" sectionKey="config" title="Configuration" defaultOpen forceOpen={errorSections.has('config')}>
            <FormRow label="Wait for" hint="Up to 24 hours. Dry-run skips the wait.">
                <div className="flex items-stretch gap-1.5">
                    <input
                        type="number"
                        min={unit === 'seconds' ? 1 : 0.01}
                        step={unit === 'seconds' ? 1 : 'any'}
                        value={display}
                        onChange={onValue}
                        onBlur={onBlur}
                        aria-label="Wait duration"
                        className={controlSurfaceClass(`flex-1 min-w-[5rem] ${controlSize}`)}
                    />
                    <select
                        value={unit}
                        onChange={onUnit}
                        className={controlSurfaceClass(`w-auto shrink-0 ${controlSize}`)}
                        aria-label="Duration unit"
                    >
                        <option value="seconds">seconds</option>
                        <option value="minutes">minutes</option>
                        <option value="hours">hours</option>
                    </select>
                </div>
            </FormRow>
        </AccordionSection>
    );
}

const FORM_WAIT_CHOICES = [
    { value: 900, label: '15 minutes' },
    { value: 3600, label: '1 hour' },
    { value: 86400, label: '24 hours' },
    { value: 7 * 24 * 3600, label: '7 days' },
];

/**
 * A further page of the routine's public form.
 *
 * The page editor is the same one the trigger uses (FormBuilderFields) — what
 * is specific here is the wait window, which only an 'input' page has: it is
 * how long the run stays paused before giving up on the visitor.
 *
 * Unlike the trigger, every text on this page is template-interpolated at the
 * moment it is shown, so the slots get the {} picker and the Input panel can
 * drop values from earlier steps straight into them.
 */
function FormPageFields({ draft, set, stepId, onFocusField, previewSample, errorSections = new Set() }) {
    const isEnding = draft.mode === 'ending';
    const form = draft.form || null;

    if (!form) {
        return (
            <AccordionSection stepType="form_page" sectionKey="config" title="Page" defaultOpen forceOpen={errorSections.has('config')}>
                <p className="text-[11px] text-[var(--text-tertiary)] mb-2">
                    {isEnding
                        ? 'A closing page is the last thing the visitor sees. It can summarise what the routine did.'
                        : 'This asks the visitor one more thing, on the same link they are already on.'}
                </p>
                <button
                    type="button"
                    onClick={() => set('form', isEnding ? defaultFormEndingDeclaration() : defaultFormPageDeclaration())}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--accent)] text-white hover:opacity-90"
                >
                    Create the page
                </button>
            </AccordionSection>
        );
    }

    return (
        <>
            <AccordionSection stepType="form_page" sectionKey="config" title="Page" defaultOpen forceOpen={errorSections.has('config')}>
                <FormBuilderFields
                    form={form}
                    onChange={(next) => set('form', next)}
                    bindingBase={`steps.${stepId || 'this'}.output`}
                    variant={isEnding ? 'ending' : 'input'}
                    allowVariables
                    onFocusField={onFocusField}
                    previewSample={previewSample}
                />
            </AccordionSection>
            {/* Its own section key, not 'options': how long the routine waits
                for a real person is a first-class decision, so it must not
                disappear behind the advanced-density filter. */}
            {!isEnding && (
                <AccordionSection stepType="form_page" sectionKey="waiting" title="Waiting" defaultOpen forceOpen={errorSections.has('waiting')}>
                    <FormRow label="Wait for an answer" hint="After this the routine gives up and the run fails.">
                        <select
                            aria-label="Wait for an answer"
                            value={draft.waitSeconds ?? 3600}
                            onChange={(e) => set('waitSeconds', Number(e.target.value))}
                            className={inputClass()}
                        >
                            {FORM_WAIT_CHOICES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                    </FormRow>
                </AccordionSection>
            )}
        </>
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

/**
 * "Show real values again" — one field, because there is one decision.
 *
 * It does not scan, so it has no categories and no threshold: it looks up
 * placeholders in the run's own vault. Everything it can and cannot resolve is
 * reported on the node after a run.
 */
/**
 * The Privacy Shield step's editor — one node, four modes (BFSF-355).
 *
 * "Check for personal data", "Hide personal data" and "Show real values again"
 * used to be three palette entries with two editors between them, and nothing
 * told you that a reveal only means something after a hide. They are one node
 * now; flow/privacyModel.js maps the mode onto the runtime type the engine
 * already speaks, so stored routines open here unchanged.
 *
 * Deliberately short beyond the mode: the org's Privacy Shield already decides
 * what counts as personal data, how sure the detector has to be, and what an
 * allowlist lets through. Re-asking all of that per step would let one routine
 * quietly hold itself to a weaker standard than the organisation — so the only
 * knobs here NARROW that policy, and the copy says which parts are inherited.
 */
function PrivacyShieldFields({ step, draft, set, groups, onFocusField, previewSample, errorSections = new Set(), stepEdges = [] }) {
    const { t } = useTranslation();
    const categories = useMemo(() => piiCategoriesLocalized(t), [t]);
    const guardTrouble = useGuardAvailability();
    const privacy = draft.privacy || readPrivacy(step);
    const setPrivacy = (patch) => set('privacy', { ...privacy, ...patch });
    const mode = privacy.mode;
    const scans = modeScans(mode);
    const hides = modeHides(mode);
    const branches = modeBranches(mode);
    const selected = Array.isArray(privacy.categories) ? privacy.categories : null;

    // A mode switch can change the node's PORTS, and the canvas would drop the
    // edges the new shape has nowhere to put. Ask before that costs wiring —
    // the same stance RouteFields takes when collapsing a router.
    const [modeAsk, setModeAsk] = useState(null);
    const chooseMode = (next) => {
        if (next === mode) return;
        const dropped = droppedEdgesOnModeChange(step, next, stepEdges);
        if (dropped.length) { setModeAsk({ next, dropped }); return; }
        setPrivacy({ mode: next });
    };

    const sourceLabel = mode === 'reveal' ? 'What to restore'
        : mode === 'hide' ? 'What to hide it in'
            : mode === 'check_hide' ? 'What to scan and hide'
                : 'What to scan';
    const sourceHint = mode === 'reveal'
        ? 'The value that still holds placeholders — usually the output of a step that worked on hidden data.'
        : 'Any value from an earlier step — an email body, a document\'s text, a form answer. Objects are scanned whole.';

    const toggleCategory = (id) => {
        // No selection means "everything the org looks for". The first tick
        // therefore starts from that whole list rather than from nothing —
        // otherwise one click would silently narrow the scan to a single
        // category, which is the opposite of what ticking a box suggests.
        const base = selected || categories.map(c => c.id);
        const next = base.includes(id) ? base.filter(c => c !== id) : [...base, id];
        setPrivacy({ categories: next.length && next.length < categories.length ? next : null });
    };

    return (
        <>
            <AccordionSection stepType={step.type} sectionKey="config" title="Configuration" defaultOpen forceOpen={errorSections.has('config')}>
                <FormRow label="What should this step do?">
                    <div className="flex flex-col gap-1">
                        {PRIVACY_MODES.map((m) => (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => chooseMode(m.id)}
                                aria-pressed={mode === m.id}
                                className={`text-left px-2.5 py-1.5 rounded border text-xs transition ${mode === m.id
                                    ? 'bg-[var(--accent)]/15 border-[var(--accent)]/40 text-[var(--accent)]'
                                    : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            >
                                <span className="font-semibold">{m.label}</span>
                                <span className="block text-[11px] text-[var(--text-tertiary)]">{m.blurb}</span>
                            </button>
                        ))}
                    </div>
                </FormRow>

                {modeAsk && (
                    <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-300">
                        <p className="mb-1.5">
                            Switching to <strong>{PRIVACY_MODES.find(m => m.id === modeAsk.next)?.label}</strong> removes{' '}
                            {modeAsk.dropped.map(d => `the "${d.port}" connection`).join(' and ')} — {modeAsk.dropped[0].why}.
                        </p>
                        <div className="flex gap-2">
                            <button type="button" className="underline font-semibold"
                                onClick={() => { const next = modeAsk.next; setModeAsk(null); setPrivacy({ mode: next }); }}>
                                Switch anyway
                            </button>
                            <button type="button" className="underline" onClick={() => setModeAsk(null)}>Keep this mode</button>
                        </div>
                    </div>
                )}

                <FormRow label={sourceLabel} hint={sourceHint}>
                    <PathField
                        value={privacy.sourceRef || ''}
                        onChange={(v) => setPrivacy({ sourceRef: v })}
                        onFocusField={onFocusField}
                        previewSample={previewSample}
                        quickPicks={guardQuickPicks(groups)}
                        quickPicksLabel="Text from previous steps"
                        placeholder="Pick a value from an earlier step"
                    />
                </FormRow>

                {/* What happens next is the whole point of the step, and none of
                    it is discoverable from the node alone. */}
                {mode === 'reveal' && (
                    <p className="text-[11px] text-[var(--text-tertiary)]">
                        Bind the next step to <code>output.text</code>. Most values come back on their own — an AI reply, a tool
                        result — so this is only needed where one did not. Anything this run cannot account for is reported
                        rather than left in the text.
                    </p>
                )}
                {mode === 'hide' && (
                    <p className="text-[11px] text-[var(--text-tertiary)]">
                        Bind the next step to <code>output.text</code>. Every value is replaced by a placeholder like{' '}
                        <code>[email_1]</code>, and the real values are put back <strong>automatically</strong> wherever the
                        run uses them again — an AI reply, a tool result. For a value that never comes back
                        that way, add a step in <strong>Show real values again</strong> mode where you want them restored.
                    </p>
                )}
                {branches && (
                    <p className="text-[11px] text-[var(--text-tertiary)]">
                        Leaves by <span className="font-semibold text-amber-600 dark:text-amber-400">personal data</span> or{' '}
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">clean</span> — wire an alert to the first.
                        {mode === 'check_hide' && (
                            <> The hidden copy is on <code>output.text</code>, with reversible placeholders — a later
                            <strong> Show real values again</strong> can restore it.</>
                        )}
                    </p>
                )}
                {guardTrouble && scans && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        The Privacy Shield detector {guardTrouble}, so this step cannot scan right now. Which branch it takes
                        then is your organisation&rsquo;s Privacy Shield setting — but it will never report
                        &ldquo;clean&rdquo; for a scan that did not happen.
                    </p>
                )}
                {branches && (
                <FormRow label="On personal data">
                    <div className="flex flex-col gap-1.5">
                        <label className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                            <input type="checkbox" checked={!!privacy.stopOnFound} onChange={(e) => setPrivacy({ stopOnFound: e.target.checked })} className="mt-0.5 accent-[var(--accent)]" />
                            <span>
                                Stop the run
                                <span className="block text-[var(--text-tertiary)]">The run fails, and the failure says which categories were found.</span>
                            </span>
                        </label>
                        <label className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                            <input type="checkbox" checked={!!privacy.maskOnFound} onChange={(e) => setPrivacy({ maskOnFound: e.target.checked })} className="mt-0.5 accent-[var(--accent)]" />
                            <span>
                                Pass a masked copy on
                                <span className="block text-[var(--text-tertiary)]">
                                    Adds <code>output.masked</code>, with every value replaced by <code>[person]</code>. Irreversible — the
                                    original is not recoverable from it, unlike the placeholders <strong>Check and hide</strong> mints.
                                </span>
                            </span>
                        </label>
                    </div>
                </FormRow>
                )}
            </AccordionSection>
            {scans && (
            <AccordionSection stepType={step.type} sectionKey="advanced" title="Advanced" forceOpen={errorSections.has('advanced')}>
                <FormRow label={hides && !branches ? 'Hide' : 'Look for'} hint="Everything the organisation looks for, unless you narrow it here. A step can only look for LESS than the Privacy Shield does, never more.">
                    <div className="flex flex-wrap gap-1">
                        {categories.map((c) => {
                            const on = !selected || selected.includes(c.id);
                            return (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => toggleCategory(c.id)}
                                    aria-pressed={on}
                                    // The id, not the label: the label is
                                    // translated, and the id is what actually
                                    // reaches the detector.
                                    data-pii-category={c.id}
                                    title={c.id}
                                    className={`px-2 py-0.5 rounded-full border text-[11px] transition ${on
                                        ? 'bg-[var(--accent)]/15 border-[var(--accent)]/40 text-[var(--accent)]'
                                        : 'border-[var(--border-default)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
                                >
                                    {c.label}
                                </button>
                            );
                        })}
                    </div>
                </FormRow>
                <FormRow label="Only report matches above" hint="Leave empty to use the organisation's threshold. A higher number reports only what the detector is more sure about.">
                    <input
                        type="number" min={0} max={1} step={0.05}
                        value={privacy.confidence ?? ''}
                        onChange={(e) => setPrivacy({ confidence: e.target.value === '' ? null : Number(e.target.value) })}
                        placeholder="inherited"
                        className={inputClass()}
                    />
                </FormRow>
            </AccordionSection>
            )}
        </>
    );
}

/** Upstream values worth scanning, offered as one-click picks. */
function guardQuickPicks(groups) {
    const picks = [];
    for (const g of groups || []) {
        const sample = g.sample;
        if (!sample || typeof sample !== 'object') continue;
        for (const [key, value] of Object.entries(sample)) {
            // Text is what a detector can read. A number or a boolean has no
            // personal data to find, and offering it is noise.
            if (typeof value !== 'string' || value.length < 3) continue;
            picks.push({ path: `${g.basePath}.${key}`, sample: value });
            if (picks.length >= 8) return picks;
        }
    }
    return picks;
}

/**
 * Can the shield's detector actually scan? A guard node that looks configured
 * but cannot scan is worse than no node, so the panel says so.
 *
 * `/api/guard/health` answers with a STATUS, and the four values mean different
 * things to an author:
 *   'not-configured' — no detector installed at all (server/index.js)
 *   'unavailable'    — installed, but the probe failed (it is down right now)
 *   'degraded'       — reachable, model not loaded (guard-service /health)
 *   'ok'             — fine, and the panel stays quiet
 *
 * Advisory only: it never blocks editing, and a failed probe says nothing
 * rather than claiming the detector is missing.
 */
const GUARD_TROUBLE = {
    'not-configured': 'is not installed',
    unavailable: 'is installed but not responding',
    degraded: 'is running but its model has not loaded',
};

function useGuardAvailability() {
    const [trouble, setTrouble] = useState(null);
    useEffect(() => {
        let alive = true;
        authFetch(`${API_BASE}/api/guard/health`)
            .then(r => (r.ok ? r.json() : null))
            .then((b) => { if (alive && b) setTrouble(GUARD_TROUBLE[b.status] || null); })
            .catch(() => { /* availability is advisory */ });
        return () => { alive = false; };
    }, []);
    return trouble;
}

/**
 * The unified "Condition" editor — one form for what used to be four palette
 * entries (If · Switch · Filter (route) · Filter (collection)).
 *
 * Designed so the common case needs almost no input: the mode is DETECTED
 * when the node is wired (mapping/autoMapInputs.js), the source list is a
 * one-line summary rather than a field to fill in, and each rule reads
 * "Subject contains isv" — never `item.subject`. Everything the author
 * doesn't normally touch (the mode override, the raw source path, the
 * generated expression) lives under Advanced.
 *
 * What happens to whatever matched no rule is NOT a setting: one rule keeps
 * the matches and drops the rest, several rules add an "otherwise" output.
 * flow/routeModel.js maps that onto the runtime step type
 * (`condition` / `switch` / `filter`) and flow/routeEdges.js re-points the
 * node's connections when the shape changes, so nothing ever strands an edge
 * (which would be a blocking save error — node-audit C1).
 *
 * BFSF-356 — the number of OUTPUTS is now an explicit choice at the top of the
 * section instead of a side effect of clicking "+ Add rule". One Condition
 * node covers both jobs, and which job it is doing is stated rather than
 * discovered:
 *   - "One output"      — a filter: what matches continues, the rest stops.
 *   - "Several outputs" — a router: every output is a filter with its own
 *                         destination, each with the same condition builder.
 * The canvas consequences are stated too (a renamed output keeps its
 * connection, a removed one takes it along; collapsing back to one names the
 * WIRED outputs it would cost before it costs them), and the fan-out semantic
 * — is a record allowed down several outputs at once — is an Advanced choice
 * per node, defaulting to 'all' only for a router BUILT here (see
 * routeModel.js: an absent `matchMode` is every stored router's contract).
 */
function RouteFields({ step, draft, set, groups, onFocusField, previewSample, errorSections = new Set(), wiredCaseNames = null }) {
    const pickerCtx = useVariablePickerContext();
    const route = draft.route || readRoute(step);
    const setRoute = (patch) => set('route', { ...route, ...patch });
    const rules = Array.isArray(route.rules) ? route.rules : [];
    const items = route.mode === 'items';
    const valueStyle = route.style === 'value';

    // A rule only needs a NAME when it becomes a labelled port — with a single
    // rule there is nothing to label, so the field would have no visible effect.
    const namesMatter = rules.length > 1;
    // BFSF-356: the number of outputs is an UP-FRONT choice, not something you
    // discover by clicking "+ Add rule" and watching the node change shape.
    const several = rules.length > 1;
    const fanOut = route.matchMode === 'all';
    // Which outputs would lose a canvas connection if the node collapsed back
    // to one — held in state so the click ASKS before it destroys wiring.
    const [collapseAsk, setCollapseAsk] = useState(null);

    // Scope the per-item rules to the CURRENT ITEM: an `item` group + sample
    // root so `item.<field>` resolves, datatypes infer, and drag-to-map works.
    const elementSample = useElementSample(items ? route.source : '', previewSample);
    const itemScope = useMemo(() => {
        if (!items || elementSample == null) return null;
        const isObj = typeof elementSample === 'object' && !Array.isArray(elementSample);
        const itemGroup = {
            id: '__route_item',
            label: 'Current item',
            kind: 'loop',
            basePath: 'item',
            sample: elementSample,
            fields: isObj ? sampleToFields(elementSample, 'item') : [],
        };
        return {
            groups: [itemGroup, ...(pickerCtx.groups || [])],
            previewSample: { ...(previewSample || {}), item: elementSample },
        };
    }, [items, elementSample, pickerCtx.groups, previewSample]);

    // The named fields the rule rows offer. In list mode they are the fields of
    // one item ("Subject", "From"); otherwise everything the upstream steps
    // produce, grouped by step. Paths stay internal — see FieldPicker.
    const fieldOptions = useMemo(
        () => (items ? itemFieldOptions(elementSample) : upstreamFieldOptions(pickerCtx.groups)),
        [items, elementSample, pickerCtx.groups],
    );

    const updateRule = (i, patch) => setRoute({
        rules: rules.map((r, j) => (j === i ? { ...r, ...patch } : r)),
        // A rename must carry the "when nothing matches" pick with it.
        ...(patch.name && route.defaultBranch === rules[i]?.name ? { defaultBranch: patch.name } : null),
    });
    const addRule = () => setRoute({
        rules: [...rules, { name: uniqueRuleName(rules, `rule${rules.length + 1}`), expr: '', value: '' }],
        // The 1 → several crossing is the ONLY place fan-out is switched on: a
        // node that gains its second output here is a new router, and "every
        // output is a filter with its own destination, none of them consumes
        // the record" is the semantic the ticket describes. A node that ALREADY
        // had several outputs keeps whatever it was saved with — adding a third
        // output to a stored first-match switch must not change how the two it
        // already had behave (routeModel.js, readMatchMode).
        ...(rules.length <= 1 ? { matchMode: 'all' } : null),
    });
    const removeRule = (i) => setRoute({
        rules: rules.filter((_, j) => j !== i),
        ...(route.defaultBranch === rules[i]?.name ? { defaultBranch: '' } : null),
    });

    // ── The up-front output-count choice ─────────────────────────────────
    const outputName = (i) => (i < 26 ? `Output ${String.fromCharCode(65 + i)}` : `Output ${i + 1}`);
    const collapseToOne = () => {
        setCollapseAsk(null);
        setRoute({
            rules: rules.slice(0, 1),
            defaultBranch: '',
            matchMode: 'first',
        });
    };
    const chooseOne = () => {
        if (!several) return;
        // reconcileRouteEdges (flow/routeEdges.js) re-points what survives and
        // drops what doesn't — this only says so BEFORE the click costs an edge.
        const losing = rules
            .map((r, i) => ({ r, i }))
            .slice(1)
            .filter(({ r }) => r?.name && wiredCaseNames?.has?.(r.name))
            .map(({ r, i }) => `${outputName(i)} (${r.name})`);
        if (losing.length) { setCollapseAsk(losing); return; }
        collapseToOne();
    };
    // "Several" must LAND on several. From a node with no outputs configured yet
    // (cases: []), a single addRule() lands at one — the chooser would still show
    // "One output" pressed and the click would read as inert, on the headline
    // control of this section. Grow to two in one step instead.
    const chooseSeveral = () => {
        if (several) return;
        const grown = [...rules];
        while (grown.length < 2) {
            grown.push({ name: uniqueRuleName(grown, `rule${grown.length + 1}`), expr: '', value: '' });
        }
        setRoute({ rules: grown, matchMode: 'all' });
    };

    // Legacy switches match ONE value against per-case values. They stay
    // editable as-is, and convert to full conditions in one click (lossless:
    // `<value to check> == "<case value>"`).
    const convertToConditions = () => setRoute({
        style: 'rules',
        rules: rules.map(r => ({
            ...r,
            expr: r.expr || `${route.matchOn || 'value'} == ${typeof r.value === 'string' ? JSON.stringify(r.value) : String(r.value)}`,
        })),
    });

    const condition = (i, r) => (
        <ConditionBuilder
            value={r.expr || ''}
            onChange={(next) => updateRule(i, { expr: next })}
            onFocusField={onFocusField}
            previewSample={itemScope ? itemScope.previewSample : previewSample}
            context={items ? 'filter' : 'condition'}
            fieldOptions={fieldOptions}
            fieldBase={items ? 'item' : 'trigger.output'}
            showSerialized={false}
        />
    );
    const scoped = (node) => (itemScope ? (
        <VariablePickerProvider
            groups={itemScope.groups}
            previewSample={itemScope.previewSample}
            stepLabelById={pickerCtx.stepLabelById}
        >
            {node}
        </VariablePickerProvider>
    ) : node);

    // The generated expressions, shown under Advanced for the curious and for
    // support — the form itself never puts an expression on screen.
    const expressions = rules.map(r => r.expr).filter(Boolean);

    return (
        <>
            {items && (
                <SourceSummaryRow
                    hint="Detected from the step above. Each item is checked against the rules below."
                    source={route.source}
                    maxItems={route.maxItems}
                    onPatch={(p) => setRoute('source' in p ? { source: p.source } : { maxItems: p.maxItems })}
                    groups={groups}
                    onFocusField={onFocusField}
                    previewSample={previewSample}
                />
            )}

            {/* No `|| errorSections.has('source')` here any more: the taxonomy
                used to route a bad Source list to a section called 'source'
                that this editor never renders, and this check papered over it
                by opening Rules instead — the wrong band, while the Source-list
                control stayed collapsed inside Advanced. The taxonomy now says
                'advanced', which is where CollectionArrayRefField actually is. */}
            <AccordionSection stepType={step.type} sectionKey="rules" title={several ? 'Outputs' : 'Output'} defaultOpen forceOpen={errorSections.has('rules')}>
                {/* BFSF-356 — the node has ONE type in the palette and the two
                    things it can be are chosen here, out loud, before anything
                    else. "+ Add rule" used to flip the node into an
                    undocumented routing mode with no explanation anywhere. */}
                <FormRow
                    label="How many outputs does this node have?"
                    hint="One output filters: what matches continues, the rest stops here. Several outputs route."
                >
                    <div className="space-y-1.5">
                        <div className="flex gap-1" role="group" aria-label="Number of outputs">
                            {[
                                { key: 'one', label: 'One output', active: !several, onClick: chooseOne },
                                { key: 'several', label: 'Several outputs', active: several, onClick: chooseSeveral },
                            ].map(opt => (
                                <button
                                    key={opt.key}
                                    type="button"
                                    aria-pressed={opt.active}
                                    onClick={opt.onClick}
                                    className={`px-2 py-1 text-[11px] rounded border transition ${opt.active
                                        ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10'
                                        : 'border-[var(--border)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)]">
                            {/* An unconfigured node has no rules yet but still routes
                                everything down one path, so "0 outputs" next to a
                                pressed "One output" contradicts itself. */}
                            This node has {Math.max(1, rules.length)} {rules.length > 1 ? 'outputs' : 'output'}.
                        </div>
                        {/* There is no documentation for this node anywhere, so
                            the editor is the only place the shape can be
                            learned. */}
                        <div className="text-[10px] text-[var(--text-tertiary)]">
                            Each output is a filter with its own destination — for example Output A: Subject contains urgent,
                            Output B: Subject contains invoice.
                        </div>
                        {several && (
                            <div className="text-[10px] text-[var(--text-tertiary)]">
                                {fanOut
                                    ? `Every output is checked on its own, so ${items ? 'an item' : 'a record'} that matches two outputs travels both paths. Whatever matches no output at all is dropped here — it stays counted as rejected.`
                                    : `Each ${items ? 'item' : 'record'} takes the FIRST output it matches and no other. Whatever matches no output at all is dropped here. Change this under Advanced.`}
                            </div>
                        )}
                        {several && (
                            <div className="text-[10px] text-[var(--text-tertiary)]">
                                On the canvas: an output that keeps its name keeps its connection, an output that
                                disappears takes its connection with it.
                            </div>
                        )}
                        {collapseAsk && (
                            <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 space-y-1.5">
                                <div className="text-[10px] text-[var(--text-primary)]">
                                    Going back to one output removes {collapseAsk.join(', ')} — {collapseAsk.length === 1 ? 'that output is' : 'those outputs are'} wired
                                    on the canvas, so {collapseAsk.length === 1 ? 'its connection goes' : 'their connections go'} too.
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={collapseToOne}
                                        className="text-[10px] text-red-500 hover:underline"
                                    >
                                        Remove them anyway
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCollapseAsk(null)}
                                        className="text-[10px] text-[var(--text-tertiary)] hover:underline"
                                    >
                                        Keep several outputs
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </FormRow>

                {valueStyle && (
                    <FormRow label="Value to check" hint="Picked once; matched against each rule's value below.">
                        <div className="space-y-1">
                            <PathField
                                value={route.matchOn || ''}
                                onChange={(next) => setRoute({ matchOn: next })}
                                onFocusField={onFocusField}
                                previewSample={previewSample}
                                placeholder="trigger.output.value"
                            />
                            <button
                                type="button"
                                onClick={convertToConditions}
                                className="text-[10px] text-[var(--accent)] hover:underline"
                            >
                                Use full conditions instead
                            </button>
                        </div>
                    </FormRow>
                )}

                <FormRow
                    label={several ? 'Conditions per output' : (items ? 'Keep when' : 'Continue when')}
                    hint={several
                        ? (fanOut
                            ? `Each output has its own condition set and is checked independently — ${items ? 'an item' : 'a record'} can match several.`
                            : `Each output has its own condition set, checked in order — the first match wins.`)
                        : (items
                            ? 'Every item is checked against this condition. Items that do not match stop here.'
                            : 'The run continues when this is true.')}
                >
                    <div className="space-y-2">
                        {rules.length === 0 && (
                            <div className="text-[11px] text-[var(--text-tertiary)] italic">No outputs yet — add one.</div>
                        )}
                        {rules.map((r, i) => (
                            <div key={i} className={namesMatter ? cardClass() : ''}>
                                {namesMatter && (
                                    <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
                                        {outputName(i)}
                                    </div>
                                )}
                                {namesMatter && (
                                    <div className="flex items-center gap-1.5">
                                        <CaseNameInput
                                            name={r.name || ''}
                                            siblingNames={rules.filter((_, j) => j !== i).map(x => x?.name).filter(Boolean)}
                                            onCommit={(name) => updateRule(i, { name })}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeRule(i)}
                                            className="p-1 rounded text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10"
                                            title={wiredCaseNames?.has?.(r.name)
                                                ? 'Remove output — its canvas connection will be removed too'
                                                : 'Remove output'}
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                )}
                                {namesMatter && wiredCaseNames?.has?.(r.name) && (
                                    <div className="text-[10px] text-[var(--text-tertiary)]">
                                        Wired on the canvas — renaming keeps the connection; removing drops it.
                                    </div>
                                )}
                                {valueStyle
                                    ? <CaseValueInput type="unknown" value={r.value} onChange={(v) => updateRule(i, { value: v })} />
                                    : scoped(condition(i, r))}
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={addRule}
                            title="Each output gets its own condition set and its own port on the node"
                            className="flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] px-2 py-1 rounded transition"
                        >
                            <Plus size={12} /> Add output
                        </button>
                        <div className="text-[10px] text-[var(--text-tertiary)]">
                            Text comparisons ignore upper/lower case.
                        </div>
                    </div>
                </FormRow>
            </AccordionSection>

            <AccordionSection stepType={step.type} sectionKey="advanced" title="Advanced" forceOpen={errorSections.has('advanced')}>
                <FormRow label="Deciding about" hint="Detected from the step above — override it here if the guess is wrong.">
                    <select
                        value={items ? 'items' : 'branch'}
                        onChange={(e) => setRoute(e.target.value === 'items' ? { mode: 'items' } : { mode: 'branch' })}
                        className={inputClass()}
                    >
                        <option value="items">Each item of a list</option>
                        <option value="branch">The whole run</option>
                    </select>
                </FormRow>
                {items && (
                    <CollectionArrayRefField
                        draft={{ arrayRef: route.source || '', maxItems: route.maxItems }}
                        set={(k, v) => setRoute(k === 'arrayRef' ? { source: v } : { maxItems: v })}
                        groups={groups}
                        onFocusField={onFocusField}
                        previewSample={previewSample}
                    />
                )}
                {/* The fan-out opt-in. It is a per-node CHOICE, never a
                    migration: a stored router keeps first-match-wins until
                    someone picks otherwise here, because flipping it for
                    everyone would mean duplicate mails/tickets/API writes for
                    customers who changed nothing (routeModel.js, writeRoute
                    persists 'all' and CLEARS the key for 'first'). */}
                {several && (
                    <FormRow
                        label="When several outputs match"
                        hint="Routines built before this existed keep sending each record down the first match only, until you change it here."
                    >
                        <select
                            value={fanOut ? 'all' : 'first'}
                            onChange={(e) => setRoute({ matchMode: e.target.value === 'all' ? 'all' : 'first' })}
                            className={inputClass()}
                        >
                            <option value="all">Send it to every matching output</option>
                            <option value="first">Send it to the first matching output only</option>
                        </select>
                    </FormRow>
                )}
                {rules.length > 1 && (
                    <FormRow label="When nothing matches" hint="Send unmatched values to one of your rules, or use the node's otherwise output.">
                        <select
                            value={route.defaultBranch || ''}
                            onChange={(e) => setRoute({ defaultBranch: e.target.value })}
                            className={inputClass()}
                        >
                            <option value="">Use the otherwise output</option>
                            {rules.filter(r => r.name).map(r => (
                                <option key={r.name} value={r.name}>{r.name}</option>
                            ))}
                        </select>
                    </FormRow>
                )}
                {expressions.length > 0 && (
                    <FormRow label="Expression" hint="What the rules above compile to. Read-only — edit the rules to change it.">
                        <div className="space-y-1">
                            {expressions.map((e, i) => (
                                <div key={i} className="text-[10px] font-mono text-[var(--text-tertiary)] break-all">{e}</div>
                            ))}
                        </div>
                    </FormRow>
                )}
            </AccordionSection>
        </>
    );
}

/**
 * Named fields of ONE item of the source list, one nesting level deep — the
 * options the rule rows offer in list mode ("Subject", "From · email").
 */
function itemFieldOptions(elementSample) {
    if (elementSample == null || typeof elementSample !== 'object' || Array.isArray(elementSample)) return [];
    const out = [];
    for (const f of sampleToFields(elementSample, 'item')) {
        out.push({ path: f.path, label: humanizeFieldKey(f.key), sample: f.sample, group: 'Fields of each item' });
        for (const c of (f.children || [])) {
            out.push({
                path: c.path,
                label: `${humanizeFieldKey(f.key)} · ${humanizeFieldKey(c.key)}`,
                sample: c.sample,
                group: 'Fields of each item',
            });
        }
    }
    return out;
}

/** Named fields of every upstream step — the options in whole-run mode. */
function upstreamFieldOptions(groups) {
    const out = [];
    for (const g of (groups || [])) {
        for (const f of (g.fields || [])) {
            out.push({ path: f.path, label: humanizeFieldKey(f.key), sample: f.sample, group: g.label });
            for (const c of (f.children || [])) {
                out.push({
                    path: c.path,
                    label: `${humanizeFieldKey(f.key)} · ${humanizeFieldKey(c.key)}`,
                    sample: c.sample,
                    group: g.label,
                });
            }
        }
    }
    return out;
}

/**
 * The one-line "Working through ‹gmail search› · Results — 10 items" summary.
 * Returns null when the path resolves to nothing we can describe, so the form
 * can fall back to showing the raw path with a warning tone.
 */
function describeSourceList(source, groups, previewSample) {
    const path = String(source || '').trim();
    if (!path) return null;
    const match = collectArrayPaths(groups, previewSample).find(a => a.path === path);
    if (!match) return null;
    const owner = (groups || []).find(g => g.basePath && path.startsWith(g.basePath));
    return {
        stepLabel: owner?.label || 'Previous step',
        fieldLabel: humanizeFieldKey(match.key),
        count: Array.isArray(match.sample) ? match.sample.length : null,
    };
}

/**
 * Case-name input that commits on blur/Enter instead of per keystroke.
 *
 * Live-controlled names fed the 600ms autosave half-typed states: a
 * select-all-and-retype passed through `''`, which buildPatch filters out of
 * `patch.cases`, which the edge reconcile then read as "case removed" — and
 * the case's canvas connection was dropped mid-typing (node-audit C1/B1a).
 * Committing only a valid final name means `draft.cases` never holds an
 * empty or duplicate name, so every flushed patch is either a clean rename
 * or an explicit trash-click removal.
 */
function CaseNameInput({ name, siblingNames = [], onCommit }) {
    const [text, setText] = useState(name);
    const [error, setError] = useState(null);
    // Resync when the committed name changes underneath us (AI patch / undo).
    useEffect(() => { setText(name); setError(null); }, [name]);

    const commit = () => {
        const trimmed = String(text || '').trim();
        if (trimmed === name) { setText(name); setError(null); return; }
        if (!trimmed) {
            setText(name);
            setError('Name required — reverted.');
            return;
        }
        if (siblingNames.includes(trimmed)) {
            setError(`A case named “${trimmed}” already exists.`);
            return;
        }
        setError(null);
        onCommit(trimmed);
    };

    return (
        <div className="flex-1 min-w-0">
            <input
                type="text"
                value={text}
                onChange={(e) => { setText(e.target.value); if (error) setError(null); }}
                onBlur={commit}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
                placeholder="case name (becomes the port label)"
                aria-invalid={!!error}
                className={rowInputClass('w-full font-mono', { invalid: !!error })}
            />
            {error && <div className="mt-0.5 text-[10px] text-red-500">{error}</div>}
        </div>
    );
}

/**
 * Typed "value to match" input for a switch case. When the switch expression's
 * datatype is known, render the matching control (number / boolean); otherwise
 * fall back to free text. Storage stays a plain string/number/boolean so the
 * runtime's loose-equality match is unchanged.
 */
function CaseValueInput({ type, value, onChange }) {
    if (type === 'number') {
        return (
            <input
                type="number"
                value={value == null || value === '' ? '' : value}
                onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="number to match"
                className={rowInputClass('w-full')}
            />
        );
    }
    if (type === 'boolean') {
        return (
            <select
                value={value === true ? 'true' : value === false ? 'false' : ''}
                onChange={(e) => onChange(e.target.value === '' ? '' : e.target.value === 'true')}
                className={rowInputClass('w-full')}
            >
                <option value="">(choose)</option>
                <option value="true">true</option>
                <option value="false">false</option>
            </select>
        );
    }
    return (
        <input
            type="text"
            value={typeof value === 'string' ? value : (value == null ? '' : String(value))}
            onChange={(e) => onChange(e.target.value)}
            placeholder="value to match"
            className={rowInputClass('w-full')}
        />
    );
}

function CollectionArrayRefField({ draft, set, groups, onFocusField, previewSample }) {
    // Array-only picker over the SHARED PathField control: friendly quick-picks
    // (nested + real-run arrays via collectArrayPaths), {} variable picker,
    // drag-to-map, name chips, and a soft "isn't a list" warning.
    const quickPicks = useMemo(() => collectArrayPaths(groups, previewSample), [groups, previewSample]);
    return (
        <>
            <FormRow label="Source list" hint="Pick a list from a previous step — or type a path manually.">
                <PathField
                    value={draft.arrayRef || ''}
                    onChange={(v) => set('arrayRef', v)}
                    expectArray
                    quickPicks={quickPicks}
                    onFocusField={onFocusField}
                    previewSample={previewSample}
                    placeholder="No list picked yet"
                />
            </FormRow>
            {/* Optional input cap (C19): read by the runner and validated by
                the server, but previously editable only via the raw JSON
                view — the router even pointed limit's maxItems errors at a
                control that didn't exist. Blank = platform default. */}
            <FormRow label="Max input items" hint="Optional cap on input size — the run FAILS if the source list is larger (platform cap 10 000). Leave blank for the default.">
                <input
                    type="number" min={1} max={10000}
                    value={draft.maxItems === '' || draft.maxItems == null ? '' : draft.maxItems}
                    onChange={(e) => set('maxItems', e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="10000"
                    className={inputClass()}
                />
            </FormRow>
        </>
    );
}

/**
 * Resolve the current element shape of a collection op's source array so its
 * sub-fields (keyField/field, filter's `item.*` conditions) get suggestions
 * with real samples. previewSample is the NDV's merged root (design-time
 * samples + real-run/pinned overlays), so a dry-run upgrades the options.
 */
function useElementSample(arrayRef, previewSample) {
    return useMemo(() => resolveElementSample(arrayRef, previewSample), [arrayRef, previewSample]);
}

function LimitFields({ draft, set, groups, onFocusField, previewSample, errorSections = new Set() }) {
    return (
        <AccordionSection stepType="limit" sectionKey="config" title="Configuration" defaultOpen forceOpen={errorSections.has('config')}>
            <CollectionArrayRefField draft={draft} set={set} groups={groups} onFocusField={onFocusField} previewSample={previewSample} />
            <FormRow label="Which end">
                <select value={draft.mode || 'first'} onChange={(e) => set('mode', e.target.value)} className={inputClass()}>
                    <option value="first">Keep the first few</option>
                    <option value="last">Keep the last few</option>
                </select>
            </FormRow>
            <FormRow label="How many to keep" hint="0 keeps nothing.">
                <input type="number" min={0} value={draft.count ?? 10} onChange={(e) => set('count', Number(e.target.value))} className={inputClass()} />
            </FormRow>
        </AccordionSection>
    );
}

function DedupeFields({ draft, set, groups, onFocusField, previewSample, errorSections = new Set() }) {
    const elementSample = useElementSample(draft.arrayRef, previewSample);
    const options = useMemo(() => elementFieldOptions(elementSample), [elementSample]);
    return (
        <AccordionSection stepType="dedupe" sectionKey="config" title="Configuration" defaultOpen forceOpen={errorSections.has('config')}>
            <CollectionArrayRefField draft={draft} set={set} groups={groups} onFocusField={onFocusField} previewSample={previewSample} />
            <FormRow label="Key field" hint="Optional. Two items with the same value here count as the same item. Leave it blank to drop only items that are identical all the way through.">
                <FieldKeyCombobox value={draft.keyField || ''} onChange={(v) => set('keyField', v)} options={options} placeholder="id" label="Key field" onFocusField={onFocusField} />
            </FormRow>
        </AccordionSection>
    );
}

function AggregateFields({ draft, set, groups, onFocusField, previewSample, errorSections = new Set() }) {
    const elementSample = useElementSample(draft.arrayRef, previewSample);
    const options = useMemo(() => elementFieldOptions(elementSample), [elementSample]);
    return (
        <AccordionSection stepType="aggregate" sectionKey="config" title="Configuration" defaultOpen forceOpen={errorSections.has('config')}>
            <CollectionArrayRefField draft={draft} set={set} groups={groups} onFocusField={onFocusField} previewSample={previewSample} />
            <FormRow label="Field" hint="The field to take from every item. The result is a plain list of just those values. If no item has this field the step is skipped rather than handing on a list of blanks.">
                <FieldKeyCombobox value={draft.field || ''} onChange={(v) => set('field', v)} options={options} placeholder="email" label="Field" onFocusField={onFocusField} />
            </FormRow>
        </AccordionSection>
    );
}

function SummarizeFields({ draft, set, groups, onFocusField, previewSample, errorSections = new Set() }) {
    const elementSample = useElementSample(draft.arrayRef, previewSample);
    const options = useMemo(() => elementFieldOptions(elementSample), [elementSample]);
    return (
        <AccordionSection stepType="summarize" sectionKey="config" title="Configuration" defaultOpen forceOpen={errorSections.has('config')}>
            <CollectionArrayRefField draft={draft} set={set} groups={groups} onFocusField={onFocusField} previewSample={previewSample} />
            {/* `count` ignores the field entirely (it counts items), so asking
                for one there would be misleading. */}
            {draft.op !== 'count' && (
                <FormRow label="Field" hint="The number to work with, read from every item. If no item has this field the step is skipped rather than reporting 0.">
                    <FieldKeyCombobox value={draft.field || ''} onChange={(v) => set('field', v)} options={options} placeholder="amount" label="Field" onFocusField={onFocusField} />
                </FormRow>
            )}
            <FormRow label="What to work out">
                <select value={draft.op || 'sum'} onChange={(e) => set('op', e.target.value)} className={inputClass()}>
                    <option value="sum">Total — add them all up</option>
                    <option value="count">Count — how many items</option>
                    <option value="avg">Average</option>
                    <option value="min">Lowest</option>
                    <option value="max">Highest</option>
                </select>
            </FormRow>
        </AccordionSection>
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
        <div className={cardClass()}>
            <div className="flex items-center gap-1.5">
                <input
                    type="text"
                    defaultValue={bindingKey}
                    onBlur={(e) => onRename(e.target.value)}
                    className={rowInputClass('flex-1 min-w-0 font-mono')}
                    placeholder="key"
                />
                <select
                    value={kind}
                    onChange={(e) => onChange({ kind: e.target.value, ...convertValue(binding, kind, e.target.value) })}
                    className={rowInputClass('px-1.5')}
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
                    className={rowInputClass('w-full')}
                />
            )}
            {kind === 'ref' && (
                <input
                    type="text"
                    value={binding?.path || ''}
                    onChange={(e) => onChange({ path: e.target.value })}
                    placeholder="trigger.output.subject  |  steps.<id>.output.<field>"
                    className={rowInputClass('w-full font-mono')}
                />
            )}
            {kind === 'template' && (
                <textarea
                    rows={2}
                    value={binding?.value || ''}
                    onChange={(e) => onChange({ value: e.target.value })}
                    placeholder="Re: {{trigger.output.subject}}"
                    className={rowInputClass('w-full font-mono resize-y')}
                />
            )}
            {kind === 'expr' && (
                <input
                    type="text"
                    value={binding?.value || ''}
                    onChange={(e) => onChange({ value: e.target.value })}
                    placeholder="steps.x.output.amount > 1000"
                    className={rowInputClass('w-full font-mono')}
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
                <div key={i} className={cardClass()}>
                    <div className="flex items-center gap-1.5">
                        <input
                            type="text"
                            value={f.key || ''}
                            onChange={(e) => update(i, { key: e.target.value })}
                            placeholder="fieldName"
                            className={rowInputClass('flex-1 min-w-0 font-mono')}
                        />
                        <select
                            value={f.type || 'string'}
                            onChange={(e) => update(i, { type: e.target.value })}
                            className={rowInputClass('px-1.5')}
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
                        className={rowInputClass('w-full')}
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
            <div className={subLabelClass()}>
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
                        className={rowInputClass('flex-1 min-w-0 font-mono')}
                    />
                    <select
                        value={c.type || 'string'}
                        onChange={(e) => update(i, { type: e.target.value })}
                        className={rowInputClass('px-1.5')}
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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Save, RotateCcw, Plus, Trash2 } from 'lucide-react';
import { tierLabel } from '../../../../tierMeta';
import useAutomationApi from '../../../../../hooks/useAutomationApi';
import ToolInputForm from '../mapping/ToolInputForm';
import ConditionBuilder from '../mapping/ConditionBuilder';
import LoopOverPicker from '../mapping/LoopOverPicker';
import TemplateField from '../mapping/TemplateField';

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

    const dirty = useMemo(() => !deepEqual(draft, baseline), [draft, baseline]);

    // Same-id content sync: when the parent re-renders with new step
    // content (e.g. server confirmed our last save, or chat updated the
    // label), adopt the incoming state IF the user has no local edits.
    // If the user IS mid-edit, just slide baseline forward so `dirty`
    // stays accurate against the new server state — the user's edits
    // remain in `draft` and the next autosave reconciles.
    useEffect(() => {
        const incoming = extractFormState(step);
        if (deepEqual(incoming, baselineRef.current)) return;
        const userHasEdits = !deepEqual(draft, baselineRef.current);
        baselineRef.current = incoming;
        setBaseline(incoming);
        if (!userHasEdits) setDraft(incoming);
    }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

    const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
    const setNested = (parent, k, v) => setDraft(d => ({ ...d, [parent]: { ...(d[parent] || {}), [k]: v } }));

    // Latest-state refs so the unmount flusher always sees the current
    // step+draft. Closures captured at mount would be stale.
    const onPatchRef = useRef(onPatch);
    const stepRef = useRef(step);
    const draftRef = useRef(draft);
    useEffect(() => { onPatchRef.current = onPatch; stepRef.current = step; draftRef.current = draft; });

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
    }, [draft, dirty, saving, saveError]); // eslint-disable-line react-hooks/exhaustive-deps

    // Flush on unmount — covers step change (parent re-keys us), panel
    // close, page navigation. Without this, clicking another node within
    // 600ms of typing would silently discard the edit.
    useEffect(() => () => { flushNow(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            {(stepIssues.errors.length > 0 || stepIssues.warnings.length > 0) && (
                <div className="flex-shrink-0 px-3 py-2 border-b border-[var(--border-default)]">
                    {stepIssues.errors.map((e, i) => <ValidationLine key={`e-${i}`} record={e} />)}
                    {stepIssues.warnings.map((w, i) => <ValidationLine key={`w-${i}`} record={w} />)}
                </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
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
                    <AiStepFields
                        draft={draft} set={set} modelTiers={modelTiers}
                        onFocusField={onFocusField} previewSample={previewSample}
                    />
                )}

                {step.type === 'integration_action' && (
                    <IntegrationActionFields
                        step={step} draft={draft} set={set}
                        catalog={catalog}
                        onFocusField={onFocusField} previewSample={previewSample}
                    />
                )}

                {step.type === 'condition' && (
                    <FormRow label="Expression" hint="Pick a field, an operator, and a value — or write a raw restricted-JS expression.">
                        <ConditionBuilder
                            value={draft.expr || ''}
                            onChange={(next) => set('expr', next)}
                            onFocusField={onFocusField}
                            previewSample={previewSample}
                        />
                    </FormRow>
                )}

                {step.type === 'loop' && (
                    <LoopFields
                        draft={draft} set={set}
                        groups={groups} onFocusField={onFocusField}
                    />
                )}

                {step.type === 'code' && (
                    <CodeFields draft={draft} set={set} />
                )}

                {step.type === 'notification' && (
                    <NotificationFields
                        draft={draft} set={set}
                        onFocusField={onFocusField} previewSample={previewSample}
                    />
                )}

                {step.type === 'set' && (
                    <SetFields draft={draft} set={set} onFocusField={onFocusField} previewSample={previewSample} />
                )}
                {step.type === 'datetime' && (
                    <DateTimeFields draft={draft} set={set} groups={groups} />
                )}
                {step.type === 'wait' && (
                    <WaitFields draft={draft} set={set} />
                )}
                {step.type === 'stop_error' && (
                    <StopErrorFields draft={draft} set={set} onFocusField={onFocusField} previewSample={previewSample} />
                )}
                {step.type === 'switch' && (
                    <SwitchFields draft={draft} set={set} onFocusField={onFocusField} previewSample={previewSample} />
                )}
                {step.type === 'filter' && (
                    <FilterFields draft={draft} set={set} groups={groups} onFocusField={onFocusField} previewSample={previewSample} />
                )}
                {step.type === 'limit' && (
                    <LimitFields draft={draft} set={set} groups={groups} onFocusField={onFocusField} />
                )}
                {step.type === 'dedupe' && (
                    <DedupeFields draft={draft} set={set} groups={groups} onFocusField={onFocusField} />
                )}
                {step.type === 'aggregate' && (
                    <AggregateFields draft={draft} set={set} groups={groups} onFocusField={onFocusField} />
                )}
                {step.type === 'summarize' && (
                    <SummarizeFields draft={draft} set={set} groups={groups} onFocusField={onFocusField} />
                )}

                <div className="text-[11px] text-[var(--text-tertiary)]">
                    Anything not on this form lives in the JSON tab.
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
                <AppEventFields draft={draft} set={set} setNested={setNested} />
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

// ── Trigger filter sub-forms (one per (provider, event)) ───────────────
//
// All filters reuse FilterShell as chrome and the standard input/textarea
// helpers — keeps the visual language consistent with the Gmail filter
// users already know. Each field's onChange clears its key when the
// input is empty (`undefined`) so the persisted filter object stays
// minimal and the matcher's "if filter.X is set" checks short-circuit.

function FilterShell({ title, children }) {
    return (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 space-y-3">
            <div className="text-[11px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)]">{title}</div>
            {children}
        </div>
    );
}

function GmailLabelFilterFields({ filter, setFilter }) {
    return (
        <FilterShell title="Gmail label.added filter (labelId is required)">
            <FormRow label="Label id" hint="Gmail label ids look like Label_3 or system ids like IMPORTANT / STARRED. Use a gmail_search step once to find the id if needed.">
                <input type="text" value={filter.labelId || ''} onChange={(e) => setFilter('labelId', e.target.value || undefined)}
                    placeholder="Label_3" className={inputClass()} />
            </FormRow>
            <FormRow label="From contains">
                <input type="text" value={filter.from || ''} onChange={(e) => setFilter('from', e.target.value || undefined)} className={inputClass()} />
            </FormRow>
            <FormRow label="Subject contains">
                <input type="text" value={filter.subjectContains || ''} onChange={(e) => setFilter('subjectContains', e.target.value || undefined)} className={inputClass()} />
            </FormRow>
            <FormRow label="Exclude labels (comma-separated)" hint="Drops messages that already carry any of these labels.">
                <input
                    type="text"
                    value={Array.isArray(filter.excludeLabelIds) ? filter.excludeLabelIds.join(',') : ''}
                    onChange={(e) => {
                        const arr = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                        setFilter('excludeLabelIds', arr.length ? arr : undefined);
                    }}
                    className={inputClass() + ' font-mono'}
                />
            </FormRow>
        </FilterShell>
    );
}

function CalendarChangedFilterFields({ filter, setFilter }) {
    return (
        <FilterShell title="Calendar event.changed filter (all optional)">
            <FormRow label="Calendar id" hint="Default 'primary'. Use a different calendar id if you've connected secondary calendars.">
                <input type="text" value={filter.calendarId || ''} onChange={(e) => setFilter('calendarId', e.target.value || undefined)}
                    placeholder="primary" className={inputClass() + ' font-mono'} />
            </FormRow>
            <FormRow label="Status">
                <select
                    value={filter.statusEquals || ''}
                    onChange={(e) => setFilter('statusEquals', e.target.value || undefined)}
                    className={inputClass()}
                >
                    <option value="">Any</option>
                    <option value="confirmed">confirmed</option>
                    <option value="cancelled">cancelled</option>
                    <option value="tentative">tentative</option>
                </select>
            </FormRow>
            <FormRow label="Attendee email contains">
                <input type="text" value={filter.attendeeEmailContains || ''} onChange={(e) => setFilter('attendeeEmailContains', e.target.value || undefined)}
                    className={inputClass()} />
            </FormRow>
        </FilterShell>
    );
}

function CalendarUpcomingFilterFields({ filter, setFilter }) {
    return (
        <FilterShell title="Calendar event.upcoming filter">
            <FormRow label="Lead minutes" hint="Fire this many minutes before the event starts. Default 15.">
                <input
                    type="number"
                    min={1}
                    max={240}
                    value={filter.leadMinutes ?? 15}
                    onChange={(e) => setFilter('leadMinutes', e.target.value === '' ? undefined : Number(e.target.value))}
                    className={inputClass()}
                />
            </FormRow>
            <FormRow label="Calendar id">
                <input type="text" value={filter.calendarId || ''} onChange={(e) => setFilter('calendarId', e.target.value || undefined)}
                    placeholder="primary" className={inputClass() + ' font-mono'} />
            </FormRow>
            <FormRow label="Include all-day events">
                <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={filter.includeAllDay === true} onChange={(e) => setFilter('includeAllDay', e.target.checked || undefined)} />
                    Yes — fire on all-day events too
                </label>
            </FormRow>
            <FormRow label="Attendee email contains">
                <input type="text" value={filter.attendeeEmailContains || ''} onChange={(e) => setFilter('attendeeEmailContains', e.target.value || undefined)}
                    className={inputClass()} />
            </FormRow>
        </FilterShell>
    );
}

function DriveFileNewFilterFields({ filter, setFilter }) {
    return (
        <FilterShell title="Drive file.new filter (all optional)">
            <FormRow label="Folder id" hint="Drive folder id. Find via drive_search or by copying from the URL: drive.google.com/drive/folders/<id>.">
                <input type="text" value={filter.folderId || ''} onChange={(e) => setFilter('folderId', e.target.value || undefined)}
                    className={inputClass() + ' font-mono'} />
            </FormRow>
            <FormRow label="MIME type" hint="e.g. application/pdf, image/jpeg, application/vnd.google-apps.document.">
                <input type="text" value={filter.mimeType || ''} onChange={(e) => setFilter('mimeType', e.target.value || undefined)}
                    placeholder="application/pdf" className={inputClass() + ' font-mono'} />
            </FormRow>
            <FormRow label="Name contains">
                <input type="text" value={filter.nameContains || ''} onChange={(e) => setFilter('nameContains', e.target.value || undefined)}
                    className={inputClass()} />
            </FormRow>
            <FormRow label="Exclude my own uploads">
                <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={filter.excludeOwnUploads === true} onChange={(e) => setFilter('excludeOwnUploads', e.target.checked || undefined)} />
                    Skip files I uploaded
                </label>
            </FormRow>
        </FilterShell>
    );
}

function NextcloudFileFilterFields({ filter, setFilter }) {
    return (
        <FilterShell title="Nextcloud file filter (all optional)">
            <FormRow label="In folder" hint="Path prefix, e.g. /Invoices. Files outside this folder are skipped.">
                <input type="text" value={filter.inFolder || ''} onChange={(e) => setFilter('inFolder', e.target.value || undefined)}
                    placeholder="/Invoices" className={inputClass() + ' font-mono'} />
            </FormRow>
            <FormRow label="Extension" hint="Without dot, e.g. pdf.">
                <input type="text" value={filter.extension || ''} onChange={(e) => setFilter('extension', e.target.value || undefined)}
                    placeholder="pdf" className={inputClass() + ' font-mono'} />
            </FormRow>
            <FormRow label="Name contains">
                <input type="text" value={filter.nameContains || ''} onChange={(e) => setFilter('nameContains', e.target.value || undefined)}
                    className={inputClass()} />
            </FormRow>
            <FormRow label="Exclude my own actions">
                <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={filter.excludeOwnUploads === true} onChange={(e) => setFilter('excludeOwnUploads', e.target.checked || undefined)} />
                    Skip files I created/edited
                </label>
            </FormRow>
            <div className="text-[11px] text-[var(--text-tertiary)] leading-snug">
                Manual runs use a <code>null</code> trigger payload — set a sample under Settings → Manual trigger payload to test bindings.
            </div>
        </FilterShell>
    );
}

function NextcloudShareFilterFields({ filter, setFilter }) {
    return (
        <FilterShell title="Nextcloud share.received filter">
            <FormRow label="Sharer (actor) equals" hint="Nextcloud username (uid) of the person who shared the item.">
                <input type="text" value={filter.actorEquals || ''} onChange={(e) => setFilter('actorEquals', e.target.value || undefined)}
                    className={inputClass() + ' font-mono'} />
            </FormRow>
            <FormRow label="Kind">
                <select
                    value={filter.kindEquals || ''}
                    onChange={(e) => setFilter('kindEquals', e.target.value || undefined)}
                    className={inputClass()}
                >
                    <option value="">Any (file or folder)</option>
                    <option value="file">file</option>
                    <option value="folder">folder</option>
                </select>
            </FormRow>
            <FormRow label="Name contains">
                <input type="text" value={filter.nameContains || ''} onChange={(e) => setFilter('nameContains', e.target.value || undefined)}
                    className={inputClass()} />
            </FormRow>
        </FilterShell>
    );
}

function NextcloudActivityFilterFields({ filter, setFilter }) {
    return (
        <FilterShell title="Nextcloud activity filter (advanced)">
            <FormRow label="Activity type" hint="Raw activity slug (e.g. file_created, comments, deck). Leave empty to match every type — and prefer file.new / file.changed / share.received as dedicated triggers.">
                <input type="text" value={filter.type || ''} onChange={(e) => setFilter('type', e.target.value || undefined)}
                    placeholder="comments" className={inputClass() + ' font-mono'} />
            </FormRow>
            <FormRow label="Object name contains">
                <input type="text" value={filter.objectNameContains || ''} onChange={(e) => setFilter('objectNameContains', e.target.value || undefined)}
                    className={inputClass()} />
            </FormRow>
            <FormRow label="Actor equals">
                <input type="text" value={filter.actorEquals || ''} onChange={(e) => setFilter('actorEquals', e.target.value || undefined)}
                    className={inputClass() + ' font-mono'} />
            </FormRow>
        </FilterShell>
    );
}

function NextcloudNotificationFilterFields({ filter, setFilter }) {
    return (
        <FilterShell title="Nextcloud notification filter">
            <FormRow label="App" hint="Source app id (e.g. spreed, files_sharing, dav, updatenotification).">
                <input type="text" value={filter.app || ''} onChange={(e) => setFilter('app', e.target.value || undefined)}
                    placeholder="spreed" className={inputClass() + ' font-mono'} />
            </FormRow>
            <FormRow label="Subject contains">
                <input type="text" value={filter.subjectContains || ''} onChange={(e) => setFilter('subjectContains', e.target.value || undefined)}
                    className={inputClass()} />
            </FormRow>
        </FilterShell>
    );
}

/**
 * Picker for the org's Ticket Assistant connections — lazy-loads the
 * list once on mount via `useAutomationApi.listTicketAssistantConnections`.
 * Falls back to a free-text input on fetch error so the user can still
 * paste a connectionId they know.
 */
function TicketAssistantConnectionPicker({ value, onChange }) {
    const api = useAutomationApi();
    const [conns, setConns] = useState(null); // null = loading; [] = loaded empty; array = loaded
    const [error, setError] = useState(null);

    useEffect(() => {
        let alive = true;
        api.listTicketAssistantConnections()
            .then(d => { if (alive) setConns(d.connections || []); })
            .catch(e => { if (alive) setError(e.message || 'Failed to load connections'); })
            // eslint-disable-next-line no-unused-vars
            .finally(() => {});
        return () => { alive = false; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    if (error) {
        return (
            <input
                type="text"
                value={value || ''}
                onChange={(e) => onChange(e.target.value || undefined)}
                placeholder="connection id"
                className={inputClass() + ' font-mono'}
            />
        );
    }
    if (conns === null) {
        return <div className="text-xs text-[var(--text-tertiary)] py-1.5">Loading connections…</div>;
    }
    return (
        <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value || undefined)}
            className={inputClass()}
        >
            <option value="">Any connection</option>
            {conns.map(c => (
                <option key={c.id} value={c.id}>
                    {c.display_name || c.email_address} ({c.provider})
                </option>
            ))}
        </select>
    );
}

function TicketAssistantTicketFilterFields({ filter, setFilter }) {
    return (
        <FilterShell title="Ticket Assistant ticket.new filter">
            <FormRow label="Connection" hint="Restrict to one of the org's Ticket Assistant connections.">
                <TicketAssistantConnectionPicker
                    value={filter.connectionId}
                    onChange={(v) => setFilter('connectionId', v)}
                />
            </FormRow>
            <FormRow label="Provider">
                <select
                    value={filter.provider || ''}
                    onChange={(e) => setFilter('provider', e.target.value || undefined)}
                    className={inputClass()}
                >
                    <option value="">Any provider</option>
                    <option value="gmail">Gmail</option>
                    <option value="outlook">Outlook</option>
                    <option value="jira">Jira</option>
                    <option value="servicenow">ServiceNow</option>
                    <option value="zendesk">Zendesk</option>
                    <option value="freshservice">Freshservice</option>
                    <option value="topdesk">TopDesk</option>
                </select>
            </FormRow>
            <FormRow label="Subject contains">
                <input type="text" value={filter.subjectContains || ''} onChange={(e) => setFilter('subjectContains', e.target.value || undefined)}
                    className={inputClass()} />
            </FormRow>
            <FormRow label="Body contains">
                <input type="text" value={filter.bodyContains || ''} onChange={(e) => setFilter('bodyContains', e.target.value || undefined)}
                    className={inputClass()} />
            </FormRow>
            <FormRow label="Category equals" hint="The AI-classified category (post-summarise). Free text — no enum yet.">
                <input type="text" value={filter.categoryEquals || ''} onChange={(e) => setFilter('categoryEquals', e.target.value || undefined)}
                    className={inputClass()} />
            </FormRow>
            <FormRow label="Priority equals">
                <select
                    value={filter.priorityEquals || ''}
                    onChange={(e) => setFilter('priorityEquals', e.target.value || undefined)}
                    className={inputClass()}
                >
                    <option value="">Any</option>
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                    <option value="urgent">urgent</option>
                </select>
            </FormRow>
            <FormRow label="Status equals" hint="Provider-native status (e.g. 'Open', 'In Progress') OR a normalised bucket: open / pending / resolved / closed.">
                <input type="text" value={filter.statusEquals || ''} onChange={(e) => setFilter('statusEquals', e.target.value || undefined)}
                    className={inputClass()} />
            </FormRow>
            <div className="text-[11px] text-[var(--text-tertiary)] leading-snug">
                Manual runs of this trigger use a <code>null</code> payload — set a sample under Settings → Manual trigger payload to test bindings before activating.
            </div>
        </FilterShell>
    );
}

function TicketAssistantSyncFilterFields({ filter, setFilter }) {
    return (
        <FilterShell title="Ticket Assistant sync.completed filter">
            <FormRow label="Connection">
                <TicketAssistantConnectionPicker
                    value={filter.connectionId}
                    onChange={(v) => setFilter('connectionId', v)}
                />
            </FormRow>
            <FormRow label="Outcome">
                <select
                    value={filter.outcomeEquals || ''}
                    onChange={(e) => setFilter('outcomeEquals', e.target.value || undefined)}
                    className={inputClass()}
                >
                    <option value="">Any outcome</option>
                    <option value="success">success</option>
                    <option value="partial">partial (some errors)</option>
                    <option value="error">error</option>
                </select>
            </FormRow>
        </FilterShell>
    );
}

function AiStepFields({ draft, set, modelTiers, onFocusField, previewSample }) {
    return (
        <>
            <FormRow label="Prompt" hint="The instruction the AI runs. Insert variables with the panel on the right — they become {{path}} references.">
                <TemplateField
                    value={draft.prompt || ''}
                    onChange={(next) => set('prompt', next)}
                    rows={6}
                    onFocusField={onFocusField}
                    previewSample={previewSample}
                    placeholder="Summarise this email and decide if it needs an urgent reply."
                />
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
            <FormRow label="Inputs" hint="Named values the AI can read alongside the prompt. Reference them in the prompt as {{name}}.">
                <ToolInputForm
                    inputs={draft.inputs || {}}
                    onChange={(next) => set('inputs', next)}
                    inputSchema={null}
                    onFocusField={onFocusField}
                    previewSample={previewSample}
                />
            </FormRow>
            <FormRow label="Structured output" hint="Define the JSON fields the AI should return. Downstream steps can then reference them via steps.<id>.output.<field>. Leave empty for free-form text.">
                <StructuredOutputFields
                    fields={draft.outputFields || []}
                    onChange={(next) => set('outputFields', next)}
                />
            </FormRow>
        </>
    );
}

function IntegrationActionFields({ step, draft, set, catalog, onFocusField, previewSample }) {
    const inputSchema = useMemo(
        () => findInputSchemaForTool(catalog, step.tool),
        [catalog, step.tool],
    );
    return (
        <>
            <FormRow label="Tool" hint="To switch tool, remove this step and add a new one — different tools have different inputs.">
                <div className="text-sm font-mono text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded px-2 py-1.5">
                    {step.tool || '—'}
                </div>
            </FormRow>
            <FormRow label="Inputs" hint={inputSchema ? 'Field values passed to the tool. Pick a variable from the right panel to bind upstream output.' : 'No schema found for this tool — using generic key/value rows.'}>
                <ToolInputForm
                    inputs={draft.inputs || {}}
                    onChange={(next) => set('inputs', next)}
                    inputSchema={inputSchema}
                    onFocusField={onFocusField}
                    previewSample={previewSample}
                />
            </FormRow>
        </>
    );
}

function findInputSchemaForTool(catalog, toolName) {
    if (!catalog?.apps || !toolName) return null;
    for (const app of catalog.apps) {
        const action = (app.actions || []).find(a => a.name === toolName);
        if (action) return action.inputSchema || null;
    }
    return null;
}

function LoopFields({ draft, set, groups, onFocusField }) {
    return (
        <>
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

function NotificationFields({ draft, set, onFocusField, previewSample }) {
    return (
        <>
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
            <FormRow label="Body" hint="Click a variable in the right panel to insert {{path}}.">
                <TemplateField
                    value={draft.body || ''}
                    onChange={(next) => set('body', next)}
                    rows={4}
                    onFocusField={onFocusField}
                    previewSample={previewSample}
                    placeholder="From: {{trigger.output.from}}\nSubject: {{trigger.output.subject}}"
                />
            </FormRow>
        </>
    );
}

// ── n8n-style utility node forms ──────────────────────────────────────

function SetFields({ draft, set, onFocusField, previewSample }) {
    return (
        <FormRow label="Fields" hint="Build the output object from explicit field bindings.">
            <ToolInputForm
                inputs={draft.fields || {}}
                onChange={(next) => set('fields', next)}
                inputSchema={null}
                onFocusField={onFocusField}
                previewSample={previewSample}
            />
        </FormRow>
    );
}

function DateTimeFields({ draft, set, groups }) {
    const op = draft.op || 'now';
    const needsInput = op !== 'now';
    const needsInput2 = op === 'diff';
    const needsAmount = op === 'addDays' || op === 'addHours' || op === 'addMinutes';
    return (
        <>
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
        </>
    );
}

function WaitFields({ draft, set }) {
    return (
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
    );
}

function StopErrorFields({ draft, set, onFocusField, previewSample }) {
    return (
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
    );
}

function SwitchFields({ draft, set, onFocusField, previewSample }) {
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
            <FormRow label="Expression" hint="Evaluated once; the value is matched against each case below (loose equality).">
                <ConditionBuilder
                    value={draft.expr || ''}
                    onChange={(next) => set('expr', next)}
                    onFocusField={onFocusField}
                    previewSample={previewSample}
                />
            </FormRow>
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
            <FormRow label="Default branch" hint="Optional case name to route to when no other case matches.">
                <input type="text" value={draft.defaultBranch || ''} onChange={(e) => set('defaultBranch', e.target.value)} placeholder="(no default — unmatched dead-ends)" className={inputClass() + ' font-mono'} />
            </FormRow>
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

function FilterFields({ draft, set, groups, onFocusField, previewSample }) {
    return (
        <>
            <CollectionArrayRefField draft={draft} set={set} groups={groups} />
            <FormRow label="Keep when" hint="Restricted expression. The current element is bound as `item`, e.g. `item.amount > 1000`.">
                <ConditionBuilder
                    value={draft.expr || ''}
                    onChange={(next) => set('expr', next)}
                    onFocusField={onFocusField}
                    previewSample={previewSample}
                />
            </FormRow>
        </>
    );
}

function LimitFields({ draft, set, groups }) {
    return (
        <>
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
        </>
    );
}

function DedupeFields({ draft, set, groups }) {
    return (
        <>
            <CollectionArrayRefField draft={draft} set={set} groups={groups} />
            <FormRow label="Key field" hint="Optional. Without it, items are compared by deep equality.">
                <input type="text" value={draft.keyField || ''} onChange={(e) => set('keyField', e.target.value)} placeholder="id" className={inputClass() + ' font-mono'} />
            </FormRow>
        </>
    );
}

function AggregateFields({ draft, set, groups }) {
    return (
        <>
            <CollectionArrayRefField draft={draft} set={set} groups={groups} />
            <FormRow label="Field" hint="Field to read from every item — output.values is the flat list.">
                <input type="text" value={draft.field || ''} onChange={(e) => set('field', e.target.value)} placeholder="email" className={inputClass() + ' font-mono'} />
            </FormRow>
        </>
    );
}

function SummarizeFields({ draft, set, groups }) {
    return (
        <>
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
        </>
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
            outputFields: schemaToFields(step.outputSchema),
        };
    }
    if (step.type === 'integration_action') {
        return { ...base, inputs: step.inputs || {} };
    }
    if (step.type === 'condition')    return { ...base, expr: step.expr || '' };
    if (step.type === 'loop')         return { ...base, overRef: step.overRef || '', itemVar: step.itemVar || '', maxIterations: step.maxIterations ?? 100 };
    if (step.type === 'code')         return { ...base, code: step.code || '' };
    if (step.type === 'notification') return { ...base, title: step.title || '', body: step.body || '' };
    // n8n-style utility nodes
    if (step.type === 'set')          return { ...base, fields: step.fields || {} };
    if (step.type === 'datetime')     return {
        ...base,
        op: step.op || 'now',
        input: step.input || '',
        input2: step.input2 || '',
        amount: typeof step.amount === 'number' ? step.amount : 0,
        format: step.format || 'yyyy-MM-dd HH:mm',
        part: step.part || 'year',
        unit: step.unit || 'days',
    };
    if (step.type === 'wait')         return { ...base, seconds: typeof step.seconds === 'number' ? step.seconds : 5 };
    if (step.type === 'stop_error')   return { ...base, message: step.message || '' };
    if (step.type === 'switch')       return {
        ...base,
        expr: step.expr || '',
        cases: Array.isArray(step.cases) ? step.cases : [],
        defaultBranch: step.defaultBranch || '',
    };
    if (step.type === 'filter')       return { ...base, arrayRef: step.arrayRef || '', expr: step.expr || '' };
    if (step.type === 'limit')        return { ...base, arrayRef: step.arrayRef || '', count: typeof step.count === 'number' ? step.count : 10, mode: step.mode || 'first' };
    if (step.type === 'dedupe')       return { ...base, arrayRef: step.arrayRef || '', keyField: step.keyField || '' };
    if (step.type === 'aggregate')    return { ...base, arrayRef: step.arrayRef || '', field: step.field || '' };
    if (step.type === 'summarize')    return { ...base, arrayRef: step.arrayRef || '', field: step.field || '', op: step.op || 'sum' };
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
        patch.outputSchema = fieldsToSchema(draft.outputFields || []);
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
    // n8n-style utility nodes
    if (step.type === 'set') {
        patch.fields = sanitizeInputs(draft.fields || {});
    }
    if (step.type === 'datetime') {
        patch.op = draft.op || 'now';
        patch.input = draft.input || undefined;
        patch.input2 = draft.input2 || undefined;
        patch.amount = typeof draft.amount === 'number' ? draft.amount : undefined;
        patch.format = draft.format || undefined;
        patch.part = draft.part || undefined;
        patch.unit = draft.unit || undefined;
    }
    if (step.type === 'wait')       patch.seconds = clamp(Number(draft.seconds) || 1, 1, 86400);
    if (step.type === 'stop_error') patch.message = draft.message || '';
    if (step.type === 'switch') {
        patch.expr = draft.expr || '';
        patch.cases = Array.isArray(draft.cases) ? draft.cases.filter(c => c && c.name) : [];
        patch.defaultBranch = draft.defaultBranch?.trim() ? draft.defaultBranch.trim() : null;
    }
    if (step.type === 'filter') {
        patch.arrayRef = draft.arrayRef || '';
        patch.expr = draft.expr || '';
    }
    if (step.type === 'limit') {
        patch.arrayRef = draft.arrayRef || '';
        patch.count = Math.max(0, Math.floor(Number(draft.count) || 0));
        patch.mode = draft.mode === 'last' ? 'last' : 'first';
    }
    if (step.type === 'dedupe') {
        patch.arrayRef = draft.arrayRef || '';
        patch.keyField = draft.keyField?.trim() ? draft.keyField.trim() : undefined;
    }
    if (step.type === 'aggregate') {
        patch.arrayRef = draft.arrayRef || '';
        patch.field = draft.field || '';
    }
    if (step.type === 'summarize') {
        patch.arrayRef = draft.arrayRef || '';
        patch.field = draft.field || '';
        patch.op = draft.op || 'sum';
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

/**
 * Structural deep-equal for plain JSON values. Replaces JSON.stringify
 * comparisons whose key-order instability could either claim dirty=false
 * for real changes (Save button greys out) or dirty=true after a no-op
 * baseline update (autosave loop).
 */
function deepEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
        return true;
    }
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (!deepEqual(a[k], b[k])) return false;
    return true;
}

// ── AI step structured-output helpers ──────────────────────────────────
//
// We support two shapes the runtime accepts (server/core/automationRunner.js
// stringifies `effectiveSchema` verbatim and tells the model "match this"):
//   1. JSON Schema:   { type:'object', properties:{ name:{type:'string'} } }
//   2. Flat:          { name:'string' }
// On read we accept both; on write we always emit shape #1 so the AI builder
// and templates (templates.js uses JSON Schema) round-trip cleanly.

const OUTPUT_FIELD_TYPES = ['string', 'number', 'boolean', 'object', 'array'];

function schemaToFields(schema) {
    if (!schema || typeof schema !== 'object') return [];
    const props = schema.properties && typeof schema.properties === 'object'
        ? schema.properties
        : schema;
    const out = [];
    for (const [key, spec] of Object.entries(props || {})) {
        if (!key) continue;
        if (typeof spec === 'string') {
            out.push({ key, type: OUTPUT_FIELD_TYPES.includes(spec) ? spec : 'string', description: '' });
        } else if (spec && typeof spec === 'object') {
            out.push({
                key,
                type: OUTPUT_FIELD_TYPES.includes(spec.type) ? spec.type : 'string',
                description: typeof spec.description === 'string' ? spec.description : '',
            });
        }
    }
    return out;
}

function fieldsToSchema(fields) {
    const valid = (fields || []).filter(f => f && typeof f.key === 'string' && f.key.trim());
    if (valid.length === 0) return null;
    const properties = {};
    for (const f of valid) {
        const spec = { type: OUTPUT_FIELD_TYPES.includes(f.type) ? f.type : 'string' };
        if (f.description && f.description.trim()) spec.description = f.description.trim();
        properties[f.key.trim()] = spec;
    }
    return { type: 'object', properties };
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

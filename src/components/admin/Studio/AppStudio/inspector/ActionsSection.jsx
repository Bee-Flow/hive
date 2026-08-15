import { FlaskConical, Trash2, Users, Workflow, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { describeAction } from './actionLabels';
import AiActionEditor from './AiActionEditors';
import { bindingForField } from './aiFieldMatching';
import ActionFlowEditor from '../flow/ActionFlowEditor';
import StepSettings from '../flow/StepSettings';
import ExpressionInput from './logic/ExpressionInput';
import { mergeDrafts, splitNamed } from './keyedRows';
import { INPUT_CLS } from './panels/kit';
import RoutinePicker from './RoutinePicker';
import { ACTION_KINDS, TOAST_TONES, TYPE_EVENT_LISTS, INPUT_TYPES } from './styleKnobMeta';
import useAutomationApi from '../../../../../hooks/useAutomationApi';
import { API_BASE, authFetch } from '../../../../../utils/helpers';
import ConfirmDialog from '../../../../shared/ConfirmDialog';
import FormField from '../../../../shared/FormField';
import Modal from '../../../../shared/Modal';
import IconButton from '../../../../shared/IconButton';
import SegmentedControl from '../../../../shared/SegmentedControl';
import Spinner from '../../../../shared/Spinner';
import toast from '../../../../shared/Toast';
import Toggle from '../../../../shared/Toggle';
import { getComponentEntry } from '../runtime/componentRegistry';
import { findNode, setAction, setNodeEvent, removeAction, NODE_EVENTS } from '../state/definitionOps';

/**
 * ActionsSection — wires each event a node's type supports (styleKnobMeta.
 * TYPE_EVENT_LISTS: button onClick, form onSubmit, data_grid/timeline/calendar
 * onRowClick, data_grid onRowSelect, kanban onCardMove) to an action and edits
 * that action inline. The action vocabulary mirrors ACTION_SPECS in
 * server/appStudio/componentSpecs.js (authoritative):
 *
 *   run_automation { automationId, inputMapping?, onSuccess?, onError? }
 *   navigate       { screenId }
 *   toast          { message, tone? }
 *   open_url       { url, newTab? }
 *
 * A `sequence` is authored on the flow canvas (flow/ActionFlowEditor), which is
 * where every control-flow and data step lives; this section is the entry point
 * to it and the editor for the single-step kinds.
 *
 * inputMapping values: {kind:'static',value} | {kind:'field',name}. Effects
 * are bounded: { toast?: {message,tone}, navigateTo? } — never chains.
 * Every edit commits immediately via setAction/setNodeEvent/removeAction +
 * onCommit(nextDef).
 *
 * An action lives in definition.actions — ONE object that any number of
 * components can point at. Wiring an existing one therefore SHARES it (later
 * edits reach every component using it) and deleting one unhooks all of them,
 * so this section counts the other users of each action, says so before an
 * edit or a delete, and offers a fork ("Only for this one").
 *
 * "Test" fires POST /api/automation/:id/run (see server/routes/automation/
 * runs.js) with the mapping's STATIC values as triggerPayload; the response
 * is { accepted, run, steps } (200), { accepted, pending, message } (202) or
 * { error } — rendered in a capped pre box and forwarded to
 * onTestActionResult(actionId, body).
 */

const KIND_OPTIONS = [
    { value: 'run_automation', label: 'Run routine' },
    { value: 'ai_extract', label: 'AI · extract from document' },
    { value: 'ai_generate', label: 'AI · generate / summarize' },
    { value: 'kb_query', label: 'AI · search knowledge base' },
    { value: 'navigate', label: 'Go to screen' },
    { value: 'toast', label: 'Show a message' },
    { value: 'open_url', label: 'Open a web page' },
    // These three were AI-only too: an action of a kind the select did not list
    // displayed as "Run routine" and the first change to it silently replaced
    // the whole thing. Every kind the schema defines is now a choice, and the
    // multi-step ones are edited on the flow canvas.
    { value: 'open_modal', label: 'Open a dialog' },
    { value: 'close_modal', label: 'Close a dialog' },
    { value: 'send_email', label: 'Send an e-mail' },
    { value: 'sequence', label: 'Several steps (a flow)' },
];

const AI_KINDS = ['ai_extract', 'ai_generate', 'kb_query'];

// Kinds whose editor comes straight from the server spec (see StepSettings).
const SPEC_EDITED_KINDS = new Set(['open_modal', 'close_modal', 'send_email']);

// Human label per event slot.
const EVENT_LABELS = {
    onClick: 'When clicked',
    onSubmit: 'When submitted',
    onRowClick: 'When a row is clicked',
    onRowSelect: 'When a row is selected',
    onCardMove: 'When a card is moved',
};

const TONE_OPTIONS = TOAST_TONES.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }));

const NEW_ACTION = '__new';

// Mirror of LIMITS.MAX_NAVIGATE_PARAMS (server/appStudio/componentSpecs.js).
const MAX_NAVIGATE_PARAMS = 20;

/**
 * Fresh per-kind defaults when the user switches an action's kind. `formFields`
 * (the enclosing form's inputs) lets ai_extract point at a document straight
 * away — `source` is required, so defaulting it empty means the builder meets a
 * validation error before touching anything.
 */
function defaultActionForKind(kind, definition, formFields = []) {
    switch (kind) {
        case 'navigate': return { kind, screenId: definition?.screens?.[0]?.id || '' };
        case 'toast': return { kind, message: '', tone: 'info' };
        case 'open_url': return { kind, url: '', newTab: true };
        case 'ai_extract': {
            const file = formFields.find((f) => f.type === 'input_file')?.name || '';
            return {
                kind,
                ...(file ? { source: bindingForField(file) } : {}),
                schema: [{ name: 'field1', type: 'string', description: '', required: false }],
            };
        }
        case 'open_modal':
        case 'close_modal': return { kind, modalId: firstModalId(definition) };
        case 'send_email': return { kind, connectorId: '', to: { kind: 'static', value: '' }, subject: { kind: 'static', value: '' }, body: { kind: 'static', value: '' } };
        case 'ai_generate': return { kind, prompt: '', output: 'text', resultVar: 'result' };
        case 'kb_query': return { kind, query: { kind: 'static', value: '' }, knowledgeBaseIds: [], resultVar: 'results' };
        case 'run_automation':
        default: return { kind: 'run_automation', automationId: null };
    }
}

/** The first `modal` node in the app — a new open/close_modal has to aim somewhere. */
function firstModalId(definition) {
    let found = '';
    const walk = (nodes) => {
        for (const n of nodes || []) {
            if (found) return;
            if (n?.type === 'modal' && typeof n.id === 'string') { found = n.id; return; }
            if (Array.isArray(n?.children)) walk(n.children);
        }
    };
    for (const screen of definition?.screens || []) {
        for (const section of screen.sections || []) walk(section.children);
    }
    return found;
}

/** How many steps a sequence holds, counting the ones inside branches. */
export function stepCount(action) {
    if (!action || action.kind !== 'sequence') return action ? 1 : 0;
    const walk = (steps) => (Array.isArray(steps) ? steps : []).reduce((n, step) => {
        if (!step || typeof step !== 'object') return n;
        let total = n + 1;
        total += walk(step.then) + walk(step.else) + walk(step.steps) + walk(step.default);
        for (const c of Array.isArray(step.cases) ? step.cases : []) total += walk(c?.steps);
        return total;
    }, 0);
    return walk(action.steps);
}

/**
 * The step a single action becomes when it is turned into a flow.
 *
 * Every v1 action kind IS a step kind, so this is a straight carry-over — which
 * is the point: "make this several steps" must never lose the one step already
 * there.
 */
function stepFromAction(action) {
    if (!action || action.kind === 'sequence') return null;
    // Effects are an ACTION-level shape; no step kind carries them, and
    // canonicalize drops the keys on the next save. Carrying them onto the step
    // therefore looked like nothing happened and then quietly lost the toast
    // and the redirect the author had set up. They become real steps instead
    // (see effectSteps) — everything that CAN survive the conversion does.
    const { onSuccess: _s, onError: _e, ...step } = action;
    return step;
}

/**
 * An action's bounded `onSuccess` effects ({ toast?, navigateTo? }) as the
 * steps that do the same thing, in the order the runtime fired them.
 */
function effectSteps(effects) {
    const steps = [];
    if (!effects || typeof effects !== 'object') return steps;
    if (effects.toast && typeof effects.toast === 'object' && effects.toast.message) {
        steps.push({ kind: 'toast', message: effects.toast.message, tone: effects.toast.tone || 'info' });
    }
    if (typeof effects.navigateTo === 'string' && effects.navigateTo) {
        steps.push({ kind: 'navigate', screenId: effects.navigateTo });
    }
    return steps;
}

/**
 * Input fields of the form enclosing `node` (or of the form itself), with
 * their component type — typed input mapping (app_trigger routines) needs to
 * offer only file inputs for `file` params.
 */
export function getFormFields(definition, node) {
    let form = null;
    if (node?.type === 'form') {
        form = node;
    } else {
        // Walk up the parent chain until we hit a form (or a section).
        let current = node;
        while (current) {
            const found = findNode(definition, current.id);
            const parent = found?.parent;
            if (!parent || !parent.type) break; // reached the section
            if (parent.type === 'form') { form = parent; break; }
            current = parent;
        }
    }
    if (!form) return [];
    const fields = [];
    const walk = (children) => {
        for (const child of children || []) {
            if (INPUT_TYPES.includes(child.type) && child.props?.name) {
                fields.push({ name: child.props.name, type: child.type, multiple: !!child.props?.multiple });
            }
            if (Array.isArray(child.children)) walk(child.children);
        }
    };
    walk(form.children);
    return fields;
}

/** Input-field names of the form enclosing `node` (or of the form itself). */
export function getFormFieldNames(definition, node) {
    return getFormFields(definition, node).map((f) => f.name);
}

/**
 * Every { nodeId, event, node } slot still pointing at `actionId`. definitionOps'
 * removeAction only clears onClick/onSubmit, so a grid/kanban/calendar slot
 * would keep a reference to a deleted action — and validate.js rejects that
 * on every later save.
 */
function eventRefsToAction(definition, actionId) {
    const refs = [];
    const walk = (nodes) => {
        for (const n of nodes || []) {
            for (const event of NODE_EVENTS) {
                if (n?.[event] === actionId) refs.push({ nodeId: n.id, event, node: n });
            }
            if (Array.isArray(n?.children)) walk(n.children);
        }
    };
    for (const screen of definition?.screens || []) {
        for (const section of screen.sections || []) walk(section.children);
    }
    return refs;
}

/** How the component is named in warnings — its own text when it has any. */
function componentLabel(node) {
    const props = node?.props || {};
    const base = getComponentEntry(node?.type)?.label || node?.type || 'Component';
    const text = props.label || props.title || props.text || props.heading;
    return (typeof text === 'string' && text.trim()) ? `${base} “${text.trim().slice(0, 24)}”` : base;
}

/** Names of the components OTHER than `nodeId` whose events run `actionId`. */
function otherComponentsRunning(definition, actionId, nodeId) {
    const byId = new Map();
    for (const ref of eventRefsToAction(definition, actionId)) {
        if (ref.nodeId === nodeId || byId.has(ref.nodeId)) continue;
        byId.set(ref.nodeId, componentLabel(ref.node));
    }
    return [...byId.values()];
}

/**
 * Names of the components that SHOW this action's result — an actionResult
 * binding anywhere in their props. Deleting the action leaves them rendering
 * with nothing behind them, which no event-slot scan would reveal.
 */
function componentsShowingResult(definition, actionId) {
    const names = [];
    const hasRef = (value, depth = 0) => {
        if (!value || typeof value !== 'object' || depth > 6) return false;
        if (!Array.isArray(value) && value.kind === 'actionResult' && value.actionId === actionId) return true;
        return Object.values(value).some((v) => hasRef(v, depth + 1));
    };
    const walk = (nodes) => {
        for (const n of nodes || []) {
            if (hasRef(n?.props)) names.push(componentLabel(n));
            if (Array.isArray(n?.children)) walk(n.children);
        }
    };
    for (const screen of definition?.screens || []) {
        for (const section of screen.sections || []) walk(section.children);
    }
    return names;
}

/** "a, b and c" — warnings name what breaks rather than counting it. */
function joinNames(names, max = 3) {
    const shown = names.slice(0, max);
    const rest = names.length - shown.length;
    const list = shown.length > 1 ? `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}` : shown[0] || '';
    return rest > 0 ? `${list} and ${rest} more` : list;
}

// ── Effects (onSuccess / onError) ──────────────────────────────────────────

/**
 * Values carried along to the next screen — `navigate.params`, readable there
 * as `screen.params.<name>`.
 *
 * The runtime has resolved these since v2 (useActionRunner.resolveNavParams)
 * and the AI builder writes them, but the inspector rendered only the screen
 * select. So "open THIS ticket" was authorable by the AI and invisible to
 * everyone else — and an author who edited such an action here could not see
 * what was being passed.
 *
 * A param is `{kind:'static', value}` or `{kind:'formula', expr}`. Names are
 * kept as typed; renaming rewrites the key in place so the order survives.
 */
function NavigateParamsEditor({ params, onChange, disabled }) {
    const stored = Object.entries(params && typeof params === 'object' ? params : []);
    // Rows added or blanked but not yet named. They cannot live in `params`,
    // which is keyed by name — so they are held here WITH the position they
    // occupy, or clearing a name would make the row jump to the bottom of the
    // list while the author was still typing in it.
    const [drafts, setDrafts] = useState([]);   // [{ at, row }]
    const rows = mergeDrafts(stored, drafts);
    // The row whose rename was refused because the name is already taken. UI
    // only, and cleared by the next accepted edit.
    const [clash, setClash] = useState(null);

    const commit = (next) => {
        setClash(null);
        // A BLANK name is a duplicate too — the guard below exempted it, so
        // clearing one row's name and then another collapsed both onto the ''
        // key and threw the first row's value away without a word. Unnamed rows
        // wait here instead, exactly as the flow editor's keyed-bindings field
        // does, and reach `params` only once they have a name of their own.
        const { named, drafts: nextDrafts } = splitNamed(next);
        setDrafts(nextDrafts);
        onChange(named.length ? Object.fromEntries(named) : null);
    };

    const setRow = (i, name, entry) => {
        // params is an object, so two rows CANNOT share a name: committing a
        // duplicate would collapse them and drop the earlier row's value
        // without a word. Refuse the rename and say so instead.
        if (name && rows.some(([n], j) => j !== i && n === name)) {
            setClash(i);
            return;
        }
        commit(rows.map((r, j) => (j === i ? [name, entry] : r)));
    };

    return (
        <div className="flex flex-col gap-2">
            <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                Values to carry along
            </span>
            {rows.length === 0 ? (
                <p className="text-[11px] text-[var(--text-secondary)]">
                    Nothing yet — the next screen reads these as <code>screen.params.name</code>.
                </p>
            ) : null}
            {rows.map(([name, entry], i) => {
                const isFormula = entry?.kind === 'formula';
                return (
                    <div key={i} className="flex flex-col gap-1.5 rounded-md border border-[var(--border-subtle)] p-2">
                        <div className="flex items-center gap-1.5">
                            <input
                                type="text"
                                className={INPUT_CLS}
                                value={name}
                                onChange={(e) => setRow(i, e.target.value, entry)}
                                placeholder="recordId"
                                disabled={disabled}
                                spellCheck={false}
                                aria-label={`Value ${i + 1} name`}
                            />
                            <IconButton
                                ariaLabel={`Remove value ${i + 1}`}
                                variant="danger"
                                size="sm"
                                disabled={disabled}
                                onClick={() => commit(rows.filter((_, j) => j !== i))}
                            >
                                <X />
                            </IconButton>
                        </div>
                        {isFormula ? (
                            <ExpressionInput
                                variant="inline"
                                value={entry.expr || ''}
                                onChange={(expr) => setRow(i, name, { kind: 'formula', expr })}
                                placeholder="e.g. item.id"
                                ariaLabel={`Value ${i + 1} formula`}
                                disabled={disabled}
                            />
                        ) : (
                            <div className="flex items-stretch gap-1.5">
                                <input
                                    type="text"
                                    className={INPUT_CLS}
                                    value={entry?.value ?? ''}
                                    onChange={(e) => setRow(i, name, { kind: 'static', value: e.target.value })}
                                    placeholder="A fixed value"
                                    disabled={disabled}
                                    aria-label={`Value ${i + 1}`}
                                />
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => setRow(i, name, isFormula ? { kind: 'static', value: '' } : { kind: 'formula', expr: '' })}
                            disabled={disabled}
                            className="self-start inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)]"
                        >
                            {isFormula ? 'Use a fixed value' : 'Work it out with a formula'}
                        </button>
                        {clash === i ? (
                            <span className="text-[11px] text-[var(--error)]">
                                Another value already goes by that name — pick a different one.
                            </span>
                        ) : null}
                    </div>
                );
            })}
            <button
                type="button"
                onClick={() => commit([...rows, ['', { kind: 'formula', expr: '' }]])}
                disabled={disabled || rows.length >= MAX_NAVIGATE_PARAMS}
                title={rows.length >= MAX_NAVIGATE_PARAMS ? `At most ${MAX_NAVIGATE_PARAMS} values.` : undefined}
                className="self-start px-2.5 py-1 text-[11px] font-medium rounded border border-dashed border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)]"
            >
                Carry a value along
            </button>
        </div>
    );
}

function EffectEditor({ label, effect, screens, onChange, disabled }) {
    const toast = effect?.toast || null;
    const set = (patch) => {
        const next = { ...(effect || {}), ...patch };
        // Keep the object bounded and tidy: drop empty members entirely.
        if (next.toast && !String(next.toast.message || '').trim()) delete next.toast;
        if (!next.navigateTo) delete next.navigateTo;
        onChange(Object.keys(next).length ? next : null);
    };

    return (
        <div className="rounded-md border border-[var(--border-subtle)] p-2.5 flex flex-col gap-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">{label}</span>
            <input
                type="text"
                className={INPUT_CLS}
                value={toast?.message || ''}
                onChange={(e) => set({ toast: { message: e.target.value, tone: toast?.tone || 'info' } })}
                placeholder="Toast message (optional)"
                disabled={disabled}
                aria-label={`${label} toast message`}
            />
            {toast?.message ? (
                <SegmentedControl
                    value={toast.tone || 'info'}
                    onChange={(tone) => set({ toast: { message: toast.message, tone } })}
                    options={TONE_OPTIONS}
                    size="sm"
                    fullWidth
                    disabled={disabled}
                    ariaLabel={`${label} toast tone`}
                />
            ) : null}
            <select
                className={INPUT_CLS}
                value={effect?.navigateTo || ''}
                onChange={(e) => set({ navigateTo: e.target.value || null })}
                disabled={disabled}
                aria-label={`${label} navigate to`}
            >
                <option value="">Stay on this screen</option>
                {screens.map((s) => (
                    <option key={s.id} value={s.id}>Go to {s.name || s.id}</option>
                ))}
            </select>
        </div>
    );
}

// ── Input mapping (run_automation) ─────────────────────────────────────────

const MAPPING_MODES = [
    { value: 'field', label: 'Form field' },
    { value: 'static', label: 'Static' },
];


/**
 * What the routine expects now, versus what this action sends.
 *
 * A routine's inputs change after it is wired: a param gets added, renamed or
 * dropped. Nothing said so — a missing input arrived as undefined and the
 * routine ran with a hole in it, while an input the routine no longer has was
 * posted and ignored. Both are silent, and both look like the routine is
 * broken.
 *
 * Only rendered when the target declares a contract at all (app_trigger's typed
 * params, or agent_call's schema); a routine with no contract can take anything.
 */
function ContractDrift({ paramMeta, mapped, onAdd, onRemove, disabled }) {
    if (!paramMeta) return null;
    const declared = Object.keys(paramMeta);
    const missing = declared.filter((name) => !mapped.includes(name));
    const extra = mapped.filter((name) => name && !declared.includes(name));
    if (!missing.length && !extra.length) return null;

    return (
        <div className="flex flex-col gap-1.5 rounded-md border border-[var(--warning)] p-2">
            {missing.length ? (
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-[var(--text-primary)]">
                        The routine also expects:
                    </span>
                    {missing.map((name) => (
                        <button
                            key={name}
                            type="button"
                            onClick={() => onAdd(name)}
                            disabled={disabled}
                            className="px-1.5 py-0.5 rounded text-[11px] font-mono border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)]"
                            title={paramMeta[name].required ? 'Required by the routine' : 'Optional'}
                        >
                            + {name}{paramMeta[name].required ? ' *' : ''}
                        </button>
                    ))}
                </div>
            ) : null}
            {extra.length ? (
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-[var(--text-primary)]">
                        The routine no longer takes:
                    </span>
                    {extra.map((name) => (
                        <button
                            key={name}
                            type="button"
                            onClick={() => onRemove(name)}
                            disabled={disabled}
                            className="px-1.5 py-0.5 rounded text-[11px] font-mono border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--error)] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)]"
                            title="Sent, and ignored"
                        >
                            {name} ✕
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

/**
 * One inputMapping row. `paramMeta` ({ type, required, description? } | null)
 * comes from the target routine's DECLARED contract (app_trigger trigger.params
 * or agent_call schema): it renders a type badge, and a `file` param locks the
 * row to form-field mode filtered to file-upload inputs (a static string can
 * never become a file).
 */
function MappingRow({ param, mapping, formFields, onChange, onRename, onRemove, disabled, paramMeta = null, takenNames = [] }) {
    // The name is typed locally: renaming onto another parameter would drop
    // that parameter's mapping, so a clashing draft is shown but not committed.
    const [draftName, setDraftName] = useState(param);
    const [syncedParam, setSyncedParam] = useState(param);
    if (syncedParam !== param) {
        setSyncedParam(param);
        setDraftName(param);
    }
    const clash = draftName !== param && (!draftName.trim() || takenNames.includes(draftName));
    const isFile = paramMeta?.type === 'file';
    const mode = isFile ? 'field' : (mapping?.kind === 'field' ? 'field' : 'static');
    const candidates = isFile ? formFields.filter((f) => f.type === 'input_file') : formFields;
    const fieldNames = candidates.map((f) => f.name);
    const selectedField = mode === 'field' ? formFields.find((f) => f.name === mapping?.name) : null;
    return (
        <div className="rounded-md border border-[var(--border-subtle)] p-2.5 flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    className={`${INPUT_CLS} font-mono text-xs`}
                    value={draftName}
                    onChange={(e) => {
                        const next = e.target.value;
                        setDraftName(next);
                        if (next.trim() && !takenNames.includes(next)) onRename(next);
                    }}
                    placeholder="Parameter"
                    disabled={disabled}
                    spellCheck={false}
                    aria-label="Parameter name"
                />
                {paramMeta ? (
                    <span
                        className="shrink-0 px-1.5 py-0.5 rounded text-[11px] font-mono text-[var(--text-secondary)] bg-[var(--bg-tertiary)]"
                        title={paramMeta.description || undefined}
                    >
                        {paramMeta.type}{paramMeta.required ? '*' : ''}
                    </span>
                ) : null}
                <IconButton ariaLabel={`Remove parameter ${param}`} onClick={onRemove} disabled={disabled} variant="danger" size="sm">
                    <X />
                </IconButton>
            </div>
            {clash ? (
                <p className="text-xs text-rose-500">
                    {draftName.trim()
                        ? `There is already a parameter called “${draftName}” — pick another name.`
                        : 'A parameter needs a name.'}
                </p>
            ) : null}
            {!isFile && (
                <SegmentedControl
                    value={mode}
                    onChange={(m) => {
                        if (m === mode) return;
                        onChange(m === 'field'
                            ? { kind: 'field', name: fieldNames[0] || '' }
                            : { kind: 'static', value: '' });
                    }}
                    options={MAPPING_MODES}
                    size="sm"
                    fullWidth
                    disabled={disabled}
                    ariaLabel={`${param} source`}
                />
            )}
            {mode === 'field' ? (
                fieldNames.length ? (
                    <select
                        className={INPUT_CLS}
                        value={mapping?.name || ''}
                        onChange={(e) => onChange({ kind: 'field', name: e.target.value })}
                        disabled={disabled}
                        aria-label={`${param} form field`}
                    >
                        <option value="">Pick a field…</option>
                        {fieldNames.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                ) : isFile ? (
                    <p className="text-xs text-[var(--text-tertiary)]">Add a File upload input to this form to feed this parameter.</p>
                ) : (
                    <input
                        type="text"
                        className={INPUT_CLS}
                        value={mapping?.name || ''}
                        onChange={(e) => onChange({ kind: 'field', name: e.target.value })}
                        placeholder="Field name (no enclosing form found)"
                        disabled={disabled}
                        spellCheck={false}
                        aria-label={`${param} form field name`}
                    />
                )
            ) : (
                <input
                    type="text"
                    className={INPUT_CLS}
                    value={mapping?.value ?? ''}
                    onChange={(e) => onChange({ kind: 'static', value: e.target.value })}
                    placeholder={paramMeta?.type === 'array' || paramMeta?.type === 'object' ? 'JSON value, e.g. [] / {}' : 'Value'}
                    disabled={disabled}
                    aria-label={`${param} static value`}
                />
            )}
            {isFile && selectedField?.multiple ? (
                <p className="text-xs text-amber-600">This routine expects a single file — a multi-file input sends only the first.</p>
            ) : null}
        </div>
    );
}

// ── Main section ───────────────────────────────────────────────────────────

export default function ActionsSection({ node, definition, onCommit, onTestActionResult, disabled = false }) {
    const events = TYPE_EVENT_LISTS[node?.type] || [];
    const actions = definition?.actions || {};

    const api = useAutomationApi();
    const [automations, setAutomations] = useState(null);
    const fetchedRef = useRef(false);

    // Titles (and agent_call contracts) come from the same list endpoint the
    // Routines sidebar uses — fetched lazily, only when a Run-routine action is
    // actually wired to any of this node's events.
    const hasRunAutomation = events.some((ev) => actions[node?.[ev]]?.kind === 'run_automation');
    useEffect(() => {
        if (!hasRunAutomation || fetchedRef.current) return;
        fetchedRef.current = true;
        api.listAutomations()
            .then((r) => setAutomations(r.automations || []))
            .catch(() => setAutomations([]));
    }, [hasRunAutomation, api]);

    const titleFor = (automationId) => {
        if (!automationId) return null;
        return (automations || []).find((a) => a.id === automationId)?.title || null;
    };

    if (!events.length) return null;

    return (
        <div className="flex flex-col gap-4">
            {events.map((event, i) => (
                <div key={event} className={i > 0 ? 'pt-4 border-t border-[var(--border-subtle)]' : ''}>
                    <EventWiring
                        event={event}
                        node={node}
                        definition={definition}
                        onCommit={onCommit}
                        onTestActionResult={onTestActionResult}
                        disabled={disabled}
                        automations={automations}
                        setAutomations={setAutomations}
                        titleFor={titleFor}
                    />
                </div>
            ))}
        </div>
    );
}

// ── One event slot's wiring + inline action editor ──────────────────────────

function EventWiring({ event, node, definition, onCommit, onTestActionResult, disabled, automations, setAutomations, titleFor }) {
    const actions = definition?.actions || {};
    const actionId = node?.[event] || null;
    const action = actionId ? actions[actionId] : null;

    const [pickerOpen, setPickerOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [test, setTest] = useState(null); // {status:'running'|'done'|'error', body?, error?}
    const [flowFor, setFlowFor] = useState(null);      // action id being edited on the canvas
    const [confirmFlatten, setConfirmFlatten] = useState(null);  // the kind being switched TO

    const screens = definition?.screens || [];
    const formFields = useMemo(() => getFormFields(definition, node), [definition, node]);
    const fieldNames = useMemo(() => formFields.map((f) => f.name), [formFields]);

    // The target routine's DECLARED input contract, when it has one:
    // app_trigger → typed trigger.params; agent_call → schema properties.
    const targetTrigger = useMemo(() => {
        if (action?.kind !== 'run_automation' || !action.automationId) return null;
        return (automations || []).find((a) => a.id === action.automationId)?.definition?.trigger || null;
    }, [action, automations]);
    const paramMetaByName = useMemo(() => {
        if (targetTrigger?.kind === 'app_trigger' && Array.isArray(targetTrigger.params)) {
            return Object.fromEntries(targetTrigger.params.filter((p) => p && p.name).map((p) => [
                p.name, { type: p.type || 'string', required: !!p.required, description: p.description || '' },
            ]));
        }
        if (targetTrigger?.kind === 'agent_call' && targetTrigger.parametersSchema?.properties) {
            const required = new Set(Array.isArray(targetTrigger.parametersSchema.required) ? targetTrigger.parametersSchema.required : []);
            return Object.fromEntries(Object.entries(targetTrigger.parametersSchema.properties).map(([n, s]) => [
                n, { type: typeof s?.type === 'string' ? s.type : 'string', required: required.has(n), description: s?.description || '' },
            ]));
        }
        return null;
    }, [targetTrigger]);

    // Everything else that runs this action, or shows what it produced.
    const sharedWith = useMemo(
        () => (actionId ? otherComponentsRunning(definition, actionId, node?.id) : []),
        [definition, actionId, node?.id],
    );
    const resultShownBy = useMemo(
        () => (actionId ? componentsShowingResult(definition, actionId) : []),
        [definition, actionId],
    );

    // Every action in the app, each labelled with how many OTHER components
    // already run it — picking one here adopts that same object.
    const choices = useMemo(() => Object.entries(actions).map(([id, a]) => {
        const others = otherComponentsRunning(definition, id, node?.id).length;
        const suffix = others ? ` (also used by ${others} other component${others === 1 ? '' : 's'})` : '';
        return { id, label: `${describeAction(id, a, definition, titleFor)}${suffix}` };
    }), [actions, definition, node?.id, titleFor]);

    const commitAction = (nextAction) => {
        const { def } = setAction(definition, actionId, nextAction);
        if (def !== definition) onCommit(def);
    };

    /**
     * Change what this action IS.
     *
     * Turning something into a flow KEEPS it as the first step rather than
     * replacing it — the old behaviour built a fresh default and the author's
     * work vanished. Turning a real flow back into one thing does destroy the
     * rest, so that direction asks first.
     */
    const onPickKind = (kind) => {
        if (kind === action.kind) return;
        if (kind === 'sequence') {
            const first = stepFromAction(action);
            // onSuccess becomes the steps that follow. onError has no equivalent
            // — a sequence ABORTS on a failed step — so it cannot come across,
            // and saying so beats dropping it in silence.
            const steps = [first, ...effectSteps(action?.onSuccess)].filter(Boolean);
            commitAction({ kind: 'sequence', steps });
            if (action?.onError && Object.keys(action.onError).length) {
                toast.info('The "on error" part could not come across — a flow stops at the step that fails.');
            }
            setFlowFor(actionId);
            return;
        }
        if (action.kind === 'sequence' && stepCount(action) > 1) {
            setConfirmFlatten(kind);
            return;
        }
        commitAction(defaultActionForKind(kind, definition, formFields));
    };

    const onSelectAction = (value) => {
        if (value === NEW_ACTION) {
            const { def: withAction, actionId: newId } = setAction(definition, null, defaultActionForKind('run_automation', definition));
            onCommit(setNodeEvent(withAction, node.id, event, newId));
            return;
        }
        const next = setNodeEvent(definition, node.id, event, value || null);
        if (next !== definition) onCommit(next);
    };

    // Give THIS component its own copy, so the edits that follow stop reaching
    // the components that shared the original.
    const onForkAction = () => {
        const copy = JSON.parse(JSON.stringify(action));
        const { def: withCopy, actionId: newId } = setAction(definition, null, copy);
        onCommit(setNodeEvent(withCopy, node.id, event, newId));
    };

    const onDeleteAction = () => {
        setConfirmDelete(false);
        let next = removeAction(definition, actionId);
        for (const ref of eventRefsToAction(next, actionId)) {
            next = setNodeEvent(next, ref.nodeId, ref.event, null);
        }
        if (next !== definition) onCommit(next);
    };

    // Nothing else points at it → nothing to warn about, so don't stop the user.
    const requestDelete = () => {
        if (sharedWith.length || resultShownBy.length) setConfirmDelete(true);
        else onDeleteAction();
    };

    /**
     * Apply a picked routine: id + param prefill from its declared contract —
     * agent_call's schema properties, or app_trigger's typed trigger.params
     * (file params snap to the first file-upload input of the enclosing form).
     */
    const onPickRoutine = (automation) => {
        setPickerOpen(false);
        if (automations && !automations.some((a) => a.id === automation.id)) {
            setAutomations([...automations, automation]);
        }
        const next = { ...action, automationId: automation.id };
        const trigger = automation?.definition?.trigger;
        let declared = null; // [{ name, type }]
        if (trigger?.kind === 'agent_call' && trigger.parametersSchema?.properties) {
            declared = Object.keys(trigger.parametersSchema.properties).map((name) => ({ name, type: 'string' }));
        } else if (trigger?.kind === 'app_trigger' && Array.isArray(trigger.params)) {
            declared = trigger.params.filter((p) => p && p.name).map((p) => ({ name: p.name, type: p.type || 'string' }));
        }
        if (declared) {
            const firstFileField = formFields.find((f) => f.type === 'input_file')?.name || '';
            // Only the params the NEW routine declares survive. This used to
            // carry the previous routine's mapping across untouched, so
            // switching from a routine taking invoiceFile + amount to one taking
            // ticketId left three rows: two of them belonged to nothing, were
            // POSTed on every run, and looked identical to the real one.
            const previous = action.inputMapping || {};
            const mapping = {};
            for (const { name, type } of declared) {
                if (previous[name]) { mapping[name] = previous[name]; continue; }
                // A file param with no file input to point at used to commit
                // {kind:'field', name:''} — a hard validation error, so picking
                // the routine broke every later save with a message about a
                // field nobody had named. An empty static is a shape the schema
                // accepts and the author can fill in.
                if (type === 'file') {
                    mapping[name] = firstFileField
                        ? { kind: 'field', name: firstFileField }
                        : { kind: 'static', value: '' };
                }
                else if (fieldNames.includes(name)) mapping[name] = { kind: 'field', name };
                else mapping[name] = { kind: 'static', value: '' };
            }
            if (Object.keys(mapping).length) next.inputMapping = mapping;
            else delete next.inputMapping;
        }
        commitAction(next);
    };

    const mappingEntries = Object.entries(action?.inputMapping || {});

    const setMapping = (param, value) => {
        commitAction({ ...action, inputMapping: { ...(action.inputMapping || {}), [param]: value } });
    };
    const renameMapping = (oldName, newName) => {
        const current = action.inputMapping || {};
        // Renaming onto an existing parameter would silently delete it.
        if (!newName.trim() || (newName !== oldName && newName in current)) return;
        const mapping = {};
        for (const [k, v] of Object.entries(current)) {
            mapping[k === oldName ? newName : k] = v;
        }
        commitAction({ ...action, inputMapping: mapping });
    };
    const removeMapping = (param) => {
        const mapping = { ...(action.inputMapping || {}) };
        delete mapping[param];
        const next = { ...action };
        if (Object.keys(mapping).length) next.inputMapping = mapping;
        else delete next.inputMapping;
        commitAction(next);
    };
    const addMapping = () => {
        const taken = new Set(Object.keys(action.inputMapping || {}));
        let name = 'param';
        let n = 1;
        while (taken.has(name)) name = `param${++n}`;
        setMapping(name, fieldNames.length ? { kind: 'field', name: fieldNames[0] } : { kind: 'static', value: '' });
    };

    const setEffect = (slot, effect) => {
        const next = { ...action };
        if (effect) next[slot] = effect;
        else delete next[slot];
        commitAction(next);
    };

    /*
     * "Test" is not a rehearsal.
     *
     * It POSTs to the same production run endpoint the Routines page uses, with
     * no dry-run flag — so a routine that e-mails customers e-mails them, and
     * one that writes rows writes them. The button said none of that; the only
     * caveat on screen ("static values only") rendered for app_trigger routines
     * alone and is about the payload, not the consequences. There is no dry-run
     * mode in the runner to fall back on, so the honest fix is to ask first.
     */
    const [confirmTest, setConfirmTest] = useState(false);

    const runTest = async () => {
        setConfirmTest(false);
        if (!action?.automationId) return;
        setTest({ status: 'running' });
        try {
            const staticInputs = {};
            for (const [param, m] of Object.entries(action.inputMapping || {})) {
                if (m?.kind === 'static') staticInputs[param] = m.value;
            }
            const r = await authFetch(`${API_BASE}/api/automation/${encodeURIComponent(action.automationId)}/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ triggerPayload: staticInputs }),
            });
            let body = null;
            try { body = await r.json(); } catch { /* empty body */ }
            if (!r.ok) throw new Error(body?.error || `Run failed (${r.status})`);
            setTest({ status: 'done', body });
            onTestActionResult?.(actionId, body);
        } catch (e) {
            setTest({ status: 'error', error: e.message });
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <FormField label={EVENT_LABELS[event] || 'When triggered'}>
                <div className="flex items-center gap-2">
                    <select
                        className={INPUT_CLS}
                        value={actionId || ''}
                        onChange={(e) => onSelectAction(e.target.value)}
                        disabled={disabled}
                        aria-label={`Action for ${event}`}
                    >
                        <option value="">{actionId ? 'Nothing happens' : 'Choose what happens…'}</option>
                        <option value={NEW_ACTION}>New action…</option>
                        {choices.length ? (
                            <optgroup label="Reuse something this app already does">
                                {choices.map((c) => (
                                    <option key={c.id} value={c.id}>{c.label}</option>
                                ))}
                            </optgroup>
                        ) : null}
                    </select>
                    {action ? (
                        <IconButton ariaLabel="Delete action" onClick={requestDelete} disabled={disabled} variant="danger">
                            <Trash2 />
                        </IconButton>
                    ) : null}
                </div>
            </FormField>

            {action ? (
                <div className="flex flex-col gap-3">
                    {sharedWith.length ? (
                        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 flex flex-col gap-2">
                            <p className="flex items-start gap-1.5 text-xs text-amber-600">
                                <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span>
                                    This is shared with {sharedWith.length} other component{sharedWith.length === 1 ? '' : 's'}
                                    {' '}({joinNames(sharedWith)}) — changes affect all of them.
                                </span>
                            </p>
                            <button
                                type="button"
                                onClick={onForkAction}
                                disabled={disabled}
                                className="self-start px-2.5 py-1 text-xs rounded-md border border-amber-500/50 text-amber-600 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                            >
                                Only for this one
                            </button>
                        </div>
                    ) : null}

                    <select
                        className={INPUT_CLS}
                        value={KIND_OPTIONS.some((o) => o.value === action.kind) ? action.kind : 'run_automation'}
                        onChange={(e) => onPickKind(e.target.value)}
                        disabled={disabled}
                        aria-label="Action kind"
                    >
                        {KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        {/* An AI-written kind this list does not offer still has
                            to show its own name, or the select claims the action
                            is something it is not. */}
                        {!KIND_OPTIONS.some((o) => o.value === action.kind) && ACTION_KINDS.includes(action.kind) ? (
                            <option value={action.kind}>{action.kind.replace(/_/g, ' ')}</option>
                        ) : null}
                    </select>

                    {action.kind === 'sequence' ? (
                        <div className="flex flex-col gap-1.5 rounded-md border border-[var(--border-subtle)] p-2.5">
                            <span className="text-xs text-[var(--text-primary)]">
                                {stepCount(action)} step{stepCount(action) === 1 ? '' : 's'}, run in order.
                            </span>
                            <button
                                type="button"
                                onClick={() => setFlowFor(actionId)}
                                disabled={disabled}
                                className="self-start inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)]"
                            >
                                <Workflow className="w-3.5 h-3.5" aria-hidden="true" /> Edit the flow
                            </button>
                        </div>
                    ) : null}

                    {AI_KINDS.includes(action.kind) && (
                        <AiActionEditor action={action} commit={commitAction} formFields={formFields} disabled={disabled} />
                    )}

                    {action.kind === 'run_automation' && (
                        <>
                            <button
                                type="button"
                                onClick={() => setPickerOpen(true)}
                                disabled={disabled}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-sm text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Workflow className="w-4 h-4 shrink-0 text-[var(--text-tertiary)]" />
                                <span className="truncate">
                                    {action.automationId
                                        ? (titleFor(action.automationId) || action.automationId)
                                        : 'Choose a routine…'}
                                </span>
                            </button>

                            <FormField
                                label="Inputs"
                                hint="Map each routine parameter to a form field or a fixed value."
                            >
                                <div className="flex flex-col gap-2">
                                    <ContractDrift
                                        paramMeta={paramMetaByName}
                                        mapped={mappingEntries.map(([p]) => p)}
                                        onAdd={(name) => setMapping(name, { kind: 'static', value: '' })}
                                        onRemove={removeMapping}
                                        disabled={disabled}
                                    />
                                    {mappingEntries.map(([param, mapping], i) => (
                                        // Keyed by POSITION: the param name is
                                        // the value being typed, so keying on it
                                        // remounts the row on every keystroke.
                                        <MappingRow
                                            key={i}
                                            param={param}
                                            mapping={mapping}
                                            formFields={formFields}
                                            paramMeta={paramMetaByName?.[param] || null}
                                            takenNames={mappingEntries.map(([p]) => p).filter((p) => p !== param)}
                                            onChange={(v) => setMapping(param, v)}
                                            onRename={(v) => renameMapping(param, v)}
                                            onRemove={() => removeMapping(param)}
                                            disabled={disabled}
                                        />
                                    ))}
                                    <button
                                        type="button"
                                        onClick={addMapping}
                                        disabled={disabled}
                                        className="px-3 py-1.5 text-xs rounded-md border border-dashed border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-50"
                                    >
                                        + Add parameter
                                    </button>
                                </div>
                            </FormField>

                            <EffectEditor
                                label="On success"
                                effect={action.onSuccess}
                                screens={screens}
                                onChange={(e) => setEffect('onSuccess', e)}
                                disabled={disabled}
                            />
                            <EffectEditor
                                label="On error"
                                effect={action.onError}
                                screens={screens}
                                onChange={(e) => setEffect('onError', e)}
                                disabled={disabled}
                            />

                            <button
                                type="button"
                                onClick={() => setConfirmTest(true)}
                                disabled={disabled || !action.automationId || test?.status === 'running'}
                                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {test?.status === 'running' ? <Spinner size="xs" /> : <FlaskConical className="w-4 h-4" />}
                                Test
                            </button>
                            <p className="-mt-1 text-xs text-[var(--text-secondary)]">
                                Runs the routine for real.
                                {targetTrigger?.kind === 'app_trigger' ? ' Static values only; file inputs are skipped.' : ''}
                            </p>
                            <ConfirmDialog
                                open={confirmTest}
                                title={`Run “${titleFor(action.automationId) || 'this routine'}” now?`}
                                description="This is the real run, not a rehearsal — anything it sends or writes actually happens."
                                confirmLabel="Run it"
                                onConfirm={runTest}
                                onCancel={() => setConfirmTest(false)}
                            />

                            {test && test.status !== 'running' && (
                                <div className="rounded-md border border-[var(--border-subtle)] overflow-hidden">
                                    <div className="flex items-center justify-between px-2.5 py-1.5 bg-[var(--bg-tertiary)]">
                                        <span className={`text-[11px] font-semibold uppercase tracking-wide ${test.status === 'error' ? 'text-rose-500' : 'text-emerald-500'}`}>
                                            {test.status === 'error' ? 'Test failed' : 'Test result'}
                                        </span>
                                        <IconButton ariaLabel="Dismiss test result" onClick={() => setTest(null)} size="sm">
                                            <X />
                                        </IconButton>
                                    </div>
                                    <pre className="text-xs p-2.5 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[var(--text-secondary)]">
                                        {test.status === 'error' ? test.error : JSON.stringify(test.body, null, 2)}
                                    </pre>
                                </div>
                            )}

                            <RoutinePicker
                                open={pickerOpen}
                                onClose={() => setPickerOpen(false)}
                                onPick={onPickRoutine}
                                formFields={formFields}
                            />
                        </>
                    )}

                    {action.kind === 'navigate' && (
                        <>
                            <FormField label="Screen">
                                <select
                                    className={INPUT_CLS}
                                    value={action.screenId || ''}
                                    onChange={(e) => commitAction({ ...action, screenId: e.target.value })}
                                    disabled={disabled}
                                    aria-label="Target screen"
                                >
                                    {screens.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name || s.id}</option>
                                    ))}
                                </select>
                            </FormField>
                            <NavigateParamsEditor
                                params={action.params}
                                onChange={(params) => {
                                    const { params: _drop, ...rest } = action;
                                    commitAction(params ? { ...rest, params } : rest);
                                }}
                                disabled={disabled}
                            />
                        </>
                    )}

                    {action.kind === 'toast' && (
                        <>
                            <FormField label="Message">
                                <input
                                    type="text"
                                    className={INPUT_CLS}
                                    value={action.message || ''}
                                    onChange={(e) => commitAction({ ...action, message: e.target.value })}
                                    placeholder="What should the message say?"
                                    disabled={disabled}
                                />
                            </FormField>
                            <FormField label="Tone">
                                <SegmentedControl
                                    value={action.tone || 'info'}
                                    onChange={(tone) => commitAction({ ...action, tone })}
                                    options={TONE_OPTIONS}
                                    size="sm"
                                    fullWidth
                                    disabled={disabled}
                                    ariaLabel="Message tone"
                                />
                            </FormField>
                        </>
                    )}

                    {action.kind === 'open_url' && (
                        <>
                            <FormField label="URL" hint="Must be an https URL.">
                                <input
                                    type="text"
                                    className={INPUT_CLS}
                                    value={action.url || ''}
                                    onChange={(e) => commitAction({ ...action, url: e.target.value })}
                                    placeholder="https://…"
                                    disabled={disabled}
                                    spellCheck={false}
                                />
                            </FormField>
                            <Toggle
                                label="Open in a new tab"
                                checked={action.newTab !== false}
                                onChange={(v) => commitAction({ ...action, newTab: v })}
                                disabled={disabled}
                                size="sm"
                            />
                        </>
                    )}

                    {/* The kinds with no hand-written editor here are edited
                        FROM THE SPEC, the same way the flow canvas edits them.
                        Every kind the schema defines now has an editor; a
                        bespoke one each is a per-kind place for a field to go
                        missing, which is exactly how three of them ended up
                        authorable only by the AI. */}
                    {SPEC_EDITED_KINDS.has(action.kind) && (
                        <StepSettings
                            step={action}
                            onChange={commitAction}
                            definition={definition}
                            node={node}
                            screens={definition?.screens || []}
                            formFields={formFields}
                            disabled={disabled}
                        />
                    )}
                </div>
            ) : null}

            {action ? (
            <ConfirmDialog
                open={confirmDelete}
                title={`Delete “${describeAction(actionId, action, definition, titleFor)}”?`}
                description={(
                    <>
                        {sharedWith.length ? (
                            <>It stops happening on {joinNames(sharedWith)} too. </>
                        ) : null}
                        {resultShownBy.length ? (
                            <>{joinNames(resultShownBy)} show{resultShownBy.length === 1 ? 's' : ''} what it produced, and will be left empty. </>
                        ) : null}
                        This can&apos;t be undone.
                    </>
                )}
                confirmLabel="Delete everywhere"
                destructive
                onConfirm={onDeleteAction}
                onCancel={() => setConfirmDelete(false)}
            />
            ) : null}

            {/* Switching a real flow back to a single thing throws the rest of
                the steps away — the old code did it on the first change of the
                select, with no warning. */}
            <ConfirmDialog
                open={!!confirmFlatten}
                title="Keep only one step?"
                description={`This flow has ${stepCount(action)} steps. Changing it back to a single action keeps none of them.`}
                confirmLabel="Discard the other steps"
                destructive
                onConfirm={() => {
                    commitAction(defaultActionForKind(confirmFlatten, definition, formFields));
                    setConfirmFlatten(null);
                }}
                onCancel={() => setConfirmFlatten(null)}
            />

            <Modal
                open={!!flowFor}
                onClose={() => setFlowFor(null)}
                title="What happens, step by step"
                description="Each step runs in order. A branch runs only the path it takes."
                size="full"
            >
                {flowFor ? (
                    <div className="h-[70vh]">
                        <ActionFlowEditor
                            action={action}
                            onChange={commitAction}
                            definition={definition}
                            node={node}
                            formFields={formFields}
                            disabled={disabled}
                        />
                    </div>
                ) : null}
            </Modal>
        </div>
    );
}

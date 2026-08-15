import { AlertTriangle, Workflow } from 'lucide-react';
import React, { useState } from 'react';
import { stepMeta } from './stepCatalog';
import {
    columnOptions, isDanglingRef, labelForRef, REFERENCE_EMPTY_HINTS,
    REFERENCE_FIELDS, REFERENCE_PLACEHOLDERS,
} from './stepReferences';
import useStepReferences from './useStepReferences';
import FormField from '../../../../shared/FormField';
import SegmentedControl from '../../../../shared/SegmentedControl';
import Toggle from '../../../../shared/Toggle';
import ExpressionInput from '../inspector/logic/ExpressionInput';
import BindingField from '../inspector/panels/BindingField';
import { INPUT_CLS } from '../inspector/panels/kit';
import { useCatalogStepSpecs } from '../inspector/panels/SpecPanel';
import { mergeDrafts, splitNamed } from '../inspector/keyedRows';
import RoutinePicker from '../inspector/RoutinePicker';

/**
 * One step's settings, rendered FROM THE SPEC rather than hand-written per kind.
 *
 * There are eighteen step kinds. A bespoke editor each is eighteen places for a
 * field to go missing — which is how the inspector ended up able to author four
 * of the ten action kinds. The server already describes every field and its
 * type, so this walks that description and maps type → control. A field the
 * server adds gets an editor for free; a field it drops stops rendering.
 *
 * The types the canvas owns rather than this panel — `steps` and `switchCases`,
 * a container's children — are skipped here: they are the branches drawn on the
 * canvas, and editing them in a side panel would be a second, disagreeing way
 * to say the same thing.
 *
 * ── REFERENCES ARE PICKED, NEVER TYPED ──────────────────────────────
 * The server types every reference field as a plain `string`, because an id is
 * what goes over the wire. `screenId` was special-cased into a <select> for
 * exactly that reason ("A screen reference is a pick, never a typed id") — and
 * the other five were left as text boxes. So "Add a row" asked a bookkeeper to
 * type `tbl_9f3a2c`, "Open a dialog" wanted a node id, and "Run routine" wanted
 * a uuid. They are all pickers now, driven by one table (stepReferences.
 * REFERENCE_FIELDS) so a new reference field cannot land as a text box again.
 *
 * A reference whose target has been DELETED still shows its raw id, with a
 * warning — blanking it would hide the breakage from the only person who can
 * repair it.
 */

/**
 * Fields whose editor is the canvas itself — a container's CHILD steps. The
 * canvas draws those branches, and a second editor for them in a side panel
 * would be a disagreeing way to say the same thing.
 *
 * `switchCases` used to be in here too, which meant a switch's cases had no
 * editor at all: the canvas can draw a branch but has nowhere to say WHAT the
 * branch matches. So every hand-built switch had valueless cases and fell
 * through to "Otherwise". The panel now edits the case VALUES; the steps inside
 * each case stay on the canvas.
 */
const CANVAS_TYPES = new Set(['steps']);

/**
 * `<kind>.<field>` pairs the server still ACCEPTS but nothing reads. Rendering
 * an input for one is worse than rendering nothing: the builder fills it in,
 * the app ignores it, and there is no feedback anywhere. `refresh.actionId` is
 * the v2.0 field the runtime has always ignored (it reloads everything, or the
 * table/dataset named beside it).
 */
const IGNORED_FIELDS = new Set(['refresh.actionId']);

/**
 * Field names the product says differently than the schema does. `humanize`
 * gets the rest right; these are the ones where the wire name is not the word
 * the builder knows the thing by.
 */
const FIELD_LABELS = {
    automationId: 'Routine',
    modalId: 'Dialog',
    connectorId: 'Connection',
    datasetId: 'Saved view',
    fileName: 'File name',
    attachToRecordId: 'Attach to record',
    attachToFieldKey: 'Attach to file column',
    threadKey: 'Conversation',
    poPattern: 'Purchase-order filename pattern',
    documentMode: 'Read documents as',
};

/** 'screenId' → 'Screen', 'maxIterations' → 'Max iterations'. */
function humanize(key) {
    const words = String(key)
        .replace(/Id$/, '')
        .replace(/_/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
}

const HINTS = {
    resultVar: 'The variable this step’s result lands in — formulas read it as vars.<name>.',
    itemVar: 'What each row is called inside the loop.',
    indexVar: 'What the position in the list is called (0, 1, 2…).',
    maxIterations: 'A ceiling, so a long list cannot run away.',
    expr: 'Worked out each time the step runs.',
    tableId: 'Which of this app’s tables the step works on.',
    datasetId: 'Reload just this saved view instead of everything.',
    rows: 'The rows that become the file — usually a table, filtered to what you want exported.',
    columns: 'The column layout: rows of { name, from, value, order } — bind a table so admins edit the format as data.',
    attachToRecordId: 'The record the file hangs off. Without it, only the app owner can download the result.',
    attachToFieldKey: 'The file column on that record — set both or neither.',
    threadKey: 'Which conversation’s mailed attachments to file.',
    poPattern: 'Filenames matching this (regex) count as the purchase order.',
    documentMode: '“Images” forces page pictures — use it for technical drawings, whose text layer alone misleads.',
    promptContext: 'Live rows added to the prompt — the purchase-order lines, the open record, the vocabulary table.',
};

export default function StepSettings({ step, onChange, definition, node = null, screens = [], disabled = false, formFields = [] }) {
    const stepSpecs = useCatalogStepSpecs();
    const references = useStepReferences(definition);
    if (!step) return null;
    const meta = stepMeta(step.kind);
    const spec = stepSpecs ? stepSpecs[step.kind] : null;
    const set = (patch) => onChange({ ...step, ...patch });

    if (!stepSpecs) {
        return <p className="text-xs text-[var(--text-secondary)]">Loading the step settings…</p>;
    }
    if (!spec) {
        return (
            <p className="text-xs text-[var(--text-secondary)]">
                This step type has no editor yet — it was written by the AI builder.
            </p>
        );
    }

    const fields = Object.entries(spec.fields)
        .filter(([key, fs]) => !CANVAS_TYPES.has(fs.type) && !IGNORED_FIELDS.has(`${step.kind}.${key}`));

    // The caller's screen list wins when it has one; it is the same
    // definition.screens either way, and passing it keeps the two existing call
    // sites working unchanged.
    const options = screens.length
        ? { ...references.options, screen: screens.filter((s) => s?.id).map((s) => ({ id: s.id, label: s.name || s.id })) }
        : references.options;

    return (
        <div className="flex flex-col gap-3" data-step-settings={step.kind}>
            <p className="text-xs text-[var(--text-secondary)]">{meta.blurb}</p>

            {fields.map(([key, fs]) => (
                <StepField
                    key={key}
                    fieldKey={key}
                    fs={fs}
                    value={step[key]}
                    step={step}
                    onChange={(v) => set({ [key]: v })}
                    definition={definition}
                    node={node}
                    options={options}
                    references={references}
                    formFields={formFields}
                    disabled={disabled}
                />
            ))}

            {meta.server ? (
                <p className="text-[11px] text-[var(--text-secondary)]">
                    Runs on the server, as the app’s owner — so it can reach data the person using
                    the app cannot.
                </p>
            ) : null}
        </div>
    );
}

function StepField({
    fieldKey, fs, value, step, onChange, definition, node, options, references, formFields, disabled,
}) {
    const label = FIELD_LABELS[fieldKey] || humanize(fieldKey);
    const hint = HINTS[fieldKey];
    const required = !!fs.required;

    // Every reference is a pick, never a typed id.
    const refKind = REFERENCE_FIELDS[fieldKey];
    if (refKind) {
        // A routine is chosen from the searchable picker the inspector already
        // uses for the bare `run_automation` action — same job, same affordance.
        if (refKind === 'automation') {
            return (
                <RoutineRefField
                    label={label}
                    hint={hint}
                    value={value}
                    onChange={onChange}
                    options={options.automation}
                    formFields={formFields}
                    disabled={disabled}
                />
            );
        }
        return (
            <ReferenceField
                label={label}
                hint={hint}
                kind={refKind}
                value={value}
                onChange={onChange}
                options={options[refKind] || []}
                disabled={disabled}
            />
        );
    }

    switch (fs.type) {
        case 'formula':
            return (
                <FormField label={label} hint={hint}>
                    <ExpressionInput
                        value={value || ''}
                        onChange={onChange}
                        definition={definition}
                        node={node}
                        ariaLabel={label}
                        expectsBoolean={fieldKey === 'expr'}
                        placeholder="e.g. vars.status == 'open'"
                        disabled={disabled}
                    />
                </FormField>
            );
        case 'binding':
            return (
                <BindingField
                    label={label}
                    hint={hint}
                    value={value}
                    onChange={onChange}
                    definition={definition}
                    node={node}
                    disabled={disabled}
                />
            );
        case 'enum':
            return (
                <FormField label={label} hint={hint}>
                    <select
                        className={INPUT_CLS}
                        value={value ?? fs.default ?? ''}
                        onChange={(e) => onChange(e.target.value)}
                        disabled={disabled}
                        aria-label={label}
                    >
                        {(fs.values || []).map((v) => <option key={String(v)} value={v}>{humanize(String(v))}</option>)}
                    </select>
                </FormField>
            );
        case 'boolean':
            return (
                <Toggle
                    size="sm"
                    label={label}
                    description={hint}
                    checked={value ?? fs.default ?? false}
                    onChange={onChange}
                    ariaLabel={label}
                    disabled={disabled}
                />
            );
        case 'int':
            return (
                <FormField label={label} hint={hint}>
                    <input
                        type="number"
                        className={INPUT_CLS}
                        value={value ?? ''}
                        min={fs.min}
                        max={fs.max}
                        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
                        disabled={disabled}
                        aria-label={label}
                    />
                </FormField>
            );
        case 'switchCases':
            return <SwitchCasesField label="Cases" value={value} onChange={onChange} disabled={disabled} />;
        case 'navParams':
        case 'recordValues':
        case 'inputMapping':
            return (
                <KeyedBindingsField
                    label={label}
                    shape={fs.type}
                    value={value}
                    onChange={onChange}
                    definition={definition}
                    node={node}
                    // A record's values are addressed by COLUMN, and the step
                    // already names the table — so offer its columns instead of
                    // asking for one to be spelled correctly from memory.
                    columns={fs.type === 'recordValues' ? columnOptions(references.fieldsFor(step?.tableId)) : []}
                    required={required}
                    formFields={formFields}
                    disabled={disabled}
                />
            );
        case 'url':
        case 'string':
        default:
            return (
                <FormField label={label} hint={hint}>
                    <input
                        type="text"
                        className={INPUT_CLS}
                        value={value ?? ''}
                        onChange={(e) => onChange(e.target.value || (fs.nullable ? null : ''))}
                        placeholder={required ? 'Required' : undefined}
                        maxLength={fs.maxLen}
                        disabled={disabled}
                        spellCheck={false}
                        aria-label={label}
                    />
                </FormField>
            );
    }
}

/**
 * A reference to something else in the app, as a list of NAMES.
 *
 * A value with nothing behind it any more (the screen was deleted, the table
 * renamed away) keeps its own option so the select still shows what the step
 * says, plus a line naming the problem. Silently snapping to blank would lose
 * the only evidence of what the step used to do.
 */
function ReferenceField({ label, hint, kind, value, onChange, options, disabled }) {
    const dangling = isDanglingRef(options, value);
    const empty = options.length === 0;

    return (
        <FormField label={label} hint={hint}>
            <select
                className={INPUT_CLS}
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                aria-label={label}
                aria-invalid={dangling ? 'true' : undefined}
            >
                <option value="">{REFERENCE_PLACEHOLDERS[kind] || 'Pick one…'}</option>
                {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                {dangling ? <option value={value}>{value} — missing</option> : null}
            </select>
            {dangling ? (
                <span className="mt-1 flex items-center gap-1 text-[11px] text-[var(--error)]" data-ref-missing="true">
                    <AlertTriangle size={11} aria-hidden="true" />
                    This no longer exists. Pick another one.
                </span>
            ) : empty ? (
                <span className="mt-1 block text-[11px] text-[var(--text-secondary)]">
                    {REFERENCE_EMPTY_HINTS[kind]}
                </span>
            ) : null}
        </FormField>
    );
}

/** The searchable routine picker, as a field. */
function RoutineRefField({ label, hint, value, onChange, options, formFields, disabled }) {
    const [picking, setPicking] = useState(false);
    const name = value ? labelForRef(options, value) : '';
    const dangling = isDanglingRef(options, value);

    return (
        <FormField label={label} hint={hint}>
            <button
                type="button"
                onClick={() => setPicking(true)}
                disabled={disabled}
                aria-label={label}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md border text-left transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)] ${
                    dangling ? 'border-[var(--error)]' : 'border-[var(--border-default)] hover:bg-[var(--bg-tertiary)]'
                } bg-[var(--bg-secondary)]`}
            >
                <Workflow className="w-3.5 h-3.5 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
                <span className={`flex-1 min-w-0 truncate ${name ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                    {name || REFERENCE_PLACEHOLDERS.automation}
                </span>
                <span className="shrink-0 text-[11px] text-[var(--text-secondary)]">{value ? 'Change' : ''}</span>
            </button>
            {dangling ? (
                <span className="mt-1 flex items-center gap-1 text-[11px] text-[var(--error)]" data-ref-missing="true">
                    <AlertTriangle size={11} aria-hidden="true" />
                    This routine no longer exists. Pick another one.
                </span>
            ) : null}
            <RoutinePicker
                open={picking}
                onClose={() => setPicking(false)}
                formFields={formFields}
                onPick={(automation) => { setPicking(false); onChange(automation?.id || ''); }}
            />
        </FormField>
    );
}

/**
 * The VALUE half of one keyed row — and only the kinds the server accepts for
 * that shape.
 *
 * All three shapes used the full BindingField, which offers a table, a saved
 * view, a connector, a routine's result and an aggregate. Only `recordValues`
 * takes a full binding: `inputMapping` accepts static|field
 * (INPUT_MAPPING_KINDS) and `navParams` accepts static|formula, and anything
 * else is a hard validation error — so picking "A table in this app" for a
 * routine's input made every later autosave 422 with a message about a mapping
 * kind nobody had chosen from a list that offered it.
 */
function RowValueField({ shape, value, onChange, definition, node, formFields, disabled }) {
    if (shape === 'recordValues') {
        return (
            <BindingField
                label={null}
                value={value}
                onChange={onChange}
                definition={definition}
                node={node}
                disabled={disabled}
            />
        );
    }

    // navigate params: a fixed value, or a formula worked out when it runs.
    if (shape === 'navParams') {
        const isFormula = value?.kind === 'formula';
        return (
            <div className="flex flex-col gap-1.5">
                <SegmentedControl
                    value={isFormula ? 'formula' : 'static'}
                    onChange={(next) => onChange(next === 'formula'
                        ? { kind: 'formula', expr: '' }
                        : { kind: 'static', value: '' })}
                    options={[{ value: 'static', label: 'A fixed value' }, { value: 'formula', label: 'Worked out' }]}
                    size="sm"
                    ariaLabel="Where this value comes from"
                />
                {isFormula ? (
                    <ExpressionInput
                        variant="inline"
                        value={value?.expr || ''}
                        onChange={(expr) => onChange({ kind: 'formula', expr })}
                        definition={definition}
                        node={node}
                        ariaLabel="Value formula"
                        disabled={disabled}
                    />
                ) : (
                    <input
                        type="text"
                        className={INPUT_CLS}
                        value={value?.value ?? ''}
                        onChange={(e) => onChange({ kind: 'static', value: e.target.value })}
                        disabled={disabled}
                        aria-label="Fixed value"
                    />
                )}
            </div>
        );
    }

    // A routine's inputs: a fixed value, or one of the enclosing form's fields.
    const isField = value?.kind === 'field';
    return (
        <div className="flex flex-col gap-1.5">
            <SegmentedControl
                value={isField ? 'field' : 'static'}
                onChange={(next) => onChange(next === 'field'
                    ? { kind: 'field', name: formFields[0]?.name || '' }
                    : { kind: 'static', value: '' })}
                options={[{ value: 'static', label: 'A fixed value' }, { value: 'field', label: 'From the form' }]}
                size="sm"
                ariaLabel="Where this value comes from"
            />
            {isField ? (
                <select
                    className={INPUT_CLS}
                    value={value?.name || ''}
                    onChange={(e) => onChange({ kind: 'field', name: e.target.value })}
                    disabled={disabled}
                    aria-label="Form field"
                >
                    <option value="">Pick a field…</option>
                    {formFields.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
                    {value?.name && !formFields.some((f) => f.name === value.name)
                        ? <option value={value.name}>{value.name} — not on this form</option>
                        : null}
                </select>
            ) : (
                <input
                    type="text"
                    className={INPUT_CLS}
                    value={value?.value ?? ''}
                    onChange={(e) => onChange({ kind: 'static', value: e.target.value })}
                    disabled={disabled}
                    aria-label="Fixed value"
                />
            )}
        </div>
    );
}

/**
 * What each branch of a "Depending on…" step matches.
 *
 * Only the VALUES: the steps inside a case are drawn on the canvas, and are
 * carried through untouched here. The runner compares `case.value` against the
 * step's expression (useActionRunner.caseMatches, loosely, so "2" matches 2),
 * and canonicalize keeps exactly { value, steps } — so a case without a value
 * can never match anything.
 */
function SwitchCasesField({ label, value, onChange, disabled }) {
    const cases = Array.isArray(value) ? value : [];
    const commit = (next) => onChange(next);

    return (
        <div className="flex flex-col gap-2">
            <span className="text-[11px] font-medium text-[var(--text-secondary)]">{label}</span>
            <p className="text-[11px] text-[var(--text-secondary)]">
                Each case runs when the value above equals what you type here. Anything that
                matches nothing runs “Otherwise”.
            </p>
            {cases.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5">
                    <input
                        type="text"
                        className={INPUT_CLS}
                        value={c?.value ?? ''}
                        onChange={(e) => commit(cases.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                        placeholder="e.g. paid"
                        disabled={disabled}
                        spellCheck={false}
                        aria-label={`Case ${i + 1} value`}
                    />
                    <button
                        type="button"
                        onClick={() => commit(cases.filter((_, j) => j !== i))}
                        disabled={disabled}
                        aria-label={`Remove case ${i + 1}`}
                        className="shrink-0 px-2 py-1 text-[11px] rounded border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--error)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)]"
                    >
                        Remove
                    </button>
                </div>
            ))}
            <button
                type="button"
                onClick={() => commit([...cases, { value: '', steps: [] }])}
                disabled={disabled}
                className="self-start px-2.5 py-1 text-[11px] font-medium rounded border border-dashed border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)]"
            >
                Add a case
            </button>
        </div>
    );
}

/**
 * A map of name → value, where each value is a binding. Three spec types share
 * this shape (navigate params, a record's column values, a routine's inputs);
 * they differ only in what the names mean, which the label already says.
 *
 * When the names are COLUMNS of a known table (`columns`), the name box becomes
 * a picker: a mistyped column is a write that fails at run time with a message
 * about a column nobody meant to name.
 *
 * ── WHY A ROW CAN BE UNNAMED WITHOUT BEING COMMITTED ────────────────
 * The stored shape is an OBJECT, so two rows cannot share a name — and a plain
 * Object.fromEntries over the row list resolves that collision by keeping the
 * last one and throwing the other away. That is how it used to work, so
 * clicking "Add one" twice destroyed the first row's binding without a word,
 * and so did renaming one row to match another. An unnamed or clashing row
 * therefore waits in local state until it has a name of its own; only named,
 * unique rows are committed.
 *
 * The other half: `commit([])` used to emit `undefined`, which on a REQUIRED
 * field (create_record's `values`) is a hard validation error — removing the
 * last column made the whole definition unsaveable, with the error surfacing
 * far from the step that caused it. A required field empties to `{}`, a shape
 * the schema accepts, so the app keeps saving while the step is incomplete.
 */
function KeyedBindingsField({ label, shape, value, onChange, definition, node, columns = [], required = false, formFields = [], disabled }) {
    const stored = Object.entries(value && typeof value === 'object' ? value : {});
    // Rows the author has added or blanked but not yet named. Local, because
    // they cannot be represented in an object keyed by name — and held WITH
    // their position, or clearing a name would make the row jump to the bottom
    // of the list while the author was still typing in it.
    const [drafts, setDrafts] = useState([]);   // [{ at, row }]
    // The row whose rename was refused because the name is taken. UI only.
    const [clash, setClash] = useState(null);

    const rows = mergeDrafts(stored, drafts);
    const commit = (next) => {
        setClash(null);
        const { named, drafts: nextDrafts } = splitNamed(next);
        setDrafts(nextDrafts);
        // Optional fields drop out entirely when empty; a required one stays as
        // an empty map so the definition keeps validating.
        onChange(named.length ? Object.fromEntries(named) : (required ? {} : undefined));
    };

    const setRowName = (i, name) => {
        if (name && rows.some(([n], j) => j !== i && n === name)) { setClash(i); return; }
        commit(rows.map((r, j) => (j === i ? [name, r[1]] : r)));
    };

    const namePlaceholder = shape === 'recordValues' ? 'column' : 'name';
    const used = new Set(rows.map(([n]) => n));
    const nextColumn = columns.find((c) => !used.has(c.key))?.key || '';

    return (
        <div className="flex flex-col gap-2">
            <span className="text-[11px] font-medium text-[var(--text-secondary)]">{label}</span>
            {rows.length === 0 ? (
                <p className="text-[11px] text-[var(--text-secondary)]">Nothing set.</p>
            ) : null}
            {rows.map(([name, binding], i) => (
                <div key={i} className="rounded-md border border-[var(--border-subtle)] p-2 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                        {columns.length ? (
                            <select
                                className={INPUT_CLS}
                                value={name}
                                onChange={(e) => setRowName(i, e.target.value)}
                                disabled={disabled}
                                aria-label={`${label} ${i + 1} name`}
                            >
                                <option value="">Pick a column…</option>
                                {columns.map((c) => (
                                    <option key={c.key} value={c.key} disabled={c.key !== name && used.has(c.key)}>
                                        {c.label}{c.required ? ' *' : ''}
                                    </option>
                                ))}
                                {name && !columns.some((c) => c.key === name)
                                    ? <option value={name}>{name} — not a column</option>
                                    : null}
                            </select>
                        ) : (
                            <input
                                type="text"
                                className={INPUT_CLS}
                                value={name}
                                onChange={(e) => setRowName(i, e.target.value)}
                                placeholder={namePlaceholder}
                                disabled={disabled}
                                spellCheck={false}
                                aria-label={`${label} ${i + 1} name`}
                            />
                        )}
                        <button
                            type="button"
                            onClick={() => commit(rows.filter((_, j) => j !== i))}
                            disabled={disabled}
                            aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}
                            className="shrink-0 px-2 py-1 text-[11px] rounded border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--error)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)]"
                        >
                            Remove
                        </button>
                    </div>
                    {clash === i ? (
                        <span className="text-[11px] text-[var(--error)]" data-name-clash="true">
                            That name is already used above. Pick another one.
                        </span>
                    ) : null}
                    {!name ? (
                        <span className="text-[11px] text-[var(--text-tertiary)]">
                            Give this a {namePlaceholder} — it is not saved until you do.
                        </span>
                    ) : null}
                    <RowValueField
                        shape={shape}
                        value={binding}
                        onChange={(b) => commit(rows.map((r, j) => (j === i ? [r[0], b] : r)))}
                        definition={definition}
                        node={node}
                        formFields={formFields}
                        disabled={disabled}
                    />
                </div>
            ))}
            <button
                type="button"
                onClick={() => commit([...rows, [columns.length ? nextColumn : '', { kind: 'static', value: '' }]])}
                disabled={disabled}
                className="self-start px-2.5 py-1 text-[11px] font-medium rounded border border-dashed border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)]"
            >
                Add one
            </button>
        </div>
    );
}

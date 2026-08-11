import React from 'react';
import { stepMeta } from './stepCatalog';
import FormField from '../../../../shared/FormField';
import Toggle from '../../../../shared/Toggle';
import ExpressionInput from '../inspector/logic/ExpressionInput';
import BindingField from '../inspector/panels/BindingField';
import { INPUT_CLS } from '../inspector/panels/kit';
import { useCatalogStepSpecs } from '../inspector/panels/SpecPanel';

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
 */

// Fields whose editor is the canvas itself.
const CANVAS_TYPES = new Set(['steps', 'switchCases']);

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
};

export default function StepSettings({ step, onChange, definition, node = null, screens = [], disabled = false }) {
    const stepSpecs = useCatalogStepSpecs();
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

    const fields = Object.entries(spec.fields).filter(([, fs]) => !CANVAS_TYPES.has(fs.type));

    return (
        <div className="flex flex-col gap-3" data-step-settings={step.kind}>
            <p className="text-xs text-[var(--text-secondary)]">{meta.blurb}</p>

            {fields.map(([key, fs]) => (
                <StepField
                    key={key}
                    fieldKey={key}
                    fs={fs}
                    value={step[key]}
                    onChange={(v) => set({ [key]: v })}
                    definition={definition}
                    node={node}
                    screens={screens}
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

function StepField({ fieldKey, fs, value, onChange, definition, node, screens, disabled }) {
    const label = humanize(fieldKey);
    const hint = HINTS[fieldKey];
    const required = !!fs.required;

    // A screen reference is a pick, never a typed id.
    if (fieldKey === 'screenId') {
        return (
            <FormField label={label} hint={hint}>
                <select
                    className={INPUT_CLS}
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    aria-label={label}
                >
                    <option value="">Pick a screen…</option>
                    {screens.map((s) => <option key={s.id} value={s.id}>{s.name || s.id}</option>)}
                </select>
            </FormField>
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
        case 'navParams':
        case 'recordValues':
        case 'inputMapping':
            return <KeyedBindingsField label={label} shape={fs.type} value={value} onChange={onChange} definition={definition} node={node} disabled={disabled} />;
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
 * A map of name → value, where each value is a binding. Three spec types share
 * this shape (navigate params, a record's column values, a routine's inputs);
 * they differ only in what the names mean, which the label already says.
 */
function KeyedBindingsField({ label, shape, value, onChange, definition, node, disabled }) {
    const rows = Object.entries(value && typeof value === 'object' ? value : {});
    const commit = (next) => onChange(next.length ? Object.fromEntries(next) : undefined);

    const namePlaceholder = shape === 'recordValues' ? 'column' : 'name';

    return (
        <div className="flex flex-col gap-2">
            <span className="text-[11px] font-medium text-[var(--text-secondary)]">{label}</span>
            {rows.length === 0 ? (
                <p className="text-[11px] text-[var(--text-secondary)]">Nothing set.</p>
            ) : null}
            {rows.map(([name, binding], i) => (
                <div key={i} className="rounded-md border border-[var(--border-subtle)] p-2 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                        <input
                            type="text"
                            className={INPUT_CLS}
                            value={name}
                            onChange={(e) => commit(rows.map((r, j) => (j === i ? [e.target.value, r[1]] : r)))}
                            placeholder={namePlaceholder}
                            disabled={disabled}
                            spellCheck={false}
                            aria-label={`${label} ${i + 1} name`}
                        />
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
                    <BindingField
                        label={null}
                        value={binding}
                        onChange={(b) => commit(rows.map((r, j) => (j === i ? [r[0], b] : r)))}
                        definition={definition}
                        node={node}
                        disabled={disabled}
                    />
                </div>
            ))}
            <button
                type="button"
                onClick={() => commit([...rows, ['', { kind: 'static', value: '' }]])}
                disabled={disabled}
                className="self-start px-2.5 py-1 text-[11px] font-medium rounded border border-dashed border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)]"
            >
                Add one
            </button>
        </div>
    );
}

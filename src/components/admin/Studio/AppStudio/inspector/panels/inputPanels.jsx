import React from 'react';
import FormField from '../../../../../shared/FormField';
import SegmentedControl from '../../../../../shared/SegmentedControl';
import Slider from '../../../../../shared/Slider';
import Toggle from '../../../../../shared/Toggle';
import { RepeatableList, inputCls } from '../../../../ProductWebsite/fields';
import BindingField from './BindingField';
import { registerInspector } from '../registry';
import { TextField, NumberField, INPUT_CLS, usePatch } from './kit';

/**
 * Content panels for the six input_* types. They share the common
 * name/label(/placeholder/required) block and add their type-specific
 * fields (prop tables mirrored from server/appStudio/componentSpecs.js,
 * authoritative). Registered individually at the bottom.
 */

function CommonFields({ props, patch, disabled, placeholder = true }) {
    return (
        <>
            <TextField
                label="Field name"
                value={props.name}
                onChange={(v) => patch({ name: v })}
                hint="The key this value submits as."
                disabled={disabled}
            />
            <TextField label="Label" value={props.label} onChange={(v) => patch({ label: v })} disabled={disabled} />
            {placeholder && (
                <TextField
                    label="Placeholder"
                    value={props.placeholder}
                    onChange={(v) => patch({ placeholder: v || null })}
                    placeholder="Optional"
                    disabled={disabled}
                />
            )}
        </>
    );
}

/**
 * `valueFrom` — the binding that fills a field from OUTSIDE the form.
 *
 * Six input types declare it and the runtime has always honoured it, but no
 * panel offered it: an "edit this record" form always opened blank and an "AI
 * draft" button could only be wired by the AI builder. It is a full binding, so
 * it gets the ordinary BindingField rather than a bespoke box.
 */
export function PrefillField({ node, definition, patch, disabled }) {
    return (
        <BindingField
            label="Prefill from"
            value={node.props?.valueFrom}
            onChange={(v) => patch({ valueFrom: v })}
            definition={definition}
            node={node}
            hint="Fills the field from a record, a variable or an action result. The person can still type over it."
            placeholder="Nothing — the field starts empty"
            disabled={disabled}
        />
    );
}

function RequiredToggle({ props, patch, disabled }) {
    return (
        <Toggle
            label="Required"
            checked={!!props.required}
            onChange={(v) => patch({ required: v })}
            disabled={disabled}
            size="sm"
        />
    );
}

// ── input_text ─────────────────────────────────────────────────────────────

const INPUT_TYPES_OPTS = [
    { value: 'text', label: 'Text' },
    { value: 'email', label: 'Email' },
    { value: 'url', label: 'URL' },
];

export function InputTextInspector({ node, definition, onCommit, disabled = false }) {
    const props = node.props || {};
    const patch = usePatch(node, definition, onCommit);
    return (
        <div className="flex flex-col gap-4">
            <CommonFields props={props} patch={patch} disabled={disabled} />
            <FormField label="Type">
                <SegmentedControl
                    value={props.inputType ?? 'text'}
                    onChange={(v) => patch({ inputType: v })}
                    options={INPUT_TYPES_OPTS}
                    size="sm"
                    fullWidth
                    disabled={disabled}
                    ariaLabel="Input type"
                />
            </FormField>
            <TextField
                label="Default value"
                value={props.defaultValue}
                onChange={(v) => patch({ defaultValue: v || null })}
                placeholder="Optional"
                disabled={disabled}
            />
            <PrefillField node={node} definition={definition} patch={patch} disabled={disabled} />
            <RequiredToggle props={props} patch={patch} disabled={disabled} />
        </div>
    );
}

// ── input_textarea ─────────────────────────────────────────────────────────

export function InputTextareaInspector({ node, definition, onCommit, disabled = false }) {
    const props = node.props || {};
    const patch = usePatch(node, definition, onCommit);
    return (
        <div className="flex flex-col gap-4">
            <CommonFields props={props} patch={patch} disabled={disabled} />
            <Slider
                label="Rows"
                value={Number.isFinite(props.rows) ? props.rows : 4}
                onChange={(v) => patch({ rows: Math.max(2, Math.min(10, Math.round(v))) })}
                min={2}
                max={10}
                step={1}
                disabled={disabled}
            />
            <PrefillField node={node} definition={definition} patch={patch} disabled={disabled} />
            <RequiredToggle props={props} patch={patch} disabled={disabled} />
        </div>
    );
}

// ── input_number ───────────────────────────────────────────────────────────

export function InputNumberInspector({ node, definition, onCommit, disabled = false }) {
    const props = node.props || {};
    const patch = usePatch(node, definition, onCommit);
    return (
        <div className="flex flex-col gap-4">
            <CommonFields props={props} patch={patch} disabled={disabled} placeholder={false} />
            <div className="grid grid-cols-2 gap-3">
                <NumberField label="Min" value={props.min} onChange={(v) => patch({ min: v })} placeholder="—" disabled={disabled} />
                <NumberField label="Max" value={props.max} onChange={(v) => patch({ max: v })} placeholder="—" disabled={disabled} />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <NumberField label="Step" value={props.step} onChange={(v) => patch({ step: v ?? 1 })} step="any" disabled={disabled} />
                <NumberField label="Default" value={props.defaultValue} onChange={(v) => patch({ defaultValue: v })} placeholder="—" disabled={disabled} />
            </div>
            {/* No "Prefill from" here: input_number is one of the two input
                types whose spec does not declare valueFrom (checkbox is the
                other), and offering a prop the validator rejects is worse than
                not offering it. */}
            <RequiredToggle props={props} patch={patch} disabled={disabled} />
        </div>
    );
}

// ── input_select ───────────────────────────────────────────────────────────

export function InputSelectInspector({ node, definition, onCommit, disabled = false }) {
    const props = node.props || {};
    const patch = usePatch(node, definition, onCommit);
    return (
        <div className="flex flex-col gap-4">
            <CommonFields props={props} patch={patch} disabled={disabled} />
            <fieldset disabled={disabled} className="min-w-0">
                <RepeatableList
                    label="Options"
                    items={props.options || []}
                    onChange={(options) => patch({ options })}
                    makeNew={() => ({ value: '', label: '' })}
                    addLabel="Add option"
                    itemLabel={(o) => o.label || o.value}
                    renderItem={(opt, update) => (
                        <div className="flex flex-col gap-2">
                            <input
                                type="text"
                                className={inputCls}
                                value={opt.value || ''}
                                onChange={(e) => update({ ...opt, value: e.target.value })}
                                placeholder="Value (submitted)"
                                spellCheck={false}
                            />
                            <input
                                type="text"
                                className={inputCls}
                                value={opt.label || ''}
                                onChange={(e) => update({ ...opt, label: e.target.value })}
                                placeholder="Label (shown)"
                            />
                        </div>
                    )}
                />
            </fieldset>
            <TextField
                label="Default value"
                value={props.defaultValue}
                onChange={(v) => patch({ defaultValue: v || null })}
                hint="Must match one of the option values."
                disabled={disabled}
            />
            <PrefillField node={node} definition={definition} patch={patch} disabled={disabled} />
            <RequiredToggle props={props} patch={patch} disabled={disabled} />
        </div>
    );
}

// ── input_checkbox ─────────────────────────────────────────────────────────

export function InputCheckboxInspector({ node, definition, onCommit, disabled = false }) {
    const props = node.props || {};
    const patch = usePatch(node, definition, onCommit);
    return (
        <div className="flex flex-col gap-4">
            <TextField
                label="Field name"
                value={props.name}
                onChange={(v) => patch({ name: v })}
                hint="The key this value submits as."
                disabled={disabled}
            />
            <TextField label="Label" value={props.label} onChange={(v) => patch({ label: v })} disabled={disabled} />
            <Toggle
                label="Checked by default"
                checked={!!props.defaultChecked}
                onChange={(v) => patch({ defaultChecked: v })}
                disabled={disabled}
                size="sm"
            />
        </div>
    );
}

// ── input_date ─────────────────────────────────────────────────────────────

// defaultValue: null | 'today' | an ISO date (allowIsoDate in the spec).

/** Today as YYYY-MM-DD in the EDITOR's timezone — toISOString() is UTC, which
 *  seeds yesterday's date for anyone east of it. */
export function todayLocalIso() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const DATE_DEFAULTS = [
    { value: 'none', label: 'None' },
    { value: 'today', label: 'Today' },
    { value: 'date', label: 'Pick a date' },
];

export function InputDateInspector({ node, definition, onCommit, disabled = false }) {
    const props = node.props || {};
    const patch = usePatch(node, definition, onCommit);
    const dv = props.defaultValue ?? null;
    const mode = dv === null ? 'none' : (dv === 'today' ? 'today' : 'date');
    return (
        <div className="flex flex-col gap-4">
            <CommonFields props={props} patch={patch} disabled={disabled} placeholder={false} />
            <FormField label="Default">
                <div className="flex flex-col gap-2">
                    <SegmentedControl
                        value={mode}
                        onChange={(m) => {
                            if (m === 'none') patch({ defaultValue: null });
                            else if (m === 'today') patch({ defaultValue: 'today' });
                            else patch({ defaultValue: todayLocalIso() });
                        }}
                        options={DATE_DEFAULTS}
                        size="sm"
                        fullWidth
                        disabled={disabled}
                        ariaLabel="Default date"
                    />
                    {mode === 'date' && (
                        <input
                            type="date"
                            className={INPUT_CLS}
                            value={dv}
                            onChange={(e) => patch({ defaultValue: e.target.value || null })}
                            disabled={disabled}
                            aria-label="Default date value"
                        />
                    )}
                </div>
            </FormField>
            <PrefillField node={node} definition={definition} patch={patch} disabled={disabled} />
            <RequiredToggle props={props} patch={patch} disabled={disabled} />
        </div>
    );
}

registerInspector('input_text', InputTextInspector);
registerInspector('input_textarea', InputTextareaInspector);
registerInspector('input_number', InputNumberInspector);
registerInspector('input_select', InputSelectInspector);
registerInspector('input_checkbox', InputCheckboxInspector);
registerInspector('input_date', InputDateInspector);

import React from 'react';
import BindingField from './BindingField';
import { FieldKeyField, TextField, usePatch } from './kit';
import FormField from '../../../../../shared/FormField';
import SegmentedControl from '../../../../../shared/SegmentedControl';
import { RepeatableList, inputCls } from '../../../../ProductWebsite/fields';
import { registerInspector } from '../registry';

/**
 * Content panel for record_detail. Props mirror componentSpecs.js
 * (authoritative). Bespoke for the fields list UX (key/label/format rows) and
 * the 1–3 column layout picker.
 */

const FORMATS = ['text', 'number', 'date', 'datetime', 'badge', 'link', 'markdown'];
const COLUMN_OPTIONS = [
    { value: 1, label: '1 column' },
    { value: 2, label: '2 columns' },
    { value: 3, label: '3 columns' },
];

export default function RecordDetailInspector({ node, definition, onCommit, disabled = false }) {
    const props = node.props || {};
    const patch = usePatch(node, definition, onCommit);

    return (
        <div className="flex flex-col gap-4">
            <BindingField
                label="Source"
                value={props.source}
                onChange={(v) => patch({ source: v })}
                definition={definition}
                hint="ONE record — typically a record binding filtered by screen.params."
                placeholder='{"name":"…"}'
                disabled={disabled}
            />
            <fieldset disabled={disabled} className="min-w-0">
                <RepeatableList
                    label="Fields"
                    items={props.fields || []}
                    onChange={(fields) => patch({ fields })}
                    makeNew={() => ({ key: '', label: '', format: 'text' })}
                    addLabel="Add field"
                    collapsible
                    itemLabel={(f) => f.label || f.key}
                    renderItem={(field, update) => (
                        <div className="flex flex-col gap-2">
                            {/* The panel already holds the source binding, so
                                the column list is right there — this used to be
                                free text and a typo like "statuss" produced a
                                silently blank row, exactly what every other data
                                panel stopped doing when it moved to FieldKeyField. */}
                            <FieldKeyField
                                value={field.key}
                                onChange={(v) => update({ ...field, key: v })}
                                source={props.source}
                                placeholder="Key (e.g. status)"
                                ariaLabel="Field key"
                            />
                            <input
                                type="text"
                                className={inputCls}
                                value={field.label || ''}
                                onChange={(e) => update({ ...field, label: e.target.value })}
                                placeholder="Label (optional)"
                                aria-label="Field label"
                            />
                            <select
                                className={inputCls}
                                value={field.format || 'text'}
                                onChange={(e) => update({ ...field, format: e.target.value })}
                                aria-label="Field format"
                            >
                                {FORMATS.map((f) => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                            </select>
                        </div>
                    )}
                />
            </fieldset>
            <p className="text-xs text-[var(--text-secondary)]">
                Leave fields empty to show every column of the record.
            </p>
            <FormField label="Layout">
                <SegmentedControl
                    value={Number.isInteger(props.columns) ? props.columns : 2}
                    onChange={(v) => patch({ columns: v })}
                    options={COLUMN_OPTIONS}
                    size="sm"
                    fullWidth
                    disabled={disabled}
                    ariaLabel="Detail columns"
                />
            </FormField>
            <TextField
                label="Empty text"
                value={props.emptyText}
                onChange={(v) => patch({ emptyText: v })}
                disabled={disabled}
            />
        </div>
    );
}

registerInspector('record_detail', RecordDetailInspector);

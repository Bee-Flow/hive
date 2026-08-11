import React from 'react';
import Slider from '../../../../../shared/Slider';
import { RepeatableList, inputCls } from '../../../../ProductWebsite/fields';
import { registerInspector } from '../registry';
import BindingField from './BindingField';
import { FieldKeyField, TextField , usePatch } from './kit';

// Mirror of the table column `format` enum (componentSpecs.js, authoritative).
const FORMATS = ['text', 'number', 'date', 'badge', 'link'];

export default function TableInspector({ node, definition, onCommit, disabled = false }) {
    const props = node.props || {};
    const patch = usePatch(node, definition, onCommit);

    return (
        <div className="flex flex-col gap-4">
            <BindingField
                label="Source"
                value={props.source}
                onChange={(v) => patch({ source: v })}
                definition={definition}
                hint="An array of objects — usually a routine result."
                placeholder='[{"title":"…"}]'
                disabled={disabled}
            />
            <fieldset disabled={disabled} className="min-w-0">
                <RepeatableList
                    label="Columns"
                    items={props.columns || []}
                    onChange={(columns) => patch({ columns })}
                    makeNew={() => ({ key: '', label: '', format: 'text' })}
                    addLabel="Add column"
                    itemLabel={(c) => c.label || c.key}
                    renderItem={(col, update) => (
                        <div className="flex flex-col gap-2">
                            <FieldKeyField
                                value={col.key}
                                onChange={(v) => update({ ...col, key: v })}
                                source={props.source}
                                placeholder="Key (e.g. status)"
                                ariaLabel="Column field"
                            />
                            <input
                                type="text"
                                className={inputCls}
                                value={col.label || ''}
                                onChange={(e) => update({ ...col, label: e.target.value })}
                                placeholder="Heading (optional)"
                            />
                            <select
                                className={inputCls}
                                value={col.format || 'text'}
                                onChange={(e) => update({ ...col, format: e.target.value })}
                                aria-label="Column format"
                            >
                                {FORMATS.map((f) => (
                                    <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                                ))}
                            </select>
                        </div>
                    )}
                />
            </fieldset>
            <TextField
                label="Empty text"
                value={props.emptyText}
                onChange={(v) => patch({ emptyText: v })}
                disabled={disabled}
            />
            <Slider
                label="Row limit"
                value={Number.isFinite(props.rowLimit) ? props.rowLimit : 25}
                onChange={(v) => patch({ rowLimit: Math.max(1, Math.min(100, Math.round(v))) })}
                min={1}
                max={100}
                step={1}
                suffix=" rows"
                disabled={disabled}
            />
        </div>
    );
}

registerInspector('table', TableInspector);

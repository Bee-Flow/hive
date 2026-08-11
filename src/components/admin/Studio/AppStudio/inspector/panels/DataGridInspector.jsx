import React from 'react';
import BindingField from './BindingField';
import { FieldKeyField, TextField , usePatch } from './kit';
import FormField from '../../../../../shared/FormField';
import SegmentedControl from '../../../../../shared/SegmentedControl';
import Slider from '../../../../../shared/Slider';
import Toggle from '../../../../../shared/Toggle';
import { RepeatableList, inputCls } from '../../../../ProductWebsite/fields';
import { actionOptions } from '../actionLabels';
import { registerInspector } from '../registry';

// Mirror of the data_grid column `format` enum (componentSpecs.js, authoritative).
const FORMATS = ['text', 'number', 'date', 'badge', 'link', 'boolean', 'relation'];
const SELECTABLE = [
    { value: 'none', label: 'None' },
    { value: 'single', label: 'Single' },
    { value: 'multi', label: 'Multi' },
];
const DENSITY = [
    { value: 'compact', label: 'Compact' },
    { value: 'comfortable', label: 'Cozy' },
    { value: 'spacious', label: 'Roomy' },
];

/** Content panel for data_grid. Props mirror componentSpecs.js (authoritative). */
export default function DataGridInspector({ node, definition, onCommit, disabled = false }) {
    const props = node.props || {};
    // A raw 'act_a1b2c3' told the author nothing — naming each action the way
    // the Actions accordion names it is the difference between choosing and guessing.
    const actions = actionOptions(definition);
    const actionIds = actions.map((a) => a.id);
    const patch = usePatch(node, definition, onCommit);

    return (
        <div className="flex flex-col gap-4">
            <BindingField
                label="Data"
                value={props.source}
                onChange={(v) => patch({ source: v })}
                definition={definition}
                componentType="data_grid"
                hint="Where the rows in this table come from."
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
                    collapsible
                    itemLabel={(c) => c.label || c.key}
                    renderItem={(col, update) => (
                        <div className="flex flex-col gap-2">
                            <FieldKeyField value={col.key} onChange={(v) => update({ ...col, key: v })} source={props.source} placeholder="Key (e.g. status)" ariaLabel="Column field" />
                            <input type="text" className={inputCls} value={col.label || ''} onChange={(e) => update({ ...col, label: e.target.value })} placeholder="Heading (optional)" />
                            <select className={inputCls} value={col.format || 'text'} onChange={(e) => update({ ...col, format: e.target.value })} aria-label="Column format">
                                {FORMATS.map((f) => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                            </select>
                            <div className="flex flex-wrap gap-3">
                                <label className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                                    <input type="checkbox" checked={col.sortable !== false} onChange={(e) => update({ ...col, sortable: e.target.checked })} className="accent-[var(--accent-primary)]" /> Sortable
                                </label>
                                <label className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                                    <input type="checkbox" checked={!!col.filterable} onChange={(e) => update({ ...col, filterable: e.target.checked })} className="accent-[var(--accent-primary)]" /> Filterable
                                </label>
                                <label className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                                    <input type="checkbox" checked={!!col.editable} onChange={(e) => update({ ...col, editable: e.target.checked })} className="accent-[var(--accent-primary)]" /> Editable
                                </label>
                            </div>
                        </div>
                    )}
                />
            </fieldset>
            <FormField label="Selection">
                <SegmentedControl value={props.selectable ?? 'none'} onChange={(v) => patch({ selectable: v })} options={SELECTABLE} size="sm" fullWidth disabled={disabled} ariaLabel="Row selection" />
            </FormField>
            <FormField label="Density">
                <SegmentedControl value={props.density ?? 'comfortable'} onChange={(v) => patch({ density: v })} options={DENSITY} size="sm" fullWidth disabled={disabled} ariaLabel="Row density" />
            </FormField>
            <Slider
                label="Page size"
                value={Number.isFinite(props.pageSize) ? props.pageSize : 25}
                onChange={(v) => patch({ pageSize: Math.max(5, Math.min(100, Math.round(v))) })}
                min={5}
                max={100}
                step={5}
                suffix=" rows"
                disabled={disabled}
            />
            <Toggle label="Searchable" checked={!!props.searchable} onChange={(v) => patch({ searchable: v })} disabled={disabled} size="sm" />
            <fieldset disabled={disabled} className="min-w-0">
                <RepeatableList
                    label="Row actions"
                    items={props.rowActions || []}
                    onChange={(rowActions) => patch({ rowActions })}
                    makeNew={() => ({ label: '', actionId: actionIds[0] || '' })}
                    addLabel="Add row action"
                    itemLabel={(a) => a.label}
                    renderItem={(a, update) => (
                        <div className="flex flex-col gap-2">
                            <input type="text" className={inputCls} value={a.label || ''} onChange={(e) => update({ ...a, label: e.target.value })} placeholder="Button label" />
                            <select className={inputCls} value={a.actionId || ''} onChange={(e) => update({ ...a, actionId: e.target.value })} aria-label="Row action">
                                <option value="">Pick an action…</option>
                                {actions.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                            </select>
                        </div>
                    )}
                />
            </fieldset>
            <TextField label="Empty text" value={props.emptyText} onChange={(v) => patch({ emptyText: v })} disabled={disabled} />
        </div>
    );
}

registerInspector('data_grid', DataGridInspector);

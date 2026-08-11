import React from 'react';
import BindingField from './BindingField';
import { FieldKeyField, usePatch } from './kit';
import Toggle from '../../../../../shared/Toggle';
import { RepeatableList, inputCls } from '../../../../ProductWebsite/fields';
import { registerInspector } from '../registry';
import { COLOR_ROLES } from '../styleKnobMeta';

/**
 * Content panel for kanban. Props mirror componentSpecs.js (authoritative).
 * Bespoke for the columns list (value/label/color) and the drag hint —
 * onCardMove itself is wired as a node event (AI builder / actions tooling),
 * carrying { item: <moved row>, value: <target column value> } as form values.
 */

export default function KanbanInspector({ node, definition, onCommit, disabled = false }) {
    const props = node.props || {};
    const patch = usePatch(node, definition, onCommit);

    return (
        <div className="flex flex-col gap-4">
            <BindingField
                label="Source"
                value={props.source}
                onChange={(v) => patch({ source: v })}
                definition={definition}
                hint="An array of objects — one card per row."
                placeholder='[{"title":"…","status":"open"}]'
                disabled={disabled}
            />
            <FieldKeyField
                label="Group by field"
                value={props.groupByField}
                onChange={(v) => patch({ groupByField: v })}
                source={props.source}
                placeholder="status"
                hint="The field whose value decides the column."
                ariaLabel="Group by field"
                disabled={disabled}
            />
            <fieldset disabled={disabled} className="min-w-0">
                <RepeatableList
                    label="Columns"
                    items={props.columns || []}
                    onChange={(columns) => patch({ columns })}
                    makeNew={() => ({ value: '', label: '', color: 'neutral' })}
                    addLabel="Add column"
                    collapsible
                    itemLabel={(c) => c.label || c.value}
                    renderItem={(col, update) => (
                        <div className="flex flex-col gap-2">
                            <input
                                type="text"
                                className={inputCls}
                                value={col.value || ''}
                                onChange={(e) => update({ ...col, value: e.target.value })}
                                placeholder="Value (e.g. open)"
                                spellCheck={false}
                                aria-label="Column value"
                            />
                            <input
                                type="text"
                                className={inputCls}
                                value={col.label || ''}
                                onChange={(e) => update({ ...col, label: e.target.value })}
                                placeholder="Heading (optional)"
                                aria-label="Column heading"
                            />
                            <select
                                className={inputCls}
                                value={col.color || 'neutral'}
                                onChange={(e) => update({ ...col, color: e.target.value })}
                                aria-label="Column color"
                            >
                                {COLOR_ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                            </select>
                        </div>
                    )}
                />
            </fieldset>
            <p className="text-xs text-[var(--text-muted)]">
                Leave columns empty to derive them from the data&rsquo;s distinct values.
            </p>
            <FieldKeyField label="Title field" value={props.titleKey} onChange={(v) => patch({ titleKey: v })} source={props.source} placeholder="title" ariaLabel="Title field" disabled={disabled} />
            <FieldKeyField label="Subtitle field" value={props.subtitleKey} onChange={(v) => patch({ subtitleKey: v || null })} source={props.source} placeholder="Optional" ariaLabel="Subtitle field" disabled={disabled} />
            <FieldKeyField label="Badge field" value={props.badgeKey} onChange={(v) => patch({ badgeKey: v || null })} source={props.source} placeholder="Optional" ariaLabel="Badge field" disabled={disabled} />
            <Toggle
                label="Allow dragging cards"
                checked={props.allowDrag !== false}
                onChange={(v) => patch({ allowDrag: v })}
                disabled={disabled}
                size="sm"
            />
            <p className="text-xs text-[var(--text-muted)]">
                Dropping a card fires the node&rsquo;s <code>onCardMove</code> action with
                <code> form.item</code> (the row) and <code>form.value</code> (the new column value).
            </p>
        </div>
    );
}

registerInspector('kanban', KanbanInspector);

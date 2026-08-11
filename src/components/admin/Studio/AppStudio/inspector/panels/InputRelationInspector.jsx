import React from 'react';
import { FieldKeyField, TextField, usePatch, INPUT_CLS } from './kit';
import ExpressionInput from '../logic/ExpressionInput';
import { registerInspector } from '../registry';
import useAppTables from '../../bi/useAppTables';
import { useEditorChrome } from '../../editor/EditorChromeContext';
import FormField from '../../../../../shared/FormField';
import Toggle from '../../../../../shared/Toggle';

/**
 * Content panel for input_relation. Props mirror componentSpecs.js (authoritative).
 *
 * The table was a free-text box the author had to fill with a raw `tbl_…` id,
 * and the display field and filter were untyped strings — while this very
 * folder already ships a table picker, a field picker and an expression editor.
 * So the one input that exists to point at another table was the one place you
 * had to know an id by heart.
 */
export default function InputRelationInspector({ node, definition, onCommit, disabled = false }) {
    const props = node.props || {};
    const patch = usePatch(node, definition, onCommit);
    const chrome = useEditorChrome();
    const appId = chrome?.appId ?? null;

    return (
        <div className="flex flex-col gap-4">
            <TextField label="Field name" value={props.name} onChange={(v) => patch({ name: v })} hint="The key this value submits as (record id)." disabled={disabled} />
            <TextField label="Label" value={props.label} onChange={(v) => patch({ label: v })} disabled={disabled} />

            <FormField label="Data table" hint="Which table to pick records from.">
                {/* useAppTables is a network hook, so it is only mounted where
                    an app id exists — outside the editor shell the raw field
                    still works rather than the panel crashing. */}
                {appId ? (
                    <TablePicker
                        appId={appId}
                        value={props.tableId || ''}
                        onChange={(v) => patch({ tableId: v || null })}
                        disabled={disabled}
                    />
                ) : (
                    <input
                        type="text"
                        className={INPUT_CLS}
                        value={props.tableId || ''}
                        onChange={(e) => patch({ tableId: e.target.value || null })}
                        placeholder="Open the app to pick a table"
                        disabled={disabled}
                        spellCheck={false}
                        aria-label="Data table"
                    />
                )}
            </FormField>

            <FieldKeyField
                label="Display field"
                value={props.displayField}
                onChange={(v) => patch({ displayField: v || null })}
                // A relation points at a TABLE, so the field list comes from
                // that table rather than from this component's own source.
                source={props.tableId ? { kind: 'records', tableId: props.tableId } : null}
                placeholder="name"
                hint="Which field labels each option."
                ariaLabel="Display field"
                disabled={disabled}
            />

            <FormField label="Filter" hint="A formula that narrows the choices (optional).">
                <ExpressionInput
                    variant="inline"
                    value={props.filter || ''}
                    onChange={(v) => patch({ filter: v || null })}
                    definition={definition}
                    node={node}
                    ariaLabel="Filter"
                    placeholder="e.g. item.active == true"
                    disabled={disabled}
                />
            </FormField>

            <Toggle label="Allow multiple" checked={!!props.multiple} onChange={(v) => patch({ multiple: v })} disabled={disabled} size="sm" />
            <Toggle label="Required" checked={!!props.required} onChange={(v) => patch({ required: v })} disabled={disabled} size="sm" />
        </div>
    );
}


function TablePicker({ appId, value, onChange, disabled }) {
    const { tables, isLoading } = useAppTables(appId);
    return (
        <select
            className={INPUT_CLS}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled || isLoading}
            aria-label="Data table"
        >
            <option value="">{isLoading ? 'Loading the tables…' : 'Pick a table…'}</option>
            {tables.map((t) => <option key={t.id} value={t.id}>{t.name || t.key}</option>)}
        </select>
    );
}

registerInspector('input_relation', InputRelationInspector);

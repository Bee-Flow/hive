import React from 'react';
import { RepeatableList, inputCls } from '../../../../ProductWebsite/fields';
import { registerInspector } from '../registry';
import BindingField from './BindingField';
import { TextField , usePatch } from './kit';

export default function KeyValueInspector({ node, definition, onCommit, disabled = false }) {
    const props = node.props || {};
    const patch = usePatch(node, definition, onCommit);

    return (
        <div className="flex flex-col gap-4">
            <BindingField
                label="Source"
                value={props.source}
                onChange={(v) => patch({ source: v })}
                definition={definition}
                hint="An object to render as label/value rows."
                placeholder='{"title":"…","owner":"…"}'
                disabled={disabled}
            />
            <fieldset disabled={disabled} className="min-w-0">
                <RepeatableList
                    label="Fields"
                    items={props.fields || []}
                    onChange={(fields) => patch({ fields })}
                    makeNew={() => ({ key: '', label: '' })}
                    addLabel="Add field"
                    itemLabel={(f) => f.label || f.key}
                    renderItem={(field, update) => (
                        <div className="flex flex-col gap-2">
                            <input
                                type="text"
                                className={inputCls}
                                value={field.key || ''}
                                onChange={(e) => update({ ...field, key: e.target.value })}
                                placeholder="Key (e.g. owner)"
                                spellCheck={false}
                            />
                            <input
                                type="text"
                                className={inputCls}
                                value={field.label || ''}
                                onChange={(e) => update({ ...field, label: e.target.value })}
                                placeholder="Label (optional)"
                            />
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
        </div>
    );
}

registerInspector('keyValue', KeyValueInspector);

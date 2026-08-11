import React from 'react';
import Toggle from '../../../../../shared/Toggle';
import { RepeatableList, inputCls } from '../../../../ProductWebsite/fields';
import { PrefillField } from './inputPanels';
import { registerInspector } from '../registry';
import { TextField , usePatch } from './kit';

/** Content panel for input_multiselect. Props mirror componentSpecs.js (authoritative). */
export default function InputMultiselectInspector({ node, definition, onCommit, disabled = false }) {
    const props = node.props || {};
    const patch = usePatch(node, definition, onCommit);
    return (
        <div className="flex flex-col gap-4">
            <TextField label="Field name" value={props.name} onChange={(v) => patch({ name: v })} hint="The key this array of values submits as." disabled={disabled} />
            <TextField label="Label" value={props.label} onChange={(v) => patch({ label: v })} disabled={disabled} />
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
                            <input type="text" className={inputCls} value={opt.value || ''} onChange={(e) => update({ ...opt, value: e.target.value })} placeholder="Value (submitted)" spellCheck={false} />
                            <input type="text" className={inputCls} value={opt.label || ''} onChange={(e) => update({ ...opt, label: e.target.value })} placeholder="Label (shown)" />
                        </div>
                    )}
                />
            </fieldset>
            <PrefillField node={node} definition={definition} patch={patch} disabled={disabled} />
            <Toggle label="Required" checked={!!props.required} onChange={(v) => patch({ required: v })} disabled={disabled} size="sm" />
        </div>
    );
}

registerInspector('input_multiselect', InputMultiselectInspector);

import React from 'react';
import Toggle from '../../../../../shared/Toggle';
import { PrefillField } from './inputPanels';
import { registerInspector } from '../registry';
import { TextField, TextAreaField , usePatch } from './kit';

/** Content panel for input_richtext. Props mirror componentSpecs.js (authoritative). */
export default function InputRichtextInspector({ node, definition, onCommit, disabled = false }) {
    const props = node.props || {};
    const patch = usePatch(node, definition, onCommit);
    return (
        <div className="flex flex-col gap-4">
            <TextField label="Field name" value={props.name} onChange={(v) => patch({ name: v })} hint="The key this value submits as (markdown)." disabled={disabled} />
            <TextField label="Label" value={props.label} onChange={(v) => patch({ label: v })} disabled={disabled} />
            <TextAreaField
                label="Default content"
                value={props.defaultValue}
                onChange={(v) => patch({ defaultValue: v || null })}
                placeholder="Optional starting markdown"
                rows={3}
                disabled={disabled}
            />
            <PrefillField node={node} definition={definition} patch={patch} disabled={disabled} />
            <Toggle label="Required" checked={!!props.required} onChange={(v) => patch({ required: v })} disabled={disabled} size="sm" />
        </div>
    );
}

registerInspector('input_richtext', InputRichtextInspector);

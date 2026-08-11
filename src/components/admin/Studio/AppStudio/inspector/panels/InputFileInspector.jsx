import React from 'react';
import Toggle from '../../../../../shared/Toggle';
import { registerInspector } from '../registry';
import { TextField , usePatch } from './kit';

/** Content panel for input_file. Props mirror componentSpecs.js (authoritative). */
export default function InputFileInspector({ node, definition, onCommit, disabled = false }) {
    const props = node.props || {};
    const patch = usePatch(node, definition, onCommit);
    return (
        <div className="flex flex-col gap-4">
            <TextField label="Field name" value={props.name} onChange={(v) => patch({ name: v })} hint="The key this value submits as." disabled={disabled} />
            <TextField label="Label" value={props.label} onChange={(v) => patch({ label: v })} disabled={disabled} />
            <TextField
                label="Accept"
                value={props.accept}
                onChange={(v) => patch({ accept: v || null })}
                placeholder="image/*, .pdf"
                hint="Comma-separated MIME types / extensions."
                disabled={disabled}
            />
            <Toggle label="Allow multiple files" checked={!!props.multiple} onChange={(v) => patch({ multiple: v })} disabled={disabled} size="sm" />
            <Toggle label="Required" checked={!!props.required} onChange={(v) => patch({ required: v })} disabled={disabled} size="sm" />
        </div>
    );
}

registerInspector('input_file', InputFileInspector);

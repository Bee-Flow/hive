import React from 'react';
import Toggle from '../../../../../shared/Toggle';
import { registerInspector } from '../registry';
import { TextField , usePatch } from './kit';

export default function FormInspector({ node, definition, onCommit, disabled = false }) {
    const props = node.props || {};
    const patch = usePatch(node, definition, onCommit);

    return (
        <div className="flex flex-col gap-4">
            <TextField
                label="Submit label"
                value={props.submitLabel}
                onChange={(v) => patch({ submitLabel: v })}
                placeholder="Submit"
                disabled={disabled}
            />
            <Toggle
                label="Show reset"
                description="Adds a button that clears the form."
                checked={!!props.showReset}
                onChange={(v) => patch({ showReset: v })}
                disabled={disabled}
                size="sm"
            />
            <TextField
                label="Form name"
                value={props.name}
                onChange={(v) => patch({ name: v || null })}
                hint="Used to reference this form from actions."
                disabled={disabled}
            />
        </div>
    );
}

registerInspector('form', FormInspector);

import React from 'react';
import { registerInspector } from '../registry';
import { TextField, TextAreaField , usePatch } from './kit';

export default function CardInspector({ node, definition, onCommit, disabled = false }) {
    const props = node.props || {};
    const patch = usePatch(node, definition, onCommit);

    return (
        <div className="flex flex-col gap-4">
            <TextField
                label="Title"
                value={props.title}
                onChange={(v) => patch({ title: v || null })}
                placeholder="Optional title"
                disabled={disabled}
            />
            <TextAreaField
                label="Description"
                value={props.description}
                onChange={(v) => patch({ description: v || null })}
                placeholder="Optional description"
                rows={2}
                disabled={disabled}
            />
        </div>
    );
}

registerInspector('card', CardInspector);

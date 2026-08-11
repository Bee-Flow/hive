import React from 'react';
import Toggle from '../../../../../shared/Toggle';
import { registerInspector } from '../registry';
import { TextAreaField , usePatch } from './kit';

export default function TextInspector({ node, definition, onCommit, disabled = false }) {
    const props = node.props || {};
    const patch = usePatch(node, definition, onCommit);

    return (
        <div className="flex flex-col gap-4">
            <TextAreaField
                label="Text"
                value={props.text}
                onChange={(v) => patch({ text: v })}
                rows={4}
                hint="Supports **bold**, *italic* and [links](https://…)."
                disabled={disabled}
            />
            <Toggle
                label="Muted"
                description="Render in the secondary text color."
                checked={!!props.muted}
                onChange={(v) => patch({ muted: v })}
                disabled={disabled}
                size="sm"
            />
        </div>
    );
}

registerInspector('text', TextInspector);

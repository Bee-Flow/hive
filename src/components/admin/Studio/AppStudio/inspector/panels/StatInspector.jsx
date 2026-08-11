import React from 'react';
import { registerInspector } from '../registry';
import BindingField from './BindingField';
import { TextField, IconField , usePatch } from './kit';

export default function StatInspector({ node, definition, onCommit, disabled = false }) {
    const props = node.props || {};
    const patch = usePatch(node, definition, onCommit);

    return (
        <div className="flex flex-col gap-4">
            <TextField label="Label" value={props.label} onChange={(v) => patch({ label: v })} disabled={disabled} />
            <BindingField
                label="Data"
                value={props.value}
                onChange={(v) => patch({ value: v })}
                definition={definition}
                componentType="stat"
                singleValue
                hint="Where the number on this tile comes from."
                placeholder="0"
                disabled={disabled}
            />
            <TextField
                label="Caption"
                value={props.caption}
                onChange={(v) => patch({ caption: v || null })}
                placeholder="Optional caption"
                disabled={disabled}
            />
            <IconField label="Icon" value={props.icon} onChange={(v) => patch({ icon: v })} disabled={disabled} />
        </div>
    );
}

registerInspector('stat', StatInspector);

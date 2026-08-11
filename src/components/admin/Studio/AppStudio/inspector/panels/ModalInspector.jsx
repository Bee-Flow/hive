import React from 'react';
import FormField from '../../../../../shared/FormField';
import SegmentedControl from '../../../../../shared/SegmentedControl';
import { registerInspector } from '../registry';
import { TextField , usePatch } from './kit';

const SIZES = [
    { value: 'sm', label: 'Small' },
    { value: 'md', label: 'Medium' },
    { value: 'lg', label: 'Large' },
];

/** Content panel for modal. Props mirror componentSpecs.js (authoritative). */
export default function ModalInspector({ node, definition, onCommit, disabled = false }) {
    const props = node.props || {};
    const patch = usePatch(node, definition, onCommit);
    return (
        <div className="flex flex-col gap-4">
            <TextField label="Title" value={props.title} onChange={(v) => patch({ title: v || null })} placeholder="Optional dialog title" disabled={disabled} />
            <FormField label="Size">
                <SegmentedControl value={props.size ?? 'md'} onChange={(v) => patch({ size: v })} options={SIZES} size="sm" fullWidth disabled={disabled} ariaLabel="Modal size" />
            </FormField>
            <TextField
                label="Trigger label"
                value={props.triggerLabel}
                onChange={(v) => patch({ triggerLabel: v || null })}
                placeholder="e.g. Open details"
                hint="A built-in button that opens this dialog. Leave empty to open it only from an action."
                disabled={disabled}
            />
        </div>
    );
}

registerInspector('modal', ModalInspector);

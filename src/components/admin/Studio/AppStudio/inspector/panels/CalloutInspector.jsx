import React from 'react';
import FormField from '../../../../../shared/FormField';
import SegmentedControl from '../../../../../shared/SegmentedControl';
import { registerInspector } from '../registry';
import { TOAST_TONES } from '../styleKnobMeta';
import { TextField, TextAreaField , usePatch } from './kit';

const TONES = TOAST_TONES.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }));

export default function CalloutInspector({ node, definition, onCommit, disabled = false }) {
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
            <TextAreaField label="Text" value={props.text} onChange={(v) => patch({ text: v })} rows={3} disabled={disabled} />
            <FormField label="Tone">
                <SegmentedControl
                    value={props.tone ?? 'info'}
                    onChange={(v) => patch({ tone: v })}
                    options={TONES}
                    size="sm"
                    fullWidth
                    disabled={disabled}
                    ariaLabel="Callout tone"
                />
            </FormField>
        </div>
    );
}

registerInspector('callout', CalloutInspector);

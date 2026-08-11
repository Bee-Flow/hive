import React from 'react';
import FormField from '../../../../../shared/FormField';
import SegmentedControl from '../../../../../shared/SegmentedControl';
import Toggle from '../../../../../shared/Toggle';
import { registerInspector } from '../registry';
import { TextField , usePatch } from './kit';

const DEFAULTS = [
    { value: 'none', label: 'None' },
    { value: 'now', label: 'Now' },
    { value: 'today', label: 'Today' },
];

/** Content panel for input_datetime. Props mirror componentSpecs.js (authoritative). */
export default function InputDatetimeInspector({ node, definition, onCommit, disabled = false }) {
    const props = node.props || {};
    const patch = usePatch(node, definition, onCommit);
    const dv = props.defaultValue ?? null;
    const mode = dv === 'now' ? 'now' : dv === 'today' ? 'today' : 'none';
    return (
        <div className="flex flex-col gap-4">
            <TextField label="Field name" value={props.name} onChange={(v) => patch({ name: v })} hint="The key this value submits as." disabled={disabled} />
            <TextField label="Label" value={props.label} onChange={(v) => patch({ label: v })} disabled={disabled} />
            <Toggle label="Include time" checked={props.withTime !== false} onChange={(v) => patch({ withTime: v })} disabled={disabled} size="sm" />
            <FormField label="Default">
                <SegmentedControl
                    value={mode}
                    onChange={(m) => patch({ defaultValue: m === 'none' ? null : m })}
                    options={DEFAULTS}
                    size="sm"
                    fullWidth
                    disabled={disabled}
                    ariaLabel="Default datetime"
                />
            </FormField>
            <Toggle label="Required" checked={!!props.required} onChange={(v) => patch({ required: v })} disabled={disabled} size="sm" />
        </div>
    );
}

registerInspector('input_datetime', InputDatetimeInspector);

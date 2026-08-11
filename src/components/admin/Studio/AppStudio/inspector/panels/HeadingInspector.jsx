import React from 'react';
import FormField from '../../../../../shared/FormField';
import SegmentedControl from '../../../../../shared/SegmentedControl';
import { registerInspector } from '../registry';
import { TextField , usePatch } from './kit';

const LEVELS = [
    { value: 1, label: 'H1' },
    { value: 2, label: 'H2' },
    { value: 3, label: 'H3' },
];

export default function HeadingInspector({ node, definition, onCommit, disabled = false }) {
    const props = node.props || {};
    const patch = usePatch(node, definition, onCommit);

    return (
        <div className="flex flex-col gap-4">
            <TextField label="Text" value={props.text} onChange={(v) => patch({ text: v })} disabled={disabled} />
            <FormField label="Level">
                <SegmentedControl
                    value={props.level ?? 2}
                    onChange={(v) => patch({ level: v })}
                    options={LEVELS}
                    size="sm"
                    fullWidth
                    disabled={disabled}
                    ariaLabel="Heading level"
                />
            </FormField>
        </div>
    );
}

registerInspector('heading', HeadingInspector);

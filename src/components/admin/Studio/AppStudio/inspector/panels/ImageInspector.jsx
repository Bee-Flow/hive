import React from 'react';
import FormField from '../../../../../shared/FormField';
import SegmentedControl from '../../../../../shared/SegmentedControl';
import { registerInspector } from '../registry';
import { TextField , usePatch } from './kit';

const FITS = [
    { value: 'cover', label: 'Cover' },
    { value: 'contain', label: 'Contain' },
];

export default function ImageInspector({ node, definition, onCommit, disabled = false }) {
    const props = node.props || {};
    const patch = usePatch(node, definition, onCommit);

    return (
        <div className="flex flex-col gap-4">
            <TextField
                label="Image URL"
                value={props.src}
                onChange={(v) => patch({ src: v.trim() || null })}
                placeholder="https://…"
                hint="Must be an https URL. Broken sources show a neutral placeholder."
                disabled={disabled}
            />
            <TextField
                label="Alt text"
                value={props.alt}
                onChange={(v) => patch({ alt: v })}
                hint="Describes the image for screen readers."
                disabled={disabled}
            />
            <FormField label="Fit">
                <SegmentedControl
                    value={props.fit ?? 'cover'}
                    onChange={(v) => patch({ fit: v })}
                    options={FITS}
                    size="sm"
                    fullWidth
                    disabled={disabled}
                    ariaLabel="Image fit"
                />
            </FormField>
        </div>
    );
}

registerInspector('image', ImageInspector);

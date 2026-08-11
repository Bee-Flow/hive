import React from 'react';
import Slider from '../../../../../shared/Slider';
import { registerInspector } from '../registry';
import { usePatch } from './kit';

export default function SpacerInspector({ node, definition, onCommit, disabled = false }) {
    const props = node.props || {};
    const patch = usePatch(node, definition, onCommit);

    return (
        <Slider
            label="Height"
            value={Number.isFinite(props.steps) ? props.steps : 2}
            onChange={(v) => patch({ steps: Math.max(1, Math.min(8, Math.round(v))) })}
            min={1}
            max={8}
            step={1}
            suffix=" steps"
            disabled={disabled}
        />
    );
}

registerInspector('spacer', SpacerInspector);

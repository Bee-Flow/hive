import React from 'react';
import FormField from '../../../../../shared/FormField';
import SegmentedControl from '../../../../../shared/SegmentedControl';
import { registerInspector } from '../registry';
import { TextField, IconField , usePatch } from './kit';

const VARIANTS = [
    { value: 'primary', label: 'Primary' },
    { value: 'secondary', label: 'Secondary' },
    { value: 'ghost', label: 'Ghost' },
    { value: 'danger', label: 'Danger' },
];

const ROLES = [
    { value: 'button', label: 'Button' },
    { value: 'submit', label: 'Submit' },
];

export default function ButtonInspector({ node, definition, onCommit, disabled = false }) {
    const props = node.props || {};
    const patch = usePatch(node, definition, onCommit);

    return (
        <div className="flex flex-col gap-4">
            <TextField label="Label" value={props.label} onChange={(v) => patch({ label: v })} disabled={disabled} />
            <FormField label="Variant">
                <SegmentedControl
                    value={props.variant ?? 'primary'}
                    onChange={(v) => patch({ variant: v })}
                    options={VARIANTS}
                    size="sm"
                    fullWidth
                    disabled={disabled}
                    ariaLabel="Button variant"
                />
            </FormField>
            <IconField
                label="Icon"
                value={props.iconLeft}
                onChange={(v) => patch({ iconLeft: v })}
                disabled={disabled}
            />
            <FormField label="Role" >
                <SegmentedControl
                    value={props.role ?? 'button'}
                    onChange={(v) => patch({ role: v })}
                    options={ROLES}
                    size="sm"
                    fullWidth
                    disabled={disabled}
                    ariaLabel="Button role"
                />
            </FormField>
            {props.role === 'submit' && (
                <p className="text-xs text-[var(--text-muted)] -mt-2">
                    Submits the enclosing form instead of running its own action.
                </p>
            )}
        </div>
    );
}

registerInspector('button', ButtonInspector);

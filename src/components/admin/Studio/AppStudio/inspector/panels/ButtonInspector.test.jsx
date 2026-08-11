import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ButtonInspector from './ButtonInspector';
import { findNode } from '../../state/definitionOps';
import { KITCHEN_SINK } from '../../state/sampleDefinitions';

// cmp_refre1: { label: 'Refresh', variant: 'secondary', iconLeft: 'RefreshCw', role: 'button' }
const node = findNode(KITCHEN_SINK, 'cmp_refre1').node;

function renderPanel(overrides = {}) {
    const onCommit = vi.fn();
    const utils = render(
        <ButtonInspector node={node} definition={KITCHEN_SINK} onCommit={onCommit} {...overrides} />,
    );
    return { onCommit, ...utils };
}

describe('ButtonInspector', () => {
    it('label edit commits an updateNodeProps patch (other props preserved)', () => {
        const { onCommit, getByDisplayValue } = renderPanel();
        fireEvent.change(getByDisplayValue('Refresh'), { target: { value: 'Refresh now' } });
        expect(onCommit).toHaveBeenCalledTimes(1);
        const next = onCommit.mock.calls[0][0];
        const committed = findNode(next, 'cmp_refre1').node;
        expect(committed.props.label).toBe('Refresh now');
        // Shallow merge — the untouched props survive.
        expect(committed.props.variant).toBe('secondary');
        expect(committed.props.iconLeft).toBe('RefreshCw');
        expect(committed.props.role).toBe('button');
        // Pure ops: the source definition is untouched.
        expect(findNode(KITCHEN_SINK, 'cmp_refre1').node.props.label).toBe('Refresh');
    });

    it('variant SegmentedControl commits the picked variant', () => {
        const { onCommit, getByRole } = renderPanel();
        expect(getByRole('radio', { name: 'Secondary' })).toHaveAttribute('aria-checked', 'true');
        fireEvent.click(getByRole('radio', { name: 'Ghost' }));
        expect(onCommit).toHaveBeenCalledTimes(1);
        expect(findNode(onCommit.mock.calls[0][0], 'cmp_refre1').node.props.variant).toBe('ghost');
    });

    it('re-picking the current variant is a no-op (no commit)', () => {
        const { onCommit, getByRole } = renderPanel();
        fireEvent.click(getByRole('radio', { name: 'Secondary' }));
        expect(onCommit).not.toHaveBeenCalled();
    });

    it('disabled prop disables every input', () => {
        const { getByDisplayValue, getByRole } = renderPanel({ disabled: true });
        expect(getByDisplayValue('Refresh')).toBeDisabled();
        expect(getByRole('radio', { name: 'Ghost' })).toBeDisabled();
    });
});

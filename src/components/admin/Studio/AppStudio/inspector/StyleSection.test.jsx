import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { clampKnob } from './styleKnobMeta';
import StyleSection, { updateSectionStyle, findSectionById } from './StyleSection';
import { findNode } from '../state/definitionOps';
import { KITCHEN_SINK } from '../state/sampleDefinitions';

const nodeOf = (id) => findNode(KITCHEN_SINK, id).node;

function renderNode(nodeId, onCommit = vi.fn()) {
    const utils = render(
        <StyleSection definition={KITCHEN_SINK} node={nodeOf(nodeId)} onCommit={onCommit} />,
    );
    return { onCommit, ...utils };
}

describe('StyleSection — span slider', () => {
    it('commits an int span patch through updateNodeStyle', () => {
        const { onCommit, container } = renderNode('cmp_headg1');
        const slider = container.querySelector('input[type="range"]');
        fireEvent.change(slider, { target: { value: '7' } });
        expect(onCommit).toHaveBeenCalledTimes(1);
        const next = onCommit.mock.calls[0][0];
        expect(next).not.toBe(KITCHEN_SINK);
        expect(findNode(next, 'cmp_headg1').node.style.span).toBe(7);
        // Untouched props/screens keep identity (pure ops, structural sharing).
        expect(findNode(next, 'cmp_headg1').node.props).toBe(nodeOf('cmp_headg1').props);
    });

    it('clamps out-of-range values to the server STYLE_KNOBS bounds', () => {
        expect(clampKnob('span', 99)).toBe(12);
        expect(clampKnob('span', -3)).toBe(1);
        expect(clampKnob('span', 6.6)).toBe(7);
        expect(clampKnob('padding', 42)).toBe(6);

        // cmp_stat01 spans 3 cols — an over-range change lands on the max (12),
        // whether jsdom's own range sanitisation or clampKnob catches it first.
        const { onCommit, container } = renderNode('cmp_stat01');
        const slider = container.querySelector('input[type="range"]');
        fireEvent.change(slider, { target: { value: '15' } });
        expect(onCommit).toHaveBeenCalledTimes(1);
        const next = onCommit.mock.calls[0][0];
        expect(findNode(next, 'cmp_stat01').node.style.span).toBe(12);
    });
});

describe('StyleSection — TokenColorField', () => {
    it('commits a role name when a role swatch is picked', () => {
        const { onCommit, getByRole } = renderNode('cmp_headg1');
        // Fixture color is null → "Theme" mode; switching tab alone commits nothing.
        fireEvent.click(getByRole('radio', { name: 'Role' }));
        expect(onCommit).not.toHaveBeenCalled();
        fireEvent.click(getByRole('radio', { name: 'success' }));
        expect(onCommit).toHaveBeenCalledTimes(1);
        expect(findNode(onCommit.mock.calls[0][0], 'cmp_headg1').node.style.color).toBe('success');
    });

    it('commits null when switching a role-colored node back to Theme', () => {
        // cmp_stat01 has style.color 'primary' → starts in Role mode.
        const { onCommit, getByRole } = renderNode('cmp_stat01');
        expect(getByRole('radio', { name: 'primary' })).toHaveAttribute('aria-checked', 'true');
        fireEvent.click(getByRole('radio', { name: 'Theme' }));
        expect(onCommit).toHaveBeenCalledTimes(1);
        expect(findNode(onCommit.mock.calls[0][0], 'cmp_stat01').node.style.color).toBeNull();
    });

    it('commits a hex when a custom preset is picked', () => {
        const { onCommit, getByRole } = renderNode('cmp_headg1');
        fireEvent.click(getByRole('radio', { name: 'Custom' }));
        expect(onCommit).not.toHaveBeenCalled();
        fireEvent.click(getByRole('radio', { name: '#B45309' }));
        expect(findNode(onCommit.mock.calls[0][0], 'cmp_headg1').node.style.color).toBe('#B45309');
    });
});

describe('StyleSection — per-type knob gating', () => {
    it('divider renders only the span slider', () => {
        const { container, queryByRole, queryByText } = renderNode('cmp_divid1');
        expect(container.querySelectorAll('input[type="range"]')).toHaveLength(1);
        expect(queryByRole('radio')).toBeNull();
        expect(queryByText('Align')).toBeNull();
        expect(queryByText('Color')).toBeNull();
    });

    it('card renders span/padding/gap sliders + radius/background enums, no color', () => {
        const { container, getByRole, queryByRole } = renderNode('cmp_card01');
        expect(container.querySelectorAll('input[type="range"]')).toHaveLength(3);
        expect(getByRole('radio', { name: 'Inherit' })).toBeInTheDocument(); // radius null option
        expect(getByRole('radio', { name: 'Surface' })).toBeInTheDocument();
        expect(queryByRole('radio', { name: 'Theme' })).toBeNull(); // no color knob
    });

    it('radius "Inherit" commits null', () => {
        const onCommit = vi.fn();
        const { getByRole } = render(
            <StyleSection definition={KITCHEN_SINK} node={nodeOf('cmp_card01')} onCommit={onCommit} />,
        );
        // Fixture card radius is 'md' → switching to Inherit commits null.
        fireEvent.click(getByRole('radio', { name: 'Inherit' }));
        expect(onCommit).toHaveBeenCalledTimes(1);
        expect(findNode(onCommit.mock.calls[0][0], 'cmp_card01').node.style.radius).toBeNull();
    });
});

describe('StyleSection — section variant', () => {
    it('renders the section trio and commits via the local section patch', () => {
        const onCommit = vi.fn();
        const { container, getByRole } = render(
            <StyleSection definition={KITCHEN_SINK} sectionId="sec_dash01" onCommit={onCommit} />,
        );
        // padding + gap sliders, background enum — and NO span slider.
        expect(container.querySelectorAll('input[type="range"]')).toHaveLength(2);
        expect(getByRole('radio', { name: 'Tint' })).toBeInTheDocument();

        const padding = container.querySelectorAll('input[type="range"]')[0];
        fireEvent.change(padding, { target: { value: '6' } });
        expect(onCommit).toHaveBeenCalledTimes(1);
        const next = onCommit.mock.calls[0][0];
        expect(findSectionById(next, 'sec_dash01').section.style.padding).toBe(6);
        expect(next).not.toBe(KITCHEN_SINK);
    });

    it('updateSectionStyle is a no-op (same reference) for identical patches', () => {
        expect(updateSectionStyle(KITCHEN_SINK, 'sec_dash01', { padding: 4 })).toBe(KITCHEN_SINK);
        expect(updateSectionStyle(KITCHEN_SINK, 'sec_nope', { padding: 1 })).toBe(KITCHEN_SINK);
    });
});

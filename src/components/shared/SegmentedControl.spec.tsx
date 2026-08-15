import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SegmentedControl from './SegmentedControl';

const OPTIONS = [
    { value: 'simple', label: 'Simple' },
    { value: 'advanced', label: 'All options' },
] as const;

describe('SegmentedControl', () => {
    it('is a radiogroup named by ariaLabel, with aria-checked on the active radio', () => {
        render(
            <SegmentedControl
                value="simple"
                onChange={() => {}}
                options={OPTIONS}
                ariaLabel="How much of this step to show"
            />,
        );
        const group = screen.getByRole('radiogroup', { name: 'How much of this step to show' });
        expect(group).toBeTruthy();
        expect(screen.getByRole('radio', { name: 'Simple' }).getAttribute('aria-checked')).toBe('true');
        expect(screen.getByRole('radio', { name: 'All options' }).getAttribute('aria-checked')).toBe('false');
    });

    it('reports the picked value through onChange', () => {
        const onChange = vi.fn();
        render(<SegmentedControl value="simple" onChange={onChange} options={OPTIONS} />);
        fireEvent.click(screen.getByRole('radio', { name: 'All options' }));
        expect(onChange).toHaveBeenCalledWith('advanced');
    });

    it('inactive segments read as available choices, not disabled ones', () => {
        // --text-tertiary is the caption tier; an inactive-but-clickable
        // segment must sit at least at --text-secondary or it reads as
        // switched off next to the active pill.
        render(<SegmentedControl value="simple" onChange={() => {}} options={OPTIONS} />);
        const inactive = screen.getByRole('radio', { name: 'All options' });
        const active = screen.getByRole('radio', { name: 'Simple' });
        expect(inactive.style.color).toBe('var(--text-secondary)');
        expect(active.style.color).toBe('var(--text-primary)');
    });

    it('a disabled option cannot be picked', () => {
        const onChange = vi.fn();
        render(
            <SegmentedControl
                value="simple"
                onChange={onChange}
                options={[OPTIONS[0], { ...OPTIONS[1], disabled: true }]}
            />,
        );
        const opt = screen.getByRole('radio', { name: 'All options' }) as HTMLButtonElement;
        expect(opt.disabled).toBe(true);
        fireEvent.click(opt);
        expect(onChange).not.toHaveBeenCalled();
    });
});

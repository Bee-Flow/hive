import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IconButton from './IconButton';

describe('IconButton', () => {
    it('exposes the icon-only button under its ariaLabel', () => {
        render(
            <IconButton ariaLabel="Close" onClick={() => {}}>
                <svg data-testid="x" />
            </IconButton>,
        );
        expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
        expect(screen.getByTestId('x')).toBeInTheDocument();
    });

    it('calls onClick when activated', async () => {
        const onClick = vi.fn();
        render(<IconButton ariaLabel="Edit" onClick={onClick}><svg /></IconButton>);
        await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('uses ariaLabel as the tooltip title by default', () => {
        render(<IconButton ariaLabel="Settings"><svg /></IconButton>);
        expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute('title', 'Settings');
    });

    it('does not fire onClick when disabled', async () => {
        const onClick = vi.fn();
        render(<IconButton ariaLabel="Disabled" disabled onClick={onClick}><svg /></IconButton>);
        await userEvent.click(screen.getByRole('button', { name: 'Disabled' }));
        expect(onClick).not.toHaveBeenCalled();
    });
});

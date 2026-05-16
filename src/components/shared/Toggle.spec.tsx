import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Toggle from './Toggle';

describe('Toggle', () => {
    it('renders a label + description in row mode and reflects checked state', () => {
        render(<Toggle checked label="Web Embed" description="Public chat" onChange={() => {}} />);
        expect(screen.getByText('Web Embed')).toBeInTheDocument();
        expect(screen.getByText('Public chat')).toBeInTheDocument();
        expect(screen.getByRole('checkbox')).toBeChecked();
    });

    it('calls onChange with the next boolean when the user clicks', async () => {
        const onChange = vi.fn();
        render(<Toggle checked={false} label="Allow Copying" onChange={onChange} />);
        await userEvent.click(screen.getByRole('checkbox'));
        expect(onChange).toHaveBeenCalledWith(true);
    });

    it('renders the bare switch (no row chrome) when no label or description is given', () => {
        render(<Toggle checked={false} onChange={() => {}} ariaLabel="enabled" />);
        // No <h4>, no <p> — just the input.
        expect(screen.queryByRole('heading')).toBeNull();
        const cb = screen.getByRole('checkbox', { name: 'enabled' });
        expect(cb).not.toBeChecked();
    });

    it('does not fire onChange when disabled', async () => {
        const onChange = vi.fn();
        render(<Toggle checked={false} label="Locked" disabled onChange={onChange} />);
        await userEvent.click(screen.getByRole('checkbox'));
        expect(onChange).not.toHaveBeenCalled();
    });

    it('falls back to label text for aria-label when the caller did not pass ariaLabel', () => {
        render(<Toggle checked={false} label="My Setting" onChange={() => {}} />);
        // RTL's accessible-name resolution walks the linked label too, so getByRole
        // with name should find the checkbox regardless of where the name comes from.
        expect(screen.getByRole('checkbox', { name: /my setting/i })).toBeInTheDocument();
    });
});

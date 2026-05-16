import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmptyState from './EmptyState';

describe('EmptyState', () => {
    it('renders the title and optional description', () => {
        render(<EmptyState title="No skills yet" description="Create your first one" />);
        expect(screen.getByText('No skills yet')).toBeInTheDocument();
        expect(screen.getByText('Create your first one')).toBeInTheDocument();
    });

    it('omits the action button when no action is provided', () => {
        render(<EmptyState title="Empty" />);
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('fires the action callback when the button is clicked', async () => {
        const onClick = vi.fn();
        render(
            <EmptyState
                title="Empty"
                action={{ label: 'Create', onClick }}
            />,
        );
        await userEvent.click(screen.getByRole('button', { name: 'Create' }));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('renders the icon slot above the title', () => {
        render(
            <EmptyState
                icon={<svg data-testid="icon" />}
                title="With Icon"
            />,
        );
        expect(screen.getByTestId('icon')).toBeInTheDocument();
    });
});

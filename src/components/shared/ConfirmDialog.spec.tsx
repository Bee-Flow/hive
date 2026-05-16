import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from './ConfirmDialog';

describe('ConfirmDialog', () => {
    it('renders the title, description, and both action buttons', () => {
        render(
            <ConfirmDialog
                open
                title="Delete plan?"
                description="This cannot be undone."
                onConfirm={() => {}}
                onCancel={() => {}}
            />,
        );
        expect(screen.getByText('Delete plan?')).toBeInTheDocument();
        expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    });

    it('invokes onCancel when Cancel is clicked', async () => {
        const onCancel = vi.fn();
        render(
            <ConfirmDialog open title="X" onConfirm={() => {}} onCancel={onCancel} />,
        );
        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('awaits an async onConfirm and disables both buttons during the call', async () => {
        let resolve: () => void = () => {};
        const promise = new Promise<void>((r) => { resolve = r; });
        const onConfirm = vi.fn().mockReturnValue(promise);
        render(
            <ConfirmDialog open title="X" onConfirm={onConfirm} onCancel={() => {}} />,
        );
        await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled();
            expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
        });
        resolve();
        await waitFor(() => {
            expect(onConfirm).toHaveBeenCalledTimes(1);
        });
    });

    it('uses custom labels when provided', () => {
        render(
            <ConfirmDialog
                open
                title="X"
                confirmLabel="Yes, delete"
                cancelLabel="Keep"
                onConfirm={() => {}}
                onCancel={() => {}}
            />,
        );
        expect(screen.getByRole('button', { name: 'Yes, delete' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument();
    });
});

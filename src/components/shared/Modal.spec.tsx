import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from './Modal';

describe('Modal', () => {
    it('renders nothing when closed', () => {
        render(
            <Modal open={false} onClose={() => {}} title="X">
                <p>body</p>
            </Modal>,
        );
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('renders into a portal and labels itself via the title', () => {
        render(
            <Modal open onClose={() => {}} title="Edit Plan">
                <p>body</p>
            </Modal>,
        );
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(dialog).toHaveAttribute('aria-labelledby');
        expect(screen.getByText('Edit Plan')).toBeInTheDocument();
        expect(screen.getByText('body')).toBeInTheDocument();
    });

    it('closes on ESC', () => {
        const onClose = vi.fn();
        render(<Modal open onClose={onClose} title="X"><p>body</p></Modal>);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close on ESC when disableEscapeClose is set', () => {
        const onClose = vi.fn();
        render(<Modal open onClose={onClose} disableEscapeClose title="X"><p>body</p></Modal>);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).not.toHaveBeenCalled();
    });

    it('closes when the backdrop is clicked', async () => {
        const onClose = vi.fn();
        render(<Modal open onClose={onClose} title="X"><button>inside</button></Modal>);
        const dialog = screen.getByRole('dialog');
        const backdrop = dialog.parentElement!;
        // mousedown on the backdrop element itself, not the dialog.
        fireEvent.mouseDown(backdrop, { target: backdrop, bubbles: true });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside the panel', async () => {
        const onClose = vi.fn();
        render(<Modal open onClose={onClose} title="X"><button>inside</button></Modal>);
        await userEvent.click(screen.getByRole('button', { name: 'inside' }));
        expect(onClose).not.toHaveBeenCalled();
    });

    it('renders header actions and a footer slot when provided', () => {
        render(
            <Modal
                open
                onClose={() => {}}
                title="With slots"
                headerActions={<button>Close</button>}
                footer={<button>Save</button>}
            >
                <p>body</p>
            </Modal>,
        );
        expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });
});

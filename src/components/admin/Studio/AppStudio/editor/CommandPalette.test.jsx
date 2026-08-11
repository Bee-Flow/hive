import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CommandPalette from './CommandPalette';

function makeActions() {
    return [
        { id: 'a', group: 'View', label: 'Switch to Preview', run: vi.fn() },
        { id: 'b', group: 'Go to screen', label: 'Go to Dashboard', run: vi.fn() },
        { id: 'c', group: 'Go to screen', label: 'Go to Settings', run: vi.fn() },
        { id: 'd', group: 'Data', label: 'Open Tables', run: vi.fn() },
    ];
}

describe('CommandPalette', () => {
    it('renders nothing when closed', () => {
        const { container } = render(<CommandPalette open={false} actions={makeActions()} onClose={vi.fn()} />);
        expect(container.querySelector('[data-command-palette]')).toBeNull();
    });

    it('runs the clicked action and closes', () => {
        const actions = makeActions();
        const onClose = vi.fn();
        render(<CommandPalette open onClose={onClose} actions={actions} />);

        fireEvent.click(screen.getByText('Open Tables'));
        expect(actions[3].run).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('filters by a label/group substring', () => {
        render(<CommandPalette open onClose={vi.fn()} actions={makeActions()} />);
        fireEvent.change(screen.getByLabelText('Command palette search'), { target: { value: 'settings' } });

        expect(screen.getByText('Go to Settings')).toBeInTheDocument();
        expect(screen.queryByText('Open Tables')).not.toBeInTheDocument();
        expect(screen.queryByText('Switch to Preview')).not.toBeInTheDocument();
    });

    it('arrow-navigates and fires the focused action on Enter', () => {
        const actions = makeActions();
        render(<CommandPalette open onClose={vi.fn()} actions={actions} />);
        const input = screen.getByLabelText('Command palette search');

        // Focus starts at index 0; move down twice → "Go to Settings" (index 2).
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(actions[2].run).toHaveBeenCalledTimes(1);
    });

    it('closes on Escape', () => {
        const onClose = vi.fn();
        render(<CommandPalette open onClose={onClose} actions={makeActions()} />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
    });
});

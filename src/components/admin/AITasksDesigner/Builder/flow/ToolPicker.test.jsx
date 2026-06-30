import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ToolPicker from './ToolPicker';

const apps = [
    {
        id: 'gmail', label: 'Gmail', available: true, actions: [
            { name: 'gmail_read', label: 'Read email', description: 'Read messages', sideEffect: false },
            { name: 'gmail_send', label: 'Send email', description: 'Send a message', sideEffect: true },
        ],
    },
    {
        id: 'agent-search', label: 'Web Search', available: true, actions: [
            { name: 'agent_search', label: 'Search the web', description: 'Run a search', sideEffect: false },
        ],
    },
];

describe('ToolPicker', () => {
    beforeEach(() => cleanup());

    it('lists the focused app\'s individual tools and toggles one', () => {
        const onToggleTool = vi.fn();
        render(<ToolPicker apps={apps} selected={[]} onToggleTool={onToggleTool} onToggleApp={vi.fn()} onClose={vi.fn()} />);
        // First app (Gmail) is focused → its tools show on the right.
        expect(screen.getByText('Read email')).toBeTruthy();
        expect(screen.getByText('Send email')).toBeTruthy();
        fireEvent.click(screen.getByText('Read email'));
        expect(onToggleTool).toHaveBeenCalledWith('gmail_read');
    });

    it('flags side-effecting tools with a "writes" badge', () => {
        render(<ToolPicker apps={apps} selected={[]} onToggleTool={vi.fn()} onToggleApp={vi.fn()} onClose={vi.fn()} />);
        expect(screen.getByText('writes')).toBeTruthy();
    });

    it('enables all tools of an app via "Enable all"', () => {
        const onToggleApp = vi.fn();
        render(<ToolPicker apps={apps} selected={[]} onToggleTool={vi.fn()} onToggleApp={onToggleApp} onClose={vi.fn()} />);
        fireEvent.click(screen.getByText('Enable all'));
        expect(onToggleApp).toHaveBeenCalledWith(apps[0], true);
    });

    it('shows "Disable all" when every tool of the app is selected', () => {
        const onToggleApp = vi.fn();
        render(<ToolPicker apps={apps} selected={['gmail_read', 'gmail_send']} onToggleTool={vi.fn()} onToggleApp={onToggleApp} onClose={vi.fn()} />);
        fireEvent.click(screen.getByText('Disable all'));
        expect(onToggleApp).toHaveBeenCalledWith(apps[0], false);
    });

    it('filters the app list by search', () => {
        render(<ToolPicker apps={apps} selected={[]} onToggleTool={vi.fn()} onToggleApp={vi.fn()} onClose={vi.fn()} />);
        fireEvent.change(screen.getByPlaceholderText('Search tools'), { target: { value: 'web' } });
        // Left list now matches Web Search only; clicking surfaces its tool.
        expect(screen.getByText('Search the web')).toBeTruthy();
    });

    it('closes on Escape', () => {
        const onClose = vi.fn();
        render(<ToolPicker apps={apps} selected={[]} onToggleTool={vi.fn()} onToggleApp={vi.fn()} onClose={onClose} />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
    });
});

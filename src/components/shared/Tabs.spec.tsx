import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Tabs from './Tabs';

describe('Tabs', () => {
    const items = [
        { id: 'plans', label: 'Plans' },
        { id: 'orgs', label: 'Organizations' },
        { id: 'audit', label: 'Audit' },
    ] as const;

    it('renders a tablist with one tab per item and marks the selected one', () => {
        render(<Tabs value="orgs" onChange={() => {}} items={items} ariaLabel="Billing tabs" />);
        const tablist = screen.getByRole('tablist', { name: 'Billing tabs' });
        expect(tablist).toBeInTheDocument();
        const tabs = screen.getAllByRole('tab');
        expect(tabs).toHaveLength(3);
        expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Organizations');
    });

    it('invokes onChange with the clicked tab id', async () => {
        const onChange = vi.fn();
        render(<Tabs value="plans" onChange={onChange} items={items} />);
        await userEvent.click(screen.getByRole('tab', { name: 'Audit' }));
        expect(onChange).toHaveBeenCalledWith('audit');
    });

    it('moves selection on ArrowRight / ArrowLeft', () => {
        const onChange = vi.fn();
        render(<Tabs value="plans" onChange={onChange} items={items} />);
        const first = screen.getByRole('tab', { name: 'Plans' });
        first.focus();
        fireEvent.keyDown(first, { key: 'ArrowRight' });
        expect(onChange).toHaveBeenLastCalledWith('orgs');
        fireEvent.keyDown(first, { key: 'ArrowLeft' });
        expect(onChange).toHaveBeenLastCalledWith('audit');
    });

    it('jumps to first/last on Home/End', () => {
        const onChange = vi.fn();
        render(<Tabs value="orgs" onChange={onChange} items={items} />);
        const middle = screen.getByRole('tab', { name: 'Organizations' });
        middle.focus();
        fireEvent.keyDown(middle, { key: 'Home' });
        expect(onChange).toHaveBeenLastCalledWith('plans');
        fireEvent.keyDown(middle, { key: 'End' });
        expect(onChange).toHaveBeenLastCalledWith('audit');
    });

    it('skips disabled tabs when arrow-keying', () => {
        const onChange = vi.fn();
        const withDisabled = [
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B', disabled: true },
            { id: 'c', label: 'C' },
        ] as const;
        render(<Tabs value="a" onChange={onChange} items={withDisabled} />);
        const a = screen.getByRole('tab', { name: 'A' });
        a.focus();
        fireEvent.keyDown(a, { key: 'ArrowRight' });
        expect(onChange).toHaveBeenLastCalledWith('c');
    });
});

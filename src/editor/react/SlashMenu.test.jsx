import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { FileText } from 'lucide-react';
import SlashMenu from './SlashMenu.jsx';

const items = [
    { key: 'h1', label: 'Heading 1', keywords: 'h1 title', icon: FileText },
    { key: 'h2', label: 'Heading 2', keywords: 'h2 subtitle', icon: FileText },
    { key: 'bullet', label: 'Bullet list', keywords: 'ul unordered', icon: FileText },
];
const rect = { top: 100, left: 100 };

afterEach(cleanup);

describe('SlashMenu', () => {
    it('renders all items with an empty query', () => {
        render(<SlashMenu items={items} query="" rect={rect} onSelect={() => {}} onClose={() => {}} />);
        expect(screen.getByText('Heading 1')).toBeTruthy();
        expect(screen.getByText('Bullet list')).toBeTruthy();
    });

    it('filters by query against label + keywords', () => {
        render(<SlashMenu items={items} query="unordered" rect={rect} onSelect={() => {}} onClose={() => {}} />);
        expect(screen.queryByText('Heading 1')).toBeNull();
        expect(screen.getByText('Bullet list')).toBeTruthy();
    });

    it('ArrowDown + Enter selects the next item', () => {
        const onSelect = vi.fn();
        render(<SlashMenu items={items} query="" rect={rect} onSelect={onSelect} onClose={() => {}} />);
        fireEvent.keyDown(document, { key: 'ArrowDown' });
        fireEvent.keyDown(document, { key: 'Enter' });
        expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ key: 'h2' }));
    });

    it('Escape calls onClose', () => {
        const onClose = vi.fn();
        render(<SlashMenu items={items} query="" rect={rect} onSelect={() => {}} onClose={onClose} />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
    });

    it('renders nothing without a rect or with no matches', () => {
        const { container, rerender } = render(<SlashMenu items={items} query="" rect={null} onSelect={() => {}} onClose={() => {}} />);
        expect(container.firstChild).toBeNull();
        rerender(<SlashMenu items={items} query="zzzznomatch" rect={rect} onSelect={() => {}} onClose={() => {}} />);
        expect(container.firstChild).toBeNull();
    });
});

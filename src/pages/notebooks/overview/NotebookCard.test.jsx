import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NotebookCard from './NotebookCard.jsx';

const NB = {
    id: 'nb1',
    name: 'Q4 Strategy',
    preview: 'Key initiatives for the fourth quarter',
    sourceCount: 3,
    messageCount: 12,
    docWordCount: 2000,
    sourceWordCount: 871,
    processingCount: 0,
    failedCount: 0,
    pinned: false,
    lastActivityAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
};

const baseProps = (over = {}) => ({
    nb: NB,
    onOpen: vi.fn(), onOpenChat: vi.fn(), onTogglePin: vi.fn(),
    onRename: vi.fn(), onDelete: vi.fn(), onDropFiles: vi.fn(),
    ...over,
});

describe('NotebookCard', () => {
    beforeEach(() => cleanup());

    it('renders name, preview, and stat counts', () => {
        render(<NotebookCard {...baseProps()} />);
        expect(screen.getByText('Q4 Strategy')).toBeTruthy();
        expect(screen.getByText('Key initiatives for the fourth quarter')).toBeTruthy();
        expect(screen.getByText('3')).toBeTruthy();   // sources
        expect(screen.getByText('12')).toBeTruthy();  // messages
        // words = docWordCount + sourceWordCount, locale-formatted ('en' is the
        // provider-less useTranslation fallback locale)
        expect(screen.getByText((2871).toLocaleString('en'))).toBeTruthy();
    });

    it('shows the pin glyph when pinned', () => {
        render(<NotebookCard {...baseProps({ nb: { ...NB, pinned: true } })} />);
        expect(screen.getByLabelText('Pinned')).toBeTruthy();
    });

    it('shows an amber processing dot when processingCount > 0', () => {
        render(<NotebookCard {...baseProps({ nb: { ...NB, processingCount: 2 } })} />);
        const dot = screen.getByTestId('status-dot-processing');
        expect(dot.className).toContain('animate-pulse');
        expect(dot.title).toContain('2');
    });

    it('shows a red dot when failedCount > 0 and nothing is processing', () => {
        render(<NotebookCard {...baseProps({ nb: { ...NB, failedCount: 1 } })} />);
        expect(screen.getByTestId('status-dot-failed')).toBeTruthy();
    });

    it('falls back to stripHtml over documentContent when preview is absent', () => {
        const nb = { ...NB, preview: '', documentContent: '<h1>Alpha</h1><p>Beta</p>' };
        render(<NotebookCard {...baseProps({ nb })} />);
        expect(screen.getByText('Alpha Beta')).toBeTruthy();
    });

    it('fires onOpen on a single card click (and Enter)', () => {
        const onOpen = vi.fn();
        render(<NotebookCard {...baseProps({ onOpen })} />);
        const card = screen.getByRole('button', { name: /Q4 Strategy/ });
        fireEvent.click(card);
        expect(onOpen).toHaveBeenCalledTimes(1);
        fireEvent.keyDown(card, { key: 'Enter' });
        expect(onOpen).toHaveBeenCalledTimes(2);
    });

    it('kebab Delete fires onDelete without opening the card', () => {
        const onDelete = vi.fn();
        const onOpen = vi.fn();
        render(<NotebookCard {...baseProps({ onDelete, onOpen })} />);
        fireEvent.click(screen.getByLabelText('Notebook actions'));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
        expect(onDelete).toHaveBeenCalledWith(NB);
        expect(onOpen).not.toHaveBeenCalled();
    });

    it('kebab Rename commits a new name on Enter', () => {
        const onRename = vi.fn();
        render(<NotebookCard {...baseProps({ onRename })} />);
        fireEvent.click(screen.getByLabelText('Notebook actions'));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
        const input = screen.getByDisplayValue('Q4 Strategy');
        fireEvent.change(input, { target: { value: 'Q1 Plan' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onRename).toHaveBeenCalledWith('nb1', 'Q1 Plan');
    });
});

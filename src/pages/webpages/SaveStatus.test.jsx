import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SaveStatus from './SaveStatus';

describe('SaveStatus', () => {
    it('renders nothing when idle', () => {
        const { container } = render(<SaveStatus saveState="idle" />);
        expect(container).toBeEmptyDOMElement();
    });

    it('shows a saving indicator', () => {
        render(<SaveStatus saveState="saving" />);
        expect(screen.getByText(/saving/i)).toBeInTheDocument();
    });

    it('shows a saved indicator with a live region', () => {
        render(<SaveStatus saveState="saved" lastSavedAt={new Date()} />);
        const el = screen.getByText(/saved/i).closest('[role="status"]');
        expect(el).toBeTruthy();
        expect(el).toHaveAttribute('aria-live', 'polite');
    });

    it('renders a retry button on error and calls onRetry', () => {
        const onRetry = vi.fn();
        render(<SaveStatus saveState="error" onRetry={onRetry} />);
        const btn = screen.getByRole('button', { name: /save failed/i });
        fireEvent.click(btn);
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('shows a non-interactive error when no onRetry given', () => {
        render(<SaveStatus saveState="error" />);
        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.getByText(/save failed/i)).toBeInTheDocument();
    });
});

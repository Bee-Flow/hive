import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import FloatingValidationPill from './FloatingValidationPill';

const def = {
    trigger: { id: 'trg', label: 'Manual trigger' },
    steps: [{ id: 'cond_7f748746', type: 'condition', label: 'If' }],
};

describe('FloatingValidationPill — never shows raw step ids', () => {
    beforeEach(() => cleanup());

    it('shows the step LABEL, not the raw id, for a validation record', () => {
        render(
            <FloatingValidationPill
                def={def}
                validation={{
                    errors: [{ code: 'condition.expr_missing', path: 'steps[cond_7f748746].expr', message: 'Step cond_7f748746: expr is required.', severity: 'error' }],
                    warnings: [],
                }}
            />,
        );
        fireEvent.click(screen.getByTitle(/validation issue/));
        expect(screen.getByText('If:', { exact: false })).toBeTruthy();
        expect(screen.getByText(/expr is required/)).toBeTruthy();
        expect(screen.queryByText(/cond_7f748746/)).toBeNull();
    });

    it('humanizes a raw id embedded in the fatal-error toast text', () => {
        render(
            <FloatingValidationPill
                def={def}
                fatalError="runPartial: step cond_7f748746 not found in definition"
                validation={null}
            />,
        );
        fireEvent.click(screen.getByTitle(/validation issue|issue/));
        expect(screen.getByText(/runPartial: step "If" not found in definition/)).toBeTruthy();
        expect(screen.queryByText(/cond_7f748746/)).toBeNull();
    });

    it('clicking a record calls onFocusStep with the owning step id', () => {
        const onFocusStep = vi.fn();
        render(
            <FloatingValidationPill
                def={def}
                onFocusStep={onFocusStep}
                validation={{
                    errors: [{ code: 'condition.expr_missing', path: 'steps[cond_7f748746].expr', message: 'expr is required.', severity: 'error' }],
                    warnings: [],
                }}
            />,
        );
        fireEvent.click(screen.getByTitle(/validation issue/));
        fireEvent.click(screen.getByText(/expr is required/));
        expect(onFocusStep).toHaveBeenCalledWith('cond_7f748746');
    });

    it('renders nothing when there is nothing to surface', () => {
        const { container } = render(<FloatingValidationPill validation={null} />);
        expect(container.firstChild).toBeNull();
    });
});

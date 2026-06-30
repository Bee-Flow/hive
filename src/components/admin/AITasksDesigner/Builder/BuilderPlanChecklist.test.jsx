import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import BuilderPlanChecklist from './BuilderPlanChecklist.jsx';

describe('BuilderPlanChecklist', () => {
    beforeEach(() => cleanup());

    it('renders nothing when there are no todos', () => {
        const { container: emptyArr } = render(<BuilderPlanChecklist todos={[]} />);
        expect(emptyArr.firstChild).toBeNull();
        cleanup();
        const { container: undef } = render(<BuilderPlanChecklist />);
        expect(undef.firstChild).toBeNull();
    });

    it('renders each todo text and the done count', () => {
        render(
            <BuilderPlanChecklist
                todos={[
                    { text: 'Add the trigger', done: true },
                    { text: 'Wire the action', done: false },
                ]}
            />,
        );
        expect(screen.getByText('Add the trigger')).toBeTruthy();
        expect(screen.getByText('Wire the action')).toBeTruthy();
        // one of two done → "1/2"
        expect(screen.getByText('1/2')).toBeTruthy();
    });

    it('strikes through done items', () => {
        render(
            <BuilderPlanChecklist
                todos={[
                    { text: 'Done thing', done: true },
                    { text: 'Pending thing', done: false },
                ]}
            />,
        );
        expect(screen.getByText('Done thing').className).toContain('line-through');
        expect(screen.getByText('Pending thing').className).not.toContain('line-through');
    });

    it('shows a single spinner on the first not-done item while running', () => {
        const { container } = render(
            <BuilderPlanChecklist
                running
                todos={[
                    { text: 'First', done: true },
                    { text: 'Second', done: false },
                    { text: 'Third', done: false },
                ]}
            />,
        );
        // The first not-done item (Second) is the active one → exactly one spinner.
        expect(container.querySelectorAll('.animate-spin')).toHaveLength(1);
    });

    it('shows no spinner when not running', () => {
        const { container } = render(
            <BuilderPlanChecklist
                todos={[
                    { text: 'First', done: true },
                    { text: 'Second', done: false },
                ]}
            />,
        );
        expect(container.querySelectorAll('.animate-spin')).toHaveLength(0);
    });
});

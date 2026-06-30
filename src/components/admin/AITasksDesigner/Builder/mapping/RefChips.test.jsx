import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import RefChips from './RefChips';

const labels = new Map([['ai_87e358', 'Search web & compile news digest']]);

describe('RefChips', () => {
    beforeEach(() => cleanup());

    it('renders the step NAME, not the raw id', () => {
        const { container } = render(
            <RefChips text="steps.ai_87e358.output.sources" mode="expression" stepLabelById={labels} />,
        );
        expect(screen.getByText('Search web & compile news digest')).toBeTruthy();
        expect(container.textContent).not.toContain('ai_87e358');
    });

    it('shows a deleted step as a muted/missing chip carrying the id + tooltip', () => {
        const { container } = render(
            <RefChips text="steps.gone_1.output.x" mode="expression" stepLabelById={labels} />,
        );
        expect(screen.getByText('gone_1')).toBeTruthy();
        const missing = container.querySelector('[title*="no longer exists"]');
        expect(missing).toBeTruthy();
        expect(missing.className).toContain('border-dashed');
    });

    it('interleaves multiple chips with literal text in a template', () => {
        render(
            <RefChips
                text="From: {{trigger.output.from}} / {{steps.ai_87e358.output.sources}}"
                mode="fixed"
                stepLabelById={labels}
            />,
        );
        expect(screen.getByText('Trigger')).toBeTruthy();
        expect(screen.getByText('Search web & compile news digest')).toBeTruthy();
        // literal text between the chips survives
        expect(screen.getByText(/From:/)).toBeTruthy();
    });

    it('never emits purple/violet/indigo classes (project rule)', () => {
        const { container } = render(
            <RefChips text="steps.ai_87e358.output.sources" mode="expression" stepLabelById={labels} />,
        );
        const html = container.innerHTML;
        expect(/purple|violet|indigo/i.test(html)).toBe(false);
    });
});

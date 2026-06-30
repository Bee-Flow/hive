import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SuggestionCard, { ComplexityBadge } from './SuggestionCard.jsx';

const base = (overrides = {}) => ({
    id: 'sug_1',
    title: 'Auto-file incoming invoices to a spreadsheet',
    description: 'Extract amount/vendor/date from invoice emails and append a row.',
    complexity: 'assisted',
    requiredIntegrations: ['gmail', 'google-sheets'],
    unavailableIntegrations: [],
    triggerKind: 'app_event',
    buildPrompt: 'When an invoice arrives, extract details and append a row.',
    ...overrides,
});

describe('ComplexityBadge', () => {
    beforeEach(() => cleanup());

    it('renders each tier with its colour class and label', () => {
        const cases = [
            ['quick', 'Quick', 'emerald'],
            ['assisted', 'Assisted', 'blue'],
            ['orchestrated', 'Orchestrated', 'amber'],
            ['advanced', 'Advanced', 'red'],
        ];
        for (const [tier, label, colour] of cases) {
            cleanup();
            render(<ComplexityBadge tier={tier} />);
            const el = screen.getByText(label);
            expect(el.className).toContain(`${colour}-500/15`);
        }
    });

    it('never uses purple/violet/indigo', () => {
        for (const tier of ['quick', 'assisted', 'orchestrated', 'advanced']) {
            cleanup();
            const { container } = render(<ComplexityBadge tier={tier} />);
            expect(container.innerHTML).not.toMatch(/purple|violet|indigo/);
        }
    });
});

describe('SuggestionCard', () => {
    beforeEach(() => cleanup());

    it('renders title, description and required integrations', () => {
        render(<SuggestionCard suggestion={base()} />);
        expect(screen.getByText('Auto-file incoming invoices to a spreadsheet')).toBeTruthy();
        expect(screen.getByText('gmail')).toBeTruthy();
        expect(screen.getByText('google-sheets')).toBeTruthy();
        expect(screen.getByText('Assisted')).toBeTruthy();
    });

    it('shows a "needs <app>" hint for unavailable integrations', () => {
        render(<SuggestionCard suggestion={base({ requiredIntegrations: ['gmail'], unavailableIntegrations: ['google-sheets'] })} />);
        expect(screen.getByText('needs google-sheets')).toBeTruthy();
    });

    it('fires onBuildDirectly with the suggestion', () => {
        const onBuildDirectly = vi.fn();
        const s = base();
        render(<SuggestionCard suggestion={s} onBuildDirectly={onBuildDirectly} />);
        fireEvent.click(screen.getByText('Build it directly'));
        expect(onBuildDirectly).toHaveBeenCalledWith(s);
    });

    it('fires onAskForChanges with the suggestion', () => {
        const onAskForChanges = vi.fn();
        const s = base();
        render(<SuggestionCard suggestion={s} onAskForChanges={onAskForChanges} />);
        fireEvent.click(screen.getByText('Ask for changes'));
        expect(onAskForChanges).toHaveBeenCalledWith(s);
    });

    // ---- additive, feature-detected extras ---------------------------------

    it('omits evidence / time-saved / grounding when the fields are absent', () => {
        const { container } = render(<SuggestionCard suggestion={base()} />);
        expect(screen.queryByText('Observed')).toBeNull();
        expect(screen.queryByText('Idea')).toBeNull();
        expect(container.innerHTML).not.toMatch(/min\/mo|hr\/mo/);
    });

    it('renders an evidence summary from the object shape', () => {
        render(<SuggestionCard suggestion={base({ evidence: { summary: 'Seen 12 invoice emails last week' } })} />);
        expect(screen.getByText('Seen 12 invoice emails last week')).toBeTruthy();
    });

    it('renders an evidence summary from the string shape', () => {
        render(<SuggestionCard suggestion={base({ evidence: 'Plain string evidence' })} />);
        expect(screen.getByText('Plain string evidence')).toBeTruthy();
    });

    it('never displays an estimated time-saved value (intentionally hidden)', () => {
        render(<SuggestionCard suggestion={base({ value: { minutesSavedPerMonth: 45 }, timeSavedMinutes: 30 })} />);
        expect(screen.queryByText(/min\/mo|hr\/mo/i)).toBeNull();
    });

    it('shows the "Observed" grounding badge for activity-grounded suggestions', () => {
        render(<SuggestionCard suggestion={base({ groundedIn: 'activity' })} />);
        const el = screen.getByText('Observed');
        expect(el).toBeTruthy();
        expect(el.className).toContain('emerald');
    });

    it('shows the "Idea" grounding badge for non-activity suggestions', () => {
        render(<SuggestionCard suggestion={base({ groundedIn: 'idea' })} />);
        expect(screen.getByText('Idea')).toBeTruthy();
    });

    it('fires onDismiss when the dismiss control is clicked', () => {
        const onDismiss = vi.fn();
        const s = base();
        render(<SuggestionCard suggestion={s} onDismiss={onDismiss} />);
        fireEvent.click(screen.getByLabelText('Delete suggestion'));
        expect(onDismiss).toHaveBeenCalledWith(s);
    });

    it('greys out and disables CTAs when dismissed', () => {
        render(<SuggestionCard suggestion={base()} dismissed muted onDismiss={vi.fn()} />);
        expect(screen.getByText('Dismissed')).toBeTruthy();
        expect(screen.getByText('Build it directly').closest('button').disabled).toBe(true);
        expect(screen.getByText('Ask for changes').closest('button').disabled).toBe(true);
        // The dismiss control hides once already dismissed.
        expect(screen.queryByLabelText('Delete suggestion')).toBeNull();
    });

    it('shows a "Built" tag and disables CTAs when built', () => {
        render(<SuggestionCard suggestion={base()} built muted />);
        expect(screen.getByText('Built')).toBeTruthy();
        expect(screen.getByText('Build it directly').closest('button').disabled).toBe(true);
    });

    it('never uses purple/violet/indigo on the extended markup', () => {
        const { container } = render(
            <SuggestionCard
                suggestion={base({
                    groundedIn: 'activity',
                    evidence: { summary: 'evidence' },
                    value: { minutesSavedPerMonth: 90 },
                })}
                built
                muted
                onDismiss={vi.fn()}
            />,
        );
        expect(container.innerHTML).not.toMatch(/purple|violet|indigo/);
    });
});

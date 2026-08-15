import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory scopedStorage so we can assert tab persistence deterministically.
const { store } = vi.hoisted(() => ({ store: new Map() }));
vi.mock('../../../../utils/scopedStorage', () => ({
    default: {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => { store.set(k, v); },
    },
}));

// Stub the four heavy tab components — this test is about the shell's tab bar +
// show/hide logic, not the panels' own data-loading subtrees.
vi.mock('./BuildWithAITab', () => ({ default: () => <div data-testid="panel-build">build</div> }));
vi.mock('./FindRepeatingWorkTab', () => ({ default: () => <div data-testid="panel-repeating">repeating</div> }));
vi.mock('./TemplatesTab', () => ({ default: () => <div data-testid="panel-templates">templates</div> }));
vi.mock('./StepsTab', () => ({ default: () => <div data-testid="panel-steps">steps</div> }));
// The runs panel is heavy (list + streaming); stub it — activity gating is its own concern.
vi.mock('../Executions/ExecutionsPanel', () => ({ default: () => <div data-testid="panel-executions">executions</div> }));

import RoutinesEmptyState from './EmptyState.jsx';

const props = {
    segment: 'automation',
    onCreateAutomation: vi.fn(),
    onUseExample: vi.fn(),
    onOpenAutomation: vi.fn(),
    onPickTemplate: vi.fn(),
    onBuildSuggestion: vi.fn(),
    onAskSuggestion: vi.fn(),
};

const isHidden = (testId) => screen.getByTestId(testId).parentElement.className.includes('hidden');

describe('RoutinesEmptyState — tabbed launcher', () => {
    beforeEach(() => { cleanup(); store.clear(); });

    it('renders the launcher tabs', () => {
        render(<RoutinesEmptyState {...props} />);
        for (const label of ['Build with AI', 'Find repeating work', 'Templates', 'Runs']) {
            expect(screen.getByRole('button', { name: label })).toBeTruthy();
        }
    });

    it('defaults to Build with AI; the other launcher panels are hidden but mounted', () => {
        render(<RoutinesEmptyState {...props} />);
        expect(isHidden('panel-build')).toBe(false);
        expect(isHidden('panel-repeating')).toBe(true);
        expect(isHidden('panel-templates')).toBe(true);
        // Runs stays MOUNTED but hidden — its `active` prop stands
        // fetching/streaming down, and hiding keeps its filters and scroll.
        expect(isHidden('panel-executions')).toBe(true);
    });

    it('switching a tab shows that panel and hides the rest', () => {
        render(<RoutinesEmptyState {...props} />);
        fireEvent.click(screen.getByRole('button', { name: 'Templates' }));
        expect(isHidden('panel-templates')).toBe(false);
        expect(isHidden('panel-build')).toBe(true);
        // Runs shows (full-width) and the narrow launcher column hides.
        fireEvent.click(screen.getByRole('button', { name: 'Runs' }));
        expect(isHidden('panel-executions')).toBe(false);
        expect(isHidden('panel-templates')).toBe(true);
    });

    it('persists the chosen tab and restores it on remount', () => {
        const { unmount } = render(<RoutinesEmptyState {...props} />);
        fireEvent.click(screen.getByRole('button', { name: 'Find repeating work' }));
        expect(store.get('routinesStartTab')).toBe('repeating');
        unmount();
        render(<RoutinesEmptyState {...props} />);
        expect(isHidden('panel-repeating')).toBe(false);
        expect(isHidden('panel-build')).toBe(true);
    });

    it('the agent-routine pane keeps its simple CTA, no tabs', () => {
        // Reachable by deep link only now — the segmented control is gone and
        // the tab is Automations.
        render(<RoutinesEmptyState {...props} segment="prompt_task" onCreateTask={vi.fn()} />);
        expect(screen.getByRole('button', { name: /New agent routine/ })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Templates' })).toBeNull();
    });
});

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
// Executions mounts only while active (it streams live); stub the panel.
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
        for (const label of ['Build with AI', 'Find repeating work', 'Templates', 'Executions']) {
            expect(screen.getByRole('button', { name: label })).toBeTruthy();
        }
    });

    it('defaults to Build with AI; the other launcher panels are hidden but mounted', () => {
        render(<RoutinesEmptyState {...props} />);
        expect(isHidden('panel-build')).toBe(false);
        expect(isHidden('panel-repeating')).toBe(true);
        expect(isHidden('panel-templates')).toBe(true);
        // Executions is full-width and mounts only when active.
        expect(screen.queryByTestId('panel-executions')).toBeNull();
    });

    it('switching a tab shows that panel and hides the rest', () => {
        render(<RoutinesEmptyState {...props} />);
        fireEvent.click(screen.getByRole('button', { name: 'Templates' }));
        expect(isHidden('panel-templates')).toBe(false);
        expect(isHidden('panel-build')).toBe(true);
        // Executions mounts (full-width) and the narrow launcher column hides.
        fireEvent.click(screen.getByRole('button', { name: 'Executions' }));
        expect(screen.getByTestId('panel-executions')).toBeTruthy();
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

    it('prompt_task segment keeps its simple CTA, no tabs', () => {
        render(<RoutinesEmptyState {...props} segment="prompt_task" onCreateTask={vi.fn()} />);
        expect(screen.getByRole('button', { name: /New routine/ })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Templates' })).toBeNull();
    });
});

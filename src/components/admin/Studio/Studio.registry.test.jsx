import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// Controllable licence gate shared with the hoisted vi.mock factories.
const { licenseMock } = vi.hoisted(() => ({ licenseMock: { hasFeature: () => true } }));

// t() echoes the key, so tabs are asserted by their labelKey.
vi.mock('../../../hooks/useTranslation', () => {
    const useTranslation = () => ({ t: (key) => key });
    return { default: useTranslation, useTranslation };
});
vi.mock('../../LicenseContext', () => ({
    useLicenseContext: () => ({ hasFeature: (f) => licenseMock.hasFeature(f) }),
}));

// Stub every registry app with a marker — these paths must match the lazy()
// import specifiers in studioApps.jsx (they resolve to the same modules).
vi.mock('../AgentStudio', () => ({
    default: ({ onEditingChange }) => (
        <div data-testid="app-agents">
            <button data-testid="agents-start-editing" onClick={() => onEditingChange(true)}>start</button>
            <button data-testid="agents-stop-editing" onClick={() => onEditingChange(false)}>stop</button>
        </div>
    ),
}));
vi.mock('./SkillsStudio', () => ({ default: () => <div data-testid="app-skills" /> }));
vi.mock('./KBsStudio', () => ({ default: () => <div data-testid="app-knowledge" /> }));
vi.mock('../AITasksDesigner', () => ({ default: () => <div data-testid="app-aiTasks" /> }));
vi.mock('../../../pages/WebpagesPage', () => ({ default: () => <div data-testid="app-webpages" /> }));
vi.mock('./TestsStudio', () => ({ default: () => <div data-testid="app-tests" /> }));
vi.mock('./SupportStudio', () => ({ default: () => <div data-testid="app-support" /> }));
vi.mock('./LeadStudio', () => ({ default: () => <div data-testid="app-leadStudio" /> }));
vi.mock('../../../pages/meeting-notes/MeetingNotesPage', () => ({ default: () => <div data-testid="app-meetingNotes" /> }));

import Studio from './index.jsx';

const ALL_TABS = [
    'studio.tab.agents', 'studio.tab.skills', 'studio.tab.knowledge',
    'studio.tab.ai_tasks', 'studio.tab.webpages', 'studio.tab.tests',
    'studio.tab.support', 'studio.tab.lead_studio',
    'studio.tab.meeting_notes',
];
const GATED_TABS = ALL_TABS.slice(3);

const renderStudio = (props = {}) => render(
    <Studio
        user={{ permissions: ['all'] }}
        hasPermission={() => true}
        onNavigate={vi.fn()}
        {...props}
    />
);

describe('Studio shell — registry-driven tabs', () => {
    beforeEach(() => {
        cleanup();
        licenseMock.hasFeature = () => true;
    });

    it('shows all built-in tabs when every gate passes', async () => {
        renderStudio();
        for (const label of ALL_TABS) expect(screen.getByText(label)).toBeTruthy();
        // Default section mounts the Agents app through the local Suspense.
        expect(await screen.findByTestId('app-agents')).toBeTruthy();
    });

    it('shows only the ungated tabs when features are off', async () => {
        licenseMock.hasFeature = () => false;
        renderStudio({ user: {}, hasPermission: () => false });
        expect(screen.getByText('studio.tab.agents')).toBeTruthy();
        expect(screen.getByText('studio.tab.skills')).toBeTruthy();
        expect(screen.getByText('studio.tab.knowledge')).toBeTruthy();
        for (const label of GATED_TABS) expect(screen.queryByText(label)).toBeNull();
        await screen.findByTestId('app-agents'); // settle the lazy mount
    });

    it('hides the support tab without the support_inbox permission even when licensed', async () => {
        renderStudio({ user: {}, hasPermission: (p) => p !== 'support_inbox' && p !== 'all' });
        expect(screen.queryByText('studio.tab.support')).toBeNull();
        await screen.findByTestId('app-agents');
        // Siblings gated purely on licence × beta stay visible (user {} has no
        // beta grants, so give it the canUseFeature map form instead).
        cleanup();
        renderStudio({
            user: { canUseFeature: { support_inbox: true, webpages: true } },
            hasPermission: () => false,
        });
        expect(screen.getByText('studio.tab.webpages')).toBeTruthy();
        expect(screen.queryByText('studio.tab.support')).toBeNull();
        await screen.findByTestId('app-agents');
    });

    it('navigates to studio/<urlSegment> on tab click', async () => {
        const onNavigate = vi.fn();
        renderStudio({ onNavigate });
        await screen.findByTestId('app-agents');
        fireEvent.click(screen.getByText('studio.tab.skills'));
        expect(onNavigate).toHaveBeenLastCalledWith('studio/skills');
        fireEvent.click(screen.getByText('studio.tab.ai_tasks'));
        expect(onNavigate).toHaveBeenLastCalledWith('studio/routines');
        fireEvent.click(screen.getByText('studio.tab.lead_studio'));
        expect(onNavigate).toHaveBeenLastCalledWith('studio/lead-studio');
        fireEvent.click(screen.getByText('studio.tab.meeting_notes'));
        expect(onNavigate).toHaveBeenLastCalledWith('studio/meeting-notes');
    });

    it('renders the active app lazily for a non-default section', async () => {
        renderStudio({ section: 'tests' });
        expect(await screen.findByTestId('app-tests')).toBeTruthy();
        expect(screen.queryByTestId('app-agents')).toBeNull();
    });

    it('still renders the active section when its gate is false (server 403s the data)', async () => {
        licenseMock.hasFeature = () => false;
        renderStudio({ section: 'tests', user: {}, hasPermission: () => false });
        expect(screen.queryByText('studio.tab.tests')).toBeNull();
        expect(await screen.findByTestId('app-tests')).toBeTruthy();
    });

    it('hides the tab bar while an app reports editing and fires the aggregate', async () => {
        const onEditingChange = vi.fn();
        renderStudio({ onEditingChange });
        const start = await screen.findByTestId('agents-start-editing');
        expect(screen.getByText('studio.tab.skills')).toBeTruthy();

        fireEvent.click(start);
        expect(onEditingChange).toHaveBeenLastCalledWith(true);
        expect(screen.queryByText('studio.tab.skills')).toBeNull();

        fireEvent.click(screen.getByTestId('agents-stop-editing'));
        expect(onEditingChange).toHaveBeenLastCalledWith(false);
        expect(screen.getByText('studio.tab.skills')).toBeTruthy();
    });
});

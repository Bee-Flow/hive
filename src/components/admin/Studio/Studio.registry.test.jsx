import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// The Studio shell has no tab bar anymore — section navigation lives in the
// app sidebar (Sidebar renders the registry + gates; covered by
// Sidebar.studioNav.test.jsx). What the shell still owns, and what this file
// asserts: resolving the active section from the registry (built-ins +
// runtime modules), lazy-mounting it behind the local Suspense boundary,
// rendering it EVEN when its gate is false (the server 403s the data), and
// aggregating the per-app fullscreen-editing flags into onEditingChange.

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
vi.mock('./SupportStudio', () => ({ default: () => <div data-testid="app-support" /> }));
vi.mock('../../../pages/meeting-notes/MeetingNotesPage', () => ({ default: () => <div data-testid="app-meetingNotes" /> }));

import Studio from './index.jsx';

const renderStudio = (props = {}) => render(
    <Studio
        user={{ permissions: ['all'] }}
        hasPermission={() => true}
        onNavigate={vi.fn()}
        {...props}
    />
);

describe('Studio shell — registry-driven sections', () => {
    beforeEach(() => cleanup());

    it('mounts the default Agents section through the local Suspense', async () => {
        renderStudio();
        expect(await screen.findByTestId('app-agents')).toBeTruthy();
    });

    it('renders the active app lazily for a non-default section', async () => {
        renderStudio({ section: 'webpages' });
        expect(await screen.findByTestId('app-webpages')).toBeTruthy();
        expect(screen.queryByTestId('app-agents')).toBeNull();
    });

    it('still renders the active section for a user its gate would exclude (server 403s the data)', async () => {
        // No licence features, no permissions — the sidebar would hide this
        // section, but a deep link into it must still render the app.
        renderStudio({ section: 'webpages', user: {}, hasPermission: () => false });
        expect(await screen.findByTestId('app-webpages')).toBeTruthy();
    });

    it('fires the aggregate editing flag while an app reports editing', async () => {
        const onEditingChange = vi.fn();
        renderStudio({ onEditingChange });
        const start = await screen.findByTestId('agents-start-editing');

        fireEvent.click(start);
        expect(onEditingChange).toHaveBeenLastCalledWith(true);

        fireEvent.click(screen.getByTestId('agents-stop-editing'));
        expect(onEditingChange).toHaveBeenLastCalledWith(false);
    });
});

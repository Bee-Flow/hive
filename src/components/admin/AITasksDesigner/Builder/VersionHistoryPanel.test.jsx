import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stable mock API object (hoisted so it exists before the vi.mock factory runs).
const { api } = vi.hoisted(() => ({
    api: {
        listVersions: vi.fn(),
        getVersion: vi.fn(),
        getAutomation: vi.fn(),
        restoreVersion: vi.fn(),
    },
}));
vi.mock('../../../../hooks/useAutomationApi', () => ({ default: () => api }));

import VersionHistoryPanel from './VersionHistoryPanel.jsx';

const nowIso = () => new Date().toISOString();

const twoVersions = () => ({
    versions: [
        { id: 'v2', version: 2, savedAt: nowIso(), changeSummary: '2 steps added', savedByName: 'Tom Kooy' },
        { id: 'v1', version: 1, savedAt: nowIso(), changeSummary: 'Initial', savedByName: 'Tom Kooy' },
    ],
});

describe('VersionHistoryPanel', () => {
    beforeEach(() => {
        cleanup();
        api.listVersions.mockReset();
        api.getVersion.mockReset();
        api.getAutomation.mockReset();
        api.restoreVersion.mockReset();
    });

    it('renders grouped versions with change summaries, author, and a Today header', async () => {
        api.listVersions.mockResolvedValue(twoVersions());
        render(<VersionHistoryPanel automation={{ id: 'a1', version: 2 }} onRestored={vi.fn()} />);

        // Change summaries are the row auto-labels.
        expect(await screen.findByText('2 steps added')).toBeTruthy();
        expect(screen.getByText('Initial')).toBeTruthy();
        // Author name surfaces (one per row).
        expect(screen.getAllByText('Tom Kooy').length).toBe(2);
        // Same-day grouping → a single "Today" header.
        expect(screen.getByText('Today')).toBeTruthy();
    });

    it('badges the current version and only offers restore on older ones', async () => {
        api.listVersions.mockResolvedValue(twoVersions());
        render(<VersionHistoryPanel automation={{ id: 'a1', version: 2 }} onRestored={vi.fn()} />);

        await screen.findByText('2 steps added');

        // v2 is the current version → "current" badge, no restore button in its row.
        const currentRow = screen.getByText('2 steps added').closest('li');
        expect(within(currentRow).getByText('current')).toBeTruthy();
        expect(within(currentRow).queryByTitle('Restore this version')).toBeNull();

        // v1 is older → no badge, has a restore action.
        const olderRow = screen.getByText('Initial').closest('li');
        expect(within(olderRow).queryByText('current')).toBeNull();
        expect(within(olderRow).getByTitle('Restore this version')).toBeTruthy();
    });

    it('opens a human-readable diff modal (raw JSON hidden by default) with a Restore button for older versions', async () => {
        api.listVersions.mockResolvedValue(twoVersions());
        // Opened snapshot (v1) has one step; current automation has two → "1 step removed".
        api.getVersion.mockResolvedValue({
            version: { id: 'v1', version: 1, definition: { steps: [{ id: 's1' }] } },
        });
        api.getAutomation.mockResolvedValue({
            automation: { version: 2, definition: { steps: [{ id: 's1' }, { id: 's2' }] } },
        });

        render(<VersionHistoryPanel automation={{ id: 'a1', version: 2 }} onRestored={vi.fn()} />);
        await screen.findByText('Initial');

        // Open the diff for v1 (the older row).
        const olderRow = screen.getByText('Initial').closest('li');
        fireEvent.click(within(olderRow).getByTitle('View diff'));

        // Modal header for the opened version.
        expect(await screen.findByText(/Diff · v1/)).toBeTruthy();

        // Default view is the plain-language summary mentioning a step change.
        expect(await screen.findByText('1 step removed')).toBeTruthy();
        // Raw JSON two-pane diff is opt-in: the toggle exists but isn't applied yet,
        // so no diff-pane content (e.g. a "steps" JSON line) is shown by default.
        expect(screen.getByTitle('Show raw JSON')).toBeTruthy();
        expect(screen.queryByText(/"steps":/)).toBeNull();

        // A Restore action is present inside the modal for the non-current v1.
        expect(screen.getByText('Restore this version')).toBeTruthy();
    });
});

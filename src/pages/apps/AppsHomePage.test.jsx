import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted mock of the studio-apps API — AppsHomePage merges listAccessible +
// listMine (published-only) into the consumer directory.
vi.mock('../../components/admin/Studio/AppStudio/studioAppsApi', () => {
    const studioAppsApi = { listAccessible: vi.fn(), listMine: vi.fn() };
    return { default: studioAppsApi, studioAppsApi };
});

import AppsHomePage from './AppsHomePage';
import { studioAppsApi } from '../../components/admin/Studio/AppStudio/studioAppsApi';

beforeEach(() => {
    vi.clearAllMocks();
    studioAppsApi.listAccessible.mockResolvedValue({ apps: [] });
    studioAppsApi.listMine.mockResolvedValue({ apps: [] });
});

describe('AppsHomePage', () => {
    it('renders accessible published tiles that link to the run view', async () => {
        studioAppsApi.listAccessible.mockResolvedValue({
            apps: [
                { id: 'a1', name: 'CRM Pipeline', description: 'Track deals', isPublished: true, accentColor: '#0F766E' },
                { id: 'a2', name: 'Ticket Tracker', isPublished: true },
            ],
        });

        render(<AppsHomePage />);

        expect(await screen.findByText('CRM Pipeline')).toBeInTheDocument();
        expect(screen.getByText('Track deals')).toBeInTheDocument();
        expect(screen.getByText('Ticket Tracker')).toBeInTheDocument();

        // Each tile is an anchor to /app/apps/:id (the standalone run view).
        const crmLink = screen.getByRole('link', { name: /CRM Pipeline/i });
        expect(crmLink).toHaveAttribute('href', '/app/apps/a1');
    });

    it('merges owned-published apps and drops drafts + duplicates', async () => {
        studioAppsApi.listAccessible.mockResolvedValue({
            apps: [{ id: 'a1', name: 'Shared App', isPublished: true }],
        });
        studioAppsApi.listMine.mockResolvedValue({
            apps: [
                { id: 'a1', name: 'Shared App', isPublished: true }, // duplicate of accessible
                { id: 'a2', name: 'My Published', isPublished: true },
                { id: 'a3', name: 'My Draft', isPublished: false },   // dropped
            ],
        });

        render(<AppsHomePage />);

        await screen.findByText('Shared App');
        expect(screen.getByText('My Published')).toBeInTheDocument();
        expect(screen.queryByText('My Draft')).not.toBeInTheDocument();
        // Deduped: only one "Shared App" tile.
        expect(screen.getAllByText('Shared App')).toHaveLength(1);
    });

    it('shows the empty state when nothing is shared', async () => {
        render(<AppsHomePage />);
        expect(await screen.findByText(/No apps have been shared with you yet/i)).toBeInTheDocument();
    });

    it('surfaces a retryable error when loading fails', async () => {
        studioAppsApi.listAccessible.mockRejectedValue(new Error('boom'));
        render(<AppsHomePage />);
        const alert = await screen.findByRole('alert');
        expect(within(alert).getByText(/boom/i)).toBeInTheDocument();
        expect(within(alert).getByText('Retry')).toBeInTheDocument();
    });
});

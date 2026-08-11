import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppRunPage from './AppRunPage';
import { KITCHEN_SINK } from '../../components/admin/Studio/AppStudio/state/sampleDefinitions';
import { studioAppsApi } from '../../components/admin/Studio/AppStudio/studioAppsApi';

// vi.mock is hoisted above the imports, so the component under test receives
// the mocked api despite the import order.
vi.mock('../../components/admin/Studio/AppStudio/studioAppsApi', () => {
    const studioAppsApi = { getRuntime: vi.fn() };
    return { studioAppsApi, default: studioAppsApi };
});

const RUNTIME_PAYLOAD = {
    id: 'app-1',
    name: 'Kitchen sink',
    icon: 'LayoutGrid',
    accentColor: '#0F766E',
    definition: KITCHEN_SINK,
};

beforeEach(() => {
    vi.clearAllMocks();
    studioAppsApi.getRuntime.mockResolvedValue(RUNTIME_PAYLOAD);
    document.title = 'BeeFlow';
});

describe('AppRunPage', () => {
    it('renders the app shell with the app name and the home screen content', async () => {
        render(<AppRunPage appId="app-1" />);

        // App name in the shell top bar + a real heading from the definition.
        expect(await screen.findByText('Kitchen sink')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Team dashboard' })).toBeInTheDocument();
        expect(studioAppsApi.getRuntime).toHaveBeenCalledWith('app-1', { draft: false });

        // Browser tab title follows the app while mounted.
        expect(document.title).toBe('Kitchen sink');
    });

    it('restores the previous document title on unmount', async () => {
        const { unmount } = render(<AppRunPage appId="app-1" />);
        await screen.findByText('Kitchen sink');
        expect(document.title).toBe('Kitchen sink');
        unmount();
        expect(document.title).toBe('BeeFlow');
    });

    it('requests the draft definition when draft is set', async () => {
        render(<AppRunPage appId="app-1" draft />);
        await screen.findByText('Kitchen sink');
        expect(studioAppsApi.getRuntime).toHaveBeenCalledWith('app-1', { draft: true });
    });

    it('renders the friendly empty state on 404 and retries on demand', async () => {
        const err = new Error('App not found');
        err.status = 404;
        studioAppsApi.getRuntime.mockRejectedValueOnce(err);

        render(<AppRunPage appId="app-1" />);
        expect(await screen.findByText('This app is not available to you')).toBeInTheDocument();

        // Retry: the second call succeeds and the app renders.
        fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
        expect(await screen.findByText('Kitchen sink')).toBeInTheDocument();
        await waitFor(() => expect(studioAppsApi.getRuntime).toHaveBeenCalledTimes(2));
    });

    it('switches screens when a nav tab is clicked', async () => {
        const { container } = render(<AppRunPage appId="app-1" />);
        await screen.findByText('Kitchen sink');

        // Home screen first.
        expect(container.querySelector('[data-app-screen="scr_dash01"]')).not.toBeNull();

        const nav = screen.getByRole('navigation', { name: 'App screens' });
        fireEvent.click(within(nav).getByRole('button', { name: /New request/ }));

        await waitFor(() => {
            expect(container.querySelector('[data-app-screen="scr_form01"]')).not.toBeNull();
        });
        expect(screen.getByRole('heading', { name: 'New request' })).toBeInTheDocument();
        expect(screen.getByLabelText(/Subject/)).toBeInTheDocument();
    });
});

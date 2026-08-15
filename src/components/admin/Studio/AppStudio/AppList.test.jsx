import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppList from './AppList';

vi.mock('./studioAppsApi', () => {
    const studioAppsApi = {
        listAccessible: vi.fn(),
        listMine: vi.fn(),
        listTemplates: vi.fn(),
        createApp: vi.fn(),
        updateApp: vi.fn(),
        deleteApp: vi.fn(),
        templateUpgrade: vi.fn(),
    };
    return { studioAppsApi, default: studioAppsApi };
});

vi.mock('../../../shared/Toast', () => {
    const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    return { default: toast, toast };
});

import { studioAppsApi } from './studioAppsApi';
import toast from '../../../shared/Toast';

const OWNED_APP = {
    id: 'app-owned',
    userId: 'u1',
    name: 'My tracker',
    description: 'Owned by me',
    icon: 'Rocket',
    accentColor: '#0F766E',
    isPublished: false,
    updatedAt: '2026-07-01T10:00:00.000Z',
};

const SHARED_APP = {
    id: 'app-shared',
    userId: 'u2',
    name: 'Team portal',
    description: 'Shared with me',
    icon: 'Users',
    accentColor: null,
    isPublished: true,
    updatedAt: '2026-07-02T09:00:00.000Z',
};

beforeEach(() => {
    vi.clearAllMocks();
    // listAccessible includes the caller's own apps too — the component must
    // dedupe by id (owned wins, listed first).
    studioAppsApi.listAccessible.mockResolvedValue({ apps: [OWNED_APP, SHARED_APP] });
    studioAppsApi.listMine.mockResolvedValue({ apps: [OWNED_APP] });
    studioAppsApi.listTemplates.mockResolvedValue({
        templates: [{
            id: 'tpl_ticket',
            title: 'Ticket tracker',
            description: 'Collect and triage requests.',
            category: 'Forms',
            icon: 'Ticket',
            tags: ['forms'],
        }],
    });
    studioAppsApi.createApp.mockResolvedValue({ success: true, app: { id: 'app-new', name: 'Ticket tracker' } });
    studioAppsApi.updateApp.mockResolvedValue({ success: true, app: { ...OWNED_APP, name: 'Renamed' } });
    studioAppsApi.deleteApp.mockResolvedValue({ success: true });
});

describe('AppList', () => {
    it('renders owned and shared apps, deduped, with shared cards linking to the run view', async () => {
        render(<AppList onOpen={vi.fn()} />);

        expect(await screen.findByText('My tracker')).toBeInTheDocument();
        expect(screen.getByText('Team portal')).toBeInTheDocument();

        // Deduped: the owned app appears once even though it is in both lists.
        expect(screen.getAllByText('My tracker')).toHaveLength(1);

        // Published badge only on the published app.
        expect(screen.getAllByText('Published')).toHaveLength(1);

        // Owned card is a button (opens the editor) with a kebab; the shared
        // card is a plain anchor to the standalone run view.
        expect(screen.getByRole('button', { name: 'Actions for My tracker' })).toBeInTheDocument();
        const sharedCard = screen.getByText('Team portal').closest('a');
        expect(sharedCard).not.toBeNull();
        expect(sharedCard.getAttribute('href')).toBe('/app/apps/app-shared');
    });

    it('calls onOpen with the app when an owned card is clicked', async () => {
        const onOpen = vi.fn();
        render(<AppList onOpen={onOpen} />);

        fireEvent.click(await screen.findByText('My tracker'));
        expect(onOpen).toHaveBeenCalledTimes(1);
        expect(onOpen.mock.calls[0][0]).toMatchObject({ id: 'app-owned' });
    });

    it('New app modal shows the template gallery and creates from a template', async () => {
        const onOpen = vi.fn();
        render(<AppList onOpen={onOpen} />);
        await screen.findByText('My tracker');

        fireEvent.click(screen.getByRole('button', { name: /New app/ }));
        expect(await screen.findByRole('dialog')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: 'From template' }));
        expect(await screen.findByText('Ticket tracker')).toBeInTheDocument();
        expect(screen.getByText('Forms')).toBeInTheDocument();
        expect(screen.getByText('Collect and triage requests.')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Ticket tracker'));
        await waitFor(() => expect(studioAppsApi.createApp).toHaveBeenCalledWith({ templateId: 'tpl_ticket' }));
        await waitFor(() => expect(onOpen).toHaveBeenCalledWith({ id: 'app-new', name: 'Ticket tracker' }));
    });

    it('says so when a template installs its screens but not its data', async () => {
        // The silent version of this produced an app with every screen, no
        // tables and no mailbox connector — indistinguishable from a template
        // that never had them. The app is still created and still opened; the
        // difference is that someone is told.
        studioAppsApi.createApp.mockResolvedValue({
            success: true,
            app: { id: 'app-new', name: 'Ticket tracker' },
            dataInstall: { ok: false, error: 'relation "studio_app_data_meta" does not exist' },
        });
        const onOpen = vi.fn();
        render(<AppList onOpen={onOpen} />);
        await screen.findByText('My tracker');

        fireEvent.click(screen.getByRole('button', { name: /New app/ }));
        fireEvent.click(screen.getByRole('tab', { name: 'From template' }));
        await screen.findByText('Ticket tracker');
        fireEvent.click(screen.getByText('Ticket tracker'));

        await waitFor(() => expect(toast.error).toHaveBeenCalled());
        expect(toast.error.mock.calls[0][0]).toMatch(/tables and connections did not install/);
        expect(toast.success).not.toHaveBeenCalled();
        // Still opened — the screens are real and the data can be retried.
        await waitFor(() => expect(onOpen).toHaveBeenCalled());
    });

    it('offers a "Remix with AI" action per template that creates then opens with a remix intent', async () => {
        const onOpen = vi.fn();
        render(<AppList onOpen={onOpen} />);
        await screen.findByText('My tracker');

        fireEvent.click(screen.getByRole('button', { name: /New app/ }));
        fireEvent.click(screen.getByRole('tab', { name: 'From template' }));
        await screen.findByText('Ticket tracker');

        // The remix affordance renders on the template card.
        const remix = screen.getByRole('button', { name: /Remix with AI/ });
        expect(remix).toBeInTheDocument();

        fireEvent.click(remix);

        // Creates from the template …
        await waitFor(() => expect(studioAppsApi.createApp).toHaveBeenCalledWith({ templateId: 'tpl_ticket' }));
        // … then opens the editor with a remix intent (templateId + a prompt for
        // the AI builder), so the second onOpen arg carries the remix options.
        await waitFor(() => expect(onOpen).toHaveBeenCalled());
        const [openedApp, openOptions] = onOpen.mock.calls[0];
        expect(openedApp).toMatchObject({ id: 'app-new' });
        expect(openOptions).toMatchObject({ remix: true, templateId: 'tpl_ticket' });
        expect(typeof openOptions.prompt).toBe('string');
        expect(openOptions.prompt.length).toBeGreaterThan(0);
    });

    it('using a template as-is (not remix) opens without a remix intent', async () => {
        const onOpen = vi.fn();
        render(<AppList onOpen={onOpen} />);
        await screen.findByText('My tracker');

        fireEvent.click(screen.getByRole('button', { name: /New app/ }));
        fireEvent.click(screen.getByRole('tab', { name: 'From template' }));
        await screen.findByText('Ticket tracker');

        // Clicking the card body (the title) creates + opens the plain way —
        // single-arg onOpen(app), no remix intent.
        fireEvent.click(screen.getByText('Ticket tracker'));
        await waitFor(() => expect(studioAppsApi.createApp).toHaveBeenCalledWith({ templateId: 'tpl_ticket' }));
        await waitFor(() => expect(onOpen).toHaveBeenCalledWith({ id: 'app-new', name: 'Ticket tracker' }));
    });

    it('creates a blank app with the typed name', async () => {
        const onOpen = vi.fn();
        render(<AppList onOpen={onOpen} />);
        await screen.findByText('My tracker');

        fireEvent.click(screen.getByRole('button', { name: /New app/ }));
        fireEvent.change(screen.getByPlaceholderText('e.g. Vacation requests'), {
            target: { value: 'Vacation requests' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Create app/ }));

        await waitFor(() => expect(studioAppsApi.createApp).toHaveBeenCalledWith({ name: 'Vacation requests' }));
        await waitFor(() => expect(onOpen).toHaveBeenCalled());
    });

    it('deletes an owned app after confirmation', async () => {
        render(<AppList onOpen={vi.fn()} />);
        await screen.findByText('My tracker');

        fireEvent.click(screen.getByRole('button', { name: 'Actions for My tracker' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

        // ConfirmDialog: nothing deleted until confirmed.
        expect(studioAppsApi.deleteApp).not.toHaveBeenCalled();
        expect(await screen.findByRole('dialog')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
        await waitFor(() => expect(studioAppsApi.deleteApp).toHaveBeenCalledWith('app-owned'));
        await waitFor(() => expect(screen.queryByText('My tracker')).not.toBeInTheDocument());
    });

    it('renames an owned app through the small modal', async () => {
        render(<AppList onOpen={vi.fn()} />);
        await screen.findByText('My tracker');

        fireEvent.click(screen.getByRole('button', { name: 'Actions for My tracker' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));

        const input = await screen.findByLabelText('App name');
        fireEvent.change(input, { target: { value: 'Renamed' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(studioAppsApi.updateApp).toHaveBeenCalledWith('app-owned', { name: 'Renamed' }));
        expect(await screen.findByText('Renamed')).toBeInTheDocument();
    });

    it('shows an amber storage pill on an owned card above 80% of the DB cap, and not below', async () => {
        studioAppsApi.listMine.mockResolvedValue({
            apps: [
                { ...OWNED_APP, id: 'app-full', name: 'Nearly full', usage: { dbBytes: 1, dbRatio: 0.82 } },
                { ...OWNED_APP, id: 'app-roomy', name: 'Roomy', usage: { dbBytes: 1, dbRatio: 0.5 } },
            ],
        });
        studioAppsApi.listAccessible.mockResolvedValue({ apps: [] });

        render(<AppList onOpen={vi.fn()} />);
        await screen.findByText('Nearly full');

        // Over-threshold app shows the pill with a rounded percent.
        expect(screen.getByText('Storage 82%')).toBeInTheDocument();
        // Under-threshold app shows no storage pill at all.
        expect(screen.queryByText(/Storage 50%/)).not.toBeInTheDocument();
        expect(screen.getAllByText(/Storage \d+%/)).toHaveLength(1);
    });

    it('renders no storage pill when a card carries no usage field (e.g. shared apps)', async () => {
        render(<AppList onOpen={vi.fn()} />);
        await screen.findByText('My tracker');
        expect(screen.queryByText(/Storage \d+%/)).not.toBeInTheDocument();
    });

    it('stops retrying a failing template fetch and shows the error state with Try again', async () => {
        studioAppsApi.listTemplates.mockRejectedValue(new Error('Templates are unavailable.'));
        render(<AppList onOpen={vi.fn()} />);
        await screen.findByText('My tracker');

        fireEvent.click(screen.getByRole('button', { name: /New app/ }));
        fireEvent.click(screen.getByRole('tab', { name: 'From template' }));

        // The failed fetch leaves templates null — the load must NOT loop.
        expect(await screen.findByText('Templates are unavailable.')).toBeInTheDocument();
        await waitFor(() => expect(studioAppsApi.listTemplates).toHaveBeenCalledTimes(2));
        await new Promise((r) => { setTimeout(r, 50); });
        expect(studioAppsApi.listTemplates).toHaveBeenCalledTimes(2);

        // A deliberate retry gets a fresh budget and recovers.
        studioAppsApi.listTemplates.mockResolvedValue({
            templates: [{ id: 'tpl_ticket', title: 'Ticket tracker', description: 'Collect and triage requests.' }],
        });
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(await screen.findByText('Ticket tracker')).toBeInTheDocument();
    });

    it('shows "Update beschikbaar" on an upgradable owned card, confirms in Dutch, then upgrades and reloads', async () => {
        studioAppsApi.listMine.mockResolvedValue({
            apps: [
                { ...OWNED_APP, templateUpgrade: { available: true, fromVersion: 1, toVersion: 2 } },
                { ...OWNED_APP, id: 'app-current', name: 'Up to date', templateUpgrade: { available: false } },
            ],
        });
        studioAppsApi.listAccessible.mockResolvedValue({ apps: [] });
        studioAppsApi.templateUpgrade.mockResolvedValue({ ok: true, fromVersion: 1, toVersion: 2 });

        const onOpen = vi.fn();
        render(<AppList onOpen={onOpen} />);
        await screen.findByText('My tracker');

        // Only the upgradable card carries the pill.
        expect(screen.getAllByRole('button', { name: 'Update beschikbaar' })).toHaveLength(1);

        // Clicking the pill opens the Dutch confirm dialog — it must NOT open
        // the editor (the whole card is a click target) and nothing runs yet.
        fireEvent.click(screen.getByRole('button', { name: 'Update beschikbaar' }));
        expect(onOpen).not.toHaveBeenCalled();
        expect(studioAppsApi.templateUpgrade).not.toHaveBeenCalled();
        expect(await screen.findByText('De app wordt bijgewerkt naar de nieuwste templateversie. Je gegevens blijven staan.')).toBeInTheDocument();

        // Confirming calls the upgrade route and reloads the list.
        fireEvent.click(screen.getByRole('button', { name: 'Bijwerken' }));
        await waitFor(() => expect(studioAppsApi.templateUpgrade).toHaveBeenCalledWith('app-owned'));
        await waitFor(() => expect(toast.success).toHaveBeenCalled());
        // load() ran once on mount and once after the upgrade.
        expect(studioAppsApi.listMine).toHaveBeenCalledTimes(2);
    });

    it('renders no update pill on shared cards or when templateUpgrade is absent', async () => {
        render(<AppList onOpen={vi.fn()} />);
        await screen.findByText('My tracker');
        expect(screen.queryByRole('button', { name: 'Update beschikbaar' })).not.toBeInTheDocument();
    });

    it('renders the empty state with the AI note when there are no apps', async () => {
        studioAppsApi.listAccessible.mockResolvedValue({ apps: [] });
        studioAppsApi.listMine.mockResolvedValue({ apps: [] });
        render(<AppList onOpen={vi.fn()} />);

        expect(await screen.findByText('Build your first app')).toBeInTheDocument();
        expect(screen.getByText(/AI can build it for you/i)).toBeInTheDocument();
    });
});

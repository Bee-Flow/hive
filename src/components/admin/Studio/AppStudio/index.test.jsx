import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The editor shell is built by a separate module (heavy, own chunk); the
// section only relies on its { app, onClose, onAppUpdated } contract.
vi.mock('./editor/AppEditorShell', () => ({
    default: ({ app, onClose, onAppUpdated }) => (
        <div data-testid="editor-shell">
            <span>editing:{app?.name}</span>
            <button type="button" onClick={onClose}>close-editor</button>
            <button type="button" onClick={() => onAppUpdated({ ...app, name: 'Updated name' })}>
                rename-from-editor
            </button>
        </div>
    ),
}));

vi.mock('./studioAppsApi', () => {
    const studioAppsApi = {
        listAccessible: vi.fn(),
        listMine: vi.fn(),
        listTemplates: vi.fn(),
        createApp: vi.fn(),
        getApp: vi.fn(),
        updateApp: vi.fn(),
        deleteApp: vi.fn(),
    };
    return { studioAppsApi, default: studioAppsApi };
});

import AppStudioSection from './index';
import { studioAppsApi } from './studioAppsApi';

const APP_ROW = {
    id: 'app-1',
    userId: 'u1',
    name: 'My tracker',
    description: 'Owned by me',
    icon: 'Rocket',
    accentColor: '#0F766E',
    isPublished: false,
    updatedAt: '2026-07-01T10:00:00.000Z',
};

beforeEach(() => {
    vi.clearAllMocks();
    studioAppsApi.listAccessible.mockResolvedValue({ apps: [APP_ROW] });
    studioAppsApi.listMine.mockResolvedValue({ apps: [APP_ROW] });
    studioAppsApi.getApp.mockResolvedValue({
        app: { ...APP_ROW, definition: { schemaVersion: 1 } },
        readOnly: false,
    });
});

describe('AppStudioSection', () => {
    it('shows the list, then opens the editor on card click and reports editing', async () => {
        const onNavigate = vi.fn();
        const onEditingChange = vi.fn();
        render(
            <AppStudioSection onNavigate={onNavigate} onEditingChange={onEditingChange} />,
        );

        // Landing view: the gallery, not the editor.
        expect(await screen.findByText('My tracker')).toBeInTheDocument();
        expect(screen.queryByTestId('editor-shell')).not.toBeInTheDocument();
        expect(onEditingChange).toHaveBeenLastCalledWith(false);

        fireEvent.click(screen.getByText('My tracker'));

        expect(await screen.findByTestId('editor-shell')).toBeInTheDocument();
        expect(screen.getByText('editing:My tracker')).toBeInTheDocument();
        // Full row is refetched so the editor gets the definition too.
        expect(studioAppsApi.getApp).toHaveBeenCalledWith('app-1');
        expect(onEditingChange).toHaveBeenLastCalledWith(true);
        expect(onNavigate).toHaveBeenCalledWith('studio/apps/app-1');
    });

    it('auto-opens the editor for initialAppId (deep link)', async () => {
        const onEditingChange = vi.fn();
        render(
            <AppStudioSection initialAppId="app-1" onEditingChange={onEditingChange} />,
        );

        expect(await screen.findByTestId('editor-shell')).toBeInTheDocument();
        expect(studioAppsApi.getApp).toHaveBeenCalledWith('app-1');
        await waitFor(() => expect(onEditingChange).toHaveBeenLastCalledWith(true));
    });

    it('closing the editor returns to the list and reports editing=false', async () => {
        const onNavigate = vi.fn();
        const onEditingChange = vi.fn();
        render(
            <AppStudioSection
                initialAppId="app-1"
                onNavigate={onNavigate}
                onEditingChange={onEditingChange}
            />,
        );
        await screen.findByTestId('editor-shell');

        fireEvent.click(screen.getByRole('button', { name: 'close-editor' }));

        expect(await screen.findByText('My tracker')).toBeInTheDocument();
        expect(screen.queryByTestId('editor-shell')).not.toBeInTheDocument();
        expect(onNavigate).toHaveBeenLastCalledWith('studio/apps');
        await waitFor(() => expect(onEditingChange).toHaveBeenLastCalledWith(false));
    });

    it('keeps the open app row in sync when the editor reports onAppUpdated', async () => {
        render(<AppStudioSection initialAppId="app-1" />);
        await screen.findByTestId('editor-shell');

        fireEvent.click(screen.getByRole('button', { name: 'rename-from-editor' }));
        expect(await screen.findByText('editing:Updated name')).toBeInTheDocument();
    });

    it('surfaces a friendly error and stays on the list when the app cannot be opened', async () => {
        const err = new Error('App not found');
        err.status = 404;
        studioAppsApi.getApp.mockRejectedValue(err);
        const onEditingChange = vi.fn();
        render(<AppStudioSection initialAppId="nope" onEditingChange={onEditingChange} />);

        expect(await screen.findByText('My tracker')).toBeInTheDocument();
        expect(screen.queryByTestId('editor-shell')).not.toBeInTheDocument();
        expect(onEditingChange).not.toHaveBeenCalledWith(true);
    });
});

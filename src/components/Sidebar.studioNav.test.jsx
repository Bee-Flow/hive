import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// The Studio screen lost its tab bar: its sections open from a flyout panel
// beside the sidebar's Studio row (from the same studioApps.jsx registry,
// gates included), and published App Studio apps open from the Apps row the
// same way. This file covers that sidebar side; Studio.registry.test.jsx
// covers the shell side.

// Controllable licence gate shared with the hoisted vi.mock factories.
const { licenseMock } = vi.hoisted(() => ({ licenseMock: { hasFeature: () => true } }));

vi.mock('../hooks/useTranslation', () => {
    const useTranslation = () => ({ t: (key, fallback) => fallback || key, locale: 'en' });
    return { default: useTranslation, useTranslation };
});
vi.mock('./ThemeContext', () => ({ useTheme: () => ({}) }));
vi.mock('./LicenseContext', () => ({
    useLicenseContext: () => ({ hasFeature: (f) => licenseMock.hasFeature(f), deploymentMode: 'cloud' }),
}));
vi.mock('./EntitlementsContext', () => ({ useEntitlements: () => ({ can: () => true }) }));
vi.mock('../utils/helpers', () => ({
    API_BASE: '',
    authFetch: vi.fn(async () => ({ ok: false })),
}));
vi.mock('../utils/scopedStorage', () => ({
    default: { getItem: () => null, setItem: () => {} },
}));
vi.mock('./NotificationCenter', () => ({ default: () => null }));
vi.mock('./NavLink', () => ({ default: ({ children, ...p }) => <a {...p}>{children}</a> }));
vi.mock('./AppIcon', () => ({ default: ({ name }) => <span data-appicon={name} /> }));
vi.mock('../moduleRuntime/registry', () => ({ useRuntimeStudioApps: () => [] }));
vi.mock('./admin/Studio/AppStudio/studioAppsApi', () => ({
    studioAppsApi: {
        listAccessible: vi.fn(async () => ({
            apps: [
                { id: 'a1', name: 'Quote intake', description: 'Turn a PO into a quote', isPublished: true, icon: 'FileText', accentColor: '#0F766E' },
                { id: 'a3', name: 'Draft thing', isPublished: false },
            ],
        })),
        // /mine may 403 for pure consumers — the flyout must survive that.
        listMine: vi.fn(async () => ({ apps: [{ id: 'a2', name: 'Order lookup', is_published: true }] })),
    },
}));

import Sidebar from './Sidebar.jsx';

const renderSidebar = (props = {}) => render(
    <Sidebar
        isOpen
        toggleSidebar={() => {}}
        user={{ isAdmin: true, permissions: ['all'] }}
        hasPermission={() => true}
        onNavigate={vi.fn()}
        currentPage="agents"
        onDirectChat={() => {}}
        onOpenMarketplace={() => {}}
        onOpenSearch={() => {}}
        onLogout={() => {}}
        {...props}
    />
);

const openStudioFlyout = () => fireEvent.click(screen.getByTestId('nav-studio'));
const openAppsFlyout = () => fireEvent.click(screen.getByTestId('nav-apps'));

describe('Sidebar — Studio flyout (registry-driven)', () => {
    beforeEach(() => {
        cleanup();
        licenseMock.hasFeature = () => true;
    });

    it('renders every gate-passing Studio section in the flyout, with its short description', () => {
        renderSidebar();
        expect(screen.queryByTestId('flyout-studio')).toBeNull();
        openStudioFlyout();
        for (const id of ['agents', 'skills', 'knowledge', 'aiTasks', 'webpages', 'support', 'apps', 'meetingNotes']) {
            expect(screen.getByTestId(`nav-studio-${id}`)).toBeTruthy();
        }
        // Descriptions come from the registry's descKey/descFallback.
        expect(screen.getByText('Create and manage your agents')).toBeTruthy();
        expect(screen.getByText('Reusable abilities for your agents')).toBeTruthy();
    });

    it('hides licence-gated sections but keeps the always-on ones', () => {
        licenseMock.hasFeature = () => false;
        // No canUseFeature map and no beta grants → canUse() is false too.
        renderSidebar({ user: { isAdmin: true, permissions: [] }, hasPermission: () => false });
        openStudioFlyout();
        for (const id of ['agents', 'skills', 'knowledge']) {
            expect(screen.getByTestId(`nav-studio-${id}`)).toBeTruthy();
        }
        for (const id of ['aiTasks', 'webpages', 'support', 'apps', 'meetingNotes']) {
            expect(screen.queryByTestId(`nav-studio-${id}`)).toBeNull();
        }
    });

    it('navigates to studio/<urlSegment> and closes the panel when a section is picked', () => {
        const onNavigate = vi.fn();
        renderSidebar({ onNavigate });
        openStudioFlyout();
        fireEvent.click(screen.getByTestId('nav-studio-skills'));
        expect(onNavigate).toHaveBeenLastCalledWith('studio/skills');
        expect(screen.queryByTestId('flyout-studio')).toBeNull();
        openStudioFlyout();
        fireEvent.click(screen.getByTestId('nav-studio-aiTasks'));
        expect(onNavigate).toHaveBeenLastCalledWith('studio/automations');
        openStudioFlyout();
        fireEvent.click(screen.getByTestId('nav-studio-meetingNotes'));
        expect(onNavigate).toHaveBeenLastCalledWith('studio/meeting-notes');
    });

    it('toggles via the row, opens on hover, closes on Escape, keeps the tour anchor', () => {
        const { container } = renderSidebar();
        const row = container.querySelector('[data-tour="nav-studio"]');
        expect(row).toBeTruthy();
        // Click toggles.
        fireEvent.click(row);
        expect(screen.getByTestId('flyout-studio')).toBeTruthy();
        fireEvent.click(row);
        expect(screen.queryByTestId('flyout-studio')).toBeNull();
        // Hovering the wrapper opens too (React derives onMouseEnter from
        // native mouseover, which is what fireEvent.mouseOver dispatches).
        fireEvent.mouseOver(row.parentElement);
        expect(screen.getByTestId('flyout-studio')).toBeTruthy();
        // Escape dismisses.
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByTestId('flyout-studio')).toBeNull();
    });

    it('marks the active section from studioRoute', () => {
        renderSidebar({ currentPage: 'studio', studioRoute: { section: 'skills', id: null } });
        openStudioFlyout();
        expect(screen.getByTestId('nav-studio-skills').getAttribute('aria-current')).toBe('page');
        expect(screen.getByTestId('nav-studio-agents').getAttribute('aria-current')).toBeNull();
    });
});

describe('Sidebar — Apps flyout (published apps)', () => {
    beforeEach(() => {
        cleanup();
        licenseMock.hasFeature = () => true;
    });

    it('lists published apps (accessible ∪ own, drafts excluded) under All apps', async () => {
        renderSidebar();
        openAppsFlyout();
        expect(await screen.findByTestId('nav-app-a1')).toBeTruthy();
        expect(screen.getByTestId('nav-app-a2')).toBeTruthy();
        expect(screen.queryByTestId('nav-app-a3')).toBeNull();
        expect(screen.getByTestId('nav-apps-all')).toBeTruthy();
        // The app's own description renders under its name.
        expect(screen.getByText('Turn a PO into a quote')).toBeTruthy();
    });

    it('navigates to the directory and to a single app', async () => {
        const onNavigate = vi.fn();
        renderSidebar({ onNavigate });
        openAppsFlyout();
        await screen.findByTestId('nav-app-a1');
        fireEvent.click(screen.getByTestId('nav-apps-all'));
        expect(onNavigate).toHaveBeenLastCalledWith('apps');
        openAppsFlyout();
        fireEvent.click(await screen.findByTestId('nav-app-a1'));
        expect(onNavigate).toHaveBeenLastCalledWith('apps/a1');
    });
});

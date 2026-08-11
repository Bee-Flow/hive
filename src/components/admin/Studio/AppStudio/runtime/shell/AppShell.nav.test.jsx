import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import AppShell from '../AppShell';

/**
 * A2 shell system — dispatcher + both layouts. Backward compat is the
 * headline assertion: a definition WITHOUT a nav key renders the tabs shell
 * (top bar, 'App screens' nav, no sidebar) exactly like before.
 */

const scr = (id, name, extra = {}) => ({ id, name, icon: null, showInNav: true, sections: [], ...extra });

const DEF = {
    schemaVersion: 2,
    meta: { name: 'Nav probe', description: '', icon: 'LayoutGrid' },
    theme: { primary: '#0F766E', radius: 'md', density: 'comfortable', fontScale: 'md', appearance: 'auto' },
    homeScreenId: 'scr_home01',
    screens: [
        scr('scr_home01', 'Home', { icon: 'House' }),
        scr('scr_req001', 'Requests'),
        scr('scr_set001', 'Settings'),
        scr('scr_hide01', 'Secret', { showInNav: false }),
    ],
};

const SIDEBAR_DEF = {
    ...DEF,
    nav: {
        style: 'sidebar',
        groups: [{ id: 'nvg_admin1', label: 'Admin', icon: null, screens: ['scr_set001'] }],
    },
};

const VIEWER = { id: 'u1', name: 'Vera Viewer', email: 'vera@example.test', isOwner: false, roleKey: 'member' };

function renderShell(props) {
    return render(
        <AppShell definition={DEF} screenId="scr_home01" onNavigate={() => {}} {...props}>
            <div>content</div>
        </AppShell>,
    );
}

beforeEach(() => {
    window.localStorage.clear();
});

describe('AppShell — tabs (default, backward compat)', () => {
    it('renders the top-bar tabs shell when the definition has no nav key', () => {
        const { container } = renderShell();
        const nav = screen.getByRole('navigation', { name: 'App screens' });
        expect(within(nav).getByRole('button', { name: 'Home' })).toBeInTheDocument();
        expect(within(nav).getByRole('button', { name: 'Requests' })).toBeInTheDocument();
        // nav-hidden screens stay out; no sidebar anywhere.
        expect(within(nav).queryByRole('button', { name: 'Secret' })).toBeNull();
        expect(container.querySelector('.app-nav-sidebar')).toBeNull();
        // Brand + content.
        expect(screen.getByText('Nav probe')).toBeInTheDocument();
        expect(screen.getByText('content')).toBeInTheDocument();
    });

    it('hides the nav entirely with a single nav screen', () => {
        const oneScreen = { ...DEF, screens: [scr('scr_only01', 'Only')] };
        render(
            <AppShell definition={oneScreen} screenId="scr_only01" onNavigate={() => {}}>
                <div>content</div>
            </AppShell>,
        );
        expect(screen.queryByRole('navigation', { name: 'App screens' })).toBeNull();
    });

    it('marks the active tab with aria-current and the primary underline', () => {
        renderShell({ screenId: 'scr_req001' });
        const nav = screen.getByRole('navigation', { name: 'App screens' });
        const active = within(nav).getByRole('button', { name: 'Requests' });
        expect(active).toHaveAttribute('aria-current', 'page');
        expect(active.style.boxShadow).toContain('inset 0 -2px 0');
    });

    it('flattens groups in tabs mode: ungrouped first, then grouped', () => {
        const tabsGrouped = { ...SIDEBAR_DEF, nav: { ...SIDEBAR_DEF.nav, style: 'tabs' } };
        render(
            <AppShell definition={tabsGrouped} screenId="scr_home01" onNavigate={() => {}}>
                <div>content</div>
            </AppShell>,
        );
        const nav = screen.getByRole('navigation', { name: 'App screens' });
        const labels = within(nav).getAllByRole('button').map((b) => b.textContent);
        expect(labels).toEqual(['Home', 'Requests', 'Settings']);
        // No group section labels in tabs mode.
        expect(screen.queryByText('Admin')).toBeNull();
    });
});

describe('AppShell — tab overflow', () => {
    const originalClient = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth');
    const originalOffset = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');

    afterEach(() => {
        if (originalClient) Object.defineProperty(Element.prototype, 'clientWidth', originalClient);
        if (originalOffset) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffset);
    });

    it('collapses tabs that do not fit into a "Meer" menu that navigates', () => {
        // 3 tabs x 100px in a 250px row with a 100px "Meer" button → 1 visible.
        Object.defineProperty(Element.prototype, 'clientWidth', {
            configurable: true,
            get() { return this.tagName === 'NAV' ? 250 : 0; },
        });
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
            configurable: true,
            get() { return 100; },
        });

        const picked = [];
        render(
            <AppShell definition={DEF} screenId="scr_home01" onNavigate={(id) => picked.push(id)}>
                <div>content</div>
            </AppShell>,
        );
        const nav = screen.getByRole('navigation', { name: 'App screens' });
        expect(within(nav).getByRole('button', { name: 'Home' })).toBeInTheDocument();
        expect(within(nav).queryByRole('button', { name: 'Settings' })).toBeNull();

        const more = within(nav).getByRole('button', { name: /Meer/ });
        fireEvent.click(more);
        const menu = within(nav).getByRole('menu');
        fireEvent.click(within(menu).getByRole('menuitem', { name: 'Settings' }));
        expect(picked).toEqual(['scr_set001']);
        // Picking closes the menu.
        expect(within(nav).queryByRole('menu')).toBeNull();
    });
});

describe('AppShell — sidebar', () => {
    function renderSidebar(props = {}) {
        return render(
            <AppShell definition={SIDEBAR_DEF} screenId="scr_set001" onNavigate={() => {}} {...props}>
                <div>content</div>
            </AppShell>,
        );
    }

    it('renders the sidebar with ungrouped items, group sections and the active rail', () => {
        const { container } = renderSidebar();
        const sidebar = container.querySelector('.app-nav-sidebar');
        expect(sidebar).not.toBeNull();
        // Group section label + member item.
        expect(within(sidebar).getByText('Admin')).toBeInTheDocument();
        const active = sidebar.querySelector('.app-nav-item[data-active]');
        expect(active).not.toBeNull();
        expect(active.textContent).toContain('Settings');
        expect(active).toHaveAttribute('aria-current', 'page');
        // The desktop main column has no top-bar tabs in sidebar mode.
        expect(screen.queryByRole('navigation', { name: 'App screens' })).not.toBeNull(); // the sidebar nav itself
        expect(container.querySelector('header')).toBeNull();
    });

    it('collapse toggle flips the rail and persists per app in localStorage', () => {
        const { container, unmount } = renderSidebar({ appId: 'app-42' });
        const sidebar = () => container.querySelector('.app-nav-sidebar');
        expect(sidebar().hasAttribute('data-collapsed')).toBe(false);

        fireEvent.click(screen.getByRole('button', { name: 'Collapse navigation' }));
        expect(sidebar().hasAttribute('data-collapsed')).toBe(true);
        expect(window.localStorage.getItem('appStudio.nav.collapsed.app-42')).toBe('1');

        // A fresh mount reads the persisted state back.
        unmount();
        const { container: again } = renderSidebar({ appId: 'app-42' });
        expect(again.querySelector('.app-nav-sidebar').hasAttribute('data-collapsed')).toBe(true);
        fireEvent.click(screen.getByRole('button', { name: 'Expand navigation' }));
        expect(window.localStorage.getItem('appStudio.nav.collapsed.app-42')).toBeNull();
    });

    it('does not persist collapse without an appId', () => {
        renderSidebar();
        fireEvent.click(screen.getByRole('button', { name: 'Collapse navigation' }));
        expect(window.localStorage.length).toBe(0);
    });

    it('moves focus with ArrowDown/ArrowUp (roving tabindex)', () => {
        const { container } = renderSidebar({ screenId: 'scr_home01' });
        const sidebar = container.querySelector('.app-nav-sidebar');
        const home = within(sidebar).getByRole('button', { name: 'Home' });
        const requests = within(sidebar).getByRole('button', { name: 'Requests' });
        expect(home).toHaveAttribute('tabindex', '0');
        expect(requests).toHaveAttribute('tabindex', '-1');

        home.focus();
        fireEvent.keyDown(within(sidebar).getByRole('navigation'), { key: 'ArrowDown' });
        expect(document.activeElement).toBe(requests);
        expect(requests).toHaveAttribute('tabindex', '0');
    });
});

describe('AppShell — user menu', () => {
    it('renders viewer name and opens the account popup with email + role badge', () => {
        renderShell({ viewer: VIEWER });
        fireEvent.click(screen.getByRole('button', { name: /Account: Vera Viewer/ }));
        const menu = screen.getByRole('menu');
        expect(within(menu).getByText('vera@example.test')).toBeInTheDocument();
        expect(within(menu).getByText('member')).toBeInTheDocument();
        // No onExit wired → no "Alle apps" link.
        expect(within(menu).queryByRole('menuitem', { name: 'Alle apps' })).toBeNull();
    });

    it('shows the owner badge and the "Alle apps" exit when wired', () => {
        const exits = [];
        renderShell({ viewer: { ...VIEWER, isOwner: true }, onExit: () => exits.push(1) });
        fireEvent.click(screen.getByRole('button', { name: /Account: Vera Viewer/ }));
        expect(screen.getByText('Eigenaar')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Alle apps' }));
        expect(exits).toEqual([1]);
        expect(screen.queryByRole('menu')).toBeNull();
    });

    it('renders nothing without a viewer', () => {
        const { container } = renderShell();
        expect(container.querySelector('[data-app-user-menu]')).toBeNull();
    });
});

describe('AppShell — mobile drawer', () => {
    it('opens from the trigger and navigates on pick (tabs mode)', () => {
        const picked = [];
        const { container } = renderShell({ onNavigate: (id) => picked.push(id) });
        const trigger = container.querySelector('button[aria-haspopup="dialog"]');
        expect(trigger).not.toBeNull();
        expect(trigger.textContent).toContain('Home'); // current screen name

        fireEvent.click(trigger);
        const drawer = screen.getByRole('dialog', { name: 'App screens' });
        fireEvent.click(within(drawer).getByRole('button', { name: 'Requests' }));
        expect(picked).toEqual(['scr_req001']);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('still shows an active nav-hidden screen as current', () => {
        const { container } = renderShell({ screenId: 'scr_hide01' });
        const trigger = container.querySelector('button[aria-haspopup="dialog"]');
        expect(trigger.textContent).toContain('Secret');

        fireEvent.click(trigger);
        const drawer = screen.getByRole('dialog', { name: 'App screens' });
        const row = within(drawer).getByRole('button', { name: 'Secret' });
        expect(row).toHaveAttribute('aria-current', 'page');
    });

    it('renders the brand bar with the drawer trigger in sidebar mode', () => {
        const { container } = render(
            <AppShell definition={SIDEBAR_DEF} screenId="scr_home01" onNavigate={() => {}}>
                <div>content</div>
            </AppShell>,
        );
        // Two brand lockups: sidebar head (desktop) + mobile bar.
        expect(container.querySelectorAll('[data-app-brand]').length).toBe(2);
        const trigger = container.querySelector('button[aria-haspopup="dialog"]');
        expect(trigger).not.toBeNull();
        fireEvent.click(trigger);
        // Grouped section label shows inside the drawer too.
        const drawer = screen.getByRole('dialog', { name: 'App screens' });
        expect(within(drawer).getByText('Admin')).toBeInTheDocument();
    });
});

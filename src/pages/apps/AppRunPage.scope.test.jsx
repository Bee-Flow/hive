import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * AppRunPage — the published run view's FORMULA SCOPE (GA gate, Wave 1a).
 *
 * The run view must feed AppRenderer a live scope, not empty stubs:
 *   (a) currentUser.* resolves from the runtime payload's viewer block
 *   (b) visibleWhen "form.email != ''" reacts to typing inside a form
 *   (c) a set_variable sequence makes vars.* visible to a computed prop
 *   (d) navigate-with-params exposes screen.params on the target screen
 *
 * getRuntime is mocked to return a viewer block; everything below it (the
 * renderer, form context, action runner, expression engine) runs for real.
 */

vi.mock('../../components/admin/Studio/AppStudio/studioAppsApi', () => {
    const studioAppsApi = { getRuntime: vi.fn() };
    return { studioAppsApi, default: studioAppsApi };
});

// Only the network call is stubbed (for the dynamic-filter fetch assertion);
// API_BASE etc. stay real. The scope-probe definition has no data bindings,
// so tests (a)–(d) never touch it.
vi.mock('@/utils/helpers', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, authFetch: vi.fn() };
});

import { authFetch } from '@/utils/helpers';
import AppRunPage from './AppRunPage';
import { studioAppsApi } from '../../components/admin/Studio/AppStudio/studioAppsApi';

const VIEWER = {
    id: 'u-viewer',
    name: 'Vera Viewer',
    email: 'vera@example.test',
    isOwner: false,
    roleKey: 'member',
};

const DEFINITION = {
    schemaVersion: 2,
    meta: { name: 'Scope probe', description: '', icon: 'LayoutGrid' },
    theme: { primary: '#0F766E', radius: 'md', density: 'comfortable', fontScale: 'md', appearance: 'auto' },
    homeScreenId: 'scr_main01',
    screens: [
        {
            id: 'scr_main01', name: 'Main', icon: null, showInNav: true, maxWidth: 'medium',
            sections: [{
                id: 'sec_main01', style: { padding: 4, gap: 3, background: 'none' },
                children: [
                    // (a) currentUser formula
                    { id: 'cmp_who001', type: 'heading', visible: true, props: { text: 'anonymous', level: 2 }, computed: { text: 'currentUser.name' }, style: { span: 12 } },
                    // (b) form + gated text
                    {
                        id: 'cmp_form01', type: 'form', visible: true, props: { name: 'contact', submitLabel: 'Send' }, style: { span: 12 },
                        children: [
                            { id: 'cmp_email1', type: 'input_text', visible: true, props: { name: 'email', label: 'Email', defaultValue: '', inputType: 'email' }, style: { span: 12 } },
                            { id: 'cmp_gate01', type: 'text', visible: true, visibleWhen: "form.email != ''", props: { text: 'Email captured', muted: false }, style: { span: 12 } },
                        ],
                    },
                    // (c) set_variable → vars.x on a computed prop
                    { id: 'cmp_setbtn', type: 'button', visible: true, onClick: 'act_set001', props: { label: 'Set var', variant: 'primary', role: 'button' }, style: { span: 3 } },
                    { id: 'cmp_varout', type: 'text', visible: true, props: { text: '', muted: false }, computed: { text: 'vars.x' }, style: { span: 12 } },
                    // (d) navigate with params
                    { id: 'cmp_gobtn1', type: 'button', visible: true, onClick: 'act_go0001', props: { label: 'Open record', variant: 'secondary', role: 'button' }, style: { span: 3 } },
                ],
            }],
        },
        {
            id: 'scr_detail1', name: 'Detail', icon: null, showInNav: false, maxWidth: 'medium',
            sections: [{
                id: 'sec_det001', style: { padding: 4, gap: 3, background: 'none' },
                children: [
                    { id: 'cmp_recid1', type: 'text', visible: true, props: { text: 'no-record', muted: false }, computed: { text: 'screen.params.recordId' }, style: { span: 12 } },
                ],
            }],
        },
    ],
    actions: {
        act_set001: { kind: 'sequence', steps: [{ kind: 'set_variable', name: 'x', value: { kind: 'static', value: 'Zap-visible' } }] },
        act_go0001: { kind: 'navigate', screenId: 'scr_detail1', params: { recordId: { kind: 'static', value: 'rec_42' } } },
    },
};

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    return render(
        <QueryClientProvider client={client}>
            <AppRunPage appId="app-1" />
        </QueryClientProvider>,
    );
}

describe('AppRunPage — run-view formula scope (GA gate)', () => {
    beforeEach(() => {
        studioAppsApi.getRuntime.mockReset();
        studioAppsApi.getRuntime.mockResolvedValue({
            id: 'app-1',
            name: 'Scope probe',
            icon: 'LayoutGrid',
            accentColor: null,
            definition: DEFINITION,
            viewer: VIEWER,
        });
        authFetch.mockReset();
        authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ records: [] }) });
    });

    it('(a) a currentUser.name formula renders for the logged-in viewer', async () => {
        // A2: the shell's user menu also shows the viewer's name, so pin the
        // formula output via its heading role.
        const { findByRole, queryByText } = renderPage();
        expect(await findByRole('heading', { name: 'Vera Viewer' })).toBeTruthy();
        expect(queryByText('anonymous')).toBeNull();
    });

    it('(b) visibleWhen "form.email != \'\'" toggles as the input is typed', async () => {
        const { findByLabelText, getByLabelText, queryByText, findByText } = renderPage();
        await findByLabelText('Email');

        // Empty default → once the form publishes its seeded values, the gated
        // text is hidden in run mode.
        await waitFor(() => expect(queryByText('Email captured')).toBeNull());

        fireEvent.change(getByLabelText('Email'), { target: { value: 'vera@example.test' } });
        expect(await findByText('Email captured')).toBeTruthy();

        // Clearing the field hides it again.
        fireEvent.change(getByLabelText('Email'), { target: { value: '' } });
        await waitFor(() => expect(queryByText('Email captured')).toBeNull());
    });

    it('(c) a set_variable sequence makes vars.x visible to a computed prop', async () => {
        const { findByText, queryByText } = renderPage();
        const button = await findByText('Set var');

        expect(queryByText('Zap-visible')).toBeNull();
        fireEvent.click(button);
        expect(await findByText('Zap-visible')).toBeTruthy();
    });

    it('(d) navigate-with-params exposes screen.params.recordId on the target screen', async () => {
        const { findByText, queryByText } = renderPage();
        const button = await findByText('Open record');

        fireEvent.click(button);
        expect(await findByText('rec_42')).toBeTruthy();
        // The computed formula replaced the static fallback.
        expect(queryByText('no-record')).toBeNull();
    });

    it('(e) a dynamic binding filter resolves against the live viewer scope before the fetch', async () => {
        // Wave 2B2: a records binding filtered by currentUser.id — the outgoing
        // request must carry the viewer's id as a LITERAL, never the formula.
        const def = structuredClone(DEFINITION);
        def.screens[0].sections[0].children.push({
            id: 'cmp_grid01',
            type: 'data_grid',
            visible: true,
            style: { span: 12 },
            props: {
                source: {
                    kind: 'records',
                    tableId: 'tbl_tick1',
                    filter: [
                        { field: 'owner_id', op: 'eq', value: { kind: 'formula', expr: 'currentUser.id' } },
                    ],
                },
            },
        });
        studioAppsApi.getRuntime.mockResolvedValue({
            id: 'app-1', name: 'Scope probe', icon: null, accentColor: null,
            definition: def, viewer: VIEWER,
        });

        const { findByRole } = renderPage();
        await findByRole('heading', { name: 'Vera Viewer' });

        await waitFor(() => {
            const call = authFetch.mock.calls.find(([u]) => String(u).includes('/data/tables/tbl_tick1/records'));
            expect(call).toBeTruthy();
            const url = decodeURIComponent(String(call[0]));
            expect(url).toContain('"value":"u-viewer"');
            expect(url).not.toContain('formula');
        });
    });

    it('fails closed: a viewer the server gave no role still cannot see role-gated content', async () => {
        const gated = structuredClone(DEFINITION);
        gated.screens[0].sections[0].children.push({
            id: 'cmp_admin1', type: 'text', visible: true, visibleToRoles: ['admin'],
            props: { text: 'Admins only', muted: false }, style: { span: 12 },
        });
        studioAppsApi.getRuntime.mockResolvedValue({
            id: 'app-1', name: 'Scope probe', icon: null, accentColor: null,
            definition: gated, viewer: { ...VIEWER, roleKey: null },
        });
        const { findByRole, queryByText } = renderPage();
        await findByRole('heading', { name: 'Vera Viewer' }); // ungated content still renders
        expect(queryByText('Admins only')).toBeNull();
    });

    it('passes previewRole from the viewer block (role-gated node hidden for a member)', async () => {
        const gated = structuredClone(DEFINITION);
        gated.screens[0].sections[0].children.push({
            id: 'cmp_admin1', type: 'text', visible: true, visibleToRoles: ['admin'],
            props: { text: 'Admins only', muted: false }, style: { span: 12 },
        });
        studioAppsApi.getRuntime.mockResolvedValue({
            id: 'app-1', name: 'Scope probe', icon: null, accentColor: null,
            definition: gated, viewer: VIEWER,
        });
        const { findByRole, queryByText } = renderPage();
        await findByRole('heading', { name: 'Vera Viewer' });
        expect(queryByText('Admins only')).toBeNull();
    });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the api + directory + toast before importing the component (vi.mock is
// hoisted). PublishModal builds the PATCH payload and calls studioAppsApi.publish;
// these tests assert the EXACT payload per audience mode.
vi.mock('../studioAppsApi', () => {
    const studioAppsApi = { publish: vi.fn() };
    return { default: studioAppsApi, studioAppsApi };
});
vi.mock('../rbac/useAppRoles', () => ({ default: vi.fn(), useOrgDirectory: vi.fn() }));
vi.mock('../../../../shared/Toast', () => {
    const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    return { default: toast, toast };
});

import PublishModal from './PublishModal';
import toast from '../../../../shared/Toast';
import useAppRoles, { useOrgDirectory } from '../rbac/useAppRoles';
import { studioAppsApi } from '../studioAppsApi';

const DIRECTORY = {
    groups: [{ id: 'g1', name: 'Sales' }, { id: 'g2', name: 'Engineering' }],
    users: [],
    isLoading: false,
    available: true,
};

// Two tables on the shipped defaults — access.default 'app', roleMapping.default
// 'app' — i.e. exactly what an owner who never opened Roles & access publishes.
const TABLES = [
    { id: 'tbl_1', key: 'absences', name: 'Absences', fields: [], access: { default: 'app', roles: {}, rowFilters: {} } },
    { id: 'tbl_2', key: 'employees', name: 'Employees', fields: [], access: { default: 'app', roles: {}, rowFilters: {} } },
];

function access({ tables = TABLES, roleMapping = { default: 'app', byGroup: {} }, connectors = [], ...rest } = {}) {
    const model = { modelVersion: 1, roles: [], roleMapping, tables, connectors };
    return { model, tables, roles: [], roleMapping, members: [], isLoading: false, isError: false, hasModel: true, ...rest };
}

/** The consequence panel's sentences, whitespace-collapsed and joined. */
function impactText() {
    return [...screen.getByTestId('publish-data-impact').querySelectorAll('p')]
        .map((p) => p.textContent.replace(/\s+/g, ' ').trim())
        .join(' ');
}

const privateApp = { id: 'app-1', name: 'Tracker', isPublished: false, sharedGroups: [] };
const orgApp = { id: 'app-1', name: 'Tracker', isPublished: true, sharedGroups: [], publishedAt: '2026-07-01T10:00:00Z' };

// A two-screen definition so path resolution has something real to walk.
const DEFINITION = {
    screens: [
        {
            id: 'scr_home',
            name: 'Overview',
            sections: [
                { id: 'sec_a', children: [{ id: 'cmp_btn' }] },
                { id: 'sec_b', children: [{ id: 'cmp_grid', children: [{ id: 'cmp_inner' }] }] },
            ],
        },
        { id: 'scr_two', name: 'Requests', sections: [{ id: 'sec_c', children: [] }] },
    ],
};

/** The 422 studioAppsApi.publish throws for a draft the server refuses. */
function rejection({ errors = [], warnings = [] } = {}) {
    const err = new Error('Fix the app\'s validation errors before publishing');
    err.status = 422;
    err.body = { error: err.message, errors, warnings };
    return err;
}

const ERR_BUTTON = {
    code: 'action.automation_missing',
    severity: 'error',
    path: 'screens[0].sections[1].children[0].children[0].props.onClick',
    message: 'Button "Go" references a routine the owner does not have.',
    hint: 'Pick a routine the app owner owns.',
};
const ERR_NO_PATH = {
    code: 'screens.missing',
    severity: 'error',
    path: 'screens',
    message: 'An app needs at least one page.',
    hint: 'Add a page before publishing.',
};

beforeEach(() => {
    vi.clearAllMocks();
    useOrgDirectory.mockReturnValue(DIRECTORY);
    useAppRoles.mockReturnValue(access());
    studioAppsApi.publish.mockResolvedValue({ success: true, isPublished: true, sharedGroups: [] });
});

describe('PublishModal', () => {
    it('Private → PATCH { isPublished: false }', async () => {
        studioAppsApi.publish.mockResolvedValue({ success: true, isPublished: false, sharedGroups: [] });
        const onPublished = vi.fn();
        render(<PublishModal open app={orgApp} onClose={vi.fn()} onPublished={onPublished} />);

        fireEvent.click(screen.getByRole('radio', { name: /Private/i }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

        await waitFor(() => expect(studioAppsApi.publish).toHaveBeenCalledTimes(1));
        expect(studioAppsApi.publish).toHaveBeenCalledWith('app-1', { isPublished: false });
        await waitFor(() => expect(onPublished).toHaveBeenCalled());
        expect(onPublished.mock.calls[0][0]).toMatchObject({ id: 'app-1', isPublished: false });
    });

    it('Entire organization → PATCH { isPublished: true, sharedGroups: [] }', async () => {
        render(<PublishModal open app={privateApp} onClose={vi.fn()} onPublished={vi.fn()} />);

        fireEvent.click(screen.getByRole('radio', { name: /Entire organization/i }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

        await waitFor(() => expect(studioAppsApi.publish).toHaveBeenCalledTimes(1));
        expect(studioAppsApi.publish).toHaveBeenCalledWith('app-1', { isPublished: true, sharedGroups: [] });
    });

    it('Specific groups → PATCH { isPublished: true, sharedGroups: [ids] }', async () => {
        studioAppsApi.publish.mockResolvedValue({ success: true, isPublished: true, sharedGroups: ['g1'] });
        render(<PublishModal open app={privateApp} onClose={vi.fn()} onPublished={vi.fn()} />);

        fireEvent.click(screen.getByRole('radio', { name: /Specific groups/i }));
        // Pick one group.
        fireEvent.click(screen.getByRole('checkbox', { name: 'Sales' }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

        await waitFor(() => expect(studioAppsApi.publish).toHaveBeenCalledTimes(1));
        expect(studioAppsApi.publish).toHaveBeenCalledWith('app-1', { isPublished: true, sharedGroups: ['g1'] });
    });

    it('disables Apply for "Specific groups" until at least one group is picked', () => {
        render(<PublishModal open app={privateApp} onClose={vi.fn()} onPublished={vi.fn()} />);

        fireEvent.click(screen.getByRole('radio', { name: /Specific groups/i }));
        expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();

        fireEvent.click(screen.getByRole('checkbox', { name: 'Engineering' }));
        expect(screen.getByRole('button', { name: 'Apply' })).not.toBeDisabled();
    });

    it('shows the current audience and a live link when already published', () => {
        render(<PublishModal open app={orgApp} onClose={vi.fn()} onPublished={vi.fn()} />);
        expect(screen.getByText('Everyone in your organization')).toBeInTheDocument();
        const link = screen.getByRole('link', { name: /View live/i });
        expect(link).toHaveAttribute('href', '/app/apps/app-1');
    });

    it('reports the version that went live back through onPublished', async () => {
        studioAppsApi.publish.mockResolvedValue({ success: true, isPublished: true, sharedGroups: [], publishedVersion: 7 });
        const onPublished = vi.fn();
        render(<PublishModal open app={privateApp} onClose={vi.fn()} onPublished={onPublished} />);

        fireEvent.click(screen.getByRole('radio', { name: /Entire organization/i }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

        await waitFor(() => expect(onPublished).toHaveBeenCalled());
        expect(onPublished.mock.calls[0][0]).toMatchObject({ publishedVersion: 7 });
    });
});

describe('PublishModal — what the audience gets, not just what it can open', () => {
    it('names the tables an org-wide publish opens to everyone', () => {
        render(<PublishModal open app={privateApp} onClose={vi.fn()} onPublished={vi.fn()} />);
        fireEvent.click(screen.getByRole('radio', { name: /Entire organization/i }));

        expect(impactText()).toBe(
            'Everyone in your organisation will be able to see, add, edit and delete every row in Absences and Employees.',
        );
    });

    it('narrows the sentence when the tables are held back, and lists what stays shut', () => {
        useAppRoles.mockReturnValue(access({
            tables: [
                { ...TABLES[0], access: { default: 'owner', roles: {}, rowFilters: {} } },
                { ...TABLES[1], access: { default: 'none', roles: {}, rowFilters: {} } },
            ],
        }));
        render(<PublishModal open app={privateApp} onClose={vi.fn()} onPublished={vi.fn()} />);
        fireEvent.click(screen.getByRole('radio', { name: /Entire organization/i }));

        expect(impactText()).toBe(
            'Everyone in your organisation will be able to add rows, and see, edit and delete only the rows '
            + 'they added themselves in Absences. They will not be able to open Employees.',
        );
    });

    it('says a row rule narrows it, and never claims the rule holds back adding', () => {
        useAppRoles.mockReturnValue(access({
            tables: [{ ...TABLES[0], access: { default: 'app', roles: {}, rowFilters: { app: 'record.created_by == viewer.id' } } }],
        }));
        render(<PublishModal open app={privateApp} onClose={vi.fn()} onPublished={vi.fn()} />);
        fireEvent.click(screen.getByRole('radio', { name: /Entire organization/i }));

        expect(impactText()).toBe(
            'Everyone in your organisation will be able to add rows, and see, edit and delete only the rows '
            + 'your row rule allows in Absences.',
        );
    });

    it('gives the groups that were mapped to another role their own sentence', () => {
        useAppRoles.mockReturnValue(access({
            tables: [{ ...TABLES[0], access: { default: 'app', roles: { manager: { read: 'all', create: false, update: 'none', delete: 'none' } }, rowFilters: {} } }],
            roleMapping: { default: 'app', byGroup: { g1: 'manager' } },
        }));
        render(<PublishModal open app={privateApp} onClose={vi.fn()} onPublished={vi.fn()} />);
        fireEvent.click(screen.getByRole('radio', { name: /Entire organization/i }));

        expect(impactText()).toBe(
            'Everyone in your organisation except Sales will be able to see, add, edit and delete every row in Absences. '
            + 'People in Sales will be able to see every row in Absences.',
        );
    });

    it('describes only the groups that were picked', () => {
        render(<PublishModal open app={privateApp} onClose={vi.fn()} onPublished={vi.fn()} />);
        fireEvent.click(screen.getByRole('radio', { name: /Specific groups/i }));
        expect(impactText()).toBe('Pick the groups above to see what they will be able to reach.');

        fireEvent.click(screen.getByRole('checkbox', { name: 'Sales' }));
        expect(impactText()).toBe(
            'Everyone in Sales will be able to see, add, edit and delete every row in Absences and Employees.',
        );
    });

    it('warns that a group outside the picked ones still hands out its own access', () => {
        useAppRoles.mockReturnValue(access({
            tables: [{ ...TABLES[0], access: { default: 'owner', roles: { manager: { read: 'all', create: true, update: 'all', delete: 'all' } }, rowFilters: {} } }],
            roleMapping: { default: 'app', byGroup: { g2: 'manager' } },
        }));
        render(<PublishModal open app={privateApp} onClose={vi.fn()} onPublished={vi.fn()} />);
        fireEvent.click(screen.getByRole('radio', { name: /Specific groups/i }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Sales' }));

        expect(impactText()).toBe(
            'Everyone in Sales will be able to add rows, and see, edit and delete only the rows they added themselves in Absences. '
            + 'Anyone you share with who is also in Engineering may be able to see, add, edit and delete every row in Absences.',
        );
    });

    it('does not promise access to tables the app never gave an access rule', () => {
        useAppRoles.mockReturnValue(access({
            tables: [{ id: 'tbl_1', key: 'absences', name: 'Absences', fields: [] }],
        }));
        render(<PublishModal open app={privateApp} onClose={vi.fn()} onPublished={vi.fn()} />);
        fireEvent.click(screen.getByRole('radio', { name: /Entire organization/i }));

        expect(impactText()).toBe('Everyone in your organisation will not be able to reach any information in this app.');
    });

    it('adds the outside sources readers reach as the owner, whatever their role', () => {
        useAppRoles.mockReturnValue(access({
            tables: [{ ...TABLES[0], access: { default: 'none', roles: {}, rowFilters: {} } }],
            connectors: [
                { id: 'conn_1', kind: 'integration_tool', name: 'Recent emails' },
                { id: 'conn_2', kind: 'integration_tool', name: 'My calendar', runAs: 'viewer' },
            ],
        }));
        render(<PublishModal open app={privateApp} onClose={vi.fn()} onPublished={vi.fn()} />);
        fireEvent.click(screen.getByRole('radio', { name: /Entire organization/i }));

        expect(impactText()).toBe(
            'Everyone in your organisation will not be able to reach any information in this app. '
            + 'Anyone who can open the app can also fetch live data as you through Recent emails, '
            + 'whichever role they land on.',
        );
    });

    it('does not call an app with no tables harmless when it fetches outside data', () => {
        useAppRoles.mockReturnValue(access({
            tables: [],
            connectors: [{ id: 'conn_1', kind: 'rest', name: 'Price list' }],
        }));
        render(<PublishModal open app={privateApp} onClose={vi.fn()} onPublished={vi.fn()} />);
        fireEvent.click(screen.getByRole('radio', { name: /Entire organization/i }));

        expect(impactText()).toBe(
            'This app has no tables of its own, so there are no stored rows to share. '
            + 'Anyone who can open the app can also fetch live data as you through Price list, '
            + 'whichever role they land on.',
        );
    });

    it('reassures for a private draft', () => {
        render(<PublishModal open app={orgApp} onClose={vi.fn()} onPublished={vi.fn()} />);
        fireEvent.click(screen.getByRole('radio', { name: /Private/i }));

        expect(impactText()).toBe('Nobody else can open this app, so nobody else can reach the information in its tables.');
    });

});

describe('PublishModal — when there is no data model to describe', () => {
    it('says plainly that it could not check, rather than implying safety', () => {
        useAppRoles.mockReturnValue(access({ model: null, tables: [], hasModel: false, isError: true }));
        render(<PublishModal open app={privateApp} onClose={vi.fn()} onPublished={vi.fn()} />);
        fireEvent.click(screen.getByRole('radio', { name: /Entire organization/i }));

        expect(impactText()).toContain('We could not check what this would share');
    });

    it('waits for the data model instead of guessing while it loads', () => {
        useAppRoles.mockReturnValue(access({ model: null, tables: [], hasModel: false, isLoading: true }));
        render(<PublishModal open app={privateApp} onClose={vi.fn()} onPublished={vi.fn()} />);
        fireEvent.click(screen.getByRole('radio', { name: /Entire organization/i }));

        expect(impactText()).toBe('Checking what this would share…');
    });

    it('says there is nothing stored to share when the app has no tables', () => {
        useAppRoles.mockReturnValue(access({ model: null, tables: [], hasModel: false }));
        render(<PublishModal open app={privateApp} onClose={vi.fn()} onPublished={vi.fn()} />);
        fireEvent.click(screen.getByRole('radio', { name: /Entire organization/i }));

        expect(impactText()).toBe('This app has no tables of its own, so there are no stored rows to share.');
    });

    it('leaves an audience with no role empty-handed', () => {
        useAppRoles.mockReturnValue(access({ roleMapping: { default: '', byGroup: {} } }));
        render(<PublishModal open app={privateApp} onClose={vi.fn()} onPublished={vi.fn()} />);
        fireEvent.click(screen.getByRole('radio', { name: /Entire organization/i }));

        expect(impactText()).toBe('Everyone in your organisation will not be able to reach any information in this app.');
    });
});

describe('PublishModal — a publish the server refuses', () => {
    it('keeps the modal open and lists every message with its hint', async () => {
        studioAppsApi.publish.mockRejectedValue(rejection({ errors: [ERR_BUTTON, ERR_NO_PATH] }));
        const onClose = vi.fn();
        render(<PublishModal open app={privateApp} definition={DEFINITION} onClose={onClose} onPublished={vi.fn()} />);

        fireEvent.click(screen.getByRole('radio', { name: /Entire organization/i }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

        await screen.findByText('2 things to fix before publishing');
        expect(screen.getByText(ERR_BUTTON.message)).toBeInTheDocument();
        expect(screen.getByText(ERR_BUTTON.hint)).toBeInTheDocument();
        expect(screen.getByText(ERR_NO_PATH.message)).toBeInTheDocument();
        expect(screen.getByText(ERR_NO_PATH.hint)).toBeInTheDocument();
        // The dead end is gone: no toast, and the modal is still there to act in.
        expect(toast.error).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('counts in the singular for one blocker', async () => {
        studioAppsApi.publish.mockRejectedValue(rejection({ errors: [ERR_NO_PATH] }));
        render(<PublishModal open app={privateApp} definition={DEFINITION} onClose={vi.fn()} onPublished={vi.fn()} />);

        fireEvent.click(screen.getByRole('radio', { name: /Entire organization/i }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

        await screen.findByText('1 thing to fix before publishing');
    });

    it('separates warnings from blockers and says they do not block publishing', async () => {
        const warning = {
            code: 'binding.table_unset', severity: 'warning', path: 'screens[1].sections[0]',
            message: 'One list has no table picked yet.', hint: 'Connect it before publishing.',
        };
        studioAppsApi.publish.mockRejectedValue(rejection({ errors: [ERR_NO_PATH], warnings: [warning] }));
        render(<PublishModal open app={privateApp} definition={DEFINITION} onClose={vi.fn()} onPublished={vi.fn()} />);

        fireEvent.click(screen.getByRole('radio', { name: /Entire organization/i }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

        await screen.findByText('1 thing to fix before publishing');
        expect(screen.getByText('1 thing worth a look')).toBeInTheDocument();
        expect(screen.getByText('These do not stop you publishing.')).toBeInTheDocument();
        expect(screen.getByText(warning.message)).toBeInTheDocument();
    });

    it('"Show me" resolves the path to the deepest node and reveals it on its page', async () => {
        studioAppsApi.publish.mockRejectedValue(rejection({ errors: [ERR_BUTTON] }));
        const onRevealNode = vi.fn();
        const onClose = vi.fn();
        render(
            <PublishModal
                open
                app={privateApp}
                definition={DEFINITION}
                onClose={onClose}
                onPublished={vi.fn()}
                onRevealNode={onRevealNode}
            />,
        );

        fireEvent.click(screen.getByRole('radio', { name: /Entire organization/i }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

        const showMe = await screen.findByRole('button', { name: 'Show me' });
        expect(screen.getByText('on “Overview”')).toBeInTheDocument();
        fireEvent.click(showMe);
        expect(onRevealNode).toHaveBeenCalledWith({ nodeId: 'cmp_inner', screenId: 'scr_home' });
        expect(onClose).toHaveBeenCalled();
    });

    it('offers no "Show me" for a path that addresses no page, or with no handler wired', async () => {
        studioAppsApi.publish.mockRejectedValue(rejection({ errors: [ERR_NO_PATH] }));
        const { unmount } = render(
            <PublishModal open app={privateApp} definition={DEFINITION} onClose={vi.fn()} onPublished={vi.fn()} onRevealNode={vi.fn()} />,
        );
        fireEvent.click(screen.getByRole('radio', { name: /Entire organization/i }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
        await screen.findByText(ERR_NO_PATH.message);
        expect(screen.queryByRole('button', { name: 'Show me' })).toBeNull();
        unmount();

        // Resolvable path, but the chrome passed no reveal handler → no dead button.
        studioAppsApi.publish.mockRejectedValue(rejection({ errors: [ERR_BUTTON] }));
        render(<PublishModal open app={privateApp} definition={DEFINITION} onClose={vi.fn()} onPublished={vi.fn()} />);
        fireEvent.click(screen.getByRole('radio', { name: /Entire organization/i }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
        await screen.findByText(ERR_BUTTON.message);
        expect(screen.queryByRole('button', { name: 'Show me' })).toBeNull();
    });

    it('falls back to the stored app definition when the chrome passes none', async () => {
        studioAppsApi.publish.mockRejectedValue(rejection({ errors: [ERR_BUTTON] }));
        const onRevealNode = vi.fn();
        render(
            <PublishModal
                open
                app={{ ...privateApp, definition: DEFINITION }}
                onClose={vi.fn()}
                onPublished={vi.fn()}
                onRevealNode={onRevealNode}
            />,
        );
        fireEvent.click(screen.getByRole('radio', { name: /Entire organization/i }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Show me' }));
        expect(onRevealNode).toHaveBeenCalledWith({ nodeId: 'cmp_inner', screenId: 'scr_home' });
    });

    it('drops the list when the user picks a different audience, and on the next attempt', async () => {
        studioAppsApi.publish.mockRejectedValue(rejection({ errors: [ERR_NO_PATH] }));
        render(<PublishModal open app={privateApp} definition={DEFINITION} onClose={vi.fn()} onPublished={vi.fn()} />);

        fireEvent.click(screen.getByRole('radio', { name: /Entire organization/i }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
        await screen.findByText(ERR_NO_PATH.message);

        fireEvent.click(screen.getByRole('radio', { name: /Private/i }));
        expect(screen.queryByText(ERR_NO_PATH.message)).toBeNull();

        // A retry that succeeds leaves nothing behind either.
        studioAppsApi.publish.mockResolvedValue({ success: true, isPublished: false, sharedGroups: [] });
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
        await waitFor(() => expect(toast.success).toHaveBeenCalled());
        expect(screen.queryByText(ERR_NO_PATH.message)).toBeNull();
    });

    it('still toasts when the failure is not a 422 list', async () => {
        const err = new Error('Server unavailable');
        err.status = 500;
        studioAppsApi.publish.mockRejectedValue(err);
        render(<PublishModal open app={privateApp} definition={DEFINITION} onClose={vi.fn()} onPublished={vi.fn()} />);

        fireEvent.click(screen.getByRole('radio', { name: /Entire organization/i }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Server unavailable'));
        expect(screen.queryByText(/to fix before publishing/)).toBeNull();
    });
});

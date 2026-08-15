import { fireEvent, render, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The connector editor reads the automations catalog (through
// useIntegrationCatalog) for the app menu, each action's parameter schema and
// the chain suggestions. Stub the api hook so tests control it; the hook caches
// the first getCatalog() promise for the session.
// listAutomations backs the routine field + picker.
const getCatalog = vi.fn(() => Promise.resolve({
    apps: [
        {
            id: 'gmail', label: 'Gmail', available: true,
            actions: [
                {
                    name: 'gmail_search', label: 'Search', integrationId: 'gmail', producesList: true,
                    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Gmail search query' } } },
                    outputSample: { results: [{ id: '18f1', threadId: 't1', subject: 'Hi' }], total: 1 },
                },
                {
                    name: 'gmail_read', label: 'Read', integrationId: 'gmail',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            messageId: { type: 'string', description: 'The id of the message to read' },
                            format: { type: 'string', enum: ['full', 'metadata'] },
                        },
                        required: ['messageId'],
                    },
                },
                { name: 'gmail_send', label: 'Send email', integrationId: 'gmail', sideEffect: true },
            ],
        },
        {
            id: 'slack', label: 'Slack', available: false,
            actions: [{ name: 'slack_post_message', label: 'Post message', integrationId: 'slack' }],
        },
        {
            id: 'drive', label: 'Drive', available: true,
            actions: [
                { name: 'drive_list_files', label: 'List files', integrationId: 'drive', producesList: true },
                { name: 'drive_upload', label: 'Upload file', integrationId: 'drive', sideEffect: true },
            ],
        },
    ],
}));
const listAutomations = vi.fn(() => Promise.resolve({
    automations: [
        { id: 'auto-1', title: 'Weekly invoice report', definition: { trigger: { kind: 'agent_call' } } },
        { id: 'auto-2', title: 'Sync contacts', definition: { trigger: { kind: 'manual' } } },
    ],
}));
vi.mock('../../../../../hooks/useAutomationApi', () => ({
    default: () => ({ getCatalog, listAutomations }),
}));
vi.mock('../../../../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));

import { authFetch } from '../../../../../utils/helpers';
import ConnectorsManager, { connectorProblem } from './ConnectorsManager';

/**
 * ConnectorsManager is a CONTROLLED editor over model.connectors[]: it never
 * saves — the parent (TablesManager) persists the whole model — so these tests
 * assert the shapes it emits through onChange. Its one network call is the
 * explicit "Test it", which runs the LAST SAVED connector server-side.
 */

function renderMgr(connectors = [], props = {}) {
    const onChange = vi.fn();
    const utils = render(<ConnectorsManager connectors={connectors} onChange={onChange} {...props} />);
    const last = () => onChange.mock.calls.at(-1)?.[0];
    return { onChange, last, ...utils };
}

beforeEach(() => {
    authFetch.mockReset();
});

describe('ConnectorsManager — adding one', () => {
    it('asks where the data comes from before creating anything', () => {
        const { onChange, getByRole } = renderMgr([]);
        const group = getByRole('radiogroup', { name: /where should this get its data/i });
        // mailbox, app, routine, web address
        expect(within(group).getAllByRole('radio')).toHaveLength(4);
        expect(onChange).not.toHaveBeenCalled();
    });

    it('offers a mailbox, and says the Bee Flow sign-in is what it uses', () => {
        // The question this answers on screen, because it is the one everybody
        // asks: no, there is no second sign-in.
        const { getByRole } = renderMgr([]);
        const group = getByRole('radiogroup', { name: /where should this get its data/i });
        const mailbox = within(group).getByRole('radio', { name: /my mailbox/i });
        expect(mailbox).toBeTruthy();
        expect(within(group).getByText(/signed in to Bee Flow with/i)).toBeTruthy();
    });

    it('starts on "an app you already use", and that card opens the app menu', async () => {
        const { onChange, getByRole, findByRole } = renderMgr([]);
        expect(getByRole('radio', { name: /an app you already use/i }).getAttribute('aria-checked')).toBe('true');

        // The app kind no longer creates a blank connector to configure — it
        // opens the picker, where each ticked action becomes its own connector.
        fireEvent.click(getByRole('button', { name: /choose apps & actions/i }));
        expect(await findByRole('dialog', { name: /choose apps & actions/i })).toBeTruthy();
        expect(onChange).not.toHaveBeenCalled();
    });

    it('creates a routine connector from the second card', () => {
        const { last, getByRole } = renderMgr([]);
        fireEvent.click(getByRole('radio', { name: /one of my routines/i }));
        fireEvent.click(getByRole('button', { name: /add it/i }));
        expect(last()[0].kind).toBe('automation');
    });

    it('marks the web-address card as the advanced way', () => {
        const { getByRole } = renderMgr([]);
        const card = getByRole('radio', { name: /another system via its web address/i });
        expect(card.textContent).toMatch(/advanced/i);
        fireEvent.click(card);
        fireEvent.click(getByRole('button', { name: /add it/i }));
    });

    it('offers the same three cards from the sidebar button, and can be cancelled', () => {
        const base = [{ id: 'conn_aaa111', kind: 'automation', name: 'A', automationId: 'auto-1' }];
        const { onChange, getByRole, queryByRole } = renderMgr(base);
        expect(queryByRole('radiogroup')).toBeNull();

        fireEvent.click(getByRole('button', { name: /routine or web address/i }));
        expect(getByRole('radiogroup', { name: /where should this get its data/i })).toBeTruthy();

        fireEvent.click(getByRole('button', { name: /cancel/i }));
        expect(queryByRole('radiogroup')).toBeNull();
        expect(onChange).not.toHaveBeenCalled();
    });

    it('renders a friendly empty state', () => {
        const { getByText } = renderMgr([]);
        expect(getByText(/No connectors yet/i)).toBeTruthy();
    });
});

describe('ConnectorsManager — editing', () => {
    it('edits the rest URL and declares a viewer param (round-trips the shape)', () => {
        const base = [{ id: 'conn_abc123', kind: 'rest', name: 'Items', params: [] }];
        const { last, getByRole } = renderMgr(base);

        fireEvent.change(getByRole('textbox', { name: /URL template/i }), {
            target: { value: 'https://api.example.com/items?q={q}' },
        });
        expect(last()[0].url).toBe('https://api.example.com/items?q={q}');

        fireEvent.click(getByRole('button', { name: /add param/i }));
        const withParam = last();
        expect(withParam[0].params).toEqual([{ key: '', type: 'text', required: false }]);

        // Fill the param key.
        const rerender = renderMgr(withParam);
        fireEvent.change(rerender.getByRole('textbox', { name: /param 1 key/i }), { target: { value: 'q' } });
        expect(rerender.last()[0].params[0].key).toBe('q');
    });

    it('keeps the REST details reachable one disclosure deeper', () => {
        const base = [{ id: 'conn_abc123', kind: 'rest', name: 'Items', params: [], auth: { type: 'bearer' } }];
        const { last, getByRole, queryByRole } = renderMgr(base);
        expect(queryByRole('textbox', { name: /Credential provider/i })).toBeNull();

        fireEvent.click(getByRole('button', { name: /advanced settings/i }));
        fireEvent.change(getByRole('textbox', { name: /Credential provider/i }), { target: { value: 'example' } });
        const emitted = last();
        expect(emitted[0].auth).toEqual({ type: 'bearer', credentialProvider: 'example' });
        // The editor exposes no field for a raw token/secret value.
        expect(() => getByRole('textbox', { name: /token|secret|api key/i })).toThrow();
    });

    it('switches kind to integration_tool and still allows a hand-typed tool', () => {
        const base = [{ id: 'conn_abc123', kind: 'rest', name: 'Items', params: [] }];
        const { last, getByRole, unmount } = renderMgr(base);
        fireEvent.change(getByRole('combobox', { name: /connector kind/i }), { target: { value: 'integration_tool' } });
        expect(last()[0].kind).toBe('integration_tool');

        const switched = last();
        unmount();
        const rerender = renderMgr(switched);
        fireEvent.click(rerender.getByRole('button', { name: /advanced settings/i }));
        fireEvent.change(rerender.getByRole('textbox', { name: /^Tool$/i }), { target: { value: 'gmail_list_messages' } });
        expect(rerender.last()[0].tool).toBe('gmail_list_messages');
    });

    it('deletes a connector', () => {
        const base = [
            { id: 'conn_aaa111', kind: 'automation', name: 'A', automationId: 'x' },
            { id: 'conn_bbb222', kind: 'automation', name: 'B', automationId: 'y' },
        ];
        const { last, getByRole } = renderMgr(base);
        const list = getByRole('button', { name: /Delete A/i });
        fireEvent.click(list);
        expect(last()).toEqual([base[1]]);
    });

    it('names what an unfinished connector still needs', () => {
        expect(connectorProblem({ kind: 'rest' })).toMatch(/web address/i);
        expect(connectorProblem({ kind: 'rest', url: 'https://x.example/y' })).toBeNull();
        expect(connectorProblem({ kind: 'integration_tool' })).toMatch(/app and an action/i);
        expect(connectorProblem({ kind: 'automation' })).toMatch(/routine/i);
        expect(connectorProblem({ kind: 'automation', automationId: 'auto-1' })).toBeNull();
    });

    it('toggles the runAs policy — viewer is persisted, owner drops the field', async () => {
        const base = [{ id: 'conn_abc123', kind: 'integration_tool', name: 'Mail', tool: 'gmail_send', params: [] }];
        const first = renderMgr(base);

        fireEvent.change(first.getByRole('combobox', { name: /connector identity/i }), { target: { value: 'viewer' } });
        const withViewer = first.last();
        expect(withViewer[0].runAs).toBe('viewer');
        first.unmount();

        const second = renderMgr(withViewer);
        fireEvent.change(second.getByRole('combobox', { name: /connector identity/i }), { target: { value: 'owner' } });
        expect('runAs' in second.last()[0]).toBe(false);
    });
});

describe('ConnectorsManager — the routine kind', () => {
    it('shows the routine by name instead of by id', async () => {
        const base = [{ id: 'conn_aaa111', kind: 'automation', name: 'Report', automationId: 'auto-1' }];
        const { findByText } = renderMgr(base);
        expect(await findByText('Weekly invoice report')).toBeTruthy();
    });

    it('picks a routine from the shared picker', async () => {
        const base = [{ id: 'conn_aaa111', kind: 'automation', name: 'Report', params: [] }];
        const { last, getByRole, findByRole } = renderMgr(base);
        fireEvent.click(getByRole('button', { name: /choose a routine/i }));
        fireEvent.click(await findByRole('button', { name: /Sync contacts/i }));
        expect(last()[0].automationId).toBe('auto-2');
    });

    it('still lets the id be typed by hand', () => {
        const base = [{ id: 'conn_aaa111', kind: 'automation', name: 'Report', params: [] }];
        const { last, getByRole } = renderMgr(base);
        fireEvent.click(getByRole('button', { name: /type the id myself/i }));
        fireEvent.change(getByRole('textbox', { name: /routine id/i }), { target: { value: 'auto-9' } });
        expect(last()[0].automationId).toBe('auto-9');
    });
});

describe('ConnectorsManager — Test it', () => {
    const REST = [{ id: 'conn_abc123', kind: 'rest', name: 'Items', params: [], url: 'https://api.example.com/items' }];

    it('runs the connector and shows the first rows', async () => {
        authFetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ rows: [{ name: 'Ann', email: 'ann@example.com' }, { name: 'Bo' }] }),
        });
        const { getByRole, findByText, getByText } = renderMgr(REST, { appId: 'app_1' });
        fireEvent.click(getByRole('button', { name: /test it/i }));

        expect(await findByText(/It works — 2 rows came back/i)).toBeTruthy();
        expect(getByText('Ann')).toBeTruthy();
        expect(authFetch).toHaveBeenCalledTimes(1);
        const [url, options] = authFetch.mock.calls[0];
        expect(url).toBe('/api/studio-apps/app_1/data/connectors/conn_abc123/run');
        expect(options.method).toBe('POST');
        expect(JSON.parse(options.body)).toEqual({ params: {} });
    });

    it('sends the values typed for declared params', async () => {
        authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ rows: [] }) });
        const withParam = [{ ...REST[0], params: [{ key: 'q', type: 'text' }] }];
        const { getByRole, getByLabelText, findByText } = renderMgr(withParam, { appId: 'app_1' });

        fireEvent.change(getByLabelText('Test value for q'), { target: { value: 'invoices' } });
        fireEvent.click(getByRole('button', { name: /test it/i }));

        expect(await findByText(/nothing came back/i)).toBeTruthy();
        expect(JSON.parse(authFetch.mock.calls[0][1].body)).toEqual({ params: { q: 'invoices' } });
    });

    it('says to save first when the server has never seen this connector', async () => {
        authFetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: 'Connector not found' }) });
        const { getByRole, findByRole } = renderMgr(REST, { appId: 'app_1' });
        fireEvent.click(getByRole('button', { name: /test it/i }));
        expect((await findByRole('alert')).textContent).toMatch(/Save your changes first/i);
    });

    it('names the app to connect when the run needs an account', async () => {
        authFetch.mockResolvedValue({
            ok: false,
            status: 409,
            json: async () => ({ error: 'needs a connected account', code: 'connection_required', provider: 'Gmail' }),
        });
        const { getByRole, findByRole } = renderMgr(REST, { appId: 'app_1' });
        fireEvent.click(getByRole('button', { name: /test it/i }));
        expect((await findByRole('alert')).textContent).toMatch(/Connect Gmail/i);
    });

    it('will not run an unfinished connector, and says why', () => {
        const unfinished = [{ id: 'conn_abc123', kind: 'rest', name: 'Items', params: [] }];
        const { getByRole, getByText } = renderMgr(unfinished, { appId: 'app_1' });
        expect(getByRole('button', { name: /test it/i }).disabled).toBe(true);
        expect(getByText(/Finish the connector first/i)).toBeTruthy();
        expect(authFetch).not.toHaveBeenCalled();
    });

    it('stays inert outside the app editor, where there is no app to test against', () => {
        const { getByRole, getByText } = renderMgr(REST);
        expect(getByRole('button', { name: /test it/i }).disabled).toBe(true);
        expect(getByText(/Open the app to test this/i)).toBeTruthy();
    });
});

// ── integration_tool: the app menu, the action's parameters, and chaining ──

describe('ConnectorsManager — picking apps & actions in bulk', () => {
    it('creates one connector per ticked action, named after the app and action', async () => {
        const { last, getByRole, findByRole } = renderMgr([]);
        fireEvent.click(getByRole('button', { name: /choose apps & actions/i }));
        await findByRole('dialog', { name: /choose apps & actions/i });

        fireEvent.click(getByRole('button', { name: /^Gmail$/ }));
        fireEvent.click(getByRole('button', { name: /^Search/ }));
        fireEvent.click(getByRole('button', { name: /^Read/ }));
        fireEvent.click(getByRole('button', { name: /^Apply$/ }));

        const emitted = last();
        expect(emitted).toHaveLength(2);
        expect(emitted.map((c) => c.tool).sort()).toEqual(['gmail_read', 'gmail_search']);
        expect(emitted.every((c) => c.kind === 'integration_tool')).toBe(true);
        expect(emitted.every((c) => c.integrationId === 'gmail')).toBe(true);
        expect(emitted.every((c) => /^conn_[0-9a-f]{6}$/.test(c.id))).toBe(true);
        // A readable default beats "Connector 7".
        expect(emitted[0].name).toMatch(/Gmail/);
    });

    it('un-ticking an action removes its connector', async () => {
        const base = [
            { id: 'conn_aaa111', kind: 'integration_tool', name: 'Gmail search', tool: 'gmail_search', integrationId: 'gmail', params: [] },
            { id: 'conn_bbb222', kind: 'integration_tool', name: 'Gmail send', tool: 'gmail_send', integrationId: 'gmail', params: [] },
        ];
        const { last, getByRole, findByRole } = renderMgr(base);
        fireEvent.click(getByRole('button', { name: /choose apps & actions/i }));
        // Scoped to the overlay: the sidebar also carries buttons named after
        // these connectors, and the app row carries an "N selected" badge.
        const picker = within(await findByRole('dialog', { name: /choose apps & actions/i }));

        fireEvent.click(picker.getByRole('button', { name: /^Gmail/ }));
        fireEvent.click(picker.getByRole('button', { name: /^Send email/ }));
        fireEvent.click(picker.getByRole('button', { name: /^Apply$/ }));

        expect(last()).toHaveLength(1);
        expect(last()[0].tool).toBe('gmail_search');
    });

    it('shows what is already wired as ticked, and Apply stays inert until something changes', async () => {
        const base = [{ id: 'conn_aaa111', kind: 'integration_tool', name: 'Gmail search', tool: 'gmail_search', integrationId: 'gmail', params: [] }];
        const { onChange, getByRole, findByRole } = renderMgr(base);
        fireEvent.click(getByRole('button', { name: /choose apps & actions/i }));
        const picker = within(await findByRole('dialog', { name: /choose apps & actions/i }));

        fireEvent.click(picker.getByRole('button', { name: /^Gmail/ }));
        expect(picker.getByRole('button', { name: /^Search/ }).getAttribute('aria-pressed')).toBe('true');
        expect(picker.getByRole('button', { name: /nothing to change/i }).disabled).toBe(true);
        expect(onChange).not.toHaveBeenCalled();
    });

    it('badges the actions that return a list and the ones that write', async () => {
        const { getByRole, findByRole } = renderMgr([]);
        fireEvent.click(getByRole('button', { name: /choose apps & actions/i }));
        await findByRole('dialog', { name: /choose apps & actions/i });

        fireEvent.click(getByRole('button', { name: /^Gmail$/ }));
        expect(getByRole('button', { name: /^Search/ }).textContent).toMatch(/list/i);
        expect(getByRole('button', { name: /^Send email/ }).textContent).toMatch(/writes/i);
    });

    it('marks an app the builder has not connected instead of hiding it', async () => {
        const { getByRole, findByRole, findByText } = renderMgr([]);
        fireEvent.click(getByRole('button', { name: /choose apps & actions/i }));
        await findByRole('dialog', { name: /choose apps & actions/i });

        fireEvent.click(getByRole('button', { name: /^Slack$/ }));
        expect(await findByText(/Slack is not connected to your account/i)).toBeTruthy();
    });

    it('groups the connector list by app', async () => {
        const base = [
            { id: 'conn_aaa111', kind: 'integration_tool', name: 'Search', tool: 'gmail_search', integrationId: 'gmail', params: [] },
            { id: 'conn_bbb222', kind: 'integration_tool', name: 'Files', tool: 'drive_list_files', integrationId: 'drive', params: [] },
            { id: 'conn_ccc333', kind: 'automation', name: 'Report', automationId: 'auto-1' },
        ];
        const { findByText } = renderMgr(base);
        expect(await findByText('Gmail')).toBeTruthy();
        expect(await findByText('Drive')).toBeTruthy();
        expect(await findByText(/Routines & web addresses/i)).toBeTruthy();
    });
});

describe('ConnectorsManager — the action own parameters', () => {
    // The regression this surface exists for: picking gmail_read used to give an
    // empty JSON box and then "Connector failed to run", with nothing on screen
    // saying a messageId was required.
    const READ = [{ id: 'conn_abc123', kind: 'integration_tool', name: 'Read', tool: 'gmail_read', integrationId: 'gmail', params: [] }];

    it('shows a required parameter as required, and blocks the test until it is supplied', async () => {
        const { findByText, getByRole } = renderMgr(READ, { appId: 'app_1' });
        expect(await findByText(/This action needs messageId/i)).toBeTruthy();
        expect(getByRole('button', { name: /test it/i }).disabled).toBe(true);
        expect(authFetch).not.toHaveBeenCalled();
    });

    it('names the missing parameter in the connector problem, before any run', () => {
        const action = {
            name: 'gmail_read',
            inputSchema: { type: 'object', properties: { messageId: { type: 'string' } }, required: ['messageId'] },
        };
        expect(connectorProblem(READ[0], action)).toMatch(/still needs messageId/i);
        expect(connectorProblem({ ...READ[0], fixedArgs: { messageId: 'm1' } }, action)).toBeNull();
        expect(connectorProblem({ ...READ[0], params: [{ key: 'messageId' }] }, action)).toBeNull();
        expect(connectorProblem({ ...READ[0], chain: [{ tool: 'x', argsFrom: { messageId: 'id' } }] }, action)).toBeNull();
        // Without the catalog it degrades to the old per-kind check, never throws.
        expect(connectorProblem(READ[0])).toBeNull();
    });

    it('pins a parameter value into fixedArgs', async () => {
        const { last, findByRole } = renderMgr(READ);
        fireEvent.change(await findByRole('combobox', { name: /where messageId comes from/i }), { target: { value: 'pinned' } });
        expect(last()[0].fixedArgs).toEqual({ messageId: '' });

        const rerender = renderMgr(last());
        fireEvent.change(await rerender.findByRole('textbox', { name: /^messageId/ }), { target: { value: '18f1' } });
        expect(rerender.last()[0].fixedArgs).toEqual({ messageId: '18f1' });
    });

    it('routes a parameter to the viewer instead, declaring it in params[]', async () => {
        const { last, findByRole } = renderMgr(READ);
        fireEvent.change(await findByRole('combobox', { name: /where messageId comes from/i }), { target: { value: 'viewer' } });
        expect(last()[0].params).toEqual([{ key: 'messageId', type: 'text', required: true }]);
        expect(last()[0].fixedArgs).toBeUndefined();
    });

    it('renders an enum parameter as a choice, not a free-text box', async () => {
        const pinned = [{ ...READ[0], fixedArgs: { format: 'full' } }];
        const { findByRole } = renderMgr(pinned);
        const control = await findByRole('combobox', { name: /^format/i });
        expect(within(control).getByRole('option', { name: 'metadata' })).toBeTruthy();
    });

    it('says an action takes no parameters rather than showing an empty form', async () => {
        const base = [{ id: 'conn_abc123', kind: 'integration_tool', name: 'Files', tool: 'drive_list_files', integrationId: 'drive', params: [] }];
        const { findByText } = renderMgr(base);
        expect(await findByText(/takes no parameters/i)).toBeTruthy();
    });
});

describe('ConnectorsManager — combining actions', () => {
    const READ = [{ id: 'conn_abc123', kind: 'integration_tool', name: 'Read', tool: 'gmail_read', integrationId: 'gmail', params: [] }];

    it('suggests the sibling action that supplies the missing id, and explains why', async () => {
        const { findByRole } = renderMgr(READ);
        // "Read needs messageId — Search gives one as `id`"
        const suggestion = await findByRole('button', { name: /needs messageId/i });
        expect(suggestion.textContent).toMatch(/Search/);
    });

    it('accepting the suggestion adds a chain step with the binding already set', async () => {
        const { last, findByRole } = renderMgr(READ);
        fireEvent.click(await findByRole('button', { name: /needs messageId/i }));
        // A follow-up action returns a different KIND of thing — that is why it
        // needed chaining — so it lands in a table of its own by default.
        expect(last()[0].chain).toEqual([{ ownTable: true, tool: 'gmail_search', argsFrom: { messageId: 'id' } }]);
    });

    it('a step can be merged into one wide table instead', async () => {
        const chained = [{ ...READ[0], chain: [{ tool: 'gmail_search', argsFrom: { messageId: 'id' }, ownTable: true }] }];
        const { last, findByRole } = renderMgr(chained);
        const select = await findByRole('combobox', { name: /how step 2 folds its result back/i });
        fireEvent.change(select, { target: { value: '' } });
        expect(last()[0].chain).toEqual([{ tool: 'gmail_search', argsFrom: { messageId: 'id' } }]);
    });

    it('expanding replaces "its own table" rather than sitting alongside it', async () => {
        // The model rejects both at once — expanding already gives the step a
        // table of its own — so the control can never leave both set.
        const chained = [{ ...READ[0], chain: [{ tool: 'gmail_search', argsFrom: { messageId: 'id' }, ownTable: true }] }];
        const { last, findByRole } = renderMgr(chained);
        const select = await findByRole('combobox', { name: /how step 2 folds its result back/i });
        fireEvent.change(select, { target: { value: 'results' } });
        expect(last()[0].chain).toEqual([{ tool: 'gmail_search', argsFrom: { messageId: 'id' }, expand: 'results' }]);
    });

    it('a step saved before linked tables existed keeps merging', async () => {
        const chained = [{ ...READ[0], chain: [{ tool: 'gmail_search', argsFrom: { messageId: 'id' } }] }];
        const { findByRole } = renderMgr(chained);
        const select = await findByRole('combobox', { name: /how step 2 folds its result back/i });
        expect(select.value).toBe('');
    });

    it('a chained parameter no longer counts as missing', async () => {
        const chained = [{ ...READ[0], chain: [{ tool: 'gmail_search', argsFrom: { messageId: 'id' } }] }];
        const { queryByText, findByText } = renderMgr(chained);
        expect(await findByText(/Filled from/i)).toBeTruthy();
        expect(queryByText(/This action needs messageId/i)).toBeNull();
    });

    it('removes a chain step, dropping the key rather than leaving an empty array', async () => {
        const chained = [{ ...READ[0], chain: [{ tool: 'gmail_search', argsFrom: { messageId: 'id' } }] }];
        const { last, findByRole } = renderMgr(chained);
        fireEvent.click(await findByRole('button', { name: /remove step 2/i }));
        expect('chain' in last()[0]).toBe(false);
    });

    it('never offers a writing action as a lookup step', async () => {
        const { findByRole, getByRole } = renderMgr(READ);
        fireEvent.click(await findByRole('button', { name: /add a follow-up step/i }));
        const select = getByRole('combobox', { name: /follow-up action/i });
        expect(within(select).queryByRole('option', { name: /Send email/i })).toBeNull();
        expect(within(select).getByRole('option', { name: /Search/i })).toBeTruthy();
    });
});

/**
 * A `chain` is only legal on an app connector — dataModel.js rejects one
 * anywhere else with "chain is only supported for app connectors" — and the
 * chain editor is only RENDERED for that kind. So switching the kind away left
 * the steps behind where nobody could see them, and the data model could never
 * be saved again: the error named a field the screen no longer showed.
 */
describe('ConnectorsManager — changing the kind takes the chain with it', () => {
    const chained = [{
        id: 'conn_abc123', kind: 'integration_tool', name: 'Read',
        tool: 'gmail_read', integrationId: 'gmail', params: [],
        chain: [{ tool: 'gmail_search', argsFrom: { messageId: 'id' } }],
    }];

    it('drops a chain the new kind cannot carry', () => {
        const { last, getByLabelText } = renderMgr(chained);
        fireEvent.change(getByLabelText('Connector kind'), { target: { value: 'rest' } });
        const out = last()[0];
        expect(out.kind).toBe('rest');
        // Absent, not merely undefined — code that asks `'chain' in c` must
        // agree with the JSON that reaches the server.
        expect('chain' in out).toBe(false);
    });

    it('keeps the chain while the connector is still an app connector', () => {
        const { last, getByLabelText } = renderMgr(chained);
        fireEvent.change(getByLabelText('Name'), { target: { value: 'Mail' } });
        expect(last()[0].chain).toHaveLength(1);
    });
});

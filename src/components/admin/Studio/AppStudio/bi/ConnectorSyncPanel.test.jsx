import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));

import { authFetch } from '../../../../../utils/helpers';
import ConnectorSyncPanel from './ConnectorSyncPanel';

/**
 * "Keep this in a table" — the panel that turns a connector into a cached,
 * refreshed table.
 *
 * The behaviour worth pinning is the honesty: incremental loading is only
 * offered when the DATA supports it, and the two kinds are described
 * differently, because only one of them actually reduces API calls. A panel that
 * blurred that would have owners discover the difference via a rate limit.
 */

const CONNECTOR = { id: 'conn_abc123', kind: 'integration_tool', name: 'Recent emails', tool: 'gmail_search', integrationId: 'gmail' };

function proposal(incremental, extra = {}) {
    return {
        rows: [{ id: 'm1' }],
        rowCount: 12,
        fields: [{ key: 'id', name: 'id', type: 'text', sourcePath: 'id' }],
        identity: 'id',
        keyField: 'id',
        defaultMode: 'upsert',
        incremental,
        suggestedTable: {
            id: 'tbl_new001', key: 'recent_emails', name: 'Recent emails',
            fields: [{ id: 'fld_1', key: 'id', name: 'id', type: 'text', unique: true, sourcePath: 'id' }],
        },
        ...extra,
    };
}

function renderPanel(props = {}) {
    const onChange = vi.fn();
    const onCreateTable = vi.fn();
    const utils = render(
        <ConnectorSyncPanel
            connector={CONNECTOR}
            tables={[]}
            appId="app_1"
            onChange={onChange}
            onCreateTable={onCreateTable}
            {...props}
        />,
    );
    return { onChange, onCreateTable, ...utils };
}

beforeEach(() => {
    authFetch.mockReset();
    // Default: sync-status reads answer empty.
    authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ syncs: [] }) });
});

describe('ConnectorSyncPanel — setting it up', () => {
    it('proposes a table from one inspect run, and only creates it on confirmation', async () => {
        authFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => proposal({ mode: 'client', field: 'modifiedTime', param: null, format: 'iso' }) });
        const { getByRole, findByText, onCreateTable } = renderPanel();

        fireEvent.click(getByRole('button', { name: /set up a table/i }));
        expect(await findByText(/Got 12 rows back/i)).toBeTruthy();
        expect(onCreateTable).not.toHaveBeenCalled();

        fireEvent.click(getByRole('button', { name: /create it/i }));
        const [table, sync] = onCreateTable.mock.calls[0];
        expect(table.key).toBe('recent_emails');
        expect(sync).toMatchObject({
            tableId: 'tbl_new001',
            mode: 'upsert',
            keyField: 'id',
            incremental: { field: 'modifiedTime', format: 'iso' },
            refreshOnView: true,
        });
        // No since-param exists, so none is stored.
        expect(sync.incremental.param).toBeUndefined();
        expect(sync.schedule.everyMinutes).toBeGreaterThanOrEqual(15);
    });

    it('proposes linked tables when the steps returned different things', async () => {
        // A step kept in its own table is ONE child row per parent row; an expand
        // is many. Saying "one row per item" about the first would be wrong.
        const tableSet = { tables: [
            { table: { id: 'tbl_msg', key: 'messages', name: 'Messages', fields: [{ id: 'fld_1', key: 'source_id', name: 'id', type: 'text' }] },
                keyField: 'id', identity: 'id', defaultMode: 'upsert', level: 0, parentLevel: null, relationField: null, expandFrom: null, tool: 'gmail_search', rowCount: 2 },
            { table: { id: 'tbl_bod', key: 'messages_body', name: 'Messages — gmail read', fields: [{ id: 'fld_2', key: 'messages_ref', name: 'Messages record', type: 'relation', relation: { table: 'tbl_msg' } }] },
                keyField: null, identity: null, defaultMode: 'replace', level: 1, parentLevel: 0, relationField: 'messages_ref', expandFrom: null, tool: 'gmail_read', rowCount: 2 },
            { table: { id: 'tbl_att', key: 'attachments', name: 'Messages — attachments', fields: [{ id: 'fld_3', key: 'messages_body_ref', name: 'x', type: 'relation', relation: { table: 'tbl_bod' } }] },
                keyField: 'id', identity: 'id', defaultMode: 'upsert', level: 2, parentLevel: 1, relationField: 'messages_body_ref', expandFrom: 'attachments', tool: 'gmail_read', rowCount: 3 },
        ] };
        authFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => proposal({ mode: 'none', field: null, param: null, format: null }, { tableSet }) });
        const onCreateTables = vi.fn();
        const { getByRole, findByText, getByText } = renderPanel({ onCreateTables });

        fireEvent.click(getByRole('button', { name: /set up a table/i }));
        expect(await findByText(/3 different things/i)).toBeTruthy();
        expect(getByText(/one row per Messages row/i)).toBeTruthy();
        expect(getByText(/one row per attachment,/i)).toBeTruthy();

        fireEvent.click(getByRole('button', { name: /create it/i }));
        const [tables, sync] = onCreateTables.mock.calls[0];
        expect(tables.map((t) => t.id)).toEqual(['tbl_msg', 'tbl_bod', 'tbl_att']);
        expect(sync.tableId).toBe('tbl_msg');
        // Each child names the grain it stores and the column that joins it.
        expect(sync.children).toEqual([
            { tableId: 'tbl_bod', level: 1, parentLevel: 0, relationField: 'messages_ref', mode: 'replace' },
            { tableId: 'tbl_att', level: 2, parentLevel: 1, relationField: 'messages_body_ref', mode: 'upsert', keyField: 'id' },
        ]);
    });

    it("describes the 'request' tier as fetching less, not just writing less", async () => {
        authFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => proposal({ mode: 'request', field: 'updated_at', param: 'updatedAfter', format: 'iso' }) });
        const { getByRole, findByText } = renderPanel();
        fireEvent.click(getByRole('button', { name: /set up a table/i }));
        expect(await findByText(/Only fetch what changed/i)).toBeTruthy();
    });

    it("is honest that the 'client' tier does not reduce API calls", async () => {
        authFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => proposal({ mode: 'client', field: 'modifiedTime', param: null, format: 'iso' }) });
        const { getByRole, findByText } = renderPanel();
        fireEvent.click(getByRole('button', { name: /set up a table/i }));
        expect(await findByText(/Only save what changed/i)).toBeTruthy();
        expect(await findByText(/does not reduce API calls/i)).toBeTruthy();
    });

    it('offers NO incremental option when nothing says when a record changed', async () => {
        authFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => proposal({ mode: 'none', field: null, param: null, format: null }) });
        const { getByRole, findByText, queryByText, onCreateTable } = renderPanel();
        fireEvent.click(getByRole('button', { name: /set up a table/i }));

        expect(await findByText(/every refresh reloads the full list/i)).toBeTruthy();
        expect(queryByText(/Only fetch what changed/i)).toBeNull();
        expect(queryByText(/Only save what changed/i)).toBeNull();

        fireEvent.click(getByRole('button', { name: /create it/i }));
        expect(onCreateTable.mock.calls[0][1].incremental).toBeUndefined();
    });

    it('says a source with no row identity can only be replaced wholesale', async () => {
        authFetch.mockResolvedValueOnce({
            ok: true, status: 200,
            json: async () => proposal({ mode: 'none' }, { identity: null, keyField: null, defaultMode: 'replace' }),
        });
        const { getByRole, findByText, onCreateTable } = renderPanel();
        fireEvent.click(getByRole('button', { name: /set up a table/i }));
        expect(await findByText(/each refresh replaces the whole table/i)).toBeTruthy();

        fireEvent.click(getByRole('button', { name: /create it/i }));
        expect(onCreateTable.mock.calls[0][1].mode).toBe('replace');
        expect(onCreateTable.mock.calls[0][1].keyField).toBeUndefined();
    });

    it('an unsaved draft SAVES first instead of going grey', async () => {
        // Reading the columns needs the saved connector — but a disabled button
        // whose fix is another button in a different part of the window is not
        // an explanation, it is a puzzle. The action does the save.
        authFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => proposal({ mode: 'none' }) });
        const onSave = vi.fn().mockResolvedValue(true);
        const { getByRole, findByRole } = renderPanel({ saved: false, onSave });

        const btn = getByRole('button', { name: /save & set up a table/i });
        expect(btn.disabled).toBe(false);
        fireEvent.click(btn);
        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
        // …and the inspect really ran against the just-saved model.
        expect(await findByRole('button', { name: /create it/i })).toBeTruthy();
    });

    it('a FAILED save cancels the action — it never inspects a stale model', async () => {
        const onSave = vi.fn().mockResolvedValue(false);
        const { getByRole } = renderPanel({ saved: false, onSave });
        fireEvent.click(getByRole('button', { name: /save & set up a table/i }));
        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
        expect(authFetch).not.toHaveBeenCalled();
    });

    it('explains a 404 as "save first" rather than showing a raw status', async () => {
        authFetch.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: 'Connector not found' }) });
        const { getByRole, findByRole } = renderPanel();
        fireEvent.click(getByRole('button', { name: /set up a table/i }));
        expect((await findByRole('alert')).textContent).toMatch(/Save your changes first/i);
    });
});

describe('ConnectorSyncPanel — once it fills a table', () => {
    const SYNCED = {
        ...CONNECTOR,
        sync: {
            tableId: 'tbl_new001', mode: 'upsert', keyField: 'id',
            incremental: { field: 'modifiedTime', format: 'iso' },
            schedule: { everyMinutes: 60 }, refreshOnView: true,
        },
    };
    const TABLES = [{ id: 'tbl_new001', key: 'recent_emails', name: 'Recent emails', fields: [] }];

    it('names the table it fills and offers all three refresh triggers', async () => {
        const { getByRole, getByText, findByText } = renderPanel({ connector: SYNCED, tables: TABLES });
        expect(await findByText(/Fills the table “Recent emails”/i)).toBeTruthy();
        // The user picked all three: a schedule, on-view, and manual.
        expect(getByRole('combobox', { name: /refresh schedule/i })).toBeTruthy();
        expect(getByText(/refresh when someone opens the app/i)).toBeTruthy();
        expect(getByRole('button', { name: /refresh now/i })).toBeTruthy();
    });

    it('changes the cadence without dropping the rest of the sync block', async () => {
        const { getByRole, onChange } = renderPanel({ connector: SYNCED, tables: TABLES });
        fireEvent.change(getByRole('combobox', { name: /refresh schedule/i }), { target: { value: '1440' } });
        const patched = onChange.mock.calls[0][0].sync;
        expect(patched.schedule).toEqual({ everyMinutes: 1440 });
        expect(patched.tableId).toBe('tbl_new001');
        expect(patched.incremental).toEqual({ field: 'modifiedTime', format: 'iso' });
    });

    it('switches to a custom cron schedule', () => {
        const { getByRole, onChange } = renderPanel({ connector: SYNCED, tables: TABLES });
        fireEvent.change(getByRole('combobox', { name: /refresh schedule/i }), { target: { value: 'cron' } });
        expect(onChange.mock.calls[0][0].sync.schedule.cron).toBeTruthy();
    });

    it('reports what a manual refresh actually did', async () => {
        authFetch
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ syncs: [] }) })
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ inserted: 3, updated: 2, skipped: 7 }) });
        const { getByRole, findByText } = renderPanel({ connector: SYNCED, tables: TABLES });
        fireEvent.click(getByRole('button', { name: /refresh now/i }));
        expect(await findByText(/3 added, 2 updated, 7 unchanged/i)).toBeTruthy();
    });

    it('surfaces a silently failing schedule instead of leaving stale data unexplained', async () => {
        authFetch.mockResolvedValue({
            ok: true, status: 200,
            json: async () => ({ syncs: [{ connectorId: 'conn_abc123', status: 'error', lastError: 'gmail is not connected', lastRunAt: '2026-08-01T00:00:00Z' }] }),
        });
        const { findByRole } = renderPanel({ connector: SYNCED, tables: TABLES });
        await waitFor(async () => expect((await findByRole('alert')).textContent).toMatch(/last refresh failed: gmail is not connected/i));
    });

    it('stops filling the table by dropping the whole sync block', () => {
        const { getByRole, onChange } = renderPanel({ connector: SYNCED, tables: TABLES });
        fireEvent.click(getByRole('button', { name: /stop filling this table/i }));
        expect(onChange).toHaveBeenCalledWith({ sync: undefined });
    });
});

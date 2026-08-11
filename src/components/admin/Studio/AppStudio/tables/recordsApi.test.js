import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));

import { createRecord, listRecords, updateRecord } from './recordsApi';
import { authFetch } from '../../../../../utils/helpers';

/**
 * The record client's whole job is to keep the server's own answer intact: the
 * sentence it wrote for a refusal, and the seconds it asks a bulk import to
 * wait. Losing either leaves the caller inventing text or giving up mid-paste.
 */

function reply(status, body, headers = {}) {
    return {
        ok: status < 400,
        status,
        json: async () => body,
        headers: { get: (name) => headers[name] ?? null },
    };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('recordsApi', () => {
    it('asks for one page and hands back the cursor for the next', async () => {
        authFetch.mockResolvedValue(reply(200, { records: [{ id: 'rec_1' }], nextCursor: 'abc' }));
        const page = await listRecords('app1', 'tbl_a', { limit: 100 });

        expect(authFetch.mock.calls[0][0]).toBe('/api/studio-apps/app1/data/tables/tbl_a/records?limit=100');
        expect(page).toEqual({ records: [{ id: 'rec_1' }], nextCursor: 'abc' });
    });

    it('sends a write as { values } and returns the row the server stored', async () => {
        authFetch.mockResolvedValue(reply(200, { success: true, record: { id: 'rec_1', amount: 12 } }));
        const res = await updateRecord('app1', 'tbl_a', 'rec_1', { amount: 12 });

        const [url, options] = authFetch.mock.calls[0];
        expect(url).toBe('/api/studio-apps/app1/data/tables/tbl_a/records/rec_1');
        expect(options.method).toBe('PATCH');
        expect(JSON.parse(options.body)).toEqual({ values: { amount: 12 } });
        expect(res.record).toEqual({ id: 'rec_1', amount: 12 });
    });

    it('carries the server’s wording, its code and its Retry-After onto the error', async () => {
        authFetch.mockResolvedValue(reply(429, { error: 'Too many requests — limit is 20 per 60s.' }, { 'Retry-After': '37' }));
        await expect(createRecord('app1', 'tbl_a', {})).rejects.toMatchObject({
            status: 429,
            retryAfter: 37,
            message: 'Too many requests — limit is 20 per 60s.',
        });

        authFetch.mockResolvedValue(reply(409, { error: 'This app has reached its row limit', code: 'quota_exceeded', limit: 1000 }));
        await expect(createRecord('app1', 'tbl_a', {})).rejects.toMatchObject({
            status: 409,
            code: 'quota_exceeded',
            retryAfter: null,
            message: 'This app has reached its row limit',
        });
    });
});

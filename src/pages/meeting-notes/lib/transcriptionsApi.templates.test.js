import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));

import { authFetch } from '../../../utils/helpers';
import {
    regenerateSummary,
    listSummaryTemplates,
    createSummaryTemplate,
    updateSummaryTemplate,
    deleteSummaryTemplate,
} from './transcriptionsApi';

const ok = (body = {}) => ({ ok: true, status: 200, json: async () => body });

function lastCall() {
    const [url, opts] = authFetch.mock.calls[authFetch.mock.calls.length - 1];
    return { url, opts, body: opts?.body ? JSON.parse(opts.body) : undefined };
}

describe('regenerateSummary payload shaping', () => {
    beforeEach(() => { vi.clearAllMocks(); authFetch.mockResolvedValue(ok({ success: true })); });

    it('accepts the legacy string form as a built-in template key', async () => {
        await regenerateSummary('m1', 'standup');
        expect(lastCall().body).toEqual({ template: 'standup' });
    });

    it('defaults to general when given null/undefined', async () => {
        await regenerateSummary('m1', null);
        expect(lastCall().body).toEqual({ template: 'general' });
    });

    it('passes a saved templateId through', async () => {
        await regenerateSummary('m1', { templateId: 'tpl-9' });
        expect(lastCall().body).toEqual({ templateId: 'tpl-9' });
    });

    it('passes an ephemeral customPrompt through', async () => {
        await regenerateSummary('m1', { customPrompt: 'Just the decisions' });
        expect(lastCall().body).toEqual({ customPrompt: 'Just the decisions' });
    });

    it('hits the meeting-scoped regenerate endpoint', async () => {
        await regenerateSummary('m1', 'general');
        expect(lastCall().url).toBe('/api/transcriptions/m1/regenerate-summary');
    });
});

describe('summary template CRUD requests', () => {
    beforeEach(() => { vi.clearAllMocks(); authFetch.mockResolvedValue(ok({})); });

    it('lists via GET /api/summary-templates', async () => {
        await listSummaryTemplates();
        expect(lastCall().url).toBe('/api/summary-templates');
    });

    it('creates via POST with the scope/name/prompt body', async () => {
        await createSummaryTemplate({ scope: 'group', name: 'G', prompt: 'p', groupId: 'g2', isDefault: true });
        const { url, opts, body } = lastCall();
        expect(url).toBe('/api/summary-templates');
        expect(opts.method).toBe('POST');
        expect(body).toEqual({ scope: 'group', name: 'G', prompt: 'p', groupId: 'g2', isDefault: true });
    });

    it('updates via PATCH /api/summary-templates/:id', async () => {
        await updateSummaryTemplate('tpl-1', { name: 'Renamed', isDefault: false });
        const { url, opts, body } = lastCall();
        expect(url).toBe('/api/summary-templates/tpl-1');
        expect(opts.method).toBe('PATCH');
        expect(body).toEqual({ name: 'Renamed', isDefault: false });
    });

    it('deletes via DELETE /api/summary-templates/:id', async () => {
        authFetch.mockResolvedValue({ ok: true, status: 200 });
        await deleteSummaryTemplate('tpl-1');
        const { url, opts } = lastCall();
        expect(url).toBe('/api/summary-templates/tpl-1');
        expect(opts.method).toBe('DELETE');
    });
});

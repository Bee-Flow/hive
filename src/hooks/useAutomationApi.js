import { useCallback } from 'react';
import { API_BASE, authFetch } from '../utils/helpers';

/**
 * REST helpers for the automation builder. Thin wrapper over authFetch so
 * components don't have to repeat the URL prefix and JSON handshake.
 */
export default function useAutomationApi() {
    const get = useCallback(async (path) => {
        const r = await authFetch(`${API_BASE}/api/automation${path}`);
        if (!r.ok) throw new Error((await safeText(r)) || `GET ${path} failed`);
        return r.json();
    }, []);

    const send = useCallback(async (method, path, body) => {
        const r = await authFetch(`${API_BASE}/api/automation${path}`, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!r.ok) throw new Error((await safeText(r)) || `${method} ${path} failed`);
        return r.json();
    }, []);

    return {
        listAutomations: () => get('/'),
        getAutomation: (id) => get(`/${id}`),
        createAutomation: (body) => send('POST', '/', body),
        updateAutomation: (id, body) => send('PUT', `/${id}`, body),
        deleteAutomation: (id) => send('DELETE', `/${id}`),
        activate: (id) => send('POST', `/${id}/activate`),
        deactivate: (id) => send('POST', `/${id}/deactivate`),
        run: (id, body) => send('POST', `/${id}/run`, body || {}),
        dryRun: (id, body) => send('POST', `/${id}/dry-run`, body || {}),
        listRuns: (id) => get(`/${id}/runs`),
        getRun: (runId) => get(`/runs/${runId}`),
        getRunSteps: (runId) => get(`/runs/${runId}/steps`),
        approveRun: (runId) => send('POST', `/runs/${runId}/approve`),
        listVersions: (id) => get(`/${id}/versions`),
        createWebhook: (id) => send('POST', `/${id}/webhook`),
        listWebhooks: (id) => get(`/${id}/webhooks`),
        getCatalog: () => get('/catalog'),
    };
}

async function safeText(r) {
    try { const j = await r.json(); return j.error || JSON.stringify(j); } catch { return r.statusText; }
}

import { useCallback, useMemo } from 'react';
import { API_BASE, authFetch } from '../utils/helpers';

/**
 * REST helpers for the automation builder. Thin wrapper over authFetch so
 * components don't have to repeat the URL prefix and JSON handshake.
 *
 * The returned object is memoised with useMemo so callers can use it as a
 * stable useEffect dependency. Without this, each render produced a new
 * object literal with new arrow-function members; consumers like
 * VersionHistoryPanel and WebhookPanel keyed a reload callback on `api`,
 * which then re-fired on every render and ran the browser out of sockets
 * (ERR_INSUFFICIENT_RESOURCES).
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

    return useMemo(() => ({
        listAutomations: () => get('/'),
        getAutomation: (id) => get(`/${id}`),
        createAutomation: (body) => send('POST', '/', body),
        updateAutomation: (id, body) => send('PUT', `/${id}`, body),
        deleteAutomation: (id) => send('DELETE', `/${id}`),
        activate: (id) => send('POST', `/${id}/activate`),
        deactivate: (id) => send('POST', `/${id}/deactivate`),
        run: (id, body) => send('POST', `/${id}/run`, body || {}),
        dryRun: (id, body) => send('POST', `/${id}/dry-run`, body || {}),
        diagnoseTrigger: (id) => send('POST', `/${id}/diagnose-trigger`),
        listRuns: (id) => get(`/${id}/runs`),
        listRecentRuns: (limit = 50) => get(`/_runs/recent?limit=${encodeURIComponent(limit)}`),
        getActiveRuns: () => get('/_runs/active'),
        previewSchedule: (cron, tz, count = 3) => send('POST', '/_schedule/preview', { cron, tz, count }),
        // Cross-route helper: read the user's Ticket Assistant connections
        // so the trigger settings form can render a connection picker.
        // Bypasses the /api/automation prefix because the TA route lives
        // at /api/ticket-assistant.
        listTicketAssistantConnections: async () => {
            const r = await authFetch(`${API_BASE}/api/ticket-assistant/connections`);
            if (!r.ok) throw new Error((await safeText(r)) || 'GET /ticket-assistant/connections failed');
            return r.json();
        },
        getRun: (runId) => get(`/runs/${runId}`),
        getRunSteps: (runId) => get(`/runs/${runId}/steps`),
        approveRun: (runId) => send('POST', `/runs/${runId}/approve`),
        // Run cancel + retry — wire UI buttons in RunHistory to these.
        // retryRun re-fires `executeAutomation` server-side with a
        // parent_run_id link so the history shows the lineage; cancelRun
        // flips cancel_requested in the DB and aborts the in-process
        // controller (cross-pod safe).
        retryRun: (id, runId) => send('POST', `/${id}/runs/${runId}/retry`),
        cancelRun: (runId) => send('POST', `/runs/${runId}/cancel`),
        approveStep: (runId, decision, reason) => send('POST', `/runs/${runId}/approve-step`, { decision, reason }),
        listVersions: (id) => get(`/${id}/versions`),
        getVersion: (id, versionId) => get(`/${id}/versions/${versionId}`),
        // Restore a historical version. Server validates the stored
        // definition (some step types or tool names may have been removed
        // since) and bumps the version counter so the restore itself shows
        // up as a new entry in the history.
        restoreVersion: (id, versionId) => send('POST', `/${id}/versions/${versionId}/restore`),
        createWebhook: (id) => send('POST', `/${id}/webhook`),
        listWebhooks: (id) => get(`/${id}/webhooks`),
        // Webhook secret rotation invalidates the previous secret
        // immediately. The new secret is returned ONCE — surface it in the
        // UI so the user copies it before navigating away.
        rotateWebhook: (id, slug) => send('POST', `/${id}/webhook/${slug}/rotate`),
        deleteWebhook: (id, slug) => send('DELETE', `/${id}/webhook/${slug}`),
        getCatalog: () => get('/catalog'),
        // Curated template gallery shown in the EmptyState. listTemplates
        // returns metadata only; getTemplate fetches the full definition
        // so the builder can pre-fill via createAutomation.
        listTemplates: () => get('/templates'),
        getTemplate: (templateId) => get(`/templates/${templateId}`),
    }), [get, send]);
}

async function safeText(r) {
    try {
        const j = await r.json();
        // Surface validator details so the user can see WHY the definition is rejected.
        if (j.error && Array.isArray(j.details) && j.details.length) {
            return `${j.error}: ${j.details.join('; ')}`;
        }
        return j.error || JSON.stringify(j);
    } catch { return r.statusText; }
}

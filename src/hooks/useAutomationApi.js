import { useCallback, useMemo } from 'react';
import { API_BASE, authFetch } from '../utils/helpers';
import { readEventStream } from '../utils/sseStream';

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

    // Reusable Steps (kind='block') live under a sibling /api/step router.
    const stepGet = useCallback(async (path) => {
        const r = await authFetch(`${API_BASE}/api/step${path}`);
        if (!r.ok) {
            // Attach status so callers can tell a 404 (feature flag off / server
            // without the /api/step routes yet) from a real failure and hide the
            // Steps tab cleanly instead of letting saves fail later.
            const err = new Error((await safeText(r)) || `GET ${path} failed`);
            err.status = r.status;
            throw err;
        }
        return r.json();
    }, []);
    const stepSend = useCallback(async (method, path, body) => {
        const r = await authFetch(`${API_BASE}/api/step${path}`, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!r.ok) {
            const err = new Error((await safeText(r)) || `${method} ${path} failed`);
            err.status = r.status;
            throw err;
        }
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
        // Executions list — cursor-paginated + filterable. `opts`:
        // { limit, cursor, status, trigger, mode, automationId, kind, since, until }.
        // Returns { runs, nextCursor }. listStepRuns is the same route (a Step's
        // runs are automation_runs with automation_id = the block id).
        listRuns: (id, opts = {}) => get(`/${id}/runs${buildRunQuery(opts)}`),
        listStepRuns: (stepId, opts = {}) => get(`/${stepId}/runs${buildRunQuery(opts)}`),
        listRecentRuns: (opts = {}) => get(`/_runs/recent${buildRunQuery(opts)}`),
        // Facet counts for the filter chips. { range (hours), automationId, kind, mode }.
        getRunFacets: (opts = {}) => get(`/_runs/facets${buildFacetQuery(opts)}`),
        getActiveRuns: () => get('/_runs/active'),
        // Live run-lifecycle SSE (fetch-streamed so X-Session-Token auth applies;
        // EventSource can't set headers). Optionally scoped to one automation.
        // onEvent(type, data) is called per event; resolves when the stream ends
        // or `signal` aborts. Throws on connect failure so callers fall back.
        streamRuns: async ({ automationId = null, signal, onEvent } = {}) => {
            const qs = automationId ? `?automationId=${encodeURIComponent(automationId)}` : '';
            const r = await authFetch(`${API_BASE}/api/automation/_runs/stream${qs}`, { signal });
            if (!r.ok || !r.body) {
                const err = new Error((await safeText(r)) || 'runs stream failed');
                err.status = r.status;
                throw err;
            }
            await readEventStream(r.body, (evt, data) => onEvent?.(data?.type || evt, data), signal);
        },
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
        // Cross-route helpers: reusable HTTP credentials (org vault) for the
        // http_request step's Authentication picker. Live under
        // /api/integrations/connections; includeShared adds credentials lent
        // to this user (marked access:'lent'). Responses never contain the
        // secret — write-only by API contract.
        listHttpConnections: async () => {
            const r = await authFetch(`${API_BASE}/api/integrations/connections?provider=http&includeShared=1`);
            if (!r.ok) throw new Error((await safeText(r)) || 'GET /integrations/connections failed');
            return r.json();
        },
        createHttpConnection: async (body) => {
            const r = await authFetch(`${API_BASE}/api/integrations/connections`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body || {}),
            });
            if (!r.ok) throw new Error((await safeText(r)) || 'POST /integrations/connections failed');
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
        // `triggerStepId` scopes the new webhook to ONE webhook-kind trigger
        // node, so an automation with several of them gets a distinct URL each.
        // The server has always validated and stored this; the client just
        // never sent it, so every webhook was primary-trigger-scoped (BFSF-320).
        // Omitted → the primary trigger, the pre-existing behaviour.
        createWebhook: (id, triggerStepId = null) => send('POST', `/${id}/webhook`, triggerStepId ? { triggerStepId } : {}),
        listWebhooks: (id) => get(`/${id}/webhooks`),
        // Webhook secret rotation invalidates the previous secret
        // immediately. The new secret is returned ONCE — surface it in the
        // UI so the user copies it before navigating away.
        rotateWebhook: (id, slug) => send('POST', `/${id}/webhook/${slug}/rotate`),
        deleteWebhook: (id, slug) => send('DELETE', `/${id}/webhook/${slug}`),
        // Hosted form pages (trigger kind 'form'). Unlike a webhook there is no
        // secret to reveal: the URL token IS the credential, so rotating mints
        // a whole new URL and the old one 404s immediately.
        createFormPage: (id, triggerStepId = null) => send('POST', `/${id}/form`, triggerStepId ? { triggerStepId } : {}),
        listFormPages: (id) => get(`/${id}/forms`),
        rotateFormPage: (id, token) => send('POST', `/${id}/form/${token}/rotate`),
        deleteFormPage: (id, token) => send('DELETE', `/${id}/form/${token}`),
        getCatalog: () => get('/catalog'),
        // AI one-liner describing what a layer does. Opt-in (gated behind an
        // off-by-default checkbox in the Layers drawer) — stateless: we send
        // the layer mini-definition the user is looking at and get { summary }.
        summariseLayer: (layer) => send('POST', '/builder/summarise-layer', { layer }),
        // Auto-label + auto-icon: the FAST tier names steps that are still
        // unnamed (empty + not user-locked). `allowedIcons` is the client's
        // renderable icon-name set so the model can only return icons we draw.
        labelSteps: (definition, allowedIcons) => send('POST', '/builder/label-steps', { definition, allowedIcons }),
        // Design-time "Map with AI" for the parse_json step: sample + plain-
        // language instruction → deterministic field paths, verified server-
        // side against the sample. Returns { fields: [{ name, path,
        // description, verified, sampleValue? }] }.
        mapJsonFields: (sample, instruction, existingFields) => send('POST', '/builder/map-json-fields', { sample, instruction, existingFields }),
        // Curated template gallery shown in the EmptyState. listTemplates
        // returns metadata only; getTemplate fetches the full definition
        // so the builder can pre-fill via createAutomation.
        listTemplates: () => get('/templates'),
        getTemplate: (templateId) => get(`/templates/${templateId}`),
        // ── Reusable Steps (kind='block') — the /api/step router ──────
        // A Step is a standalone Flowlet (one input contract + output) built in
        // the same builder, published, then added to automations (call_block)
        // or exposed in chat. publishStep rolls the draft out to consumers.
        listSteps: () => stepGet('/'),
        getStep: (id) => stepGet(`/${id}`),
        createStep: (body) => stepSend('POST', '/', body),
        updateStep: (id, body) => stepSend('PUT', `/${id}`, body),
        deleteStep: (id) => stepSend('DELETE', `/${id}`),
        publishStep: (id) => stepSend('POST', `/${id}/publish`),
        setStepSharing: (id, body) => stepSend('PUT', `/${id}/sharing`, body),
        setStepExpose: (id, exposeAsTool) => stepSend('PUT', `/${id}/expose`, { exposeAsTool }),
        listStepVersions: (id) => stepGet(`/${id}/versions`),
        testStep: (id, inputs) => stepSend('POST', `/${id}/test`, { inputs }),
        // "Find repeating work" — runs a read-only scan of the user's
        // connected tools and returns automation suggestions (specs only).
        // The caller feeds a chosen suggestion's buildPrompt into the builder.
        // SSE: streams `phase` / `model` / `scan_step` / `done` / `error`
        // events (and, optionally, a future per-suggestion `suggestion` event)
        // so the UI can show a live scan log; resolves when the stream ends.
        // Pass an AbortSignal to cancel the scan (e.g. on unmount). The body's
        // `force:true` (set by Re-scan) tells the backend to bypass any
        // server-side scan cache — harmless to send before that lands.
        suggestAutomationsStream: async (body, onEvent, signal) => {
            const r = await authFetch(`${API_BASE}/api/automation/builder/suggest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body || {}),
                signal,
            });
            if (!r.ok || !r.body) {
                // Preserve the HTTP status + Retry-After so callers can tell a
                // rate-limit cooldown (429) apart from a real failure.
                const msg = (await safeText(r)) || 'Suggestion scan failed';
                const err = new Error(msg);
                err.status = r.status;
                const ra = Number(r.headers.get('Retry-After'));
                if (Number.isFinite(ra) && ra > 0) err.retryAfter = ra;
                throw err;
            }
            await readEventStream(r.body, onEvent, signal);
        },
        // Last persisted scan for this user (server-side cache), so the section
        // can paint instantly without re-scanning. Optional endpoint — tolerate
        // 204 (no body) / 404 (route not deployed yet) by resolving to null so
        // the FE degrades gracefully before the backend lands.
        getLastScan: async () => {
            try {
                const r = await authFetch(`${API_BASE}/api/automation/builder/suggest/last`);
                if (r.status === 204 || r.status === 404) return null;
                if (!r.ok) return null;
                const text = await r.text();
                if (!text) return null;
                try { return JSON.parse(text); } catch { return null; }
            } catch {
                return null;
            }
        },
        // Best-effort feedback signal for a suggestion ('built' | 'asked' |
        // 'dismissed'). Used to improve future ranking. Fire-and-forget:
        // swallow any error (incl. the route not existing yet) so it never
        // blocks the user's action.
        recordSuggestionFeedback: async (body) => {
            try {
                await authFetch(`${API_BASE}/api/automation/builder/feedback`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body || {}),
                });
            } catch {
                /* best-effort — never surface */
            }
        },
    }), [get, send, stepGet, stepSend]);
}

export async function safeText(r) {
    try {
        const j = await r.json();
        // Surface validator details so the user can see WHY the definition is
        // rejected. `details` is an array of structured records
        // ({code, message, hint, ...}) — render their human messages, not the
        // raw objects (which would stringify to "[object Object]").
        if (j.error && Array.isArray(j.details) && j.details.length) {
            const msgs = j.details.map(detailText).filter(Boolean);
            return msgs.length ? `${j.error}: ${msgs.join('; ')}` : j.error;
        }
        return j.error || JSON.stringify(j);
    } catch { return r.statusText; }
}

/**
 * One validator detail as a sentence — INCLUDING its hint (BFSF-348).
 *
 * Every record the server rejects a definition with carries both a `message`
 * ("Step step_7: a form step needs the routine to start with a form trigger")
 * and a `hint` ("Switch the trigger to Form, or remove this step") — the
 * message says what is wrong, the hint says what to do about it. We used to
 * drop the hint on the floor, which left the user staring at a rule with no
 * way out of it: the one actionable half of the error was fetched, parsed and
 * then discarded.
 *
 * The hint is skipped when the message already contains it, so a server that
 * spells both into `message` doesn't produce a stutter.
 */
function detailText(d) {
    if (typeof d === 'string') return d;
    if (!d) return '';
    const message = d.message || d.code || '';
    const hint = typeof d.hint === 'string' ? d.hint.trim() : '';
    if (!hint || message.includes(hint)) return message;
    return message ? `${message} — ${hint}` : hint;
}

// Build the executions list query string. Arrays (status/trigger/mode) are
// sent comma-separated; the server parses them back into ANY(...) filters.
function buildRunQuery(opts = {}) {
    const p = new URLSearchParams();
    const csv = (v) => (Array.isArray(v) ? v.filter(Boolean).join(',') : v);
    if (opts.limit != null) p.set('limit', String(opts.limit));
    if (opts.cursor) p.set('cursor', opts.cursor);
    if (opts.automationId) p.set('automationId', opts.automationId);
    if (opts.kind) p.set('kind', opts.kind);
    const status = csv(opts.status); if (status) p.set('status', status);
    const trigger = csv(opts.trigger || opts.triggerKind); if (trigger) p.set('triggerKind', trigger);
    const mode = csv(opts.mode); if (mode) p.set('mode', mode);
    if (opts.since) p.set('since', opts.since);
    if (opts.until) p.set('until', opts.until);
    const qs = p.toString();
    return qs ? `?${qs}` : '';
}

function buildFacetQuery(opts = {}) {
    const p = new URLSearchParams();
    if (opts.range != null) p.set('range', String(opts.range));
    if (opts.automationId) p.set('automationId', opts.automationId);
    if (opts.kind) p.set('kind', opts.kind);
    const mode = Array.isArray(opts.mode) ? opts.mode.filter(Boolean).join(',') : opts.mode;
    if (mode) p.set('mode', mode);
    const qs = p.toString();
    return qs ? `?${qs}` : '';
}

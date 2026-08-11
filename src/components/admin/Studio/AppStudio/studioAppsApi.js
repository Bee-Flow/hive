/**
 * App Studio — client API for /api/studio-apps (see server/routes/studioApps.js
 * and server/routes/studioAppsRun.js). Thin fetch wrappers over the house
 * authFetch; every function throws an Error with .status and .body on non-2xx
 * EXCEPT saveDefinition, whose 409/422 are expected flows returned as values.
 */

import { API_BASE, authFetch } from '../../../../utils/helpers';

const base = `${API_BASE}/api/studio-apps`;
const enc = encodeURIComponent;

async function request(url, options = {}) {
    const res = await authFetch(url, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options,
    });
    let body = null;
    try { body = await res.json(); } catch { /* empty/non-JSON body */ }
    if (!res.ok) {
        // Prefer the server's structured error/code (e.g. the 409 quota body
        // { error, code:'quota_exceeded', limit, used }) over the generic text.
        const err = new Error(body?.error || `Request failed (${res.status})`);
        err.status = res.status;
        err.code = body?.code || null;
        err.body = body;
        throw err;
    }
    return body;
}

export const studioAppsApi = {
    // Catalog / templates
    getCatalog: () => request(`${base}/catalog`),
    listTemplates: () => request(`${base}/templates`),
    getTemplate: (templateId) => request(`${base}/templates/${enc(templateId)}`),

    // Apps
    listAccessible: () => request(base),
    listMine: () => request(`${base}/mine`),
    /** body: { name?, description?, icon?, accentColor?, templateId? } */
    createApp: (body = {}) => request(base, { method: 'POST', body: JSON.stringify(body) }),
    getApp: (id) => request(`${base}/${enc(id)}`),
    updateApp: (id, meta) => request(`${base}/${enc(id)}`, { method: 'PUT', body: JSON.stringify(meta) }),
    deleteApp: (id) => request(`${base}/${enc(id)}`, { method: 'DELETE' }),

    /**
     * Autosave the working draft. Returns (never throws for these flows):
     *   { ok:true, version, warnings, repairs }
     *   { ok:false, conflict:true, currentVersion, definition }   // 409
     *   { ok:false, invalid:true, errors, warnings }              // 422
     * Other statuses throw (incl. 413 definition_too_large).
     */
    saveDefinition: async (id, definition, baseVersion) => {
        try {
            const body = await request(`${base}/${enc(id)}/definition`, {
                method: 'PUT',
                body: JSON.stringify({ definition, baseVersion }),
            });
            return { ok: true, ...body };
        } catch (err) {
            if (err.status === 409) return { ok: false, conflict: true, ...(err.body || {}) };
            if (err.status === 422) return { ok: false, invalid: true, ...(err.body || {}) };
            throw err;
        }
    },

    /** body: { isPublished, sharedGroups? } */
    publish: (id, body) => request(`${base}/${enc(id)}/publish`, { method: 'PATCH', body: JSON.stringify(body) }),

    // Versions
    listVersions: (id) => request(`${base}/${enc(id)}/versions`),
    restoreVersion: (id, versionId) =>
        request(`${base}/${enc(id)}/versions/${enc(versionId)}/restore`, { method: 'POST' }),

    // Run view payload ({ id, name, icon, accentColor, definition, draft? })
    getRuntime: (id, { draft = false } = {}) =>
        request(`${base}/${enc(id)}/runtime${draft ? '?draft=1' : ''}`),

    // Actions (the run bridge; useActionRunner drives these in run mode)
    runAction: (appId, actionId, { formValues = {}, draft = false } = {}) =>
        request(`${base}/${enc(appId)}/actions/${enc(actionId)}/run${draft ? '?draft=1' : ''}`, {
            method: 'POST',
            body: JSON.stringify({ formValues, wait: true }),
        }),
    getActionRun: (appId, runId) => request(`${base}/${enc(appId)}/actions/runs/${enc(runId)}`),

    // AI builder — rehydrates the persisted chat session after a refresh.
    getBuilderSession: (appId) => request(`${base}/builder/session/${enc(appId)}`),

    // Data model (owner-only). getSchema → { model, modelVersion }.
    getSchema: (id) => request(`${base}/${enc(id)}/schema`),
    /**
     * Persist the data model. Returns (never throws for these flows):
     *   { ok:true, version }
     *   { ok:false, conflict:true, currentVersion, model }     // 409
     *   { ok:false, invalid:true, errors }                     // 422
     */
    saveSchema: async (id, model, expectedVersion) => {
        try {
            const body = await request(`${base}/${enc(id)}/schema`, {
                method: 'PUT',
                body: JSON.stringify({ model, expectedVersion }),
            });
            return { ok: true, ...body };
        } catch (err) {
            if (err.status === 409) return { ok: false, conflict: true, ...(err.body || {}) };
            if (err.status === 422) return { ok: false, invalid: true, ...(err.body || {}) };
            throw err;
        }
    },
};

export default studioAppsApi;

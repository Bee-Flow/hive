/**
 * notebookApi.js — shared HTTP helpers for the Notebooks + Legal surfaces.
 *
 * Extracted from NotebooksPage so the page and the V2 workspace
 * hooks all hit the `/api/notebooks/*` endpoints through one definition instead
 * of copy-pasting the fetch+error-handling boilerplate. Both surfaces use the
 * notebook endpoints for sources / generation / export / document-save (Legal
 * keeps its own `/api/legal-matters/*` calls for matter-specific data).
 */
import { API_BASE, authFetch } from '../../../utils/helpers';

/** GET/POST/PUT/DELETE against `/api/notebooks{path}`. `path === '/'` lists. */
export async function notebookApi(path, opts = {}) {
    const url = `${API_BASE}/api/notebooks${path === '/' ? '' : path}`;
    const res = await authFetch(url, {
        headers: { 'Content-Type': 'application/json', ...opts.headers },
        ...opts,
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('[Notebooks] API error:', res.status, data);
        const err = new Error(data.error || `API ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return res.json();
}

/** Multipart upload of a single source file to a notebook/matter. */
export async function uploadSourceFile(entityId, file) {
    const form = new FormData();
    form.append('file', file);
    const res = await authFetch(`${API_BASE}/api/notebooks/${entityId}/sources/file`, {
        method: 'POST',
        body: form,
    });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
}

/** Extracted text of a source (preview panel). */
export function getSourceContent(entityId, sid) {
    return notebookApi(`/${entityId}/sources/${sid}/content`);
}

/** Rename a source. */
export function renameSource(entityId, sid, name) {
    return notebookApi(`/${entityId}/sources/${sid}`, { method: 'PATCH', body: JSON.stringify({ name }) });
}

/** Persist a manual source ordering. */
export function reorderSourcesApi(entityId, orderedIds) {
    return notebookApi(`/${entityId}/sources/reorder`, { method: 'PATCH', body: JSON.stringify({ orderedIds }) });
}

/** Delete several sources at once. */
export function bulkDeleteSourcesApi(entityId, ids) {
    return notebookApi(`/${entityId}/sources/bulk-delete`, { method: 'POST', body: JSON.stringify({ ids }) });
}

import { API_BASE, authFetch } from '../../../utils/helpers';

async function jsonOrThrow(res) {
    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        let code = null;
        try {
            const body = await res.json();
            if (body?.error) msg = body.error;
            if (body?.code) code = body.code;
        } catch (_) { /* ignore */ }
        const err = new Error(msg);
        err.status = res.status;
        if (code) err.code = code;
        throw err;
    }
    return res.json();
}

export async function listTranscriptions() {
    const res = await authFetch(`${API_BASE}/api/transcriptions`);
    const data = await jsonOrThrow(res);
    return data.transcriptions || [];
}

export async function getTranscription(id) {
    const res = await authFetch(`${API_BASE}/api/transcriptions/${id}`);
    return jsonOrThrow(res);
}

export async function uploadAudio({ file, language, title, contextTerms, provider, signal }) {
    const formData = new FormData();
    formData.append('audio', file);
    formData.append('language', language);
    formData.append('title', title);
    if (contextTerms) formData.append('context_terms', contextTerms);
    if (provider) formData.append('provider', provider);
    const res = await authFetch(`${API_BASE}/api/transcriptions`, {
        method: 'POST',
        body: formData,
        signal,
    });
    return jsonOrThrow(res);
}

export async function uploadFromNextcloud({ path, language, title, contextTerms, provider }) {
    const res = await authFetch(`${API_BASE}/api/transcriptions/from-nextcloud`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            nextcloud_path: path,
            language,
            title,
            context_terms: contextTerms,
            provider: provider || undefined,
        }),
    });
    return jsonOrThrow(res);
}

export async function listNextcloudAudioFiles(folder = '/Recordings') {
    const res = await authFetch(
        `${API_BASE}/api/transcriptions/nextcloud-audio-files?folder=${encodeURIComponent(folder)}`,
    );
    const data = await jsonOrThrow(res);
    return data.items || [];
}

/**
 * List Nextcloud Talk call recordings grouped by conversation (room token).
 * Pass a `folder` to override the configured Talk recordings folder.
 * Returns `{ folder, count, rooms: [{ token, recordings: [{ name, path, size, lastModified, kind }] }] }`.
 */
export async function listNextcloudTalkRecordings(folder) {
    const qs = folder ? `?folder=${encodeURIComponent(folder)}` : '';
    const res = await authFetch(`${API_BASE}/api/transcriptions/nextcloud-talk-recordings${qs}`);
    return jsonOrThrow(res);
}

export async function patchTranscription(id, patch) {
    const res = await authFetch(`${API_BASE}/api/transcriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
    });
    return jsonOrThrow(res);
}

export async function deleteTranscription(id) {
    const res = await authFetch(`${API_BASE}/api/transcriptions/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
}

export async function reprocessTranscription(id) {
    const res = await authFetch(`${API_BASE}/api/transcriptions/${id}/reprocess`, { method: 'POST' });
    return jsonOrThrow(res);
}

export async function regenerateSummary(id, template) {
    const res = await authFetch(`${API_BASE}/api/transcriptions/${id}/regenerate-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template }),
    });
    return jsonOrThrow(res);
}

/**
 * Atomically rename and/or merge speakers on a transcription. Owner-only.
 * Payload mirrors the backend route shape:
 *   { renames: { "Old name": "New name" }, merges: [{ from: ["A","B"], into: "A" }] }
 * Returns the full updated transcription.
 */
export async function updateSpeakers(id, { renames = {}, merges = [] } = {}) {
    const res = await authFetch(`${API_BASE}/api/transcriptions/${id}/speakers`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ renames, merges }),
    });
    return jsonOrThrow(res);
}

/**
 * Publish a transcription to the owner's organisation (or specific groups).
 * Mirrors the publish model used by Knowledge Bases.
 */
export async function publishTranscription(id, isPublished, sharedGroups) {
    const res = await authFetch(`${API_BASE}/api/transcriptions/${id}/publish`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished, sharedGroups: Array.isArray(sharedGroups) ? sharedGroups : [] }),
    });
    return jsonOrThrow(res);
}

export async function exportTranscription(id, format) {
    const res = await authFetch(`${API_BASE}/api/transcriptions/${id}/export?format=${format}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.blob();
}

export function audioUrl(id) {
    return `${API_BASE}/api/transcriptions/${id}/audio`;
}

export async function listOrgUsers() {
    const res = await authFetch(`${API_BASE}/auth/users`);
    return jsonOrThrow(res);
}

export async function listOrgGroups() {
    const res = await authFetch(`${API_BASE}/auth/groups`);
    const data = await jsonOrThrow(res);
    return Array.isArray(data?.groups) ? data.groups : (Array.isArray(data) ? data : []);
}

export async function getAiConfig() {
    const res = await authFetch(`${API_BASE}/api/admin/ai-config`);
    return jsonOrThrow(res);
}

export async function getChatModelTiers() {
    const res = await authFetch(`${API_BASE}/ai/config/chat-models`);
    return jsonOrThrow(res);
}

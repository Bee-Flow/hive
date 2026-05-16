import { API_BASE, authFetch } from '../../../utils/helpers';

async function jsonOrThrow(res) {
    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
            const body = await res.json();
            if (body?.error) msg = body.error;
        } catch (_) { /* ignore */ }
        throw new Error(msg);
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

export async function shareTranscription(id, userIds) {
    const res = await authFetch(`${API_BASE}/api/transcriptions/${id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds }),
    });
    return jsonOrThrow(res);
}

export async function unshareTranscription(id, userIds) {
    const res = await authFetch(`${API_BASE}/api/transcriptions/${id}/unshare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds }),
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

export async function getAiConfig() {
    const res = await authFetch(`${API_BASE}/api/admin/ai-config`);
    return jsonOrThrow(res);
}

export async function getChatModelTiers() {
    const res = await authFetch(`${API_BASE}/ai/config/chat-models`);
    return jsonOrThrow(res);
}

export async function listBotSessions() {
    const res = await authFetch(`${API_BASE}/api/meet-bot/sessions`);
    return jsonOrThrow(res);
}

export async function joinBotToMeeting({ meetLink, title, language }) {
    const res = await authFetch(`${API_BASE}/api/meet-bot/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetLink, title, language }),
    });
    return jsonOrThrow(res);
}

export async function stopBotSession(id) {
    const res = await authFetch(`${API_BASE}/api/meet-bot/sessions/${id}/stop`, { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function getBotCredentials() {
    const res = await authFetch(`${API_BASE}/api/meet-bot/credentials`);
    return jsonOrThrow(res);
}

export async function saveBotCredentials({ email, password }) {
    const res = await authFetch(`${API_BASE}/api/meet-bot/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    return jsonOrThrow(res);
}

export async function listBotPlatforms() {
    const res = await authFetch(`${API_BASE}/api/meet-bot/platforms`);
    const data = await jsonOrThrow(res);
    return Array.isArray(data?.platforms) ? data.platforms : [];
}

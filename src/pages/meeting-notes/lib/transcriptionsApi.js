import { API_BASE, authFetch, isDemoMode } from '../../../utils/helpers';

async function jsonOrThrow(res) {
    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        let code = null;
        try {
            const body = await res.json();
            if (body?.error) msg = body.error;
            if (body?.code) code = body.code;
        } catch (_) { /* ignore */ }
        // A 413 is normally refused by the reverse proxy, not by the API, so
        // there is no JSON to read and the user was shown a bare "HTTP 413"
        // with no hint of what went wrong or what to do about it. Only rewrite
        // when the API itself said nothing — a real API 413 (e.g. the 500 MB
        // cap) carries a better message than we could invent here.
        if (res.status === 413 && msg === `HTTP ${res.status}`) {
            msg = 'The audio file is too large for this server\'s upload limit, so it never reached Bee Flow. '
                + 'Record or upload a shorter session, or ask your administrator to raise the upload limit '
                + '(nginx client_max_body_size / ingress proxy-body-size).';
            code = code || 'payload_too_large';
        }
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

/** "Previously in this series" — the prior note from the same Meet/Talk room, or null. */
export async function getSeriesPrevious(id) {
    const res = await authFetch(`${API_BASE}/api/transcriptions/${id}/series-previous`);
    const data = await jsonOrThrow(res);
    return data.previous || null;
}

/**
 * Multi-meeting AI report: one question over up to 10 selected notes.
 * Returns { report (markdown), usedTranscripts, meetings: [{id,title,createdAt}] }.
 */
export async function reportMeetings({ ids, prompt }) {
    const res = await authFetch(`${API_BASE}/api/transcriptions/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, prompt }),
    });
    return jsonOrThrow(res);
}

export async function uploadAudio({ file, language, title, contextTerms, attendees, numSpeakers, provider, captureMode, signal }) {
    const formData = new FormData();
    formData.append('audio', file);
    // 'recording' | 'upload'. Decides what we can honestly tell the user if the
    // audio is ever missing: a browser recording has no original to re-upload.
    if (captureMode) formData.append('capture_mode', captureMode);
    formData.append('language', language);
    formData.append('title', title);
    if (contextTerms) formData.append('context_terms', contextTerms);
    if (attendees) formData.append('attendees', attendees);
    if (numSpeakers) formData.append('num_speakers', String(numSpeakers));
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

/**
 * The user's upcoming Talk meetings (from their calendar), each with record
 * status. Returns `{ recordingEnabled, autoRecord, autoRecordScope, recordingMode, meetings: [...] }`.
 */
export async function listTalkMeetings() {
    const res = await authFetch(`${API_BASE}/api/transcriptions/talk-meetings`);
    return jsonOrThrow(res);
}

/** Toggle auto-record for a single meeting (by room token; eventUid optional). */
export async function setMeetingRecord(token, record, eventUid) {
    const res = await authFetch(`${API_BASE}/api/transcriptions/talk-meetings/${encodeURIComponent(token)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record, eventUid }),
    });
    return jsonOrThrow(res);
}

/**
 * The user's upcoming Google Meet meetings (from their Google Calendar), each
 * with import status. Returns
 * `{ connection: { connected, hasMeetScopes, hasSettingsScope, needsReauth },
 *    autoImport, meetings: [{ eventId, iCalUID, title, start, end, organizerEmail,
 *    organizerSelf, meetingCode, meetLink, excluded, recordingControlledByHost,
 *    importedNoteId, status }] }`.
 */
export async function listGoogleMeetMeetings() {
    const res = await authFetch(`${API_BASE}/api/transcriptions/gmeet-meetings`);
    return jsonOrThrow(res);
}

/** Toggle auto-import for a single Google Meet meeting (by calendar event id). */
export async function setGoogleMeetMeetingRecord(eventId, record, { meetingCode, applyToSeries } = {}) {
    const res = await authFetch(`${API_BASE}/api/transcriptions/gmeet-meetings/${encodeURIComponent(eventId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record, meetingCode, applyToSeries }),
    });
    return jsonOrThrow(res);
}

/**
 * Recently ended Google Meet meetings with recording availability, for the
 * manual import panel. Returns `{ items: [{ eventId, meetingCode, title, start,
 * end, recordingState: 'available'|'processing'|'none', importedNoteId }] }`.
 */
export async function listGoogleMeetRecordings() {
    const res = await authFetch(`${API_BASE}/api/transcriptions/gmeet-recordings`);
    return jsonOrThrow(res);
}

/**
 * Recent Google Meet import jobs (status feed for auto-import).
 * Returns `{ items: [{ id, title, meetingCode, meetingStart, meetingEnd,
 * status, errorCode, transcriptionId }] }`.
 */
export async function listGoogleMeetImports() {
    const res = await authFetch(`${API_BASE}/api/transcriptions/gmeet-imports`);
    return jsonOrThrow(res);
}

/**
 * Import one Google Meet recording (server downloads the Drive MP4, extracts
 * audio and transcribes). Synchronous like `/from-nextcloud`; may return
 * 202 `{ jobId, status }` when the recording isn't generated yet.
 */
export async function importGoogleMeetRecording({ eventId, meetingCode, meetLink, language, title, contextTerms }) {
    const res = await authFetch(`${API_BASE}/api/transcriptions/from-gmeet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            event_id: eventId,
            meeting_code: meetingCode,
            meet_link: meetLink,
            language,
            title,
            context_terms: contextTerms,
        }),
    });
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

/**
 * Regenerate the summary. Accepts either the legacy string form (a built-in
 * template key) or an object `{ template?, templateId?, customPrompt? }`:
 *   - templateId  — a saved custom template (server checks visibility)
 *   - customPrompt — an ephemeral "try this once" prompt (not saved)
 *   - template     — a built-in key (default 'general')
 */
export async function regenerateSummary(id, arg) {
    const body = typeof arg === 'string' || arg == null
        ? { template: arg || 'general' }
        : {
            ...(arg.template ? { template: arg.template } : {}),
            ...(arg.templateId ? { templateId: arg.templateId } : {}),
            ...(arg.customPrompt ? { customPrompt: arg.customPrompt } : {}),
        };
    const res = await authFetch(`${API_BASE}/api/transcriptions/${id}/regenerate-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return jsonOrThrow(res);
}

// ── Custom summary templates (user / org / group) ────────────────────────────

/**
 * List summary templates visible to the caller. Returns
 * `{ builtins:[{id,name,nameKey,prompt}], custom:[…], defaultTemplateId, canManageOrg, primaryOrgId }`.
 */
export async function listSummaryTemplates() {
    const res = await authFetch(`${API_BASE}/api/summary-templates`);
    return jsonOrThrow(res);
}

/** All org + group templates in the caller's org (org admin only), plus the org's groups. */
export async function listOrgSummaryTemplates() {
    const res = await authFetch(`${API_BASE}/api/summary-templates/org`);
    return jsonOrThrow(res);
}

/**
 * Create a template. `scope` is 'user' | 'org' | 'group'. Org/group scope
 * require org admin; group scope needs `groupId`.
 */
export async function createSummaryTemplate({ scope = 'user', name, prompt, groupId, isDefault }) {
    const res = await authFetch(`${API_BASE}/api/summary-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, name, prompt, groupId, isDefault: !!isDefault }),
    });
    return jsonOrThrow(res);
}

export async function updateSummaryTemplate(id, patch) {
    const res = await authFetch(`${API_BASE}/api/summary-templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
    });
    return jsonOrThrow(res);
}

export async function deleteSummaryTemplate(id) {
    const res = await authFetch(`${API_BASE}/api/summary-templates/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return true;
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
 * Re-run AI speaker naming on the stored transcript (no re-transcription).
 * `attendees` (names of who was in the room, comma-separated or array) is the
 * strongest hint and, when given, drives the mapping. Returns the updated note.
 */
export async function reidentifySpeakers(id, attendees) {
    const res = await authFetch(`${API_BASE}/api/transcriptions/${id}/reidentify-speakers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendees: attendees || '' }),
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
    // An <audio src> is a browser fetch the demo transport cannot intercept,
    // so on /__demo__/meeting-notes this was a real request to the API from an
    // anonymous visitor — while the page above the frame promised "no
    // microphone access and no network access". There is no audio to play:
    // the sample meeting is a fixture, not a recording. An empty src makes the
    // player render its unavailable state, which is the truth.
    if (isDemoMode()) return '';
    return `${API_BASE}/api/transcriptions/${id}/audio`;
}

/**
 * Same bytes, served as an attachment. For a meeting recorded in the browser
 * this is the only way the user can ever get a copy of their own audio out.
 */
export function audioDownloadUrl(id) {
    return `${API_BASE}/api/transcriptions/${id}/audio?download=1`;
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

// Client helpers for the Learning Center achievements + certificate endpoints
// (server/routes/ai/learning.js). Thin authFetch wrappers.

import { API_BASE, authFetch } from '../../utils/helpers';

// { badges, certificates, version } — or null on failure.
export async function fetchAchievements() {
    try {
        const res = await authFetch(`${API_BASE}/ai/learning/achievements`);
        if (!res.ok) return null;
        return await res.json();
    } catch (_) {
        return null;
    }
}

// Issue (or update public visibility of) a certificate. Returns the issued record
// + URLs, or throws with a friendly message (e.g. not eligible yet).
export async function issueCertificate(certificateId, { makePublic = false } = {}) {
    const res = await authFetch(`${API_BASE}/ai/learning/certificate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certificateId, makePublic }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error || 'Could not issue the certificate.');
    return body;
}

// Fetch a same-origin-or-cross-origin protected asset (PNG/PDF) as an object URL,
// using credentialed authFetch so it works in dev where the API is cross-origin.
export async function fetchAssetObjectUrl(path) {
    const res = await authFetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`Failed to load (${res.status})`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
}

// Trigger a browser download of a protected asset.
export async function downloadAsset(path, filename) {
    const url = await fetchAssetObjectUrl(path);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

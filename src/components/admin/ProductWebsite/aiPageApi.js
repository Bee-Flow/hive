import { authFetch } from '../../../utils/helpers';

const ENDPOINT = '/api/ai/chat/page-generator';

export async function requestGeneratedPage({ prompt, locale } = {}) {
    const res = await authFetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, locale }),
    });

    let body = null;
    try { body = await res.json(); } catch { /* non-JSON error */ }

    if (!res.ok) {
        const msg = body?.error || `Request failed (${res.status})`;
        throw new Error(msg);
    }

    return { page: body?.page, summary: body?.summary };
}

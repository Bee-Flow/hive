// Runtime fetch of the server's structural course catalog (GET /ai/learning/catalog).
//
// The server is the structural authority (course ids, lessonIds, tracks,
// prereqs, badges, certificate rules); the bundled copy in courses.js carries
// presentation and serves as the offline fallback. Fetch once per session
// (module-level promise cache); failures resolve to null so callers keep the
// bundled catalog without ever blocking the UI.

import { API_BASE, authFetch } from '../../utils/helpers';

let catalogPromise = null;

export function fetchCatalog() {
    if (!catalogPromise) {
        catalogPromise = (async () => {
            try {
                const res = await authFetch(`${API_BASE}/ai/learning/catalog`);
                if (!res.ok) return null;
                const data = await res.json();
                return (data && Array.isArray(data.courses)) ? data : null;
            } catch (_) {
                return null;
            }
        })();
    }
    return catalogPromise;
}

// Test/logout hook — drop the cached promise so the next call refetches.
export function resetCatalogCache() {
    catalogPromise = null;
}

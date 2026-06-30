/**
 * Persistence + formatting helpers for the "Find repeating work" scan.
 *
 * Two scoped-storage slots (per-user via scopedStorage):
 *   - routinesScanCache:<hash>  → last scan result for a given
 *       {integrationIds, focus} combo, so the section paints instantly on
 *       remount WITHOUT re-running a scan. Keyed by a stable hash of the
 *       sorted integration ids + focus.
 *   - routinesSuggestionState   → { dismissed:{[titleHash]:ms}, built:{[titleHash]:ms} }
 *       so a user's "not interested" / "built it" choices survive reloads and
 *       follow the suggestion across re-scans (keyed by a stable title hash,
 *       not the volatile server-generated id).
 *
 * Everything here is best-effort: storage may be unavailable (no active user,
 * quota, private mode) so reads fall back to empty and writes swallow errors.
 */

import scopedStorage from '../../../../utils/scopedStorage';

const SUGGESTION_STATE_KEY = 'routinesSuggestionState';
const SCAN_CACHE_PREFIX = 'routinesScanCache:';

/**
 * Small, stable, non-cryptographic string hash (FNV-1a-ish). Used only to
 * derive storage keys / de-dup keys — never for anything security-sensitive.
 * Deterministic across reloads, which is all we need.
 */
export function hashString(input) {
    const str = String(input == null ? '' : input);
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    // Unsigned hex.
    return (h >>> 0).toString(36);
}

/**
 * Stable identity for a suggestion that survives re-scans. The server id is
 * regenerated each scan, so we key dismiss/built state on the title's word
 * tokens (lowercased, punctuation-stripped, sorted-stable order preserved).
 */
export function titleHash(suggestion) {
    const title = (suggestion && (suggestion.title || suggestion.name)) || '';
    const tokens = String(title)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
    return hashString(tokens.join(' '));
}

/** Cache key for a scan result, keyed by the sorted integration set + focus. */
export function scanCacheKey(integrationIds, focus) {
    const ids = Array.isArray(integrationIds) ? integrationIds.slice().sort() : [];
    return SCAN_CACHE_PREFIX + hashString(ids.join(',') + '|' + (focus || '').trim().toLowerCase());
}

/** Read a previously cached scan result. Returns null when absent/invalid. */
export function readScanCache(integrationIds, focus) {
    try {
        const v = scopedStorage.getJSON
            ? scopedStorage.getJSON(scanCacheKey(integrationIds, focus), null)
            : safeParse(scopedStorage.getItem(scanCacheKey(integrationIds, focus)));
        if (v && Array.isArray(v.suggestions)) return v;
        return null;
    } catch {
        return null;
    }
}

/** Persist the latest scan result for instant re-paint on remount. */
export function writeScanCache(integrationIds, focus, payload) {
    try {
        const record = {
            suggestions: Array.isArray(payload?.suggestions) ? payload.suggestions : [],
            summary: payload?.summary || null,
            reason: payload?.reason || null,
            scannedAt: payload?.scannedAt || new Date().toISOString(),
            integrationIds: Array.isArray(integrationIds) ? integrationIds.slice().sort() : [],
            focus: (focus || '').trim(),
        };
        if (scopedStorage.setJSON) scopedStorage.setJSON(scanCacheKey(integrationIds, focus), record);
        else scopedStorage.setItem(scanCacheKey(integrationIds, focus), JSON.stringify(record));
        return record;
    } catch {
        return null;
    }
}

/** Read the dismissed/built ledger. Always returns a well-formed object. */
export function readSuggestionState() {
    try {
        const v = scopedStorage.getJSON
            ? scopedStorage.getJSON(SUGGESTION_STATE_KEY, null)
            : safeParse(scopedStorage.getItem(SUGGESTION_STATE_KEY));
        return {
            dismissed: (v && typeof v.dismissed === 'object' && v.dismissed) || {},
            built: (v && typeof v.built === 'object' && v.built) || {},
        };
    } catch {
        return { dismissed: {}, built: {} };
    }
}

function writeSuggestionState(state) {
    try {
        const record = {
            dismissed: state?.dismissed || {},
            built: state?.built || {},
        };
        if (scopedStorage.setJSON) scopedStorage.setJSON(SUGGESTION_STATE_KEY, record);
        else scopedStorage.setItem(SUGGESTION_STATE_KEY, JSON.stringify(record));
    } catch {
        /* best-effort */
    }
}

/** Mark a suggestion dismissed; returns the updated ledger. */
export function markDismissed(suggestion) {
    const state = readSuggestionState();
    state.dismissed = { ...state.dismissed, [titleHash(suggestion)]: Date.now() };
    writeSuggestionState(state);
    return state;
}

/** Mark a suggestion built; returns the updated ledger. */
export function markBuilt(suggestion) {
    const state = readSuggestionState();
    state.built = { ...state.built, [titleHash(suggestion)]: Date.now() };
    writeSuggestionState(state);
    return state;
}

/**
 * Project the persisted ledger onto the CURRENT suggestion list, returning
 * Sets of suggestion ids that are dismissed/built (so render can grey them).
 * Keyed via titleHash so the flags follow a suggestion across re-scans even
 * though the server id changes.
 */
export function deriveStateSets(suggestions, ledger) {
    const dismissed = new Set();
    const built = new Set();
    const dMap = ledger?.dismissed || {};
    const bMap = ledger?.built || {};
    for (const s of Array.isArray(suggestions) ? suggestions : []) {
        if (!s || s.id == null) continue;
        const th = titleHash(s);
        if (dMap[th]) dismissed.add(s.id);
        if (bMap[th]) built.add(s.id);
    }
    return { dismissed, built };
}

/** "just now" / "26m ago" / "7h ago" / "3d ago" / locale date for older. */
export function formatRelative(iso) {
    try {
        const t = new Date(iso).getTime();
        if (!Number.isFinite(t)) return '';
        const diff = Date.now() - t;
        const m = Math.round(diff / 60000);
        if (m < 1) return 'just now';
        if (m < 60) return `${m}m ago`;
        const h = Math.round(m / 60);
        if (h < 24) return `${h}h ago`;
        const d = Math.round(h / 24);
        if (d < 7) return `${d}d ago`;
        return new Date(iso).toLocaleDateString();
    } catch {
        return '';
    }
}

function safeParse(raw) {
    if (raw == null) return null;
    try { return JSON.parse(raw); } catch { return null; }
}

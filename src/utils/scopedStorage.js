/**
 * User-scoped localStorage wrapper.
 *
 * All keys are namespaced by the current user id as `beeflow:${userId}:${key}`.
 * This prevents data leaks across accounts on shared browsers — switching
 * users drops the old user's favourites, last-used agent, etc.
 *
 * How to use:
 *
 *   1. At app boot, call `setCurrentUser(userId)` after resolving whoami.
 *   2. On logout, call `setCurrentUser(null)` + optionally `clearUser(previousId)`.
 *   3. Anywhere you would have written `localStorage.setItem('lastUsedAgentId', x)`,
 *      write `scopedStorage.setItem('lastUsedAgentId', x)` instead.
 *
 * Migration strategy: on first read, if the scoped key is missing but the
 * legacy global key exists, we copy the legacy value into the scoped slot so
 * existing users don't get reset. The legacy key is left in place for one
 * release; a later cleanup PR can delete it.
 *
 * Device-level keys (theme, locale) stay on raw localStorage — they're not
 * user-specific and should survive account switches.
 */

const PREFIX = 'beeflow';

let currentUserId = null;

function legacyRaw(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
}

function scopedKey(userId, key) {
    return `${PREFIX}:${userId}:${key}`;
}

/**
 * Register the active user. Passing null/undefined clears the active user —
 * subsequent reads return null until a new user is registered.
 */
export function setCurrentUser(userId) {
    currentUserId = userId || null;
}

export function getCurrentUser() {
    return currentUserId;
}

/**
 * Read a user-scoped key. Returns null when no user is active or the key
 * doesn't exist. On first access we lazily migrate from the legacy global
 * key to the scoped slot.
 */
export function getItem(key) {
    if (!currentUserId) return null;
    try {
        const scoped = localStorage.getItem(scopedKey(currentUserId, key));
        if (scoped !== null) return scoped;
        // Legacy migration: copy the global value into the scoped slot once.
        const legacy = legacyRaw(key);
        if (legacy !== null) {
            localStorage.setItem(scopedKey(currentUserId, key), legacy);
            return legacy;
        }
        return null;
    } catch (_) {
        return null;
    }
}

export function setItem(key, value) {
    if (!currentUserId) return;
    try { localStorage.setItem(scopedKey(currentUserId, key), value); } catch (_) { /* ignore quota */ }
}

export function removeItem(key) {
    if (!currentUserId) return;
    try { localStorage.removeItem(scopedKey(currentUserId, key)); } catch (_) { /* ignore */ }
}

/**
 * JSON helpers so call sites don't repeat try/catch. `fallback` is returned
 * when the stored value is missing or not valid JSON.
 */
export function getJSON(key, fallback = null) {
    const raw = getItem(key);
    if (raw === null) return fallback;
    try { return JSON.parse(raw); } catch (_) { return fallback; }
}

export function setJSON(key, value) {
    try { setItem(key, JSON.stringify(value)); } catch (_) { /* ignore */ }
}

/**
 * Remove ALL scoped keys for the given user. Call on logout.
 * Intentionally leaves device-level keys alone.
 */
export function clearUser(userId) {
    if (!userId) return;
    try {
        const prefix = `${PREFIX}:${userId}:`;
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(prefix)) toRemove.push(k);
        }
        for (const k of toRemove) localStorage.removeItem(k);
    } catch (_) { /* ignore */ }
}

export default {
    setCurrentUser,
    getCurrentUser,
    getItem,
    setItem,
    removeItem,
    getJSON,
    setJSON,
    clearUser,
};

// Client-side error reporting with secret redaction + offline queue.
//
// Wraps the POST to `/api/client-errors`. Two responsibilities the old
// inline reporter inside ErrorBoundary.jsx didn't handle:
//
//   1. Redaction — error messages and stacks can carry tokens / keys when
//      a request URL or thrown Error embeds them. We scrub those before
//      sending so they don't end up in server logs.
//
//   2. Offline / 5xx queue — when the POST itself fails (offline, server
//      down) the report would be lost. We enqueue to IndexedDB and drain
//      on the next mount. Capped at 50 entries (LRU) to avoid filling
//      browser storage during a sustained outage.
//
// Public API:
//   reportClientError(label, error, info) — fire-and-forget POST + queue
//   drainErrorQueue()                     — call once on app mount
//
// Both functions are async but never reject.

import { APP_BUILD_SHA } from './appVersion';

const ENDPOINT = '/api/client-errors';
const DB_NAME = 'bf-error-queue';
const STORE_NAME = 'reports';
const QUEUE_CAP = 50;

// ── Redaction ──────────────────────────────────────────────────────────
//
// Patterns ordered most-specific first so JWTs aren't mangled by the
// generic key=value sweep. Each regex is global + case-insensitive where
// relevant.

const JWT_RE = /ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
const BEARER_RE = /\b[Bb]earer\s+[A-Za-z0-9._-]{8,}/g;
// Keyword list deliberately excludes `authorization` / `bearer` — those
// are handled by BEARER_RE already, and listing them here causes the KV
// pass to re-redact "Authorization: Bearer [REDACTED]" into nonsense.
// The negated character class also excludes `[]` so we don't re-match
// strings the previous passes have already replaced with `[REDACTED]`.
const KV_RE = /(token|key|secret|password|api[-_]?key)([=:\s]+)[^\s,"'<>[\]]{4,}/gi;

export function redactSecrets(input) {
    if (typeof input !== 'string' || input.length === 0) return input;
    return input
        .replace(JWT_RE, '[REDACTED_JWT]')
        .replace(BEARER_RE, 'Bearer [REDACTED]')
        .replace(KV_RE, (_, k, sep) => `${k}${sep}[REDACTED]`);
}

// ── Payload construction ──────────────────────────────────────────────

function buildPayload(label, error, info) {
    const diag = (typeof window !== 'undefined' && window.__APP_DIAGNOSTICS__) || {};
    return {
        label,
        message: redactSecrets(String(error?.message || error || '')),
        stack: redactSecrets(String(error?.stack || '')),
        componentStack: redactSecrets(String(info?.componentStack || '')),
        url: typeof window !== 'undefined' ? redactSecrets(window.location.href) : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        at: new Date().toISOString(),
        buildSha: APP_BUILD_SHA,
        userRole: diag.userRole || '',
        featureFlags: diag.featureFlags || {},
    };
}

// ── IndexedDB queue ───────────────────────────────────────────────────
//
// Tiny single-store wrapper. We don't pull in idb-keyval just for this —
// the surface is small enough to inline.

function openDb() {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB unavailable'));
            return;
        }
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function enqueue(payload) {
    try {
        const db = await openDb();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.add(payload);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        // LRU trim: keep the most-recent QUEUE_CAP entries.
        await trim(db);
        db.close();
    } catch (e) {
        // Last-resort: log to console. If IndexedDB is also unavailable,
        // we've done what we can.
        console.warn('[clientErrorReporter] enqueue failed', e);
    }
}

async function trim(db) {
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const countReq = store.count();
        countReq.onsuccess = () => {
            const excess = countReq.result - QUEUE_CAP;
            if (excess <= 0) { resolve(); return; }
            const cursorReq = store.openCursor();
            let deleted = 0;
            cursorReq.onsuccess = () => {
                const cursor = cursorReq.result;
                if (cursor && deleted < excess) {
                    cursor.delete();
                    deleted += 1;
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            cursorReq.onerror = () => resolve();
        };
        countReq.onerror = () => resolve();
    });
}

async function readAll() {
    try {
        const db = await openDb();
        const items = await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
        db.close();
        return items;
    } catch {
        return [];
    }
}

async function removeIds(ids) {
    if (!ids.length) return;
    try {
        const db = await openDb();
        await new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            ids.forEach((id) => store.delete(id));
            tx.oncomplete = resolve;
            tx.onerror = resolve;
        });
        db.close();
    } catch { /* best effort */ }
}

// ── Network send ──────────────────────────────────────────────────────

async function postOnce(payload, { keepalive = true } = {}) {
    if (typeof fetch !== 'function') throw new Error('fetch unavailable');
    const r = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
        keepalive,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
}

// ── Public API ────────────────────────────────────────────────────────

export async function reportClientError(label, error, info) {
    try { console.error(`[ErrorBoundary:${label}]`, error, info?.componentStack || ''); }
    catch { /* console may be sandboxed */ }
    const payload = buildPayload(label, error, info);
    try {
        await postOnce(payload);
    } catch {
        // Network or 5xx — stash for the next mount to retry.
        await enqueue(payload);
    }
}

/**
 * Drain queued reports. Call once at app mount, after auth is ready.
 * Returns the number of reports successfully drained (zero on no-op or
 * partial failure).
 */
export async function drainErrorQueue() {
    const items = await readAll();
    if (items.length === 0) return 0;
    const drainedIds = [];
    for (const item of items) {
        const { id, ...payload } = item;
        try {
            // keepalive: false here — we're not in an unload path, the user
            // is reading the app; we can afford a normal request.
            await postOnce(payload, { keepalive: false });
            drainedIds.push(id);
        } catch {
            // Stop on first failure — server is still down, drain again
            // next mount.
            break;
        }
    }
    await removeIds(drainedIds);
    return drainedIds.length;
}

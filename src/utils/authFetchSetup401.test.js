import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * authFetch reloads the page on a 401 to recover a stale session. The
 * connector's `/setup/*` routes are ADMIN-gated, so a 401 from them means
 * "this Nextcloud user is not an admin" — a fact no reload can change.
 *
 * This matters on the not-yet-paired embedded view: AuthedApp probes
 * /setup/diagnostics whenever it has no session, which for a non-admin NC user
 * is every single mount. Without the exclusion each mount burned a full page
 * reload (the 30s cooldown caps the spin, it doesn't prevent it).
 */
const RELOAD_FLAG = 'bf_auth_reload_at';

let authFetch;
let reload;

beforeEach(async () => {
    vi.resetModules();
    sessionStorage.clear();
    reload = vi.fn();
    // jsdom's location.reload is non-configurable on the real object; swap in
    // a plain stand-in so we can observe the call. The pathname must be an
    // in-app route: on a public marketing path the reload is suppressed
    // outright, which would make the control case pass for the wrong reason.
    delete window.location;
    window.location = { reload, href: 'http://localhost/app/agents', pathname: '/app/agents' };
    ({ authFetch } = await import('./helpers'));
});

afterEach(() => {
    vi.unstubAllGlobals();
});

const respond = (status) => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
        status,
        ok: status >= 200 && status < 300,
        headers: new Headers(),
        json: async () => ({}),
        text: async () => '',
    })));
};

describe('authFetch 401 reload heuristic', () => {
    it('does NOT reload on a 401 from an admin-gated /setup/ route', async () => {
        respond(401);
        await authFetch('/index.php/apps/app_api/proxy/bee_flow/setup/diagnostics');
        expect(reload).not.toHaveBeenCalled();
        expect(sessionStorage.getItem(RELOAD_FLAG)).toBeNull();
    });

    it('still reloads on a 401 from an ordinary API route', async () => {
        respond(401);
        await authFetch('/api/agents');
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it('does not reload on a 502 — that is bootstrap-in-progress, not a stale session', async () => {
        respond(502);
        await authFetch('/api/agents');
        expect(reload).not.toHaveBeenCalled();
    });
});

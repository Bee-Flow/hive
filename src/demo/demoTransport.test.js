/**
 * The security property of the public feature demos, pinned.
 *
 * The demos render real Studio components to anonymous visitors. Those
 * components call `authFetch` freely. The ONLY thing standing between a
 * visitor's click and a real unauthenticated API call is that authFetch
 * short-circuits into the demo transport and that the transport fails
 * closed on an unknown route.
 *
 * If either of those regresses, nothing looks broken — the demo keeps
 * working, because it quietly starts talking to the real server. So these
 * assertions are about what must NOT happen.
 *
 * Run: cd agent-hub && npx vitest run src/demo/demoTransport.test.js
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDemoTransport } from './demoTransport';
import {
    authFetch, setDemoTransport, isDemoMode, isDemoPath, sealDemoBeforeBoot,
} from '../utils/helpers';

const ROUTES = {
    'GET /api/things': ({ state }) => ({ items: state.things }),
    'GET /api/things/:id': ({ state, params }) => {
        const found = state.things.find(t => t.id === params.id);
        return found || new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    },
    'PUT /api/things/:id': ({ state, params, body }) => {
        const t = state.things.find(x => x.id === params.id);
        Object.assign(t, body);
        return { success: true, thing: t };
    },
    'DELETE /api/things/:id': ({ state, params }) => {
        state.things = state.things.filter(t => t.id !== params.id);
        return undefined;                       // → 204
    },
    'GET /api/wildcard/*': () => ({ ok: true }),
};

function freshState() {
    return { things: [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }] };
}

let fetchSpy;

beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
    setDemoTransport(null);
    fetchSpy.mockRestore();
});

describe('authFetch demo mode', () => {
    it('is off by default — the app must be unaffected', () => {
        expect(isDemoMode()).toBe(false);
    });

    it('never calls fetch() while a transport is installed', async () => {
        setDemoTransport(createDemoTransport(ROUTES, freshState()));

        await authFetch('/api/things');
        await authFetch('/api/things/a');
        await authFetch('/api/nothing-like-this');
        await authFetch('/auth/login/start', { method: 'POST', body: '{}' });

        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('fails CLOSED on an unknown route instead of falling through to the network', async () => {
        setDemoTransport(createDemoTransport(ROUTES, freshState()));

        const res = await authFetch('/api/definitely/not/mapped');

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.demo).toBe(true);
        expect(body.path).toBe('/api/definitely/not/mapped');
    });

    it('refuses a transport that does not return a Response, rather than guessing', async () => {
        setDemoTransport(async () => ({ not: 'a response' }));
        await expect(authFetch('/api/things')).rejects.toThrow(/no Response/);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('restores the real transport when removed', () => {
        const t = createDemoTransport(ROUTES, freshState());
        setDemoTransport(t);
        expect(isDemoMode()).toBe(true);
        const previous = setDemoTransport(null);
        expect(previous).toBe(t);
        expect(isDemoMode()).toBe(false);
    });
});

describe('route matching', () => {
    let state;
    beforeEach(() => {
        state = freshState();
        setDemoTransport(createDemoTransport(ROUTES, state));
    });

    it('serves a collection', async () => {
        const body = await (await authFetch('/api/things')).json();
        expect(body.items.map(t => t.id)).toEqual(['a', 'b']);
    });

    it('binds :params and honours a handler-returned Response', async () => {
        const ok = await authFetch('/api/things/a');
        expect(await ok.json()).toEqual({ id: 'a', name: 'Alpha' });

        const missing = await authFetch('/api/things/zzz');
        expect(missing.status).toBe(404);
    });

    it('applies writes to the in-memory state so editing feels real', async () => {
        const res = await authFetch('/api/things/a', {
            method: 'PUT',
            body: JSON.stringify({ name: 'Renamed' }),
        });
        expect((await res.json()).thing.name).toBe('Renamed');

        const after = await (await authFetch('/api/things')).json();
        expect(after.items[0].name).toBe('Renamed');
    });

    it('returns 204 for a handler with no body', async () => {
        const res = await authFetch('/api/things/b', { method: 'DELETE' });
        expect(res.status).toBe(204);
        const after = await (await authFetch('/api/things')).json();
        expect(after.items.map(t => t.id)).toEqual(['a']);
    });

    it('distinguishes methods on the same path', async () => {
        const res = await authFetch('/api/things/a', { method: 'POST', body: '{}' });
        expect(res.status).toBe(404);
    });

    it('ignores the API_BASE origin and the query string', async () => {
        const res = await authFetch('http://localhost:3001/api/things?limit=10&x=1');
        expect((await res.json()).items).toHaveLength(2);
    });

    it('supports a trailing wildcard', async () => {
        const res = await authFetch('/api/wildcard/deep/path/here');
        expect((await res.json()).ok).toBe(true);
    });

    it('turns a throwing handler into a 500, never a passthrough', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        setDemoTransport(createDemoTransport({
            'GET /api/boom': () => { throw new Error('fixture bug'); },
        }, {}));

        const res = await authFetch('/api/boom');
        expect(res.status).toBe(500);
        expect(fetchSpy).not.toHaveBeenCalled();
        spy.mockRestore();
    });
});

/**
 * The transport DemoHost installs cannot cover the app shell, because
 * DemoHost is lazy and the providers above it mount first. Four real requests
 * left the browser in that window. Nine marketing pages say "the demo has no
 * network access", so the window is sealed before React renders instead.
 */
describe('sealing the demo before boot', () => {
    let fetchSpy;
    beforeEach(() => { fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}')); });
    afterEach(() => { setDemoTransport(null); fetchSpy.mockRestore(); });

    it('recognises a demo path and nothing else', () => {
        expect(isDemoPath('/__demo__/compliance')).toBe(true);
        expect(isDemoPath('/__demo__/privacy-shield/')).toBe(true);
        expect(isDemoPath('/__demo__/')).toBe(false);
        expect(isDemoPath('/app/settings/organisation/privacy')).toBe(false);
        expect(isDemoPath('/privacy-shield')).toBe(false);   // the marketing page
        expect(isDemoPath(undefined)).toBe(false);
    });

    it('installs a transport on a demo path, so the shell cannot reach the API', async () => {
        expect(sealDemoBeforeBoot('/__demo__/compliance')).toBe(true);
        expect(isDemoMode()).toBe(true);
        // The four the shell actually made.
        for (const url of [
            '/api/branding/effective', '/api/branding/public',
            '/api/languages/user/locales', '/api/modules/frontend',
        ]) {
            expect((await authFetch(url)).status).toBe(404);
        }
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('leaves the real app alone', async () => {
        expect(sealDemoBeforeBoot('/app/studio/agents')).toBe(false);
        expect(isDemoMode()).toBe(false);
        await authFetch('/api/branding/effective');
        expect(fetchSpy).toHaveBeenCalled();
    });

    it('is silent — a shell call is not a missing fixture', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        sealDemoBeforeBoot('/__demo__/knowledge');
        await authFetch('/api/branding/effective');
        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
    });
});

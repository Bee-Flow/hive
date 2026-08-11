import { describe, it, expect } from 'vitest';
import { isEnvPermission, normalizePermissions, permissionCopy, splitEnvPermissions } from './permissionCopy';
import EN_DEFAULTS from '../../../i18n/en-defaults';

// t() stub that resolves through the real EN dict so the canonical copy is
// asserted, with {param} interpolation like the real hook.
const t = (key, params) => {
    let s = EN_DEFAULTS[key] ?? key;
    for (const [k, v] of Object.entries(params || {})) s = s.replace(`{${k}}`, String(v));
    return s;
};

describe('normalizePermissions', () => {
    it('accepts bare id strings and {id, reason} objects, drops junk', () => {
        expect(normalizePermissions(['db', { id: 'ai', reason: 'summaries' }, null, {}, 42]))
            .toEqual([{ id: 'db' }, { id: 'ai', reason: 'summaries' }]);
    });

    it('returns [] for non-arrays', () => {
        expect(normalizePermissions(undefined)).toEqual([]);
        expect(normalizePermissions('db')).toEqual([]);
    });
});

describe('permissionCopy', () => {
    it('renders the canonical copy for fixed ids', () => {
        expect(permissionCopy(t, 'db')).toBe('Full database access, including organisation and user data');
        expect(permissionCopy(t, 'ai')).toBe("Can invoke this instance's AI providers (may incur cost)");
        expect(permissionCopy(t, 'config')).toBe('Can store its own settings and secrets (namespaced)');
        expect(permissionCopy(t, 'email:send')).toBe('Can send email on behalf of this instance');
    });

    it('shows the http pattern, with * reading as any internet host', () => {
        expect(permissionCopy(t, 'http:*.stripe.com')).toBe('Can make outbound HTTP requests to *.stripe.com');
        expect(permissionCopy(t, 'http:*')).toBe('Can make outbound HTTP requests to any internet host');
    });

    it('labels env: and unknown ids explicitly', () => {
        expect(permissionCopy(t, 'env:process')).toBe('Direct server environment access (env:process)');
        expect(permissionCopy(t, 'quantum:entangle')).toBe('Extended permission: quantum:entangle');
    });
});

describe('splitEnvPermissions', () => {
    it('separates env:* ids into their own section', () => {
        const perms = normalizePermissions(['db', 'env:process', 'http:*', 'env:fs']);
        const { normal, env } = splitEnvPermissions(perms);
        expect(normal.map((p) => p.id)).toEqual(['db', 'http:*']);
        expect(env.map((p) => p.id)).toEqual(['env:process', 'env:fs']);
        expect(isEnvPermission('env:fs')).toBe(true);
        expect(isEnvPermission('db')).toBe(false);
    });
});

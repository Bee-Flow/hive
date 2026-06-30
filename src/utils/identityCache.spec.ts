import { describe, it, expect } from 'vitest';
import { identityKey, shouldResetCache } from './identityCache';

describe('identityKey', () => {
    it('returns null when signed out', () => {
        expect(identityKey(null)).toBeNull();
        expect(identityKey(undefined)).toBeNull();
        expect(identityKey({})).toBeNull();
        expect(identityKey({ id: '' })).toBeNull();
    });

    it('keys by user id and active org', () => {
        expect(identityKey({ id: 'u1', organizationId: 'o1' })).toBe('u1:o1');
        expect(identityKey({ id: 'u1', orgId: 'o2' })).toBe('u1:o2');
    });

    it('is stable across benign profile patches (same id + org)', () => {
        const a = identityKey({ id: 'u1', organizationId: 'o1' });
        const b = identityKey({ id: 'u1', organizationId: 'o1', orgId: undefined });
        expect(a).toBe(b);
    });

    it('distinguishes the same user across different orgs', () => {
        expect(identityKey({ id: 'u1', organizationId: 'o1' }))
            .not.toBe(identityKey({ id: 'u1', organizationId: 'o2' }));
    });

    it('treats no-org consistently', () => {
        expect(identityKey({ id: 'u1' })).toBe('u1:');
    });
});

describe('shouldResetCache', () => {
    it('does not reset on initial sign-in (null -> X)', () => {
        expect(shouldResetCache(null, 'u1:o1')).toBe(false);
    });

    it('does not reset on logout (X -> null) — handled explicitly elsewhere', () => {
        expect(shouldResetCache('u1:o1', null)).toBe(false);
    });

    it('does not reset when identity is unchanged', () => {
        expect(shouldResetCache('u1:o1', 'u1:o1')).toBe(false);
    });

    it('resets on account switch', () => {
        expect(shouldResetCache('u1:o1', 'u2:o1')).toBe(true);
    });

    it('resets on org switch for the same user', () => {
        expect(shouldResetCache('u1:o1', 'u1:o2')).toBe(true);
    });
});

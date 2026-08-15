/**
 * Signup validation used to live in two places that disagreed: the wizard's
 * canAdvance() required KvK and VAT but not a password minimum, and
 * handleSignup() required a password minimum but not KvK/VAT. Which rules
 * applied depended on which button you pressed.
 */
import { describe, it, expect } from 'vitest';
import {
    MIN_PASSWORD_LENGTH, validateStep, validateSubmit,
    requiresDutchRegistration, isPlausibleEmail,
} from './signupValidation';

const org = (over = {}) => ({ signupType: 'new', newOrgName: 'Acme', ...over });
const consumer = (over = {}) => ({ signupType: 'consumer', ...over });

describe('MIN_PASSWORD_LENGTH', () => {
    it('matches the server policy in server/auth/passwordPolicy.js', () => {
        // Bump both together — the server is authoritative and will reject
        // anything shorter regardless of what this file says.
        expect(MIN_PASSWORD_LENGTH).toBe(8);
    });
});

describe('requiresDutchRegistration', () => {
    it('is required for a Dutch organisation', () => {
        expect(requiresDutchRegistration({ orgCountry: 'NL' })).toBe(true);
    });
    it('is not required elsewhere', () => {
        for (const c of ['DE', 'BE', 'FR', 'US']) {
            expect(requiresDutchRegistration({ orgCountry: c })).toBe(false);
        }
    });
    it('falls back to the interface language when no country is set', () => {
        expect(requiresDutchRegistration({}, 'nl')).toBe(true);
        expect(requiresDutchRegistration({}, 'en')).toBe(false);
    });
    it('prefers an explicit country over the language', () => {
        expect(requiresDutchRegistration({ orgCountry: 'DE' }, 'nl')).toBe(false);
    });
});

describe('validateStep — type', () => {
    it('an organisation needs a name', () => {
        expect(validateStep('type', org({ newOrgName: '' })).ok).toBe(false);
        expect(validateStep('type', org()).ok).toBe(true);
    });

    it('a Dutch organisation needs KvK and VAT', () => {
        const ctx = { locale: 'nl' };
        expect(validateStep('type', org(), ctx)).toMatchObject({ ok: false, reason: 'kvk_required' });
        expect(validateStep('type', org({ orgKvk: '123' }), ctx)).toMatchObject({ ok: false, reason: 'vat_required' });
        expect(validateStep('type', org({ orgKvk: '123', orgVat: 'NL1B01' }), ctx).ok).toBe(true);
    });

    it('a non-Dutch organisation can proceed without them — this used to be impossible', () => {
        expect(validateStep('type', org({ orgCountry: 'DE' }), { locale: 'de' }).ok).toBe(true);
    });

    it('a personal account has nothing to fill in', () => {
        expect(validateStep('type', consumer()).ok).toBe(true);
    });

    it('joining an existing organisation needs one selected', () => {
        expect(validateStep('type', { signupType: 'existing' }).ok).toBe(false);
        expect(validateStep('type', { signupType: 'existing', organizationId: 'acme' }).ok).toBe(true);
    });
});

describe('validateStep — other steps', () => {
    it('the plan step is always skippable', () => {
        expect(validateStep('plan', org()).ok).toBe(true);
        expect(validateStep('plan', consumer()).ok).toBe(true);
    });

    it('auth needs a method', () => {
        expect(validateStep('auth', org()).ok).toBe(false);
        expect(validateStep('auth', org({ authMethod: 'password' })).ok).toBe(true);
    });

    it('an enabled shield needs at least one PII category', () => {
        expect(validateStep('privacy', { shieldEnabled: true, piiCategories: [] }).ok).toBe(false);
        expect(validateStep('privacy', { shieldEnabled: true, piiCategories: ['email'] }).ok).toBe(true);
    });

    it('a disabled shield needs nothing', () => {
        expect(validateStep('privacy', { shieldEnabled: false, piiCategories: [] }).ok).toBe(true);
    });

    it('applies the same privacy rule to both account types', () => {
        const data = { shieldEnabled: true, piiCategories: [] };
        expect(validateStep('privacy', { ...org(), ...data }).ok)
            .toBe(validateStep('privacy', { ...consumer(), ...data }).ok);
    });
});

describe('validateSubmit', () => {
    const valid = { username: 'tom', password: 'hunter2hunter2', signupType: 'consumer' };

    it('accepts a complete personal signup', () => {
        expect(validateSubmit(valid).ok).toBe(true);
    });

    it('requires a username', () => {
        expect(validateSubmit({ ...valid, username: '' })).toMatchObject({ reason: 'username_required' });
    });

    it('refuses the reserved admin username', () => {
        expect(validateSubmit({ ...valid, username: 'admin' })).toMatchObject({ reason: 'username_reserved' });
    });

    it('enforces the password minimum the wizard now shares', () => {
        expect(validateSubmit({ ...valid, password: 'abc' })).toMatchObject({ reason: 'password_too_short' });
        expect(validateSubmit({ ...valid, password: 'molenwiek42' }).ok).toBe(true);
    });

    // A pentest signed up with `password`. Length alone let it through, here
    // and on the server. The server owns the real deny-list; this catches the
    // handful people actually type, before the round-trip.
    it('refuses the passwords everyone tries first', () => {
        for (const pw of ['password', '12345678', 'Welkom123', 'P@ssw0rd', 'a'.repeat(MIN_PASSWORD_LENGTH)]) {
            expect(validateSubmit({ ...valid, password: pw })).toMatchObject({ reason: 'password_too_common' });
        }
    });

    it('rejects an obviously malformed email but allows none at all', () => {
        expect(validateSubmit({ ...valid, email: 'not-an-email' })).toMatchObject({ reason: 'email_invalid' });
        expect(validateSubmit({ ...valid, email: '' }).ok).toBe(true);
        expect(validateSubmit({ ...valid, email: 'a@b.nl' }).ok).toBe(true);
    });

    it('re-checks the account-type rules, so an odd path cannot skip them', () => {
        const orgSubmit = { ...valid, signupType: 'new', newOrgName: '' };
        expect(validateSubmit(orgSubmit)).toMatchObject({ reason: 'org_name_required' });
    });

    it('an invited user skips the account-type rules — the invite decides the org', () => {
        const invited = { ...valid, signupType: 'new', newOrgName: '' };
        expect(validateSubmit(invited, { isInvite: true }).ok).toBe(true);
    });

    it('returns a human-readable error alongside the reason', () => {
        const r = validateSubmit({ ...valid, password: 'x' });
        expect(r.error).toMatch(/8/);
    });
});

describe('isPlausibleEmail', () => {
    it.each(['a@b.nl', 'first.last+tag@sub.example.com'])('accepts %s', (e) => {
        expect(isPlausibleEmail(e)).toBe(true);
    });
    it.each(['', 'no-at-sign', 'a@b', 'a b@c.nl', '@b.nl'])('rejects %s', (e) => {
        expect(isPlausibleEmail(e)).toBe(false);
    });
});

import { describe, it, expect } from 'vitest';
import { redactSecrets } from './clientErrorReporter';

describe('redactSecrets', () => {
    it('returns input unchanged when no secret-like substring is present', () => {
        expect(redactSecrets('normal error message')).toBe('normal error message');
    });

    it('handles null and non-string gracefully', () => {
        expect(redactSecrets(null)).toBeNull();
        expect(redactSecrets(undefined)).toBeUndefined();
        expect(redactSecrets(42)).toBe(42);
    });

    it('redacts a Bearer header value', () => {
        const out = redactSecrets('Authorization: Bearer abc123xyz456');
        expect(out).toMatch(/Bearer \[REDACTED\]/);
        expect(out).not.toContain('abc123xyz456');
    });

    it('redacts a JWT-shaped string', () => {
        // Synthetic JWT — segments built via join() so secret-scanners in the
        // deploy pipeline don't flag the literal as a real token.
        // Header decodes to {"alg":"RS256","typ":"JWT"}; payload to
        // {"sub":"1234567890"}; signature is literally "signature-here…".
        const jwt = [
            'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9',
            'eyJzdWIiOiIxMjM0NTY3ODkwIn0',
            'signature-here-very-long-thing',
        ].join('.');
        const out = redactSecrets(`token=${jwt}`);
        expect(out).toContain('[REDACTED_JWT]');
        expect(out).not.toContain('signature-here');
    });

    it('redacts api-key style key=value pairs', () => {
        const out = redactSecrets('api_key=sk-abc1234567890'); // gitleaks:allow
        expect(out).toMatch(/api_key[=:\s]+\[REDACTED\]/);
        expect(out).not.toContain('sk-abc1234567890'); // gitleaks:allow
    });

    it('redacts password=… and secret=…', () => {
        expect(redactSecrets('password: supersecret123')).toMatch(/password.*\[REDACTED\]/i);
        expect(redactSecrets('secret=hunter2hunter2')).toMatch(/secret.*\[REDACTED\]/i);
    });
});

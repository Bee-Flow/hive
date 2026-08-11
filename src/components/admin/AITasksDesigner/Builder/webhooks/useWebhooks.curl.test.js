import crypto from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { buildCurlSnippet, webhookUrl, maskSecret } from './useWebhooks';

/**
 * BFSF-320 — "Copy as cURL" produced a command the server ALWAYS rejected.
 *
 * The snippet signed the body alone, but `server/routes/automation/events.js`
 * verifies the HMAC over `nonce + "\n" + body`. Every copied command came back
 * 401 "Bad signature", so nobody could get a webhook working from the UI.
 *
 * These tests re-derive the signature the snippet's shell pipeline would
 * produce and check it against the server's algorithm, so the two can't drift
 * apart again.
 */
const SECRET = 'a'.repeat(64);

/** Exactly what routes/automation/events.js computes. */
function serverSignature(secret, nonce, body) {
    return 'sha256=' + crypto.createHmac('sha256', secret).update(`${nonce}\n${body}`).digest('hex');
}

/** What `printf '%s\n%s' "$NONCE" "$BODY" | openssl dgst -sha256 -hmac <secret>` yields. */
function shellSignature(snippet, secret, nonce, body) {
    const printfMatch = snippet.match(/printf '([^']*)' "\$NONCE" "\$BODY"/);
    expect(printfMatch, 'snippet must pipe printf of NONCE and BODY into openssl').toBeTruthy();
    // Resolve the printf format the shell would apply to (nonce, body).
    const rendered = printfMatch[1].replace(/\\n/g, '\n').replace('%s', nonce).replace('%s', body);
    return 'sha256=' + crypto.createHmac('sha256', secret).update(rendered).digest('hex');
}

describe('buildCurlSnippet', () => {
    const snippet = buildCurlSnippet('https://app.example.com/api/automation/webhook/abc', SECRET);

    it('signs nonce + newline + body, matching what the server verifies', () => {
        const nonce = 'deadbeef';
        const body = '{}';
        expect(shellSignature(snippet, SECRET, nonce, body)).toBe(serverSignature(SECRET, nonce, body));
    });

    it('still matches for a non-empty body', () => {
        const nonce = 'f00d';
        const body = '{"hello":"world"}';
        expect(shellSignature(snippet, SECRET, nonce, body)).toBe(serverSignature(SECRET, nonce, body));
    });

    it('does not sign the body alone (the original defect)', () => {
        const nonce = 'deadbeef';
        const body = '{}';
        const bodyOnly = 'sha256=' + crypto.createHmac('sha256', SECRET).update(body).digest('hex');
        expect(shellSignature(snippet, SECRET, nonce, body)).not.toBe(bodyOnly);
    });

    it('sends both required headers and posts to the given URL', () => {
        expect(snippet).toContain('X-BeeFlow-Signature: $SIG');
        expect(snippet).toContain('X-BeeFlow-Nonce: $NONCE');
        expect(snippet).toContain("curl -X POST 'https://app.example.com/api/automation/webhook/abc'");
    });

    it('generates a fresh nonce per invocation (replay guard)', () => {
        expect(snippet).toContain('NONCE=$(openssl rand -hex 16)');
    });
});

describe('webhookUrl', () => {
    it('prefers the absolute url the server now sends', () => {
        expect(webhookUrl({ id: 'abc', url: 'https://app.example.com/api/automation/webhook/abc' }))
            .toBe('https://app.example.com/api/automation/webhook/abc');
    });

    it('falls back to the page origin for rows without a url', () => {
        expect(webhookUrl({ id: 'abc' })).toBe(`${window.location.origin}/api/automation/webhook/abc`);
    });
});

describe('maskSecret', () => {
    it('keeps the length stable and reveals only the last 4 chars', () => {
        const masked = maskSecret(SECRET);
        expect(masked).toHaveLength(SECRET.length);
        expect(masked.endsWith(SECRET.slice(-4))).toBe(true);
        expect(masked).not.toContain(SECRET.slice(0, 8));
    });

    it('fully masks a short secret', () => {
        expect(maskSecret('abcd')).toBe('••••••••');
        expect(maskSecret('')).toBe('••••••••');
    });
});

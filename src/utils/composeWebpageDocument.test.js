import { describe, it, expect } from 'vitest';
import composeWebpageDocument from './composeWebpageDocument';

/**
 * Every injected shim (auth, DB, bridges, selection bridge) is emitted from a
 * template literal, where `\/` silently cooks to `/`. That once turned the
 * beeflowApp shim's `.replace(/^\/+/, "")` into `.replace(/^/+/, "")` — an
 * unterminated regex literal that killed the whole bridges <script> block with
 * "SyntaxError: Invalid regular expression: missing /", leaving beeflowAI /
 * beeflowApp / beeflowAutomations / beeflowIntegrations undefined in the
 * preview. These tests parse every emitted inline script so any future
 * de-escaping regression fails loudly.
 */

function composeFullDoc() {
    return composeWebpageDocument(
        {
            html: '<!DOCTYPE html><html><head></head><body><div id="app"></div></body></html>',
            css: 'body { margin: 0; }',
            js: 'console.log("hi");',
        },
        {
            selectionBridge: true,
            dbToken: 'tok_test',
            dbApiBase: 'https://api.example.test/',
            dbWebpageId: 'wp_123',
        }
    );
}

function extractInlineScripts(doc) {
    const bodies = [];
    const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = re.exec(doc)) !== null) {
        const attrs = m[1] || '';
        // Only classic/module JS — skip anything explicitly non-JS (importmap etc.)
        if (/type\s*=/i.test(attrs) && !/type\s*=\s*["']?(text\/javascript|module)/i.test(attrs)) continue;
        if (m[2].trim()) bodies.push(m[2]);
    }
    return bodies;
}

describe('composeWebpageDocument injected scripts', () => {
    it('emits every inline script as syntactically valid JavaScript', () => {
        const doc = composeFullDoc();
        const scripts = extractInlineScripts(doc);
        // auth + db + bridges + user js + selection bridge
        expect(scripts.length).toBeGreaterThanOrEqual(5);
        for (const body of scripts) {
            expect(() => new Function(body)).not.toThrow();
        }
    });

    it('keeps the escaped slash in the beeflowApp route regex', () => {
        const doc = composeFullDoc();
        expect(doc).toContain('replace(/^\\/+/, "")');
        expect(doc).not.toContain('replace(/^/+/, "")');
    });
});

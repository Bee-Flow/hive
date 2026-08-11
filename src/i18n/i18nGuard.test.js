/**
 * i18n completeness guard.
 *
 * Prevents the "raw key rendered in the UI" bug class:
 *  1. Every literal t('key') call site must have its key in EN_DEFAULTS —
 *     t() returns the RAW KEY for a missing key with no string 2nd arg.
 *  2. The `t('key') || 'Fallback'` idiom is banned: t() returns the truthy
 *     raw key, so the || never fires. Use t('key', 'Fallback') instead.
 *  3. The client dict (en-defaults.js) and the server source dict
 *     (server/i18n/defaults/en.js) must have identical KEY sets, so every
 *     string is translatable in the admin Languages panel and renders even
 *     when the API is unreachable.
 *  4. Dynamic keys (template literals / string concat) can't be checked
 *     exactly — instead each dynamic prefix must match at least one
 *     EN_DEFAULTS key, catching renamed/typo'd namespaces.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import EN_DEFAULTS from './en-defaults';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..');
const SERVER_DEFAULTS = path.resolve(HERE, '../../../server/i18n/defaults/en.js');

// Files whose t() mentions are not real call sites.
const EXCLUDED = new Set([
    'hooks/useTranslation.jsx', // JSDoc usage examples
]);

function* walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) yield* walk(p);
        else if (/\.(jsx?|tsx?)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) yield p;
    }
}

function collectSources() {
    const out = [];
    for (const file of walk(SRC)) {
        const rel = path.relative(SRC, file).replace(/\\/g, '/');
        if (rel.startsWith('i18n/') || EXCLUDED.has(rel)) continue;
        out.push({ rel, src: fs.readFileSync(file, 'utf8') });
    }
    return out;
}

const sources = collectSources();

describe('i18n guard', () => {
    it('every literal t(key) call site has its key in EN_DEFAULTS', () => {
        // First arg is a string literal immediately followed by `,` or `)`
        // (a following `+` or backtick means a dynamic key — checked below).
        const CALL_RX = /\bt\(\s*(['"])((?:[^'"\\]|\\.)+?)\1\s*[,)]/g;
        const missing = [];
        for (const { rel, src } of sources) {
            for (const m of src.matchAll(CALL_RX)) {
                const key = m[2];
                if (!/^[\w.-]+$/.test(key)) continue; // not a translation key
                if (!(key in EN_DEFAULTS)) missing.push(`${rel}: ${key}`);
            }
        }
        expect(missing, `t() keys missing from en-defaults.js — add them (and to server/i18n/defaults/en.js):\n${missing.join('\n')}`).toEqual([]);
    });

    it('the broken `t(key) || fallback` idiom is not used', () => {
        const ANTI_RX = /\bt\(\s*(['"])[^'"]+?\1\s*\)\s*\|\|/g;
        const hits = [];
        for (const { rel, src } of sources) {
            for (const m of src.matchAll(ANTI_RX)) {
                const line = src.slice(0, m.index).split('\n').length;
                hits.push(`${rel}:${line}`);
            }
        }
        expect(hits, `t() returns the raw key when missing, so "|| fallback" never fires. Use t('key', 'Fallback') instead:\n${hits.join('\n')}`).toEqual([]);
    });

    it('client and server default dictionaries have identical key sets', () => {
        const require_ = createRequire(import.meta.url);
        const { GUI_DEFAULTS } = require_(SERVER_DEFAULTS);
        const client = new Set(Object.keys(EN_DEFAULTS));
        const server = new Set(Object.keys(GUI_DEFAULTS));
        const clientOnly = [...client].filter(k => !server.has(k));
        const serverOnly = [...server].filter(k => !client.has(k));
        expect(clientOnly, `keys in en-defaults.js but missing from server/i18n/defaults/en.js (untranslatable in the Languages panel):\n${clientOnly.join('\n')}`).toEqual([]);
        expect(serverOnly, `keys in server/i18n/defaults/en.js but missing from en-defaults.js (no offline English fallback):\n${serverOnly.join('\n')}`).toEqual([]);
    });

    it('neither dictionary defines the same key twice', () => {
        // The key-set check above compares the PARSED objects, so it is blind
        // to this: a duplicated key is silently collapsed by the JS object
        // literal, last one wins, and the earlier entry becomes dead code that
        // still looks editable. Both files had this — 37 keys in the client
        // (`pii.api_key_or_secret` three times) and 13 in the server — so an
        // edit to the first `pii.*` block changed nothing at all and the two
        // dictionaries still passed the parity check.
        //
        // Read the SOURCE, since that is the only place a duplicate exists.
        const files = [
            ['en-defaults.js', path.join(HERE, 'en-defaults.js')],
            ['server/i18n/defaults/en.js', SERVER_DEFAULTS],
        ];
        for (const [label, file] of files) {
            const src = fs.readFileSync(file, 'utf8');
            const seen = new Map();
            const dups = [];
            const re = /^\s*(['"])([A-Za-z0-9_.\-]+)\1\s*:/gm;
            let m;
            // Line numbers are tracked incrementally. The obvious version —
            // `src.slice(0, m.index).split('\n').length` per match — copies and
            // splits the whole file for EVERY key, which is quadratic: at ~5000
            // keys over a 300KB dictionary it is hundreds of millions of
            // characters of work, and this test began timing out at 5s under a
            // parallel run purely from adding keys. Same numbers, linear cost.
            let lastIndex = 0;
            let line = 1;
            while ((m = re.exec(src)) !== null) {
                const key = m[2];
                for (let i = lastIndex; i < m.index; i++) {
                    if (src.charCodeAt(i) === 10) line++;
                }
                lastIndex = m.index;
                if (seen.has(key)) dups.push(`${key} (lines ${seen.get(key)} and ${line})`);
                else seen.set(key, line);
            }
            expect(dups, `${label} defines these keys more than once. The later value wins and the earlier one is dead — editing it has no effect:\n${dups.join('\n')}`).toEqual([]);
        }
    });

    it('dynamic t(`…${x}…`) key prefixes match at least one EN_DEFAULTS key', () => {
        const DYN_RX = /\bt\(\s*`([^`$]*)\$\{/g;
        const CONCAT_RX = /\bt\(\s*(['"])((?:[^'"\\]|\\.)+?)\1\s*\+/g;
        const allKeys = Object.keys(EN_DEFAULTS);
        const bad = [];
        for (const { rel, src } of sources) {
            const prefixes = [
                ...[...src.matchAll(DYN_RX)].map(m => m[1]),
                ...[...src.matchAll(CONCAT_RX)].map(m => m[2]),
            ];
            for (const prefix of prefixes) {
                if (!prefix || prefix.length < 3) continue; // too generic to check
                if (!allKeys.some(k => k.startsWith(prefix))) bad.push(`${rel}: t(\`${prefix}…\`)`);
            }
        }
        expect(bad, `dynamic key prefixes with NO matching EN_DEFAULTS keys (typo or missing entries):\n${bad.join('\n')}`).toEqual([]);
    });
});

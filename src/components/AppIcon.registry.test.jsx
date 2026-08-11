/**
 * Registry discipline for AppIcon.
 *
 * AppIcon resolves icons from ICON_REGISTRY synchronously and falls back to a
 * lazy full-Lucide import for anything else. That fallback is an escape hatch
 * for names typed freely into CMS content — NOT for names we ship ourselves.
 * A seed icon that misses the registry pops in late on the public marketing
 * site; a literal call-site miss flashes a placeholder in app chrome. Both
 * are silent visual defects no other test would catch, so this one fails the
 * build instead.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICON_REGISTRY } from './iconRegistry';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');

const ICON_RE = /icon:\s*['"]([A-Za-z0-9]+)['"]/g;
const LITERAL_RE = /<AppIcon[^>]*?name=\{?['"]([A-Za-z0-9]+)['"]/g;

function namesIn(file, re) {
    const src = fs.readFileSync(file, 'utf8');
    return [...src.matchAll(re)].map((m) => m[1]);
}

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === 'dist') continue;
            walk(p, out);
        } else if (/\.(jsx?|tsx?)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
            out.push(p);
        }
    }
    return out;
}

describe('AppIcon icon registry', () => {
    it('covers every icon the CMS seed content ships', () => {
        const seed = path.join(repoRoot, 'server/scripts/content/beeflowSite.js');
        const missing = [...new Set(namesIn(seed, ICON_RE))]
            .filter((n) => !ICON_REGISTRY[n]);
        expect(missing, `seed icons missing from iconRegistry.js: ${missing.join(', ')}`).toEqual([]);
    });

    it('covers every icon in the CMS block defaults', () => {
        const defaults = path.join(repoRoot, 'server/i18n/defaults/cmsDefaults.js');
        const missing = [...new Set(namesIn(defaults, ICON_RE))]
            .filter((n) => !ICON_REGISTRY[n]);
        expect(missing, `default icons missing from iconRegistry.js: ${missing.join(', ')}`).toEqual([]);
    });

    it('covers every literal <AppIcon name="…"> in src', () => {
        const files = walk(path.join(repoRoot, 'agent-hub/src'));
        const missing = new Set();
        for (const f of files) {
            for (const n of namesIn(f, LITERAL_RE)) {
                if (!ICON_REGISTRY[n]) missing.add(`${n} (${path.relative(repoRoot, f)})`);
            }
        }
        expect([...missing], 'literal AppIcon names missing from iconRegistry.js').toEqual([]);
    });

    it('AppIcon itself has no wildcard lucide import', () => {
        const src = fs.readFileSync(path.join(here, 'AppIcon.jsx'), 'utf8');
        expect(src).not.toMatch(/import \* as .* from 'lucide-react'/);
    });
});

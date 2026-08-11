import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

/**
 * A destructive action may never be hidden behind hover.
 *
 * `opacity-0 group-hover:opacity-100` on a Delete button means three things at
 * once: it is unreachable by keyboard until focus lands on something invisible,
 * it does not exist at all on touch, and the only way to DISCOVER it is to hover
 * a row you were not trying to delete. App Studio had it on the connector list
 * and the table list — the two places where a wrong click loses real data.
 *
 * A source scan rather than a render test on purpose: this is a rule about how
 * the whole surface is written, and the failure mode is someone adding a NEW
 * hidden delete button in a file no test renders.
 */

const ROOT = dirname(fileURLToPath(import.meta.url));
const HIDDEN = /opacity-0[^"'`]*group-hover:opacity-100/;
// A "delete" that is really a text filter, an icon name, or a comment is not a
// control; only an element that both hides itself and destroys something counts.
const DESTRUCTIVE = /\b(Delete|Remove|Trash2|onDelete|onRemove|remove[A-Z]|delete[A-Z])/;

function jsxFiles(dir, out = []) {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) { jsxFiles(full, out); continue; }
        if (/\.(jsx|tsx)$/.test(name) && !/\.test\./.test(name)) out.push(full);
    }
    return out;
}

/** The JSX element (attribute run) each hidden-class match sits in. */
function hiddenElements(source) {
    const out = [];
    const re = /<[a-zA-Z][^>]*>/gs;
    for (const m of source.matchAll(re)) {
        if (HIDDEN.test(m[0])) out.push(m[0]);
    }
    return out;
}

describe('destructive actions are never hover-only', () => {
    const files = jsxFiles(ROOT);

    it('scans a real number of files (the guard itself works)', () => {
        expect(files.length).toBeGreaterThan(40);
    });

    it('no Delete/Remove control is hidden behind group-hover', () => {
        const offenders = [];
        for (const file of files) {
            const source = readFileSync(file, 'utf8');
            if (!HIDDEN.test(source)) continue;
            for (const el of hiddenElements(source)) {
                if (DESTRUCTIVE.test(el)) offenders.push(`${relative(ROOT, file)}: ${el.slice(0, 120)}`);
            }
        }
        expect(offenders).toEqual([]);
    });
});

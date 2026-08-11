import { describe, it, expect } from 'vitest';

/**
 * App Studio — contrast rules that a rendered-HTML test cannot see.
 *
 * The failures this guards against all drifted in the same way: they are
 * CLASS STRINGS, and the panel tests assert behaviour. kit.test.jsx has always
 * passed while the inspector's inputs had no focus indicator at all, because
 * nothing ever looked at a class name. So this is a source scan, deliberately
 * modelled on AppStudio.noPurple.test.jsx — static, fast, and it fails the
 * moment the pattern comes back rather than the next time somebody audits.
 *
 * Each rule states the measurement that justifies it.
 */

const RULES = [
    {
        name: 'no white-on-white hover overlays',
        // hover:bg-white/5 over a light --bg-primary (#fafafa) is a visual
        // no-op: it changes nothing a person can see in light, glass, paper or
        // sepia. Not a WCAG failure — a plain bug, in the four themes half the
        // users pick.
        pattern: /hover:bg-white\/\d+/,
        fix: 'Use hover:bg-[var(--bg-tertiary)] (or --bg-card-hover), which is a real step in every theme.',
    },
    {
        name: 'no focus ring removed without a replacement',
        // SC 2.4.7. `focus:outline-none` with nothing in its place leaves a
        // keyboard user with no idea where they are.
        pattern: /focus:outline-none/,
        allowIf: (line) => /focus-visible:|FOCUS_RING|focus:ring|INPUT_CLS|controlSurfaceClass/.test(line),
        fix: 'Pair it with focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)], or use INPUT_CLS / formStyles.',
    },
    {
        name: 'no 10px text in the muted colour',
        // --text-tertiary aliases --text-muted (#64748b): 3.78:1 on
        // --bg-secondary in the default dark theme, 3.47:1 on --bg-tertiary.
        // SC 1.4.3 wants 4.5:1, and 10px never reaches the large-text
        // threshold that would relax it.
        pattern: /text-\[10px\][^"'`]*text-\[var\(--text-(?:tertiary|muted)\)\]|text-\[var\(--text-(?:tertiary|muted)\)\][^"'`]*text-\[10px\]/,
        fix: 'Use text-[11px] with --text-secondary, or keep 10px and give it --text-secondary.',
    },
    {
        name: 'no --danger token',
        // It is defined nowhere in the platform: `var(--danger, #ef4444)`
        // ALWAYS falls back, so paper (#b91c1c) and sepia (#991b1b) get a red
        // tuned for a dark background on a warm light one.
        pattern: /var\(--danger/,
        fix: 'The token is --error, and every theme defines it.',
    },
];

/** Every non-test source file under the App Studio tree. */
async function sourceFiles() {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const files = [];
    const walk = (p) => {
        const stat = fs.statSync(p);
        if (stat.isDirectory()) {
            for (const entry of fs.readdirSync(p)) walk(path.join(p, entry));
        } else if (/\.(jsx?|css)$/.test(p) && !/\.test\.|contrast\.test/.test(p)) {
            files.push(p);
        }
    };
    walk(__dirname);
    return { files, fs, path };
}

/**
 * Comments are stripped so the prose above (and the reasoning in the files
 * themselves) can name a pattern without tripping its own guard.
 *
 * A block comment is replaced by its own newlines rather than removed, so the
 * line numbers this test reports still point at the offending line.
 */
function stripComments(src) {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('App Studio — builder contrast', () => {
    for (const rule of RULES) {
        it(rule.name, async () => {
            const { files, fs, path } = await sourceFiles();
            expect(files.length).toBeGreaterThan(40);   // sanity: really scanning

            const offenders = [];
            for (const file of files) {
                const lines = stripComments(fs.readFileSync(file, 'utf8')).split('\n');
                lines.forEach((line, i) => {
                    if (!rule.pattern.test(line)) return;
                    if (rule.allowIf && rule.allowIf(line)) return;
                    offenders.push(`${path.basename(file)}:${i + 1}`);
                });
            }
            expect(offenders, `${offenders.join(', ')}\n→ ${rule.fix}`).toEqual([]);
        });
    }
});

describe('App Studio — the editor accent respects the no-purple rule', () => {
    it('is a blue, not the indigo it used to be', async () => {
        const fs = await import('node:fs');
        const path = await import('node:path');
        // Comments stripped, so the file may explain what it moved away from.
        const css = stripComments(fs.readFileSync(path.join(__dirname, 'editor', 'editor.css'), 'utf8'));

        // The old values passed the noPurple guard only because FORBIDDEN is a
        // literal hex list they were not on.
        expect(css).not.toMatch(/#7c6cf5/i);
        expect(css).not.toMatch(/#5b4bd8/i);
        expect(css).toMatch(/--editor-accent:\s*#60a5fa/);
        expect(css).toMatch(/--editor-accent:\s*#2563eb/);
    });

    it('gives both accent shades a contrast colour that clears 10px text', () => {
        // White on the dark-family accent measured 3.95:1 at 10px — the size
        // .ase-resize-badge renders at.
        const dark = contrastRatio('#0b0b10', '#60a5fa');
        const light = contrastRatio('#ffffff', '#2563eb');
        expect(dark).toBeGreaterThanOrEqual(4.5);
        expect(light).toBeGreaterThanOrEqual(4.5);
    });
});

/** WCAG 2.x relative-luminance contrast, so the numbers above are checkable. */
function contrastRatio(a, b) {
    const lum = (hex) => {
        const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
        const ch = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
        return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(bl);
    };
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
}

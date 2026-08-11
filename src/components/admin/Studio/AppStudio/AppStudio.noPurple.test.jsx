import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AppRenderer from './runtime/AppRenderer';
import AppShell from './runtime/AppShell';
import { KITCHEN_SINK, V2_RICH } from './state/sampleDefinitions';

// V2_RICH (sampleDefinitions) exercises every rich component (chart / data grid
// / pivot / stat delta+sparkline / tabs / modal / repeater + the rich form
// inputs) so the rendered-HTML scan below sees their real surfaces.

// Hard project rule: no purple/violet/indigo anywhere. Mirrors the FORBIDDEN
// list in components/WebpagePlanCard.noPurple.test.jsx, extended with the
// remaining banned hexes from the App Studio contract.
const FORBIDDEN = [
    /99\s*,\s*102\s*,\s*241/i, // rgb(99,102,241) = indigo-500
    /#6366f1/i,
    /#4f46e5/i,
    /#818cf8/i,
    /#7c3aed/i,
    /#a855f7/i,
    /indigo/i,
    /violet/i,
    /purple/i,
];

// Every App Studio surface that must stay purple-free. Append new entries
// here as more surfaces land (palette, inspector, theme picker, …).
const SURFACES = [
    {
        name: 'AppRenderer run — dashboard screen',
        render: () => <AppRenderer definition={KITCHEN_SINK} screenId="scr_dash01" mode="run" />,
    },
    {
        name: 'AppRenderer run — form screen',
        render: () => <AppRenderer definition={KITCHEN_SINK} screenId="scr_form01" mode="run" />,
    },
    {
        name: 'AppRenderer edit — dashboard screen',
        render: () => <AppRenderer definition={KITCHEN_SINK} screenId="scr_dash01" mode="edit" />,
    },
    {
        name: 'AppRenderer edit — form screen',
        render: () => <AppRenderer definition={KITCHEN_SINK} screenId="scr_form01" mode="edit" />,
    },
    {
        name: 'AppShell chrome',
        render: () => (
            <AppShell definition={KITCHEN_SINK} screenId="scr_dash01" onNavigate={() => {}}>
                <div>content</div>
            </AppShell>
        ),
    },
    {
        name: 'AppShell chrome — sidebar shell with viewer',
        render: () => (
            <AppShell
                definition={{ ...KITCHEN_SINK, nav: { style: 'sidebar' } }}
                screenId="scr_dash01"
                onNavigate={() => {}}
                viewer={{ id: 'u1', name: 'Vera Viewer', email: 'vera@example.test', isOwner: true }}
                onExit={() => {}}
            >
                <div>content</div>
            </AppShell>
        ),
    },
    {
        name: 'AppRenderer run — v2 rich components',
        render: () => <AppRenderer definition={V2_RICH} screenId="scr_rich01" mode="run" />,
    },
    {
        name: 'AppRenderer edit — v2 rich components',
        render: () => <AppRenderer definition={V2_RICH} screenId="scr_rich01" mode="edit" />,
    },
];

describe('App Studio — no purple', () => {
    for (const surface of SURFACES) {
        it(`${surface.name} has no purple/violet/indigo`, () => {
            const { container } = render(surface.render());
            const html = container.innerHTML;
            expect(html.length).toBeGreaterThan(0);
            for (const re of FORBIDDEN) {
                expect(re.test(html), `${surface.name} must not contain ${re}`).toBe(false);
            }
        });
    }
});

// Rendered-HTML checks only see the default state; conditional branches
// (hover styles, error states, rarely-rendered panels) escape them. This
// source-level scan covers EVERY App Studio file — editor, inspector,
// palette, chat, runtime, run page, hooks — with comments stripped so prose
// like this sentence can say "purple" without tripping the guard.
describe('App Studio — no purple in source', () => {
    it('no banned color appears in any App Studio source file', async () => {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const roots = [
            __dirname, // the whole AppStudio tree
            path.resolve(__dirname, '../../../../pages/apps'),
            path.resolve(__dirname, '../../../../hooks/useAppBuilderStream.js'),
        ];
        const files = [];
        const walk = (p) => {
            const stat = fs.statSync(p);
            if (stat.isDirectory()) {
                for (const entry of fs.readdirSync(p)) walk(path.join(p, entry));
            } else if (/\.(jsx?|css)$/.test(p) && !/\.test\.|noPurple/.test(p)) {
                files.push(p);
            }
        };
        roots.forEach((r) => fs.existsSync(r) && walk(r));
        expect(files.length).toBeGreaterThan(40); // sanity: the tree is really being scanned

        const offenders = [];
        for (const file of files) {
            const src = fs.readFileSync(file, 'utf8')
                .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
                .replace(/(^|[^:])\/\/.*$/gm, '$1'); // line comments (keep http://)
            for (const re of FORBIDDEN) {
                if (re.test(src)) offenders.push(`${path.basename(file)} matches ${re}`);
            }
        }
        expect(offenders, offenders.join('; ')).toEqual([]);
    });
});

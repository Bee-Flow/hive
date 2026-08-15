/**
 * The "sidebar item does nothing" trap, pinned.
 *
 * AgentHub's main content is one long ternary. A branch keyed on `currentPage`
 * that sits ABOVE the overlay branches wins over them, so while such a page is
 * on screen, opening the marketplace / KB store / a chat only flips a flag
 * nothing renders — the click appears to do nothing. That was BFSF-267, and it
 * came back for Cowork.
 *
 * closeAllOverlays() compensates by navigating away from those pages, driven by
 * the PAGES_ABOVE_OVERLAYS list. This test is the thing that notices when
 * someone adds a page above the overlays and forgets the list.
 *
 * Asserted over the source text (same approach as the server's
 * aiTaskRunner.autoSend tests) because rendering AgentHub means standing up the
 * whole app.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'AgentHub.jsx'),
    'utf8',
);

// The first overlay-flag branch in the ternary. Everything before it outranks
// every overlay.
const FIRST_OVERLAY_BRANCH = /\)\s*:\s*showAITasks\s*\?\s*\(/;

function declaredPages() {
    const m = SRC.match(/const PAGES_ABOVE_OVERLAYS = \[([^\]]*)\]/);
    if (!m) return null;
    return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
}

function pageBranchesAboveOverlays() {
    const cut = SRC.search(FIRST_OVERLAY_BRANCH);
    const before = SRC.slice(0, cut);
    // Only the render-chain branches, i.e. `) : currentPage === 'x' ? (`.
    return [...before.matchAll(/\)\s*:\s*currentPage === '([^']+)'\s*\?\s*\(/g)].map(m => m[1]);
}

describe('AgentHub — pages that outrank the overlay branches', () => {
    it('still has the list and the overlay branches it describes', () => {
        expect(declaredPages()).not.toBeNull();
        expect(SRC).toMatch(FIRST_OVERLAY_BRANCH);
    });

    it('lists every currentPage branch rendered above the overlays', () => {
        const declared = declaredPages();
        for (const page of pageBranchesAboveOverlays()) {
            expect(
                declared,
                `'${page}' renders above the overlay branches but is missing from `
                + 'PAGES_ABOVE_OVERLAYS, so opening the marketplace / KB store / a '
                + 'chat while it is on screen will silently do nothing',
            ).toContain(page);
        }
    });

    it('does not list pages that no longer outrank the overlays', () => {
        const above = pageBranchesAboveOverlays();
        for (const page of declaredPages()) {
            expect(
                above,
                `'${page}' is in PAGES_ABOVE_OVERLAYS but no longer renders above `
                + 'the overlays, so closeAllOverlays navigates away for no reason',
            ).toContain(page);
        }
    });

    it('closeAllOverlays acts on the list, and lets a modal caller opt out', () => {
        expect(SRC).toMatch(/PAGES_ABOVE_OVERLAYS\.includes\(currentPage\) && onNavigate\) onNavigate\('agents'\)/);
        // The search palette floats above the content; it must not evict the page.
        expect(SRC).toMatch(/onOpenSearch=\{\(\) => \{ closeAllOverlays\(\{ keepPage: true \}\)/);
    });
});

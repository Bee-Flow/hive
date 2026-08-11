/**
 * Every registered demo must actually mount, and must do it without reaching
 * for a route we forgot to fixture.
 *
 * These demos are public and anonymous, so the two failure modes are:
 *   1. it crashes or shows a lock screen — a broken shop window
 *   2. it asks for something the transport does not know
 *
 * (2) is the one that matters and the one that is invisible by eye: the
 * transport 404s the call, the component swallows the error, and the panel
 * just renders empty. So the test asserts on the transport's own
 * "no fixture for …" warning rather than on pixels — which also makes this
 * the tool for extending a demo: add a feature, run this, fixture whatever
 * it names.
 *
 * Run: cd agent-hub && npx vitest run src/demo/DemoHost.test.jsx
 */
import React from 'react';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DemoHost from './DemoHost';
import { DEMO_FEATURE_IDS, DEMO_FEATURES } from './registry';
import { isDemoMode } from '../utils/helpers';

let fetchSpy;
let warnSpy;
let missing;

beforeEach(() => {
    missing = [];
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    warnSpy = vi.spyOn(console, 'warn').mockImplementation((...args) => {
        const first = String(args[0] ?? '');
        if (first.startsWith('[demo] no fixture for')) missing.push(first);
    });
});

afterEach(() => {
    cleanup();
    fetchSpy.mockRestore();
    warnSpy.mockRestore();
});

describe('the demo route', () => {
    // The server mirrors this list in cmsDefaults.DEMO_FEATURE_IDS (it cannot
    // import registry.js — React lazy() imports). Both halves are pinned so a
    // demo added on one side and forgotten on the other shows up as a failing
    // test rather than as a validator warning nobody reads.
    it('registers exactly the features the server knows about', () => {
        expect([...DEMO_FEATURE_IDS].sort()).toEqual(['agents', 'app-studio', 'compliance', 'knowledge', 'legal', 'meeting-notes', 'monitoring', 'notebooks', 'privacy-shield', 'routines', 'skills', 'support']);
    });

    it('shows a clear message for an unknown feature instead of a blank frame', async () => {
        render(<DemoHost feature="not-a-feature" />);
        expect(await screen.findByText('Demo not found')).toBeInTheDocument();
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it.each(DEMO_FEATURE_IDS)('%s mounts without touching the network', async (id) => {
        render(<DemoHost feature={id} />);

        // data-demo-feature lands once the fixtures are in and the feature is
        // rendering — a "we got past loading" pin that survives chrome changes.
        await waitFor(() => expect(document.querySelector('[data-demo-feature]')).not.toBeNull(), { timeout: 8000 });
        // Let the feature's own mount-time fetches settle.
        await new Promise(r => setTimeout(r, 50));

        expect(fetchSpy).not.toHaveBeenCalled();
    });

    // Waiting on the host element is not enough: the ErrorBoundary sits INSIDE
    // it, and the fixture list may not have arrived yet. Both demos that
    // shipped broken passed exactly that way — a fixed delay expired before
    // the crash. So wait for the demo's OWN content, then assert it survived.
    //
    // This is also what makes the two classes of fixture bug visible:
    //   wrong VALUE → the marker never appears (empty panel)
    //   wrong SHAPE → the ErrorBoundary trips (`(x || []).map is not a
    //                 function`, `undefined.toLowerCase()`)
    it.each(DEMO_FEATURE_IDS)('%s renders its sample data without crashing', async (id) => {
        const expected = DEMO_FEATURES[id].expectText;
        expect(expected, `${id} must declare expectText in the registry`).toBeTruthy();

        render(<DemoHost feature={id} />);

        await waitFor(
            () => expect(document.body.textContent).toContain(expected),
            { timeout: 15_000 },
        );
        // Give anything that renders after the first paint a chance to throw.
        await new Promise(r => setTimeout(r, 400));

        expect(
            screen.queryByText(/Something went wrong/i),
            `${id} crashed — open /__demo__/${id} and read the error detail`,
        ).toBeNull();
    // Per-test timeout must exceed the waitFor budget above, or the intended
    // wait can never be spent — vitest's 5s default killed the test first.
    // `routines` needs the headroom: it mounts the whole React Flow canvas with
    // a populated workflow AND (since the run-rehydration work) the last run's
    // rows — edge chips, run status, decorated edges — at first paint. It runs
    // ~2s on its own, 4-5x every other demo, and is the one that tips over
    // under full-suite parallel load.
    }, 25_000);

    it.each(DEMO_FEATURE_IDS)('%s has a fixture for every route it asks for', async (id) => {
        render(<DemoHost feature={id} />);
        await waitFor(() => expect(document.querySelector('[data-demo-feature]')).not.toBeNull(), { timeout: 8000 });
        await new Promise(r => setTimeout(r, 250));

        expect(missing, `unfixtured routes:\n  ${missing.join('\n  ')}`).toEqual([]);
    });

    // A demo that mounts cleanly can still be useless: the Routines demo
    // first shipped landing on an empty "New automation" canvas, and the
    // meeting showed "Speaker 1..4" because the UI labels speakers by their
    // id. Both looked fine to every other assertion here. So: pin that each
    // demo actually renders its sample content.
    it('meeting notes shows named people, not "Speaker 1"', async () => {
        render(<DemoHost feature="meeting-notes" />);
        await waitFor(
            () => expect(screen.getAllByText(/Intake flow — pilot review/).length).toBeGreaterThan(0),
            { timeout: 6000 },
        );
        await new Promise(r => setTimeout(r, 150));
        expect(document.body.textContent).toMatch(/Sanne de Vries/);
        expect(document.body.textContent).not.toMatch(/Speaker 1/);
    });

    // The "this is sample data" disclosure lives on the marketing page (the
    // feature-demo block), NOT inside the frame — a strip in here ate
    // vertical space from the product itself. What the host must guarantee
    // is that it adds no chrome of its own when framed; the one standalone
    // exception (the ?vw= close button) is pinned in its own describe below.
    it('renders the feature full-bleed, with no demo chrome of its own', async () => {
        render(<DemoHost feature="routines" />);
        await waitFor(() => expect(document.querySelector('[data-demo-feature]')).not.toBeNull(), { timeout: 8000 });
        expect(screen.queryByText('Live demo')).toBeNull();
        expect(screen.queryByText(/Open the real thing/)).toBeNull();
    });

    it('removes the demo transport on unmount so the app is unaffected', async () => {
        const { unmount } = render(<DemoHost feature="routines" />);
        await waitFor(() => expect(isDemoMode()).toBe(true));
        unmount();
        expect(isDemoMode()).toBe(false);
    });
});

// ?vw= lets the marketing page's mobile "Open full screen" link ask this
// document for a desktop layout viewport. Framed it is inert — viewport meta
// only applies to top-level documents — so the behaviour to pin is the
// standalone one: meta written, out-of-range clamped, garbage failing closed
// to device-width. The effect runs before the feature resolves, so mounting
// the not-found branch exercises exactly the same code without booting a
// Studio component.
describe('the ?vw= viewport override', () => {
    afterEach(() => {
        window.history.replaceState({}, '', '?');
        document.querySelector('meta[name="viewport"]')?.remove();
    });

    async function mountWith(query) {
        window.history.replaceState({}, '', query);
        render(<DemoHost feature="not-a-feature" />);
        await screen.findByText('Demo not found');
    }

    const meta = () => document.querySelector('meta[name="viewport"]');

    it('writes the requested width into the viewport meta', async () => {
        await mountWith('?vw=1280');
        expect(meta()?.getAttribute('content')).toBe('width=1280, viewport-fit=cover');
    });

    it('clamps an absurd width down to 1600', async () => {
        await mountWith('?vw=40000');
        expect(meta()?.getAttribute('content')).toBe('width=1600, viewport-fit=cover');
    });

    it('clamps a sub-tablet width up to 768', async () => {
        await mountWith('?vw=10');
        expect(meta()?.getAttribute('content')).toBe('width=768, viewport-fit=cover');
    });

    it('fails closed on a non-integer', async () => {
        await mountWith('?vw=abc');
        expect(meta()).toBeNull();
    });

    it('leaves the viewport alone when the param is absent', async () => {
        await mountWith('?');
        expect(meta()).toBeNull();
    });

    // The close button is the host's ONE piece of chrome, and only in the
    // full-screen flow (?vw= present, document owns the tab — which jsdom's
    // window.self === window.top satisfies). Without vw there must be none,
    // which is also what keeps the framed no-chrome guarantee intact.
    it('shows a close button back to the website only in the full-screen flow', async () => {
        await mountWith('?vw=1280');
        expect(screen.getByRole('button', { name: /Close the demo/ })).toBeInTheDocument();
        cleanup();
        await mountWith('?');
        expect(screen.queryByRole('button', { name: /Close the demo/ })).toBeNull();
    });

    it('the close button goes back to the page the visitor came from', async () => {
        // pushState (not replace) so there is real history behind the demo,
        // the same shape as the marketing page's same-tab navigation.
        window.history.pushState({}, '', '?vw=1280');
        render(<DemoHost feature="not-a-feature" />);
        await screen.findByText('Demo not found');

        const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
        fireEvent.click(screen.getByRole('button', { name: /Close the demo/ }));
        expect(backSpy).toHaveBeenCalledTimes(1);
        backSpy.mockRestore();
    });
});

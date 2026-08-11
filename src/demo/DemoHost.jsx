import React, { useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { setDemoTransport } from '../utils/helpers';
import { createDemoTransport } from './demoTransport';
import { getDemoFeature, DEMO_FEATURE_IDS } from './registry';
import { COMMON_ROUTES, DEMO_USER } from './fixtures/common';
import { EntitlementsProvider } from '../components/EntitlementsContext';
import { LicenseProvider } from '../components/LicenseContext';
import ErrorBoundary from '../components/ErrorBoundary';

/**
 * Host for the public feature demos at /__demo__/<feature>.
 *
 * Renders the REAL Studio component — same code, same CSS, same layout as the
 * product — against an in-memory fixture backend. It is mounted from AppRoot
 * before any auth handling, so it works for anonymous visitors, and it is
 * designed to be framed by a marketing page.
 *
 * WHY THE TRANSPORT IS INSTALLED BEFORE THE FIRST RENDER
 * Studio components fetch on mount. If the feature rendered first and the
 * transport went in from an effect, that first burst of requests would go to
 * the real API as an anonymous visitor. `useState(initialiser)` runs during
 * render, before children exist, so there is no window where both are true.
 *
 * WHAT MAKES THIS SAFE
 *   • authFetch is short-circuited: no request reaches the network, and an
 *     unmapped route 404s rather than falling through (demoTransport).
 *   • No session is created, read or sent. The host never touches the session
 *     token, and the transport ignores credentials entirely.
 *   • Fixtures are compile-time constants — there is no visitor-supplied
 *     content, so nothing here can be poisoned by what someone types.
 *   • Writes mutate a plain object in the tab and are gone on reload.
 */
export default function DemoHost({ feature: featureId }) {
    const feature = getDemoFeature(featureId);
    const [fixtures, setFixtures] = useState(null);
    const [loadError, setLoadError] = useState(null);

    // The host provides everything a feature needs to stand alone — the
    // App Studio demo is the first react-query consumer, and in the browser
    // it happened to inherit the app root's QueryClient while the tests
    // (which render DemoHost directly) had none. An OWN client is also the
    // correct isolation: demo queries never share the real app's cache, and
    // a 404 from the fail-closed transport must not be retried.
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: { queries: { retry: false } },
    }));

    // Install the transport during the FIRST render, synchronously, and keep
    // the same instance for the life of the host.
    const [installed] = useState(() => {
        if (!feature) return false;
        setDemoTransport(createDemoTransport({ ...COMMON_ROUTES }, {}));
        return true;
    });

    useEffect(() => () => { setDemoTransport(null); }, []);

    // Swap in the feature's real routes + state once its fixture module lands.
    useEffect(() => {
        if (!feature) return undefined;
        let cancelled = false;
        feature.loadFixtures()
            .then((mod) => {
                if (cancelled) return;
                const state = mod.createState();
                setDemoTransport(createDemoTransport({ ...COMMON_ROUTES, ...mod.ROUTES }, state));
                // Runs BEFORE the feature's first render, so a hook the
                // component reads in a useState initialiser still sees it.
                try { feature.beforeMount?.(state); }
                catch (err) { console.warn('[demo] beforeMount failed', err); }
                setFixtures({ state });
            })
            .catch((err) => { if (!cancelled) setLoadError(err); });
        return () => { cancelled = true; };
    }, [feature]);

    // The demo is framed by the marketing site, which has its own light/dark
    // handling; honour ?theme= so the frame can match its surroundings.
    // ?vw=<px> asks this document to lay out at a desktop viewport width:
    // the marketing page's mobile "Open full screen" link passes 1280 so a
    // phone renders the desktop layout, natively pinch-zoomable (no
    // initial-scale, so the browser fits the whole app on screen first).
    // That link navigates in the SAME tab, which is what lets the close
    // button below history.back() to the exact page the visitor left.
    // Viewport meta only applies to top-level documents, so this is inert
    // whenever the host is framed; a non-integer fails closed to
    // device-width. No restore on unmount, same as data-theme: /__demo__/
    // is a full-document destination, there is no client-side route away.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const theme = params.get('theme');
        document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');

        const vw = Number.parseInt(params.get('vw') || '', 10);
        if (Number.isInteger(vw)) {
            const clamped = Math.min(1600, Math.max(768, vw));
            let meta = document.querySelector('meta[name="viewport"]');
            if (!meta) {
                meta = document.createElement('meta');
                meta.setAttribute('name', 'viewport');
                document.head.appendChild(meta);
            }
            meta.setAttribute('content', `width=${clamped}, viewport-fit=cover`);
        }
    }, []);

    const props = useMemo(
        () => ({ ...(feature?.props || {}), user: DEMO_USER, hasPermission: () => true }),
        [feature],
    );

    if (!feature) {
        return (
            <DemoFrame title="Demo not found">
                <p className="text-sm text-[var(--text-secondary)]">
                    No demo is registered for “{String(featureId)}”.
                    {' '}Available: {DEMO_FEATURE_IDS.join(', ')}.
                </p>
            </DemoFrame>
        );
    }

    if (loadError) {
        return (
            <DemoFrame title={feature.label}>
                <p className="text-sm text-red-400">This demo failed to load.</p>
            </DemoFrame>
        );
    }

    if (!installed || !fixtures) {
        return (
            <DemoFrame title={feature.label}>
                <p className="text-sm text-[var(--text-secondary)]">Loading the demo…</p>
            </DemoFrame>
        );
    }

    const Feature = feature.Component;
    return (
        // No banner inside the frame: it stole vertical space from the thing
        // the visitor came to look at, and duplicated a disclosure the
        // marketing page already carries under the frame (the `feature-demo`
        // block). The ONE exception is the floating close button, and only
        // when this document is the whole tab — the mobile full-screen flow.
        // Framed, the host still adds no chrome of its own.
        // `data-demo-feature` is the mount signal the tests use.
        <div
            className="demo-host h-[100dvh] flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden"
            data-demo-feature={feature.id}
        >
            {isStandaloneFullScreen() ? <CloseDemoButton /> : null}
            {/* overflow-y-auto, not hidden. Several demos are taller than the
                frame the marketing page gives them — the organisation usage
                view runs to about 1400px — and `overflow-hidden` clipped the
                rest with no way to reach it. Demos that manage their own
                scrolling (the chat, the automation canvas) have inner scroll
                containers with fixed heights, so an outer scroller never
                engages for them. x stays hidden: a horizontal scrollbar inside
                an iframe on a marketing page is always a layout bug. */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                <ErrorBoundary label={`demo:${feature.id}`}>
                    <QueryClientProvider client={queryClient}>
                        <EntitlementsProvider>
                            <LicenseProvider>
                                <React.Suspense fallback={<div className="p-6 text-sm text-[var(--text-secondary)]">Loading…</div>}>
                                    <Feature {...props} />
                                </React.Suspense>
                            </LicenseProvider>
                        </EntitlementsProvider>
                    </QueryClientProvider>
                </ErrorBoundary>
            </div>
        </div>
    );
}

function DemoFrame({ title, children }) {
    return (
        <div className="h-[100dvh] flex flex-col items-center justify-center gap-2 bg-[var(--bg-primary)] text-[var(--text-primary)] p-8">
            {isStandaloneFullScreen() ? <CloseDemoButton /> : null}
            <h1 className="text-base font-semibold">{title}</h1>
            {children}
        </div>
    );
}

// True only for the mobile full-screen flow: this document owns the whole
// tab AND arrived with ?vw= (the marketing block's links are the only thing
// that sets it). Framed embeds never qualify — window.top differs — so the
// no-chrome-when-framed guarantee holds without any postMessage handshake.
// Plain function, not a hook: neither the URL nor frame-ness changes during
// the life of the document.
function isStandaloneFullScreen() {
    if (typeof window === 'undefined') return false;
    if (window.self !== window.top) return false;
    const vw = Number.parseInt(new URLSearchParams(window.location.search).get('vw') || '', 10);
    return Number.isInteger(vw);
}

function CloseDemoButton() {
    const ref = useRef(null);

    // With the widened viewport meta the layout viewport is ~1280px while the
    // phone shows it pinch-zoomed out; position:fixed sticks to the LAYOUT
    // viewport, so an unadjusted 44px button would paint at ~13px and drift
    // off-screen the moment the visitor pans. Glue it to the visual viewport
    // and counter-scale, so it stays ~44 on-screen px at any zoom. jsdom and
    // desktop browsers without pinch-zoom take the static fallback style.
    useEffect(() => {
        const el = ref.current;
        const vv = window.visualViewport;
        if (!el || !vv) return undefined;
        const sync = () => {
            const scale = vv.scale || 1;
            const size = Math.round(44 / scale);
            const margin = Math.round(10 / scale);
            el.style.width = `${size}px`;
            el.style.height = `${size}px`;
            el.style.right = 'auto';
            el.style.left = `${Math.round(vv.offsetLeft + vv.width - size - margin)}px`;
            el.style.top = `${Math.round(vv.offsetTop + margin)}px`;
        };
        sync();
        vv.addEventListener('resize', sync);
        vv.addEventListener('scroll', sync);
        return () => {
            vv.removeEventListener('resize', sync);
            vv.removeEventListener('scroll', sync);
        };
    }, []);

    const close = () => {
        // Same-tab arrival means real history: back restores the marketing
        // page, scroll position included. A cold direct open of the URL has
        // nothing behind it — land on the site's front page instead.
        if (window.history.length > 1) window.history.back();
        else window.location.assign('/');
    };

    return (
        <button
            ref={ref}
            type="button"
            onClick={close}
            aria-label="Close the demo and go back to the website"
            title="Close the demo"
            className="demo-close-btn"
            style={{
                position: 'fixed', top: 10, right: 10, width: 44, height: 44,
                zIndex: 2147483000,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 999, border: '1px solid rgba(255, 255, 255, 0.25)',
                background: 'rgba(15, 23, 42, 0.62)', color: '#fff',
                cursor: 'pointer', padding: 0,
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
            }}
        >
            <X aria-hidden="true" style={{ width: '52%', height: '52%' }} />
        </button>
    );
}

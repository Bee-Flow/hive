// Publish the host React family to window.__BEEFLOW_SHARED__ before ANYTHING
// else, so runtime-loaded module bundles (resolved through the index.html import
// map to the public/module-shims/*.js shims) always bind to this one React.
import './moduleRuntime/sharedRuntime'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'
import { TranslationProvider } from './hooks/useTranslation'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { ThemeProvider } from './components/ThemeContext.jsx'
import { Toaster } from './components/shared/Toast.tsx'
import { drainErrorQueue } from './utils/clientErrorReporter'
import { sealDemoBeforeBoot } from './utils/helpers'
import { reportWebVitals } from './utils/webVitalsReporter'
import { initOpenObserve } from './telemetry/openobserve'
import { queryClient } from './api/queryClient'
import './index.css'

// Embed route — `/chat/<id>` is mounted before LicenseProvider runs and would
// otherwise inherit the host org's saved theme. We freeze the theme to the URL
// param (light/dark) and lock `allowUserOverride` off so the inner toggle
// button manages presentation without bleeding the embedder's branding into
// the outer provider's localStorage cache or server fetch.
function pickInitialOverride() {
    try {
        if (!window.location.pathname.startsWith('/chat/')) return null;
        const params = new URLSearchParams(window.location.search);
        const t = params.get('theme');
        const preset = (t === 'light' || t === 'dark') ? t : 'light';
        return { preset, allowUserOverride: false };
    } catch (_) {
        return null;
    }
}

// Real-user monitoring + browser-logs. MUST run before React mounts so the SDK
// instruments the initial navigation / long tasks / errors. No-op unless a
// client token is present in a production build; on the public marketing site
// it additionally waits for cookie consent (see telemetry/openobserve).
initOpenObserve();

// On a public feature demo, seal the API off BEFORE React renders. DemoHost
// owns the real fixture transport, but it is lazy — and the shell's providers
// mount and fetch while its chunk is still in flight. See sealDemoBeforeBoot.
sealDemoBeforeBoot(window.location.pathname);

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ErrorBoundary label="root">
            <QueryClientProvider client={queryClient}>
                <ThemeProvider initialOverride={pickInitialOverride()}>
                    <TranslationProvider>
                        <App />
                        <Toaster />
                    </TranslationProvider>
                </ThemeProvider>
            </QueryClientProvider>
        </ErrorBoundary>
    </React.StrictMode>,
)

// Start the remote-module runtime: it (re)fetches the installed frontend
// modules on every `beeflow:auth-changed` and publishes them to the Studio
// registry via `beeflow:modules-changed`. Kept out of the React tree so it runs
// once regardless of re-renders.
//
// Imported dynamically, and after IDLE — not merely after mount. The registry
// pulls in RemoteStudioApp → studioApps → the Studio route table; a plain
// post-mount import() still fetched that chunk graph and called
// /api/modules/frontend on every marketing pageview, competing with the LCP
// image and fonts for bandwidth during exactly the window Lighthouse scores.
// Nothing here is needed before first paint: the runtime reacts to
// `beeflow:auth-changed`, which cannot have fired yet, and an anonymous
// visitor has no installed modules to fetch. The 4s timeout floor keeps a
// signed-in user's module load from waiting forever on a busy tab.
const startModuleRuntime = () => import('./moduleRuntime/registry')
    .then(m => m.startRemoteModuleRuntime())
    .catch(e => console.warn('[main] module runtime failed to start', e));
if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(startModuleRuntime, { timeout: 4000 });
} else {
    setTimeout(startModuleRuntime, 1500);
}

// Best-effort: ship any error reports that the previous session couldn't
// deliver (offline / server outage). Runs after mount so the UI isn't
// blocked; ignored entirely if IndexedDB is unavailable.
drainErrorQueue().catch((e) => console.warn('[main] drainErrorQueue failed', e));

// Real-user Core Web Vitals beacons. Establishes the baseline for the
// upcoming lazy-load / memoization work in later refactor phases.
reportWebVitals();

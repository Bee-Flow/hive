import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'
import { TranslationProvider } from './hooks/useTranslation'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { ThemeProvider } from './components/ThemeContext.jsx'
import { Toaster } from './components/shared/Toast.tsx'
import { drainErrorQueue } from './utils/clientErrorReporter'
import { reportWebVitals } from './utils/webVitalsReporter'
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

// Best-effort: ship any error reports that the previous session couldn't
// deliver (offline / server outage). Runs after mount so the UI isn't
// blocked; ignored entirely if IndexedDB is unavailable.
drainErrorQueue().catch((e) => console.warn('[main] drainErrorQueue failed', e));

// Real-user Core Web Vitals beacons. Establishes the baseline for the
// upcoming lazy-load / memoization work in later refactor phases.
reportWebVitals();

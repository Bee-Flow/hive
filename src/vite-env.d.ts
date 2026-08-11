/// <reference types="vite/client" />

// Build-time constants injected via define() in vite.config.js. Rollup
// inlines these as string literals at build time.
declare const __APP_VERSION__: string;
declare const __APP_BUILD_SHA__: string;
declare const __APP_BUILD_DATE__: string;

// Custom Vite env entries used by the app. Keep in sync with the
// VITE_* variables documented in .env.example.
interface ImportMetaEnv {
    readonly VITE_API_URL?: string;
    readonly VITE_BUILD_SHA?: string;
    readonly VITE_BUNDLE_ANALYZE?: string;
    // OpenObserve RUM + browser-logs (see src/telemetry/openobserve.js).
    readonly VITE_OPENOBSERVE_ENABLE?: string;
    readonly VITE_OPENOBSERVE_CLIENT_TOKEN?: string;
    readonly VITE_OPENOBSERVE_APPLICATION_ID?: string;
    readonly VITE_OPENOBSERVE_SITE?: string;
    readonly VITE_OPENOBSERVE_ORG?: string;
    readonly VITE_OPENOBSERVE_SERVICE?: string;
    readonly VITE_OPENOBSERVE_ENV?: string;
    readonly VITE_OPENOBSERVE_SESSION_SAMPLE_RATE?: string;
    readonly VITE_OPENOBSERVE_REPLAY_SAMPLE_RATE?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

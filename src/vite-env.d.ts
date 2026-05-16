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
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

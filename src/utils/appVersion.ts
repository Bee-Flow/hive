/**
 * Build-time version metadata.
 *
 * Values are injected by vite.config.js via `define` — rollup inlines them as
 * string literals so there's no runtime cost and no way for them to be
 * undefined in a real build. In dev the values fall back to the local git SHA.
 *
 * CI (.github/workflows/build-push-ghcr.yml) passes `${{ github.sha }}` into
 * the agent-hub Docker build as VITE_BUILD_SHA, so every deployment gets a
 * unique version string that traces back to a commit.
 */

/* global __APP_VERSION__, __APP_BUILD_SHA__, __APP_BUILD_DATE__ */

export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
export const APP_BUILD_SHA = typeof __APP_BUILD_SHA__ !== 'undefined' ? __APP_BUILD_SHA__ : 'dev';
export const APP_BUILD_DATE = typeof __APP_BUILD_DATE__ !== 'undefined' ? __APP_BUILD_DATE__ : '';

/**
 * Short, single-line version string intended for footers — "v1.0.0 · a1b2c3d".
 * When the SHA is "dev" (local, no git) we drop the dot so it reads "v1.0.0".
 */
export function formatVersion() {
    if (!APP_BUILD_SHA || APP_BUILD_SHA === 'dev') return `v${APP_VERSION}`;
    return `v${APP_VERSION} · ${APP_BUILD_SHA}`;
}

/**
 * Long version string for tooltips — adds the build date.
 */
export function formatVersionWithDate() {
    const base = formatVersion();
    if (!APP_BUILD_DATE) return base;
    // Trim to yyyy-mm-dd hh:mm UTC so it's short enough for a tooltip.
    const date = APP_BUILD_DATE.slice(0, 16).replace('T', ' ');
    return `${base} · built ${date} UTC`;
}

export default {
    APP_VERSION,
    APP_BUILD_SHA,
    APP_BUILD_DATE,
    formatVersion,
    formatVersionWithDate,
};

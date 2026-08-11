import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { API_BASE, authFetch, isDemoPath } from '../utils/helpers';
import WallpaperLayer from './WallpaperLayer';
import { applyThemeToDocument } from './theme/applyTheme';

/**
 * ThemeContext — single source of truth for the active theme + branding.
 *
 *   - On mount, calls GET /api/branding/effective. If that 401s (no session
 *     yet, e.g. login page), falls back to GET /api/branding/public.
 *   - Writes data-theme and knob CSS vars to <html> in a useLayoutEffect
 *     so paint always reflects the latest state without a flash.
 *   - Stashes the resolved values in localStorage['beeflow:theme:bootstrap']
 *     so the pre-React script in index.html can apply them synchronously on
 *     the next reload.
 *
 * Resolution at boot: pre-React script → initial state from same localStorage
 * → /api/branding/effective on mount reconciles with server truth.
 *
 * Preview mode: when the URL contains ?themePreview=1 (used by the admin
 * Theme Studio inside same-origin iframes), the provider short-circuits the
 * server fetch and reads its theme from the `t=` query param (base64-JSON).
 * It then listens for postMessage updates from window.parent so slider drags
 * propagate live without re-encoding the URL. Bootstrap localStorage writes
 * are suppressed in preview mode to keep the admin's saved baseline clean.
 */

const BOOTSTRAP_KEY = 'beeflow:theme:bootstrap';

const DEFAULTS = Object.freeze({
    preset: 'light',
    accent: '#9ca3af',
    radiusScale: 1,
    font: 'system',
    wallpaperOverlay: 0.1,
    glassIntensity: 1,
    // Glass v2 config — drive [data-*] attrs on <html> for CSS to pick up.
    wallpaperPreset: 'mono',
    glassTint: 'neutral',
    glassLens: 'on',
    glassAnimation: 'off',
    glassGrain: 'subtle',
    glassBorder: 'subtle',
    glassTierSubtle: null,
    glassTierDefault: null,
    glassTierOpaque: null,
    wallpaperUrl: null,
    allowUserOverride: true,
    source: 'default',
});

function readBootstrap() {
    try {
        const raw = localStorage.getItem(BOOTSTRAP_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        return parsed;
    } catch (_) {
        return null;
    }
}

function writeBootstrap(theme) {
    try {
        localStorage.setItem(BOOTSTRAP_KEY, JSON.stringify({
            preset: theme.preset,
            accent: theme.accent,
            radiusScale: theme.radiusScale,
            font: theme.font,
            wallpaperUrl: theme.wallpaperUrl,
            wallpaperOverlay: theme.wallpaperOverlay,
            glassIntensity: theme.glassIntensity,
            // Glass v2 attrs — applied by the pre-React bootstrap script in
            // index.html so the page paints with the right look on first frame.
            wallpaperPreset: theme.wallpaperPreset,
            glassTint: theme.glassTint,
            glassLens: theme.glassLens,
            glassAnimation: theme.glassAnimation,
            glassGrain: theme.glassGrain,
            glassBorder: theme.glassBorder,
        }));
    } catch (_) { /* quota, ignore */ }
}

function detectPreviewMode() {
    if (typeof window === 'undefined') return { inPreview: false, initial: null };
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('themePreview') !== '1') return { inPreview: false, initial: null };
        const t = params.get('t');
        if (!t) return { inPreview: true, initial: null };
        // URL-safe base64 → standard base64 → JSON.
        const b64 = t.replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
        const parsed = JSON.parse(atob(padded));
        if (!parsed || typeof parsed !== 'object') return { inPreview: true, initial: null };
        return { inPreview: true, initial: parsed };
    } catch (e) {
        console.warn('[Theme] preview payload parse failed:', e);
        return { inPreview: true, initial: null };
    }
}

const ThemeContext = createContext({
    ...DEFAULTS,
    loading: true,
    error: null,
    setUserOverride: async () => {},
    clearUserOverride: async () => {},
    setAdminDefault: async () => {},
    uploadWallpaper: async () => {},
    deleteWallpaper: async () => {},
    reload: async () => {},
});

export function ThemeProvider({ children, initialOverride = null }) {
    // Preview mode is decided once per provider mount from the URL. The Theme
    // Studio re-creates the iframe (and therefore the provider) whenever the
    // admin switches surfaces, so this value never needs to react to URL changes.
    const previewRef = useRef(detectPreviewMode());
    const { inPreview } = previewRef.current;

    // `initialOverride` is for sub-routes that need a fixed theme without
    // touching the global bootstrap cache or hitting the server — e.g. the
    // public chat embed at /chat/<id>?theme=dark. When present, we skip both
    // the server fetch and the bootstrap write so the embed never poisons
    // the admin's saved baseline.
    const overrideRef = useRef(initialOverride);

    const [state, setState] = useState(() => {
        if (inPreview) {
            return {
                ...DEFAULTS,
                ...(previewRef.current.initial || {}),
                loading: false,
                error: null,
            };
        }
        if (overrideRef.current) {
            return {
                ...DEFAULTS,
                ...overrideRef.current,
                loading: false,
                error: null,
            };
        }
        const boot = readBootstrap();
        return {
            ...DEFAULTS,
            ...(boot || {}),
            loading: true,
            error: null,
        };
    });
    // mountedRef gates setState after async fetches so we don't update an
    // unmounted component. Critical: the effect must SET the ref to true on
    // every mount, not just rely on useRef's initial value. Otherwise React
    // StrictMode's simulated mount → cleanup → remount cycle leaves the ref
    // stuck at false (because the cleanup ran but nothing re-set it), which
    // silently swallows every reload() setState call.
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    // Apply theme to <html> on every state change — single place that writes
    // the document, so admin/user changes propagate immediately without
    // touching individual components. The pure application function lives in
    // `theme/applyTheme.js` so it's scannable and unit-testable.
    useLayoutEffect(() => {
        applyThemeToDocument(state);
        // In preview mode AND when running under an initialOverride (e.g. the
        // public embed) we MUST NOT touch the admin's bootstrap cache so the
        // saved baseline stays clean.
        if (!inPreview && !overrideRef.current) writeBootstrap(state);
    }, [
        state.preset, state.accent, state.radiusScale, state.font,
        state.wallpaperUrl, state.wallpaperOverlay, state.glassIntensity,
        state.wallpaperPreset, state.glassTint, state.glassLens,
        state.glassAnimation, state.glassGrain, state.glassBorder,
        state.glassTierSubtle, state.glassTierDefault, state.glassTierOpaque,
        inPreview,
    ]);

    const reload = useCallback(async () => {
        try {
            // A public feature demo takes its theme from the ?theme= param the
            // marketing page frames it with (DemoHost), and it is supposed to
            // reach no API at all. Because the two calls below are PLAIN
            // fetches they bypass the demo transport entirely — which is the
            // whole point of the transport being at the authFetch seam, and
            // also why these two were the only requests still leaving a demo
            // page after that seam was sealed. Nothing to reconcile here, so
            // do not ask.
            if (isDemoPath(window.location.pathname)) return;
            // Plain fetch, not authFetch: the 401 below is an EXPECTED answer
            // for a signed-out visitor and is handled two lines down, but
            // authFetch treats any 401 as an expired session and reloads the
            // page — which meant every anonymous marketing pageview loaded the
            // entire site twice before this fallback could run.
            let r = await fetch(`${API_BASE}/api/branding/effective`, { credentials: 'include' });
            if (r.status === 401) {
                // Not logged in yet — pull the safe public subset.
                r = await fetch(`${API_BASE}/api/branding/public`);
            }
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const data = await r.json();
            if (!mountedRef.current) return;
            setState(s => {
                const next = {
                    ...s,
                    preset: data.preset || s.preset,
                    accent: data.accent || s.accent,
                    radiusScale: data.radiusScale ?? s.radiusScale,
                    font: data.font || s.font,
                    wallpaperUrl: data.wallpaperUrl || null,
                    wallpaperOverlay: data.wallpaperOverlay ?? s.wallpaperOverlay,
                    glassIntensity: data.glassIntensity ?? s.glassIntensity,
                    wallpaperPreset: data.wallpaperPreset || s.wallpaperPreset,
                    glassTint:       data.glassTint       || s.glassTint,
                    glassLens:       data.glassLens       || s.glassLens,
                    glassAnimation:  data.glassAnimation  || s.glassAnimation,
                    glassGrain:      data.glassGrain      || s.glassGrain,
                    glassBorder:     data.glassBorder     || s.glassBorder,
                    glassTierSubtle:  data.glassTierSubtle  !== undefined ? data.glassTierSubtle  : s.glassTierSubtle,
                    glassTierDefault: data.glassTierDefault !== undefined ? data.glassTierDefault : s.glassTierDefault,
                    glassTierOpaque:  data.glassTierOpaque  !== undefined ? data.glassTierOpaque  : s.glassTierOpaque,
                    allowUserOverride: data.allowUserOverride !== undefined ? data.allowUserOverride : s.allowUserOverride,
                    source: data.source || 'default',
                    loading: false,
                    error: null,
                };
                return next;
            });
        } catch (e) {
            if (!mountedRef.current) return;
            console.warn('[ThemeProvider] reload failed', e);
            setState(s => ({ ...s, loading: false, error: e.message || 'theme fetch failed' }));
        }
    }, []);

    // In preview mode we skip the server fetch entirely — the theme is
    // delivered via the URL payload + postMessage from the parent window.
    // With `initialOverride` we also skip — the embedder is the source of
    // truth and we don't want to leak the org admin's saved theme to a
    // public chat embed.
    useEffect(() => {
        if (inPreview || overrideRef.current) return;
        reload();
    }, [reload, inPreview]);

    // Preview bridge: tag the iframe document, handshake with the parent,
    // and apply incoming theme patches. Only mounted when inPreview=true.
    useEffect(() => {
        if (!inPreview) return undefined;
        const root = document.documentElement;
        root.setAttribute('data-preview', '1');
        try {
            window.parent.postMessage(
                { type: 'beeflow:theme:ready', version: 0 },
                window.location.origin,
            );
        } catch (_) { /* parent might not exist; harmless */ }

        let lastVersion = -1;
        const onMessage = (event) => {
            if (event.origin !== window.location.origin) return;
            const data = event.data;
            if (!data || data.type !== 'beeflow:theme:apply') return;
            const v = typeof data.version === 'number' ? data.version : -1;
            if (v <= lastVersion) return;
            lastVersion = v;
            if (!data.theme || typeof data.theme !== 'object') return;
            setState(s => ({ ...s, ...data.theme, loading: false, error: null }));
        };
        window.addEventListener('message', onMessage);
        return () => {
            window.removeEventListener('message', onMessage);
            root.removeAttribute('data-preview');
        };
    }, [inPreview]);

    const setUserOverride = useCallback(async (patch) => {
        const r = await authFetch(`${API_BASE}/api/branding/user`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
        });
        if (!r.ok) {
            const data = await r.json().catch(() => ({}));
            const msg = data.error || `HTTP ${r.status}`;
            console.error('[Theme] user override failed:', r.status, msg);
            throw new Error(msg);
        }
        const result = await r.json().catch(() => ({}));
        await reload();
        return result;
    }, [reload]);

    const clearUserOverride = useCallback(async () => {
        const r = await authFetch(`${API_BASE}/api/branding/user`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: 'null',
        });
        if (!r.ok) {
            const data = await r.json().catch(() => ({}));
            const msg = data.error || `HTTP ${r.status}`;
            console.error('[Theme] clear override failed:', r.status, msg);
            throw new Error(msg);
        }
        const result = await r.json().catch(() => ({}));
        await reload();
        return result;
    }, [reload]);

    const setAdminDefault = useCallback(async (patch) => {
        const r = await authFetch(`${API_BASE}/api/branding/admin`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
        });
        if (!r.ok) {
            const data = await r.json().catch(() => ({}));
            const msg = data.error || `HTTP ${r.status}`;
            console.error('[Theme] save failed:', r.status, msg);
            throw new Error(msg);
        }
        const result = await r.json();
        await reload();
        return result;
    }, [reload]);

    const uploadWallpaper = useCallback(async (file) => {
        const fd = new FormData();
        fd.append('wallpaper', file);
        const r = await authFetch(`${API_BASE}/api/branding/wallpaper`, {
            method: 'POST',
            body: fd,
        });
        if (!r.ok) {
            const data = await r.json().catch(() => ({}));
            throw new Error(data.error || `HTTP ${r.status}`);
        }
        await reload();
        return r.json();
    }, [reload]);

    const deleteWallpaper = useCallback(async () => {
        const r = await authFetch(`${API_BASE}/api/branding/wallpaper`, { method: 'DELETE' });
        if (!r.ok) {
            const data = await r.json().catch(() => ({}));
            throw new Error(data.error || `HTTP ${r.status}`);
        }
        await reload();
    }, [reload]);

    const value = useMemo(() => ({
        ...state,
        setUserOverride,
        clearUserOverride,
        setAdminDefault,
        uploadWallpaper,
        deleteWallpaper,
        reload,
    }), [state, setUserOverride, clearUserOverride, setAdminDefault, uploadWallpaper, deleteWallpaper, reload]);

    return (
        <ThemeContext.Provider value={value}>
            <WallpaperLayer wallpaperUrl={state.wallpaperUrl} />
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}

export const THEME_PRESETS = [
    { id: 'light', label: 'Light' },
    { id: 'paper', label: 'Paper' },
    { id: 'sepia', label: 'Sepia' },
    { id: 'glass', label: 'Glass' },
    { id: 'glass-dark', label: 'Glass Dark' },
    { id: 'dark', label: 'Dark' },
    { id: 'obsidian', label: 'Obsidian' },
    { id: 'high-contrast', label: 'High Contrast' },
    { id: 'custom', label: 'Custom' },
];

export const FONT_OPTIONS = [
    { id: 'system', label: 'System default' },
    { id: 'inter', label: 'Inter' },
    { id: 'plex', label: 'IBM Plex Sans' },
    { id: 'geist', label: 'Geist' },
];

export default ThemeContext;

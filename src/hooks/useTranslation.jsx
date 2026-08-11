/**
 * useTranslation — React hook for i18n
 * 
 * Usage:
 *   const { t, locale, setLocale, isLoading } = useTranslation();
 *   t('admin.dashboard_title')         → "Admin Dashboard" (en)
 *   t('admin.dashboard_title')         → "Beheerdersdashboard" (nl)
 *   t('welcome_user', { name: 'Tom' }) → "Welcome, Tom" (if value is "Welcome, {name}")
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE, authFetch } from '../utils/helpers';
import { isPublicMarketingPath } from '../utils/cmsPublicRouting';

/*
 * EN_DEFAULTS is loaded ASYNCHRONOUSLY, on purpose. The static import put the
 * whole English catalogue — ~400 KB raw, ~106 KB gzipped, 55% of the entry
 * chunk — on the first-load path of every page, including the marketing site,
 * which contains not a single t() call. The catalogue now arrives via
 * `ensureI18nDefaults()`:
 *
 *   - every lazy surface that DOES translate (AuthedApp, the public pages)
 *     is imported through `lazyWithI18n` (utils/lazyWithReload.js), which
 *     awaits this promise alongside the chunk — so by the time any of their
 *     t() calls run, DEFAULTS is populated and nothing ever renders a raw key;
 *   - the provider also kicks the load on mount as a safety net and bumps a
 *     state counter when it resolves, re-rendering any t() consumer that
 *     somehow raced ahead of it.
 *
 * DEFAULTS is a live module-scope binding rather than React state because the
 * provider-less fallback path in useTranslation() has no state to subscribe
 * to — it reads whatever has arrived, which for every real surface is the
 * full catalogue (see lazyWithI18n above).
 */
let DEFAULTS = {};
let defaultsPromise = null;
const defaultsListeners = new Set();
export function ensureI18nDefaults() {
    if (!defaultsPromise) {
        defaultsPromise = import('../i18n/en-defaults').then((m) => {
            DEFAULTS = m.default || {};
            defaultsListeners.forEach((fn) => fn());
            defaultsListeners.clear();
        }).catch((e) => {
            // A failed chunk leaves keys resolving to their string fallbacks —
            // degraded but readable. Reset so a later surface can retry.
            console.warn('[i18n] defaults chunk failed to load:', e?.message);
            defaultsPromise = null;
        });
    }
    return defaultsPromise;
}

const TranslationContext = createContext(null);

const STORAGE_KEY = 'beeflow_locale';
const CACHE_PREFIX = 'beeflow_i18n_';
const LOCALES_CACHE_KEY = 'beeflow_i18n_available_locales';
const LOCALES_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Resolve which locales the server actually has configured. Without this gate
// the boot path fires a 404 in DevTools every time the browser is set to a
// language the org hasn't added (e.g. `nl` against an English-only seed).
// Cached for 24h in localStorage so we don't pay the round-trip on every load.
async function fetchAvailableLocaleCodes(apiBase) {
    try {
        const cached = localStorage.getItem(LOCALES_CACHE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && Array.isArray(parsed.codes) && Date.now() - (parsed.at || 0) < LOCALES_CACHE_TTL_MS) {
                return parsed.codes;
            }
        }
    } catch { /* fall through */ }
    try {
        const res = await fetch(`${apiBase}/api/languages/public/locales`);
        if (!res.ok) return null;
        const list = await res.json();
        const codes = Array.isArray(list) ? list.map(l => l.code).filter(Boolean) : [];
        try { localStorage.setItem(LOCALES_CACHE_KEY, JSON.stringify({ codes, at: Date.now() })); } catch { /* quota */ }
        return codes;
    } catch {
        return null;
    }
}

/**
 * TranslationProvider — wrap your app with this to enable translations
 */
export function TranslationProvider({ children }) {
    const hasStoredLocale = useRef(!!localStorage.getItem(STORAGE_KEY));
    const [locale, setLocaleState] = useState(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return stored;
        // Auto-detect browser language (nl, nl-NL → nl)
        const browserLang = (navigator.language || navigator.userLanguage || 'en').split('-')[0].toLowerCase();
        return browserLang || 'en';
    });
    // Server strings only — the EN catalogue is layered underneath inside t()
    // (`strings[key] ?? DEFAULTS[key]`), which makes the old `{...EN_DEFAULTS,
    // ...data}` spreads unnecessary and lets the defaults arrive at any time.
    const [strings, setStrings] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const loadedLocaleRef = useRef('en'); // defaults are already loaded

    // Safety net for anything not routed through lazyWithI18n; bumping state
    // re-renders every t() consumer once the catalogue lands.
    const [, setDefaultsTick] = useState(0);
    useEffect(() => {
        let cancelled = false;
        // …but not on the public marketing surface. Nothing under src/marketing
        // calls t(), and every genuine consumer arrives through lazyWithI18n,
        // which resolves the catalogue alongside its own chunk. Left ungated,
        // this net pulled ~100 KB gzipped into the LCP window of a page that
        // never reads a single key.
        if (typeof window !== 'undefined' && isPublicMarketingPath(window.location.pathname)) {
            return undefined;
        }
        if (Object.keys(DEFAULTS).length === 0) {
            const bump = () => { if (!cancelled) setDefaultsTick((n) => n + 1); };
            defaultsListeners.add(bump);
            ensureI18nDefaults();
            return () => { cancelled = true; defaultsListeners.delete(bump); };
        }
        return undefined;
    }, []);

    const loadStrings = useCallback(async (loc) => {
        // Check cache first
        const cached = localStorage.getItem(`${CACHE_PREFIX}${loc}`);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (parsed.data) {
                    setStrings(parsed.data);
                    loadedLocaleRef.current = loc;
                }
            } catch { }
        }

        // Skip the server round-trip if the org doesn't have this locale —
        // avoids a console-noisy 404 for stored locales that were dropped on
        // the server side (or were never added in this deployment).
        const available = await fetchAvailableLocaleCodes(API_BASE);
        if (available && !available.includes(loc)) {
            loadedLocaleRef.current = loc;
            return;
        }

        // Fetch from server
        setIsLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/api/languages/user/strings/${loc}`);
            if (res.ok) {
                const data = await res.json();
                setStrings(data);
                loadedLocaleRef.current = loc;
                // Cache for 5 minutes
                localStorage.setItem(`${CACHE_PREFIX}${loc}`, JSON.stringify({
                    data,
                    timestamp: Date.now(),
                }));
            }
        } catch (err) {
            console.warn('[i18n] Failed to load translations:', err.message);
            // Keep the EN catalogue (layered in t()) as fallback — no need to set empty strings
        }
        setIsLoading(false);
    }, []);

    // Load strings via public endpoint for pre-auth (login page) when locale is non-English.
    // Probes /public/locales first so we don't fire a console-noisy 404 when the browser
    // is set to a language the org hasn't configured.
    const loadPublicStrings = useCallback(async (loc) => {
        if (loc === 'en' || loadedLocaleRef.current === loc) return;
        const available = await fetchAvailableLocaleCodes(API_BASE);
        if (available && !available.includes(loc)) {
            // Server doesn't have this locale; stay on EN defaults and mark loaded
            // so the useEffect below doesn't keep re-triggering loadStrings().
            loadedLocaleRef.current = loc;
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/api/languages/public/strings/${loc}`);
            if (res.ok) {
                const data = await res.json();
                setStrings(data);
                loadedLocaleRef.current = loc;
                localStorage.setItem(`${CACHE_PREFIX}${loc}`, JSON.stringify({ data, timestamp: Date.now() }));
                return;
            }
        } catch { }
        // Network error (not a 404) — try authenticated endpoint after login resolves.
        loadStrings(loc);
    }, [loadStrings]);

    // On first load: try public endpoint for detected browser locale,
    // then check org default once authenticated
    useEffect(() => {
        if (!hasStoredLocale.current && locale !== 'en') {
            // Browser detected a non-English locale — try loading via public endpoint
            loadPublicStrings(locale);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Post-auth: check for org default locale
    useEffect(() => {
        if (!hasStoredLocale.current) {
            authFetch(`${API_BASE}/api/languages/user/locales`)
                .then(r => r.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        const orgDefault = data.find(l => l.isOrgDefault);
                        if (orgDefault && orgDefault.code !== 'en') {
                            localStorage.setItem(STORAGE_KEY, orgDefault.code);
                            setLocaleState(orgDefault.code);
                        }
                    }
                })
                .catch(e => console.warn('[useTranslation] org-default locale probe failed', e));
        }
    }, []);

    useEffect(() => {
        if (locale !== loadedLocaleRef.current) {
            loadStrings(locale);
        }
    }, [locale, loadStrings]);

    const setLocale = useCallback((newLocale) => {
        localStorage.setItem(STORAGE_KEY, newLocale);
        setLocaleState(newLocale);
    }, []);

    /**
     * t(key, fallbackOrParams?, params?) — translate a key.
     *
     * Supported signatures:
     *   t('org.cost')                          → strings['org.cost'] || DEFAULTS['org.cost'] || 'org.cost'
     *   t('org.cost', 'Cost')                  → string fallback used when key is missing in both server strings AND the EN catalogue
     *   t('hello', { name: 'Tom' })            → interpolate "{name}" placeholders
     *   t('greet', 'Hi {name}', { name: 'T' }) → fallback + interpolation
     *
     * Resolution order: server strings → EN catalogue (DEFAULTS) → string fallback → raw key.
     */
    const t = useCallback((key, fallbackOrParams, paramsArg) => {
        const hasStringFallback = typeof fallbackOrParams === 'string';
        const params = hasStringFallback ? paramsArg : fallbackOrParams;
        let value = strings[key] || DEFAULTS[key];
        if (value === undefined || value === null) {
            value = hasStringFallback ? fallbackOrParams : key;
        }
        // Guard: a malformed server payload could land a non-string at this key
        // (e.g. an object). Returning it would crash React with the
        // "Objects are not valid as a React child" reconciler throw. Coerce
        // to the fallback or raw key instead so the UI keeps rendering.
        if (typeof value !== 'string') {
            value = hasStringFallback ? fallbackOrParams : key;
        }
        if (params && typeof params === 'object') {
            for (const [k, v] of Object.entries(params)) {
                value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
            }
        }
        return value;
    }, [strings]);

    const value = { t, locale, setLocale, isLoading, strings };

    return (
        <TranslationContext.Provider value={value}>
            {children}
        </TranslationContext.Provider>
    );
}

/**
 * useTranslation — access translations from any component
 */
export function useTranslation() {
    const ctx = useContext(TranslationContext);
    if (!ctx) {
        // Graceful fallback if the provider is not mounted (embeds, isolated
        // tests). This used to return the raw KEY whenever the second argument
        // was a params object — so `t('x.n_selected', { count: 2 })` rendered
        // the literal "x.n_selected" on screen. Resolve against the EN catalogue and
        // interpolate, exactly like the real t().
        return {
            t: (key, fallbackOrParams, paramsArg) => {
                const hasStringFallback = typeof fallbackOrParams === 'string';
                const params = hasStringFallback ? paramsArg : fallbackOrParams;
                let value = DEFAULTS[key];
                if (typeof value !== 'string') value = hasStringFallback ? fallbackOrParams : key;
                if (params && typeof params === 'object') {
                    for (const [k, v] of Object.entries(params)) {
                        value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
                    }
                }
                return value;
            },
            locale: 'en',
            setLocale: () => { },
            isLoading: false,
            strings: {},
        };
    }
    return ctx;
}

export default useTranslation;

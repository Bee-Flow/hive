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
import EN_DEFAULTS from '../i18n/en-defaults';
import { API_BASE, authFetch } from '../utils/helpers';

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
    const [strings, setStrings] = useState(EN_DEFAULTS);
    const [isLoading, setIsLoading] = useState(false);
    const loadedLocaleRef = useRef('en'); // defaults are already loaded

    const loadStrings = useCallback(async (loc) => {
        // Check cache first
        const cached = localStorage.getItem(`${CACHE_PREFIX}${loc}`);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (parsed.data) {
                    setStrings({ ...EN_DEFAULTS, ...parsed.data });
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
                setStrings({ ...EN_DEFAULTS, ...data });
                loadedLocaleRef.current = loc;
                // Cache for 5 minutes
                localStorage.setItem(`${CACHE_PREFIX}${loc}`, JSON.stringify({
                    data,
                    timestamp: Date.now(),
                }));
            }
        } catch (err) {
            console.warn('[i18n] Failed to load translations:', err.message);
            // Keep EN_DEFAULTS as fallback — no need to set empty strings
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
                setStrings({ ...EN_DEFAULTS, ...data });
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
     *   t('org.cost')                          → strings['org.cost'] || EN_DEFAULTS['org.cost'] || 'org.cost'
     *   t('org.cost', 'Cost')                  → string fallback used when key is missing in both server strings AND EN_DEFAULTS
     *   t('hello', { name: 'Tom' })            → interpolate "{name}" placeholders
     *   t('greet', 'Hi {name}', { name: 'T' }) → fallback + interpolation
     *
     * Resolution order: server strings → EN_DEFAULTS → string fallback → raw key.
     */
    const t = useCallback((key, fallbackOrParams, paramsArg) => {
        const hasStringFallback = typeof fallbackOrParams === 'string';
        const params = hasStringFallback ? paramsArg : fallbackOrParams;
        let value = strings[key] || EN_DEFAULTS[key];
        if (value === undefined || value === null) {
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
        // Graceful fallback if provider is not mounted
        return {
            t: (key) => key,
            locale: 'en',
            setLocale: () => { },
            isLoading: false,
            strings: {},
        };
    }
    return ctx;
}

export default useTranslation;

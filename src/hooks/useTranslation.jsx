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

/**
 * TranslationProvider — wrap your app with this to enable translations
 */
export function TranslationProvider({ children }) {
    const [locale, setLocaleState] = useState(() => {
        return localStorage.getItem(STORAGE_KEY) || 'en';
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
     * t(key, interpolation?) — translate a key
     * Falls back: server strings → EN_DEFAULTS → raw key
     */
    const t = useCallback((key, params) => {
        let value = strings[key] || EN_DEFAULTS[key] || key;
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

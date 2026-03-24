import React, { useState, useEffect, useRef } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { API_BASE, authFetch } from '../utils/helpers';

/**
 * LanguagePicker — compact locale selector for sidebar/settings
 * Fetches available locales from the server and lets the user switch.
 */
const LanguagePicker = ({ className = '', compact = false }) => {
    const { locale, setLocale } = useTranslation();
    const [locales, setLocales] = useState([]);
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        authFetch(`${API_BASE}/api/languages/user/locales`)
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data)) setLocales(data);
            })
            .catch(() => { });
    }, []);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    if (locales.length <= 1) return null; // Don't show if only English

    const currentLocale = locales.find(l => l.code === locale) || { code: locale, name: locale };

    return (
        <div ref={ref} className={`relative ${className}`}>
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--bg-tertiary)]"
                style={{ color: 'var(--text-secondary)' }}
                title="Change language"
            >
                <Globe className="w-3.5 h-3.5" />
                {!compact && <span>{currentLocale.name}</span>}
                <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div
                    className="absolute bottom-full left-0 mb-1 min-w-40 rounded-lg border shadow-lg py-1 z-50"
                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
                >
                    {locales.map(l => (
                        <button
                            key={l.code}
                            onClick={() => { setLocale(l.code); setOpen(false); }}
                            className="w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-colors"
                            style={{ color: locale === l.code ? 'var(--accent-primary)' : 'var(--text-primary)' }}
                        >
                            <span>{l.name}</span>
                            {locale === l.code && <Check className="w-3 h-3" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LanguagePicker;

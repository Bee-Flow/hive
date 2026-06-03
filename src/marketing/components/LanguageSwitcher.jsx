import React, { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../../utils/helpers';

/**
 * Public marketing-site language switcher.
 *
 * Lists the locales the org has enabled (from the public, no-auth
 * /api/languages/public/locales endpoint) and lets a visitor switch the site
 * language. The choice is stored in `beeflow_locale` (shared with the app's
 * i18n picker) and applied via the ?locale= query so RootPathGate re-fetches
 * the translated content. Hidden when only one language is available, and in
 * the CMS preview iframe (the admin switches locale from the editor instead).
 */

function currentLocale() {
    try {
        const param = new URLSearchParams(window.location.search).get('locale');
        if (param) return param.toLowerCase().split('-')[0];
        const stored = localStorage.getItem('beeflow_locale');
        if (stored) return stored.toLowerCase().split('-')[0];
    } catch { /* ignore */ }
    return (navigator.language || 'en').toLowerCase().split('-')[0];
}

export default function LanguageSwitcher() {
    const [locales, setLocales] = useState([]);
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const active = currentLocale();

    const isPreview = typeof window !== 'undefined'
        && new URLSearchParams(window.location.search).has('preview');

    useEffect(() => {
        if (isPreview) return;
        let cancelled = false;
        fetch(`${API_BASE}/api/languages/public/locales`)
            .then(r => (r.ok ? r.json() : null))
            .then(data => {
                if (cancelled || !data) return;
                const list = Array.isArray(data) ? data : (data.locales || []);
                setLocales(list);
            })
            .catch(() => { /* non-fatal — switcher just stays hidden */ });
        return () => { cancelled = true; };
    }, [isPreview]);

    useEffect(() => {
        const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('click', onDoc);
        return () => document.removeEventListener('click', onDoc);
    }, []);

    // Nothing to switch between (or in preview) → render nothing.
    if (isPreview || locales.length < 2) return null;

    const choose = (code) => {
        if (code === active) { setOpen(false); return; }
        try { localStorage.setItem('beeflow_locale', code); } catch { /* ignore */ }
        const url = new URL(window.location.href);
        url.searchParams.set('locale', code);
        window.location.assign(url.toString());
    };

    const activeInfo = locales.find(l => l.code === active);
    const label = (activeInfo?.code || active).toUpperCase();

    return (
        <div className="lang-switcher" ref={ref} style={{ position: 'relative' }}>
            <button
                type="button"
                className="lang-switcher-btn"
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen(v => !v)}
                title="Change language"
            >
                <span aria-hidden="true">🌐</span>
                <span>{label}</span>
            </button>
            {open && (
                <ul className="lang-switcher-menu" role="listbox">
                    {locales.map(l => (
                        <li key={l.code} role="option" aria-selected={l.code === active}>
                            <button
                                type="button"
                                className={l.code === active ? 'active' : undefined}
                                onClick={() => choose(l.code)}
                            >
                                {l.name || l.code} <span className="lang-code">({l.code})</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

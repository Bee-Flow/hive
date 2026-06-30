import React, { useEffect, useState } from 'react';

// Self-contained cookie consent banner. No external CSS or state deps — it
// owns its own styling (inline, using the marketing CSS variables with hard
// fallbacks so it also renders correctly outside the marketing root) and
// persists the visitor's choice in localStorage.
//
// Stored under `cookie_consent` as one of: "accepted" | "declined".
// Absent/unknown → the banner is shown. Once a choice is made the banner is
// replaced by a small 🍪 button (fixed bottom-right) that re-opens it — the
// reopen affordance is required so visitors can withdraw consent under EU
// GDPR ("intrekken even makkelijk als toestemming geven").

const STORAGE_KEY = 'cookie_consent';
// Legacy key used by earlier builds; migrated on first read so returning
// visitors don't see the banner again after the rename.
const LEGACY_STORAGE_KEY = 'bf_cookie_consent';

// Built-in copy. Caller-supplied `text` is overlaid per language, so a
// partial override (e.g. just the message) keeps the default button labels.
const DEFAULT_TEXT = {
    en: {
        message: 'We use cookies to improve your experience.',
        accept: 'Accept',
        decline: 'Decline',
        privacyLabel: 'Privacy Policy',
        privacyUrl: '/privacy',
    },
    nl: {
        message: 'Wij gebruiken cookies om je ervaring te verbeteren.',
        accept: 'Accepteren',
        decline: 'Weigeren',
        privacyLabel: 'Privacybeleid',
        privacyUrl: '/privacy',
    },
};

export default function CookieBanner({
    enabled = true,
    language = 'en',
    text = undefined,
} = {}) {
    // Prefer the requested language when we have strings for it (built-in or
    // caller-provided); otherwise fall back to English.
    const lang = (DEFAULT_TEXT[language] || text?.[language]) ? language : 'en';
    const strings = {
        ...(DEFAULT_TEXT[lang] || DEFAULT_TEXT.en),
        ...(text?.[lang] || {}),
    };

    // 'unset' until we've read localStorage on mount — this avoids a flash of
    // the banner for returning visitors who already chose, and keeps the
    // component SSR-safe. After mount it is 'accepted' | 'declined' | null.
    const [consent, setConsent] = useState('unset');

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            let stored = window.localStorage.getItem(STORAGE_KEY);
            if (stored !== 'accepted' && stored !== 'declined') {
                // One-time migration from the legacy key. Copy it over so
                // returning visitors keep their prior choice, then drop the
                // old entry to avoid two sources of truth.
                const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
                if (legacy === 'accepted' || legacy === 'declined') {
                    window.localStorage.setItem(STORAGE_KEY, legacy);
                    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
                    stored = legacy;
                }
            }
            setConsent(stored === 'accepted' || stored === 'declined' ? stored : null);
        } catch {
            // Storage blocked (private mode / disabled cookies) → treat as
            // no prior choice so the banner still shows.
            setConsent(null);
        }
    }, []);

    const choose = (value) => {
        setConsent(value);
        try {
            window.localStorage.setItem(STORAGE_KEY, value);
        } catch {
            /* storage blocked — the in-memory choice still hides the banner */
        }
        // Notify same-tab listeners (e.g. AnalyticsTracker in cookie mode) that
        // consent changed — the `storage` event only fires in OTHER tabs, so a
        // dedicated event is needed for the tab the visitor clicked in.
        try {
            window.dispatchEvent(new CustomEvent('bf-cookie-consent', { detail: value }));
        } catch {
            /* CustomEvent unsupported — non-fatal, tracker reconciles on reload */
        }
    };

    const reopen = () => setConsent(null);

    // Render nothing when disabled, or while we're still reading storage.
    if (!enabled) return null;
    if (consent === 'unset') return null;

    // Choice already made → compact re-open affordance, bottom-right, so
    // the visitor can withdraw or change their consent at any time.
    if (consent === 'accepted' || consent === 'declined') {
        return (
            <button
                type="button"
                onClick={reopen}
                aria-label={strings.privacyLabel || 'Cookie settings'}
                title={strings.privacyLabel || 'Cookie settings'}
                style={reopenButtonStyle}
            >
                <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>🍪</span>
            </button>
        );
    }

    // No choice yet → full banner.
    return (
        <div role="dialog" aria-live="polite" aria-label="Cookie consent" style={bannerStyle}>
            <p style={messageStyle}>
                {strings.message}
                {strings.privacyUrl ? (
                    <>
                        {' '}
                        <a href={strings.privacyUrl} style={linkStyle}>
                            {strings.privacyLabel || 'Privacy Policy'}
                        </a>
                    </>
                ) : null}
            </p>
            <div style={actionsStyle}>
                <button
                    type="button"
                    onClick={() => choose('declined')}
                    style={declineButtonStyle}
                >
                    {strings.decline}
                </button>
                <button
                    type="button"
                    onClick={() => choose('accepted')}
                    style={acceptButtonStyle}
                >
                    {strings.accept}
                </button>
            </div>
        </div>
    );
}

// ── Styles ──────────────────────────────────────────────────────────
// Inline so the component is fully portable. CSS variables come from the
// marketing root when present; the second value in each var() is a hard
// fallback so the banner is legible anywhere it's mounted.
const Z = 2147483000; // above virtually everything, below browser chrome

const bannerStyle = {
    position: 'fixed',
    left: '1rem',
    right: '1rem',
    bottom: '1rem',
    zIndex: Z,
    maxWidth: 720,
    margin: '0 auto',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem 1rem',
    padding: '0.875rem 1.125rem',
    background: 'var(--brand-surface, #ffffff)',
    color: 'var(--brand-text, #0f172a)',
    border: '1px solid var(--border-subtle, rgba(15, 23, 42, 0.12))',
    borderRadius: 'var(--radius-base, 12px)',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.18)',
    fontFamily: 'var(--font-body, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
};

const messageStyle = {
    margin: 0,
    flex: '1 1 260px',
    fontSize: '0.875rem',
    lineHeight: 1.5,
};

const linkStyle = {
    color: 'var(--brand-primary, #2563eb)',
    textDecoration: 'underline',
};

const actionsStyle = {
    display: 'flex',
    gap: '0.5rem',
    flexShrink: 0,
};

const baseButtonStyle = {
    appearance: 'none',
    cursor: 'pointer',
    fontSize: '0.8125rem',
    fontWeight: 600,
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius-base, 8px)',
    border: '1px solid transparent',
    fontFamily: 'inherit',
};

const acceptButtonStyle = {
    ...baseButtonStyle,
    background: 'var(--brand-primary, #2563eb)',
    color: '#ffffff',
};

const declineButtonStyle = {
    ...baseButtonStyle,
    background: 'transparent',
    color: 'var(--brand-text, #0f172a)',
    borderColor: 'var(--border-subtle, rgba(15, 23, 42, 0.25))',
};

const reopenButtonStyle = {
    position: 'fixed',
    right: '1rem',
    bottom: '1rem',
    zIndex: Z,
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    cursor: 'pointer',
    borderRadius: '50%',
    background: 'var(--brand-surface, #ffffff)',
    border: '1px solid var(--border-subtle, rgba(15, 23, 42, 0.15))',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.18)',
};


import React, { useState } from 'react';
import { Toggle, TextField } from './fields';

/**
 * Site-chrome editor for the cookie consent banner. Edits site.cookieBanner:
 *
 *   { enabled, text: { en: {...}, nl: {...} } }
 *
 * The `text` blob carries every locale's copy in one place — the public
 * renderer (marketing/components/CookieBanner) picks the visitor's language
 * at display time, so there's no per-locale override layer here.
 *
 * Lives in its own file (rather than editors.jsx) and is wired into
 * SiteChromeEditor in ProductWebsitePanel, next to Header/Footer.
 */

// Locales the banner ships copy for. Add an entry here to surface another
// language section in the editor.
const LOCALES = [
    { code: 'en', label: 'English' },
    { code: 'nl', label: 'Nederlands' },
];

// Small section-level collapsible card. Mirrors the one in editors.jsx so
// the banner editor folds the same way the Header/Footer sections do,
// without importing that file (keeps this control self-contained).
function CollapsibleCard({ title, defaultOpen = true, children }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="rounded-md border border-[var(--border-subtle)] mb-3">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                aria-expanded={open}
            >
                <span
                    className="shrink-0 inline-block transition-transform"
                    style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                    aria-hidden="true"
                >▾</span>
                <span className="truncate">{title}</span>
            </button>
            {open ? <div className="px-3 pb-3">{children}</div> : null}
        </div>
    );
}

export default function CookieBannerEditor({ data = {}, onChange }) {
    const enabled = data.enabled !== false;
    const text = data.text || {};

    // Replace one copy field for one locale, leaving every other field and
    // locale intact.
    const updateField = (locale, key, value) => {
        onChange({
            ...data,
            text: {
                ...text,
                [locale]: { ...(text[locale] || {}), [key]: value },
            },
        });
    };

    return (
        <>
            <Toggle
                label="Show cookie banner"
                value={enabled}
                onChange={v => onChange({ ...data, enabled: v })}
            />

            {LOCALES.map(({ code, label }) => {
                const t = text[code] || {};
                return (
                    <CollapsibleCard key={code} title={label} defaultOpen={code === 'en'}>
                        <TextField
                            label="Message"
                            value={t.message || ''}
                            onChange={v => updateField(code, 'message', v)}
                        />
                        <TextField
                            label="Accept button"
                            value={t.accept || ''}
                            onChange={v => updateField(code, 'accept', v)}
                        />
                        <TextField
                            label="Decline button"
                            value={t.decline || ''}
                            onChange={v => updateField(code, 'decline', v)}
                        />
                        <TextField
                            label="Privacy link label"
                            value={t.privacyLabel || ''}
                            onChange={v => updateField(code, 'privacyLabel', v)}
                        />
                        <TextField
                            label="Privacy link URL"
                            value={t.privacyUrl || ''}
                            onChange={v => updateField(code, 'privacyUrl', v)}
                            hint="Leave empty to hide the link. Defaults to /privacy."
                        />
                    </CollapsibleCard>
                );
            })}
        </>
    );
}

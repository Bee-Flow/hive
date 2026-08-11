import React from 'react';
import { Toggle, TextField } from './fields';
import { CollapsibleCard } from './primitives';

/**
 * Site-chrome editor for the cookie consent banner. Edits site.cookieBanner:
 *
 *   { enabled, text: { en: {...}, nl: {...}, <any locale code>: {...} } }
 *
 * The `text` blob carries every locale's copy in one place — the public
 * renderer (marketing/components/CookieBanner) picks the visitor's language
 * at display time (falling back to English), so there's no per-locale
 * override layer here.
 *
 * The locale sections follow the SITE's locale list (`locales` prop — the
 * org language system, managed in the admin Languages tab), so adding a
 * language there surfaces a banner section here automatically. Copy saved
 * for locales that were later removed from the org list is preserved under
 * "Other saved languages" (removing a locale must never silently destroy
 * banner text).
 */

const FALLBACK_LOCALES = [
    { code: 'en', name: 'English' },
    { code: 'nl', name: 'Nederlands' },
];

function LocaleCard({ code, label, text, defaultOpen, onField }) {
    const t = text[code] || {};
    return (
        <CollapsibleCard title={label} defaultOpen={defaultOpen} persistKey={`cookie.${code}`}>
            <TextField
                label="Message"
                value={t.message || ''}
                onChange={v => onField(code, 'message', v)}
            />
            <TextField
                label="Accept button"
                value={t.accept || ''}
                onChange={v => onField(code, 'accept', v)}
            />
            <TextField
                label="Decline button"
                value={t.decline || ''}
                onChange={v => onField(code, 'decline', v)}
            />
            <TextField
                label="Privacy link label"
                value={t.privacyLabel || ''}
                onChange={v => onField(code, 'privacyLabel', v)}
            />
            <TextField
                label="Privacy link URL"
                value={t.privacyUrl || ''}
                onChange={v => onField(code, 'privacyUrl', v)}
                hint="Leave empty to hide the link. Defaults to /privacy."
            />
        </CollapsibleCard>
    );
}

export default function CookieBannerEditor({ data = {}, onChange, locales = null, defaultLocale = 'en' }) {
    const enabled = data.enabled !== false;
    const text = data.text || {};

    // The site's locale list (org language system) drives the sections;
    // hosts that don't pass `locales` keep the historic en/nl pair.
    const siteLocales = (Array.isArray(locales) && locales.length > 0)
        ? locales.map(l => ({ code: l.code, name: l.name || l.code }))
        : FALLBACK_LOCALES;
    const known = new Set(siteLocales.map(l => l.code));
    // Saved copy for locales no longer in the org list — still editable.
    const orphaned = Object.keys(text).filter(code => !known.has(code) && text[code] && typeof text[code] === 'object');

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
            <p className="text-[10px] text-[var(--text-muted)] mb-3 -mt-1">
                Visitors see the copy for their language; languages without copy fall back to English.
            </p>

            {siteLocales.map(({ code, name }) => (
                <LocaleCard
                    key={code}
                    code={code}
                    label={`${name} (${code})${code === defaultLocale ? ' ★' : ''}`}
                    text={text}
                    defaultOpen={code === defaultLocale}
                    onField={updateField}
                />
            ))}

            {orphaned.length > 0 && (
                <CollapsibleCard title="Other saved languages" defaultOpen={false}>
                    <p className="text-[10px] text-[var(--text-muted)] mb-2">
                        Copy saved for languages that are no longer in the organization's
                        language list. It stays published until removed here.
                    </p>
                    {orphaned.map(code => (
                        <LocaleCard
                            key={code}
                            code={code}
                            label={code}
                            text={text}
                            defaultOpen={false}
                            onField={updateField}
                        />
                    ))}
                </CollapsibleCard>
            )}
        </>
    );
}

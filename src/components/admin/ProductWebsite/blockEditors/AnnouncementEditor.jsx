import React from 'react';
import { Toggle, TextField } from '../fields';
import { CollapsibleCard, SegmentedControl } from '../primitives';

/**
 * Site-chrome editor for the announcement bar. Edits site.announcement:
 *
 *   { enabled, dismissible, variant, text: { en: {...}, nl: {...}, <locale>: {...} } }
 *
 * Same model as CookieBannerEditor: the `text` blob carries every locale's
 * copy in one place and the public renderer
 * (marketing/components/AnnouncementBar) picks the visitor's language at
 * display time (falling back to English), so there is no per-locale override
 * layer here.
 *
 * The locale sections follow the SITE's locale list (`locales` prop — the org
 * language system). Copy saved for locales that were later removed from the
 * org list is preserved under "Other saved languages" — removing a language
 * must never silently destroy announcement copy.
 */

const FALLBACK_LOCALES = [
    { code: 'en', name: 'English' },
    { code: 'nl', name: 'Nederlands' },
];

const VARIANT_OPTIONS = [
    { value: 'accent',  label: 'Accent',  hint: 'Brand gradient strip with light label text' },
    { value: 'surface', label: 'Surface', hint: 'Quiet surface fill with a hairline under it' },
    { value: 'dark',    label: 'Dark',    hint: 'Dark strip with light text' },
];

function LocaleCard({ code, label, text, defaultOpen, onField }) {
    const t = text[code] || {};
    return (
        <CollapsibleCard title={label} defaultOpen={defaultOpen} persistKey={`announce.${code}`}>
            <TextField
                label="Message"
                value={t.message || ''}
                onChange={v => onField(code, 'message', v)}
                hint="Keep it to one short line. Empty = the bar stays hidden for this language."
            />
            <TextField
                label="Link label"
                value={t.linkLabel || ''}
                onChange={v => onField(code, 'linkLabel', v)}
                hint="Optional call to action, e.g. “Read more”."
            />
            <TextField
                label="Link URL"
                value={t.linkUrl || ''}
                onChange={v => onField(code, 'linkUrl', v)}
                hint="Leave both link fields empty to show the message on its own."
            />
        </CollapsibleCard>
    );
}

export default function AnnouncementEditor({ data = {}, onChange, locales = null, defaultLocale = 'en' }) {
    // Off by default — unlike the cookie banner, an announcement is opt-in
    // (a site that never configured one must not suddenly grow a strip).
    const enabled = data.enabled === true;
    const dismissible = data.dismissible !== false;
    const variant = VARIANT_OPTIONS.some(o => o.value === data.variant) ? data.variant : 'accent';
    const text = data.text || {};

    const siteLocales = (Array.isArray(locales) && locales.length > 0)
        ? locales.map(l => ({ code: l.code, name: l.name || l.code }))
        : FALLBACK_LOCALES;
    const known = new Set(siteLocales.map(l => l.code));
    const orphaned = Object.keys(text).filter(
        code => !known.has(code) && text[code] && typeof text[code] === 'object');

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
                label="Show announcement bar"
                value={enabled}
                onChange={v => onChange({ ...data, enabled: v })}
            />
            <p className="text-[10px] text-[var(--text-muted)] mb-3 -mt-1">
                Sits above the header on every page. Visitors see the copy for their
                language; languages without a message hide the bar entirely.
            </p>

            <div className="mb-3">
                <div className="text-[11px] font-medium text-[var(--text-secondary)] mb-1.5">Style</div>
                <SegmentedControl
                    options={VARIANT_OPTIONS}
                    value={variant}
                    onChange={v => onChange({ ...data, variant: v })}
                />
            </div>

            <Toggle
                label="Visitors can dismiss it"
                value={dismissible}
                onChange={v => onChange({ ...data, dismissible: v })}
            />
            <p className="text-[10px] text-[var(--text-muted)] mb-3 -mt-1">
                A dismissed bar stays hidden for that visitor until you change the
                message — new copy is shown again to everyone.
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

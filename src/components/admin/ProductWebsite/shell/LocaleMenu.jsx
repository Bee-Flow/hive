import React from 'react';
import AppIcon from '../../../AppIcon';
import Dropdown from './Dropdown';

/**
 * TopBar locale switcher — THE one locale control for the builder.
 * Lists the org's locales (from the site payload), marks the site's source
 * language (★), switches the editor into translate mode, and carries the
 * "Set as default locale" action (behind the shell's confirm) plus a
 * cross-link to the Languages admin tab where locales are managed.
 *
 * `coverageByLocale` is optional ({ [code]: { done, total } }) — rendered
 * as "n/m translated" + a mini bar when provided (translation workstream).
 */
export default function LocaleMenu({
    locales,
    activeLocale,
    defaultLocale,
    coverageByLocale = null,
    onSelect,
    onSetDefault,        // (code) — parent confirms + persists
    onManageLanguages,   // optional — cross-link to admin/languages
}) {
    const active = locales.find(l => l.code === activeLocale);

    return (
        <Dropdown
            align="right"
            width={264}
            trigger={({ open }) => (
                <button
                    type="button"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border border-transparent hover:border-[var(--border-subtle)]"
                    title="Language"
                >
                    <AppIcon name="Languages" className="w-4 h-4 text-[var(--text-muted)]" />
                    <span className="font-medium uppercase">{activeLocale}</span>
                    {active?.code === defaultLocale ? <span className="text-[10px] text-[var(--text-muted)]">★</span> : null}
                    <AppIcon name={open ? 'ChevronUp' : 'ChevronDown'} className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </button>
            )}
        >
            {({ close }) => (
                <div className="overflow-hidden rounded-lg">
                    <ul className="py-1 max-h-80 overflow-y-auto">
                        {locales.map(l => {
                            const isActive = l.code === activeLocale;
                            const isDefault = l.code === defaultLocale;
                            const cov = coverageByLocale?.[l.code];
                            return (
                                <li key={l.code}>
                                    <button
                                        type="button"
                                        onClick={() => { onSelect(l.code); close(); }}
                                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left
                                            ${isActive
                                                ? 'bg-[var(--accent-primary)]/10 text-[var(--text-primary)]'
                                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
                                    >
                                        <AppIcon
                                            name={isActive ? 'Check' : 'Languages'}
                                            className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}`}
                                        />
                                        <span className="flex-1 min-w-0">
                                            <span className="flex items-center gap-1.5">
                                                <span className="truncate">{l.name}</span>
                                                <span className="text-[10px] text-[var(--text-muted)] uppercase">{l.code}</span>
                                                {isDefault && (
                                                    <span className="text-[10px] text-[var(--text-muted)]" title="Source language">★</span>
                                                )}
                                            </span>
                                            {!isDefault && cov && cov.total > 0 ? (
                                                <span className="block mt-1">
                                                    <span className="block text-[10px] text-[var(--text-muted)]">
                                                        {cov.done}/{cov.total} fields have a translation
                                                    </span>
                                                    <span className="block h-0.5 mt-0.5 rounded bg-[var(--border-subtle)] overflow-hidden">
                                                        <span
                                                            className="block h-full bg-[var(--accent-primary)]"
                                                            style={{ width: `${Math.round((cov.done / cov.total) * 100)}%` }}
                                                        />
                                                    </span>
                                                </span>
                                            ) : null}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                    <div className="border-t border-[var(--border-subtle)] py-1">
                        {activeLocale !== defaultLocale && (
                            <button
                                type="button"
                                onClick={() => { close(); onSetDefault(activeLocale); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] text-left"
                            >
                                <AppIcon name="Star" className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                                Set {active?.name || activeLocale} as default locale
                            </button>
                        )}
                        {onManageLanguages && (
                            <button
                                type="button"
                                onClick={() => { close(); onManageLanguages(); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] text-left"
                            >
                                <AppIcon name="Settings2" className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                                Manage languages →
                            </button>
                        )}
                        {locales.length <= 1 && (
                            <p className="px-3 py-1.5 text-[10px] text-[var(--text-muted)]">
                                Add languages in the Languages tab to translate this site.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </Dropdown>
    );
}

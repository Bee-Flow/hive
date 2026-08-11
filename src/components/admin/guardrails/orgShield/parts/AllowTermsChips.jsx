import { ShieldOff, X } from 'lucide-react';
import React from 'react';

import Toggle from '../../../../shared/Toggle';
import AddRow from './AddRow';

/**
 * The never-redact list — the mirror image of the custom sensitive terms.
 *
 * ── Why this is the most dangerous control on the page ────────────────────
 * Everything else here makes the shield redact MORE. This one makes it redact
 * LESS, permanently, for every category. So the copy is not decoration: an
 * admin has to be able to predict exactly what a term will and will not
 * exempt, or they will allowlist "Shell" and quietly unredact a client called
 * "Shell Advies BV".
 *
 * Matching is exact on the NORMALISED form (case, punctuation and whitespace
 * stripped) and never a substring — the panel says so in those words.
 *
 * Chips rather than a table because each entry is a single value with no
 * properties. The visual contrast with the terms table above is doing work: it
 * tells the admin these are different kinds of thing.
 */

/**
 * Mirror of `normaliseAllowValue` in server/core/dlp/allowTerms.js.
 *
 * Duplicated rather than imported because that module is CommonJS and
 * server-only. `orgShield.allowterms` tests the server side; the client test
 * uses the same fixtures so the two cannot drift unnoticed.
 */
export function normaliseAllowValue(value) {
    return String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

export function AllowTermsChips({ terms, onChange, publicOrgs, onChangePublicOrgs, readOnly, t }) {
    const add = (raw) => {
        const key = normaliseAllowValue(raw);
        if (!key) return t('admin.shield_allow_err_empty', 'Enter a name or word.');
        if (raw.length > 120) return t('admin.shield_allow_err_long', 'Keep it under 120 characters.');
        // Without this, adding "Coca-Cola" when "coca cola" is already listed
        // is a silent no-op the admin has no way to see.
        if (terms.some(existing => normaliseAllowValue(existing) === key)) {
            return t('admin.shield_allow_err_duplicate', 'That one is already on the list (upper and lower case, spaces and punctuation do not matter).');
        }
        onChange([...terms, raw]);
        return null;
    };

    return (
        <div
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: 'rgba(217,119,6,0.35)', background: 'rgba(217,119,6,0.05)' }}
        >
            <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(217,119,6,0.25)' }}>
                <span className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <ShieldOff className="w-4 h-4 shrink-0" aria-hidden="true" style={{ color: '#d97706' }} />
                    {t('admin.shield_allow_title', 'Never hide these')}
                </span>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {t('admin.shield_allow_desc',
                        'These are always left visible to the AI, in every category. They have to match exactly - allowing "Shell" does not allow "Shell Advies BV". Upper and lower case, spaces and punctuation do not matter.')}
                </p>
            </div>

            <div className="p-4 space-y-3">
                <Toggle
                    id="org-shield-allow-public"
                    checked={publicOrgs}
                    onChange={onChangePublicOrgs}
                    disabled={readOnly}
                    ariaLabel={t('admin.shield_allow_public_title', 'Always allow well-known companies')}
                    label={t('admin.shield_allow_public_title', 'Always allow well-known companies')}
                    description={t('admin.shield_allow_public_desc',
                        'A built-in list of large companies, household brands and government bodies — Microsoft, PostNL, the Belastingdienst and the like. These are public knowledge rather than personal data, and hiding them takes away context the AI needs.')}
                />

                {terms.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5 list-none p-0 m-0">
                        {terms.map((term, i) => (
                            <li key={`${term}-${i}`}>
                                <span
                                    className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-xs"
                                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                                >
                                    {term}
                                    {!readOnly && (
                                        <button
                                            type="button"
                                            onClick={() => onChange(terms.filter((_, idx) => idx !== i))}
                                            aria-label={t('admin.shield_allow_remove', 'Remove {term}', { term })}
                                            className="p-0.5 rounded-full hover:bg-white/10"
                                        >
                                            <X className="w-3 h-3" aria-hidden="true" />
                                        </button>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}

                {!readOnly && (
                    <AddRow
                        onAdd={add}
                        placeholder={t('admin.shield_allow_placeholder', 'Company, product or brand name')}
                        addLabel={t('admin.shield_allow_add', 'Add')}
                    />
                )}
            </div>
        </div>
    );
}

export default AllowTermsChips;

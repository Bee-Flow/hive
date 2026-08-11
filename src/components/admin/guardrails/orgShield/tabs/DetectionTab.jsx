import { Info, ShieldCheck } from 'lucide-react';
import React from 'react';

import PiiCategoryGrid from '../../../../privacy/PiiCategoryGrid';
import PiiSensitivityPicker, { presetFor } from '../../../../privacy/PiiSensitivityPicker';
import Disclosure from '../../../../shared/Disclosure';
import AllowTermsChips from '../parts/AllowTermsChips';
import CustomTermsTable from '../parts/CustomTermsTable';

/**
 * "What counts as personal data?"
 *
 * Ordered widen-then-narrow: how sure the detector must be → which categories
 * → extra terms of our own → the exceptions that are never redacted.
 */
export function DetectionTab({ f, categories, readOnly, termErrors = [], t }) {
    // Only a CUSTOM, off-scale threshold earns a warning.
    //
    // The old rule fired at >= 0.85 and < 0.5 — which is exactly the "Low
    // sensitivity" preset (0.85) and exactly the "High sensitivity" preset
    // (0.45). Both offered choices scolded the user the moment they were
    // picked, and the amber box told them to go back to the value they had
    // just deliberately left. A named level is a decision; its trade-off is
    // already printed on the card.
    const preset = presetFor(f.piiConfidenceThreshold);
    const warnHigh = !preset && f.piiConfidenceThreshold >= 0.85;
    const warnLow = !preset && f.piiConfidenceThreshold < 0.45;

    return (
        <div className="space-y-5">
            <div
                className="flex items-start gap-3 p-4 rounded-xl border"
                style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}
            >
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
                <div>
                    <span className="text-sm font-medium text-[var(--text-primary)] block">
                        {t('admin.shield_pii_master_title', 'What we look for')}
                    </span>
                    <span className="text-xs text-muted block mt-0.5 leading-relaxed">
                        {t('admin.shield_pii_master_desc_short',
                            'Before a message goes to the AI, Bee Flow reads it and looks for personal details — names, email addresses, phone numbers, home addresses, bank details, ID numbers, health information and more. Anything found is hidden from the AI. This happens on your own server; nothing is sent elsewhere to check it.')}
                    </span>
                </div>
            </div>

            <div>
                <PiiSensitivityPicker
                    value={f.piiConfidenceThreshold}
                    onChange={v => f.setPiiConfidenceThreshold(v)}
                    disabled={readOnly}
                    t={t}
                />
                {warnHigh && (
                    <div
                        className="mt-3 flex items-start gap-2 text-[11px] px-3 py-2 rounded-lg"
                        style={{ background: 'rgba(234, 179, 8, 0.10)', color: '#92400e', border: '1px solid rgba(234, 179, 8, 0.30)' }}
                    >
                        <Info className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
                        <span className="leading-relaxed">
                            {t('admin.shield_pii_confidence_too_high_custom',
                                'At this setting almost nothing is hidden. Short messages usually score between 60% and 85%, so names, company names and addresses will get through.')}
                        </span>
                    </div>
                )}
                {warnLow && (
                    <div
                        className="mt-3 flex items-start gap-2 text-[11px] px-3 py-2 rounded-lg"
                        style={{ background: 'rgba(59, 130, 246, 0.10)', color: '#1e40af', border: '1px solid rgba(59, 130, 246, 0.25)' }}
                    >
                        <Info className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
                        <span className="leading-relaxed">
                            {t('admin.shield_pii_confidence_too_low_custom',
                                'This is below the High sensitivity level, so expect more ordinary words to be hidden as well.')}
                        </span>
                    </div>
                )}
            </div>

            <PiiCategoryGrid
                value={f.piiCategories}
                onChange={f.setPiiCategories}
                categories={categories}
                disabled={readOnly}
                label={t('admin.shield_pii_categories', 'Kinds of personal data')}
                allLabel={t('common.all')}
                noneLabel={t('common.none')}
            />

            {/* Both lists are exceptions to the rules above, so they sit last
                and folded: the allowlist in particular is the one control that
                makes the shield leak by design, and it should not be the first
                thing an admin plays with. */}
            <Disclosure
                variant="card"
                title={t('admin.shield_exceptions_title', 'Your own words and exceptions')}
                hint={t('admin.shield_exceptions_hint', 'Words to always hide, and words to never hide')}
            >
                <div className="space-y-4">
                    <CustomTermsTable
                        terms={f.customSensitiveTerms}
                        onChange={f.setCustomSensitiveTerms}
                        termErrors={termErrors}
                        readOnly={readOnly}
                        t={t}
                    />
                    <AllowTermsChips
                        terms={f.piiAllowTerms}
                        onChange={f.setPiiAllowTerms}
                        publicOrgs={f.piiAllowPublicOrgs}
                        onChangePublicOrgs={f.setPiiAllowPublicOrgs}
                        readOnly={readOnly}
                        t={t}
                    />
                </div>
            </Disclosure>
        </div>
    );
}

export default DetectionTab;

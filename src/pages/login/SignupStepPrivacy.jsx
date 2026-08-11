import React from 'react';
import { ShieldCheck, Globe, ArrowLeft, ArrowRight } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { piiCategoriesLocalized } from '../../config/piiCategories';
import PiiCategoryGrid from '../../components/privacy/PiiCategoryGrid';
import PiiActionPicker from '../../components/privacy/PiiActionPicker';

/**
 * Onboarding "Privacy Shield" step. Mirrors the admin Privacy Shield page:
 * a master enable toggle, the canonical PII-category picker, and the
 * tokenize/block action. Whatever the founder picks here is written to the
 * org's real shield config at signup, so it matches Settings → Privacy Shield.
 *
 * Personal accounts see the same step (BFSF-289) with first-person copy; their
 * choices are written to `user_privacy_shield_${userId}` instead of the org's.
 */
const SignupStepPrivacy = ({ signupData, setSignupData, handleSignupNext, setSignupStep, setError, embedded = false }) => {
    const { t } = useTranslation();
    const categories = piiCategoriesLocalized(t);
    const isPersonal = signupData.signupType === 'consumer';

    const enabled = signupData.shieldEnabled !== false;
    const setShieldEnabled = (on) => setSignupData(p => ({ ...p, shieldEnabled: on }));
    const setCategories = (ids) => setSignupData(p => ({ ...p, piiCategories: ids }));
    const setAction = (a) => setSignupData(p => ({ ...p, piiAction: a }));

    return (
        <div className="space-y-4">
            {/* Master enable toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-primary)]">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                        <span className="text-sm font-medium text-[var(--text-primary)]">{t('signup.shield_enable', 'Privacy Shield')}</span>
                        <p className="text-xs text-[var(--text-muted)]">
                            {isPersonal
                                ? t('signup.shield_enable_desc_personal', 'Scan your messages for personal data and replace it before it reaches the AI. Recommended — you can change this later in Settings.')
                                : t('signup.shield_enable_desc', 'Scan messages for personal data and block or replace it before it reaches the AI.')}
                        </p>
                    </div>
                </div>
                <button type="button" onClick={() => setShieldEnabled(!enabled)}
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${enabled ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-default)]'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
                </button>
            </div>

            {enabled && (
                <>
                    <PiiCategoryGrid
                        categories={categories}
                        value={signupData.piiCategories || []}
                        onChange={setCategories}
                        label={t('signup.pii_categories', 'Kinds of personal data')}
                        allLabel={t('common.all', 'All')}
                        noneLabel={t('common.none', 'None')}
                    />

                    <PiiActionPicker
                        value={signupData.piiAction || (isPersonal ? 'tokenize' : 'block')}
                        onChange={setAction}
                        tokenizeLabel={t('pii.action_tokenize', 'Replace with placeholders')}
                        tokenizeHelp={t('pii.action_tokenize_help', 'Sensitive details are swapped for labels like [email_1] before the message goes to the AI. The real values are never sent to the AI, and are put back in the answer.')}
                        blockLabel={t('pii.action_block', 'Do not send the message')}
                        blockHelp={isPersonal
                            ? t('pii.action_block_help_personal', 'The message is stopped before it leaves your device, and you are asked to rewrite it without the personal data.')
                            : t('pii.action_block_help', 'The message is stopped before it reaches the AI, and the person is asked to rewrite it without the personal data.')}
                    />

                    {/* EU-only models — a related org-level AI setting. */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-primary)]">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/10">
                                <Globe className="w-4 h-4 text-blue-500" />
                            </div>
                            <div>
                                <span className="text-sm font-medium text-[var(--text-primary)]">{t('signup.eu_only_models')}</span>
                                <p className="text-xs text-[var(--text-muted)]">{t('signup.eu_only_models_desc')}</p>
                            </div>
                        </div>
                        <button type="button" onClick={() => setSignupData(p => ({ ...p, euModeEnabled: !p.euModeEnabled }))}
                            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${signupData.euModeEnabled ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-default)]'}`}>
                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${signupData.euModeEnabled ? 'translate-x-5' : ''}`} />
                        </button>
                    </div>
                </>
            )}

            <p className="text-xs text-[var(--text-muted)] text-center mt-1">
                {isPersonal
                    ? t('signup.privacy_tune_later_personal', 'You can fine-tune these settings later in Settings → Privacy.')
                    : t('signup.privacy_tune_later')}
            </p>

            {/* Footer buttons — only standalone (legacy). Wizard shell owns nav. */}
            {!embedded && (
                <>
                    <button type="button" onClick={handleSignupNext}
                        className="w-full py-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-base shadow-lg mt-2">
                        {t('signup.continue')} <ArrowRight className="w-5 h-5" />
                    </button>
                    <button type="button" onClick={() => { setSignupStep(2); setError(''); }}
                        className="w-full py-2.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm">
                        <ArrowLeft className="w-4 h-4" /> {t('signup.back')}
                    </button>
                </>
            )}
        </div>
    );
};

export default SignupStepPrivacy;

import React from 'react';
import { Building, MapPin, Phone, FileText, ArrowLeft, ArrowRight, User } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

const SignupStepOrg = ({ signupData, setSignupData, signupOrgs, handleSignupNext, resetSignup, inputClass, inputClassSimple, labelClass, deploymentMode, allowOrgSignups = true, allowConsumerSignups = true, embedded = false, onAdvance }) => {
    const { t } = useTranslation();
    const isCloud = deploymentMode === 'cloud';

    const accountTypes = [
        ...(allowOrgSignups ? [{
            id: 'new',
            icon: <Building className="w-6 h-6" />,
            title: t('signup.org_account'),
            subtitle: t('signup.org_account_desc'),
            description: t('signup.org_account_features'),
        }] : []),
        ...(isCloud && allowConsumerSignups ? [{
            id: 'consumer',
            icon: <User className="w-6 h-6" />,
            title: t('signup.personal_account'),
            subtitle: t('signup.personal_account_desc'),
            description: t('signup.personal_account_features'),
        }] : []),
        // Self-service "Join an existing organisation" is intentionally removed:
        // users join an org via an email invitation, not by self-selecting it.
    ];

    // Auto-select if only one type is available
    React.useEffect(() => {
        if (accountTypes.length === 1 && signupData.signupType !== accountTypes[0].id) {
            setSignupData(p => ({ ...p, signupType: accountTypes[0].id }));
        }
    }, [accountTypes.length]);

    return (
        <form onSubmit={e => { e.preventDefault(); embedded ? onAdvance?.() : handleSignupNext(); }} className="space-y-4">
            {/* ── Account Type Cards ── */}
            <div className="space-y-3">
                {accountTypes.map(type => {
                    const isSelected = signupData.signupType === type.id;
                    return (
                        <button key={type.id} type="button"
                            onClick={() => setSignupData(p => ({ ...p, signupType: type.id }))}
                            className={`w-full text-left rounded-xl border-2 transition-all duration-200 ${isSelected
                                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                                : 'border-[var(--border-subtle)] bg-[var(--bg-primary)] hover:border-[var(--accent-primary)]/40'}`}
                        >
                            <div className="p-4 flex items-start gap-3.5">
                                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                                    style={{
                                        background: isSelected ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                        color: isSelected ? '#fff' : 'var(--text-muted)',
                                        transition: 'all 0.2s ease',
                                    }}>
                                    {type.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                            {type.title}
                                        </span>
                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                                            style={{
                                                background: isSelected ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                                color: isSelected ? '#fff' : 'var(--text-muted)',
                                            }}>
                                            {type.subtitle}
                                        </span>
                                    </div>
                                    <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                        {type.description}
                                    </p>
                                </div>
                                <div className="shrink-0 mt-1">
                                    <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                                        style={{ borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)' }}>
                                        {isSelected && (
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--accent-primary)' }} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* ── Expanded Fields ── */}
            {signupData.signupType === 'new' && (
                <div className="space-y-3 animate-[fadeIn_0.2s_ease-out] pt-1">
                    <div>
                        <label className={labelClass}>{t('signup.company_name')} *</label>
                        <div className="relative">
                            <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
                            <input type="text" value={signupData.newOrgName} onChange={e => setSignupData(p => ({ ...p, newOrgName: e.target.value }))} className={inputClass} placeholder="Jansen B.V." required />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>{t('signup.tagline')}</label>
                        <input type="text" value={signupData.orgTagline} onChange={e => setSignupData(p => ({ ...p, orgTagline: e.target.value }))} className={inputClassSimple} placeholder="Slim werken met AI" />
                    </div>
                    <div>
                        <label className={labelClass}>{t('signup.description_label')}</label>
                        <input type="text" value={signupData.orgDescription} onChange={e => setSignupData(p => ({ ...p, orgDescription: e.target.value }))} className={inputClassSimple} placeholder={t('signup.what_does_org_do')} />
                    </div>
                    <div>
                        <label className={labelClass}>{t('signup.address')}</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
                            <input type="text" value={signupData.orgAddress} onChange={e => setSignupData(p => ({ ...p, orgAddress: e.target.value }))} className={inputClass} placeholder="Keizersgracht 123, Amsterdam" />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>{t('signup.phone')}</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
                            <input type="tel" value={signupData.orgPhone} onChange={e => setSignupData(p => ({ ...p, orgPhone: e.target.value }))} className={inputClass} placeholder="+31 6 12345678" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>{t('signup.kvk')} *</label>
                            <div className="relative">
                                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
                                <input type="text" value={signupData.orgKvk} onChange={e => setSignupData(p => ({ ...p, orgKvk: e.target.value }))} className={inputClass} placeholder="12345678" required />
                            </div>
                        </div>
                        <div>
                            <label className={labelClass}>{t('signup.vat')} *</label>
                            <div className="relative">
                                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
                                <input type="text" value={signupData.orgVat} onChange={e => setSignupData(p => ({ ...p, orgVat: e.target.value }))} className={inputClass} placeholder="NL123456789B01" required />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer buttons — only when used standalone (legacy). The wizard
                shell renders its own Back/Next, so they're hidden when embedded. */}
            {!embedded && (
                <>
                    <button type="submit"
                        className="w-full py-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-base shadow-lg mt-2">
                        {t('signup.continue')} <ArrowRight className="w-5 h-5" />
                    </button>

                    <button type="button" onClick={resetSignup}
                        className="w-full py-2.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm">
                        <ArrowLeft className="w-4 h-4" /> {t('signup.back_to_signin')}
                    </button>
                </>
            )}
        </form>
    );
};

export default SignupStepOrg;

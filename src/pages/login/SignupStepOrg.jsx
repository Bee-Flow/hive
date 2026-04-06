import React from 'react';
import { Building, MapPin, Phone, FileText, ArrowLeft, ArrowRight, User, UserPlus, Users, Sparkles } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

const SignupStepOrg = ({ signupData, setSignupData, signupOrgs, handleSignupNext, resetSignup, inputClass, inputClassSimple, labelClass, deploymentMode }) => {
    const { t } = useTranslation();
    const isCloud = deploymentMode === 'cloud';

    const accountTypes = [
        {
            id: 'new',
            icon: <Building className="w-6 h-6" />,
            title: t('signup.org_account'),
            subtitle: t('signup.org_account_desc'),
            description: t('signup.org_account_features'),
            gradient: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            accentColor: '#6366f1',
        },
        ...(isCloud ? [{
            id: 'consumer',
            icon: <User className="w-6 h-6" />,
            title: t('signup.personal_account'),
            subtitle: t('signup.personal_account_desc'),
            description: t('signup.personal_account_features'),
            gradient: 'linear-gradient(135deg, #a855f7, #ec4899)',
            accentColor: '#a855f7',
        }] : []),
        ...(signupOrgs.length > 0 ? [{
            id: 'existing',
            icon: <UserPlus className="w-6 h-6" />,
            title: t('signup.join_existing'),
            subtitle: t('signup.join_existing_desc'),
            description: t('signup.join_existing_features'),
            gradient: 'linear-gradient(135deg, #10b981, #14b8a6)',
            accentColor: '#10b981',
        }] : []),
    ];

    return (
        <form onSubmit={e => { e.preventDefault(); handleSignupNext(); }} className="space-y-4">
            {/* ── Account Type Cards ── */}
            <div className="space-y-3">
                {accountTypes.map(type => {
                    const isSelected = signupData.signupType === type.id;
                    return (
                        <button key={type.id} type="button"
                            onClick={() => setSignupData(p => ({ ...p, signupType: type.id }))}
                            className="w-full text-left rounded-xl border-2 transition-all duration-200"
                            style={{
                                borderColor: isSelected ? type.accentColor : 'var(--border-subtle)',
                                background: isSelected ? `${type.accentColor}08` : 'var(--bg-primary)',
                                boxShadow: isSelected ? `0 0 0 1px ${type.accentColor}20, 0 4px 12px ${type.accentColor}10` : 'none',
                            }}
                        >
                            <div className="p-4 flex items-start gap-3.5">
                                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-white"
                                    style={{
                                        background: isSelected ? type.gradient : 'var(--bg-tertiary)',
                                        color: isSelected ? '#fff' : 'var(--text-muted)',
                                        transition: 'all 0.2s ease',
                                    }}>
                                    {type.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                            {type.title}
                                        </span>
                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                                            style={{
                                                background: isSelected ? `${type.accentColor}15` : 'var(--bg-tertiary)',
                                                color: isSelected ? type.accentColor : 'var(--text-muted)',
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
                                        style={{
                                            borderColor: isSelected ? type.accentColor : 'var(--border-subtle)',
                                        }}>
                                        {isSelected && (
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: type.accentColor }} />
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
                            <input type="text" value={signupData.newOrgName} onChange={e => setSignupData(p => ({ ...p, newOrgName: e.target.value }))} className={inputClass} placeholder="Acme Corp" required />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>{t('signup.tagline')}</label>
                        <input type="text" value={signupData.orgTagline} onChange={e => setSignupData(p => ({ ...p, orgTagline: e.target.value }))} className={inputClassSimple} placeholder="Intelligence in Action" />
                    </div>
                    <div>
                        <label className={labelClass}>{t('signup.description_label')}</label>
                        <input type="text" value={signupData.orgDescription} onChange={e => setSignupData(p => ({ ...p, orgDescription: e.target.value }))} className={inputClassSimple} placeholder={t('signup.what_does_org_do')} />
                    </div>
                    <div>
                        <label className={labelClass}>{t('signup.address')}</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
                            <input type="text" value={signupData.orgAddress} onChange={e => setSignupData(p => ({ ...p, orgAddress: e.target.value }))} className={inputClass} placeholder="123 Main Street, City" />
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
                    <div>
                        <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
                            <input type="checkbox" checked={signupData.orgAllowSignup} onChange={e => setSignupData(p => ({ ...p, orgAllowSignup: e.target.checked }))} className="accent-[var(--accent-primary)] w-4 h-4" />
                            <div>
                                <span className="text-sm font-medium block" style={{ color: 'var(--text-primary)' }}>{t('signup.allow_team_join')}</span>
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('signup.allow_team_join_desc')}</span>
                            </div>
                        </label>
                    </div>
                </div>
            )}

            {signupData.signupType === 'existing' && (
                <div className="animate-[fadeIn_0.2s_ease-out] pt-1">
                    <label className={labelClass}>{t('signup.select_org')}</label>
                    <div className="relative">
                        <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
                        <select value={signupData.organizationId} onChange={e => setSignupData(p => ({ ...p, organizationId: e.target.value }))} className={inputClass} style={{ paddingLeft: '2.5rem' }} required>
                            <option value="" style={{ background: 'var(--bg-secondary)' }}>{t('signup.select_org_placeholder')}</option>
                            {signupOrgs.map(org => (
                                <option key={org.id} value={org.id} style={{ background: 'var(--bg-secondary)' }}>{org.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            <button type="submit"
                className="w-full py-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-base shadow-lg mt-2">
                {t('signup.continue')} <ArrowRight className="w-5 h-5" />
            </button>

            <button type="button" onClick={resetSignup}
                className="w-full py-2.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm">
                <ArrowLeft className="w-4 h-4" /> {t('signup.back_to_signin')}
            </button>
        </form>
    );
};

export default SignupStepOrg;

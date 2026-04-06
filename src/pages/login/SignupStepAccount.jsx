import React from 'react';
import { User, Lock, Mail, Loader2, UserPlus, Building, ArrowLeft } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { useTranslation } from '../../hooks/useTranslation';

const SignupStepAccount = ({
    signupData, setSignupData, signupOrgs, handleSignup,
    isLoading, setIsLoading, setSignupStep, setError,
    inputClass, inputClassSimple, labelClass
}) => {
    const { t } = useTranslation();

    // OAuth flow — redirect to provider
    if (signupData.authMethod !== 'password' && signupData.signupType === 'new') {
        const providerName = signupData.authMethod === 'google' ? 'Google' : 'Microsoft';

        const handleOAuthSignup = async () => {
            setIsLoading(true);
            setError('');
            try {
                const res = await authFetch(`${API_BASE}/auth/pending-signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        newOrgName: signupData.newOrgName,
                        orgDetails: {
                            tagline: signupData.orgTagline,
                            description: signupData.orgDescription,
                            address: signupData.orgAddress,
                            email: signupData.orgEmail,
                            phone: signupData.orgPhone,
                            website: signupData.orgWebsite,
                            kvk: signupData.orgKvk,
                            vat: signupData.orgVat,
                            allowSignup: signupData.orgAllowSignup,
                            authMethod: signupData.authMethod,
                            privacyLevel: signupData.privacyLevel,
                            euModeEnabled: signupData.euModeEnabled
                        }
                    })
                });
                const data = await res.json();
                if (data.ok) {
                    window.location.href = `${API_BASE}/auth/login/${signupData.authMethod}`;
                } else {
                    setError(data.error || 'Failed to save signup data');
                    setIsLoading(false);
                }
            } catch (err) {
                setError('Failed to connect to server');
                setIsLoading(false);
            }
        };

        return (
            <div className="space-y-4">
                <div className="p-3 rounded-lg border flex items-center gap-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
                    <Building className="w-5 h-5 text-[var(--accent-primary)]" />
                    <div>
                        <span className="text-sm font-medium block" style={{ color: 'var(--text-primary)' }}>{signupData.newOrgName}</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('signup.new_org')}</span>
                    </div>
                </div>

                <p className="text-sm text-[var(--text-secondary)] text-center">
                    {t('signup.sign_in_with_provider', { provider: providerName })}
                </p>

                <button type="button" disabled={isLoading} onClick={handleOAuthSignup}
                    className="w-full py-3.5 bg-white border-2 border-[var(--border-default)] hover:border-[var(--accent-primary)] text-[var(--text-primary)] rounded-xl font-medium transition-all flex items-center justify-center gap-3 text-base shadow-sm disabled:opacity-50">
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                        <>
                            {signupData.authMethod === 'google' ? (
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <rect x="1" y="1" width="10" height="10" fill="#F25022" />
                                    <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
                                    <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
                                    <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
                                </svg>
                            )}
                            {t('signup.continue_with_provider', { provider: providerName })}
                        </>
                    )}
                </button>

                <button type="button" onClick={() => { setSignupStep(3); setError(''); }}
                    className="w-full py-2.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm">
                    <ArrowLeft className="w-4 h-4" /> {t('signup.back')}
                </button>
            </div>
        );
    }

    // Password flow — username/password form
    const isConsumer = signupData.signupType === 'consumer';

    // Context indicator — show org name or personal account
    const contextIcon = isConsumer
        ? <User className="w-5 h-5 text-[var(--accent-primary)]" />
        : <Building className="w-5 h-5 text-[var(--accent-primary)]" />;

    const contextTitle = isConsumer
        ? t('signup.personal_account')
        : signupData.signupType === 'new'
            ? signupData.newOrgName
            : signupOrgs.find(o => o.id === signupData.organizationId)?.name || 'Organization';

    const contextSubtitle = isConsumer
        ? t('signup.personal_account_desc')
        : signupData.signupType === 'new'
            ? t('signup.new_org')
            : t('signup.joining_existing');

    // Back navigation — consumer and existing go to step 1, new org goes to step 3
    const backStep = (isConsumer || signupData.signupType === 'existing') ? 1 : 3;

    return (
        <form onSubmit={handleSignup} className="space-y-4">
            <div className="p-3 rounded-lg border flex items-center gap-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
                {contextIcon}
                <div>
                    <span className="text-sm font-medium block" style={{ color: 'var(--text-primary)' }}>
                        {contextTitle}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {contextSubtitle}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={labelClass}>{t('signup.first_name')}</label>
                    <input type="text" value={signupData.firstName} onChange={e => setSignupData(p => ({ ...p, firstName: e.target.value }))} className={inputClassSimple} placeholder="John" />
                </div>
                <div>
                    <label className={labelClass}>{t('signup.last_name')}</label>
                    <input type="text" value={signupData.lastName} onChange={e => setSignupData(p => ({ ...p, lastName: e.target.value }))} className={inputClassSimple} placeholder="Doe" />
                </div>
            </div>

            <div>
                <label className={labelClass}>{t('signup.username')} *</label>
                <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
                    <input type="text" value={signupData.username} onChange={e => setSignupData(p => ({ ...p, username: e.target.value }))} className={inputClass} placeholder="johndoe" required />
                </div>
            </div>

            <div>
                <label className={labelClass}>{t('signup.email')}</label>
                <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
                    <input type="email" value={signupData.email} onChange={e => setSignupData(p => ({ ...p, email: e.target.value }))} className={inputClass} placeholder="john@company.com" />
                </div>
            </div>

            <div>
                <label className={labelClass}>{t('signup.password')} *</label>
                <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
                    <input type="password" value={signupData.password} onChange={e => setSignupData(p => ({ ...p, password: e.target.value }))} className={inputClass} placeholder="••••••••" required minLength={4} />
                </div>
            </div>

            <div>
                <label className={labelClass}>{t('signup.confirm_password')} *</label>
                <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
                    <input type="password" value={signupData.confirmPassword} onChange={e => setSignupData(p => ({ ...p, confirmPassword: e.target.value }))} className={inputClass} placeholder="••••••••" required minLength={4} />
                </div>
            </div>

            <button type="submit" disabled={isLoading}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-base shadow-lg mt-2">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><UserPlus className="w-5 h-5" /> {t('signup.create_account_btn')}</>}
            </button>

            <button type="button" onClick={() => { setSignupStep(backStep); setError(''); }}
                className="w-full py-2.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm">
                <ArrowLeft className="w-4 h-4" /> {t('signup.back')}
            </button>
        </form>
    );
};

export default SignupStepAccount;

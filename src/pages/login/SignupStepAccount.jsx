import React, { useState } from 'react';
import { User, Lock, Mail, Loader2, UserPlus, Building, ArrowLeft } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { useTranslation } from '../../hooks/useTranslation';
import { useDeploymentMode } from '../../hooks/useDeploymentMode';
import LegalDocModal from '../../components/LegalDocModal';

const SignupStepAccount = ({
    signupData, setSignupData, signupOrgs, handleSignup,
    isLoading, setIsLoading, setSignupStep, setError,
    inputClass, inputClassSimple, labelClass, embedded = false
}) => {
    const { t } = useTranslation();
    // Legal & Consent (the clickwrap below) is a Bee Flow Cloud surface only.
    // Self-hosted installs are governed by their licence agreement, not these
    // SaaS terms, so the consent step is hidden and never blocks signup there.
    const { isSelfHosted } = useDeploymentMode();
    const consentRequired = !isSelfHosted;
    const [viewDoc, setViewDoc] = useState(null); // { docId, title } — opens the in-app reader

    // ── Review summary (wizard) ──────────────────────────────────────────
    // Mirrors the "done"/review step of the Nextcloud onboarding wizard, but
    // folded above the credential fields so a final success screen doesn't
    // flash before auto-login navigates away.
    const renderReview = () => {
        const authLabel = { password: t('org.password_auth', 'Username & Password'), google: 'Google', microsoft: 'Microsoft' }[signupData.authMethod];
        const shieldOn = signupData.shieldEnabled !== false;
        const privacyLabel = shieldOn
            ? t('signup.shield_on_summary', '{n} PII categories', { n: (signupData.piiCategories || []).length })
            : t('signup.shield_off_summary', 'Off');
        const typeLabel = signupData.signupType === 'consumer'
            ? t('signup.personal_account', 'Personal account')
            : signupData.signupType === 'existing'
                ? t('signup.join_existing', 'Join an organisation')
                : t('signup.org_account', 'Organisation account');
        const orgName = signupData.signupType === 'new'
            ? signupData.newOrgName
            : signupData.signupType === 'existing'
                ? (signupOrgs.find(o => o.id === signupData.organizationId)?.name || '')
                : '';
        const rows = [
            [t('signup.review_account_type', 'Account type'), typeLabel],
            ...(orgName ? [[t('signup.review_organisation', 'Organisation'), orgName]] : []),
            ...(authLabel ? [[t('signup.review_signin', 'Sign-in method'), authLabel]] : []),
            ...(signupData.signupType === 'new' ? [[t('signup.review_privacy', 'Privacy Shield'), privacyLabel]] : []),
        ];
        return (
            <div className="rounded-xl border p-4 space-y-2 text-sm" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-tertiary)' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>{t('signup.review_title', 'Review your details')}</p>
                {rows.map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-3">
                        <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                        <span className="font-medium text-right truncate" style={{ color: 'var(--text-primary)' }}>{v}</span>
                    </div>
                ))}
            </div>
        );
    };

    // ── Legal consent checkbox (clickwrap) ───────────────────────────────
    // Un-ticked by default; the primary action stays disabled until ticked.
    // Org creators (signupType 'new') also accept the DPA; everyone else accepts
    // Terms + Privacy + Acceptable Use. Document links open the in-app reader
    // (LegalDocModal); the modal also offers an "Open full page" link to the
    // stable, savable public page (Dutch BW 6:234).
    const renderConsent = () => {
        if (!consentRequired) return null;
        const links = [
            { key: 'signup.consent_tos', fb: 'Terms of Service', docId: 'terms' },
            { key: 'signup.consent_privacy', fb: 'Privacy Policy', docId: 'privacy' },
            ...(signupData.signupType === 'new'
                ? [{ key: 'signup.consent_dpa', fb: 'Data Processing Agreement', docId: 'dpa' }]
                : []),
            { key: 'signup.consent_aup', fb: 'Acceptable Use Policy', docId: 'aup' },
        ];
        // The trigger buttons live inside the <label>, so preventDefault/stop
        // keeps a doc click from toggling the consent checkbox. The modal is a
        // sibling of the label (it portals to body) so its events don't bubble
        // back into the label through React's tree.
        const openDoc = (e, l) => {
            e.preventDefault();
            e.stopPropagation();
            setViewDoc({ docId: l.docId, title: t(l.key, l.fb) });
        };
        return (
            <>
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={!!signupData.consentAccepted}
                        onChange={e => setSignupData(p => ({ ...p, consentAccepted: e.target.checked }))}
                        className="mt-0.5 w-4 h-4 shrink-0"
                        style={{ accentColor: 'var(--accent-primary)' }}
                    />
                    <span className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {t('signup.consent_intro', "I have read and agree to Bee Flow's")}{' '}
                        {links.map((l, i) => (
                            <React.Fragment key={l.docId}>
                                {i > 0 && (i === links.length - 1
                                    ? <>{' '}{t('signup.consent_and', 'and')}{' '}</>
                                    : ', ')}
                                <button type="button" onClick={e => openDoc(e, l)}
                                    className="underline" style={{ color: 'var(--accent-primary)' }}>
                                    {t(l.key, l.fb)}
                                </button>
                            </React.Fragment>
                        ))}.
                    </span>
                </label>
                <LegalDocModal
                    open={!!viewDoc}
                    docId={viewDoc?.docId}
                    title={viewDoc?.title}
                    onClose={() => setViewDoc(null)}
                />
            </>
        );
    };

    // OAuth flow — redirect to provider (org or consumer)
    if (signupData.authMethod !== 'password' && (signupData.signupType === 'new' || signupData.signupType === 'consumer')) {
        const providerName = signupData.authMethod === 'google' ? 'Google' : 'Microsoft';

        const isConsumerOAuth = signupData.signupType === 'consumer';

        const handleOAuthSignup = async () => {
            if (consentRequired && !signupData.consentAccepted) {
                setError(t('signup.consent_required_error', 'Please read and accept the legal terms to continue.'));
                return;
            }
            setIsLoading(true);
            setError('');
            try {
                const pendingBody = isConsumerOAuth
                    ? {
                        signupType: 'consumer',
                        authMethod: signupData.authMethod,
                        // Carried through the session into the OAuth callback,
                        // which writes this user's personal Privacy Shield so a
                        // new personal account starts protected (BFSF-289).
                        privacyShield: {
                            enabled: signupData.shieldEnabled !== false,
                            piiDetectionCategories: signupData.piiCategories || [],
                            piiDetectionAction: signupData.piiAction || 'tokenize',
                            euModeEnabled: signupData.euModeEnabled,
                        },
                        consent: { accepted: true, accountType: 'consumer' },
                    }
                    : {
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
                            privacyShield: {
                                enabled: signupData.shieldEnabled !== false,
                                piiDetectionCategories: signupData.piiCategories || [],
                                piiDetectionAction: signupData.piiAction || 'block',
                                euModeEnabled: signupData.euModeEnabled
                            }
                        },
                        consent: { accepted: true, accountType: 'org_admin' }
                    };

                const res = await authFetch(`${API_BASE}/auth/pending-signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(pendingBody)
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
                {embedded ? renderReview() : (
                    <div className="p-3 rounded-lg border flex items-center gap-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
                        {isConsumerOAuth
                            ? <User className="w-5 h-5 text-[var(--accent-primary)]" />
                            : <Building className="w-5 h-5 text-[var(--accent-primary)]" />
                        }
                        <div>
                            <span className="text-sm font-medium block" style={{ color: 'var(--text-primary)' }}>
                                {isConsumerOAuth ? t('signup.personal_account') : signupData.newOrgName}
                            </span>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {isConsumerOAuth ? t('signup.personal_account_desc') : t('signup.new_org')}
                            </span>
                        </div>
                    </div>
                )}

                <p className="text-sm text-[var(--text-secondary)] text-center">
                    {t('signup.sign_in_with_provider', { provider: providerName })}
                </p>

                {renderConsent()}

                <button type="button" disabled={isLoading || (consentRequired && !signupData.consentAccepted)} onClick={handleOAuthSignup}
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

                {!embedded && (
                    <button type="button" onClick={() => { setSignupStep(isConsumerOAuth ? 2 : 3); setError(''); }}
                        className="w-full py-2.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm">
                        <ArrowLeft className="w-4 h-4" /> {t('signup.back')}
                    </button>
                )}
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

    // Back navigation — consumer goes to step 2 (auth selection) or 1 if auto-selected,
    // existing org goes to step 1, new org goes to step 3
    const backStep = isConsumer ? (signupData.authMethod ? 2 : 1)
        : signupData.signupType === 'existing' ? 1 : 3;

    return (
        <form onSubmit={handleSignup} className="space-y-4">
            {embedded ? renderReview() : (
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
            )}

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={labelClass}>{t('signup.first_name')}</label>
                    <input type="text" value={signupData.firstName} onChange={e => setSignupData(p => ({ ...p, firstName: e.target.value }))} className={inputClassSimple} placeholder="Jan" />
                </div>
                <div>
                    <label className={labelClass}>{t('signup.last_name')}</label>
                    <input type="text" value={signupData.lastName} onChange={e => setSignupData(p => ({ ...p, lastName: e.target.value }))} className={inputClassSimple} placeholder="Jansen" />
                </div>
            </div>

            <div>
                <label className={labelClass}>{t('signup.username')} *</label>
                <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
                    <input type="text" value={signupData.username} onChange={e => setSignupData(p => ({ ...p, username: e.target.value }))} className={inputClass} placeholder="janjansen" required />
                </div>
            </div>

            <div>
                <label className={labelClass}>{t('signup.email')}</label>
                <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
                    <input type="email" value={signupData.email} onChange={e => setSignupData(p => ({ ...p, email: e.target.value }))} className={inputClass} placeholder="jan@bedrijf.nl" />
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

            {renderConsent()}

            <button type="submit" disabled={isLoading || (consentRequired && !signupData.consentAccepted)}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-base shadow-lg mt-2">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><UserPlus className="w-5 h-5" /> {t('signup.create_account_btn')}</>}
            </button>

            {!embedded && (
                <button type="button" onClick={() => { setSignupStep(backStep); setError(''); }}
                    className="w-full py-2.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm">
                    <ArrowLeft className="w-4 h-4" /> {t('signup.back')}
                </button>
            )}
        </form>
    );
};

export default SignupStepAccount;

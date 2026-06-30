import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, AlertCircle, Globe } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import beeFlowLogo from '../../assets/bee-flow-logo.svg';

import SignupStepOrg from './SignupStepOrg';
import SignupStepAuth from './SignupStepAuth';
import SignupStepPrivacy from './SignupStepPrivacy';
import SignupStepAccount from './SignupStepAccount';

/**
 * SignupWizard — full-page onboarding wizard for new web signups.
 *
 * Mirrors the Nextcloud-connector onboarding wizard (NcOnboardingWizard): a
 * frosted card on a gradient page, a header with the logo + dynamic step title
 * + "Step X of N", a segmented progress bar, and a single Back / Next / submit
 * footer. The per-step bodies reuse the existing SignupStep* components in
 * `embedded` mode (their own footers hidden); this shell owns all navigation.
 *
 * Step path is derived from the chosen account type rather than hardcoded
 * numbers, so flow-specific skips (consumer single login-method, existing-org,
 * invite) are just shorter arrays:
 *   new org   : welcome → type → auth → privacy → account
 *   consumer  : welcome → type → [auth] → account
 *   existing  : welcome → type → account
 *   invite    : account
 * The account step owns its own primary action (Create account / Continue with
 * provider), which auto-logs in on success — so there's no trailing "done"
 * screen to flash; the review summary lives at the top of the account step.
 */
const SignupWizard = ({
    signupData, setSignupData, signupOrgs,
    deploymentMode = 'cloud', orgLogo,
    consumerLoginMethods = ['password', 'google', 'microsoft'],
    allowOrgSignups = true, allowConsumerSignups = true,
    inviteInfo, inviteToken,
    isLoading, setIsLoading,
    error, setError,
    handleSignup, resetSignup,
    availableLocales = [], locale, setLocale,
    inputClass, inputClassSimple, labelClass,
}) => {
    const { t } = useTranslation();
    const [stepIdx, setStepIdx] = useState(0);
    const isInvite = !!inviteInfo;

    const steps = useMemo(() => {
        if (isInvite) return ['account'];
        const type = signupData.signupType;
        if (type === 'consumer') {
            return consumerLoginMethods.length === 1
                ? ['welcome', 'type', 'account']
                : ['welcome', 'type', 'auth', 'account'];
        }
        if (type === 'existing') return ['welcome', 'type', 'account'];
        // 'new' organisation (default)
        return ['welcome', 'type', 'auth', 'privacy', 'account'];
    }, [isInvite, signupData.signupType, consumerLoginMethods.length]);

    // Keep stepIdx in range when the path shrinks (e.g. user switches from a
    // new org to a consumer account on the 'type' step).
    useEffect(() => {
        if (stepIdx > steps.length - 1) setStepIdx(steps.length - 1);
    }, [steps.length, stepIdx]);

    // Consumer with a single allowed login method: pre-select it (the 'auth'
    // step is omitted from the path above). Mirrors the old handleSignupNext.
    useEffect(() => {
        if (signupData.signupType === 'consumer' && consumerLoginMethods.length === 1
            && signupData.authMethod !== consumerLoginMethods[0]) {
            setSignupData(p => ({ ...p, authMethod: consumerLoginMethods[0] }));
        }
    }, [signupData.signupType, consumerLoginMethods]); // eslint-disable-line react-hooks/exhaustive-deps

    const idx = Math.min(stepIdx, steps.length - 1);
    const step = steps[idx];

    const canAdvance = () => {
        if (step === 'welcome') return true;
        if (step === 'type') {
            const type = signupData.signupType;
            if (type === 'new') return !!(signupData.newOrgName && signupData.orgKvk && signupData.orgVat);
            if (type === 'existing') return !!signupData.organizationId;
            return true; // consumer
        }
        if (step === 'auth') return !!signupData.authMethod;
        // Privacy: an enabled shield with no categories selected detects nothing.
        if (step === 'privacy' && signupData.shieldEnabled !== false) {
            return (signupData.piiCategories || []).length > 0;
        }
        return true; // privacy (shield off) / account
    };

    const next = () => {
        if (!canAdvance()) return;
        setError('');
        setStepIdx(i => Math.min(i + 1, steps.length - 1));
    };
    const prev = () => {
        setError('');
        if (idx === 0) { resetSignup(); return; } // back to the sign-in card
        setStepIdx(i => Math.max(i - 1, 0));
    };

    const titleFor = (s) => {
        if (isInvite) return t('login.accept_invitation', 'Accept invitation');
        switch (s) {
            case 'welcome': return t('signup.step_welcome', 'Welcome');
            case 'type': return signupData.signupType === 'new'
                ? t('signup.step_org', 'Organisation details')
                : t('signup.step_type', 'Choose your account');
            case 'auth': return t('signup.step_auth', 'Sign-in method');
            case 'privacy': return t('signup.step_privacy', 'Privacy Shield');
            case 'account': return t('signup.step_account', 'Your account');
            default: return '';
        }
    };

    const logoSrc = (deploymentMode === 'self-hosted' && orgLogo) ? orgLogo : beeFlowLogo;

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative"
            style={{ background: 'linear-gradient(160deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, var(--bg-tertiary) 100%)' }}>

            {/* Animated background shapes (match the login page) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute w-[500px] h-[500px] rounded-full opacity-[0.07]"
                    style={{ background: 'radial-gradient(circle, var(--accent-primary), transparent 70%)', top: '-5%', left: '-10%', animation: 'pulse 4s ease-in-out infinite' }} />
                <div className="absolute w-80 h-80 rounded-full opacity-[0.05]"
                    style={{ background: 'radial-gradient(circle, var(--accent-secondary), transparent 70%)', bottom: '5%', right: '-5%', animation: 'pulse 5s ease-in-out infinite 1.5s' }} />
            </div>

            <div className="w-full max-w-2xl relative z-10">
                <div className="backdrop-blur-xl rounded-3xl p-8 shadow-2xl border relative overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                    {/* Language picker */}
                    {availableLocales.length > 1 && (
                        <div className="absolute top-4 right-4 z-10">
                            <div className="relative inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] hover:border-[var(--border-default)] transition-colors cursor-pointer">
                                <Globe className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                                <select value={locale} onChange={(e) => setLocale(e.target.value)}
                                    className="appearance-none bg-transparent text-xs font-medium text-[var(--text-secondary)] cursor-pointer pr-4 outline-none"
                                    style={{ minWidth: '2rem' }}>
                                    {availableLocales.map(l => (
                                        <option key={l.code} value={l.code} style={{ background: 'var(--bg-secondary)' }}>{l.code.toUpperCase()}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Header */}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-2xl overflow-hidden ring-2 ring-[var(--border-subtle)] flex items-center justify-center bg-[var(--bg-primary)] shrink-0">
                            <img src={logoSrc} alt="Bee Flow" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-lg font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{titleFor(step)}</h1>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                {isInvite
                                    ? t('signup.invited_to_join', "You've been invited to join {orgName}", { orgName: inviteInfo.orgName || '' })
                                    : t('signup.step_counter', 'Step {n} of {total}', { n: idx + 1, total: steps.length })}
                            </p>
                        </div>
                    </div>

                    {/* Progress bar */}
                    {!isInvite && (
                        <div className="flex gap-1 mb-8">
                            {steps.map((s, i) => (
                                <div key={s} className="flex-1 h-1.5 rounded-full" style={{ background: i <= idx ? 'var(--accent-primary)' : 'var(--border-subtle)' }} />
                            ))}
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-500 text-sm">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Step body */}
                    {step === 'welcome' && (
                        <div className="space-y-4">
                            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                                {signupData.signupType === 'consumer'
                                    ? t('signup.wizard_welcome_consumer', "Let's create your personal Bee Flow account in a few quick steps.")
                                    : t('signup.wizard_welcome_org', "Let's set up your organisation on Bee Flow in a few quick steps.")}
                            </p>
                            <div className="rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-tertiary)' }}>
                                <p style={{ color: 'var(--text-secondary)' }}>
                                    {t('signup.wizard_welcome_body', "We'll walk you through your account type, how you sign in, privacy, and your account details. You can change most of this later in settings.")}
                                </p>
                            </div>
                        </div>
                    )}

                    {step === 'type' && (
                        <SignupStepOrg
                            embedded onAdvance={next}
                            signupData={signupData} setSignupData={setSignupData}
                            signupOrgs={signupOrgs}
                            inputClass={inputClass} inputClassSimple={inputClassSimple} labelClass={labelClass}
                            deploymentMode={deploymentMode}
                            allowOrgSignups={allowOrgSignups}
                            allowConsumerSignups={allowConsumerSignups}
                        />
                    )}

                    {step === 'auth' && (
                        <SignupStepAuth
                            embedded
                            signupData={signupData} setSignupData={setSignupData}
                            setError={setError}
                            allowedMethods={signupData.signupType === 'consumer' ? consumerLoginMethods : null}
                        />
                    )}

                    {step === 'privacy' && (
                        <SignupStepPrivacy
                            embedded
                            signupData={signupData} setSignupData={setSignupData}
                            setError={setError}
                        />
                    )}

                    {step === 'account' && (
                        <SignupStepAccount
                            embedded
                            signupData={signupData} setSignupData={setSignupData}
                            signupOrgs={signupOrgs} handleSignup={handleSignup}
                            isLoading={isLoading} setIsLoading={setIsLoading}
                            setError={setError}
                            inputClass={inputClass} inputClassSimple={inputClassSimple} labelClass={labelClass}
                        />
                    )}

                    {/* Footer — Back always; Next on non-account steps. The account
                        step renders its own primary action inside the body. */}
                    <div className="flex items-center justify-between mt-8">
                        <button type="button" onClick={prev} disabled={isLoading}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-30"
                            style={{ color: 'var(--text-secondary)' }}>
                            <ChevronLeft className="w-4 h-4" />
                            {idx === 0 ? t('signup.back_to_signin', 'Back to sign in') : t('signup.back', 'Back')}
                        </button>
                        {step !== 'account' && (
                            <button type="button" onClick={next} disabled={!canAdvance()}
                                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-30"
                                style={{ background: 'var(--accent-primary)' }}>
                                {t('signup.next', 'Next')} <ChevronRight className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                <p className="text-center text-xs text-[var(--text-tertiary)] mt-6">
                    {t('login.platform_name')}
                </p>
            </div>
        </div>
    );
};

export default SignupWizard;

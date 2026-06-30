import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { AlertCircle, Globe, MailCheck, CheckCircle } from 'lucide-react';
import { API_BASE, authFetch, setSessionToken } from '../utils/helpers';
import { opaqueLogin } from '../lib/opaque';
import InitSetupWizard from '../components/InitSetupWizard';
import beeFlowLogo from '../assets/bee-flow-logo.svg';

// Detect if we're running inside an iframe (embedded in Nextcloud, etc.)
const isEmbedded = (() => {
    try { return window.self !== window.top; } catch (e) { return true; }
})();

import LoginForm from './login/LoginForm';
import SignupWizard from './login/SignupWizard';
import MfaLoginStep from './login/MfaLoginStep';
import ForgotPasswordStep from './login/ForgotPasswordStep';
import ResetPasswordStep from './login/ResetPasswordStep';
import { PII_CATEGORIES } from '../config/piiCategories';

// Default Privacy-Shield selection for a new org: all PII categories on,
// block on detection. The wizard's All/None lets the founder pare it down.
const DEFAULT_PII_CATEGORIES = PII_CATEGORIES.map(c => c.id);

const LoginPage = ({ onLogin }) => {
    const { t, locale, setLocale } = useTranslation();
    const [availableLocales, setAvailableLocales] = useState([]);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [setupMode, setSetupMode] = useState(false);
    const [isOAuthConfigured, setIsOAuthConfigured] = useState(false);
    const [serverUrl, setServerUrl] = useState('');
    const [isGoogleConfigured, setIsGoogleConfigured] = useState(false);
    const [isMicrosoftConfigured, setIsMicrosoftConfigured] = useState(false);
    const [isSetupComplete, setIsSetupComplete] = useState(true);
    const [allowSignups, setAllowSignups] = useState(null);
    const [allowOrgSignups, setAllowOrgSignups] = useState(true);
    const [allowConsumerSignups, setAllowConsumerSignups] = useState(true);
    const [consumerLoginMethods, setConsumerLoginMethods] = useState(['password', 'google', 'microsoft']);
    const [allowPasswordLogin, setAllowPasswordLogin] = useState(null);
    const [authSettingsLoaded, setAuthSettingsLoaded] = useState(false);
    const [deploymentMode, setDeploymentMode] = useState('cloud');
    const [orgLogo, setOrgLogo] = useState(null);
    const [confirmPassword, setConfirmPassword] = useState('');
    const [adminRecoveryKey, setAdminRecoveryKey] = useState(null);
    // MFA: set when /auth/admin-login reports a second factor is required.
    const [mfaRequired, setMfaRequired] = useState(false);
    // Password reset: forgot-password email step + reset-with-token step.
    const [forgotMode, setForgotMode] = useState(false);
    const [forgotSent, setForgotSent] = useState(false);
    const [resetToken, setResetToken] = useState(null);
    const [resetDone, setResetDone] = useState(false);

    // Email verification: "check your inbox" gate after signup / blocked login.
    const [verifyEmailSent, setVerifyEmailSent] = useState(false);
    const [verifyEmail, setVerifyEmail] = useState('');
    const [resending, setResending] = useState(false);
    const [resendDone, setResendDone] = useState(false);
    const [verifiedBanner, setVerifiedBanner] = useState(false);

    // Invite token state
    const [inviteToken, setInviteToken] = useState(null);
    const [inviteInfo, setInviteInfo] = useState(null); // { email, organizationId, orgName, role }

    // Signup state
    const [signupMode, setSignupMode] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('signup') === '1' || params.get('invite')) {
            return true;
        }
        return false;
    });
    const [signupOrgs, setSignupOrgs] = useState([]);
    const [signupData, setSignupData] = useState({
        username: '', password: '', confirmPassword: '', firstName: '', lastName: '', email: '',
        signupType: 'new', organizationId: '',
        newOrgName: '', orgTagline: '', orgDescription: '', orgAddress: '', orgEmail: '', orgPhone: '', orgWebsite: '', orgKvk: '', orgVat: '', orgAllowSignup: false,
        authMethod: '', shieldEnabled: true, piiCategories: DEFAULT_PII_CATEGORIES, piiAction: 'block', euModeEnabled: false,
        consentAccepted: false,
    });

    useEffect(() => {
        const checkSetup = async () => {
            try {
                const res = await authFetch(`${API_BASE}/auth/setup-status`);
                if (res.ok) {
                    const data = await res.json();
                    setIsSetupComplete(data.isSetupComplete);
                    setIsOAuthConfigured(data.isOAuthConfigured);
                    setIsGoogleConfigured(data.isGoogleConfigured);
                    setIsMicrosoftConfigured(data.isMicrosoftConfigured);
                    if (data.serverUrl) setServerUrl(data.serverUrl);
                    if (!data.isSetupComplete) setSetupMode(true);
                    // Also track raw setup-complete flag for wizard
                    setIsSetupComplete(data.isSetupComplete);
                    if (data.allowSignups === false) setAllowSignups(false);
                    else setAllowSignups(true);
                    setAllowOrgSignups(data.allowOrgSignups !== false);
                    setAllowConsumerSignups(data.allowConsumerSignups !== false);
                    if (Array.isArray(data.consumerLoginMethods)) setConsumerLoginMethods(data.consumerLoginMethods);
                    if (data.allowPasswordLogin === false) setAllowPasswordLogin(false);
                    else setAllowPasswordLogin(true);
                    if (data.deploymentMode) setDeploymentMode(data.deploymentMode);
                    if (data.branding?.logo) {
                        setOrgLogo(data.branding.logo.startsWith('/') ? `${API_BASE}${data.branding.logo}` : data.branding.logo);
                    }
                    if (data.availableLocales) setAvailableLocales(data.availableLocales);
                } else {
                    // If setup-status fails, show everything (safe fallback)
                    setAllowSignups(true);
                    setAllowPasswordLogin(true);
                }
                setAuthSettingsLoaded(true);

                const orgRes = await authFetch(`${API_BASE}/auth/organizations/public`);
                if (orgRes.ok) {
                    const orgData = await orgRes.json();
                    setSignupOrgs(orgData);
                }
            } catch (err) {
                console.error('Failed to check setup status:', err);
            }
        };
        checkSetup();
    }, []);

    // Detect a password-reset link (?reset=TOKEN). Capture the token and strip
    // it from the address bar so it can't leak from a copied URL.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('reset');
        if (token) {
            setResetToken(token);
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    // Detect the email-verification redirect (?verified=1 on success, or
    // ?error=verify_expired / verify_error). The verify endpoint 302s here
    // after flipping the account to active; show a banner and clean the URL.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('verified') === '1') {
            setVerifiedBanner(true);
            window.history.replaceState({}, '', window.location.pathname);
        } else if ((params.get('error') || '').startsWith('verify_')) {
            setError(t('login.verify_link_invalid', 'This verification link is invalid or has expired. Please log in to request a new one.'));
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Detect and validate invite token. Two paths:
    //   1. Legacy `?invite=TOKEN` query param (kept for backwards-compat).
    //   2. New flow: token lives in the server session after the user clicked
    //      the email link, which 302-redirected through /api/auth/redeem-invite/<token>.
    //      Pull it via /auth/pending-invite. No token ever appears in the URL bar.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const queryToken = params.get('invite');
        if (queryToken) {
            // Strip the token from the URL immediately so a copy/paste of the
            // address bar can't leak it.
            window.history.replaceState({}, '', window.location.pathname);
        }

        const applyInvite = (token, data) => {
            setInviteToken(token);
            setInviteInfo(data);
            setSignupData(prev => ({
                ...prev,
                signupType: 'existing',
                organizationId: data.organizationId,
                email: data.email || prev.email,
            }));
            setSignupMode(true);
        };

        const run = async () => {
            try {
                // Prefer the server-side session entry (new flow).
                const pendingRes = await authFetch(`${API_BASE}/auth/pending-invite`);
                if (pendingRes.ok) {
                    const data = await pendingRes.json();
                    if (data.valid && data.token) {
                        applyInvite(data.token, data);
                        return;
                    }
                }
                // Fallback to the legacy query-param flow.
                if (!queryToken) return;
                const res = await authFetch(`${API_BASE}/auth/invite/${queryToken}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.valid) {
                        applyInvite(queryToken, data);
                        return;
                    }
                }
                setError('This invitation link has expired or is no longer valid.');
                setInviteToken(null);
            } catch (err) {
                console.error('Failed to validate invite:', err);
                setError('Failed to validate invitation. Please try again.');
                setInviteToken(null);
            }
        };
        run();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            if (setupMode) {
                if (password !== confirmPassword) {
                    setError(t('login.passwords_no_match'));
                    setIsLoading(false);
                    return;
                }
                const res = await authFetch(`${API_BASE}/auth/setup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.recoveryKey) {
                        // Show recovery key before switching to login
                        setAdminRecoveryKey(data.recoveryKey);
                    } else {
                        setSetupMode(false);
                        setIsSetupComplete(true);
                    }
                    setPassword('');
                    setConfirmPassword('');
                    setError('');
                } else {
                    const data = await res.json();
                    setError(data.error || t('login.setup_failed'));
                }
            } else {
                const res = await authFetch(`${API_BASE}/auth/admin-login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();

                if (data.useOpaque) {
                    // User has migrated to OPAQUE — use OPAQUE flow transparently
                    try {
                        const result = await opaqueLogin(username, password);
                        if (result.useLegacy) {
                            setError(t('login.auth_error_contact_admin'));
                        } else if (result.success) {
                            onLogin(result.user);
                        } else {
                            setError(t('login.login_failed'));
                        }
                    } catch (opaqueErr) {
                        setError(opaqueErr.message || t('login.login_failed'));
                    }
                } else if (res.ok && data.mfaRequired) {
                    // Password verified — prompt for the second factor.
                    setMfaRequired(true);
                } else if (res.ok && data.emailVerificationRequired) {
                    // Credentials OK but the email isn't confirmed yet — gate
                    // them on verification and offer a resend.
                    setVerifyEmail(username.includes('@') ? username : '');
                    setResendDone(false);
                    setVerifyEmailSent(true);
                } else if (res.ok && data.success) {
                    onLogin(data.user, data.recoveryKey);
                } else {
                    setError(data.error || t('login.login_failed'));
                }
            }
        } catch (err) {
            setError(t('login.connection_error'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleMfaVerify = async (code) => {
        setError('');
        setIsLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/auth/mfa/verify-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                onLogin(data.user, data.recoveryKey);
            } else {
                setError(data.error || t('mfa.invalid_code', 'Invalid code. Please try again.'));
            }
        } catch (err) {
            setError(t('login.connection_error'));
        } finally {
            setIsLoading(false);
        }
    };

    const cancelMfa = () => {
        setMfaRequired(false);
        setError('');
        setPassword('');
    };

    const handleForgotPassword = async (email) => {
        setError('');
        setIsLoading(true);
        try {
            // Always 200 from the server — show the same confirmation either way.
            await authFetch(`${API_BASE}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            setForgotSent(true);
        } catch (err) {
            // Network error only — still show the neutral confirmation.
            setForgotSent(true);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async (newPassword) => {
        setError('');
        setIsLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: resetToken, newPassword })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setResetDone(true);
            } else {
                setError(data.error || t('reset.failed', 'Failed to reset password.'));
            }
        } catch (err) {
            setError(t('login.connection_error'));
        } finally {
            setIsLoading(false);
        }
    };

    const exitPasswordReset = () => {
        setForgotMode(false);
        setForgotSent(false);
        setResetToken(null);
        setResetDone(false);
        setError('');
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setError('');

        if (signupData.password !== signupData.confirmPassword) {
            setError(t('login.passwords_no_match'));
            return;
        }
        if (signupData.password.length < 4) {
            setError('Password must be at least 4 characters');
            return;
        }
        if (!signupData.username) {
            setError('Username is required');
            return;
        }
        // Clickwrap consent is Cloud-only; self-hosted signup skips the gate.
        if (deploymentMode !== 'self-hosted' && !signupData.consentAccepted) {
            setError(t('signup.consent_required_error', 'Please read and accept the legal terms to continue.'));
            return;
        }

        setIsLoading(true);
        try {
            const body = {
                username: signupData.username,
                password: signupData.password,
                displayName: `${signupData.firstName} ${signupData.lastName}`.trim() || signupData.username,
                firstName: signupData.firstName,
                lastName: signupData.lastName,
                email: signupData.email,
                // The chosen interface language drives the language of this
                // account's transactional emails (verification, welcome).
                locale,
            };

            if (signupData.signupType === 'new') {
                body.newOrgName = signupData.newOrgName;
                body.orgDetails = {
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
                };
            } else if (signupData.signupType === 'existing') {
                body.organizationId = signupData.organizationId;
            }
            // signupType === 'consumer' → no org fields sent

            // Attach invite token if present
            if (inviteToken) {
                body.inviteToken = inviteToken;
            }

            // Legal consent — the server re-derives the required documents and
            // versions from the registry; we only assert the affirmative tick.
            body.consent = { accepted: true };

            const res = await authFetch(`${API_BASE}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (res.ok && data.emailVerificationRequired) {
                // Account created but blocked until the email is confirmed.
                setVerifyEmail(signupData.email || '');
                setResendDone(false);
                setVerifyEmailSent(true);
            } else if (res.ok && data.success) {
                onLogin(data.user, data.recoveryKey);
            } else {
                setError(data.error || t('login.signup_failed'));
            }
        } catch (err) {
            setError('Connection error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Resend a verification link. The server always responds 200 (no account
    // enumeration), so we just show a neutral confirmation.
    const handleResendVerification = async (email) => {
        const target = (email || verifyEmail || '').trim();
        if (!target) return;
        setResending(true);
        try {
            await authFetch(`${API_BASE}/auth/resend-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: target }),
            });
        } catch (err) { /* still show the neutral confirmation */ }
        setResendDone(true);
        setResending(false);
    };

    // OAuth redirects must go directly to the backend server URL (not through
    // the frontend nginx proxy) so the session cookie is properly set.
    const oauthBase = serverUrl || API_BASE;

    // Open OAuth in a popup when embedded in an iframe (Google/Microsoft block
    // their consent screens from loading inside iframes).
    // We use `noopener` to fully sever the iframe→popup relationship so that
    // Google/Microsoft can't detect the cross-origin iframe context.
    // Since `noopener` breaks window.opener (no postMessage), we poll
    // /auth/user to detect when login completes.
    const pollTimerRef = useRef(null);

    // Open the OAuth flow in a popup. In embedded mode (BeeFlow iframed under
    // Nextcloud / etc.), Chrome's storage partitioning blocks the iframe from
    // ever seeing the popup's session cookie — so polling /auth/user always
    // returns unauthenticated. We bridge that with a pickup token: the iframe
    // mints a random id, hands it to the popup via the URL, the OAuth callback
    // deposits a session token under that id, and we poll /auth/login-pickup
    // (no cookie required) to retrieve it. The token is then stashed in
    // sessionStorage and travels on every authFetch as X-Session-Token.
    const openOAuthPopup = useCallback((urlBase) => {
        const w = 520, h = 650;
        const left = window.screenX + (window.outerWidth - w) / 2;
        const top = window.screenY + (window.outerHeight - h) / 2;

        // Generate pickup id; append to URL so the OAuth callback can deposit
        // a token under it.
        const pickupId = (window.crypto && window.crypto.randomUUID)
            ? window.crypto.randomUUID()
            : Math.random().toString(36).slice(2) + Date.now().toString(36);
        const sep = urlBase.includes('?') ? '&' : '?';
        const url = `${urlBase}${sep}pickup=${encodeURIComponent(pickupId)}`;

        // noopener severs the opener chain — Google won't see the iframe context.
        window.open(url, 'beeflow_oauth',
            `width=${w},height=${h},left=${left},top=${top},noopener,noreferrer`);

        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        pollTimerRef.current = setInterval(async () => {
            try {
                // Try the pickup channel first (works even when 3rd-party
                // cookies are blocked).
                const pickRes = await fetch(`${API_BASE}/auth/login-pickup?id=${encodeURIComponent(pickupId)}`, {
                    credentials: 'include',
                });
                if (pickRes.ok) {
                    const pickData = await pickRes.json();
                    if (pickData.sessionToken) {
                        setSessionToken(pickData.sessionToken);
                        clearInterval(pollTimerRef.current);
                        pollTimerRef.current = null;
                        // Now fetch the user with the token in place.
                        const userRes = await authFetch(`${API_BASE}/auth/user`);
                        if (userRes.ok) {
                            const data = await userRes.json();
                            if (data.authenticated && data.user) return onLogin(data.user);
                        }
                    }
                }

                // Fallback: cookie-based check (works in non-embedded mode or
                // when the browser allows 3rd-party cookies).
                const res = await authFetch(`${API_BASE}/auth/user`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.authenticated && data.user) {
                        clearInterval(pollTimerRef.current);
                        pollTimerRef.current = null;
                        onLogin(data.user);
                    }
                }
            } catch (_) { /* server unreachable, keep polling */ }
        }, 1500);

        // Stop polling after 5 minutes (safety net)
        setTimeout(() => {
            if (pollTimerRef.current) {
                clearInterval(pollTimerRef.current);
                pollTimerRef.current = null;
            }
        }, 5 * 60 * 1000);
    }, [onLogin]);

    // Clean up polling on unmount
    useEffect(() => {
        return () => {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        };
    }, []);

    const handleOAuthLogin = () => {
        if (isEmbedded) {
            openOAuthPopup(`${oauthBase}/auth/login/nextcloud?popup=1`);
        } else {
            window.location.href = `${oauthBase}/auth/login/nextcloud`;
        }
    };

    const handleGoogleLogin = () => {
        if (isEmbedded) {
            openOAuthPopup(`${oauthBase}/auth/login/google?popup=1`);
        } else {
            window.location.href = `${oauthBase}/auth/login/google`;
        }
    };

    const handleMicrosoftLogin = () => {
        if (isEmbedded) {
            openOAuthPopup(`${oauthBase}/auth/login/microsoft?popup=1`);
        } else {
            window.location.href = `${oauthBase}/auth/login/microsoft`;
        }
    };

    const resetSignup = () => {
        setSignupMode(false);
        setError('');
        setSignupData({
            username: '', password: '', confirmPassword: '', firstName: '', lastName: '', email: '',
            signupType: 'new', organizationId: '',
            newOrgName: '', orgTagline: '', orgDescription: '', orgAddress: '', orgEmail: '', orgPhone: '', orgWebsite: '', orgKvk: '', orgVat: '', orgAllowSignup: false,
            authMethod: '', shieldEnabled: true, piiCategories: DEFAULT_PII_CATEGORIES, piiAction: 'block', euModeEnabled: false,
            consentAccepted: false,
        });
    };

    const inputClass = "w-full pl-10 pr-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition-all";
    const inputClassSimple = "w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition-all text-sm";
    const labelClass = "block text-sm font-medium text-[var(--text-secondary)] mb-1.5";

    // Determine subtitle (signup now lives in the full-page SignupWizard).
    const getSubtitle = () => {
        if (setupMode) return t('login.create_admin_password');
        if (resetToken) return t('reset.title', 'Reset your password');
        if (forgotMode) return t('reset.forgot_title', 'Forgot your password?');
        if (mfaRequired) return t('mfa.title', 'Two-factor authentication');
        return t('login.sign_in_continue');
    };

    // Setup mode now only shows password creation (LoginForm handles this).
    // All AI/service configuration is handled by the Docker install wizard.

    // Signup is a dedicated full-page wizard (welcome → steps → auto-login),
    // mirroring the Nextcloud-connector onboarding flow. Shown once auth
    // settings have loaded so the wizard's flow gates have real values.
    // Email-verification gate: shown after a signup that needs confirmation, or
    // after a blocked login attempt for an unverified account. Takes priority
    // over the signup wizard / login form.
    if (verifyEmailSent) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 relative"
                style={{ background: 'linear-gradient(160deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, var(--bg-tertiary) 100%)' }}>
                <div className="w-full max-w-md">
                    <div className="rounded-2xl shadow-xl p-8 text-center" style={{ background: 'var(--bg-secondary)' }}>
                        <div className="w-16 h-16 mx-auto mb-5 rounded-full flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
                            <MailCheck className="w-8 h-8" style={{ color: 'var(--accent-primary)' }} />
                        </div>
                        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                            {t('login.verify_title', 'Confirm your email address')}
                        </h2>
                        <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                            {verifyEmail
                                ? t('login.verify_sent_to', 'We sent a confirmation link to')
                                : t('login.verify_check_inbox', 'We sent you a confirmation link. Please check your inbox to activate your account.')}
                        </p>
                        {verifyEmail && <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{verifyEmail}</p>}
                        <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
                            {t('login.verify_then_login', 'Click the link in the email, then log in. You can\'t log in until your email is confirmed.')}
                        </p>

                        {resendDone ? (
                            <div className="mb-4 p-3 rounded-lg flex items-center justify-center gap-2 text-sm" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                                <CheckCircle className="w-4 h-4" /> {t('login.verify_resent', 'If that account needs confirmation, a new link is on its way.')}
                            </div>
                        ) : (
                            <div className="mb-4 space-y-2">
                                {!verifyEmail && (
                                    <input
                                        type="email"
                                        value={verifyEmail}
                                        onChange={e => setVerifyEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        className={inputClass}
                                    />
                                )}
                                <button
                                    onClick={() => handleResendVerification(verifyEmail)}
                                    disabled={resending || !verifyEmail.trim()}
                                    className="w-full py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-opacity"
                                    style={{ background: 'var(--accent-primary)' }}
                                >
                                    {resending ? t('login.verify_resending', 'Sending…') : t('login.verify_resend', 'Resend confirmation email')}
                                </button>
                            </div>
                        )}

                        <button
                            onClick={() => { setVerifyEmailSent(false); setResendDone(false); setSignupMode(false); setError(''); }}
                            className="text-sm font-medium"
                            style={{ color: 'var(--accent-primary)' }}
                        >
                            {t('login.back_to_login', 'Back to login')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (authSettingsLoaded && signupMode) {
        return (
            <SignupWizard
                signupData={signupData} setSignupData={setSignupData}
                signupOrgs={signupOrgs}
                deploymentMode={deploymentMode} orgLogo={orgLogo}
                consumerLoginMethods={consumerLoginMethods}
                allowOrgSignups={allowOrgSignups} allowConsumerSignups={allowConsumerSignups}
                inviteInfo={inviteInfo} inviteToken={inviteToken}
                isLoading={isLoading} setIsLoading={setIsLoading}
                error={error} setError={setError}
                handleSignup={handleSignup} resetSignup={resetSignup}
                availableLocales={availableLocales} locale={locale} setLocale={setLocale}
                inputClass={inputClass} inputClassSimple={inputClassSimple} labelClass={labelClass}
            />
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative"
            style={{ background: 'linear-gradient(160deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, var(--bg-tertiary) 100%)' }}>

            {/* Recovery Key Modal */}
            {adminRecoveryKey && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md p-6 rounded-2xl shadow-2xl space-y-5" style={{ background: 'var(--bg-secondary)' }}>
                        <div className="text-center">
                            <div className="text-3xl mb-2">🔐</div>
                            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{t('login.save_recovery_key')}</h3>
                            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{t('login.recovery_key_desc')}</p>
                        </div>
                        <div className="p-4 rounded-xl font-mono text-sm text-center break-all select-all cursor-text" style={{ background: 'var(--bg-primary)', border: '2px dashed var(--border-default)', color: 'var(--text-primary)' }}>
                            {adminRecoveryKey}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => { navigator.clipboard.writeText(adminRecoveryKey); }}
                                className="flex-1 py-2.5 rounded-xl font-medium text-sm border transition-colors"
                                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                            >📋 {t('common.copy')}</button>
                            <button
                                onClick={() => { setAdminRecoveryKey(null); setSetupMode(false); setIsSetupComplete(true); }}
                                className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white"
                                style={{ background: 'var(--accent-primary)' }}
                            >{t('login.ive_saved_it')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Animated background shapes */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute w-[500px] h-[500px] rounded-full opacity-[0.07]"
                    style={{ background: 'radial-gradient(circle, var(--accent-primary), transparent 70%)', top: '-5%', left: '-10%', animation: 'pulse 4s ease-in-out infinite' }} />
                <div className="absolute w-80 h-80 rounded-full opacity-[0.05]"
                    style={{ background: 'radial-gradient(circle, var(--accent-secondary), transparent 70%)', bottom: '5%', right: '-5%', animation: 'pulse 5s ease-in-out infinite 1.5s' }} />
                <div className="absolute w-48 h-48 rounded-full opacity-[0.04]"
                    style={{ background: 'radial-gradient(circle, var(--accent-primary), transparent 70%)', top: '60%', left: '15%', animation: 'pulse 6s ease-in-out infinite 0.8s' }} />
                <div className="absolute w-32 h-32 rounded-full opacity-[0.06]"
                    style={{ background: 'radial-gradient(circle, var(--accent-secondary), transparent 70%)', top: '15%', right: '30%', animation: 'pulse 7s ease-in-out infinite 2s' }} />
            </div>

            <div className="w-full max-w-md relative z-10 transition-all duration-300">
                <div className="backdrop-blur-xl rounded-3xl p-8 shadow-2xl border relative overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                    {/* Top highlight line for glass effect */}
                    <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-[var(--border-default)] to-transparent" />

                    {/* Language picker */}
                    {availableLocales.length > 1 && (
                        <div className="absolute top-4 right-4 z-10">
                            <div className="relative inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] hover:border-[var(--border-default)] transition-colors cursor-pointer">
                                <Globe className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                                <select
                                    value={locale}
                                    onChange={(e) => setLocale(e.target.value)}
                                    className="appearance-none bg-transparent text-xs font-medium text-[var(--text-secondary)] cursor-pointer pr-4 outline-none"
                                    style={{ minWidth: '2rem' }}
                                >
                                    {availableLocales.map(l => (
                                        <option key={l.code} value={l.code} style={{ background: 'var(--bg-secondary)' }}>
                                            {l.code.toUpperCase()}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-36 h-36 mx-auto mb-5 rounded-full overflow-hidden shadow-xl ring-4 ring-[var(--border-subtle)] flex items-center justify-center bg-[var(--bg-primary)]">
                            {deploymentMode === 'self-hosted' && orgLogo
                                ? <img src={orgLogo} alt="Organization" className="max-w-[80%] max-h-[80%] object-contain" />
                                : <img src={beeFlowLogo} alt="Bee Flow" className="w-full h-full object-cover" />}
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">
                            {getSubtitle()}
                        </p>
                    </div>

                    {/* Email-verified success banner (after clicking the link) */}
                    {verifiedBanner && (
                        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3 text-green-600 text-sm">
                            <CheckCircle className="w-5 h-5 shrink-0" />
                            {t('login.verified_success', 'Your email is confirmed. You can now log in.')}
                        </div>
                    )}

                    {/* Error display */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-500 text-sm">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Content */}
                    {!authSettingsLoaded ? (
                        <div className="flex justify-center py-8">
                            <div className="w-6 h-6 rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-primary)] animate-spin" />
                        </div>
                    ) : resetToken ? (
                        <ResetPasswordStep
                            onSubmit={handleResetPassword}
                            onDone={exitPasswordReset}
                            isLoading={isLoading}
                            done={resetDone}
                            inputClass={inputClass}
                            labelClass={labelClass}
                        />
                    ) : forgotMode ? (
                        <ForgotPasswordStep
                            onSubmit={handleForgotPassword}
                            onBack={exitPasswordReset}
                            isLoading={isLoading}
                            sent={forgotSent}
                            inputClass={inputClass}
                            labelClass={labelClass}
                        />
                    ) : mfaRequired ? (
                        <MfaLoginStep
                            onVerify={handleMfaVerify}
                            onCancel={cancelMfa}
                            isLoading={isLoading}
                            inputClass={inputClass}
                            labelClass={labelClass}
                        />
                    ) : (
                        <LoginForm
                            onForgotPassword={() => { setForgotMode(true); setError(''); }}
                            username={username} setUsername={setUsername}
                            password={password} setPassword={setPassword}
                            confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
                            setupMode={setupMode} isLoading={isLoading}
                            handleSubmit={handleSubmit}
                            handleOAuthLogin={handleOAuthLogin}
                            handleGoogleLogin={handleGoogleLogin}
                            handleMicrosoftLogin={handleMicrosoftLogin}
                            isOAuthConfigured={isOAuthConfigured}
                            isGoogleConfigured={isGoogleConfigured}
                            isMicrosoftConfigured={isMicrosoftConfigured}
                            setSignupMode={allowSignups ? setSignupMode : null}
                            setError={setError}
                            allowSignups={allowSignups}
                            allowPasswordLogin={allowPasswordLogin}
                            inputClass={inputClass} labelClass={labelClass}
                        />
                    )}
                </div>

                <p className="text-center text-xs text-[var(--text-tertiary)] mt-6">
                    {t('login.platform_name')}
                </p>

                {deploymentMode === 'self-hosted' && (
                    <p className="text-center text-[10px] text-[var(--text-tertiary)] mt-2">
                        <a
                            href="https://beeflow.nl"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-[var(--text-secondary)] transition-colors"
                        >
                            {t('sidebar.powered_by', 'Powered by Bee Flow')}
                        </a>
                    </p>
                )}
            </div>
        </div>
    );
};

export default LoginPage;

import React, { useState, useEffect } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { AlertCircle } from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';
import { opaqueLogin } from '../lib/opaque';
import InitSetupWizard from '../components/InitSetupWizard';

import LoginForm from './login/LoginForm';
import SignupStepOrg from './login/SignupStepOrg';
import SignupStepAuth from './login/SignupStepAuth';
import SignupStepPrivacy from './login/SignupStepPrivacy';
import SignupStepAccount from './login/SignupStepAccount';

const LoginPage = ({ onLogin, onDemoLogin }) => {
    const { t } = useTranslation();
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
    const [isDemoEnabled, setIsDemoEnabled] = useState(true);
    const [confirmPassword, setConfirmPassword] = useState('');
    const [adminRecoveryKey, setAdminRecoveryKey] = useState(null);

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
    const [signupStep, setSignupStep] = useState(1);
    const [signupOrgs, setSignupOrgs] = useState([]);
    const [signupData, setSignupData] = useState({
        username: '', password: '', confirmPassword: '', firstName: '', lastName: '', email: '',
        signupType: 'new', organizationId: '',
        newOrgName: '', orgTagline: '', orgDescription: '', orgAddress: '', orgEmail: '', orgPhone: '', orgWebsite: '', orgKvk: '', orgVat: '', orgAllowSignup: true,
        authMethod: '', privacyLevel: 'off', euModeEnabled: false
    });

    useEffect(() => {
        const checkSetup = async () => {
            try {
                const healthRes = await authFetch(`${API_BASE}/api/health`);
                if (healthRes.ok) {
                    const healthData = await healthRes.json();
                    setIsDemoEnabled(healthData.demoEnabled !== false);
                }

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
                }

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

    // Detect and validate invite token
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('invite');
        if (!token) return;

        setInviteToken(token);
        // Clean up URL but keep invite context
        window.history.replaceState({}, '', window.location.pathname);

        const validateInvite = async () => {
            try {
                const res = await authFetch(`${API_BASE}/auth/invite/${token}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.valid) {
                        setInviteInfo(data);
                        // Auto-fill signup data
                        setSignupData(prev => ({
                            ...prev,
                            signupType: 'existing',
                            organizationId: data.organizationId,
                            email: data.email || prev.email,
                        }));
                        // Skip org selection, go straight to account step
                        setSignupStep(4);
                        setSignupMode(true);
                    } else {
                        setError('This invitation link has expired or is no longer valid.');
                        setInviteToken(null);
                    }
                } else {
                    setError('This invitation link has expired or is no longer valid.');
                    setInviteToken(null);
                }
            } catch (err) {
                console.error('Failed to validate invite:', err);
                setError('Failed to validate invitation. Please try again.');
                setInviteToken(null);
            }
        };
        validateInvite();
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

    const handleSignupNext = () => {
        setError('');
        if (signupStep === 1) {
            if (signupData.signupType === 'new' && !signupData.newOrgName) {
                setError('Organization name is required');
                return;
            }
            if (signupData.signupType === 'existing' && !signupData.organizationId) {
                setError('Please select an organization');
                return;
            }
            if (signupData.signupType === 'existing') {
                setSignupStep(4);
                return;
            }
            setSignupStep(2);
        } else if (signupStep === 2) {
            if (!signupData.authMethod) {
                setError('Please select a sign-in method');
                return;
            }
            setSignupStep(3);
        } else if (signupStep === 3) {
            setSignupStep(4);
        }
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

        setIsLoading(true);
        try {
            const body = {
                username: signupData.username,
                password: signupData.password,
                displayName: `${signupData.firstName} ${signupData.lastName}`.trim() || signupData.username,
                firstName: signupData.firstName,
                lastName: signupData.lastName,
                email: signupData.email,
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
                    privacyLevel: signupData.privacyLevel,
                    euModeEnabled: signupData.euModeEnabled
                };
            } else {
                body.organizationId = signupData.organizationId;
            }

            // Attach invite token if present
            if (inviteToken) {
                body.inviteToken = inviteToken;
            }

            const res = await authFetch(`${API_BASE}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (res.ok && data.success) {
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

    const handleDemoLogin = async () => {
        setError('');
        setIsLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/auth/demo-login`, { method: 'POST' });
            const data = await res.json();
            if (res.ok && data.success) {
                onDemoLogin(data.user);
            } else {
                setError(data.error || 'Demo login failed');
            }
        } catch (err) {
            setError('Connection error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // OAuth redirects must go directly to the backend server URL (not through
    // the frontend nginx proxy) so the session cookie is properly set.
    const oauthBase = serverUrl || API_BASE;

    const handleOAuthLogin = () => {
        window.location.href = `${oauthBase}/auth/login/nextcloud`;
    };

    const handleGoogleLogin = () => {
        window.location.href = `${oauthBase}/auth/login/google`;
    };

    const handleMicrosoftLogin = () => {
        window.location.href = `${oauthBase}/auth/login/microsoft`;
    };

    const resetSignup = () => {
        setSignupMode(false);
        setSignupStep(1);
        setError('');
        setSignupData({
            username: '', password: '', confirmPassword: '', firstName: '', lastName: '', email: '',
            signupType: 'new', organizationId: '',
            newOrgName: '', orgTagline: '', orgDescription: '', orgAddress: '', orgEmail: '', orgPhone: '', orgWebsite: '', orgKvk: '', orgVat: '', orgAllowSignup: true,
            authMethod: '', privacyLevel: 'off', euModeEnabled: false
        });
    };

    const inputClass = "w-full pl-10 pr-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition-all";
    const inputClassSimple = "w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition-all text-sm";
    const labelClass = "block text-sm font-medium text-[var(--text-secondary)] mb-1.5";

    // Determine step subtitle
    const getSubtitle = () => {
        if (setupMode) return t('login.create_admin_password');
        if (!signupMode) return t('login.sign_in_continue');
        if (signupStep === 1) return t('login.setup_org');
        if (signupStep === 2) return t('login.how_team_signin');
        if (signupStep === 3) return t('login.protect_org');
        return t('login.complete_account');
    };

    // Setup mode now only shows password creation (LoginForm handles this).
    // All AI/service configuration is handled by the Docker install wizard.

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

            <div className={`w-full ${signupMode ? 'max-w-xl' : 'max-w-md'} relative z-10 transition-all duration-300`}>
                <div className="backdrop-blur-xl rounded-3xl p-8 shadow-2xl border relative overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                    {/* Top highlight line for glass effect */}
                    <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-[var(--border-default)] to-transparent" />

                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-36 h-36 mx-auto mb-5 rounded-full overflow-hidden shadow-xl ring-4 ring-[var(--border-subtle)]">
                            <img src="/bee-flow-logo.svg" alt="Bee Flow" className="w-full h-full object-cover" />
                        </div>
                        {signupMode && (
                            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                                {inviteInfo ? t('login.accept_invitation') : t('login.create_account')}
                            </h1>
                        )}
                        <p className="text-sm text-[var(--text-secondary)] mt-1">
                            {inviteInfo ? `You've been invited to join ${inviteInfo.orgName}` : getSubtitle()}
                        </p>
                    </div>

                    {/* Step indicator */}
                    {signupMode && signupData.signupType === 'new' && (
                        <div className="flex justify-center gap-2 mb-6">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className={`w-8 h-1 rounded-full transition-all ${signupStep >= i ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-default)]'}`} />
                            ))}
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
                    {signupMode ? (
                        signupStep === 1 ? (
                            <SignupStepOrg
                                signupData={signupData} setSignupData={setSignupData}
                                signupOrgs={signupOrgs} handleSignupNext={handleSignupNext}
                                resetSignup={resetSignup}
                                inputClass={inputClass} inputClassSimple={inputClassSimple} labelClass={labelClass}
                            />
                        ) : signupStep === 2 ? (
                            <SignupStepAuth
                                signupData={signupData} setSignupData={setSignupData}
                                handleSignupNext={handleSignupNext}
                                setSignupStep={setSignupStep} setError={setError}
                            />
                        ) : signupStep === 3 ? (
                            <SignupStepPrivacy
                                signupData={signupData} setSignupData={setSignupData}
                                handleSignupNext={handleSignupNext}
                                setSignupStep={setSignupStep} setError={setError}
                            />
                        ) : (
                            <SignupStepAccount
                                signupData={signupData} setSignupData={setSignupData}
                                signupOrgs={signupOrgs} handleSignup={handleSignup}
                                isLoading={isLoading} setIsLoading={setIsLoading}
                                setSignupStep={setSignupStep} setError={setError}
                                inputClass={inputClass} inputClassSimple={inputClassSimple} labelClass={labelClass}
                            />
                        )
                    ) : (
                        <LoginForm
                            username={username} setUsername={setUsername}
                            password={password} setPassword={setPassword}
                            confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
                            setupMode={setupMode} isLoading={isLoading}
                            handleSubmit={handleSubmit}
                            handleDemoLogin={handleDemoLogin}
                            handleOAuthLogin={handleOAuthLogin}
                            handleGoogleLogin={handleGoogleLogin}
                            handleMicrosoftLogin={handleMicrosoftLogin}
                            isDemoEnabled={isDemoEnabled}
                            isOAuthConfigured={isOAuthConfigured}
                            isGoogleConfigured={isGoogleConfigured}
                            isMicrosoftConfigured={isMicrosoftConfigured}
                            setSignupMode={setSignupMode} setError={setError}
                            inputClass={inputClass} labelClass={labelClass}
                        />
                    )}
                </div>

                <p className="text-center text-xs text-[var(--text-tertiary)] mt-6">
                    {t('login.platform_name')}
                </p>
            </div>
        </div>
    );
};

export default LoginPage;

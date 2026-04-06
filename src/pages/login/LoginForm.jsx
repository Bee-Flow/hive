import React, { useState, useEffect } from 'react';
import { User, Lock, LogIn, Loader2, Zap, UserPlus, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name, value, days = 365) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`;
}

const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

const NextcloudIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.5 15v-4.5H7l5-7v4.5h3.5l-5 7z" />
    </svg>
);

const MicrosoftIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="9" height="9" fill="#F25022" />
        <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
        <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
        <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
);

const PasswordInput = ({ value, onChange, inputClass, placeholder = "••••••••", label = "Password", labelClass, setupMode, minLength, id = "password" }) => {
    const [showPassword, setShowPassword] = useState(false);
    return (
        <div>
            <label htmlFor={id} className={labelClass}>{label}</label>
            <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
                <input
                    id={id}
                    name={id}
                    type={showPassword ? "text" : "password"}
                    value={value}
                    onChange={onChange}
                    className={inputClass}
                    placeholder={placeholder}
                    aria-label={label}
                    data-testid={id}
                    required
                    minLength={minLength}
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                    aria-label={showPassword ? 'Toggle password visibility' : 'Toggle password visibility'}
                    tabIndex={-1}
                >
                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
            </div>
            {setupMode && <p className="text-xs text-[var(--text-tertiary)] mt-1.5 ml-1">{label === 'Password' ? '' : ''}{setupMode._t ? setupMode._t('login.password_requirements') : 'Must be at least 8 characters (uppercase, lowercase, and number)'}</p>}
        </div>
    );
};

const Divider = ({ label }) => (
    <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t-2 border-[var(--border-subtle)]" />
        </div>
        <div className="relative flex justify-center">
            <span className="px-4 bg-[var(--bg-secondary)] text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                {label}
            </span>
        </div>
    </div>
);

const LoginForm = ({
    username, setUsername, password, setPassword,
    confirmPassword, setConfirmPassword,
    setupMode, isLoading, handleSubmit,
    handleDemoLogin, handleOAuthLogin, handleGoogleLogin, handleMicrosoftLogin,
    isDemoEnabled, isOAuthConfigured, isGoogleConfigured, isMicrosoftConfigured,
    setSignupMode, setError,
    allowSignups = true, allowPasswordLogin = true,
    inputClass, labelClass
}) => {
    const { t } = useTranslation();
    const [preferredMethod, setPreferredMethod] = useState(null);
    const [showAllMethods, setShowAllMethods] = useState(false);

    useEffect(() => {
        const saved = getCookie('bf_preferred_login');
        if (saved) setPreferredMethod(saved);
    }, []);

    const handlePasswordLogin = (e) => {
        setCookie('bf_preferred_login', 'password');
        handleSubmit(e);
    };

    const handleOAuthWithCookie = () => {
        setCookie('bf_preferred_login', 'nextcloud');
        handleOAuthLogin();
    };

    const handleGoogleWithCookie = () => {
        setCookie('bf_preferred_login', 'google');
        handleGoogleLogin();
    };

    const handleMicrosoftWithCookie = () => {
        setCookie('bf_preferred_login', 'microsoft');
        handleMicrosoftLogin();
    };

    const isPreferredAvailable =
        (preferredMethod === 'google' && isGoogleConfigured) ||
        (preferredMethod === 'microsoft' && isMicrosoftConfigured) ||
        (preferredMethod === 'nextcloud' && isOAuthConfigured) ||
        (preferredMethod === 'password' && allowPasswordLogin);

    // Are there any other methods beyond the preferred one?
    const hasOtherMethods =
        (preferredMethod !== 'password' && allowPasswordLogin) ||
        (preferredMethod !== 'google' && isGoogleConfigured) ||
        (preferredMethod !== 'microsoft' && isMicrosoftConfigured) ||
        (preferredMethod !== 'nextcloud' && isOAuthConfigured) ||
        isDemoEnabled;

    const showDedicated = !setupMode && preferredMethod && isPreferredAvailable && !showAllMethods;

    // ── Dedicated view for a single preferred method ──
    if (showDedicated) {
        return (
            <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
                {preferredMethod === 'password' && allowPasswordLogin && (
                    <form onSubmit={handlePasswordLogin} className="space-y-5" aria-label="Login form">
                        <div>
                            <label htmlFor="username" className={labelClass}>{t('login.username')}</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
                                <input id="username" name="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} placeholder={t('login.enter_username')} aria-label={t('login.username')} data-testid="username" autoComplete="username" required />
                            </div>
                        </div>
                        <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} inputClass={inputClass} labelClass={labelClass} label={t('login.password')} placeholder={t('login.enter_password')} />
                        <button type="submit" disabled={isLoading}
                            aria-label={t('login.sign_in_btn')}
                            data-testid="login-submit-button"
                            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-base shadow-lg shadow-amber-500/20 mt-2">
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><LogIn className="w-5 h-5" /> {t('login.sign_in_btn')}</>}
                        </button>
                    </form>
                )}

                {preferredMethod === 'google' && (
                    <button onClick={handleGoogleWithCookie} disabled={isLoading}
                        className="w-full py-3.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl font-semibold transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-md text-base">
                        <GoogleIcon /> {t('login.sign_in_with_google')}
                    </button>
                )}

                {preferredMethod === 'nextcloud' && (
                    <button onClick={handleOAuthWithCookie} disabled={isLoading}
                        className="w-full py-3.5 bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-xl font-semibold transition-all flex items-center justify-center gap-3 disabled:opacity-50 text-base">
                        <NextcloudIcon /> {t('login.sign_in_with_nextcloud')}
                    </button>
                )}

                {preferredMethod === 'microsoft' && (
                    <button onClick={handleMicrosoftWithCookie} disabled={isLoading}
                        className="w-full py-3.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl font-semibold transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-md text-base">
                        <MicrosoftIcon /> {t('login.sign_in_with_microsoft')}
                    </button>
                )}

                {hasOtherMethods && (
                    <div className="pt-2">
                        <button
                            onClick={() => setShowAllMethods(true)}
                            className="w-full py-2.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex items-center justify-center gap-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]"
                        >
                            <ChevronDown className="w-4 h-4" />
                            {t('login.other_methods')}
                        </button>
                    </div>
                )}

                {allowSignups && setSignupMode && (
                    <button onClick={() => { setSignupMode(true); setError(''); }}
                        className="w-full py-2.5 bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-default)] rounded-xl font-medium transition-all flex items-center justify-center gap-2">
                        <UserPlus className="w-4.5 h-4.5" /> {t('login.create_account_btn')}
                    </button>
                )}
            </div>
        );
    }

    // ── Full login form (default or "show all methods") ──
    return (
        <div className={showAllMethods ? 'animate-[fadeIn_0.3s_ease-out]' : ''}>
            {(setupMode || allowPasswordLogin) && (
                <form onSubmit={handlePasswordLogin} className="space-y-5" aria-label="Login form">
                    {!setupMode && (
                        <div>
                            <label htmlFor="username" className={labelClass}>{t('login.username')}</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
                                <input id="username" name="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} placeholder={t('login.enter_username')} aria-label={t('login.username')} data-testid="username" autoComplete="username" required />
                            </div>
                        </div>
                    )}

                    <PasswordInput
                        id={setupMode ? 'root-password' : 'password'}
                        value={password} onChange={(e) => setPassword(e.target.value)}
                        inputClass={inputClass} labelClass={labelClass}
                        label={setupMode ? t('login.create_root_password') : t('login.password')}
                        placeholder={setupMode ? t('login.enter_strong_password') : t('login.enter_password')}
                        setupMode={setupMode ? { _t: t } : false}
                        minLength={setupMode ? 8 : 1}
                    />

                    {setupMode && (
                        <PasswordInput
                            id="confirm-password"
                            value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                            inputClass={inputClass} labelClass={labelClass}
                            label={t('login.confirm_password_label')}
                            placeholder={t('login.re_enter_password')}
                            minLength={8}
                        />
                    )}

                    <button type="submit" disabled={isLoading}
                        aria-label={setupMode ? t('login.initialize_system') : t('login.sign_in_btn')}
                        data-testid="login-submit-button"
                        className={`w-full py-3 ${setupMode
                            ? 'bg-green-600 hover:bg-green-700'
                            : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-500/20'
                            } text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-base mt-2`}>
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>
                            {setupMode ? <Zap className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
                            {setupMode ? t('login.initialize_system') : t('login.sign_in_btn')}
                        </>}
                    </button>
                </form>
            )}

            {!setupMode && (
                <>
                    {allowPasswordLogin && <Divider label={t('login.or_continue_with')} />}

                    <div className="space-y-3">
                        {isDemoEnabled && (
                            <button onClick={handleDemoLogin} disabled={isLoading}
                                data-testid="demo-login-button"
                                className="w-full py-2.5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                <Zap className="w-5 h-5" /> {t('login.demo_mode')}
                            </button>
                        )}

                        {isOAuthConfigured && (
                            <button onClick={handleOAuthWithCookie} disabled={isLoading}
                                data-testid="sso-nextcloud-button"
                                aria-label={t('login.sign_in_with_nextcloud')}
                                className="w-full py-2.5 bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-xl font-medium transition-all flex items-center justify-center gap-2.5 disabled:opacity-50">
                                <NextcloudIcon /> {t('login.sign_in_with_nextcloud')}
                            </button>
                        )}

                        {isGoogleConfigured && (
                            <button onClick={handleGoogleWithCookie} disabled={isLoading}
                                data-testid="sso-google-button"
                                aria-label={t('login.sign_in_with_google')}
                                className="w-full py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl font-medium transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 shadow-sm">
                                <GoogleIcon /> {t('login.sign_in_with_google')}
                            </button>
                        )}

                        {isMicrosoftConfigured && (
                            <button onClick={handleMicrosoftWithCookie} disabled={isLoading}
                                data-testid="sso-microsoft-button"
                                aria-label={t('login.sign_in_with_microsoft')}
                                className="w-full py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl font-medium transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 shadow-sm">
                                <MicrosoftIcon /> {t('login.sign_in_with_microsoft')}
                            </button>
                        )}

                        {allowSignups && setSignupMode && (
                            <button onClick={() => { setSignupMode(true); setError(''); }}
                                data-testid="create-account-button"
                                className="w-full py-2.5 bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-default)] rounded-xl font-medium transition-all flex items-center justify-center gap-2">
                                <UserPlus className="w-4.5 h-4.5" /> {t('login.create_account_btn')}
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default LoginForm;

import React, { useState, useMemo } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';

import StepPassword from './StepPassword';
import StepDeploymentType from './StepDeploymentType';
import StepAzureSetup from './StepAzureSetup';
import StepAiProvider from './StepAiProvider';
import StepSearch from './StepSearch';
import StepTiers from './StepTiers';
import StepSso from './StepSso';
import { TIERS } from './StepTiers';

const INPUT_CLASS = "w-full px-4 py-3 rounded-xl border-2 outline-none text-sm transition-all focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-gray-400";
const INPUT_STYLE = { background: '#fff', borderColor: '#d1d5db', color: '#1f2937', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)' };

const makeTierState = () => ({
    fast: { modelId: '', label: 'Fast' },
    thinking: { modelId: '', label: 'Thinking' },
    writer: { modelId: '', label: 'Writer' },
    pro: { modelId: '', label: 'Deep Thinking' },
});

const InitSetupWizard = ({ onComplete }) => {
    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [recoveryKey, setRecoveryKey] = useState(null);

    // Deployment type
    const [deploymentType, setDeploymentType] = useState('');

    // Step: Admin
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Step: AI Provider (standard path)
    const [aiProvider, setAiProvider] = useState('');
    const [genericKey, setGenericKey] = useState('');

    // Step: Azure config (shared between paths)
    const [azureEndpoint, setAzureEndpoint] = useState('');
    const [azureKey, setAzureKey] = useState('');
    const [azureVersion, setAzureVersion] = useState('2025-04-01-preview');
    const [azureModels, setAzureModels] = useState('');

    // Step: Search
    const [searchProvider, setSearchProvider] = useState('');
    const [bingKey, setBingKey] = useState('');
    const [bingMarket, setBingMarket] = useState('');
    const [serperKey, setSerperKey] = useState('');

    // Step: Tiers
    const [tierConfig, setTierConfig] = useState(makeTierState());
    const [euTierConfig, setEuTierConfig] = useState(makeTierState());

    // Step: SSO
    const [msClientId, setMsClientId] = useState('');
    const [msClientSecret, setMsClientSecret] = useState('');
    const [msTenantId, setMsTenantId] = useState('');

    const isAzure = deploymentType === 'azure';
    const clearMessages = () => setError('');

    const modelOptions = isAzure && azureModels.trim()
        ? azureModels.split(',').map(m => m.trim()).filter(Boolean)
        : [];

    const updateTier = (key, value) => setTierConfig(prev => ({ ...prev, [key]: { ...prev[key], modelId: value } }));
    const updateEuTier = (key, value) => setEuTierConfig(prev => ({ ...prev, [key]: { ...prev[key], modelId: value } }));

    // ─── Dynamic Steps ────────────────────────────────────────

    const steps = useMemo(() => {
        const base = [
            { key: 'password', label: 'Admin Account', icon: '🔐' },
            { key: 'type', label: 'Setup Type', icon: '⚙️' },
        ];
        if (deploymentType === 'azure') {
            return [
                ...base,
                { key: 'azure', label: 'Azure Services', icon: '☁️' },
                { key: 'tiers', label: 'Model Tiers', icon: '⚡' },
            ];
        } else if (deploymentType === 'standard') {
            return [
                ...base,
                { key: 'ai', label: 'AI Provider', icon: '🤖' },
                { key: 'search', label: 'Web Search', icon: '🔍' },
                { key: 'tiers', label: 'Model Tiers', icon: '⚡' },
                { key: 'sso', label: 'Microsoft SSO', icon: '🔷' },
            ];
        }
        return base;
    }, [deploymentType]);

    const currentStepKey = steps[step]?.key;
    const isLastStep = step === steps.length - 1;

    // ─── Step Handlers (local only — no API calls until finish) ─

    const validatePassword = () => {
        clearMessages();
        if (!password || password.length < 8) { setError('Password must be at least 8 characters'); return; }
        if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
            setError('Must contain uppercase, lowercase, and a number'); return;
        }
        if (password !== confirmPassword) { setError('Passwords do not match'); return; }
        setStep(1);
    };

    const handleDeployType = () => {
        clearMessages();
        if (!deploymentType) { setError('Please select a setup type'); return; }
        setStep(2);
    };

    const advanceStep = () => { clearMessages(); setStep(step + 1); };

    // ─── Final Save — creates account + saves everything ──────

    const finishSetup = async () => {
        clearMessages();
        setSaving(true);
        try {
            // 1. Create admin account
            const setupRes = await authFetch(`${API_BASE}/auth/setup`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });
            const setupData = await setupRes.json();
            if (!setupRes.ok || !setupData.success) throw new Error(setupData.error || 'Account creation failed');

            // Store recovery key if returned (will show modal)
            if (setupData.recoveryKey) setRecoveryKey(setupData.recoveryKey);

            // 2. Login to get auth session
            await authFetch(`${API_BASE}/auth/admin-login`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'admin', password }),
            });

            // 3. Save AI / Search config
            const aiBody = {};
            if (isAzure) {
                if (azureEndpoint.trim()) aiBody.azureEndpoint = azureEndpoint;
                if (azureKey.trim()) aiBody.azureApiKey = azureKey;
                aiBody.azureApiVersion = azureVersion;
                aiBody.azureModels = azureModels.trim();
                if (bingKey.trim()) {
                    aiBody.searchProvider = 'bing';
                    aiBody.bingSearchKey = bingKey;
                    if (bingMarket.trim()) aiBody.bingSearchMarket = bingMarket;
                }
            } else {
                if (aiProvider && genericKey.trim()) aiBody[`${aiProvider}ApiKey`] = genericKey;
                if (searchProvider === 'bing') {
                    aiBody.searchProvider = 'bing';
                    if (bingKey.trim()) aiBody.bingSearchKey = bingKey;
                    if (bingMarket.trim()) aiBody.bingSearchMarket = bingMarket;
                } else if (searchProvider === 'agent-search') {
                    aiBody.searchProvider = 'agent-search';
                    if (serperKey.trim()) aiBody.serperApiKey = serperKey;
                }
            }
            if (Object.keys(aiBody).length > 0) {
                const r = await authFetch(`${API_BASE}/ai/config`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(aiBody),
                });
                if (!r.ok) throw new Error('Failed to save AI configuration');
            }

            // 4. Save model tiers
            const hasAny = TIERS.some(t => tierConfig[t.key]?.modelId);
            if (hasAny) {
                const r = await authFetch(`${API_BASE}/ai/config/chat-models`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tierConfig),
                });
                if (!r.ok) throw new Error('Failed to save model tiers');
            }
            if (!isAzure) {
                const hasEu = TIERS.some(t => euTierConfig[t.key]?.modelId);
                if (hasEu) {
                    const r = await authFetch(`${API_BASE}/ai/config/chat-models-eu`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(euTierConfig),
                    });
                    if (!r.ok) throw new Error('Failed to save EU tiers');
                }
            }

            // 5. Save SSO config
            if (msClientId.trim() || msClientSecret.trim()) {
                const ssoBody = {};
                if (msClientId.trim()) ssoBody.clientId = msClientId;
                if (msClientSecret.trim()) ssoBody.clientSecret = msClientSecret;
                if (msTenantId.trim()) ssoBody.tenantId = msTenantId;
                const r = await authFetch(`${API_BASE}/auth/providers/microsoft`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ssoBody),
                });
                if (!r.ok) {
                    const d = await r.json().catch(() => ({}));
                    throw new Error(d.error || 'Failed to save SSO config');
                }
            }

            // Done — if no recovery key, go straight to login
            if (!setupData.recoveryKey) onComplete();
        } catch (e) {
            setError(e.message || 'Setup failed');
        }
        setSaving(false);
    };

    const HANDLER_MAP = {
        password: validatePassword,
        type: handleDeployType,
        azure: advanceStep,
        ai: advanceStep,
        search: advanceStep,
        tiers: finishSetup,  // last step in azure path
        sso: finishSetup,    // last step in standard path
    };

    const handleNext = () => HANDLER_MAP[currentStepKey]?.();
    const handleSkip = () => {
        clearMessages();
        if (isLastStep) finishSetup();
        else setStep(step + 1);
    };

    const getNextLabel = () => {
        if (currentStepKey === 'password') return 'Continue';
        if (currentStepKey === 'type') return 'Continue';
        if (isLastStep) return 'Finish Setup';
        return 'Next';
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative"
            style={{ background: 'linear-gradient(160deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, var(--bg-tertiary) 100%)' }}>

            {/* Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute w-[500px] h-[500px] rounded-full opacity-[0.07]"
                    style={{ background: 'radial-gradient(circle, var(--accent-primary), transparent 70%)', top: '-5%', left: '-10%', animation: 'pulse 4s ease-in-out infinite' }} />
                <div className="absolute w-80 h-80 rounded-full opacity-[0.05]"
                    style={{ background: 'radial-gradient(circle, var(--accent-secondary), transparent 70%)', bottom: '5%', right: '-5%', animation: 'pulse 5s ease-in-out infinite 1.5s' }} />
            </div>

            {/* Recovery Key Modal */}
            {recoveryKey && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md p-6 rounded-2xl shadow-2xl space-y-5" style={{ background: 'var(--bg-secondary)' }}>
                        <div className="text-center">
                            <div className="text-3xl mb-2">🔐</div>
                            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Save Your Recovery Key</h3>
                            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Store this securely — it's your only recovery option.</p>
                        </div>
                        <div className="p-4 rounded-xl font-mono text-sm text-center break-all select-all cursor-text"
                            style={{ background: 'var(--bg-primary)', border: '2px dashed var(--border-default)', color: 'var(--text-primary)' }}>
                            {recoveryKey}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => navigator.clipboard.writeText(recoveryKey)}
                                className="flex-1 py-2.5 rounded-xl font-medium text-sm border transition-colors"
                                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>📋 Copy</button>
                            <button onClick={() => { setRecoveryKey(null); onComplete(); }}
                                className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white"
                                style={{ background: 'var(--accent-primary)' }}>I've Saved It</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="w-full max-w-xl relative z-10">
                <div className="backdrop-blur-xl rounded-3xl p-8 shadow-2xl border relative overflow-hidden"
                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>

                    <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-[var(--border-default)] to-transparent" />

                    {/* Header */}
                    <div className="text-center mb-6">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full overflow-hidden shadow-xl ring-4 ring-[var(--border-subtle)]">
                            <img src="/bee-flow-logo.svg" alt="Bee Flow" className="w-full h-full object-cover" />
                        </div>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                            {step === 0 ? 'Welcome to Bee Flow' : step === 1 ? 'Choose Your Setup' : 'Setup Wizard'}
                        </h1>
                        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                            {step === 0
                                ? 'Create your admin password to get started'
                                : step === 1
                                    ? 'Select your deployment infrastructure'
                                    : `Step ${step + 1} of ${steps.length} — ${steps[step]?.label}`}
                        </p>
                    </div>

                    {/* Step indicator */}
                    {steps.length > 2 && (
                        <div className="flex justify-center gap-2 mb-6">
                            {steps.map((s, i) => (
                                <div key={s.key} className="flex items-center gap-1.5">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${i === step ? 'ring-2 ring-offset-2' : ''}`}
                                        style={{
                                            background: i <= step ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                            color: i <= step ? '#fff' : 'var(--text-muted)',
                                            '--tw-ring-offset-color': 'var(--bg-secondary)',
                                        }}>
                                        {i < step ? '✓' : s.icon}
                                    </div>
                                    {i < steps.length - 1 && (
                                        <div className="w-6 h-0.5 rounded-full" style={{ background: i < step ? 'var(--accent-primary)' : 'var(--border-default)' }} />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="mb-4 p-3 rounded-xl text-sm flex items-center gap-2"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Step Content */}
                    <div className="space-y-4">
                        {currentStepKey === 'password' && (
                            <StepPassword password={password} setPassword={setPassword}
                                confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
                                inputClass={INPUT_CLASS} inputStyle={INPUT_STYLE} onNext={handleNext} />
                        )}
                        {currentStepKey === 'type' && (
                            <StepDeploymentType deploymentType={deploymentType} setDeploymentType={setDeploymentType} />
                        )}
                        {currentStepKey === 'azure' && (
                            <StepAzureSetup
                                azureEndpoint={azureEndpoint} setAzureEndpoint={setAzureEndpoint}
                                azureKey={azureKey} setAzureKey={setAzureKey}
                                azureVersion={azureVersion} setAzureVersion={setAzureVersion}
                                azureModels={azureModels} setAzureModels={setAzureModels}
                                bingKey={bingKey} setBingKey={setBingKey}
                                bingMarket={bingMarket} setBingMarket={setBingMarket}
                                msClientId={msClientId} setMsClientId={setMsClientId}
                                msClientSecret={msClientSecret} setMsClientSecret={setMsClientSecret}
                                msTenantId={msTenantId} setMsTenantId={setMsTenantId}
                                inputClass={INPUT_CLASS} inputStyle={INPUT_STYLE}
                            />
                        )}
                        {currentStepKey === 'ai' && (
                            <StepAiProvider aiProvider={aiProvider} setAiProvider={setAiProvider}
                                azureEndpoint={azureEndpoint} setAzureEndpoint={setAzureEndpoint}
                                azureKey={azureKey} setAzureKey={setAzureKey}
                                azureVersion={azureVersion} setAzureVersion={setAzureVersion}
                                azureModels={azureModels} setAzureModels={setAzureModels}
                                genericKey={genericKey} setGenericKey={setGenericKey}
                                clearMessages={clearMessages} inputClass={INPUT_CLASS} inputStyle={INPUT_STYLE} />
                        )}
                        {currentStepKey === 'search' && (
                            <StepSearch searchProvider={searchProvider} setSearchProvider={setSearchProvider}
                                bingKey={bingKey} setBingKey={setBingKey}
                                bingMarket={bingMarket} setBingMarket={setBingMarket}
                                serperKey={serperKey} setSerperKey={setSerperKey}
                                clearMessages={clearMessages} inputClass={INPUT_CLASS} inputStyle={INPUT_STYLE} />
                        )}
                        {currentStepKey === 'tiers' && (
                            <StepTiers tierConfig={tierConfig} updateTier={updateTier}
                                euTierConfig={euTierConfig} updateEuTier={updateEuTier}
                                isAzure={isAzure} modelOptions={modelOptions} inputStyle={INPUT_STYLE} />
                        )}
                        {currentStepKey === 'sso' && (
                            <StepSso isAzure={isAzure}
                                msClientId={msClientId} setMsClientId={setMsClientId}
                                msClientSecret={msClientSecret} setMsClientSecret={setMsClientSecret}
                                msTenantId={msTenantId} setMsTenantId={setMsTenantId}
                                inputClass={INPUT_CLASS} inputStyle={INPUT_STYLE} />
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between mt-6 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                        <div>
                            {step > 0 && (
                                <button onClick={() => { setStep(step - 1); clearMessages(); }}
                                    className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                                    style={{ color: 'var(--text-muted)' }}>← Back</button>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            {step > 1 && currentStepKey !== 'type' && (
                                <button onClick={handleSkip}
                                    className="px-4 py-2.5 rounded-xl text-sm font-medium border transition-all hover:opacity-80"
                                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                                    {isLastStep ? 'Skip & Finish' : 'Skip'}
                                </button>
                            )}
                            <button onClick={handleNext} disabled={saving}
                                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                                style={{ background: 'var(--accent-primary)' }}>
                                {saving ? '...' : getNextLabel()}
                            </button>
                        </div>
                    </div>
                </div>

                <p className="text-center text-xs mt-6" style={{ color: 'var(--text-tertiary)' }}>
                    Bee Flow AI Agent Platform — Initial Setup
                </p>
            </div>
        </div>
    );
};

export default InitSetupWizard;

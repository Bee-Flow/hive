import React, { useState } from 'react';
import { Shield, Key, Copy, Check, Eye, EyeOff, AlertTriangle, Lock, ArrowLeft } from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';
import { opaquePinRegister, opaquePinLogin } from '../lib/opaque';

/**
 * EncryptionSetup — Intercepts SSO login when encryption PIN is needed.
 * 
 * Four modes:
 * 1. mode='setup': First-time SSO user — choose a PIN, get recovery key
 * 2. mode='unlock': Returning SSO user — enter existing PIN to unlock
 * 3. mode='recovery': Show a recovery key (from login migration or signup)
 * 4. Internal 'recover' state: Forgot PIN — enter recovery key + new PIN
 */
const EncryptionSetup = ({ mode, onComplete, recoveryKeyProp }) => {
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [showPin, setShowPin] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [recoveryKey, setRecoveryKey] = useState(recoveryKeyProp || null);
    const [copied, setCopied] = useState(false);
    const [showRecovery, setShowRecovery] = useState(false);
    const [recoveryInput, setRecoveryInput] = useState('');
    const [newPin, setNewPin] = useState('');
    const [confirmNewPin, setConfirmNewPin] = useState('');

    const isSetup = mode === 'setup';

    const handleSetup = async () => {
        setError('');
        if (pin.length < 6) {
            setError('PIN must be at least 6 characters');
            return;
        }
        if (pin !== confirmPin) {
            setError('PINs do not match');
            return;
        }

        setIsLoading(true);
        try {
            // Try OPAQUE PIN registration first (PIN never sent to server)
            const result = await opaquePinRegister(pin);
            if (result.success && result.recoveryKey) {
                setRecoveryKey(result.recoveryKey);
                return;
            }
        } catch (opaqueErr) {
            console.warn('[Encryption] OPAQUE PIN setup failed, falling back to legacy:', opaqueErr.message);
        }

        // Legacy fallback — PIN sent to server (for users without OPAQUE support)
        try {
            const res = await authFetch(`${API_BASE}/auth/sso-encryption-setup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setRecoveryKey(data.recoveryKey);
            } else {
                setError(data.error || 'Setup failed');
            }
        } catch {
            setError('Connection error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUnlock = async () => {
        setError('');
        if (!pin) {
            setError('Please enter your encryption PIN');
            return;
        }

        setIsLoading(true);
        try {
            // Try OPAQUE PIN login first (PIN never sent to server)
            const result = await opaquePinLogin(pin);
            if (result.needsSetup) {
                window.location.reload();
                return;
            }
            if (result.success) {
                onComplete();
                return;
            }
        } catch (opaqueErr) {
            console.warn('[Encryption] OPAQUE PIN unlock failed, falling back to legacy:', opaqueErr.message);
        }

        // Legacy fallback
        try {
            const res = await authFetch(`${API_BASE}/auth/sso-encryption-unlock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                onComplete();
            } else if (data.needsSetup) {
                window.location.reload();
            } else {
                setError(data.error || 'Incorrect PIN');
            }
        } catch {
            setError('Connection error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRecover = async () => {
        setError('');
        if (!recoveryInput.trim()) {
            setError('Please enter your recovery key');
            return;
        }
        if (newPin.length < 6) {
            setError('New PIN must be at least 6 characters');
            return;
        }
        if (newPin !== confirmNewPin) {
            setError('PINs do not match');
            return;
        }

        setIsLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/auth/sso-recovery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recoveryKey: recoveryInput.trim(), newPin })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setRecoveryKey(data.recoveryKey);
                setShowRecovery(false);
            } else {
                setError(data.error || 'Recovery failed');
            }
        } catch {
            setError('Connection error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(recoveryKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Recovery key confirmation screen
    if (recoveryKey) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4"
                style={{ background: 'linear-gradient(160deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, var(--bg-tertiary) 100%)' }}>
                <div className="w-full max-w-lg relative z-10">
                    <div className="backdrop-blur-xl rounded-3xl p-8 shadow-2xl border relative overflow-hidden"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-[var(--border-default)] to-transparent" />

                        <div className="text-center mb-6">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                                <Key className="w-8 h-8 text-white" />
                            </div>
                            <h1 className="text-xl font-bold text-[var(--text-primary)]">Save Your Recovery Key</h1>
                            <p className="text-sm text-[var(--text-secondary)] mt-2">
                                This is the <strong>only way</strong> to recover your encrypted data if you forget your PIN.
                                Save it somewhere safe — it won't be shown again.
                            </p>
                        </div>

                        {/* Warning */}
                        <div className="mb-5 p-3 rounded-lg flex items-start gap-3 text-sm"
                            style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#f59e0b' }}>
                            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                            <span>If you lose this key and forget your PIN, your encrypted data will be <strong>permanently inaccessible</strong>.</span>
                        </div>

                        {/* Recovery key display */}
                        <div className="mb-6">
                            <div className="p-4 rounded-xl font-mono text-sm text-center tracking-wider break-all select-all"
                                style={{ background: 'var(--bg-primary)', border: '2px dashed var(--border-default)', color: 'var(--text-primary)' }}>
                                {recoveryKey}
                            </div>
                            <button onClick={handleCopy}
                                className="mt-3 w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all"
                                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                                {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy to clipboard</>}
                            </button>
                        </div>

                        <button onClick={onComplete}
                            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                            style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                            I've saved my recovery key — Continue
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Recovery flow — forgot PIN
    if (showRecovery) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4"
                style={{ background: 'linear-gradient(160deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, var(--bg-tertiary) 100%)' }}>
                <div className="w-full max-w-md relative z-10">
                    <div className="backdrop-blur-xl rounded-3xl p-8 shadow-2xl border relative overflow-hidden"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-[var(--border-default)] to-transparent" />

                        {/* Header */}
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                                <Key className="w-8 h-8 text-white" />
                            </div>
                            <h1 className="text-xl font-bold text-[var(--text-primary)]">Recover Your Account</h1>
                            <p className="text-sm text-[var(--text-secondary)] mt-2">
                                Enter your recovery key and choose a new PIN to regain access to your encrypted data.
                            </p>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-500 text-sm">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            {/* Recovery key input */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                                    Recovery Key
                                </label>
                                <textarea
                                    value={recoveryInput}
                                    onChange={(e) => setRecoveryInput(e.target.value)}
                                    placeholder="Paste your recovery key here"
                                    rows={3}
                                    className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition-all text-sm font-mono"
                                />
                            </div>

                            {/* New PIN input */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                                    New PIN
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPin ? 'text' : 'password'}
                                        value={newPin}
                                        onChange={(e) => setNewPin(e.target.value)}
                                        placeholder="Minimum 6 characters"
                                        className="w-full px-4 py-3 pr-10 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition-all text-sm"
                                    />
                                    <button type="button" onClick={() => setShowPin(!showPin)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
                                        {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Confirm new PIN */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                                    Confirm New PIN
                                </label>
                                <input
                                    type={showPin ? 'text' : 'password'}
                                    value={confirmNewPin}
                                    onChange={(e) => setConfirmNewPin(e.target.value)}
                                    placeholder="Confirm your new PIN"
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleRecover(); }}
                                    className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition-all text-sm"
                                />
                            </div>

                            <button
                                onClick={handleRecover}
                                disabled={isLoading}
                                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                                {isLoading ? 'Recovering...' : 'Recover & Set New PIN'}
                            </button>

                            <button
                                onClick={() => { setShowRecovery(false); setError(''); setRecoveryInput(''); setNewPin(''); setConfirmNewPin(''); }}
                                className="w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all"
                                style={{ color: 'var(--text-secondary)' }}>
                                <ArrowLeft className="w-4 h-4" />
                                Back to PIN entry
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4"
            style={{ background: 'linear-gradient(160deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, var(--bg-tertiary) 100%)' }}>
            <div className="w-full max-w-md relative z-10">
                <div className="backdrop-blur-xl rounded-3xl p-8 shadow-2xl border relative overflow-hidden"
                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                    <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-[var(--border-default)] to-transparent" />

                    {/* Header */}
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' }}>
                            {isSetup ? <Shield className="w-8 h-8 text-white" /> : <Lock className="w-8 h-8 text-white" />}
                        </div>
                        <h1 className="text-xl font-bold text-[var(--text-primary)]">
                            {isSetup ? 'Set Up Data Encryption' : 'Unlock Your Data'}
                        </h1>
                        <p className="text-sm text-[var(--text-secondary)] mt-2">
                            {isSetup
                                ? 'Choose an encryption PIN to protect your data. This is separate from your SSO login.'
                                : 'Enter your encryption PIN to access your encrypted data.'}
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-500 text-sm">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* PIN input */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                                {isSetup ? 'Choose Encryption PIN' : 'Encryption PIN'}
                            </label>
                            <div className="relative">
                                <input
                                    type={showPin ? 'text' : 'password'}
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value)}
                                    placeholder={isSetup ? 'Minimum 6 characters' : 'Enter your PIN'}
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !isSetup) handleUnlock();
                                    }}
                                    className="w-full px-4 py-3 pr-10 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition-all text-sm"
                                />
                                <button type="button" onClick={() => setShowPin(!showPin)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
                                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {isSetup && (
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                                    Confirm PIN
                                </label>
                                <input
                                    type={showPin ? 'text' : 'password'}
                                    value={confirmPin}
                                    onChange={(e) => setConfirmPin(e.target.value)}
                                    placeholder="Confirm your PIN"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSetup();
                                    }}
                                    className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition-all text-sm"
                                />
                            </div>
                        )}

                        <button
                            onClick={isSetup ? handleSetup : handleUnlock}
                            disabled={isLoading}
                            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' }}>
                            {isLoading ? 'Processing...' : isSetup ? 'Set Up Encryption' : 'Unlock'}
                        </button>

                        {/* Forgot PIN — only show on unlock screen */}
                        {!isSetup && (
                            <button
                                onClick={() => { setShowRecovery(true); setError(''); }}
                                className="w-full py-2 text-sm font-medium transition-all hover:opacity-80"
                                style={{ color: 'var(--accent-primary)' }}>
                                Forgot your PIN? Use recovery key
                            </button>
                        )}
                    </div>

                    {/* Info footer */}
                    {isSetup && (
                        <p className="text-xs text-[var(--text-tertiary)] text-center mt-5 leading-relaxed">
                            Your PIN encrypts your data locally. The server cannot read your encrypted data without it.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EncryptionSetup;

import React from 'react';
import { AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react';

const SignupStepAuth = ({ signupData, setSignupData, handleSignupNext, setSignupStep, setError }) => {
    const methods = [{
        id: 'password',
        name: 'Username & Password',
        description: 'Users sign in with a username and password.',
        icon: (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
        ),
        color: '#6366f1',
    }, {
        id: 'google',
        name: 'Sign in with Google',
        description: 'Users sign in using their Google account.',
        icon: (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
        ),
        color: '#4285F4',
    }, {
        id: 'microsoft',
        name: 'Sign in with Microsoft',
        description: 'Users sign in using their Microsoft account.',
        icon: (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
                <rect x="1" y="1" width="10" height="10" fill="#F25022" />
                <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
                <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
                <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
            </svg>
        ),
        color: '#00A4EF',
    }];

    return (
        <div className="space-y-4">
            {methods.map(method => {
                const isSelected = signupData.authMethod === method.id;
                return (
                    <button key={method.id} type="button"
                        onClick={() => setSignupData(p => ({ ...p, authMethod: method.id }))}
                        className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${isSelected ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5' : 'border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40 hover:bg-[var(--bg-primary)]'
                            }`}
                    >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: isSelected ? `${method.color}15` : 'var(--bg-tertiary)' }}>
                            <div style={{ color: method.color }}>{method.icon}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="text-sm font-semibold text-[var(--text-primary)]">{method.name}</span>
                            <p className="text-xs text-[var(--text-muted)] mt-0.5">{method.description}</p>
                        </div>
                        <div className="shrink-0">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-[var(--accent-primary)]' : 'border-[var(--border-subtle)]'}`}>
                                {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent-primary)]" />}
                            </div>
                        </div>
                    </button>
                );
            })}

            <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-xs text-amber-600">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span><strong>Choose carefully:</strong> Once saved, this cannot be changed. Each user's data is protected with a unique key that is tied to how they sign in.</span>
            </div>

            <button type="button" onClick={handleSignupNext}
                className="w-full py-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-base shadow-lg mt-2">
                Continue <ArrowRight className="w-5 h-5" />
            </button>
            <button type="button" onClick={() => { setSignupStep(1); setError(''); }}
                className="w-full py-2.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm">
                <ArrowLeft className="w-4 h-4" /> Back
            </button>
        </div>
    );
};

export default SignupStepAuth;

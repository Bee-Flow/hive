import React from 'react';
import { ShieldCheck, ShieldAlert, ShieldOff, Globe, ArrowLeft, ArrowRight } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

const SignupStepPrivacy = ({ signupData, setSignupData, handleSignupNext, setSignupStep, setError }) => {
    const { t } = useTranslation();

    const levels = [{
        id: 'off', name: t('signup.privacy_off'), icon: ShieldOff, color: '#64748b',
        description: t('signup.privacy_off_desc')
    }, {
        id: 'basic', name: t('signup.privacy_basic'), icon: ShieldCheck, color: '#10b981',
        description: t('signup.privacy_basic_desc')
    }, {
        id: 'strict', name: t('signup.privacy_strict'), icon: ShieldAlert, color: '#ef4444',
        description: t('signup.privacy_strict_desc')
    }];

    return (
        <div className="space-y-4">
            {levels.map(level => {
                const isSelected = signupData.privacyLevel === level.id;
                const Icon = level.icon;
                return (
                    <button key={level.id} type="button"
                        onClick={() => setSignupData(p => ({ ...p, privacyLevel: level.id }))}
                        className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${isSelected ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5' : 'border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40 hover:bg-[var(--bg-primary)]'
                            }`}
                    >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${level.color}15` }}>
                            <Icon className="w-5 h-5" style={{ color: level.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="text-sm font-semibold text-[var(--text-primary)]">{level.name}</span>
                            <p className="text-xs text-[var(--text-muted)] mt-0.5">{level.description}</p>
                        </div>
                        <div className="shrink-0">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-[var(--accent-primary)]' : 'border-[var(--border-subtle)]'}`}>
                                {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent-primary)]" />}
                            </div>
                        </div>
                    </button>
                );
            })}

            {signupData.privacyLevel !== 'off' && (
                <div className="flex items-center justify-between p-3.5 rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-primary)]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/10">
                            <Globe className="w-4 h-4 text-blue-500" />
                        </div>
                        <div>
                            <span className="text-sm font-medium text-[var(--text-primary)]">{t('signup.eu_only_models')}</span>
                            <p className="text-xs text-[var(--text-muted)]">{t('signup.eu_only_models_desc')}</p>
                        </div>
                    </div>
                    <button type="button" onClick={() => setSignupData(p => ({ ...p, euModeEnabled: !p.euModeEnabled }))}
                        className={`relative w-11 h-6 rounded-full transition-colors ${signupData.euModeEnabled ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-default)]'}`}>
                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${signupData.euModeEnabled ? 'translate-x-5' : ''}`} />
                    </button>
                </div>
            )}

            <p className="text-xs text-[var(--text-muted)] text-center mt-1">{t('signup.privacy_tune_later')}</p>

            <button type="button" onClick={handleSignupNext}
                className="w-full py-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-base shadow-lg mt-2">
                {t('signup.continue')} <ArrowRight className="w-5 h-5" />
            </button>
            <button type="button" onClick={() => { setSignupStep(2); setError(''); }}
                className="w-full py-2.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm">
                <ArrowLeft className="w-4 h-4" /> {t('signup.back')}
            </button>
        </div>
    );
};

export default SignupStepPrivacy;

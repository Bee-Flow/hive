import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { useTranslation } from '../../hooks/useTranslation';
import { pickBetaIcon } from '../../utils/betaFeatureIcon';
import { useLicenseContext } from '../../components/LicenseContext';
import UpgradePrompt from '../../components/billing/UpgradePrompt';

/**
 * Consumer Beta features section.
 * Read-only listing of beta features the user has access to. Consumer
 * accounts have no organisation, so the allow-list comes from a
 * deployment-wide config (`default_consumer_beta_features`) configured
 * by super admins.
 */
const ConsumerBetaFeaturesSection = () => {
    const { t } = useTranslation();
    const { hasTier, upgradeUrl, deploymentMode, loading: licenseLoading } = useLicenseContext();
    const [loading, setLoading] = useState(true);
    const [allowed, setAllowed] = useState([]);
    const [registry, setRegistry] = useState([]);

    useEffect(() => {
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/auth/me/consumer-features`);
                if (res.ok) {
                    const data = await res.json();
                    setAllowed(Array.isArray(data.allowedBetaFeatures) ? data.allowedBetaFeatures : []);
                    setRegistry(Array.isArray(data.betaRegistry) ? data.betaRegistry : []);
                }
            } catch (e) {
                console.error('[ConsumerBeta] load error:', e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    if (loading || licenseLoading) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="h-6 w-48 bg-[var(--bg-tertiary)] rounded-lg" />
                <div className="h-32 bg-[var(--bg-tertiary)] rounded-2xl" />
            </div>
        );
    }

    // Beta features require Enterprise — match the server-side short-circuit
    // in core/betaFeatures.js so we don't render toggles that would 403.
    if (!hasTier('enterprise')) {
        return (
            <div className="space-y-5 animate-fadeIn">
                <div>
                    <h2 className="text-lg font-bold text-[var(--text-primary)]">
                        {t('settings.beta_features', 'Beta features')}
                    </h2>
                    <p className="text-sm text-[var(--text-muted)] mt-1">
                        {t('settings.beta_features_intro', 'Experimental features available on your account')}
                    </p>
                </div>
                {/* Shared paywall. A consumer on cloud can upgrade in two
                    clicks, so the CTA goes to /app/billing rather than sending
                    them out to the public pricing site to start over. */}
                <div className="rounded-2xl border p-2" style={{ borderColor: 'var(--border-subtle)' }}>
                    <UpgradePrompt
                        requiredTier="enterprise"
                        feature="beta_features"
                        deploymentMode={deploymentMode}
                        upgradeUrl={upgradeUrl}
                        title={t('settings.beta_requires_enterprise', 'Beta features require Enterprise')}
                        description={t('settings.beta_upgrade_blurb', 'Beta capabilities — voice chat, webpages, automations, meeting notes — ship with the Enterprise tier.')}
                    />
                </div>
            </div>
        );
    }

    const allowedFeatures = registry.filter(f => allowed.includes(f.id));

    return (
        <div className="space-y-5 animate-fadeIn">
            <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                    {t('settings.beta_features', 'Beta features')}
                </h2>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                    Experimental features available on your account
                </p>
            </div>

            {allowedFeatures.length === 0 ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 text-center">
                    <Sparkles className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-sm font-medium text-[var(--text-primary)] mb-1">No beta features yet</p>
                    <p className="text-xs text-[var(--text-muted)]">
                        New experimental features will appear here when they're available for your account.
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {allowedFeatures.map(f => (
                        <div
                            key={f.id}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl"
                            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
                        >
                            <div
                                className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                                style={{ background: 'rgba(16,185,129,0.10)', color: '#10b981' }}
                            >
                                {pickBetaIcon(f.id || f.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{f.name || f.id}</p>
                                {f.description && (
                                    <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{f.description}</p>
                                )}
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0" style={{ background: 'rgba(16,185,129,0.10)', color: '#10b981' }}>
                                Active
                            </span>
                        </div>
                    ))}
                </div>
            )}

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
                <div className="flex gap-3">
                    <span className="text-lg">💡</span>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed flex-1">
                        Beta features are experimental capabilities turned on for your account by the Bee Flow team. They may change without notice. If you'd like access to a specific beta, contact support.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ConsumerBetaFeaturesSection;

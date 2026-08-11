import React from 'react';
import { Lock, ArrowRight, ExternalLink } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { BILLING_ACTION } from './billingTheme';

/**
 * What a user sees when a feature is above their licence tier.
 *
 * This block was copy-pasted into five components (LicenseContext's RequireTier,
 * GuardrailsPanel three times, OrgFeatureTogglesPanel, ConsumerBetaFeaturesSection),
 * and every copy's only call to action was an outbound link to beeflow.nl — so
 * the paywall for a cloud customer who could upgrade in two clicks sent them to
 * the public marketing site to start over.
 *
 * On cloud the primary action is now in-app, deep-linking to the billing page
 * with the feature preselected. The outbound link stays for self-hosted, where
 * there is genuinely nothing to buy in-app: those installs activate a licence
 * key instead.
 */
export default function UpgradePrompt({
    requiredTier = 'enterprise',
    feature = null,
    variant = 'panel',
    deploymentMode = 'cloud',
    upgradeUrl = 'https://beeflow.nl/pricing',
    onNavigateToBilling = null,
    onNavigateToLicense = null,
    title,
    description,
}) {
    const { t } = useTranslation();
    const isCloud = deploymentMode !== 'self-hosted';

    const heading = title
        || t('license.feature_locked', 'Requires {tier} license').replace('{tier}', requiredTier);
    const body = description || (isCloud
        ? t('license.upgrade_explainer_cloud',
            'Upgrade your plan to unlock this feature. Your existing data and settings carry over — nothing is lost.')
        : t('license.community_explainer',
            'You can activate Enterprise or a custom plan with a license key purchased at beeflow.nl. Activation unlocks compliance features such as SSO, audit log export, GDPR/AI Act hubs, and admin controls.'));

    // On cloud the upgrade path is in-app. A caller that owns the router can
    // pass onNavigateToBilling; everyone else gets a plain link to /app/billing,
    // which resolves to the right surface for the account type. That fallback is
    // deliberate — it means a gate anywhere in the app gets a working in-app CTA
    // without threading a navigate callback down to it.
    const primaryClass = 'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold';
    const primaryStyle = { background: BILLING_ACTION, color: '#fff' };

    const primary = isCloud
        ? (onNavigateToBilling
            ? (
                <button
                    type="button"
                    onClick={() => onNavigateToBilling({ feature, requiredTier })}
                    className={primaryClass}
                    style={primaryStyle}
                >
                    {t('license.view_plans', 'View plans')}
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden />
                </button>
            )
            : (
                <a href="/app/billing" className={primaryClass} style={primaryStyle}>
                    {t('license.view_plans', 'View plans')}
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden />
                </a>
            )
        )
        : (
            <a
                href={upgradeUrl}
                target="_blank"
                rel="noreferrer"
                className={primaryClass}
                style={primaryStyle}
            >
                {t('license.upgrade_at_beeflow', 'Upgrade at beeflow.nl')}
                <ExternalLink className="w-3.5 h-3.5" aria-hidden />
            </a>
        );

    const secondary = onNavigateToLicense && (
        <button
            type="button"
            onClick={onNavigateToLicense}
            className="px-4 py-2 rounded-xl text-xs font-semibold border"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
        >
            {t('license.enter_key', 'Enter license key')}
        </button>
    );

    if (variant === 'inline') {
        return (
            <div
                className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-tertiary)' }}
            >
                <Lock className="w-4 h-4 shrink-0" style={{ color: BILLING_ACTION }} aria-hidden />
                <span className="text-xs flex-1 min-w-[12rem]" style={{ color: 'var(--text-secondary)' }}>
                    {heading}
                </span>
                {primary}
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center p-12 text-center">
            <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 border"
                style={{
                    background: 'color-mix(in srgb, ' + BILLING_ACTION + ' 10%, transparent)',
                    borderColor: 'color-mix(in srgb, ' + BILLING_ACTION + ' 30%, transparent)',
                }}
            >
                <Lock className="w-6 h-6" style={{ color: BILLING_ACTION }} aria-hidden />
            </div>
            <h2 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{heading}</h2>
            <p className="text-sm max-w-md mb-4" style={{ color: 'var(--text-muted)' }}>{body}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
                {primary}
                {secondary}
            </div>
        </div>
    );
}

import { AlertTriangle, ShieldOff } from 'lucide-react';
import React from 'react';
import { useTranslation } from '../../../../hooks/useTranslation';

/**
 * "Every PII control on this page is decoration right now."
 *
 * `GET /api/org-privacy-shield/user/guard-status` reports `{configured, reachable}`.
 * Without the guard sidecar, `detectPii()` returns null and the chat path fails
 * OPEN — the shield can be switched on, categories can be picked, a threshold
 * can be tuned, and none of it detects anything. That state is currently
 * invisible everywhere except the server log, which is exactly the "works on
 * dev, not for the customer" class of ticket.
 *
 * Renders nothing when healthy: a banner that is always present stops being read.
 */
const HealthBanner = ({ status, onInstall }) => {
    const { t } = useTranslation();
    if (!status) return null;                       // still probing
    if (status.configured && status.reachable) return null;

    const notConfigured = !status.configured;
    const Icon = notConfigured ? ShieldOff : AlertTriangle;

    return (
        <div
            role="status"
            className="flex items-start gap-3 rounded-xl border px-4 py-3
                       border-amber-500/30 bg-amber-500/10"
        >
            <Icon size={18} className="mt-0.5 shrink-0 text-amber-500" />
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                    {notConfigured
                        ? t('admin.gr_health_absent_title', 'PII Guard is not installed')
                        : t('admin.gr_health_unreachable_title', 'PII Guard is unreachable')}
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                    {notConfigured
                        ? t('admin.gr_health_absent_desc', 'Personal-data detection cannot run, so the PII settings below have no effect. Regex patterns and sensitive terms still work — they do not need the service.')
                        : t('admin.gr_health_unreachable_desc', 'The service is configured but not answering. Organisations set to fail closed are blocking messages; organisations set to fail open are sending them unmasked.')}
                </p>
            </div>
            {onInstall && notConfigured && (
                <button
                    type="button"
                    onClick={onInstall}
                    className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg
                               border border-amber-500/40 text-amber-500
                               hover:bg-amber-500/10 transition-colors
                               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                    {t('admin.gr_health_install', 'Install')}
                </button>
            )}
        </div>
    );
};

export default HealthBanner;

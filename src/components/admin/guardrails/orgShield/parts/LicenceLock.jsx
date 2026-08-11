import { Lock } from 'lucide-react';
import React from 'react';

/**
 * "This is an Enterprise feature" + the upgrade link.
 *
 * There were five near-identical copies of this sentence on the page, each
 * with its own emoji, its own wrapper and its own fallback URL. One component
 * so a change to the wording or the link lands everywhere at once.
 */
export function LicenceLock({ children, upgradeUrl, t }) {
    return (
        <p className="text-[11px] leading-relaxed flex items-start gap-1.5" style={{ color: 'var(--text-muted)' }}>
            <Lock className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
            <span>
                {children}{' '}
                <a
                    href={upgradeUrl || 'https://beeflow.nl/pricing'}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#3b82f6' }}
                >
                    {t('license.upgrade_at_beeflow', 'Upgrade at beeflow.nl')}
                </a>
            </span>
        </p>
    );
}

export default LicenceLock;

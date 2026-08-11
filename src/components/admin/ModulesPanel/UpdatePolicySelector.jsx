import React from 'react';
import { useTranslation } from '../../../hooks/useTranslation';

// Compact channel/pin selector for an installed module's update policy.
// Rendered on the installed card footer and in the drawer's Versions tab.
// Defensive about missing data: a v1 hub / older server row has no policy,
// which reads as the defaults { channel: stable, pin: none }.
export default function UpdatePolicySelector({ policy, busy = false, onChange }) {
    const { t } = useTranslation();
    const channel = policy?.channel || 'stable';
    const pin = policy?.pin || 'none';
    const selectStyle = { background: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' };

    return (
        <div className="flex items-center gap-2 flex-wrap" data-testid="update-policy-selector" onClick={(e) => e.stopPropagation()}>
            <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                {t('modules.update_policy')}
            </span>
            <select
                value={channel}
                disabled={busy}
                onChange={(e) => onChange({ channel: e.target.value, pin })}
                className="text-xs rounded-lg border px-1.5 py-1 outline-none disabled:opacity-50"
                style={selectStyle}
                aria-label={t('modules.update_policy_channel')}
            >
                <option value="stable">{t('modules.channel_stable')}</option>
                <option value="beta">{t('modules.channel_beta')}</option>
            </select>
            <select
                value={pin}
                disabled={busy}
                onChange={(e) => onChange({ channel, pin: e.target.value })}
                className="text-xs rounded-lg border px-1.5 py-1 outline-none disabled:opacity-50"
                style={selectStyle}
                aria-label={t('modules.update_policy_pin')}
            >
                <option value="none">{t('modules.pin_none')}</option>
                <option value="major">{t('modules.pin_major')}</option>
                <option value="minor">{t('modules.pin_minor')}</option>
            </select>
        </div>
    );
}

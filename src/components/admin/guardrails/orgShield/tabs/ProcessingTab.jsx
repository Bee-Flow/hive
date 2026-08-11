import { Ban, Eye, Repeat, Workflow } from 'lucide-react';
import React from 'react';

import ChoiceCards from '../../../../shared/ChoiceCards';
import ToggleCard from '../parts/ToggleCard';

/**
 * "What do we do with a message we flagged?"
 *
 * The action, the transparency panel that only makes sense alongside it, and
 * whether routines are covered by the same policy.
 */
export function ProcessingTab({ f, readOnly, licence, t }) {
    const { canTokenizePii, upgradeUrl } = licence;

    // Both cards are ALWAYS rendered. Hiding the tokenize card on a plan that
    // does not include it produced the worst possible state: an organisation
    // whose stored action is `tokenize` (the server deliberately does not
    // clamp it) saw NO card selected and no explanation of why. Disabled +
    // still checked + a sentence is the honest version.
    const options = [
        {
            value: 'tokenize',
            label: t('dlp.action_tokenize_label', 'Replace with placeholders'),
            description: t('dlp.action_tokenize_help_short',
                'Sensitive details are swapped for labels like [email_1] before the message goes to the AI. The AI never sees the real values, and Bee Flow puts them back in the answer.'),
            Icon: Repeat,
            disabled: !canTokenizePii,
            badge: !canTokenizePii ? t('license.enterprise', 'Enterprise') : undefined,
            lockedNotice: !canTokenizePii ? (
                <>
                    {t('dlp.action_tokenize_locked', 'Replacing with placeholders is an Enterprise feature.')}{' '}
                    <a href={upgradeUrl || 'https://beeflow.nl/pricing'} target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>
                        {t('license.upgrade_at_beeflow', 'Upgrade at beeflow.nl')}
                    </a>
                </>
            ) : undefined,
        },
        {
            value: 'block',
            label: t('dlp.action_block_label', 'Do not send the message'),
            description: t('dlp.action_block_help', 'The message is stopped before it reaches the AI, and the person is asked to rewrite it without the personal data.'),
            Icon: Ban,
        },
    ];

    return (
        <div className="space-y-5">
            <div
                className="p-4 rounded-xl border"
                style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}
            >
                <p className="text-xs font-medium text-muted mb-2" id="pii-action-label">
                    {t('admin.pii_action_on_detection', 'What happens when we find personal data')}
                </p>
                <ChoiceCards
                    value={f.piiAction}
                    onChange={f.setPiiAction}
                    options={options}
                    disabled={readOnly}
                    ariaLabel={t('admin.pii_action_on_detection', 'What happens when we find personal data')}
                />
                {f.piiAction === 'tokenize' && !canTokenizePii && (
                    <p className="text-[11px] mt-2 leading-relaxed" style={{ color: '#d97706' }}>
                        {t('admin.shield_action_unlicensed_note',
                            'Placeholders are saved for this organisation, but your plan does not include them — messages are stopped instead, until you upgrade or choose “Do not send the message”.')}
                    </p>
                )}
                <p className="text-[10px] mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {t('dlp.action_footnote', 'Want people to decide for themselves each time? Turn on the extra check under “Leaving your org” and set it to Ask.')}
                </p>
            </div>

            {f.piiAction === 'tokenize' && (
                <ToggleCard
                    Icon={Eye}
                    title={t('admin.shield_raw_payload_title', 'Let people see what was sent to the AI')}
                    description={t('admin.shield_raw_payload_desc',
                        'Adds a section to the "How I got this answer" panel: the original message, the version that went to the AI, the AI\'s reply, and which placeholder stood for which value. Real values only appear on click, and anyone who can open the conversation can see them.')}
                    checked={f.showRawPayload}
                    onChange={f.setShowRawPayload}
                    disabled={readOnly}
                />
            )}

            <ToggleCard
                Icon={Workflow}
                title={t('admin.shield_apply_automations', 'Also protect routines')}
                description={t('admin.shield_apply_automations_desc', 'Routines run on their own, with nobody watching. Check their data and their AI steps the same way as chat. (Activity logging keeps running either way.)')}
                checked={f.applyToAutomations}
                onChange={f.setApplyToAutomations}
                disabled={readOnly}
            />
        </div>
    );
}

export default ProcessingTab;

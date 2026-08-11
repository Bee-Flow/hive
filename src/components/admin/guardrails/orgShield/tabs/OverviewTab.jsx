import { ShieldCheck } from 'lucide-react';
import React from 'react';

import Toggle from '../../../../shared/Toggle';
import PostureRow from '../parts/PostureRow';

/**
 * "How does this organisation stand right now?"
 *
 * The master switch plus a read-only summary. Everything else on this tab is
 * derived (see orgShieldPosture.js) — no setting has a second home here,
 * because two places to change one value is two places to keep in sync.
 */

/** Structured posture value → a sentence. Kept here so the derivation stays pure. */
function describe(row, t, presetLabels) {
    const v = row.value;
    switch (row.id) {
        case 'guard':
            return v.configured === false
                ? t('admin.shield_posture_guard_missing', 'not installed')
                : t('admin.shield_posture_guard_unreachable', 'not responding');
        case 'categories':
            return t('admin.shield_posture_categories_value', '{n} of {total}', { n: v.n, total: v.total });
        case 'sensitivity':
            return v.presetId
                ? presetLabels[v.presetId]
                : t('admin.shield_posture_custom_pct', 'Custom ({pct}%)', { pct: v.customPct });
        case 'action':
            return v.action === 'tokenize'
                ? t('dlp.action_tokenize_label', 'Replace with placeholders')
                : t('dlp.action_block_label', 'Do not send the message');
        case 'transparency':
        case 'routines':
        case 'eu':
            return v.on ? t('common.on', 'On') : t('common.off', 'Off');
        case 'websearch':
            return v.on ? t('common.on', 'On') : t('common.off', 'Off');
        case 'dlp':
            if (!v.on) return t('common.off', 'Off');
            if (v.mode === 'block') return t('admin.shield_posture_dlp_block', 'On — do not send');
            if (v.mode === 'auto_redact') return t('admin.shield_posture_dlp_redact', 'On — hide automatically');
            return t('admin.shield_posture_dlp_ask', 'On — ask the person');
        case 'toolcalls':
            return t('admin.shield_posture_toolcalls_value',
                'outside tools {external}/{total}, own server {internal}/{total}',
                { external: v.external, internal: v.internal, total: v.total });
        case 'customterms':
            return v.n === 0
                ? t('common.none', 'None')
                : t('admin.shield_posture_terms_value', '{n} of your own', { n: v.n });
        case 'allowlist':
            if (v.terms === 0) {
                return v.publicOrgs
                    ? t('admin.shield_posture_allow_public_only', 'Well-known companies only')
                    : t('common.none', 'None');
            }
            return t('admin.shield_posture_allow_value', '{n} of your own', { n: v.terms });
        default:
            return '';
    }
}

/** The extra sentence a row only earns when something is wrong. */
function hintFor(row, t) {
    if (row.tone === 'ok' || row.tone === 'note') {
        if (row.id === 'allowlist' && row.tone === 'note') {
            return t('admin.shield_posture_allow_hint',
                'These are deliberately left visible to the AI.');
        }
        return null;
    }
    switch (row.id) {
        case 'guard':
            return t('admin.shield_posture_guard_hint',
                'This service does the actual scanning. Until it is running, nothing on this page has any effect.');
        case 'categories':
            return t('admin.shield_posture_categories_hint',
                'Protection is on, but nothing is ticked — so nothing will ever be found.');
        case 'action':
            return t('admin.shield_posture_action_hint',
                'Your plan does not include placeholders, so these messages are stopped instead.');
        default:
            return null;
    }
}

const LABEL_KEYS = {
    guard: ['admin.shield_posture_guard', 'Detection service'],
    categories: ['admin.shield_posture_categories', 'Kinds of data we look for'],
    sensitivity: ['admin.shield_posture_sensitivity', 'How strict'],
    action: ['admin.shield_posture_action', 'When we find something'],
    transparency: ['admin.shield_posture_transparency', 'Show what was sent'],
    routines: ['admin.shield_posture_routines', 'Also covers routines'],
    dlp: ['admin.shield_posture_dlp', 'One last check before an outside AI'],
    toolcalls: ['admin.shield_posture_toolcalls', 'Held back from tools'],
    websearch: ['admin.shield_posture_websearch', 'Web search protection'],
    eu: ['admin.shield_posture_eu', 'EU-hosted AI only'],
    customterms: ['admin.shield_posture_customterms', 'Always hidden'],
    allowlist: ['admin.shield_posture_allowlist', 'Never hidden'],
};

export function OverviewTab({ f, posture, readOnly, t, onGoTo }) {
    const presetLabels = {
        strict: t('privacy.sensitivity_strict', 'Low sensitivity'),
        balanced: t('privacy.sensitivity_balanced', 'Balanced'),
        high: t('privacy.sensitivity_high', 'High sensitivity'),
    };

    return (
        <div className="space-y-5">
            <Toggle
                id="org-shield-enable"
                checked={f.enabled}
                onChange={f.setEnabled}
                disabled={readOnly}
                ariaLabel={t('admin.shield_enable')}
                label={t('admin.shield_enable')}
                description={t('admin.shield_enable_desc')}
            />

            {posture.off ? (
                <div
                    className="flex items-start gap-3 p-4 rounded-xl border"
                    style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}
                >
                    <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                        {t('admin.shield_disabled_note',
                            'Protection is off for this organisation. Messages go to the AI unchanged, and the other tabs stay inactive until you turn it on.')}
                    </p>
                </div>
            ) : (
                <div
                    className="rounded-xl border overflow-hidden"
                    style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}
                >
                    {posture.rows.map(row => (
                        <PostureRow
                            key={row.id}
                            row={row}
                            label={t(...LABEL_KEYS[row.id])}
                            value={describe(row, t, presetLabels)}
                            hint={hintFor(row, t)}
                            onGoTo={onGoTo}
                            goToLabel={t('admin.shield_posture_change', 'Change')}
                        />
                    ))}
                </div>
            )}

            <div className="p-4 rounded-lg flex gap-3" style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" style={{ color: '#3b82f6' }} />
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{t('admin.shield_how_it_works')}</strong>{' '}
                    {t('admin.shield_how_it_works_desc')}
                </p>
            </div>
        </div>
    );
}

export default OverviewTab;

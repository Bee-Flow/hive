/**
 * Organisation encryption settings — the org admin picks the tier.
 *
 * Two things the server tells us that this screen must respect:
 *
 *   • `tierOptions[].selectable` + `blockedBy` — a tier can be blocked for two
 *     very different reasons, and they need different copy. `entitlement` is a
 *     billing answer (show an upgrade link); `readiness` is a configuration
 *     answer (show an ops note — an upgrade would not fix it).
 *
 *   • Locked tiers are still RENDERED, disabled, with the reason underneath.
 *     Hiding them is the failure mode called out in the Privacy Shield's
 *     ProcessingTab: the admin cannot tell the difference between "this product
 *     has no such option" and "your plan does not include it".
 *
 * `scope` (per-surface toggles) is deliberately absent — the server only
 * accepts it from a super-admin, so offering the control here would mean a
 * save that 403s.
 */
import { Lock, ShieldCheck, ShieldOff, KeyRound, AlertTriangle } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from '../../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../../utils/helpers';
import ChoiceCards from '../../shared/ChoiceCards';
import { toast } from '../../shared/Toast';

const TIER_ICON = { none: ShieldOff, managed: ShieldCheck, zk: KeyRound };

export default function OrgEncryptionEditor({ orgId }) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [server, setServer] = useState(null);   // last loaded server state
    const [tier, setTier] = useState(null);       // current selection
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        if (!orgId) return;
        setLoading(true);
        setLoadError(null);
        try {
            const res = await authFetch(`${API_BASE}/auth/organizations/${orgId}/encryption`);
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            const data = await res.json();
            setServer(data);
            setTier(data.tier);
        } catch (err) {
            // Null the loaded state so Save stays disabled — saving on top of a
            // failed load would write a guess.
            setServer(null);
            setLoadError(err.message);
        } finally {
            setLoading(false);
        }
    }, [orgId]);

    useEffect(() => { load(); }, [load]);

    const isDirty = !!server && tier !== server.tier;

    const handleSave = useCallback(async () => {
        if (!server || !isDirty) return;
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/auth/organizations/${orgId}/encryption`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tier }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.error(body.message || body.error || t('admin.encryption.save_failed', 'Could not save encryption settings'));
                return;
            }
            if (body.sessionsBusted) {
                // Everyone, including the admin doing this, has to sign in again.
                toast.info(t(
                    'admin.encryption.sessions_busted',
                    'Everyone in this organisation has been signed out. Each person must sign in again so their encryption key can be created.',
                ));
            } else {
                toast.success(t('admin.encryption.saved', 'Encryption settings saved'));
            }
            await load();
        } catch (err) {
            toast.error(err.message || t('admin.encryption.save_failed', 'Could not save encryption settings'));
        } finally {
            setSaving(false);
        }
    }, [server, isDirty, orgId, tier, t, load]);

    // Note: this component owns its save bar rather than reporting up through
    // the shell's onStateChange — OrgInfoPanel already drives that for the org
    // form, and two writers would overwrite each other's state.

    const options = useMemo(() => {
        const meta = {
            none: {
                label: t('admin.encryption.tier_none', 'Off'),
                description: t('admin.encryption.tier_none_desc', 'Messages are stored without content encryption.'),
            },
            managed: {
                label: t('admin.encryption.tier_managed', 'Managed'),
                description: t(
                    'admin.encryption.tier_managed_desc',
                    'Encrypted at rest. Your administrators can reset a password without the user losing their data.',
                ),
            },
            zk: {
                label: t('admin.encryption.tier_zk', 'Zero-knowledge'),
                description: t(
                    'admin.encryption.tier_zk_desc',
                    'Encrypted with each user’s own secret. Nobody — not your administrators, not Bee Flow support — can recover a user’s data if they lose their password and recovery key.',
                ),
            },
        };

        return (server?.tierOptions || []).map((opt) => {
            const m = meta[opt.tier] || { label: opt.tier };
            const blockedByPlan = opt.blockedBy === 'entitlement';
            return {
                value: opt.tier,
                label: m.label,
                description: m.description,
                Icon: TIER_ICON[opt.tier],
                disabled: !opt.selectable,
                badge: blockedByPlan ? t('license.enterprise', 'Enterprise') : undefined,
                lockedNotice: !opt.selectable ? (
                    <>
                        {opt.reason}
                        {blockedByPlan && (
                            <>
                                {' '}
                                <a
                                    href="https://beeflow.nl/pricing"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline"
                                >
                                    {t('license.upgrade_at_beeflow', 'Upgrade at beeflow.nl')}
                                </a>
                            </>
                        )}
                    </>
                ) : undefined,
            };
        });
    }, [server, t]);

    if (loading) {
        return <div className="p-4 text-sm opacity-70">{t('common.loading', 'Loading…')}</div>;
    }

    if (loadError) {
        return (
            <div className="p-4">
                <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
                    <AlertTriangle className="mr-2 inline h-4 w-4" aria-hidden="true" />
                    {t('admin.encryption.load_failed', 'Could not load encryption settings.')} {loadError}
                </div>
            </div>
        );
    }

    const selected = (server?.tierOptions || []).find(o => o.tier === tier);

    return (
        <div className="space-y-5 p-1">
            <header>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Lock className="h-5 w-5" aria-hidden="true" />
                    {t('admin.encryption.title', 'Encryption')}
                </h2>
                <p className="mt-1 text-sm opacity-75">
                    {t(
                        'admin.encryption.intro',
                        'Choose how your organisation’s conversation content is stored. This affects new messages; existing messages are left exactly as they are and stay readable either way.',
                    )}
                </p>
            </header>

            {!server?.entitled && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                    {t(
                        'admin.encryption.not_entitled',
                        'Encryption is not included in your current plan. You can still turn it off, but not on.',
                    )}
                </div>
            )}

            <ChoiceCards
                value={tier}
                onChange={setTier}
                options={options}
                columns={1}
                ariaLabel={t('admin.encryption.choose_tier', 'Encryption level')}
                disabled={saving}
            />

            {/* Advisory, not a blocker — e.g. OPAQUE not configured for zk. */}
            {selected?.warningReason && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                    <AlertTriangle className="mr-2 inline h-4 w-4" aria-hidden="true" />
                    {selected.warningReason}
                </div>
            )}

            {/* Switching into zk signs everyone out — say so before they save. */}
            {isDirty && tier === 'zk' && (
                <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
                    <AlertTriangle className="mr-2 inline h-4 w-4" aria-hidden="true" />
                    {t(
                        'admin.encryption.warn_zk_signout',
                        'Saving this will sign out everyone in the organisation, including you. Each person must sign in again so their encryption key can be created. Data can no longer be recovered by an administrator.',
                    )}
                </div>
            )}

            <div className="flex items-center gap-3 border-t border-black/10 pt-4 dark:border-white/10">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={!isDirty || saving}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 hover:bg-blue-700"
                >
                    {saving ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
                </button>
                {isDirty && (
                    <button
                        type="button"
                        onClick={() => setTier(server.tier)}
                        disabled={saving}
                        className="text-sm underline opacity-75 hover:opacity-100"
                    >
                        {t('common.cancel', 'Cancel')}
                    </button>
                )}
            </div>
        </div>
    );
}

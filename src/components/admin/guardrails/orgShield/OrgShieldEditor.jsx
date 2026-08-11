import { AlertTriangle, Building2 } from 'lucide-react';
import React, { useMemo } from 'react';

import { useUrlQueryParam } from '../../../../hooks/useUrlTab';
import { useTranslation } from '../../../../hooks/useTranslation';
import { useLicenseContext } from '../../../LicenseContext';
// The app-level <Toaster/> from shared/Toast is mounted in main.jsx, so this
// works on EVERY route. The guardrails-local showToast needed a <ToastHost/>
// that the settings tree never mounted — so a save from
// /app/settings/organisation/privacy produced no confirmation at all, and a
// failed save produced no error either.
import { toast } from '../../../shared/Toast';
import Tabs from '../../../shared/Tabs';
import ActivityTab from './activity/ActivityTab';
import { derivePosture } from './orgShieldPosture';
import { ACTIVITY_TAB, ALL_TAB_IDS, DEFAULT_TAB, TAB_IDS, TABS, normaliseTab } from './orgShieldTabs';
import DetectionTab from './tabs/DetectionTab';
import OutboundTab from './tabs/OutboundTab';
import OverviewTab from './tabs/OverviewTab';
import ProcessingTab from './tabs/ProcessingTab';
import useOrgShield from './useOrgShield';

/**
 * One organisation's Privacy Shield, as an editor.
 *
 * A shell: the org picker, the load-error state, the tab strip and the save
 * bar. Every control lives in `tabs/`, and all state lives in `useOrgShield`.
 *
 * ── Why the tab is a QUERY PARAM and not a path segment ───────────────────
 * This component is mounted twice, on two unrelated routes: the org settings
 * page (/app/settings/organisation/privacy) and the admin console
 * (/app/admin/security/guardrails/organisations). `useUrlTab` writes a PATH,
 * so a tab click in the admin console would navigate the console out of
 * itself. On the settings side it would also fight `AdvancedSettings`, which
 * pushState's its own 3-segment URL whenever the pathname differs — and
 * `useUrlTab` only re-reads on `popstate`, which pushState does not fire, so
 * the strip and the URL would silently disagree.
 *
 * A query param rides on whatever pathname is current, is invisible to both
 * route parsers, and still survives a bookmark and the back button.
 * `guardrailsRoutes.js` already writes this rule down for this very console.
 *
 * @param {string}  [orgId]          The organisation to edit. Required unless
 *   `allowOrgPicker` is set — see useOrgShield for why guessing is forbidden.
 * @param {boolean} [allowOrgPicker] Render a visible org picker and default to
 *   the first organisation. Admin view only; never in an embedded context,
 *   where a guess would be both invisible and writable.
 * @param {boolean} [readOnly]       Render every control disabled and hide Save.
 * @param {Function}[onSaved]        Called after a successful save.
 * @param {string|null} [urlParam]   Query param carrying the active tab.
 *   `null` opts out of URL sync entirely — for hosts that own the URL already.
 * @param {boolean} [showActivityTab] Offer the "What happened" monitoring tab.
 *   Default OFF, and the admin GuardrailsHub must NEVER pass it: the
 *   monitoring endpoints derive the organisation from the SESSION, so on a
 *   mount that can pin a different org the tab would silently show the wrong
 *   organisation's activity. Only the org-settings mount opts in.
 */
const OrgShieldEditor = ({ orgId = null, allowOrgPicker = false, readOnly = false, onSaved, urlParam = 'tab', showActivityTab = false }) => {
    const { t } = useTranslation();
    // 'pii_tokenize' unlocks the Tokenize action; 'web_search_guard' unlocks the
    // Web Search Guard block and external tool-call blocking. Both Enterprise —
    // the backend clamps regardless, this only avoids offering what won't stick.
    const { hasFeature: hasLicenseFeature, upgradeUrl } = useLicenseContext();
    const canTokenizePii = hasLicenseFeature('pii_tokenize');
    const canUseWebSearchGuard = hasLicenseFeature('web_search_guard');

    const [rawTab, setRawTab] = useUrlQueryParam(urlParam || 'tab');
    // Never trust the URL, and never NORMALISE it on mount: writing
    // `?tab=overview` on every render would litter the admin console's URL and
    // race its own replaceState. Only a click writes.
    // The valid-id set depends on the mount: `?tab=activity` on a mount that
    // does not offer the tab falls back to Overview instead of rendering a
    // wrong-organisation monitoring pane (see orgShieldTabs.js).
    const tabIds = showActivityTab ? ALL_TAB_IDS : TAB_IDS;
    const activeTab = normaliseTab(rawTab ?? DEFAULT_TAB, tabIds);
    const [localTab, setLocalTab] = React.useState(DEFAULT_TAB);
    const tab = urlParam ? activeTab : localTab;
    const setTab = urlParam ? (id) => setRawTab(id) : setLocalTab;

    const shield = useOrgShield({ orgId, allowOrgPicker });
    const {
        loading, shieldLoading, saving, message,
        loadError, isDirty, canSave,
        orgList, selectedOrgId, selectOrg,
        hasEuModelsConfigured, hasWebSearchEnabled,
        categories: PII_CATEGORIES_LIST,
        save, toggleToolPiiCat, setToolPiiCats, fields: f,
    } = shield;

    const licence = { canTokenizePii, canUseWebSearchGuard, upgradeUrl };
    const env = { hasEuModelsConfigured, hasWebSearchEnabled };

    const posture = useMemo(
        () => derivePosture(f, { categories: PII_CATEGORIES_LIST, env, licence }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [f, PII_CATEGORIES_LIST, hasEuModelsConfigured, hasWebSearchEnabled, canTokenizePii, canUseWebSearchGuard],
    );

    // Which custom terms the server refused on the last save. Kept so the
    // offending ROWS can be flagged: the server saves the valid terms and
    // reports the rest, so a partial save used to read as a clean one.
    const [termErrors, setTermErrors] = React.useState([]);

    const handleSave = async () => {
        const result = await save();
        setTermErrors(result.termErrors || []);
        if (result.ok) {
            // A clamp or a rejected term means the save landed but not exactly
            // as asked. Reporting that as a plain success is how an admin ends
            // up believing a pattern is in force when it never compiled.
            if (result.clamped?.length || result.termErrors?.length) {
                toast.info(t('admin.guard_saved_with_notes', 'Saved, with notes — see the message below.'));
            } else {
                toast.success(t('admin.guard_saved'));
            }
            onSaved?.();
        } else {
            toast.error(result.error || 'Failed to save.');
        }
    };

    if (loading) {
        return <div className="text-sm p-4" style={{ color: 'var(--text-muted)' }}>{t('admin.shield_loading')}</div>;
    }

    const tabItems = (showActivityTab ? [...TABS, ACTIVITY_TAB] : TABS).map(({ id, labelKey, fallback, Icon }) => ({
        id,
        label: t(labelKey, fallback),
        icon: <Icon className="w-3.5 h-3.5" aria-hidden="true" />,
        // The control tabs are meaningless while the shield is off; disabling
        // them says so instead of showing three panes of inert switches.
        // Activity stays usable: history exists even when the shield is off,
        // and the pane says so in one line.
        disabled: id !== 'overview' && id !== 'activity' && !f.enabled,
    }));

    return (
        // Full width — the host owns the horizontal budget. The old centred
        // max-w-3xl left a dead gap between the settings menu and the card,
        // and made this the only non-full-width section in the admin hub.
        <div className="w-full space-y-6 animate-fadeIn">
            <div>
                <h2 className="text-xl font-bold mb-1 text-primary">{t('admin.guard_org_title')}</h2>
                <p className="text-sm text-muted">{t('admin.guard_org_desc')}</p>
            </div>

            {/* The empty state must not paint over a PINNED org: when the caller
                supplies an id we never fetch the org list, so it stays empty. */}
            {!selectedOrgId && orgList.length === 0 ? (
                <div className="p-8 rounded-xl border text-center" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <Building2 className="w-8 h-8 mx-auto mb-3" aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-sm text-muted">
                        {t('admin.shield_no_orgs', 'No organizations found. Create one in User Management first.')}
                    </p>
                </div>
            ) : (
                <div className="p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    {/* Org selector — never shown when the org is pinned by the
                        caller: offering a choice the prop then overrides is
                        worse than offering none. */}
                    {orgList.length > 1 && allowOrgPicker && !orgId && (
                        <div className="mb-6">
                            <label htmlFor="org-shield-org" className="text-xs font-medium text-muted mb-2 block">{t('admin.shield_org_label')}</label>
                            <select
                                id="org-shield-org"
                                value={selectedOrgId}
                                onChange={e => selectOrg(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-lg border text-sm"
                                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', background: 'var(--bg-tertiary)' }}
                            >
                                {orgList.map(org => (
                                    <option key={org.id} value={org.id}>{org.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {loadError ? (
                        /* The load failed, so every field below would hold a
                           constructor default, not this org's configuration.
                           Saying so — and rendering no form and no Save — is
                           the fix: the page used to show "shield off, no
                           categories" indistinguishably from a real answer,
                           with Save live, and one click wrote that blank
                           config over the org's real one. */
                        <div
                            role="alert"
                            className="flex items-start gap-3 p-4 rounded-xl border"
                            style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.30)' }}
                        >
                            <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" style={{ color: '#ef4444' }} />
                            <div>
                                <span className="text-sm font-medium block" style={{ color: 'var(--text-primary)' }}>
                                    {t('admin.shield_load_failed', 'Could not load these settings')}
                                </span>
                                <span className="text-xs text-muted block mt-0.5 leading-relaxed">
                                    {loadError.status === 403
                                        ? t('admin.shield_load_failed_403', 'You do not have access to this organisation\'s privacy settings.')
                                        : t('admin.shield_load_failed_desc', 'The current configuration could not be read, so nothing can be changed here safely. Saving is disabled — reload the page to try again.')}
                                </span>
                            </div>
                        </div>
                    ) : shieldLoading ? (
                        <div className="text-sm text-muted py-4 text-center">{t('admin.shield_loading')}</div>
                    ) : (
                        <>
                            <Tabs
                                value={tab}
                                onChange={setTab}
                                items={tabItems}
                                ariaLabel={t('admin.shield_tabs_label', 'Privacy Shield sections')}
                                className="mb-5"
                            />

                            {tab === 'overview' && (
                                <OverviewTab f={f} posture={posture} readOnly={readOnly} t={t} onGoTo={setTab} />
                            )}
                            {tab === 'detection' && (
                                <DetectionTab
                                    f={f}
                                    categories={PII_CATEGORIES_LIST}
                                    readOnly={readOnly}
                                    termErrors={termErrors}
                                    t={t}
                                />
                            )}
                            {tab === 'processing' && (
                                <ProcessingTab f={f} readOnly={readOnly} licence={licence} t={t} />
                            )}
                            {tab === 'outbound' && (
                                <OutboundTab
                                    f={f}
                                    categories={PII_CATEGORIES_LIST}
                                    readOnly={readOnly}
                                    licence={licence}
                                    env={env}
                                    t={t}
                                    toggleToolPiiCat={toggleToolPiiCat}
                                    setToolPiiCats={setToolPiiCats}
                                />
                            )}
                            {tab === 'activity' && showActivityTab && (
                                <ActivityTab
                                    t={t}
                                    shieldEnabled={!!f.enabled}
                                    licensed={hasLicenseFeature('advanced_usage_monitoring')}
                                    upgradeUrl={upgradeUrl}
                                />
                            )}

                            {/* The save bar belongs to the four CONFIG tabs;
                                Activity is read-only evidence. */}
                            {!readOnly && tab !== 'activity' && (
                                <div className="flex items-center justify-end gap-3 pt-4 mt-6 border-t border-white/5">
                                    {isDirty && !message && (
                                        <span className="text-xs text-muted mr-auto">
                                            {t('admin.shield_unsaved', 'Unsaved changes')}
                                        </span>
                                    )}
                                    {message && (
                                        /* Three tones, because there are three
                                           outcomes. "Saved. Note: …" used to
                                           render red and read as a failure. */
                                        <span
                                            className="text-sm mr-auto"
                                            style={{
                                                color: message.type === 'success' ? '#10b981'
                                                    : message.type === 'warning' ? '#d97706'
                                                        : '#ef4444',
                                            }}
                                        >{message.text}</span>
                                    )}
                                    <button
                                        onClick={handleSave}
                                        disabled={saving || !canSave}
                                        className="px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 shadow-lg transition-all hover:opacity-90"
                                        style={{ background: 'var(--accent-primary)', color: 'white' }}
                                    >
                                        {saving ? t('admin.guard_saving') : t('admin.guard_save_all')}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default OrgShieldEditor;

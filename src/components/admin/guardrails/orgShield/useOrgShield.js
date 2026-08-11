import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { piiCategoriesLocalized } from '../../../../config/piiCategories';
import { useTranslation } from '../../../../hooks/useTranslation';
import { deepEqual } from '../../../../utils/deepEqual';
import { API_BASE, authFetch } from '../../../../utils/helpers';

/**
 * State + I/O for one organisation's Privacy Shield.
 *
 * Extracted verbatim from GuardrailsPanel's `orgshield` tab so the same editor
 * can be embedded in org settings and in the admin console without two copies
 * drifting apart. Behaviour is deliberately unchanged by the extraction.
 *
 * ── The invariant this hook exists to protect ─────────────────────────────
 * It must NEVER guess which organisation it is editing. The panel used to fall
 * back to `orgs[0]` from /auth/organizations whenever no id was supplied — and
 * in embedded mode the org picker is hidden, so a super-admin opening org B's
 * settings page silently read, and on save WROTE, org A's shield. An explicit
 * id is the only way this code can know which tenant it is looking at.
 *
 * So there are exactly two legitimate modes:
 *   - `orgId` supplied      → follow it, never deviate, no picker.
 *   - `allowOrgPicker`      → the caller renders a VISIBLE picker, so defaulting
 *                             to the first org is something the admin can see
 *                             and change. Only then may we choose one.
 * Neither → fetch nothing and say so. Pinned by OrgShieldEditor.orgscope.test.jsx.
 *
 * @param {object}  opts
 * @param {string}  [opts.orgId]           Pinned organisation. Wins over everything.
 * @param {boolean} [opts.allowOrgPicker]  May default to the first org (admin view only).
 */
/**
 * The server document → the field values this page edits.
 *
 * Shared by the state-setting path and the dirty-state snapshot so the two can
 * never disagree about what "unchanged" means. If a snapshot were built from
 * the raw document while state came from a normalised copy, the form would read
 * as dirty the instant it loaded.
 */
function normaliseDoc(data, validIds) {
    const tpp = data.toolPiiPolicy || {};
    return {
        enabled: !!data.enabled,
        euModeEnabled: !!data.euModeEnabled,
        webSearchGuard: !!data.webSearchGuardEnabled,
        disableSearchOnUpload: !!data.disableSearchOnUpload,
        monitorIntegrations: !!data.monitorIntegrations,
        applyToAutomations: data.applyToAutomations !== false,
        dlpEnabled: !!data.dlpEnabled,
        dlpMode: ['ask', 'auto_redact', 'block'].includes(data.dlpMode) ? data.dlpMode : 'ask',
        customSensitiveTerms: Array.isArray(data.customSensitiveTerms) ? data.customSensitiveTerms : [],
        // Older rows may hold `{ term }` objects; the UI edits bare strings.
        piiAllowTerms: (Array.isArray(data.piiAllowTerms) ? data.piiAllowTerms : [])
            .map(v => (typeof v === 'string' ? v : v?.term))
            .filter(v => typeof v === 'string' && v.trim())
            .map(v => v.trim()),
        piiAllowPublicOrgs: data.piiAllowPublicOrgs !== false,
        toolPiiPolicy: {
            external: { blockCategories: (tpp.external?.blockCategories || []).filter(id => validIds.has(id)) },
            internal: { blockCategories: (tpp.internal?.blockCategories || []).filter(id => validIds.has(id)) },
        },
        piiCategories: (data.piiDetectionCategories || []).filter(id => validIds.has(id)),
        piiConfidenceThreshold: data.piiDetectionConfidenceThreshold ?? 0.7,
        piiAction: data.piiDetectionAction || 'block',
        piiFailureMode: data.piiFailureMode === 'fail_open' ? 'fail_open' : 'fail_closed',
        showRawPayload: !!data.showRawPayload,
    };
}

/**
 * The PUT body: the loaded document with this page's fields laid over it.
 *
 * The spread of `base` is the whole point — see `loadedDocRef`. Response-only
 * keys are stripped first: echoing `clamped_fields` back would persist a
 * transient plan note into the row, and `updatedAt`/`updatedBy` are the
 * server's to write.
 */
function buildPayload(doc, f) {
    const {
        clamped_fields: _cf, clamped_tier: _ct, stalenessWarnings: _sw,
        updatedAt: _ua, updatedBy: _ub,
        ...base
    } = doc || {};
    return {
        ...base,
        enabled: f.enabled,
        euModeEnabled: f.euModeEnabled,
        webSearchGuardEnabled: f.webSearchGuard,
        disableSearchOnUpload: f.disableSearchOnUpload,
        monitorIntegrations: f.monitorIntegrations,
        applyToAutomations: f.applyToAutomations,
        toolPiiPolicy: f.toolPiiPolicy,
        piiDetectionCategories: f.piiCategories,
        piiDetectionConfidenceThreshold: f.piiConfidenceThreshold,
        piiDetectionAction: f.piiAction,
        piiFailureMode: f.piiFailureMode,
        // SAVE-gated, not merely edit-gated. The control is hidden when the
        // action is not `tokenize`, but the value used to be sent regardless —
        // so an org that enabled it and then switched to Block kept a hidden
        // transparency panel switched on for every one of its users.
        showRawPayload: f.piiAction === 'tokenize' ? f.showRawPayload : false,
        dlpEnabled: f.dlpEnabled,
        dlpMode: f.dlpMode,
        customSensitiveTerms: f.customSensitiveTerms,
        piiAllowTerms: f.piiAllowTerms,
        piiAllowPublicOrgs: f.piiAllowPublicOrgs,
    };
}

export function useOrgShield({ orgId: pinnedOrgId = null, allowOrgPicker = false } = {}) {
    const { t } = useTranslation();

    const [loading, setLoading] = useState(true);
    const [orgList, setOrgList] = useState([]);
    const [selectedOrgId, setSelectedOrgId] = useState('');

    // Environment flags that decide which cards are relevant at all.
    const [hasEuModelsConfigured, setHasEuModelsConfigured] = useState(false);
    const [hasWebSearchEnabled, setHasWebSearchEnabled] = useState(false);

    // ── The shield document ──────────────────────────────────────────────
    //
    // The server's document, verbatim, exactly as it was loaded. Every save is
    // layered ON TOP of this rather than assembled from the fields below.
    //
    // Why: the PUT handler rebuilds the whole row from the request body, so a
    // key this page does not send comes back as its default. This page did not
    // send `customSensitiveTerms`, `dlpScope`, `dlpFailureMode`,
    // `dlpAllowlistedHosts` or `attachmentLargeInputPolicy` — so every admin
    // save silently wiped the org's own sensitive terms and reset four
    // policies nobody touched. Keeping the raw document means a field this
    // page has never heard of (including one added in a future release)
    // survives a save it was never part of.
    //
    // `null` also doubles as "we do not have a trustworthy document" — see
    // `canSave`.
    const loadedDocRef = useRef(null);
    // The payload as it was at load / last successful save. Dirty-tracking
    // compares against this; nothing else may write it.
    const snapshotRef = useRef(null);
    const [loadError, setLoadError] = useState(null);

    const [enabled, setEnabled] = useState(false);
    const [euModeEnabled, setEuModeEnabled] = useState(false);
    const [webSearchGuard, setWebSearchGuard] = useState(false);
    const [disableSearchOnUpload, setDisableSearchOnUpload] = useState(false);
    const [monitorIntegrations, setMonitorIntegrations] = useState(false);
    const [applyToAutomations, setApplyToAutomations] = useState(true);
    const [dlpEnabled, setDlpEnabled] = useState(false);
    const [dlpMode, setDlpMode] = useState('ask');
    // Extra terms to redact (org-authored regex/literal), and the mirror image:
    // terms that must NEVER be redacted. Both were previously loaded by nobody
    // and destroyed on every save.
    const [customSensitiveTerms, setCustomSensitiveTerms] = useState([]);
    const [piiAllowTerms, setPiiAllowTerms] = useState([]);
    // `!== false`: an absent value means ON, matching the server and the
    // runtime matcher. Defaulting to `false` here would render "off" for a
    // list that is actually active.
    const [piiAllowPublicOrgs, setPiiAllowPublicOrgs] = useState(true);
    const [toolPiiPolicy, setToolPiiPolicy] = useState({
        external: { blockCategories: [] },
        internal: { blockCategories: [] },
    });
    const [piiCategories, setPiiCategories] = useState([]);
    const [piiConfidenceThreshold, setPiiConfidenceThreshold] = useState(0.7);
    const [piiAction, setPiiAction] = useState('block');
    // Not exposed in the UI: stays at its safe default so a degraded detector
    // never silently sends unmasked text to the model (BFSF-269).
    const [piiFailureMode, setPiiFailureMode] = useState('fail_closed');
    const [showRawPayload, setShowRawPayload] = useState(false);

    const [saving, setSaving] = useState(false);
    const [shieldLoading, setShieldLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const categories = useMemo(() => piiCategoriesLocalized(t), [t]);

    // ── Dirty state ──────────────────────────────────────────────────────
    // Declared BEFORE the callbacks that read it: `selectOrg` guards on
    // `isDirty`, and a const referenced above its declaration is a temporal
    // dead zone throw on first render, not a lint warning.
    //
    // The payload as it stands right now — and the dirty comparand, so "what
    // changed" and "what we would send" can never diverge.
    const currentPayload = useMemo(() => (
        loadedDocRef.current === null ? null : buildPayload(loadedDocRef.current, {
            enabled, euModeEnabled, webSearchGuard, disableSearchOnUpload,
            monitorIntegrations, applyToAutomations, dlpEnabled, dlpMode,
            customSensitiveTerms, piiAllowTerms, piiAllowPublicOrgs, toolPiiPolicy,
            piiCategories, piiConfidenceThreshold, piiAction, piiFailureMode, showRawPayload,
        })
    ), [enabled, euModeEnabled, webSearchGuard, disableSearchOnUpload, monitorIntegrations,
        applyToAutomations, dlpEnabled, dlpMode, customSensitiveTerms, piiAllowTerms,
        piiAllowPublicOrgs, toolPiiPolicy, piiCategories, piiConfidenceThreshold, piiAction,
        piiFailureMode, showRawPayload]);

    const isDirty = !!currentPayload && !!snapshotRef.current
        && !deepEqual(currentPayload, snapshotRef.current);

    // Save is only meaningful when we hold a document we trust.
    const canSave = !!selectedOrgId && !loadError && !shieldLoading && currentPayload !== null;

    // Refresh / close with pending edits. In-app navigation cannot be guarded —
    // there is no router to hook — so this covers what it can and nothing
    // pretends otherwise.
    useEffect(() => {
        if (!isDirty) return undefined;
        const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [isDirty]);

    const fetchShield = useCallback(async (orgId) => {
        if (!orgId) return;
        setShieldLoading(true);
        setLoadError(null);
        try {
            const res = await authFetch(`${API_BASE}/api/org-privacy-shield/${orgId}`);
            if (!res.ok) {
                // A failed load used to leave every field at its constructor
                // default — "shield off, no categories, action block" — while
                // Save stayed live. One click then persisted that blank config
                // over the org's real one. Refusing to save is the only honest
                // state: we do not know what the configuration is.
                loadedDocRef.current = null;
                snapshotRef.current = null;
                setLoadError({ status: res.status });
                return;
            }
            const data = await res.json();
            const validIds = new Set(categories.map(c => c.id));
            const f = normaliseDoc(data, validIds);

            loadedDocRef.current = data;
            snapshotRef.current = buildPayload(data, f);

            setEnabled(f.enabled);
            setEuModeEnabled(f.euModeEnabled);
            setWebSearchGuard(f.webSearchGuard);
            setDisableSearchOnUpload(f.disableSearchOnUpload);
            setMonitorIntegrations(f.monitorIntegrations);
            setApplyToAutomations(f.applyToAutomations);
            setDlpEnabled(f.dlpEnabled);
            setDlpMode(f.dlpMode);
            setCustomSensitiveTerms(f.customSensitiveTerms);
            setPiiAllowTerms(f.piiAllowTerms);
            setPiiAllowPublicOrgs(f.piiAllowPublicOrgs);
            setToolPiiPolicy(f.toolPiiPolicy);
            setPiiCategories(f.piiCategories);
            setPiiConfidenceThreshold(f.piiConfidenceThreshold);
            setPiiAction(f.piiAction);
            setPiiFailureMode(f.piiFailureMode);
            setShowRawPayload(f.showRawPayload);

            // The server clamps fields the org's plan doesn't allow and reports
            // them in `clamped_fields`. Surface WHY the shown value differs from
            // what was picked — otherwise the setting looks like it "didn't save".
            if (Array.isArray(data.clamped_fields) && data.clamped_fields.length > 0) {
                setMessage({
                    type: 'warning',
                    text: data.clamped_fields.includes('piiDetectionAction')
                        ? 'Tokenize requires the Enterprise plan — PII action is enforced as Block on this plan.'
                        : 'Some settings are limited by your current plan.',
                });
            } else {
                setMessage(null);
            }
        } catch (e) {
            console.error('[OrgShield] Failed to fetch shield', e);
            loadedDocRef.current = null;
            snapshotRef.current = null;
            setLoadError({ status: 0 });
        } finally {
            setShieldLoading(false);
        }
    }, [categories]);

    // Mount: environment flags + the org list.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/ai/config`);
                if (res.ok && !cancelled) {
                    const data = await res.json();
                    setHasWebSearchEnabled(!!(data.searchProvider && data.searchProvider !== 'disabled'));
                }

                const euRes = await authFetch(`${API_BASE}/ai/config/chat-models-eu`);
                if (euRes.ok && !cancelled) {
                    const euModels = await euRes.json();
                    setHasEuModelsConfigured(
                        Object.values(euModels).some(tier => tier && tier.modelId && tier.modelId.trim() !== ''),
                    );
                }

                const orgRes = await authFetch(`${API_BASE}/auth/organizations`);
                if (orgRes.ok && !cancelled) {
                    const orgs = await orgRes.json();
                    setOrgList(orgs);
                    // `pinnedOrgId` is handled by its own effect — the embedding
                    // page resolves its org asynchronously and usually has not
                    // done so yet at this point.
                    if (orgs.length > 0 && !pinnedOrgId) {
                        if (allowOrgPicker) {
                            setSelectedOrgId(orgs[0].id);
                            fetchShield(orgs[0].id);
                        } else {
                            console.warn('[OrgShield] no orgId and no visible picker — refusing to guess which organisation to edit');
                            setShieldLoading(false);
                        }
                    }
                }
            } catch (e) {
                console.error('[OrgShield] Failed to fetch config', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Follow an explicitly-supplied organisation, including one that arrives
    // after mount. Guarded on `pinnedOrgId` alone so a picker selection in the
    // admin view is never overridden by a stale prop.
    useEffect(() => {
        if (!pinnedOrgId || pinnedOrgId === selectedOrgId) return;
        setSelectedOrgId(pinnedOrgId);
        fetchShield(pinnedOrgId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pinnedOrgId]);

    // Switching organisation reloads the form, discarding edits. It is the one
    // in-component navigation that can silently throw away work, so it is the
    // one place a confirm is honest rather than annoying.
    const selectOrg = useCallback((orgId) => {
        if (isDirty && typeof window !== 'undefined' && typeof window.confirm === 'function') {
            const ok = window.confirm('You have unsaved changes. Switching organisation will discard them.');
            if (!ok) return;
        }
        setSelectedOrgId(orgId);
        setMessage(null);
        fetchShield(orgId);
    }, [fetchShield, isDirty]);

    const save = useCallback(async () => {
        if (!selectedOrgId) return { ok: false };
        if (!currentPayload) {
            // Belt-and-braces behind the disabled button: without a loaded
            // document a save would write constructor defaults over real config.
            const text = 'Cannot save: the current settings could not be loaded.';
            setMessage({ type: 'error', text });
            return { ok: false, error: text };
        }
        setSaving(true);
        setMessage(null);
        try {
            const res = await authFetch(`${API_BASE}/api/org-privacy-shield/${selectedOrgId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentPayload),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const text = data.error || 'Failed to save.';
                setMessage({ type: 'error', text });
                return { ok: false, error: text };
            }

            // The save succeeded, so the server's row is the new baseline —
            // including any value it clamped or rejected below.
            if (data.config) loadedDocRef.current = data.config;
            snapshotRef.current = data.config
                ? buildPayload(data.config, normaliseDoc(data.config, new Set(categories.map(c => c.id))))
                : currentPayload;

            // Invalid custom terms are reported but the VALID ones are still
            // persisted, so this is a partial success. Ignoring `termErrors`
            // made a partial save read as a clean one and the admin never
            // learned that a pattern of theirs is not in force.
            const termErrors = Array.isArray(data.termErrors) ? data.termErrors : [];

            // A clamped field means the stored value differs from what was
            // submitted. Reflect the stored value and say why, rather than a
            // bare "saved" that hides the override.
            if (Array.isArray(data.clamped_fields) && data.clamped_fields.length > 0) {
                if (data.config?.piiDetectionAction) setPiiAction(data.config.piiDetectionAction);
                setMessage({
                    // A warning, not an error: the save DID happen. Painting
                    // "Saved. Note: …" in red read as a failure.
                    type: 'warning',
                    text: data.clamped_fields.includes('piiDetectionAction')
                        ? 'Saved. Note: Tokenize requires the Enterprise plan — PII action was saved as Block.'
                        : 'Saved. Note: some settings were adjusted to your plan limits.',
                });
                return { ok: true, clamped: data.clamped_fields, termErrors };
            }
            if (termErrors.length > 0) {
                setMessage({
                    type: 'warning',
                    text: `Saved, but ${termErrors.length} custom term(s) were rejected and are not in force.`,
                });
                return { ok: true, clamped: [], termErrors };
            }
            setMessage({ type: 'success', text: 'Saved.' });
            return { ok: true, clamped: [], termErrors: [] };
        } catch {
            setMessage({ type: 'error', text: 'Error saving.' });
            return { ok: false, error: 'Error saving.' };
        } finally {
            setSaving(false);
        }
    }, [selectedOrgId, currentPayload, categories]);

    // Toggle one PII category in a tool-class block list (external | internal).
    const toggleToolPiiCat = useCallback((cls, id, checked) => setToolPiiPolicy(prev => ({
        ...prev,
        [cls]: {
            blockCategories: checked
                ? [...new Set([...(prev[cls]?.blockCategories || []), id])]
                : (prev[cls]?.blockCategories || []).filter(x => x !== id),
        },
    })), []);

    const setToolPiiCats = useCallback((cls, ids) => setToolPiiPolicy(prev => ({
        ...prev,
        [cls]: { blockCategories: ids },
    })), []);

    return {
        loading, shieldLoading, saving, message, setMessage,
        loadError, isDirty, canSave,
        orgList, selectedOrgId, selectOrg,
        hasEuModelsConfigured, hasWebSearchEnabled,
        categories,
        save,
        toggleToolPiiCat, setToolPiiCats,
        fields: {
            enabled, setEnabled,
            euModeEnabled, setEuModeEnabled,
            webSearchGuard, setWebSearchGuard,
            disableSearchOnUpload, setDisableSearchOnUpload,
            monitorIntegrations, setMonitorIntegrations,
            applyToAutomations, setApplyToAutomations,
            dlpEnabled, setDlpEnabled,
            dlpMode, setDlpMode,
            customSensitiveTerms, setCustomSensitiveTerms,
            piiAllowTerms, setPiiAllowTerms,
            piiAllowPublicOrgs, setPiiAllowPublicOrgs,
            toolPiiPolicy,
            piiCategories, setPiiCategories,
            piiConfidenceThreshold, setPiiConfidenceThreshold,
            piiAction, setPiiAction,
            showRawPayload, setShowRawPayload,
        },
    };
}

export default useOrgShield;

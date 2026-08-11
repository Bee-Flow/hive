import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from '../../../hooks/useTranslation';
import { authFetch } from '../../../utils/helpers';
import { ShieldCheck, Scale, Bot, Settings as SettingsIcon, Inbox, BookOpen, ClipboardList, Siren, Gauge, ListChecks, FileText, AlertTriangle, ClipboardCheck, GraduationCap, Plug } from 'lucide-react';
import OverviewPage from './OverviewPage';
import ChecksPage from './ChecksPage';
import SettingsPage from './SettingsPage';
import DsrInboxPage from './DsrInboxPage';
import RopaPage from './RopaPage';
import DpiaPage from './DpiaPage';
import IncidentsPage from './IncidentsPage';
import SoaPage from './SoaPage';
import PoliciesPage from './PoliciesPage';
import IsoOverviewPage from './IsoOverviewPage';
import ConnectorsPage from './ConnectorsPage';
import RisksPage from './RisksPage';
import AuditPage from './AuditPage';
import TrainingPage from './TrainingPage';
import OnboardingWizard from './OnboardingWizard';
import { ToastHost, showToast } from '../guardrails/Toast';
import { CheckCardSkeleton } from './shared/Skeleton';

const API = (import.meta.env.VITE_API_URL || '') + '/api/compliance';
const API_DSR = (import.meta.env.VITE_API_URL || '') + '/api/dsr';
const OPTS = { credentials: 'include' };

// Two frameworks share the hub: the privacy pair (GDPR + EU AI Act, the
// original sections) and ISO 27001. The rail shows one framework's sections at
// a time; the framework is DERIVED from the active section id (iso_* → iso),
// so URLs and the settings nav adapter keep working unchanged.
const PRIVACY_SECTIONS = [
    { id: 'overview', labelKey: 'compliance.nav_overview', icon: ShieldCheck, color: '#10b981' },
    { id: 'gdpr', labelKey: 'compliance.nav_gdpr', icon: Scale, color: '#3b82f6' },
    { id: 'aia', labelKey: 'compliance.nav_aia', icon: Bot, color: '#8b5cf6' },
    { id: 'dsr', labelKey: 'compliance.nav_dsr', icon: Inbox, color: '#ef4444' },
    { id: 'incidents', labelKey: 'compliance.nav_incidents', icon: Siren, color: '#dc2626' },
    { id: 'ropa', labelKey: 'compliance.nav_ropa', icon: BookOpen, color: '#0ea5e9' },
    { id: 'dpia', labelKey: 'compliance.nav_dpia', icon: ClipboardList, color: '#f97316' },
    { id: 'settings', labelKey: 'compliance.nav_settings', icon: SettingsIcon, color: '#f59e0b' },
];
const ISO_SECTIONS = [
    { id: 'iso_overview', labelKey: 'compliance.nav_iso_overview', icon: Gauge, color: '#10b981' },
    { id: 'iso_controls', labelKey: 'compliance.nav_iso_controls', icon: ShieldCheck, color: '#0ea5e9' },
    { id: 'iso_soa', labelKey: 'compliance.nav_iso_soa', icon: ListChecks, color: '#8b5cf6' },
    { id: 'iso_policies', labelKey: 'compliance.nav_iso_policies', icon: FileText, color: '#f59e0b' },
    { id: 'iso_risks', labelKey: 'compliance.nav_iso_risks', icon: AlertTriangle, color: '#ef4444' },
    { id: 'iso_audit', labelKey: 'compliance.nav_iso_audit', icon: ClipboardCheck, color: '#dc2626' },
    { id: 'iso_training', labelKey: 'compliance.nav_iso_training', icon: GraduationCap, color: '#059669' },
    { id: 'iso_connectors', labelKey: 'compliance.nav_iso_connectors', icon: Plug, color: '#6366f1' },
];
const FRAMEWORKS = [
    { id: 'privacy', labelKey: 'compliance.fw_privacy', shortKey: 'compliance.fw_privacy_short', sections: PRIVACY_SECTIONS, home: 'overview' },
    { id: 'iso27001', labelKey: 'compliance.fw_iso', shortKey: 'compliance.fw_iso_short', sections: ISO_SECTIONS, home: 'iso_overview' },
];
const SECTIONS = [...PRIVACY_SECTIONS, ...ISO_SECTIONS];
const frameworkOf = (sectionId) => (String(sectionId).startsWith('iso_') ? 'iso27001' : 'privacy');

// authFetch, not bare fetch. It already sends `credentials: 'include'`, so
// behaviour in the product is unchanged — but it is also the single seam the
// public demo transport can intercept. A bare fetch here would go to the real
// /api/compliance as an anonymous visitor from the demo at /__demo__, which
// is exactly the failure the transport is built to make impossible.
async function fetchJson(url, init) {
    const r = await authFetch(url, { ...OPTS, ...(init || {}) });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
}

// `exportsEnabled` is the one concession to the public demo. Every register
// here offers a PDF or a zip, and those are plain `<a href download>` links —
// a browser navigation, so the demo transport cannot stand in for them and a
// visitor would get a 401 page instead of a document. The pages already treat
// a missing url as "no download button", so switching it off hides the
// affordance rather than breaking it.
export default function ComplianceHub({ activeSection = 'overview', focusCheckId = null, onNavigate, exportsEnabled = true }) {
    const { t } = useTranslation();
    const dl = (url) => (exportsEnabled ? url : null);
    const VALID = SECTIONS.map(s => s.id);
    const active = VALID.includes(activeSection) ? activeSection : 'overview';

    const [overview, setOverview] = useState(null);
    const [checks, setChecks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [rerunningId, setRerunningId] = useState(null);
    const [autoFixingId, setAutoFixingId] = useState(null);
    const [showWizard, setShowWizard] = useState(false);

    // Section-local data — fetched lazily when the section is first opened.
    const [dsrRequests, setDsrRequests] = useState(null);      // null = not loaded yet
    const [dsrBusyId, setDsrBusyId] = useState(null);
    const [ropa, setRopa] = useState(null);
    const [ropaBusy, setRopaBusy] = useState(false);
    const [dpiaList, setDpiaList] = useState(null);
    const [dpiaSavingId, setDpiaSavingId] = useState(null);
    const [incidents, setIncidents] = useState(null);
    const [incidentBusyId, setIncidentBusyId] = useState(null);

    const [scoreHistory, setScoreHistory] = useState([]);

    // Org member directory for the DPO / breach-recipient pickers. null = not
    // loaded; [] = failed or empty (pickers hide, free text stays available).
    const [orgUsers, setOrgUsers] = useState(null);

    // ISO 27001 — Statement of Applicability rows.
    const [soa, setSoa] = useState(null);
    const [soaBusyRef, setSoaBusyRef] = useState(null);

    // ISO 27001 — ISMS policy documents.
    const [isoDocs, setIsoDocs] = useState(null);
    const [docBusySlug, setDocBusySlug] = useState(null);

    // ISO 27001 — readiness dashboard.
    const [isoReadiness, setIsoReadiness] = useState(null);

    // ISO 27001 — evidence connectors.
    const [isoConnectors, setIsoConnectors] = useState(null);
    const [connBusyId, setConnBusyId] = useState(null);

    // ISO 27001 — ISMS process layer.
    const [isoRisks, setIsoRisks] = useState(null);
    const [riskBusyId, setRiskBusyId] = useState(null);
    const [isoAudit, setIsoAudit] = useState(null);
    const [auditBusy, setAuditBusy] = useState(false);
    const [independenceWarning, setIndependenceWarning] = useState(null);
    const [isoTraining, setIsoTraining] = useState(null);
    const [trainingBusyId, setTrainingBusyId] = useState(null);

    const refresh = useCallback(async () => {
        try {
            const [o, c, hist] = await Promise.all([
                fetchJson(`${API}/overview`),
                fetchJson(`${API}/checks`),
                fetchJson(`${API}/score-history?days=90`).catch(() => []),
            ]);
            setOverview(o);
            setChecks(Array.isArray(c) ? c : []);
            setScoreHistory(Array.isArray(hist) ? hist : []);
            if (!o?.onboarded) setShowWizard(true);
            if (o?.first_scan_ran) {
                showToast('success',
                    t('compliance.toast_first_scan', 'First compliance scan complete — review the score and open items below.'));
            }
        } catch (e) {
            console.error('[ComplianceHub] refresh error:', e.message);
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => { refresh(); }, [refresh]);

    const handleRunNow = async () => {
        setRunning(true);
        try {
            const r = await fetchJson(`${API}/checks/run`, { method: 'POST' });
            await refresh();
            showToast('success', t('compliance.toast_scan_complete', { score: r?.score?.score ?? '' }) ||
                `Compliance scan complete (score: ${r?.score?.score ?? '—'}/100)`);
        } catch (e) {
            console.error('[ComplianceHub] run error:', e.message);
            showToast('error', t('compliance.toast_scan_failed', 'Scan failed — see server logs'));
        } finally { setRunning(false); }
    };

    const handleRerun = async (checkId) => {
        setRerunningId(checkId);
        try {
            await fetchJson(`${API}/checks/${encodeURIComponent(checkId)}/run`, { method: 'POST' });
            await refresh();
            showToast('success', t('compliance.toast_check_rerun', 'Check re-run complete'));
        } catch (e) {
            console.error('[ComplianceHub] rerun error:', e.message);
            showToast('error', t('compliance.toast_check_failed', 'Could not re-run this check'));
        } finally { setRerunningId(null); }
    };

    const handleAutoFix = async (checkId) => {
        setAutoFixingId(checkId);
        try {
            const r = await fetchJson(`${API}/checks/${encodeURIComponent(checkId)}/auto-fix`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
            });
            await refresh();
            showToast('success', r?.result?.summary || t('compliance.toast_auto_fixed', 'Automatic fix applied'));
        } catch (e) {
            console.error('[ComplianceHub] auto-fix error:', e.message);
            showToast('error', t('compliance.toast_auto_fix_failed', 'Automatic fix failed — see server logs'));
        } finally { setAutoFixingId(null); }
    };

    // Audit trail per check — status timeline + hashed evidence rows. Fetched
    // on demand when a CheckCard's "History & evidence" expander opens.
    const handleLoadTrail = useCallback(async (checkId) => {
        const enc = encodeURIComponent(checkId);
        const [history, evidence] = await Promise.all([
            fetchJson(`${API}/checks/${enc}/history`).catch(() => []),
            fetchJson(`${API}/evidence/${enc}`).catch(() => []),
        ]);
        return { history, evidence };
    }, []);

    const handleSaveSettings = async (body) => {
        try {
            const saved = await fetchJson(`${API}/settings`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            await refresh();
            showToast('success', t('compliance.toast_settings_saved', 'Settings saved — running checks again…'));
            return saved;
        } catch (e) {
            showToast('error', t('compliance.toast_settings_failed', 'Could not save settings'));
            throw e;
        }
    };

    // Read-only pre-fill for the wizard — synthesised server-side from the
    // org's live config (providers → residency, admins → breach recipients).
    const handleAutoDetect = useCallback(
        () => fetchJson(`${API}/auto-detect-settings`, { method: 'POST' }),
        [],
    );

    // ── DSR inbox ──
    const refreshDsr = useCallback(async () => {
        try { setDsrRequests(await fetchJson(`${API_DSR}/requests`)); }
        catch (e) { console.error('[ComplianceHub] DSR fetch error:', e.message); setDsrRequests([]); }
    }, []);

    const handleDsrUpdate = async (id, body) => {
        setDsrBusyId(id);
        try {
            await fetchJson(`${API_DSR}/requests/${encodeURIComponent(id)}/fulfil`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            await Promise.all([refreshDsr(), refresh()]);
            showToast('success', t('compliance.dsr_toast_updated', 'Request updated'));
        } catch (e) {
            console.error('[ComplianceHub] DSR update error:', e.message);
            showToast('error', t('compliance.dsr_toast_update_failed', 'Could not update the request'));
        } finally { setDsrBusyId(null); }
    };

    // ── ROPA ──
    const refreshRopa = useCallback(async () => {
        try { setRopa(await fetchJson(`${API}/ropa`)); }
        catch (e) { console.error('[ComplianceHub] ROPA fetch error:', e.message); setRopa({ error: true }); }
    }, []);

    const handleRopaReview = async () => {
        setRopaBusy(true);
        try {
            await fetchJson(`${API}/ropa/review`, { method: 'POST' });
            await Promise.all([refreshRopa(), refresh()]);
            showToast('success', t('compliance.ropa_toast_reviewed', 'Processing register marked as reviewed'));
        } catch (e) {
            showToast('error', t('compliance.ropa_toast_review_failed', 'Could not mark the register as reviewed'));
        } finally { setRopaBusy(false); }
    };

    const handleSccToggle = async (operator, confirmed) => {
        setRopaBusy(true);
        try {
            await fetchJson(`${API}/settings/scc`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ operator, confirmed }),
            });
            await Promise.all([refreshRopa(), refresh()]);
            showToast('success', confirmed
                ? t('compliance.scc_toast_confirmed', 'SCC attestation recorded')
                : t('compliance.scc_toast_revoked', 'SCC attestation withdrawn'));
        } catch (e) {
            showToast('error', t('compliance.scc_toast_failed', 'Could not update the SCC attestation'));
        } finally { setRopaBusy(false); }
    };

    // ── DPIA ──
    const refreshDpia = useCallback(async () => {
        try { setDpiaList(await fetchJson(`${API}/dpia`)); }
        catch (e) { console.error('[ComplianceHub] DPIA fetch error:', e.message); setDpiaList([]); }
    }, []);

    const handleDpiaSave = async (agentId, body) => {
        setDpiaSavingId(agentId);
        try {
            await fetchJson(`${API}/dpia/${encodeURIComponent(agentId)}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            await Promise.all([refreshDpia(), refresh()]);
            showToast('success', t('compliance.dpia_toast_saved', 'DPIA recorded'));
        } catch (e) {
            showToast('error', t('compliance.dpia_toast_failed', 'Could not save the DPIA'));
        } finally { setDpiaSavingId(null); }
    };

    // ── Incidents (Art. 33/34) ──
    const refreshIncidents = useCallback(async () => {
        try { setIncidents(await fetchJson(`${API}/incidents`)); }
        catch (e) { console.error('[ComplianceHub] incidents fetch error:', e.message); setIncidents([]); }
    }, []);

    const handleIncidentCreate = async (body) => {
        try {
            await fetchJson(`${API}/incidents`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            await Promise.all([refreshIncidents(), refresh()]);
            showToast('success', t('compliance.inc_toast_created', 'Incident recorded — the 72-hour clock is running'));
        } catch (e) {
            showToast('error', t('compliance.inc_toast_failed', 'Could not save the incident'));
        }
    };

    const handleIncidentUpdate = async (id, body) => {
        setIncidentBusyId(id);
        try {
            await fetchJson(`${API}/incidents/${encodeURIComponent(id)}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            await Promise.all([refreshIncidents(), refresh()]);
            showToast('success', t('compliance.inc_toast_updated', 'Incident updated'));
        } catch (e) {
            showToast('error', t('compliance.inc_toast_failed', 'Could not save the incident'));
        } finally { setIncidentBusyId(null); }
    };

    const handleIncidentNotify = async (id) => {
        setIncidentBusyId(id);
        try {
            const r = await fetchJson(`${API}/incidents/${encodeURIComponent(id)}/notify-recipients`, { method: 'POST' });
            await refreshIncidents();
            showToast('success', t('compliance.inc_toast_notified', { count: r?.notified ?? '' }) ||
                `Breach recipients notified (${r?.notified ?? 0})`);
        } catch (e) {
            showToast('error', t('compliance.inc_toast_notify_failed', 'Could not send the notification — check breach recipients and SMTP'));
        } finally { setIncidentBusyId(null); }
    };

    // Lazy-load section data the first time each section opens.
    useEffect(() => {
        if (active === 'dsr' && dsrRequests === null) refreshDsr();
        if (active === 'ropa' && ropa === null) refreshRopa();
        if (active === 'dpia' && dpiaList === null) refreshDpia();
        if (active === 'incidents' && incidents === null) refreshIncidents();
    }, [active, dsrRequests, ropa, dpiaList, incidents, refreshDsr, refreshRopa, refreshDpia, refreshIncidents]);

    // Member directory — wizard, settings, SoA and policy owner pickers.
    useEffect(() => {
        if ((showWizard || active === 'settings' || active === 'iso_soa' || active === 'iso_policies') && orgUsers === null) {
            fetchJson(`${API}/org-users`)
                .then(u => setOrgUsers(Array.isArray(u) ? u : []))
                .catch(() => setOrgUsers([]));
        }
    }, [showWizard, active, orgUsers]);

    // ── ISO SoA handlers ──
    const refreshSoa = useCallback(async () => {
        try { setSoa(await fetchJson(`${API}/iso/soa`)); }
        catch (e) { setSoa({ error: e.message }); }
    }, []);

    const handleSoaSeed = async () => {
        setSoaBusyRef('seed');
        try {
            const r = await fetchJson(`${API}/iso/soa/seed`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
            await refreshSoa();
            showToast('success', t('compliance.soa_toast_seeded', { count: r?.inserted ?? 0 }) || `Seeded ${r?.inserted ?? 0} SoA rows`);
        } catch (e) {
            showToast('error', t('compliance.soa_toast_seed_failed', 'Could not seed the SoA'));
        } finally { setSoaBusyRef(null); }
    };

    const handleSoaUpdate = async (ref, patch) => {
        setSoaBusyRef(ref);
        try {
            await fetchJson(`${API}/iso/soa/${encodeURIComponent(ref)}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patch),
            });
            await refreshSoa();
        } catch (e) {
            showToast('error', t('compliance.soa_toast_save_failed', 'Could not save the SoA row'));
        } finally { setSoaBusyRef(null); }
    };

    useEffect(() => {
        if (active === 'iso_soa' && soa === null) refreshSoa();
    }, [active, soa, refreshSoa]);

    // ── ISMS policy document handlers ──
    const refreshIsoDocs = useCallback(async () => {
        try { setIsoDocs(await fetchJson(`${API}/iso/docs`)); }
        catch (e) { setIsoDocs({ error: e.message, documents: [], missing_seeds: [] }); }
    }, []);

    useEffect(() => {
        if (active === 'iso_policies' && isoDocs === null) refreshIsoDocs();
    }, [active, isoDocs, refreshIsoDocs]);

    useEffect(() => {
        if (active === 'iso_overview' && isoReadiness === null) {
            fetchJson(`${API}/iso/readiness`)
                .then(setIsoReadiness)
                .catch(e => setIsoReadiness({ error: e.message }));
        }
    }, [active, isoReadiness]);

    // ── Evidence connector handlers ──
    const refreshConnectors = useCallback(async () => {
        try { setIsoConnectors(await fetchJson(`${API}/iso/connectors`)); }
        catch (e) { setIsoConnectors([]); }
    }, []);

    useEffect(() => {
        if (active === 'iso_connectors' && isoConnectors === null) refreshConnectors();
    }, [active, isoConnectors, refreshConnectors]);

    const handleConnSave = async (id, patch) => {
        setConnBusyId(id);
        try {
            await fetchJson(`${API}/iso/connectors/${encodeURIComponent(id)}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patch),
            });
            await refreshConnectors();
            showToast('success', t('compliance.conn_toast_saved', 'Connector saved'));
        } catch (e) {
            showToast('error', t('compliance.conn_toast_save_failed', 'Could not save the connector'));
        } finally { setConnBusyId(null); }
    };

    const handleConnSweep = async (id) => {
        setConnBusyId(id);
        try {
            const r = await fetchJson(`${API}/iso/connectors/${encodeURIComponent(id)}/sweep`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
            await refreshConnectors();
            showToast('success', t('compliance.conn_toast_swept', { subjects: r?.subjects ?? 0, changed: r?.changed ?? 0 }) || `Sweep done — ${r?.subjects ?? 0} subject(s), ${r?.changed ?? 0} changed`);
        } catch (e) {
            await refreshConnectors();
            showToast('error', t('compliance.conn_toast_sweep_failed', 'Sweep failed — check the credential and settings'));
        } finally { setConnBusyId(null); }
    };

    const handleConnLoadConnections = async (id) => {
        try { return await fetchJson(`${API}/iso/connectors/${encodeURIComponent(id)}/connections`); }
        catch { return []; }
    };

    // ── ISMS process layer handlers ──
    const refreshRisks = useCallback(async () => {
        try { setIsoRisks(await fetchJson(`${API}/iso/risks`)); }
        catch (e) { setIsoRisks({ risks: [], treatments: [], stats: null, error: e.message }); }
    }, []);
    const refreshAudit = useCallback(async () => {
        try { setIsoAudit(await fetchJson(`${API}/iso/audit`)); }
        catch (e) { setIsoAudit({ audits: [], findings: [], reviews: [], ncs: [], objectives: [], mr_inputs: null, error: e.message }); }
    }, []);
    const refreshTraining = useCallback(async () => {
        try { setIsoTraining(await fetchJson(`${API}/iso/training`)); }
        catch (e) { setIsoTraining({ personnel: [], obligations: [], error: e.message }); }
    }, []);

    useEffect(() => {
        if (active === 'iso_risks' && isoRisks === null) refreshRisks();
        if (active === 'iso_audit' && isoAudit === null) refreshAudit();
        if (active === 'iso_training' && isoTraining === null) refreshTraining();
    }, [active, isoRisks, isoAudit, isoTraining, refreshRisks, refreshAudit, refreshTraining]);

    const _isoMutate = async (setBusy, busyKey, fn, refresh, errKey, errFallback) => {
        setBusy(busyKey);
        try { await fn(); await refresh(); }
        catch (e) { showToast('error', t(errKey, errFallback)); }
        finally { setBusy(null); }
    };

    const handleRiskCreate = (fields) => _isoMutate(setRiskBusyId, 'create',
        () => fetchJson(`${API}/iso/risks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) }),
        refreshRisks, 'compliance.risk_toast_failed', 'Could not save the risk');
    const handleRiskUpdate = (id, patch) => _isoMutate(setRiskBusyId, id,
        () => fetchJson(`${API}/iso/risks/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }),
        refreshRisks, 'compliance.risk_toast_failed', 'Could not save the risk');
    const handleRiskAddTreatment = (riskId, fields) => _isoMutate(setRiskBusyId, riskId,
        () => fetchJson(`${API}/iso/risks/${riskId}/treatments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) }),
        refreshRisks, 'compliance.risk_toast_failed', 'Could not save the treatment');
    const handleRiskSeed = () => _isoMutate(setRiskBusyId, 'seed',
        async () => {
            const r = await fetchJson(`${API}/iso/risks/seed`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
            showToast('success', t('compliance.risk_toast_seeded', 'Seeded {count} risk scenario(s)', { count: r?.inserted ?? 0 }));
        },
        refreshRisks, 'compliance.risk_toast_failed', 'Could not seed risks');

    const _auditMutate = (fn) => _isoMutate(setAuditBusy, true, fn, refreshAudit, 'compliance.audit_toast_failed', 'Could not save — try again');
    const handleCreateAudit = async (fields) => {
        // Independence probe (9.2.2): record the conflict before the audit exists.
        if (fields?.auditor_user_id) {
            try {
                const ind = await fetchJson(`${API}/iso/audit/independence/${encodeURIComponent(fields.auditor_user_id)}`);
                setIndependenceWarning(ind?.independent === false
                    // t() returns the raw KEY when a string is missing, so the
                    // old `t(...) || fallback` could never fire — the fallback
                    // belongs in the call itself.
                    ? t('compliance.audit_independence_warning',
                        'Independence conflict: this auditor {conflicts}',
                        { conflicts: (ind.conflicts || []).join('; ') })
                    : null);
            } catch { setIndependenceWarning(null); }
        }
        return _auditMutate(() => fetchJson(`${API}/iso/audits`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) }));
    };
    const handleUpdateAudit = (id, patch) => _auditMutate(() => fetchJson(`${API}/iso/audits/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }));
    const handleAddFinding = (auditId, fields) => _auditMutate(() => fetchJson(`${API}/iso/audits/${auditId}/findings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) }));
    const handleCreateReview = (fields) => _auditMutate(() => fetchJson(`${API}/iso/reviews`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...fields, inputs: isoAudit?.mr_inputs || {} }) }));
    const handleCreateNc = (fields) => _auditMutate(() => fetchJson(`${API}/iso/ncs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) }));
    const handleUpdateNc = (id, patch) => _auditMutate(() => fetchJson(`${API}/iso/ncs/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }));
    const handleCreateObjective = (fields) => _auditMutate(() => fetchJson(`${API}/iso/objectives`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) }));
    const handleUpdateObjective = (id, patch) => _auditMutate(() => fetchJson(`${API}/iso/objectives/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }));

    const handleTrainingAttest = (userId, note) => _isoMutate(setTrainingBusyId, userId,
        () => fetchJson(`${API}/iso/training/${encodeURIComponent(userId)}/attest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note }) }),
        refreshTraining, 'compliance.training_toast_failed', 'Could not record the attestation');
    const handleObligationCreate = (fields) => _isoMutate(setTrainingBusyId, 'create',
        () => fetchJson(`${API}/iso/obligations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) }),
        refreshTraining, 'compliance.obl_toast_failed', 'Could not save the obligation');
    const handleObligationComplete = (id) => _isoMutate(setTrainingBusyId, id,
        () => fetchJson(`${API}/iso/obligations/${id}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }),
        refreshTraining, 'compliance.obl_toast_failed', 'Could not complete the obligation');

    const handleDocSeed = async () => {
        setDocBusySlug('seed');
        try {
            const r = await fetchJson(`${API}/iso/docs/seed`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
            await refreshIsoDocs();
            showToast('success', t('compliance.policies_toast_seeded', { count: r?.inserted ?? 0 }) || `Seeded ${r?.inserted ?? 0} policy templates`);
        } catch (e) {
            showToast('error', t('compliance.policies_toast_seed_failed', 'Could not seed policy templates'));
        } finally { setDocBusySlug(null); }
    };

    const handleDocLoad = async (slug) => {
        try { return await fetchJson(`${API}/iso/docs/${encodeURIComponent(slug)}`); }
        catch { return null; }
    };

    const handleDocSave = async (slug, patch) => {
        setDocBusySlug(slug);
        try {
            await fetchJson(`${API}/iso/docs/${encodeURIComponent(slug)}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patch),
            });
            await refreshIsoDocs();
        } catch (e) {
            showToast('error', t('compliance.policies_toast_save_failed', 'Could not save the document'));
        } finally { setDocBusySlug(null); }
    };

    const handleDocPublish = async (slug) => {
        setDocBusySlug(slug);
        try {
            const doc = await fetchJson(`${API}/iso/docs/${encodeURIComponent(slug)}/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
            await refreshIsoDocs();
            showToast('success', t('compliance.policies_toast_published', { version: doc?.current_version ?? '' }) || `Published v${doc?.current_version}`);
        } catch (e) {
            showToast('error', t('compliance.policies_toast_publish_failed', 'Could not publish the document'));
        } finally { setDocBusySlug(null); }
    };

    const handleFinishWizard = async (body) => {
        try {
            await fetchJson(`${API}/settings/onboarded`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            setShowWizard(false);
            await refresh();
            showToast('success', t('compliance.toast_wizard_done', 'Setup complete — your first compliance scan is running'));
        } catch (e) {
            showToast('error', t('compliance.toast_wizard_failed', 'Could not save setup — try again'));
            throw e;
        }
    };

    const handleSectionClick = (id) => {
        if (onNavigate) onNavigate(`admin/compliance/${id}`);
    };

    const activeFramework = frameworkOf(active);
    const railSections = FRAMEWORKS.find(f => f.id === activeFramework)?.sections || PRIVACY_SECTIONS;

    return (
        <div style={styles.container}>
            {/* Sidebar */}
            <div style={styles.sidebar}>
                {/* Framework switcher — GDPR/AI vs ISO 27001 */}
                <div style={styles.fwSwitch}>
                    {FRAMEWORKS.map(fw => {
                        const on = fw.id === activeFramework;
                        return (
                            <button key={fw.id}
                                onClick={() => { if (!on) handleSectionClick(fw.home); }}
                                title={t(fw.labelKey)}
                                style={{
                                    ...styles.fwBtn,
                                    background: on ? 'var(--accent-primary, #6366f1)' : 'transparent',
                                    color: on ? '#fff' : 'var(--text-muted, #888)',
                                }}>
                                {t(fw.shortKey)}
                            </button>
                        );
                    })}
                </div>
                {railSections.map(sec => {
                    const Icon = sec.icon;
                    const isActive = active === sec.id;
                    return (
                        <button key={sec.id}
                            onClick={() => handleSectionClick(sec.id)}
                            title={t(sec.labelKey)}
                            style={{
                                ...styles.navBtn,
                                background: isActive ? `${sec.color}20` : 'transparent',
                                borderLeft: isActive ? `3px solid ${sec.color}` : '3px solid transparent',
                            }}>
                            <Icon style={{
                                width: 20, height: 20,
                                color: isActive ? sec.color : 'var(--text-muted, #888)',
                            }} />
                            <span style={{
                                fontSize: 9, fontWeight: isActive ? 700 : 500,
                                color: isActive ? sec.color : 'var(--text-muted, #888)',
                                textAlign: 'center', lineHeight: 1.1,
                            }}>{t(sec.labelKey)}</span>
                        </button>
                    );
                })}
            </div>

            {/* Main */}
            <div style={styles.main}>
                <div style={styles.topBar}>
                    <div>
                        <h2 style={styles.pageTitle}>{t(SECTIONS.find(s => s.id === active)?.labelKey)}</h2>
                        <p style={styles.pageDesc}>{t(`compliance.nav_${active}_desc`)}</p>
                    </div>
                </div>
                <div style={styles.content}>
                    {!overview?.onboarded && !showWizard && active !== 'settings' && !loading ? (
                        <div style={banner}>
                            <div>
                                <strong style={{ fontSize: 14, color: 'var(--text-primary, #fff)' }}>{t('compliance.banner_onboard_title')}</strong>
                                <div style={{ fontSize: 12, color: 'var(--text-muted, #aaa)', marginTop: 4 }}>{t('compliance.banner_onboard_desc')}</div>
                            </div>
                            <button onClick={() => setShowWizard(true)} style={{
                                background: '#10b981', color: '#fff', border: 'none',
                                padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                                fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                            }}>{t('compliance.start_wizard')}</button>
                        </div>
                    ) : null}

                    {active === 'overview' && (
                        <OverviewPage overview={overview} checks={checks}
                            scoreHistory={scoreHistory}
                            reportUrl={dl(`${API}/report.pdf`)}
                            running={running} loading={loading}
                            onRunNow={handleRunNow} onNavigate={onNavigate}
                            onStartWizard={() => setShowWizard(true)} />
                    )}
                    {active === 'gdpr' && (
                        <ChecksPage checks={checks} regulation="GDPR" loading={loading}
                            onNavigate={onNavigate} onRerun={handleRerun} rerunningId={rerunningId}
                            onAutoFix={handleAutoFix} autoFixingId={autoFixingId}
                            onLoadTrail={handleLoadTrail}
                            focusCheckId={focusCheckId} />
                    )}
                    {active === 'aia' && (
                        <ChecksPage checks={checks} regulation="AIA" loading={loading}
                            onNavigate={onNavigate} onRerun={handleRerun} rerunningId={rerunningId}
                            onAutoFix={handleAutoFix} autoFixingId={autoFixingId}
                            onLoadTrail={handleLoadTrail}
                            focusCheckId={focusCheckId} />
                    )}
                    {active === 'dsr' && (
                        <DsrInboxPage requests={dsrRequests} busyId={dsrBusyId}
                            onUpdate={handleDsrUpdate} onRefresh={refreshDsr}
                            exportUrlFor={(id) => dl(`${API_DSR}/requests/${encodeURIComponent(id)}/export`)}
                            focusId={focusCheckId} />
                    )}
                    {active === 'incidents' && (
                        <IncidentsPage incidents={incidents} busyId={incidentBusyId}
                            onCreate={handleIncidentCreate} onUpdate={handleIncidentUpdate}
                            onNotify={handleIncidentNotify} focusId={focusCheckId} />
                    )}
                    {active === 'ropa' && (
                        <RopaPage ropa={ropa} busy={ropaBusy}
                            pdfUrl={dl(`${API}/ropa.pdf`)}
                            onReview={handleRopaReview} onSccToggle={handleSccToggle}
                            onRefresh={refreshRopa} />
                    )}
                    {active === 'dpia' && (
                        <DpiaPage checks={checks} dpiaList={dpiaList} savingId={dpiaSavingId}
                            pdfUrlFor={(agentId) => dl(`${API}/dpia/${encodeURIComponent(agentId)}/pdf`)}
                            onSave={handleDpiaSave} focusId={focusCheckId} />
                    )}
                    {active === 'settings' && (
                        loading
                            ? <CheckCardSkeleton count={3} />
                            : <SettingsPage settings={overview?.settings} onSave={handleSaveSettings} orgUsers={orgUsers} />
                    )}
                    {active === 'iso_overview' && (
                        <IsoOverviewPage readiness={isoReadiness}
                            soaPdfUrl={dl(`${API}/iso/soa.pdf`)}
                            clausePdfUrl={dl(`${API}/iso/clause-conformity.pdf`)}
                            riskPdfUrl={dl(`${API}/iso/risks.pdf`)}
                            policyPackUrl={dl(`${API}/iso/policy-pack.pdf`)}
                            bundleUrl={dl(`${API}/iso/evidence-bundle.zip`)}
                            onNavigate={onNavigate} />
                    )}
                    {active === 'iso_controls' && (
                        <ChecksPage checks={checks} regulation="ISO27001" loading={loading}
                            onNavigate={onNavigate} onRerun={handleRerun} rerunningId={rerunningId}
                            onAutoFix={handleAutoFix} autoFixingId={autoFixingId}
                            onLoadTrail={handleLoadTrail}
                            focusCheckId={focusCheckId} />
                    )}
                    {active === 'iso_soa' && (
                        <SoaPage soa={soa} checks={checks} busyRef={soaBusyRef}
                            onSeed={handleSoaSeed} onUpdate={handleSoaUpdate}
                            orgUsers={orgUsers} />
                    )}
                    {active === 'iso_policies' && (
                        <PoliciesPage docs={isoDocs} busySlug={docBusySlug}
                            onSeed={handleDocSeed} onSave={handleDocSave}
                            onPublish={handleDocPublish} onLoadDoc={handleDocLoad}
                            orgUsers={orgUsers} />
                    )}
                    {active === 'iso_connectors' && (
                        <ConnectorsPage connectors={isoConnectors} busyId={connBusyId}
                            onSave={handleConnSave} onSweep={handleConnSweep}
                            onLoadConnections={handleConnLoadConnections} />
                    )}
                    {active === 'iso_risks' && (
                        <RisksPage risks={isoRisks?.risks ?? null} treatments={isoRisks?.treatments || []}
                            stats={isoRisks?.stats || null} busyId={riskBusyId}
                            onCreate={handleRiskCreate} onUpdate={handleRiskUpdate}
                            onAddTreatment={handleRiskAddTreatment} onSeed={handleRiskSeed}
                            orgUsers={orgUsers} />
                    )}
                    {active === 'iso_audit' && (
                        <AuditPage audits={isoAudit?.audits ?? null} findings={isoAudit?.findings || []}
                            reviews={isoAudit?.reviews || []} ncs={isoAudit?.ncs || []}
                            objectives={isoAudit?.objectives || []} busy={auditBusy}
                            independenceWarning={independenceWarning}
                            mrInputs={isoAudit?.mr_inputs || null}
                            onCreateAudit={handleCreateAudit} onUpdateAudit={handleUpdateAudit}
                            onAddFinding={handleAddFinding} onCreateReview={handleCreateReview}
                            onCreateNc={handleCreateNc} onUpdateNc={handleUpdateNc}
                            onCreateObjective={handleCreateObjective} onUpdateObjective={handleUpdateObjective}
                            orgUsers={orgUsers} />
                    )}
                    {active === 'iso_training' && (
                        <TrainingPage personnel={isoTraining?.personnel ?? null}
                            obligations={isoTraining?.obligations ?? null} busyId={trainingBusyId}
                            onAttest={handleTrainingAttest}
                            onCreateObligation={handleObligationCreate}
                            onCompleteObligation={handleObligationComplete}
                            orgUsers={orgUsers} />
                    )}
                </div>
            </div>

            {showWizard && (
                <OnboardingWizard
                    initialSettings={overview?.settings}
                    onAutoDetect={handleAutoDetect}
                    onFinish={handleFinishWizard}
                    onSkip={() => setShowWizard(false)}
                    orgUsers={orgUsers}
                />
            )}

            <ToastHost />

            <style>{`
                @keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
                @keyframes dropdownIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
}

const styles = {
    container: { display: 'flex', height: '100%', overflow: 'hidden', fontFamily: 'var(--font-family, Inter, sans-serif)' },
    sidebar: {
        width: 56, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2,
        padding: '8px 0',
        background: 'var(--bg-secondary, #111)',
        borderRight: '1px solid var(--border-default, rgba(255,255,255,0.08))',
    },
    navBtn: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        padding: '10px 4px', margin: '0 4px',
        borderRadius: 8, border: 'none',
        cursor: 'pointer', transition: 'all 0.15s',
    },
    fwSwitch: {
        display: 'flex', flexDirection: 'column', gap: 2,
        margin: '0 4px 6px', padding: 2, borderRadius: 8,
        background: 'var(--bg-tertiary, rgba(255,255,255,0.05))',
    },
    fwBtn: {
        border: 'none', borderRadius: 6, padding: '5px 2px',
        fontSize: 8.5, fontWeight: 700, letterSpacing: '0.02em',
        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
        textAlign: 'center', lineHeight: 1.2,
    },
    main: {
        flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        background: 'var(--bg-primary, #0f0f1a)',
    },
    topBar: {
        padding: '16px 24px',
        borderBottom: '1px solid var(--border-default, rgba(255,255,255,0.06))',
        flexShrink: 0,
    },
    pageTitle: { fontSize: 18, fontWeight: 700, color: 'var(--text-primary, #fff)', margin: 0 },
    pageDesc: { fontSize: 12, color: 'var(--text-muted, #888)', margin: '2px 0 0', fontWeight: 400 },
    content: { flex: 1, overflow: 'auto', padding: '20px 24px' },
};

const banner = {
    background: 'var(--bg-secondary, #1a1a2e)',
    border: '1px solid #10b98133',
    borderLeft: '4px solid #10b981',
    borderRadius: 10, padding: 16, marginBottom: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
};

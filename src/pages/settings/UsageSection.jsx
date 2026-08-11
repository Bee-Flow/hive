import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { useTranslation } from '../../hooks/useTranslation';
import {
    Bot, Filter, X, Cpu, Users, ChevronDown, Activity, BarChart3,
    AlertTriangle, ThumbsUp,
} from 'lucide-react';
import OrgFeedbackPanel from './OrgFeedbackPanel';
import OrgTerminationsPanel from './OrgTerminationsPanel';
import { useLicenseContext } from '../../components/LicenseContext';
import { useDeploymentMode } from '../../hooks/useDeploymentMode';
import { deriveRangeParams, USAGE_ALL_DAYS, buildModelTierMap, tierForModel } from '../../utils/usageHelpers';
import { shortModel } from './usage/format';
import { getSourceDetails } from './usage/widgets';
import RangeControl, { defaultRange } from './usage/RangeControl';
import OverviewTab from './usage/OverviewTab';

/* ── Report tabs ─────────────────────────────────────────────────────────── */
// Safety & Integrations moved to Settings → Organisation → Privacy Shield →
// "What happened" (?tab=activity) — they are shield monitoring, not
// consumption reporting. This page keeps the money/usage reports.
const REPORT_TABS = [
    { id: 'overview', labelKey: 'usage.tab_overview', icon: BarChart3, color: '#0ea5e9' },
    { id: 'feedback', labelKey: 'usage.tab_feedback', icon: ThumbsUp, color: '#10b981' },
    { id: 'terminations', labelKey: 'usage.tab_terminations', icon: AlertTriangle, color: '#f43f5e' },
];

const ReportTabBar = ({ active, onChange, t: translate, tabs = REPORT_TABS }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderBottom: '1px solid var(--border-default, var(--border-subtle))' }}>
        {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = active === tab.id;
            return (
                <button key={tab.id} onClick={() => onChange(tab.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: isActive ? 'var(--bg-secondary)' : 'transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: isActive ? 500 : 400, fontSize: 13, transition: 'background 0.15s ease, color 0.15s ease',
                }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                    <Icon style={{ width: 14, height: 14, color: isActive ? tab.color : 'var(--text-muted)' }} />
                    {translate(tab.labelKey)}
                </button>
            );
        })}
    </div>
);

/* ── Filter pill (Users / Agents / Models / Sources) ─────────────────────── */
const FilterPill = ({ icon: Icon, value, onChange, options, placeholder }) => (
    <div style={{ position: 'relative' }}>
        <div style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8,
            background: value ? 'var(--accent-primary)' : 'var(--bg-primary)',
            border: `1px solid ${value ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
            fontSize: 12, fontWeight: 500, color: value ? '#fff' : 'var(--text-secondary)', transition: 'all 0.15s ease',
        }}>
            {Icon && <Icon style={{ width: 12, height: 12, flexShrink: 0 }} />}
            <select value={value || ''} onChange={(e) => onChange(e.target.value || null)} style={{
                background: 'transparent', border: 'none', outline: 'none', color: 'inherit', fontSize: 12, fontWeight: 500,
                cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', minWidth: 60, paddingRight: 14,
            }}>
                <option value="">{placeholder}</option>
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown style={{ width: 11, height: 11, position: 'absolute', right: 8, pointerEvents: 'none', opacity: 0.5 }} />
        </div>
    </div>
);

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  MAIN CONTAINER                                                            */
/* ═══════════════════════════════════════════════════════════════════════════ */
const UsageSection = ({ initialReport = '' }) => {
    const { t } = useTranslation();
    const { hasFeature: hasLicenseFeature } = useLicenseContext();
    const { isSelfHosted } = useDeploymentMode();

    // `advanced_usage_monitoring` (Enterprise+) gates every non-Overview tab.
    const canSeeAdvancedUsage = hasLicenseFeature('advanced_usage_monitoring');
    const visibleTabs = useMemo(
        () => canSeeAdvancedUsage ? REPORT_TABS : REPORT_TABS.filter(tab => tab.id === 'overview'),
        [canSeeAdvancedUsage]
    );

    const [range, setRange] = useState(() => defaultRange('30d'));
    const rangeParams = useMemo(() => deriveRangeParams(range), [range]);
    const [loading, setLoading] = useState(true);
    // initialReport lets deep links open a specific report tab. Unknown values
    // — including the RETIRED 'safety'/'integrations' ids from old bookmarks —
    // fall back to overview; the license bounce below still wins for
    // non-Enterprise orgs. (Those reports now live on the Privacy Shield's
    // Activity tab: /app/settings/organisation/privacy?tab=activity.)
    const [activeReport, setActiveReport] = useState(() =>
        REPORT_TABS.some(tab => tab.id === initialReport) ? initialReport : 'overview');

    useEffect(() => {
        if (initialReport && REPORT_TABS.some(tab => tab.id === initialReport)) setActiveReport(initialReport);
    }, [initialReport]);

    useEffect(() => {
        if (!canSeeAdvancedUsage && activeReport !== 'overview') setActiveReport('overview');
    }, [canSeeAdvancedUsage, activeReport]);

    // Subscription (customer-view header: plan, billing, cost cap).
    const [subscription, setSubscription] = useState(null);
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const permsRes = await authFetch(`${API_BASE}/auth/my-permissions`);
                if (!permsRes.ok) return;
                const perms = await permsRes.json();
                const orgId = (perms?.organizations || [])[0];
                if (!orgId) return;
                const subRes = await authFetch(`${API_BASE}/api/subscriptions/orgs/${orgId}`);
                if (!subRes.ok) return;
                const sub = await subRes.json();
                if (!cancelled) setSubscription(sub);
            } catch (_) { /* non-fatal */ }
        })();
        return () => { cancelled = true; };
    }, []);

    // Model → tier map (cloud view badges).
    const [modelTierMap, setModelTierMap] = useState({});
    // Raw tiers config retained so the customer "By tier" breakdown can resolve
    // custom-tier display labels (tierLabel needs the tier object for `custom:*`).
    const [modelTiers, setModelTiers] = useState({});
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/ai/config/tiers-for-user?taskType=direct_chat`);
                if (!res.ok) return;
                const d = await res.json();
                const tiers = d?.tiers || d?.modelTiers || d;
                if (!cancelled) {
                    setModelTierMap(buildModelTierMap(tiers));
                    setModelTiers(tiers && typeof tiers === 'object' ? tiers : {});
                }
            } catch (_) { /* non-fatal — falls back to model-only badges */ }
        })();
        return () => { cancelled = true; };
    }, []);
    const tierFor = useCallback((model) => tierForModel(modelTierMap, model), [modelTierMap]);

    // Cross-cutting filters
    const [filterUser, setFilterUser] = useState(null);
    const [filterAgent, setFilterAgent] = useState(null);
    const [filterModel, setFilterModel] = useState(null);
    const [filterSource, setFilterSource] = useState(null);
    const hasFilters = filterUser || filterAgent || filterModel || filterSource;
    const clearFilters = () => { setFilterUser(null); setFilterAgent(null); setFilterModel(null); setFilterSource(null); };

    const [data, setData] = useState({ summary: null, timeline: [], users: [], sources: [], agents: [], models: [], modelsByAgent: [], modelsByUser: [] });
    const [azureServices, setAzureServices] = useState({ summary: null, byType: [], byUser: [] });

    // Backend redacts token/call counts for cloud non-admin customers and swaps
    // estimated_cost for marked-up billed_cost. Detect that shape.
    const isCustomerView = data.summary && data.summary.total_calls === undefined && data.summary.billed_cost !== undefined;
    // Single source of truth for token visibility: self-hosted always; cloud only
    // for admins (who keep total_calls). Defaults to hidden in cloud until the
    // summary loads, so tokens never flash for a customer.
    const showTokens = isSelfHosted || (data.summary != null && !isCustomerView);

    const buildQS = useCallback(() => {
        const params = new URLSearchParams();
        // Always send a day count (works with today's days-only usage routes);
        // also send startDate/endDate so the routes use the exact window once the
        // backend tweak ships. 'all' → large day fallback.
        params.set('days', String(rangeParams.days ?? USAGE_ALL_DAYS));
        if (rangeParams.startDate) params.set('startDate', rangeParams.startDate);
        if (rangeParams.endDate) params.set('endDate', rangeParams.endDate);
        if (filterUser) params.set('user', filterUser);
        if (filterAgent) params.set('agent', filterAgent);
        // Customers see tiers, not models, and have no model filter pill — never
        // let a stale model filter scope their dashboard to a hidden model id.
        if (filterModel && !isCustomerView) params.set('model', filterModel);
        if (filterSource) params.set('source', filterSource);
        return params.toString();
    }, [rangeParams, filterUser, filterAgent, filterModel, filterSource, isCustomerView]);

    useEffect(() => {
        const fetchUsage = async () => {
            setLoading(true);
            try {
                const qs = buildQS();
                const sj = async (r, fb) => { try { if (!r.ok) return fb; const d = await r.json(); return d?.error ? fb : d; } catch { return fb; } };
                const sa = async (r) => { const d = await sj(r, []); return Array.isArray(d) ? d : []; };

                const eps = ['summary', 'timeline', 'users', 'sources', 'agents', 'models', 'models-by-agent', 'models-by-user'];
                const results = await Promise.all(eps.map(ep => authFetch(`${API_BASE}/api/usage/${ep}?${qs}`)));
                setData({
                    summary: await sj(results[0], {}),
                    timeline: await sa(results[1]),
                    users: await sa(results[2]),
                    sources: await sa(results[3]),
                    agents: await sa(results[4]),
                    models: await sa(results[5]),
                    modelsByAgent: await sa(results[6]),
                    modelsByUser: await sa(results[7]),
                });

                // The guardrails/integrations blocks (19 requests) left with
                // the Safety & Integrations tabs — see the Privacy Shield
                // Activity tab, which fetches its two consolidated overviews
                // only when it is actually open.
                const azEps = ['azure-services/summary', 'azure-services/by-type', 'azure-services/by-user'];
                const azResults = await Promise.all(azEps.map(ep => authFetch(`${API_BASE}/api/usage/${ep}?${qs}`)));
                setAzureServices({
                    summary: await sj(azResults[0], {}),
                    byType: await sa(azResults[1]),
                    byUser: await sa(azResults[2]),
                });
            } catch (err) { console.error('Failed to load usage', err); }
            setLoading(false);
        };
        fetchUsage();
    }, [buildQS]);

    // Filter dropdown options
    const userOptions = useMemo(() => data.users.map(u => ({ value: u.user_id, label: u.display_name || u.user_id })), [data.users]);
    const agentOptions = useMemo(() => data.agents.map(a => ({ value: a.agent_id || a.agent_name, label: a.agent_name || 'Direct Chat' })), [data.agents]);
    const modelOptions = useMemo(() => data.models.map(m => ({ value: m.model, label: shortModel(m.model) })), [data.models]);
    const sourceOptions = useMemo(() => data.sources.map(s => ({ value: s.source, label: getSourceDetails(s.source).label })), [data.sources]);

    const isPanelTab = activeReport === 'feedback' || activeReport === 'terminations';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}>
            {/* Page header + global range control */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0, flex: 1 }}>
                    <h2 data-tour="usage-summary" style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{t('usage.title')}</h2>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>·</span>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('usage.subtitle')}</p>
                </div>
                <RangeControl range={range} onChange={setRange} t={t} />
            </div>

            <ReportTabBar active={activeReport} onChange={setActiveReport} t={t} tabs={visibleTabs} />

            {/* Cross-cutting filter bar — usage tabs only */}
            <div style={{
                display: isPanelTab ? 'none' : 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                padding: '6px 10px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 2 }}>
                    <Filter style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('usage.filters')}</span>
                </div>
                <FilterPill icon={Users} value={filterUser} onChange={setFilterUser} options={userOptions} placeholder={t('usage.all_users')} />
                <FilterPill icon={Bot} value={filterAgent} onChange={setFilterAgent} options={agentOptions} placeholder={t('usage.all_agents')} />
                {/* Model filter hidden in the customer view — models are abstracted to tiers there. */}
                {!isCustomerView && (
                    <FilterPill icon={Cpu} value={filterModel} onChange={setFilterModel} options={modelOptions} placeholder={t('usage.all_models')} />
                )}
                <FilterPill icon={Activity} value={filterSource} onChange={setFilterSource} options={sourceOptions} placeholder={t('usage.all_sources')} />
                {hasFilters && (
                    <button onClick={clearFilters} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, border: 'none', background: 'var(--bg-tertiary)', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <X style={{ width: 10, height: 10 }} /> {t('usage.clear')}
                    </button>
                )}
            </div>

            {loading && !isPanelTab ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                        {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 80, borderRadius: 12, background: 'var(--bg-tertiary)', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
                    </div>
                    <div style={{ height: 90, borderRadius: 12, background: 'var(--bg-tertiary)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                </div>
            ) : (
                <>
                    {activeReport === 'overview' && (
                        <OverviewTab
                            t={t} data={data} subscription={subscription} isCustomerView={isCustomerView}
                            showTokens={showTokens} tierForModel={tierFor} modelTiers={modelTiers} azureServices={azureServices}
                            setFilterUser={setFilterUser} setFilterModel={setFilterModel} setFilterSource={setFilterSource}
                        />
                    )}
                    {activeReport === 'feedback' && <OrgFeedbackPanel rangeParams={rangeParams} showTokens={showTokens} />}
                    {activeReport === 'terminations' && <OrgTerminationsPanel rangeParams={rangeParams} showTokens={showTokens} />}
                </>
            )}
        </div>
    );
};

export default UsageSection;

// Overview tab of the Usage & Monitoring dashboard.
//
// Two render paths:
//  • Full view (self-hosted or cloud-admin, showTokens=true): cost hero + token/
//    cost breakdowns, exactly as before.
//  • Cloud customer view (isCustomerView=true / showTokens=false): tokens & call
//    counts are absent from the redacted payload — show AI-usage-vs-cap, plan/
//    billing, and model+tier + %-share breakdowns instead.

import {
    Users, Cpu, Activity, Bot, DollarSign, Zap, BarChart3, Server,
    FileText, ShieldCheck, ScanEye, Binary, ChevronRight, TrendingUp, CreditCard,
} from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import { fNum, fCur, currencySym, formatDateRange, shortModel } from './format';
import {
    Card, MetricCard, MetricGrid, MonitorHero, TabHeader, AlertBanner,
    SectionTitle, ListRow, TrendChip, CollapsibleSection, ShowMore, EmptyInline, TOKENS,
} from './kit';
import { Avatar, IconBadge, getSourceDetails } from './widgets';
import { tierLabel, TIER_META } from '../../../components/tierMeta';
import { paletteColor as getColor, OVERVIEW_COST_ALERT } from '../../../config/analyticsConfig';
import { computeHalfPeriodDelta } from '../../../utils/usageHelpers';

// ── Overview-local primitives (used only here) ───────────────────────────────
const InOutBar = ({ input, output, height = 5, style }) => {
    const total = (input || 0) + (output || 0);
    if (total === 0) return <div style={{ width: '100%', height, borderRadius: 99, background: 'var(--bg-tertiary)', ...style }} />;
    const inputPct = ((input || 0) / total) * 100;
    return (
        <div style={{ width: '100%', height, borderRadius: 99, background: 'var(--bg-tertiary)', overflow: 'hidden', display: 'flex', ...style }}>
            <div style={{ height: '100%', width: `${inputPct}%`, background: '#3b82f6', borderRadius: '99px 0 0 99px', transition: 'width 0.4s ease' }} />
            <div style={{ height: '100%', flex: 1, background: '#f59e0b', borderRadius: '0 99px 99px 0', transition: 'width 0.4s ease' }} />
        </div>
    );
};

const InOutLabel = ({ input, output, inputCost, outputCost, showCost }) => (
    <div style={{ display: 'flex', gap: showCost ? 16 : 12, fontSize: 11, color: 'var(--text-muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ color: '#3b82f6', fontWeight: 600 }}>↘ {fNum(input)}</span>
            {showCost && <span style={{ color: '#3b82f6', opacity: 0.7, fontWeight: 500 }}>({fCur(inputCost)})</span>}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ color: '#f59e0b', fontWeight: 600 }}>↗ {fNum(output)}</span>
            {showCost && <span style={{ color: '#f59e0b', opacity: 0.7, fontWeight: 500 }}>({fCur(outputCost)})</span>}
        </span>
    </div>
);

const Legend = ({ inputLabel, outputLabel }) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#3b82f6', display: 'inline-block' }} /> {inputLabel}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#f59e0b', display: 'inline-block' }} /> {outputLabel}
        </span>
    </div>
);

const TrendChart = ({ timeline, title, avgLabel, noDataLabel, valueField = 'total_tokens', valueFormatter }) => {
    if (!timeline?.length) return (
        <div style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 10 }}>
            {noDataLabel}
        </div>
    );
    const get = (t) => Number(t?.[valueField]) || 0;
    const maxVal = Math.max(...timeline.map(get), 1);
    const points = timeline.map((t, i) => {
        const x = (i / Math.max(timeline.length - 1, 1)) * 100;
        const y = 100 - (get(t) / maxVal) * 100;
        return `${x},${y}`;
    }).join(' ');
    const avgDay = (timeline.reduce((s, t) => s + get(t), 0) / timeline.length);
    const fmt = valueFormatter || fNum;
    return (
        <Card style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TrendingUp style={{ width: 13, height: 13, color: 'var(--accent-primary)', opacity: 0.7 }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{avgLabel.replace('{value}', fmt(avgDay))}</span>
            </div>
            <div style={{ height: 56, width: '100%', position: 'relative' }}>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    <defs>
                        <linearGradient id="ovTrendFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <polygon points={`0,100 ${points} 100,100`} fill="url(#ovTrendFill)" />
                    <polyline points={points} fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>
        </Card>
    );
};

export default function OverviewTab({
    t, data, subscription, isCustomerView, showTokens, tierForModel, modelTiers = {},
    azureServices, setFilterUser, setFilterModel, setFilterSource,
}) {
    const [expandedAgent, setExpandedAgent] = useState(null);
    const [muShow, setMuShow] = useState(20);
    const modelByUserRef = useRef(null);

    const agentModelGroups = useMemo(() => {
        const map = new Map();
        for (const row of data.modelsByAgent || []) {
            const key = row.agent_name || 'Direct Chat';
            if (!map.has(key)) map.set(key, { agent_name: key, agent_id: row.agent_id, models: [], total_tokens: 0, estimated_cost: 0 });
            const group = map.get(key);
            group.models.push(row);
            group.total_tokens += row.total_tokens || 0;
            group.estimated_cost += row.estimated_cost || 0;
        }
        return Array.from(map.values()).sort((a, b) => b.total_tokens - a.total_tokens);
    }, [data.modelsByAgent]);

    const tableHeaders = [
        { key: 'usage.user', align: 'left' },
        { key: 'usage.model', align: 'left' },
        { key: 'usage.in_tokens', align: 'right', color: '#3b82f6' },
        { key: 'usage.out_tokens', align: 'right', color: '#f59e0b' },
        { key: 'usage.total', align: 'right' },
        { key: 'usage.in_cost', align: 'right', color: '#3b82f6' },
        { key: 'usage.out_cost', align: 'right', color: '#f59e0b' },
        { key: 'usage.total_cost', align: 'right' },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: TOKENS.pagePad }}>
            <TabHeader icon={BarChart3} iconColor="#0ea5e9" title={t('usage.tab_overview')} description={t('usage.subtitle')} />

            {isCustomerView ? renderCustomerView() : renderFullView()}
        </div>
    );

    // ── Cloud customer view (no tokens) ──────────────────────────────────────
    function renderCustomerView() {
        const billedCost = Number(data.summary?.billed_cost || 0);
        const sub = subscription;
        const billing = sub?.billing || null;
        const costCap = Number(sub?.effective_limits?.max_cost_per_month) || 0;
        const sym = currencySym(billing?.plan_currency || 'EUR');
        // Hero gauge is anchored to the BILLING PERIOD so it matches the License
        // page exactly (both = current_usage.cost ÷ cap). `billedCost` above stays
        // range-scoped — it only feeds the breakdown shares (sharePct), which track
        // the RangeControl window.
        const periodBilledCost = Number(sub?.current_usage?.cost || 0);
        const pct = costCap > 0 ? Math.min(100, Math.round((periodBilledCost / costCap) * 100)) : null;
        const statusColor = sub?.status === 'active' ? '#10b981' : sub?.status === 'trialing' ? '#f59e0b' : sub?.status ? '#f43f5e' : '#94a3b8';
        const activeUsers = data.summary?.unique_users || data.users?.length || 0;
        const periodStr = sub?.billing_period ? formatDateRange(sub.billing_period.startDate, sub.billing_period.endDate) : null;

        const totalBilled = billedCost;
        const sharePct = (v) => totalBilled > 0 ? Math.round((Number(v || 0) / totalBilled) * 100) : 0;
        const sortedUsers = [...(data.users || [])].sort((a, b) => Number(b.billed_cost || 0) - Number(a.billed_cost || 0)).slice(0, 8);
        const sortedSources = [...(data.sources || [])].sort((a, b) => Number(b.billed_cost || 0) - Number(a.billed_cost || 0)).slice(0, 8);

        // Customers never see raw model ids — aggregate model rows into the tier
        // selection they actually picked (Auto / Fast / Think / Deep Thinking …).
        // Bucket by display label so aliases (pro + deep_thinking → "Deep Thinking")
        // merge; keep a tierKey for the icon. Models with no current tier mapping
        // fall under "Other".
        const otherTierLabel = t('usage.tier_other', 'Other');
        const tierBuckets = new Map();
        for (const m of (data.models || [])) {
            const tierKey = tierForModel?.(m.model) || null;
            const label = (tierKey ? tierLabel(tierKey, modelTiers) : '') || otherTierLabel;
            const bucket = tierBuckets.get(label) || { label, tierKey, billed_cost: 0 };
            bucket.billed_cost += Number(m.billed_cost || 0);
            if (!bucket.tierKey && tierKey) bucket.tierKey = tierKey;
            tierBuckets.set(label, bucket);
        }
        const sortedTiers = [...tierBuckets.values()].sort((a, b) => b.billed_cost - a.billed_cost).slice(0, 8);

        const capColor = pct == null ? '#10b981' : pct >= 95 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#10b981';

        return (
            <>
                <MonitorHero
                    accent="#10b981"
                    eyebrow={t('usage.ai_usage_this_period', 'AI usage this period')}
                    value={pct == null ? '—' : `${pct}%`}
                    valueColor="#10b981"
                    status={sub?.status ? { label: sub.status, color: statusColor } : null}
                    subline={<>{activeUsers} {t('usage.active_users', 'active users')}{periodStr ? ` · ${periodStr}` : ''}</>}
                    aside={
                        <MetricGrid cols={1} gap={TOKENS.tileGap}>
                            <MetricCard size="md" icon={CreditCard} color="#0ea5e9" label={t('usage.plan', 'Plan')} value={sub?.plan_name || '—'} />
                            <MetricCard
                                size="md" icon={DollarSign} color="#10b981"
                                label={t('usage.billed_per_cycle', 'Billed per cycle')}
                                value={`${sym}${Number(billing?.subscription_total || 0).toFixed(2)}`}
                                subtitle={billing?.per_seat ? `${billing.seat_quantity} × ${sym}${Number(billing.plan_price || 0).toFixed(2)} / seat` : `/ ${billing?.billing_interval === 'yearly' ? 'year' : 'month'}`}
                            />
                        </MetricGrid>
                    }
                >
                    {costCap > 0 && (
                        <div style={{ marginTop: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11, fontWeight: 600 }}>
                                <span style={{ color: 'var(--text-secondary)' }}>{t('usage.ai_usage_vs_cap', 'AI usage vs. cap')}</span>
                                <span style={{ color: capColor }}>{pct}%</span>
                            </div>
                            <div style={{ height: 8, borderRadius: 999, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: capColor, borderRadius: 999, transition: 'width 0.5s' }} />
                            </div>
                        </div>
                    )}
                </MonitorHero>

                <TrendChart
                    timeline={data.timeline}
                    title={t('usage.cost_trend', 'Cost trend')}
                    avgLabel={t('usage.avg_per_day')}
                    noDataLabel={t('usage.no_data')}
                    valueField="billed_cost"
                    valueFormatter={(v) => costCap > 0 ? Math.round((Number(v) / costCap) * 100) + '%' : ''}
                />

                <MetricGrid min={280}>
                    {/* Top users by % */}
                    <div>
                        <SectionTitle icon={Users}>{t('usage.top_users_by_cost', 'Top users by cost')}</SectionTitle>
                        <Card>
                            {sortedUsers.length === 0 ? <EmptyInline text={t('usage.no_active_users')} /> : sortedUsers.map((u, i) => (
                                <ListRow key={i}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                                        <Avatar user={u} color={getColor(i)} />
                                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.display_name}</span>
                                    </div>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', paddingLeft: 10 }}>{sharePct(u.billed_cost)}%</span>
                                </ListRow>
                            ))}
                        </Card>
                    </div>

                    {/* By tier — the model-tier selection used, no raw model ids (token-free) */}
                    <div>
                        <SectionTitle icon={Cpu}>{t('usage.by_tier', 'By tier')}</SectionTitle>
                        <Card>
                            {sortedTiers.length === 0 ? <EmptyInline text={t('usage.no_model_data')} /> : sortedTiers.map((tb, i) => {
                                const TierIcon = (tb.tierKey && TIER_META[tb.tierKey]?.Icon) || Cpu;
                                return (
                                    <ListRow key={tb.label}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                                            <IconBadge icon={TierIcon} color={getColor(i)} />
                                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tb.label}</span>
                                        </div>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', paddingLeft: 10 }}>{sharePct(tb.billed_cost)}%</span>
                                    </ListRow>
                                );
                            })}
                        </Card>
                    </div>

                    {/* By app area */}
                    <div>
                        <SectionTitle icon={Activity}>{t('usage.by_app_area', 'By app area')}</SectionTitle>
                        <Card>
                            {sortedSources.length === 0 ? <EmptyInline text={t('usage.no_usage_recorded', 'No usage recorded yet')} /> : sortedSources.map((s, i) => {
                                const d = getSourceDetails(s.source);
                                return (
                                    <ListRow key={i}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                            <IconBadge icon={d.icon} color={d.color} />
                                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{d.label}</span>
                                        </div>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', paddingLeft: 10 }}>{sharePct(s.billed_cost)}%</span>
                                    </ListRow>
                                );
                            })}
                        </Card>
                    </div>
                </MetricGrid>
            </>
        );
    }

    // ── Full view (self-hosted / cloud-admin) ────────────────────────────────
    function renderFullView() {
        const cost = Number(data.summary?.combined_total_cost ?? data.summary?.total_estimated_cost ?? 0);
        const overBudget = cost > OVERVIEW_COST_ALERT;
        const critical = cost > OVERVIEW_COST_ALERT * 2;
        const costTrend = computeHalfPeriodDelta(data.timeline, r => Number(r.total_cost ?? r.estimated_cost ?? 0));
        const tokenSpark = (data.timeline || []).map(r => Number(r.total_tokens ?? r.total ?? 0));
        const callSpark = (data.timeline || []).map(r => Number(r.total_calls ?? r.calls ?? 0));
        const costSpark = (data.timeline || []).map(r => Number(r.total_cost ?? r.estimated_cost ?? 0));
        const muRows = data.modelsByUser || [];

        return (
            <>
                {overBudget && (
                    <AlertBanner
                        severity={critical ? 'red' : 'amber'}
                        title="Spend over budget"
                        message={`${fCur(cost)} spent this period — threshold ${fCur(OVERVIEW_COST_ALERT)}.`}
                        ctaLabel="Review by model"
                        onCta={() => modelByUserRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    />
                )}

                <MonitorHero
                    accent="#10b981"
                    eyebrow="Estimated cost"
                    value={fCur(cost)}
                    valueColor="#10b981"
                    valueSize={44}
                    trend={costTrend && Math.abs(costTrend.delta) > 0.005 ? (
                        <TrendChip delta={costTrend.delta} display={fCur(Math.abs(costTrend.delta))} title={`Previous half: ${fCur(costTrend.prev)}`} goodWhenDown />
                    ) : null}
                    subline={(
                        <>
                            In: <span style={{ color: '#3b82f6', fontWeight: 700 }}>{fCur(data.summary?.total_input_cost)}</span>
                            <span style={{ margin: '0 6px' }}>·</span>
                            Out: <span style={{ color: '#f59e0b', fontWeight: 700 }}>{fCur(data.summary?.total_output_cost)}</span>
                            {(data.summary?.azure_services_total_cost || 0) > 0 && (
                                <>
                                    <span style={{ margin: '0 6px' }}>·</span>
                                    Azure: <span style={{ color: '#0ea5e9', fontWeight: 700 }}>{fCur(data.summary?.azure_services_total_cost)}</span>
                                </>
                            )}
                        </>
                    )}
                    aside={
                        <MetricGrid cols={2} gap={TOKENS.tileGap}>
                            <MetricCard size="sm" icon={Zap} color="#0ea5e9" label="AI calls" value={Number(data.summary?.total_calls || 0).toLocaleString()} spark={callSpark} />
                            <MetricCard size="sm" icon={BarChart3} color="#3b82f6" label="Tokens" value={fNum(data.summary?.total_tokens)} spark={tokenSpark} />
                            <MetricCard size="sm" icon={Users} color="#f59e0b" label="Active users" value={data.summary?.unique_users || data.users.length || 0} />
                            <MetricCard size="sm" icon={DollarSign} color="#10b981" label="Cost / day avg" value={fCur(data.timeline?.length ? cost / data.timeline.length : 0)} spark={costSpark} />
                        </MetricGrid>
                    }
                />

                <TrendChart timeline={data.timeline} title={t('usage.token_trend')} avgLabel={t('usage.avg_per_day')} noDataLabel={t('usage.no_data')} valueField="total_tokens" />

                {/* Users + Models */}
                <MetricGrid cols={2}>
                    <div>
                        <SectionTitle icon={Users} right={<Legend inputLabel={t('usage.input')} outputLabel={t('usage.output')} />}>{t('usage.top_users')}</SectionTitle>
                        <Card>
                            {data.users.length === 0 ? <EmptyInline text={t('usage.no_active_users')} /> : data.users.slice(0, 8).map((u, i) => (
                                <ListRow key={i} onClick={() => setFilterUser(u.user_id)}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                                        <Avatar user={u} color={getColor(i)} />
                                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.display_name}</span>
                                            <InOutBar input={u.prompt_tokens} output={u.completion_tokens} height={3} style={{ marginTop: 4, maxWidth: 100 }} />
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: 10 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{fNum(u.total_tokens)}</div>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{fCur(u.estimated_cost)}</div>
                                    </div>
                                </ListRow>
                            ))}
                        </Card>
                    </div>

                    <div>
                        <SectionTitle icon={Cpu} right={<Legend inputLabel={t('usage.input')} outputLabel={t('usage.output')} />}>{t('usage.by_model')}</SectionTitle>
                        <Card>
                            {data.models.length === 0 ? <EmptyInline text={t('usage.no_model_data')} /> : data.models.slice(0, 8).map((m, i) => (
                                <ListRow key={i} onClick={() => setFilterModel(m.model)}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                                        <IconBadge icon={Cpu} color={getColor(i)} />
                                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.model}>{shortModel(m.model)}</span>
                                            <InOutBar input={m.prompt_tokens} output={m.completion_tokens} height={3} style={{ marginTop: 4, maxWidth: 100 }} />
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: 10 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{fNum(m.total_tokens)}</div>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{fCur(m.estimated_cost)} · {m.calls} {t('usage.calls')}</div>
                                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 1, fontSize: 9 }}>
                                            <span style={{ color: '#3b82f6', fontWeight: 500 }}>In: {fCur(m.input_cost)}</span>
                                            <span style={{ color: '#f59e0b', fontWeight: 500 }}>Out: {fCur(m.output_cost)}</span>
                                        </div>
                                    </div>
                                </ListRow>
                            ))}
                        </Card>
                    </div>
                </MetricGrid>

                {/* Sources + Model × Agent */}
                <MetricGrid cols={2}>
                    <div>
                        <SectionTitle icon={Activity}>{t('usage.by_app_area')}</SectionTitle>
                        <Card>
                            {data.sources.length === 0 ? <EmptyInline text={t('usage.no_usage_recorded')} /> : data.sources.map((s, i) => {
                                const d = getSourceDetails(s.source);
                                return (
                                    <ListRow key={i} onClick={() => setFilterSource(s.source)}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                            <IconBadge icon={d.icon} color={d.color} />
                                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{d.label}</span>
                                                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{s.calls} {t('usage.calls')}</span>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: 10 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{fNum(s.total_tokens)}</div>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{fCur(s.estimated_cost)}</div>
                                        </div>
                                    </ListRow>
                                );
                            })}
                        </Card>
                    </div>

                    <div>
                        <SectionTitle icon={Bot}>{t('usage.models_per_agent')}</SectionTitle>
                        <Card>
                            {agentModelGroups.length === 0 ? <EmptyInline text={t('usage.no_data_short')} /> : agentModelGroups.slice(0, 8).map((group, gi) => {
                                const isExpanded = expandedAgent === group.agent_name;
                                return (
                                    <div key={gi}>
                                        <ListRow onClick={() => setExpandedAgent(isExpanded ? null : group.agent_name)} style={{ borderBottom: isExpanded ? 'none' : undefined }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                                <IconBadge icon={Bot} color={getColor(gi)} />
                                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                                                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.agent_name}</span>
                                                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{group.models.length} model{group.models.length !== 1 ? 's' : ''}</span>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{fNum(group.total_tokens)}</div>
                                                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fCur(group.estimated_cost)}</div>
                                                </div>
                                                <ChevronRight style={{ width: 13, height: 13, color: 'var(--text-muted)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease' }} />
                                            </div>
                                        </ListRow>
                                        {isExpanded && group.models.map((m, mi) => (
                                            <div key={mi} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 14px 6px 48px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)', fontSize: 11 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <Cpu style={{ width: 11, height: 11, color: getColor(mi + 3) }} />
                                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{shortModel(m.model)}</span>
                                                    <InOutLabel input={m.prompt_tokens} output={m.completion_tokens} showCost inputCost={m.input_cost} outputCost={m.output_cost} />
                                                </div>
                                                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{fNum(m.total_tokens)}</span>
                                                    <span style={{ color: 'var(--text-muted)' }}>{fCur(m.estimated_cost)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </Card>
                    </div>
                </MetricGrid>

                {/* Model × User table — collapsible, with Show more (no silent row cap) */}
                {muRows.length > 0 && (
                    <div ref={modelByUserRef}>
                        <CollapsibleSection title={t('usage.model_usage_by_user')} icon={Users} count={muRows.length} defaultOpen right={<Legend inputLabel={t('usage.input')} outputLabel={t('usage.output')} />}>
                            <Card>
                                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr repeat(3, 70px) repeat(3, 72px)', padding: '8px 14px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-subtle)', overflowX: 'auto' }}>
                                    {tableHeaders.map(h => (
                                        <span key={h.key} style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: h.color || 'var(--text-muted)', textAlign: h.align, whiteSpace: 'nowrap' }}>{t(h.key)}</span>
                                    ))}
                                </div>
                                {muRows.slice(0, muShow).map((row, i) => (
                                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr repeat(3, 70px) repeat(3, 72px)', padding: '7px 14px', alignItems: 'center', background: i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', whiteSpace: 'nowrap', cursor: 'pointer', minWidth: 0 }} onClick={() => setFilterUser(row.user_id)}>
                                            <Avatar user={row} color={getColor(i)} size={20} />
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.display_name || row.user_id}</span>
                                        </span>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: getColor(i), display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => setFilterModel(row.model)}>
                                            <Cpu style={{ width: 10, height: 10, flexShrink: 0 }} />{shortModel(row.model)}
                                        </span>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: '#3b82f6', textAlign: 'right' }}>{fNum(row.prompt_tokens)}</span>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: '#f59e0b', textAlign: 'right' }}>{fNum(row.completion_tokens)}</span>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>{fNum(row.total_tokens)}</span>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: '#3b82f6', textAlign: 'right' }}>{fCur(row.input_cost)}</span>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: '#f59e0b', textAlign: 'right' }}>{fCur(row.output_cost)}</span>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>{fCur(row.estimated_cost)}</span>
                                    </div>
                                ))}
                                {muRows.length > muShow && <ShowMore remaining={muRows.length - muShow} onMore={() => setMuShow(c => c + 20)} label={t('usage.safety_show_more', 'Show more')} />}
                            </Card>
                        </CollapsibleSection>
                    </div>
                )}

                {/* Azure services */}
                {(azureServices.byType?.length > 0) && (
                    <div>
                        <SectionTitle icon={Server}>{t('usage.azure_services', 'Azure Services')}</SectionTitle>
                        <Card>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 0 }}>
                                {azureServices.byType.map((svc, i) => {
                                    const svcInfo = {
                                        doc_intelligence: { label: 'Document Intelligence', icon: FileText, color: '#0ea5e9', metric: `${fNum(svc.total_pages)} pages` },
                                        content_safety: { label: 'Content Safety', icon: ShieldCheck, color: '#f59e0b', metric: `${fNum(svc.total_chars)} chars` },
                                        pii_detection: { label: 'PII Detection', icon: ScanEye, color: '#14b8a6', metric: `${fNum(svc.total_chars)} chars` },
                                        embedding: { label: 'Embeddings', icon: Binary, color: '#0ea5e9', metric: showTokens ? `${fNum(svc.total_tokens)} tokens` : '' },
                                    }[svc.service_type] || { label: svc.service_type, icon: Server, color: '#94a3b8', metric: '' };
                                    const SvcIcon = svcInfo.icon;
                                    return (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
                                            <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${svcInfo.color}15`, flexShrink: 0 }}>
                                                <SvcIcon style={{ width: 16, height: 16, color: svcInfo.color }} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{svcInfo.label}</div>
                                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{svc.calls} {t('usage.calls')}{svcInfo.metric ? ` · ${svcInfo.metric}` : ''}</div>
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                <div style={{ fontSize: 14, fontWeight: 700, color: svcInfo.color }}>{fCur(svc.total_cost)}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-tertiary)', borderTop: '2px solid var(--border-subtle)' }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('usage.total', 'Total')}</span>
                                <span style={{ fontSize: 16, fontWeight: 800, color: '#10b981' }}>{fCur(azureServices.summary?.total_cost)}</span>
                            </div>
                        </Card>
                    </div>
                )}
            </>
        );
    }
}

// The Privacy Shield "What happened" tab — evidence, where the other four
// tabs are policy.
//
// Overview-first by design: four KPIs, at most ONE alert, one trend, up to
// three top-5 lists, and the raw tables folded away until a drill or an
// explicit click opens them. The two screens this replaces stacked ~17
// sections with five drill axes; every section here self-hides when empty.

import { Ban, Globe2, Lock, ScanSearch, ShieldAlert, Users } from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';

import { ALERT_SCORE_THRESHOLD, SAFETY_PII_ALERT, SEMANTIC, scoreColor } from '../../../../../config/analyticsConfig';
import RangeControl, { defaultRange } from '../../../../../pages/settings/usage/RangeControl';
import { fNum } from '../../../../../pages/settings/usage/format';
import {
    AlertBanner, Card, DrillChip, EmptyInline, FilterChipBar,
    ListRow, MetricCard, MetricGrid, SectionTitle, ShowMore, TrendChip,
} from '../../../../../pages/settings/usage/kit';
import { Avatar } from '../../../../../pages/settings/usage/widgets';
import { deriveRangeParams } from '../../../../../utils/usageHelpers';
import LicenceLock from '../parts/LicenceLock';
import ActivityDetailTable, { useCategoryLabels } from './ActivityDetailTable';
import useShieldActivity from './useShieldActivity';

const num = (v) => Number(v) || 0;

// Trend series colours — one per guard family, matching the KPI colours.
// dlp included: the "Times the shield stepped in" KPI and each bar's tooltip
// count ALL events, so a period that is mostly outside-AI checks would render
// a near-empty bar that contradicts the number printed above it.
const SERIES = [
    { key: 'moderation', color: '#f43f5e', labelKey: 'admin.shield_activity_series_unsafe', fallback: 'Unsafe content' },
    { key: 'pii', color: '#f59e0b', labelKey: 'admin.shield_activity_series_personal', fallback: 'Personal data' },
    { key: 'regex', color: '#0ea5e9', labelKey: 'admin.shield_activity_series_custom', fallback: 'Your custom rules' },
    { key: 'dlp', color: '#8b5cf6', labelKey: 'admin.shield_activity_series_dlp', fallback: 'Checks before an outside AI' },
];

function TrendCard({ timeline, t }) {
    if (!timeline || timeline.length < 2) return null;
    const rows = timeline;
    const max = Math.max(...timeline.map(r => num(r.total)), 1);
    return (
        <Card title={t('admin.shield_activity_trend_title', 'Activity over time')}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 90 }}>
                {rows.map(r => {
                    const total = num(r.total);
                    return (
                        <div key={r.period} title={`${r.period}: ${total}`}
                            style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', minWidth: 2 }}>
                            {SERIES.map(s => {
                                const v = num(r[s.key]);
                                if (!v) return null;
                                return <div key={s.key} style={{ height: `${(v / max) * 100}%`, background: s.color, borderRadius: 1 }} />;
                            })}
                            {total === 0 && <div style={{ height: 1, background: 'var(--border-subtle)' }} />}
                        </div>
                    );
                })}
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
                {SERIES.map(s => (
                    <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-muted)' }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: 'inline-block' }} />
                        {t(s.labelKey, s.fallback)}
                    </span>
                ))}
            </div>
        </Card>
    );
}

export default function ActivityTab({ t, shieldEnabled, licensed, upgradeUrl }) {
    const [range, setRange] = useState(() => defaultRange('30d'));
    const rangeParams = useMemo(() => deriveRangeParams(range), [range]);
    const [detail, setDetail] = useState({ open: false, kind: 'guard', drill: null, limit: 50 });
    const detailRef = useRef(null);
    const catLabel = useCategoryLabels(t);

    const enabled = !!licensed;
    const { loading, error, guard, integ, detailRows, detailLoading } =
        useShieldActivity({ enabled, rangeParams, detail });

    const openDetails = (kind, drill = null) => {
        setDetail(d => ({ ...d, open: true, kind, drill, limit: 50 }));
        // After the fold renders, bring it into view.
        setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    };

    // ── Locked (licence) ───────────────────────────────────────────────
    if (!licensed) {
        return (
            <div className="p-6 rounded-xl border text-center" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}>
                <Lock className="w-6 h-6 mx-auto mb-2" aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                    {t('admin.shield_activity_locked_title', 'See what actually happened')}
                </p>
                <p className="text-xs text-muted mb-2">
                    {t('admin.shield_activity_locked_body', 'Activity reporting is part of the Enterprise plan.')}
                </p>
                <div className="inline-block"><LicenceLock upgradeUrl={upgradeUrl} t={t}>{''}</LicenceLock></div>
            </div>
        );
    }

    const gs = guard.summary || {};
    const is = integ.summary || {};
    const score = is.sovereignty_score === null || is.sovereignty_score === undefined ? null : num(is.sovereignty_score);
    const totalEvents = num(gs.total_events);
    const totalCalls = num(is.total_calls);
    const piiCount = num(gs.pii_count);
    const piiNonEu = num(is.pii_non_eu_count);
    const isEmpty = !loading && totalEvents === 0 && totalCalls === 0;

    // At most ONE alert, worst first.
    let alert = null;
    if (piiNonEu > 0) {
        alert = {
            severity: 'red',
            title: t('admin.shield_activity_alert_pii_abroad', 'Personal data left Europe'),
            message: t('admin.shield_activity_alert_pii_abroad_msg', '{n} calls sent personal data to servers outside Europe in this period.').replace('{n}', fNum(piiNonEu)),
            cta: () => openDetails('egress', { axis: 'non_eu', value: 'non_eu' }),
        };
    } else if (score !== null && score < ALERT_SCORE_THRESHOLD) {
        alert = {
            severity: 'amber',
            title: t('admin.shield_activity_alert_low_score', 'A lot of your data is leaving Europe'),
            message: t('admin.shield_activity_alert_low_score_msg', 'Only {score} of 100 calls stayed in Europe or on your own servers.').replace('{score}', String(score)),
            cta: () => openDetails('egress', { axis: 'non_eu', value: 'non_eu' }),
        };
    } else if (piiCount > SAFETY_PII_ALERT) {
        alert = {
            severity: 'amber',
            title: t('admin.shield_activity_alert_many_catches', 'The shield is catching a lot of personal data'),
            message: t('admin.shield_activity_alert_many_catches_msg', '{n} messages contained personal data in this period.').replace('{n}', fNum(piiCount)),
            cta: () => openDetails('guard'),
        };
    }

    const topUsers = guard.top_users || [];
    const topCategories = guard.top_categories || [];
    const topNonEu = integ.top?.non_eu_destinations || [];
    const bySurface = guard.by_surface || [];
    const surfaceNames = {
        direct: t('admin.shield_activity_src_direct', 'Direct chat'),
        agent: t('admin.shield_activity_src_agent', 'Agent'),
        routine: t('admin.shield_activity_src_routine', 'Routine'),
        notebook: t('admin.shield_activity_src_notebook', 'Notebook'),
    };

    return (
        <div className="space-y-4">
            {/* Header: one sentence + the range. */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <p className="text-xs text-muted" style={{ margin: 0 }}>
                    {t('admin.shield_activity_subtitle', 'What the shield caught, and where your data went.')}
                </p>
                <RangeControl range={range} onChange={setRange} t={t} presets={['7d', '30d', '90d']} />
            </div>

            {!shieldEnabled && (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                    {t('admin.shield_activity_off_note', 'The shield is off right now — nothing new is being checked. You are looking at past activity.')}
                </p>
            )}

            {error && (
                <p role="alert" className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                    {t('admin.shield_activity_error', 'Could not load activity. Reload the page to try again.')}
                </p>
            )}

            {loading && !error && (
                <p className="text-xs text-muted text-center py-6">{t('admin.shield_loading', 'Loading settings...')}</p>
            )}

            {isEmpty && !error && (
                <EmptyInline boxed text={t('admin.shield_activity_empty', 'Nothing to show yet. Activity appears here once people start using the assistant.')} />
            )}

            {!loading && !isEmpty && !error && (
                <>
                    {alert && (
                        <AlertBanner
                            severity={alert.severity}
                            title={alert.title}
                            message={alert.message}
                            ctaLabel={t('admin.shield_activity_alert_cta', 'Look at these')}
                            onCta={alert.cta}
                        />
                    )}

                    <MetricGrid cols={4} min={150}>
                        <MetricCard
                            icon={ShieldAlert}
                            label={t('admin.shield_activity_kpi_events', 'Times the shield stepped in')}
                            value={fNum(totalEvents)}
                            color="#0ea5e9"
                            spark={(guard.timeline || []).map(r => num(r.total))}
                            onClick={() => openDetails('guard')}
                        />
                        <MetricCard
                            icon={ScanSearch}
                            label={t('admin.shield_activity_kpi_personal', 'Personal data caught')}
                            value={fNum(piiCount)}
                            color={piiCount > SAFETY_PII_ALERT ? SEMANTIC.crit : '#f59e0b'}
                            onClick={() => openDetails('guard')}
                        />
                        <MetricCard
                            icon={Globe2}
                            label={t('admin.shield_activity_kpi_calls', 'Calls to outside services')}
                            value={fNum(totalCalls)}
                            color="#8b5cf6"
                            onClick={() => openDetails('egress')}
                        />
                        <MetricCard
                            icon={Ban}
                            label={t('admin.shield_activity_kpi_eu', 'Stayed in Europe')}
                            value={score === null ? '—' : `${score}/100`}
                            color={score === null ? '#94a3b8' : scoreColor(score)}
                            subtitle={(
                                <span title={t('admin.shield_activity_score_hint', 'Out of 100. Calls that stayed in Europe or on your own servers score full marks; personal data leaving Europe counts double against the score.')}>
                                    {is.score_delta !== null && is.score_delta !== undefined
                                        ? <TrendChip delta={num(is.score_delta)} display={`${num(is.score_delta) > 0 ? '+' : ''}${num(is.score_delta)}`} />
                                        : t('admin.shield_activity_score_sub', 'of your calls')}
                                </span>
                            )}
                        />
                    </MetricGrid>

                    <TrendCard timeline={guard.timeline} t={t} />

                    {(topUsers.length > 0 || topCategories.length > 0 || topNonEu.length > 0 || bySurface.length > 0) && (
                        <div>
                            <SectionTitle icon={Users}>{t('admin.shield_activity_top_title', 'What to look at')}</SectionTitle>
                            <MetricGrid cols={3} min={220}>
                                {bySurface.length > 0 && (
                                    <Card title={t('admin.shield_activity_top_where', 'Where it happened')}>
                                        {bySurface.map(s => (
                                            <ListRow key={s.surface}>
                                                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 11 }}>
                                                    {surfaceNames[s.surface] || s.surface}
                                                </span>
                                                <b style={{ fontSize: 11 }}>{fNum(num(s.count))}</b>
                                            </ListRow>
                                        ))}
                                    </Card>
                                )}
                                {topUsers.length > 0 && (
                                    <Card title={t('admin.shield_activity_top_people', 'People with the most catches')}>
                                        {topUsers.slice(0, 5).map(u => (
                                            <ListRow key={u.user_id} onClick={() => openDetails('guard', { axis: 'user', value: u.user_id })}>
                                                <Avatar user={u} size={18} />
                                                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 11 }}>{u.display_name || u.user_id}</span>
                                                <b style={{ fontSize: 11 }}>{fNum(num(u.total))}</b>
                                            </ListRow>
                                        ))}
                                    </Card>
                                )}
                                {topCategories.length > 0 && (
                                    <Card title={t('admin.shield_activity_top_kinds', 'What we caught most')}>
                                        {topCategories.slice(0, 5).map(c => (
                                            <ListRow key={`${c.category}-${c.violation_type}`} onClick={() => openDetails('guard', { axis: 'category', value: c.category })}>
                                                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 11 }}>{catLabel(c.category)}</span>
                                                <b style={{ fontSize: 11 }}>{fNum(num(c.count))}</b>
                                            </ListRow>
                                        ))}
                                    </Card>
                                )}
                                {topNonEu.length > 0 && (
                                    <Card title={t('admin.shield_activity_top_left_eu', 'Where data left Europe')}>
                                        {topNonEu.slice(0, 5).map(d => (
                                            <ListRow key={d.dest_host} onClick={() => openDetails('egress', { axis: 'dest', value: d.dest_host })}>
                                                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 11 }}>{d.dest_host}</span>
                                                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{d.country_name || d.operator || ''}</span>
                                                <b style={{ fontSize: 11 }}>{fNum(num(d.total))}</b>
                                            </ListRow>
                                        ))}
                                    </Card>
                                )}
                            </MetricGrid>
                        </div>
                    )}

                    <div ref={detailRef}>
                        {/* Controlled fold — kit's CollapsibleSection owns its
                            own open state, and a drill click has to open this
                            one from the outside. Same look, external state. */}
                        <button
                            type="button"
                            onClick={() => setDetail(d => ({ ...d, open: !d.open }))}
                            aria-expanded={detail.open}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 8, fontFamily: 'inherit' }}
                        >
                            <span aria-hidden="true" style={{ display: 'inline-block', transform: detail.open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-muted)', fontSize: 12 }}>›</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                                {t('admin.shield_activity_details', 'The details')}
                            </span>
                        </button>
                        {detail.open && (<div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                                <FilterChipBar
                                    value={detail.kind}
                                    onChange={(kind) => setDetail(d => ({ ...d, kind, drill: null, limit: 50 }))}
                                    options={[
                                        { id: 'guard', label: t('admin.shield_activity_detail_shield', 'Shield events') },
                                        { id: 'egress', label: t('admin.shield_activity_detail_egress', 'Data that left your org') },
                                    ]}
                                    size="sm"
                                />
                                {detail.drill && (
                                    <DrillChip
                                        axis={detail.drill.axis}
                                        label={detail.drill.axis === 'category' ? catLabel(detail.drill.value)
                                            : detail.drill.axis === 'non_eu' ? t('admin.shield_activity_drill_non_eu', 'Outside Europe')
                                                : String(detail.drill.value)}
                                        onClear={() => setDetail(d => ({ ...d, drill: null }))}
                                    />
                                )}
                            </div>
                            {detailLoading
                                ? <p className="text-xs text-muted py-3 text-center">{t('admin.shield_loading', 'Loading settings...')}</p>
                                : (
                                    <>
                                        <ActivityDetailTable
                                            kind={detail.kind}
                                            rows={detailRows}
                                            t={t}
                                            emptyText={t('admin.shield_activity_no_rows', 'Nothing matches this filter.')}
                                        />
                                        {/* Hidden for client-filtered drills (category/dest): the
                                            hook already fetches the maximum page there, and gating
                                            on the POST-filter row count would never fire anyway. */}
                                        {!(detail.drill && (detail.drill.axis === 'category' || detail.drill.axis === 'dest'))
                                            && detailRows.length >= detail.limit && detail.limit < 200 && (
                                            <ShowMore
                                                remaining={null}
                                                label={t('usage.safety_show_more', 'Show more')}
                                                onMore={() => setDetail(d => ({ ...d, limit: Math.min(d.limit + 50, 200) }))}
                                            />
                                        )}
                                    </>
                                )}
                        </div>)}
                    </div>
                </>
            )}
        </div>
    );
}

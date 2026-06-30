// Safety & Guardrails tab of the Usage & Monitoring dashboard.
// Moderation / PII / regex guardrail events. Token-free (no gating needed).

import {
    Shield, AlertTriangle, Eye, Fingerprint, Users, Activity, TrendingUp,
    ArrowUpRight, ArrowDownLeft, Clock,
} from 'lucide-react';
import React, { useState, useRef } from 'react';
import { shortModel } from './format';
import {
    Card, MetricCard, MetricGrid, MonitorHero, TabHeader, AlertBanner,
    SectionTitle, ListRow, TrendChip, FilterChipBar, DrillChip, CollapsibleSection, ShowMore, EmptyInline, TOKENS,
} from './kit';
import { Avatar, getSourceDetails } from './widgets';
import { paletteColor as getColor, SAFETY_PII_ALERT } from '../../../config/analyticsConfig';
import { computeHalfPeriodDelta } from '../../../utils/usageHelpers';

const typeColorFn = (vt) => vt === 'moderation' ? '#f59e0b' : vt === 'pii' ? '#14b8a6' : '#3b82f6';
const actionColorFn = (a) => (a === 'hard_block' || a === 'blocked' || a === 'search_blocked') ? '#ef4444'
    : (a === 'pii_detected' || a === 'tokenized') ? '#14b8a6' : a === 'redacted' ? '#3b82f6' : '#f59e0b';
const actionLabel = (a) => (a || 'unknown').replace(/_/g, ' ');

export default function SafetyTab({ t, guardrails }) {
    const [safetyTypeFilter, setSafetyTypeFilter] = useState(null);
    const [expandedEventId, setExpandedEventId] = useState(null);
    const [safetyShowCount, setSafetyShowCount] = useState(20);
    const [safetyDrill, setSafetyDrill] = useState(null);
    const guardrailEventsRef = useRef(null);

    const totalEvents = Number(guardrails.summary?.total_events) || 0;
    const modCount = Number(guardrails.summary?.moderation_count) || 0;
    const piiCount = Number(guardrails.summary?.pii_count) || 0;
    const regCount = Number(guardrails.summary?.regex_count) || 0;
    const inputCount = Number(guardrails.summary?.input_count) || 0;
    const outputCount = Number(guardrails.summary?.output_count) || 0;
    const pctOf = (n) => totalEvents > 0 ? Math.round((n / totalEvents) * 100) : 0;

    const handleSafetyDrill = (axis, key, label) => {
        setSafetyDrill({ axis, key, label });
        setTimeout(() => guardrailEventsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    };

    const filteredRecent = (() => {
        let arr = safetyTypeFilter ? guardrails.recent.filter(e => e.violation_type === safetyTypeFilter) : guardrails.recent;
        if (safetyDrill) {
            const d = safetyDrill;
            if (d.axis === 'category') arr = arr.filter(e => (e.violation_categories || '').split(',').map(s => s.trim()).includes(d.key));
            if (d.axis === 'user') arr = arr.filter(e => e.user_id === d.key);
            if (d.axis === 'action') arr = arr.filter(e => e.action_taken === d.key);
        }
        return arr;
    })();
    const filteredByCategory = safetyTypeFilter ? guardrails.byCategory.filter(c => c.violation_type === safetyTypeFilter) : guardrails.byCategory;
    const filteredByUser = safetyTypeFilter ? guardrails.byUser.filter(u => Number(u[safetyTypeFilter]) > 0) : guardrails.byUser;

    const piiTrend = computeHalfPeriodDelta(guardrails.timeline, r => Number(r.pii_events ?? r.pii ?? 0));
    const piiSpark = (guardrails.timeline || []).map(r => Number(r.pii_events ?? r.pii ?? 0));
    const piiPctColor = totalEvents > 0 && pctOf(piiCount) >= 40 ? '#ef4444' : '#14b8a6';
    const maxCat = Math.max(...filteredByCategory.map(x => Number(x.count) || 0), 1);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: TOKENS.pagePad }}>
            <TabHeader icon={Shield} iconColor="#ef4444" title={t('usage.safety_title')} description={t('usage.safety_subtitle')} />

            <FilterChipBar
                value={safetyTypeFilter}
                onChange={(v) => { setSafetyTypeFilter(v); setSafetyShowCount(20); }}
                options={[
                    { value: null, label: t('usage.safety_filter_all'), count: totalEvents, color: '#ef4444' },
                    { value: 'moderation', label: t('usage.moderation'), count: modCount, color: '#f59e0b' },
                    { value: 'pii', label: 'PII', count: piiCount, color: '#14b8a6' },
                    { value: 'regex', label: 'Regex', count: regCount, color: '#3b82f6' },
                ]}
            />

            {piiCount > SAFETY_PII_ALERT && (
                <AlertBanner
                    severity={piiCount > SAFETY_PII_ALERT * 2 ? 'red' : 'amber'}
                    message={`${piiCount} PII detection${piiCount === 1 ? '' : 's'} this period — review retention and access controls.`}
                    ctaLabel="Review PII events"
                    onCta={() => { setSafetyTypeFilter('pii'); setSafetyShowCount(20); setTimeout(() => guardrailEventsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}
                />
            )}

            <MonitorHero
                accent={piiCount > 0 ? '#ef4444' : '#10b981'}
                eyebrow="PII detections"
                value={(
                    <>
                        <span style={{ color: piiPctColor }}>{piiCount}</span>
                        {totalEvents > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginLeft: 10 }}>· {pctOf(piiCount)}% of {totalEvents} violation{totalEvents === 1 ? '' : 's'}</span>}
                    </>
                )}
                valueColor={piiPctColor}
                trend={piiTrend && piiTrend.delta !== 0 ? <TrendChip delta={piiTrend.delta} display={Math.abs(piiTrend.delta)} title={`Previous half: ${piiTrend.prev}`} goodWhenDown /> : null}
                subline="Personal data detected leaving the agent — verify retention and access controls."
                aside={
                    <MetricGrid cols={2} gap={TOKENS.tileGap}>
                        <MetricCard size="sm" icon={Shield} color="#ef4444" label="Total violations" value={totalEvents.toLocaleString()} />
                        <MetricCard size="sm" icon={AlertTriangle} color="#f59e0b" label="Moderation" value={modCount.toLocaleString()} />
                        <MetricCard size="sm" icon={Eye} color="#3b82f6" label="Regex matches" value={regCount.toLocaleString()} />
                        <MetricCard size="sm" icon={Users} color="#0ea5e9" label="Users" value={(guardrails.summary?.unique_users || 0).toLocaleString()} spark={piiSpark} />
                    </MetricGrid>
                }
            />

            {/* Direction + Timeline */}
            <div style={{ display: 'grid', gridTemplateColumns: guardrails.timeline.length > 0 ? '200px 1fr' : '1fr', gap: 10 }}>
                <Card style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
                        <Activity style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{t('usage.safety_by_direction')}</span>
                    </div>
                    <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', height: 22, background: 'var(--bg-tertiary)' }}>
                        {inputCount > 0 && <div style={{ width: `${pctOf(inputCount)}%`, background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'width 0.3s' }}><span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>{pctOf(inputCount)}%</span></div>}
                        {outputCount > 0 && <div style={{ width: `${pctOf(outputCount)}%`, background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'width 0.3s' }}><span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>{pctOf(outputCount)}%</span></div>}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#3b82f6', fontWeight: 600 }}><ArrowUpRight style={{ width: 10, height: 10 }} />{t('usage.safety_input')} ({inputCount})</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#f59e0b', fontWeight: 600 }}><ArrowDownLeft style={{ width: 10, height: 10 }} />{t('usage.safety_output')} ({outputCount})</span>
                    </div>
                </Card>

                {guardrails.timeline.length > 0 && (
                    <Card style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                            <TrendingUp style={{ width: 12, height: 12, color: '#ef4444', opacity: 0.7 }} />
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{t('usage.violation_trend')}</span>
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, fontSize: 10 }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 7, height: 7, borderRadius: 2, background: '#f59e0b', display: 'inline-block' }} /> {t('usage.moderation')}</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 7, height: 7, borderRadius: 2, background: '#14b8a6', display: 'inline-block' }} /> PII</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 7, height: 7, borderRadius: 2, background: '#3b82f6', display: 'inline-block' }} /> Regex</span>
                            </div>
                        </div>
                        {(() => {
                            const tl = guardrails.timeline;
                            const maxVal = Math.max(...tl.map(d => Number(d.total) || 0), 1);
                            const showEvery = Math.max(1, Math.ceil(tl.length / 8));
                            return (
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 100 }}>
                                        {tl.map((d, i) => {
                                            const mod = Number(d.moderation) || 0, pii = Number(d.pii) || 0, reg = Number(d.regex) || 0;
                                            const total = mod + pii + reg;
                                            const h = (total / maxVal) * 100;
                                            const modH = total > 0 ? (mod / total) * h : 0;
                                            const piiH = total > 0 ? (pii / total) * h : 0;
                                            const regH = total > 0 ? (reg / total) * h : 0;
                                            return (
                                                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }} title={`${d.period}: ${total} events (${mod} mod, ${pii} pii, ${reg} regex)`}>
                                                    {regH > 0 && <div style={{ height: `${regH}%`, background: '#3b82f6', borderRadius: reg === total ? '3px 3px 0 0' : '0', minHeight: 2, transition: 'height 0.2s' }} />}
                                                    {piiH > 0 && <div style={{ height: `${piiH}%`, background: '#14b8a6', minHeight: 2, borderRadius: (reg === 0 && pii > 0) ? '3px 3px 0 0' : '0', transition: 'height 0.2s' }} />}
                                                    {modH > 0 && <div style={{ height: `${modH}%`, background: '#f59e0b', borderRadius: total === mod ? '3px 3px 0 0' : '0', minHeight: 2, transition: 'height 0.2s' }} />}
                                                    {total === 0 && <div style={{ height: 2, background: 'var(--bg-tertiary)', borderRadius: 2 }} />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
                                        {tl.map((d, i) => (
                                            <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 8, color: 'var(--text-muted)', fontWeight: 500 }}>
                                                {i % showEvery === 0 ? new Date(d.period).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}
                    </Card>
                )}
            </div>

            {/* By Category + By User + By Action */}
            <MetricGrid cols={3}>
                <div>
                    <SectionTitle icon={AlertTriangle}>{t('usage.by_violation_category')}</SectionTitle>
                    <Card>
                        {filteredByCategory.length === 0 ? <EmptyInline text={t('usage.no_violations')} /> : filteredByCategory.slice(0, 10).map((c, i) => {
                            const tc = typeColorFn(c.violation_type);
                            const w = Math.max(5, (Number(c.count) / maxCat) * 100);
                            return (
                                <ListRow key={i} onClick={() => handleSafetyDrill('category', c.category, c.category)}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                        <div style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${tc}12`, flexShrink: 0 }}>
                                            {c.violation_type === 'moderation' ? <AlertTriangle style={{ width: 11, height: 11, color: tc }} /> : c.violation_type === 'pii' ? <Fingerprint style={{ width: 11, height: 11, color: tc }} /> : <Eye style={{ width: 11, height: 11, color: tc }} />}
                                        </div>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.category}</div>
                                            <div style={{ height: 3, borderRadius: 2, background: 'var(--bg-tertiary)', marginTop: 3, overflow: 'hidden' }}>
                                                <div style={{ height: '100%', borderRadius: 2, background: tc, width: `${w}%`, transition: 'width 0.3s' }} />
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: tc, flexShrink: 0, minWidth: 24, textAlign: 'right' }}>{c.count}</div>
                                </ListRow>
                            );
                        })}
                    </Card>
                </div>

                <div>
                    <SectionTitle icon={Users}>{t('usage.violations_by_user')}</SectionTitle>
                    <Card>
                        {filteredByUser.length === 0 ? <EmptyInline text={t('usage.no_violations')} /> : filteredByUser.slice(0, 8).map((u, i) => {
                            const userTotal = Number(u.total) || 0;
                            const userPct = totalEvents > 0 ? Math.round((userTotal / totalEvents) * 100) : 0;
                            return (
                                <ListRow key={i} onClick={() => handleSafetyDrill('user', u.user_id, u.display_name || u.user_id)}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                        <Avatar user={u} color={getColor(i + 5)} />
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.display_name}</div>
                                            <div style={{ display: 'flex', gap: 6, marginTop: 2, fontSize: 10, alignItems: 'center' }}>
                                                {Number(u.moderation) > 0 && <span style={{ color: '#f59e0b', fontWeight: 600 }}>{u.moderation} mod</span>}
                                                {Number(u.pii) > 0 && <span style={{ color: '#14b8a6', fontWeight: 600 }}>{u.pii} pii</span>}
                                                {Number(u.regex) > 0 && <span style={{ color: '#3b82f6', fontWeight: 600 }}>{u.regex} regex</span>}
                                            </div>
                                            <div style={{ height: 2, borderRadius: 1, background: 'var(--bg-tertiary)', marginTop: 3, overflow: 'hidden' }}>
                                                <div style={{ height: '100%', borderRadius: 1, background: '#ef4444', width: `${userPct}%`, transition: 'width 0.3s' }} />
                                            </div>
                                            {u.last_event && <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{t('usage.safety_last_event')}: {new Date(u.last_event).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                                        <span style={{ fontSize: 14, fontWeight: 700, color: '#ef4444' }}>{userTotal}</span>
                                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{userPct}% {t('usage.safety_of_total')}</span>
                                    </div>
                                </ListRow>
                            );
                        })}
                    </Card>
                </div>

                <div>
                    <SectionTitle icon={Shield}>{t('usage.safety_by_action')}</SectionTitle>
                    <Card>
                        {guardrails.byAction.length === 0 ? <EmptyInline text={t('usage.no_violations')} /> : (() => {
                            const actionMap = new Map();
                            for (const a of guardrails.byAction) {
                                const key = a.action_taken;
                                if (!actionMap.has(key)) actionMap.set(key, { action: key, count: 0, types: {} });
                                const entry = actionMap.get(key);
                                entry.count += Number(a.count) || 0;
                                entry.types[a.violation_type] = (entry.types[a.violation_type] || 0) + (Number(a.count) || 0);
                            }
                            const actions = Array.from(actionMap.values()).sort((a, b) => b.count - a.count);
                            const maxAction = Math.max(...actions.map(a => a.count), 1);
                            return actions.map((a, i) => {
                                const ac = actionColorFn(a.action);
                                const w = Math.max(8, (a.count / maxAction) * 100);
                                return (
                                    <ListRow key={i} onClick={() => handleSafetyDrill('action', a.action, actionLabel(a.action))}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 6, background: `${ac}15`, color: ac, fontSize: 10, fontWeight: 700, textTransform: 'capitalize' }}>{actionLabel(a.action)}</span>
                                            </div>
                                            <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', borderRadius: 2, background: ac, width: `${w}%`, transition: 'width 0.3s' }} />
                                            </div>
                                            <div style={{ display: 'flex', gap: 6, marginTop: 3, fontSize: 9, color: 'var(--text-muted)' }}>
                                                {Object.entries(a.types).map(([type, cnt]) => (<span key={type} style={{ color: typeColorFn(type), fontWeight: 600 }}>{cnt} {type}</span>))}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: ac, flexShrink: 0, minWidth: 24, textAlign: 'right' }}>{a.count}</div>
                                    </ListRow>
                                );
                            });
                        })()}
                    </Card>
                </div>
            </MetricGrid>

            {/* Recent events */}
            {filteredRecent.length > 0 && (
                <div ref={guardrailEventsRef}>
                    {safetyDrill && <DrillChip axis={safetyDrill.axis} label={safetyDrill.label || safetyDrill.key} onClear={() => setSafetyDrill(null)} />}
                    <CollapsibleSection title={t('usage.recent_guardrail_events')} icon={Clock} count={filteredRecent.length} defaultOpen>
                        <Card>
                            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 80px 90px 1fr 55px 90px', padding: '8px 14px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-subtle)' }}>
                                {[t('usage.col_time'), t('usage.col_user'), t('usage.col_type'), t('usage.col_agent'), t('usage.col_categories'), t('usage.col_direction'), t('usage.col_action')].map(h => (
                                    <span key={h} style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>{h}</span>
                                ))}
                            </div>
                            {filteredRecent.slice(0, safetyShowCount).map((ev, i) => {
                                const tc = typeColorFn(ev.violation_type);
                                const ac = actionColorFn(ev.action_taken);
                                const isExpanded = expandedEventId === i;
                                const srcDetail = getSourceDetails(ev.source);
                                return (
                                    <React.Fragment key={i}>
                                        <div onClick={() => setExpandedEventId(isExpanded ? null : i)} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 80px 90px 1fr 55px 90px', padding: '7px 14px', alignItems: 'center', background: isExpanded ? 'var(--bg-tertiary)' : (i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)'), borderBottom: isExpanded ? 'none' : '1px solid var(--border-subtle)', fontSize: 11, cursor: 'pointer' }}>
                                            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{new Date(ev.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--text-primary)', minWidth: 0 }}>
                                                <Avatar user={ev} color={getColor(i)} size={18} />
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.display_name || ev.user_id || 'Unknown'}</span>
                                            </span>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                                <span style={{ width: 6, height: 6, borderRadius: 99, background: tc }} />
                                                <span style={{ fontWeight: 600, color: tc, textTransform: 'capitalize' }}>{ev.violation_type}</span>
                                            </span>
                                            <span style={{ fontSize: 10, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.agent_name || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Direct</span>}</span>
                                            <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ev.violation_categories}>{ev.violation_categories || '—'}</span>
                                            <span style={{ color: ev.direction === 'output' ? '#f59e0b' : '#3b82f6', fontWeight: 600, textTransform: 'capitalize', fontSize: 10 }}>{ev.direction}</span>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 5, background: `${ac}12`, color: ac, fontWeight: 700, fontSize: 9, textTransform: 'capitalize' }}>{actionLabel(ev.action_taken)}</span>
                                        </div>
                                        {isExpanded && (
                                            <div style={{ padding: '8px 14px 10px 14px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 10 }}>
                                                {ev.source && <div><span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t('usage.col_source')}: </span><span style={{ color: srcDetail.color, fontWeight: 600 }}>{srcDetail.label}</span></div>}
                                                {ev.model && <div><span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t('usage.safety_model')}: </span><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{shortModel(ev.model)}</span></div>}
                                                {ev.conversation_id && <div><span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t('usage.safety_conversation')}: </span><span style={{ color: 'var(--text-primary)', fontWeight: 500, fontFamily: 'monospace', fontSize: 9 }}>{ev.conversation_id.substring(0, 12)}…</span></div>}
                                                {ev.violation_categories && <div><span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t('usage.col_categories')}: </span><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{ev.violation_categories}</span></div>}
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                            {filteredRecent.length > safetyShowCount && <ShowMore remaining={filteredRecent.length - safetyShowCount} onMore={() => setSafetyShowCount(c => c + 20)} label={t('usage.safety_show_more', 'Show more')} />}
                        </Card>
                    </CollapsibleSection>
                </div>
            )}

            {totalEvents === 0 && filteredRecent.length === 0 && (
                <Card style={{ padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Shield style={{ width: 18, height: 18, color: 'var(--text-muted)' }} />
                    </div>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t('usage.no_guardrail_data')}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t('usage.safety_subtitle')}</div>
                    </div>
                </Card>
            )}
        </div>
    );
}

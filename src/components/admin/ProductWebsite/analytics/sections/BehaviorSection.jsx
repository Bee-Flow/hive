/**
 * Behavior — funnels, user journeys, retention and goals.
 *
 * These reports are computed by Umami from pageviews plus the custom events the
 * public renderer emits (cta_click, form_submit, outbound_click, file_download).
 *
 * Response shapes differ a little between Umami builds, so every reader here is
 * tolerant: it accepts the documented shape and the obvious variants, and falls
 * back to an honest empty state rather than rendering a confident wrong number.
 */
import React, { useState } from 'react';
import { Filter, GitBranch, Repeat, Target, Plus, X } from 'lucide-react';
import { useAnalyticsQuery } from '../useAnalyticsQuery';
import { ACCENT, PALETTE, Card, Empty, ErrorNote, Skeleton, fmt, paletteAt } from '../ui';

const TABS = [
    { id: 'funnel', label: 'Funnel', icon: Filter },
    { id: 'journey', label: 'Journeys', icon: GitBranch },
    { id: 'retention', label: 'Retention', icon: Repeat },
    { id: 'goals', label: 'Goals', icon: Target },
];

export default function BehaviorSection({ scope, onDrill }) {
    const [tab, setTab] = useState('funnel');
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {TABS.map(t => {
                    const Icon = t.icon;
                    const active = t.id === tab;
                    return (
                        <button key={t.id} onClick={() => setTab(t.id)} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                            borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                            background: active ? `${ACCENT}14` : 'var(--bg-secondary, #1a1a2e)',
                            border: `1px solid ${active ? `${ACCENT}66` : 'var(--border-default, rgba(255,255,255,0.1))'}`,
                            color: active ? ACCENT : 'var(--text-muted, #888)',
                        }}>
                            <Icon style={{ width: 13, height: 13 }} /> {t.label}
                        </button>
                    );
                })}
            </div>

            {tab === 'funnel' && <FunnelPanel scope={scope} />}
            {tab === 'journey' && <JourneyPanel scope={scope} onDrill={onDrill} />}
            {tab === 'retention' && <RetentionPanel scope={scope} />}
            {tab === 'goals' && <GoalsPanel scope={scope} />}
        </div>
    );
}

// ── Funnel ───────────────────────────────────────────────────────────

function readFunnel(payload) {
    const rows = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
    return rows.map(r => ({
        label: r.value ?? r.x ?? r.type ?? '',
        visitors: Number(r.visitors ?? r.y ?? r.count ?? 0),
        dropoff: r.dropoff != null ? Number(r.dropoff) : null,
    }));
}

/**
 * A funnel worth showing before the user has built one.
 *
 * The tab used to open on an empty box with a single "Add a step…" dropdown,
 * so it read as broken on arrival and demanded data modelling before it showed
 * anything. The busiest landing page → the next busiest page → a conversion
 * event is the funnel almost everyone would have drawn anyway.
 */
function defaultSteps(pageRows, eventRows) {
    const pages = pageRows.filter(p => p.x).slice(0, 3);
    if (pages.length < 2) return [];
    const home = pages.find(p => p.x === '/') || pages[0];
    const next = pages.find(p => p.x !== home.x);
    if (!next) return [];

    const steps = [{ type: 'path', value: home.x }, { type: 'path', value: next.x }];
    const conversion = eventRows.find(e => e.x === 'form_submit') || eventRows.find(e => e.x === 'cta_click');
    if (conversion) steps.push({ type: 'event', value: conversion.x });
    return steps;
}

function FunnelPanel({ scope }) {
    const pages = useAnalyticsQuery('query', 'metrics', scope, { params: { type: 'path', limit: 30 } });
    const events = useAnalyticsQuery('query', 'metrics', scope, { params: { type: 'event', limit: 30 } });
    // null = "the user has not touched this yet", which is distinct from an
    // explicitly cleared funnel — clearing must not immediately re-seed.
    const [steps, setSteps] = useState(null);

    const pageRows = Array.isArray(pages.payload) ? pages.payload : [];
    const eventRows = Array.isArray(events.payload) ? events.payload : [];
    const pageOptions = pageRows.map(p => ({ type: 'path', value: p.x }));
    const eventOptions = eventRows.map(p => ({ type: 'event', value: p.x }));

    const effectiveSteps = steps ?? defaultSteps(pageRows, eventRows);
    const isDefault = steps === null && effectiveSteps.length > 0;
    const setStepsFrom = (fn) => setSteps(fn(effectiveSteps));

    const ready = effectiveSteps.length >= 2;
    const funnel = useAnalyticsQuery('report', 'funnel', scope, {
        body: { steps: effectiveSteps, window: 60 },
        enabled: ready,
    });

    const rows = readFunnel(funnel.payload);
    const top = rows[0]?.visitors || 0;
    const bottom = rows.length ? rows[rows.length - 1].visitors : 0;
    const conversion = top > 0 ? (bottom / top) * 100 : null;

    const addStep = (raw) => {
        if (!raw) return;
        const [type, ...rest] = raw.split(':');
        setStepsFrom(s => [...s, { type, value: rest.join(':') }]);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Card title="Build a funnel" icon={Filter} action={
                isDefault ? (
                    <span style={{ fontSize: 10, color: 'var(--text-muted, #777)' }}>
                        suggested — edit the steps to make it yours
                    </span>
                ) : null
            }>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {effectiveSteps.map((s, i) => (
                        <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8,
                            background: 'var(--bg-tertiary, rgba(255,255,255,0.03))',
                        }}>
                            <span style={{
                                width: 20, height: 20, borderRadius: 99, flexShrink: 0, fontSize: 11, fontWeight: 800,
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                background: `${paletteAt(i)}22`, color: paletteAt(i),
                            }}>{i + 1}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>{s.type}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-primary, #fff)', flex: 1 }}>{s.value}</span>
                            <button onClick={() => setStepsFrom(list => list.filter((_, j) => j !== i))}
                                aria-label={`Remove step ${i + 1}`}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted, #888)', cursor: 'pointer' }}>
                                <X style={{ width: 13, height: 13 }} />
                            </button>
                        </div>
                    ))}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Plus style={{ width: 13, height: 13, color: ACCENT }} />
                        <select
                            value=""
                            onChange={(e) => { addStep(e.target.value); e.target.value = ''; }}
                            style={{
                                background: 'var(--bg-primary, #0f0f1a)', color: 'var(--text-primary, #fff)',
                                border: '1px solid var(--border-default, rgba(255,255,255,0.12))',
                                borderRadius: 8, padding: '7px 10px', fontSize: 12, minWidth: 260,
                            }}
                        >
                            <option value="">Add a step…</option>
                            {pageOptions.length > 0 && (
                                <optgroup label="Pages">
                                    {pageOptions.map((o, i) => <option key={`p${i}`} value={`path:${o.value}`}>{o.value}</option>)}
                                </optgroup>
                            )}
                            {eventOptions.length > 0 && (
                                <optgroup label="Events">
                                    {eventOptions.map((o, i) => <option key={`e${i}`} value={`event:${o.value}`}>{o.value}</option>)}
                                </optgroup>
                            )}
                        </select>
                        {effectiveSteps.length > 0 && (
                            <button onClick={() => setSteps([])} style={{
                                background: 'transparent', border: '1px solid var(--border-default, rgba(255,255,255,0.12))',
                                borderRadius: 8, padding: '6px 10px', fontSize: 12, color: 'var(--text-muted, #888)', cursor: 'pointer',
                            }}>Clear</button>
                        )}
                    </div>
                    {!ready && (
                        <p style={{ fontSize: 11, color: 'var(--text-muted, #777)', margin: 0 }}>
                            {pageOptions.length < 2
                                ? 'Once visitors have seen at least two different pages, a funnel can be built here.'
                                : 'Pick at least two steps to see conversion and drop-off.'}
                        </p>
                    )}
                </div>
            </Card>

            {ready && (
                <Card title="Conversion" action={
                    conversion != null ? (
                        <span style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>
                            <strong style={{ color: ACCENT, fontSize: 15 }}>{conversion.toFixed(1)}%</strong>
                            {' '}made it all the way through
                        </span>
                    ) : null
                }>
                    {funnel.loading ? <Skeleton height={200} />
                        : funnel.error ? <ErrorNote message={funnel.error} onRetry={funnel.reload} compact />
                        : rows.length === 0 ? <Empty text="No visitors completed this path in the selected period." />
                        : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {rows.map((r, i) => {
                                    const pct = top > 0 ? Math.round((r.visitors / top) * 100) : 0;
                                    const prev = i > 0 ? rows[i - 1].visitors : null;
                                    const drop = prev ? prev - r.visitors : 0;
                                    return (
                                        <div key={i}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
                                                <span style={{ fontSize: 12, color: 'var(--text-primary, #fff)' }}>
                                                    {i + 1}. {r.label || effectiveSteps[i]?.value}
                                                </span>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>
                                                    {fmt(r.visitors)} <span style={{ color: 'var(--text-muted, #888)', fontWeight: 500 }}>({pct}%)</span>
                                                </span>
                                            </div>
                                            <div style={{ height: 10, borderRadius: 5, background: 'var(--bg-tertiary, rgba(255,255,255,0.06))', overflow: 'hidden' }}>
                                                <div style={{ width: `${pct}%`, height: '100%', background: paletteAt(i) }} />
                                            </div>
                                            {prev != null && drop > 0 && (
                                                <div style={{ fontSize: 11, color: '#f87171', marginTop: 3 }}>
                                                    −{fmt(drop)} dropped off here
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                </Card>
            )}
        </div>
    );
}

// ── Journeys ─────────────────────────────────────────────────────────

function readJourneys(payload) {
    const rows = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
    return rows.map(r => ({
        path: Array.isArray(r.items) ? r.items : (Array.isArray(r.path) ? r.path : []),
        count: Number(r.count ?? r.y ?? r.visitors ?? 0),
    })).filter(r => r.path.length > 0);
}

function JourneyPanel({ scope, onDrill }) {
    const [depth, setDepth] = useState(3);
    const { payload, loading, error, reload } = useAnalyticsQuery('report', 'journey', scope, {
        body: { steps: depth },
    });
    const journeys = readJourneys(payload);

    return (
        <Card title="Common journeys" icon={GitBranch} action={
            <select value={depth} onChange={(e) => setDepth(Number(e.target.value))} style={{
                background: 'var(--bg-primary, #0f0f1a)', color: 'var(--text-primary, #fff)',
                border: '1px solid var(--border-default, rgba(255,255,255,0.12))',
                borderRadius: 7, padding: '4px 8px', fontSize: 11,
            }}>
                {[3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n} steps</option>)}
            </select>
        }>
            {loading ? <Skeleton height={220} />
                : error ? <ErrorNote message={error} onRetry={reload} compact />
                : journeys.length === 0 ? <Empty text="Not enough multi-page sessions in this period to build journeys." />
                : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {journeys.slice(0, 15).map((j, i) => (
                            <div key={i} style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-tertiary, rgba(255,255,255,0.03))' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                                    {j.path.map((step, k) => (
                                        <React.Fragment key={k}>
                                            {k > 0 && <span style={{ color: 'var(--text-muted, #666)', fontSize: 11 }}>→</span>}
                                            <button
                                                onClick={() => step && onDrill('path', step)}
                                                style={{
                                                    background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                                                    fontSize: 12, color: 'var(--text-primary, #fff)',
                                                }}
                                            >{step || '(exit)'}</button>
                                        </React.Fragment>
                                    ))}
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT }}>{fmt(j.count)} sessions</span>
                            </div>
                        ))}
                    </div>
                )}
        </Card>
    );
}

// ── Retention ────────────────────────────────────────────────────────

function readRetention(payload) {
    const rows = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
    const byCohort = new Map();
    for (const r of rows) {
        const cohort = r.date ?? r.cohort ?? '';
        const day = Number(r.day ?? r.offset ?? 0);
        const pct = r.percentage != null ? Number(r.percentage)
            : (r.visitors && r.returnVisitors != null ? (Number(r.returnVisitors) / Number(r.visitors)) * 100 : null);
        if (!cohort) continue;
        if (!byCohort.has(cohort)) byCohort.set(cohort, { cohort, visitors: Number(r.visitors ?? 0), days: new Map() });
        byCohort.get(cohort).days.set(day, pct);
    }
    return [...byCohort.values()];
}

function RetentionPanel({ scope }) {
    const { payload, loading, error, reload } = useAnalyticsQuery('report', 'retention', scope);
    const cohorts = readRetention(payload);
    const maxDay = Math.min(10, Math.max(0, ...cohorts.flatMap(c => [...c.days.keys()])));

    if (loading) return <Card title="Retention"><Skeleton height={240} /></Card>;
    if (error) return <Card title="Retention"><ErrorNote message={error} onRetry={reload} compact /></Card>;
    if (!cohorts.length) {
        return <Card title="Retention" icon={Repeat}><Empty text="No returning-visitor data for this period yet." /></Card>;
    }

    return (
        <Card title="Retention" icon={Repeat}>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'separate', borderSpacing: 2, fontSize: 11 }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left', color: 'var(--text-muted, #888)', fontWeight: 600, padding: '2px 6px' }}>Cohort</th>
                            <th style={{ textAlign: 'right', color: 'var(--text-muted, #888)', fontWeight: 600, padding: '2px 6px' }}>Visitors</th>
                            {Array.from({ length: maxDay + 1 }, (_, d) => (
                                <th key={d} style={{ color: 'var(--text-muted, #888)', fontWeight: 600, padding: '2px 6px', minWidth: 38 }}>D{d}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {cohorts.slice(0, 14).map(c => (
                            <tr key={c.cohort}>
                                <td style={{ color: 'var(--text-primary, #fff)', padding: '2px 6px', whiteSpace: 'nowrap' }}>
                                    {String(c.cohort).slice(0, 10)}
                                </td>
                                <td style={{ color: 'var(--text-muted, #999)', padding: '2px 6px', textAlign: 'right' }}>{fmt(c.visitors)}</td>
                                {Array.from({ length: maxDay + 1 }, (_, d) => {
                                    const pct = c.days.get(d);
                                    const t = pct == null ? 0 : Math.max(0, Math.min(1, pct / 100));
                                    return (
                                        <td key={d} title={pct == null ? '' : `${Math.round(pct)}%`} style={{
                                            textAlign: 'center', padding: '4px 6px', borderRadius: 4,
                                            background: pct == null ? 'transparent' : `rgba(20,184,166,${0.12 + t * 0.75})`,
                                            color: pct == null ? 'var(--text-muted, #555)' : '#fff', fontWeight: 700,
                                        }}>
                                            {pct == null ? '·' : `${Math.round(pct)}%`}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}

// ── Goals ────────────────────────────────────────────────────────────

function GoalsPanel({ scope }) {
    const [goal, setGoal] = useState(null);
    const pages = useAnalyticsQuery('query', 'metrics', scope, { params: { type: 'path', limit: 20 } });
    const events = useAnalyticsQuery('query', 'metrics', scope, { params: { type: 'event', limit: 20 } });

    const result = useAnalyticsQuery('report', 'goal', scope, {
        body: goal ? { type: goal.type, value: goal.value } : undefined,
        enabled: !!goal,
    });

    const options = [
        ...(Array.isArray(pages.payload) ? pages.payload : []).map(p => ({ type: 'path', value: p.x })),
        ...(Array.isArray(events.payload) ? events.payload : []).map(p => ({ type: 'event', value: p.x })),
    ];

    // Umami answers { num, total }: num = visitors who reached the goal,
    // total = visitors in the period. Reading `count` first — a key that does
    // not exist — fell through to `total` and printed the DENOMINATOR as the
    // conversion count, so every goal looked like it converted everyone.
    const raw = result.payload;
    const reached = raw && typeof raw === 'object' && raw.num != null ? Number(raw.num)
        : typeof raw === 'number' ? raw
        : null;
    const audience = raw && typeof raw === 'object' && raw.total != null ? Number(raw.total) : null;
    const rate = reached != null && audience ? (reached / audience) * 100 : null;

    return (
        <Card title="Goal conversion" icon={Target}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <select
                    value={goal ? `${goal.type}:${goal.value}` : ''}
                    onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return setGoal(null);
                        const [type, ...rest] = v.split(':');
                        setGoal({ type, value: rest.join(':') });
                    }}
                    style={{
                        background: 'var(--bg-primary, #0f0f1a)', color: 'var(--text-primary, #fff)',
                        border: '1px solid var(--border-default, rgba(255,255,255,0.12))',
                        borderRadius: 8, padding: '7px 10px', fontSize: 12, maxWidth: 340,
                    }}
                >
                    <option value="">Choose a page or event as the goal…</option>
                    {options.map((o, i) => (
                        <option key={i} value={`${o.type}:${o.value}`}>{o.type}: {o.value}</option>
                    ))}
                </select>

                {!goal ? <Empty text="Pick a goal to see how many visitors reached it." />
                    : result.loading ? <Skeleton height={80} />
                    : result.error ? <ErrorNote message={result.error} onRetry={result.reload} compact />
                    : (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 28, fontWeight: 800, color: ACCENT, lineHeight: 1.1 }}>
                                    {reached == null ? '—' : fmt(reached)}
                                </span>
                                {rate != null && (
                                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary, #aaa)' }}>
                                        {rate.toFixed(1)}% of {fmt(audience)}
                                    </span>
                                )}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>
                                visitors reached {goal.type === 'event' ? 'the event' : 'the page'} “{goal.value}”
                            </div>
                        </div>
                    )}
            </div>
        </Card>
    );
}

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { useTranslation } from '../../hooks/useTranslation';
import { Bot, MessageSquare, BookOpen, Search, Code, LayoutTemplate, Filter, X, Cpu, Users, ChevronDown, Activity, ArrowUpRight, ArrowDownLeft, BarChart3, Zap, DollarSign, TrendingUp, ChevronRight, Shield, AlertTriangle, Eye, Fingerprint, Clock, Globe, Server, ArrowRight, ArrowLeft, Link2, Info, FileText, ScanEye, ShieldCheck, Binary, ThumbsUp } from 'lucide-react';
import OrgFeedbackPanel from './OrgFeedbackPanel';
import OrgTerminationsPanel from './OrgTerminationsPanel';
import { useLicenseContext } from '../../components/LicenseContext';
import { getIntegrationIcon, hasIntegrationIcon } from '../../config/integrationIcons';
import { rowsToCsv as rowsToCsvShared, downloadCsv as downloadCsvShared, computeHalfPeriodDelta } from '../../utils/usageHelpers';
import {
    PALETTE,
    paletteColor,
    OPERATOR_COLORS,
    operatorColor,
    ALERT_SCORE_THRESHOLD,
    OVERVIEW_COST_ALERT,
    SAFETY_PII_ALERT,
} from '../../config/analyticsConfig';

// ── Formatters ──────────────────────────────────────────────────────────────
const fNum = (n) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n?.toLocaleString() || '0';
};
const fCur = (c) => `$${(c || 0).toFixed(2)}`;

const currencySym = (c) => ({ EUR: '€', USD: '$', GBP: '£' }[String(c || 'EUR').toUpperCase()] || (c || '€'));
const formatDateRange = (startIso, endIso) => {
    try {
        const a = startIso ? new Date(startIso) : null;
        const b = endIso ? new Date(endIso) : null;
        const opts = { day: 'numeric', month: 'short' };
        const yearOpts = { day: 'numeric', month: 'short', year: 'numeric' };
        if (!a || !b) return '';
        const sameYear = a.getFullYear() === b.getFullYear();
        return `${a.toLocaleDateString(undefined, opts)} – ${b.toLocaleDateString(undefined, sameYear ? yearOpts : yearOpts)}`;
    } catch { return ''; }
};

const shortModel = (m) => {
    if (!m) return 'Unknown';
    return m.replace(/^(openai\/|anthropic\/|google\/|azure\/|mistral\/)/, '')
             .replace(/-\d{4}-\d{2}-\d{2}$/, '');
};

// ── Source details ──────────────────────────────────────────────────────────
const SOURCE_MAP = {
    agent: { label: 'Agent Chat', icon: Bot, color: '#0ea5e9' },
    chat: { label: 'Agent Chat', icon: Bot, color: '#0ea5e9' },
    direct: { label: 'Direct Chat', icon: MessageSquare, color: '#10b981' },
    notebook: { label: 'Notebooks', icon: BookOpen, color: '#14b8a6' },
    research: { label: 'Research', icon: Search, color: '#f59e0b' },
    template: { label: 'Templates', icon: LayoutTemplate, color: '#ef4444' },
    designer: { label: 'App Designer', icon: Code, color: '#0ea5e9' },
    agent_stream: { label: 'Agent Stream', icon: Bot, color: '#0ea5e9' },
};
const getSourceDetails = (source) => SOURCE_MAP[source] || { label: source || 'Other', icon: Bot, color: '#94a3b8' };

// CSV helpers live in src/utils/usageHelpers.js — bind local names that match
// the existing call sites in this file.
const rowsToCsv = rowsToCsvShared;
const downloadCsv = downloadCsvShared;

// Colours, palette, and thresholds live in src/config/analyticsConfig.ts.
// `getColor` is a local alias to keep the existing call sites short.
const getColor = paletteColor;

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  MINI COMPONENTS                                                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

const Card = ({ children, style }) => (
    <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
        borderRadius: 12, overflow: 'hidden', ...style,
    }}>{children}</div>
);

const StatCard = ({ icon: Icon, label, value, sub, color }) => (
    <Card style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
            <div style={{
                width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${color}15`,
            }}>
                <Icon style={{ width: 13, height: 13, color }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{label}</span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{value}</div>
        {sub && <div style={{ marginTop: 2 }}>{sub}</div>}
    </Card>
);

// Sovereignty-over-time mini chart — stacked columns showing EU/Local on
// emerald and Non-EU on amber per day, with the EU% printed above each bar.
// Inline SVG, no chart dep. Renders nothing when there's only one bucket
// (caller falls back to the MiniStat grid in that case).
const SovereigntyTrend = ({ timeline }) => {
    if (!Array.isArray(timeline) || timeline.length < 2) return null;
    const data = timeline.map(r => ({
        period: r.period,
        eu: Number(r.eu_count || 0),
        local: Number(r.local_count || 0),
        nonEu: Number(r.non_eu_count || 0),
        total: Number(r.total || 0),
    }));
    const maxTotal = Math.max(...data.map(d => d.total), 1);
    const H = 90;
    const PAD_T = 14; // room for EU% labels
    const PAD_B = 18; // room for date labels
    const barW = 12;
    const gap = 6;
    const W = data.length * (barW + gap) + gap;
    return (
        <div style={{ padding: '6px 4px 0 4px', overflowX: 'auto' }}>
            <svg width={W} height={H + PAD_T + PAD_B} style={{ display: 'block' }}>
                {data.map((d, i) => {
                    const x = gap + i * (barW + gap);
                    const totalH = Math.round((d.total / maxTotal) * H);
                    const euLocal = d.eu + d.local;
                    const euLocalH = d.total > 0 ? Math.round((euLocal / d.total) * totalH) : 0;
                    const nonEuH = totalH - euLocalH;
                    const yTop = PAD_T + (H - totalH);
                    const pctEu = d.total > 0 ? Math.round((euLocal / d.total) * 100) : 0;
                    const pctColor = pctEu >= 80 ? '#10b981' : pctEu >= 40 ? '#f59e0b' : '#ef4444';
                    const dateLabel = (d.period || '').slice(5); // MM-DD
                    return (
                        <g key={i}>
                            {/* EU% label above the bar */}
                            {d.total > 0 && (
                                <text x={x + barW / 2} y={PAD_T - 3} fontSize="8" fontWeight="700" textAnchor="middle" fill={pctColor}>{pctEu}%</text>
                            )}
                            {/* Non-EU on top (amber) */}
                            {nonEuH > 0 && (
                                <rect x={x} y={yTop} width={barW} height={nonEuH} rx="2" fill="#f59e0b">
                                    <title>{`${d.period}: ${d.nonEu} non-EU of ${d.total}`}</title>
                                </rect>
                            )}
                            {/* EU+Local on bottom (emerald) */}
                            {euLocalH > 0 && (
                                <rect x={x} y={yTop + nonEuH} width={barW} height={euLocalH} rx="2" fill="#10b981">
                                    <title>{`${d.period}: ${euLocal} EU/local of ${d.total} (${pctEu}%)`}</title>
                                </rect>
                            )}
                            {/* Date label */}
                            <text x={x + barW / 2} y={PAD_T + H + 12} fontSize="8" textAnchor="middle" fill="var(--text-muted)">{dateLabel}</text>
                        </g>
                    );
                })}
            </svg>
            <div style={{ display: 'flex', gap: 10, fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', marginTop: 2 }}>
                <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#10b981', marginRight: 4 }} />EU+Local</span>
                <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#f59e0b', marginRight: 4 }} />Non-EU</span>
            </div>
        </div>
    );
};

// One row of the Sovereignty breakdown panel. Same shape regardless of axis.
const SovereigntyRow = ({ row, onClick, avatarFor, topOperatorColorFor }) => {
    const total = Number(row.total || 0);
    const eu = Number(row.eu_count || 0);
    const local = Number(row.local_count || 0);
    const nonEu = Number(row.non_eu_count || 0);
    const piiNonEu = Number(row.pii_non_eu_count || 0);
    // PII-weighted sovereignty score (same formula as the hero) — a PII leak to a
    // non-EU server counts twice in the denominator. Rows with no data hit 100.
    const score = total > 0 ? Math.round(((eu + local) / (total + piiNonEu)) * 100) : 100;
    const euPct = total > 0 ? (eu / total) * 100 : 0;
    const localPct = total > 0 ? (local / total) * 100 : 0;
    const nonEuPct = total > 0 ? (nonEu / total) * 100 : 0;
    const scoreColor = score >= 80 ? '#10b981' : score >= 60 ? '#84cc16' : score >= 40 ? '#f59e0b' : score >= 20 ? '#f97316' : '#ef4444';
    const opColor = topOperatorColorFor ? topOperatorColorFor(row.top_operator) : '#94a3b8';
    return (
        <div
            onClick={onClick}
            style={{
                display: 'grid', gridTemplateColumns: '32px 1fr 70px', alignItems: 'center', gap: 12,
                padding: '10px 12px',
                background: 'var(--bg-primary)',
                borderBottom: '1px solid var(--border-subtle)',
                cursor: onClick ? 'pointer' : 'default',
                transition: 'background 0.12s',
            }}
            onMouseEnter={e => { if (onClick) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
            onMouseLeave={e => { if (onClick) e.currentTarget.style.background = 'var(--bg-primary)'; }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {avatarFor ? avatarFor(row) : <div style={{ width: 26, height: 26, borderRadius: '50%', background: opColor, opacity: 0.18 }} />}
            </div>
            <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'capitalize' }} title={row.label}>{(row.label || row.key || '').toString().replace(/_/g, ' ')}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{total} call{total === 1 ? '' : 's'}</span>
                </div>
                {/* Stacked bar */}
                <div style={{ display: 'flex', height: 7, borderRadius: 99, overflow: 'hidden', background: 'var(--bg-tertiary)' }}>
                    {eu > 0 && <div style={{ width: `${euPct}%`, background: '#10b981' }} title={`${eu} EU/EEA`} />}
                    {local > 0 && <div style={{ width: `${localPct}%`, background: '#14b8a6' }} title={`${local} Local`} />}
                    {nonEu > 0 && <div style={{ width: `${nonEuPct}%`, background: '#f59e0b' }} title={`${nonEu} Non-EU`} />}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 9, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    {eu > 0 && <span><span style={{ color: '#10b981', fontWeight: 700 }}>{eu}</span> EU</span>}
                    {local > 0 && <span><span style={{ color: '#14b8a6', fontWeight: 700 }}>{local}</span> Local</span>}
                    {nonEu > 0 && <span><span style={{ color: '#f59e0b', fontWeight: 700 }}>{nonEu}</span> Non-EU</span>}
                    {piiNonEu > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#ef4444', fontWeight: 700 }}>
                            <Fingerprint style={{ width: 9, height: 9 }} />
                            −{piiNonEu} PII abroad
                        </span>
                    )}
                    {row.top_operator && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: opColor }} />
                            top: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.top_operator}</span>
                        </span>
                    )}
                </div>
            </div>
            <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: scoreColor, letterSpacing: '-0.03em', lineHeight: 1 }}>{score}</div>
                <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>Score</div>
            </div>
        </div>
    );
};

// Action-required banner shape, reused across all four monitoring tabs.
// severity = 'amber' or 'red' — the only two visual states. Hidden by the
// caller when no alert applies.
const AlertBanner = ({ severity = 'amber', title = 'Action required', message, ctaLabel, onCta }) => {
    const c = severity === 'red' ? '#ef4444' : '#f59e0b';
    return (
        <div style={{
            marginBottom: 14, padding: '12px 16px', borderRadius: 12,
            background: `${c}10`, border: `1px solid ${c}55`,
            display: 'flex', alignItems: 'center', gap: 12,
        }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${c}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle style={{ width: 16, height: 16, color: c }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: c }}>{title}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 1 }}>{message}</div>
            </div>
            {ctaLabel && onCta && (
                <button
                    onClick={onCta}
                    style={{
                        padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: c, color: 'white', fontWeight: 700, fontSize: 12,
                        display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
                    }}
                >
                    {ctaLabel} <ChevronRight style={{ width: 14, height: 14 }} />
                </button>
            )}
        </div>
    );
};

// Tiny sparkline for the MiniStat tiles. ~50×16, no chart dep.
const Sparkline = ({ values, color = '#0ea5e9', width = 60, height = 16 }) => {
    if (!Array.isArray(values) || values.length < 2) return null;
    const max = Math.max(...values, 1);
    const points = values.map((v, i) => {
        const x = (i / (values.length - 1)) * (width - 2) + 1;
        const y = height - 1 - ((v / max) * (height - 2));
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return (
        <svg width={width} height={height} style={{ display: 'block', marginTop: 2 }}>
            <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    );
};

// Compact stat used in the sovereignty hero — smaller than StatCard so 4
// fit comfortably alongside the hero headline.
const MiniStat = ({ icon: Icon, color, label, value, spark }) => (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}15`, flexShrink: 0 }}>
            <Icon style={{ width: 14, height: 14, color }} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{value}</div>
            {Array.isArray(spark) && spark.length > 1 && <Sparkline values={spark} color={color} />}
        </div>
    </div>
);

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
            <ArrowDownLeft style={{ width: 10, height: 10, color: '#3b82f6' }} />
            <span style={{ color: '#3b82f6', fontWeight: 600 }}>{fNum(input)}</span>
            {showCost && <span style={{ color: '#3b82f6', opacity: 0.7, fontWeight: 500 }}>({fCur(inputCost)})</span>}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <ArrowUpRight style={{ width: 10, height: 10, color: '#f59e0b' }} />
            <span style={{ color: '#f59e0b', fontWeight: 600 }}>{fNum(output)}</span>
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

const SectionTitle = ({ children, icon: Icon, right }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {Icon && <Icon style={{ width: 14, height: 14, color: 'var(--accent-primary)', opacity: 0.7 }} />}
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{children}</span>
        </div>
        {right}
    </div>
);

const ListRow = ({ children, onClick, style: s }) => (
    <div
        onClick={onClick}
        style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '9px 14px', background: 'var(--bg-primary)',
            borderBottom: '1px solid var(--border-subtle)',
            cursor: onClick ? 'pointer' : 'default',
            transition: 'background 0.12s',
            ...s,
        }}
        onMouseEnter={e => { if (onClick) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
        onMouseLeave={e => { if (onClick) e.currentTarget.style.background = 'var(--bg-primary)'; }}
    >
        {children}
    </div>
);

const Avatar = ({ user, name, color, size = 26 }) => {
    const displayName = user?.display_name || name || '?';
    const avatarType = user?.avatarType;
    const avatar = user?.avatar;
    const base = {
        width: size, height: size, borderRadius: 99, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    };
    if (avatarType === 'emoji' && avatar) {
        return (
            <div style={{
                ...base, background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-default)',
                fontSize: Math.round(size * 0.5), lineHeight: 1,
            }}>
                {avatar}
            </div>
        );
    }
    if (avatarType === 'url' && avatar) {
        return (
            <img
                src={avatar}
                alt={displayName}
                style={{ ...base, objectFit: 'cover' }}
            />
        );
    }
    return (
        <div style={{
            ...base,
            fontSize: Math.round(size * 0.42), fontWeight: 700, color: '#fff',
            background: `linear-gradient(135deg, ${color || 'var(--accent-primary)'}, ${color || 'var(--accent-primary)'}99)`,
        }}>
            {displayName[0].toUpperCase()}
        </div>
    );
};

const IconBadge = ({ icon: Icon, color, size = 26 }) => (
    <div style={{
        width: size, height: size, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, background: `${color}12`,
    }}>
        <Icon style={{ width: size * 0.5, height: size * 0.5, color }} />
    </div>
);

// Renders the real brand logo for an integration (Gmail's red M, YouTrack's
// gradient block, etc.). Falls back to a colored IconBadge with a generic
// fallback icon when the registry has no brand asset for this id.
const IntegrationLogo = ({ integrationType, size = 26, fallbackColor }) => {
    const hasBrand = hasIntegrationIcon(integrationType);
    if (!hasBrand) {
        return <IconBadge icon={Globe} color={fallbackColor || '#94a3b8'} size={size} />;
    }
    const inner = size * 0.7;
    return (
        <div style={{
            width: size, height: size, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', overflow: 'hidden',
        }}>
            <div style={{ width: inner, height: inner, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {getIntegrationIcon(integrationType)}
            </div>
        </div>
    );
};

/* Sparkline */
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
                        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <polygon points={`0,100 ${points} 100,100`} fill="url(#trendFill)" />
                    <polyline points={points} fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>
        </Card>
    );
};

/* Filter pill */
const FilterPill = ({ label, icon: Icon, value, onChange, options, placeholder }) => (
    <div style={{ position: 'relative' }}>
        <div style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8,
            background: value ? `var(--accent-primary)` : 'var(--bg-primary)',
            border: `1px solid ${value ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
            fontSize: 12, fontWeight: 500,
            color: value ? '#fff' : 'var(--text-secondary)',
            transition: 'all 0.15s ease',
        }}>
            {Icon && <Icon style={{ width: 12, height: 12, flexShrink: 0 }} />}
            <select
                value={value || ''}
                onChange={(e) => onChange(e.target.value || null)}
                style={{
                    background: 'transparent', border: 'none', outline: 'none',
                    color: 'inherit', fontSize: 12, fontWeight: 500,
                    cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
                    minWidth: 60, paddingRight: 14,
                }}
            >
                <option value="">{placeholder}</option>
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown style={{ width: 11, height: 11, position: 'absolute', right: 8, pointerEvents: 'none', opacity: 0.5 }} />
        </div>
    </div>
);

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                                           */
/* ═══════════════════════════════════════════════════════════════════════════ */
/* ── Report Tab component ────────────────────────────────────────────────── */
const REPORT_TABS = [
    { id: 'overview', labelKey: 'usage.tab_overview', icon: BarChart3, color: '#0ea5e9' },
    { id: 'safety', labelKey: 'usage.tab_safety', icon: Shield, color: '#ef4444' },
    { id: 'integrations', labelKey: 'usage.tab_integrations', icon: Globe, color: '#0ea5e9' },
    { id: 'feedback', labelKey: 'usage.tab_feedback', icon: ThumbsUp, color: '#10b981' },
    { id: 'terminations', labelKey: 'usage.tab_terminations', icon: AlertTriangle, color: '#f43f5e' },
];

const ReportTabBar = ({ active, onChange, t: translate, tabs = REPORT_TABS }) => (
    <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        borderBottom: '1px solid var(--border-default, var(--border-subtle))',
    }}>
        {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = active === tab.id;
            return (
                <button
                    key={tab.id}
                    onClick={() => onChange(tab.id)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: isActive ? 'var(--bg-secondary)' : 'transparent',
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontWeight: isActive ? 500 : 400,
                        fontSize: 13, transition: 'background 0.15s ease, color 0.15s ease',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                    <Icon style={{ width: 14, height: 14, color: isActive ? tab.color : 'var(--text-muted)' }} />
                    {translate(tab.labelKey)}
                </button>
            );
        })}
    </div>
);

const UsageSection = () => {
    const { t } = useTranslation();
    // `advanced_usage_monitoring` (Enterprise+) gates every non-Overview
    // tab. The four backend routes (/api/usage/{guardrails,integrations,
    // azure-services}/* and /api/{feedback,terminations}) also enforce
    // this — the UI filter just keeps community admins from clicking
    // tabs that would 403.
    const { hasFeature: hasLicenseFeature } = useLicenseContext();
    const canSeeAdvancedUsage = hasLicenseFeature('advanced_usage_monitoring');
    const visibleTabs = useMemo(
        () => canSeeAdvancedUsage ? REPORT_TABS : REPORT_TABS.filter(tab => tab.id === 'overview'),
        [canSeeAdvancedUsage]
    );
    const [days, setDays] = useState(30);
    const [loading, setLoading] = useState(true);
    const [expandedAgent, setExpandedAgent] = useState(null);
    const [activeReport, setActiveReport] = useState('overview');

    // If the user arrived with a deep-link to a non-Overview tab (e.g.
    // ?tab=safety bookmark) but the licence dropped them back to
    // Overview, fall back so the page doesn't render an empty body.
    useEffect(() => {
        if (!canSeeAdvancedUsage && activeReport !== 'overview') {
            setActiveReport('overview');
        }
    }, [canSeeAdvancedUsage, activeReport]);

    // Resolve the user's org and pull their subscription so the customer
    // view can show plan name, billing period, seat count, and cost cap.
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

    // Filters
    const [filterUser, setFilterUser] = useState(null);
    const [filterAgent, setFilterAgent] = useState(null);
    const [filterModel, setFilterModel] = useState(null);
    const [filterSource, setFilterSource] = useState(null);
    const hasFilters = filterUser || filterAgent || filterModel || filterSource;

    const [data, setData] = useState({
        summary: null, timeline: [], users: [], sources: [],
        agents: [], models: [], modelsByAgent: [], modelsByUser: [],
    });
    // Subscription context for the customer-view header (plan, billing,
    // cost cap). Backend route is auth+org-scoped, so we resolve the
    // org id via /api/auth/my-permissions and call /api/subscriptions/orgs/:id.
    const [subscription, setSubscription] = useState(null);
    // Backend redacts token/message counts for non-admin callers and replaces
    // estimated_cost with marked-up billed_cost. Detect that shape so the UI
    // shows a cost-only customer view instead of empty token/call counters.
    const isCustomerView = data.summary && data.summary.total_calls === undefined && data.summary.billed_cost !== undefined;
    const [guardrails, setGuardrails] = useState({
        summary: null, timeline: [], byUser: [], byCategory: [], byAction: [], recent: [],
    });
    const [safetyTypeFilter, setSafetyTypeFilter] = useState(null);
    const [expandedEventId, setExpandedEventId] = useState(null);
    const [safetyShowCount, setSafetyShowCount] = useState(20);
    const [integData, setIntegData] = useState({
        summary: null, byType: [], byTool: [], piiSummary: [], servers: [], recent: [], egress: [], operators: [],
        timeline: [],
        sovereignty: { user: [], integration: [], agent: [], pii: [] },
    });
    const [egressEuFilter, setEgressEuFilter] = useState('all'); // 'all' | 'eu' | 'non-eu' | 'local'
    const [sovereigntyAxis, setSovereigntyAxis] = useState('user'); // 'user' | 'integration' | 'agent' | 'pii'
    // Click-to-filter drill from any breakdown row. Local to the egress log so
    // the global aggregates above stay visible. Only one drill active at a time.
    const [egressDrill, setEgressDrill] = useState(null); // { axis, key, label } | null
    const egressLogRef = useRef(null);
    const modelByUserRef = useRef(null);
    const guardrailEventsRef = useRef(null);
    // Safety tab drill-down (mirrors egressDrill — clicking a breakdown row
    // filters the Recent Guardrail Events table and shows a removable chip).
    const [safetyDrill, setSafetyDrill] = useState(null); // { axis, key, label }
    const [azureServices, setAzureServices] = useState({
        summary: null, byType: [], byUser: [],
    });

    const buildQS = useCallback(() => {
        const params = new URLSearchParams({ days });
        if (filterUser) params.set('user', filterUser);
        if (filterAgent) params.set('agent', filterAgent);
        if (filterModel) params.set('model', filterModel);
        if (filterSource) params.set('source', filterSource);
        return params.toString();
    }, [days, filterUser, filterAgent, filterModel, filterSource]);

    useEffect(() => {
        const fetchUsage = async () => {
            setLoading(true);
            try {
                const qs = buildQS();
                const eps = ['summary', 'timeline', 'users', 'sources', 'agents', 'models', 'models-by-agent', 'models-by-user'];
                const results = await Promise.all(eps.map(ep => authFetch(`${API_BASE}/api/usage/${ep}?${qs}`)));
                const sj = async (r, fb) => { try { if (!r.ok) return fb; const d = await r.json(); return d?.error ? fb : d; } catch { return fb; } };
                const sa = async (r) => { const d = await sj(r, []); return Array.isArray(d) ? d : []; };
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
                // Fetch guardrail data in parallel
                const gEps = ['guardrails/summary', 'guardrails/timeline', 'guardrails/by-user', 'guardrails/by-category', 'guardrails/by-action', 'guardrails/recent'];
                const gResults = await Promise.all(gEps.map(ep => authFetch(`${API_BASE}/api/usage/${ep}?${qs}`)));
                setGuardrails({
                    summary: await sj(gResults[0], {}),
                    timeline: await sa(gResults[1]),
                    byUser: await sa(gResults[2]),
                    byCategory: await sa(gResults[3]),
                    byAction: await sa(gResults[4]),
                    recent: await sa(gResults[5]),
                });
                // Fetch integration monitoring data
                const iEps = [
                    'integrations/summary',
                    'integrations/by-type',
                    'integrations/by-tool',
                    'integrations/pii-summary',
                    'integrations/servers',
                    'integrations/recent',
                    'integrations/egress?limit=200',
                    'integrations/operator-summary',
                    'integrations/timeline?interval=day',
                    'integrations/sovereignty?dimension=user',
                    'integrations/sovereignty?dimension=integration',
                    'integrations/sovereignty?dimension=agent',
                    'integrations/sovereignty?dimension=pii',
                ];
                const iResults = await Promise.all(iEps.map(ep => {
                    const sep = ep.includes('?') ? '&' : '?';
                    return authFetch(`${API_BASE}/api/usage/${ep}${sep}${qs}`);
                }));
                setIntegData({
                    summary: await sj(iResults[0], {}),
                    byType: await sa(iResults[1]),
                    byTool: await sa(iResults[2]),
                    piiSummary: await sa(iResults[3]),
                    servers: await sa(iResults[4]),
                    recent: await sa(iResults[5]),
                    egress: await sa(iResults[6]),
                    operators: await sa(iResults[7]),
                    timeline: await sa(iResults[8]),
                    sovereignty: {
                        user: await sa(iResults[9]),
                        integration: await sa(iResults[10]),
                        agent: await sa(iResults[11]),
                        pii: await sa(iResults[12]),
                    },
                });
                // Fetch Azure service cost data
                const azEps = ['azure-services/summary', 'azure-services/by-type', 'azure-services/by-user'];
                const azResults = await Promise.all(azEps.map(ep => authFetch(`${API_BASE}/api/usage/${ep}?${qs}`)));
                setAzureServices({
                    summary: await sj(azResults[0], {}),
                    byType: await sa(azResults[1]),
                    byUser: await sa(azResults[2]),
                });
            } catch (err) { console.error("Failed to load usage", err); }
            setLoading(false);
        };
        fetchUsage();
    }, [buildQS]);

    // Dropdown options
    const userOptions = useMemo(() => data.users.map(u => ({ value: u.user_id, label: u.display_name || u.user_id })), [data.users]);
    const agentOptions = useMemo(() => data.agents.map(a => ({ value: a.agent_id || a.agent_name, label: a.agent_name || 'Direct Chat' })), [data.agents]);
    const modelOptions = useMemo(() => data.models.map(m => ({ value: m.model, label: shortModel(m.model) })), [data.models]);
    const sourceOptions = useMemo(() => data.sources.map(s => ({ value: s.source, label: getSourceDetails(s.source).label })), [data.sources]);

    // Group modelsByAgent by agent
    const agentModelGroups = useMemo(() => {
        const map = new Map();
        for (const row of data.modelsByAgent) {
            const key = row.agent_name || 'Direct Chat';
            if (!map.has(key)) map.set(key, { agent_name: key, agent_id: row.agent_id, models: [], total_tokens: 0, estimated_cost: 0 });
            const group = map.get(key);
            group.models.push(row);
            group.total_tokens += row.total_tokens || 0;
            group.estimated_cost += row.estimated_cost || 0;
        }
        return Array.from(map.values()).sort((a, b) => b.total_tokens - a.total_tokens);
    }, [data.modelsByAgent]);

    const clearFilters = () => { setFilterUser(null); setFilterAgent(null); setFilterModel(null); setFilterSource(null); };

    // PII-weighted sovereignty score — shared by the banner, hero, and trend
    // arrow. Same formula as before, centralised so all three reflect a single
    // computation. Trend delta uses the integration timeline split into a
    // current half vs an earlier half; null if there's not enough history.
    const sovereigntyStats = useMemo(() => {
        const eg = integData.egress || [];
        const total = eg.length;
        const euCount = eg.filter(r => r.is_eu === true).length;
        const localCount = eg.filter(r => !!r.is_local).length;
        const nonEuCount = total - euCount - localCount;
        const piiNonEuCount = eg.filter(r =>
            !r.is_eu && !r.is_local
            && r.pii_categories_detected && r.pii_categories_detected.trim() !== ''
        ).length;
        const score = total > 0
            ? Math.round(((euCount + localCount) / (total + piiNonEuCount)) * 100)
            : 100;

        // Trend: split the timeline in half and compute the score per half.
        // The timeline endpoint already carries the same per-period counters.
        const tl = (integData.timeline || []).map(r => ({
            eu: Number(r.eu_count || 0),
            local: Number(r.local_count || 0),
            nonEu: Number(r.non_eu_count || 0),
            piiNonEu: Number(r.pii_non_eu_count || 0),
            total: Number(r.total || 0),
        }));
        let trend = null; // { delta, prevScore } — null when no comparable prior
        if (tl.length >= 2) {
            const half = Math.floor(tl.length / 2);
            const sum = (arr) => arr.reduce((s, r) => ({
                eu: s.eu + r.eu, local: s.local + r.local, nonEu: s.nonEu + r.nonEu,
                piiNonEu: s.piiNonEu + r.piiNonEu, total: s.total + r.total,
            }), { eu: 0, local: 0, nonEu: 0, piiNonEu: 0, total: 0 });
            const prev = sum(tl.slice(0, half));
            const curr = sum(tl.slice(half));
            const scoreOf = (b) => b.total > 0 ? Math.round(((b.eu + b.local) / (b.total + b.piiNonEu)) * 100) : null;
            const prevScore = scoreOf(prev);
            const currScore = scoreOf(curr);
            if (prevScore !== null && currScore !== null) {
                trend = { delta: currScore - prevScore, prevScore };
            }
        }
        return { total, euCount, localCount, nonEuCount, piiNonEuCount, score, trend };
    }, [integData.egress, integData.timeline]);

    const maxUserTokens = Math.max(...data.users.map(u => u.total_tokens || 0), 1);
    const maxModelTokens = Math.max(...data.models.map(m => m.total_tokens || 0), 1);

    // Table header keys
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}>

            {/* ── Header — compact single-line, with the range selector emphasised ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0, flex: 1 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{t('usage.title')}</h2>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>·</span>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('usage.subtitle')}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Range</span>
                    <div style={{ display: 'flex', padding: 2, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                        {[7, 30, 90].map(d => {
                            const active = d === days;
                            return (
                                <button key={d} onClick={() => setDays(d)} style={{
                                    padding: '6px 14px', fontSize: 11, fontWeight: 700, borderRadius: 6, border: 'none', cursor: 'pointer',
                                    background: active ? 'var(--accent-primary, #10b981)' : 'transparent',
                                    color: active ? 'white' : 'var(--text-muted)',
                                    boxShadow: active ? '0 1px 4px rgba(16,185,129,0.35)' : 'none',
                                    transition: 'all 0.15s',
                                }}>{d}d</button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Report Tabs ── */}
            <ReportTabBar active={activeReport} onChange={setActiveReport} t={t} tabs={visibleTabs} />

            {/* ── Filter Bar ── */}
            <div style={{
                display: (activeReport === 'feedback' || activeReport === 'terminations') ? 'none' : 'flex',
                alignItems: 'center', gap: 6, flexWrap: 'wrap',
                padding: '6px 10px', borderRadius: 10,
                background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 2 }}>
                    <Filter style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('usage.filters')}</span>
                </div>
                <FilterPill icon={Users} value={filterUser} onChange={setFilterUser} options={userOptions} placeholder={t('usage.all_users')} />
                <FilterPill icon={Bot} value={filterAgent} onChange={setFilterAgent} options={agentOptions} placeholder={t('usage.all_agents')} />
                <FilterPill icon={Cpu} value={filterModel} onChange={setFilterModel} options={modelOptions} placeholder={t('usage.all_models')} />
                <FilterPill icon={Activity} value={filterSource} onChange={setFilterSource} options={sourceOptions} placeholder={t('usage.all_sources')} />
                {hasFilters && (
                    <button onClick={clearFilters} style={{
                        display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
                        borderRadius: 6, border: 'none', background: 'var(--bg-tertiary)',
                        fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer',
                    }}><X style={{ width: 10, height: 10 }} /> {t('usage.clear')}</button>
                )}
            </div>

            {loading && activeReport !== 'feedback' && activeReport !== 'terminations' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                        {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 80, borderRadius: 12, background: 'var(--bg-tertiary)', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
                    </div>
                    <div style={{ height: 90, borderRadius: 12, background: 'var(--bg-tertiary)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                </div>
            ) : (
                <>
                    {/* ════════════════════════════════════════════════════════════ */}
                    {/* OVERVIEW TAB                                                */}
                    {/* ════════════════════════════════════════════════════════════ */}
                    {activeReport === 'overview' && (<>
                    {(() => {
                        if (isCustomerView) {
                            // Customer-facing view: marked-up AI usage cost + subscription context.
                            // Token/call counts are intentionally absent from the redacted backend payload.
                            const billedCost = Number(data.summary?.billed_cost || 0);
                            const sub = subscription;
                            const billing = sub?.billing || null;
                            const costCap = Number(sub?.effective_limits?.max_cost_per_month) || 0;
                            const sym = currencySym(billing?.plan_currency || 'EUR');
                            const statusDot = sub?.status === 'active' ? '#10b981'
                                : sub?.status === 'trialing' ? '#f59e0b'
                                : sub?.status ? '#f43f5e' : 'var(--text-muted)';
                            return (
                                <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {/* Tile row: Plan · Billed per cycle · AI usage */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                                        <Card style={{ padding: 16 }}>
                                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 4 }}>Plan</div>
                                            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{sub?.plan_name || '—'}</div>
                                            {sub?.status && (
                                                <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                    <span style={{ width: 6, height: 6, borderRadius: 999, background: statusDot, display: 'inline-block' }} />
                                                    <span style={{ color: 'var(--text-secondary)' }}>{sub.status}</span>
                                                </div>
                                            )}
                                            {sub?.billing_period && (
                                                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                                                    {formatDateRange(sub.billing_period.startDate, sub.billing_period.endDate)}
                                                </div>
                                            )}
                                        </Card>
                                        <Card style={{ padding: 16 }}>
                                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 4 }}>Billed per cycle</div>
                                            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>
                                                {sym}{Number(billing?.subscription_total || 0).toFixed(2)}
                                                <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>
                                                    / {billing?.billing_interval === 'yearly' ? 'year' : 'month'}
                                                </span>
                                            </div>
                                            {billing?.per_seat && (
                                                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                                                    {billing.seat_quantity} × {sym}{Number(billing.plan_price || 0).toFixed(2)} / seat
                                                </div>
                                            )}
                                        </Card>
                                        <Card style={{ padding: 16 }}>
                                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 4 }}>AI usage this period</div>
                                            <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>€{billedCost.toFixed(2)}</div>
                                            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                                                {(data.summary?.unique_users || data.users?.length || 0)} active users
                                            </div>
                                        </Card>
                                    </div>

                                    {/* Cost-cap progress (only when a cap is set) */}
                                    {costCap > 0 && (() => {
                                        const pct = Math.min(100, Math.round((billedCost / costCap) * 100));
                                        const isWarn = pct >= 80 && pct < 95;
                                        const isCrit = pct >= 95;
                                        const barColor = isCrit ? '#ef4444' : isWarn ? '#f59e0b' : '#10b981';
                                        const pctColor = isCrit ? '#ef4444' : isWarn ? '#f59e0b' : 'var(--text-muted)';
                                        return (
                                            <Card style={{ padding: 16 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                                        <DollarSign style={{ width: 14, height: 14, color: '#10b981' }} />
                                                        AI usage vs. cap
                                                    </div>
                                                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                        €{billedCost.toFixed(2)} / €{Number(costCap).toFixed(2)}
                                                    </span>
                                                </div>
                                                <div style={{ height: 8, borderRadius: 999, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 999, transition: 'width 0.5s' }} />
                                                </div>
                                                <div style={{ marginTop: 6, textAlign: 'right', fontSize: 10, fontWeight: 600, color: pctColor }}>
                                                    {pct}% used
                                                </div>
                                            </Card>
                                        );
                                    })()}
                                </div>
                            );
                        }
                        const cost = Number(data.summary?.combined_total_cost ?? data.summary?.total_estimated_cost ?? 0);
                        // Cost-alert banner — amber over 1×, red over 2× the threshold.
                        const overBudget = cost > OVERVIEW_COST_ALERT;
                        const critical = cost > OVERVIEW_COST_ALERT * 2;
                        // Trend: split timeline in half, sum total costs per half.
                        const costTrend = computeHalfPeriodDelta(data.timeline, r => Number(r.total_cost ?? r.estimated_cost ?? 0));
                        const tokenSpark = (data.timeline || []).map(r => Number(r.total_tokens ?? r.total ?? 0));
                        const callSpark = (data.timeline || []).map(r => Number(r.total_calls ?? r.calls ?? 0));
                        const costSpark = (data.timeline || []).map(r => Number(r.total_cost ?? r.estimated_cost ?? 0));
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
                            {/* Cost-led hero — left: big cost number + trend; right: 2×2 MiniStat */}
                            <div style={{ marginBottom: 14, borderRadius: 14, padding: 18, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', overflow: 'hidden', position: 'relative' }}>
                                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at top left, rgba(16,185,129,0.06), transparent 60%)', pointerEvents: 'none' }} />
                                <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24, alignItems: 'center' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                                            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Estimated cost</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: 44, fontWeight: 800, color: '#10b981', letterSpacing: '-0.04em', lineHeight: 1 }}>{fCur(cost)}</span>
                                            {costTrend && Math.abs(costTrend.delta) > 0.005 && (() => {
                                                const c = costTrend.delta > 0 ? '#ef4444' : '#10b981';
                                                const arrow = costTrend.delta > 0 ? '↑' : '↓';
                                                return (
                                                    <span title={`Previous half: ${fCur(costTrend.prev)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 5, background: `${c}15`, color: c, fontSize: 11, fontWeight: 800 }}>
                                                        <span style={{ fontSize: 13 }}>{arrow}</span>{fCur(Math.abs(costTrend.delta))}
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, fontWeight: 500 }}>
                                            In: <span style={{ color: '#3b82f6', fontWeight: 700 }}>{fCur(data.summary?.total_input_cost)}</span>
                                            <span style={{ margin: '0 6px' }}>·</span>
                                            Out: <span style={{ color: '#f59e0b', fontWeight: 700 }}>{fCur(data.summary?.total_output_cost)}</span>
                                            {(data.summary?.azure_services_total_cost || 0) > 0 && (
                                                <>
                                                    <span style={{ margin: '0 6px' }}>·</span>
                                                    Azure: <span style={{ color: '#0ea5e9', fontWeight: 700 }}>{fCur(data.summary?.azure_services_total_cost)}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                        <MiniStat icon={Zap} color="#0ea5e9" label="AI calls" value={Number(data.summary?.total_calls || 0).toLocaleString()} spark={callSpark} />
                                        <MiniStat icon={BarChart3} color="#3b82f6" label="Tokens" value={fNum(data.summary?.total_tokens)} spark={tokenSpark} />
                                        <MiniStat icon={Users} color="#f59e0b" label="Active users" value={data.summary?.unique_users || data.users.length || 0} />
                                        <MiniStat icon={DollarSign} color="#10b981" label="Cost / day avg" value={fCur((data.timeline?.length ? cost / data.timeline.length : 0))} spark={costSpark} />
                                    </div>
                                </div>
                            </div>
                            </>
                        );
                    })()}

                    {/* ── Trend ── */}
                    <TrendChart
                        timeline={data.timeline}
                        title={isCustomerView ? t('usage.cost_trend', 'Cost trend') : t('usage.token_trend')}
                        avgLabel={t('usage.avg_per_day')}
                        noDataLabel={t('usage.no_data')}
                        valueField={isCustomerView ? 'billed_cost' : 'total_tokens'}
                        valueFormatter={isCustomerView ? (v => '€' + Number(v).toFixed(2)) : undefined}
                    />

                    {/* ── Customer-view breakdowns (cost-only) ── */}
                    {isCustomerView && (() => {
                        const billing = subscription?.billing || {};
                        const perUserMode = billing.usage_pooled === false;
                        const perUserCap = Number(billing.per_user_cap) || 0;
                        const sortedUsers = [...(data.users || [])]
                            .sort((a, b) => Number(b.billed_cost || 0) - Number(a.billed_cost || 0))
                            .slice(0, 8);
                        const sortedSources = [...(data.sources || [])]
                            .sort((a, b) => Number(b.billed_cost || 0) - Number(a.billed_cost || 0))
                            .slice(0, 8);
                        return (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                {/* Top users by cost */}
                                <div>
                                    <SectionTitle icon={Users}>{t('usage.top_users_by_cost', 'Top users by cost')}</SectionTitle>
                                    <Card>
                                        {sortedUsers.length === 0 ? (
                                            <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{t('usage.no_active_users')}</div>
                                        ) : sortedUsers.map((u, i) => {
                                            const used = Number(u.billed_cost || 0);
                                            const pct = perUserMode && perUserCap > 0 ? Math.min(100, Math.round((used / perUserCap) * 100)) : null;
                                            const dotColor = pct == null ? 'transparent' : pct >= 95 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#10b981';
                                            return (
                                                <ListRow key={i}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                                                        <Avatar user={u} color={getColor(i)} />
                                                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                                                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {u.display_name}
                                                            </span>
                                                            {perUserMode && perUserCap > 0 && (
                                                                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                                                                    €{used.toFixed(2)} / €{perUserCap.toFixed(2)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 10, flexShrink: 0 }}>
                                                        {pct != null && (
                                                            <span style={{ width: 8, height: 8, borderRadius: 999, background: dotColor, display: 'inline-block' }} />
                                                        )}
                                                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>€{used.toFixed(2)}</span>
                                                    </div>
                                                </ListRow>
                                            );
                                        })}
                                    </Card>
                                </div>

                                {/* By source */}
                                <div>
                                    <SectionTitle icon={Activity}>{t('usage.by_app_area', 'By app area')}</SectionTitle>
                                    <Card>
                                        {sortedSources.length === 0 ? (
                                            <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{t('usage.no_usage_recorded', 'No usage recorded yet')}</div>
                                        ) : sortedSources.map((s, i) => {
                                            const d = getSourceDetails(s.source);
                                            const Icon = d.icon;
                                            return (
                                                <ListRow key={i}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                                        <IconBadge icon={Icon} color={d.color} />
                                                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{d.label}</span>
                                                    </div>
                                                    <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: 10 }}>
                                                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>€{Number(s.billed_cost || 0).toFixed(2)}</span>
                                                    </div>
                                                </ListRow>
                                            );
                                        })}
                                    </Card>
                                </div>
                            </div>
                        );
                    })()}

                    {!isCustomerView && (<>
                    {/* ── Two Column: Users + Models ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

                        {/* Top Users */}
                        <div>
                            <SectionTitle icon={Users} right={<Legend inputLabel={t('usage.input')} outputLabel={t('usage.output')} />}>{t('usage.top_users')}</SectionTitle>
                            <Card>
                                {data.users.length === 0 ? (
                                    <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{t('usage.no_active_users')}</div>
                                ) : data.users.slice(0, 8).map((u, i) => (
                                    <ListRow key={i} onClick={() => setFilterUser(u.user_id)}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                                            <Avatar user={u} color={getColor(i)} />
                                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {u.display_name}
                                                </span>
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

                        {/* By Model */}
                        <div>
                            <SectionTitle icon={Cpu} right={<Legend inputLabel={t('usage.input')} outputLabel={t('usage.output')} />}>{t('usage.by_model')}</SectionTitle>
                            <Card>
                                {data.models.length === 0 ? (
                                    <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{t('usage.no_model_data')}</div>
                                ) : data.models.slice(0, 8).map((m, i) => (
                                    <ListRow key={i} onClick={() => setFilterModel(m.model)}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                                            <IconBadge icon={Cpu} color={getColor(i)} />
                                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                    title={m.model}>
                                                    {shortModel(m.model)}
                                                </span>
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
                    </div>

                    {/* ── Two Column: Sources + Model × Agent ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

                        {/* By Source */}
                        <div>
                            <SectionTitle icon={Activity}>{t('usage.by_app_area')}</SectionTitle>
                            <Card>
                                {data.sources.length === 0 ? (
                                    <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{t('usage.no_usage_recorded')}</div>
                                ) : data.sources.map((s, i) => {
                                    const d = getSourceDetails(s.source);
                                    const Icon = d.icon;
                                    return (
                                        <ListRow key={i} onClick={() => setFilterSource(s.source)}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                                <IconBadge icon={Icon} color={d.color} />
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

                        {/* Model × Agent — grouped by agent, expandable */}
                        <div>
                            <SectionTitle icon={Bot}>{t('usage.models_per_agent')}</SectionTitle>
                            <Card>
                                {agentModelGroups.length === 0 ? (
                                    <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{t('usage.no_data_short')}</div>
                                ) : agentModelGroups.slice(0, 8).map((group, gi) => {
                                    const isExpanded = expandedAgent === group.agent_name;
                                    return (
                                        <div key={gi}>
                                            <ListRow onClick={() => setExpandedAgent(isExpanded ? null : group.agent_name)}
                                                style={{ borderBottom: isExpanded ? 'none' : undefined }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                                    <IconBadge icon={Bot} color={getColor(gi)} />
                                                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                                                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {group.agent_name}
                                                        </span>
                                                        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                                                            {group.models.length} model{group.models.length !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{fNum(group.total_tokens)}</div>
                                                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fCur(group.estimated_cost)}</div>
                                                    </div>
                                                    <ChevronRight style={{
                                                        width: 13, height: 13, color: 'var(--text-muted)',
                                                        transform: isExpanded ? 'rotate(90deg)' : 'none',
                                                        transition: 'transform 0.2s ease',
                                                    }} />
                                                </div>
                                            </ListRow>
                                            {/* Expanded model sub-rows */}
                                            {isExpanded && group.models.map((m, mi) => (
                                                <div key={mi} style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    padding: '6px 14px 6px 48px', background: 'var(--bg-secondary)',
                                                    borderBottom: '1px solid var(--border-subtle)',
                                                    fontSize: 11,
                                                }}>
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
                    </div>

                    {/* ── Model × User Table ── */}
                    {data.modelsByUser.length > 0 && (
                        <div ref={modelByUserRef}>
                            <SectionTitle icon={Users} right={<Legend inputLabel={t('usage.input')} outputLabel={t('usage.output')} />}>{t('usage.model_usage_by_user')}</SectionTitle>
                            <Card>
                                <div style={{
                                    display: 'grid', gridTemplateColumns: '1.5fr 1fr repeat(3, 70px) repeat(3, 72px)',
                                    padding: '8px 14px', background: 'var(--bg-tertiary)',
                                    borderBottom: '1px solid var(--border-subtle)',
                                    overflowX: 'auto',
                                }}>
                                    {tableHeaders.map(h => (
                                        <span key={h.key} style={{
                                            fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                                            color: h.color || 'var(--text-muted)',
                                            textAlign: h.align,
                                            whiteSpace: 'nowrap',
                                        }}>{t(h.key)}</span>
                                    ))}
                                </div>
                                {data.modelsByUser.slice(0, 20).map((row, i) => (
                                    <div key={i} style={{
                                        display: 'grid', gridTemplateColumns: '1.5fr 1fr repeat(3, 70px) repeat(3, 72px)',
                                        padding: '7px 14px', alignItems: 'center',
                                        background: i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                                        borderBottom: '1px solid var(--border-subtle)',
                                        transition: 'background 0.1s',
                                    }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                        onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)'}
                                    >
                                        <span style={{
                                            fontSize: 11, fontWeight: 600, color: 'var(--text-primary)',
                                            display: 'flex', alignItems: 'center', gap: 6,
                                            overflow: 'hidden', whiteSpace: 'nowrap',
                                            cursor: 'pointer', minWidth: 0,
                                        }} onClick={() => setFilterUser(row.user_id)}>
                                            <Avatar user={row} color={getColor(i)} size={20} />
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {row.display_name || row.user_id}
                                            </span>
                                        </span>
                                        <span style={{
                                            fontSize: 11, fontWeight: 600, color: getColor(i),
                                            display: 'flex', alignItems: 'center', gap: 4,
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            cursor: 'pointer',
                                        }} onClick={() => setFilterModel(row.model)}>
                                            <Cpu style={{ width: 10, height: 10, flexShrink: 0 }} />
                                            {shortModel(row.model)}
                                        </span>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: '#3b82f6', textAlign: 'right' }}>{fNum(row.prompt_tokens)}</span>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: '#f59e0b', textAlign: 'right' }}>{fNum(row.completion_tokens)}</span>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>{fNum(row.total_tokens)}</span>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: '#3b82f6', textAlign: 'right' }}>{fCur(row.input_cost)}</span>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: '#f59e0b', textAlign: 'right' }}>{fCur(row.output_cost)}</span>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>{fCur(row.estimated_cost)}</span>
                                    </div>
                                ))}
                            </Card>
                        </div>
                    )}

                    {/* ── Azure Services Breakdown ── */}
                    {(azureServices.byType?.length > 0) && (
                        <div>
                            <SectionTitle icon={Server}>{t('usage.azure_services') || 'Azure Services'}</SectionTitle>
                            <Card>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 0 }}>
                                    {azureServices.byType.map((svc, i) => {
                                        const svcInfo = {
                                            doc_intelligence: { label: 'Document Intelligence', icon: FileText, color: '#0ea5e9', metric: `${fNum(svc.total_pages)} pages` },
                                            content_safety: { label: 'Content Safety', icon: ShieldCheck, color: '#f59e0b', metric: `${fNum(svc.total_chars)} chars` },
                                            pii_detection: { label: 'PII Detection', icon: ScanEye, color: '#14b8a6', metric: `${fNum(svc.total_chars)} chars` },
                                            embedding: { label: 'Embeddings', icon: Binary, color: '#0ea5e9', metric: `${fNum(svc.total_tokens)} tokens` },
                                        }[svc.service_type] || { label: svc.service_type, icon: Server, color: '#94a3b8', metric: '' };
                                        const SvcIcon = svcInfo.icon;
                                        return (
                                            <div key={i} style={{
                                                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                                                borderBottom: '1px solid var(--border-subtle)',
                                            }}>
                                                <div style={{
                                                    width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    background: `${svcInfo.color}15`, flexShrink: 0,
                                                }}>
                                                    <SvcIcon style={{ width: 16, height: 16, color: svcInfo.color }} />
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{svcInfo.label}</div>
                                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                                                        {svc.calls} {t('usage.calls')} · {svcInfo.metric}
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                    <div style={{ fontSize: 14, fontWeight: 700, color: svcInfo.color }}>{fCur(svc.total_cost)}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {/* Azure services total */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '10px 14px', background: 'var(--bg-tertiary)',
                                    borderTop: '2px solid var(--border-subtle)',
                                }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {t('usage.total') || 'Total'}
                                    </span>
                                    <span style={{ fontSize: 16, fontWeight: 800, color: '#10b981' }}>
                                        {fCur(azureServices.summary?.total_cost)}
                                    </span>
                                </div>
                            </Card>
                        </div>
                    )}

                    </>)}

                    </>)}

                    {/* ════════════════════════════════════════════════════════════ */}
                    {/* SAFETY & GUARDRAILS TAB                                    */}
                    {/* ════════════════════════════════════════════════════════════ */}
                    {activeReport === 'safety' && ((() => {
                        const totalEvents = Number(guardrails.summary?.total_events) || 0;
                        const modCount = Number(guardrails.summary?.moderation_count) || 0;
                        const piiCount = Number(guardrails.summary?.pii_count) || 0;
                        const regCount = Number(guardrails.summary?.regex_count) || 0;
                        const inputCount = Number(guardrails.summary?.input_count) || 0;
                        const outputCount = Number(guardrails.summary?.output_count) || 0;
                        const pctOf = (n) => totalEvents > 0 ? Math.round((n / totalEvents) * 100) : 0;
                        const typeColorFn = (vt) => vt === 'moderation' ? '#f59e0b' : vt === 'pii' ? '#14b8a6' : '#3b82f6';
                        const actionColorFn = (a) => (a === 'hard_block' || a === 'blocked' || a === 'search_blocked') ? '#ef4444' : (a === 'pii_detected' || a === 'tokenized') ? '#14b8a6' : a === 'redacted' ? '#3b82f6' : '#f59e0b';
                        const actionLabel = (a) => (a || 'unknown').replace(/_/g, ' ');
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
                        const handleSafetyDrill = (axis, key, label) => {
                            setSafetyDrill({ axis, key, label });
                            setTimeout(() => guardrailEventsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                        };

                        return (
                        <div>
                        {/* ── Header ── */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #ef444418, #f59e0b18)' }}>
                                <Shield style={{ width: 16, height: 16, color: '#ef4444' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>{t('usage.safety_title')}</h3>
                                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{t('usage.safety_subtitle')}</p>
                            </div>
                        </div>

                        {/* ── Type Filter Chips ── */}
                        <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
                            {[
                                { id: null, label: t('usage.safety_filter_all'), count: totalEvents, color: '#ef4444' },
                                { id: 'moderation', label: t('usage.moderation'), count: modCount, color: '#f59e0b' },
                                { id: 'pii', label: 'PII', count: piiCount, color: '#14b8a6' },
                                { id: 'regex', label: 'Regex', count: regCount, color: '#3b82f6' },
                            ].map(chip => {
                                const active = safetyTypeFilter === chip.id;
                                return (
                                    <button key={chip.id || 'all'} onClick={() => { setSafetyTypeFilter(chip.id); setSafetyShowCount(20); }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8,
                                            border: active ? `1.5px solid ${chip.color}` : '1px solid var(--border-subtle)',
                                            background: active ? `${chip.color}10` : 'var(--bg-secondary)',
                                            color: active ? chip.color : 'var(--text-muted)',
                                            fontWeight: active ? 700 : 500, fontSize: 11, cursor: 'pointer', transition: 'all 0.15s',
                                        }}>
                                        <span style={{ width: 6, height: 6, borderRadius: 99, background: chip.color, opacity: active ? 1 : 0.5 }} />
                                        {chip.label}
                                        <span style={{
                                            background: active ? `${chip.color}20` : 'var(--bg-tertiary)',
                                            padding: '1px 6px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                                            color: active ? chip.color : 'var(--text-muted)',
                                        }}>{chip.count}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* PII-alert banner — amber over threshold, red at 2×. */}
                        {piiCount > SAFETY_PII_ALERT && (
                            <AlertBanner
                                severity={piiCount > SAFETY_PII_ALERT * 2 ? 'red' : 'amber'}
                                message={`${piiCount} PII detection${piiCount === 1 ? '' : 's'} this period — review retention and access controls.`}
                                ctaLabel="Review PII events"
                                onCta={() => {
                                    setSafetyTypeFilter('pii');
                                    setSafetyShowCount(20);
                                    setTimeout(() => guardrailEventsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                                }}
                            />
                        )}

                        {/* PII-led hero — big red number on the left, MiniStat grid on the right */}
                        {(() => {
                            const piiTrend = computeHalfPeriodDelta(guardrails.timeline, r => Number(r.pii_events ?? r.pii ?? 0));
                            const piiSpark = (guardrails.timeline || []).map(r => Number(r.pii_events ?? r.pii ?? 0));
                            const piiPctColor = totalEvents > 0 && pctOf(piiCount) >= 40 ? '#ef4444' : '#14b8a6';
                            return (
                                <div style={{ marginBottom: 14, borderRadius: 14, padding: 18, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', overflow: 'hidden', position: 'relative' }}>
                                    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at top left, ${piiCount > 0 ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.05)'}, transparent 60%)`, pointerEvents: 'none' }} />
                                    <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24, alignItems: 'center' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                                                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>PII detections</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: 54, fontWeight: 800, color: piiPctColor, letterSpacing: '-0.04em', lineHeight: 1 }}>{piiCount}</span>
                                                {totalEvents > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>· {pctOf(piiCount)}% of {totalEvents} violation{totalEvents === 1 ? '' : 's'}</span>}
                                                {piiTrend && piiTrend.delta !== 0 && (() => {
                                                    const c = piiTrend.delta > 0 ? '#ef4444' : '#10b981';
                                                    return <span title={`Previous half: ${piiTrend.prev}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 5, background: `${c}15`, color: c, fontSize: 11, fontWeight: 800 }}><span style={{ fontSize: 13 }}>{piiTrend.delta > 0 ? '↑' : '↓'}</span>{Math.abs(piiTrend.delta)}</span>;
                                                })()}
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                                                Personal data detected leaving the agent — verify retention and access controls.
                                            </div>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                            <MiniStat icon={Shield} color="#ef4444" label="Total violations" value={totalEvents.toLocaleString()} />
                                            <MiniStat icon={AlertTriangle} color="#f59e0b" label="Moderation" value={modCount.toLocaleString()} />
                                            <MiniStat icon={Eye} color="#3b82f6" label="Regex matches" value={regCount.toLocaleString()} />
                                            <MiniStat icon={Users} color="#0ea5e9" label="Users" value={(guardrails.summary?.unique_users || 0).toLocaleString()} spark={piiSpark} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* ── Direction + Timeline row ── */}
                        <div style={{ display: 'grid', gridTemplateColumns: guardrails.timeline.length > 0 ? '200px 1fr' : '1fr', gap: 10, marginBottom: 14 }}>
                            {/* Direction Mini Chart */}
                            <Card style={{ padding: '14px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
                                    <Activity style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />
                                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{t('usage.safety_by_direction')}</span>
                                </div>
                                <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', height: 22, background: 'var(--bg-tertiary)' }}>
                                    {inputCount > 0 && <div style={{ width: `${pctOf(inputCount)}%`, background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'width 0.3s' }}>
                                        <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>{pctOf(inputCount)}%</span>
                                    </div>}
                                    {outputCount > 0 && <div style={{ width: `${pctOf(outputCount)}%`, background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'width 0.3s' }}>
                                        <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>{pctOf(outputCount)}%</span>
                                    </div>}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10 }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#3b82f6', fontWeight: 600 }}>
                                        <ArrowUpRight style={{ width: 10, height: 10 }} />{t('usage.safety_input')} ({inputCount})
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#f59e0b', fontWeight: 600 }}>
                                        <ArrowDownLeft style={{ width: 10, height: 10 }} />{t('usage.safety_output')} ({outputCount})
                                    </span>
                                </div>
                            </Card>

                            {/* Violation Timeline — Enhanced */}
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
                                                        const mod = Number(d.moderation) || 0;
                                                        const pii = Number(d.pii) || 0;
                                                        const reg = Number(d.regex) || 0;
                                                        const total = mod + pii + reg;
                                                        const h = (total / maxVal) * 100;
                                                        const modH = total > 0 ? (mod / total) * h : 0;
                                                        const piiH = total > 0 ? (pii / total) * h : 0;
                                                        const regH = total > 0 ? (reg / total) * h : 0;
                                                        return (
                                                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', cursor: 'default' }}
                                                                title={`${d.period}: ${total} events (${mod} mod, ${pii} pii, ${reg} regex)`}>
                                                                {regH > 0 && <div style={{ height: `${regH}%`, background: '#3b82f6', borderRadius: reg === total ? '3px 3px 0 0' : '0', minHeight: 2, transition: 'height 0.2s' }} />}
                                                                {piiH > 0 && <div style={{ height: `${piiH}%`, background: '#14b8a6', minHeight: 2, borderRadius: (reg === 0 && pii > 0) ? '3px 3px 0 0' : '0', transition: 'height 0.2s' }} />}
                                                                {modH > 0 && <div style={{ height: `${modH}%`, background: '#f59e0b', borderRadius: total === mod ? '3px 3px 0 0' : '0', minHeight: 2, transition: 'height 0.2s' }} />}
                                                                {total === 0 && <div style={{ height: 2, background: 'var(--bg-tertiary)', borderRadius: 2 }} />}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                {/* Date labels */}
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

                        {/* ── Three Column: By Category + By User + By Action ── */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                            {/* By Category */}
                            <div>
                                <SectionTitle icon={AlertTriangle}>{t('usage.by_violation_category')}</SectionTitle>
                                <Card>
                                    {filteredByCategory.length === 0 ? (
                                        <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>{t('usage.no_violations')}</div>
                                    ) : filteredByCategory.slice(0, 10).map((c, i) => {
                                        const tc = typeColorFn(c.violation_type);
                                        const maxCat = Math.max(...filteredByCategory.map(x => Number(x.count) || 0), 1);
                                        const w = Math.max(5, (Number(c.count) / maxCat) * 100);
                                        return (
                                            <ListRow key={i} onClick={() => handleSafetyDrill('category', c.category, c.category)}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                                    <div style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${tc}12`, flexShrink: 0 }}>
                                                        {c.violation_type === 'moderation' ? <AlertTriangle style={{ width: 11, height: 11, color: tc }} /> :
                                                         c.violation_type === 'pii' ? <Fingerprint style={{ width: 11, height: 11, color: tc }} /> :
                                                         <Eye style={{ width: 11, height: 11, color: tc }} />}
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

                            {/* By User */}
                            <div>
                                <SectionTitle icon={Users}>{t('usage.violations_by_user')}</SectionTitle>
                                <Card>
                                    {filteredByUser.length === 0 ? (
                                        <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>{t('usage.no_violations')}</div>
                                    ) : filteredByUser.slice(0, 8).map((u, i) => {
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
                                                        {/* Progress bar */}
                                                        <div style={{ height: 2, borderRadius: 1, background: 'var(--bg-tertiary)', marginTop: 3, overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', borderRadius: 1, background: '#ef4444', width: `${userPct}%`, transition: 'width 0.3s' }} />
                                                        </div>
                                                        {u.last_event && <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                                                            {t('usage.safety_last_event')}: {new Date(u.last_event).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </div>}
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

                            {/* By Action Taken */}
                            <div>
                                <SectionTitle icon={Shield}>{t('usage.safety_by_action')}</SectionTitle>
                                <Card>
                                    {guardrails.byAction.length === 0 ? (
                                        <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>{t('usage.no_violations')}</div>
                                    ) : (() => {
                                        // Aggregate actions across violation types
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
                                                            <span style={{
                                                                display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 6,
                                                                background: `${ac}15`, color: ac, fontSize: 10, fontWeight: 700, textTransform: 'capitalize',
                                                            }}>{actionLabel(a.action)}</span>
                                                        </div>
                                                        <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', borderRadius: 2, background: ac, width: `${w}%`, transition: 'width 0.3s' }} />
                                                        </div>
                                                        <div style={{ display: 'flex', gap: 6, marginTop: 3, fontSize: 9, color: 'var(--text-muted)' }}>
                                                            {Object.entries(a.types).map(([type, cnt]) => (
                                                                <span key={type} style={{ color: typeColorFn(type), fontWeight: 600 }}>{cnt} {type}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div style={{ fontSize: 14, fontWeight: 700, color: ac, flexShrink: 0, minWidth: 24, textAlign: 'right' }}>{a.count}</div>
                                                </ListRow>
                                            );
                                        });
                                    })()}
                                </Card>
                            </div>
                        </div>

                        {/* ── Recent Events Table — Enhanced ── */}
                        {filteredRecent.length > 0 && (
                            <div ref={guardrailEventsRef}>
                                <SectionTitle icon={Clock}>{t('usage.recent_guardrail_events')} ({filteredRecent.length})</SectionTitle>
                                {safetyDrill && (
                                    <div style={{ marginBottom: 8 }}>
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 8,
                                            padding: '5px 6px 5px 10px', borderRadius: 99,
                                            background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.25)',
                                            fontSize: 11, color: 'var(--text-primary)',
                                        }}>
                                            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#0ea5e9' }}>{safetyDrill.axis}</span>
                                            <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{(safetyDrill.label || safetyDrill.key || '').toString().replace(/_/g, ' ')}</span>
                                            <button onClick={() => setSafetyDrill(null)} style={{
                                                width: 18, height: 18, borderRadius: '50%', border: 'none', cursor: 'pointer',
                                                background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
                                            }} aria-label="Clear drill filter">✕</button>
                                        </span>
                                    </div>
                                )}
                                <Card>
                                    {/* Header */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 80px 90px 1fr 55px 90px', padding: '8px 14px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-subtle)' }}>
                                        {[t('usage.col_time'), t('usage.col_user'), t('usage.col_type'), t('usage.col_agent'), t('usage.col_categories'), t('usage.col_direction'), t('usage.col_action')].map(h => (
                                            <span key={h} style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>{h}</span>
                                        ))}
                                    </div>
                                    {/* Rows */}
                                    {filteredRecent.slice(0, safetyShowCount).map((ev, i) => {
                                        const tc = typeColorFn(ev.violation_type);
                                        const ac = actionColorFn(ev.action_taken);
                                        const isExpanded = expandedEventId === i;
                                        const srcDetail = getSourceDetails(ev.source);
                                        return (
                                            <React.Fragment key={i}>
                                                <div
                                                    onClick={() => setExpandedEventId(isExpanded ? null : i)}
                                                    style={{
                                                        display: 'grid', gridTemplateColumns: '110px 1fr 80px 90px 1fr 55px 90px',
                                                        padding: '7px 14px', alignItems: 'center',
                                                        background: isExpanded ? 'var(--bg-tertiary)' : (i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)'),
                                                        borderBottom: isExpanded ? 'none' : '1px solid var(--border-subtle)',
                                                        fontSize: 11, cursor: 'pointer', transition: 'background 0.1s',
                                                    }}
                                                    onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                                                    onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)'; }}
                                                >
                                                    <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                                                        {new Date(ev.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--text-primary)', minWidth: 0 }}>
                                                        <Avatar user={ev} color={getColor(i)} size={18} />
                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {ev.display_name || ev.user_id || 'Unknown'}
                                                        </span>
                                                    </span>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                                        <span style={{ width: 6, height: 6, borderRadius: 99, background: tc }} />
                                                        <span style={{ fontWeight: 600, color: tc, textTransform: 'capitalize' }}>{ev.violation_type}</span>
                                                    </span>
                                                    <span style={{ fontSize: 10, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {ev.agent_name || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Direct</span>}
                                                    </span>
                                                    <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ev.violation_categories}>
                                                        {ev.violation_categories || '—'}
                                                    </span>
                                                    <span style={{ color: ev.direction === 'output' ? '#f59e0b' : '#3b82f6', fontWeight: 600, textTransform: 'capitalize', fontSize: 10 }}>
                                                        {ev.direction}
                                                    </span>
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 5,
                                                        background: `${ac}12`, color: ac, fontWeight: 700, fontSize: 9, textTransform: 'capitalize',
                                                    }}>{actionLabel(ev.action_taken)}</span>
                                                </div>
                                                {/* Expanded detail row */}
                                                {isExpanded && (
                                                    <div style={{
                                                        padding: '8px 14px 10px 14px', background: 'var(--bg-tertiary)',
                                                        borderBottom: '1px solid var(--border-subtle)',
                                                        display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 10,
                                                    }}>
                                                        {ev.source && <div>
                                                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t('usage.col_source')}: </span>
                                                            <span style={{ color: srcDetail.color, fontWeight: 600 }}>{srcDetail.label}</span>
                                                        </div>}
                                                        {ev.model && <div>
                                                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t('usage.safety_model')}: </span>
                                                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{shortModel(ev.model)}</span>
                                                        </div>}
                                                        {ev.conversation_id && <div>
                                                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t('usage.safety_conversation')}: </span>
                                                            <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontFamily: 'monospace', fontSize: 9 }}>{ev.conversation_id.substring(0, 12)}…</span>
                                                        </div>}
                                                        {ev.violation_categories && <div>
                                                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t('usage.col_categories')}: </span>
                                                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{ev.violation_categories}</span>
                                                        </div>}
                                                    </div>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                    {/* Show more button */}
                                    {filteredRecent.length > safetyShowCount && (
                                        <button
                                            onClick={() => setSafetyShowCount(c => c + 20)}
                                            style={{
                                                width: '100%', padding: '10px 0', border: 'none', cursor: 'pointer',
                                                background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                                                fontSize: 11, fontWeight: 600, transition: 'all 0.15s',
                                                borderTop: '1px solid var(--border-subtle)',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                                        >
                                            {t('usage.safety_show_more')} ({filteredRecent.length - safetyShowCount} remaining)
                                        </button>
                                    )}
                                </Card>
                            </div>
                        )}

                        {/* Empty state */}
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
                    </div>);
                    })())}

                    {/* ════════════════════════════════════════════════════════ */}
                    {/* INTEGRATION ACTIVITY MONITOR TAB                        */}
                    {/* ════════════════════════════════════════════════════════ */}
                    {activeReport === 'integrations' && (<div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                            <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0ea5e920, #0ea5e920)' }}>
                                <Globe style={{ width: 15, height: 15, color: '#0ea5e9' }} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>{t('usage.integ_title')}</h3>
                                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, fontWeight: 400 }}>{t('usage.integ_subtitle')}</p>
                            </div>
                        </div>

                        {/* No data notice */}
                        {(!integData.summary || (Number(integData.summary.total_calls) === 0 && integData.byType.length === 0)) ? (
                            <Card style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Info style={{ width: 16, height: 16, color: 'var(--text-muted)', flexShrink: 0 }} />
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('usage.integ_not_enabled')}</span>
                            </Card>
                        ) : (
                            <>
                                {/* Action-required banner — fires when the PII-weighted score
                                    drops below ALERT_SCORE_THRESHOLD. Uses the shared AlertBanner
                                    primitive so all four tabs share the same shape. */}
                                {sovereigntyStats.total > 0 && sovereigntyStats.score < ALERT_SCORE_THRESHOLD && (() => {
                                    const severity = sovereigntyStats.score < 20 ? 'red' : 'amber';
                                    const reasonBits = [];
                                    if (sovereigntyStats.piiNonEuCount > 0) reasonBits.push(`${sovereigntyStats.piiNonEuCount} call${sovereigntyStats.piiNonEuCount === 1 ? '' : 's'} leaked PII outside the EU/EEA`);
                                    else if (sovereigntyStats.nonEuCount > 0) reasonBits.push(`${sovereigntyStats.nonEuCount} of ${sovereigntyStats.total} call${sovereigntyStats.total === 1 ? '' : 's'} left the EU/EEA`);
                                    const onCta = sovereigntyStats.piiNonEuCount > 0
                                        ? () => {
                                            setEgressDrill({ axis: 'pii-non-eu', key: 'pii-non-eu', label: 'PII leaks abroad' });
                                            setTimeout(() => egressLogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                                        } : null;
                                    return (
                                        <AlertBanner
                                            severity={severity}
                                            message={`Sovereignty score ${sovereigntyStats.score}/100 — ${reasonBits.join(' · ')}`}
                                            ctaLabel={onCta ? 'Review PII leaks' : null}
                                            onCta={onCta}
                                        />
                                    );
                                })()}

                                {/* Sovereignty hero — answers "where is my data going?" before
                                    the user has to scan a table. EU/Non-EU/Local split is computed
                                    from the egress log so it tracks the same source-of-truth as the
                                    table below. */}
                                {(() => {
                                    const { total, euCount, localCount, nonEuCount, piiNonEuCount, score } = sovereigntyStats;
                                    const pct = (n) => total > 0 ? Math.round((n / total) * 100) : 0;
                                    const scoreColor = score >= 80 ? '#10b981' : score >= 60 ? '#84cc16' : score >= 40 ? '#f59e0b' : score >= 20 ? '#f97316' : '#ef4444';
                                    const scoreLabel = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Watch' : score >= 20 ? 'Risky' : 'Critical';
                                    const summary = integData.summary || {};
                                    return (
                                        <div style={{ marginBottom: 14, borderRadius: 14, padding: 18, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', overflow: 'hidden', position: 'relative' }}>
                                            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at top left, rgba(16,185,129,0.06), transparent 60%)', pointerEvents: 'none' }} />
                                            <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24, alignItems: 'center' }}>
                                                {/* Left: PII-weighted sovereignty score + stacked bar */}
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                                                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Data sovereignty score</span>
                                                        <span
                                                            style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', opacity: 0.8, cursor: 'help' }}
                                                            title={`(EU + Local) / (Total + PII-leaks-abroad) × 100. A non-EU call that exposed PII counts twice against the denominator, so the score punishes leaks of personal data more than benign non-EU traffic.`}
                                                        >ⓘ how is this scored?</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
                                                        <span style={{ fontSize: 54, fontWeight: 800, color: scoreColor, letterSpacing: '-0.04em', lineHeight: 1 }}>{score}</span>
                                                        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '-0.02em' }}>/ 100</span>
                                                        <span style={{ padding: '3px 9px', borderRadius: 6, background: `${scoreColor}15`, color: scoreColor, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{scoreLabel}</span>
                                                        {sovereigntyStats.trend && (() => {
                                                            const d = sovereigntyStats.trend.delta;
                                                            const trendColor = d > 0 ? '#10b981' : d < 0 ? '#ef4444' : 'var(--text-muted)';
                                                            const arrow = d > 0 ? '↑' : d < 0 ? '↓' : '·';
                                                            return (
                                                                <span
                                                                    title={`Previous half-period score: ${sovereigntyStats.trend.prevScore}`}
                                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 5, background: `${trendColor}15`, color: trendColor, fontSize: 11, fontWeight: 800 }}
                                                                >
                                                                    <span style={{ fontSize: 13 }}>{arrow}</span>
                                                                    {d === 0 ? '0' : Math.abs(d)}
                                                                </span>
                                                            );
                                                        })()}
                                                    </div>
                                                    {/* B1: always-visible score explainer */}
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 500 }}>
                                                        Score drops on Non-EU traffic; PII leaks abroad count double.
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, fontSize: 12, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                                                        <span><span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{pct(euCount + localCount)}%</span> raw EU/EEA + local share</span>
                                                        {piiNonEuCount > 0 && (
                                                            <button
                                                                onClick={() => {
                                                                    setEgressDrill({ axis: 'pii-non-eu', key: 'pii-non-eu', label: 'PII leaks abroad' });
                                                                    setTimeout(() => egressLogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                                                                }}
                                                                style={{
                                                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                                                    padding: '4px 10px', borderRadius: 99, cursor: 'pointer',
                                                                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
                                                                    color: '#ef4444', fontWeight: 700, fontSize: 11,
                                                                    transition: 'background 0.12s',
                                                                }}
                                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
                                                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                                                                title="Click to filter the egress log to the PII-leaking calls"
                                                            >
                                                                <Fingerprint style={{ width: 12, height: 12 }} />
                                                                −{piiNonEuCount} PII leak{piiNonEuCount === 1 ? '' : 's'} abroad
                                                                <ChevronRight style={{ width: 12, height: 12 }} />
                                                            </button>
                                                        )}
                                                    </div>
                                                    {/* Stacked bar */}
                                                    <div style={{ display: 'flex', height: 10, borderRadius: 99, overflow: 'hidden', background: 'var(--bg-tertiary)' }}>
                                                        {euCount > 0 && <div title={`${euCount} EU/EEA calls`} style={{ width: `${pct(euCount)}%`, background: 'linear-gradient(90deg,#10b981,#34d399)', transition: 'width 0.4s ease' }} />}
                                                        {localCount > 0 && <div title={`${localCount} local calls`} style={{ width: `${pct(localCount)}%`, background: 'linear-gradient(90deg,#14b8a6,#2dd4bf)', transition: 'width 0.4s ease' }} />}
                                                        {nonEuCount > 0 && <div title={`${nonEuCount} non-EU calls`} style={{ width: `${pct(nonEuCount)}%`, background: 'linear-gradient(90deg,#f59e0b,#fbbf24)', transition: 'width 0.4s ease' }} />}
                                                    </div>
                                                    {/* Legend */}
                                                    <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                                                            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#10b981' }} />
                                                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{euCount}</span>
                                                            <span style={{ color: 'var(--text-muted)' }}>EU/EEA ({pct(euCount)}%)</span>
                                                        </span>
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                                                            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#14b8a6' }} />
                                                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{localCount}</span>
                                                            <span style={{ color: 'var(--text-muted)' }}>Local ({pct(localCount)}%)</span>
                                                        </span>
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                                                            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#f59e0b' }} />
                                                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{nonEuCount}</span>
                                                            <span style={{ color: 'var(--text-muted)' }}>Non-EU ({pct(nonEuCount)}%)</span>
                                                        </span>
                                                    </div>
                                                </div>
                                                {/* Right: trend chart when there are multiple periods, MiniStat grid otherwise */}
                                                {(integData.timeline?.length || 0) > 1 ? (
                                                    <div>
                                                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>Sovereignty over time</div>
                                                        <SovereigntyTrend timeline={integData.timeline} />
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                        <MiniStat icon={Zap} color="#0ea5e9" label="Total calls" value={Number(summary.total_calls || 0).toLocaleString()} />
                                                        <MiniStat icon={Link2} color="#0ea5e9" label="Integrations" value={Number(summary.unique_integrations || 0).toLocaleString()} />
                                                        <MiniStat icon={Server} color="#10b981" label="Endpoints" value={Number(summary.unique_servers || 0).toLocaleString()} />
                                                        <MiniStat icon={Fingerprint} color="#ef4444" label="PII events" value={Number(summary.pii_events || 0).toLocaleString()} />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Sovereignty breakdown — switchable axis (User / Integration / Agent / PII).
                                    Click a row to drill the egress log to that bucket. */}
                                {(() => {
                                    const axes = [
                                        { id: 'user', label: 'User', icon: Users },
                                        { id: 'integration', label: 'Integration', icon: Link2 },
                                        { id: 'agent', label: 'Agent', icon: Bot },
                                        { id: 'pii', label: 'PII (when detected)', icon: Fingerprint },
                                    ];
                                    const rows = (integData.sovereignty?.[sovereigntyAxis] || []).slice(0, 12);
                                    const handleDrill = (axis, row) => {
                                        setEgressDrill({ axis, key: row.key, label: row.label || row.key });
                                        // Defer scroll so React commits the state update first.
                                        setTimeout(() => {
                                            egressLogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        }, 50);
                                    };
                                    const avatarFor = (row) => {
                                        if (sovereigntyAxis === 'user') {
                                            return <Avatar user={{ ...row, display_name: row.label }} color={getColor(0)} size={26} />;
                                        }
                                        if (sovereigntyAxis === 'integration' && hasIntegrationIcon(row.key)) {
                                            return <IntegrationLogo integrationType={row.key} size={26} />;
                                        }
                                        return null;
                                    };
                                    return (
                                        <div style={{ marginBottom: 14 }}>
                                            <SectionTitle icon={Activity} right={(
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    {axes.map(a => {
                                                        const on = sovereigntyAxis === a.id;
                                                        const AxisIcon = a.icon;
                                                        return (
                                                            <button key={a.id} onClick={() => setSovereigntyAxis(a.id)} style={{
                                                                display: 'flex', alignItems: 'center', gap: 5,
                                                                padding: '4px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
                                                                background: on ? 'var(--bg-secondary)' : 'transparent',
                                                                color: on ? 'var(--text-primary)' : 'var(--text-muted)',
                                                                fontWeight: on ? 700 : 500, fontSize: 11,
                                                                transition: 'background 0.12s',
                                                            }}>
                                                                <AxisIcon style={{ width: 12, height: 12 }} />
                                                                {a.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}>Sovereignty breakdown</SectionTitle>
                                            <Card>
                                                {rows.length === 0 ? (
                                                    <div style={{ padding: 22, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                                                        {sovereigntyAxis === 'pii' ? 'No PII detected in any tool result.' : 'No data for this dimension.'}
                                                    </div>
                                                ) : rows.map((row, i) => (
                                                    <SovereigntyRow
                                                        key={i}
                                                        row={row}
                                                        onClick={() => handleDrill(sovereigntyAxis, row)}
                                                        avatarFor={avatarFor}
                                                        topOperatorColorFor={operatorColor}
                                                    />
                                                ))}
                                            </Card>
                                        </div>
                                    );
                                })()}

                                {/* Two Column: By Type + Server Endpoints */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                                    <div>
                                        <SectionTitle icon={Link2}>{t('usage.integ_by_type')}</SectionTitle>
                                        <Card>
                                            {/* Column headers — make it obvious what each number means */}
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-subtle)' }}>
                                                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Integration · Direction · PII</span>
                                                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Calls · Last used</span>
                                            </div>
                                            {integData.byType.length === 0 ? (
                                                <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{t('usage.integ_no_data')}</div>
                                            ) : integData.byType.slice(0, 10).map((item, i) => {
                                                const total = Number(item.total) || 0;
                                                const pii = Number(item.pii_events) || 0;
                                                return (
                                                    <ListRow key={i}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                                            <IntegrationLogo integrationType={item.integration_type} fallbackColor={getColor(i)} />
                                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{(item.integration_type || 'unknown').replace(/_/g, ' ')}</div>
                                                                <div style={{ display: 'flex', gap: 8, marginTop: 2, fontSize: 10 }}>
                                                                    {Number(item.sent) > 0 && <span style={{ color: '#3b82f6', fontWeight: 600 }}>{item.sent} {t('usage.integ_sent')}</span>}
                                                                    {Number(item.received) > 0 && <span style={{ color: '#10b981', fontWeight: 600 }}>{item.received} {t('usage.integ_received')}</span>}
                                                                    {pii > 0 && <span style={{ color: '#ef4444', fontWeight: 600 }}>{pii} {t('usage.integ_pii')}</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{total}</div>
                                                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('usage.integ_last_used')} {item.last_used ? new Date(item.last_used).toLocaleDateString() : '—'}</div>
                                                        </div>
                                                    </ListRow>
                                                );
                                            })}
                                        </Card>
                                    </div>

                                    <div>
                                        <SectionTitle icon={Server}>{t('usage.integ_by_server')}</SectionTitle>
                                        <Card>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-subtle)' }}>
                                                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Hostname · Region · IPs</span>
                                                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Calls · Last contact</span>
                                            </div>
                                            {integData.servers.length === 0 ? (
                                                <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{t('usage.integ_no_data')}</div>
                                            ) : integData.servers.slice(0, 10).map((srv, i) => {
                                                const total = Number(srv.total) || 0;
                                                const flags = srv.country_flags || [];
                                                const names = srv.country_names || [];
                                                const codes = srv.country_codes || [];
                                                const ips = srv.server_ips || [];
                                                return (
                                                    <ListRow key={i}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                                            <IconBadge icon={Server} color={getColor(i + 2)} />
                                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={srv.server_endpoint}>{srv.server_endpoint}</div>
                                                                <div style={{ display: 'flex', gap: 6, marginTop: 2, fontSize: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                                                    {flags.length > 0 && flags.map((flag, fi) => (
                                                                        <span key={fi} style={{ fontWeight: 600, color: srv.is_eu ? '#10b981' : '#f59e0b' }}>{flag} {names[fi] || codes[fi]}</span>
                                                                    ))}
                                                                    {srv.is_eu !== undefined && <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 6, background: srv.is_eu ? '#10b98118' : '#f59e0b18', color: srv.is_eu ? '#10b981' : '#f59e0b', letterSpacing: '0.03em' }}>{srv.is_eu ? 'EU/EEA' : 'Non-EU'}</span>}
                                                                    <span style={{ color: 'var(--text-muted)' }}>{Number(srv.integration_count) || 0} integrations</span>
                                                                    {Number(srv.sent) > 0 && <span style={{ color: '#3b82f6', fontWeight: 600 }}>{srv.sent}↑</span>}
                                                                    {Number(srv.received) > 0 && <span style={{ color: '#10b981', fontWeight: 600 }}>{srv.received}↓</span>}
                                                                </div>
                                                                {ips.length > 0 && <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>IP: {ips.join(', ')}</div>}
                                                            </div>
                                                        </div>
                                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{total}</div>
                                                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('usage.integ_last_contact')} {srv.last_contact ? new Date(srv.last_contact).toLocaleDateString() : '—'}</div>
                                                        </div>
                                                    </ListRow>
                                                );
                                            })}
                                        </Card>
                                    </div>
                                </div>

                                {/* PII Categories by Integration — wrapped in a red warning frame
                                    so this critical signal isn't visually equal to the more benign
                                    "byType" / "servers" cards next to it. */}
                                {integData.piiSummary.length > 0 && (
                                    <div style={{
                                        marginBottom: 14, padding: 14, borderRadius: 12,
                                        background: 'rgba(239,68,68,0.04)',
                                        border: '1px solid rgba(239,68,68,0.35)',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                            <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <AlertTriangle style={{ width: 13, height: 13, color: '#ef4444' }} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 12, fontWeight: 800, color: '#ef4444', letterSpacing: '-0.01em' }}>{t('usage.integ_pii_by_category')}</div>
                                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>Personal data detected leaving the agent — verify these tools have a legitimate reason to handle the categories below.</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                            {integData.piiSummary.map((p, i) => (
                                                <div key={i} style={{
                                                    display: 'flex', alignItems: 'center', gap: 6,
                                                    padding: '6px 12px', borderRadius: 20,
                                                    background: '#fff', border: '1px solid rgba(239,68,68,0.35)',
                                                }}>
                                                    <Fingerprint style={{ width: 11, height: 11, color: '#ef4444' }} />
                                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444' }}>{p.pii_category}</span>
                                                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '1px 6px', borderRadius: 8 }}>{p.count}</span>
                                                    <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{(p.integration_type || '').replace(/_/g, ' ')}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Operator Summary — card grid, one per cloud provider with a
                                    proportion bar showing its share of total egress. Brand-tinted
                                    chrome makes the eye group Google/MS/Cloudflare/AWS quickly. */}
                                {integData.operators.length > 0 && (() => {
                                    const ops = integData.operators;
                                    const grand = ops.reduce((s, o) => s + (Number(o.total) || 0), 0) || 1;
                                    return (
                                    <div style={{ marginBottom: 14 }}>
                                        <SectionTitle icon={Server}>Destinations by operator</SectionTitle>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                                            {ops.map((op, i) => {
                                                const total = Number(op.total) || 0;
                                                const ips = Number(op.unique_ips) || 0;
                                                const integs = Number(op.unique_integrations) || 0;
                                                const name = op.operator || 'Unknown';
                                                const isUnknown = name === 'Unknown';
                                                const c = operatorColor(name);
                                                const pct = Math.round((total / grand) * 100);
                                                return (
                                                    <div key={i} style={{
                                                        position: 'relative', padding: 14, borderRadius: 12, overflow: 'hidden',
                                                        // Unknown operator gets an amber-tinted card — these are the IPs
                                                        // not attributable to a known cloud, the highest-risk bucket.
                                                        background: isUnknown ? 'rgba(245,158,11,0.08)' : 'var(--bg-secondary)',
                                                        border: isUnknown ? '1px solid rgba(245,158,11,0.45)' : '1px solid var(--border-subtle)',
                                                    }}>
                                                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: isUnknown ? 4 : 3, background: c }} />
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                <div style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${c}18`, color: c, fontSize: 12, fontWeight: 800, letterSpacing: '-0.02em' }}>
                                                                    {isUnknown ? <AlertTriangle style={{ width: 14, height: 14 }} /> : name[0]}
                                                                </div>
                                                                <div style={{ minWidth: 0 }}>
                                                                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                                                                    <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{ips} IP{ips === 1 ? '' : 's'} · {integs} integration{integs === 1 ? '' : 's'}</div>
                                                                </div>
                                                            </div>
                                                            <div style={{ textAlign: 'right' }}>
                                                                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>{total}</div>
                                                                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{pct}% of egress</div>
                                                            </div>
                                                        </div>
                                                        {/* Proportion bar */}
                                                        <div style={{ height: 4, borderRadius: 99, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', width: `${pct}%`, background: c, transition: 'width 0.4s ease' }} />
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 9, color: 'var(--text-muted)' }}>
                                                            {op.any_eu
                                                                ? <span style={{ padding: '2px 6px', borderRadius: 5, background: '#10b98115', color: '#10b981', fontWeight: 700, letterSpacing: '0.03em' }}>EU/EEA SEEN</span>
                                                                : <span style={{ padding: '2px 6px', borderRadius: 5, background: '#f59e0b15', color: '#f59e0b', fontWeight: 700, letterSpacing: '0.03em' }}>NON-EU</span>}
                                                            <span>last {op.last_seen ? new Date(op.last_seen).toLocaleDateString() : '—'}</span>
                                                        </div>
                                                        {isUnknown && (
                                                            <div style={{ marginTop: 8, fontSize: 10, fontWeight: 600, color: '#92400e' }}>
                                                                Operator not in our registry — verify these IPs are expected.
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    );
                                })()}

                                {/* Data Egress Log — per-call record with actual peer IP */}
                                {integData.egress.length > 0 && (
                                    <div ref={egressLogRef}>
                                        <SectionTitle icon={Activity} right={(
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    {[
                                                        { id: 'all', label: 'All' },
                                                        { id: 'eu', label: '🇪🇺 EU only' },
                                                        { id: 'non-eu', label: 'Non-EU' },
                                                        { id: 'local', label: 'Local' },
                                                    ].map(p => {
                                                        const on = egressEuFilter === p.id;
                                                        return (
                                                            <button key={p.id} onClick={() => setEgressEuFilter(p.id)} style={{
                                                                padding: '3px 9px', borderRadius: 6, border: 'none', cursor: 'pointer',
                                                                background: on ? 'var(--bg-primary)' : 'var(--bg-tertiary)',
                                                                color: on ? 'var(--text-primary)' : 'var(--text-muted)',
                                                                fontWeight: on ? 700 : 500, fontSize: 10,
                                                            }}>{p.label}</button>
                                                        );
                                                    })}
                                                </div>
                                                {/* CSV export — respects the currently-applied EU + drill filters */}
                                                <button
                                                    onClick={() => {
                                                        const filtered = integData.egress.filter(ev => {
                                                            if (egressEuFilter === 'eu' && ev.is_eu !== true) return false;
                                                            if (egressEuFilter === 'non-eu' && (ev.is_eu !== false || ev.is_local)) return false;
                                                            if (egressEuFilter === 'local' && !ev.is_local) return false;
                                                            if (egressDrill) {
                                                                const d = egressDrill;
                                                                if (d.axis === 'user' && ev.user_id !== d.key) return false;
                                                                if (d.axis === 'agent' && (ev.agent_id || 'direct-chat') !== d.key) return false;
                                                                if (d.axis === 'integration' && ev.integration_type !== d.key) return false;
                                                                if (d.axis === 'pii') {
                                                                    const cats = (ev.pii_categories_detected || '').split(',').map(s => s.trim());
                                                                    if (!cats.includes(d.key)) return false;
                                                                }
                                                                if (d.axis === 'pii-non-eu') {
                                                                    const hasPii = ev.pii_categories_detected && ev.pii_categories_detected.trim() !== '';
                                                                    if (ev.is_eu || ev.is_local || !hasPii) return false;
                                                                }
                                                            }
                                                            return true;
                                                        });
                                                        const headers = ['timestamp', 'user_id', 'display_name', 'agent_id', 'agent_name', 'tool_name', 'integration_type', 'peer_ip', 'peer_ip_source', 'tls_servername', 'server_endpoint', 'operator', 'country_code', 'is_eu', 'is_local', 'data_direction', 'pii_categories_detected'];
                                                        const csv = rowsToCsv(headers, filtered);
                                                        const today = new Date().toISOString().slice(0, 10);
                                                        downloadCsv(`integration-egress-${today}.csv`, csv);
                                                    }}
                                                    style={{
                                                        padding: '3px 9px', borderRadius: 6, border: '1px solid var(--border-default, var(--border-subtle))', cursor: 'pointer',
                                                        background: 'var(--bg-primary)', color: 'var(--text-secondary)',
                                                        fontWeight: 600, fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4,
                                                    }}
                                                    title="Download the egress log (respects active filters)"
                                                >
                                                    ↓ CSV
                                                </button>
                                            </div>
                                        )}>Data egress log</SectionTitle>
                                        {/* Active drill chip */}
                                        {egressDrill && (
                                            <div style={{ marginBottom: 8 }}>
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 8,
                                                    padding: '5px 6px 5px 10px', borderRadius: 99,
                                                    background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.25)',
                                                    fontSize: 11, color: 'var(--text-primary)',
                                                }}>
                                                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#0ea5e9' }}>{egressDrill.axis}</span>
                                                    <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{(egressDrill.label || egressDrill.key || '').toString().replace(/_/g, ' ')}</span>
                                                    <button onClick={() => setEgressDrill(null)} style={{
                                                        width: 18, height: 18, borderRadius: '50%', border: 'none', cursor: 'pointer',
                                                        background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
                                                    }} aria-label="Clear drill filter">✕</button>
                                                </span>
                                            </div>
                                        )}
                                        <Card>
                                            <div style={{ display: 'grid', gridTemplateColumns: '110px 130px 90px 100px 160px 130px 70px 60px', padding: '8px 14px 8px 14px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-subtle)', borderLeft: '3px solid transparent' }}>
                                                {['Time', 'User', 'Tool', 'Integration', 'Hostname → Peer IP', 'Operator', 'Region', 'Direction'].map(h => (
                                                    <span key={h} style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>{h}</span>
                                                ))}
                                            </div>
                                            {(() => {
                                                const filtered = integData.egress.filter(ev => {
                                                    if (egressEuFilter === 'eu' && ev.is_eu !== true) return false;
                                                    if (egressEuFilter === 'non-eu' && (ev.is_eu !== false || ev.is_local)) return false;
                                                    if (egressEuFilter === 'local' && !ev.is_local) return false;
                                                    if (egressDrill) {
                                                        const d = egressDrill;
                                                        if (d.axis === 'user' && ev.user_id !== d.key) return false;
                                                        if (d.axis === 'agent' && (ev.agent_id || 'direct-chat') !== d.key) return false;
                                                        if (d.axis === 'integration' && ev.integration_type !== d.key) return false;
                                                        if (d.axis === 'pii') {
                                                            const cats = (ev.pii_categories_detected || '').split(',').map(s => s.trim());
                                                            if (!cats.includes(d.key)) return false;
                                                        }
                                                        if (d.axis === 'pii-non-eu') {
                                                            // Virtual axis used by the Action-required banner CTA
                                                            // and the hero "PII leaks abroad" button.
                                                            const hasPii = ev.pii_categories_detected && ev.pii_categories_detected.trim() !== '';
                                                            if (ev.is_eu || ev.is_local || !hasPii) return false;
                                                        }
                                                    }
                                                    return true;
                                                });
                                                if (filtered.length === 0) {
                                                    return <div style={{ padding: 18, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>No rows match this filter.</div>;
                                                }
                                                return filtered.slice(0, 100).map((ev, i) => {
                                                    const dirColor = ev.data_direction === 'sent' ? '#3b82f6' : ev.data_direction === 'received' ? '#10b981' : '#f59e0b';
                                                    const sourceColor = ev.peer_ip_source === 'socket' ? '#10b981' : ev.peer_ip_source === 'dns_pre_call' ? '#0ea5e9' : ev.peer_ip_source === 'local' ? '#64748b' : '#f59e0b';
                                                    const rowAccent = ev.is_local ? '#14b8a6' : (ev.operator ? operatorColor(ev.operator) : '#94a3b8');
                                                    return (
                                                        <div key={ev.id || i} style={{
                                                            display: 'grid', gridTemplateColumns: '110px 130px 90px 100px 160px 130px 70px 60px',
                                                            padding: '7px 14px 7px 11px', alignItems: 'center',
                                                            background: i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                                                            borderBottom: '1px solid var(--border-subtle)',
                                                            borderLeft: `3px solid ${rowAccent}`,
                                                            fontSize: 11,
                                                        }}>
                                                            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{new Date(ev.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--text-primary)', minWidth: 0 }}>
                                                                <Avatar user={ev} color={getColor(i)} size={18} />
                                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.display_name || ev.user_id || 'Unknown'}</span>
                                                            </span>
                                                            <span style={{ fontWeight: 600, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10 }} title={ev.tool_name}>{ev.tool_name}</span>
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600, color: getColor(i), textTransform: 'capitalize', fontSize: 10, minWidth: 0 }}>
                                                                {hasIntegrationIcon(ev.integration_type) && (
                                                                    <span style={{ width: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{getIntegrationIcon(ev.integration_type)}</span>
                                                                )}
                                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(ev.integration_type || '').replace(/_/g, ' ')}</span>
                                                            </span>
                                                            <span style={{ minWidth: 0, overflow: 'hidden' }}>
                                                                {ev.is_local ? (
                                                                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: '#10b98115', color: '#10b981' }}>Local</span>
                                                                ) : (
                                                                    <>
                                                                        {(() => {
                                                                            // Prefer the probe-captured hostname (tls_servername) — that
                                                                            // is provably where the call went. Fall back to the static
                                                                            // server_endpoint only when no probe captured a hostname.
                                                                            const realHost = ev.tls_servername || ev.server_endpoint || '—';
                                                                            const showAlt = ev.tls_servername && ev.server_endpoint && ev.tls_servername !== ev.server_endpoint;
                                                                            return (
                                                                                <>
                                                                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={realHost}>{realHost}</div>
                                                                                    {showAlt && <div style={{ fontSize: 8, color: 'var(--text-muted)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`Configured: ${ev.server_endpoint}`}>cfg: {ev.server_endpoint}</div>}
                                                                                </>
                                                                            );
                                                                        })()}
                                                                        <div style={{ fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', fontWeight: 700, color: 'var(--text-primary)', fontSize: 11 }}>{ev.peer_ip || '—'}</div>
                                                                        {ev.peer_ip_source && <span style={{ fontSize: 8, fontWeight: 700, color: sourceColor, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{ev.peer_ip_source.replace(/_/g, ' ')}</span>}
                                                                    </>
                                                                )}
                                                            </span>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: ev.operator ? 'var(--text-primary)' : 'var(--text-muted)', overflow: 'hidden', whiteSpace: 'nowrap' }} title={ev.operator || (ev.is_local ? 'Local' : 'Unknown')}>
                                                                {!ev.is_local && <span style={{ width: 6, height: 6, borderRadius: '50%', background: rowAccent, flexShrink: 0 }} />}
                                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.operator || (ev.is_local ? '—' : 'Unknown')}</span>
                                                            </span>
                                                            <span style={{ fontSize: 10, fontWeight: 600, color: ev.is_eu ? '#10b981' : ev.country_flag ? '#f59e0b' : 'var(--text-muted)' }} title={ev.country_name || ''}>{ev.is_local ? '—' : ev.country_flag ? `${ev.country_flag} ${ev.country_code || ''}` : '—'}</span>
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                                                {ev.data_direction === 'sent' && <ArrowRight style={{ width: 10, height: 10, color: dirColor }} />}
                                                                {ev.data_direction === 'received' && <ArrowLeft style={{ width: 10, height: 10, color: dirColor }} />}
                                                                {ev.data_direction === 'both' && <><ArrowRight style={{ width: 8, height: 8, color: dirColor }} /><ArrowLeft style={{ width: 8, height: 8, color: dirColor }} /></>}
                                                                <span style={{ fontWeight: 600, color: dirColor, textTransform: 'capitalize', fontSize: 10 }}>{ev.data_direction}</span>
                                                            </span>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </Card>
                                    </div>
                                )}
                            </>
                        )}
                    </div>)}

                    {/* ════════════════════════════════════════════════════════════ */}
                    {/* FEEDBACK TAB                                                */}
                    {/* ════════════════════════════════════════════════════════════ */}
                    {activeReport === 'feedback' && (
                        <OrgFeedbackPanel />
                    )}

                    {/* ════════════════════════════════════════════════════════════ */}
                    {/* TERMINATIONS TAB                                            */}
                    {/* ════════════════════════════════════════════════════════════ */}
                    {activeReport === 'terminations' && (
                        <OrgTerminationsPanel />
                    )}
                </>
            )}
        </div>
    );
};

export default UsageSection;

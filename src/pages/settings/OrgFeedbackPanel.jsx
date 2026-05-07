import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    ThumbsUp, ThumbsDown, MessageCircle, MessageSquare, ChevronRight,
    Search, Cpu, User, Bot, ExternalLink, RefreshCw, Calendar,
    Clock, Repeat,
} from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { useTranslation } from '../../hooks/useTranslation';
import MarkdownRenderer from '../../components/MarkdownRenderer';

const PAGE_SIZE = 10;
const FEEDBACK_API = `${API_BASE}/api/feedback/org`;

// Palette — explicitly excludes purple/violet/indigo (per project styling rules).
const C = {
    primary: '#6366f1', // accent (still used by site theme); we don't paint cards with it
    blue: '#3b82f6',
    green: '#10b981',
    amber: '#f59e0b',
    rose: '#f43f5e',
    cyan: '#06b6d4',
};

const RANGES = [
    { id: 'today', labelKey: 'org.feedback_today' },
    { id: '7d', labelKey: 'org.feedback_7d' },
    { id: '30d', labelKey: 'org.feedback_30d' },
    { id: 'all', labelKey: 'org.feedback_all_time' },
    { id: 'custom', labelKey: 'org.feedback_custom' },
];

function rangeToFilter(rangeId, customStart, customEnd) {
    if (rangeId === 'all') return {};
    if (rangeId === 'custom') {
        if (!customStart || !customEnd) return {};
        return {
            startDate: new Date(customStart).toISOString(),
            endDate: new Date(customEnd).toISOString(),
        };
    }
    const now = new Date();
    let start;
    if (rangeId === 'today') {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (rangeId === '7d') {
        start = new Date(now.getTime() - 7 * 86400000);
    } else {
        start = new Date(now.getTime() - 30 * 86400000);
    }
    return { startDate: start.toISOString(), endDate: now.toISOString() };
}

function toLocalInput(date) {
    const d = new Date(date);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
    return d.toLocaleDateString();
}

function shortModel(m) {
    if (!m) return 'Unknown';
    return m.replace(/^(openai\/|anthropic\/|google\/|azure\/|mistral\/)/, '')
        .replace(/-\d{4}-\d{2}-\d{2}$/, '');
}

function fmtDuration(ms) {
    if (ms == null || ms === '') return null;
    const n = Number(ms);
    if (!Number.isFinite(n) || n <= 0) return null;
    if (n < 1000) return `${Math.round(n)} ms`;
    return `${(n / 1000).toFixed(1)} s`;
}

function parseSnapshot(raw) {
    if (!raw) return null;
    try {
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return Array.isArray(data) ? data : null;
    } catch { return null; }
}

const Card = ({ children, style }) => (
    <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
        borderRadius: 12, padding: '16px 18px', ...style,
    }}>{children}</div>
);

const KpiCard = ({ icon: Icon, label, value, color, subtitle }) => (
    <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
        borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 6,
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
                width: 28, height: 28, borderRadius: 7,
                background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <Icon style={{ width: 14, height: 14, color }} />
            </div>
            <span style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.06em', color: 'var(--text-muted)',
            }}>{label}</span>
        </div>
        <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.05 }}>
            {value}
        </span>
        {subtitle && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{subtitle}</span>
        )}
    </div>
);

const Empty = ({ text }) => (
    <div style={{
        padding: '2rem 1rem', textAlign: 'center',
        color: 'var(--text-muted)', fontSize: 13,
        borderRadius: 10, background: 'var(--bg-tertiary)',
    }}>{text}</div>
);

export default function OrgFeedbackPanel() {
    const { t } = useTranslation();
    const [range, setRange] = useState('7d');
    const [customStart, setCustomStart] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0); return toLocalInput(d);
    });
    const [customEnd, setCustomEnd] = useState(() => toLocalInput(new Date()));
    const [loading, setLoading] = useState(true);
    const [feedback, setFeedback] = useState([]);
    const [summary, setSummary] = useState({ total: 0, thumbs_up: 0, thumbs_down: 0, with_comments: 0 });

    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [pageNum, setPageNum] = useState(0);
    const [expanded, setExpanded] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const filters = rangeToFilter(range, customStart, customEnd);
            const qs = new URLSearchParams(filters).toString();
            const q = qs ? `?${qs}` : '';
            const [listResp, sumResp] = await Promise.all([
                authFetch(`${FEEDBACK_API}${q}`),
                authFetch(`${FEEDBACK_API}/summary${q}`),
            ]);
            const list = listResp.ok ? await listResp.json() : [];
            const sum = sumResp.ok ? await sumResp.json() : null;
            setFeedback(Array.isArray(list) ? list : []);
            setSummary(sum || { total: 0, thumbs_up: 0, thumbs_down: 0, with_comments: 0 });
        } catch (e) {
            console.error('[OrgFeedback] fetch error:', e);
            setFeedback([]);
        }
        setLoading(false);
    }, [range, customStart, customEnd]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filtered = useMemo(() => {
        let data = feedback;
        if (filter === 'positive') data = data.filter(f => f.rating === 'up');
        if (filter === 'negative') data = data.filter(f => f.rating === 'down');
        if (filter === 'comments') data = data.filter(f => f.comment);
        if (filter === 'with_convo') data = data.filter(f => f.conversation_snapshot);
        if (search) {
            const qq = search.toLowerCase();
            data = data.filter(f =>
                f.comment?.toLowerCase().includes(qq) ||
                f.agent_id?.toLowerCase().includes(qq) ||
                f.user_id?.toLowerCase().includes(qq) ||
                f.source?.toLowerCase().includes(qq) ||
                f.conversation_id?.toLowerCase().includes(qq)
            );
        }
        return data;
    }, [feedback, filter, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paged = filtered.slice(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE);

    const posCount = Number(summary?.thumbs_up) || 0;
    const negCount = Number(summary?.thumbs_down) || 0;
    const total = Number(summary?.total) || 0;
    const posRate = total > 0 ? `${Math.round((posCount / total) * 100)}%` : '—';

    const withConvoCount = useMemo(
        () => feedback.filter(f => f.conversation_snapshot).length,
        [feedback]
    );

    const FILTER_CHIPS = [
        { id: 'all', labelKey: 'org.feedback_chip_all' },
        { id: 'positive', labelKey: 'org.feedback_chip_positive' },
        { id: 'negative', labelKey: 'org.feedback_chip_negative' },
        { id: 'comments', labelKey: 'org.feedback_chip_comments' },
        { id: 'with_convo', labelKey: 'org.feedback_chip_with_convo' },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Header / range selector */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        {t('org.feedback_title')}
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0', fontWeight: 400 }}>
                        {t('org.feedback_subtitle')}
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{
                        display: 'flex', borderRadius: 8, overflow: 'hidden',
                        border: '1px solid var(--border-subtle)',
                    }}>
                        {RANGES.map(r => {
                            const active = range === r.id;
                            return (
                                <button
                                    key={r.id}
                                    onClick={() => setRange(r.id)}
                                    style={{
                                        padding: '6px 12px', fontSize: 11, fontWeight: 600,
                                        border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                                        background: active ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                        color: active ? '#fff' : 'var(--text-muted)',
                                        display: 'flex', alignItems: 'center', gap: 5,
                                    }}
                                >
                                    {r.id === 'custom' && <Calendar style={{ width: 11, height: 11 }} />}
                                    {t(r.labelKey)}
                                </button>
                            );
                        })}
                    </div>
                    {range === 'custom' && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '4px 8px', borderRadius: 8,
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-subtle)',
                        }}>
                            <input
                                type="datetime-local"
                                value={customStart}
                                max={customEnd}
                                onChange={e => setCustomStart(e.target.value)}
                                style={{
                                    background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                                    borderRadius: 6, padding: '3px 6px', fontSize: 11,
                                    color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
                                }}
                            />
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>→</span>
                            <input
                                type="datetime-local"
                                value={customEnd}
                                min={customStart}
                                onChange={e => setCustomEnd(e.target.value)}
                                style={{
                                    background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                                    borderRadius: 6, padding: '3px 6px', fontSize: 11,
                                    color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
                                }}
                            />
                        </div>
                    )}
                    <button
                        onClick={fetchData}
                        title={t('org.feedback_refresh')}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 30, height: 30, borderRadius: 8,
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-secondary)', cursor: 'pointer',
                            color: 'var(--text-muted)',
                        }}
                    >
                        <RefreshCw style={{ width: 13, height: 13, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                    </button>
                </div>
            </div>

            {/* KPI Cards — note: NO purple, "With Comments" uses amber */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                <KpiCard icon={ThumbsUp} label={t('org.feedback_positive')} color={C.green}
                    value={posCount} subtitle={`${posRate} ${t('org.feedback_approval')}`} />
                <KpiCard icon={ThumbsDown} label={t('org.feedback_negative')} color={C.rose}
                    value={negCount} />
                <KpiCard icon={MessageCircle} label={t('org.feedback_with_comments')} color={C.amber}
                    value={Number(summary?.with_comments) || 0} />
                <KpiCard icon={MessageSquare} label={t('org.feedback_with_conversation')} color={C.blue}
                    value={withConvoCount} subtitle={t('org.feedback_shared_context')} />
            </div>

            {/* Filter chips + search + list */}
            <Card>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    {FILTER_CHIPS.map(f => {
                        const active = filter === f.id;
                        return (
                            <button
                                key={f.id}
                                onClick={() => { setFilter(f.id); setPageNum(0); }}
                                style={{
                                    padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                                    border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                                    background: active ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                    color: active ? '#fff' : 'var(--text-secondary)',
                                }}
                            >{t(f.labelKey)}</button>
                        );
                    })}
                    <div style={{ flex: 1 }} />
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
                        borderRadius: 8, background: 'var(--bg-primary)',
                        border: '1px solid var(--border-subtle)',
                    }}>
                        <Search style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />
                        <input
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPageNum(0); }}
                            placeholder={t('org.feedback_search_placeholder')}
                            style={{
                                background: 'transparent', border: 'none', outline: 'none', fontSize: 12,
                                color: 'var(--text-primary)', width: 160,
                            }}
                        />
                    </div>
                </div>

                {paged.length === 0 ? (
                    <Empty text={loading ? t('org.feedback_loading') : t('org.feedback_empty')} />
                ) : paged.map((item, i) => {
                    const isExpanded = expanded === item.id;
                    const snapshot = parseSnapshot(item.conversation_snapshot);
                    const hasConvo = !!snapshot && snapshot.length > 0;
                    const isUp = item.rating === 'up';

                    return (
                        <div key={item.id || i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <div
                                onClick={() => setExpanded(isExpanded ? null : item.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 2px',
                                    cursor: 'pointer', transition: 'background 0.12s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <span style={{ fontSize: 18, width: 28, textAlign: 'center', flexShrink: 0 }}>
                                    {isUp ? '👍' : '👎'}
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {item.user_id || t('org.feedback_anonymous')}
                                        </span>
                                        {item.source && (
                                            <span style={{
                                                padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                                                background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                                            }}>{item.source}</span>
                                        )}
                                        {(item.agent_name || item.agent_id) && (
                                            <span style={{
                                                display: 'flex', alignItems: 'center', gap: 3,
                                                padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                                                background: `${C.blue}15`, color: C.blue,
                                            }} title={item.agent_id || ''}>
                                                <Bot style={{ width: 9, height: 9 }} />
                                                {item.agent_name || (item.agent_id?.length > 20 ? item.agent_id.slice(0, 20) + '…' : item.agent_id)}
                                            </span>
                                        )}
                                        {item.model && (
                                            <span style={{
                                                display: 'flex', alignItems: 'center', gap: 3,
                                                padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                                                background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                                            }} title={item.model}>
                                                <Cpu style={{ width: 9, height: 9 }} />
                                                {shortModel(item.model)}
                                            </span>
                                        )}
                                        {item.model_tier && (
                                            <span style={{
                                                padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                                                background: `${C.amber}15`, color: C.amber,
                                            }} title={`tier: ${item.model_tier}`}>
                                                tier: {item.model_tier}
                                            </span>
                                        )}
                                        {hasConvo && (
                                            <span style={{
                                                display: 'flex', alignItems: 'center', gap: 3,
                                                padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                                                background: `${C.cyan}15`, color: C.cyan,
                                            }}>
                                                <MessageSquare style={{ width: 9, height: 9 }} />
                                                {snapshot.length}
                                            </span>
                                        )}
                                    </div>
                                    {item.comment && (
                                        <div style={{
                                            fontSize: 12, color: 'var(--text-secondary)', marginTop: 3,
                                            overflow: 'hidden', textOverflow: 'ellipsis',
                                            whiteSpace: isExpanded ? 'pre-wrap' : 'nowrap',
                                            maxWidth: isExpanded ? 'none' : 500,
                                        }}>
                                            "{item.comment}"
                                        </div>
                                    )}
                                </div>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                                    {fmtTime(item.created_at)}
                                </span>
                                <ChevronRight style={{
                                    width: 14, height: 14, color: 'var(--text-muted)',
                                    transform: isExpanded ? 'rotate(90deg)' : 'none',
                                    transition: 'transform 0.2s', flexShrink: 0,
                                }} />
                            </div>

                            {isExpanded && (
                                <div style={{
                                    padding: '10px 12px 14px 38px',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: '0 0 8px 8px',
                                }}>
                                    <div style={{
                                        display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap',
                                        fontSize: 11, color: 'var(--text-muted)',
                                    }}>
                                        {item.conversation_id && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <ExternalLink style={{ width: 10, height: 10 }} />
                                                Conv: {item.conversation_id.slice(0, 16)}…
                                            </span>
                                        )}
                                        {item.message_id && (
                                            <span>Msg: {item.message_id.slice(0, 16)}…</span>
                                        )}
                                    </div>

                                    {item.comment && (
                                        <div style={{
                                            marginBottom: 10, padding: '10px 14px', borderRadius: 10,
                                            background: isUp ? `${C.green}10` : `${C.rose}10`,
                                            border: `1px solid ${isUp ? C.green : C.rose}25`,
                                        }}>
                                            <div style={{
                                                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                                                letterSpacing: '0.04em', marginBottom: 4,
                                                color: isUp ? C.green : C.rose,
                                            }}>{t('org.feedback_user_feedback')}</div>
                                            <div style={{
                                                fontSize: 13, color: 'var(--text-primary)',
                                                whiteSpace: 'pre-wrap', lineHeight: 1.5,
                                            }}>{item.comment}</div>
                                        </div>
                                    )}

                                    {hasConvo ? (
                                        <div>
                                            <div style={{
                                                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                                                letterSpacing: '0.04em', marginBottom: 8,
                                                color: C.blue, display: 'flex', alignItems: 'center', gap: 5,
                                            }}>
                                                <MessageSquare style={{ width: 11, height: 11 }} />
                                                {t('org.feedback_conversation')} ({snapshot.length})
                                            </div>
                                            <div style={{
                                                maxHeight: 360, overflowY: 'auto',
                                                display: 'flex', flexDirection: 'column', gap: 6,
                                            }}>
                                                {(() => {
                                                    // Track the previous assistant turn's model so we can flag a switch.
                                                    let prevAssistantModel = null;
                                                    return snapshot.map((msg, mi) => {
                                                        const isUserMsg = msg.role === 'user';
                                                        const content = typeof msg.content === 'string'
                                                            ? msg.content
                                                            : JSON.stringify(msg.content);
                                                        if (!content || content.trim().length === 0) return null;
                                                        const truncated = content.length > 800
                                                            ? content.slice(0, 800) + '…'
                                                            : content;

                                                        const duration = !isUserMsg ? fmtDuration(msg.duration_ms) : null;
                                                        const turnModel = !isUserMsg ? (msg.model || null) : null;
                                                        const switched = !isUserMsg && turnModel && prevAssistantModel && turnModel !== prevAssistantModel;
                                                        if (!isUserMsg) prevAssistantModel = turnModel || prevAssistantModel;

                                                        return (
                                                            <div key={mi} style={{
                                                                display: 'flex',
                                                                justifyContent: isUserMsg ? 'flex-end' : 'flex-start',
                                                            }}>
                                                                <div style={{
                                                                    maxWidth: '85%',
                                                                    padding: '8px 12px', borderRadius: 12,
                                                                    background: isUserMsg
                                                                        ? 'var(--bg-secondary)'
                                                                        : 'var(--bg-primary)',
                                                                    border: `1px solid ${isUserMsg
                                                                        ? 'var(--border-subtle)'
                                                                        : `${C.blue}25`}`,
                                                                }}>
                                                                    <div style={{
                                                                        display: 'flex', alignItems: 'center', gap: 5,
                                                                        marginBottom: 4, flexWrap: 'wrap',
                                                                    }}>
                                                                        {isUserMsg
                                                                            ? <User style={{ width: 10, height: 10, color: 'var(--text-muted)' }} />
                                                                            : <Bot style={{ width: 10, height: 10, color: C.blue }} />}
                                                                        <span style={{
                                                                            fontSize: 10, fontWeight: 600,
                                                                            color: isUserMsg ? 'var(--text-muted)' : C.blue,
                                                                        }}>
                                                                            {isUserMsg ? t('org.feedback_role_user') : t('org.feedback_role_ai')}
                                                                        </span>
                                                                        {turnModel && (
                                                                            <span style={{
                                                                                display: 'inline-flex', alignItems: 'center', gap: 3,
                                                                                padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                                                                                background: switched ? `${C.amber}20` : 'var(--bg-tertiary)',
                                                                                color: switched ? C.amber : 'var(--text-secondary)',
                                                                                border: switched ? `1px solid ${C.amber}40` : '1px solid transparent',
                                                                            }} title={switched
                                                                                ? `${t('org.feedback_model_switched')}: ${prevAssistantModel} → ${turnModel}`
                                                                                : turnModel}>
                                                                                {switched
                                                                                    ? <Repeat style={{ width: 9, height: 9 }} />
                                                                                    : <Cpu style={{ width: 9, height: 9 }} />}
                                                                                {shortModel(turnModel)}
                                                                            </span>
                                                                        )}
                                                                        {duration && (
                                                                            <span style={{
                                                                                display: 'inline-flex', alignItems: 'center', gap: 3,
                                                                                padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                                                                                background: 'var(--bg-tertiary)',
                                                                                color: 'var(--text-secondary)',
                                                                            }} title={t('org.feedback_response_time')}>
                                                                                <Clock style={{ width: 9, height: 9 }} />
                                                                                {duration}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div style={{
                                                                        fontSize: 13,
                                                                        color: 'var(--text-primary)',
                                                                        wordBreak: 'break-word',
                                                                        lineHeight: 1.6,
                                                                    }} className="prose prose-sm dark:prose-invert max-w-none">
                                                                        {isUserMsg
                                                                            ? <span style={{ whiteSpace: 'pre-wrap' }}>{truncated}</span>
                                                                            : <MarkdownRenderer content={truncated} />}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{
                                            padding: 14, borderRadius: 10, textAlign: 'center',
                                            background: 'var(--bg-primary)',
                                            border: '1px dashed var(--border-subtle)',
                                        }}>
                                            <MessageSquare style={{ width: 18, height: 18, color: 'var(--text-muted)', margin: '0 auto 4px' }} />
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                {t('org.feedback_no_conversation')}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12, alignItems: 'center' }}>
                        <button
                            onClick={() => setPageNum(p => Math.max(0, p - 1))}
                            disabled={pageNum === 0}
                            style={pagBtn(pageNum === 0)}
                        >←</button>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 8px' }}>
                            {pageNum + 1} / {totalPages}
                        </span>
                        <button
                            onClick={() => setPageNum(p => Math.min(totalPages - 1, p + 1))}
                            disabled={pageNum >= totalPages - 1}
                            style={pagBtn(pageNum >= totalPages - 1)}
                        >→</button>
                    </div>
                )}
            </Card>
        </div>
    );
}

const pagBtn = (disabled) => ({
    padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
});

import {
    ThumbsUp, ThumbsDown, MessageCircle, MessageSquare, ChevronRight,
    Search, Cpu, User, Bot, ExternalLink, RefreshCw, Clock, Repeat,
} from 'lucide-react';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { shortModel, fmtTime, fmtDuration } from './usage/format';
import { Card, MetricCard, MetricGrid, MonitorHero, TabHeader, AlertBanner, FilterChipBar, EmptyInline, TOKENS } from './usage/kit';
import MarkdownRenderer from '../../components/MarkdownRenderer';
import { SEMANTIC } from '../../config/analyticsConfig';
import { useTranslation } from '../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../utils/helpers';

// Trigger the action-required banner when positive feedback drops below this
// threshold on a meaningful sample.
const FEEDBACK_POSITIVE_ALERT_PCT = 60;
const FEEDBACK_MIN_SAMPLE = 5;
const PAGE_SIZE = 10;
const FEEDBACK_API = `${API_BASE}/api/feedback/org`;

// Palette (no purple/indigo) — reuse the shared semantic colours.
const C = SEMANTIC;

function parseSnapshot(raw) {
    if (!raw) return null;
    try {
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return Array.isArray(data) ? data : null;
    } catch { return null; }
}

export default function OrgFeedbackPanel({ rangeParams }) {
    const { t } = useTranslation();
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
            const filters = rangeParams?.startDate ? { startDate: rangeParams.startDate, endDate: rangeParams.endDate } : {};
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
    }, [rangeParams]);

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
    const posPct = total > 0 ? Math.round((posCount / total) * 100) : null;
    const withConvoCount = useMemo(() => feedback.filter(f => f.conversation_snapshot).length, [feedback]);

    const heroColor = posPct === null ? '#94a3b8' : posPct >= 80 ? '#10b981' : posPct >= 60 ? '#f59e0b' : '#ef4444';
    const heroLabel = posPct === null ? 'No data' : posPct >= 80 ? 'Excellent' : posPct >= 60 ? 'Watch' : 'Critical';

    const FILTER_CHIPS = [
        { value: 'all', label: t('org.feedback_chip_all') },
        { value: 'positive', label: t('org.feedback_chip_positive') },
        { value: 'negative', label: t('org.feedback_chip_negative') },
        { value: 'comments', label: t('org.feedback_chip_comments') },
        { value: 'with_convo', label: t('org.feedback_chip_with_convo') },
    ];

    const refreshBtn = (
        <button onClick={fetchData} title={t('org.feedback_refresh')} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8,
            border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--text-muted)',
        }}>
            <RefreshCw style={{ width: 13, height: 13, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: TOKENS.pagePad }}>
            <TabHeader icon={ThumbsUp} iconColor="#10b981" title={t('org.feedback_title')} description={t('org.feedback_subtitle')} actions={refreshBtn} />

            {/* Action-required banner */}
            {posPct !== null && total >= FEEDBACK_MIN_SAMPLE && posPct < FEEDBACK_POSITIVE_ALERT_PCT && (
                <AlertBanner
                    severity={posPct < 40 ? 'red' : 'amber'}
                    message={`Positive rate ${posPct}% on ${total} feedback item${total === 1 ? '' : 's'} — review negative comments.`}
                    ctaLabel="Review negatives"
                    onCta={() => { setFilter('negative'); setPageNum(0); }}
                />
            )}

            <MonitorHero
                accent={heroColor}
                eyebrow="Positive rate"
                value={posPct === null ? '—' : `${posPct}%`}
                valueColor={heroColor}
                status={{ label: heroLabel, color: heroColor }}
                subline={`${posCount} thumbs up · ${negCount} thumbs down · ${total} total`}
                aside={
                    <MetricGrid cols={2} gap={TOKENS.tileGap}>
                        <MetricCard size="sm" icon={ThumbsUp} color={C.green} label={t('org.feedback_positive')} value={posCount} />
                        <MetricCard size="sm" icon={ThumbsDown} color={C.rose} label={t('org.feedback_negative')} value={negCount} />
                        <MetricCard size="sm" icon={MessageCircle} color={C.amber} label={t('org.feedback_with_comments')} value={Number(summary?.with_comments) || 0} />
                        <MetricCard size="sm" icon={MessageSquare} color={C.blue} label={t('org.feedback_with_conversation')} value={withConvoCount} />
                    </MetricGrid>
                }
            />

            <Card>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <FilterChipBar value={filter} onChange={(v) => { setFilter(v); setPageNum(0); }} options={FILTER_CHIPS} />
                    <div style={{ flex: 1 }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                        <Search style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />
                        <input value={search} onChange={e => { setSearch(e.target.value); setPageNum(0); }} placeholder={t('org.feedback_search_placeholder')}
                            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text-primary)', width: 160 }} />
                    </div>
                </div>

                {paged.length === 0 ? (
                    <EmptyInline boxed text={loading ? t('org.feedback_loading') : t('org.feedback_empty')} />
                ) : paged.map((item, i) => {
                    const isExpanded = expanded === item.id;
                    const snapshot = parseSnapshot(item.conversation_snapshot);
                    const hasConvo = !!snapshot && snapshot.length > 0;
                    const isUp = item.rating === 'up';
                    return (
                        <div key={item.id || i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <div onClick={() => setExpanded(isExpanded ? null : item.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 2px', cursor: 'pointer', transition: 'background 0.12s' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <span style={{ fontSize: 18, width: 28, textAlign: 'center', flexShrink: 0 }}>{isUp ? '👍' : '👎'}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{item.user_id || t('org.feedback_anonymous')}</span>
                                        {item.source && <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{item.source}</span>}
                                        {(item.agent_name || item.agent_id) && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: `${C.blue}15`, color: C.blue }} title={item.agent_id || ''}>
                                                <Bot style={{ width: 9, height: 9 }} />{item.agent_name || (item.agent_id?.length > 20 ? item.agent_id.slice(0, 20) + '…' : item.agent_id)}
                                            </span>
                                        )}
                                        {item.model && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }} title={item.model}>
                                                <Cpu style={{ width: 9, height: 9 }} />{shortModel(item.model)}
                                            </span>
                                        )}
                                        {item.model_tier && <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: `${C.amber}15`, color: C.amber }} title={`tier: ${item.model_tier}`}>tier: {item.model_tier}</span>}
                                        {hasConvo && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: `${C.cyan}15`, color: C.cyan }}>
                                                <MessageSquare style={{ width: 9, height: 9 }} />{snapshot.length}
                                            </span>
                                        )}
                                    </div>
                                    {item.comment && (
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isExpanded ? 'pre-wrap' : 'nowrap', maxWidth: isExpanded ? 'none' : 500 }}>
                                            "{item.comment}"
                                        </div>
                                    )}
                                </div>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{fmtTime(item.created_at)}</span>
                                <ChevronRight style={{ width: 14, height: 14, color: 'var(--text-muted)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                            </div>

                            {isExpanded && (
                                <div style={{ padding: '10px 12px 14px 38px', background: 'var(--bg-tertiary)', borderRadius: '0 0 8px 8px' }}>
                                    <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-muted)' }}>
                                        {item.conversation_id && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><ExternalLink style={{ width: 10, height: 10 }} />Conv: {item.conversation_id.slice(0, 16)}…</span>}
                                        {item.message_id && <span>Msg: {item.message_id.slice(0, 16)}…</span>}
                                    </div>
                                    {item.comment && (
                                        <div style={{ marginBottom: 10, padding: '10px 14px', borderRadius: 10, background: isUp ? `${C.green}10` : `${C.rose}10`, border: `1px solid ${isUp ? C.green : C.rose}25` }}>
                                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4, color: isUp ? C.green : C.rose }}>{t('org.feedback_user_feedback')}</div>
                                            <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{item.comment}</div>
                                        </div>
                                    )}
                                    {hasConvo ? (
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, color: C.blue, display: 'flex', alignItems: 'center', gap: 5 }}>
                                                <MessageSquare style={{ width: 11, height: 11 }} />{t('org.feedback_conversation')} ({snapshot.length})
                                            </div>
                                            <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                {(() => {
                                                    let prevAssistantModel = null;
                                                    return snapshot.map((msg, mi) => {
                                                        const isUserMsg = msg.role === 'user';
                                                        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
                                                        if (!content || content.trim().length === 0) return null;
                                                        const truncated = content.length > 800 ? content.slice(0, 800) + '…' : content;
                                                        const duration = !isUserMsg ? fmtDuration(msg.duration_ms, { invalid: null }) : null;
                                                        const turnModel = !isUserMsg ? (msg.model || null) : null;
                                                        const switched = !isUserMsg && turnModel && prevAssistantModel && turnModel !== prevAssistantModel;
                                                        if (!isUserMsg) prevAssistantModel = turnModel || prevAssistantModel;
                                                        return (
                                                            <div key={mi} style={{ display: 'flex', justifyContent: isUserMsg ? 'flex-end' : 'flex-start' }}>
                                                                <div style={{ maxWidth: '85%', padding: '8px 12px', borderRadius: 12, background: isUserMsg ? 'var(--bg-secondary)' : 'var(--bg-primary)', border: `1px solid ${isUserMsg ? 'var(--border-subtle)' : `${C.blue}25`}` }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, flexWrap: 'wrap' }}>
                                                                        {isUserMsg ? <User style={{ width: 10, height: 10, color: 'var(--text-muted)' }} /> : <Bot style={{ width: 10, height: 10, color: C.blue }} />}
                                                                        <span style={{ fontSize: 10, fontWeight: 600, color: isUserMsg ? 'var(--text-muted)' : C.blue }}>{isUserMsg ? t('org.feedback_role_user') : t('org.feedback_role_ai')}</span>
                                                                        {turnModel && (
                                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: switched ? `${C.amber}20` : 'var(--bg-tertiary)', color: switched ? C.amber : 'var(--text-secondary)', border: switched ? `1px solid ${C.amber}40` : '1px solid transparent' }}
                                                                                title={switched ? `${t('org.feedback_model_switched')}: ${prevAssistantModel} → ${turnModel}` : turnModel}>
                                                                                {switched ? <Repeat style={{ width: 9, height: 9 }} /> : <Cpu style={{ width: 9, height: 9 }} />}{shortModel(turnModel)}
                                                                            </span>
                                                                        )}
                                                                        {duration && (
                                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }} title={t('org.feedback_response_time')}>
                                                                                <Clock style={{ width: 9, height: 9 }} />{duration}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div style={{ fontSize: 13, color: 'var(--text-primary)', wordBreak: 'break-word', lineHeight: 1.6 }} className="prose prose-sm dark:prose-invert max-w-none">
                                                                        {isUserMsg ? <span style={{ whiteSpace: 'pre-wrap' }}>{truncated}</span> : <MarkdownRenderer content={truncated} />}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ padding: 14, borderRadius: 10, textAlign: 'center', background: 'var(--bg-primary)', border: '1px dashed var(--border-subtle)' }}>
                                            <MessageSquare style={{ width: 18, height: 18, color: 'var(--text-muted)', margin: '0 auto 4px' }} />
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('org.feedback_no_conversation')}</div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12, alignItems: 'center' }}>
                        <button onClick={() => setPageNum(p => Math.max(0, p - 1))} disabled={pageNum === 0} style={pagBtn(pageNum === 0)}>←</button>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 8px' }}>{pageNum + 1} / {totalPages}</span>
                        <button onClick={() => setPageNum(p => Math.min(totalPages - 1, p + 1))} disabled={pageNum >= totalPages - 1} style={pagBtn(pageNum >= totalPages - 1)}>→</button>
                    </div>
                )}
            </Card>
        </div>
    );
}

const pagBtn = (disabled) => ({
    padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
    border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
});

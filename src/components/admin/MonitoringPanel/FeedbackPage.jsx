import React, { useState, useMemo } from 'react';
import {
    ThumbsUp, ThumbsDown, MessageCircle, ChevronRight, Search, Cpu,
    User, Bot, MessageSquare, Clock, ExternalLink
} from 'lucide-react';
import {
    COLORS, fmtTime, shortModel, MetricCard, Card, Empty
} from './shared';
import MarkdownRenderer from '../../MarkdownRenderer';

const PAGE_SIZE = 10;

function parseSnapshot(raw) {
    if (!raw) return null;
    try {
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return Array.isArray(data) ? data : null;
    } catch { return null; }
}

export function FeedbackPage({ feedback, summary }) {
    const [filter, setFilter] = useState('all'); // all | positive | negative | comments | with_convo
    const [pageNum, setPageNum] = useState(0);
    const [expanded, setExpanded] = useState(null);
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        let data = feedback;
        if (filter === 'positive') data = data.filter(f => f.rating === 'up');
        if (filter === 'negative') data = data.filter(f => f.rating === 'down');
        if (filter === 'comments') data = data.filter(f => f.comment);
        if (filter === 'with_convo') data = data.filter(f => f.conversation_snapshot);
        if (search) {
            const q = search.toLowerCase();
            data = data.filter(f =>
                f.comment?.toLowerCase().includes(q) ||
                f.agent_id?.toLowerCase().includes(q) ||
                f.user_id?.toLowerCase().includes(q) ||
                f.source?.toLowerCase().includes(q) ||
                f.conversation_id?.toLowerCase().includes(q)
            );
        }
        return data;
    }, [feedback, filter, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paged = filtered.slice(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE);

    const posCount = summary?.thumbs_up || 0;
    const negCount = summary?.thumbs_down || 0;
    const total = summary?.total || 0;
    const posRate = total > 0 ? ((posCount / total) * 100).toFixed(0) : '—';

    // Count items with conversation snapshots
    const withConvoCount = useMemo(() =>
        feedback.filter(f => f.conversation_snapshot).length
    , [feedback]);

    return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '1.25rem' }}>
                <MetricCard icon={ThumbsUp} label="Positive" color={COLORS.green}
                    value={posCount} subtitle={`${posRate}% approval`} />
                <MetricCard icon={ThumbsDown} label="Negative" color={COLORS.rose}
                    value={negCount} />
                <MetricCard icon={MessageCircle} label="With Comments" color={COLORS.purple}
                    value={summary?.with_comments || 0} />
                <MetricCard icon={MessageSquare} label="With Conversation" color={COLORS.blue}
                    value={withConvoCount} subtitle="Shared context" />
            </div>

            {/* Filter & Search */}
            <Card>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {[
                        { id: 'all', label: 'All' },
                        { id: 'positive', label: '👍 Positive' },
                        { id: 'negative', label: '👎 Negative' },
                        { id: 'comments', label: '💬 Comments' },
                        { id: 'with_convo', label: '🗨️ With Conversation' },
                    ].map(f => (
                        <button
                            key={f.id}
                            onClick={() => { setFilter(f.id); setPageNum(0); }}
                            style={{
                                padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                                background: filter === f.id ? COLORS.primary + '20' : 'var(--bg-tertiary, rgba(255,255,255,0.04))',
                                color: filter === f.id ? COLORS.primary : 'var(--text-secondary, #aaa)',
                            }}
                        >{f.label}</button>
                    ))}
                    <div style={{ flex: 1 }} />
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px',
                        borderRadius: '8px', background: 'var(--bg-primary, #0f0f1a)',
                        border: '1px solid var(--border-default, rgba(255,255,255,0.08))',
                    }}>
                        <Search style={{ width: 12, height: 12, color: 'var(--text-muted, #888)' }} />
                        <input
                            value={search} onChange={e => { setSearch(e.target.value); setPageNum(0); }}
                            placeholder="Search feedback..."
                            style={{
                                background: 'transparent', border: 'none', outline: 'none', fontSize: '12px',
                                color: 'var(--text-primary, #fff)', width: '140px',
                            }}
                        />
                    </div>
                </div>

                {/* Feedback List */}
                {paged.length === 0 ? <Empty text="No feedback entries" /> : paged.map((item, i) => {
                    const isExpanded = expanded === item.id;
                    const snapshot = parseSnapshot(item.conversation_snapshot);
                    const hasConvo = !!snapshot && snapshot.length > 0;
                    const isUp = item.rating === 'up';

                    return (
                        <div key={item.id || i} style={{ borderBottom: '1px solid var(--border-default, rgba(255,255,255,0.05))' }}>
                            <div
                                onClick={() => setExpanded(isExpanded ? null : item.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 2px',
                                    cursor: 'pointer', transition: 'background 0.12s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary, rgba(255,255,255,0.03))'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                {/* Rating icon */}
                                <span style={{
                                    fontSize: '18px', width: '28px', textAlign: 'center', flexShrink: 0,
                                }}>{isUp ? '👍' : '👎'}</span>

                                {/* Main info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary, #fff)' }}>
                                            {item.user_id || 'Anonymous'}
                                        </span>
                                        {item.source && (
                                            <span style={{
                                                padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
                                                background: 'var(--bg-tertiary, rgba(255,255,255,0.04))',
                                                color: 'var(--text-muted, #888)',
                                            }}>{item.source}</span>
                                        )}
                                        {(item.agent_name || item.agent_id) && (
                                            <span style={{
                                                display: 'flex', alignItems: 'center', gap: '3px',
                                                padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
                                                background: COLORS.blue + '15', color: COLORS.blue,
                                            }}
                                            title={item.agent_id || ''}>
                                                <Bot style={{ width: 9, height: 9 }} />
                                                {item.agent_name || (item.agent_id.length > 20 ? item.agent_id.slice(0, 20) + '…' : item.agent_id)}
                                            </span>
                                        )}
                                        {item.model && (
                                            <span style={{
                                                display: 'flex', alignItems: 'center', gap: '3px',
                                                padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
                                                background: 'var(--bg-tertiary, rgba(255,255,255,0.04))',
                                                color: 'var(--text-secondary, #aaa)',
                                            }} title={item.model}>
                                                <Cpu style={{ width: 9, height: 9 }} />
                                                {shortModel(item.model)}
                                            </span>
                                        )}
                                        {item.model_tier && (
                                            <span style={{
                                                padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
                                                background: COLORS.amber + '15', color: COLORS.amber,
                                            }}
                                            title={item.model_tier === 'auto' && item.model ? `auto → ${item.model}` : `tier: ${item.model_tier}`}>
                                                tier: {item.model_tier}{item.model_tier === 'auto' && item.model ? ` → ${shortModel(item.model)}` : ''}
                                            </span>
                                        )}
                                        {hasConvo && (
                                            <span style={{
                                                display: 'flex', alignItems: 'center', gap: '3px',
                                                padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
                                                background: COLORS.blue + '15', color: COLORS.blue,
                                            }}>
                                                <MessageSquare style={{ width: 9, height: 9 }} />
                                                {snapshot.length} msgs
                                            </span>
                                        )}
                                    </div>
                                    {item.comment && (
                                        <div style={{
                                            fontSize: '12px', color: 'var(--text-secondary, #aaa)', marginTop: '3px',
                                            overflow: 'hidden', textOverflow: 'ellipsis',
                                            whiteSpace: isExpanded ? 'pre-wrap' : 'nowrap',
                                            maxWidth: isExpanded ? 'none' : '500px',
                                        }}>
                                            "{item.comment}"
                                        </div>
                                    )}
                                </div>

                                <span style={{ fontSize: '11px', color: 'var(--text-muted, #888)', flexShrink: 0 }}>
                                    {fmtTime(item.created_at)}
                                </span>
                                <ChevronRight style={{
                                    width: 14, height: 14, color: 'var(--text-muted, #888)',
                                    transform: isExpanded ? 'rotate(90deg)' : 'none',
                                    transition: 'transform 0.2s', flexShrink: 0,
                                }} />
                            </div>

                            {/* Expanded: conversation replay */}
                            {isExpanded && (
                                <div style={{
                                    padding: '10px 12px 16px 40px',
                                    background: 'var(--bg-tertiary, rgba(255,255,255,0.02))',
                                    borderRadius: '0 0 8px 8px',
                                    animation: 'fadeIn 0.2s ease',
                                }}>
                                    {/* Meta row */}
                                    <div style={{
                                        display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap',
                                        fontSize: '11px', color: 'var(--text-muted, #888)'
                                    }}>
                                        {item.conversation_id && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <ExternalLink style={{ width: 10, height: 10 }} />
                                                Conv: {item.conversation_id.slice(0, 16)}…
                                            </span>
                                        )}
                                        {item.message_id && (
                                            <span>Msg: {item.message_id.slice(0, 16)}…</span>
                                        )}
                                        {item.organization_id && (
                                            <span>Org: {item.organization_id.slice(0, 16)}…</span>
                                        )}
                                    </div>

                                    {/* Comment */}
                                    {item.comment && (
                                        <div style={{
                                            marginBottom: '12px', padding: '10px 14px', borderRadius: '10px',
                                            background: isUp ? COLORS.green + '10' : COLORS.rose + '10',
                                            border: `1px solid ${isUp ? COLORS.green : COLORS.rose}25`,
                                        }}>
                                            <div style={{
                                                fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                                                letterSpacing: '0.04em', marginBottom: '4px',
                                                color: isUp ? COLORS.green : COLORS.rose,
                                            }}>User Feedback</div>
                                            <div style={{
                                                fontSize: '13px', color: 'var(--text-primary, #fff)',
                                                whiteSpace: 'pre-wrap', lineHeight: 1.5,
                                            }}>{item.comment}</div>
                                        </div>
                                    )}

                                    {/* Conversation Snapshot */}
                                    {hasConvo ? (
                                        <div>
                                            <div style={{
                                                fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                                                letterSpacing: '0.04em', marginBottom: '8px',
                                                color: COLORS.blue, display: 'flex', alignItems: 'center', gap: '5px',
                                            }}>
                                                <MessageSquare style={{ width: 11, height: 11 }} />
                                                Conversation ({snapshot.length} messages)
                                            </div>
                                            <div style={{
                                                maxHeight: '400px', overflowY: 'auto',
                                                display: 'flex', flexDirection: 'column', gap: '6px',
                                                padding: '2px',
                                            }}>
                                                {snapshot.map((msg, mi) => {
                                                    const isUserMsg = msg.role === 'user';
                                                    const content = typeof msg.content === 'string'
                                                        ? msg.content
                                                        : JSON.stringify(msg.content);
                                                    // Skip empty system/tool messages
                                                    if (!content || content.trim().length === 0) return null;
                                                    // Truncate very long messages
                                                    const truncated = content.length > 800
                                                        ? content.slice(0, 800) + '…'
                                                        : content;

                                                    return (
                                                        <div key={mi} style={{
                                                            display: 'flex',
                                                            justifyContent: isUserMsg ? 'flex-end' : 'flex-start',
                                                        }}>
                                                            <div style={{
                                                                maxWidth: '85%',
                                                                padding: '8px 12px', borderRadius: '12px',
                                                                background: isUserMsg
                                                                    ? 'var(--bg-secondary, #1a1a2e)'
                                                                    : 'var(--bg-primary, #0f0f1a)',
                                                                border: `1px solid ${isUserMsg
                                                                    ? 'var(--border-default, rgba(255,255,255,0.08))'
                                                                    : COLORS.primary + '20'
                                                                }`,
                                                            }}>
                                                                <div style={{
                                                                    display: 'flex', alignItems: 'center', gap: '5px',
                                                                    marginBottom: '4px',
                                                                }}>
                                                                    {isUserMsg
                                                                        ? <User style={{ width: 10, height: 10, color: 'var(--text-muted, #888)' }} />
                                                                        : <Bot style={{ width: 10, height: 10, color: COLORS.primary }} />
                                                                    }
                                                                    <span style={{
                                                                        fontSize: '10px', fontWeight: 600,
                                                                        color: isUserMsg ? 'var(--text-muted, #888)' : COLORS.primary,
                                                                    }}>
                                                                        {isUserMsg ? 'User' : 'AI'}
                                                                    </span>
                                                                    {msg.timestamp && (
                                                                        <span style={{
                                                                            fontSize: '9px', color: 'var(--text-muted, #666)',
                                                                            marginLeft: 'auto',
                                                                        }}>
                                                                            {fmtTime(msg.timestamp)}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div style={{
                                                                    fontSize: '13px',
                                                                    color: 'var(--text-primary, #fff)',
                                                                    wordBreak: 'break-word',
                                                                    lineHeight: 1.6,
                                                                }} className="prose prose-sm dark:prose-invert max-w-none">
                                                                    {isUserMsg
                                                                        ? <span style={{ whiteSpace: 'pre-wrap' }}>{truncated}</span>
                                                                        : <MarkdownRenderer content={truncated} />
                                                                    }
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{
                                            padding: '16px', borderRadius: '10px', textAlign: 'center',
                                            background: 'var(--bg-primary, #0f0f1a)',
                                            border: '1px dashed var(--border-default, rgba(255,255,255,0.08))',
                                        }}>
                                            <MessageSquare style={{ width: 20, height: 20, color: 'var(--text-muted, #555)', margin: '0 auto 6px' }} />
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted, #666)' }}>
                                                No conversation shared
                                            </div>
                                            <div style={{ fontSize: '10px', color: 'var(--text-muted, #555)', marginTop: '2px' }}>
                                                User did not include conversation context with this feedback
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '14px', alignItems: 'center' }}>
                        <button
                            onClick={() => setPageNum(p => Math.max(0, p - 1))}
                            disabled={pageNum === 0}
                            style={paginationBtn}
                        >←</button>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted, #888)', padding: '0 8px' }}>
                            {pageNum + 1} / {totalPages}
                        </span>
                        <button
                            onClick={() => setPageNum(p => Math.min(totalPages - 1, p + 1))}
                            disabled={pageNum >= totalPages - 1}
                            style={paginationBtn}
                        >→</button>
                    </div>
                )}
            </Card>
        </div>
    );
}

const paginationBtn = {
    padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
    border: '1px solid var(--border-default, rgba(255,255,255,0.1))',
    background: 'var(--bg-secondary, #1a1a2e)', color: 'var(--text-secondary, #aaa)',
    cursor: 'pointer',
};

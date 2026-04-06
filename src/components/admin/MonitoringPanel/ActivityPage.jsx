import React, { useState, useMemo } from 'react';
import {
    Clock, Search, ChevronRight, Cpu, Bot, User, Filter, Activity
} from 'lucide-react';
import {
    fmt, fmtCost, fmtDuration, fmtTime, shortModel, COLORS, MODEL_COLORS,
    Card, Empty, InOutLabel, getSourceDetails
} from './shared';

const PAGE_SIZE = 25;

export function ActivityPage({ recent, modelCosts, filterSources, filterModels }) {
    const [search, setSearch] = useState('');
    const [filterSource, setFilterSource] = useState('');
    const [filterModel, setFilterModel] = useState('');
    const [pageNum, setPageNum] = useState(0);
    const [expanded, setExpanded] = useState(null);

    const filtered = useMemo(() => {
        let data = recent;
        if (filterSource) data = data.filter(r => r.source === filterSource);
        if (filterModel) data = data.filter(r => r.model === filterModel);
        if (search) {
            const q = search.toLowerCase();
            data = data.filter(r =>
                r.source?.toLowerCase().includes(q) ||
                r.model?.toLowerCase().includes(q) ||
                r.agent_name?.toLowerCase().includes(q) ||
                r.type?.toLowerCase().includes(q)
            );
        }
        return data;
    }, [recent, filterSource, filterModel, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paged = filtered.slice(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE);

    const sourceOptions = useMemo(() => {
        const set = new Set(recent.map(r => r.source).filter(Boolean));
        return Array.from(set).sort();
    }, [recent]);

    const modelOptions = useMemo(() => {
        const set = new Set(recent.map(r => r.model).filter(Boolean));
        return Array.from(set).sort();
    }, [recent]);

    return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <Card>
                {/* Filter row */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Search */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px',
                        borderRadius: '8px', background: 'var(--bg-primary, #0f0f1a)',
                        border: '1px solid var(--border-default, rgba(255,255,255,0.08))', flex: '0 1 200px',
                    }}>
                        <Search style={{ width: 12, height: 12, color: 'var(--text-muted, #888)' }} />
                        <input
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPageNum(0); }}
                            placeholder="Search calls..."
                            style={{
                                background: 'transparent', border: 'none', outline: 'none', fontSize: '12px',
                                color: 'var(--text-primary, #fff)', width: '100%',
                            }}
                        />
                    </div>

                    {/* Source filter */}
                    <div style={filterSelectWrapper}>
                        <Activity style={{ width: 12, height: 12, color: 'var(--text-muted, #888)' }} />
                        <select
                            value={filterSource}
                            onChange={e => { setFilterSource(e.target.value); setPageNum(0); }}
                            style={filterSelectStyle}
                        >
                            <option value="">All Sources</option>
                            {sourceOptions.map(s => <option key={s} value={s}>{getSourceDetails(s).label}</option>)}
                        </select>
                    </div>

                    {/* Model filter */}
                    <div style={filterSelectWrapper}>
                        <Cpu style={{ width: 12, height: 12, color: 'var(--text-muted, #888)' }} />
                        <select
                            value={filterModel}
                            onChange={e => { setFilterModel(e.target.value); setPageNum(0); }}
                            style={filterSelectStyle}
                        >
                            <option value="">All Models</option>
                            {modelOptions.map(m => <option key={m} value={m}>{shortModel(m)}</option>)}
                        </select>
                    </div>

                    <div style={{ flex: 1 }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted, #888)' }}>
                        {filtered.length} call{filtered.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Table Header */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '110px 1fr 1fr 70px 80px 90px 70px 24px',
                    gap: '8px', padding: '8px 8px', marginBottom: '2px',
                    fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.05em', color: 'var(--text-muted, #666)',
                }}>
                    <span>Time</span>
                    <span>Source / Agent</span>
                    <span>Model</span>
                    <span style={{ textAlign: 'right' }}>Tokens</span>
                    <span style={{ textAlign: 'right' }}>Latency</span>
                    <span style={{ textAlign: 'right' }}>Cost</span>
                    <span style={{ textAlign: 'right' }}>Type</span>
                    <span></span>
                </div>

                {/* Rows */}
                {paged.length === 0 ? <Empty text="No API calls found" /> : paged.map((r, i) => {
                    const isExpanded = expanded === (r.id || i);
                    const src = getSourceDetails(r.source);

                    return (
                        <div key={r.id || i}>
                            <div
                                onClick={() => setExpanded(isExpanded ? null : (r.id || i))}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '110px 1fr 1fr 70px 80px 90px 70px 24px',
                                    gap: '8px', padding: '8px 8px', alignItems: 'center',
                                    borderRadius: '6px',
                                    background: i % 2 === 0 ? 'transparent' : 'var(--bg-tertiary, rgba(255,255,255,0.02))',
                                    cursor: 'pointer', transition: 'background 0.12s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary, rgba(255,255,255,0.05))'}
                                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'var(--bg-tertiary, rgba(255,255,255,0.02))'}
                            >
                                <span style={{ fontSize: '11px', color: 'var(--text-muted, #888)' }}>
                                    {fmtTime(r.created_at)}
                                </span>
                                <div style={{ overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <src.icon style={{ width: 12, height: 12, color: src.color, flexShrink: 0 }} />
                                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary, #fff)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {r.agent_name || src.label}
                                        </span>
                                    </div>
                                </div>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: COLORS.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {shortModel(r.model)}
                                </span>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.green, textAlign: 'right' }}>
                                    {fmt(r.total_tokens)}
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted, #888)', textAlign: 'right' }}>
                                    {fmtDuration(r.duration_ms)}
                                </span>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.amber, textAlign: 'right' }}>
                                    {fmtCost(r.estimated_cost || 0)}
                                </span>
                                <span style={{
                                    fontSize: '10px', fontWeight: 600, textAlign: 'right',
                                    padding: '2px 6px', borderRadius: '4px',
                                    background: r.type === 'chat' ? COLORS.primary + '15' : COLORS.amber + '15',
                                    color: r.type === 'chat' ? COLORS.primary : COLORS.amber,
                                }}>
                                    {r.type || '—'}
                                </span>
                                <ChevronRight style={{
                                    width: 13, height: 13, color: 'var(--text-muted, #888)',
                                    transform: isExpanded ? 'rotate(90deg)' : 'none',
                                    transition: 'transform 0.2s',
                                }} />
                            </div>

                            {/* Expanded detail */}
                            {isExpanded && (
                                <div style={{
                                    padding: '8px 16px 12px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                                    gap: '10px', background: 'var(--bg-tertiary, rgba(255,255,255,0.02))',
                                    borderRadius: '0 0 8px 8px', marginBottom: '4px',
                                    fontSize: '11px',
                                }}>
                                    <DetailItem label="Prompt Tokens" value={fmt(r.prompt_tokens)} color={COLORS.blue} />
                                    <DetailItem label="Completion Tokens" value={fmt(r.completion_tokens)} color={COLORS.amber} />
                                    <DetailItem label="Total Tokens" value={fmt(r.total_tokens)} color={COLORS.green} />
                                    <DetailItem label="Input Cost" value={fmtCost(r.input_cost || 0)} color={COLORS.blue} />
                                    <DetailItem label="Output Cost" value={fmtCost(r.output_cost || 0)} color={COLORS.amber} />
                                    <DetailItem label="Total Cost" value={fmtCost(r.estimated_cost || 0)} color={COLORS.green} />
                                    <DetailItem label="Source" value={src.label} />
                                    <DetailItem label="Model" value={r.model || 'Unknown'} />
                                    {r.conversation_id && <DetailItem label="Conversation" value={r.conversation_id.slice(0, 12) + '…'} />}
                                    {r.user_id && <DetailItem label="User" value={r.display_name || r.user_id} />}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '14px', alignItems: 'center' }}>
                        <button onClick={() => setPageNum(p => Math.max(0, p - 1))} disabled={pageNum === 0} style={paginationBtn}>←</button>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted, #888)', padding: '0 8px' }}>
                            {pageNum + 1} / {totalPages}
                        </span>
                        <button onClick={() => setPageNum(p => Math.min(totalPages - 1, p + 1))} disabled={pageNum >= totalPages - 1} style={paginationBtn}>→</button>
                    </div>
                )}
            </Card>
        </div>
    );
}

function DetailItem({ label, value, color }) {
    return (
        <div>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted, #888)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>{label}</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: color || 'var(--text-primary, #fff)', wordBreak: 'break-all' }}>{value}</div>
        </div>
    );
}

const filterSelectWrapper = {
    display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px',
    borderRadius: '8px', background: 'var(--bg-primary, #0f0f1a)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.08))',
};

const filterSelectStyle = {
    background: 'transparent', border: 'none', outline: 'none',
    fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary, #aaa)',
    cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
};

const paginationBtn = {
    padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
    border: '1px solid var(--border-default, rgba(255,255,255,0.1))',
    background: 'var(--bg-secondary, #1a1a2e)', color: 'var(--text-secondary, #aaa)',
    cursor: 'pointer',
};

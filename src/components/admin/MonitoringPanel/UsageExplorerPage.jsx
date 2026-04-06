import React, { useState, useMemo } from 'react';
import {
    Cpu, Bot, Users, MessageSquare, ChevronRight, Activity
} from 'lucide-react';
import {
    fmt, fmtCost, fmtDuration, shortModel, COLORS, MODEL_COLORS,
    Card, Empty, FilterBar, SortableTable, InOutBar, InOutLabel,
    getAgentStyle, getSourceDetails
} from './shared';

export function UsageExplorerPage({
    byModel, byAgent, byUser, byConversation, costPerModel, modelCosts,
    onSelectModel, onSelectAgent
}) {
    const [filters, setFilters] = useState({ user: null, agent: null, model: null, source: null });
    const [expandedAgent, setExpandedAgent] = useState(null);

    // Generate filter options
    const userOptions = useMemo(() => byUser.map(u => ({ value: u.user_id, label: u.display_name || u.user_id })), [byUser]);
    const agentOptions = useMemo(() => byAgent.map(a => ({ value: a.agent_name || a.agent_id, label: a.agent_name || 'Unknown' })), [byAgent]);
    const modelOptions = useMemo(() => byModel.map(m => ({ value: m.model, label: shortModel(m.model) })), [byModel]);

    // Filtered data
    const filteredModels = useMemo(() => {
        let data = byModel;
        if (filters.model) data = data.filter(m => m.model === filters.model);
        return data;
    }, [byModel, filters.model]);

    const filteredAgents = useMemo(() => {
        let data = byAgent;
        if (filters.agent) data = data.filter(a => (a.agent_name || a.agent_id) === filters.agent);
        return data;
    }, [byAgent, filters.agent]);

    const filteredUsers = useMemo(() => {
        let data = byUser;
        if (filters.user) data = data.filter(u => u.user_id === filters.user);
        return data;
    }, [byUser, filters.user]);

    const filteredConversations = useMemo(() => {
        let data = byConversation;
        if (filters.agent) data = data.filter(c => c.agent_name === filters.agent);
        if (filters.user) data = data.filter(c => c.user_id === filters.user);
        return data;
    }, [byConversation, filters.agent, filters.user]);

    // Model table columns
    const modelColumns = [
        {
            key: 'model', label: 'Model', width: '2fr', sortable: true,
            render: (row, i) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: MODEL_COLORS[i % MODEL_COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary, #fff)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.model}>
                        {shortModel(row.model)}
                    </span>
                </div>
            ),
        },
        {
            key: 'tokens_bar', label: 'In / Out', width: '1.2fr', sortable: false,
            render: row => (
                <div>
                    <InOutBar input={row.prompt_tokens} output={row.completion_tokens} height={4} style={{ maxWidth: '100px' }} />
                    <InOutLabel input={row.prompt_tokens} output={row.completion_tokens} />
                </div>
            ),
        },
        {
            key: 'total_tokens', label: 'Tokens', width: '80px', align: 'right', sortable: true,
            render: row => <span style={{ fontSize: '12px', fontWeight: 700, color: COLORS.green }}>{fmt(row.total_tokens)}</span>,
        },
        {
            key: 'calls', label: 'Calls', width: '70px', align: 'right', sortable: true,
            render: row => <span style={{ fontSize: '12px', color: 'var(--text-secondary, #aaa)' }}>{row.calls}</span>,
        },
        {
            key: 'cost', label: 'Cost', width: '80px', align: 'right', sortable: false,
            render: row => (
                <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.amber }}>
                    {fmtCost(costPerModel[row.model] || row.estimated_cost || 0)}
                </span>
            ),
        },
    ];

    // User table columns
    const userColumns = [
        {
            key: 'display_name', label: 'User', width: '1.5fr', sortable: true,
            render: (row, i) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px', fontWeight: 700, color: '#fff', flexShrink: 0,
                        background: `linear-gradient(135deg, ${MODEL_COLORS[i % MODEL_COLORS.length]}, ${MODEL_COLORS[i % MODEL_COLORS.length]}99)`,
                    }}>
                        {(row.display_name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary, #fff)' }}>{row.display_name || row.user_id}</div>
                        {row.display_name && row.user_id && row.display_name !== row.user_id && (
                            <div style={{ fontSize: '10px', color: 'var(--text-muted, #666)' }}>{row.user_id}</div>
                        )}
                    </div>
                </div>
            ),
        },
        {
            key: 'tokens_bar', label: 'In / Out', width: '1fr', sortable: false,
            render: row => (
                <InOutBar input={row.prompt_tokens} output={row.completion_tokens} height={4} style={{ maxWidth: '100px' }} />
            ),
        },
        {
            key: 'total_tokens', label: 'Tokens', width: '80px', align: 'right', sortable: true,
            render: row => <span style={{ fontSize: '12px', fontWeight: 700, color: COLORS.green }}>{fmt(row.total_tokens)}</span>,
        },
        {
            key: 'calls', label: 'Calls', width: '60px', align: 'right', sortable: true,
            render: row => <span style={{ fontSize: '12px', color: 'var(--text-secondary, #aaa)' }}>{row.calls}</span>,
        },
        {
            key: 'estimated_cost', label: 'Cost', width: '80px', align: 'right', sortable: true,
            render: row => <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.amber }}>{fmtCost(row.estimated_cost || 0)}</span>,
        },
    ];

    return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
            {/* Filter Bar */}
            <FilterBar
                filters={filters} setFilters={setFilters}
                userOptions={userOptions}
                agentOptions={agentOptions}
                modelOptions={modelOptions}
            />

            {/* By Model + By User */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '1.25rem' }}>
                <Card title="By Model" icon={Cpu}>
                    <SortableTable
                        columns={modelColumns} data={filteredModels} emptyText="No model data"
                        onRowClick={onSelectModel}
                    />
                </Card>
                <Card title="By User" icon={Users}>
                    <SortableTable
                        columns={userColumns} data={filteredUsers} emptyText="No user data"
                        onRowClick={u => setFilters(f => ({ ...f, user: f.user === u.user_id ? null : u.user_id }))}
                    />
                </Card>
            </div>

            {/* By Agent — expandable with model sub-rows */}
            <Card title="By Agent" icon={Bot} style={{ marginBottom: '1.25rem' }}>
                {filteredAgents.length === 0 ? <Empty text="No agent data" /> : filteredAgents.map((a, i) => {
                    const isExpanded = expandedAgent === (a.agent_name || a.agent_id);
                    const style = getAgentStyle(a.agent_type);

                    return (
                        <div key={i}>
                            <div
                                onClick={() => setExpandedAgent(isExpanded ? null : (a.agent_name || a.agent_id))}
                                style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '10px 2px', borderBottom: '1px solid var(--border-default, rgba(255,255,255,0.05))',
                                    cursor: 'pointer', transition: 'background 0.12s', borderRadius: '4px',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary, rgba(255,255,255,0.03))'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                    <span style={{
                                        padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700,
                                        background: style.bg, color: style.text, flexShrink: 0,
                                    }}>{a.agent_type || 'chat'}</span>
                                    <span style={{
                                        fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #fff)',
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>{a.agent_name || a.agent_id || 'Unknown'}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted, #888)' }}>
                                        {fmtDuration(a.avg_duration_ms)} avg
                                    </span>
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.green }}>
                                        {fmt(a.total_tokens)}
                                    </span>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted, #888)' }}>
                                        {a.calls} calls
                                    </span>
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.amber, minWidth: '50px', textAlign: 'right' }}>
                                        {fmtCost(a.estimated_cost || 0)}
                                    </span>
                                    <ChevronRight style={{
                                        width: 14, height: 14, color: 'var(--text-muted, #888)',
                                        transform: isExpanded ? 'rotate(90deg)' : 'none',
                                        transition: 'transform 0.2s',
                                    }} />
                                </div>
                            </div>
                            {/* Expanded sub-models */}
                            {isExpanded && (a.models || []).length > 0 && (
                                <div style={{
                                    padding: '4px 0 8px 32px',
                                    background: 'var(--bg-tertiary, rgba(255,255,255,0.02))',
                                    borderRadius: '0 0 8px 8px',
                                }}>
                                    {a.models.map((m, mi) => (
                                        <div key={mi} style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '6px 8px', fontSize: '11px', borderBottom: '1px solid var(--border-default, rgba(255,255,255,0.03))',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Cpu style={{ width: 11, height: 11, color: MODEL_COLORS[mi % MODEL_COLORS.length] }} />
                                                <span style={{ fontWeight: 600, color: 'var(--text-primary, #fff)' }}>{shortModel(m.model)}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                <span style={{ color: COLORS.green, fontWeight: 600 }}>{fmt(m.total_tokens)}</span>
                                                <span style={{ color: 'var(--text-muted, #888)' }}>{m.calls} calls</span>
                                                <span style={{ color: COLORS.amber, fontWeight: 600 }}>{fmtCost(m.estimated_cost || 0)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </Card>

            {/* By Conversation */}
            {filteredConversations.length > 0 && (
                <Card title="Conversations" icon={MessageSquare}>
                    <SortableTable
                        columns={[
                            {
                                key: 'agent_name', label: 'Agent', width: '1.5fr', sortable: true,
                                render: row => (
                                    <div>
                                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary, #fff)' }}>
                                            {row.agent_name || 'Direct Chat'}
                                        </div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-muted, #666)', fontFamily: 'monospace' }}>
                                            {row.conversation_id?.slice(0, 8)}…
                                        </div>
                                    </div>
                                ),
                            },
                            { key: 'calls', label: 'Calls', width: '70px', align: 'right', sortable: true,
                              render: row => <span style={{ fontSize: '12px', color: 'var(--text-secondary, #aaa)' }}>{row.calls}</span> },
                            { key: 'total_tokens', label: 'Tokens', width: '80px', align: 'right', sortable: true,
                              render: row => <span style={{ fontSize: '12px', fontWeight: 700, color: COLORS.green }}>{fmt(row.total_tokens)}</span> },
                            { key: 'estimated_cost', label: 'Cost', width: '80px', align: 'right', sortable: true,
                              render: row => <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.amber }}>{fmtCost(row.estimated_cost || 0)}</span> },
                            {
                                key: 'models_used', label: 'Models', width: '1.2fr', sortable: false,
                                render: row => (
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                        {(row.models_used || '').split(',').filter(Boolean).slice(0, 3).map((m, j) => (
                                            <span key={j} style={{
                                                padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
                                                background: 'var(--bg-tertiary, rgba(255,255,255,0.04))',
                                                color: MODEL_COLORS[j % MODEL_COLORS.length],
                                            }}>{shortModel(m.trim())}</span>
                                        ))}
                                    </div>
                                ),
                            },
                        ]}
                        data={filteredConversations}
                        emptyText="No conversation data"
                        maxRows={20}
                    />
                </Card>
            )}
        </div>
    );
}

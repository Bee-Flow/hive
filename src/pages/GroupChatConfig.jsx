import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, GripVertical, Users, Save, Sparkles } from 'lucide-react';

import { API_BASE, authFetch } from '../utils/helpers';

export default function GroupChatConfig({ onBack, groupChatId = null, onSaved }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [avatar, setAvatar] = useState('🗣️');
    const [participantIds, setParticipantIds] = useState([]);
    const [availableAgents, setAvailableAgents] = useState([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    // Load available agents
    useEffect(() => {
        const load = async () => {
            try {
                const res = await authFetch(`${API_BASE}/agents/published`);
                if (res.ok) {
                    const agents = await res.json();
                    // Filter out group chats (only show regular agents as participants)
                    setAvailableAgents(agents.filter(a => a._type !== 'roundtable'));
                }

                // If editing, load existing group chat
                if (groupChatId) {
                    const gcRes = await authFetch(`${API_BASE}/group-chats/${groupChatId}`);
                    if (gcRes.ok) {
                        const gc = await gcRes.json();
                        setName(gc.name);
                        setDescription(gc.description || '');
                        setAvatar(gc.avatar || '🗣️');
                        setParticipantIds(gc.participantIds || []);
                    }
                }
            } catch (e) {
                console.error('Failed to load:', e);
            }
            setLoading(false);
        };
        load();
    }, [groupChatId]);

    const handleSave = async () => {
        if (!name.trim() || participantIds.length < 2) return;
        setSaving(true);

        try {
            const body = { name, description, avatar, participantIds };
            const url = groupChatId
                ? `${API_BASE}/group-chats/${groupChatId}`
                : `${API_BASE}/group-chats`;
            const method = groupChatId ? 'PUT' : 'POST';

            const res = await authFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                const saved = await res.json();
                onSaved?.(saved);
            }
        } catch (e) {
            console.error('Save failed:', e);
        }
        setSaving(false);
    };

    const handleDelete = async () => {
        if (!groupChatId) return;
        if (!confirm('Delete this round table?')) return;
        try {
            await authFetch(`${API_BASE}/group-chats/${groupChatId}`, {
                method: 'DELETE',
            });
            onBack?.();
        } catch (e) {
            console.error('Delete failed:', e);
        }
    };

    const toggleParticipant = (agentId) => {
        setParticipantIds(prev =>
            prev.includes(agentId)
                ? prev.filter(id => id !== agentId)
                : [...prev, agentId]
        );
    };

    const moveParticipant = (index, direction) => {
        const newIds = [...participantIds];
        const swapIdx = index + direction;
        if (swapIdx < 0 || swapIdx >= newIds.length) return;
        [newIds[index], newIds[swapIdx]] = [newIds[swapIdx], newIds[index]];
        setParticipantIds(newIds);
    };

    if (loading) {
        return (
            <div style={styles.page}>
                <div style={styles.center}>Loading...</div>
            </div>
        );
    }

    const selectedAgents = participantIds.map(id => availableAgents.find(a => a.id === id)).filter(Boolean);

    return (
        <div style={styles.page}>
            {/* Header */}
            <div style={styles.header}>
                {onBack && (
                    <button onClick={onBack} style={styles.backBtn}>
                        <ArrowLeft style={{ width: 16, height: 16 }} /> Back
                    </button>
                )}
                <h1 style={styles.title}>
                    <Users style={{ width: 22, height: 22 }} />
                    {groupChatId ? 'Edit Round Table' : 'New Round Table'}
                </h1>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {groupChatId && (
                        <button onClick={handleDelete} style={styles.deleteBtn}>
                            <Trash2 style={{ width: 14, height: 14 }} /> Delete
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving || !name.trim() || participantIds.length < 2}
                        style={{
                            ...styles.saveBtn,
                            opacity: (!name.trim() || participantIds.length < 2) ? 0.5 : 1
                        }}
                    >
                        <Save style={{ width: 14, height: 14 }} />
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>

            {/* Basic Info */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>Basic Info</h2>
                <div style={styles.row}>
                    <div style={{ ...styles.field, flex: '0 0 80px' }}>
                        <label style={styles.label}>Avatar</label>
                        <input
                            style={{ ...styles.input, textAlign: 'center', fontSize: '24px' }}
                            value={avatar}
                            onChange={e => setAvatar(e.target.value)}
                            maxLength={4}
                        />
                    </div>
                    <div style={{ ...styles.field, flex: 1 }}>
                        <label style={styles.label}>Name</label>
                        <input
                            style={styles.input}
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. Strategy Roundtable"
                        />
                    </div>
                </div>
                <div style={styles.field}>
                    <label style={styles.label}>Description</label>
                    <input
                        style={styles.input}
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="A round-table discussion with multiple AI agents"
                    />
                </div>
            </div>

            {/* Turn Order Preview */}
            {selectedAgents.length > 0 && (
                <div style={styles.section}>
                    <h2 style={styles.sectionTitle}>
                        <Sparkles style={{ width: 16, height: 16, color: 'var(--accent-primary)' }} />
                        Conversation Order
                    </h2>
                    <p style={styles.sectionDesc}>
                        Agents respond in this order. The first agent <strong>leads</strong> the discussion.
                    </p>
                    <div style={styles.orderList}>
                        {selectedAgents.map((agent, idx) => (
                            <div key={agent.id} style={styles.orderItem}>
                                <div style={{ ...styles.orderIndex, background: idx === 0 ? '#f59e0b' : 'var(--accent-primary)' }}>
                                    {idx === 0 ? '👑' : idx + 1}
                                </div>
                                <div style={styles.orderAvatar}>
                                    {agent.avatar || agent.name?.[0]?.toUpperCase()}
                                </div>
                                <span style={styles.orderName}>{agent.name}</span>
                                <div style={styles.orderActions}>
                                    <button
                                        onClick={() => moveParticipant(idx, -1)}
                                        disabled={idx === 0}
                                        style={{ ...styles.moveBtn, opacity: idx === 0 ? 0.3 : 1 }}
                                    >↑</button>
                                    <button
                                        onClick={() => moveParticipant(idx, 1)}
                                        disabled={idx === selectedAgents.length - 1}
                                        style={{ ...styles.moveBtn, opacity: idx === selectedAgents.length - 1 ? 0.3 : 1 }}
                                    >↓</button>
                                    <button
                                        onClick={() => toggleParticipant(agent.id)}
                                        style={styles.removeBtn}
                                    >×</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Flow visualization */}
                    <div style={styles.flowViz}>
                        <div style={styles.flowNode}>👤 You</div>
                        {selectedAgents.map((agent, idx) => (
                            <React.Fragment key={agent.id}>
                                <span style={styles.flowArrow}>→</span>
                                <div style={styles.flowNode}>
                                    {agent.avatar || agent.name?.[0]?.toUpperCase()} {agent.name}
                                </div>
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            )}

            {/* Agent Picker */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>
                    Select Agents ({participantIds.length} selected, min 2)
                </h2>
                <div style={styles.agentGrid}>
                    {availableAgents.map(agent => {
                        const isSelected = participantIds.includes(agent.id);
                        return (
                            <button
                                key={agent.id}
                                onClick={() => toggleParticipant(agent.id)}
                                style={{
                                    ...styles.agentCard,
                                    borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-default)',
                                    background: isSelected ? 'var(--accent-primary)10' : 'var(--bg-primary)'
                                }}
                            >
                                <div style={styles.agentCardAvatar}>
                                    {agent.avatar || agent.name?.[0]?.toUpperCase()}
                                </div>
                                <div style={styles.agentCardInfo}>
                                    <div style={styles.agentCardName}>{agent.name}</div>
                                    <div style={styles.agentCardDesc}>
                                        {agent.description?.slice(0, 60) || 'AI Agent'}
                                    </div>
                                </div>
                                {isSelected && (
                                    <div style={styles.checkBadge}>✓</div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

const styles = {
    page: {
        maxWidth: '900px',
        margin: '0 auto',
        padding: '24px',
        color: 'var(--text-primary)',
        fontFamily: 'Inter, system-ui, sans-serif'
    },
    center: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '40vh',
        color: 'var(--text-secondary)',
        fontSize: '14px'
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '24px'
    },
    title: {
        flex: 1,
        fontSize: '20px',
        fontWeight: 700,
        margin: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
    },
    backBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-default)',
        color: 'var(--text-secondary)',
        padding: '6px 14px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '13px'
    },
    saveBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: 'var(--accent-primary)',
        border: 'none',
        color: '#fff',
        padding: '8px 20px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 600,
        fontSize: '13px'
    },
    deleteBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: '#ef4444',
        border: 'none',
        color: '#fff',
        padding: '8px 16px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '13px'
    },
    section: {
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px'
    },
    sectionTitle: {
        fontSize: '15px',
        fontWeight: 600,
        margin: '0 0 14px 0',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    },
    sectionDesc: {
        fontSize: '13px',
        color: 'var(--text-secondary)',
        margin: '-8px 0 14px 0'
    },
    row: {
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap'
    },
    field: {
        marginBottom: '12px'
    },
    label: {
        display: 'block',
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--text-secondary)',
        marginBottom: '4px',
        textTransform: 'uppercase',
        letterSpacing: '0.04em'
    },
    input: {
        width: '100%',
        padding: '8px 12px',
        borderRadius: '8px',
        border: '1px solid var(--border-default)',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        fontSize: '14px',
        boxSizing: 'border-box'
    },
    // Order list
    orderList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        marginBottom: '16px'
    },
    orderItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        borderRadius: '10px',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-subtle)',
        transition: 'all 0.15s'
    },
    orderIndex: {
        width: '22px',
        height: '22px',
        borderRadius: '50%',
        background: 'var(--accent-primary)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '11px',
        fontWeight: 700,
        flexShrink: 0
    },
    orderAvatar: {
        width: '28px',
        height: '28px',
        borderRadius: '8px',
        background: 'var(--bg-tertiary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px',
        border: '1px solid var(--border-subtle)',
        flexShrink: 0
    },
    orderName: {
        flex: 1,
        fontSize: '13px',
        fontWeight: 500
    },
    orderActions: {
        display: 'flex',
        gap: '4px'
    },
    moveBtn: {
        width: '24px',
        height: '24px',
        border: '1px solid var(--border-default)',
        borderRadius: '6px',
        background: 'var(--bg-secondary)',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px'
    },
    removeBtn: {
        width: '24px',
        height: '24px',
        border: '1px solid #ef444440',
        borderRadius: '6px',
        background: '#ef444410',
        color: '#ef4444',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px',
        fontWeight: 700
    },
    // Flow viz
    flowViz: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexWrap: 'wrap',
        padding: '12px 16px',
        background: 'var(--bg-primary)',
        borderRadius: '10px',
        border: '1px solid var(--border-subtle)'
    },
    flowNode: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: '8px',
        border: '1px solid var(--border-default)',
        fontSize: '12px',
        fontWeight: 500,
        background: 'var(--bg-secondary)',
        whiteSpace: 'nowrap'
    },
    flowArrow: {
        fontSize: '16px',
        color: 'var(--text-tertiary)',
        fontWeight: 300
    },
    // Agent picker grid
    agentGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: '10px'
    },
    agentCard: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px',
        borderRadius: '10px',
        border: '2px solid',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s',
        position: 'relative'
    },
    agentCardAvatar: {
        width: '36px',
        height: '36px',
        borderRadius: '10px',
        background: 'var(--bg-tertiary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '18px',
        border: '1px solid var(--border-subtle)',
        flexShrink: 0
    },
    agentCardInfo: {
        flex: 1,
        minWidth: 0
    },
    agentCardName: {
        fontSize: '13px',
        fontWeight: 600,
        marginBottom: '2px'
    },
    agentCardDesc: {
        fontSize: '11px',
        color: 'var(--text-secondary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    },
    checkBadge: {
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        background: 'var(--accent-primary)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '11px',
        fontWeight: 700,
        flexShrink: 0
    }
};

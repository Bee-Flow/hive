import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Users, ArrowLeft, Sparkles, Copy } from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';

/**
 * Round the Table Manager — sidebar list + edit panel for admin dashboard.
 * Configures multi-agent round-table discussions with a lead agent.
 */
export default function GroupChatManager({ onBack }) {
    const [groups, setGroups] = useState([]);
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [availableAgents, setAvailableAgents] = useState([]);

    useEffect(() => {
        Promise.all([
            authFetch(`${API_BASE}/group-chats`).then(r => r.json()),
            authFetch(`${API_BASE}/agents/published`).then(r => r.json())
        ]).then(([gcData, agentsData]) => {
            setGroups(Array.isArray(gcData) ? gcData : []);
            setAvailableAgents(
                (Array.isArray(agentsData) ? agentsData : []).filter(a => a._type !== 'roundtable')
            );
            setLoading(false);
        }).catch(err => { console.error(err); setLoading(false); });
    }, []);

    const selectGroup = (gc) => {
        if (dirty && !confirm('Discard unsaved changes?')) return;
        setSelected(JSON.parse(JSON.stringify(gc)));
        setDirty(false);
        setIsCreating(false);
    };

    const updateField = (field, value) => {
        setSelected(prev => ({ ...prev, [field]: value }));
        setDirty(true);
    };

    const toggleParticipant = (agentId) => {
        setSelected(prev => {
            const ids = prev.participantIds || [];
            const next = ids.includes(agentId)
                ? ids.filter(id => id !== agentId)
                : [...ids, agentId];
            return { ...prev, participantIds: next };
        });
        setDirty(true);
    };

    const moveParticipant = (index, direction) => {
        setSelected(prev => {
            const ids = [...(prev.participantIds || [])];
            const swapIdx = index + direction;
            if (swapIdx < 0 || swapIdx >= ids.length) return prev;
            [ids[index], ids[swapIdx]] = [ids[swapIdx], ids[index]];
            return { ...prev, participantIds: ids };
        });
        setDirty(true);
    };

    const saveGroup = async () => {
        if (!selected || !selected.name?.trim()) return;
        setSaving(true);
        try {
            const isNew = isCreating;
            const url = isNew ? `${API_BASE}/group-chats` : `${API_BASE}/group-chats/${selected.id}`;
            const method = isNew ? 'POST' : 'PUT';
            const res = await authFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(selected)
            });
            const saved = await res.json();
            setGroups(prev => {
                const idx = prev.findIndex(g => g.id === saved.id);
                if (idx >= 0) return prev.map(g => g.id === saved.id ? saved : g);
                return [...prev, saved];
            });
            setSelected(JSON.parse(JSON.stringify(saved)));
            setDirty(false);
            setIsCreating(false);
        } catch (err) { console.error('Save error:', err); }
        setSaving(false);
    };

    const deleteGroup = async (id) => {
        if (!confirm('Delete this round table?')) return;
        try {
            await authFetch(`${API_BASE}/group-chats/${id}`, { method: 'DELETE' });
            setGroups(prev => prev.filter(g => g.id !== id));
            if (selected?.id === id) { setSelected(null); setIsCreating(false); }
        } catch (err) { console.error('Delete error:', err); }
    };

    const duplicateGroup = (gc) => {
        if (dirty && !confirm('Discard unsaved changes?')) return;
        const clone = JSON.parse(JSON.stringify(gc));
        delete clone.id;
        clone.name = `${clone.name} (Copy)`;
        setSelected(clone);
        setIsCreating(true);
        setDirty(true);
    };

    const createGroup = () => {
        if (dirty && !confirm('Discard unsaved changes?')) return;
        setIsCreating(true);
        setSelected({
            name: '',
            description: '',
            avatar: '🗣️',
            participantIds: []
        });
        setDirty(true);
    };

    const selectedAgents = (selected?.participantIds || [])
        .map(id => availableAgents.find(a => a.id === id))
        .filter(Boolean);

    return (
        <div className="h-full flex flex-col p-6" style={{ background: 'var(--bg-primary)' }}>
            <div className="flex-1 flex overflow-hidden border rounded-xl shadow-sm"
                style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>

                {/* Sidebar */}
                <div className="w-64 border-r flex flex-col flex-shrink-0"
                    style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
                    <div className="p-4 border-b flex items-center justify-between"
                        style={{ borderColor: 'var(--border-default)' }}>
                        <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Round Tables</span>
                        <button onClick={createGroup} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                            title="Create Round Table" style={{ color: 'var(--accent-primary)' }}>
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {loading ? (
                            <div className="p-8 text-center text-muted text-sm">Loading...</div>
                        ) : groups.length === 0 ? (
                            <div className="p-8 text-center text-muted text-sm flex flex-col items-center">
                                <span className="text-2xl mb-2">🗣️</span>
                                <p className="mb-3">No round tables yet</p>
                                <button onClick={createGroup} className="btn-primary text-xs py-1.5">Create First Round Table</button>
                            </div>
                        ) : (
                            <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                                {groups.map(gc => (
                                    <div key={gc.id} onClick={() => selectGroup(gc)}
                                        className={`group p-4 cursor-pointer transition-all hover:bg-white/5 relative border-l-2 ${selected?.id === gc.id && !isCreating
                                            ? 'bg-white/5 border-[var(--accent-primary)]'
                                            : 'border-transparent'
                                            }`}>
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">{gc.avatar || '🗣️'}</span>
                                                <span className={`font-medium text-sm truncate ${selected?.id === gc.id && !isCreating
                                                    ? 'text-[var(--accent-primary)]'
                                                    : 'text-[var(--text-primary)]'
                                                    }`}>{gc.name}</span>
                                            </div>
                                            <div className="flex items-center gap-0.5">
                                                <button onClick={(e) => { e.stopPropagation(); duplicateGroup(gc); }}
                                                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-blue-400 transition-all"
                                                    title="Duplicate">
                                                    <Copy className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); deleteGroup(gc.id); }}
                                                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                                                    title="Delete">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="text-xs text-muted truncate">
                                            {gc.participantIds?.length || 0} agents
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Editor */}
                <div className="flex-1 flex overflow-hidden relative">
                    {selected ? (
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                            <div className="max-w-3xl mx-auto space-y-6">
                                {/* Header */}
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                        {isCreating ? 'Create Round Table' : 'Edit Round Table'}
                                    </h2>
                                    <button onClick={saveGroup}
                                        disabled={saving || !selected.name?.trim() || (selected.participantIds?.length || 0) < 2}
                                        className="btn-primary px-6 shadow-lg shadow-emerald-500/20">
                                        {saving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>

                                {/* Basic Info */}
                                <div className="p-5 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                                    <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Basic Info</h3>
                                    <div className="flex gap-3 mb-4">
                                        <div className="w-20">
                                            <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Avatar</label>
                                            <input type="text" value={selected.avatar || '🗣️'}
                                                onChange={(e) => updateField('avatar', e.target.value)}
                                                className="input w-full py-3 text-center text-2xl" maxLength={4} />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Name</label>
                                            <input type="text" value={selected.name}
                                                onChange={(e) => updateField('name', e.target.value)}
                                                className="input w-full px-4 py-3" placeholder="e.g. Strategy Roundtable" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Description</label>
                                        <input type="text" value={selected.description || ''}
                                            onChange={(e) => updateField('description', e.target.value)}
                                            className="input w-full px-4 py-3 text-sm" placeholder="A group conversation with multiple AI agents" />
                                    </div>
                                </div>

                                {/* Turn Order */}
                                {selectedAgents.length > 0 && (
                                    <div className="p-5 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                                        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                            <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" />
                                            Conversation Order
                                        </h3>
                                        <p className="text-xs text-muted mb-3">Agents respond in this order. The first agent <strong>leads</strong> the discussion.</p>
                                        <div className="space-y-1.5 mb-3">
                                            {selectedAgents.map((agent, idx) => (
                                                <div key={agent.id} className="flex items-center gap-2 p-2 rounded-lg"
                                                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                                                    <span className={`w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${idx === 0 ? 'bg-amber-500' : 'bg-[var(--accent-primary)]'}`}>
                                                        {idx === 0 ? '👑' : idx + 1}
                                                    </span>
                                                    <span className="text-sm">{agent.avatar || agent.name?.[0]?.toUpperCase()}</span>
                                                    <span className="text-sm font-medium flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{agent.name}</span>
                                                    {idx === 0 && <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">Lead</span>}
                                                    <div className="flex gap-1">
                                                        <button onClick={() => moveParticipant(idx, -1)} disabled={idx === 0}
                                                            className="w-6 h-6 rounded text-xs border flex items-center justify-center"
                                                            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', opacity: idx === 0 ? 0.3 : 1 }}>↑</button>
                                                        <button onClick={() => moveParticipant(idx, 1)} disabled={idx === selectedAgents.length - 1}
                                                            className="w-6 h-6 rounded text-xs border flex items-center justify-center"
                                                            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', opacity: idx === selectedAgents.length - 1 ? 0.3 : 1 }}>↓</button>
                                                        <button onClick={() => toggleParticipant(agent.id)}
                                                            className="w-6 h-6 rounded text-xs border flex items-center justify-center text-red-400 border-red-500/20 hover:bg-red-500/10">×</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {/* Flow */}
                                        <div className="flex items-center gap-2 flex-wrap p-3 rounded-lg"
                                            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                                            <span className="px-2 py-1 rounded text-xs font-medium border"
                                                style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>👤 You</span>
                                            {selectedAgents.map((agent) => (
                                                <React.Fragment key={agent.id}>
                                                    <span className="text-muted text-sm">→</span>
                                                    <span className="px-2 py-1 rounded text-xs font-medium border"
                                                        style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
                                                        {agent.avatar || agent.name?.[0]} {agent.name}
                                                    </span>
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Agent Picker */}
                                <div className="p-5 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                                    <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                                        Select Agents ({selected.participantIds?.length || 0} selected, min 2)
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {availableAgents.map(agent => {
                                            const isSelected = (selected.participantIds || []).includes(agent.id);
                                            return (
                                                <button key={agent.id} onClick={() => toggleParticipant(agent.id)}
                                                    className="flex items-center gap-3 p-3 rounded-xl text-left transition-all border-2"
                                                    style={{
                                                        borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-default)',
                                                        background: isSelected ? 'rgba(99, 102, 241, 0.06)' : 'var(--bg-primary)'
                                                    }}>
                                                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                                                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                                                        {agent.avatar || agent.name?.[0]?.toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{agent.name}</div>
                                                        <div className="text-[11px] text-muted truncate">{agent.description?.slice(0, 60) || 'AI Agent'}</div>
                                                    </div>
                                                    {isSelected && (
                                                        <div className="w-5 h-5 rounded-full bg-[var(--accent-primary)] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">✓</div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center bg-[var(--bg-primary)]">
                            <div className="text-center">
                                <div className="text-6xl mb-4">🗣️</div>
                                <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Round the Table</h2>
                                <p className="text-sm text-muted max-w-md mx-auto mb-6">
                                    Create round-table discussions where multiple AI agents debate and discuss topics with one agent leading the conversation.
                                </p>
                                <button onClick={createGroup} className="btn-primary px-6 shadow-lg">
                                    <Plus className="w-4 h-4 mr-2 inline" />Create Round Table
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, Plus, X, Trash2, Edit2, Check, ChevronDown, ChevronUp, Users, Lock, Zap, Search } from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';

/* ─── Icon picker options ─────────────────────────────────────────── */
const ICONS = ['⚡', '🎯', '📝', '📧', '📊', '🔍', '💡', '🚀', '🎨', '🤝', '📋', '🏆', '🔧', '⚙️', '🌟', '💬', '📞', '🖊️', '🗂️', '🔑'];

/* ─── Field limit ─────────────────────────────────────────────────── */
const INSTRUCTION_LIMIT = 4000;

/* ─── Empty form state ────────────────────────────────────────────── */
const emptyForm = () => ({
    name: '',
    description: '',
    instructions: '',
    workflow: '',
    rules: '',
    examples: '',
    icon: '⚡',
    isShared: false,
});

/* ─── Char counter ────────────────────────────────────────────────── */
function CharCount({ value, limit }) {
    const remaining = limit - (value?.length || 0);
    const pct = (value?.length || 0) / limit;
    return (
        <span style={{
            fontSize: 11,
            color: pct > 0.9 ? '#ef4444' : pct > 0.75 ? '#f59e0b' : 'var(--text-tertiary)',
            fontVariantNumeric: 'tabular-nums',
        }}>
            {remaining} left
        </span>
    );
}

/* ─── Skill Card ──────────────────────────────────────────────────── */
function SkillCard({ skill, isOwner, isActive, onToggle, onEdit, onDelete }) {
    const [expanded, setExpanded] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    return (
        <div style={{
            borderRadius: 16,
            border: `1.5px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
            background: isActive ? 'var(--bg-secondary)' : 'var(--bg-primary)',
            transition: 'all .2s ease',
            overflow: 'hidden',
            boxShadow: isActive ? '0 0 0 3px rgba(245,158,11,.12)' : 'none',
        }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
                {/* Icon */}
                <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: isActive ? 'rgba(245,158,11,.15)' : 'var(--bg-tertiary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, flexShrink: 0,
                    transition: 'background .2s',
                }}>
                    {skill.icon}
                </div>

                {/* Name + meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                            {skill.name}
                        </span>
                        {skill.isShared ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(59,130,246,.1)', color: '#3b82f6' }}>
                                <Users size={9} /> shared
                            </span>
                        ) : (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
                                <Lock size={9} /> private
                            </span>
                        )}
                    </div>
                    {skill.description && (
                        <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                            {skill.description}
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {/* Expand details */}
                    <button
                        onClick={() => setExpanded(v => !v)}
                        title="Show details"
                        style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}
                    >
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {isOwner && (
                        <>
                            <button
                                onClick={() => onEdit(skill)}
                                title="Edit skill"
                                style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}
                            >
                                <Edit2 size={13} />
                            </button>
                            {confirmDelete ? (
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <button onClick={() => onDelete(skill.id)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Delete</button>
                                    <button onClick={() => setConfirmDelete(false)} style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>Cancel</button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setConfirmDelete(true)}
                                    title="Delete skill"
                                    style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}
                                >
                                    <Trash2 size={13} />
                                </button>
                            )}
                        </>
                    )}

                    {/* Activate toggle */}
                    <button
                        onClick={() => onToggle(skill.id)}
                        title={isActive ? 'Deactivate skill' : 'Activate skill'}
                        style={{
                            height: 28, padding: '0 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                            background: isActive ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                            color: isActive ? '#fff' : 'var(--text-secondary)',
                            fontSize: 12, fontWeight: 600,
                            transition: 'all .15s ease',
                            display: 'flex', alignItems: 'center', gap: 5,
                        }}
                    >
                        {isActive ? <><Check size={11} /> Active</> : 'Use'}
                    </button>
                </div>
            </div>

            {/* Expanded detail */}
            {expanded && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {skill.instructions && <FieldPreview label="Instructions" value={skill.instructions} />}
                    {skill.workflow && <FieldPreview label="Workflow" value={skill.workflow} />}
                    {skill.rules && <FieldPreview label="Rules" value={skill.rules} />}
                    {skill.examples && <FieldPreview label="Examples" value={skill.examples} />}
                </div>
            )}
        </div>
    );
}

function FieldPreview({ label, value }) {
    return (
        <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{label}</div>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{value}</p>
        </div>
    );
}

/* ─── Skill Form Modal ────────────────────────────────────────────── */
function SkillFormModal({ skill, onSave, onCancel, saving }) {
    const [form, setForm] = useState(skill ? {
        name: skill.name || '',
        description: skill.description || '',
        instructions: skill.instructions || '',
        workflow: skill.workflow || '',
        rules: skill.rules || '',
        examples: skill.examples || '',
        icon: skill.icon || '⚡',
        isShared: skill.isShared ?? false,
    } : emptyForm());
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [activeTab, setActiveTab] = useState('instructions');

    const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const tabs = [
        { id: 'instructions', label: 'Instructions' },
        { id: 'workflow', label: 'Workflow' },
        { id: 'rules', label: 'Rules' },
        { id: 'examples', label: 'Examples' },
    ];

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
        }}
            onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
        >
            <div style={{
                background: 'var(--bg-secondary)',
                borderRadius: 20, border: '1px solid var(--border-subtle)',
                boxShadow: '0 32px 80px rgba(0,0,0,.25)',
                width: '100%', maxWidth: 580, maxHeight: '90vh',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
                animation: 'skillModalIn .18s cubic-bezier(.21,1.02,.73,1) both',
            }}>
                {/* Title bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                    {/* Icon selector */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowIconPicker(v => !v)}
                            title="Choose icon"
                            style={{
                                width: 44, height: 44, borderRadius: 12,
                                border: '1.5px solid var(--border-default)',
                                background: 'var(--bg-tertiary)', fontSize: 22, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            {form.icon}
                        </button>
                        {showIconPicker && (
                            <div style={{
                                position: 'absolute', top: 50, left: 0, zIndex: 10,
                                background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                                borderRadius: 12, padding: 10, boxShadow: '0 8px 32px rgba(0,0,0,.2)',
                                display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, width: 180,
                            }}>
                                {ICONS.map(ic => (
                                    <button key={ic} onClick={() => { setField('icon', ic); setShowIconPicker(false); }}
                                        style={{
                                            width: 32, height: 32, borderRadius: 8, border: 'none', background: form.icon === ic ? 'rgba(245,158,11,.15)' : 'transparent',
                                            fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                        {ic}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{ flex: 1 }}>
                        <input
                            value={form.name}
                            onChange={e => setField('name', e.target.value)}
                            placeholder="Skill name (e.g. meeting-summary)"
                            autoFocus
                            style={{
                                width: '100%', fontSize: 16, fontWeight: 700,
                                border: 'none', background: 'transparent', outline: 'none',
                                color: 'var(--text-primary)',
                            }}
                        />
                        <input
                            value={form.description}
                            onChange={e => setField('description', e.target.value)}
                            placeholder="Short description..."
                            style={{
                                width: '100%', fontSize: 13, marginTop: 2,
                                border: 'none', background: 'transparent', outline: 'none',
                                color: 'var(--text-secondary)',
                            }}
                        />
                    </div>
                    <button onClick={onCancel} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--bg-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0 }}>
                        <X size={16} />
                    </button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', padding: '0 24px', flexShrink: 0 }}>
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            style={{
                                padding: '10px 14px', fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 400,
                                color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                border: 'none', background: 'transparent', cursor: 'pointer',
                                borderBottom: `2px solid ${activeTab === tab.id ? 'var(--accent-primary)' : 'transparent'}`,
                                transition: 'all .15s', marginBottom: -1,
                            }}>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Active tab content */}
                <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                            {activeTab === 'instructions' && 'What should the AI do? Be specific and detailed.'}
                            {activeTab === 'workflow' && 'Step-by-step process to follow.'}
                            {activeTab === 'rules' && 'Tone, format rules, dos and don\'ts.'}
                            {activeTab === 'examples' && 'Example outputs or input/output pairs.'}
                        </span>
                        {activeTab === 'instructions' && <CharCount value={form.instructions} limit={INSTRUCTION_LIMIT} />}
                    </div>
                    <textarea
                        value={form[activeTab]}
                        onChange={e => {
                            if (activeTab === 'instructions' && e.target.value.length > INSTRUCTION_LIMIT) return;
                            setField(activeTab, e.target.value);
                        }}
                        placeholder={
                            activeTab === 'instructions' ? 'e.g. When asked to summarize a meeting, extract all key decisions, action items with owners, and open questions...' :
                                activeTab === 'workflow' ? 'e.g. 1. Read the transcript\n2. Extract action items\n3. List decisions made\n4. Output in structured format...' :
                                    activeTab === 'rules' ? 'e.g. - Always use bullet points\n- Keep summaries under 300 words\n- Highlight action items in bold...' :
                                        'e.g. Input: "Meeting transcript..."\nOutput: "## Summary\n..."'
                        }
                        style={{
                            width: '100%', minHeight: 180,
                            fontSize: 13, lineHeight: 1.6,
                            color: 'var(--text-primary)',
                            background: 'var(--bg-tertiary)',
                            border: '1.5px solid var(--border-subtle)',
                            borderRadius: 12, padding: '12px 14px',
                            resize: 'vertical', outline: 'none', fontFamily: 'inherit',
                            boxSizing: 'border-box',
                            transition: 'border-color .15s',
                        }}
                        onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
                        onBlur={e => e.target.style.borderColor = 'var(--border-subtle)'}
                    />
                </div>

                {/* Footer */}
                <div style={{ padding: '12px 24px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    {/* Shared toggle */}
                    <button
                        onClick={() => setField('isShared', !form.isShared)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '7px 12px', borderRadius: 10,
                            border: `1.5px solid ${form.isShared ? 'rgba(59,130,246,.4)' : 'var(--border-subtle)'}`,
                            background: form.isShared ? 'rgba(59,130,246,.08)' : 'transparent',
                            color: form.isShared ? '#3b82f6' : 'var(--text-secondary)',
                            cursor: 'pointer', fontSize: 13, fontWeight: 500,
                            transition: 'all .15s',
                        }}>
                        {form.isShared ? <Users size={14} /> : <Lock size={14} />}
                        {form.isShared ? 'Shared with org' : 'Private'}
                    </button>

                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={onCancel} style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                            Cancel
                        </button>
                        <button
                            onClick={() => onSave(form)}
                            disabled={!form.name.trim() || saving}
                            style={{
                                padding: '8px 22px', borderRadius: 10, border: 'none',
                                background: 'var(--accent-primary)', color: '#fff',
                                cursor: form.name.trim() && !saving ? 'pointer' : 'not-allowed',
                                fontSize: 13, fontWeight: 600, opacity: form.name.trim() && !saving ? 1 : 0.5,
                                display: 'flex', alignItems: 'center', gap: 6,
                                transition: 'opacity .15s',
                            }}>
                            {saving ? 'Saving...' : <><Sparkles size={14} /> {skill ? 'Update skill' : 'Create skill'}</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── Main SkillsPanel ────────────────────────────────────────────── */
export default function SkillsPanel({ user, onClose, activeSkillIds = [], onToggleSkill }) {
    const [skills, setSkills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [editingSkill, setEditingSkill] = useState(null);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await authFetch(`${API_BASE}/skills`);
            if (!res.ok) throw new Error('Failed to load skills');
            const data = await res.json();
            setSkills(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleSave = async (form) => {
        setSaving(true);
        try {
            if (editingSkill) {
                const res = await authFetch(`${API_BASE}/skills/${editingSkill.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
                if (!res.ok) throw new Error('Failed to update skill');
            } else {
                const res = await authFetch(`${API_BASE}/skills`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
                if (!res.ok) throw new Error('Failed to create skill');
            }
            setShowForm(false);
            setEditingSkill(null);
            await load();
        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await authFetch(`${API_BASE}/skills/${id}`, { method: 'DELETE' });
            await load();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleEdit = (skill) => {
        setEditingSkill(skill);
        setShowForm(true);
    };

    const filtered = skills.filter(s =>
        !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.description?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <>
            <div style={{
                height: '100%', display: 'flex', flexDirection: 'column',
                background: 'var(--bg-primary)',
                overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 28px 0',
                    borderBottom: '1px solid var(--border-subtle)',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                            <div style={{
                                width: 40, height: 40, borderRadius: 12,
                                background: 'linear-gradient(135deg, rgba(245,158,11,.3) 0%, rgba(251,191,36,.15) 100%)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: '1.5px solid rgba(245,158,11,.25)',
                            }}>
                                <Sparkles size={20} color="#f59e0b" />
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Skills</h2>
                                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.04em', padding: '2px 7px', borderRadius: 6, background: 'rgba(168,85,247,.12)', color: '#a855f7', textTransform: 'uppercase' }}>beta</span>
                                </div>
                                <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                                    Reusable instruction packs for consistent AI task execution
                                </p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <button
                                onClick={() => { setEditingSkill(null); setShowForm(true); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '8px 16px', borderRadius: 11, border: 'none',
                                    background: 'var(--accent-primary)', color: '#fff',
                                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                    boxShadow: '0 2px 8px rgba(245,158,11,.3)',
                                    transition: 'opacity .15s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '.88'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                            >
                                <Plus size={15} /> New skill
                            </button>
                            <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Active indicator */}
                    {activeSkillIds.length > 0 && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 14px', borderRadius: 10, marginBottom: 12,
                            background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.25)',
                        }}>
                            <Zap size={13} color="#f59e0b" />
                            <span style={{ fontSize: 12, color: '#d97706', fontWeight: 500 }}>
                                {activeSkillIds.length} skill{activeSkillIds.length !== 1 ? 's' : ''} active in chat
                            </span>
                        </div>
                    )}

                    {/* Search */}
                    <div style={{ position: 'relative', marginBottom: 16 }}>
                        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search skills..."
                            style={{
                                width: '100%', padding: '8px 12px 8px 34px',
                                fontSize: 13, borderRadius: 10,
                                border: '1.5px solid var(--border-subtle)',
                                background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                                outline: 'none', boxSizing: 'border-box',
                            }}
                        />
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflow: 'auto', padding: '16px 28px 28px' }}>
                    {loading && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120 }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2.5px solid var(--border-subtle)', borderTopColor: 'var(--accent-primary)', animation: 'spin 0.7s linear infinite' }} />
                        </div>
                    )}

                    {!loading && error && (
                        <div style={{ padding: '20px 0', textAlign: 'center', color: '#ef4444', fontSize: 14 }}>
                            {error} — <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: 14, textDecoration: 'underline' }}>retry</button>
                        </div>
                    )}

                    {!loading && !error && filtered.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '48px 0' }}>
                            <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
                            <h3 style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
                                {search ? 'No skills match your search' : 'No skills yet'}
                            </h3>
                            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                {search ? 'Try a different search term.' : 'Create your first skill to teach the AI how to handle specific tasks consistently.'}
                            </p>
                            {!search && (
                                <button
                                    onClick={() => { setEditingSkill(null); setShowForm(true); }}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                        padding: '9px 20px', borderRadius: 11, border: 'none',
                                        background: 'var(--accent-primary)', color: '#fff',
                                        fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                    }}>
                                    <Plus size={14} /> Create your first skill
                                </button>
                            )}
                        </div>
                    )}

                    {!loading && !error && filtered.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {filtered.map(skill => (
                                <SkillCard
                                    key={skill.id}
                                    skill={skill}
                                    isOwner={skill.userId === user?.id || user?.isAdmin}
                                    isActive={activeSkillIds.includes(skill.id)}
                                    onToggle={onToggleSkill}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Create/Edit form modal */}
            {showForm && (
                <SkillFormModal
                    skill={editingSkill}
                    onSave={handleSave}
                    onCancel={() => { setShowForm(false); setEditingSkill(null); }}
                    saving={saving}
                />
            )}

            <style>{`
                @keyframes skillModalIn {
                    from { opacity: 0; transform: scale(.96) translateY(8px); }
                    to   { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </>
    );
}

import React, { useState, useEffect, useCallback } from 'react';
import { Package, Building2, Plus, Pencil, Trash2, Save, X, Star, AlertTriangle, CheckCircle, ChevronDown, ChevronRight, Shield, Infinity } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';

const FEATURE_OPTIONS = [
    { id: 'chat', label: 'Chat' },
    { id: 'agents', label: 'Agents' },
    { id: 'swarms', label: 'Swarms' },
    { id: 'browser_agents', label: 'Browser Agents' },
    { id: 'terminal_agents', label: 'Terminal Agents' },
    { id: 'knowledge_base', label: 'Knowledge Base' },
    { id: 'embed_chat', label: 'Embed Chat' },
    { id: 'direct_chat', label: 'Direct Chat' },
    { id: 'workspace', label: 'Workspace' },
    { id: 'group_chats', label: 'Group Chats' },
    { id: 'encryption', label: 'Encryption (PIN)' },
];

const SECTIONS = [
    { id: 'plans', label: 'Plans', icon: Package, color: '#8b5cf6' },
    { id: 'organizations', label: 'Organizations', icon: Building2, color: '#3b82f6' },
];

const LIMIT_FIELDS = [
    { key: 'max_messages_per_month', label: 'Total Messages / Month', type: 'number' },
    { key: 'max_tokens_per_month', label: 'Tokens / Month', type: 'number' },
    { key: 'max_cost_per_month', label: 'Cost Cap / Month (€)', type: 'currency' },
    { key: 'max_users', label: 'Max Users', type: 'number' },
    { key: 'max_agents', label: 'Max Agents', type: 'number' },
    { key: 'max_knowledge_sources', label: 'Max Knowledge Sources', type: 'number' },
];

const AGENT_TYPES = [
    { key: 'chat', label: 'Chat Agents', color: '#3b82f6' },
    { key: 'browser', label: 'Browser Agents', color: '#8b5cf6' },
    { key: 'terminal', label: 'Terminal Agents', color: '#22c55e' },
    { key: 'swarm', label: 'Swarm Agents', color: '#f59e0b' },
];

// ── Style helpers ──
const card = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    borderRadius: '12px',
    padding: '20px',
};
const input = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid var(--border-default)',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    outline: 'none',
};
const btnPrimary = {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 16px', borderRadius: '8px', border: 'none',
    background: 'var(--accent-primary)', color: 'white',
    fontSize: '13px', fontWeight: '600', cursor: 'pointer',
};
const btnSecondary = {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 16px', borderRadius: '8px',
    border: '1px solid var(--border-default)', background: 'transparent',
    color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '500',
    cursor: 'pointer',
};
const btnDanger = {
    ...btnSecondary,
    color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)',
};


// ═══════════════════════════════════════════
//  Usage Bar Component
// ═══════════════════════════════════════════
const UsageBar = ({ current, limit, label, unit = '' }) => {
    if (limit === null || limit === undefined) {
        return (
            <div style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{(current || 0).toLocaleString()}{unit} / <Infinity style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle' }} /></span>
                </div>
                <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-tertiary)' }}>
                    <div style={{ width: '0%', height: '100%', borderRadius: '3px', background: 'var(--accent-primary)' }} />
                </div>
            </div>
        );
    }
    const pct = limit > 0 ? Math.min(100, Math.round((current || 0) / limit * 100)) : 0;
    const color = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e';
    return (
        <div style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ color: pct >= 90 ? '#ef4444' : 'var(--text-muted)' }}>{(current || 0).toLocaleString()}{unit} / {limit.toLocaleString()}{unit} ({pct}%)</span>
            </div>
            <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-tertiary)' }}>
                <div style={{ width: `${pct}%`, height: '100%', borderRadius: '3px', background: color, transition: 'width 0.3s ease' }} />
            </div>
        </div>
    );
};


// ═══════════════════════════════════════════
//  Limit Field with Override Toggle
// ═══════════════════════════════════════════
const LimitInput = ({ field, value, onChange, planDefault, showOverride = false }) => {
    const isOverridden = value !== null && value !== undefined;
    const displayValue = isOverridden ? value : '';
    const placeholder = planDefault !== null && planDefault !== undefined ? `Plan: ${planDefault.toLocaleString()}` : 'Unlimited';

    return (
        <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)' }}>{field.label}</label>
                {showOverride && (
                    <button
                        onClick={() => onChange(isOverridden ? null : (planDefault || ''))}
                        style={{
                            fontSize: '10px', padding: '2px 8px', borderRadius: '4px', border: 'none',
                            cursor: 'pointer',
                            background: isOverridden ? 'rgba(139,92,246,0.15)' : 'var(--bg-tertiary)',
                            color: isOverridden ? '#8b5cf6' : 'var(--text-muted)',
                            fontWeight: '600',
                        }}
                    >
                        {isOverridden ? 'Override ✓' : 'Override'}
                    </button>
                )}
            </div>
            <input
                type="number"
                step={field.type === 'currency' ? '0.01' : '1'}
                value={displayValue}
                placeholder={placeholder}
                disabled={showOverride && !isOverridden}
                onChange={e => {
                    const v = e.target.value;
                    onChange(v === '' ? null : (field.type === 'currency' ? parseFloat(v) : parseInt(v)));
                }}
                style={{
                    ...input,
                    opacity: showOverride && !isOverridden ? 0.5 : 1,
                }}
            />
        </div>
    );
};


// ═══════════════════════════════════════════
//  Feature Checkbox Grid
// ═══════════════════════════════════════════
const FeatureCheckboxes = ({ selected = [], onChange }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '6px' }}>
        {FEATURE_OPTIONS.map(f => {
            const checked = selected.length === 0 || selected.includes(f.id);
            return (
                <label key={f.id} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '6px 10px', borderRadius: '8px', cursor: 'pointer',
                    background: checked ? 'rgba(34,197,94,0.08)' : 'var(--bg-tertiary)',
                    border: `1px solid ${checked ? 'rgba(34,197,94,0.3)' : 'var(--border-default)'}`,
                    fontSize: '12px', color: 'var(--text-primary)',
                    transition: 'all 0.15s ease',
                }}>
                    <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                            if (selected.length === 0) {
                                // All were selected, now deselect this one
                                onChange(FEATURE_OPTIONS.filter(o => o.id !== f.id).map(o => o.id));
                            } else if (checked) {
                                const next = selected.filter(id => id !== f.id);
                                onChange(next.length === 0 ? [] : next);
                            } else {
                                const next = [...selected, f.id];
                                onChange(next.length === FEATURE_OPTIONS.length ? [] : next);
                            }
                        }}
                        style={{ accentColor: '#22c55e' }}
                    />
                    {f.label}
                </label>
            );
        })}
    </div>
);


// ═══════════════════════════════════════════
//  Agent Type Message Limits
// ═══════════════════════════════════════════
const AgentTypeLimits = ({ values = {}, onChange, planDefaults, showOverride = false }) => {
    const [expanded, setExpanded] = useState(Object.keys(values || {}).length > 0);

    const updateType = (key, val) => {
        const next = { ...values };
        if (val === null || val === '') {
            delete next[key];
        } else {
            next[key] = parseInt(val);
        }
        onChange(Object.keys(next).length > 0 ? next : {});
    };

    return (
        <div style={{ marginTop: '12px' }}>
            <button
                onClick={() => setExpanded(!expanded)}
                style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)',
                }}
            >
                {expanded ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
                Per Agent Type Limits
                <span style={{ fontSize: '11px', fontWeight: '400', color: 'var(--text-muted)' }}>— optional, per type caps</span>
            </button>
            {expanded && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginTop: '10px', padding: '12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)' }}>
                    {AGENT_TYPES.map(t => {
                        const val = values?.[t.key];
                        const planVal = planDefaults?.[t.key];
                        const hasOverride = showOverride;
                        const isSet = val !== undefined && val !== null;
                        const placeholder = hasOverride && planVal ? `Plan: ${planVal.toLocaleString()}` : 'Unlimited';

                        return (
                            <div key={t.key}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                                    <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)' }}>{t.label}</label>
                                </div>
                                <input
                                    type="number"
                                    min="0"
                                    value={isSet ? val : ''}
                                    placeholder={placeholder}
                                    onChange={e => updateType(t.key, e.target.value || null)}
                                    style={{ ...input, fontSize: '12px', padding: '6px 10px' }}
                                />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};


// ═══════════════════════════════════════════
//  Plan Editor Modal
// ═══════════════════════════════════════════
const PlanEditor = ({ plan, onSave, onCancel }) => {
    const [form, setForm] = useState({
        name: plan?.name || '',
        description: plan?.description || '',
        max_messages_per_month: plan?.max_messages_per_month ?? null,
        max_messages_by_type: plan?.max_messages_by_type || {},
        max_tokens_per_month: plan?.max_tokens_per_month ?? null,
        max_cost_per_month: plan?.max_cost_per_month ?? null,
        max_users: plan?.max_users ?? null,
        max_agents: plan?.max_agents ?? null,
        max_knowledge_sources: plan?.max_knowledge_sources ?? null,
        allowed_features: plan?.allowed_features || [],
        allowed_models: plan?.allowed_models || [],
        is_default: plan?.is_default || false,
    });

    const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
            <div style={{ ...card, width: '560px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                        {plan ? 'Edit Plan' : 'New Plan'}
                    </h3>
                    <button onClick={onCancel} style={{ ...btnSecondary, padding: '4px 8px' }}><X style={{ width: 16, height: 16 }} /></button>
                </div>

                {/* Name & Description */}
                <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Plan Name *</label>
                    <input value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g. Pro, Enterprise" style={input} />
                </div>
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Description</label>
                    <textarea value={form.description} onChange={e => update('description', e.target.value)} placeholder="Brief description of this plan" rows={2} style={{ ...input, resize: 'vertical' }} />
                </div>

                {/* Limits */}
                <h4 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield style={{ width: 14, height: 14, color: '#8b5cf6' }} /> Limits
                    <span style={{ fontSize: '11px', fontWeight: '400', color: 'var(--text-muted)' }}>— leave empty for unlimited</span>
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                    {LIMIT_FIELDS.map(f => (
                        <LimitInput key={f.key} field={f} value={form[f.key]} onChange={v => update(f.key, v)} />
                    ))}
                </div>
                <AgentTypeLimits values={form.max_messages_by_type} onChange={v => update('max_messages_by_type', v)} />

                {/* Features */}
                <h4 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', margin: '16px 0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Package style={{ width: 14, height: 14, color: '#22c55e' }} /> Allowed Features
                    <span style={{ fontSize: '11px', fontWeight: '400', color: 'var(--text-muted)' }}>— empty = all</span>
                </h4>
                <FeatureCheckboxes selected={form.allowed_features} onChange={v => update('allowed_features', v)} />

                {/* Default toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.is_default} onChange={e => update('is_default', e.target.checked)} style={{ accentColor: '#f59e0b' }} />
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                        <Star style={{ width: 14, height: 14, color: '#f59e0b', display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                        Default plan for new organizations
                    </span>
                </label>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
                    <button onClick={onCancel} style={btnSecondary}>Cancel</button>
                    <button onClick={() => onSave(form)} disabled={!form.name.trim()} style={{ ...btnPrimary, opacity: form.name.trim() ? 1 : 0.5 }}>
                        <Save style={{ width: 14, height: 14 }} /> {plan ? 'Update Plan' : 'Create Plan'}
                    </button>
                </div>
            </div>
        </div>
    );
};


// ═══════════════════════════════════════════
//  Plans View
// ═══════════════════════════════════════════
const PlansView = () => {
    const [plans, setPlans] = useState([]);
    const [editing, setEditing] = useState(null); // null | 'new' | plan object
    const [loading, setLoading] = useState(true);

    const loadPlans = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/subscriptions/plans`);
            const data = await res.json();
            if (res.ok) setPlans(Array.isArray(data) ? data : []);
        } catch (e) { console.error('Failed to load plans:', e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadPlans(); }, [loadPlans]);

    const handleSave = async (form) => {
        try {
            if (editing && editing !== 'new') {
                await authFetch(`${API_BASE}/api/subscriptions/plans/${editing.id}`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form)
                });
            } else {
                await authFetch(`${API_BASE}/api/subscriptions/plans`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form)
                });
            }
            setEditing(null);
            loadPlans();
        } catch (e) { console.error('Save plan error:', e); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this plan? Orgs using it will lose their plan assignment.')) return;
        try {
            await authFetch(`${API_BASE}/api/subscriptions/plans/${id}`, { method: 'DELETE' });
            loadPlans();
        } catch (e) { console.error('Delete plan error:', e); }
    };

    const formatLimit = (val, unit = '') => {
        if (val === null || val === undefined) return '∞';
        if (unit === '€') return `€${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        return val.toLocaleString() + unit;
    };

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading plans...</div>;
    }

    return (
        <div style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                    <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Subscription Plans</h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>Create reusable plan templates with limits and feature access</p>
                </div>
                <button onClick={() => setEditing('new')} style={btnPrimary}>
                    <Plus style={{ width: 16, height: 16 }} /> New Plan
                </button>
            </div>

            {plans.length === 0 ? (
                <div style={{ ...card, textAlign: 'center', padding: '60px 20px' }}>
                    <Package style={{ width: 40, height: 40, color: 'var(--text-muted)', margin: '0 auto 12px' }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No plans yet. Create your first subscription plan.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                    {plans.map(plan => (
                        <div key={plan.id} style={{ ...card, position: 'relative', transition: 'border-color 0.15s', borderColor: plan.is_default ? 'rgba(245,158,11,0.4)' : undefined }}>
                            {plan.is_default && (
                                <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: '700', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '3px 8px', borderRadius: '6px' }}>
                                    <Star style={{ width: 10, height: 10 }} /> DEFAULT
                                </div>
                            )}
                            <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 4px' }}>{plan.name}</h3>
                            {plan.description && <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 16px' }}>{plan.description}</p>}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: '12px', marginBottom: '16px' }}>
                                <div><span style={{ color: 'var(--text-muted)' }}>Messages:</span> <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{formatLimit(plan.max_messages_per_month)}</span></div>
                                <div><span style={{ color: 'var(--text-muted)' }}>Tokens:</span> <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{formatLimit(plan.max_tokens_per_month)}</span></div>
                                <div><span style={{ color: 'var(--text-muted)' }}>Cost Cap:</span> <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{formatLimit(plan.max_cost_per_month, '€')}</span></div>
                                <div><span style={{ color: 'var(--text-muted)' }}>Users:</span> <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{formatLimit(plan.max_users)}</span></div>
                                <div><span style={{ color: 'var(--text-muted)' }}>Agents:</span> <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{formatLimit(plan.max_agents)}</span></div>
                                <div><span style={{ color: 'var(--text-muted)' }}>Knowledge:</span> <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{formatLimit(plan.max_knowledge_sources)}</span></div>
                            </div>

                            {plan.max_messages_by_type && Object.keys(plan.max_messages_by_type).length > 0 && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                    Per type: {AGENT_TYPES.filter(t => plan.max_messages_by_type[t.key]).map(t =>
                                        `${t.label}: ${plan.max_messages_by_type[t.key].toLocaleString()}`
                                    ).join(', ')}
                                </div>
                            )}

                            {plan.allowed_features?.length > 0 && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                                    Features: {plan.allowed_features.map(f => FEATURE_OPTIONS.find(o => o.id === f)?.label || f).join(', ')}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-default)', paddingTop: '12px' }}>
                                <button onClick={() => setEditing(plan)} style={{ ...btnSecondary, flex: 1, justifyContent: 'center' }}>
                                    <Pencil style={{ width: 13, height: 13 }} /> Edit
                                </button>
                                <button onClick={() => handleDelete(plan.id)} style={{ ...btnDanger, padding: '8px 12px' }}>
                                    <Trash2 style={{ width: 13, height: 13 }} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {editing && <PlanEditor plan={editing === 'new' ? null : editing} onSave={handleSave} onCancel={() => setEditing(null)} />}
        </div>
    );
};


// ═══════════════════════════════════════════
//  Org Subscription Detail Panel
// ═══════════════════════════════════════════
const OrgDetail = ({ orgSub, plans, onSave, onClose, onRemove }) => {
    const [form, setForm] = useState({
        plan_id: orgSub?.plan_id || '',
        status: orgSub?.status || 'active',
        max_messages_per_month: orgSub?.max_messages_per_month ?? null,
        max_messages_by_type: orgSub?.max_messages_by_type || null,
        max_tokens_per_month: orgSub?.max_tokens_per_month ?? null,
        max_cost_per_month: orgSub?.max_cost_per_month ?? null,
        max_users: orgSub?.max_users ?? null,
        max_agents: orgSub?.max_agents ?? null,
        max_knowledge_sources: orgSub?.max_knowledge_sources ?? null,
        allowed_features: orgSub?.allowed_features || null,
        allowed_models: orgSub?.allowed_models || null,
        notes: orgSub?.notes || '',
    });

    const selectedPlan = plans.find(p => p.id === form.plan_id);
    const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

    return (
        <div style={{ ...card, marginTop: '16px', borderColor: 'rgba(59,130,246,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                    {orgSub?.org_name || 'Organization'} — Subscription
                </h3>
                <button onClick={onClose} style={{ ...btnSecondary, padding: '4px 8px' }}><X style={{ width: 16, height: 16 }} /></button>
            </div>

            {/* Usage bars */}
            {orgSub?.current_usage && (
                <div style={{ marginBottom: '20px', padding: '16px', borderRadius: '10px', background: 'var(--bg-tertiary)' }}>
                    <h4 style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '12px' }}>Current Month Usage</h4>
                    <UsageBar label="Messages" current={orgSub.current_usage.messages} limit={orgSub.effective_limits?.max_messages_per_month} />
                    <UsageBar label="Tokens" current={orgSub.current_usage.tokens} limit={orgSub.effective_limits?.max_tokens_per_month} />
                    <UsageBar label="Cost" current={orgSub.current_usage.cost} limit={orgSub.effective_limits?.max_cost_per_month} unit="€" />
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                {/* Plan selector */}
                <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Plan</label>
                    <select value={form.plan_id} onChange={e => update('plan_id', e.target.value)} style={{ ...input, cursor: 'pointer' }}>
                        <option value="">No plan (custom)</option>
                        {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>

                {/* Status */}
                <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Status</label>
                    <select value={form.status} onChange={e => update('status', e.target.value)} style={{ ...input, cursor: 'pointer' }}>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
            </div>

            {/* Limit overrides */}
            <h4 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', margin: '16px 0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Shield style={{ width: 14, height: 14, color: '#8b5cf6' }} /> Limit Overrides
                <span style={{ fontSize: '11px', fontWeight: '400', color: 'var(--text-muted)' }}>— toggle to override plan defaults</span>
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                {LIMIT_FIELDS.map(f => (
                    <LimitInput
                        key={f.key}
                        field={f}
                        value={form[f.key]}
                        onChange={v => update(f.key, v)}
                        planDefault={selectedPlan?.[f.key]}
                        showOverride={true}
                    />
                ))}
            </div>
            <AgentTypeLimits
                values={form.max_messages_by_type || {}}
                onChange={v => update('max_messages_by_type', Object.keys(v).length > 0 ? v : null)}
                planDefaults={selectedPlan?.max_messages_by_type}
                showOverride={true}
            />

            {/* Notes */}
            <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Notes</label>
                <textarea value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Internal notes about this subscription" rows={2} style={{ ...input, resize: 'vertical' }} />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-default)', paddingTop: '16px' }}>
                <button onClick={onRemove} style={btnDanger}><Trash2 style={{ width: 13, height: 13 }} /> Remove Subscription</button>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={onClose} style={btnSecondary}>Cancel</button>
                    <button onClick={() => onSave(form)} style={btnPrimary}><Save style={{ width: 14, height: 14 }} /> Save</button>
                </div>
            </div>
        </div>
    );
};


// ═══════════════════════════════════════════
//  Organizations View
// ═══════════════════════════════════════════
const OrgsView = () => {
    const [orgs, setOrgs] = useState([]);
    const [subs, setSubs] = useState([]);
    const [plans, setPlans] = useState([]);
    const [selectedOrg, setSelectedOrg] = useState(null);
    const [loading, setLoading] = useState(true);
    const [assignOrg, setAssignOrg] = useState(null); // org to assign a new subscription

    const loadAll = useCallback(async () => {
        try {
            const [orgsRes, subsRes, plansRes] = await Promise.all([
                authFetch(`${API_BASE}/api/usage/organizations`),
                authFetch(`${API_BASE}/api/subscriptions/orgs`),
                authFetch(`${API_BASE}/api/subscriptions/plans`),
            ]);
            if (orgsRes.ok) {
                // Also load full org list for org names
                const usageOrgs = await orgsRes.json();
                // Get all organizations from userStore for full list
                const fullOrgsRes = await authFetch(`${API_BASE}/api/subscriptions/orgs`);
                // We'll merge usage data into subs
                setOrgs(usageOrgs.filter(o => o.id !== '__unassigned'));
            }
            if (subsRes.ok) { const sd = await subsRes.json(); setSubs(Array.isArray(sd) ? sd : []); }
            if (plansRes.ok) { const pd = await plansRes.json(); setPlans(Array.isArray(pd) ? pd : []); }
        } catch (e) { console.error('Failed to load org subscriptions:', e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadAll(); }, [loadAll]);

    const handleSave = async (orgId, form) => {
        try {
            await authFetch(`${API_BASE}/api/subscriptions/orgs/${orgId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            setSelectedOrg(null);
            setAssignOrg(null);
            loadAll();
        } catch (e) { console.error('Save sub error:', e); }
    };

    const handleRemove = async (orgId) => {
        if (!window.confirm('Remove subscription from this organization?')) return;
        try {
            await authFetch(`${API_BASE}/api/subscriptions/orgs/${orgId}`, { method: 'DELETE' });
            setSelectedOrg(null);
            loadAll();
        } catch (e) { console.error('Remove sub error:', e); }
    };

    const getSubForOrg = (orgId) => subs.find(s => s.organization_id === orgId);
    const unsubscribedOrgs = orgs.filter(o => !getSubForOrg(o.id));

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading organizations...</div>;
    }

    return (
        <div style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                    <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Organization Subscriptions</h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>Assign plans and manage limits for each organization</p>
                </div>
            </div>

            {/* Subscribed orgs */}
            {subs.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px' }}>Active Subscriptions ({subs.length})</h3>
                    <div style={{ borderRadius: '12px', border: '1px solid var(--border-default)', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-tertiary)' }}>
                                    <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: '600', color: 'var(--text-secondary)' }}>Organization</th>
                                    <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: '600', color: 'var(--text-secondary)' }}>Plan</th>
                                    <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: '600', color: 'var(--text-secondary)' }}>Status</th>
                                    <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: '600', color: 'var(--text-secondary)' }}>Messages</th>
                                    <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: '600', color: 'var(--text-secondary)' }}>Cost</th>
                                    <th style={{ textAlign: 'right', padding: '10px 16px', fontWeight: '600', color: 'var(--text-secondary)' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {subs.map(sub => {
                                    const msgLimit = sub.effective_limits?.max_messages_per_month;
                                    const costLimit = sub.effective_limits?.max_cost_per_month;
                                    const msgPct = msgLimit ? Math.round((sub.current_usage?.messages || 0) / msgLimit * 100) : null;
                                    const costPct = costLimit ? Math.round((sub.current_usage?.cost || 0) / costLimit * 100) : null;
                                    const isSelected = selectedOrg === sub.organization_id;

                                    return (
                                        <React.Fragment key={sub.organization_id}>
                                            <tr
                                                onClick={() => setSelectedOrg(isSelected ? null : sub.organization_id)}
                                                style={{
                                                    cursor: 'pointer',
                                                    background: isSelected ? 'rgba(59,130,246,0.05)' : 'var(--bg-secondary)',
                                                    borderBottom: '1px solid var(--border-default)',
                                                    transition: 'background 0.1s'
                                                }}
                                                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                                                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                                            >
                                                <td style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-primary)' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        {isSelected ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
                                                        {sub.org_name}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{sub.plan_name || 'Custom'}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <span style={{
                                                        padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
                                                        background: sub.status === 'active' ? 'rgba(34,197,94,0.1)' : sub.status === 'suspended' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                                                        color: sub.status === 'active' ? '#22c55e' : sub.status === 'suspended' ? '#f59e0b' : '#ef4444',
                                                    }}>
                                                        {sub.status}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                                                    {sub.current_usage?.messages?.toLocaleString() || 0}{msgLimit ? ` / ${msgLimit.toLocaleString()}` : ''}
                                                    {msgPct !== null && msgPct >= 80 && <AlertTriangle style={{ width: 12, height: 12, color: msgPct >= 90 ? '#ef4444' : '#f59e0b', marginLeft: '4px', verticalAlign: 'middle' }} />}
                                                </td>
                                                <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                                                    €{(sub.current_usage?.cost || 0).toFixed(4)}{costLimit ? ` / €${costLimit.toFixed(2)}` : ''}
                                                    {costPct !== null && costPct >= 80 && <AlertTriangle style={{ width: 12, height: 12, color: costPct >= 90 ? '#ef4444' : '#f59e0b', marginLeft: '4px', verticalAlign: 'middle' }} />}
                                                </td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                                    <Pencil style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
                                                </td>
                                            </tr>
                                            {isSelected && (
                                                <tr><td colSpan={6} style={{ padding: '0 16px 16px' }}>
                                                    <OrgDetail
                                                        orgSub={sub}
                                                        plans={plans}
                                                        onSave={(form) => handleSave(sub.organization_id, form)}
                                                        onClose={() => setSelectedOrg(null)}
                                                        onRemove={() => handleRemove(sub.organization_id)}
                                                    />
                                                </td></tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Unsubscribed orgs */}
            {unsubscribedOrgs.length > 0 && (
                <div>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '12px' }}>Unsubscribed Organizations ({unsubscribedOrgs.length})</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                        {unsubscribedOrgs.map(org => (
                            <div key={org.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px' }}>
                                <div>
                                    <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{org.name}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        {org.total_calls?.toLocaleString() || 0} calls · €{(org.estimated_cost || 0).toFixed(4)}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setAssignOrg(org)}
                                    style={{ ...btnPrimary, padding: '6px 12px', fontSize: '12px' }}
                                >
                                    <Plus style={{ width: 13, height: 13 }} /> Assign Plan
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {orgs.length === 0 && subs.length === 0 && (
                <div style={{ ...card, textAlign: 'center', padding: '60px 20px' }}>
                    <Building2 style={{ width: 40, height: 40, color: 'var(--text-muted)', margin: '0 auto 12px' }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No organizations found. Create organizations in Security → Users first.</p>
                </div>
            )}

            {/* Quick assign modal for unsubscribed orgs */}
            {assignOrg && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
                    <QuickAssign org={assignOrg} plans={plans} onSave={(form) => handleSave(assignOrg.id, form)} onCancel={() => setAssignOrg(null)} />
                </div>
            )}
        </div>
    );
};

// Quick assign plan modal
const QuickAssign = ({ org, plans, onSave, onCancel }) => {
    const [planId, setPlanId] = useState(plans.find(p => p.is_default)?.id || '');
    const [status, setStatus] = useState('active');

    return (
        <div style={{ ...card, width: '400px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 4px' }}>
                Assign Subscription
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 20px' }}>
                for <strong>{org.name}</strong>
            </p>

            <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Plan</label>
                <select value={planId} onChange={e => setPlanId(e.target.value)} style={{ ...input, cursor: 'pointer' }}>
                    <option value="">No plan (custom limits)</option>
                    {plans.map(p => <option key={p.id} value={p.id}>{p.name}{p.is_default ? ' ⭐' : ''}</option>)}
                </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...input, cursor: 'pointer' }}>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button onClick={onCancel} style={btnSecondary}>Cancel</button>
                <button onClick={() => onSave({ plan_id: planId || null, status })} style={btnPrimary}>
                    <CheckCircle style={{ width: 14, height: 14 }} /> Assign
                </button>
            </div>
        </div>
    );
};


// ═══════════════════════════════════════════
//  Main SubscriptionsPanel
// ═══════════════════════════════════════════
const SubscriptionsPanel = () => {
    const [active, setActive] = useState('plans');

    return (
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
            {/* Left Sidebar */}
            <div style={{
                width: '56px', flexShrink: 0,
                display: 'flex', flexDirection: 'column', gap: '2px', padding: '8px 0',
                background: 'var(--bg-secondary)',
                borderRight: '1px solid var(--border-default)',
            }}>
                {SECTIONS.map(sec => {
                    const Icon = sec.icon;
                    const isActive = active === sec.id;
                    return (
                        <button
                            key={sec.id}
                            onClick={() => setActive(sec.id)}
                            title={sec.label}
                            style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                                padding: '10px 4px', margin: '0 4px', borderRadius: '8px', border: 'none',
                                cursor: 'pointer', transition: 'all 0.15s ease',
                                background: isActive ? `${sec.color}20` : 'transparent',
                                borderLeft: isActive ? `3px solid ${sec.color}` : '3px solid transparent',
                            }}
                        >
                            <Icon style={{ width: 20, height: 20, color: isActive ? sec.color : 'var(--text-muted)', transition: 'color 0.15s ease' }} />
                            <span style={{
                                fontSize: '9px', fontWeight: isActive ? '700' : '500',
                                color: isActive ? sec.color : 'var(--text-muted)',
                                textAlign: 'center', lineHeight: 1.1, transition: 'color 0.15s ease',
                            }}>
                                {sec.label}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Main Panel */}
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                {active === 'plans' && (
                    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
                        <PlansView />
                    </div>
                )}
                {active === 'organizations' && (
                    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
                        <OrgsView />
                    </div>
                )}
            </div>
        </div>
    );
};

export default SubscriptionsPanel;

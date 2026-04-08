import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Check, AlertCircle, Loader2, Calendar, Building2, Link2, RefreshCw } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';

const CURRENT_YEAR = new Date().getFullYear();

const ENTITY_TYPES = [
    { id: 'eenmanszaak', label: 'Eenmanszaak', desc: 'Sole proprietorship — IB (inkomstenbelasting)', icon: '👤' },
    { id: 'bv', label: 'BV', desc: 'Private limited company — VPB (vennootschapsbelasting)', icon: '🏢' },
    { id: 'vof', label: 'VOF', desc: 'General partnership — IB (inkomstenbelasting)', icon: '👥' },
];

const QUARTERS = [
    { id: 1, label: 'Q1', months: 'Jan – Mar' },
    { id: 2, label: 'Q2', months: 'Apr – Jun' },
    { id: 3, label: 'Q3', months: 'Jul – Sep' },
    { id: 4, label: 'Q4', months: 'Oct – Dec' },
];

export default function TaxAssistantWizard({ onClose, onCreated, user }) {
    const [step, setStep] = useState(0);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState(null);

    // Step 1: Period
    const [periodType, setPeriodType] = useState('quarterly');
    const [year, setYear] = useState(CURRENT_YEAR);
    const [quarter, setQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));

    // Step 2: Entity
    const [entityType, setEntityType] = useState('eenmanszaak');
    const [btwNumber, setBtwNumber] = useState('');
    const [kvkNumber, setKvkNumber] = useState('');

    // Step 3: Integrations
    const [integrations, setIntegrations] = useState({ google: false, checking: true });

    useEffect(() => {
        // Check which integrations are connected
        authFetch(`${API_BASE}/api/user/connected-providers`)
            .then(r => r.ok ? r.json() : { providers: [] })
            .then(data => {
                const providers = data.providers || [];
                setIntegrations({
                    google: providers.includes('google'),
                    checking: false,
                });
            })
            .catch(() => setIntegrations(prev => ({ ...prev, checking: false })));
    }, []);

    const handleCreate = async () => {
        setCreating(true);
        setError(null);
        try {
            const res = await authFetch(`${API_BASE}/api/tax-assistant`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    periodType,
                    year,
                    quarter: periodType === 'quarterly' ? quarter : null,
                    entityType,
                    btwNumber: btwNumber.trim() || null,
                    kvkNumber: kvkNumber.trim() || null,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to create tax assistant');
            }
            const data = await res.json();
            onCreated?.(data.notebook);
        } catch (err) {
            setError(err.message);
        } finally {
            setCreating(false);
        }
    };

    const steps = [
        { label: 'Period', icon: Calendar },
        { label: 'Business', icon: Building2 },
        { label: 'Integrations', icon: Link2 },
    ];

    const canProceed = () => {
        if (step === 0) return !!year && (periodType === 'annual' || !!quarter);
        if (step === 1) return !!entityType;
        return true;
    };

    const periodLabel = periodType === 'quarterly' ? `Q${quarter} ${year}` : `Year ${year}`;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
        }} onClick={onClose}>
            <div onClick={e => e.stopPropagation()} style={{
                width: 540, maxHeight: '90vh', overflow: 'auto',
                background: 'var(--bg-primary, #fff)',
                borderRadius: 20, boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
                border: '1px solid var(--border-subtle, #e5e7eb)',
            }}>
                {/* Header */}
                <div style={{
                    padding: '24px 28px 16px',
                    borderBottom: '1px solid var(--border-subtle, #e5e7eb)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            🧾 New Tax Assistant
                            <span style={{
                                fontSize: 10, fontWeight: 700, padding: '2px 8px',
                                borderRadius: 6, background: 'linear-gradient(135deg, #059669, #10b981)',
                                color: '#fff', textTransform: 'uppercase', letterSpacing: 1,
                            }}>beta</span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                            Dutch business tax preparation assistant
                        </div>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', padding: 4, borderRadius: 8,
                    }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Step indicator */}
                <div style={{ display: 'flex', gap: 4, padding: '16px 28px 0', alignItems: 'center' }}>
                    {steps.map((s, i) => {
                        const Icon = s.icon;
                        const isActive = i === step;
                        const isDone = i < step;
                        return (
                            <React.Fragment key={i}>
                                {i > 0 && <div style={{
                                    flex: 1, height: 2, borderRadius: 1,
                                    background: isDone ? '#059669' : 'var(--border-subtle, #e5e7eb)',
                                    transition: 'background 0.3s',
                                }} />}
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '6px 12px', borderRadius: 10,
                                    background: isActive ? 'rgba(5, 150, 105, 0.1)' : 'transparent',
                                    color: isActive ? '#059669' : isDone ? '#059669' : 'var(--text-muted)',
                                    fontWeight: isActive ? 600 : 400, fontSize: 13,
                                    transition: 'all 0.3s',
                                }}>
                                    {isDone ? <Check size={14} /> : <Icon size={14} />}
                                    {s.label}
                                </div>
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* Content */}
                <div style={{ padding: '20px 28px 24px', minHeight: 280 }}>
                    {/* Step 0: Period */}
                    {step === 0 && (
                        <div>
                            <div style={{ marginBottom: 20 }}>
                                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>
                                    Filing Type
                                </label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {['quarterly', 'annual'].map(pt => (
                                        <button key={pt} onClick={() => setPeriodType(pt)} style={{
                                            flex: 1, padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                                            border: `2px solid ${periodType === pt ? '#059669' : 'var(--border-subtle, #e5e7eb)'}`,
                                            background: periodType === pt ? 'rgba(5, 150, 105, 0.06)' : 'var(--bg-secondary, #f9fafb)',
                                            color: 'var(--text-primary)', fontWeight: 600, fontSize: 14,
                                            transition: 'all 0.2s',
                                        }}>
                                            {pt === 'quarterly' ? '📅 Quarterly (BTW)' : '📆 Annual'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ marginBottom: 20 }}>
                                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>
                                    Year
                                </label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {[CURRENT_YEAR - 1, CURRENT_YEAR].map(y => (
                                        <button key={y} onClick={() => setYear(y)} style={{
                                            flex: 1, padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                                            border: `2px solid ${year === y ? '#059669' : 'var(--border-subtle, #e5e7eb)'}`,
                                            background: year === y ? 'rgba(5, 150, 105, 0.06)' : 'var(--bg-secondary, #f9fafb)',
                                            color: 'var(--text-primary)', fontWeight: 600, fontSize: 14,
                                            transition: 'all 0.2s',
                                        }}>
                                            {y}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {periodType === 'quarterly' && (
                                <div>
                                    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>
                                        Quarter
                                    </label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                        {QUARTERS.map(q => (
                                            <button key={q.id} onClick={() => setQuarter(q.id)} style={{
                                                padding: '14px 16px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                                                border: `2px solid ${quarter === q.id ? '#059669' : 'var(--border-subtle, #e5e7eb)'}`,
                                                background: quarter === q.id ? 'rgba(5, 150, 105, 0.06)' : 'var(--bg-secondary, #f9fafb)',
                                                transition: 'all 0.2s',
                                            }}>
                                                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{q.label}</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{q.months}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 1: Entity */}
                    {step === 1 && (
                        <div>
                            <div style={{ marginBottom: 20 }}>
                                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>
                                    Business Entity Type
                                </label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {ENTITY_TYPES.map(e => (
                                        <button key={e.id} onClick={() => setEntityType(e.id)} style={{
                                            padding: '14px 16px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                                            border: `2px solid ${entityType === e.id ? '#059669' : 'var(--border-subtle, #e5e7eb)'}`,
                                            background: entityType === e.id ? 'rgba(5, 150, 105, 0.06)' : 'var(--bg-secondary, #f9fafb)',
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            transition: 'all 0.2s',
                                        }}>
                                            <span style={{ fontSize: 24 }}>{e.icon}</span>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{e.label}</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{e.desc}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                                        BTW Number <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
                                    </label>
                                    <input
                                        value={btwNumber} onChange={e => setBtwNumber(e.target.value)}
                                        placeholder="NL123456789B01"
                                        style={{
                                            width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 13,
                                            border: '1px solid var(--border-subtle, #e5e7eb)',
                                            background: 'var(--bg-secondary, #f9fafb)',
                                            color: 'var(--text-primary)', outline: 'none',
                                            boxSizing: 'border-box',
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                                        KvK Number <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
                                    </label>
                                    <input
                                        value={kvkNumber} onChange={e => setKvkNumber(e.target.value)}
                                        placeholder="12345678"
                                        style={{
                                            width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 13,
                                            border: '1px solid var(--border-subtle, #e5e7eb)',
                                            background: 'var(--bg-secondary, #f9fafb)',
                                            color: 'var(--text-primary)', outline: 'none',
                                            boxSizing: 'border-box',
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Integrations */}
                    {step === 2 && (
                        <div>
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                                    Connected Integrations
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                    The Tax Assistant works best with Gmail & Drive connected for automatic document gathering.
                                </div>
                            </div>

                            {integrations.checking ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 20, justifyContent: 'center', color: 'var(--text-muted)' }}>
                                    <Loader2 size={16} className="animate-spin" /> Checking connections...
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <div style={{
                                        padding: '16px', borderRadius: 12,
                                        border: `1px solid ${integrations.google ? '#059669' : 'var(--border-subtle, #e5e7eb)'}`,
                                        background: integrations.google ? 'rgba(5, 150, 105, 0.04)' : 'var(--bg-secondary, #f9fafb)',
                                        display: 'flex', alignItems: 'center', gap: 12,
                                    }}>
                                        <span style={{ fontSize: 24 }}>📧</span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>Gmail & Google Drive</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Search invoices, read attachments, find financial documents</div>
                                        </div>
                                        {integrations.google ? (
                                            <span style={{
                                                display: 'flex', alignItems: 'center', gap: 4,
                                                fontSize: 12, fontWeight: 600, color: '#059669',
                                                background: 'rgba(5, 150, 105, 0.1)', padding: '4px 10px', borderRadius: 8,
                                            }}>
                                                <Check size={12} /> Connected
                                            </span>
                                        ) : (
                                            <span style={{
                                                display: 'flex', alignItems: 'center', gap: 4,
                                                fontSize: 12, fontWeight: 600, color: '#dc2626',
                                                background: 'rgba(220, 38, 38, 0.08)', padding: '4px 10px', borderRadius: 8,
                                            }}>
                                                <AlertCircle size={12} /> Not Connected
                                            </span>
                                        )}
                                    </div>

                                    {!integrations.google && (
                                        <div style={{
                                            padding: '14px 16px', borderRadius: 12,
                                            background: 'rgba(245, 158, 11, 0.06)',
                                            border: '1px solid rgba(245, 158, 11, 0.2)',
                                            display: 'flex', alignItems: 'flex-start', gap: 10,
                                        }}>
                                            <AlertCircle size={16} style={{ color: '#f59e0b', marginTop: 1, flexShrink: 0 }} />
                                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                                <strong style={{ color: 'var(--text-primary)' }}>Google not connected.</strong>{' '}
                                                Without Gmail and Drive access, the assistant cannot automatically find invoices and documents.
                                                You can still manually upload files. Connect Google from your profile settings.
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Summary */}
                            <div style={{
                                marginTop: 24, padding: '16px', borderRadius: 12,
                                background: 'rgba(5, 150, 105, 0.04)',
                                border: '1px solid rgba(5, 150, 105, 0.15)',
                            }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#059669', marginBottom: 8 }}>📋 Summary</div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                    <strong>Period:</strong> {periodLabel}<br />
                                    <strong>Entity:</strong> {ENTITY_TYPES.find(e => e.id === entityType)?.label || entityType}<br />
                                    {btwNumber && <><strong>BTW:</strong> {btwNumber}<br /></>}
                                    {kvkNumber && <><strong>KvK:</strong> {kvkNumber}<br /></>}
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div style={{
                            marginTop: 12, padding: '10px 14px', borderRadius: 10,
                            background: 'rgba(220, 38, 38, 0.06)', border: '1px solid rgba(220, 38, 38, 0.15)',
                            fontSize: 13, color: '#dc2626', display: 'flex', gap: 6, alignItems: 'center',
                        }}>
                            <AlertCircle size={14} /> {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 28px 24px',
                    display: 'flex', justifyContent: 'space-between', gap: 8,
                }}>
                    <button
                        onClick={() => step > 0 ? setStep(step - 1) : onClose()}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '10px 18px', borderRadius: 10, cursor: 'pointer',
                            border: '1px solid var(--border-subtle, #e5e7eb)',
                            background: 'var(--bg-secondary, #f9fafb)',
                            color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
                        }}
                    >
                        <ChevronLeft size={14} /> {step > 0 ? 'Back' : 'Cancel'}
                    </button>

                    {step < 2 ? (
                        <button
                            onClick={() => setStep(step + 1)}
                            disabled={!canProceed()}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '10px 20px', borderRadius: 10, cursor: canProceed() ? 'pointer' : 'not-allowed',
                                border: 'none',
                                background: canProceed() ? 'linear-gradient(135deg, #059669, #10b981)' : '#d1d5db',
                                color: '#fff', fontSize: 13, fontWeight: 600,
                                opacity: canProceed() ? 1 : 0.6,
                                transition: 'all 0.2s',
                            }}
                        >
                            Next <ChevronRight size={14} />
                        </button>
                    ) : (
                        <button
                            onClick={handleCreate}
                            disabled={creating}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '10px 22px', borderRadius: 10, cursor: creating ? 'not-allowed' : 'pointer',
                                border: 'none',
                                background: 'linear-gradient(135deg, #059669, #10b981)',
                                color: '#fff', fontSize: 13, fontWeight: 700,
                                boxShadow: '0 4px 14px rgba(5, 150, 105, 0.3)',
                                transition: 'all 0.2s',
                            }}
                        >
                            {creating ? <><Loader2 size={14} className="animate-spin" /> Creating...</> : <><Check size={14} /> Create Tax Assistant</>}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

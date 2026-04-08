import React, { useState, useEffect, useCallback } from 'react';
import {
    Search, Loader2, AlertCircle, FileText, TrendingUp,
    TrendingDown, RefreshCw, CheckCircle2, Clock,
    ArrowUpRight, ArrowDownRight, Scale
} from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';

const STAT_CARDS = [
    { key: 'invoiceCount', label: 'Invoices', icon: FileText, color: '#3b82f6', prefix: '' },
    { key: 'totalIncome', label: 'Revenue', icon: TrendingUp, color: '#059669', prefix: '€' },
    { key: 'totalExpenses', label: 'Expenses', icon: TrendingDown, color: '#ef4444', prefix: '€' },
    { key: 'btwBalance', label: 'BTW Balance', icon: Scale, color: '#8b5cf6', prefix: '€' },
];

const GATHER_STATUS = {
    pending: { label: 'Not started', icon: Clock, color: '#9ca3af', bg: 'rgba(156,163,175,0.08)' },
    in_progress: { label: 'Gathering...', icon: Loader2, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', spin: true },
    complete: { label: 'Complete', icon: CheckCircle2, color: '#059669', bg: 'rgba(5,150,105,0.08)' },
};

export default function TaxDashboard({ notebook, sources, onGather, onSourceClick }) {
    const [dashboard, setDashboard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [gathering, setGathering] = useState(false);

    const taxConfig = notebook?.settings?.taxConfig || {};

    const fetchDashboard = useCallback(async () => {
        if (!notebook?.id) return;
        try {
            setLoading(true);
            const res = await authFetch(`${API_BASE}/api/tax-assistant/${notebook.id}/dashboard`);
            if (res.ok) {
                const data = await res.json();
                setDashboard(data.dashboard);
            }
        } catch (err) {
            console.error('[TaxDashboard] Fetch failed:', err);
        } finally {
            setLoading(false);
        }
    }, [notebook?.id]);

    useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

    const handleGather = async () => {
        setGathering(true);
        try {
            // Update status to in_progress
            await authFetch(`${API_BASE}/api/tax-assistant/${notebook.id}/gather`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'in_progress' }),
            });

            // Trigger the AI gather via chat
            onGather?.();
        } catch (err) {
            console.error('[TaxDashboard] Gather failed:', err);
        } finally {
            setGathering(false);
        }
    };

    const stats = dashboard?.stats || {};
    const gatherConfig = GATHER_STATUS[taxConfig.gatherStatus] || GATHER_STATUS.pending;
    const GatherIcon = gatherConfig.icon;

    const formatCurrency = (val) => {
        if (val === undefined || val === null) return '€0.00';
        return `€${Math.abs(val).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const entityLabels = { eenmanszaak: 'Eenmanszaak', bv: 'BV', vof: 'VOF' };

    return (
        <div style={{ padding: '16px 12px', height: '100%', overflow: 'auto' }}>
            {/* Period header */}
            <div style={{
                padding: '16px', borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(5,150,105,0.06), rgba(16,185,129,0.04))',
                border: '1px solid rgba(5,150,105,0.12)',
                marginBottom: 16,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: 1.2 }}>
                            {taxConfig.periodType === 'quarterly' ? 'BTW Aangifte' : 'Jaaraangifte'}
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                            {taxConfig.periodType === 'quarterly' ? `Q${taxConfig.quarter} ${taxConfig.year}` : taxConfig.year}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                            {entityLabels[taxConfig.entityType] || taxConfig.entityType}
                            {taxConfig.btwNumber && ` · ${taxConfig.btwNumber}`}
                        </div>
                    </div>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                        borderRadius: 8, fontSize: 11, fontWeight: 600,
                        color: gatherConfig.color, background: gatherConfig.bg,
                    }}>
                        <GatherIcon size={12} className={gatherConfig.spin ? 'animate-spin' : ''} />
                        {gatherConfig.label}
                    </div>
                </div>
            </div>

            {/* Gather button */}
            <button
                onClick={handleGather}
                disabled={gathering}
                style={{
                    width: '100%', padding: '14px 16px', borderRadius: 12, cursor: gathering ? 'not-allowed' : 'pointer',
                    border: 'none',
                    background: gathering ? 'var(--bg-secondary)' : 'linear-gradient(135deg, #059669, #10b981)',
                    color: gathering ? 'var(--text-muted)' : '#fff',
                    fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: gathering ? 'none' : '0 4px 14px rgba(5,150,105,0.25)',
                    transition: 'all 0.3s',
                    marginBottom: 16,
                }}
            >
                {gathering ? (
                    <><Loader2 size={16} className="animate-spin" /> Scanning...</>
                ) : (
                    <><Search size={16} /> Scan Gmail & Drive</>
                )}
            </button>

            {/* Stats grid */}
            {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 30, color: 'var(--text-muted)' }}>
                    <Loader2 size={18} className="animate-spin" />
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                    {STAT_CARDS.map(({ key, label, icon: Icon, color, prefix }) => {
                        const val = stats[key] || 0;
                        const isNegative = key === 'btwBalance' && val < 0;
                        const displayVal = key === 'invoiceCount' ? val : formatCurrency(val);
                        return (
                            <div key={key} style={{
                                padding: '14px', borderRadius: 12,
                                background: 'var(--bg-secondary, #f9fafb)',
                                border: '1px solid var(--border-subtle, #e5e7eb)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                    <div style={{
                                        width: 28, height: 28, borderRadius: 8,
                                        background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <Icon size={14} style={{ color }} />
                                    </div>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                        {label}
                                    </span>
                                </div>
                                <div style={{
                                    fontSize: 18, fontWeight: 800,
                                    color: isNegative ? '#059669' : 'var(--text-primary)',
                                }}>
                                    {key === 'btwBalance' && val < 0 && '−'}
                                    {key === 'invoiceCount' ? val : formatCurrency(Math.abs(val))}
                                </div>
                                {key === 'btwBalance' && (
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                        {val > 0 ? 'To remit' : val < 0 ? 'To reclaim' : 'Balanced'}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* P&L summary */}
            {!loading && stats.profit !== undefined && (
                <div style={{
                    padding: '14px 16px', borderRadius: 12, marginBottom: 16,
                    background: stats.profit >= 0 ? 'rgba(5,150,105,0.04)' : 'rgba(239,68,68,0.04)',
                    border: `1px solid ${stats.profit >= 0 ? 'rgba(5,150,105,0.12)' : 'rgba(239,68,68,0.12)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                            Profit
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: stats.profit >= 0 ? '#059669' : '#ef4444' }}>
                            {stats.profit >= 0 ? '' : '−'}{formatCurrency(Math.abs(stats.profit))}
                        </div>
                    </div>
                    {stats.profit >= 0 ? (
                        <ArrowUpRight size={24} style={{ color: '#059669', opacity: 0.5 }} />
                    ) : (
                        <ArrowDownRight size={24} style={{ color: '#ef4444', opacity: 0.5 }} />
                    )}
                </div>
            )}

            {/* Sources list */}
            <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                    Sources ({sources?.length || 0})
                </div>
                {(!sources || sources.length === 0) ? (
                    <div style={{
                        padding: '24px 16px', textAlign: 'center', borderRadius: 12,
                        background: 'var(--bg-secondary, #f9fafb)',
                        border: '1px dashed var(--border-subtle, #e5e7eb)',
                    }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>🧾</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                            No documents yet. Use <strong>Scan Gmail & Drive</strong> or add sources manually.
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {sources.map(source => {
                            const meta = source.metadata || {};
                            const categoryIcon = meta.taxCategory === 'income' ? '📥' : meta.taxCategory === 'expense' ? '📤' : '📄';
                            return (
                                <button
                                    key={source.id}
                                    onClick={() => onSourceClick?.(source)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        padding: '10px 12px', borderRadius: 10,
                                        background: 'var(--bg-secondary, #f9fafb)',
                                        border: '1px solid var(--border-subtle, #e5e7eb)',
                                        cursor: 'pointer', textAlign: 'left', width: '100%',
                                        transition: 'background 0.15s',
                                    }}
                                >
                                    <span style={{ fontSize: 16, flexShrink: 0 }}>{categoryIcon}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>
                                            {source.name}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                            {source.type} · {(source.wordCount || 0).toLocaleString()} words
                                            {meta.amount ? ` · €${meta.amount.toFixed(2)}` : ''}
                                        </div>
                                    </div>
                                    {source.status === 'processing' && <Loader2 size={12} className="animate-spin" style={{ color: '#f59e0b' }} />}
                                    {source.status === 'ready' && <CheckCircle2 size={12} style={{ color: '#059669' }} />}
                                    {source.status === 'error' && <AlertCircle size={12} style={{ color: '#ef4444' }} />}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Refresh */}
            <button
                onClick={fetchDashboard}
                disabled={loading}
                style={{
                    display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
                    width: '100%', padding: '10px', borderRadius: 10, cursor: 'pointer',
                    border: '1px solid var(--border-subtle, #e5e7eb)',
                    background: 'transparent', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600,
                    marginTop: 8,
                }}
            >
                <RefreshCw size={12} /> Refresh Dashboard
            </button>
        </div>
    );
}

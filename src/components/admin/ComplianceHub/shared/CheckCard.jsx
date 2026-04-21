import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle, ChevronDown, ArrowRight, RefreshCw } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';

const STATUS_STYLES = {
    pass: { color: '#10b981', Icon: CheckCircle2, labelKey: 'compliance.status_pass' },
    warn: { color: '#f59e0b', Icon: AlertTriangle, labelKey: 'compliance.status_warn' },
    fail: { color: '#ef4444', Icon: XCircle, labelKey: 'compliance.status_fail' },
    not_applicable: { color: '#6b7280', Icon: MinusCircle, labelKey: 'compliance.status_na' },
    pending: { color: '#6b7280', Icon: MinusCircle, labelKey: 'compliance.status_pending' },
};

const SEVERITY_COLOR = {
    critical: '#ef4444', high: '#f59e0b', medium: '#3b82f6', low: '#6b7280',
};

const SEVERITY_LABEL_KEY = {
    critical: 'compliance.sev_critical',
    high: 'compliance.sev_high',
    medium: 'compliance.sev_medium',
    low: 'compliance.sev_low',
};

export default function CheckCard({ check, onNavigate, onRerun, rerunning, focus = false }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(focus);
    const rootRef = useRef(null);
    const s = STATUS_STYLES[check.status] || STATUS_STYLES.pending;
    const Icon = s.Icon;
    const remediationHref = check.remediationLink ? `/${check.remediationLink.replace(/^\//, '')}` : null;

    // When the card is focused (navigated to from Overview open-items),
    // scroll it into view and auto-expand once.
    useEffect(() => {
        if (!focus) return;
        setOpen(true);
        const el = rootRef.current;
        if (el && typeof el.scrollIntoView === 'function') {
            const id = setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
            return () => clearTimeout(id);
        }
    }, [focus]);

    const title = t(check.titleKey) || check.check_id;
    const description = t(check.descriptionKey) || '';
    const remediation = t(check.remediationKey) || '';

    const severityLabel = t(SEVERITY_LABEL_KEY[check.severity]) || check.severity;

    return (
        <div ref={rootRef} style={{
            border: `1px solid ${s.color}33`,
            borderLeft: `4px solid ${s.color}`,
            background: 'var(--bg-secondary, #1a1a2e)',
            borderRadius: 10,
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            boxShadow: focus ? `0 0 0 2px ${s.color}55` : 'none',
            transition: 'box-shadow 0.2s',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icon size={22} style={{ color: s.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>{title}</span>
                        <span style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                            padding: '2px 6px', borderRadius: 4,
                            background: `${SEVERITY_COLOR[check.severity] || '#6b7280'}22`,
                            color: SEVERITY_COLOR[check.severity] || '#9ca3af',
                            textTransform: 'uppercase',
                        }}>{severityLabel}</span>
                        <span style={{
                            fontSize: 10, fontWeight: 600,
                            padding: '2px 6px', borderRadius: 4,
                            background: 'var(--bg-tertiary, rgba(255,255,255,0.05))',
                            color: 'var(--text-muted, #888)',
                        }}>Art. {check.article}</span>
                    </div>
                    {check.details && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary, #aaa)', marginTop: 4, lineHeight: 1.4 }}>
                            {check.details}
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {onRerun && (
                        <button onClick={() => onRerun(check.check_id)} disabled={rerunning}
                            title={t('compliance.rerun_check')}
                            style={btn('transparent', 'var(--text-muted, #888)')}>
                            <RefreshCw size={14} style={{ animation: rerunning ? 'spin 1s linear infinite' : 'none' }} />
                        </button>
                    )}
                    <button onClick={() => setOpen(v => !v)} style={btn('transparent', 'var(--text-muted, #888)')}>
                        <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                    </button>
                </div>
            </div>

            {/* Expanded body */}
            {open && (
                <div style={{
                    padding: '10px 12px',
                    background: 'var(--bg-primary, rgba(0,0,0,0.2))',
                    borderRadius: 8,
                    fontSize: 12.5,
                    lineHeight: 1.5,
                    color: 'var(--text-secondary, #bbb)',
                    display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                    {description && (
                        <div>
                            <div style={label()}>{t('compliance.why_matters')}</div>
                            <div>{description}</div>
                        </div>
                    )}
                    {remediation && (
                        <div>
                            <div style={label()}>{t('compliance.how_to_fix')}</div>
                            <div>{remediation}</div>
                        </div>
                    )}
                    {check.evidence && (
                        <div>
                            <div style={label()}>{t('compliance.evidence')}</div>
                            <pre style={{
                                margin: 0, fontSize: 11, overflow: 'auto',
                                color: 'var(--text-muted, #888)',
                                background: 'var(--bg-secondary, #1a1a2e)',
                                padding: '8px', borderRadius: 6,
                            }}>{JSON.stringify(check.evidence, null, 2)}</pre>
                        </div>
                    )}
                    {check.status !== 'pass' && remediationHref && onNavigate && (
                        <button onClick={() => onNavigate(remediationHref.replace(/^\//, ''))}
                            style={{
                                ...btn(s.color, '#fff'),
                                padding: '8px 14px', fontSize: 12.5, fontWeight: 600,
                                alignSelf: 'flex-start',
                            }}>
                            {t('compliance.open_fix')} <ArrowRight size={14} />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

function btn(bg, color) {
    return {
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: bg, color, border: 'none',
        padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
        fontFamily: 'inherit',
    };
}

function label() {
    return {
        fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
        textTransform: 'uppercase', color: 'var(--text-muted, #666)', marginBottom: 4,
    };
}

import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle, ChevronDown, ArrowRight, RefreshCw, Wand2 } from 'lucide-react';
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

// How the result was established (registry.js `verification`). Attested items
// are visually distinct so a passing card never overstates what the tool
// actually verified.
const VERIFICATION_BADGE = {
    automated: { labelKey: 'compliance.verification_automated', color: '#10b981' },
    attestation: { labelKey: 'compliance.verification_attestation', color: '#f59e0b' },
    hybrid: { labelKey: 'compliance.verification_hybrid', color: '#3b82f6' },
};

export default function CheckCard({ check, onNavigate, onRerun, rerunning, onAutoFix, autoFixing, onLoadTrail, focus = false }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(focus);
    const [confirmFix, setConfirmFix] = useState(false);
    const [trailOpen, setTrailOpen] = useState(false);
    const [trail, setTrail] = useState(null);       // { history, evidence } once loaded
    const [trailLoading, setTrailLoading] = useState(false);
    const rootRef = useRef(null);

    const toggleTrail = async () => {
        const next = !trailOpen;
        setTrailOpen(next);
        if (next && trail === null && onLoadTrail) {
            setTrailLoading(true);
            try { setTrail(await onLoadTrail(check.check_id)); }
            catch { setTrail({ history: [], evidence: [] }); }
            finally { setTrailLoading(false); }
        }
    };
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
                        }}>{/* ISO refs (A.8.24, cl9.2) are self-labeling; GDPR/AIA articles get the Art. prefix */}
                            {/^(A\.|cl)/.test(String(check.article || '')) ? check.article : `Art. ${check.article}`}</span>
                        {VERIFICATION_BADGE[check.verification] && (
                            <span title={t(`${VERIFICATION_BADGE[check.verification].labelKey}_hint`)} style={{
                                fontSize: 10, fontWeight: 600,
                                padding: '2px 6px', borderRadius: 4,
                                background: `${VERIFICATION_BADGE[check.verification].color}18`,
                                color: VERIFICATION_BADGE[check.verification].color,
                            }}>{t(VERIFICATION_BADGE[check.verification].labelKey)}</span>
                        )}
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
                    {onLoadTrail && (
                        <div>
                            <button onClick={toggleTrail} style={{
                                ...btn('transparent', 'var(--text-muted, #999)'),
                                padding: '4px 0', fontSize: 12, fontWeight: 600,
                            }}>
                                <ChevronDown size={13} style={{ transform: trailOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                                {t('compliance.trail_toggle')}
                            </button>
                            {trailOpen && (
                                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {trailLoading ? (
                                        <div style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>{t('compliance.trail_loading')}</div>
                                    ) : (
                                        <>
                                            <div>
                                                <div style={label()}>{t('compliance.trail_history')}</div>
                                                {(trail?.history || []).length === 0 ? (
                                                    <div style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>{t('compliance.trail_empty')}</div>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                        {(trail.history || []).slice(0, 15).map((h, i) => {
                                                            const hs = STATUS_STYLES[h.status] || STATUS_STYLES.pending;
                                                            return (
                                                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                                                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: hs.color, flexShrink: 0 }} />
                                                                    <span style={{ color: hs.color, fontWeight: 600, width: 88, flexShrink: 0 }}>{t(hs.labelKey)}</span>
                                                                    <span style={{ color: 'var(--text-muted, #888)' }}>{h.run_at ? new Date(h.run_at).toLocaleString() : '—'}</span>
                                                                    {h.run_type && <span style={{ color: 'var(--text-muted, #666)', fontSize: 10.5 }}>({h.run_type})</span>}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <div style={label()}>{t('compliance.trail_evidence')}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginBottom: 4 }}>
                                                    {t('compliance.trail_evidence_hint')}
                                                </div>
                                                {(trail?.evidence || []).length === 0 ? (
                                                    <div style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>{t('compliance.trail_empty')}</div>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, overflow: 'auto' }}>
                                                        {(trail.evidence || []).slice(0, 15).map((ev, i) => (
                                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                                                                <span style={{ color: 'var(--text-muted, #888)', flexShrink: 0 }}>
                                                                    {ev.captured_at ? new Date(ev.captured_at).toLocaleString() : '—'}
                                                                </span>
                                                                <code style={{
                                                                    fontSize: 10, color: 'var(--text-muted, #777)',
                                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                                }} title={ev.hash}>
                                                                    sha256:{String(ev.hash || '').slice(0, 16)}…
                                                                </code>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {check.status !== 'pass' && remediationHref && onNavigate && (
                            <button onClick={() => onNavigate(remediationHref.replace(/^\//, ''))}
                                style={{
                                    ...btn(s.color, '#fff'),
                                    padding: '8px 14px', fontSize: 12.5, fontWeight: 600,
                                }}>
                                {t('compliance.open_fix')} <ArrowRight size={14} />
                            </button>
                        )}
                        {check.autoFixId && onAutoFix
                            && check.status !== 'pass' && check.status !== 'not_applicable' && !confirmFix && (
                            <button onClick={() => setConfirmFix(true)} disabled={autoFixing}
                                style={{
                                    ...btn('var(--accent-primary, #6366f1)', '#fff'),
                                    padding: '8px 14px', fontSize: 12.5, fontWeight: 600,
                                    opacity: autoFixing ? 0.6 : 1,
                                }}>
                                <Wand2 size={14} style={{ animation: autoFixing ? 'spin 1s linear infinite' : 'none' }} />
                                {autoFixing ? t('compliance.auto_fixing') : t('compliance.auto_fix')}
                            </button>
                        )}
                    </div>
                    {confirmFix && (
                        <div style={{
                            border: '1px solid var(--accent-primary, #6366f1)',
                            borderRadius: 8, padding: '12px 14px',
                            display: 'flex', flexDirection: 'column', gap: 8,
                        }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>
                                {t('compliance.auto_fix_confirm_title')}
                            </div>
                            <div>{t('compliance.auto_fix_confirm_desc')}</div>
                            {Array.isArray(check.evidence?.missing_disclosure) && check.evidence.missing_disclosure.length > 0 && (
                                <div>
                                    <div style={label()}>{t('compliance.auto_fix_affected')}</div>
                                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                                        {check.evidence.missing_disclosure.map(a => (
                                            <li key={a.id}>{a.name || a.id}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => { setConfirmFix(false); onAutoFix(check.check_id); }}
                                    style={{ ...btn('var(--accent-primary, #6366f1)', '#fff'), fontSize: 12.5, fontWeight: 600 }}>
                                    <Wand2 size={14} /> {t('compliance.auto_fix_apply')}
                                </button>
                                <button onClick={() => setConfirmFix(false)}
                                    style={{ ...btn('transparent', 'var(--text-muted, #888)'), fontSize: 12.5 }}>
                                    {t('compliance.auto_fix_cancel')}
                                </button>
                            </div>
                        </div>
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

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CheckSquare, Mail, Clock, Zap, Brain, AlertTriangle, ChevronDown, ChevronRight, Trash2, Check, X, Play, Search, Loader2, Sparkles, ArrowLeft, Filter, RotateCw, Copy, Pause, RefreshCw, AlertCircle } from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';
import NotificationCenter from '../components/NotificationCenter';
import ModelTierSelector from '../components/ModelTierSelector';
import ReactMarkdown from 'react-markdown';

/* ─── Design tokens ─── */
const COLORS = {
    bg: 'var(--bg-primary, #fafafa)',
    bgCard: 'var(--bg-card, #ffffff)',
    bgSec: 'var(--bg-secondary, #f3f3f3)',
    border: 'var(--border-subtle, rgba(0,0,0,0.06))',
    borderDefault: 'var(--border-default, rgba(0,0,0,0.12))',
    text: 'var(--text-primary, #0f172a)',
    textSec: 'var(--text-secondary, #334155)',
    textMuted: 'var(--text-muted, #64748b)',
    accent: '#8b5cf6',
    accentBg: 'rgba(139, 92, 246, 0.08)',
    green: '#059669',
    red: '#dc2626',
    amber: '#d97706',
    blue: '#3b82f6',
};

const TRIGGER_BADGES = {
    schedule: { icon: Clock, color: COLORS.blue, label: 'Scheduled' },
    email_received: { icon: Mail, color: COLORS.green, label: 'Email Trigger' },
    email_pattern: { icon: Zap, color: COLORS.amber, label: 'Pattern' },
    manual: { icon: Play, color: COLORS.textMuted, label: 'Manual' },
    event_upcoming: { icon: Clock, color: COLORS.blue, label: 'Before Event' },
    event_ended: { icon: Clock, color: COLORS.green, label: 'After Event' },
    meeting_ended: { icon: Clock, color: '#7C3AED', label: 'After Meeting' },
};

const STATUS_BADGES = {
    pending: { color: COLORS.amber, label: 'Pending' },
    approved: { color: COLORS.blue, label: 'Approved' },
    running: { color: COLORS.accent, label: 'Running' },
    completed: { color: COLORS.green, label: 'Completed' },
    failed: { color: COLORS.red, label: 'Failed' },
    rejected: { color: COLORS.textMuted, label: 'Rejected' },
    queued: { color: '#a78bfa', label: 'Queued' },
    paused: { color: '#6b7280', label: 'Paused' },
    awaiting_approval: { color: '#f59e0b', label: 'Awaiting Approval' },
};

const SOURCE_ICONS = {
    gmail: '✉️', calendar: '📅', drive: '📁', slides: '📊',
    sheets: '📗', docs: '📝', fireflies: '🎙️', youtrack: '🎯', gamma: '🎨', cross_app: '🔀', manual: '✋',
};

/* ─── Trigger Description ─── */
function describeTrigger(trigger) {
    if (!trigger?.type) return 'Manual trigger';
    const cfg = trigger.config || {};
    switch (trigger.type) {
        case 'schedule':
            return cfg.human_readable || cfg.cron || 'On a schedule';
        case 'email_received':
            const parts = [];
            if (cfg.from) parts.push(`from ${cfg.from}`);
            if (cfg.subject_contains) parts.push(`subject contains "${cfg.subject_contains}"`);
            if (cfg.has_attachment) parts.push('with attachments');
            return parts.length > 0 ? `When email ${parts.join(', ')}` : 'When email received';
        case 'email_pattern':
            return cfg.pattern_description || `Recurring pattern (${cfg.frequency || 'unknown frequency'})`;
        case 'manual':
            return cfg.description || 'Run on demand';
        default:
            return trigger.type;
    }
}

/* ─── Proposal Card (from scan results) ─── */
function ProposalCard({ proposal, onApply, onDismiss, applying }) {
    const [expanded, setExpanded] = useState(false);
    const trigger = TRIGGER_BADGES[proposal.trigger?.type] || TRIGGER_BADGES.manual;
    const TriggerIcon = trigger.icon;

    return (
        <div style={{
            padding: 16, borderRadius: 12,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.bgCard,
            transition: 'border-color 0.15s',
        }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, background: `${trigger.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TriggerIcon style={{ width: 18, height: 18, color: trigger.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <h4 style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, margin: 0 }}>{proposal.title}</h4>
                        {proposal.requires_ai && (
                            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(139,92,246,0.12)', color: COLORS.accent, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Brain style={{ width: 10, height: 10 }} /> AI
                            </span>
                        )}
                    </div>
                    <p style={{ fontSize: 12, color: COLORS.textSec, margin: 0, lineHeight: 1.5 }}>{proposal.description}</p>

                    {/* Trigger badge */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: `${trigger.color}12`, color: trigger.color, fontWeight: 500 }}>
                            {trigger.label}: {describeTrigger(proposal.trigger)}
                        </span>
                        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: `${COLORS.amber}12`, color: COLORS.amber, fontWeight: 500 }}>
                            {proposal.priority} priority
                        </span>
                    </div>

                    {/* Expand for details */}
                    <button onClick={() => setExpanded(!expanded)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 11, color: COLORS.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        {expanded ? <ChevronDown style={{ width: 12, height: 12 }} /> : <ChevronRight style={{ width: 12, height: 12 }} />}
                        {expanded ? 'Hide details' : 'Show details'}
                    </button>

                    {expanded && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${COLORS.border}` }}>
                            {/* Conditions */}
                            {proposal.conditions?.length > 0 && (
                                <div style={{ marginBottom: 8 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: COLORS.textMuted }}>Conditions</span>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                        {proposal.conditions.map((c, i) => (
                                            <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', color: COLORS.textSec, border: `1px solid ${COLORS.border}` }}>
                                                {c.description || `${c.field} ${c.operator} ${c.value}`}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {/* Actions */}
                            {proposal.actions?.length > 0 && (
                                <div style={{ marginBottom: 8 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: COLORS.textMuted }}>Actions</span>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
                                        {proposal.actions.map((a, i) => (
                                            <div key={i} style={{ fontSize: 11, color: COLORS.textSec, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ width: 4, height: 4, borderRadius: 2, background: COLORS.accent, flexShrink: 0 }} />
                                                {a.description || `${a.type}: ${JSON.stringify(a.config || {})}`}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {/* Reasoning */}
                            {proposal.reasoning && (
                                <div style={{ fontSize: 11, color: COLORS.textMuted, fontStyle: 'italic', marginTop: 4 }}>
                                    💡 {proposal.reasoning}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={onDismiss}
                        style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.textMuted, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s' }}
                        title="Dismiss">Dismiss</button>
                    <button onClick={onApply} disabled={applying}
                        style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: applying ? COLORS.textMuted : COLORS.accent, color: '#fff', fontSize: 12, fontWeight: 600, cursor: applying ? 'wait' : 'pointer', transition: 'all 0.15s', opacity: applying ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {applying ? <Loader2 style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }} /> : <Check style={{ width: 12, height: 12 }} />}
                        Apply
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Task Card (from database) ─── */
function TaskCard({ task, onApprove, onReject, onDelete, onRun, onRetry, onPause, onDuplicate, onApproveExecution, onSkipExecution, runningId }) {
    const [expanded, setExpanded] = useState(false);
    const [showTechnical, setShowTechnical] = useState(false);
    const status = STATUS_BADGES[task.status] || STATUS_BADGES.pending;
    const trigger = TRIGGER_BADGES[task.trigger_config?.type || task.type] || TRIGGER_BADGES.manual;
    const TriggerIcon = trigger.icon;
    const sourceEmoji = SOURCE_ICONS[task.source] || SOURCE_ICONS.manual;
    const hasScopeError = task.result?.scopeError;

    return (
        <div style={{
            padding: 14, borderRadius: 12,
            border: `1px solid ${hasScopeError ? `${COLORS.red}40` : COLORS.border}`,
            background: COLORS.bgCard,
            boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))',
        }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, background: `${trigger.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TriggerIcon style={{ width: 16, height: 16, color: trigger.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                        <span style={{ fontSize: 13 }}>{sourceEmoji}</span>
                        <h4 style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, margin: 0 }}>{task.title}</h4>
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: `${status.color}10`, color: status.color, fontWeight: 600 }}>
                            {status.label}
                        </span>
                        {task.requires_ai && (
                            <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: COLORS.accentBg, color: COLORS.accent, fontWeight: 600 }}>AI</span>
                        )}
                    </div>
                    <p style={{ fontSize: 11, color: COLORS.textSec, margin: 0 }}>{task.description}</p>

                    {task.trigger_config?.type && (
                        <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 4 }}>
                            ⚡ {describeTrigger({ type: task.trigger_config?.type, config: task.trigger_config })}
                        </div>
                    )}

                    {/* Scope error alert */}
                    {hasScopeError && (
                        <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 6, background: `${COLORS.red}08`, border: `1px solid ${COLORS.red}20`, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: COLORS.red }}>
                            <AlertCircle style={{ width: 12, height: 12, flexShrink: 0 }} />
                            Re-authenticate with Google to grant updated permissions
                        </div>
                    )}

                    <button onClick={() => setExpanded(!expanded)}
                        style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 6, fontSize: 10, color: COLORS.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        {expanded ? <ChevronDown style={{ width: 10, height: 10 }} /> : <ChevronRight style={{ width: 10, height: 10 }} />}
                        Details
                    </button>

                    {expanded && (
                        <div style={{ marginTop: 8, fontSize: 11, color: COLORS.textSec }}>
                            {/* Pending changes preview — always visible for awaiting_approval */}
                            {task.status === 'awaiting_approval' && task.pending_changes && (() => {
                                const pc = task.pending_changes;
                                const changes = Array.isArray(pc) ? pc : (pc.changes || []);
                                return (
                                    <div style={{ marginTop: 4, padding: 10, borderRadius: 8, background: `${COLORS.amber}08`, border: `1px solid ${COLORS.amber}30` }}>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.amber, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            ⚡ Trigger matched — {changes.length} change{changes.length > 1 ? 's' : ''} pending
                                        </div>
                                        {changes.map((c, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '4px 0', borderBottom: i < changes.length - 1 ? `1px solid ${COLORS.border}` : 'none' }}>
                                                <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: `${COLORS.accent}10`, color: COLORS.accent, fontWeight: 600, flexShrink: 0 }}>{c.type}</span>
                                                <div>
                                                    <div style={{ fontSize: 11, color: COLORS.text }}>{c.target}</div>
                                                    <div style={{ fontSize: 10, color: COLORS.textMuted }}>{c.detail}</div>
                                                </div>
                                            </div>
                                        ))}
                                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                            <button onClick={() => onApproveExecution(task.id)}
                                                style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: COLORS.green, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                                ✓ Approve & Execute
                                            </button>
                                            <button onClick={() => onSkipExecution(task.id)}
                                                style={{ padding: '6px 16px', borderRadius: 6, border: `1px solid ${COLORS.border}`, background: COLORS.bgCard, color: COLORS.textSec, fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
                                                Skip
                                            </button>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Result summary — user-friendly, no raw logs */}
                            {task.result && (
                                <div style={{ marginTop: 6, padding: 8, borderRadius: 6, background: COLORS.bgSec, border: `1px solid ${COLORS.border}` }}>
                                    <strong>Last Result:</strong>
                                    {task.result.message && (
                                        <div style={{ marginTop: 4, fontSize: 11, color: COLORS.textSec }}>{task.result.message}</div>
                                    )}
                                    {task.result.results?.map((r, i) => (
                                        <div key={i} style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, color: r.success ? COLORS.green : COLORS.red }}>
                                            {r.success ? <Check style={{ width: 10, height: 10 }} /> : <X style={{ width: 10, height: 10 }} />}
                                            <span>{r.action}:</span>
                                            <span style={{ color: COLORS.textSec }}>{r.summary || r.data || r.message || (r.success ? 'OK' : r.error)}</span>
                                            {r.errorType && (
                                                <span style={{ fontSize: 9, padding: '0 4px', borderRadius: 3, background: `${COLORS.red}10`, color: COLORS.red, fontWeight: 600 }}>{r.errorType}</span>
                                            )}
                                        </div>
                                    ))}
                                    {task.result.executedAt && (
                                        <div style={{ marginTop: 4, color: COLORS.textMuted, fontSize: 10 }}>Executed: {new Date(task.result.executedAt).toLocaleString()}</div>
                                    )}
                                    {task.result.checkedAt && !task.result.executedAt && (
                                        <div style={{ marginTop: 4, color: COLORS.textMuted, fontSize: 10 }}>Checked: {new Date(task.result.checkedAt).toLocaleString()}</div>
                                    )}
                                </div>
                            )}

                            {/* Timestamps */}
                            <div style={{ color: COLORS.textMuted, fontSize: 10, marginTop: 4 }}>
                                Created {new Date(task.created_at).toLocaleString()}
                                {task.approved_by && ` • Approved by ${task.approved_by}`}
                                {task.last_run_at && ` • Last run: ${new Date(task.last_run_at).toLocaleString()}`}
                                {task.run_count > 0 && ` • Runs: ${task.run_count}`}
                            </div>

                            {/* Technical Details — secondary toggle */}
                            {(task.script || task.conditions?.length > 0 || task.actions?.length > 0 || task.result?.log?.length > 0 || (task.pending_changes && (task.pending_changes.log || []).length > 0)) && (
                                <div style={{ marginTop: 8 }}>
                                    <button onClick={() => setShowTechnical(!showTechnical)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: COLORS.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', opacity: 0.8 }}>
                                        {showTechnical ? <ChevronDown style={{ width: 10, height: 10 }} /> : <ChevronRight style={{ width: 10, height: 10 }} />}
                                        Technical Details
                                    </button>
                                    {showTechnical && (
                                        <div style={{ marginTop: 6, padding: 8, borderRadius: 6, background: COLORS.bg, border: `1px dashed ${COLORS.border}` }}>
                                            {task.conditions?.length > 0 && (
                                                <div style={{ marginBottom: 6 }}>
                                                    <strong>Conditions:</strong> {task.conditions.map(c => c.description || `${c.field} ${c.operator} ${c.value}`).join('; ')}
                                                </div>
                                            )}
                                            {task.actions?.length > 0 && (
                                                <div style={{ marginBottom: 6 }}>
                                                    <strong>Actions:</strong> {task.actions.map(a => a.description || a.type).join(' → ')}
                                                </div>
                                            )}
                                            {task.script && (
                                                <div style={{ marginBottom: 6 }}>
                                                    <strong>Script:</strong>
                                                    <pre style={{ margin: '4px 0', padding: 8, borderRadius: 6, background: COLORS.bgSec, border: `1px solid ${COLORS.border}`, fontSize: 10, fontFamily: 'monospace', overflow: 'auto', maxHeight: 120, whiteSpace: 'pre-wrap', color: COLORS.textSec }}>
                                                        {task.script.substring(0, 500)}{task.script.length > 500 ? '...' : ''}
                                                    </pre>
                                                </div>
                                            )}
                                            {/* Tool call logs from pending changes */}
                                            {task.pending_changes && (() => {
                                                const pcLog = (Array.isArray(task.pending_changes) ? [] : task.pending_changes.log) || [];
                                                if (pcLog.length === 0) return null;
                                                return (
                                                    <div style={{ marginTop: 6, padding: 6, borderRadius: 6, background: COLORS.bgSec, fontSize: 10, fontFamily: 'monospace' }}>
                                                        <div style={{ fontWeight: 600, color: COLORS.textSec, marginBottom: 4, fontFamily: 'inherit' }}>Tool calls:</div>
                                                        {pcLog.map((e, i) => (
                                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0', color: e.success ? COLORS.green : COLORS.red }}>
                                                                {e.success ? <Check style={{ width: 8, height: 8 }} /> : <X style={{ width: 8, height: 8 }} />}
                                                                <span style={{ color: COLORS.accent }}>{e.tool}</span>
                                                                {e.args && <span style={{ color: COLORS.textMuted }}>({e.args.substring(0, 50)})</span>}
                                                                <span style={{ color: COLORS.textSec }}>→ {e.summary}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            })()}
                                            {/* Execution log from results */}
                                            {task.result?.log?.length > 0 && (
                                                <div style={{ marginTop: 6, padding: 6, borderRadius: 6, background: COLORS.bgSec, fontSize: 10, fontFamily: 'monospace' }}>
                                                    <div style={{ fontWeight: 600, color: COLORS.textSec, marginBottom: 4, fontFamily: 'inherit' }}>Execution log ({task.result.log.length} calls):</div>
                                                    {task.result.log.map((e, i) => (
                                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0', color: e.success ? COLORS.green : COLORS.red }}>
                                                            {e.success ? <Check style={{ width: 8, height: 8 }} /> : <X style={{ width: 8, height: 8 }} />}
                                                            <span style={{ color: COLORS.accent }}>{e.tool}</span>
                                                            {e.args && <span style={{ color: COLORS.textMuted }}>({e.args.length > 50 ? e.args.substring(0, 50) + '…' : e.args})</span>}
                                                            <span style={{ color: COLORS.textSec }}>→ {e.summary}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {/* Run button */}
                    {['approved', 'queued', 'completed', 'failed'].includes(task.status) && (
                        <button onClick={() => onRun(task.id)} title="Run Now" disabled={runningId === task.id}
                            style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: `${COLORS.accent}10`, color: COLORS.accent, cursor: runningId === task.id ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {runningId === task.id ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Play style={{ width: 14, height: 14 }} />}
                        </button>
                    )}
                    {/* Retry button for failed tasks */}
                    {task.status === 'failed' && (
                        <button onClick={() => onRetry(task.id)} title="Retry"
                            style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: `${COLORS.amber}10`, color: COLORS.amber, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <RefreshCw style={{ width: 14, height: 14 }} />
                        </button>
                    )}
                    {/* Pause/Resume for approved or paused */}
                    {(task.status === 'approved' || task.status === 'paused') && (
                        <button onClick={() => onPause(task.id)} title={task.status === 'paused' ? 'Resume' : 'Pause'}
                            style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: `${COLORS.textMuted}10`, color: COLORS.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {task.status === 'paused' ? <Play style={{ width: 14, height: 14 }} /> : <Pause style={{ width: 14, height: 14 }} />}
                        </button>
                    )}
                    {/* Approve/Reject for pending */}
                    {task.status === 'pending' && (
                        <>
                            <button onClick={() => onApprove(task.id)} title="Approve"
                                style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: `${COLORS.green}10`, color: COLORS.green, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Check style={{ width: 14, height: 14 }} />
                            </button>
                            <button onClick={() => onReject(task.id)} title="Reject"
                                style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: `${COLORS.red}10`, color: COLORS.red, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X style={{ width: 14, height: 14 }} />
                            </button>
                        </>
                    )}
                    {/* Duplicate */}
                    <button onClick={() => onDuplicate(task.id)} title="Duplicate"
                        style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: COLORS.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Copy style={{ width: 13, height: 13 }} />
                    </button>
                    {/* Delete */}
                    <button onClick={() => onDelete(task.id)} title="Delete"
                        style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: COLORS.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 style={{ width: 13, height: 13 }} />
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Scan Progress (simple for single-app scans) ─── */
function ScanProgressSimple({ status, progress }) {
    return (
        <div style={{ padding: 20, borderRadius: 12, border: `1px solid ${COLORS.accent}30`, background: COLORS.accentBg, textAlign: 'center' }}>
            <Loader2 style={{ width: 24, height: 24, color: COLORS.accent, margin: '0 auto 8px', animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: 13, fontWeight: 500, color: COLORS.text, margin: '0 0 4px' }}>{status || 'Scanning...'}</p>
            {progress && <p style={{ fontSize: 11, color: COLORS.textSec, margin: 0 }}>{progress}</p>}
        </div>
    );
}

/* ─── Phased Scan Progress (for cross-app scans) ─── */
const PHASE_DEFS = [
    { id: 'discovery', icon: Search, label: 'Discovery', desc: 'Exploring your data' },
    { id: 'analysis', icon: Brain, label: 'Analysis', desc: 'Finding connections' },
    { id: 'proposals', icon: Sparkles, label: 'Proposals', desc: 'Generating automations' },
];

function ScanProgressPhased({ phases, currentPhase, status }) {
    const [expandedPhase, setExpandedPhase] = useState(null);

    return (
        <div style={{ padding: 20, borderRadius: 12, border: `1px solid ${COLORS.accent}20`, background: COLORS.bgCard, boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))' }}>
            {/* Phase stepper */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 16 }}>
                {PHASE_DEFS.map((pd, i) => {
                    const phaseData = phases.find(p => p.id === pd.id);
                    const isActive = currentPhase === pd.id;
                    const isDone = phaseData?.done;
                    const PhaseIcon = pd.icon;

                    return (
                        <div key={pd.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                            {/* Connector line */}
                            {i > 0 && (
                                <div style={{
                                    position: 'absolute', top: 16, left: 0, right: '50%', height: 2,
                                    background: isDone || isActive ? COLORS.accent : COLORS.border,
                                    transition: 'background 0.3s',
                                }} />
                            )}
                            {i < PHASE_DEFS.length - 1 && (
                                <div style={{
                                    position: 'absolute', top: 16, left: '50%', right: 0, height: 2,
                                    background: isDone ? COLORS.accent : COLORS.border,
                                    transition: 'background 0.3s',
                                }} />
                            )}

                            {/* Circle */}
                            <div style={{
                                width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: isDone ? COLORS.accent : isActive ? `${COLORS.accent}15` : COLORS.bgSec,
                                border: `2px solid ${isDone ? COLORS.accent : isActive ? COLORS.accent : COLORS.border}`,
                                transition: 'all 0.3s', position: 'relative', zIndex: 1,
                            }}>
                                {isDone ? (
                                    <Check style={{ width: 14, height: 14, color: '#fff' }} />
                                ) : isActive ? (
                                    <Loader2 style={{ width: 14, height: 14, color: COLORS.accent, animation: 'spin 1s linear infinite' }} />
                                ) : (
                                    <PhaseIcon style={{ width: 14, height: 14, color: COLORS.textMuted }} />
                                )}
                            </div>

                            {/* Label */}
                            <span style={{
                                fontSize: 11, fontWeight: isActive ? 600 : 400, marginTop: 6,
                                color: isDone || isActive ? COLORS.text : COLORS.textMuted,
                            }}>{pd.label}</span>

                            {/* Tool count badge */}
                            {phaseData?.toolCalls > 0 && (
                                <span style={{ fontSize: 9, color: COLORS.textMuted, marginTop: 2 }}>
                                    {phaseData.toolCalls} queries
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Current status */}
            {status && (
                <div style={{ textAlign: 'center', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {currentPhase && <span className="scan-pulse-dot" />}
                    <p style={{ fontSize: 13, fontWeight: 500, color: COLORS.text, margin: 0 }}>{status}</p>
                </div>
            )}

            {/* Phase summaries — collapsible with markdown */}
            {phases.filter(p => p.done && p.summary).map(p => {
                const isExpanded = expandedPhase === p.id;
                const phaseDef = PHASE_DEFS.find(d => d.id === p.id);
                return (
                    <div key={p.id} style={{
                        marginTop: 8, borderRadius: 8,
                        background: COLORS.bgSec, border: `1px solid ${COLORS.border}`,
                        overflow: 'hidden', transition: 'all 0.15s',
                    }}>
                        <button
                            onClick={() => setExpandedPhase(isExpanded ? null : p.id)}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                                padding: '8px 12px', border: 'none', background: 'transparent',
                                cursor: 'pointer', textAlign: 'left',
                            }}
                        >
                            <Check style={{ width: 12, height: 12, color: COLORS.green, flexShrink: 0 }} />
                            <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.text }}>{phaseDef?.label}</span>
                            {p.appsUsed?.length > 0 && (
                                <span style={{ fontSize: 9, color: COLORS.textMuted, padding: '1px 5px', borderRadius: 4, background: `${COLORS.accent}10` }}>
                                    {p.appsUsed.join(', ')}
                                </span>
                            )}
                            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                                <ChevronDown style={{
                                    width: 12, height: 12, color: COLORS.textMuted,
                                    transition: 'transform 0.15s',
                                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                }} />
                            </span>
                        </button>
                        {isExpanded && (
                            <div className="scan-phase-md" style={{
                                padding: '0 12px 10px',
                                fontSize: 12, color: COLORS.textSec, lineHeight: 1.6,
                            }}>
                                <ReactMarkdown
                                    components={{
                                        p: ({ children }) => <p style={{ margin: '4px 0' }}>{children}</p>,
                                        strong: ({ children }) => <strong style={{ color: COLORS.text, fontWeight: 600 }}>{children}</strong>,
                                        em: ({ children }) => <em style={{ color: COLORS.accent }}>{children}</em>,
                                        ul: ({ children }) => <ul style={{ margin: '4px 0', paddingLeft: 18 }}>{children}</ul>,
                                        ol: ({ children }) => <ol style={{ margin: '4px 0', paddingLeft: 18 }}>{children}</ol>,
                                        li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
                                        code: ({ children }) => <code style={{ fontSize: 11, padding: '1px 4px', borderRadius: 3, background: `${COLORS.accent}10`, color: COLORS.accent }}>{children}</code>,
                                        a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.accent, textDecoration: 'underline' }}>{children}</a>,
                                    }}
                                >{p.summary}</ReactMarkdown>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/* ─── Main TasksPage ─── */
export default function TasksPage({ user, onBack, onNavigate }) {
    const [activeTab, setActiveTab] = useState('discover');
    const [tasks, setTasks] = useState([]);
    const [proposals, setProposals] = useState([]);
    const [scanning, setScanning] = useState(false);
    const [scanStatus, setScanStatus] = useState('');
    const [scanProgress, setScanProgress] = useState('');
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [applyingId, setApplyingId] = useState(null);
    const [runningId, setRunningId] = useState(null);
    const [scanPhases, setScanPhases] = useState([]);
    const [currentPhase, setCurrentPhase] = useState(null);
    const [scanAppId, setScanAppId] = useState(null);
    const [scanTier, setScanTier] = useState('auto');
    const [modelTiers, setModelTiers] = useState({});
    const [scanFocus, setScanFocus] = useState('');
    const [crossAppApps, setCrossAppApps] = useState(['gmail', 'calendar', 'drive', 'slides', 'sheets', 'docs', 'fireflies', 'youtrack', 'gamma']);
    const heartbeatRef = useRef(null);
    const pollRef = useRef(null);

    // Load tasks from DB
    const loadTasks = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/tasks`);
            if (res.ok) setTasks(await res.json());
        } catch (err) {
            console.error('Failed to load tasks:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadTasks(); }, [loadTasks]);

    // Load model tiers for the selector
    useEffect(() => {
        authFetch(`${API_BASE}/ai/config/chat-models`)
            .then(r => r.ok ? r.json() : {})
            .then(data => setModelTiers(data))
            .catch(() => { });
    }, []);

    // Heartbeat: send presence signal every 30s while page is mounted
    useEffect(() => {
        const sendHeartbeat = () => {
            authFetch(`${API_BASE}/api/tasks/heartbeat`, { method: 'POST' }).catch(() => { });
        };
        sendHeartbeat(); // immediate
        heartbeatRef.current = setInterval(sendHeartbeat, 30 * 1000);
        return () => clearInterval(heartbeatRef.current);
    }, []);

    // Poll tasks every 10s to see live status changes
    useEffect(() => {
        pollRef.current = setInterval(loadTasks, 10 * 1000);
        return () => clearInterval(pollRef.current);
    }, [loadTasks]);

    // Start scan for any app
    const startScan = async (appId = 'gmail') => {
        setScanning(true);
        setProposals([]);
        setScanStatus(`Connecting to ${appId}...`);
        setScanProgress('');
        setScanPhases([]);
        setCurrentPhase(null);
        setScanAppId(appId);

        try {
            const res = await authFetch(`${API_BASE}/api/tasks/scan/${appId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tier: scanTier,
                    focus: scanFocus || undefined,
                    ...(appId === 'cross_app' ? { enabledApps: crossAppApps } : {}),
                }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Scan failed');
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].startsWith('event: ')) {
                        const eventType = lines[i].substring(7).trim();
                        // The data line follows the event line
                        if (i + 1 < lines.length && lines[i + 1].startsWith('data: ')) {
                            try {
                                const data = JSON.parse(lines[i + 1].substring(6));
                                handleScanEvent(eventType, data);
                            } catch (e) { /* ignore parse errors */ }
                            i++; // skip the data line
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Scan error:', err);
            setScanStatus(`Error: ${err.message}`);
        } finally {
            setScanning(false);
        }
    };

    const handleScanEvent = (event, data) => {
        switch (event) {
            case 'scan_started':
                setScanStatus('Scan started...');
                break;
            case 'phase_change':
                setCurrentPhase(data.phase);
                setScanStatus(data.description || `Phase: ${data.title}`);
                setScanPhases(prev => {
                    const exists = prev.find(p => p.id === data.phase);
                    if (exists) return prev;
                    return [...prev, { id: data.phase, title: data.title, done: false, toolCalls: 0, appsUsed: [], summary: '' }];
                });
                break;
            case 'tool_call':
                setScanStatus(`${data.app}: ${data.tool.replace(/_/g, ' ')}`);
                setScanPhases(prev => prev.map(p =>
                    p.id === data.phase ? { ...p, toolCalls: data.queryCount } : p
                ));
                break;
            case 'phase_complete':
                setScanPhases(prev => prev.map(p =>
                    p.id === data.phase ? { ...p, done: true, toolCalls: data.toolCalls || p.toolCalls, summary: data.summary || '', appsUsed: data.appsUsed || p.appsUsed } : p
                ));
                break;
            case 'status':
                setScanStatus(data.message || 'Processing...');
                break;
            case 'emails_fetched':
                setScanStatus(`Found ${data.count} recent emails`);
                setScanProgress('Preparing to analyze...');
                break;
            case 'analyzing':
                setScanStatus(data.message || 'Analyzing with AI...');
                setScanProgress(`${data.emailCount || '?'} emails being analyzed`);
                break;
            case 'task_proposed':
                setProposals(prev => [...prev, data.proposal]);
                break;
            case 'scan_complete':
                setScanStatus(`Scan complete — ${data.proposalCount || 0} automations found`);
                setScanProgress('');
                setCurrentPhase(null);
                break;
            case 'done':
                setScanStatus(`Done — ${data.proposalCount || 0} automations identified`);
                setCurrentPhase(null);
                break;
            case 'error':
                setScanStatus(`Error: ${data.error}`);
                setCurrentPhase(null);
                break;
        }
    };

    // Apply a proposal (create as pending task)
    const applyProposal = async (proposal) => {
        setApplyingId(proposal.id);
        try {
            const res = await authFetch(`${API_BASE}/api/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: proposal.title,
                    description: proposal.description,
                    priority: proposal.priority,
                    type: proposal.trigger?.type === 'schedule' ? 'scheduled' : proposal.trigger?.type === 'email_received' ? 'email_triggered' : proposal.trigger?.type === 'email_pattern' ? 'pattern_triggered' : 'manual',
                    source: proposal.source || 'gmail_scan',
                    trigger_config: proposal.trigger || {},
                    conditions: proposal.conditions || [],
                    actions: proposal.actions || [],
                    script: proposal.script || null,
                    requires_ai: proposal.requires_ai || false,
                    scan_id: proposal.scanId,
                }),
            });
            if (res.ok) {
                const task = await res.json();
                setTasks(prev => [task, ...prev]);
                setProposals(prev => prev.filter(p => p.id !== proposal.id));
            }
        } catch (err) {
            console.error('Failed to apply proposal:', err);
        } finally {
            setApplyingId(null);
        }
    };

    const dismissProposal = (proposalId) => {
        setProposals(prev => prev.filter(p => p.id !== proposalId));
    };

    // Task actions
    const approveTask = async (id) => {
        const res = await authFetch(`${API_BASE}/api/tasks/${id}/approve`, { method: 'POST' });
        if (res.ok) loadTasks();
    };
    const rejectTask = async (id) => {
        const res = await authFetch(`${API_BASE}/api/tasks/${id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
        if (res.ok) loadTasks();
    };
    const deleteTask = async (id) => {
        const res = await authFetch(`${API_BASE}/api/tasks/${id}`, { method: 'DELETE' });
        if (res.ok) loadTasks();
    };
    const runTask = async (id) => {
        setRunningId(id);
        try {
            await authFetch(`${API_BASE}/api/tasks/${id}/run`, { method: 'POST' });
            loadTasks();
        } catch (err) {
            console.error('Run error:', err);
        } finally {
            setRunningId(null);
        }
    };
    const retryTask = async (id) => {
        const res = await authFetch(`${API_BASE}/api/tasks/${id}/retry`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runNow: true }) });
        if (res.ok) loadTasks();
    };
    const pauseTask = async (id) => {
        const res = await authFetch(`${API_BASE}/api/tasks/${id}/pause`, { method: 'POST' });
        if (res.ok) loadTasks();
    };
    const duplicateTask = async (id) => {
        const res = await authFetch(`${API_BASE}/api/tasks/${id}/duplicate`, { method: 'POST' });
        if (res.ok) loadTasks();
    };
    const approveExecution = async (id) => {
        setRunningId(id);
        try {
            await authFetch(`${API_BASE}/api/tasks/${id}/approve-execution`, { method: 'POST' });
            loadTasks();
        } catch (err) {
            console.error('Approve execution error:', err);
        } finally {
            setRunningId(null);
        }
    };
    const skipExecution = async (id) => {
        const res = await authFetch(`${API_BASE}/api/tasks/${id}/skip-execution`, { method: 'POST' });
        if (res.ok) loadTasks();
    };

    const filteredTasks = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);
    const pendingCount = tasks.filter(t => t.status === 'pending').length;
    const queuedCount = tasks.filter(t => t.status === 'queued').length;
    const awaitingCount = tasks.filter(t => t.status === 'awaiting_approval').length;
    const tabs = [
        { id: 'discover', label: 'Discover', icon: Search },
        { id: 'tasks', label: 'My Tasks', icon: CheckSquare, count: pendingCount + queuedCount + awaitingCount },
    ];

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: COLORS.bg }}>
            {/* Header */}
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.textSec, display: 'flex', alignItems: 'center' }}>
                    <ArrowLeft style={{ width: 18, height: 18 }} />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles style={{ width: 18, height: 18, color: COLORS.accent }} />
                    <h2 style={{ fontSize: 16, fontWeight: 600, color: COLORS.text, margin: 0 }}>Tasks</h2>
                </div>
                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: COLORS.accentBg, color: COLORS.accent, fontWeight: 600 }}>beta</span>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 2, marginLeft: 24, background: COLORS.bgSec, borderRadius: 8, padding: 2 }}>
                    {tabs.map(tab => {
                        const TabIcon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                                    borderRadius: 6, border: 'none', cursor: 'pointer',
                                    background: isActive ? COLORS.accent : 'transparent',
                                    color: isActive ? '#fff' : COLORS.textSec,
                                    fontSize: 12, fontWeight: isActive ? 600 : 400,
                                    transition: 'all 0.15s',
                                }}>
                                <TabIcon style={{ width: 13, height: 13 }} />
                                {tab.label}
                                {tab.count > 0 && (
                                    <span style={{ fontSize: 10, padding: '0 5px', borderRadius: 10, background: isActive ? 'rgba(255,255,255,0.2)' : `${COLORS.amber}20`, color: isActive ? '#fff' : COLORS.amber, fontWeight: 700 }}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Spacer + Notification bell */}
                <div style={{ flex: 1 }} />
                <NotificationCenter />
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
                <div style={{ maxWidth: 800, margin: '0 auto' }}>

                    {activeTab === 'discover' && (
                        <div>
                            {/* Multi-app scan grid */}
                            <div style={{ marginBottom: 20 }}>
                                {/* Model selector row */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSec }}>Discover automations</span>
                                    <ModelTierSelector tiers={modelTiers} value={scanTier} onChange={setScanTier} dropDirection="down" />
                                </div>
                                <div style={{ position: 'relative', marginBottom: 10 }}>
                                    <input
                                        type="text"
                                        value={scanFocus}
                                        onChange={e => setScanFocus(e.target.value)}
                                        placeholder="Focus on... (e.g. 'invoices', 'meeting follow-ups', 'stale files')"
                                        disabled={scanning}
                                        style={{
                                            width: '100%', padding: '9px 12px', fontSize: 13,
                                            border: `1px solid ${COLORS.border}`, borderRadius: 8,
                                            background: COLORS.bgCard, color: COLORS.text,
                                            outline: 'none', boxSizing: 'border-box',
                                            transition: 'border-color 0.15s',
                                        }}
                                        onFocus={e => e.target.style.borderColor = COLORS.amber}
                                        onBlur={e => e.target.style.borderColor = COLORS.border}
                                        onKeyDown={e => { if (e.key === 'Enter' && !scanning) startScan('cross_app'); }}
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                                    {[
                                        { id: 'cross_app', name: 'Cross-App', desc: 'Multi-app workflows', color: '#8b5cf6', emoji: '🔀', highlight: true },
                                    ].map(app => (
                                        <div key={app.id} style={{ gridColumn: app.highlight ? '1 / -1' : undefined }}>
                                            <button onClick={() => startScan(app.id)} disabled={scanning}
                                                style={{
                                                    width: '100%', padding: '14px 16px', borderRadius: 10,
                                                    border: `2px solid ${app.color}`,
                                                    background: `${app.color}08`,
                                                    cursor: scanning ? 'not-allowed' : 'pointer',
                                                    display: 'flex', alignItems: 'center', gap: 10,
                                                    transition: 'all 0.15s', textAlign: 'left',
                                                    opacity: scanning ? 0.5 : 1,
                                                    boxShadow: `0 0 12px ${app.color}15`,
                                                }}
                                            >
                                                <span style={{ fontSize: 22 }}>{app.emoji}</span>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{app.name}</div>
                                                    <div style={{ fontSize: 11, color: COLORS.textSec }}>{app.desc}</div>
                                                </div>
                                                <Search style={{ width: 14, height: 14, color: COLORS.textMuted }} />
                                            </button>
                                            {/* Cross-App toggle pills */}
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, paddingLeft: 2 }}>
                                                {[
                                                    { key: 'gmail', label: 'Gmail', color: '#D93025' },
                                                    { key: 'calendar', label: 'Calendar', color: '#4285F4' },
                                                    { key: 'drive', label: 'Drive', color: '#0F9D58' },
                                                    { key: 'slides', label: 'Slides', color: '#F4B400' },
                                                    { key: 'sheets', label: 'Sheets', color: '#0F9D58' },
                                                    { key: 'docs', label: 'Docs', color: '#4285F4' },
                                                    { key: 'fireflies', label: 'Fireflies', color: '#7C3AED' },
                                                    { key: 'youtrack', label: 'YouTrack', color: '#FC801D' },
                                                    { key: 'gamma', label: 'Gamma', color: '#6366F1' },

                                                ].map(t => {
                                                    const on = crossAppApps.includes(t.key);
                                                    return (
                                                        <button key={t.key}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setCrossAppApps(prev =>
                                                                    prev.includes(t.key)
                                                                        ? prev.filter(k => k !== t.key)
                                                                        : [...prev, t.key]
                                                                );
                                                            }}
                                                            style={{
                                                                padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 500,
                                                                border: `1px solid ${on ? t.color : COLORS.border}`,
                                                                background: on ? `${t.color}18` : COLORS.bgCard,
                                                                color: on ? t.color : COLORS.textMuted,
                                                                cursor: 'pointer', transition: 'all 0.15s',
                                                            }}
                                                        >
                                                            {t.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                    {[
                                        { id: 'gmail', name: 'Gmail', desc: 'Email automations', color: '#D93025', emoji: '✉️' },
                                        { id: 'calendar', name: 'Calendar', desc: 'Schedule automations', color: '#4285F4', emoji: '📅' },
                                        { id: 'drive', name: 'Drive', desc: 'File organization', color: '#0F9D58', emoji: '📁' },
                                        { id: 'slides', name: 'Slides', desc: 'Presentation tasks', color: '#F4B400', emoji: '📊' },
                                        { id: 'sheets', name: 'Sheets', desc: 'Spreadsheet tasks', color: '#0F9D58', icon: <svg width="22" height="22" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M40 45H8c-1.66 0-3-1.34-3-3V6c0-1.66 1.34-3 3-3h22l13 13v27c0 1.66-1.34 3-3 3z" fill="#0F9D58" /><path d="M30 3l13 13H33c-1.66 0-3-1.34-3-3V3z" fill="#087B4A" /><rect x="13" y="22" width="22" height="16" rx="1" fill="#fff" /><line x1="13" y1="28" x2="35" y2="28" stroke="#0F9D58" strokeWidth="1" /><line x1="13" y1="33" x2="35" y2="33" stroke="#0F9D58" strokeWidth="1" /><line x1="24" y1="22" x2="24" y2="38" stroke="#0F9D58" strokeWidth="1" /></svg> },
                                        { id: 'docs', name: 'Docs', desc: 'Document tasks', color: '#4285F4', icon: <svg width="22" height="22" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M40 45H8c-1.66 0-3-1.34-3-3V6c0-1.66 1.34-3 3-3h22l13 13v27c0 1.66-1.34 3-3 3z" fill="#4285F4" /><path d="M30 3l13 13H33c-1.66 0-3-1.34-3-3V3z" fill="#2A67C8" /><rect x="14" y="22" width="16" height="2" rx="1" fill="#fff" /><rect x="14" y="27" width="20" height="2" rx="1" fill="#fff" /><rect x="14" y="32" width="12" height="2" rx="1" fill="#fff" /></svg> },
                                        { id: 'fireflies', name: 'Fireflies', desc: 'Meeting follow-ups', color: '#7C3AED', emoji: '🎙️' },
                                        { id: 'youtrack', name: 'YouTrack', desc: 'Issue management', color: '#FC801D', emoji: '🎯' },
                                        { id: 'gamma', name: 'Gamma', desc: 'AI presentations', color: '#6366F1', emoji: '🎨' },

                                    ].map(app => (
                                        <button key={app.id} onClick={() => startScan(app.id)} disabled={scanning}
                                            style={{
                                                padding: '14px 16px', borderRadius: 10,
                                                border: app.highlight ? `2px solid ${app.color}` : `1px solid ${COLORS.border}`,
                                                background: app.highlight ? `${app.color}08` : COLORS.bgCard,
                                                cursor: scanning ? 'not-allowed' : 'pointer',
                                                display: 'flex', alignItems: 'center', gap: 10,
                                                transition: 'all 0.15s', textAlign: 'left',
                                                opacity: scanning ? 0.5 : 1,
                                                gridColumn: app.highlight ? '1 / -1' : undefined,
                                                boxShadow: app.highlight ? `0 0 12px ${app.color}15` : 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))',
                                            }}
                                            onMouseEnter={e => { if (!scanning) e.currentTarget.style.borderColor = app.color; }}
                                            onMouseLeave={e => e.currentTarget.style.borderColor = app.highlight ? app.color : COLORS.border}
                                        >
                                            {app.icon ? app.icon : <span style={{ fontSize: 22 }}>{app.emoji}</span>}
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{app.name}</div>
                                                <div style={{ fontSize: 11, color: COLORS.textSec }}>{app.desc}</div>
                                            </div>
                                            <Search style={{ width: 14, height: 14, color: COLORS.textMuted }} />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Scan progress */}
                            {scanning && scanAppId === 'cross_app' && scanPhases.length > 0 ? (
                                <ScanProgressPhased phases={scanPhases} currentPhase={currentPhase} status={scanStatus} />
                            ) : scanning ? (
                                <ScanProgressSimple status={scanStatus} progress={scanProgress} />
                            ) : null}

                            {/* Scan results */}
                            {!scanning && scanStatus && proposals.length === 0 && (
                                <div style={{ padding: 20, borderRadius: 12, border: `1px solid ${COLORS.border}`, background: COLORS.bgCard, textAlign: 'center' }}>
                                    <p style={{ fontSize: 13, color: COLORS.textSec, margin: 0 }}>{scanStatus}</p>
                                </div>
                            )}

                            {proposals.length > 0 && (
                                <div>
                                    <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: COLORS.textMuted, marginBottom: 10 }}>
                                        Discovered Automations ({proposals.length})
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {proposals.map(p => (
                                            <ProposalCard
                                                key={p.id}
                                                proposal={p}
                                                onApply={() => applyProposal(p)}
                                                onDismiss={() => dismissProposal(p.id)}
                                                applying={applyingId === p.id}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Empty state */}
                            {!scanning && !scanStatus && proposals.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                                    <div style={{ width: 64, height: 64, borderRadius: 16, background: COLORS.accentBg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                                        <Search style={{ width: 28, height: 28, color: COLORS.accent }} />
                                    </div>
                                    <h3 style={{ fontSize: 16, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>Discover Automations</h3>
                                    <p style={{ fontSize: 13, color: COLORS.textSec, maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
                                        Select an app above to let AI analyze your data and suggest automations.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── My Tasks Tab ─── */}
                    {activeTab === 'tasks' && (
                        <div>
                            {/* Filter bar */}
                            <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
                                {['all', 'pending', 'approved', 'awaiting_approval', 'queued', 'running', 'completed', 'failed', 'paused', 'rejected'].map(f => (
                                    <button key={f} onClick={() => setFilter(f)}
                                        style={{
                                            padding: '5px 10px', borderRadius: 6,
                                            border: `1px solid ${filter === f ? COLORS.accent : COLORS.border}`,
                                            background: filter === f ? COLORS.accentBg : COLORS.bgCard,
                                            color: filter === f ? COLORS.accent : COLORS.textSec,
                                            fontSize: 11, fontWeight: filter === f ? 600 : 400,
                                            cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.15s',
                                        }}>
                                        {f} {f !== 'all' && `(${tasks.filter(t => t.status === f).length})`}
                                    </button>
                                ))}
                            </div>

                            {loading ? (
                                <div style={{ textAlign: 'center', padding: 40 }}>
                                    <Loader2 style={{ width: 24, height: 24, color: COLORS.accent, animation: 'spin 1s linear infinite' }} />
                                </div>
                            ) : filteredTasks.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                                    <CheckSquare style={{ width: 32, height: 32, color: COLORS.textMuted, margin: '0 auto 12px', display: 'block' }} />
                                    <h3 style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>No tasks yet</h3>
                                    <p style={{ fontSize: 12, color: COLORS.textSec }}>
                                        Use the "Discover" tab to scan your apps and find automation opportunities.
                                    </p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {filteredTasks.map(task => (
                                        <TaskCard key={task.id} task={task} onApprove={approveTask} onReject={rejectTask} onDelete={deleteTask} onRun={runTask} onRetry={retryTask} onPause={pauseTask} onDuplicate={duplicateTask} onApproveExecution={approveExecution} onSkipExecution={skipExecution} runningId={runningId} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes scanPulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.4; transform: scale(0.8); }
                }
                .scan-pulse-dot {
                    width: 6px; height: 6px; border-radius: 50%;
                    background: ${COLORS.accent};
                    animation: scanPulse 1.5s ease-in-out infinite;
                    flex-shrink: 0;
                }
            `}</style>
        </div>
    );
}

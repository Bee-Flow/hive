// The two drill tables of the "What happened" tab — 5 visible columns each
// (the old tabs used 7 and 8), everything else in an expandable row.
//
// kind='guard'  → shield events   : Time | Person | Where it happened | What we found | What we did
// kind='egress' → data that left  : Time | Person | Where it happened | Service | Where it went

import { ChevronDown, ChevronRight } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { piiCategoriesLocalized } from '../../../../../config/piiCategories';
import { fmtTime } from '../../../../../pages/settings/usage/format';
import { EmptyInline } from '../../../../../pages/settings/usage/kit';
import { Avatar, IntegrationLogo } from '../../../../../pages/settings/usage/widgets';

const CELL = { fontSize: 11, color: 'var(--text-secondary)', padding: '7px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const HEAD = { ...CELL, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', padding: '4px 8px' };
const GRID = '95px 1fr 1fr 1.2fr 1fr 24px';

// Audit markers that travel in the categories column but are not categories.
const MARKER_LABELS = {
    privacy_protection_unavailable: 'Protection was unavailable',
    scan_timeout: 'Check ran out of time',
    scan_overflow: 'File too large to fully check',
    scan_degraded: 'Check ran reduced',
    // A routine hit the per-run placeholder ceiling, so the oldest placeholders
    // can no longer be turned back into real values.
    token_evicted: 'Some placeholders were dropped',
};

/** Map stored category values (canonical ids or legacy labels) to UI labels. */
export function useCategoryLabels(t) {
    return useMemo(() => {
        const map = new Map();
        for (const cat of piiCategoriesLocalized(t)) map.set(cat.id, cat.label);
        return (value) => {
            if (!value) return '';
            // Dedupe: legacy rows repeat the same label per occurrence
            // ("Person Name, Person Name, …"), which reads as noise.
            const parts = [...new Set(String(value).split(',').map(s => s.trim()).filter(Boolean))];
            return parts
                .map(id => map.get(id)
                    || (MARKER_LABELS[id] ? t(`admin.shield_activity_marker_${id}`, MARKER_LABELS[id]) : id))
                .join(', ');
        };
    }, [t]);
}

/**
 * Which surface produced this row — the "was this chat, an agent, or a
 * routine?" answer. Sources across eras: 'direct'/'direct_chat',
 * 'agent'/'agent_chat'/'agent_stream', 'routine', 'notebook'. Routines also
 * carry automation_id (their title travels in agent_name).
 */
export function surfaceLabel(row, t) {
    const src = String(row?.source || '').toLowerCase();
    const named = (base, name) => (name ? `${base} — ${name}` : base);
    if (row?.automation_id || src === 'routine') {
        return named(t('admin.shield_activity_src_routine', 'Routine'), row.agent_name);
    }
    if (src.startsWith('agent') || (row?.agent_id && !src.startsWith('direct'))) {
        return named(t('admin.shield_activity_src_agent', 'Agent'), row.agent_name);
    }
    if (src.startsWith('direct')) return t('admin.shield_activity_src_direct', 'Direct chat');
    if (src.includes('notebook')) return t('admin.shield_activity_src_notebook', 'Notebook');
    return row?.agent_name || row?.source || '—';
}

// What-we-did values → plain words. Unknown values pass through.
const ACTION_LABELS = {
    blocked: 'Stopped',
    redacted: 'Hidden',
    allowed: 'Sent anyway',
    tokenized: 'Placeholders',
    search_blocked: 'Search stopped',
    pii_detected: 'Noted only',
    passed_unredacted: 'Sent unchecked',
    scan_failed: 'Check failed',
};

function DetailPairs({ pairs }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 12px', padding: '6px 8px 8px 103px', fontSize: 10.5 }}>
            {pairs.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => (
                <React.Fragment key={k}>
                    <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                    <span style={{ color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{String(v)}</span>
                </React.Fragment>
            ))}
        </div>
    );
}

export default function ActivityDetailTable({ kind, rows, t, emptyText }) {
    const [expandedId, setExpandedId] = useState(null);
    const catLabel = useCategoryLabels(t);

    if (!rows || rows.length === 0) return <EmptyInline text={emptyText} boxed />;

    const cols = kind === 'guard'
        ? [t('admin.shield_activity_col_time', 'Time'), t('admin.shield_activity_col_person', 'Person'),
            t('admin.shield_activity_col_source', 'Where it happened'),
            t('admin.shield_activity_col_found', 'What we found'), t('admin.shield_activity_col_did', 'What we did')]
        : [t('admin.shield_activity_col_time', 'Time'), t('admin.shield_activity_col_person', 'Person'),
            t('admin.shield_activity_col_source', 'Where it happened'),
            t('admin.shield_activity_col_service', 'Service'), t('admin.shield_activity_col_where', 'Where it went')];

    return (
        <div role="table" style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-primary)' }}>
            <div role="row" style={{ display: 'grid', gridTemplateColumns: GRID, background: 'var(--bg-secondary)' }}>
                {cols.map(c => <div role="columnheader" key={c} style={HEAD}>{c}</div>)}
                <div style={HEAD} aria-hidden="true" />
            </div>
            {rows.map(row => {
                const open = expandedId === row.id;
                const person = (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <Avatar user={row} size={16} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.display_name || row.user_id || '—'}</span>
                    </span>
                );
                const surface = <span key="src" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{surfaceLabel(row, t)}</span>;
                const main = kind === 'guard'
                    ? [
                        fmtTime(row.timestamp),
                        person,
                        surface,
                        catLabel(row.violation_categories) || row.violation_type,
                        t(`admin.shield_activity_action_${row.action_taken}`, ACTION_LABELS[row.action_taken] || row.action_taken || '—'),
                    ]
                    : [
                        fmtTime(row.timestamp),
                        person,
                        surface,
                        <span key="svc" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            <IntegrationLogo integrationType={row.integration_type} size={14} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.integration_type || row.tool_name}</span>
                        </span>,
                        <span key="where" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {row.country_flag ? `${row.country_flag} ` : ''}
                            {row.is_local ? t('admin.shield_activity_local', 'Your own server')
                                : (row.dest_host || row.tls_servername || row.server_endpoint || '—')}
                        </span>,
                    ];
                const pairs = kind === 'guard'
                    ? [
                        [t('admin.shield_activity_d_kind', 'Kind'), row.violation_type],
                        [t('admin.shield_activity_d_direction', 'Direction'), row.direction],
                        [t('admin.shield_activity_d_model', 'AI model'), row.model],
                        [t('admin.shield_activity_d_file', 'File'), row.attachment_filename],
                        [t('admin.shield_activity_d_conversation', 'Conversation'), row.conversation_id],
                    ]
                    : [
                        [t('admin.shield_activity_d_tool', 'Tool'), row.tool_name],
                        [t('admin.shield_activity_d_country', 'Country'), row.country_name],
                        [t('admin.shield_activity_d_operator', 'Operated by'), row.operator],
                        [t('admin.shield_activity_d_address', 'Server address'), row.peer_ip],
                        [t('admin.shield_activity_d_status', 'Result'), row.status === 'error'
                            ? `${t('admin.shield_activity_status_error', 'Failed')}${row.error_message ? ` — ${row.error_message}` : ''}`
                            : row.status === 'blocked' ? t('admin.shield_activity_status_blocked', 'Stopped by the shield') : null],
                        [t('admin.shield_activity_d_duration', 'Took'), Number.isFinite(Number(row.duration_ms)) && row.duration_ms !== null ? `${row.duration_ms} ms` : null],
                        [t('admin.shield_activity_d_personal', 'Personal data'), catLabel(row.pii_categories_detected)],
                    ];
                return (
                    <div key={row.id ?? `${row.timestamp}-${row.tool_name || row.violation_type}`}>
                        <button
                            type="button"
                            onClick={() => setExpandedId(open ? null : (row.id ?? null))}
                            aria-expanded={open}
                            style={{
                                display: 'grid', gridTemplateColumns: GRID, width: '100%', textAlign: 'left',
                                background: open ? 'var(--bg-secondary)' : 'transparent', border: 'none',
                                borderTop: '1px solid var(--border-subtle)', cursor: 'pointer', padding: 0,
                                alignItems: 'center', color: 'inherit', fontFamily: 'inherit',
                            }}
                        >
                            {main.map((cell, i) => <div key={i} style={CELL}>{cell}</div>)}
                            <div style={{ ...CELL, padding: '7px 4px' }} aria-hidden="true">
                                {open ? <ChevronDown style={{ width: 12, height: 12 }} /> : <ChevronRight style={{ width: 12, height: 12 }} />}
                            </div>
                        </button>
                        {open && <DetailPairs pairs={pairs} />}
                    </div>
                );
            })}
        </div>
    );
}

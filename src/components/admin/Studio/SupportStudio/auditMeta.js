// auditMeta — single source of truth for turning a support audit event into a
// visual category (icon + colour + label + summary). The backend audit log now
// stores the precise actor_kind (system / automation / ai / staff / requester),
// so categorisation is primarily by actor_kind, with a fallback mapping from the
// action for legacy rows. Mirrors server/support/audit.js ACTION_CATALOG.
//
// Colour rule: AI uses the app accent (never purple). Automation=amber,
// staff=blue, requester=green, system=neutral.

import { Sparkles, Workflow, Settings as SettingsIcon, User, Mail } from 'lucide-react';

export const CATEGORY_META = {
    ai: { label: 'AI', Icon: Sparkles, color: 'var(--accent-primary)', dot: 'var(--accent-primary)', chip: 'text-[var(--accent-primary)] border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10' },
    automation: { label: 'Automation', Icon: Workflow, color: '#f59e0b', dot: '#f59e0b', chip: 'text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10' },
    system: { label: 'System', Icon: SettingsIcon, color: 'var(--text-tertiary)', dot: 'var(--text-tertiary)', chip: 'text-[var(--text-tertiary)] border-[var(--border-default)] bg-[var(--bg-secondary)]' },
    staff: { label: 'Teammate', Icon: User, color: '#3b82f6', dot: '#3b82f6', chip: 'text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/10' },
    requester: { label: 'Customer', Icon: Mail, color: '#22c55e', dot: '#22c55e', chip: 'text-green-600 dark:text-green-400 border-green-500/30 bg-green-500/10' },
};

export const CATEGORY_IDS = ['ai', 'automation', 'staff', 'requester', 'system'];

// Fallback action → category for legacy events that lack a precise actor_kind.
const ACTION_CATEGORY = {
    email_ingested: 'system', email_sent: 'system', email_send_failed: 'system', email_failed: 'system', auto_assigned: 'system',
    classified_not_support: 'automation', classifier_filtered: 'automation', sla_breach: 'automation', kb_ingested: 'automation',
    ai_action: 'ai', ai_escalated: 'ai', ai_draft: 'ai', ai_reply: 'ai', ai_draft_generated: 'ai', ai_reply_sent: 'ai', ai_resolved: 'ai', ai_status_changed: 'ai', ai_tool_called: 'ai',
    staff_reply: 'staff', staff_reply_sent: 'staff', internal_note: 'staff', updated: 'staff', status_changed: 'staff',
    assign: 'staff', assigned: 'staff', assignee_change: 'staff', priority_change: 'staff', tags_change: 'staff', tagged: 'staff',
    resolved: 'staff', marked_not_support: 'staff', restored_to_support: 'staff',
    inbox_created: 'staff', inbox_connected: 'staff', inbox_settings_changed: 'staff', inbox_access_changed: 'staff',
    kb_automation_changed: 'staff', scan_started: 'staff', inbox_deleted: 'staff',
    tag_created: 'staff', tag_deleted: 'staff', canned_created: 'staff', canned_updated: 'staff', canned_deleted: 'staff', sla_policy_changed: 'staff',
    reply: 'requester', requester_reply: 'requester', reopened: 'requester', resolution_disputed: 'requester', csat: 'requester',
};

const ACTION_LABEL = {
    email_ingested: 'Email received',
    ai_draft: 'AI drafted a reply', ai_reply: 'AI replied', ai_action: 'AI used a tool', ai_escalated: 'AI escalated to a human', ai_resolved: 'AI resolved',
    resolved: 'Resolved', staff_reply: 'Replied', staff_reply_sent: 'Replied', internal_note: 'Internal note added',
    updated: 'Ticket updated', status_changed: 'Status changed',
    assign: 'Assigned', assigned: 'Assigned', assignee_change: 'Assignee changed',
    auto_assigned: 'Auto-assigned', priority_change: 'Priority changed', tags_change: 'Tags changed', tagged: 'Tags changed',
    marked_not_support: 'Marked “not support”', restored_to_support: 'Restored to support',
    classified_not_support: 'Filtered as non-support', sla_breach: 'SLA breached',
    reply: 'Customer replied', reopened: 'Reopened by customer', resolution_disputed: 'Resolution disputed', csat: 'Rated the conversation',
    inbox_created: 'Inbox created', inbox_connected: 'Mailbox connected', inbox_deleted: 'Inbox deleted',
    inbox_settings_changed: 'Settings changed', inbox_access_changed: 'Access changed',
    kb_automation_changed: 'Knowledge ingestion changed', scan_started: 'History scan started',
    tag_created: 'Tag created', tag_deleted: 'Tag deleted',
    canned_created: 'Canned reply created', canned_updated: 'Canned reply updated', canned_deleted: 'Canned reply deleted',
    sla_policy_changed: 'SLA policy updated',
    email_sent: 'Email delivered', email_send_failed: 'Email send failed', email_failed: 'Email send failed',
};

export function categoryFor(event) {
    const byAction = ACTION_CATEGORY[event?.action];
    const k = event?.actor_kind;
    // Legacy rows recorded AI/automation actions under actor_kind 'system'; the
    // action is the more specific signal, so promote those to ai/automation.
    if (k === 'system' && (byAction === 'ai' || byAction === 'automation')) return byAction;
    if (k && CATEGORY_META[k]) return k;
    return byAction || 'system';
}

export function labelFor(action) {
    if (!action) return '';
    return ACTION_LABEL[action] || action.replace(/_/g, ' ');
}

// A short human summary of an event's payload for the secondary line.
export function summarize(event) {
    const p = event?.payload || {};
    switch (event?.action) {
        case 'inbox_settings_changed':
            return Array.isArray(p.changed) && p.changed.length ? p.changed.join(', ') : '';
        case 'updated':
            return Object.entries(p).map(([k, v]) => `${k}: ${v}`).join(' · ');
        case 'ai_action':
            return p.tool || '';
        case 'email_ingested':
            return p.subject || p.from || '';
        case 'inbox_access_changed':
            return Array.isArray(p.sharedGroups) && p.sharedGroups.length ? `restricted to ${p.sharedGroups.length} group(s)` : 'open to all support staff';
        case 'inbox_connected':
        case 'inbox_created':
            return [p.emailAddress, p.provider].filter(Boolean).join(' · ');
        case 'ai_reply':
        case 'ai_draft':
            return p.confidence != null ? `confidence ${Math.round(p.confidence * 100)}%` : '';
        case 'ai_escalated':
            return p.reason || '';
        case 'kb_automation_changed':
            return p.enabled ? 'enabled' : 'disabled';
        case 'scan_started':
            return p.windowDays ? `${p.windowDays} days` : '';
        case 'sla_breach':
            return p.which === 'first' ? 'first response' : 'resolution';
        default:
            return '';
    }
}

export function metaFor(event) {
    const category = categoryFor(event);
    return { category, ...CATEGORY_META[category], label: labelFor(event?.action), summary: summarize(event) };
}

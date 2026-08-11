// healthMeta — single source of truth for turning a connector-health status,
// problem severity or event code into a visual (icon + colour + label + chip).
// Mirrors SupportStudio/auditMeta.js.
//
// Colour rule: error/critical = rose, warning = amber, info = neutral
// (var(--text-tertiary)), healthy = green. Never purple.
//
// Privacy rule: event meta is NEVER rendered raw — summarize() only surfaces
// the whitelisted keys below (metadata-only; no prompts, tokens, tenant keys
// or message content ever reach the DOM).

import {
    CheckCircle2, CreditCard, ClipboardList, UserCheck, KeyRound,
    AlertTriangle, MoonStar, Info, AlertCircle, AlertOctagon,
} from 'lucide-react';

const GREEN = '#22c55e';
const AMBER = '#f59e0b';
const ROSE = '#ef4444';
const NEUTRAL = 'var(--text-tertiary)';

const GREEN_CHIP = 'text-green-600 dark:text-green-400 border-green-500/30 bg-green-500/10';
const AMBER_CHIP = 'text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10';
const ROSE_CHIP = 'text-rose-600 dark:text-rose-400 border-rose-500/30 bg-rose-500/10';
const NEUTRAL_CHIP = 'text-[var(--text-tertiary)] border-[var(--border-default)] bg-[var(--bg-secondary)]';

// Pinned health enum (API contract): higher severityRank = worse. The fleet
// table sorts on this, worst first.
export const STATUS_META = {
    no_subscription: { labelKey: 'admin.ch_status_no_subscription', fallback: 'No subscription', Icon: CreditCard, color: ROSE, chip: ROSE_CHIP, severityRank: 6 },
    tenant_key_mismatch: { labelKey: 'admin.ch_status_tenant_key_mismatch', fallback: 'Key mismatch', Icon: KeyRound, color: ROSE, chip: ROSE_CHIP, severityRank: 5 },
    chat_failing: { labelKey: 'admin.ch_status_chat_failing', fallback: 'Chat failing', Icon: AlertTriangle, color: ROSE, chip: ROSE_CHIP, severityRank: 4 },
    onboarding_pending: { labelKey: 'admin.ch_status_onboarding_pending', fallback: 'Onboarding pending', Icon: ClipboardList, color: AMBER, chip: AMBER_CHIP, severityRank: 3 },
    users_pending_approval: { labelKey: 'admin.ch_status_users_pending_approval', fallback: 'Awaiting approvals', Icon: UserCheck, color: AMBER, chip: AMBER_CHIP, severityRank: 2 },
    inactive: { labelKey: 'admin.ch_status_inactive', fallback: 'Inactive', Icon: MoonStar, color: AMBER, chip: AMBER_CHIP, severityRank: 1 },
    ok: { labelKey: 'admin.ch_status_ok', fallback: 'Healthy', Icon: CheckCircle2, color: GREEN, chip: GREEN_CHIP, severityRank: 0 },
};

// Worst-first status ids (drives the filter pill order too).
export const STATUS_IDS = Object.keys(STATUS_META)
    .sort((a, b) => STATUS_META[b].severityRank - STATUS_META[a].severityRank);

export function statusRank(health) {
    return STATUS_META[health] ? STATUS_META[health].severityRank : 0;
}

// Pinned severity enum (API contract).
export const SEVERITY_META = {
    critical: { labelKey: 'admin.ch_sev_critical', fallback: 'Critical', Icon: AlertOctagon, color: ROSE, dot: ROSE, chip: ROSE_CHIP, rank: 4 },
    error: { labelKey: 'admin.ch_sev_error', fallback: 'Error', Icon: AlertCircle, color: ROSE, dot: ROSE, chip: ROSE_CHIP, rank: 3 },
    warning: { labelKey: 'admin.ch_sev_warning', fallback: 'Warning', Icon: AlertTriangle, color: AMBER, dot: AMBER, chip: AMBER_CHIP, rank: 2 },
    info: { labelKey: 'admin.ch_sev_info', fallback: 'Info', Icon: Info, color: NEUTRAL, dot: NEUTRAL, chip: NEUTRAL_CHIP, rank: 1 },
};

export const SEVERITY_IDS = ['critical', 'error', 'warning', 'info'];

/** Meta for a severity, falling back to the neutral info style for unknowns. */
export function sevMeta(severity) {
    return SEVERITY_META[severity] || SEVERITY_META.info;
}

const BLOCKING_SEVERITIES = new Set(['error', 'critical']);

/** True when the org has at least one open error/critical problem — i.e. its
 *  users cannot send AI messages right now. Drives the rose fleet banner. */
export function orgIsBlocked(org) {
    return Array.isArray(org?.problems)
        && org.problems.some(p => p && BLOCKING_SEVERITIES.has(p.severity));
}

// Human labels for known event/problem codes (server orgHealth CODES catalog).
// Anything unknown falls back to the code with separators spaced out, so new
// backend codes render acceptably without a frontend release.
const CODE_LABELS = {
    'bootstrap.org_created': 'Organisation created',
    'bootstrap.org_adopted': 'Organisation adopted',
    'bootstrap.pairing_redeemed': 'Pairing code redeemed',
    'bootstrap.pairing_required': 'Pairing required',
    'bootstrap.verification_pending': 'Domain verification pending',
    'bootstrap.verify_failed': 'Domain verification failed',
    'bootstrap.admin_email_conflict': 'Admin email conflict',
    'bootstrap.org_create_failed': 'Organisation creation failed',
    'bootstrap.plan_applied': 'Subscription plan applied',
    'bootstrap.plan_apply_failed': 'Plan assignment failed',
    'bootstrap.community_fallback': 'Fell back to Community tier',
    'auth.no_matching_tenant_key': 'No matching tenant key',
    'auth.missing_email': 'User has no email address',
    'auth.blocked_onboarding_pending': 'Blocked: onboarding not completed',
    'auth.blocked_pending_approval': 'Blocked: awaiting admin approval',
    'auth.blocked_seat_cap': 'Blocked: seat limit reached',
    'auth.blocked_geo': 'Blocked: region restriction',
    'auth.blocked_org_mismatch': 'Blocked: organisation mismatch',
    'auth.provision_failed': 'User provisioning failed',
    'auth.encryption_key_failed': 'Encryption key derivation failed',
    'auth.user_auto_provisioned': 'User auto-provisioned',
    'chat.subscription_blocked': 'Chat blocked: subscription',
    'chat.budget_exhausted': 'Chat blocked: budget exhausted',
    'chat.provider_config_failed': 'AI provider not configured',
    'chat.provider_error': 'AI provider error',
    'chat.dlp_blocked': 'Message stopped by privacy shield',
    'onboarding.completed': 'Onboarding completed',
    'binding.approved': 'Binding approved',
    'binding.denied': 'Binding denied',
    'binding.removed': 'Binding removed',
    'connector.reported_error': 'Connector reported an error',
};

export function labelFor(code) {
    if (!code) return '';
    return CODE_LABELS[code] || String(code).replace(/[._]/g, ' ');
}

// Per-code whitelist of meta keys that may appear in the timeline's secondary
// line. Everything not listed is dropped; values are stringified primitives
// only, truncated. Unknown codes fall back to DEFAULT_META_KEYS.
const DEFAULT_META_KEYS = ['reason'];
const META_WHITELIST = {
    'bootstrap.plan_applied': ['plan', 'planId', 'source'],
    'bootstrap.plan_apply_failed': ['plan', 'planId', 'reason'],
    'bootstrap.community_fallback': ['reason'],
    'bootstrap.verify_failed': ['reason'],
    'auth.no_matching_tenant_key': ['domain', 'unverified'],
    'auth.blocked_seat_cap': ['seatLimit', 'seatsUsed'],
    'auth.blocked_geo': ['country'],
    'auth.user_auto_provisioned': ['status'],
    'chat.subscription_blocked': ['reason'],
    'chat.budget_exhausted': ['scope', 'reason'],
    'chat.provider_config_failed': ['provider'],
    'chat.provider_error': ['provider', 'status'],
    'connector.reported_error': ['category', 'connectorVersion'],
};

/** Short human summary of an event's whitelisted meta — never the raw JSON. */
export function summarize(event) {
    const meta = event?.meta;
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return '';
    const allowed = META_WHITELIST[event?.code] || DEFAULT_META_KEYS;
    const parts = [];
    for (const key of allowed) {
        const v = meta[key];
        if (v === undefined || v === null || typeof v === 'object' || typeof v === 'function') continue;
        parts.push(`${key}: ${String(v).slice(0, 120)}`);
    }
    return parts.join(' · ');
}

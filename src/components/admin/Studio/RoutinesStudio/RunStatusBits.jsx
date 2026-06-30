import React from 'react';
import { tokenFor } from '../../../shared/statusTokens';

/**
 * Status icon + badge for a run, driven entirely by the shared status-token
 * table (agent-hub/src/components/shared/statusTokens.ts). Using tokenFor
 * here is what fixes the old bug where `awaiting_approval` fell through to a
 * gray "queued" Play icon — the token table maps it (and the
 * `awaiting_confirm` alias) to an amber ShieldQuestion. Unknown statuses
 * degrade to the neutral `idle` token instead of crashing.
 */
export function RunStatusIcon({ status, size = 14, className = '' }) {
    const token = tokenFor(status);
    const Icon = token.icon;
    return (
        <Icon
            size={size}
            className={`${token.solid} ${token.spin ? 'animate-spin' : ''} flex-shrink-0 ${className}`}
        />
    );
}

/**
 * Pill badge for a run's status. For dry-runs we keep the status word
 * (e.g. "Success") and surface the dry-run nature with a separate
 * <DryRunBadge> so users see BOTH facts instead of "dry-run" masking the
 * outcome (the old behaviour).
 */
export function RunStatusBadge({ status }) {
    const token = tokenFor(status);
    return (
        <span className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded ${token.badge}`}>
            {token.label}
        </span>
    );
}

/** Small neutral "Dry-run" pill, shown alongside the status badge. */
export function DryRunBadge() {
    return (
        <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-default)]">
            dry-run
        </span>
    );
}

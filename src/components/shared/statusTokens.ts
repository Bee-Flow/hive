import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    Info,
    Loader2,
    Pause,
    Power,
    ShieldQuestion,
    XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Status token table — single source of truth for the colors, icons, and
 * labels used to render automation/run/step status across the studio.
 *
 * Until now every component rolled its own emerald/amber/red Tailwind
 * mix. That made theme work painful (every new shade had to be hunted
 * down) and made consistency impossible — "success" was emerald-500 in
 * one place, green-600 in another, and a custom hex in a third. The
 * table here is the only place that maps a semantic status name to its
 * visual treatment.
 *
 * Token surface:
 *   - solid       — full-saturation text/border for inline pills
 *   - subtle      — 10%-opacity background for banners/cards
 *   - badge       — combined background + text classes for chip-style badges
 *   - icon        — the conventional lucide icon for this state
 *   - spin        — whether the icon should animate (running states)
 *   - label       — default human-readable label
 *
 * Add a new status by extending STATUS_KEYS + adding a row below. Don't
 * reach for arbitrary `text-emerald-600` strings in feature code anymore;
 * import a token instead so the visual contract stays consistent.
 */

export const STATUS_KEYS = [
    'success',
    'error',
    'running',
    'queued',
    'paused',
    'cancelled',
    'awaiting_approval',
    'warning',
    'info',
    'idle',
] as const;

export type StatusKey = typeof STATUS_KEYS[number];

export interface StatusToken {
    solid: string;
    subtle: string;
    badge: string;
    icon: LucideIcon;
    spin: boolean;
    label: string;
}

export const STATUS_TOKENS: Record<StatusKey, StatusToken> = {
    success: {
        solid: 'text-emerald-600 dark:text-emerald-400',
        subtle: 'bg-emerald-500/10',
        badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
        icon: CheckCircle2,
        spin: false,
        label: 'Success',
    },
    error: {
        solid: 'text-red-600 dark:text-red-400',
        subtle: 'bg-red-500/10',
        badge: 'bg-red-500/15 text-red-700 dark:text-red-300',
        icon: XCircle,
        spin: false,
        label: 'Error',
    },
    running: {
        solid: 'text-amber-600 dark:text-amber-400',
        subtle: 'bg-amber-500/10',
        badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
        icon: Loader2,
        spin: true,
        label: 'Running',
    },
    queued: {
        solid: 'text-[var(--text-tertiary)]',
        subtle: 'bg-[var(--bg-secondary)]',
        badge: 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]',
        icon: Clock,
        spin: false,
        label: 'Queued',
    },
    paused: {
        solid: 'text-amber-600 dark:text-amber-400',
        subtle: 'bg-amber-500/10',
        badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
        icon: Pause,
        spin: false,
        label: 'Paused',
    },
    cancelled: {
        solid: 'text-[var(--text-tertiary)]',
        subtle: 'bg-[var(--bg-secondary)]',
        badge: 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]',
        icon: Power,
        spin: false,
        label: 'Cancelled',
    },
    awaiting_approval: {
        solid: 'text-amber-700 dark:text-amber-300',
        subtle: 'bg-amber-500/10',
        badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40',
        icon: ShieldQuestion,
        spin: false,
        label: 'Awaiting approval',
    },
    warning: {
        solid: 'text-amber-600 dark:text-amber-400',
        subtle: 'bg-amber-500/10',
        badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
        icon: AlertTriangle,
        spin: false,
        label: 'Warning',
    },
    info: {
        solid: 'text-blue-600 dark:text-blue-400',
        subtle: 'bg-blue-500/10',
        badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
        icon: Info,
        spin: false,
        label: 'Info',
    },
    idle: {
        solid: 'text-[var(--text-tertiary)]',
        subtle: 'bg-[var(--bg-secondary)]',
        badge: 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]',
        icon: Clock,
        spin: false,
        label: 'Idle',
    },
};

/**
 * Look up a token by status string. Falls back to `idle` for anything
 * outside the canonical set so call sites can safely pass through
 * unknown server-side statuses without crashing — they'll just render
 * as the neutral idle token.
 */
export function tokenFor(status: string | null | undefined): StatusToken {
    if (!status) return STATUS_TOKENS.idle;
    const lower = status.toLowerCase();
    // Map a few server-side aliases to canonical keys.
    if (lower === 'failed') return STATUS_TOKENS.error;
    if (lower === 'awaiting_confirm') return STATUS_TOKENS.awaiting_approval;
    if (lower === 'paused_breakpoint') return STATUS_TOKENS.paused;
    if ((STATUS_KEYS as readonly string[]).includes(lower)) {
        return STATUS_TOKENS[lower as StatusKey];
    }
    return STATUS_TOKENS.idle;
}

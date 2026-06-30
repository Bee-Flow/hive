import { Sparkles, Wand2, Pencil, X, Eye } from 'lucide-react';
import React from 'react';

/**
 * Complexity badge for a suggested automation. Four tiers, low → high effort.
 * Colours mirror the RunStatusBadge palette in EmptyState.jsx (emerald/amber/
 * red `bg-*-500/15`) — red here means "highest effort, review carefully", not
 * an error. Never uses purple/violet/indigo (project rule).
 */
const TIER_META = {
    quick: { label: 'Quick', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
    assisted: { label: 'Assisted', cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
    orchestrated: { label: 'Orchestrated', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
    advanced: { label: 'Advanced', cls: 'bg-red-500/15 text-red-600 dark:text-red-400' },
};

export function ComplexityBadge({ tier }) {
    const meta = TIER_META[tier] || { label: tier || 'unknown', cls: 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]' };
    return (
        <span className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${meta.cls}`}>
            {meta.label}
        </span>
    );
}

/**
 * "Observed" vs "Idea" grounding badge. `groundedIn === 'activity'` means the
 * suggestion came from something actually seen in the user's tool activity
 * (emerald, more trustworthy); anything else is a generic idea (neutral/blue).
 * Feature-detected — omitted entirely when the field is absent.
 */
function GroundingBadge({ groundedIn }) {
    if (!groundedIn) return null;
    const observed = groundedIn === 'activity';
    const cls = observed
        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
        : 'bg-blue-500/15 text-blue-700 dark:text-blue-400';
    return (
        <span className={`inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${cls}`}>
            <Eye size={9} /> {observed ? 'Observed' : 'Idea'}
        </span>
    );
}

/** Extract a plain-text evidence summary (never HTML). Supports both
 *  `evidence: 'string'` and `evidence: { summary }` shapes. */
function evidenceText(evidence) {
    if (!evidence) return '';
    if (typeof evidence === 'string') return evidence;
    if (typeof evidence === 'object' && typeof evidence.summary === 'string') return evidence.summary;
    return '';
}

/**
 * One suggested-automation card. Shows the complexity badge, title,
 * description, the integrations it needs, and two actions:
 *   - Build it directly  → onBuildDirectly(suggestion)  (AI builds it now)
 *   - Ask for changes     → onAskForChanges(suggestion)  (open builder prefilled)
 *
 * Optional, feature-detected extras (rendered only when present):
 *   - grounding badge ('Observed' / 'Idea') from suggestion.groundedIn
 *   - an evidence line (suggestion.evidence?.summary | suggestion.evidence)
 *   - a Dismiss control (onDismiss). When dismissed/built, the card greys out
 *     (muted) and its CTAs are disabled.
 */
export default function SuggestionCard({
    suggestion,
    onBuildDirectly,
    onAskForChanges,
    onDismiss,
    built = false,
    dismissed = false,
    muted = false,
}) {
    const {
        title,
        description,
        complexity,
        requiredIntegrations = [],
        unavailableIntegrations = [],
        groundedIn,
    } = suggestion || {};

    const evidence = evidenceText(suggestion?.evidence);
    const isMuted = muted || dismissed || built;
    const disabledCtas = dismissed || built;

    return (
        <div
            className={`flex flex-col rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 transition ${
                isMuted ? 'opacity-60' : ''
            }`}
        >
            <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    <Sparkles size={16} className="text-[var(--text-secondary)] mt-0.5 flex-shrink-0" />
                    <GroundingBadge groundedIn={groundedIn} />
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    <ComplexityBadge tier={complexity} />
                    {onDismiss && !disabledCtas && (
                        <button
                            type="button"
                            onClick={() => onDismiss?.(suggestion)}
                            aria-label="Delete suggestion"
                            title="Delete"
                            className="p-0.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition"
                        >
                            <X size={13} />
                        </button>
                    )}
                </div>
            </div>

            {(dismissed || built) && (
                <span
                    className={`self-start mb-2 text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${
                        built
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                            : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
                    }`}
                >
                    {built ? 'Built' : 'Dismissed'}
                </span>
            )}

            <div className="text-sm font-medium text-[var(--text-primary)] mb-1">{title}</div>
            <div className="text-[11px] text-[var(--text-tertiary)] leading-relaxed mb-2 line-clamp-3">{description}</div>

            {evidence && (
                <div className="text-[11px] text-[var(--text-secondary)] leading-relaxed mb-3 line-clamp-2 italic">
                    {evidence}
                </div>
            )}

            <div className="flex flex-wrap items-center gap-1 mb-3">
                {requiredIntegrations.map((ig) => (
                    <span
                        key={ig}
                        className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] border border-[var(--border-default)]"
                    >
                        {ig}
                    </span>
                ))}
                {unavailableIntegrations.length > 0 && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400">
                        needs {unavailableIntegrations.join(', ')}
                    </span>
                )}
            </div>

            <div className="flex items-center gap-2 mt-auto">
                <button
                    type="button"
                    onClick={() => onBuildDirectly?.(suggestion)}
                    disabled={disabledCtas}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: 'var(--accent-primary, var(--text-primary))' }}
                >
                    <Wand2 size={12} /> Build it directly
                </button>
                <button
                    type="button"
                    onClick={() => onAskForChanges?.(suggestion)}
                    disabled={disabledCtas}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Pencil size={12} /> Ask for changes
                </button>
            </div>
        </div>
    );
}

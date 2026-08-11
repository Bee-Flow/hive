import { resolveBinding } from '../resolveBinding';
import { useRuntime } from '../RuntimeContext';
import { ROLE_COLORS } from '../styleResolver';
import { Skeleton } from '../uiBits';

/**
 * App Studio runtime — 'progress'. Spec: server/appStudio/componentSpecs.js.
 * A bound value rendered as a bar against `max`, with an optional label and a
 * percent/fraction caption. Values clamp into [0, max]; a non-numeric value
 * renders an empty (0%) bar rather than crashing.
 */

export default function AppProgress({ node }) {
    const { actionState, dataState, scope } = useRuntime();
    const { max = 100, format = 'percent', label = null, tone = 'primary' } = node.props || {};
    const { value: raw, isLoading } = resolveBinding(node.props?.value, { actionState, dataState, scope });

    if (isLoading) return <Skeleton className="h-2.5 w-full" />;

    const value = Number(raw);
    const ceiling = Number.isFinite(Number(max)) && Number(max) > 0 ? Number(max) : 100;
    const clamped = Number.isFinite(value) ? Math.max(0, Math.min(ceiling, value)) : 0;
    const pct = (clamped / ceiling) * 100;

    const caption = format === 'percent'
        ? `${Math.round(pct)}%`
        : format === 'fraction'
            ? `${Number.isFinite(value) ? clamped.toLocaleString() : 0} / ${ceiling.toLocaleString()}`
            : null;

    const size = node.style?.size || 'md';
    const barH = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2';
    const color = ROLE_COLORS[tone] || ROLE_COLORS.primary;

    return (
        <div className="w-full min-w-0 flex flex-col gap-1" data-app-progress="true">
            {(label || caption) ? (
                <div className="flex items-baseline justify-between gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span className="truncate font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
                    {caption ? <span data-app-progress-caption="true">{caption}</span> : null}
                </div>
            ) : null}
            <div
                className={`w-full ${barH} rounded-full overflow-hidden`}
                style={{ background: 'var(--bg-tertiary)' }}
                role="progressbar"
                aria-valuenow={Math.round(clamped)}
                aria-valuemin={0}
                aria-valuemax={Math.round(ceiling)}
                aria-label={label || 'Progress'}
            >
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
            </div>
        </div>
    );
}

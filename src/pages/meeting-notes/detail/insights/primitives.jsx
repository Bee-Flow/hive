import React from 'react';
import { formatDuration, formatSpeakerLabel } from '../../lib/format';

/**
 * Shared building blocks for the Insights tabs, so five tabs read as one
 * system instead of five ad-hoc layouts.
 *
 * Colour rules: speaker-coded marks use the shared palette
 * (buildSpeakerColorMap/speakerColor) passed in as `color`; everything else
 * uses CSS vars. The one literal is the amber flag already used for a
 * long monologue.
 */

export const FLAG_AMBER = '#f59e0b';

/** Big-number tile — the three meeting-level headline stats. */
export function StatChip({ label, value, hint }) {
    return (
        <div
            className="rounded-lg border px-3 py-2"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
            title={hint}
        >
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{label}</div>
            <div className="text-base font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{value}</div>
        </div>
    );
}

/** Section title inside a tab. */
export function TabHeading({ children, hint }) {
    return (
        <h3
            className="text-xs font-semibold"
            style={{ color: 'var(--text-primary)' }}
            title={hint}
        >
            {children}
        </h3>
    );
}

/** What a tab shows when it has nothing to show — never a bare heading. */
export function EmptyState({ children }) {
    return (
        <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>{children}</p>
    );
}

/** label → value line. `onClick` turns the value into a seek button. */
export function MetricRow({ label, value, detail, onClick, title, flagged = false }) {
    const valueNode = (
        <span
            className="tabular-nums font-medium"
            style={{ color: flagged ? FLAG_AMBER : 'var(--text-primary)' }}
        >
            {value}
        </span>
    );
    return (
        <div className="flex items-baseline gap-2 text-xs">
            <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--text-secondary)' }}>{label}</span>
            {detail && (
                <span className="truncate max-w-[45%]" style={{ color: 'var(--text-muted)' }}>{detail}</span>
            )}
            {onClick ? (
                <button type="button" onClick={onClick} title={title} className="hover:underline shrink-0">
                    {valueNode}
                </button>
            ) : (
                <span className="shrink-0" title={title}>{valueNode}</span>
            )}
        </div>
    );
}

/** Speaker chip: the palette dot plus a humanised name. */
export function SpeakerName({ speakerId, color, className = '' }) {
    return (
        <span className={`inline-flex items-center gap-1.5 min-w-0 ${className}`}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
            <span className="truncate" style={{ color: 'var(--text-primary)' }}>{formatSpeakerLabel(speakerId)}</span>
        </span>
    );
}

/** Horizontal proportion bar — one row of a ranked list. */
export function BarRow({ label, fraction, value, color = 'var(--accent-primary)', onClick, title }) {
    const pct = Math.max(1, Math.round((Number(fraction) || 0) * 100));
    const body = (
        <>
            <span className="w-28 shrink-0 truncate text-left">{label}</span>
            <span className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
            </span>
            <span className="shrink-0 tabular-nums text-right" style={{ color: 'var(--text-muted)' }}>{value}</span>
        </>
    );
    const className = 'w-full flex items-center gap-2 text-xs';
    return onClick ? (
        <button type="button" onClick={onClick} title={title} className={`${className} hover:opacity-80 transition-opacity`} style={{ color: 'var(--text-secondary)' }}>
            {body}
        </button>
    ) : (
        <div className={className} style={{ color: 'var(--text-secondary)' }} title={title}>{body}</div>
    );
}

/**
 * Tiny bar chart over time — used for the turn-taking rhythm. Values are
 * counts; the tallest bar defines full height. Decorative by itself, so the
 * caller supplies the accessible summary via `ariaLabel`.
 */
export function Sparkline({ points, ariaLabel, onSeek, formatTitle }) {
    const max = points.reduce((m, p) => Math.max(m, p.value), 0);
    return (
        <div className="flex items-end gap-px h-8" role="img" aria-label={ariaLabel}>
            {points.map((p) => {
                const h = max > 0 ? Math.max(2, Math.round((p.value / max) * 100)) : 2;
                const style = { height: `${h}%`, background: 'var(--accent-primary)', opacity: max > 0 && p.value > 0 ? 0.85 : 0.25 };
                return onSeek ? (
                    <button
                        key={p.start}
                        type="button"
                        onClick={() => onSeek(p.start)}
                        title={formatTitle ? formatTitle(p) : undefined}
                        className="flex-1 min-w-0 rounded-sm hover:opacity-100"
                        style={style}
                    />
                ) : (
                    <span key={p.start} className="flex-1 min-w-0 rounded-sm" style={style} title={formatTitle ? formatTitle(p) : undefined} />
                );
            })}
        </div>
    );
}

/**
 * Stacked share-per-window column chart: who held the floor when. Each column
 * is one time window; the stack is that window's speech split by speaker.
 */
export function StackedAirtime({ windows, colorFor, ariaLabel, onSeek, formatTitle }) {
    return (
        <div className="flex items-end gap-px h-14" role="img" aria-label={ariaLabel}>
            {windows.map((w) => (
                <button
                    key={w.start}
                    type="button"
                    onClick={onSeek ? () => onSeek(w.start) : undefined}
                    title={formatTitle ? formatTitle(w) : undefined}
                    className="flex-1 min-w-0 h-full flex flex-col justify-end rounded-sm overflow-hidden"
                    style={{ background: 'var(--bg-tertiary)' }}
                >
                    {w.shares.map((s) => (
                        <span
                            key={s.speakerId}
                            className="block w-full"
                            style={{ height: `${Math.max(2, Math.round(s.share * 100))}%`, background: colorFor(s.speakerId) }}
                        />
                    ))}
                </button>
            ))}
        </div>
    );
}

/** "4:47" for a seconds value, with a dash for nothing. */
export function duration(seconds) {
    return Number.isFinite(seconds) && seconds > 0 ? formatDuration(seconds) : '—';
}

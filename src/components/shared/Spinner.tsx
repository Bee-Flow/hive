import React from 'react';

/**
 * Spinner — themed ring spinner. Single canonical replacement for the
 * 20+ inline patterns of:
 *
 *   <div className="w-X h-X border-2 border-[var(--border-default)]
 *                    border-t-[var(--accent-primary)] rounded-full animate-spin" />
 *
 * Lucide's <Loader2 className="animate-spin" /> remains fine for
 * inline-with-text use; this primitive replaces only the standalone
 * CSS ring pattern.
 */

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

export interface SpinnerProps {
    size?: SpinnerSize;
    /** Optional CSS color override for the spinning arc. */
    color?: string;
    /** Visually-hidden text for screen readers describing what's loading. */
    label?: string;
    className?: string;
}

const SIZE_DIM: Record<SpinnerSize, string> = {
    xs: 'w-3 h-3 border-2',
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-[3px]',
};

export default function Spinner({
    size = 'md',
    color,
    label,
    className = '',
}: SpinnerProps) {
    const style: React.CSSProperties = {
        borderColor: 'var(--border-default)',
        borderTopColor: color ?? 'var(--accent-primary)',
    };
    return (
        <span role="status" aria-live="polite" className={`inline-flex items-center ${className}`}>
            <span
                aria-hidden="true"
                className={`${SIZE_DIM[size]} rounded-full animate-spin`}
                style={style}
            />
            {label && <span className="sr-only">{label}</span>}
        </span>
    );
}

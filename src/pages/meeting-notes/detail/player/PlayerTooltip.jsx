import React from 'react';

/**
 * Floating info card for the player layers (marker pins, hover preview).
 *
 * Replaces native `title=` tooltips, which are invisible on touch, take a
 * second to appear, and can't show structure. This one is instant, themed, and
 * pointer-transparent so it never steals the hover that opened it.
 *
 * Positioning: `x` is px within the positioned ancestor; the card centers on
 * it but clamps to the container so it never clips at the edges.
 */
export default function PlayerTooltip({ x, containerWidth, visible, children }) {
    if (!visible) return null;

    const half = 120; // half of max-w below — enough for clamping math
    const clamped = Math.max(half, Math.min((containerWidth || 0) - half, x));

    return (
        <div
            className="absolute bottom-full mb-2 z-20 pointer-events-none"
            style={{ left: clamped, transform: 'translateX(-50%)' }}
        >
            <div
                className="max-w-[240px] px-2.5 py-1.5 rounded-lg border shadow-lg text-[11px] leading-snug"
                style={{
                    background: 'var(--bg-primary)',
                    borderColor: 'var(--border-default)',
                    color: 'var(--text-primary)',
                }}
            >
                {children}
            </div>
        </div>
    );
}

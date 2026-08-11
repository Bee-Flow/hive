/**
 * The realtime pulse — one bar per minute, newest on the right.
 *
 * Deliberately not a TrendChart: at this resolution the data is spiky and
 * mostly empty, and discrete bars read as "these are the minutes something
 * happened" where a smoothed area chart would imply a continuous rate that
 * isn't there.
 */
import React from 'react';
import { ACCENT, fmt } from '../ui';

export default function MinuteBars({
    buckets = [], height = 72, color = ACCENT, overlayColor = '#3b82f6',
    caption, formatLabel = (t) => new Date(t).toISOString().slice(11, 16),
}) {
    let peak = 1;
    for (const b of buckets) {
        if (b.value > peak) peak = b.value;
        if (b.overlay > peak) peak = b.overlay;
    }

    if (!buckets.length) {
        return (
            <div style={{
                height, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: 'var(--text-muted, #888)',
                background: 'var(--bg-tertiary, rgba(255,255,255,0.02))', borderRadius: 10,
            }}>Nothing in the last few minutes.</div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height }}>
                {buckets.map((b, i) => {
                    const h = Math.max(b.value > 0 ? 2 : 0, (b.value / peak) * height);
                    const oh = b.overlay ? Math.max(2, (b.overlay / peak) * height) : 0;
                    return (
                        <div
                            key={b.t ?? i}
                            title={`${formatLabel(b.t)} — ${fmt(b.value)}${b.overlay != null ? ` views, ${fmt(b.overlay)} visitors` : ''}`}
                            style={{ flex: 1, minWidth: 2, position: 'relative', height, display: 'flex', alignItems: 'flex-end' }}
                        >
                            <div style={{
                                width: '100%', height: h, borderRadius: 2, background: color,
                                opacity: b.value ? 1 : 0,
                            }} />
                            {oh > 0 && (
                                <div style={{
                                    position: 'absolute', bottom: 0, left: 0, width: '100%',
                                    height: oh, borderRadius: 2, background: overlayColor, opacity: 0.75,
                                }} />
                            )}
                        </div>
                    );
                })}
            </div>
            <div style={{
                display: 'flex', justifyContent: 'space-between', marginTop: 5,
                fontSize: 10, color: 'var(--text-muted, #777)',
            }}>
                <span>{formatLabel(buckets[0].t)}</span>
                {caption && <span>{caption}</span>}
                <span>now</span>
            </div>
        </div>
    );
}

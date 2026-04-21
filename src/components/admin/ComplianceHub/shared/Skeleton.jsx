import React from 'react';

/**
 * Three pulsing CheckCard-shaped skeletons. Used on first load.
 */
export function CheckCardSkeleton({ count = 3 }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="animate-pulse" style={{
                    border: '1px solid var(--border-default, rgba(255,255,255,0.06))',
                    borderLeft: '4px solid var(--bg-tertiary, rgba(255,255,255,0.05))',
                    background: 'var(--bg-secondary, #1a1a2e)',
                    borderRadius: 10, padding: '16px 18px',
                    display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-tertiary, rgba(255,255,255,0.05))' }} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ width: '40%', height: 12, borderRadius: 4, background: 'var(--bg-tertiary, rgba(255,255,255,0.05))' }} />
                            <div style={{ width: '70%', height: 10, borderRadius: 4, background: 'var(--bg-tertiary, rgba(255,255,255,0.04))' }} />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

/** Hero skeleton for the Overview page — ring placeholder + stats. */
export function OverviewSkeleton() {
    return (
        <div className="animate-pulse" style={{
            background: 'var(--bg-secondary, #1a1a2e)',
            border: '1px solid var(--border-default, rgba(255,255,255,0.06))',
            borderRadius: 14, padding: 24,
            display: 'flex', gap: 24, alignItems: 'center',
        }}>
            <div style={{ width: 140, height: 140, borderRadius: '50%', background: 'var(--bg-tertiary, rgba(255,255,255,0.05))', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ width: '60%', height: 18, borderRadius: 4, background: 'var(--bg-tertiary, rgba(255,255,255,0.05))' }} />
                <div style={{ width: '80%', height: 12, borderRadius: 4, background: 'var(--bg-tertiary, rgba(255,255,255,0.04))' }} />
                <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                    {[0, 1, 2, 3].map(i => (
                        <div key={i} style={{ width: 60, height: 40, borderRadius: 6, background: 'var(--bg-tertiary, rgba(255,255,255,0.04))' }} />
                    ))}
                </div>
            </div>
        </div>
    );
}

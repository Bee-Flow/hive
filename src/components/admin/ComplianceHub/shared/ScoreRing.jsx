import React from 'react';

/**
 * SVG ring showing 0-100 compliance score. Colour scales green→amber→red.
 */
export default function ScoreRing({ score = 0, size = 140, label = '' }) {
    const s = Math.max(0, Math.min(100, Math.round(score)));
    const r = (size - 16) / 2;
    const c = 2 * Math.PI * r;
    const offset = c - (s / 100) * c;

    let color = '#10b981';       // green
    if (s < 60) color = '#ef4444';  // red
    else if (s < 85) color = '#f59e0b'; // amber

    return (
        <div style={{ position: 'relative', width: size, height: size }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={r}
                    fill="none" stroke="var(--border-default, rgba(255,255,255,0.08))" strokeWidth="10" />
                <circle cx={size / 2} cy={size / 2} r={r}
                    fill="none" stroke={color} strokeWidth="10"
                    strokeDasharray={c} strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease' }} />
            </svg>
            <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
            }}>
                <div style={{ fontSize: size * 0.3, fontWeight: 800, color: 'var(--text-primary, #fff)', lineHeight: 1 }}>{s}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
            </div>
        </div>
    );
}

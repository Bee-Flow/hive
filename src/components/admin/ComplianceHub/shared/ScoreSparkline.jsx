import React, { useMemo, useState } from 'react';
import { useTranslation } from '../../../../hooks/useTranslation';

/**
 * Score-over-time sparkline (single series, bounded index 0–100).
 *
 * Design notes (dataviz method): change-over-time → line; single series → no
 * legend, the caption names it; fixed 0–100 domain so the trend is never
 * exaggerated by axis truncation; 2px line; values/caption wear text tokens,
 * not the series color; hover shows a nearest-point tooltip.
 */
export default function ScoreSparkline({ history, width = 220, height = 48 }) {
    const { t } = useTranslation();
    const [hover, setHover] = useState(null); // { x, y, score, at }

    const points = useMemo(() => {
        const rows = (history || []).filter(r => Number.isFinite(Number(r.overall_score)));
        if (rows.length < 2) return null;
        const t0 = new Date(rows[0].captured_at).getTime();
        const t1 = new Date(rows[rows.length - 1].captured_at).getTime();
        const span = Math.max(t1 - t0, 1);
        const pad = 3;
        return rows.map(r => ({
            x: pad + ((new Date(r.captured_at).getTime() - t0) / span) * (width - pad * 2),
            y: pad + (1 - Number(r.overall_score) / 100) * (height - pad * 2),
            score: Number(r.overall_score),
            at: r.captured_at,
        }));
    }, [history, width, height]);

    if (!points) return null; // fewer than 2 sweeps — nothing to trend yet

    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const last = points[points.length - 1];

    const onMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const mx = ((e.clientX - rect.left) / rect.width) * width;
        let nearest = points[0];
        for (const p of points) if (Math.abs(p.x - mx) < Math.abs(nearest.x - mx)) nearest = p;
        setHover(nearest);
    };

    return (
        <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
            <svg width={width} height={height} role="img"
                aria-label={t('compliance.trend_aria', 'Compliance score over the last 90 days')}
                onMouseMove={onMove} onMouseLeave={() => setHover(null)}
                style={{ display: 'block', cursor: 'crosshair' }}>
                {/* Recessive frame: top (100) and bottom (0) reference lines */}
                <line x1="0" y1="1" x2={width} y2="1" stroke="var(--border-default, rgba(255,255,255,0.08))" strokeWidth="1" />
                <line x1="0" y1={height - 1} x2={width} y2={height - 1} stroke="var(--border-default, rgba(255,255,255,0.08))" strokeWidth="1" />
                <path d={path} fill="none" stroke="var(--accent-primary, #6366f1)" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round" />
                {/* Endpoint marker with a 2px surface ring so it reads on the line */}
                <circle cx={last.x} cy={last.y} r="4" fill="var(--accent-primary, #6366f1)"
                    stroke="var(--bg-secondary, #1a1a2e)" strokeWidth="2" />
                {hover && (
                    <>
                        <line x1={hover.x} y1="0" x2={hover.x} y2={height}
                            stroke="var(--text-muted, #888)" strokeWidth="1" strokeDasharray="2,2" />
                        <circle cx={hover.x} cy={hover.y} r="4" fill="var(--accent-primary, #6366f1)"
                            stroke="var(--bg-secondary, #1a1a2e)" strokeWidth="2" />
                    </>
                )}
            </svg>
            {hover && (
                <div style={{
                    position: 'absolute', top: -30,
                    left: Math.min(Math.max(hover.x - 40, 0), width - 84),
                    background: 'var(--bg-primary, #0f0f1a)',
                    border: '1px solid var(--border-default, rgba(255,255,255,0.12))',
                    borderRadius: 6, padding: '3px 8px', pointerEvents: 'none',
                    fontSize: 10.5, color: 'var(--text-primary, #fff)', whiteSpace: 'nowrap',
                }}>
                    <strong>{hover.score}</strong>
                    <span style={{ color: 'var(--text-muted, #888)' }}>
                        {' '}· {new Date(hover.at).toLocaleDateString()}
                    </span>
                </div>
            )}
            <span style={{ fontSize: 10, color: 'var(--text-muted, #888)' }}>
                {t('compliance.trend_caption', 'Score — last 90 days')}
            </span>
        </div>
    );
}

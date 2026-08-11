/**
 * The dashboard's one time-series chart.
 *
 * Hand-rolled SVG rather than recharts, which is already a dependency: its
 * ResponsiveContainer measures to 0x0 under jsdom and renders nothing, which
 * would make every colocated test that touches a chart assert on an empty box.
 * The shape needed here is small enough that owning it is cheaper than working
 * around that.
 *
 * What it does that MonitoringPanel's SvgAreaChart cannot:
 *   - multiple series on one shared y-scale (this period vs last period)
 *   - null gaps that BREAK the line instead of being drawn as zero
 *   - a dashed final segment for a bucket that is still filling up
 *   - reference lines, for the Core Web Vitals thresholds
 */
import React, { useMemo, useState } from 'react';
import { ACCENT, fmt } from '../ui';

const PAD = { top: 10, right: 8, bottom: 20, left: 8 };

function pathFor(values, x, y) {
    // A null is a gap, not a zero: `M` restarts the line after one.
    let d = '';
    let pen = false;
    values.forEach((v, i) => {
        if (v == null || !Number.isFinite(v)) { pen = false; return; }
        d += `${pen ? 'L' : 'M'}${x(i).toFixed(2)},${y(v).toFixed(2)}`;
        pen = true;
    });
    return d;
}

export default function TrendChart({
    series = [], labels = [], height = 200, formatY = fmt, formatLabel,
    refLines = [], partialLast = false, yMin = 0, emptyText = 'No data',
}) {
    const [hover, setHover] = useState(null);
    const n = labels.length;

    const { scaleX, scaleY, top } = useMemo(() => {
        const all = series.flatMap(s => s.data).filter(v => v != null && Number.isFinite(v));
        const refs = refLines.map(r => r.y).filter(Number.isFinite);
        const peak = Math.max(...all, ...refs, 1);
        // Round the top of the axis up so the line never touches the frame.
        const nice = peak <= 1 ? 1 : Math.pow(10, Math.floor(Math.log10(peak)));
        const topV = Math.ceil(peak / nice + 0.15) * nice;
        return {
            top: topV,
            scaleX: (i) => (n <= 1 ? 50 : (i / (n - 1)) * 100),
            scaleY: (v) => {
                const t = (v - yMin) / (topV - yMin || 1);
                return 100 - Math.max(0, Math.min(1, t)) * 100;
            },
        };
    }, [series, refLines, n, yMin]);

    if (!n || !series.some(s => s.data.some(v => v != null))) {
        return (
            <div style={{
                height, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: 'var(--text-muted, #888)',
                background: 'var(--bg-tertiary, rgba(255,255,255,0.02))', borderRadius: 10,
            }}>{emptyText}</div>
        );
    }

    const label = (i) => (formatLabel ? formatLabel(i) : labels[i]);

    return (
        <div style={{ position: 'relative' }}>
            <svg
                viewBox="0 0 100 100" preserveAspectRatio="none"
                style={{ width: '100%', height, display: 'block', overflow: 'visible' }}
                role="img"
                aria-label={`${series.map(s => s.label).join(' and ')} over ${n} points`}
            >
                {refLines.map((r, i) => (
                    <g key={i}>
                        <line x1="0" x2="100" y1={scaleY(r.y)} y2={scaleY(r.y)}
                            stroke={r.color || 'var(--border-default, rgba(255,255,255,0.18))'}
                            strokeWidth="0.4" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
                    </g>
                ))}

                {series.map((s, si) => {
                    const color = s.color || (si === 0 ? ACCENT : '#3b82f6');
                    const solid = partialLast ? s.data.slice(0, -1) : s.data;
                    const d = pathFor(solid, scaleX, scaleY);
                    // The final segment is dashed when today's bucket is still
                    // filling — otherwise it reads as a crash that hasn't happened.
                    const tailFrom = s.data.length - 2;
                    const tail = partialLast && tailFrom >= 0
                        ? pathFor(s.data.slice(tailFrom), (i) => scaleX(tailFrom + i), scaleY)
                        : '';
                    return (
                        <g key={s.key || si}>
                            {s.style !== 'line' && s.style !== 'dashed' && (
                                <path
                                    d={`${d}L${scaleX(s.data.length - 1)},100L${scaleX(0)},100Z`}
                                    fill={color} opacity={0.12}
                                />
                            )}
                            <path d={d} fill="none" stroke={color}
                                strokeWidth={s.style === 'dashed' ? 1.2 : 1.6}
                                strokeDasharray={s.style === 'dashed' ? '3 2' : undefined}
                                strokeLinejoin="round" strokeLinecap="round"
                                vectorEffect="non-scaling-stroke" />
                            {tail && (
                                <path d={tail} fill="none" stroke={color} strokeWidth="1.6"
                                    strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
                            )}
                        </g>
                    );
                })}

                {hover != null && (
                    <line x1={scaleX(hover)} x2={scaleX(hover)} y1="0" y2="100"
                        stroke="var(--text-muted, #888)" strokeWidth="0.4"
                        vectorEffect="non-scaling-stroke" />
                )}

                {/* Invisible hit targets — one per bucket. */}
                {labels.map((_, i) => (
                    <rect key={i} x={scaleX(i) - (n <= 1 ? 50 : 50 / (n - 1))} y="0"
                        width={n <= 1 ? 100 : 100 / (n - 1)} height="100"
                        fill="transparent"
                        onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
                ))}
            </svg>

            <div style={{
                display: 'flex', justifyContent: 'space-between', marginTop: 4,
                fontSize: 10, color: 'var(--text-muted, #777)',
            }}>
                <span>{label(0)}</span>
                <span>{label(n - 1)}</span>
            </div>

            {hover != null && (
                <div style={{
                    position: 'absolute', top: 0,
                    left: `${scaleX(hover)}%`, transform: 'translateX(-50%)',
                    pointerEvents: 'none', padding: '6px 9px', borderRadius: 8,
                    background: 'var(--bg-secondary, #12121f)',
                    border: '1px solid var(--border-default, rgba(255,255,255,0.14))',
                    fontSize: 11, whiteSpace: 'nowrap', zIndex: 2,
                }}>
                    <div style={{ color: 'var(--text-muted, #888)', marginBottom: 3 }}>{label(hover)}</div>
                    {series.map((s, si) => (
                        <div key={s.key || si} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{
                                width: 7, height: 7, borderRadius: 2,
                                background: s.color || (si === 0 ? ACCENT : '#3b82f6'),
                            }} />
                            <span style={{ color: 'var(--text-muted, #999)' }}>{s.label}</span>
                            <span style={{ color: 'var(--text-primary, #fff)', fontWeight: 700, marginLeft: 'auto' }}>
                                {s.data[hover] == null ? 'no data' : formatY(s.data[hover])}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {series.length > 1 && (
                <div style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
                    {series.map((s, si) => (
                        <span key={s.key || si} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                            <span style={{
                                width: 10, height: 3, borderRadius: 2,
                                background: s.color || (si === 0 ? ACCENT : '#3b82f6'),
                                opacity: s.style === 'dashed' ? 0.6 : 1,
                            }} />
                            <span style={{ color: 'var(--text-muted, #888)' }}>{s.label}</span>
                        </span>
                    ))}
                    {partialLast && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted, #777)' }}>
                            dashed = period still in progress
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
export { PAD };

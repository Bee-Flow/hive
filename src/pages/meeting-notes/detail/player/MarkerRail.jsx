import React, { memo, useRef, useState } from 'react';
import PlayerTooltip from './PlayerTooltip';
import { formatDuration } from '../../lib/format';

/**
 * Action-item pins in their own rail above the waveform.
 *
 * The previous design drew markers as full-height bars through the waveform —
 * they read as playhead clones and sliced up the audio picture. Pins in a
 * dedicated rail keep "moments" and "audio" as separate visual sentences.
 * Near-coincident items arrive pre-clustered (timelineMarkers.js) and show a
 * count pill; done items hollow out and mute.
 */
function MarkerRail({ markers = [], onJump, color = 'var(--accent-primary)', ariaLabel = 'Action item moments' }) {
    const railRef = useRef(null);
    const [hovered, setHovered] = useState(null); // marker + x, while a pin is hovered/focused

    if (!markers.length) return null;

    const show = (m) => {
        const width = railRef.current?.offsetWidth || 0;
        setHovered({ marker: m, x: m.fraction * width, width });
    };

    return (
        <div ref={railRef} className="relative h-3" aria-label={ariaLabel} role="group">
            {markers.map((m) => (
                <button
                    key={m.id}
                    type="button"
                    onClick={() => onJump?.(m.seconds)}
                    onMouseEnter={() => show(m)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => show(m)}
                    onBlur={() => setHovered(null)}
                    aria-label={`Play from ${formatDuration(m.seconds)}: ${m.label}`}
                    className="absolute top-0 -ml-2 w-4 h-full flex items-center justify-center"
                    style={{ left: `${m.fraction * 100}%` }}
                >
                    {m.count > 1 ? (
                        <span
                            className="min-w-[16px] h-[13px] px-0.5 rounded-full text-[9px] font-semibold leading-[13px] text-center text-white"
                            style={{ background: color, opacity: m.done ? 0.45 : 1 }}
                        >
                            {m.count}
                        </span>
                    ) : (
                        <span
                            className="w-2 h-2 rounded-full border transition-transform hover:scale-125"
                            style={m.done
                                ? { background: 'transparent', borderColor: 'var(--text-muted)', opacity: 0.6 }
                                : { background: color, borderColor: color }}
                        />
                    )}
                </button>
            ))}

            <PlayerTooltip x={hovered?.x || 0} containerWidth={hovered?.width || 0} visible={!!hovered}>
                {hovered && (
                    <>
                        <span className="font-mono" style={{ color: 'var(--text-muted)' }}>
                            {formatDuration(hovered.marker.seconds)}
                        </span>
                        <div className="line-clamp-3">{hovered.marker.label}</div>
                        {hovered.marker.assignee && (
                            <div style={{ color: 'var(--text-muted)' }}>→ {hovered.marker.assignee}</div>
                        )}
                    </>
                )}
            </PlayerTooltip>
        </div>
    );
}

export default memo(MarkerRail);

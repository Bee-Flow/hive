import { Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChapterStrip from './ChapterStrip';
import { drawWaveform } from './drawWaveform';
import MarkerRail from './MarkerRail';
import PlayerTooltip from './PlayerTooltip';
import SpeakerRows, { TRACK_INDENT_CLASS, TRACK_LEFT_CLASS } from './SpeakerRows';
import { formatDuration, formatSpeakerLabel } from '../../lib/format';
import { segmentNearTime, segmentSpeakerId, speakerColor } from '../../lib/playerData';

/**
 * The layered timeline: marker rail, waveform, per-speaker rows, chapter strip.
 *
 * Every layer shares ONE time axis: the speaker rows' label column width is
 * the indent for the other layers, and a single DOM-overlay playhead runs
 * vertically through waveform + rows (also the only playhead — the canvas
 * paints bars, nothing else, so a mousemove no longer repaints 600 bars and
 * the "now" line is visible at 0:00).
 *
 * Layer discipline (the "no overload" contract): the permanent layers are
 * color and shape plus the speaker names and chapter labels; everything else —
 * timestamps, what's being said — appears in one floating chip under the cursor.
 */
export default function TimelineStack({
    peaks, loading, duration, currentTime,
    markers, mentionMarkers = [], rows, others, colorMap, chapters, segments,
    onSeekTo,
}) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [hover, setHover] = useState(null); // { x, frac, width } while over the waveform

    const progress = duration > 0 ? currentTime / duration : 0;

    // Bars only — the hover ghost and playhead live in the overlay below, so
    // hovering doesn't trigger a full canvas repaint anymore.
    const draw = useCallback(() => {
        drawWaveform(canvasRef.current, { peaks, progress });
    }, [peaks, progress]);

    useEffect(() => { draw(); }, [draw]);
    useEffect(() => {
        const ro = new ResizeObserver(draw);
        if (containerRef.current) ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, [draw]);

    const fracFromEvent = (e) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect || !rect.width) return null;
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        return {
            frac: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
            x: clientX - rect.left,
            width: rect.width,
        };
    };

    const handleSeek = (e) => {
        const p = fracFromEvent(e);
        if (p && duration) onSeekTo(p.frac * duration);
    };

    // Stable jump handler so the memoized rail/strip stay out of the
    // timeupdate re-render loop.
    const jumpTo = useCallback((sec) => onSeekTo(sec, { play: true }), [onSeekTo]);

    // ChapterStrip gets the active INDEX (changes a handful of times per
    // meeting) instead of currentTime (changes 4×/s), so React.memo holds.
    const activeChapterIndex = useMemo(
        () => chapters.findIndex((c) => currentTime >= c.seconds && currentTime < c.endSeconds),
        [chapters, currentTime],
    );

    return (
        <div ref={containerRef} className="flex flex-col gap-1.5">
            <div className={TRACK_INDENT_CLASS}>
                <MarkerRail markers={markers} onJump={jumpTo} />
            </div>

            {/* The viewer's private name-mention pins — their own rail so a
                mention never clusters into an action-item pin. Amber, to read
                as "about you" rather than "to do". */}
            {mentionMarkers.length > 0 && (
                <div className={TRACK_INDENT_CLASS}>
                    <MarkerRail
                        markers={mentionMarkers}
                        onJump={jumpTo}
                        color="#f59e0b"
                        ariaLabel="Moments where your name was mentioned"
                    />
                </div>
            )}

            <div className="relative">
                <div className={`relative h-12 ${TRACK_INDENT_CLASS}`}>
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--text-muted)' }} />
                        </div>
                    )}
                    <canvas
                        ref={canvasRef}
                        className="w-full h-12 cursor-pointer"
                        onClick={handleSeek}
                        onMouseMove={(e) => setHover(fracFromEvent(e))}
                        onMouseLeave={() => setHover(null)}
                        onTouchStart={handleSeek}
                    />
                    <WaveformHoverChip hover={hover} duration={duration} segments={segments} colorMap={colorMap} />
                </div>

                <div className="mt-1.5">
                    <SpeakerRows
                        rows={rows}
                        others={others}
                        colorMap={colorMap}
                        duration={duration}
                        segments={segments}
                        onSeekTo={onSeekTo}
                    />
                </div>

                <PlayheadOverlay hoverFrac={hover?.frac ?? null} progress={progress} visible={duration > 0} />
            </div>

            <div className={TRACK_INDENT_CLASS}>
                <ChapterStrip chapters={chapters} activeIndex={activeChapterIndex} onSeek={jumpTo} />
            </div>
        </div>
    );
}

/**
 * The waveform's hover chip: timestamp + who's talking + what they're saying,
 * from one binary search per mousemove. Tolerant lookup so the name doesn't
 * blink out in the sub-second gaps between a speaker's segments. Desktop-only
 * by nature — no hover on touch.
 */
function WaveformHoverChip({ hover, duration, segments, colorMap }) {
    const hoverSegment = hover && duration ? segmentNearTime(segments, hover.frac * duration) : null;
    const hoverSpeaker = hoverSegment ? segmentSpeakerId(hoverSegment) : null;
    return (
        <PlayerTooltip x={hover?.x || 0} containerWidth={hover?.width || 0} visible={!!hover}>
            {hover && (
                <>
                    <span className="font-mono" style={{ color: 'var(--text-muted)' }}>
                        {formatDuration(hover.frac * duration)}
                    </span>
                    {hoverSpeaker && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ background: speakerColor(colorMap, hoverSpeaker) }}
                            />
                            <span className="font-medium">{formatSpeakerLabel(hoverSpeaker)}</span>
                        </div>
                    )}
                    {hoverSegment?.text && (
                        <div className="line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                            {hoverSegment.text}
                        </div>
                    )}
                </>
            )}
        </PlayerTooltip>
    );
}

/**
 * One playhead through waveform + rows (plus the hover ghost). Rendered
 * whenever a duration exists, so "now" is visible at 0:00 too.
 * pointer-events-none: purely visual.
 */
function PlayheadOverlay({ hoverFrac, progress, visible }) {
    return (
        <div className={`absolute inset-y-0 right-0 ${TRACK_LEFT_CLASS} pointer-events-none`} aria-hidden="true">
            {hoverFrac != null && (
                <div
                    className="absolute top-0 bottom-0 w-px"
                    style={{ left: `${hoverFrac * 100}%`, background: 'rgba(148, 163, 184, 0.6)' }}
                />
            )}
            {visible && (
                <div
                    className="absolute top-0 bottom-0 w-[2px] -translate-x-1/2"
                    style={{ left: `${progress * 100}%`, background: 'var(--accent-primary)' }}
                >
                    <div
                        className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                        style={{ background: 'var(--accent-primary)' }}
                    />
                </div>
            )}
        </div>
    );
}

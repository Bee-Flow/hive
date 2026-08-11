import React, { memo, useRef, useState } from 'react';
import PlayerTooltip from './PlayerTooltip';
import { formatDuration } from '../../lib/format';

/** Labels vanish below this width — an ellipsis on 4% of a strip is noise. */
const LABEL_MIN_FRACTION = 0.06;

/**
 * Topic blocks along the bottom of the player — the meeting's table of
 * contents, clickable. Text on the timeline is budgeted for names and topics
 * only: "what was this meeting about" beats every other annotation.
 *
 * Hovering (or focusing) a block opens a PlayerTooltip with the chapter title,
 * its time range, and a one-line summary when the note has one — the same
 * floating card the action-item pins use, replacing the old native `title=`
 * (invisible on touch, slow, no structure). Renders nothing when the meeting
 * has no chapters yet — the player must look complete without it.
 *
 * Takes the active chapter INDEX, not the current time: the index changes a
 * handful of times per meeting, so the memo actually keeps this strip out of
 * the 4×/s timeupdate re-render loop.
 */
function ChapterStrip({ chapters = [], activeIndex = -1, onSeek }) {
    const stripRef = useRef(null);
    const [hovered, setHovered] = useState(null); // { index, x, width } while a block is hovered/focused

    if (!chapters.length) return null;

    // Anchor the tooltip on the block's own centre (accurate under flex gap /
    // min-width / shrink), measured against the positioned strip container.
    const show = (i, e) => {
        const btn = e.currentTarget;
        const width = stripRef.current?.offsetWidth || 0;
        setHovered({ index: i, x: btn.offsetLeft + btn.offsetWidth / 2, width });
    };
    const hide = () => setHovered(null);

    const hc = hovered != null ? chapters[hovered.index] : null;

    return (
        <div ref={stripRef} className="relative flex w-full gap-[3px]" role="group" aria-label="Chapters">
            {chapters.map((c, i) => {
                const active = i === activeIndex;
                return (
                    <button
                        key={`${c.seconds}-${c.title}`}
                        type="button"
                        onClick={() => onSeek?.(c.seconds)}
                        onMouseEnter={(e) => show(i, e)}
                        onMouseLeave={hide}
                        onFocus={(e) => show(i, e)}
                        onBlur={hide}
                        aria-label={`Chapter: ${c.title}, starts at ${formatDuration(c.seconds)}`}
                        aria-current={active ? 'true' : undefined}
                        className="h-[22px] min-w-[8px] rounded-md px-1.5 text-[10px] font-medium truncate transition-colors"
                        style={{
                            flexBasis: `${c.widthFraction * 100}%`,
                            flexGrow: 0,
                            flexShrink: 1,
                            background: active
                                ? 'color-mix(in srgb, var(--accent-primary) 22%, var(--bg-tertiary))'
                                : 'var(--bg-tertiary)',
                            color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                            boxShadow: active ? 'inset 0 0 0 1px var(--accent-primary)' : 'none',
                        }}
                    >
                        {c.widthFraction >= LABEL_MIN_FRACTION ? c.title : ''}
                    </button>
                );
            })}

            <PlayerTooltip x={hovered?.x || 0} containerWidth={hovered?.width || 0} visible={!!hc}>
                {hc && (
                    <>
                        <div className="font-semibold line-clamp-2">{hc.title}</div>
                        <div className="font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {formatDuration(hc.seconds)} – {formatDuration(hc.endSeconds)}
                        </div>
                        {hc.summary && <div className="mt-1 line-clamp-3">{hc.summary}</div>}
                    </>
                )}
            </PlayerTooltip>
        </div>
    );
}

export default memo(ChapterStrip);

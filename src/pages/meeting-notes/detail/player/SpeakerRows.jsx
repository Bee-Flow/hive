import React, { memo, useRef, useState } from 'react';
import PlayerTooltip from './PlayerTooltip';
import { NEUTRAL_SPEAKER_COLOR } from '../../../../config/meetingNotesConfig';
import { formatDuration, formatSpeakerLabel } from '../../lib/format';
import { segmentNearTime, segmentSpeakerId, speakerColor } from '../../lib/playerData';

/**
 * Per-speaker timeline rows — the "who spoke when" view that replaced the
 * anonymous 6px SpeakerLane ribbon. Each ranked speaker gets a labeled row of
 * colored blocks on the shared time axis; speakers past the top rows collapse
 * into one grey aggregate row behind a "+N more" toggle.
 *
 * Unlike the old ribbon this IS a control surface (not aria-hidden): every
 * block is a real button that seeks-and-plays, with a roving tabindex so the
 * grid costs one Tab stop instead of hundreds. The transcript stays the
 * accessible long-form route for reading who said what.
 */

// The label column width doubles as the track indent for the waveform /
// marker rail / chapter strip, so every layer shares one time axis.
// Keep these three in sync (same rem values, different CSS properties).
export const SPEAKER_LABEL_CLASS = 'w-16 sm:w-28';
export const TRACK_INDENT_CLASS = 'ml-16 sm:ml-28';
export const TRACK_LEFT_CLASS = 'left-16 sm:left-28';

/** Rows shown while collapsed; the rest lives behind the "+N more" toggle. */
export const DEFAULT_MAX_ROWS = 6;

/** Arrow-key navigation for the roving tabindex grid. */
function rovingKeyDown(e, [r, b], focusBlock) {
    if (e.key === 'ArrowRight') { e.preventDefault(); focusBlock(r, b + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); focusBlock(r, b - 1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); focusBlock(r + 1, 0); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusBlock(r - 1, 0); }
    else if (e.key === 'Home') { e.preventDefault(); focusBlock(r, 0); }
    else if (e.key === 'End') { e.preventDefault(); focusBlock(r, Infinity); }
}

/** One row's block track. Click seeks proportionally inside the block. */
function Track({ blocks, color, label, rowIdx, focusPos, setFocusPos, onSeekTo, onHover, onLeave }) {
    const blockClick = (e, block) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const frac = rect.width && e.clientX ? Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) : 0;
        onSeekTo(block.start + frac * (block.end - block.start), { play: true });
    };

    return (
        <div
            className="relative h-3 flex-1 rounded-sm"
            style={{ background: 'var(--bg-tertiary)' }}
            onMouseMove={onHover}
            onMouseLeave={onLeave}
        >
            {blocks.map((b, i) => (
                <button
                    key={`${b.start}-${i}`}
                    type="button"
                    data-row={rowIdx}
                    data-block={i}
                    tabIndex={focusPos[0] === rowIdx && focusPos[1] === i ? 0 : -1}
                    aria-label={`Play ${label} at ${formatDuration(b.start)}`}
                    onClick={(ev) => blockClick(ev, b)}
                    onFocus={() => setFocusPos([rowIdx, i])}
                    className="absolute top-0 h-full rounded-[2px] focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)] outline-none"
                    style={{
                        left: `${b.fraction * 100}%`,
                        width: `${b.widthFraction * 100}%`,
                        background: color,
                        opacity: 0.85,
                    }}
                />
            ))}
        </div>
    );
}

/** The rows' floating chip: time + who + (matching) spoken text. */
function RowsHoverChip({ hover, colorMap }) {
    return (
        <PlayerTooltip x={hover?.x || 0} containerWidth={hover?.width || 0} visible={!!hover}>
            {hover && (
                <>
                    <span className="font-mono" style={{ color: 'var(--text-muted)' }}>
                        {formatDuration(hover.time)}
                    </span>
                    {hover.speakerId && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ background: speakerColor(colorMap, hover.speakerId) }}
                            />
                            <span className="font-medium">{formatSpeakerLabel(hover.speakerId)}</span>
                        </div>
                    )}
                    {hover.text && (
                        <div className="line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                            {hover.text}
                        </div>
                    )}
                </>
            )}
        </PlayerTooltip>
    );
}

function SpeakerRows({ rows = [], others = null, colorMap = {}, duration = 0, segments = [], onSeekTo, maxRows = DEFAULT_MAX_ROWS }) {
    const [expanded, setExpanded] = useState(false);
    const [hover, setHover] = useState(null); // { x, width, time, speakerId, text }
    const [focusPos, setFocusPos] = useState([0, 0]); // roving tabindex [row, block]
    const containerRef = useRef(null);

    if (!rows.length || !duration) return null;

    const visibleRows = expanded ? rows : rows.slice(0, maxRows);
    const showOthers = !expanded && others;
    const grid = visibleRows.map((r) => r.blocks.length);
    if (showOthers) grid.push(others.blocks.length);

    // Positional preview. A named row always announces its own speaker and
    // looks up what THAT speaker said nearest to the cursor (tolerant lookup:
    // blocks bridge ≤1s diarizer gaps, so an exact hit can miss while the
    // cursor is visually on the block); the grey aggregate row shows whoever
    // spoke around that instant.
    const hoverFor = (rowSpeakerId) => (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const container = containerRef.current?.getBoundingClientRect();
        if (!rect.width || !container) return;
        const time = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration;
        const seg = segmentNearTime(segments, time, { speakerId: rowSpeakerId || null });
        setHover({
            x: e.clientX - container.left,
            width: container.width,
            time,
            speakerId: rowSpeakerId || (seg ? segmentSpeakerId(seg) : null),
            text: seg ? seg.text : null,
        });
    };
    const clearHover = () => setHover(null);

    const focusBlock = (rowIdx, blockIdx) => {
        const row = Math.max(0, Math.min(grid.length - 1, rowIdx));
        const block = Math.max(0, Math.min((grid[row] || 1) - 1, blockIdx));
        setFocusPos([row, block]);
        containerRef.current?.querySelector(`[data-row="${row}"][data-block="${block}"]`)?.focus();
    };

    const trackProps = { focusPos, setFocusPos, onSeekTo, onLeave: clearHover };

    return (
        <div
            ref={containerRef}
            role="group"
            aria-label="Speaker timeline"
            className="relative flex flex-col gap-[3px]"
            onKeyDown={(e) => rovingKeyDown(e, focusPos, focusBlock)}
        >
            <div className={`flex flex-col gap-[3px] ${expanded ? 'max-h-[170px] overflow-y-auto pr-0.5' : ''}`}>
                {visibleRows.map((row, rowIdx) => {
                    const label = formatSpeakerLabel(row.speakerId);
                    return (
                        <div key={row.speakerId} className="flex items-center">
                            <span
                                className={`${SPEAKER_LABEL_CLASS} shrink-0 pr-2 truncate text-[11px] leading-3`}
                                style={{ color: 'var(--text-secondary)' }}
                                title={`${label} · ${formatDuration(row.speakingSeconds)}`}
                            >
                                {label}
                            </span>
                            <Track
                                blocks={row.blocks}
                                color={speakerColor(colorMap, row.speakerId)}
                                label={label}
                                rowIdx={rowIdx}
                                onHover={hoverFor(row.speakerId)}
                                {...trackProps}
                            />
                        </div>
                    );
                })}

                {showOthers && (
                    <div className="flex items-center">
                        <button
                            type="button"
                            onClick={() => setExpanded(true)}
                            aria-expanded={false}
                            aria-label={`Show ${others.count} more speakers`}
                            className={`${SPEAKER_LABEL_CLASS} shrink-0 pr-2 truncate text-left text-[11px] leading-3 hover:underline`}
                            style={{ color: 'var(--text-muted)' }}
                        >
                            +{others.count} more
                        </button>
                        <Track
                            blocks={others.blocks}
                            color={NEUTRAL_SPEAKER_COLOR}
                            label="other speakers"
                            rowIdx={visibleRows.length}
                            onHover={hoverFor(null)}
                            {...trackProps}
                        />
                    </div>
                )}
            </div>

            {expanded && rows.length > maxRows && (
                <button
                    type="button"
                    onClick={() => setExpanded(false)}
                    aria-expanded
                    className="self-start text-[11px] hover:underline"
                    style={{ color: 'var(--text-muted)' }}
                >
                    Show less
                </button>
            )}

            <RowsHoverChip hover={hover} colorMap={colorMap} />
        </div>
    );
}

// The player re-renders ~4×/s on timeupdate; rows carry no time prop (the
// playhead is the parent's overlay), so memo keeps them out of that loop.
export default memo(SpeakerRows);

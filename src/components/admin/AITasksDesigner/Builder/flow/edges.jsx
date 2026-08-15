import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow, useViewport } from '@xyflow/react';
import { Palette, Plus, X } from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { EDGE_COLOR_KEYS, resolveEdgeColor } from './edgeColors';
import { hopPath } from './edgeHops';
import { useEdgeCrossingVersion, useEdgeCrossings } from './EdgeCrossingContext';

/**
 * Custom edge that renders `then` / `else` / loop labels as a small
 * theme-tokened chip near the source instead of letting React Flow
 * draw a flat label tag. Falls back to an unlabelled smooth-step edge
 * for edges without a label.
 *
 * In editable mode it also exposes, on hover, midpoint controls:
 *   • a "+" button that inserts a step BETWEEN the two nodes (splices
 *     the edge), via `data.onInsert({ source, target, sourceHandle })` —
 *     sourceHandle carries the branch port (then/else/case:<name>) so the
 *     spliced-in step keeps routing on the same branch
 *   • a "×" button that removes the connection, via
 *     `data.onDelete({ source, target })`
 *   • a palette button that swaps the row for eight colour dots + an
 *     "auto" dot, via `data.onSetColor({ …identity, color|null })` — the
 *     connection's colour is definition data (edge.color, a palette key)
 * The callbacks + the `editable` flag are threaded in through `data`
 * by DiagramPane (the edge component can't reach the parent directly).
 *
 * Parallel edges (several cases routing to the SAME node) fan out: layout.js
 * assigns each a lane (`parallelIndex`/`parallelCount`) and the target-side
 * Y coordinate shifts a few px per lane so the lines stay distinguishable;
 * chips stagger horizontally for the same reason.
 *
 * Hover behaviour (BFSF-331). The chip, the data pill and the action buttons
 * are ONE cluster in ONE EdgeLabelRenderer wrapper that owns the hover state.
 * They used to be two mutually exclusive layers — the chip unmounted the
 * instant you hovered, and the buttons sat at the midpoint the pointer had to
 * leave the line to reach, which fired mouseleave and took them away again.
 * Every control being a DOM descendant of the hovered element makes that
 * impossible (the StepNodeBase idiom).
 */

// Vertical distance between parallel lanes, in flow units. 26 rather than 12
// because the invisible hit band below is up to LANE_PITCH-4 wide: at 12 the
// neighbouring lanes' hit areas overlapped and the wrong edge won the hover.
const LANE_PITCH = 26;
// Horizontal chip stagger for parallel lanes.
const CHIP_PITCH = 28;
// Grace period between leaving the cluster and it closing, so the few pixels
// between the line and a button don't dismiss it.
const CLOSE_DELAY_MS = 220;
// How far from the line's midpoint you have to hover before the cluster comes
// to YOU instead of appearing at the midpoint. Below this the jump would be
// pointless motion; above it, "the buttons are somewhere else on the line" is
// exactly the complaint (BFSF-331). In flow units.
const ANCHOR_DEAD_ZONE = 60;

export function LabelledEdge({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd, style }) {
    const laneCount = data?.parallelCount || 1;
    const laneIndex = data?.parallelIndex || 0;
    const laneDy = laneCount > 1 ? (laneIndex - (laneCount - 1) / 2) * LANE_PITCH : 0;
    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX, sourceY, targetX, targetY: targetY + laneDy, sourcePosition, targetPosition, borderRadius: 12,
    });

    // ── line hops ───────────────────────────────────────────────────────
    // A plain crossing is ambiguous: where two lines meet there is nothing to
    // say whether the one you are following carries on or turns. Publish our
    // own geometry, read everyone else's, and bridge over theirs. The DRAWN
    // path is the hopped one; `edgePath` stays the geometry of record, so the
    // label position and what we publish are unaffected by decoration.
    // The API is stable by construction — depending on a value that changed per
    // bump made this effect tear down and re-publish on every bump, which fed
    // the next one and locked the canvas up the moment a drag ended.
    const crossings = useEdgeCrossings();
    useLayoutEffect(() => {
        if (!crossings) return undefined;
        crossings.publish(id, edgePath);
        return () => crossings.retract(id);
    }, [crossings, id, edgePath]);
    // The version is a RENDER-time signal that some other edge moved. Nothing
    // may hang off it in an effect.
    const crossingVersion = useEdgeCrossingVersion();
    const drawnPath = useMemo(
        () => (crossings ? hopPath(edgePath, crossings.others(id)) : edgePath),
        // crossingVersion looks unused to the linter — `others()` reads a
        // mutable registry, so the version IS the invalidation signal. Drop it
        // and an edge keeps bridging over lines that have since moved away.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [crossings, crossingVersion, edgePath, id],
    );

    const chipDx = laneCount > 1 ? (laneIndex - (laneCount - 1) / 2) * CHIP_PITCH : 0;
    const [hovered, setHovered] = useState(false);
    // Clicking the line LATCHES the cluster open, so the buttons stay put
    // while you aim at them (and survive a stray mouseleave entirely).
    const [latched, setLatched] = useState(false);
    const [swatchesOpen, setSwatchesOpen] = useState(false);
    // EdgeLabelRenderer content lives inside the viewport transform, so at 2×
    // zoom the cluster would blow up into billboard-sized dots. Counter-scale
    // by the zoom (clamped so extreme zoom-out doesn't make it unhittable).
    // The whole cluster scales together now — chip, data pill and buttons —
    // because they are one unit; a chip that grew while its buttons shrank
    // read as two unrelated things.
    const { zoom } = useViewport();
    const controlScale = Math.min(2, Math.max(0.5, 1 / (zoom || 1)));
    const kind = data?.kind || null;
    const editable = !!data?.editable;
    const dataSummary = data?.dataSummary || null;
    // The line's identity colour (manual or mode-derived) — stamped by
    // DiagramPane's identity pass. Case-name chips tint to match; the
    // SEMANTIC chips (then/else/on error/never runs) keep their fixed tones.
    const chipColor = data?.chipColor || null;
    const tone = kind === 'pii_found'
        // Amber, not red: personal data is a finding to act on, not a failure.
        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
        : kind === 'then' || kind === 'pii_clean'
            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
            : kind === 'else'
            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
            : kind === 'default'
                ? 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] border-[var(--border-default)] italic'
                : kind === 'on_error'
                    ? 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30'
                    : kind === 'unrouted'
                        ? 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/40 border-dashed'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-default)]';
    // 'unrouted' flags an unlabelled edge out of a brancher — the runtime
    // never follows it (routing is label-only), so it must not read as a
    // working connection. The chip text says so; delete-and-redraw from a
    // branch port is the fix.
    // then/else are the runtime's names; the canvas shows the unified node's
    // wording so a chip reads the same as the port it came out of.
    // pii_found / pii_clean are a GUARD's two branches. They are the same
    // then/else edges underneath, but "match" / "otherwise" tells you nothing
    // about what the guard decided.
    const CHIP_TEXT = {
        unrouted: 'never runs', on_error: 'on error', then: 'match', else: 'otherwise', default: 'otherwise',
        pii_found: 'personal data', pii_clean: 'clean',
    };
    const chipText = CHIP_TEXT[kind] || kind;
    const semanticChip = !!CHIP_TEXT[kind];
    const chipTint = chipColor && !semanticChip
        ? { color: chipColor, borderColor: `${chipColor}55`, background: `${chipColor}22` }
        : null;

    const identity = () => ({
        source, target,
        sourceHandle: data?.sourceHandle || null,
        label: data?.defLabel ?? null,
        caseName: data?.defCaseName ?? null,
    });

    // ── open / close ────────────────────────────────────────────────────
    const closeTimer = useRef(null);
    const cancelClose = useCallback(() => {
        if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    }, []);
    const open = useCallback(() => { cancelClose(); setHovered(true); }, [cancelClose]);
    const swatchesRef = useRef(false);
    swatchesRef.current = swatchesOpen;
    const latchedRef = useRef(false);
    latchedRef.current = latched;
    const scheduleClose = useCallback(() => {
        cancelClose();
        // A latched cluster and an OPEN colour picker both stay: dismissing the
        // swatches on mouseleave meant the palette closed the moment you moved
        // towards it.
        if (latchedRef.current || swatchesRef.current) return;
        closeTimer.current = setTimeout(() => {
            closeTimer.current = null;
            setHovered(false);
            // Back to the midpoint, so the resting chip/badge sits where a
            // label belongs rather than wherever you last pointed.
            setAnchor(null);
        }, CLOSE_DELAY_MS);
    }, [cancelClose]);
    useEffect(() => cancelClose, [cancelClose]);

    // ── where the cluster appears ───────────────────────────────────────
    //
    // At rest it sits at the line's midpoint, which is where a label belongs.
    // But on a long connection the midpoint can be hundreds of pixels from
    // where you actually pointed, so the controls "appeared somewhere else" —
    // the reachability half of BFSF-331. On hover the cluster moves to the
    // point you entered the line at.
    //
    // It anchors ON ENTER and then stays put: a cluster that tracks the pointer
    // is a moving target you can never land on. Clicking latches it where it
    // already is.
    const [anchor, setAnchor] = useState(null);
    const rf = useReactFlow();
    const anchorAt = useCallback((event) => {
        if (!rf?.screenToFlowPosition || event?.clientX == null) return;
        const p = rf.screenToFlowPosition({ x: event.clientX, y: event.clientY });
        if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
        // Near the middle the midpoint IS the natural spot — don't nudge it.
        if (Math.hypot(p.x - labelX, p.y - labelY) < ANCHOR_DEAD_ZONE) { setAnchor(null); return; }
        setAnchor(p);
    }, [rf, labelX, labelY]);

    const dismiss = useCallback(() => {
        cancelClose();
        setLatched(false);
        setSwatchesOpen(false);
        setHovered(false);
        setAnchor(null);
    }, [cancelClose]);

    // Only while latched: a click anywhere else, or Escape, releases it.
    useEffect(() => {
        if (!latched) return undefined;
        const onDown = (e) => { if (!e.target?.closest?.('[data-edge-cluster]')) dismiss(); };
        const onKey = (e) => { if (e.key === 'Escape') dismiss(); };
        document.addEventListener('mousedown', onDown, true);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown, true);
            document.removeEventListener('keydown', onKey);
        };
    }, [latched, dismiss]);

    const active = editable && (hovered || latched);

    // The invisible hit band is measured in SCREEN pixels: a fixed flow-unit
    // width shrank to 12px at 0.5× zoom, and fitView lands below 1× on most
    // graphs — which is exactly the "I have to hit the middle of the line"
    // report. Parallel lanes cap it so neighbouring bands can't overlap.
    const hitWidth = Math.min(
        laneCount > 1 ? LANE_PITCH - 4 : 96,
        Math.max(16, 30 / (zoom || 1)),
    );

    const showCluster = editable || kind || dataSummary;

    return (
        <>
            {/* The caller's `style` MERGES over the base look — DiagramPane uses
                it for identity colours, run colouring (traversed/in-flight/
                failed) and the drop-target accent while a step is being dragged
                in from the ribbon. It used to be dropped on the floor here, so
                none of those strokes ever showed. */}
            <BaseEdge id={id} path={drawnPath} markerEnd={markerEnd} style={{ stroke: 'var(--border-default)', strokeWidth: 1.5, ...(style || null) }} />
            {/* Invisible fat hit-area so the thin edge is easy to hover and
                the controls have a forgiving target.

                Follows `drawnPath`, not `edgePath`: where this line bridges over
                another the two diverge, and a band on the undecorated geometry
                sits beside the line you can see.

                Rendered for a read-only edge too when it carries a data badge —
                on a run replay the badge is the point of the edge, and gating
                the band on `editable` left it with no hover target at all. */}
            {(editable || dataSummary) && (
                <path
                    d={drawnPath}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={hitWidth}
                    style={{ pointerEvents: 'stroke', cursor: editable ? 'pointer' : 'default' }}
                    onMouseEnter={(e) => { open(); anchorAt(e); }}
                    onMouseLeave={scheduleClose}
                    onClick={editable ? ((e) => {
                        e.stopPropagation();
                        anchorAt(e);
                        setLatched(l => !l);
                        setHovered(true);
                    }) : undefined}
                />
            )}
            {showCluster && (
                <EdgeLabelRenderer>
                    <div
                        data-edge-cluster
                        style={{
                            position: 'absolute',
                            // Anchored to the point you entered the line at
                            // while open, back to the midpoint at rest. The
                            // lane stagger only applies at the midpoint — the
                            // anchor is already on this lane's own band.
                            transform: anchor
                                ? `translate(-50%, -50%) translate(${anchor.x}px, ${anchor.y}px) scale(${controlScale})`
                                : `translate(-50%, -50%) translate(${labelX + chipDx}px, ${labelY}px) scale(${controlScale})`,
                            // Inert unless there is something to interact with,
                            // so a plain label chip never occludes the line.
                            pointerEvents: (editable || dataSummary) ? 'all' : 'none',
                        }}
                        className="flex items-center gap-1 nodrag nopan"
                        onMouseEnter={editable ? open : undefined}
                        onMouseLeave={editable ? scheduleClose : undefined}
                    >
                        {kind && !swatchesOpen && (
                            <span
                                className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded-full border ${tone}`}
                                style={chipTint || undefined}
                                title={kind === 'unrouted' ? 'Unlabelled connection from an If/Switch — the runtime never follows it. Delete it and drag from a branch port instead.' : undefined}
                            >
                                {chipText}
                            </span>
                        )}
                        {/* What the last run actually sent down this connection.
                            Clicking it opens the source step's full view, where
                            the data itself is. It stays visible while the
                            actions are up — they are siblings now, not rivals. */}
                        {dataSummary && !swatchesOpen && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); data?.onInspect?.(source); }}
                                title={data?.piiTooltip || dataSummary.title || `Last run sent ${dataSummary.label} to the next step — click to see the data`}
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-default)] shadow-sm hover:text-[var(--text-primary)] hover:border-[var(--accent)] tabular-nums whitespace-nowrap"
                            >
                                {dataSummary.label}
                            </button>
                        )}
                        {/* label/caseName = the DEFINITION row's identity
                            (layout.js data.defLabel/defCaseName) — handlers
                            must target exactly this edge, not every edge
                            between the same pair. sourceHandle remains as a
                            fallback for stale renders. */}
                        {editable && swatchesOpen && (
                            <div className="flex items-center gap-1 px-1.5 py-1 rounded-full bg-[var(--bg-primary)] border border-[var(--border-default)] shadow-md">
                                {EDGE_COLOR_KEYS.map((key) => {
                                    const hex = resolveEdgeColor(key);
                                    const isActive = data?.defColor === key;
                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            title={`Colour this connection ${key}`}
                                            aria-label={`Colour this connection ${key}`}
                                            onClick={(e) => { e.stopPropagation(); data?.onSetColor?.({ ...identity(), color: key }); setSwatchesOpen(false); }}
                                            className={`w-3 h-3 rounded-full shadow-sm hover:scale-125 transition ${isActive ? 'ring-2 ring-offset-1 ring-[var(--text-primary)]' : ''}`}
                                            style={{ background: hex }}
                                        />
                                    );
                                })}
                                <button
                                    type="button"
                                    title="Automatic colour"
                                    aria-label="Automatic colour"
                                    onClick={(e) => { e.stopPropagation(); data?.onSetColor?.({ ...identity(), color: null }); setSwatchesOpen(false); }}
                                    className={`w-3 h-3 rounded-full border border-[var(--text-tertiary)] bg-[var(--bg-primary)] shadow-sm hover:scale-125 transition relative overflow-hidden ${data?.defColor ? '' : 'ring-2 ring-offset-1 ring-[var(--text-primary)]'}`}
                                >
                                    <span className="absolute inset-x-0 top-1/2 rotate-45 border-t border-[var(--text-tertiary)]" />
                                </button>
                            </div>
                        )}
                        {editable && !swatchesOpen && (
                            <>
                                {/* "+" keeps a dimmed resting state — the only
                                    hint that a connection is interactive at
                                    all. The other two appear on hover. */}
                                <button
                                    type="button"
                                    title="Insert a step here"
                                    onClick={(e) => { e.stopPropagation(); data?.onInsert?.(identity()); }}
                                    style={{ opacity: active ? 1 : 0.35, transition: 'opacity 120ms ease' }}
                                    className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--accent)] text-white shadow-sm hover:opacity-90"
                                >
                                    <Plus size={12} strokeWidth={2.5} />
                                </button>
                                {/* Colour and delete are omitted, not disabled,
                                    when the canvas withholds their handler. A
                                    line inside an expanded loop is DERIVED from
                                    the body's order (inlineFlowlets.js), so
                                    there is nothing there to recolour or
                                    remove — the next render would draw it
                                    straight back. "+" still applies: inserting
                                    a step IS an order change. */}
                                {data?.onSetColor && (
                                    <button
                                        type="button"
                                        title="Colour this connection"
                                        aria-label="Colour this connection"
                                        onClick={(e) => { e.stopPropagation(); setSwatchesOpen(true); }}
                                        style={{ opacity: active ? 1 : 0, pointerEvents: active ? 'all' : 'none', transition: 'opacity 120ms ease' }}
                                        className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--bg-primary)] border border-[var(--border-default)] text-[var(--text-secondary)] shadow-sm hover:text-[var(--text-primary)] hover:border-[var(--accent)]"
                                    >
                                        <Palette size={12} strokeWidth={2} />
                                    </button>
                                )}
                                {data?.onDelete && (
                                    <button
                                        type="button"
                                        title="Remove this connection"
                                        onClick={(e) => { e.stopPropagation(); data.onDelete(identity()); }}
                                        style={{ opacity: active ? 1 : 0, pointerEvents: active ? 'all' : 'none', transition: 'opacity 120ms ease' }}
                                        className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--bg-primary)] border border-[var(--border-default)] text-[var(--text-secondary)] shadow-sm hover:text-red-500 hover:border-red-400"
                                    >
                                        <X size={12} strokeWidth={2.5} />
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
}

/**
 * The thin dashed tether from an AI step's tool port down to one of its tools.
 *
 * Its own type rather than a styled LabelledEdge because it is NOT a
 * connection: there is no definition row behind it, so the "+" splice, the "×"
 * delete and the colour palette a LabelledEdge offers would all act on an edge
 * that does not exist. Nothing to hover, nothing to click.
 */
export function ToolLinkEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }) {
    const [path] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 12 });
    return (
        <BaseEdge
            path={path}
            style={{ stroke: 'var(--border-default)', strokeWidth: 1.5, strokeDasharray: '4 3' }}
            interactionWidth={0}
        />
    );
}

export const edgeTypes = { labelled: LabelledEdge, toolLink: ToolLinkEdge };

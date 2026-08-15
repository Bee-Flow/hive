/**
 * App Studio editor — PURE math for on-canvas resize gestures. No React, no
 * DOM: everything takes plain numbers so it is unit-testable directly (see
 * EditorNodeWrapper.test.jsx). The component measures the grid on pointerdown
 * and feeds the numbers here; the same clamps the server (componentSpecs.js)
 * and styleResolver.js enforce keep the live preview honest.
 */

// span is an integer 1..12 (the section's 12-column grid).
const MIN_SPAN = 1;
const MAX_SPAN = 12;

function clampSpan(n) {
    const v = Number.isFinite(n) ? Math.round(n) : MAX_SPAN;
    return Math.max(MIN_SPAN, Math.min(MAX_SPAN, v));
}

/**
 * Pointer horizontal drag → new span.
 *   { startSpan, dx, columnWidth } → integer 1..12
 * dx is pixels dragged from the pointerdown x; columnWidth is one grid
 * column's width in px. A non-positive / non-finite columnWidth (jsdom, an
 * unmeasurable grid) leaves the span at its clamped start so a bad measurement
 * never resizes anything.
 */
export function spanFromDrag({ startSpan, dx, columnWidth } = {}) {
    const base = clampSpan(startSpan);
    if (!Number.isFinite(columnWidth) || columnWidth <= 0 || !Number.isFinite(dx)) return base;
    return clampSpan(base + Math.round(dx / columnWidth));
}

// The height knob's ordered vocabulary (mirror of STYLE_KNOBS.height in
// componentSpecs.js). Only some types carry it (image) — the component gates
// the handle on the type's styleKnobs.
export const HEIGHT_STEPS = ['auto', 'sm', 'md', 'lg', 'xl'];

/** One height step ≈ this many pixels of vertical drag. */
export const HEIGHT_STEP_PX = 80;

/**
 * Pointer vertical drag → nearest height step.
 *   { startHeight, dy, stepPx } → one of HEIGHT_STEPS
 * dy is pixels dragged down (positive) / up (negative) from pointerdown y.
 */
export function heightFromDrag({ startHeight, dy, stepPx = HEIGHT_STEP_PX } = {}) {
    const start = HEIGHT_STEPS.indexOf(startHeight);
    const base = start === -1 ? 0 : start;
    if (!Number.isFinite(dy) || !Number.isFinite(stepPx) || stepPx <= 0) return HEIGHT_STEPS[base];
    const idx = Math.max(0, Math.min(HEIGHT_STEPS.length - 1, base + Math.round(dy / stepPx)));
    return HEIGHT_STEPS[idx];
}

/**
 * Shared visual vocabulary for the routine-builder forms — the node settings
 * panel (NDV) and everything it renders.
 *
 * Pure strings, no React on purpose: CollapsibleSection imports these, and it
 * is also rendered by App Studio's inspector. Sourcing them from
 * formPrimitives would drag FieldHint — and the guardrails popover behind it —
 * into that import graph.
 *
 * The text levels below must stay visibly different from one another. They
 * used to be byte-identical strings, which is why a section heading, a field
 * label and the "Show N more options" control all read as the same object.
 *
 * Surface budget, measured: adjacent background tokens differ by at most
 * ~1.1:1 luminance (paper --bg-card #fffdf7 against --bg-secondary #f7f4ed is
 * 1.08:1; obsidian defines the two as the same colour). Borders and type carry
 * every boundary here — a fill is only ever a supporting cue.
 */

// L2 — section heading ("Basics", "Inputs"). The only uppercase text in the
// form, and it always sits on a band (see bandClass).
export function sectionHeaderClass() {
    return 'text-[11px] uppercase tracking-[0.08em] font-semibold text-[var(--text-secondary)]';
}

// L3 — field label ("Operation", "query"). Sentence case is the cue that
// separates it from L2. Matches what BindingField already used, so the two
// competing label systems become one.
export function fieldLabelClass() {
    return 'text-[11px] font-medium text-[var(--text-secondary)]';
}

// L4 — slot label inside a repeatable row, helper captions.
export function subLabelClass() {
    return 'text-[10px] text-[var(--text-tertiary)]';
}

// L5 — disclosure ("Show 1 more option"). Deliberately shaped like the
// Auto-map button next to it: this is a control, not a heading. Not tinted
// with --accent, which is an admin-configurable neutral grey by default and
// lands around 2.3:1 on the panel.
export function disclosureClass() {
    return 'inline-flex items-center gap-1.5 shrink-0 px-2 py-1 rounded border border-[var(--border-default)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition';
}

// The section band. --bg-tertiary is used by nothing else in the panel, so it
// cannot be confused with chrome (--bg-secondary) or content (--bg-card), and
// it is a distinct step in all eight themes — including high-contrast
// (#141414 on a #000000 card) and the two translucent glass tiers.
export function bandClass() {
    return 'flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] pr-1.5';
}

// The body of a section: a hairline rail showing where the group ends. The
// band says where a group starts; the rail says what belongs to it.
export function railClass() {
    return 'pt-2.5 ml-1 pl-2.5 border-l border-[var(--border-subtle)] space-y-2.5';
}

// --accent defaults to a neutral grey (#9ca3af) and measures ~2.3:1 on a light
// input fill — under the 3:1 that WCAG 2.2 SC 1.4.11 asks of a focus
// indicator. --accent-primary-hover is the stronger step, is defined in every
// theme, and measures 4.4:1 (light) to 12.5:1 (obsidian).
export const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)] focus-visible:border-[var(--accent-primary-hover)]';

// For controls sitting inside a clipping parent (a segmented group with
// overflow-hidden), where an outset ring would be cropped away.
export const FOCUS_RING_INSET = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-primary-hover)]';

// One fill for every form control. --bg-secondary sits below the panel's real
// background (--bg-card, forced by the [data-surface="default"] rule in
// index.css) in light/dark/paper/sepia, is equal in obsidian where the border
// carries it, and is replaced entirely by the glass themes' own input styling.
const FIELD_SHAPE = 'rounded-md border bg-[var(--bg-secondary)] text-[var(--text-primary)] transition-colors';
const FIELD_BORDER = 'border-[var(--border-default)]';

/**
 * A control edge that is actually visible at rest.
 *
 * --border-default is rgba(255,255,255,0.1) in the default dark theme, which
 * composites to 1.35:1 against the input fill — under the 3:1 WCAG 2.2 SC
 * 1.4.11 asks of a control boundary, and the light family measures the same.
 * Raising the global token to clear it would need rgba(255,255,255,0.35), a
 * 3.5x jump on a platform-wide token used by every panel and card — far outside
 * "the form controls".
 *
 * So the edge is derived instead from --text-secondary, which is contrasty by
 * construction in every theme (light #334155, obsidian #d6d3d1, high-contrast
 * #e5e5e5, paper #292524). Measured at 60%: 3.33:1 in the default dark theme
 * against --bg-secondary. 50% gives 2.70 — not enough.
 */
export const CONTROL_BORDER_STRONG = 'border-[color-mix(in_srgb,var(--text-secondary)_60%,transparent)]';

/**
 * The control surface with no size baked in — for the handful of controls that
 * need their own padding or type scale.
 *
 * Size and width live in `extra` rather than in the base, because two
 * competing utilities for one property (w-full vs w-auto, py-1 vs py-1.5)
 * resolve by stylesheet order, not by the order they are written in the class
 * list. The invalid border likewise *replaces* the default instead of racing
 * it.
 */
export function controlSurfaceClass(extra = '', { invalid = false, strongBorder = false } = {}) {
    const border = invalid
        ? 'border-[var(--error)]'
        : (strongBorder ? CONTROL_BORDER_STRONG : FIELD_BORDER);
    return `${FIELD_SHAPE} ${border} ${FOCUS_RING} ${extra}`.trim();
}

// The 12px control used by the mapping editors — the common field density.
export function denseInputClass(extra = '', opts) {
    return controlSurfaceClass(`px-2 py-1.5 text-xs ${extra}`.trim(), opts);
}

// The tighter 12px control used inside repeatable rows and table editors.
export function rowInputClass(extra = '', opts) {
    return controlSurfaceClass(`px-2 py-1 text-xs ${extra}`.trim(), opts);
}

// Full-width 14px field — the default for a FormRow.
export function inputClass() {
    return controlSurfaceClass('w-full px-2 py-1.5 text-sm');
}
export function textareaClass() {
    return controlSurfaceClass('w-full px-2 py-1.5 text-sm resize-y');
}

// Repeatable sub-editor card: outlined, never filled. A filled card cannot
// host a filled input when the best available step between two surface tokens
// is ~1.1:1 — one of the two always disappears.
export function cardClass(extra = '') {
    return `rounded-md border border-[var(--border-subtle)] p-2 space-y-1.5 ${extra}`.trim();
}

export function requiredMarkClass() {
    return 'text-[var(--error)] text-[12px] leading-none';
}

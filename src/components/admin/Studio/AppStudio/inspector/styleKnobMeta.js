/**
 * App Studio inspector — client mirror of the style-knob vocabulary.
 *
 * server/appStudio/componentSpecs.js is AUTHORITATIVE for everything in this
 * file (STYLE_KNOBS ranges, per-type styleKnobs lists, section knobs, theme
 * spec, action kinds, toast tones, input types, events). The values below are
 * mirrored verbatim so the inspector can render offline; keep them in
 * lockstep with the server file.
 */

// Mirror of COLOR_ROLES (componentSpecs.js).
export const COLOR_ROLES = ['primary', 'neutral', 'success', 'warning', 'danger', 'info'];

// Mirror of STYLE_KNOBS (componentSpecs.js) — the closed visual vocabulary.
// Sliders take min/max/step from here; enum knobs render their `values`.
export const STYLE_KNOBS = {
    span:       { type: 'int', min: 1, max: 12, step: 1, default: 12 },
    size:       { type: 'enum', values: ['sm', 'md', 'lg'], default: 'md' },
    align:      { type: 'enum', values: ['start', 'center', 'end'], default: 'start' },
    color:      { type: 'colorOrRole', roles: COLOR_ROLES, default: null },
    radius:     { type: 'enum', values: [null, 'none', 'sm', 'md', 'lg', 'full'], default: null },
    padding:    { type: 'int', min: 0, max: 6, step: 1, default: 0 },
    gap:        { type: 'int', min: 0, max: 6, step: 1, default: 3 },
    weight:     { type: 'enum', values: ['regular', 'medium', 'semibold'], default: 'regular' },
    height:     { type: 'enum', values: ['auto', 'sm', 'md', 'lg', 'xl', 'fill'], default: 'auto' },
    background: { type: 'enum', values: ['none', 'surface', 'tint'], default: 'none' },
    border:     { type: 'enum', values: ['none', 'subtle', 'default'], default: 'none' },
};

/**
 * What each knob is CALLED in the inspector.
 *
 * One map, deliberately: StyleSection and MultiInspector each kept their own
 * copy, both were missing `border`, and the two failed differently — the single
 * panel rendered an anonymous None/Subtle/Default control (FormField skips the
 * <label> when it gets undefined) while the multi-selection captioned it with
 * the literal string "undefined". knobLabel() falls back to the key, so the
 * next knob added to STYLE_KNOBS shows its own name rather than nothing.
 */
export const KNOB_LABELS = {
    span: 'Width',
    size: 'Size',
    align: 'Align',
    color: 'Color',
    radius: 'Corners',
    padding: 'Padding',
    gap: 'Gap',
    weight: 'Weight',
    height: 'Height',
    background: 'Background',
    border: 'Border',
};

export function knobLabel(knob) {
    return KNOB_LABELS[knob] || String(knob).charAt(0).toUpperCase() + String(knob).slice(1);
}

// Mirror of each type's `styleKnobs` list in COMPONENT_SPECS (componentSpecs.js).
// EVERY catalog type appears here — runtime/catalogLockstep.test.js fails the
// build when this map drifts from the server spec.
export const TYPE_STYLE_KNOBS = {
    heading:        ['span', 'align', 'color'],
    text:           ['span', 'align', 'color', 'weight', 'size'],
    button:         ['span', 'size', 'align'],
    image:          ['span', 'height', 'radius', 'align'],
    file_preview:   ['span', 'height', 'radius'],
    divider:        ['span'],
    spacer:         ['span'],
    callout:        ['span'],
    stat:           ['span', 'size', 'align', 'color'],
    keyValue:       ['span', 'size'],
    table:          ['span', 'size'],
    list:           ['span', 'size', 'height'],
    card:           ['span', 'padding', 'gap', 'radius', 'background', 'height', 'border'],
    form:           ['span', 'gap', 'padding'],
    input_text:     ['span', 'size'],
    input_textarea: ['span'],
    input_number:   ['span', 'size'],
    input_select:   ['span', 'size'],
    input_checkbox: ['span'],
    input_date:     ['span', 'size'],
    // v2 data & visualization
    data_grid:      ['span', 'size', 'height'],
    chart:          ['span', 'height'],
    pivot:          ['span', 'size'],
    // v2 rich inputs
    input_file:        ['span', 'size'],
    input_richtext:    ['span'],
    input_datetime:    ['span', 'size'],
    input_relation:    ['span', 'size'],
    input_multiselect: ['span', 'size'],
    // v2 containers
    tabs:     ['span', 'gap', 'padding'],
    tab:      ['gap', 'padding'],
    modal:    ['gap', 'padding'],
    repeater: ['span', 'gap', 'padding'],
    // v2.1 batch
    container:     ['span', 'padding', 'gap', 'background', 'radius', 'height', 'border'],
    pane:          ['span', 'padding', 'gap', 'background', 'radius', 'height', 'border'],
    page_header:   ['span', 'padding', 'gap'],
    markdown:      ['span', 'color'],
    badge_list:    ['span', 'size', 'align'],
    progress:      ['span', 'size'],
    stepper:       ['span', 'size', 'align'],
    file_gallery:  ['span', 'size', 'height'],
    connector_status: ['span', 'padding', 'background', 'radius', 'border'],
    timeline:      ['span', 'size', 'height'],
    message_thread: ['span', 'size', 'height'],
    record_detail: ['span', 'padding', 'background', 'radius', 'border', 'height'],
    filter_bar:    ['span', 'size', 'gap'],
    kanban:        ['span', 'size', 'height'],
    calendar:      ['span', 'height'],
    // AI
    ai_chat:       ['span', 'height'],
};

// Mirror of SECTION_STYLE_KNOBS / SECTION_STYLE_DEFAULTS (componentSpecs.js).
export const SECTION_STYLE_KNOBS = ['padding', 'gap', 'background', 'height'];
export const SECTION_STYLE_DEFAULTS = { padding: 4, gap: 3, background: 'none' };

// Mirror of THEME_SPEC enums (componentSpecs.js); the preset hex list lives
// in runtime/themeVars.js (APP_COLOR_PRESETS) — import it from there.
export const THEME_ENUMS = {
    radius:     ['none', 'sm', 'md', 'lg', 'xl'],
    density:    ['compact', 'comfortable', 'spacious'],
    fontScale:  ['sm', 'md', 'lg'],
    appearance: ['light', 'dark', 'auto'],
};

// Mirror of the enum-valued SCREEN_SPEC fields (componentSpecs.js).
//
// These were AI-builder-only for a long time: updateScreen has always accepted
// the whole patch, but the only caller passed { name }. So an app defaulted to
// maxWidth 'medium' (960px) and there was no hand-editable way out of it — on a
// wide monitor the app used a third of the screen and the author could do
// nothing about it. catalogLockstep pins these against the server spec.
export const SCREEN_ENUMS = {
    maxWidth:        ['narrow', 'medium', 'wide', 'full'],
    refreshInterval: [0, 15, 30, 60, 300],
};
export const SCREEN_DEFAULTS = { maxWidth: 'medium', refreshInterval: 0, showInNav: true };

// The action kinds the inspector edits inline (a subset of componentSpecs.js
// ACTION_KINDS — open_modal/sequence are authored by the AI builder, not here).
export const ACTION_KINDS = ['run_automation', 'ai_extract', 'ai_generate', 'kb_query', 'navigate', 'toast', 'open_url'];
export const TOAST_TONES = ['info', 'success', 'warning', 'danger'];

// Full mirror of each type's `events` array in COMPONENT_SPECS — the lockstep
// test pins this against the server spec. A type absent here carries no events.
export const TYPE_EVENT_LISTS = {
    button: ['onClick'],
    list: ['onRowClick'],
    form: ['onSubmit'],
    data_grid: ['onRowClick', 'onRowSelect'],
    timeline: ['onRowClick'],
    stepper: ['onRowClick'],
    file_gallery: ['onRowClick'],
    badge_list: ['onRowClick'],
    input_select: ['onChange'],
    input_checkbox: ['onChange'],
    input_date: ['onChange'],
    input_multiselect: ['onChange'],
    message_thread: ['onRowClick'],
    kanban: ['onRowClick', 'onCardMove'],
    calendar: ['onRowClick'],
};

// Which event slot the inspector's Actions section can WIRE today. This stays
// limited to onClick/onSubmit because state/definitionOps.setNodeEvent only
// accepts those two; widening it (row/card events) needs setNodeEvent +
// ActionsSection changes — until then the AI builder wires row/card events.
export const TYPE_EVENTS = { button: 'onClick', form: 'onSubmit' };

/**
 * Mirror of FORMULA_SCOPE_ROOTS (componentSpecs.js) — every root a formula may
 * start with. The expression editor's inline autocomplete completes exactly
 * these, so what it offers is what the engine accepts.
 *
 * A mirror rather than a catalog read on purpose: the catalog arrives through
 * react-query, and requiring a QueryClientProvider around every field that
 * happens to hold a formula would push a network concern into leaf components.
 * The lockstep test pins this against the server list, so drift fails CI
 * instead of quietly changing what autocompletes.
 */
export const FORMULA_SCOPE_ROOTS = [
    'actions', 'form', 'forms', 'screen', 'vars', 'item', 'index', 'value',
    'currentUser', 'records', 'datasets', 'connectors', 'now', 'today',
];

// Mirror of INPUT_TYPES (componentSpecs.js) — types that collect a form value.
export const INPUT_TYPES = [
    'input_text', 'input_textarea', 'input_number',
    'input_select', 'input_checkbox', 'input_date',
    'input_file', 'input_richtext', 'input_datetime',
    'input_relation', 'input_multiselect',
];

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Knob list for a component type (empty array for unknown types). */
export function getKnobsForType(type) {
    return TYPE_STYLE_KNOBS[type] || [];
}

/**
 * Clamp a knob value to the server's vocabulary so a bad slider event can
 * never commit an out-of-range value (the server clamps again — this just
 * keeps the live preview honest).
 */
export function clampKnob(knob, value) {
    const spec = STYLE_KNOBS[knob];
    if (!spec) return value;
    if (spec.type === 'int') {
        const n = Math.round(Number(value));
        if (!Number.isFinite(n)) return spec.default;
        return Math.max(spec.min, Math.min(spec.max, n));
    }
    if (spec.type === 'enum') {
        return spec.values.includes(value) ? value : spec.default;
    }
    if (spec.type === 'colorOrRole') {
        if (value == null) return null;
        if (spec.roles.includes(value)) return value;
        if (typeof value === 'string' && HEX_RE.test(value)) return value;
        return null;
    }
    return value;
}

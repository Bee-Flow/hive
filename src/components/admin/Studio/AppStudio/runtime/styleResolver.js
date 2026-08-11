/**
 * App Studio runtime — style-knob → CSS translation.
 *
 * The knob vocabulary (names, ranges, defaults) is owned by
 * server/appStudio/componentSpecs.js (STYLE_KNOBS / COLOR_ROLES —
 * AUTHORITATIVE); canonicalize.js clamps values before they reach us, so this
 * module only translates, never validates.
 *
 * span renders as an inline gridColumn; runtime.css forces every .app-grid
 * child to full width below 640px (with !important, so the inline span
 * loses), which is what makes the 12-column layout stack on phones.
 * padding/gap are spacing STEPS: 1 step = 4px × var(--app-space) (the theme
 * density multiplier), so one density picker rescales the whole app.
 */

// One spacing step in px (multiplied by the --app-space density var).
export const SPACE_STEP_PX = 4;

/** calc() for N spacing steps honouring the theme density multiplier. */
export function spaceSteps(n) {
    const steps = Number.isFinite(n) ? n : 0;
    if (steps <= 0) return '0px';
    return `calc(${steps * SPACE_STEP_PX}px * var(--app-space, 1))`;
}

// Role → color. primary follows the theme var; neutral uses the platform
// text token; the status roles use the house emerald/amber/red/sky hexes
// (see shared/statusTokens.ts / shared/Toast.tsx for the same family).
export const ROLE_COLORS = {
    primary: 'var(--app-primary)',
    neutral: 'var(--text-secondary)',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#0ea5e9',
};

/**
 * A role colour used as TEXT, rather than as a fill.
 *
 * The raw hexes above are chosen to read on a DARK surface. Painted as the
 * foreground of a 16% wash of themselves — which is what a badge and a status
 * pill do — amber and emerald land well under 4.5:1 in the light themes.
 *
 * Mixing the role colour into --text-primary keeps the hue (so the badge still
 * says "warning" at a glance) while the lightness follows the theme, which is
 * what makes it legible in all eight rather than in four.
 */
export const roleTextColor = (tone) => {
    const color = ROLE_COLORS[tone] || ROLE_COLORS.primary;
    if (tone === 'neutral' || tone === 'primary') return color;
    return `color-mix(in srgb, ${color} 55%, var(--text-primary))`;
};

/**
 * A foreground for a bubble/button FILLED with a role colour.
 *
 * White was hardcoded, so warning (#f59e0b) and info (#0ea5e9) — and even
 * danger — fell under 4.5:1. These two are dark enough for white; the rest read
 * far better with near-black on them.
 */
export const roleFillContrast = (tone) => (
    tone === 'danger' || tone === 'primary' ? '#ffffff' : '#111827'
);

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** colorOrRole knob value → CSS color, or null to inherit. */
export function resolveColor(value) {
    if (value == null) return null;
    if (ROLE_COLORS[value]) return ROLE_COLORS[value];
    if (typeof value === 'string' && HEX_RE.test(value)) return value;
    return null;
}

// radius knob: null inherits the theme radius; 'full' is the pill shape.
const RADIUS_VALUES = { none: '0px', sm: '4px', md: '8px', lg: '12px', full: '9999px' };

export function resolveRadius(value) {
    if (value === undefined) return undefined;       // knob not present on this node
    if (value === null) return 'var(--app-radius)';  // inherit theme
    return RADIUS_VALUES[value] || 'var(--app-radius)';
}

const ALIGN_VALUES = { start: 'left', center: 'center', end: 'right' };
const WEIGHT_VALUES = { regular: 400, medium: 500, semibold: 600 };
const SIZE_FONT = { sm: '0.875em', md: null, lg: '1.125em' };
export const HEIGHT_PX = { sm: '120px', md: '200px', lg: '320px' };

/**
 * `flex: 1 1 0` — as LONGHANDS, deliberately.
 *
 * jsdom's cssstyle does not implement the `flex` shorthand: assigning it drops
 * the declaration on the floor, so the rule was invisible to every DOM-level
 * test and the height chain could break without a single test noticing (it did,
 * for as long as height:'fill' has existed). Longhands are identical in a
 * browser and actually observable in a test.
 */
export const FLEX_FILL = Object.freeze({ flexGrow: 1, flexShrink: 1, flexBasis: 0 });

/** True when this node asked to take the leftover space. */
export const isFill = (node) => node?.style?.height === 'fill';

/**
 * span (1..12) → the inline `gridColumn` value. Shared by resolveNodeStyle
 * (run + edit render) and the editor's live resize preview so a dragged span
 * lays out EXACTLY like a committed one.
 */
export function spanGridColumn(span) {
    const n = Number.isFinite(span) ? Math.max(1, Math.min(12, span)) : 12;
    return `span ${n} / span ${n}`;
}

/**
 * height knob → inline `height` (null = auto/inherit; never emitted).
 *
 * 'fill' resolves to null here on purpose: it carries no fixed pixel size. It
 * becomes a flex rule in resolveNodeStyle instead, so the node takes whatever
 * space is left rather than a number someone guessed.
 */
export function resolveHeight(value) {
    if (!value || value === 'auto' || value === 'fill') return null;
    return HEIGHT_PX[value] || null;
}

export function resolveBackground(value) {
    if (value === 'surface') return 'var(--bg-card)';
    if (value === 'tint') return 'var(--app-primary-soft)';
    return null; // 'none' / absent
}

/**
 * border knob → an inline `border` shorthand.
 *
 * A surface is only a surface if you can see where it ends. In the
 * high-contrast theme --bg-card and --bg-primary are both #000000, so a card
 * with background:'surface' and no outline is not subtle — it is gone, and every
 * grouping the layout relies on goes with it.
 *
 * Both values use --border-color so they follow the platform theme; 'subtle'
 * fades it, which is what a divider inside a card wants.
 */
export function resolveBorder(value) {
    // The fallback is load-bearing: --border-color is declared only inside the
    // data-app-appearance light/dark blocks, so on the default 'auto' both of
    // these were invalid declarations and the border knob painted nothing.
    if (value === 'default') return '1px solid var(--border-color, var(--border-default))';
    if (value === 'subtle') return '1px solid color-mix(in srgb, var(--border-color, var(--border-default)) 55%, transparent)';
    return null; // 'none' / absent
}

/**
 * resolveNodeStyle(node) → { className, style } for the node's grid cell.
 * Only knobs actually present on node.style are emitted; components read
 * type-specific knobs (e.g. a stat's size) straight off node.style when they
 * need finer-grained treatment than these generic translations.
 */
export function resolveNodeStyle(node) {
    const s = (node && node.style) || {};
    const style = {};

    style.gridColumn = spanGridColumn(s.span);

    if (s.align in ALIGN_VALUES) style.textAlign = ALIGN_VALUES[s.align];
    if (s.weight in WEIGHT_VALUES) style.fontWeight = WEIGHT_VALUES[s.weight];
    if (SIZE_FONT[s.size]) style.fontSize = SIZE_FONT[s.size];
    // 'fill' grows to the leftover space; a fixed height gets its own scrollbar
    // (a box with a hard height that clipped its content would just hide data).
    // `flex` is inert in a grid cell and load-bearing inside a pane, which is
    // why one value serves both contexts.
    if (s.height === 'fill') {
        Object.assign(style, FLEX_FILL);
        style.minHeight = 0;
        style.minWidth = 0;
    } else {
        const height = resolveHeight(s.height);
        if (height) {
            style.height = height;
            style.overflow = 'auto';
        }
    }

    const color = resolveColor(s.color);
    if (color) style.color = color;

    const radius = resolveRadius(s.radius);
    if (radius !== undefined) style.borderRadius = radius;

    if (Number.isFinite(s.padding) && s.padding > 0) style.padding = spaceSteps(s.padding);

    const background = resolveBackground(s.background);
    if (background) style.background = background;

    const border = resolveBorder(s.border);
    if (border) style.border = border;

    // A surface with no edge is invisible in the high-contrast theme (--bg-card
    // and --bg-primary are both #000000 there). .app-surface adds a hairline in
    // CSS, so an explicit `border` knob — which is inline — still wins.
    const className = `app-node min-w-0${background === 'var(--bg-card)' ? ' app-surface' : ''}`;
    return { className, style };
}

/**
 * Section style → { className, style } for the .app-grid.
 *
 * Returns an object rather than a bare style because a full-height section also
 * needs a class: the responsive fallback in runtime.css has to be able to undo
 * the fixed height on phones, where a squashed two-pane split is worse than a
 * plain stack.
 */
export function resolveSectionStyle(section) {
    const s = (section && section.style) || {};
    const style = {
        gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
        gap: spaceSteps(Number.isFinite(s.gap) ? s.gap : 3),
        padding: spaceSteps(Number.isFinite(s.padding) ? s.padding : 0),
    };
    let className = 'app-grid';

    if (s.height === 'fill') {
        className += ' app-section-fill';
        Object.assign(style, FLEX_FILL);
        style.minHeight = 0;
        // The single implicit row must fill the section, otherwise the grid
        // children keep their content height and nothing actually stretches.
        style.gridTemplateRows = 'minmax(0, 1fr)';
    } else {
        const height = resolveHeight(s.height);
        if (height) {
            style.height = height;
            style.overflow = 'auto';
        }
    }

    const background = resolveBackground(s.background);
    if (background) {
        style.background = background;
        style.borderRadius = 'var(--app-radius)';
    }
    return { className, style };
}

export default resolveNodeStyle;

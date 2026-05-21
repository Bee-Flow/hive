/**
 * Shared per-text inline-style helper, used by section renderers
 * (SocialProof, Hero, …) that expose font / size / color / alignment
 * overrides on individual text elements.
 *
 * Empty / missing fields are dropped so the CSS file's defaults still
 * win — user edits are strictly additive overrides. The returned object
 * is `undefined` when nothing applies, so call sites can pass it
 * straight to `<Tag style={…}>` without producing an empty inline style
 * attribute on every render.
 *
 * `align` is a separate argument (not part of the style blob) because
 * alignment is stored per-field as `{fieldName}Align` on the block data,
 * not inside the font/size/color `*Style` sub-objects. Pass the resolved
 * value — e.g. `inlineTextStyle(data.titleStyle, data.titleAlign || data.align)`.
 * It is applied as `text-align` directly on the text element, so each
 * field aligns independently of any block-level wrapper.
 */
export function inlineTextStyle(style, align) {
    const out = {};
    if (style && typeof style === 'object') {
        if (typeof style.fontFamily === 'string' && style.fontFamily.trim()) {
            // Quote names with spaces; always include a system fallback so
            // the page renders before any Google Font has finished loading.
            const name = style.fontFamily.trim().replace(/"/g, '');
            const quoted = /\s/.test(name) ? `"${name}"` : name;
            out.fontFamily = `${quoted}, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        }
        if (Number.isFinite(style.fontSize) && style.fontSize > 0) {
            out.fontSize = `${style.fontSize}px`;
        }
        if (typeof style.color === 'string' && style.color.trim()) {
            out.color = style.color.trim();
        }
    }
    if (align === 'left' || align === 'center' || align === 'right') {
        out.textAlign = align;
    }
    return Object.keys(out).length ? out : undefined;
}

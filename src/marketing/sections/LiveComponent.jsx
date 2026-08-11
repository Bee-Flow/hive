import React, { useRef, useEffect } from 'react';
import SectionFrame from '../components/SectionFrame';
import { inlineTextStyle } from './textStyle';

/**
 * Live Component — pasted HTML/CSS/JS rendered in a sandboxed iframe.
 *
 * Four layouts:
 *   full            — single iframe, full width
 *   two-components  — two iframes side by side (50/50)
 *   component-text  — iframe (left) + heading + body (right)
 *   component-cta   — iframe (left) + heading + CTA button (right)
 *
 * All iframes share the same sandbox profile (`allow-scripts`, no
 * allow-same-origin), so each frame is opaque-origin and the parent
 * cannot read its document to measure height. Instead the embed is
 * sized entirely by the content, through a postMessage contract.
 *
 * --- lc-resize contract (snippet side) -------------------------------
 * Any HTML pasted into a Live Component block should self-measure and
 * report its height. Add this at the end of the snippet's <script>:
 *
 *   function reportHeight() {
 *     window.parent.postMessage(
 *       { type: 'lc-resize', height: document.documentElement.scrollHeight },
 *       '*'
 *     );
 *   }
 *   reportHeight();                                   // report on load
 *   new ResizeObserver(reportHeight).observe(document.body); // and on change
 *
 * --- lc-resize contract (renderer side) ------------------------------
 * `LiveFrame` listens for `{ type: 'lc-resize', height }` messages from
 * its own iframe and applies the height. The iframe carries NO fixed or
 * minimum height — it always grows to the content, so tall snippets are
 * never clipped. Snippets that don't implement the contract simply keep
 * the small starting height.
 */
export default function LiveComponent({ data }) {
    if (data?.enabled === false) return null;

    const layout    = data?.layout || 'full';
    const code      = typeof data?.code === 'string'      ? data.code      : '';
    const codeRight = typeof data?.codeRight === 'string' ? data.codeRight : '';
    const heading   = typeof data?.heading === 'string'   ? data.heading   : '';
    const body      = typeof data?.body === 'string'      ? data.body      : '';
    // CTA mirrors Hero's nested shape. legacyifyLinks (admin preview)
    // flattens cta.link → cta.href; resolveLinksInTree (public path)
    // leaves the resolved object on cta.link.href. Read both.
    const cta = data?.cta || {};
    // Per-field alignment — `{field}Align`, falling back to a legacy
    // block-level `align` when a field hasn't been aligned on its own.
    const headingAlign = data?.headingAlign || data?.align || null;
    const bodyAlign    = data?.bodyAlign    || data?.align || null;
    // Per-field typography overrides — the {field}Style blob the editor's
    // StyleTriplet + weight control writes. Empty / 0 values fall through
    // to the renderer's base styles and the shared `content-el-heading`
    // class, so untouched blocks keep the default heading scale.
    const headingStyle = data?.headingStyle || null;
    const bodyStyle    = data?.bodyStyle    || null;

    return (
        <SectionFrame id="live-component" name="Live Component" enabled={data?.enabled !== false}>
            <section className="live-component-block">
                <div className="container">
                    {renderLayout(layout, { code, codeRight, heading, body, cta, headingAlign, bodyAlign, headingStyle, bodyStyle })}
                </div>
            </section>
        </SectionFrame>
    );
}

// Layout switch — each branch produces the JSX for one of the four
// layouts. Falling through to `full` keeps the renderer resilient to
// unknown values (e.g. a future layout removed but still in saved data).
function renderLayout(layout, fields) {
    const { code, codeRight, heading, body, cta, headingAlign, bodyAlign, headingStyle, bodyStyle } = fields;

    if (layout === 'two-components') {
        return (
            <div style={twoColRow}>
                <div style={col}>{renderSlot(code)}</div>
                <div style={col}>{renderSlot(codeRight)}</div>
            </div>
        );
    }

    if (layout === 'component-text') {
        return (
            <div style={{ ...twoColRow, alignItems: 'center' }}>
                <div style={col}>{renderSlot(code)}</div>
                <div style={col}>
                    {heading ? <h2 className="content-el-heading" style={{ ...textHeading, ...textInlineStyle(headingStyle, headingAlign) }}>{heading}</h2> : null}
                    {body    ? <p  style={{ ...textBody, ...textInlineStyle(bodyStyle, bodyAlign) }}>{body}</p> : null}
                </div>
            </div>
        );
    }

    if (layout === 'component-cta') {
        return (
            <div style={{ ...twoColRow, alignItems: 'center' }}>
                <div style={col}>{renderSlot(code)}</div>
                <div style={col}>
                    {heading ? <h2 className="content-el-heading" style={{ ...textHeading, marginBottom: '1.5rem', ...textInlineStyle(headingStyle, headingAlign) }}>{heading}</h2> : null}
                    {renderCta(cta)}
                </div>
            </div>
        );
    }

    // 'full' and any unknown layout — single iframe.
    return <div style={{ width: '100%' }}>{renderSlot(code)}</div>;
}

// CTA renderer — reads the nested Hero-style { enabled, label, link, style }
// shape. Style maps to a small inline-style preset (primary/secondary/
// ghost/link) so the button picks up the active design palette through
// the same CSS variables the rest of the marketing renderer uses.
function renderCta(cta) {
    if (!cta || cta.enabled === false) return null;
    const label = cta.label || 'Get started';
    // Resolved-link shape: legacyifyLinks (admin preview) flattens
    // cta.link → cta.href; resolveLinksInTree (public site) puts the
    // resolved href on cta.link.href.
    const href   = cta.href || cta.link?.href || '#';
    const target = cta.target ?? cta.link?.target;
    const rel    = cta.rel    ?? cta.link?.rel;
    const style  = ctaStyleFor(cta.style || 'primary');
    return (
        <a href={href} target={target} rel={rel} style={style}>
            {label}
        </a>
    );
}

function ctaStyleFor(variant) {
    const base = {
        display: 'inline-block',
        padding: '0.75rem 1.5rem',
        borderRadius: '8px',
        textDecoration: 'none',
        fontWeight: 600,
        lineHeight: 1.2,
    };
    if (variant === 'secondary') {
        return { ...base, background: 'transparent', color: 'var(--text-primary, #0F172A)', border: '1.5px solid currentColor' };
    }
    if (variant === 'ghost') {
        return { ...base, background: 'transparent', color: 'var(--text-primary, #0F172A)', border: '1.5px solid transparent' };
    }
    if (variant === 'link') {
        return {
            ...base,
            background: 'transparent',
            color: 'var(--accent-primary, var(--brand-primary, #F5A623))',
            border: 'none',
            padding: 0,
            textDecoration: 'underline',
        };
    }
    // 'primary' and any unknown variant — filled brand colour.
    return { ...base, background: 'var(--brand-primary, #F5A623)', color: '#ffffff', border: 'none' };
}

// One slot of the layout — either the sandboxed iframe (when code is set)
// or a friendly placeholder card so empty blocks don't render as a
// confusing zero-height stripe in the live preview.
function renderSlot(code) {
    if (!code) return <SlotPlaceholder />;
    return <LiveFrame code={code} />;
}

// Sandboxed iframe for one pasted HTML/CSS/JS snippet.
//
// Height is content-driven: the iframe carries no fixed or minimum
// height. It starts at a small placeholder height and grows to whatever
// the snippet reports over the `lc-resize` postMessage contract (see the
// file header). The frame is opaque-origin under `allow-scripts`, so the
// parent can't read its document — the snippet must measure itself.
// Ensure the snippet carries a mobile viewport meta. Without it, a sandboxed
// srcDoc iframe lays its content out against a desktop-width fallback viewport
// (commonly ~980px) even when the iframe element is only ~350px wide on a
// phone — so the snippet's own `@media (max-width: …)` rules never fire and a
// desktop layout renders, then overflows and is clipped by the frame. Adding
// `width=device-width` makes the iframe's internal viewport equal its real
// (responsive, width:100%) pixel width, which is what lets a responsive embed
// actually reflow to a mobile layout. We only inject when the snippet hasn't
// already declared its own viewport, so author-provided settings win.
function withViewportMeta(code) {
    if (/<meta\s[^>]*name=["']?viewport/i.test(code)) return code;
    const meta = '<meta name="viewport" content="width=device-width, initial-scale=1">';
    // Prefer slotting it inside an existing <head>; otherwise prepend so the
    // parser still hoists it into the head of the generated document.
    if (/<head[^>]*>/i.test(code)) {
        return code.replace(/<head[^>]*>/i, (m) => m + meta);
    }
    return meta + code;
}

function LiveFrame({ code }) {
    const iframeRef = useRef(null);

    useEffect(() => {
        const onMessage = (e) => {
            if (e.data?.type !== 'lc-resize') return;
            const frame = iframeRef.current;
            if (!frame) return;
            // The two-components layout mounts two frames listening on
            // the same window — only resize the frame the message came
            // from, matched by its content window.
            if (e.source !== frame.contentWindow) return;
            const h = Number(e.data.height);
            if (h > 0) frame.style.height = `${h}px`;
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, []);

    return (
        <iframe
            ref={iframeRef}
            srcDoc={withViewportMeta(code)}
            title="Live Component"
            sandbox="allow-scripts"
            scrolling="no"
            style={{
                width: '100%',
                // Small starting height only — overwritten by the first
                // lc-resize message. Never a fixed/min height, so tall
                // content is never clipped.
                height: 100,
                border: 'none',
                display: 'block',
                overflow: 'hidden',
                background: 'transparent',
            }}
        />
    );
}

function SlotPlaceholder() {
    return (
        <div
            style={{
                minHeight: 220,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
                border: '1px dashed rgba(15,23,42,0.18)',
                borderRadius: 12,
                color: 'var(--text-muted, #94A3B8)',
                fontSize: '0.9rem',
                textAlign: 'center',
                lineHeight: 1.5,
            }}
        >
            Paste HTML / CSS / JS in the editor panel — it will render here in a sandboxed frame.
        </div>
    );
}

// Layout primitives — kept inline so the section is self-contained and
// doesn't pull in marketing.css for column rules unique to this block.
const twoColRow  = { display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' };
const col        = { flex: '1 1 320px', minWidth: 0 };
const textHeading = { fontFamily: 'inherit', marginBottom: '1rem', lineHeight: 1.2, whiteSpace: 'pre-wrap' };
const textBody    = { color: 'var(--text-secondary, #475569)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' };

// inlineTextStyle (the shared helper) resolves font-family / size / color
// and text-align. Font weight is not part of that helper, so it's merged
// on here from the same {field}Style blob the editor writes — that keeps
// the shared helper untouched for the other blocks that depend on it.
function textInlineStyle(style, align) {
    const out = { ...(inlineTextStyle(style, align) || {}) };
    if (style && Number.isFinite(style.fontWeight) && style.fontWeight > 0) {
        out.fontWeight = style.fontWeight;
    }
    return out;
}

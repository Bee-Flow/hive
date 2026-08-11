import React from 'react';
import Button from '../components/Button';
import EditableText from '../components/EditableText';
import FramedMedia from '../components/FramedMedia';
import SectionFrame from '../components/SectionFrame';
import { migrateLegacyContent, resolveVideoEmbed } from './contentMigration';
import { inlineTextStyle } from './textStyle';

/**
 * Flexible Content section. Each block is a grid of N columns, each column
 * is a list of elements (text / image / video / iframe / cta). Old shape
 * (heading/body/image/imagePosition/…) is migrated on read so the renderer
 * only deals with the new shape internally.
 *
 * Inline-edit paths (consumed by applyIframeEdit in the panel):
 *   content.columns.{colIdx}.elements.{elIdx}.heading
 *   content.columns.{colIdx}.elements.{elIdx}.subheading
 *   content.columns.{colIdx}.elements.{elIdx}.body
 *   content.columns.{colIdx}.elements.{elIdx}.caption
 *   content.columns.{colIdx}.elements.{elIdx}.label   (cta)
 */
export default function Content({ data }) {
    if (!data?.enabled) return null;
    const c = migrateLegacyContent(data);

    const layoutClass = `content-block-grid--layout-${c.columnLayout}`;
    const alignClass  = `content-block-grid--valign-${c.verticalAlign || 'top'}`;
    const bgClass     = c.background && c.background !== 'none'
        ? `content-block--bg-${c.background}`
        : '';

    return (
        <SectionFrame id="content" name="Content" enabled={data.enabled}>
            <section className={`content-block ${bgClass}`.trim()}>
                <div className="container">
                    <div className={`content-block-grid ${layoutClass} ${alignClass}`}>
                        {c.columns.map((col, colIdx) => {
                            // A lone image (the column's only element) becomes
                            // full-width *iff* no sibling column carries any
                            // text — i.e. it isn't acting as the visual half of
                            // a text+image pair. In that case it renders
                            // edge-to-edge within the content container.
                            const loneImageCol = (col.elements || []).length === 1
                                && col.elements[0]?.kind === 'image';
                            const textElsewhere = c.columns.some((other, i) =>
                                i !== colIdx
                                && (other.elements || []).some(e => e?.kind === 'text'));
                            const imageFull = loneImageCol && !textElsewhere;
                            return (
                                <div key={col.id || colIdx} className="content-block-col">
                                    {(col.elements || []).map((el, elIdx) => (
                                        <ContentElement
                                            key={el.id || elIdx}
                                            el={el}
                                            colIdx={colIdx}
                                            elIdx={elIdx}
                                            // First text element on the first
                                            // column gets an h2 (page-level
                                            // heading hierarchy); subsequent
                                            // text elements get h3.
                                            firstHeading={colIdx === 0 && elIdx === 0}
                                            fullWidth={el.kind === 'image' && imageFull}
                                        />
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>
        </SectionFrame>
    );
}

// ── Element renderers ──────────────────────────────────────────────────

function ContentElement({ el, colIdx, elIdx, firstHeading, fullWidth }) {
    const pathBase = `content.columns.${colIdx}.elements.${elIdx}`;
    switch (el?.kind) {
        case 'text':   return <TextElement   el={el} pathBase={pathBase} firstHeading={firstHeading} />;
        case 'image':  return <ImageElement  el={el} pathBase={pathBase} fullWidth={fullWidth} />;
        case 'video':  return <VideoElement  el={el} pathBase={pathBase} />;
        case 'iframe': return <IframeElement el={el} pathBase={pathBase} />;
        case 'cta':    return <CtaElement    el={el} pathBase={pathBase} />;
        default:       return null;
    }
}

function TextElement({ el, pathBase, firstHeading }) {
    const align = ['left', 'center', 'right'].includes(el.align) ? el.align : 'left';
    const HeadingTag = firstHeading ? 'h2' : 'h3';
    // Per-text inline overrides from the editor's StyleTriplet — empty
    // values fall through to CSS / Design tab defaults. Alignment is
    // resolved per field: each field uses its own `{field}Align`, falling
    // back to the element's legacy single `align` (always set by
    // makeElement). That makes every field emit an explicit text-align —
    // alignment never depends on the `content-el-text--align-*` wrapper.
    const headingStyle    = inlineTextStyle(el.headingStyle,    el.headingAlign    || el.align);
    const subheadingStyle = inlineTextStyle(el.subheadingStyle, el.subheadingAlign || el.align);
    const bodyStyle       = inlineTextStyle(el.bodyStyle,       el.bodyAlign       || el.align);
    return (
        // TODO: render basic markdown (**bold**, *italic*, [text](url)) on
        // the body when not in preview mode. For now plain text with
        // pre-wrap honours line breaks; the data shape is markdown-friendly.
        <div className={`content-el content-el-text content-el-text--align-${align}`}>
            {el.heading || isEditable() ? (
                <EditableText
                    as={HeadingTag}
                    path={`${pathBase}.heading`}
                    multiline
                    placeholder="Heading"
                    className="content-el-heading"
                    style={headingStyle}
                >
                    {el.heading || ''}
                </EditableText>
            ) : null}
            {el.subheading || isEditable() ? (
                <EditableText
                    as="p"
                    path={`${pathBase}.subheading`}
                    multiline
                    placeholder="Subheading"
                    className="content-el-subheading"
                    style={subheadingStyle}
                >
                    {el.subheading || ''}
                </EditableText>
            ) : null}
            {el.body || isEditable() ? (
                <EditableText
                    as="p"
                    multiline
                    path={`${pathBase}.body`}
                    placeholder="Body text"
                    className="content-el-body"
                    style={bodyStyle}
                >
                    {el.body || ''}
                </EditableText>
            ) : null}
        </div>
    );
}

function ImageElement({ el, pathBase, fullWidth }) {
    const ratio = ['16/9', '4/3', '1/1', '3/4'].includes(el.aspectRatio) ? el.aspectRatio : 'auto';
    const wrapStyle = ratio !== 'auto' ? { aspectRatio: ratio } : undefined;

    // Opt-in premium frame ('hairline' | 'browser') — renders through
    // FramedMedia instead of the bare <img>. Absent/unknown keeps the
    // legacy rendering. Framed images use the frame's own box: the fixed
    // aspect-ratio crop is skipped, and when both frame and lightbox are
    // set the frame wins (no zoom button).
    const frame = el.frame === 'hairline' || el.frame === 'browser' ? el.frame : null;

    // Default sizing: fill the column. With a fixed aspect ratio the wrap
    // defines the box and the image covers it; with the intrinsic ratio the
    // image keeps its proportions (height: auto) at full column width. Set
    // inline so it wins over the generic `.content-el-image-wrap img` rule.
    const imgStyle = ratio !== 'auto'
        ? { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }
        : { width: '100%', height: 'auto', display: 'block' };

    const [lightboxOpen, setLightboxOpen] = React.useState(false);
    React.useEffect(() => {
        if (!lightboxOpen) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setLightboxOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [lightboxOpen]);

    // Explicit full-bleed wins over the implicit lone-image full width: it
    // breaks out of the grid column to the full content-container width
    // (CSS class .content-el-image--bleed), matching the Live Component block.
    const bleed = el.fullBleed === true;
    const figureClass = [
        'content-el',
        'content-el-image',
        bleed ? 'content-el-image--bleed' : '',
        // A lone, text-free image renders edge-to-edge within the content
        // container — no artificial max-width cap.
        !bleed && fullWidth ? 'img--full' : '',
        el.rounded ? 'is-rounded' : '',
    ].filter(Boolean).join(' ');
    const figureStyle = (!bleed && fullWidth) ? { width: '100%', maxWidth: '100%' } : undefined;

    // Publish-time enrichment (server/core/cms/mediaDims.js) stores the
    // intrinsic size; as attributes it reserves the box before the bytes
    // arrive, while the CSS display size stays responsive.
    const imgDims = el.width > 0 && el.height > 0
        ? { width: Math.round(el.width), height: Math.round(el.height) }
        : {};
    const imgEl = el.src
        ? <img src={el.src} alt={el.alt || ''} {...imgDims} loading="lazy" style={imgStyle} />
        : null;

    return (
        <figure className={figureClass} style={figureStyle}>
            <div className={`content-el-image-wrap${frame ? ' content-el-image-wrap--framed' : ''}`} style={frame ? undefined : wrapStyle}>
                {el.src ? (
                    frame ? (
                        <FramedMedia media={{ src: el.src, alt: el.alt || '', kind: 'image', frame }} />
                    ) : el.lightbox === true ? (
                        <button
                            type="button"
                            className="content-el-image-zoom"
                            onClick={() => setLightboxOpen(true)}
                            aria-label={el.alt ? `Enlarge image: ${el.alt}` : 'Enlarge image'}
                            style={{
                                display: 'block',
                                width: '100%',
                                height: ratio !== 'auto' ? '100%' : 'auto',
                                padding: 0,
                                border: 'none',
                                background: 'none',
                                cursor: 'zoom-in',
                            }}
                        >
                            {imgEl}
                        </button>
                    ) : imgEl
                ) : (
                    <div className="content-el-image-placeholder">
                        <span>Add an image in the panel</span>
                    </div>
                )}
            </div>
            {(el.caption || isEditable()) ? (
                <EditableText
                    as="figcaption"
                    path={`${pathBase}.caption`}
                    placeholder="Caption (optional)"
                    className="content-el-caption"
                >
                    {el.caption || ''}
                </EditableText>
            ) : null}

            {lightboxOpen && el.src ? (
                <div
                    className="content-el-lightbox"
                    role="dialog"
                    aria-modal="true"
                    onClick={() => setLightboxOpen(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '24px',
                        background: 'rgba(0, 0, 0, 0.85)',
                        cursor: 'zoom-out',
                    }}
                >
                    <img
                        src={el.src}
                        alt={el.alt || ''}
                        // Clicking the image itself shouldn't close — only the
                        // backdrop (or Escape) dismisses the overlay.
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            maxWidth: '90vw',
                            maxHeight: '90vh',
                            objectFit: 'contain',
                            display: 'block',
                            cursor: 'default',
                        }}
                    />
                </div>
            ) : null}
        </figure>
    );
}

function VideoElement({ el, pathBase }) {
    const ratio = ['16/9', '4/3', '1/1'].includes(el.aspectRatio) ? el.aspectRatio : '16/9';
    const embed = resolveVideoEmbed(el.url);
    // Anything that isn't a recognised YouTube/Vimeo URL but is still a
    // non-empty URL is treated as a self-hosted file (the editor's "Upload
    // file" source writes the asset URL into el.url). Rendered as a muted
    // autoplay loop to match the Media + Text 'video-silent' affordance.
    const hasUrl = typeof el.url === 'string' && el.url.trim() !== '';
    return (
        <figure className="content-el content-el-video">
            <div className="content-el-video-wrap" style={{ aspectRatio: ratio }}>
                {embed ? (
                    <iframe
                        src={embed}
                        title={el.caption || 'Embedded video'}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    />
                ) : hasUrl ? (
                    <video
                        src={el.url}
                        autoPlay
                        muted
                        loop
                        playsInline
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                ) : (
                    <div className="content-el-video-placeholder">
                        <span>Paste a YouTube or Vimeo URL in the panel, or upload a video file</span>
                    </div>
                )}
            </div>
            {(el.caption || isEditable()) ? (
                <EditableText
                    as="figcaption"
                    path={`${pathBase}.caption`}
                    placeholder="Caption (optional)"
                    className="content-el-caption"
                >
                    {el.caption || ''}
                </EditableText>
            ) : null}
        </figure>
    );
}

function IframeElement({ el }) {
    const heightPx = Number.isFinite(el.height) ? el.height : 480;
    return (
        <div className="content-el content-el-iframe">
            {el.src ? (
                <iframe
                    src={el.src}
                    title={el.label || 'Embedded content'}
                    height={heightPx}
                    scrolling={el.scrolling ? 'yes' : 'no'}
                    style={{ width: '100%', border: 'none' }}
                    // sandbox: allow-scripts is needed for chat agents,
                    // Calendly, maps, etc. allow-same-origin keeps cookies
                    // working. allow-popups + allow-forms cover the rest of
                    // the typical "embedded widget" surface area.
                    sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox"
                    allow="clipboard-write; clipboard-read; microphone; camera; payment; autoplay"
                    referrerPolicy="strict-origin-when-cross-origin"
                />
            ) : (
                <div className="content-el-iframe-placeholder" style={{ height: heightPx }}>
                    <span>Paste an embed URL in the panel</span>
                </div>
            )}
        </div>
    );
}

function CtaElement({ el, pathBase }) {
    const align = ['left', 'center', 'right'].includes(el.align) ? el.align : 'left';
    // Mirror Footer/Header link reading: legacyifyLinks (admin preview)
    // turns link → href; resolveLinksInTree (public site) leaves href on
    // link.href. Read both shapes so the same component works on either.
    const href = el.href || el.link?.href || (typeof el.link === 'string' ? el.link : '#');
    const target = el.target ?? el.link?.target;
    const rel    = el.rel    ?? el.link?.rel;
    return (
        <div className={`content-el content-el-cta content-el-cta--align-${align}`}>
            <Button variant={el.style || 'primary'} href={href} target={target} rel={rel}>
                <EditableText path={`${pathBase}.label`} placeholder="Button label">
                    {el.label || ''}
                </EditableText>
            </Button>
        </div>
    );
}

// Inline-edit affordances are gated on preview mode (?preview=1) so the
// public site renders as a normal static page. Mirrors EditableText's own
// preview check to decide whether to render placeholder rows for currently
// empty fields (so users have something to click in the editor).
function isEditable() {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has('preview');
}

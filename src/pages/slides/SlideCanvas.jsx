/**
 * SlideCanvas — Renders and edits a single slide at 16:9 aspect ratio.
 *
 * Layout modes:
 *   split-left  → CSS Grid: image zone (45%) | text zone (55%)
 *   split-right → CSS Grid: text zone (55%) | image zone (45%)
 *   hero        → Full-bleed image/gradient bg with centered overlay text
 *   title, content, two-column, section, blank → absolute positioning
 *
 * Element types (absolute & split modes):
 *   heading, text, list, image, code, shape, label, stat, quote, divider
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { getTheme, getSlideBackground, getSlideTextColor } from './SlideThemes';

// ─── Main Export ─────────────────────────────────────────────────────────────

export default function SlideCanvas({ slide, theme = 'corporate', onUpdateSlide, isEditing = true, scale = 1 }) {
    const [selectedElement, setSelectedElement] = useState(null);
    const [editingElement, setEditingElement] = useState(null);
    const canvasRef = useRef(null);
    const themeObj = getTheme(theme);

    const bg = getSlideBackground(themeObj, slide?.layout, slide?.background);
    const defaultTextColor = getSlideTextColor(themeObj, slide?.layout);

    const handleElementClick = useCallback((e, id) => {
        e.stopPropagation();
        if (isEditing) setSelectedElement(id);
    }, [isEditing]);

    const handleElementDoubleClick = useCallback((e, id) => {
        e.stopPropagation();
        if (isEditing) { setEditingElement(id); setSelectedElement(id); }
    }, [isEditing]);

    const handleCanvasClick = useCallback(() => {
        setSelectedElement(null);
        setEditingElement(null);
    }, []);

    const handleContentBlur = useCallback((elementId, e) => {
        if (onUpdateSlide && slide) {
            const updated = (slide.elements || []).map(el =>
                el.id === elementId ? { ...el, content: e.target.innerHTML } : el
            );
            onUpdateSlide({ ...slide, elements: updated });
        }
        setEditingElement(null);
    }, [slide, onUpdateSlide]);

    useEffect(() => {
        const onKey = (e) => {
            if (!selectedElement || !isEditing) return;
            if ((e.key === 'Delete' || e.key === 'Backspace') && !editingElement) {
                e.preventDefault();
                if (onUpdateSlide && slide) {
                    onUpdateSlide({ ...slide, elements: (slide.elements || []).filter(el => el.id !== selectedElement) });
                    setSelectedElement(null);
                }
            }
            if (e.key === 'Escape') { setSelectedElement(null); setEditingElement(null); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedElement, editingElement, isEditing, slide, onUpdateSlide]);

    if (!slide) {
        return (
            <div style={{
                width: '100%', aspectRatio: '16/9', display: 'flex', alignItems: 'center',
                justifyContent: 'center', background: 'var(--bg-secondary)', borderRadius: '12px',
                border: '2px dashed var(--border-subtle)', color: 'var(--text-muted)', fontSize: '16px',
            }}>
                Select a slide or create a new one
            </div>
        );
    }

    const elementProps = {
        themeObj,
        defaultTextColor,
        selectedElement,
        editingElement,
        canEdit: isEditing,
        onElementClick: handleElementClick,
        onElementDoubleClick: handleElementDoubleClick,
        onElementBlur: handleContentBlur,
    };

    const baseStyle = {
        width: '100%',
        aspectRatio: '16 / 9',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.3)',
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        fontFamily: themeObj.fonts.body,
        cursor: isEditing ? 'default' : 'pointer',
    };

    const layout = slide.layout;

    // ── Split layout (image + text side by side) ──────────────────────
    if (layout === 'split-left' || layout === 'split-right') {
        return (
            <SplitLayout
                ref={canvasRef}
                slide={slide}
                theme={themeObj}
                side={layout === 'split-left' ? 'left' : 'right'}
                elementProps={elementProps}
                baseStyle={baseStyle}
                onCanvasClick={handleCanvasClick}
            />
        );
    }

    // ── Hero layout (full-bleed image/gradient bg) ────────────────────
    if (layout === 'hero') {
        return (
            <HeroLayout
                ref={canvasRef}
                slide={slide}
                theme={themeObj}
                elementProps={elementProps}
                baseStyle={baseStyle}
                onCanvasClick={handleCanvasClick}
            />
        );
    }

    // ── Standard absolute-position layout ────────────────────────────
    return (
        <div
            ref={canvasRef}
            className="slide-canvas"
            onClick={handleCanvasClick}
            style={{ ...baseStyle, position: 'relative', background: bg }}
        >
            <SlideCSS />
            {(slide.elements || []).map(el => (
                <SlideElement key={el.id} element={el} {...elementProps} />
            ))}
        </div>
    );
}

// ─── Split Layout ─────────────────────────────────────────────────────────────

const SplitLayout = React.forwardRef(function SplitLayout(
    { slide, theme, side, elementProps, baseStyle, onCanvasClick }, ref
) {
    const zone = slide.imageZone || {};
    const imageBg = zone.background || theme.splitImageBackground || 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)';
    const imageUrl = zone.imageUrl || null;
    const textBg = slide.background || theme.backgrounds?.content || theme.colors?.background || '#111111';
    const contentElements = (slide.elements || []).filter(el => !el.zone || el.zone === 'content');

    const imagePanel = (
        <div style={{ position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
            {/* Background gradient */}
            <div style={{
                position: 'absolute', inset: 0,
                background: imageBg,
            }} />

            {/* Real image if provided */}
            {imageUrl && (
                <img src={imageUrl} alt={zone.caption || ''} style={{
                    position: 'absolute', inset: 0, width: '100%', height: '100%',
                    objectFit: 'cover', objectPosition: zone.imagePosition || 'center',
                }} />
            )}

            {/* Highlight blobs for depth */}
            <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: 'radial-gradient(circle at 25% 75%, rgba(255,255,255,0.12) 0%, transparent 55%), radial-gradient(circle at 75% 25%, rgba(255,255,255,0.07) 0%, transparent 40%)',
            }} />

            {/* Edge fade toward text zone */}
            <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: side === 'left'
                    ? 'linear-gradient(to right, transparent 60%, rgba(0,0,0,0.15) 100%)'
                    : 'linear-gradient(to left, transparent 60%, rgba(0,0,0,0.15) 100%)',
            }} />

            {/* Optional overlay */}
            {zone.overlay && (
                <div style={{ position: 'absolute', inset: 0, background: zone.overlay }} />
            )}

            {/* Caption */}
            {zone.caption && (
                <div style={{
                    position: 'absolute', bottom: '5%', left: '6%', right: '6%',
                    fontSize: '10px', color: 'rgba(255,255,255,0.55)', textAlign: 'center',
                    letterSpacing: '0.05em',
                }}>
                    {zone.caption}
                </div>
            )}

            {/* Upload hint (only in editing mode, no image) */}
            {!imageUrl && (
                <div style={{
                    position: 'absolute', bottom: '6%', left: '50%', transform: 'translateX(-50%)',
                    fontSize: '9px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em',
                    textTransform: 'uppercase', whiteSpace: 'nowrap',
                }}>
                    Click to add image
                </div>
            )}
        </div>
    );

    const textPanel = (
        <div style={{
            background: textBg,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '9% 10%',
            position: 'relative',
            overflow: 'hidden',
            flex: 1,
        }}>
            <SlideCSS />
            {contentElements.map(el => (
                <SplitElement key={el.id} element={el} {...elementProps} />
            ))}
        </div>
    );

    return (
        <div
            ref={ref}
            className="slide-canvas"
            onClick={onCanvasClick}
            style={{
                ...baseStyle,
                display: 'grid',
                gridTemplateColumns: side === 'left' ? '45% 55%' : '55% 45%',
            }}
        >
            {side === 'left' ? <>{imagePanel}{textPanel}</> : <>{textPanel}{imagePanel}</>}
        </div>
    );
});

// ─── Hero Layout ──────────────────────────────────────────────────────────────

const HeroLayout = React.forwardRef(function HeroLayout(
    { slide, theme, elementProps, baseStyle, onCanvasClick }, ref
) {
    const bg = slide.background || theme.backgrounds?.title || theme.backgrounds?.content;
    const imageUrl = slide.imageZone?.imageUrl || slide.heroImage;

    return (
        <div
            ref={ref}
            className="slide-canvas"
            onClick={onCanvasClick}
            style={{
                ...baseStyle,
                position: 'relative',
                background: bg,
            }}
        >
            {/* Background image */}
            {imageUrl && (
                <img src={imageUrl} alt="" style={{
                    position: 'absolute', inset: 0, width: '100%', height: '100%',
                    objectFit: 'cover', objectPosition: 'center',
                }} />
            )}

            {/* Dark overlay for readability */}
            <div style={{
                position: 'absolute', inset: 0,
                background: slide.imageZone?.overlay || 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.6) 100%)',
            }} />

            <SlideCSS />
            {(slide.elements || []).map(el => (
                <SlideElement key={el.id} element={el} {...elementProps} />
            ))}
        </div>
    );
});

// ─── Slide-scoped CSS ────────────────────────────────────────────────────────

function SlideCSS() {
    return (
        <style>{`
            .slide-canvas ul, .slide-canvas ol {
                margin: 0; padding-left: 1.4em;
            }
            .slide-canvas li {
                margin-bottom: 0.35em;
                line-height: 1.5;
            }
            .slide-canvas ul li::marker {
                color: currentColor;
                opacity: 0.6;
            }
        `}</style>
    );
}

// ─── Absolute Element (default layouts) ──────────────────────────────────────

function SlideElement({ element, themeObj, defaultTextColor, selectedElement, editingElement, canEdit, onElementClick, onElementDoubleClick, onElementBlur }) {
    const ref = useRef(null);
    const pos = element.position || {};
    const style = element.style || {};
    const isSelected = selectedElement === element.id;
    const isEditing = editingElement === element.id;

    useEffect(() => {
        if (isEditing && ref.current) {
            ref.current.focus();
            try {
                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(ref.current);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
            } catch (_) {}
        }
    }, [isEditing]);

    const baseElementStyle = {
        position: 'absolute',
        left: `${pos.x ?? 0}%`,
        top: `${pos.y ?? 0}%`,
        width: `${pos.width ?? 80}%`,
        height: `${pos.height ?? 20}%`,
        boxSizing: 'border-box',
        overflow: 'hidden',
        wordWrap: 'break-word',
        // Typography
        fontSize: style.fontSize || (element.type === 'heading' ? '32px' : '18px'),
        fontWeight: style.fontWeight || (element.type === 'heading' ? '700' : 'normal'),
        fontStyle: style.fontStyle,
        fontFamily: style.fontFamily || (element.type === 'heading' ? themeObj.fonts.heading : themeObj.fonts.body),
        textAlign: style.textAlign || 'left',
        textTransform: element.type === 'label' ? (style.textTransform || 'uppercase') : style.textTransform,
        textDecoration: style.textDecoration,
        letterSpacing: element.type === 'label' ? (style.letterSpacing || '0.12em') : style.letterSpacing,
        lineHeight: style.lineHeight || '1.4',
        color: style.color || (element.type === 'label' ? (themeObj.accentColor || themeObj.colors?.primary) : defaultTextColor),
        textShadow: style.textShadow,
        // Box model
        padding: style.padding || '4px 8px',
        borderRadius: style.borderRadius,
        // Background & effects
        background: style.background,
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        backgroundSize: style.backgroundSize,
        backgroundPosition: style.backgroundPosition,
        boxShadow: style.boxShadow,
        border: style.border,
        borderLeft: style.borderLeft,
        borderRight: style.borderRight,
        borderTop: style.borderTop,
        borderBottom: style.borderBottom,
        backdropFilter: style.backdropFilter,
        WebkitBackdropFilter: style.backdropFilter,
        // Visibility
        opacity: style.opacity !== undefined ? style.opacity : 1,
        zIndex: style.zIndex,
        // Interaction
        outline: isSelected ? '2px solid rgba(99,102,241,0.75)' : 'none',
        outlineOffset: '3px',
        cursor: canEdit ? 'pointer' : 'default',
        transition: 'outline 0.1s ease',
        userSelect: isEditing ? 'text' : 'none',
        WebkitUserSelect: isEditing ? 'text' : 'none',
    };

    // ── Image ──────────────────────────────────────────────────────────
    if (element.type === 'image') {
        return (
            <div style={baseElementStyle} onClick={(e) => onElementClick(e, element.id)}>
                {element.content ? (
                    <img
                        src={element.content}
                        alt=""
                        style={{
                            width: '100%', height: '100%',
                            objectFit: style.objectFit || 'cover',
                            objectPosition: style.objectPosition || 'center',
                            borderRadius: style.borderRadius || '4px',
                        }}
                        draggable={false}
                    />
                ) : (
                    <div style={{
                        width: '100%', height: '100%',
                        background: 'rgba(128,128,128,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: style.borderRadius || '4px',
                        border: '2px dashed rgba(128,128,128,0.3)',
                        color: 'rgba(128,128,128,0.5)', fontSize: '12px',
                    }}>
                        📷 Image
                    </div>
                )}
            </div>
        );
    }

    // ── Code ───────────────────────────────────────────────────────────
    if (element.type === 'code') {
        return (
            <div style={baseElementStyle} onClick={(e) => onElementClick(e, element.id)}>
                <pre style={{
                    background: 'rgba(0,0,0,0.25)', borderRadius: '6px', padding: '12px',
                    fontSize: '13px', fontFamily: "'Fira Code', 'Consolas', monospace",
                    overflow: 'auto', height: '100%', margin: 0, color: '#e2e8f0',
                }}>
                    <code>{element.content}</code>
                </pre>
            </div>
        );
    }

    // ── Stat ───────────────────────────────────────────────────────────
    if (element.type === 'stat') {
        return (
            <div
                style={{ ...baseElementStyle, display: 'flex', flexDirection: 'column', alignItems: style.textAlign === 'center' ? 'center' : 'flex-start', justifyContent: 'center' }}
                onClick={(e) => onElementClick(e, element.id)}
            >
                <div style={{
                    fontSize: style.fontSize || '52px',
                    fontWeight: style.fontWeight || '900',
                    color: style.color || (themeObj.accentColor || defaultTextColor),
                    lineHeight: '1',
                    letterSpacing: '-0.03em',
                }}>
                    {element.content}
                </div>
                {element.label && (
                    <div style={{
                        fontSize: '13px', fontWeight: '500', letterSpacing: '0.05em',
                        color: style.labelColor || 'rgba(255,255,255,0.55)',
                        marginTop: '6px', textTransform: 'uppercase',
                    }}>
                        {element.label}
                    </div>
                )}
            </div>
        );
    }

    // ── Quote ──────────────────────────────────────────────────────────
    if (element.type === 'quote') {
        return (
            <div
                style={{
                    ...baseElementStyle,
                    borderLeft: style.borderLeft || `4px solid ${themeObj.accentColor || themeObj.colors?.primary}`,
                    paddingLeft: style.paddingLeft || '20px',
                }}
                onClick={(e) => onElementClick(e, element.id)}
            >
                <div style={{
                    fontSize: style.fontSize || '22px',
                    fontStyle: style.fontStyle || 'italic',
                    color: style.color || defaultTextColor,
                    lineHeight: '1.5',
                }}>
                    {element.content}
                </div>
                {element.author && (
                    <div style={{
                        fontSize: '13px', fontWeight: '600', marginTop: '12px',
                        color: style.authorColor || (themeObj.accentColor || themeObj.colors?.primary),
                        letterSpacing: '0.05em', textTransform: 'uppercase',
                    }}>
                        — {element.author}
                    </div>
                )}
            </div>
        );
    }

    // ── Divider ────────────────────────────────────────────────────────
    if (element.type === 'divider') {
        return (
            <div style={{ ...baseElementStyle, display: 'flex', alignItems: 'center' }}
                onClick={(e) => onElementClick(e, element.id)}>
                <div style={{
                    width: '100%',
                    height: style.height || '2px',
                    background: style.background || `linear-gradient(90deg, ${themeObj.accentColor || themeObj.colors?.primary}, transparent)`,
                    borderRadius: '2px',
                }} />
            </div>
        );
    }

    // ── Default (heading, text, list, label, shape) ────────────────────
    return (
        <div
            ref={ref}
            style={baseElementStyle}
            onClick={(e) => onElementClick(e, element.id)}
            onDoubleClick={(e) => onElementDoubleClick(e, element.id)}
            contentEditable={isEditing}
            suppressContentEditableWarning
            onBlur={(e) => onElementBlur(element.id, e)}
            dangerouslySetInnerHTML={isEditing ? undefined : { __html: element.content || '' }}
        />
    );
}

// ─── Flow Element (inside split layouts) ─────────────────────────────────────

function SplitElement({ element, themeObj, defaultTextColor, selectedElement, editingElement, canEdit, onElementClick, onElementDoubleClick, onElementBlur }) {
    const ref = useRef(null);
    const style = element.style || {};
    const isSelected = selectedElement === element.id;
    const isEditing = editingElement === element.id;

    useEffect(() => {
        if (isEditing && ref.current) {
            ref.current.focus();
            try {
                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(ref.current);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
            } catch (_) {}
        }
    }, [isEditing]);

    const interactionStyle = {
        outline: isSelected ? '2px solid rgba(99,102,241,0.6)' : 'none',
        outlineOffset: '4px',
        borderRadius: isSelected ? '4px' : undefined,
        cursor: canEdit ? 'text' : 'default',
        userSelect: isEditing ? 'text' : 'none',
        WebkitUserSelect: isEditing ? 'text' : 'none',
    };

    // ── Label ──────────────────────────────────────────────────────────
    if (element.type === 'label') {
        return (
            <div
                ref={ref}
                contentEditable={isEditing}
                suppressContentEditableWarning
                onClick={(e) => onElementClick(e, element.id)}
                onDoubleClick={(e) => onElementDoubleClick(e, element.id)}
                onBlur={(e) => onElementBlur(element.id, e)}
                dangerouslySetInnerHTML={isEditing ? undefined : { __html: element.content || '' }}
                style={{
                    fontSize: style.fontSize || '11px',
                    fontWeight: style.fontWeight || '700',
                    letterSpacing: style.letterSpacing || '0.15em',
                    textTransform: style.textTransform || 'uppercase',
                    color: style.color || themeObj.accentColor || themeObj.colors?.primary || '#f5c418',
                    marginBottom: style.marginBottom || '14px',
                    ...interactionStyle,
                }}
            />
        );
    }

    // ── Heading ────────────────────────────────────────────────────────
    if (element.type === 'heading') {
        return (
            <div
                ref={ref}
                contentEditable={isEditing}
                suppressContentEditableWarning
                onClick={(e) => onElementClick(e, element.id)}
                onDoubleClick={(e) => onElementDoubleClick(e, element.id)}
                onBlur={(e) => onElementBlur(element.id, e)}
                dangerouslySetInnerHTML={isEditing ? undefined : { __html: element.content || '' }}
                style={{
                    fontSize: style.fontSize || '38px',
                    fontWeight: style.fontWeight || '800',
                    lineHeight: style.lineHeight || '1.15',
                    letterSpacing: style.letterSpacing || '-0.02em',
                    color: style.color || defaultTextColor || '#ffffff',
                    marginBottom: style.marginBottom || '16px',
                    textShadow: style.textShadow,
                    fontFamily: style.fontFamily || themeObj.fonts?.heading,
                    ...interactionStyle,
                }}
            />
        );
    }

    // ── Text ───────────────────────────────────────────────────────────
    if (element.type === 'text') {
        const dimColor = defaultTextColor === '#ffffff' || defaultTextColor?.startsWith('rgba(255')
            ? 'rgba(255,255,255,0.65)' : defaultTextColor;
        return (
            <div
                ref={ref}
                contentEditable={isEditing}
                suppressContentEditableWarning
                onClick={(e) => onElementClick(e, element.id)}
                onDoubleClick={(e) => onElementDoubleClick(e, element.id)}
                onBlur={(e) => onElementBlur(element.id, e)}
                dangerouslySetInnerHTML={isEditing ? undefined : { __html: element.content || '' }}
                style={{
                    fontSize: style.fontSize || '16px',
                    fontWeight: style.fontWeight || '400',
                    lineHeight: style.lineHeight || '1.65',
                    color: style.color || dimColor,
                    marginBottom: style.marginBottom || '10px',
                    ...interactionStyle,
                }}
            />
        );
    }

    // ── List ───────────────────────────────────────────────────────────
    if (element.type === 'list') {
        return (
            <div
                ref={ref}
                contentEditable={isEditing}
                suppressContentEditableWarning
                className="slide-canvas"
                onClick={(e) => onElementClick(e, element.id)}
                onDoubleClick={(e) => onElementDoubleClick(e, element.id)}
                onBlur={(e) => onElementBlur(element.id, e)}
                dangerouslySetInnerHTML={isEditing ? undefined : { __html: element.content || '' }}
                style={{
                    fontSize: style.fontSize || '15px',
                    lineHeight: style.lineHeight || '1.7',
                    color: style.color || defaultTextColor,
                    marginBottom: style.marginBottom || '10px',
                    ...interactionStyle,
                }}
            />
        );
    }

    // ── Stat ───────────────────────────────────────────────────────────
    if (element.type === 'stat') {
        return (
            <div style={{ marginBottom: style.marginBottom || '16px', ...interactionStyle }}
                onClick={(e) => onElementClick(e, element.id)}>
                <div style={{
                    fontSize: style.fontSize || '48px',
                    fontWeight: '900',
                    color: style.color || themeObj.accentColor || defaultTextColor,
                    lineHeight: '1',
                    letterSpacing: '-0.03em',
                }}>
                    {element.content}
                </div>
                {element.label && (
                    <div style={{
                        fontSize: '12px', fontWeight: '600', textTransform: 'uppercase',
                        letterSpacing: '0.1em', marginTop: '6px',
                        color: 'rgba(255,255,255,0.5)',
                    }}>
                        {element.label}
                    </div>
                )}
            </div>
        );
    }

    // ── Quote ──────────────────────────────────────────────────────────
    if (element.type === 'quote') {
        return (
            <div style={{
                borderLeft: `4px solid ${themeObj.accentColor || themeObj.colors?.primary}`,
                paddingLeft: '18px', marginBottom: '16px', ...interactionStyle,
            }} onClick={(e) => onElementClick(e, element.id)}>
                <div style={{
                    fontSize: style.fontSize || '20px', fontStyle: 'italic',
                    color: style.color || defaultTextColor, lineHeight: '1.5',
                }}>
                    {element.content}
                </div>
            </div>
        );
    }

    // ── Meta (small secondary text) ────────────────────────────────────
    if (element.type === 'meta') {
        return (
            <div
                ref={ref}
                contentEditable={isEditing}
                suppressContentEditableWarning
                onClick={(e) => onElementClick(e, element.id)}
                onDoubleClick={(e) => onElementDoubleClick(e, element.id)}
                onBlur={(e) => onElementBlur(element.id, e)}
                dangerouslySetInnerHTML={isEditing ? undefined : { __html: element.content || '' }}
                style={{
                    fontSize: style.fontSize || '13px',
                    fontWeight: style.fontWeight || '400',
                    color: style.color || 'rgba(255,255,255,0.4)',
                    marginTop: style.marginTop || '8px',
                    letterSpacing: '0.02em',
                    ...interactionStyle,
                }}
            />
        );
    }

    // ── Default fallback ───────────────────────────────────────────────
    return (
        <div
            ref={ref}
            contentEditable={isEditing}
            suppressContentEditableWarning
            onClick={(e) => onElementClick(e, element.id)}
            onDoubleClick={(e) => onElementDoubleClick(e, element.id)}
            onBlur={(e) => onElementBlur(element.id, e)}
            dangerouslySetInnerHTML={isEditing ? undefined : { __html: element.content || '' }}
            style={{
                fontSize: style.fontSize || '16px',
                color: style.color || defaultTextColor,
                marginBottom: '8px',
                lineHeight: '1.5',
                ...interactionStyle,
            }}
        />
    );
}

// ─── Slide Thumbnail ─────────────────────────────────────────────────────────

export function SlideThumbnail({ slide, theme = 'corporate', isActive = false, onClick, index }) {
    const themeObj = getTheme(theme);
    const bg = getSlideBackground(themeObj, slide?.layout, slide?.background);
    const defaultTextColor = getSlideTextColor(themeObj, slide?.layout);
    const layout = slide?.layout;
    const isSplit = layout === 'split-left' || layout === 'split-right';

    const containerStyle = {
        width: '100%',
        aspectRatio: '16 / 9',
        position: 'relative',
        borderRadius: '6px',
        overflow: 'hidden',
        cursor: 'pointer',
        border: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
        boxShadow: isActive ? '0 0 0 2px rgba(99,102,241,0.3), 0 4px 12px rgba(0,0,0,0.25)' : '0 2px 8px rgba(0,0,0,0.2)',
        transition: 'all 0.15s ease',
        fontFamily: themeObj.fonts.body,
    };

    if (isSplit) {
        const zone = slide?.imageZone || {};
        const imageBg = zone.background || themeObj.splitImageBackground || 'linear-gradient(135deg, #6366f1, #ec4899)';
        const textBg = slide?.background || themeObj.backgrounds?.content || '#111111';
        const contentEls = (slide?.elements || []).filter(el => !el.zone || el.zone === 'content');
        const side = layout === 'split-left' ? 'left' : 'right';

        const imagePanel = (
            <div style={{
                position: 'relative',
                background: imageBg,
                overflow: 'hidden',
            }}>
                {zone.imageUrl && (
                    <img src={zone.imageUrl} alt="" style={{
                        position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                    }} />
                )}
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'radial-gradient(circle at 25% 75%, rgba(255,255,255,0.12) 0%, transparent 55%)',
                }} />
            </div>
        );

        const textPanel = (
            <div style={{
                background: textBg,
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                padding: '8% 10%', gap: '3px', overflow: 'hidden',
            }}>
                {contentEls.map(el => {
                    const s = el.style || {};
                    const scaledSize = Math.max(3, parseFloat(s.fontSize || (el.type === 'heading' ? '38' : el.type === 'label' ? '11' : '16')) * 0.18);
                    const color = s.color || (el.type === 'label' ? (themeObj.accentColor || themeObj.colors?.primary) : defaultTextColor);
                    return (
                        <div key={el.id} style={{
                            fontSize: `${scaledSize}px`,
                            fontWeight: el.type === 'heading' ? '800' : el.type === 'label' ? '700' : '400',
                            color,
                            letterSpacing: el.type === 'label' ? '0.12em' : undefined,
                            textTransform: el.type === 'label' ? 'uppercase' : undefined,
                            lineHeight: '1.3', overflow: 'hidden',
                            maxHeight: scaledSize * 3,
                        }}>
                            <span dangerouslySetInnerHTML={{ __html: el.content || '' }} />
                        </div>
                    );
                })}
            </div>
        );

        return (
            <div onClick={onClick} style={{ ...containerStyle, display: 'grid', gridTemplateColumns: side === 'left' ? '45% 55%' : '55% 45%' }}>
                {side === 'left' ? <>{imagePanel}{textPanel}</> : <>{textPanel}{imagePanel}</>}
                <div style={{
                    position: 'absolute', bottom: '3px', right: '5px',
                    fontSize: '5px', color: 'rgba(128,128,128,0.5)',
                }}>
                    {(index ?? 0) + 1}
                </div>
            </div>
        );
    }

    // Standard absolute thumbnail
    return (
        <div onClick={onClick} style={{ ...containerStyle, background: bg, fontSize: '4px' }}>
            {(slide?.elements || []).map(el => {
                const pos = el.position || {};
                const s = el.style || {};
                const scaledFontSize = Math.max(3, parseFloat(s.fontSize || '18') * 0.22);

                return (
                    <div key={el.id} style={{
                        position: 'absolute',
                        left: `${pos.x || 0}%`, top: `${pos.y || 0}%`,
                        width: `${pos.width || 80}%`, height: `${pos.height || 20}%`,
                        fontSize: `${scaledFontSize}px`,
                        fontWeight: s.fontWeight || 'normal',
                        color: s.color || defaultTextColor,
                        textAlign: s.textAlign || 'left',
                        letterSpacing: s.letterSpacing,
                        textTransform: s.textTransform,
                        lineHeight: '1.3',
                        overflow: 'hidden',
                        padding: '1px 2px',
                        opacity: s.opacity ?? 1,
                        background: s.background,
                        borderRadius: s.borderRadius,
                        backdropFilter: s.backdropFilter,
                        WebkitBackdropFilter: s.backdropFilter,
                        border: s.border,
                        boxShadow: s.boxShadow,
                    }}>
                        {el.type === 'image' ? (
                            el.content
                                ? <img src={el.content} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <div style={{ width: '100%', height: '100%', background: 'rgba(128,128,128,0.2)', borderRadius: '1px' }} />
                        ) : el.type === 'divider' ? (
                            <div style={{
                                width: '100%', height: s.height || '1px',
                                background: s.background || themeObj.accentColor,
                            }} />
                        ) : el.type === 'stat' ? (
                            <div>
                                <div style={{ fontSize: `${scaledFontSize * 1.8}px`, fontWeight: '900', color: s.color || themeObj.accentColor }}>
                                    {el.content}
                                </div>
                                {el.label && <div style={{ fontSize: `${scaledFontSize * 0.7}px`, opacity: 0.55 }}>{el.label}</div>}
                            </div>
                        ) : (
                            <span dangerouslySetInnerHTML={{ __html: el.content || '' }} />
                        )}
                    </div>
                );
            })}
            <div style={{
                position: 'absolute', bottom: '2px', right: '4px',
                fontSize: '5px', color: 'rgba(128,128,128,0.5)',
            }}>
                {(index ?? 0) + 1}
            </div>
        </div>
    );
}

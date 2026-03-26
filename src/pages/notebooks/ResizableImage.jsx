/**
 * ResizableImage — Custom TipTap Node extension with resize handles + alignment
 * 
 * Features:
 * - Corner drag handles for proportional resizing
 * - Alignment: left / center / right
 * - Text wrapping: text flows around image
 * - Persists width, alignment, textWrap in HTML attributes
 * - Backwards-compatible: parses existing <img> tags
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React, { useCallback, useRef, useState, useEffect } from 'react';

/* ── React NodeView Component ────────────────────────────────── */

function ResizableImageView({ node, updateAttributes, selected, editor }) {
    const { src, alt, title, width, alignment, textWrap } = node.attrs;
    const imgRef = useRef(null);
    const [resizing, setResizing] = useState(false);
    const [currentWidth, setCurrentWidth] = useState(width);
    const startDataRef = useRef(null);

    // Sync state when attribute changes externally
    useEffect(() => {
        setCurrentWidth(width);
    }, [width]);

    const onResizeStart = useCallback((e, corner) => {
        e.preventDefault();
        e.stopPropagation();

        const img = imgRef.current;
        if (!img) return;

        const rect = img.getBoundingClientRect();
        const aspectRatio = rect.width / rect.height;

        startDataRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startWidth: rect.width,
            aspectRatio,
            corner,
        };

        setResizing(true);

        const onMouseMove = (moveE) => {
            const data = startDataRef.current;
            if (!data) return;

            let deltaX = moveE.clientX - data.startX;

            // For left-side corners, invert the delta
            if (data.corner === 'top-left' || data.corner === 'bottom-left') {
                deltaX = -deltaX;
            }

            const newWidth = Math.max(50, Math.round(data.startWidth + deltaX));

            // Limit to editor width
            const editorEl = editor?.view?.dom;
            const maxWidth = editorEl ? editorEl.clientWidth - 40 : 800;
            const clampedWidth = Math.min(newWidth, maxWidth);

            setCurrentWidth(clampedWidth);
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            setResizing(false);

            // Persist to node attributes
            const data = startDataRef.current;
            if (data) {
                let deltaX = 0; // will use currentWidth from state
                updateAttributes({ width: currentWidth });
            }
            startDataRef.current = null;
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, [editor, updateAttributes, currentWidth]);

    // We need to persist width on mouseUp — but currentWidth in the closure
    // may be stale. Use a ref to track the latest value.
    const latestWidthRef = useRef(currentWidth);
    useEffect(() => {
        latestWidthRef.current = currentWidth;
    }, [currentWidth]);

    // Patched onMouseUp via ref
    const onResizeStartPatched = useCallback((e, corner) => {
        e.preventDefault();
        e.stopPropagation();

        const img = imgRef.current;
        if (!img) return;

        const rect = img.getBoundingClientRect();

        startDataRef.current = {
            startX: e.clientX,
            startWidth: rect.width,
            corner,
        };

        setResizing(true);

        const onMouseMove = (moveE) => {
            const data = startDataRef.current;
            if (!data) return;

            let deltaX = moveE.clientX - data.startX;
            if (data.corner === 'top-left' || data.corner === 'bottom-left') {
                deltaX = -deltaX;
            }

            const newWidth = Math.max(50, Math.round(data.startWidth + deltaX));
            const editorEl = editor?.view?.dom;
            const maxWidth = editorEl ? editorEl.clientWidth - 40 : 800;
            const clampedWidth = Math.min(newWidth, maxWidth);

            setCurrentWidth(clampedWidth);
            latestWidthRef.current = clampedWidth;
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            setResizing(false);
            updateAttributes({ width: latestWidthRef.current });
            startDataRef.current = null;
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, [editor, updateAttributes]);

    const wrapperStyle = {};
    const imgStyle = {
        width: currentWidth ? `${currentWidth}px` : '100%',
        height: 'auto',
        display: 'block',
        maxWidth: '100%',
    };

    return (
        <NodeViewWrapper
            className={`resizable-image-wrapper${selected ? ' selected' : ''}${resizing ? ' resizing' : ''}`}
            data-alignment={alignment || 'center'}
            data-text-wrap={textWrap ? 'true' : 'false'}
            style={wrapperStyle}
            draggable="true"
            data-drag-handle
        >
            <div className="resizable-image-container" style={{ width: currentWidth ? `${currentWidth}px` : 'auto' }}>
                <img
                    ref={imgRef}
                    src={src}
                    alt={alt || ''}
                    title={title || ''}
                    style={imgStyle}
                    draggable={false}
                />

                {/* Resize handles — visible when selected or hovered */}
                {(selected || resizing) && (
                    <>
                        <div className="resize-handle top-left" onMouseDown={(e) => onResizeStartPatched(e, 'top-left')} />
                        <div className="resize-handle top-right" onMouseDown={(e) => onResizeStartPatched(e, 'top-right')} />
                        <div className="resize-handle bottom-left" onMouseDown={(e) => onResizeStartPatched(e, 'bottom-left')} />
                        <div className="resize-handle bottom-right" onMouseDown={(e) => onResizeStartPatched(e, 'bottom-right')} />
                        {/* Edge handles for more precise control */}
                        <div className="resize-handle left-edge" onMouseDown={(e) => onResizeStartPatched(e, 'bottom-left')} />
                        <div className="resize-handle right-edge" onMouseDown={(e) => onResizeStartPatched(e, 'bottom-right')} />
                    </>
                )}

                {/* Width indicator while resizing */}
                {resizing && currentWidth && (
                    <div className="resize-width-indicator">
                        {currentWidth}px
                    </div>
                )}
            </div>
        </NodeViewWrapper>
    );
}


/* ── TipTap Node Extension ───────────────────────────────────── */

const ResizableImage = Node.create({
    name: 'resizableImage',

    group: 'block',
    atom: true,
    draggable: true,

    addAttributes() {
        return {
            src: { default: null },
            alt: { default: null },
            title: { default: null },
            width: { default: null },  // px value, null = auto/100%
            alignment: { default: 'center' },  // left, center, right
            textWrap: { default: false },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'img[src]',
                getAttrs: (dom) => ({
                    src: dom.getAttribute('src'),
                    alt: dom.getAttribute('alt'),
                    title: dom.getAttribute('title'),
                    width: dom.getAttribute('data-width')
                        ? parseInt(dom.getAttribute('data-width'), 10)
                        : (dom.style?.width ? parseInt(dom.style.width, 10) : null),
                    alignment: dom.getAttribute('data-alignment') || 'center',
                    textWrap: dom.getAttribute('data-text-wrap') === 'true',
                }),
            },
            // Also parse our wrapper divs for round-tripping
            {
                tag: 'div.resizable-image-wrapper',
                getAttrs: (dom) => {
                    const img = dom.querySelector('img');
                    if (!img) return false;
                    return {
                        src: img.getAttribute('src'),
                        alt: img.getAttribute('alt'),
                        title: img.getAttribute('title'),
                        width: dom.getAttribute('data-width')
                            ? parseInt(dom.getAttribute('data-width'), 10)
                            : null,
                        alignment: dom.getAttribute('data-alignment') || 'center',
                        textWrap: dom.getAttribute('data-text-wrap') === 'true',
                    };
                },
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        const { src, alt, title, width, alignment, textWrap } = HTMLAttributes;
        return [
            'img',
            {
                src,
                alt: alt || '',
                title: title || '',
                'data-width': width || '',
                'data-alignment': alignment || 'center',
                'data-text-wrap': textWrap ? 'true' : 'false',
                class: 'notebook-image',
                style: width ? `width: ${width}px` : '',
            },
        ];
    },

    addNodeView() {
        return ReactNodeViewRenderer(ResizableImageView);
    },

    addCommands() {
        return {
            setImage: (attrs) => ({ commands }) => {
                return commands.insertContent({
                    type: this.name,
                    attrs,
                });
            },
            setImageAlignment: (alignment) => ({ commands, state }) => {
                const { selection } = state;
                const node = state.doc.nodeAt(selection.from);
                if (node?.type.name === this.name) {
                    return commands.updateAttributes(this.name, { alignment });
                }
                return false;
            },
            setImageTextWrap: (textWrap) => ({ commands, state }) => {
                const { selection } = state;
                const node = state.doc.nodeAt(selection.from);
                if (node?.type.name === this.name) {
                    return commands.updateAttributes(this.name, { textWrap });
                }
                return false;
            },
        };
    },
});

export default ResizableImage;
export { ResizableImageView };

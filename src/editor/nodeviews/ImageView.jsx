/**
 * ImageView — resizable image atom node-view (no TipTap).
 *
 * Resize math + corner handles are ported from the legacy ResizableImage.jsx;
 * only the TipTap NodeViewWrapper is replaced by a plain div and updateAttributes
 * is routed through the EditorView (view.updateAtom).
 */
import React, { useCallback, useRef, useState, useEffect } from 'react';

export default function ImageView({ node, view, selected, editable }) {
  const { src, alt, title, width, alignment, textWrap } = node.attrs || {};
  const imgRef = useRef(null);
  const [resizing, setResizing] = useState(false);
  const [currentWidth, setCurrentWidth] = useState(width);
  const latestWidthRef = useRef(width);
  const startRef = useRef(null);

  useEffect(() => { setCurrentWidth(width); latestWidthRef.current = width; }, [width]);

  const onResizeStart = useCallback((e, corner) => {
    e.preventDefault();
    e.stopPropagation();
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    startRef.current = { startX: e.clientX, startWidth: rect.width, corner };
    setResizing(true);

    const onMove = (mv) => {
      const data = startRef.current;
      if (!data) return;
      let dx = mv.clientX - data.startX;
      if (data.corner === 'top-left' || data.corner === 'bottom-left') dx = -dx;
      const editorEl = view?.host;
      const maxW = editorEl ? editorEl.clientWidth - 40 : 800;
      const w = Math.min(Math.max(50, Math.round(data.startWidth + dx)), maxW);
      setCurrentWidth(w);
      latestWidthRef.current = w;
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setResizing(false);
      view.updateAtom(node, { width: latestWidthRef.current });
      startRef.current = null;
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [view, node]);

  const imgStyle = { width: currentWidth ? `${currentWidth}px` : '100%', height: 'auto', display: 'block', maxWidth: '100%' };

  return (
    <div
      className={`resizable-image-wrapper${selected ? ' selected' : ''}${resizing ? ' resizing' : ''}`}
      data-alignment={alignment || 'center'}
      data-text-wrap={textWrap ? 'true' : 'false'}
      onMouseDown={() => view.selectAtom(node)}
    >
      <div className="resizable-image-container" style={{ width: currentWidth ? `${currentWidth}px` : 'auto' }}>
        <img ref={imgRef} src={src} alt={alt || ''} title={title || ''} style={imgStyle} draggable={false} />
        {editable && (selected || resizing) && (
          <>
            <div className="resize-handle top-left" onMouseDown={(e) => onResizeStart(e, 'top-left')} />
            <div className="resize-handle top-right" onMouseDown={(e) => onResizeStart(e, 'top-right')} />
            <div className="resize-handle bottom-left" onMouseDown={(e) => onResizeStart(e, 'bottom-left')} />
            <div className="resize-handle bottom-right" onMouseDown={(e) => onResizeStart(e, 'bottom-right')} />
            <div className="resize-handle left-edge" onMouseDown={(e) => onResizeStart(e, 'bottom-left')} />
            <div className="resize-handle right-edge" onMouseDown={(e) => onResizeStart(e, 'bottom-right')} />
          </>
        )}
        {resizing && currentWidth && <div className="resize-width-indicator">{currentWidth}px</div>}
      </div>
    </div>
  );
}

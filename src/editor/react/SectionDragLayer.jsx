/**
 * SectionDragLayer — floating drag handle + heading-aware block reordering.
 *
 * Uses pointer events (not HTML5 draggable) because native drag fights
 * contenteditable. Hovering a top-level block shows a grip (or an H{n} section
 * badge for headings); dragging shows a drop-indicator line and on release moves
 * the block — or, for a heading, the whole section (until the next heading of
 * equal-or-higher level).
 */
import React, { useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { getSectionRange, moveBlocks } from '../engine/sectionDrag.js';
import useTranslation from '../../hooks/useTranslation';

export default function SectionDragLayer({ hostRef, viewRef }) {
  const { t } = useTranslation();
  const tt = (key, fallback) => { const v = t(key); return v && v !== key ? v : fallback; };
  const [hover, setHover] = useState(null); // { idx, top, level }
  const [dropTop, setDropTop] = useState(null);
  const dragRef = useRef(null);

  const blockItems = () => {
    const host = hostRef.current;
    if (!host) return [];
    return Array.from(host.children).map((el, i) => ({ el, i, rect: el.getBoundingClientRect() }));
  };
  const hostOriginTop = () => {
    const host = hostRef.current;
    return host.getBoundingClientRect().top - host.offsetTop;
  };

  useEffect(() => {
    const host = hostRef.current;
    // Listen on the wrapper (host + left gutter) so moving onto the handle, which
    // sits in the gutter, doesn't clear the hover before it can be grabbed.
    const container = host?.parentElement;
    if (!host || !container) return undefined;
    const onMove = (e) => {
      if (dragRef.current) return;
      const items = blockItems();
      let hit = items.find((it) => e.clientY >= it.rect.top - 2 && e.clientY <= it.rect.bottom + 2);
      if (!hit && items.length) hit = items[items.length - 1]; // below last block
      if (!hit) { setHover(null); return; }
      const node = viewRef.current?.state.doc.content[hit.i];
      setHover({ idx: hit.i, top: hit.rect.top - hostOriginTop(), level: node?.type === 'heading' ? (node.attrs?.level || 1) : null });
    };
    const onLeave = () => { if (!dragRef.current) setHover(null); };
    container.addEventListener('mousemove', onMove);
    container.addEventListener('mouseleave', onLeave);
    return () => { container.removeEventListener('mousemove', onMove); container.removeEventListener('mouseleave', onLeave); };
  }, [hostRef, viewRef]);

  const startDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const view = viewRef.current;
    if (!view || hover == null) return;
    const count = getSectionRange(view.state.doc, hover.idx);
    dragRef.current = { fromIdx: hover.idx, count, dropIdx: hover.idx };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    const onMove = (ev) => {
      const items = blockItems();
      const origin = hostOriginTop();
      let dropIdx = items.length;
      let lineTop = items.length ? items[items.length - 1].rect.bottom - origin : 0;
      for (const it of items) {
        const mid = it.rect.top + it.rect.height / 2;
        if (ev.clientY < mid) { dropIdx = it.i; lineTop = it.rect.top - origin; break; }
      }
      dragRef.current.dropIdx = dropIdx;
      setDropTop(lineTop);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      const d = dragRef.current;
      dragRef.current = null;
      setDropTop(null);
      setHover(null);
      if (d) view.dispatch((s) => moveBlocks(s, d.fromIdx, d.count, d.dropIdx), { kind: 'structural' });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <>
      {hover && (
        <div
          className="bf-drag-handle"
          onMouseDown={startDrag}
          style={{
            top: hover.top,
            background: hover.level ? 'rgba(59,130,246,0.12)' : 'transparent',
            border: hover.level ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
            color: hover.level ? '#60a5fa' : 'var(--text-tertiary)',
          }}
          title={hover.level
            ? tt('notebooks.drag_section', `Drag to move the whole H${hover.level} section`).replace('{level}', hover.level)
            : tt('notebooks.drag_block', 'Drag to reorder this block')}
        >
          {hover.level
            ? <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1, userSelect: 'none' }}>H{hover.level}≡</span>
            : <GripVertical className="w-3.5 h-3.5" strokeWidth={2} />}
        </div>
      )}
      {dropTop != null && <div className="bf-drop-indicator" style={{ top: dropTop }} />}
    </>
  );
}

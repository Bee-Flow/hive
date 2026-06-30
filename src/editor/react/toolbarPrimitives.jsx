/**
 * toolbarPrimitives — small chrome atoms + shared menu panels used by both the
 * persistent EditorToolbar and the floating FormatBubble, so the two surfaces
 * stay visually and behaviourally identical. No engine coupling: every action is
 * an `editor.chain()` call passed in by the caller.
 */
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown, Pilcrow, Heading1, Heading2, Heading3, List, ListOrdered, Quote,
  CheckSquare, AlignLeft, AlignCenter, AlignRight,
} from 'lucide-react';

/* Font / colour palettes — module scope so every surface shares one source. */
export const FONT_FAMILIES = [
  { label: 'Default', value: null, css: "'Inter', sans-serif" },
  { label: 'Inter', value: 'Inter', css: "'Inter', sans-serif" },
  { label: 'Georgia', value: 'Georgia', css: 'Georgia, serif' },
  { label: 'Merriweather', value: 'Merriweather', css: "'Merriweather', serif" },
  { label: 'Playfair Display', value: 'Playfair Display', css: "'Playfair Display', serif" },
  { label: 'Lora', value: 'Lora', css: "'Lora', serif" },
  { label: 'Poppins', value: 'Poppins', css: "'Poppins', sans-serif" },
  { label: 'Nunito', value: 'Nunito', css: "'Nunito', sans-serif" },
  { label: 'Source Sans 3', value: 'Source Sans 3', css: "'Source Sans 3', sans-serif" },
  { label: 'Roboto Mono', value: 'Roboto Mono', css: "'Roboto Mono', monospace" },
  { label: 'Fira Code', value: 'Fira Code', css: "'Fira Code', monospace" },
];
export const PALETTE = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#ec4899', '#f43f5e', '#fb7185', '#fda4af', '#64748b', '#94a3b8', '#cbd5e1', '#000000'];
// Highlight swatches (soft backgrounds; no purple per the design rule).
export const HIGHLIGHTS = ['#fef08a', '#fed7aa', '#fecaca', '#bbf7d0', '#a7f3d0', '#bfdbfe', '#a5f3fc', '#fbcfe8'];

/** translate-with-fallback helper bound to a `t`. */
export const mkTt = (t) => (key, fallback) => { const v = t ? t(key) : null; return v && v !== key ? v : fallback; };

export function Btn({ onClick, active, icon: Icon, title, disabled }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); if (!disabled) onClick(); }}
      className={`p-1.5 rounded-md transition-all duration-150 ${active ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'} ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
      title={title}
      aria-label={title}
      aria-pressed={active ? true : undefined}
      disabled={disabled}
    >
      <Icon className="w-3.5 h-3.5" strokeWidth={2} />
    </button>
  );
}

// The menu is rendered in a portal to <body> with fixed positioning so it can
// never be clipped by an ancestor's overflow (the toolbar scrolls horizontally)
// or sit behind the document. It's anchored to the trigger's screen rect.
export function Dropdown({ trigger, children, align = 'left' }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const measure = () => { const el = triggerRef.current; if (el) setRect(el.getBoundingClientRect()); };

  // Re-measure right before paint when opening, so the menu never flashes at (0,0).
  useLayoutEffect(() => { if (open) measure(); }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true); // any scroller closes the menu
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  const toggle = (v) => setOpen((o) => (typeof v === 'function' ? v(o) : v));

  let style = { position: 'fixed', zIndex: 10050, background: 'var(--bg-primary)', borderColor: 'var(--border-default)' };
  if (rect) {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    style.top = Math.round(rect.bottom + 4);
    if (align === 'right') style.right = Math.max(8, Math.round(vw - rect.right));
    else style.left = Math.max(8, Math.min(Math.round(rect.left), vw - 268));
  }

  return (
    <div className="relative" ref={triggerRef}>
      {trigger(open, toggle)}
      {open && rect && createPortal(
        <div ref={menuRef} className="py-1 rounded-xl shadow-2xl border min-w-[180px]" style={style} role="menu">
          {children(setOpen)}
        </div>,
        document.body,
      )}
    </div>
  );
}

export function Item({ icon: Icon, label, onClick, active, danger, disabled, spin }) {
  return (
    <button
      disabled={disabled}
      role="menuitem"
      onMouseDown={(e) => { e.preventDefault(); if (!disabled) onClick(); }}
      className={`flex items-center gap-2 w-full px-3 py-1.5 text-[11px] font-medium transition-colors hover:bg-[var(--bg-tertiary)] ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${active ? 'text-[var(--accent-primary)] bg-[var(--accent-primary)]/5' : danger ? 'text-red-400' : 'text-[var(--text-secondary)]'}`}>
      {Icon && <Icon className={`w-3.5 h-3.5 ${spin ? 'animate-spin' : ''}`} />} {label}
    </button>
  );
}

export function MenuDivider() {
  return <div className="my-1 h-px" style={{ background: 'var(--border-subtle)' }} />;
}

export function MenuLabel({ children }) {
  return <div className="px-3 pt-1.5 pb-0.5 text-[9px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{children}</div>;
}

export function BubbleDivider() {
  return <div className="w-px h-4 mx-0.5 shrink-0" style={{ background: 'var(--border-subtle)' }} />;
}

/* ── shared menu bodies (same in the toolbar and the bubble) ─────────────── */

/** "Turn into" block-type list. `onDone` closes the host dropdown. */
export function TurnIntoItems({ editor, t, onDone }) {
  const tt = mkTt(t);
  const chain = () => editor.chain().focus();
  const isPlain = !editor.isActive('heading') && !editor.isActive('bulletList') && !editor.isActive('orderedList') && !editor.isActive('taskList') && !editor.isActive('blockquote');
  const run = (fn) => { fn(); onDone?.(); };
  return (
    <>
      <Item icon={Pilcrow} label={tt('notebooks.paragraph', 'Text')} active={isPlain} onClick={() => run(() => chain().setParagraph().run())} />
      <Item icon={Heading1} label={tt('notebooks.heading_1', 'Heading 1')} active={editor.isActive('heading', { level: 1 })} onClick={() => run(() => chain().toggleHeading({ level: 1 }).run())} />
      <Item icon={Heading2} label={tt('notebooks.heading_2', 'Heading 2')} active={editor.isActive('heading', { level: 2 })} onClick={() => run(() => chain().toggleHeading({ level: 2 }).run())} />
      <Item icon={Heading3} label={tt('notebooks.heading_3', 'Heading 3')} active={editor.isActive('heading', { level: 3 })} onClick={() => run(() => chain().toggleHeading({ level: 3 }).run())} />
      <MenuDivider />
      <Item icon={List} label={tt('notebooks.bullet_list', 'Bullet list')} active={editor.isActive('bulletList')} onClick={() => run(() => chain().toggleBulletList().run())} />
      <Item icon={ListOrdered} label={tt('notebooks.numbered_list', 'Numbered list')} active={editor.isActive('orderedList')} onClick={() => run(() => chain().toggleOrderedList().run())} />
      <Item icon={CheckSquare} label={tt('notebooks.task_list', 'Task list')} active={editor.isActive('taskList')} onClick={() => run(() => chain().toggleTaskList().run())} />
      <Item icon={Quote} label={tt('notebooks.blockquote', 'Quote')} active={editor.isActive('blockquote')} onClick={() => run(() => chain().toggleBlockquote().run())} />
    </>
  );
}

/** Text-alignment list. */
export function AlignItems({ editor, t, onDone }) {
  const tt = mkTt(t);
  const chain = () => editor.chain().focus();
  const align = (a) => editor.isActive({ align: a });
  const run = (a) => { chain().setTextAlign(a).run(); onDone?.(); };
  return (
    <>
      <Item icon={AlignLeft} label={tt('notebooks.align_left', 'Align left')} active={align('left')} onClick={() => run('left')} />
      <Item icon={AlignCenter} label={tt('notebooks.align_center', 'Center')} active={align('center')} onClick={() => run('center')} />
      <Item icon={AlignRight} label={tt('notebooks.align_right', 'Align right')} active={align('right')} onClick={() => run('right')} />
    </>
  );
}

/** Colour + highlight + font panel body (the inner of the Colour dropdown). */
export function ColorFontPanel({ editor, t, onDone }) {
  const tt = mkTt(t);
  const chain = () => editor.chain().focus();
  const currentColor = editor.getAttributes('textStyle').color || null;
  const currentFont = editor.getAttributes('textStyle').fontFamily || null;
  return (
    <div className="p-2.5" style={{ minWidth: 208 }}>
      <MenuLabel>{tt('notebooks.text_color', 'Text color')}</MenuLabel>
      <div className="grid grid-cols-8 gap-1 mb-1.5">
        {PALETTE.map((c) => (
          <button key={c} onMouseDown={(e) => { e.preventDefault(); chain().setColor(c).run(); }} className="w-5 h-5 rounded-md border hover:scale-110 transition-transform" style={{ background: c, borderColor: currentColor === c ? 'white' : 'transparent', boxShadow: currentColor === c ? `0 0 0 2px ${c}` : 'none' }} />
        ))}
      </div>
      <div className="flex items-center justify-between mb-2">
        <label className="flex items-center gap-1.5 text-[10px] cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
          <input type="color" value={currentColor || '#000000'} onChange={(e) => chain().setColor(e.target.value).run()} className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0" />
          {tt('notebooks.custom', 'Custom')}
        </label>
        <button onMouseDown={(e) => { e.preventDefault(); chain().unsetColor().run(); }} className="text-[10px]" style={{ color: 'var(--text-muted)' }}>✕ {tt('notebooks.reset', 'Reset')}</button>
      </div>
      <MenuLabel>{tt('notebooks.highlight', 'Highlight')}</MenuLabel>
      <div className="grid grid-cols-8 gap-1 mb-1.5">
        {HIGHLIGHTS.map((c) => (
          <button key={c} onMouseDown={(e) => { e.preventDefault(); chain().toggleHighlight({ color: c }).run(); }} className="w-5 h-5 rounded-md border hover:scale-110 transition-transform" style={{ background: c, borderColor: 'transparent' }} />
        ))}
      </div>
      <MenuLabel>{tt('notebooks.font', 'Font')}</MenuLabel>
      <div className="max-h-[150px] overflow-y-auto custom-scrollbar -mx-1">
        {FONT_FAMILIES.map((f) => (
          <button key={f.label} onMouseDown={(e) => { e.preventDefault(); f.value ? chain().setFontFamily(f.value).run() : chain().unsetFontFamily().run(); onDone?.(); }} className={`flex items-center w-full px-2 py-1 text-[11px] rounded hover:bg-[var(--bg-tertiary)] ${f.value === currentFont ? 'text-[var(--accent-primary)] font-semibold' : 'text-[var(--text-secondary)]'}`} style={{ fontFamily: f.css }}>{f.label}</button>
        ))}
      </div>
    </div>
  );
}

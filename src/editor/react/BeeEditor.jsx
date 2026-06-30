/**
 * BeeEditor — React wrapper for the from-scratch editor. Drop-in replacement for
 * NotebookEditor: identical props + imperative ref API, so the call sites switch
 * with one import. React renders the chrome (toolbar, bubble menus, atom portals)
 * and a single contentEditable host; the EditorView owns the editable DOM.
 */
import React, {
  useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle, useReducer,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered, Quote,
  Heading1, Heading2, Heading3, AlignLeft, AlignCenter, AlignRight,
  Highlighter, Wand2, RefreshCw, Scissors, Expand, Code, Link as LinkIcon,
  Table2, Trash2, ChevronDown, ChevronRight, Sigma, CheckSquare, ImageIcon, Palette, WrapText,
  Loader2, ExternalLink, Minus, Pilcrow, Plus, BarChart3,
} from 'lucide-react';
import useTranslation from '../../hooks/useTranslation';
import useFloatingRect from './useFloatingRect.js';
import SlashMenu from './SlashMenu.jsx';
import { EditorView } from '../engine/view.js';
import { createState } from '../engine/state.js';
import { htmlToAst } from '../serialization/htmlToAst.js';
import { contentToDoc, markdownToDoc } from './contentPipeline.js';
import { makeFacade } from './editorFacade.js';
import ImageView from '../nodeviews/ImageView.jsx';
import MermaidView from '../nodeviews/MermaidView.jsx';
import MathView from '../nodeviews/MathView.jsx';
import FormulaView from '../nodeviews/FormulaView.jsx';
import ChartView from '../nodeviews/ChartView.jsx';
import ChartConfigModal from './ChartConfigModal.jsx';
import { tableToMatrix } from '../engine/formula.js';
import SectionDragLayer from './SectionDragLayer.jsx';
import { API_BASE } from '../../utils/helpers';
import EditorToolbar from './EditorToolbar.jsx';
import {
  Btn, Dropdown, Item, MenuDivider, MenuLabel, BubbleDivider, mkTt,
  FONT_FAMILIES, PALETTE, HIGHLIGHTS,
} from './toolbarPrimitives.jsx';
import '../editor.css';
import 'katex/dist/katex.min.css';

/* ── main component ─────────────────────────────────────── */
const BeeEditor = forwardRef(function BeeEditor(props, ref) {
  const {
    content, placeholder, editable = true, onChange, onSave, onAIAction, onAIFill,
    saving, onImportClick, generating, aiFilling, onTocUpdate, notebookId, askAiEnabled = true,
  } = props;

  const { t } = useTranslation();
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const facadeRef = useRef(null);
  const notebookIdRef = useRef(notebookId);
  const lastHtmlRef = useRef(null);
  const saveTimer = useRef(null);
  const imageInputRef = useRef(null);
  // contentGen increments on every external content swap (notebook switch / restore /
  // AI update). A debounced save captures the gen + notebook id at schedule time and
  // only fires if both still match — so a pending save from notebook A can never write
  // A's content into notebook B after a switch.
  const contentGenRef = useRef(0);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const [, bump] = useReducer((x) => x + 1, 0);
  const [atoms, setAtoms] = useState([]);
  const [wordCount, setWordCount] = useState(0);
  const [ask, setAsk] = useState(null); // {anchor:{top,left}, from, to, text}
  const [askQuery, setAskQuery] = useState('');
  const [chartConfig, setChartConfig] = useState(null); // { columns, rows } | null
  const [collapsed, setCollapsed] = useState(() => loadCollapsed(notebookId)); // Set<ordinal>
  const tt = mkTt(t);

  useEffect(() => { onChangeRef.current = onChange; onSaveRef.current = onSave; });

  // Switching notebooks must cancel any save still pending for the previous one.
  useEffect(() => {
    if (notebookIdRef.current !== notebookId) {
      if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
      contentGenRef.current += 1;
    }
    notebookIdRef.current = notebookId;
  }, [notebookId]);

  // Keep onTocUpdate fresh for the stable refreshChrome callback.
  const onTocRef = useRef(onTocUpdate);
  useEffect(() => { onTocRef.current = onTocUpdate; }, [onTocUpdate]);

  // Recompute toolbar chrome (word count, TOC) after an external content change
  // that doesn't emit an update (setContent / AI write / content prop) — without
  // triggering a save. Fixes the "0 words after AI write" stale-count bug.
  const refreshChrome = useCallback(() => {
    const v = viewRef.current;
    if (!v) return;
    lastHtmlRef.current = v.getHTML();
    setWordCount(countWords(v.getText()));
    updateToc(v, onTocRef.current);
    bump();
  }, []);

  // Collapse state is view-only (never serialized): reload on notebook switch,
  // persist on change, and re-apply the `bf-collapsed` class to each table el
  // after every render (the reconciler may recreate table elements).
  const prevNbRef = useRef(notebookId);
  useEffect(() => {
    if (prevNbRef.current !== notebookId) { prevNbRef.current = notebookId; setCollapsed(loadCollapsed(notebookId)); }
  }, [notebookId]);
  useEffect(() => { saveCollapsed(notebookId, collapsed); }, [collapsed, notebookId]);
  useEffect(() => {
    const v = viewRef.current;
    if (!v?.allTables) return;
    for (const { el, ordinal } of v.allTables()) { if (el) el.classList.toggle('bf-collapsed', collapsed.has(ordinal)); }
  });

  const toggleCollapseFocused = useCallback(() => {
    const info = viewRef.current?.tableInfo?.();
    if (!info) return;
    setCollapsed((prev) => { const n = new Set(prev); if (n.has(info.ordinal)) n.delete(info.ordinal); else n.add(info.ordinal); return n; });
  }, []);

  // Open the chart config modal, seeded with the current table's columns/rows.
  const openChartModal = useCallback(() => {
    const info = viewRef.current?.tableInfo?.();
    if (!info) return;
    const matrix = tableToMatrix(info.node);
    if (!matrix.length || !matrix[0]?.length) return;
    setChartConfig({ columns: matrix[0], rows: matrix.slice(1) });
  }, []);
  const createChart = useCallback((spec) => {
    setChartConfig(null);
    viewRef.current?.chain().focus().insertAfterTable({ type: 'chart', attrs: { spec: JSON.stringify(spec) } }).run();
    refreshChrome();
  }, [refreshChrome]);

  /* mount the view once */
  useEffect(() => {
    const host = hostRef.current;
    let nextAtomId = 1;
    const view = new EditorView(host, {
      state: createState(contentToDoc(content)),
      editable,
      htmlToAst: (html) => htmlToAst(html),
      mountAtom: (node, hostEl) => {
        hostEl.__bfAtomNode = node;
        const id = nextAtomId++;
        hostEl.__bfAtomId = id;
        setAtoms((a) => [...a, { host: hostEl, node, id }]);
      },
      unmountAtom: (hostEl) => setAtoms((a) => a.filter((x) => x.host !== hostEl)),
      // Re-point an atom's portal at the new node (attr change) WITHOUT unmounting,
      // so the mermaid/math view keeps its DOM + internal state (no flicker/reset).
      remapAtom: (hostEl, n) => { hostEl.__bfAtomNode = n; setAtoms((a) => a.map((x) => (x.host === hostEl ? { ...x, node: n } : x))); },
      onUpdate: () => {
        const html = view.getHTML();
        lastHtmlRef.current = html;
        onChangeRef.current?.(html);
        setWordCount(countWords(view.getText()));
        updateToc(view, onTocRef.current);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        const genAtSchedule = contentGenRef.current;
        const idAtSchedule = notebookIdRef.current;
        saveTimer.current = setTimeout(() => {
          // Only persist if we haven't switched notebooks since this edit.
          if (contentGenRef.current === genAtSchedule && notebookIdRef.current === idAtSchedule) onSaveRef.current?.(html);
        }, 2000);
        bump();
      },
      onSelectionChange: () => bump(),
    });
    viewRef.current = view;
    facadeRef.current = makeFacade(view);
    console.info('%c[BeeEditor] new editor active (not TipTap)', 'color:#3b82f6;font-weight:600');
    lastHtmlRef.current = view.getHTML();
    setWordCount(countWords(view.getText()));
    updateToc(view, onTocUpdate);

    // Image paste/drop → upload (capture phase, before the view's text handler)
    const onPaste = (e) => { if (handleImageClipboard(e.clipboardData)) e.stopImmediatePropagation(); };
    const onDrop = (e) => { if (handleImageClipboard(e.dataTransfer)) { e.preventDefault(); e.stopImmediatePropagation(); } };
    host.addEventListener('paste', onPaste, true);
    host.addEventListener('drop', onDrop, true);

    // Thorough teardown so a StrictMode/HMR re-mount starts from a clean host
    // (no duplicate listeners, no orphaned atom portals, no pending save).
    return () => {
      host.removeEventListener('paste', onPaste, true);
      host.removeEventListener('drop', onDrop, true);
      if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
      view.destroy();
      try { host.textContent = ''; } catch (e) { /* noop */ }
      setAtoms([]);
      viewRef.current = null;
      facadeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* external content changes (e.g. switching notebooks) */
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (typeof content === 'string' && content !== lastHtmlRef.current) {
      // External content swap: cancel any save still pending for the old content.
      if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
      view.setDoc(contentToDoc(content), { emitUpdate: false });
      refreshChrome();
      // Compare future props against the raw incoming string so an identical
      // content prop on a later render doesn't re-apply (refreshChrome set this
      // to the re-serialized HTML, which may differ from `content`).
      lastHtmlRef.current = content;
    }
  }, [content, refreshChrome]);

  useEffect(() => { viewRef.current?.setEditable(editable); }, [editable]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const ph = t('notebooks.placeholder');
    const fallback = placeholder || (ph && ph !== 'notebooks.placeholder' ? ph : 'Begin met schrijven…');
    host.style.setProperty('--bf-placeholder', `"${fallback.replace(/"/g, '\\"')}"`);
  }, [placeholder, t]);

  /* image upload */
  const uploadImage = useCallback(async (file) => {
    const nbId = notebookIdRef.current;
    if (!nbId || !file || !/^image\//.test(file.type)) return;
    const fd = new FormData();
    fd.append('image', file);
    try {
      const res = await fetch(`${API_BASE}/api/notebooks/${nbId}/images`, { method: 'POST', body: fd, credentials: 'include' });
      const data = await res.json();
      if (data.url) {
        const src = `${API_BASE}${data.url}`;
        if (src.startsWith('/') || /^https?:\/\//i.test(src)) viewRef.current?.chain().focus().setImage({ src, alt: file.name }).run();
      }
    } catch (err) { console.error('[BeeEditor] image upload failed', err); }
  }, []);

  const handleImageClipboard = (dt) => {
    const items = Array.from(dt?.items || dt?.files || []);
    const img = items.find((i) => (i.type || '').startsWith('image/'));
    if (!img) return false;
    const file = img.getAsFile ? img.getAsFile() : img;
    if (file) uploadImage(file);
    return true;
  };

  /* imperative ref API (parity + setMarkdown fix) */
  useImperativeHandle(ref, () => ({
    insertContent: (c) => { viewRef.current?.chain().focus().insertContent(c).run(); refreshChrome(); },
    setContent: (html) => { viewRef.current?.setDoc(contentToDoc(html), { emitUpdate: false }); refreshChrome(); },
    insertMarkdown: (md) => { viewRef.current?.chain().focus().insertContent(md).run(); refreshChrome(); },
    setMarkdownContent: (md) => { viewRef.current?.setDoc(markdownToDoc(md), { emitUpdate: false }); refreshChrome(); },
    setMarkdown: (md) => { viewRef.current?.setDoc(markdownToDoc(md), { emitUpdate: false }); refreshChrome(); },
    getEditor: () => facadeRef.current,
  }), [refreshChrome]);

  const editor = facadeRef.current;
  const selectedAtomNode = viewRef.current?.getSelectedNode?.() || null;
  // Re-evaluated each render; BeeEditor re-renders on selectionchange (bump),
  // so the toolbar's AI items enable/disable as the selection changes.
  const hasSelection = !!(viewRef.current && selectionText(viewRef.current).trim());
  // The table the caret sits in (for the on-edit add-row/add-column controls).
  const tableInfo = editor && editable ? (viewRef.current?.tableInfo?.() || null) : null;
  const tableCollapsed = tableInfo ? collapsed.has(tableInfo.ordinal) : false;

  /* AI action helpers */
  const aiAction = (key, customQuery = null) => {
    const view = viewRef.current;
    if (!view || !onAIAction) return;
    const text = view.getText && selectionText(view);
    const flat = view.selectionFlat?.();
    if (!text || !text.trim()) return;
    onAIAction(key, text, flat || { from: 0, to: 0 }, customQuery);
  };

  // Open the Ask-AI portal anchored on the current selection (used by the
  // toolbar's AI ▾ → Ask AI, mirroring the FormatBubble's Ask button).
  const openAskFromSelection = () => {
    const view = viewRef.current;
    if (!view) return;
    const text = selectionText(view);
    if (!text || !text.trim()) return;
    const flat = view.selectionFlat?.() || { from: 0, to: 0 };
    let anchor = { top: 120, left: 120 };
    try {
      const dsel = window.getSelection();
      if (dsel && dsel.rangeCount) { const r = dsel.getRangeAt(0).getBoundingClientRect(); anchor = { top: r.top, left: r.left }; }
    } catch (e) { /* noop */ }
    setAsk({ anchor, from: flat.from, to: flat.to, text });
    setAskQuery('');
  };

  const insertMath = () => {
    const view = viewRef.current;
    const text = selectionText(view);
    view.chain().focus().insertContent(text?.trim() ? `$${text}$` : '$formula$').run();
  };

  /* ── block insertion (shared by the status-strip Insert menu + slash menu) ── */
  const insertItems = React.useMemo(() => buildInsertItems(t), [t]);

  const runInsert = useCallback((item, deleteBack = 0) => {
    const view = viewRef.current;
    if (!view || !item) return;
    let c = view.chain().focus();
    for (let i = 0; i < deleteBack; i++) c = c.deleteBackward();
    if (item.apply) {
      item.apply(c).run();
    } else {
      c.run();
      if (item.action === 'image') imageInputRef.current?.click();
      else if (item.action === 'math') insertMath();
    }
    refreshChrome();
  }, [refreshChrome]);

  /* ── slash menu (/ at the start of a text run) ── */
  const [slash, setSlash] = useState(null); // { query, rect:{top,left}, matchLen }

  const detectSlash = useCallback(() => {
    const view = viewRef.current;
    if (!view || view.composing) { setSlash(null); return; }
    const dsel = window.getSelection();
    if (!dsel || !dsel.isCollapsed || dsel.rangeCount === 0) { setSlash(null); return; }
    const node = dsel.anchorNode;
    if (!node || node.nodeType !== 3 || !hostRef.current?.contains(node)) { setSlash(null); return; }
    const before = node.textContent.slice(0, dsel.anchorOffset);
    const m = before.match(/^\/(\w*)$/);
    if (!m) { setSlash(null); return; }
    const r = dsel.getRangeAt(0).getBoundingClientRect();
    setSlash({ query: m[1], rect: { top: r.bottom, left: r.left }, matchLen: m[1].length + 1 });
  }, []);

  useEffect(() => {
    const onSel = () => detectSlash();
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, [detectSlash]);

  const runSlash = useCallback((item) => {
    runInsert(item, slash?.matchLen || 0);
    setSlash(null);
  }, [slash, runInsert]);

  return (
    <div className="bf-editor flex flex-col h-full relative" style={{ background: 'var(--bg-primary)' }}>
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ''; }} />

      {editor && editable && (
        <EditorToolbar
          editor={editor}
          t={t}
          insertItems={insertItems}
          onInsert={runInsert}
          onImportClick={onImportClick}
          onAIFill={onAIFill}
          aiFilling={aiFilling}
          askAiEnabled={askAiEnabled}
          saving={saving}
          wordCount={wordCount}
          onAIAction={aiAction}
          onAsk={openAskFromSelection}
          hasSelection={hasSelection}
          tableMenuExtras={({ inTable, setOpen }) => (
            <>
              <Item icon={BarChart3} label={tt('notebooks.create_chart', 'Create chart')} disabled={!inTable} onClick={() => { openChartModal(); setOpen(false); }} />
              <Item icon={tableCollapsed ? ChevronDown : ChevronRight} label={tableCollapsed ? tt('notebooks.expand_table', 'Expand table') : tt('notebooks.collapse_table', 'Collapse table')} disabled={!inTable} onClick={() => { toggleCollapseFocused(); setOpen(false); }} />
            </>
          )}
        />
      )}

      {generating && <GeneratingOverlay label={generating} />}

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-[820px] mx-auto px-8 py-6 relative">
          {editor && editable && <SectionDragLayer hostRef={hostRef} viewRef={viewRef} />}
          <div ref={hostRef} className="notebook-editor bf-content" />
        </div>
      </div>

      {/* contextual format bubble (inline marks + block + AI) */}
      {editor && editable && (
        <FormatBubble
          view={viewRef.current}
          editor={editor}
          t={t}
          askAiEnabled={askAiEnabled}
          onAction={aiAction}
          onAsk={(anchor, from, to, text) => { setAsk({ anchor, from, to, text }); setAskQuery(''); }}
          askOpen={!!ask}
        />
      )}

      {/* slash command menu (/ for block insertion) */}
      {editor && editable && slash && (
        <SlashMenu
          items={insertItems}
          query={slash.query}
          rect={slash.rect}
          onSelect={runSlash}
          onClose={() => setSlash(null)}
        />
      )}

      {/* table add-row / add-column + collapse controls (caret inside a table) */}
      {editor && editable && tableInfo && (
        <TableControls view={viewRef.current} info={tableInfo} t={t} collapsed={tableCollapsed} onToggleCollapse={toggleCollapseFocused} />
      )}

      {/* image bubble */}
      {editor && editable && selectedAtomNode?.type === 'image' && (
        <ImageBubble view={viewRef.current} node={selectedAtomNode} />
      )}

      {/* link edit popover (caret inside a link) */}
      {editor && editable && <LinkPopover view={viewRef.current} editor={editor} />}

      {/* ask AI floating portal */}
      {ask && (
        <AskPortal
          ask={ask} query={askQuery} setQuery={setAskQuery} t={t}
          onSubmit={() => { if (askQuery.trim()) onAIAction?.('ask', ask.text, { from: ask.from, to: ask.to }, askQuery.trim()); setAsk(null); }}
          onClose={() => setAsk(null)}
        />
      )}

      {/* chart config modal */}
      {chartConfig && (
        <ChartConfigModal
          columns={chartConfig.columns}
          rows={chartConfig.rows}
          t={t}
          onCreate={createChart}
          onClose={() => setChartConfig(null)}
        />
      )}

      {/* atom portals */}
      {atoms.map((a) => createPortal(
        <AtomRenderer node={a.node} view={viewRef.current} selected={selectedAtomNode === a.node} editable={editable} />,
        a.host, a.id,
      ))}
    </div>
  );
});

/* ── atom renderer ──────────────────────────────────────── */
function AtomRenderer({ node, view, selected, editable }) {
  if (node.type === 'image') return <ImageView node={node} view={view} selected={selected} editable={editable} />;
  if (node.type === 'mermaid') return <MermaidView node={node} view={view} editable={editable} />;
  if (node.type === 'mathBlock') return <MathView node={node} view={view} inline={false} editable={editable} />;
  if (node.type === 'mathInline') return <MathView node={node} view={view} inline editable={editable} />;
  if (node.type === 'formula') return <FormulaView node={node} view={view} editable={editable} />;
  if (node.type === 'chart') return <ChartView node={node} view={view} editable={editable} />;
  return null;
}

/* ── block-insert catalogue (status-strip Insert menu + slash menu) ──────── */
function buildInsertItems(t) {
  const tt = (key, fallback) => { const v = t ? t(key) : null; return v && v !== key ? v : fallback; };
  return [
    { key: 'h1', icon: Heading1, label: tt('notebooks.heading_1', 'Heading 1'), keywords: 'h1 title', apply: (c) => c.toggleHeading({ level: 1 }) },
    { key: 'h2', icon: Heading2, label: tt('notebooks.heading_2', 'Heading 2'), keywords: 'h2 subtitle', apply: (c) => c.toggleHeading({ level: 2 }) },
    { key: 'h3', icon: Heading3, label: tt('notebooks.heading_3', 'Heading 3'), keywords: 'h3', apply: (c) => c.toggleHeading({ level: 3 }) },
    { key: 'bullet', icon: List, label: tt('notebooks.bullet_list', 'Bullet list'), keywords: 'ul unordered', apply: (c) => c.toggleBulletList() },
    { key: 'ordered', icon: ListOrdered, label: tt('notebooks.numbered_list', 'Numbered list'), keywords: 'ol numbered', apply: (c) => c.toggleOrderedList() },
    { key: 'task', icon: CheckSquare, label: tt('notebooks.task_list', 'Task list'), keywords: 'todo checkbox', apply: (c) => c.toggleTaskList() },
    { key: 'quote', icon: Quote, label: tt('notebooks.blockquote', 'Quote'), keywords: 'blockquote', apply: (c) => c.toggleBlockquote() },
    { key: 'code', icon: Code, label: tt('notebooks.code_block', 'Code block'), keywords: 'pre snippet', apply: (c) => c.setCodeBlock() },
    { key: 'table', icon: Table2, label: tt('notebooks.table', 'Table'), keywords: 'grid', apply: (c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }) },
    { key: 'divider', icon: Minus, label: tt('notebooks.divider', 'Divider'), keywords: 'hr rule horizontal', apply: (c) => c.setHorizontalRule() },
    { key: 'image', icon: ImageIcon, label: tt('notebooks.upload_image', 'Image'), keywords: 'picture photo', action: 'image' },
    { key: 'math', icon: Sigma, label: tt('notebooks.math_formula', 'Math'), keywords: 'formula latex equation', action: 'math' },
  ];
}

/* ── bubble menus ───────────────────────────────────────── */

// FormatBubble — the contextual formatter shown on a text selection. It is now
// the PRIMARY formatting surface (the persistent toolbar was demoted): inline
// marks + "turn into" block type + alignment + colour/highlight/font + AI.
function FormatBubble({ view, editor, t, askAiEnabled, onAction, onAsk, askOpen }) {
  const rect = useFloatingRect(view, { enabled: !askOpen });
  if (!rect || !editor) return null;
  const tt = (key, fallback) => { const v = t(key); return v && v !== key ? v : fallback; };
  const chain = () => editor.chain().focus();
  const align = (a) => editor.isActive({ align: a });
  const currentColor = editor.getAttributes('textStyle').color || null;
  const currentFont = editor.getAttributes('textStyle').fontFamily || null;
  const isPlain = !editor.isActive('heading') && !editor.isActive('bulletList') && !editor.isActive('orderedList') && !editor.isActive('taskList') && !editor.isActive('blockquote');

  // Above the selection, flipping below when there's no room; clamp horizontally.
  const W = 360;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const left = Math.max(8, Math.min(rect.left, vw - W - 8));
  const above = rect.top - 46;
  const top = above < 8 ? rect.bottom + 8 : above;

  const turnLabel = editor.isActive('heading', { level: 1 }) ? 'H1'
    : editor.isActive('heading', { level: 2 }) ? 'H2'
    : editor.isActive('heading', { level: 3 }) ? 'H3'
    : editor.isActive('bulletList') ? '•'
    : editor.isActive('orderedList') ? '1.'
    : editor.isActive('taskList') ? '☑'
    : editor.isActive('blockquote') ? '❝'
    : tt('notebooks.paragraph', 'Text');

  return (
    <div className="fixed z-[9998] flex items-center flex-wrap px-1.5 py-1 rounded-xl shadow-xl border backdrop-blur-md"
      style={{ top, left, gap: 2, maxWidth: 'min(94vw, 540px)', background: 'var(--bg-primary)', borderColor: 'var(--border-default)' }}
      role="toolbar" aria-label={tt('notebooks.format', 'Format')}
      onMouseDown={(e) => e.preventDefault()}>
      <Btn onClick={() => chain().toggleBold().run()} active={editor.isActive('bold')} icon={Bold} title={tt('notebooks.bold', 'Bold')} />
      <Btn onClick={() => chain().toggleItalic().run()} active={editor.isActive('italic')} icon={Italic} title={tt('notebooks.italic', 'Italic')} />
      <Btn onClick={() => chain().toggleUnderline().run()} active={editor.isActive('underline')} icon={UnderlineIcon} title={tt('notebooks.underline', 'Underline')} />
      <Btn onClick={() => chain().toggleStrike().run()} active={editor.isActive('strike')} icon={Strikethrough} title={tt('notebooks.strikethrough', 'Strikethrough')} />
      <Btn onClick={() => chain().toggleCode().run()} active={editor.isActive('code')} icon={Code} title={tt('notebooks.inline_code', 'Inline code')} />
      <Btn onClick={() => chain().toggleHighlight().run()} active={editor.isActive('highlight')} icon={Highlighter} title={tt('notebooks.highlight', 'Highlight')} />
      <Btn onClick={() => { const url = window.prompt(tt('notebooks.url', 'URL')); if (url) chain().setLink({ href: url }).run(); }} active={editor.isActive('link')} icon={LinkIcon} title={tt('notebooks.insert_link', 'Insert link')} />

      <BubbleDivider />

      {/* Turn into block type */}
      <Dropdown trigger={(open, setOpen) => (
        <button onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }} className="flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]" title={tt('notebooks.turn_into', 'Turn into')}>
          <span className="min-w-[14px] text-center">{turnLabel}</span><ChevronDown className="w-3 h-3 opacity-50" />
        </button>
      )}>
        {(setOpen) => (
          <>
            <Item icon={Pilcrow} label={tt('notebooks.paragraph', 'Text')} active={isPlain} onClick={() => { chain().setParagraph().run(); setOpen(false); }} />
            <Item icon={Heading1} label={tt('notebooks.heading_1', 'Heading 1')} active={editor.isActive('heading', { level: 1 })} onClick={() => { chain().toggleHeading({ level: 1 }).run(); setOpen(false); }} />
            <Item icon={Heading2} label={tt('notebooks.heading_2', 'Heading 2')} active={editor.isActive('heading', { level: 2 })} onClick={() => { chain().toggleHeading({ level: 2 }).run(); setOpen(false); }} />
            <Item icon={Heading3} label={tt('notebooks.heading_3', 'Heading 3')} active={editor.isActive('heading', { level: 3 })} onClick={() => { chain().toggleHeading({ level: 3 }).run(); setOpen(false); }} />
            <MenuDivider />
            <Item icon={List} label={tt('notebooks.bullet_list', 'Bullet list')} active={editor.isActive('bulletList')} onClick={() => { chain().toggleBulletList().run(); setOpen(false); }} />
            <Item icon={ListOrdered} label={tt('notebooks.numbered_list', 'Numbered list')} active={editor.isActive('orderedList')} onClick={() => { chain().toggleOrderedList().run(); setOpen(false); }} />
            <Item icon={CheckSquare} label={tt('notebooks.task_list', 'Task list')} active={editor.isActive('taskList')} onClick={() => { chain().toggleTaskList().run(); setOpen(false); }} />
            <Item icon={Quote} label={tt('notebooks.blockquote', 'Quote')} active={editor.isActive('blockquote')} onClick={() => { chain().toggleBlockquote().run(); setOpen(false); }} />
          </>
        )}
      </Dropdown>

      {/* Alignment */}
      <Dropdown trigger={(open, setOpen) => (
        <button onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }} className={`flex items-center gap-0.5 p-1.5 rounded-md ${align('center') || align('right') ? 'text-[var(--accent-primary)] bg-[var(--accent-primary)]/10' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`} title={tt('notebooks.alignment', 'Alignment')}>
          <AlignLeft className="w-3.5 h-3.5" /><ChevronDown className="w-2.5 h-2.5 opacity-50" />
        </button>
      )}>
        {(setOpen) => (
          <>
            <Item icon={AlignLeft} label={tt('notebooks.align_left', 'Align left')} active={align('left')} onClick={() => { chain().setTextAlign('left').run(); setOpen(false); }} />
            <Item icon={AlignCenter} label={tt('notebooks.align_center', 'Center')} active={align('center')} onClick={() => { chain().setTextAlign('center').run(); setOpen(false); }} />
            <Item icon={AlignRight} label={tt('notebooks.align_right', 'Align right')} active={align('right')} onClick={() => { chain().setTextAlign('right').run(); setOpen(false); }} />
          </>
        )}
      </Dropdown>

      {/* Colour / highlight / font */}
      <Dropdown trigger={(open, setOpen) => (
        <button onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }} className={`flex items-center gap-1 p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] ${currentColor || currentFont ? 'bg-[var(--accent-primary)]/10' : ''}`} title={tt('notebooks.text_style', 'Text style')}>
          <Palette className="w-3.5 h-3.5" style={{ color: currentColor || 'currentColor' }} /><ChevronDown className="w-2.5 h-2.5 opacity-50" />
        </button>
      )}>
        {(setOpen) => (
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
                <button key={f.label} onMouseDown={(e) => { e.preventDefault(); f.value ? chain().setFontFamily(f.value).run() : chain().unsetFontFamily().run(); setOpen(false); }} className={`flex items-center w-full px-2 py-1 text-[11px] rounded hover:bg-[var(--bg-tertiary)] ${f.value === currentFont ? 'text-[var(--accent-primary)] font-semibold' : 'text-[var(--text-secondary)]'}`} style={{ fontFamily: f.css }}>{f.label}</button>
              ))}
            </div>
          </div>
        )}
      </Dropdown>

      {askAiEnabled && (
        <>
          <BubbleDivider />
          {[['rewrite', RefreshCw, tt('notebooks.ai_action_rewrite', 'Rewrite')], ['shorten', Scissors, tt('notebooks.ai_action_shorten', 'Shorten')], ['expand', Expand, tt('notebooks.ai_action_expand', 'Expand')]].map(([k, Icon, label]) => (
            <button key={k} onClick={() => onAction(k)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] hover:bg-[var(--bg-tertiary)]" style={{ color: 'var(--text-secondary)' }}>
              <Icon className="w-3 h-3" /> {label}
            </button>
          ))}
          <button onClick={() => onAsk({ top: rect.top, left: rect.left }, view.selectionFlat?.()?.from ?? 0, view.selectionFlat?.()?.to ?? 0, selectionText(view))}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px]" style={{ color: 'var(--accent-primary)' }}>
            <Wand2 className="w-3 h-3" /> {tt('notebooks.ask_ai', 'Ask AI')}
          </button>
        </>
      )}
    </div>
  );
}

function ImageBubble({ view, node }) {
  const rect = useNodeRect(view, node);
  if (!rect) return null;
  const attrs = node.attrs || {};
  const setAttr = (a) => view.updateAtom(node, a);
  const width = (pct) => { const w = pct === 100 ? null : Math.round(((view.host.clientWidth - 40) * pct) / 100); setAttr({ width: w }); };
  return (
    <div className="fixed z-[9998] flex items-center gap-0.5 px-1.5 py-1 rounded-xl shadow-xl border backdrop-blur-md"
      style={{ top: rect.top - 44, left: rect.left, background: 'var(--bg-primary)', borderColor: 'var(--border-default)' }}
      onMouseDown={(e) => e.preventDefault()}>
      {['left', 'center', 'right'].map((al) => {
        const Icon = al === 'left' ? AlignLeft : al === 'center' ? AlignCenter : AlignRight;
        return <button key={al} onClick={() => setAttr({ alignment: al })} className={`p-1.5 rounded-lg ${(attrs.alignment || 'center') === al ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}><Icon className="w-3.5 h-3.5" /></button>;
      })}
      <div className="w-px h-4 mx-0.5" style={{ background: 'var(--border-subtle)' }} />
      <button onClick={() => setAttr({ textWrap: !attrs.textWrap })} className={`p-1.5 rounded-lg ${attrs.textWrap ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}><WrapText className="w-3.5 h-3.5" /></button>
      <div className="w-px h-4 mx-0.5" style={{ background: 'var(--border-subtle)' }} />
      {[25, 50, 75, 100].map((p) => {
        const full = view.host ? view.host.clientWidth - 40 : 0;
        const cur = attrs.width || (full || null);
        const activePct = !attrs.width ? 100 : (full ? Math.round((attrs.width / full) * 100) : null);
        const isActive = activePct != null && Math.abs(activePct - p) <= 4;
        return <button key={p} title={`${p}%`} onClick={() => width(p)} className={`px-1.5 py-1 rounded-lg text-[10px] font-semibold ${isActive ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}>{p}%</button>;
      })}
      <div className="w-px h-4 mx-0.5" style={{ background: 'var(--border-subtle)' }} />
      <button onClick={() => view.deleteAtom(node)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /></button>
    </div>
  );
}

function AskPortal({ ask, query, setQuery, onSubmit, onClose, t }) {
  const inputRef = useRef(null);
  const tt = (key, fallback) => { const v = t ? t(key) : null; return v && v !== key ? v : fallback; };
  useEffect(() => { const id = requestAnimationFrame(() => inputRef.current?.focus()); return () => cancelAnimationFrame(id); }, []);
  useEffect(() => {
    const h = (e) => { const p = document.querySelector('[data-ask-portal]'); if (p && !p.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  const preview = (ask.text || '').slice(0, 120);
  // Clamp to the viewport: keep within the right edge, and drop below the
  // selection when there isn't room above (mirrors the old editor).
  const W = 360;
  const left = Math.max(8, Math.min(ask.anchor.left, (typeof window !== 'undefined' ? window.innerWidth : 1200) - W - 8));
  const above = ask.anchor.top - 52;
  const top = above < 8 ? ask.anchor.top + 24 : above;
  return (
    <div data-ask-portal className="fixed z-[9999] flex flex-col rounded-xl shadow-2xl border backdrop-blur-md overflow-hidden"
      style={{ top, left, minWidth: 280, maxWidth: W, background: 'var(--bg-primary)', borderColor: 'var(--border-default)' }}
      onMouseDown={(e) => e.stopPropagation()}>
      {preview && (
        <div className="px-3 pt-2 pb-1.5 text-[10px] border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
          <div className="text-[9px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-tertiary)' }}>{tt('notebooks.selected_text', 'Selected text')}</div>
          <p className="italic line-clamp-3">{preview}</p>
        </div>
      )}
      <div className="flex items-center gap-2 px-3 py-1.5">
        <Wand2 className="w-3 h-3" style={{ color: 'var(--accent-primary)' }} />
        <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tt('notebooks.ask_ai_placeholder', 'Ask me…')}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); onSubmit(); } else if (e.key === 'Escape') onClose(); }}
          className="bg-transparent border-none outline-none text-[11px] w-[200px] text-[var(--text-primary)]" />
        <button onMouseDown={(e) => { e.preventDefault(); onSubmit(); }} className="px-2 py-1 rounded-lg text-[10px] font-bold bg-[var(--accent-primary)] text-white" disabled={!query.trim()}>{tt('notebooks.send', 'Send')}</button>
        <button onMouseDown={(e) => { e.preventDefault(); onClose(); }} className="px-1.5 py-1 text-[var(--text-tertiary)]">×</button>
      </div>
    </div>
  );
}

function GeneratingOverlay({ label }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none" style={{ background: 'rgba(127,127,127,0.06)' }}>
      <div className="flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border text-sm font-semibold" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent-primary)' }} />
        <span>Generating {String(label).replace(/_/g, ' ')}…</span>
        <span className="flex gap-0.5">
          {[0, 1, 2].map((i) => <span key={i} className="w-1 h-1 rounded-full animate-bounce" style={{ background: 'var(--accent-primary)', animationDelay: `${i * 120}ms` }} />)}
        </span>
      </div>
    </div>
  );
}

/* ── link edit popover (caret inside a link) ─────────────── */
function LinkPopover({ view, editor }) {
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    const h = () => force();
    document.addEventListener('selectionchange', h);
    return () => document.removeEventListener('selectionchange', h);
  }, []);
  if (!editor || !editor.isActive('link')) return null;
  const href = editor.getAttributes('link').href || '';
  const sel = view?.state?.selection;
  let rect = null;
  try {
    const dsel = window.getSelection();
    if (dsel && dsel.rangeCount) rect = dsel.getRangeAt(0).getBoundingClientRect();
  } catch (e) { /* noop */ }
  if (!rect || (rect.width === 0 && rect.height === 0)) return null;
  const edit = () => { const url = window.prompt('URL', href); if (url != null) editor.chain().focus().setLink({ href: url }).run(); };
  const remove = () => editor.chain().focus().unsetLink().run();
  return (
    <div className="fixed z-[9998] flex items-center gap-1.5 px-2 py-1 rounded-xl shadow-xl border backdrop-blur-md"
      style={{ top: rect.bottom + 6, left: rect.left, maxWidth: 360, background: 'var(--bg-primary)', borderColor: 'var(--border-default)' }}
      onMouseDown={(e) => e.preventDefault()}>
      <ExternalLink className="w-3 h-3 shrink-0" style={{ color: 'var(--accent-primary)' }} />
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-[11px] truncate max-w-[180px]" style={{ color: 'var(--accent-primary)' }} title={href}>{href || '—'}</a>
      <button onClick={edit} className="px-1.5 py-0.5 rounded text-[10px] hover:bg-[var(--bg-tertiary)]" style={{ color: 'var(--text-secondary)' }}>Edit</button>
      <button onClick={remove} className="p-1 rounded text-red-400 hover:bg-red-500/10"><Trash2 className="w-3 h-3" /></button>
    </div>
  );
}

/* ── table add-row / add-column controls ─────────────────── */
// Floating "+" affordances glued to the right edge (add column) and bottom edge
// (add row) of the table the caret is in. Re-measures on scroll/resize and when
// the table node changes (after an append). Appends always go to the table end.
function TableControls({ view, info, t, collapsed, onToggleCollapse }) {
  const tt = mkTt(t);
  const [rect, setRect] = useState(null);
  useEffect(() => {
    if (!view || !info?.el) { setRect(null); return undefined; }
    const measure = () => {
      const r = info.el.getBoundingClientRect();
      if (!r.width && !r.height) { setRect(null); return; }
      setRect({ top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height });
    };
    measure();
    const scroller = view.host?.closest('.overflow-y-auto') || window;
    scroller.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => { scroller.removeEventListener('scroll', measure); window.removeEventListener('resize', measure); };
  }, [view, info?.el, info?.node, collapsed]);
  if (!rect) return null;
  const run = (cmd) => view.chain().focus()[cmd]().run();
  const btn = 'fixed z-[60] flex items-center justify-center rounded-md border shadow-sm transition-colors hover:text-white hover:bg-[var(--accent-primary)] hover:border-[var(--accent-primary)]';
  const style = { background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' };
  const rows = info.node?.content?.length || 0;
  return (
    <>
      {/* collapse / expand chevron in the left gutter */}
      <button type="button" title={collapsed ? tt('notebooks.expand_table', 'Expand table') : tt('notebooks.collapse_table', 'Collapse table')}
        onMouseDown={(e) => { e.preventDefault(); onToggleCollapse?.(); }}
        className={btn} style={{ ...style, top: rect.top + 2, left: rect.left - 26, width: 22, height: 22 }}>
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {collapsed ? (
        <span className="fixed z-[60] px-2 py-0.5 rounded-md border shadow-sm text-[10px] font-medium"
          style={{ ...style, top: rect.top + 2, left: rect.right + 6 }}>
          {tt('notebooks.rows_collapsed', '{n} rows').replace('{n}', String(rows))}
        </span>
      ) : (
        <>
          <button type="button" title={tt('notebooks.add_column', 'Add column')} aria-label={tt('notebooks.add_column', 'Add column')}
            onMouseDown={(e) => { e.preventDefault(); run('appendColumn'); }}
            className={btn} style={{ ...style, top: rect.top + rect.height / 2 - 11, left: rect.right + 4, width: 22, height: 22 }}>
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button type="button" title={tt('notebooks.add_row', 'Add row')} aria-label={tt('notebooks.add_row', 'Add row')}
            onMouseDown={(e) => { e.preventDefault(); run('appendRow'); }}
            className={btn} style={{ ...style, top: rect.bottom + 4, left: rect.left + rect.width / 2 - 11, width: 22, height: 22 }}>
            <Plus className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </>
  );
}

/* ── collapse persistence (view-only; never serialized) ──── */
function loadCollapsed(notebookId) {
  try { return new Set(JSON.parse(localStorage.getItem(`bf.table.collapsed.${notebookId || 'doc'}`) || '[]')); }
  catch (e) { return new Set(); }
}
function saveCollapsed(notebookId, set) {
  try { localStorage.setItem(`bf.table.collapsed.${notebookId || 'doc'}`, JSON.stringify([...set])); }
  catch (e) { /* noop */ }
}

/* ── hooks & helpers ────────────────────────────────────── */
function useNodeRect(view, node) {
  const [rect, setRect] = useState(null);
  useEffect(() => {
    if (!view) return undefined;
    const update = () => {
      const el = view.domForNode.get(node);
      if (el) { const r = el.getBoundingClientRect(); setRect({ top: r.top, left: r.left + 8 }); }
    };
    update();
    // Keep the bubble glued to the image while the document scrolls / resizes.
    const scroller = view.host?.closest('.overflow-y-auto') || window;
    scroller.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { scroller.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [view, node]);
  return rect;
}

function selectionText(view) {
  if (!view) return '';
  const sel = view.state.selection;
  if (sel.type !== 'text') return '';
  const dsel = window.getSelection();
  return dsel ? dsel.toString() : '';
}

function countWords(text) { return text.trim() ? text.trim().split(/\s+/).length : 0; }

function updateToc(view, onTocUpdate) {
  if (!onTocUpdate) return;
  const items = [];
  let idx = 0;
  (view.state.doc.content || []).forEach((n) => {
    if (n.type === 'heading') {
      const text = (n.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
      items.push({ id: `bf-h-${idx}`, level: n.attrs?.level || 1, textContent: text, itemIndex: idx, isActive: false, isScrolledOver: false });
      idx++;
    }
  });
  onTocUpdate(items);
}

export default BeeEditor;

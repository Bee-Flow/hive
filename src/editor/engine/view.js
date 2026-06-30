/**
 * view.js — EditorView: owns the contenteditable host, runs the input loop,
 * dispatches transforms, reconciles the DOM and bridges the browser selection.
 *
 * Design: React renders the chrome + one empty contentEditable host; this class
 * owns the host's children imperatively (React never re-renders the editable
 * subtree) which removes the whole "React fights contenteditable" bug class.
 *
 * NOTE: the input loop is implemented to the plan's design; IME/composition,
 * selection preservation and tables are the known-hard areas flagged for
 * real-browser QA before the feature flag is enabled (see plan risk section).
 */
import { renderDoc } from './render.js';
import { reconcileChildren } from './reconcile.js';
import { posFromDOM, domFromPos } from './dommap.js';
import { applyTransform, firstTextblockPath } from './state.js';
import { normalizeDeep } from './normalize.js';
import { getNode } from './doc.js';
import * as T from './transforms.js';
import * as Tbl from './tables.js';
import { commands } from '../commands/index.js';
import { isActive as qIsActive, getAttributes as qGetAttributes } from './queries.js';
import { createHistory, record, undo as histUndo, redo as histRedo, canUndo, canRedo } from './history.js';
import { textSelection, nodeSelection, cellSelection, pos, isText, isNode, isCell, isCollapsed, selRange, eqSelection } from './selection.js';
import { isCode, isTextblock } from '../model/schema.js';
import { inlineToTokens, tokensToInline } from './inline.js';
import { runInputRules } from './inputRules.js';
import { astToHtml } from '../serialization/astToHtml.js';
import { astToMarkdown } from '../serialization/astToMd.js';
import { selectionToFlat } from './flatpos.js';

const now = () => (typeof Date !== 'undefined' ? Date.now() : 0);

export class EditorView {
  constructor(host, opts = {}) {
    this.host = host;
    this.doc = host.ownerDocument;
    this.contentEl = host;
    this.state = opts.state || { doc: { type: 'doc', content: [] }, selection: textSelection(pos([0], 0)), storedMarks: null };
    this.editable = opts.editable !== false;
    this.onUpdate = opts.onUpdate || (() => {});
    this.onSelectionChange = opts.onSelectionChange || (() => {});
    this.history = createHistory();
    this.nodeToPath = new Map();
    this.domForNode = new WeakMap();
    this.composing = false;
    this.compStartSel = null;
    this.suppressSelectionSync = false;
    this.htmlToAst = opts.htmlToAst || null;
    this.ctx = {
      document: this.doc,
      nodeToPath: this.nodeToPath,
      domForNode: this.domForNode,
      mountAtom: opts.mountAtom || null,
      unmountAtom: opts.unmountAtom || null,
      remapAtom: opts.remapAtom || null,
    };

    host.setAttribute('contenteditable', this.editable ? 'true' : 'false');
    host.setAttribute('role', 'textbox');
    host.setAttribute('aria-multiline', 'true');
    host.setAttribute('spellcheck', 'true');
    host.setAttribute('autocapitalize', 'sentences');
    host.setAttribute('autocorrect', 'on');
    host.classList.add('bf-content');

    this.fullRender();
    this.bind();
    this.installMutationGuard();
  }

  /* ── lifecycle ────────────────────────────────────────── */
  bind() {
    this._onBeforeInput = (e) => this.onBeforeInput(e);
    this._onKeyDown = (e) => this.onKeyDown(e);
    this._onCompStart = () => this.onCompositionStart();
    this._onCompEnd = (e) => this.onCompositionEnd(e);
    this._onPaste = (e) => this.onPaste(e);
    this._onCopy = (e) => this.onCopyCut(e, false);
    this._onCut = (e) => this.onCopyCut(e, true);
    this._onSelChange = () => this.onSelectionChangeEvt();
    this._onChange = (e) => this.onChangeEvt(e);
    this._onDrop = (e) => this.onDrop(e);
    this._onMouseDown = (e) => this.onMouseDown(e);
    this._onHoverMove = (e) => this.onHoverMove(e);
    this.host.addEventListener('drop', this._onDrop);
    this.host.addEventListener('mousedown', this._onMouseDown);
    this.host.addEventListener('mousemove', this._onHoverMove);
    this.host.addEventListener('beforeinput', this._onBeforeInput);
    this.host.addEventListener('keydown', this._onKeyDown);
    this.host.addEventListener('compositionstart', this._onCompStart);
    this.host.addEventListener('compositionend', this._onCompEnd);
    this.host.addEventListener('paste', this._onPaste);
    this.host.addEventListener('copy', this._onCopy);
    this.host.addEventListener('cut', this._onCut);
    this.host.addEventListener('change', this._onChange);
    this.doc.addEventListener('selectionchange', this._onSelChange);
  }

  destroy() {
    this.host.removeEventListener('beforeinput', this._onBeforeInput);
    this.host.removeEventListener('keydown', this._onKeyDown);
    this.host.removeEventListener('compositionstart', this._onCompStart);
    this.host.removeEventListener('compositionend', this._onCompEnd);
    this.host.removeEventListener('paste', this._onPaste);
    this.host.removeEventListener('copy', this._onCopy);
    this.host.removeEventListener('cut', this._onCut);
    this.host.removeEventListener('change', this._onChange);
    this.host.removeEventListener('drop', this._onDrop);
    this.host.removeEventListener('mousedown', this._onMouseDown);
    this.host.removeEventListener('mousemove', this._onHoverMove);
    this.doc.removeEventListener('selectionchange', this._onSelChange);
    if (this.mo) { this.mo.disconnect(); this.mo = null; }
  }

  /* ── untracked-mutation safety net ────────────────────── */
  installMutationGuard() {
    const MO = this.doc.defaultView && this.doc.defaultView.MutationObserver;
    if (!MO) return;
    this.mo = new MO((records) => {
      if (this.composing) return; // IME resyncs itself on compositionend
      // We disconnect the observer around our own DOM writes (applyDOM). Mutations
      // inside atom hosts are React portals rendering — also expected. Anything
      // left is an untracked mutation in the editable flow (drag-drop, extension,
      // browser quirk) that diverged the DOM from the model → restore from model.
      if (!records.some((r) => !this.inAtom(r.target))) return;
      // eslint-disable-next-line no-console
      console.warn('[BeeEditor] untracked DOM mutation — re-syncing from model');
      this.fullRender();
    });
    this.observeDOM();
  }

  inAtom(node) {
    let n = node;
    while (n && n !== this.host) {
      if (n.nodeType === 1 && n.getAttribute && n.getAttribute('data-bf-atom') != null) return true;
      n = n.parentNode;
    }
    return false;
  }

  observeDOM() {
    if (this.mo) this.mo.observe(this.host, { childList: true, characterData: true, subtree: true });
  }

  /** Run a DOM-mutating fn without the MutationObserver treating it as untracked. */
  applyDOM(fn) {
    if (this.mo) this.mo.disconnect();
    try { fn(); } finally { if (this.mo) { this.mo.takeRecords(); this.observeDOM(); } }
  }

  setEditable(v) {
    this.editable = v;
    this.host.setAttribute('contenteditable', v ? 'true' : 'false');
  }

  /* ── rendering ────────────────────────────────────────── */
  fullRender() {
    this.rebuildPaths(this.state.doc);
    this.applyDOM(() => {
      // Unmount existing atom hosts before clearing.
      if (this.ctx.unmountAtom) this.host.querySelectorAll('[data-bf-atom]').forEach((a) => a.__bfAtomNode && this.ctx.unmountAtom(a));
      this.host.textContent = '';
      this.host.appendChild(renderDoc(this.state.doc, this.ctx));
    });
    this.writeSelection();
  }

  rebuildPaths(doc) {
    this.nodeToPath.clear();
    const walk = (n, p) => {
      this.nodeToPath.set(n, p);
      if (isTextblock(n.type) || n.type === 'text') return;
      (n.content || []).forEach((c, i) => { if (c.type !== 'text') walk(c, [...p, i]); });
    };
    (doc.content || []).forEach((c, i) => walk(c, [i]));
  }

  reconcile(oldDoc, newDoc) {
    this.rebuildPaths(newDoc);
    // Incremental, identity-aware patch (see reconcile.js): only the differing
    // blocks are touched, and a changed textblock keeps its caret text node.
    this.applyDOM(() => reconcileChildren(this.contentEl, oldDoc.content || [], newDoc.content || [], this.ctx, []));
  }

  /* ── dispatch ─────────────────────────────────────────── */
  dispatch(fn, { kind = 'other' } = {}) {
    const prev = this.state;
    const next = applyTransform(prev, fn);
    if (next.doc === prev.doc) {
      // selection / storedMarks only — no history, no DOM reconcile
      this.state = next;
      if (!eqSelection(next.selection, prev.selection)) this.writeSelection();
      try { this.onSelectionChange(this.state); } catch (e) { /* noop */ }
      return false;
    }
    record(this.history, prev, kind, now());
    this.state = next;
    this.reconcile(prev.doc, next.doc);
    this.writeSelection();
    this.emitChange();
    return true;
  }

  emitChange() { try { this.onUpdate(); } catch (e) { /* noop */ } }

  /* ── selection bridge ─────────────────────────────────── */
  writeSelection() {
    const sel = this.state.selection;
    const win = this.doc.defaultView;
    const dsel = win.getSelection();
    if (!dsel) return;
    // Suppress the selectionchange our own write triggers, releasing on the next
    // microtask: long enough to ignore the self-write, short enough not to swallow
    // a real user selection in the same frame (an rAF window would).
    this.suppressSelectionSync = true;
    Promise.resolve().then(() => { this.suppressSelectionSync = false; });
    try {
      if (isNode(sel)) {
        const el = this.domForNode.get(getNode(this.state.doc, sel.path));
        if (el) { const r = this.doc.createRange(); r.selectNode(el); dsel.removeAllRanges(); dsel.addRange(r); }
      } else if (isCell(sel)) {
        // Collapse the caret into the anchor cell; the rectangle is shown via .selectedCell.
        const a = domFromPos(this.domForNode, this.state.doc, pos([...sel.anchorCell, 0], 0));
        if (a) { const r = this.doc.createRange(); r.setStart(a.node, a.offset); r.collapse(true); dsel.removeAllRanges(); dsel.addRange(r); }
      } else {
        const { from, to } = selRange(sel);
        const a = domFromPos(this.domForNode, this.state.doc, from);
        const b = domFromPos(this.domForNode, this.state.doc, to);
        if (a && b) { const r = this.doc.createRange(); r.setStart(a.node, a.offset); r.setEnd(b.node, b.offset); dsel.removeAllRanges(); dsel.addRange(r); }
      }
    } catch (e) { /* selection write can race the DOM; ignore */ }
    this.paintCellSelection();
  }

  /** Apply / clear the .selectedCell highlight for a cell-rectangle selection.
   *  Class (attribute) mutations are not observed by the MutationObserver, so this
   *  never trips the untracked-mutation safety net. */
  paintCellSelection() {
    if (!this.host || !this.host.querySelectorAll) return;
    this.host.querySelectorAll('.selectedCell').forEach((c) => c.classList.remove('selectedCell'));
    const sel = this.state.selection;
    if (!isCell(sel)) return;
    const rect = Tbl.cellRect(this.state.doc, sel);
    if (!rect) return;
    for (const cellPath of rect.cells) {
      const el = this.domForNode.get(getNode(this.state.doc, cellPath));
      if (el) el.classList.add('selectedCell');
    }
  }

  syncSelectionFromDOM() {
    const win = this.doc.defaultView;
    const dsel = win.getSelection();
    if (!dsel || dsel.rangeCount === 0) return;
    if (!this.contentEl.contains(dsel.anchorNode)) return;
    const anchor = posFromDOM(this.contentEl, dsel.anchorNode, dsel.anchorOffset, this.nodeToPath);
    const head = posFromDOM(this.contentEl, dsel.focusNode, dsel.focusOffset, this.nodeToPath);
    if (!anchor) return;
    if (anchor.atom) { this.state = { ...this.state, selection: nodeSelection(anchor.path), storedMarks: null }; return; }
    if (!head) return;
    this.state = {
      ...this.state,
      selection: textSelection(pos(anchor.path, anchor.offset), head.atom ? pos(anchor.path, anchor.offset) : pos(head.path, head.offset)),
      storedMarks: this.state.storedMarks,
    };
  }

  onSelectionChangeEvt() {
    // Never touch the model from a DOM selection mid-composition or mid cell-drag:
    // the DOM holds transient state (IME text, native drag highlight) not in the model.
    if (this.suppressSelectionSync || this.composing || this.cellDragging) return;
    const win = this.doc.defaultView;
    const dsel = win.getSelection();
    if (!dsel || dsel.rangeCount === 0 || !this.contentEl.contains(dsel.anchorNode)) return;
    this.syncSelectionFromDOM();
    this.paintCellSelection(); // clears stale cell highlight when the caret moves out
    try { this.onSelectionChange(this.state); } catch (e) { /* noop */ }
  }

  /* ── input handling ───────────────────────────────────── */
  onBeforeInput(e) {
    if (this.composing) return;
    if (isCell(this.state.selection)) return this.onBeforeInputCell(e);
    const it = e.inputType;
    let fn = null;
    let kind = 'other';
    switch (it) {
      case 'insertText': { const data = e.data || ''; fn = (s) => { const ns = T.insertText(s, data); return runInputRules(ns, data) || ns; }; kind = 'type'; break; }
      case 'insertReplacementText': fn = (s) => T.insertText(s, e.data || ''); kind = 'type'; break;
      case 'deleteContentBackward': case 'deleteWordBackward': case 'deleteContentBackwardWord':
        fn = T.deleteBackward; kind = 'delete'; break;
      case 'deleteContentForward': case 'deleteWordForward':
        fn = T.deleteForward; kind = 'delete'; break;
      case 'deleteByCut': case 'deleteContent': fn = T.deleteSelection; kind = 'delete'; break;
      case 'formatBold': fn = (s) => T.toggleMark(s, 'bold'); kind = 'format'; break;
      case 'formatItalic': fn = (s) => T.toggleMark(s, 'italic'); kind = 'format'; break;
      case 'formatUnderline': fn = (s) => T.toggleMark(s, 'underline'); kind = 'format'; break;
      case 'formatStrikeThrough': fn = (s) => T.toggleMark(s, 'strike'); kind = 'format'; break;
      case 'historyUndo': e.preventDefault(); this.undo(); return;
      case 'historyRedo': e.preventDefault(); this.redo(); return;
      // Split / line-break can also arrive without a keydown (voice, some mobile
      // IMEs), so handle them here too rather than only in onKeyDown.
      case 'insertParagraph': e.preventDefault(); this.enter(false); return;
      case 'insertLineBreak': e.preventDefault(); this.enter(true); return;
      case 'insertFromPaste': case 'insertFromDrop': return; // handled by paste/drop listeners
      default: return;
    }
    e.preventDefault();
    this.syncSelectionFromDOM();
    this.dispatch(fn, { kind });
  }

  // Input while a cell rectangle is selected: delete clears the cells; typing
  // clears them then drops the caret into the anchor cell and inserts.
  onBeforeInputCell(e) {
    const it = e.inputType || '';
    e.preventDefault();
    const anchor = this.state.selection.anchorCell;
    if (it.startsWith('delete')) return this.dispatch((s) => Tbl.clearCells(s), { kind: 'delete' });
    if (it === 'insertText') {
      this.dispatch((s) => Tbl.clearCells(s), { kind: 'delete' });
      this.state = { ...this.state, selection: textSelection(pos([...anchor, 0], 0)) };
      if (e.data) this.dispatch((s) => T.insertText(s, e.data), { kind: 'type' });
    }
  }

  collapseCellSelection() {
    if (!isCell(this.state.selection)) return;
    this.state = { ...this.state, selection: textSelection(pos([...this.state.selection.anchorCell, 0], 0)) };
    this.writeSelection();
    try { this.onSelectionChange(this.state); } catch (e) { /* noop */ }
  }

  onKeyDown(e) {
    if (isCell(this.state.selection)) {
      if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); return this.dispatch((s) => Tbl.clearCells(s), { kind: 'delete' }); }
      if (e.key === 'Escape') { e.preventDefault(); return this.collapseCellSelection(); }
    }
    const mod = e.metaKey || e.ctrlKey;
    if (mod && !e.altKey) {
      const k = e.key.toLowerCase();
      const m = (type) => { e.preventDefault(); this.syncSelectionFromDOM(); this.dispatch((s) => T.toggleMark(s, type), { kind: 'format' }); };
      if (k === 'b') return m('bold');
      if (k === 'i') return m('italic');
      if (k === 'u') return m('underline');
      if (k === 'z') { e.preventDefault(); return e.shiftKey ? this.redo() : this.undo(); }
      if (k === 'y') { e.preventDefault(); return this.redo(); }
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      return this.enter(e.shiftKey);
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      this.syncSelectionFromDOM();
      if (Tbl.inTable(this.state)) return this.dispatch((s) => Tbl.goToCell(s, e.shiftKey ? -1 : 1), { kind: 'structural' });
      if (this.inListItem()) return this.dispatch(e.shiftKey ? T.liftListItem : T.sinkListItem, { kind: 'structural' });
      return this.dispatch((s) => T.insertText(s, '  '), { kind: 'type' });
    }
  }

  /* ── table cell selection + column resize (mouse) ─────── */
  cellElFromPoint(target) {
    let n = target;
    while (n && n !== this.host) {
      if (n.nodeType === 1 && (n.tagName === 'TD' || n.tagName === 'TH') && n.__bfNode) return n;
      n = n.parentNode;
    }
    return null;
  }

  cellPathOfSelection() {
    const sel = this.state.selection;
    const path = isText(sel) ? sel.anchor.path : isCell(sel) ? sel.anchorCell : null;
    if (!path) return null;
    const ctx = Tbl.tableContext(this.state.doc, path);
    return ctx ? [...ctx.tablePath, ctx.rowIdx, ctx.cellIdx] : null;
  }

  setCellSelection(anchorCell, headCell) {
    const sel = cellSelection(anchorCell, headCell);
    if (!Tbl.cellRect(this.state.doc, sel)) return; // not a valid same-table rectangle
    this.state = { ...this.state, selection: sel, storedMarks: null };
    this.writeSelection();
    try { this.onSelectionChange(this.state); } catch (e) { /* noop */ }
  }

  onHoverMove(e) {
    if (this.cellDragging || this._resizing) return;
    const cell = this.cellElFromPoint(e.target);
    let resize = false;
    if (cell) { const r = cell.getBoundingClientRect(); resize = (r.right - e.clientX <= 6 && r.right - e.clientX >= 0); }
    this.host.style.cursor = resize ? 'col-resize' : '';
  }

  onMouseDown(e) {
    if (e.button !== 0) return;
    const cell = this.cellElFromPoint(e.target);
    if (!cell) {
      if (isCell(this.state.selection)) { this.state = { ...this.state, selection: textSelection(pos([...this.state.selection.anchorCell, 0], 0)) }; this.paintCellSelection(); }
      return;
    }
    const cellPath = this.nodeToPath.get(cell.__bfNode);
    if (!cellPath) return;
    const r = cell.getBoundingClientRect();
    if (r.right - e.clientX <= 6 && r.right - e.clientX >= 0) { e.preventDefault(); this.startColumnResize(e, cellPath); return; }
    if (e.shiftKey) {
      const anchor = isCell(this.state.selection) ? this.state.selection.anchorCell : this.cellPathOfSelection();
      if (anchor && anchor.join() !== cellPath.join()) { e.preventDefault(); this.setCellSelection(anchor, cellPath); return; }
    }
    this.beginCellDrag(cellPath);
  }

  beginCellDrag(anchorPath) {
    const onMove = (ev) => {
      const target = this.doc.elementFromPoint ? this.doc.elementFromPoint(ev.clientX, ev.clientY) : null;
      const overEl = this.cellElFromPoint(target);
      if (!overEl) return;
      const headPath = this.nodeToPath.get(overEl.__bfNode);
      if (!headPath) return;
      if (headPath.join() === anchorPath.join()) {
        // back in the anchor cell → let native text selection take over
        if (isCell(this.state.selection)) { this.state = { ...this.state, selection: textSelection(pos([...anchorPath, 0], 0)) }; this.paintCellSelection(); }
        this.cellDragging = false;
        return;
      }
      ev.preventDefault();
      this.cellDragging = true;
      const win = this.doc.defaultView; const dsel = win && win.getSelection();
      if (dsel) dsel.removeAllRanges(); // kill the native cross-cell text highlight
      this.setCellSelection(anchorPath, headPath);
    };
    const onUp = () => {
      this.doc.removeEventListener('mousemove', onMove);
      this.doc.removeEventListener('mouseup', onUp);
      this.cellDragging = false;
    };
    this.doc.addEventListener('mousemove', onMove);
    this.doc.addEventListener('mouseup', onUp);
  }

  startColumnResize(e, cellPath) {
    const ctx = Tbl.tableContext(this.state.doc, cellPath);
    if (!ctx) return;
    const colIdx = ctx.cellIdx;
    const cellEl = this.domForNode.get(getNode(this.state.doc, cellPath));
    const startX = e.clientX;
    const startW = cellEl ? cellEl.getBoundingClientRect().width : 120;
    this._resizing = true;
    const width = (ev) => Math.max(40, Math.round(startW + (ev.clientX - startX)));
    const onMove = (ev) => { if (cellEl) cellEl.style.width = `${width(ev)}px`; }; // live preview (attr, not observed)
    const onUp = (ev) => {
      this.doc.removeEventListener('mousemove', onMove);
      this.doc.removeEventListener('mouseup', onUp);
      this._resizing = false;
      this.host.style.cursor = '';
      this.state = { ...this.state, selection: textSelection(pos([...cellPath, 0], 0)) };
      this.dispatch((s) => Tbl.setColumnWidth(s, colIdx, width(ev)), { kind: 'structural' });
    };
    this.doc.addEventListener('mousemove', onMove);
    this.doc.addEventListener('mouseup', onUp);
  }

  // Block split / line break (from Enter keydown or an insertParagraph beforeinput).
  enter(shift) {
    this.syncSelectionFromDOM();
    if (shift) return this.dispatch(T.insertHardBreak, { kind: 'type' });
    const block = this.currentBlock();
    if (block && isCode(block.type)) return this.dispatch((s) => T.insertText(s, '\n'), { kind: 'type' });
    if (this.isEmptyListItem()) return this.dispatch(T.liftListItem, { kind: 'structural' });
    // Keep table cells single-paragraph (GFM cells are inline-only): Enter is a
    // line break, not a block split.
    if (this.inTableCell()) return this.dispatch(T.insertHardBreak, { kind: 'type' });
    return this.dispatch(T.splitBlock, { kind: 'structural' });
  }

  inTableCell() {
    const sel = this.state.selection;
    if (!isText(sel) || sel.anchor.path.length < 1) return false;
    const parent = getNode(this.state.doc, sel.anchor.path.slice(0, -1));
    return !!parent && parent.type === 'tableCell';
  }

  // Text drop. Image drops are intercepted by the React layer (capture phase); a
  // plain-text drop reaches here — handle it through the model so the browser
  // never performs an untracked DOM insertion.
  onDrop(e) {
    const dt = e.dataTransfer;
    const text = dt && dt.getData && dt.getData('text/plain');
    if (!text) return;
    e.preventDefault();
    const win = this.doc.defaultView;
    const range = this.doc.caretRangeFromPoint ? this.doc.caretRangeFromPoint(e.clientX, e.clientY) : null;
    if (range && win) { const dsel = win.getSelection(); dsel.removeAllRanges(); dsel.addRange(range); }
    this.syncSelectionFromDOM();
    this.dispatch((s) => commands.insertContent(text)(s), { kind: 'type' });
  }

  // Task-list checkbox toggle. The checkbox is rendered imperatively (not React),
  // so we catch its native change here and flip the taskItem's `checked` attr.
  onChangeEvt(e) {
    const box = e.target;
    if (!box || !box.getAttribute || box.getAttribute('data-bf-checkbox') == null) return;
    const li = box.closest && box.closest('[data-bf-block]');
    if (!li || !li.__bfNode) return;
    const path = this.nodeToPath.get(li.__bfNode);
    if (!path) return;
    const checked = !li.__bfNode.attrs?.checked; // toggle the model value, not the DOM
    this.dispatch((s) => T.updateNodeAttrsAtPath(s, path, { checked }), { kind: 'structural' });
  }

  onCompositionStart() {
    this.syncSelectionFromDOM();
    this.composing = true;
    this.compStartSel = this.state.selection;
    this.compStartStored = this.state.storedMarks; // keep bold/italic etc. across IME
  }

  onCompositionEnd(e) {
    this.composing = false;
    const data = e.data || '';
    // The browser mutated the DOM in place while composing. Restore the model
    // selection + stored marks to the pre-composition point, then apply the
    // committed string as one transaction so the DOM is reconciled to the model.
    this.state = { ...this.state, selection: this.compStartSel || this.state.selection, storedMarks: this.compStartStored || null };
    if (data) {
      this.dispatch((s) => T.insertText(s, data), { kind: 'type' });
    } else {
      // Cancelled composition: the doc is unchanged, so reconcile is a no-op and
      // can't undo any stray DOM the IME left behind — re-render from the model.
      this.fullRender();
    }
    this.compStartStored = null;
  }

  onPaste(e) {
    e.preventDefault();
    const cd = e.clipboardData;
    if (!cd) return;
    this.syncSelectionFromDOM();
    const md = cd.getData('text/plain');
    const html = cd.getData('text/html');
    // The React layer can intercept image paste before this fires; here we handle text.
    if (html && this.htmlToAst) {
      const ast = this.htmlToAst(html);
      this.dispatch((s) => T.insertBlocks(s, ast.content || []), { kind: 'type' });
    } else if (md) {
      this.dispatch((s) => commands.insertContent(md)(s), { kind: 'type' });
    }
  }

  onCopyCut(e, isCut) {
    const sel = this.state.selection;
    // Cell rectangle → clean pipe/tab plaintext (never raw HTML on text/plain — BFSF-167).
    if (isCell(sel)) {
      const rect = Tbl.cellRect(this.state.doc, sel);
      if (!rect) return;
      e.preventDefault();
      e.clipboardData.setData('text/plain', Tbl.cellRectToText(this.state.doc, rect));
      if (isCut) this.dispatch((s) => Tbl.clearCells(s), { kind: 'delete' });
      return;
    }
    if (!isText(sel) || isCollapsed(sel)) return;
    e.preventDefault();
    const { from, to } = selRange(sel);
    let text = '';
    if (from.path.join() === to.path.join()) {
      const slice = inlineToTokens(getNode(this.state.doc, from.path).content).slice(from.offset, to.offset);
      text = slice.map((t) => (t.node ? (t.node.type === 'hardBreak' ? '\n' : '') : t.ch)).join('');
      // Rich copy (TipTap parity): emit the marked-up slice as HTML too.
      try { e.clipboardData.setData('text/html', astToHtml({ type: 'doc', content: [{ type: 'paragraph', content: tokensToInline(slice) }] })); } catch (err) { /* noop */ }
    } else {
      text = this.getText();
    }
    e.clipboardData.setData('text/plain', text);
    if (isCut) this.dispatch(T.deleteSelection, { kind: 'delete' });
  }

  /* ── history ──────────────────────────────────────────── */
  undo() {
    const prev = histUndo(this.history, this.state);
    if (!prev) return;
    const old = this.state; this.state = prev;
    this.reconcile(old.doc, prev.doc); this.writeSelection(); this.emitChange();
  }
  redo() {
    const next = histRedo(this.history, this.state);
    if (!next) return;
    const old = this.state; this.state = next;
    this.reconcile(old.doc, next.doc); this.writeSelection(); this.emitChange();
  }

  /* ── atom node-view bridge ────────────────────────────── */
  updateAtom(node, attrs) {
    const path = this.nodeToPath.get(node);
    if (!path) return;
    this.dispatch((s) => T.updateNodeAttrsAtPath(s, path, attrs), { kind: 'structural' });
  }
  selectAtom(node) {
    const path = this.nodeToPath.get(node);
    if (!path) return;
    this.state = { ...this.state, selection: nodeSelection(path), storedMarks: null };
    this.writeSelection();
    try { this.onSelectionChange(this.state); } catch (e) { /* noop */ }
  }
  deleteAtom(node) {
    const path = this.nodeToPath.get(node);
    if (!path) return;
    this.dispatch((s) => T.deleteSelection({ ...s, selection: nodeSelection(path) }), { kind: 'delete' });
  }

  /* ── public API (facade backing) ──────────────────────── */
  focus() { try { this.host.focus(); } catch (e) { /* noop */ } this.writeSelection(); }

  setDoc(doc, { emitUpdate = true } = {}) {
    this.state = { doc: normalizeDeep(doc), selection: textSelection(pos(firstTextblockPath(normalizeDeep(doc)), 0)), storedMarks: null };
    this.fullRender();
    if (emitUpdate) this.emitChange();
  }

  isActive(name, attrs) { return qIsActive(this.state, name, attrs); }
  getAttributes(name) { return qGetAttributes(this.state, name); }
  getSelectedNode() { const sel = this.state.selection; return isNode(sel) ? getNode(this.state.doc, sel.path) : null; }
  // The table containing the current selection (+ its DOM element), or null.
  // Powers the on-hover add-row/add-column controls.
  tableInfo() {
    const sel = this.state.selection;
    const path = isText(sel) ? sel.anchor.path : isNode(sel) ? sel.path : isCell(sel) ? sel.anchorCell : null;
    if (!path) return null;
    const ctx = Tbl.tableContext(this.state.doc, path);
    if (!ctx) return null;
    const node = getNode(this.state.doc, ctx.tablePath);
    const el = this.domForNode.get(node);
    if (!el) return null;
    // ordinal = index among all tables in document order (stable collapse key).
    const target = ctx.tablePath.join(',');
    let ordinal = 0; let found = false;
    const walk = (n, p) => {
      if (found) return;
      if (n.type === 'table') { if (p.join(',') === target) found = true; else ordinal++; return; }
      (n.content || []).forEach((c, i) => walk(c, [...p, i]));
    };
    walk(this.state.doc, []);
    return { el, node, path: ctx.tablePath, ordinal };
  }
  // All tables in document order with their DOM elements (for collapse toggling).
  allTables() {
    const out = []; let ordinal = 0;
    const walk = (n, p) => {
      if (n.type === 'table') { out.push({ el: this.domForNode.get(n), ordinal }); ordinal++; return; }
      (n.content || []).forEach((c, i) => walk(c, [...p, i]));
    };
    walk(this.state.doc, []);
    return out;
  }
  selectionFlat() { return selectionToFlat(this.state.doc, this.state.selection); }
  can() { return { undo: () => canUndo(this.history), redo: () => canRedo(this.history) }; }

  getHTML() { return astToHtml(this.state.doc); }
  getMarkdown() { return astToMarkdown(this.state.doc); }
  getText() {
    const out = [];
    const walk = (n) => {
      if (isTextblock(n.type)) { out.push(inlineToTokens(n.content).filter((t) => !t.node).map((t) => t.ch).join('')); return; }
      (n.content || []).forEach(walk);
    };
    (this.state.doc.content || []).forEach(walk);
    return out.join('\n');
  }

  chain() {
    const ops = [];
    const proxy = new Proxy({}, {
      get: (_t, prop) => {
        if (prop === 'run') return () => { this.runChain(ops); return true; };
        return (...args) => { ops.push([prop, args]); return proxy; };
      },
    });
    return proxy;
  }

  runChain(ops) {
    const fns = [];
    let kind = 'other';
    for (const [name, args] of ops) {
      if (name === 'focus') { this.focus(); continue; }
      if (name === 'undo') { this.undo(); return; }
      if (name === 'redo') { this.redo(); return; }
      const factory = commands[name];
      if (factory) {
        fns.push(factory(...args));
        if (name.startsWith('insert') || name === 'insertText') kind = 'type';
      }
    }
    if (fns.length) this.dispatch((s) => fns.reduce((acc, f) => f(acc) || acc, s), { kind });
  }

  /* ── helpers ──────────────────────────────────────────── */
  currentBlock() {
    const sel = this.state.selection;
    const path = isText(sel) ? sel.anchor.path : isNode(sel) ? sel.path : null;
    return path ? getNode(this.state.doc, path) : null;
  }
  inListItem() {
    const sel = this.state.selection;
    if (!isText(sel)) return false;
    const pPath = sel.anchor.path.slice(0, -1);
    if (!pPath.length) return false;
    const parent = getNode(this.state.doc, pPath);
    return parent.type === 'listItem' || parent.type === 'taskItem';
  }
  isEmptyListItem() {
    if (!this.inListItem()) return false;
    const block = this.currentBlock();
    return block && isTextblock(block.type) && inlineToTokens(block.content).length === 0;
  }
}

export function createView(host, opts) { return new EditorView(host, opts); }

/**
 * render.js — AST → contenteditable DOM.
 *
 * Each block element gets `el.__bfNode = node` (identity link) and is recorded in
 * the view's nodeToPath / domForNode maps so selection mapping (dommap.js) never
 * has to count sibling indices through wrapper elements like <tbody>.
 *
 * Atom blocks/inlines (image, mermaid, math, hr) render as contenteditable=false
 * void hosts; ctx.mountAtom(node, hostEl) lets the React layer portal a component
 * into them. In a plain-DOM context (tests) mountAtom may be omitted.
 */
import { markDefaults } from '../model/schema.js';
import { escapeAttr, encodeForAttr, safeUrl } from '../serialization/util.js';

export function renderDoc(doc, ctx) {
  const frag = ctx.document.createDocumentFragment();
  (doc.content || []).forEach((b, i) => frag.appendChild(renderBlock(b, ctx, [i])));
  return frag;
}

export function renderBlock(node, ctx, path) {
  const el = createBlockEl(node, ctx, path);
  el.__bfNode = node;
  el.setAttribute('data-bf-block', node.type);
  ctx.nodeToPath && ctx.nodeToPath.set(node, path);
  ctx.domForNode && ctx.domForNode.set(node, el);
  return el;
}

function createBlockEl(node, ctx, path) {
  const d = ctx.document;
  const a = (n) => node.attrs?.[n] ?? null;
  let el;
  switch (node.type) {
    case 'paragraph':
      el = d.createElement('p');
      applyAlign(el, a('align'));
      renderInline(el, node.content, ctx);
      break;
    case 'heading':
      el = d.createElement('h' + (a('level') || 1));
      applyAlign(el, a('align'));
      renderInline(el, node.content, ctx);
      break;
    case 'bulletList':
      el = d.createElement('ul');
      renderChildBlocks(el, node, ctx, path);
      break;
    case 'orderedList':
      el = d.createElement('ol');
      if (a('start') && a('start') !== 1) el.setAttribute('start', a('start'));
      renderChildBlocks(el, node, ctx, path);
      break;
    case 'taskList':
      el = d.createElement('ul');
      el.setAttribute('data-type', 'taskList');
      renderChildBlocks(el, node, ctx, path);
      break;
    case 'listItem':
      el = d.createElement('li');
      renderChildBlocks(el, node, ctx, path);
      break;
    case 'taskItem': {
      el = d.createElement('li');
      el.setAttribute('data-type', 'taskItem');
      el.setAttribute('data-checked', a('checked') ? 'true' : 'false');
      const label = d.createElement('label');
      label.setAttribute('contenteditable', 'false');
      const box = d.createElement('input');
      box.type = 'checkbox';
      box.checked = !!a('checked');
      box.setAttribute('data-bf-checkbox', '');
      label.appendChild(box);
      el.appendChild(label);
      const wrap = d.createElement('div');
      renderChildBlocks(wrap, node, ctx, path);
      el.appendChild(wrap);
      break;
    }
    case 'blockquote':
      el = d.createElement('blockquote');
      renderChildBlocks(el, node, ctx, path);
      break;
    case 'codeBlock': {
      el = d.createElement('pre');
      el.className = 'notebook-code-block';
      const code = d.createElement('code');
      if (a('language')) code.className = 'language-' + a('language');
      code.textContent = (node.content || []).map((c) => c.text || '').join('') || '​';
      el.appendChild(code);
      break;
    }
    case 'horizontalRule':
      el = d.createElement('hr');
      el.setAttribute('data-bf-atom', '');
      el.setAttribute('contenteditable', 'false');
      break;
    case 'table': {
      el = d.createElement('table');
      const tbody = d.createElement('tbody');
      (node.content || []).forEach((row, i) => tbody.appendChild(renderBlock(row, ctx, [...path, i])));
      el.appendChild(tbody);
      break;
    }
    case 'tableRow':
      el = d.createElement('tr');
      renderChildBlocks(el, node, ctx, path);
      break;
    case 'tableCell': {
      el = d.createElement(a('header') ? 'th' : 'td');
      if (a('align')) el.style.textAlign = a('align');
      if (a('colspan') && a('colspan') !== 1) el.setAttribute('colspan', a('colspan'));
      if (a('rowspan') && a('rowspan') !== 1) el.setAttribute('rowspan', a('rowspan'));
      if (a('colwidth')) el.style.width = `${a('colwidth')}px`;
      renderChildBlocks(el, node, ctx, path);
      break;
    }
    case 'image':
    case 'mermaid':
    case 'mathBlock':
    case 'chart':
      el = createAtomHost(node, ctx, false);
      break;
    default:
      el = d.createElement('div');
      renderInline(el, node.content || [], ctx);
  }
  // Empty textblock needs a filler <br> so it has height & is focusable. The
  // filler carries data-bf-filler so selection mapping ignores it (unlike a real
  // hardBreak <br>, which is a token).
  if ((node.type === 'paragraph' || node.type === 'heading') && (!node.content || node.content.length === 0)) {
    const br = d.createElement('br');
    br.setAttribute('data-bf-filler', '');
    el.appendChild(br);
  }
  return el;
}

function renderChildBlocks(el, node, ctx, path) {
  (node.content || []).forEach((child, i) => el.appendChild(renderBlock(child, ctx, [...path, i])));
}

function createAtomHost(node, ctx, inline) {
  const d = ctx.document;
  const host = d.createElement(inline ? 'span' : 'div');
  host.setAttribute('data-bf-atom', node.type);
  host.setAttribute('contenteditable', 'false');
  host.__bfInlineAtom = !!inline;
  // Identity attributes always go on the host — they cost nothing and keep the
  // DOM inspectable/parseable.
  if (node.type === 'mermaid') host.setAttribute('data-code', encodeForAttr(node.attrs?.code || ''));
  else if (node.type === 'mathBlock' || node.type === 'mathInline') host.setAttribute('data-latex', escapeAttr(node.attrs?.latex || ''));
  else if (node.type === 'formula') host.setAttribute('data-formula', escapeAttr(node.attrs?.src || ''));
  else if (node.type === 'chart') host.setAttribute('data-spec', encodeForAttr(node.attrs?.spec || ''));

  // Fallback CHILDREN, so the host is meaningful without React (export, tests).
  // Only when no portal will mount: createPortal appends and never clears its
  // container, so emitting these alongside a portal renders the atom TWICE.
  // That was the duplicate image (BFSF-312) and the "$formula$ formula" double
  // placeholder (BFSF-317) — and only the portal copy carried the selection and
  // resize handlers, which is exactly why just one of the two was editable.
  if (!ctx.mountAtom) {
    if (node.type === 'image') {
      const img = d.createElement('img');
      img.src = safeUrl(node.attrs?.src || '') || '';
      img.alt = node.attrs?.alt || '';
      if (node.attrs?.width) img.style.width = node.attrs.width + 'px';
      img.className = 'notebook-image';
      host.appendChild(img);
    } else if (node.type === 'mathBlock' || node.type === 'mathInline') {
      host.textContent = (inline ? '$' : '$$') + (node.attrs?.latex || '') + (inline ? '$' : '$$');
    } else if (node.type === 'formula') {
      host.textContent = node.attrs?.value || node.attrs?.src || '';
    }
    return host;
  }
  ctx.mountAtom(node, host);
  return host;
}

/**
 * Update an atom host's fallback markup to match new attrs, in place. The live
 * React portal (when mounted) owns the host's children and re-renders via
 * ctx.remapAtom; this keeps the non-React fallback (export / tests) correct too.
 */
export function updateAtomHost(host, node) {
  // A host with a live portal is owned by React: writing to its children here
  // (textContent = …) removes React-rendered DOM while React still believes it
  // is mounted — it destroyed the formula's open <input> on every reconcile.
  // Attributes are safe; children are not.
  const reactOwned = !!host.__bfAtomId;
  if (node.type === 'image') {
    const img = !reactOwned && host.querySelector ? host.querySelector('img') : null;
    if (img) {
      img.src = node.attrs?.src || '';
      img.alt = node.attrs?.alt || '';
      if (node.attrs?.width) img.style.width = node.attrs.width + 'px';
      else img.style.removeProperty('width');
    }
  } else if (node.type === 'mermaid') {
    host.setAttribute('data-code', encodeForAttr(node.attrs?.code || ''));
  } else if (node.type === 'mathBlock' || node.type === 'mathInline') {
    host.setAttribute('data-latex', escapeAttr(node.attrs?.latex || ''));
    if (!reactOwned) host.textContent = (host.__bfInlineAtom ? '$' : '$$') + (node.attrs?.latex || '') + (host.__bfInlineAtom ? '$' : '$$');
  } else if (node.type === 'formula') {
    host.setAttribute('data-formula', escapeAttr(node.attrs?.src || ''));
    if (!reactOwned) host.textContent = node.attrs?.value || node.attrs?.src || '';
  } else if (node.type === 'chart') {
    host.setAttribute('data-spec', encodeForAttr(node.attrs?.spec || ''));
  }
}

/* ── Inline ─────────────────────────────────────────────── */

function renderInline(el, content = [], ctx) {
  for (const n of content) el.appendChild(renderInlineNode(n, ctx));
}

export function renderInlineNode(n, ctx) {
  const d = ctx.document;
  if (n.type === 'hardBreak') return d.createElement('br');
  if (n.type === 'mathInline') return createAtomHost(n, ctx, true);
  if (n.type === 'formula') return createAtomHost(n, ctx, true);
  if (n.type === 'image') return createAtomHost(n, ctx, true);
  // text with marks → nested wrappers, innermost = text node
  let domNode = d.createTextNode(n.text);
  const marks = n.marks || [];
  for (const m of [...marks].reverse()) domNode = wrapMarkEl(domNode, m, d);
  return domNode;
}

function wrapMarkEl(inner, m, d) {
  let el;
  switch (m.type) {
    case 'code': el = d.createElement('code'); break;
    case 'strike': el = d.createElement('s'); break;
    case 'italic': el = d.createElement('em'); break;
    case 'bold': el = d.createElement('strong'); break;
    case 'underline': el = d.createElement('u'); break;
    case 'textStyle':
      el = d.createElement('span');
      if (m.attrs?.color) el.style.color = m.attrs.color;
      if (m.attrs?.fontFamily) el.style.fontFamily = m.attrs.fontFamily;
      break;
    case 'highlight':
      el = d.createElement('mark');
      if (m.attrs?.color) el.style.backgroundColor = m.attrs.color;
      break;
    case 'link': {
      el = d.createElement('a');
      const def = markDefaults('link');
      el.setAttribute('href', safeUrl(m.attrs?.href || '') || '');
      el.setAttribute('target', m.attrs?.target || def.target);
      el.setAttribute('rel', m.attrs?.rel || def.rel);
      el.className = 'notebook-link';
      break;
    }
    default: el = d.createElement('span');
  }
  el.appendChild(inner);
  return el;
}

function applyAlign(el, align) {
  if (align === 'center' || align === 'right') el.style.textAlign = align;
}

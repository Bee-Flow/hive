/**
 * astToHtml.js — render the editor AST to HTML for display + export.
 *
 * The output is intentionally shape-compatible with the legacy TipTap HTML so the
 * existing export pipeline (Playwright PDF, html-to-docx, server-side mermaid
 * render) and the `embedImagesAsBase64` regex keep working unchanged:
 *  - images  → <img ... data-width data-alignment data-text-wrap class="notebook-image">
 *  - mermaid → <div data-type="mermaid-diagram" data-code="<base64>"></div>
 *  - code    → <pre class="notebook-code-block"><code>…</code></pre>
 *
 * Math is emitted with KaTeX auto-render delimiters (\(…\) / \[…\]); the editor's
 * MathView renders nodes directly, so this path is only the export/mirror form.
 */
import { attr } from '../model/nodes.js';
import { markDefaults } from '../model/schema.js';
import { escapeHtml, escapeAttr, encodeForAttr, safeUrl } from './util.js';
import { evaluateTable, displayResult, isFormulaCell } from '../engine/formula.js';

export function astToHtml(docNode) {
  return (docNode?.content || []).map(renderBlock).join('');
}

function renderBlock(n) {
  switch (n.type) {
    case 'paragraph':      return `<p${alignStyle(n)}>${renderInline(n.content) || '<br>'}</p>`;
    case 'heading':        { const l = attr(n, 'level'); return `<h${l}${alignStyle(n)}>${renderInline(n.content)}</h${l}>`; }
    case 'blockquote':     return `<blockquote>${(n.content || []).map(renderBlock).join('')}</blockquote>`;
    case 'bulletList':     return `<ul>${renderItems(n)}</ul>`;
    case 'orderedList':    { const s = attr(n, 'start'); return `<ol${s && s !== 1 ? ` start="${s}"` : ''}>${renderItems(n)}</ol>`; }
    case 'listItem':       return `<li>${(n.content || []).map(renderBlock).join('')}</li>`;
    case 'taskList':       return `<ul data-type="taskList">${(n.content || []).map(renderTaskItem).join('')}</ul>`;
    case 'codeBlock':      return renderCodeBlock(n);
    case 'horizontalRule': return '<hr>';
    case 'table':          return renderTable(n);
    case 'image':          return renderImage(n);
    case 'mermaid':        return `<div data-type="mermaid-diagram" data-code="${encodeForAttr(attr(n, 'code') || '')}"></div>`;
    case 'mathBlock':      return `<div data-type="blockMath" data-latex="${escapeAttr(attr(n, 'latex') || '')}">\\[${escapeHtml(attr(n, 'latex') || '')}\\]</div>`;
    case 'chart':          return renderChart(n);
    default:               return n.content ? n.content.map(renderBlock).join('') : '';
  }
}

function renderItems(listNode) {
  return (listNode.content || []).map(renderBlock).join('');
}

function renderTaskItem(item) {
  const checked = attr(item, 'checked');
  return `<li data-type="taskItem" data-checked="${checked ? 'true' : 'false'}">` +
    `<label><input type="checkbox"${checked ? ' checked' : ''}></label>` +
    `<div>${(item.content || []).map(renderBlock).join('')}</div></li>`;
}

function renderCodeBlock(n) {
  const lang = attr(n, 'language');
  const body = (n.content || []).map((c) => c.text || '').join('');
  const codeCls = lang ? ` class="language-${escapeAttr(lang)}"` : '';
  return `<pre class="notebook-code-block"><code${codeCls}>${escapeHtml(body)}</code></pre>`;
}

function renderTable(n) {
  // Evaluate formulas so exported HTML (PDF/DOCX) shows the computed numbers, not
  // the `=…` source — regardless of whether the live editor already filled them in.
  let results;
  try { results = evaluateTable(n); } catch (e) { results = new Map(); }
  const rows = (n.content || []).map((row, r) => {
    const cells = (row.content || []).map((cell, c) => {
      const tag = attr(cell, 'header') ? 'th' : 'td';
      const a = attr(cell, 'align');
      const cw = attr(cell, 'colwidth');
      const styles = [];
      if (a) styles.push(`text-align:${a}`);
      if (cw) styles.push(`width:${cw}px`);
      const style = styles.length ? ` style="${styles.join(';')}"` : '';
      const cs = attr(cell, 'colspan'); const rs = attr(cell, 'rowspan');
      const span = (cs && cs !== 1 ? ` colspan="${cs}"` : '') + (rs && rs !== 1 ? ` rowspan="${rs}"` : '');
      let body;
      if (isFormulaCell(cell)) {
        const src = cell.content[0].content[0].attrs?.src || '';
        const val = displayResult(results.get(`${r},${c}`));
        body = `<span data-type="formula" data-formula="${escapeAttr(src)}">${escapeHtml(val)}</span>`;
      } else {
        body = (cell.content || []).map(renderBlock).join('');
      }
      return `<${tag}${span}${style}>${body}</${tag}>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  return `<table><tbody>${rows}</tbody></table>`;
}

// Charts render live (recharts) in the editor; for export we emit a static data
// table inside the figure so PDF/DOCX keep the information. data-spec round-trips.
function renderChart(n) {
  const specStr = attr(n, 'spec') || '';
  const enc = encodeForAttr(specStr);
  let spec = null;
  try { spec = JSON.parse(specStr); } catch (e) { spec = null; }
  if (!spec || !Array.isArray(spec.labels)) return `<figure data-type="chart" data-spec="${enc}"></figure>`;
  const series = Array.isArray(spec.series) ? spec.series : [];
  const caption = spec.title ? `<figcaption>${escapeHtml(spec.title)}</figcaption>` : '';
  const head = `<tr><th></th>${series.map((s) => `<th>${escapeHtml(s.name || '')}</th>`).join('')}</tr>`;
  const body = spec.labels.map((lab, i) =>
    `<tr><th>${escapeHtml(String(lab))}</th>${series.map((s) => `<td>${escapeHtml(String((s.data || [])[i] ?? ''))}</td>`).join('')}</tr>`).join('');
  return `<figure data-type="chart" data-spec="${enc}">${caption}<table><tbody>${head}${body}</tbody></table></figure>`;
}

function renderImage(n) {
  const src = safeUrl(attr(n, 'src') || '') || '';
  const alt = attr(n, 'alt') || '';
  const title = attr(n, 'title') || '';
  const width = attr(n, 'width');
  const alignment = attr(n, 'alignment') || 'center';
  const textWrap = attr(n, 'textWrap');
  return `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" title="${escapeAttr(title)}"` +
    ` data-width="${width || ''}" data-alignment="${alignment}" data-text-wrap="${textWrap ? 'true' : 'false'}"` +
    ` class="notebook-image"${width ? ` style="width: ${width}px"` : ''}>`;
}

function alignStyle(n) {
  const a = attr(n, 'align');
  return (a === 'center' || a === 'right') ? ` style="text-align:${a}"` : '';
}

/* ── Inline ─────────────────────────────────────────────── */

function renderInline(nodes = []) {
  return nodes.map(renderInlineNode).join('');
}

function renderInlineNode(n) {
  if (n.type === 'hardBreak') return '<br>';
  if (n.type === 'mathInline') return `<span data-type="inlineMath" data-latex="${escapeAttr(n.attrs?.latex || '')}">\\(${escapeHtml(n.attrs?.latex || '')}\\)</span>`;
  if (n.type === 'image') return renderImage(n);
  if (n.type !== 'text') return '';

  let s = escapeHtml(n.text);
  const marks = n.marks || [];
  // marks are sorted outermost-first; wrap innermost-first by reversing.
  for (const m of [...marks].reverse()) s = wrapMark(s, m);
  return s;
}

function wrapMark(inner, m) {
  switch (m.type) {
    case 'code':      return `<code>${inner}</code>`;
    case 'strike':    return `<s>${inner}</s>`;
    case 'italic':    return `<em>${inner}</em>`;
    case 'bold':      return `<strong>${inner}</strong>`;
    case 'underline': return `<u>${inner}</u>`;
    case 'textStyle': {
      const parts = [];
      if (m.attrs?.color) parts.push(`color: ${m.attrs.color}`);
      if (m.attrs?.fontFamily) parts.push(`font-family: ${m.attrs.fontFamily}`);
      return parts.length ? `<span style="${parts.join('; ')}">${inner}</span>` : inner;
    }
    case 'highlight': return m.attrs?.color ? `<mark style="background-color: ${m.attrs.color}">${inner}</mark>` : `<mark>${inner}</mark>`;
    case 'link': {
      const d = markDefaults('link');
      const href = safeUrl(m.attrs?.href || '') || '';
      const target = m.attrs?.target ?? d.target;
      const rel = m.attrs?.rel ?? d.rel;
      return `<a href="${escapeAttr(href)}" target="${target}" rel="${rel}" class="notebook-link">${inner}</a>`;
    }
    default: return inner;
  }
}

export default astToHtml;

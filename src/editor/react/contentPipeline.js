/**
 * contentPipeline.js — turn an incoming `content` prop (legacy HTML or Markdown)
 * into an AST doc, applying the same import-time transforms the old editor did
 * (legal-citation linkifying). Mermaid fences/divs are handled natively by the
 * md/html parsers, so the legacy preprocessMermaidContent string pass is no
 * longer needed.
 */
import { markdownToAst } from '../serialization/mdToAst.js';
import { htmlToAst } from '../serialization/htmlToAst.js';
import { looksLikeHtml } from '../serialization/util.js';
import { linkifyLegalCitations } from '../../utils/legalCitations.js';
import { API_BASE } from '../../utils/helpers';

function safeLinkify(s) {
  try { return linkifyLegalCitations(s) ?? s; } catch { return s; }
}

// Resolve relative /api/storage image URLs → full API_BASE URLs when loading
// saved content. Production (nginx): API_BASE='', no-op. Dev: prepends the backend
// host so saved images load. Covers both HTML (src="…") and Markdown (](…)).
// Mirrors NotebookEditor.jsx's resolveContentUrls so both editors behave alike.
function resolveContentUrls(s) {
  if (!s || !API_BASE) return s;
  return s
    .replace(/(src=["'])(\/api\/storage\/[^"']+)/gi, `$1${API_BASE}$2`)
    .replace(/(\]\()(\/api\/storage\/[^)\s]+)/g, `$1${API_BASE}$2`);
}

export function contentToDoc(content) {
  if (content == null) return markdownToAst('');
  if (typeof content !== 'string') {
    if (content && content.type === 'doc') return content;
    return markdownToAst('');
  }
  const linked = safeLinkify(resolveContentUrls(content));
  return looksLikeHtml(linked) ? htmlToAst(linked) : markdownToAst(linked);
}

export function markdownToDoc(md) {
  return markdownToAst(safeLinkify(resolveContentUrls(md || '')));
}

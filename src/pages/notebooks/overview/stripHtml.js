/**
 * stripHtml — plain-text excerpt of document HTML, for card previews.
 *
 * Fallback only: fresh list rows carry a server-computed `preview`; this covers
 * stale/demo rows that still ship raw `documentContent`. DOMParser with
 * 'text/html' is inert — no scripts run, no resources load — unlike the old
 * innerHTML-on-a-div approach it replaces. Block elements are joined with a
 * space so '<h1>A</h1><p>B</p>' reads "A B", not the mangled "AB".
 */

const BLOCK_TAGS = /^(P|DIV|H[1-6]|LI|UL|OL|TABLE|THEAD|TBODY|TR|TD|TH|BLOCKQUOTE|PRE|SECTION|ARTICLE|HEADER|FOOTER|FIGURE|FIGCAPTION|HR|BR)$/;
// Their text content is code/markup, not prose — a preview must not leak it.
const SKIP_TAGS = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/;

export default function stripHtml(html) {
    if (!html || typeof DOMParser === 'undefined') return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const parts = [];
    const walk = (node) => {
        for (const child of node.childNodes) {
            if (child.nodeType === 3) parts.push(child.textContent);
            else if (child.nodeType === 1 && !SKIP_TAGS.test(child.tagName)) {
                walk(child);
                if (BLOCK_TAGS.test(child.tagName)) parts.push(' ');
            }
        }
    };
    walk(doc.body);
    return parts.join('').replace(/\s+/g, ' ').trim();
}

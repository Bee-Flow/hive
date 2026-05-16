/**
 * Legal citation auto-linker — remark plugin.
 *
 * Walks the markdown AST and, for every plain text node, splits matches of
 * Dutch legal citation patterns (ECLI, BWB-id, CELEX, Kamerstuk) into
 * clickable links. Code spans, code blocks and existing links are left
 * untouched so quoted/raw citations don't get double-linked.
 */

import { visit, SKIP } from 'unist-util-visit';

export const CITATION_PATTERNS = [
    {
        name: 'ecli',
        regex: /\bECLI:[A-Z]{2}:[A-Z]+:\d{4}:\d+\b/gi,
        toUrl: (match) => `https://uitspraken.rechtspraak.nl/details?id=${encodeURIComponent(match)}`,
    },
    {
        name: 'bwb',
        regex: /\bBWB[RVA]\d{7,8}\b/g,
        toUrl: (match) => `https://wetten.overheid.nl/${match}`,
    },
    {
        name: 'celex',
        regex: /\b3\d{4}[RLDH]\d{4}\b/g,
        toUrl: (match) => `https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=CELEX:${match}`,
    },
    {
        name: 'kamerstuk',
        regex: /\b(\d{5,6})[,\s]+nr\.?\s*(\d+)\b/g,
        toUrl: (_match, m) => `https://zoek.officielebekendmakingen.nl/kst-${m[1]}-${m[2]}.html`,
    },
];

function findFirstMatch(value) {
    let best = null;
    for (const pat of CITATION_PATTERNS) {
        pat.regex.lastIndex = 0;
        const m = pat.regex.exec(value);
        if (m && (best === null || m.index < best.match.index)) {
            best = { pattern: pat, match: m };
        }
    }
    return best;
}

function splitTextNode(value) {
    const nodes = [];
    let rest = value;
    while (rest.length > 0) {
        const hit = findFirstMatch(rest);
        if (!hit) {
            nodes.push({ type: 'text', value: rest });
            break;
        }
        const { pattern, match } = hit;
        if (match.index > 0) {
            nodes.push({ type: 'text', value: rest.slice(0, match.index) });
        }
        const url = pattern.toUrl(match[0], match);
        nodes.push({
            type: 'link',
            url,
            children: [{ type: 'text', value: match[0] }],
        });
        rest = rest.slice(match.index + match[0].length);
    }
    return nodes;
}

/**
 * HTML/markdown transformer — wraps citation matches in `<a target="_blank">`
 * tags. Used by the Tiptap-based Notebook editor, which doesn't go through
 * react-markdown so the remark plugin can't reach it.
 *
 * Behaviour:
 *  - Skips text inside `<a>`, `<code>`, and `<pre>` so existing links and
 *    code blocks aren't disturbed.
 *  - Markdown inline code spans (backtick-wrapped) are also left alone — we
 *    avoid touching anything between a `\`` and the next `\``.
 *  - Idempotent: running it twice on the same string is a no-op.
 *  - Returns the input unchanged when the input is empty/non-string or when
 *    there are no matches.
 */
export function linkifyLegalCitations(input) {
    if (typeof input !== 'string' || input.length === 0) return input;

    // Cheap shortcut: if none of the patterns appear at all, skip the parse.
    let anyMatch = false;
    for (const pat of CITATION_PATTERNS) {
        pat.regex.lastIndex = 0;
        if (pat.regex.test(input)) { anyMatch = true; break; }
    }
    if (!anyMatch) return input;

    // Branch: HTML (contains a tag) vs plain markdown.
    if (/<[a-zA-Z][^>]*>/.test(input)) {
        return linkifyHtml(input);
    }
    return linkifyMarkdown(input);
}

const SKIP_TAGS = new Set(['A', 'CODE', 'PRE', 'SCRIPT', 'STYLE', 'TEMPLATE']);

function linkifyHtml(html) {
    if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return html;
    // Parse as a fragment by wrapping in a sandbox div — DOMParser's
    // document mode would inject <html><body> wrappers we'd then strip back
    // out. The simple div approach preserves the exact subtree.
    const doc = new DOMParser().parseFromString(`<div id="__bf_wrap">${html}</div>`, 'text/html');
    const wrap = doc.getElementById('__bf_wrap');
    if (!wrap) return html;

    const walker = doc.createTreeWalker(wrap, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            for (let el = node.parentNode; el && el !== wrap; el = el.parentNode) {
                if (el.nodeType === 1 && SKIP_TAGS.has(el.tagName)) {
                    return NodeFilter.FILTER_REJECT;
                }
            }
            return NodeFilter.FILTER_ACCEPT;
        },
    });

    const toReplace = [];
    let n;
    while ((n = walker.nextNode())) {
        if (!n.nodeValue || n.nodeValue.length === 0) continue;
        const hit = findFirstMatch(n.nodeValue);
        if (hit) toReplace.push(n);
    }

    for (const textNode of toReplace) {
        const frag = doc.createDocumentFragment();
        let rest = textNode.nodeValue;
        while (rest.length > 0) {
            const hit = findFirstMatch(rest);
            if (!hit) { frag.appendChild(doc.createTextNode(rest)); break; }
            const { pattern, match } = hit;
            if (match.index > 0) frag.appendChild(doc.createTextNode(rest.slice(0, match.index)));
            const a = doc.createElement('a');
            a.setAttribute('href', pattern.toUrl(match[0], match));
            a.setAttribute('target', '_blank');
            a.setAttribute('rel', 'noopener noreferrer');
            a.appendChild(doc.createTextNode(match[0]));
            frag.appendChild(a);
            rest = rest.slice(match.index + match[0].length);
        }
        textNode.parentNode.replaceChild(frag, textNode);
    }

    return wrap.innerHTML;
}

// Markdown branch: split on code spans/fences and only transform the
// non-code segments. Existing markdown links `[label](url)` and reference
// definitions are left alone because their inner text doesn't contain the
// raw citation literal.
function linkifyMarkdown(md) {
    // Split on fenced code blocks (```), inline code (`...`), and existing
    // links — re-assemble with citations transformed only inside the "prose"
    // pieces. The token regex captures whichever delimiter type matched so we
    // can pass it through verbatim.
    const TOKEN = /(```[\s\S]*?```|`[^`]*`|\[[^\]]*\]\([^)]*\))/g;
    const parts = md.split(TOKEN);
    return parts.map((part, i) => {
        // Odd indices are the matched delimiters → pass through.
        if (i % 2 === 1) return part;
        return transformMarkdownText(part);
    }).join('');
}

function transformMarkdownText(text) {
    let rest = text;
    let out = '';
    while (rest.length > 0) {
        const hit = findFirstMatch(rest);
        if (!hit) { out += rest; break; }
        const { pattern, match } = hit;
        if (match.index > 0) out += rest.slice(0, match.index);
        const url = pattern.toUrl(match[0], match);
        out += `[${match[0]}](${url})`;
        rest = rest.slice(match.index + match[0].length);
    }
    return out;
}

export function remarkLegalCitations() {
    return (tree) => {
        visit(tree, 'text', (node, index, parent) => {
            if (!parent || typeof index !== 'number') return;
            // Don't transform text inside existing links, code spans, or code blocks.
            if (parent.type === 'link' || parent.type === 'inlineCode' || parent.type === 'code') {
                return SKIP;
            }
            if (typeof node.value !== 'string' || node.value.length === 0) return;

            const replacements = splitTextNode(node.value);
            // No matches found → leave the node alone.
            if (replacements.length === 1 && replacements[0].type === 'text') return;

            parent.children.splice(index, 1, ...replacements);
            return [SKIP, index + replacements.length];
        });
    };
}

export default remarkLegalCitations;

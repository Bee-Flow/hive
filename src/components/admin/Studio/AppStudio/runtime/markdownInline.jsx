/**
 * App Studio runtime — the "small markdown subset" (bold / italic / links)
 * that `markdown`-typed props support per componentSpecs.js.
 *
 * Deliberately NOT the chat MarkdownRenderer: that one renders full markdown
 * (code blocks, tables, images…) which app definitions must not smuggle in.
 * This is a tiny character scanner (no regex, no dangerouslySetInnerHTML) that
 * emits React elements only — output is escaped by construction. Links are
 * restricted to http(s) and always open in a new tab with rel=noopener.
 */

function isSafeHref(url) {
    const u = String(url || '').trim().toLowerCase();
    return u.startsWith('https://') || u.startsWith('http://');
}

function parse(text, keyPrefix) {
    const out = [];
    let buf = '';
    let i = 0;
    const flush = () => {
        if (buf) { out.push(buf); buf = ''; }
    };
    while (i < text.length) {
        const ch = text[i];

        // **bold** / *italic*
        if (ch === '*') {
            const bold = text[i + 1] === '*';
            const marker = bold ? '**' : '*';
            const close = text.indexOf(marker, i + marker.length);
            const inner = close === -1 ? '' : text.slice(i + marker.length, close);
            if (inner.trim()) {
                flush();
                const key = `${keyPrefix}-${i}`;
                const kids = parse(inner, key);
                out.push(bold ? <strong key={key}>{kids}</strong> : <em key={key}>{kids}</em>);
                i = close + marker.length;
                continue;
            }
            buf += ch;
            i += 1;
            continue;
        }

        // [label](https://…)
        if (ch === '[') {
            const closeBracket = text.indexOf(']', i + 1);
            if (closeBracket !== -1 && text[closeBracket + 1] === '(') {
                const closeParen = text.indexOf(')', closeBracket + 2);
                if (closeParen !== -1) {
                    const label = text.slice(i + 1, closeBracket);
                    const href = text.slice(closeBracket + 2, closeParen).trim();
                    if (label && isSafeHref(href)) {
                        flush();
                        const key = `${keyPrefix}-${i}`;
                        out.push(
                            <a
                                key={key}
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline underline-offset-2"
                                style={{ color: 'var(--app-primary)' }}
                            >
                                {parse(label, key)}
                            </a>,
                        );
                        i = closeParen + 1;
                        continue;
                    }
                }
            }
            buf += ch;
            i += 1;
            continue;
        }

        buf += ch;
        i += 1;
    }
    flush();
    return out;
}

/** Render a markdown-subset string to an array of React nodes. */
export function renderInlineMarkdown(text) {
    if (text == null) return null;
    return parse(String(text), 'md');
}

export default renderInlineMarkdown;

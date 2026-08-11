/**
 * astToHtml — attribute-injection regression tests.
 *
 * astToHtml builds HTML by string concatenation, and that HTML is STORED
 * (notebooks.document_content) and re-rendered server-side into PDF/DOCX
 * exports. Several attribute values were interpolated raw, so document content —
 * which a user can author, paste, import, or have an AI write — could close the
 * attribute and inject markup.
 *
 * util.js used to claim the editor's only XSS vector was a dangerous URL scheme
 * "because render builds DOM nodes". True of the live editor; NOT true of this
 * serializer's output.
 *
 * Run: cd agent-hub && npx vitest run src/editor/serialization/astToHtml.xss.test.js
 */

import { describe, it, expect } from 'vitest';
import { astToHtml } from './astToHtml.js';
import { markdownToAst } from './mdToAst.js';
import { htmlToAst } from './htmlToAst.js';

const BREAKOUT = 'a"><img src=x onerror=alert(1)>';

const doc = (content) => ({ type: 'doc', content });
const para = (inline) => ({ type: 'paragraph', content: inline });
const text = (t, marks) => ({ type: 'text', text: t, ...(marks ? { marks } : {}) });

function assertNoBreakout(html) {
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('onerror=');
    // No raw quote may appear inside a style attribute value.
    for (const m of html.matchAll(/style="([^"]*)"/g)) {
        expect(m[1]).not.toContain('"');
        expect(m[1]).not.toContain('<');
    }
}

describe('attribute injection via marks', () => {
    it('textStyle color cannot break out of style=""', () => {
        const html = astToHtml(doc([para([text('x', [{ type: 'textStyle', attrs: { color: BREAKOUT } }])])]));
        assertNoBreakout(html);
    });

    it('textStyle fontFamily cannot break out of style=""', () => {
        const html = astToHtml(doc([para([text('x', [{ type: 'textStyle', attrs: { fontFamily: BREAKOUT } }])])]));
        assertNoBreakout(html);
    });

    it('highlight color cannot break out of style=""', () => {
        const html = astToHtml(doc([para([text('x', [{ type: 'highlight', attrs: { color: BREAKOUT } }])])]));
        assertNoBreakout(html);
    });

    it('link target/rel cannot break out', () => {
        const html = astToHtml(doc([para([text('x', [{ type: 'link', attrs: { href: 'https://e.com', target: BREAKOUT, rel: BREAKOUT } }])])]));
        assertNoBreakout(html);
    });

    it('javascript: hrefs are still stripped', () => {
        const html = astToHtml(doc([para([text('x', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }])])]));
        expect(html).not.toContain('javascript:');
    });
});

describe('attribute injection via node attrs', () => {
    it('image width/alignment cannot inject', () => {
        const html = astToHtml(doc([{ type: 'image', attrs: { src: 'https://e.com/a.png', width: BREAKOUT, alignment: BREAKOUT } }]));
        assertNoBreakout(html);
        expect(html).toContain('data-alignment="center"');   // falls back to the default
    });

    it('heading level cannot escape the tag name', () => {
        const html = astToHtml(doc([{ type: 'heading', attrs: { level: '1 onload=alert(1)' }, content: [text('t')] }]));
        expect(html).not.toContain('onload=');
        expect(html).toMatch(/^<h[1-6][ >]/);
    });

    it('table cell align/colwidth/colspan cannot inject', () => {
        const html = astToHtml(doc([{
            type: 'table',
            content: [{ type: 'tableRow', content: [{ type: 'tableCell', attrs: { align: BREAKOUT, colwidth: BREAKOUT, colspan: BREAKOUT }, content: [para([text('c')])] }] }],
        }]));
        assertNoBreakout(html);
    });

    it('ordered-list start cannot inject', () => {
        const html = astToHtml(doc([{ type: 'orderedList', attrs: { start: BREAKOUT }, content: [{ type: 'listItem', content: [para([text('a')])] }] }]));
        assertNoBreakout(html);
    });
});

describe('the same payload arriving through the parsers', () => {
    it('a hostile {color=…} span attribute is dropped at parse time', () => {
        const html = astToHtml(markdownToAst(`[x]{color=${BREAKOUT}}`));
        assertNoBreakout(html);
    });

    it('a hostile inline style on imported HTML is dropped at parse time', () => {
        const ast = htmlToAst(`<p><span style="color: ${BREAKOUT}">x</span></p>`);
        assertNoBreakout(astToHtml(ast));
    });
});

describe('legitimate styling still works', () => {
    it('keeps normal colours, fonts and highlights', () => {
        const html = astToHtml(doc([para([
            text('a', [{ type: 'textStyle', attrs: { color: '#ff0000', fontFamily: 'Georgia, serif' } }]),
            text('b', [{ type: 'highlight', attrs: { color: 'rgb(250, 204, 21)' } }]),
        ])]));
        expect(html).toContain('color: #ff0000');
        expect(html).toContain('font-family: Georgia, serif');
        expect(html).toContain('background-color: rgb(250, 204, 21)');
    });

    it('keeps real image width/alignment and table geometry', () => {
        const img = astToHtml(doc([{ type: 'image', attrs: { src: '/a.png', width: 320, alignment: 'right' } }]));
        expect(img).toContain('data-width="320"');
        expect(img).toContain('data-alignment="right"');
        expect(img).toContain('style="width: 320px"');

        const tbl = astToHtml(doc([{
            type: 'table',
            content: [{ type: 'tableRow', content: [{ type: 'tableCell', attrs: { align: 'center', colwidth: 120, colspan: 2 }, content: [para([text('c')])] }] }],
        }]));
        expect(tbl).toContain('colspan="2"');
        expect(tbl).toContain('text-align:center');
        expect(tbl).toContain('width:120px');
    });
});

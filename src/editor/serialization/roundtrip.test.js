/**
 * Round-trip fidelity tests for content the serializers used to silently drop.
 *
 * These matter more than they look: the Markdown mirror is what the AI tools
 * read and write (notebook_doc_read / _write), and the server persists what
 * they return. So anything lost in HTML→Markdown→HTML is lost from the user's
 * DOCUMENT the first time an AI edit touches it — not just from one rendering.
 *
 * Run: cd agent-hub && npx vitest run src/editor/serialization/roundtrip.test.js
 */

import { describe, it, expect } from 'vitest';
import { astToMarkdown } from './astToMd.js';
import { markdownToAst } from './mdToAst.js';
import { astToHtml } from './astToHtml.js';
import { htmlToAst } from './htmlToAst.js';

const mdRoundTrip = (md) => astToMarkdown(markdownToAst(md));
const htmlRoundTrip = (html) => astToHtml(markdownToAst(astToMarkdown(htmlToAst(html))));

describe('C7 — URLs containing parentheses', () => {
    it('keeps a wikipedia-style link intact across a Markdown round-trip', () => {
        const url = 'https://en.wikipedia.org/wiki/Foo_(bar)';
        const out = mdRoundTrip(`See [the page](<${url}>) here.`);
        const ast = markdownToAst(out);
        const link = JSON.stringify(ast).match(/"href":"([^"]+)"/);
        expect(link && link[1]).toBe(url);
    });

    it('survives a full HTML round-trip without losing the closing paren', () => {
        const url = 'https://en.wikipedia.org/wiki/Foo_(bar)';
        const out = htmlRoundTrip(`<p><a href="${url}">x</a></p>`);
        expect(out).toContain(url);
        // the stray ")" that used to leak into the text
        expect(out).not.toMatch(/>\)</);
    });

    it('leaves ordinary URLs in the plain form', () => {
        const out = mdRoundTrip('[x](https://example.com/a/b)');
        expect(out).toContain('(https://example.com/a/b)');
        expect(out).not.toContain('<https://example.com/a/b>');
    });

    it('handles an image src with parentheses', () => {
        const url = 'https://cdn.example.com/img_(1).png';
        const ast = markdownToAst(`![alt](<${url}>)`);
        expect(JSON.stringify(ast)).toContain(url);
    });
});

describe('C6 — table cells holding block content', () => {
    it('a cell containing a bullet list is not emptied', () => {
        const html = '<table><tbody><tr><td><ul><li>one</li><li>two</li></ul></td></tr></tbody></table>';
        const md = astToMarkdown(htmlToAst(html));
        expect(md).toContain('one');
        expect(md).toContain('two');
    });

    it('a cell containing an image keeps the image', () => {
        const html = '<table><tbody><tr><td><img src="https://e.com/a.png" alt="pic"></td></tr></tbody></table>';
        const md = astToMarkdown(htmlToAst(html));
        expect(md).toContain('https://e.com/a.png');
    });

    it('a cell containing a blockquote keeps its text', () => {
        const html = '<table><tbody><tr><td><blockquote><p>quoted</p></blockquote></td></tr></tbody></table>';
        const md = astToMarkdown(htmlToAst(html));
        expect(md).toContain('quoted');
    });

    it('a plain text cell is unchanged', () => {
        const html = '<table><tbody><tr><td>plain</td></tr></tbody></table>';
        expect(astToMarkdown(htmlToAst(html))).toContain('plain');
    });
});

describe('C8 — merged cells', () => {
    it('colspan survives a Markdown round-trip', () => {
        const html = '<table><tbody><tr><th colspan="2">H1+H2</th></tr><tr><td>a</td><td>b</td></tr></tbody></table>';
        const md = astToMarkdown(htmlToAst(html));
        expect(md).toContain('cs=2');
        const back = markdownToAst(md);
        expect(JSON.stringify(back)).toContain('"colspan":2');
    });

    it('rowspan survives a Markdown round-trip', () => {
        const html = '<table><tbody><tr><td rowspan="3">tall</td><td>x</td></tr></tbody></table>';
        const md = astToMarkdown(htmlToAst(html));
        expect(md).toContain('rs=3');
        expect(JSON.stringify(markdownToAst(md))).toContain('"rowspan":3');
    });

    it('the span marker is not left as visible cell text', () => {
        const html = '<table><tbody><tr><th colspan="2">Header</th></tr></tbody></table>';
        const back = markdownToAst(astToMarkdown(htmlToAst(html)));
        const json = JSON.stringify(back);
        expect(json).toContain('Header');
        expect(json).not.toContain('cs=2');
    });

    it('a table with no merged cells emits no marker', () => {
        const html = '<table><tbody><tr><th>A</th><th>B</th></tr></tbody></table>';
        const md = astToMarkdown(htmlToAst(html));
        expect(md).not.toContain('cs=');
        expect(md).not.toContain('rs=');
    });
});

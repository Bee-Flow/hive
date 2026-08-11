import { describe, it, expect } from 'vitest';
import stripHtml from './stripHtml';

describe('stripHtml', () => {
    it('joins block elements with a space', () => {
        expect(stripHtml('<h1>A</h1><p>B</p>')).toBe('A B');
    });

    it('keeps inline elements glued together', () => {
        expect(stripHtml('<p>Hello <strong>bold</strong> world</p>')).toBe('Hello bold world');
    });

    it('separates nested blocks (lists, tables)', () => {
        expect(stripHtml('<ul><li>one</li><li>two</li></ul>')).toBe('one two');
        expect(stripHtml('<table><tr><td>a</td><td>b</td></tr></table>')).toBe('a b');
    });

    it('collapses whitespace and trims', () => {
        expect(stripHtml('<p>  a  </p>\n<p> b </p>')).toBe('a b');
    });

    it('returns empty string for empty/nullish input', () => {
        expect(stripHtml('')).toBe('');
        expect(stripHtml(null)).toBe('');
        expect(stripHtml(undefined)).toBe('');
    });

    it('never executes scripts or renders tags', () => {
        expect(stripHtml('<p>safe</p><script>window.__pwned = 1;</script>')).toBe('safe');
        expect(window.__pwned).toBeUndefined();
    });
});

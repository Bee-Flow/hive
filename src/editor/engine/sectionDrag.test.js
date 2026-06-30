import { describe, it, expect } from 'vitest';
import { markdownToAst } from '../serialization/mdToAst.js';
import { astToMarkdown } from '../serialization/astToMd.js';
import { createState, applyTransform } from './state.js';
import { getSectionRange, moveBlocks } from './sectionDrag.js';

const docFrom = (md) => createState(markdownToAst(md)).doc;

describe('getSectionRange', () => {
  it('an H1 section extends to the next H1', () => {
    const doc = docFrom('# A\n\nx\n\n# B');
    expect(getSectionRange(doc, 0)).toBe(2);
    expect(getSectionRange(doc, 2)).toBe(1);
  });

  it('an H1 section includes nested sub-sections', () => {
    const doc = docFrom('# A\n\n## B\n\ny\n\n# C');
    expect(getSectionRange(doc, 0)).toBe(3);
    expect(getSectionRange(doc, 1)).toBe(2);
  });

  it('a non-heading block is a section of one', () => {
    const doc = docFrom('para one\n\npara two');
    expect(getSectionRange(doc, 0)).toBe(1);
  });
});

describe('moveBlocks', () => {
  it('moves a heading section to the end', () => {
    let s = createState(markdownToAst('# A\n\nx\n\n# B'));
    s = applyTransform(s, (st) => moveBlocks(st, 0, 2, 3));
    expect(astToMarkdown(s.doc).trim()).toBe('# B\n\n# A\n\nx');
  });

  it('is a no-op when dropping inside the source range', () => {
    const s0 = createState(markdownToAst('# A\n\nx\n\n# B'));
    const s1 = applyTransform(s0, (st) => moveBlocks(st, 0, 2, 1));
    expect(astToMarkdown(s1.doc).trim()).toBe('# A\n\nx\n\n# B');
  });
});

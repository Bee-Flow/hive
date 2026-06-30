import { describe, it, expect, beforeEach } from 'vitest';
import { markdownToAst } from '../serialization/mdToAst.js';
import { createState } from './state.js';
import { renderDoc } from './render.js';
import { posFromDOM, domFromPos } from './dommap.js';
import { pos } from './selection.js';

function setup(md) {
  const doc = createState(markdownToAst(md)).doc;
  const host = document.createElement('div');
  const nodeToPath = new Map();
  const domForNode = new Map();
  host.appendChild(renderDoc(doc, { document, nodeToPath, domForNode }));
  return { doc, host, nodeToPath, domForNode };
}

function roundTrip(md, p) {
  const { doc, host, nodeToPath, domForNode } = setup(md);
  const dp = domFromPos(domForNode, doc, p);
  expect(dp).toBeTruthy();
  const back = posFromDOM(host, dp.node, dp.offset, nodeToPath);
  expect(back).toBeTruthy();
  expect(back.path).toEqual(p.path);
  expect(back.offset).toBe(p.offset);
}

describe('DOM ↔ model position round-trip', () => {
  it('maps plain paragraph offsets', () => {
    for (const off of [0, 1, 3, 5]) roundTrip('hello', pos([0], off));
  });

  it('maps offsets across mark boundaries', () => {
    for (const off of [0, 2, 4, 5, 9]) roundTrip('**bold** text', pos([0], off));
  });

  it('maps heading offsets', () => {
    roundTrip('# Heading', pos([0], 4));
  });

  it('maps a list item paragraph', () => {
    roundTrip('- item', pos([0, 0, 0], 2));
  });

  it('maps a position in the second of two paragraphs', () => {
    roundTrip('a\n\nb', pos([1], 1));
  });

  it('maps the caret in an empty paragraph', () => {
    roundTrip('', pos([0], 0));
  });

  it('maps offsets around a hard break', () => {
    roundTrip('line one\\\nline two', pos([0], 9));
  });
});

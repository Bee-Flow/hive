/**
 * Regression cover for BFSF-351: clicking into a table crashed the editor with
 * "ReferenceError: X is not defined" because the delete-column / delete-row
 * gutter buttons rendered a lucide icon the module never imported. Lint now
 * catches that class (react/jsx-no-undef), and this asserts the component
 * itself still renders.
 *
 * The controls measure themselves, and jsdom reports every rect as 0×0 — which
 * makes TableControls bail out and render null, i.e. a naive mount would pass
 * even with the bug present. So the geometry is stubbed per element: a real
 * <table> in the document, real rects on the host/table/rows/cells.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TableControls } from './BeeEditor.jsx';
import ChromeBoundary from './ChromeBoundary.jsx';

const rect = (top, left, width, height) => ({
  top, left, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {},
});

const cell = (text, attrs = {}) => ({
  type: 'tableCell',
  attrs,
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

/** A 2×2 table: the model node plus a matching DOM subtree with stubbed rects. */
function mountTable() {
  const node = {
    type: 'table',
    content: [
      { type: 'tableRow', content: [cell('a'), cell('b')] },
      { type: 'tableRow', content: [cell('c'), cell('d')] },
    ],
  };

  // The host is what the editor scrolls; the column strip is only drawn when
  // the table sits far enough below its top edge.
  const host = document.createElement('div');
  host.getBoundingClientRect = () => rect(0, 0, 800, 600);

  const table = document.createElement('table');
  table.innerHTML = '<tbody><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></tbody>';
  table.getBoundingClientRect = () => rect(100, 50, 400, 80);
  table.querySelectorAll('tbody > tr').forEach((tr, r) => {
    tr.getBoundingClientRect = () => rect(100 + r * 40, 50, 400, 40);
    Array.from(tr.children).forEach((td, c) => {
      td.getBoundingClientRect = () => rect(100 + r * 40, 50 + c * 200, 200, 40);
    });
  });

  host.appendChild(table);
  document.body.appendChild(host);
  return { node, host, table };
}

function fakeView(host) {
  const ops = [];
  const chain = new Proxy({}, {
    get: (_t, prop) => {
      if (prop === 'run') return () => { ops.push('run'); return true; };
      return () => { ops.push(String(prop)); return chain; };
    },
  });
  return { view: { host, chain: () => chain, dispatch: vi.fn(), refPick: null }, ops };
}

const baseProps = (node, view) => ({
  view,
  info: { el: view.host.querySelector('table'), node, path: [0] },
  t: (k) => k,                       // mkTt falls through to the English fallback
  collapsed: false,
  onToggleCollapse: vi.fn(),
  headersHidden: false,
});

describe('TableControls', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  afterEach(() => { document.body.innerHTML = ''; });

  it('renders a delete button per column and per row (BFSF-351)', () => {
    const { node, host } = mountTable();
    const { view } = fakeView(host);
    render(<TableControls {...baseProps(node, view)} />);

    // Before the fix these two threw ReferenceError from inside the .map().
    expect(screen.getAllByLabelText('Delete column')).toHaveLength(2);
    expect(screen.getAllByLabelText('Delete row')).toHaveLength(2);
  });

  it('labels columns A/B when the table has no header row', () => {
    const { node, host } = mountTable();
    const { view } = fakeView(host);
    render(<TableControls {...baseProps(node, view)} />);

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('deleting a row dispatches a transform', () => {
    const { node, host } = mountTable();
    const { view } = fakeView(host);
    render(<TableControls {...baseProps(node, view)} />);

    fireEvent.mouseDown(screen.getAllByLabelText('Delete row')[0]);
    expect(view.dispatch).toHaveBeenCalledTimes(1);
  });

  it('renders no gutters when the table is collapsed', () => {
    const { node, host } = mountTable();
    const { view } = fakeView(host);
    render(<TableControls {...baseProps(node, view)} collapsed />);

    expect(screen.queryByLabelText('Delete column')).toBeNull();
    expect(screen.queryByLabelText('Delete row')).toBeNull();
  });

  it('a nested table in the DOM does not inflate the geometry rows (S8)', () => {
    const { node, host, table } = mountTable();
    // Legacy artifact: a nested table inside the first td. Its rows must NOT
    // count as outer rows — the unscoped 'tbody > tr' selector did exactly that.
    const td = table.querySelector('td');
    const nested = document.createElement('table');
    nested.innerHTML = '<tbody><tr><td>n1</td></tr><tr><td>n2</td></tr></tbody>';
    td.appendChild(nested);
    const { view } = fakeView(host);
    render(<TableControls {...baseProps(node, view)} />);

    expect(screen.getAllByLabelText('Delete row')).toHaveLength(2);   // not 4
    expect(screen.getAllByLabelText('Delete column')).toHaveLength(2);
  });

  it("columnName always shows the letter: 'A · Price' with a header row", () => {
    const { node, host } = mountTable();
    node.content[0].content = [cell('Price', { header: true }), cell('Qty', { header: true })];
    const { view } = fakeView(host);
    render(<TableControls {...baseProps(node, view)} />);

    expect(screen.getByText('A · Price')).toBeInTheDocument();
    expect(screen.getByText('B · Qty')).toBeInTheDocument();
  });

  it('Σ dispatches addColumnTotal for the hovered column', () => {
    const { node, host } = mountTable();
    const { view } = fakeView(host);
    render(<TableControls {...baseProps(node, view)} />);

    fireEvent.mouseDown(screen.getAllByLabelText('Sum column')[0]);
    expect(view.dispatch).toHaveBeenCalledTimes(1);

    // The dispatched transform is a real addColumnTotal: applying it to a
    // state appends a total row with the explicit column range.
    const fn = view.dispatch.mock.calls[0][0];
    const out = fn({ doc: { type: 'doc', content: [node] }, selection: null, storedMarks: null });
    expect(out.doc.content[0].content).toHaveLength(3);
    const totalCell = out.doc.content[0].content[2].content[0];
    expect(totalCell.content[0].content[0].type).toBe('formula');
    expect(totalCell.content[0].content[0].attrs.src).toBe('=SUM(A1:A2)'); // no header row
  });
});

describe('ChromeBoundary', () => {
  it('renders its children when nothing throws', () => {
    render(<ChromeBoundary label="probe"><span>chrome</span></ChromeBoundary>);
    expect(screen.getByText('chrome')).toBeInTheDocument();
  });

  it('hides broken chrome instead of taking the document down with it', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Boom = () => { throw new Error('kaboom'); };

    render(
      <div>
        <span>document body</span>
        <ChromeBoundary label="probe"><Boom /></ChromeBoundary>
      </div>,
    );

    expect(screen.getByText('document body')).toBeInTheDocument();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import EditorToolbar from './EditorToolbar.jsx';

// Force desktop layout so all groups render inline (not collapsed into "Format").
vi.mock('../../hooks/useViewport', () => ({
  useViewport: () => ({ width: 1920, isMobile: false, isCompact: false, isDesktop: true }),
}));

// A fake editor whose chain() records the method names it receives, with
// configurable isActive/can so we can assert active-state + enablement.
function fakeEditor({ active = {} } = {}) {
  const ops = [];
  const chain = new Proxy({}, {
    get: (_t, prop) => {
      if (prop === 'run') return () => { ops.push('run'); return true; };
      return (...args) => { ops.push(args.length ? [String(prop), args] : String(prop)); return chain; };
    },
  });
  const editor = {
    chain: () => chain,
    can: () => ({ undo: () => true, redo: () => true }),
    isActive: (name) => !!active[typeof name === 'string' ? name : JSON.stringify(name)],
    getAttributes: () => ({}),
  };
  return { editor, ops };
}

const baseProps = (editor) => ({
  editor,
  t: (k, fb) => fb || k,
  insertItems: [{ key: 'h1', icon: () => null, label: 'Heading 1', apply: (c) => c.toggleHeading({ level: 1 }) }],
  onInsert: vi.fn(),
  wordCount: 42,
});

describe('EditorToolbar', () => {
  beforeEach(() => cleanup());

  it('Bold button runs focus + toggleBold + run', () => {
    const { editor, ops } = fakeEditor();
    render(<EditorToolbar {...baseProps(editor)} />);
    fireEvent.mouseDown(screen.getByTitle('Bold'));
    expect(ops).toContain('focus');
    expect(ops.some((o) => o === 'toggleBold')).toBe(true);
    expect(ops).toContain('run');
  });

  it('reflects active marks via aria-pressed', () => {
    const { editor } = fakeEditor({ active: { bold: true } });
    render(<EditorToolbar {...baseProps(editor)} />);
    expect(screen.getByTitle('Bold').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTitle('Italic').getAttribute('aria-pressed')).toBeNull();
  });

  it('Table structural actions are disabled when the caret is not in a table', () => {
    const { editor } = fakeEditor({ active: { table: false } });
    render(<EditorToolbar {...baseProps(editor)} />);
    fireEvent.mouseDown(screen.getByTitle('Table'));
    expect(screen.getByText('Insert row above').closest('button').disabled).toBe(true);
    // The size picker (Insert table) is always available, even outside a table.
    expect(screen.getByLabelText('1 × 1')).toBeTruthy();
  });

  it('the size picker inserts a table with the picked dimensions', () => {
    const { editor, ops } = fakeEditor({ active: { table: false } });
    render(<EditorToolbar {...baseProps(editor)} />);
    fireEvent.mouseDown(screen.getByTitle('Table'));
    fireEvent.mouseDown(screen.getByLabelText('2 × 3'));
    const call = ops.find((o) => Array.isArray(o) && o[0] === 'insertTable');
    expect(call?.[1]?.[0]).toEqual({ rows: 2, cols: 3, withHeaderRow: true });
  });

  it('Table structural actions are enabled inside a table', () => {
    const { editor, ops } = fakeEditor({ active: { table: true } });
    render(<EditorToolbar {...baseProps(editor)} />);
    fireEvent.mouseDown(screen.getByTitle('Table'));
    const addRow = screen.getByText('Insert row below').closest('button');
    expect(addRow.disabled).toBe(false);
    fireEvent.mouseDown(addRow);
    expect(ops.some((o) => o === 'addRowAfter')).toBe(true);
  });

  it('AI selection actions are disabled without a selection', () => {
    const { editor } = fakeEditor();
    render(<EditorToolbar {...baseProps(editor)} askAiEnabled onAIAction={vi.fn()} hasSelection={false} />);
    fireEvent.mouseDown(screen.getByTitle('AI'));
    expect(screen.getByText('Rewrite').closest('button').disabled).toBe(true);
  });

  it('AI selection actions are enabled with a selection and call onAIAction', () => {
    const { editor } = fakeEditor();
    const onAIAction = vi.fn();
    render(<EditorToolbar {...baseProps(editor)} askAiEnabled onAIAction={onAIAction} hasSelection />);
    fireEvent.mouseDown(screen.getByTitle('AI'));
    const rewrite = screen.getByText('Rewrite').closest('button');
    expect(rewrite.disabled).toBe(false);
    fireEvent.mouseDown(rewrite);
    expect(onAIAction).toHaveBeenCalledWith('rewrite');
  });
});

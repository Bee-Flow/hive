import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import ListPickChooser from './ListPickChooser';
import { pathListShape } from './listShape';

const ROOT = {
    steps: {
        g: {
            output: {
                results: [
                    { subject: 'A', attachments: [{ filename: 'a1.pdf' }] },
                    { subject: 'B', attachments: [{ filename: 'b1.pdf' }] },
                ],
            },
        },
    },
};

function renderChooser(path, extra = {}) {
    const onChoose = vi.fn();
    const onCancel = vi.fn();
    const shape = pathListShape(path, ROOT);
    render(
        <ListPickChooser
            open
            anchorEl={null}
            path={path}
            shape={shape}
            sampleRoot={ROOT}
            expectShape="scalar"
            allowForEach
            onChoose={onChoose}
            onCancel={onCancel}
            {...extra}
        />,
    );
    return { onChoose, onCancel, shape };
}

describe('ListPickChooser', () => {
    beforeEach(() => cleanup());

    it('offers the five answers, foreach first', () => {
        renderChooser('steps.g.output.results[*].subject');
        for (const label of [
            'Run this step once for each row',
            'Just the first one',
            'Just the last one',
            'All of them, joined into text',
            'How many there are',
            'Keep the whole list',
        ]) {
            expect(screen.getByText(label)).toBeTruthy();
        }
    });

    it('foreach emits the two writes: the forEach and the row-scoped binding', () => {
        const { onChoose } = renderChooser('steps.g.output.results[*].subject');
        fireEvent.click(screen.getByText('Run this step once for each row'));
        expect(onChoose).toHaveBeenCalledWith({
            mode: 'foreach',
            forEach: { overRef: 'steps.g.output.results', itemVar: 'result', maxIterations: 100 },
            binding: { kind: 'ref', path: 'loop.result.subject' },
            itemVar: 'result',
        });
    });

    it('"Keep the whole list" is a bare ref — never a template', () => {
        const { onChoose } = renderChooser('steps.g.output.results[*].subject');
        fireEvent.click(screen.getByText('Keep the whole list'));
        expect(onChoose).toHaveBeenCalledWith({
            mode: 'each',
            binding: { kind: 'ref', path: 'steps.g.output.results[*].subject' },
            separator: undefined,
        });
    });

    it('join carries the chosen separator into the expression', () => {
        const { onChoose } = renderChooser('steps.g.output.results[*].subject');
        fireEvent.change(screen.getByLabelText('Separated by'), { target: { value: '\n' } });
        fireEvent.click(screen.getByText('All of them, joined into text'));
        expect(onChoose).toHaveBeenCalledWith({
            mode: 'join',
            binding: { kind: 'expr', value: 'join(steps.g.output.results[*].subject, "\\n")' },
            separator: '\n',
        });
    });

    it('foreach is DISABLED when each row still holds a list here', () => {
        const { onChoose, shape } = renderChooser('steps.g.output.results[*].attachments');
        expect(shape.rowScopedListTail).toBe(true);
        const row = screen.getByText('Run this step once for each row').closest('button');
        expect(row.disabled).toBe(true);
        expect(screen.getByText(/pick a single value inside the row instead/)).toBeTruthy();
        fireEvent.click(row);
        expect(onChoose).not.toHaveBeenCalled();
    });

    it('Escape closes the chooser and NEVER reaches an NDV-style document listener', () => {
        // NodeDetailView listens for Escape on document in the BUBBLE phase;
        // the chooser must eat the key in the CAPTURE phase or pressing
        // Escape would close both dialogs at once.
        const ndvEscape = vi.fn();
        const ndvListener = (e) => { if (e.key === 'Escape') ndvEscape(); };
        document.addEventListener('keydown', ndvListener);
        try {
            const { onCancel } = renderChooser('steps.g.output.results[*].subject');
            fireEvent.keyDown(document.body, { key: 'Escape' });
            expect(onCancel).toHaveBeenCalled();
            expect(ndvEscape).not.toHaveBeenCalled();
        } finally {
            document.removeEventListener('keydown', ndvListener);
        }
    });

    it('the Alt-bypass tip is standing copy, not a hidden gesture', () => {
        renderChooser('steps.g.output.results[*].subject');
        expect(screen.getByText(/hold Alt/)).toBeTruthy();
    });
});

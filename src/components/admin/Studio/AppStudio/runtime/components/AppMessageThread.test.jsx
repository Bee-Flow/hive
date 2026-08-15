import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AppMessageThread from './AppMessageThread';
import { RuntimeProvider, DEFAULT_RUNTIME } from '../RuntimeContext';

/**
 * The message thread is the one component that exists because a repeater cannot
 * do it: per-row appearance driven by a field. These tests pin that behaviour
 * and the sandbox invariant on HTML e-mail bodies.
 */

const MESSAGES = [
    { id: 'm1', kind: 'requester', author: 'Jan Klant', body: 'Waar blijft mijn pakket?', at: '2026-03-01T09:00:00Z', files: [{ filename: 'bon.pdf' }] },
    { id: 'm2', kind: 'agent', author: 'Ann', body: 'Onderweg!', at: '2026-03-01T09:12:00Z', files: [] },
    { id: 'm3', kind: 'system', author: null, body: 'Ticket gesloten', at: '2026-03-02T08:00:00Z', files: [] },
    { id: 'm4', kind: 'note', author: 'Ann', body: 'Klant belde ook', at: '2026-03-02T08:05:00Z', files: [] },
];

const SIDE_MAP = [
    { value: 'requester', side: 'left', tone: 'neutral' },
    { value: 'agent', side: 'right', tone: 'primary' },
    { value: 'system', side: 'center', tone: 'neutral' },
    { value: 'note', side: 'right', tone: 'warning' },
];

function node(props = {}, extra = {}) {
    return {
        id: 'cmp_mt',
        type: 'message_thread',
        props: {
            source: { kind: 'static', value: MESSAGES },
            bodyField: 'body', authorField: 'author', timestampField: 'at',
            sideField: 'kind', sideMap: SIDE_MAP,
            attachmentsField: 'files', attachmentLabelKey: 'filename',
            rowLimit: 100, emptyText: 'No messages yet.',
            ...props,
        },
        style: { span: 12 },
        ...extra,
    };
}

function renderThread(n, runtime = {}) {
    return render(
        <RuntimeProvider value={{ ...DEFAULT_RUNTIME, mode: 'run', ...runtime }}>
            <AppMessageThread node={n} />
        </RuntimeProvider>,
    );
}

describe('AppMessageThread', () => {
    it('gives each row the side and tone its sideMap entry asks for', () => {
        // This is the whole reason the component exists — four visual
        // treatments driven by one field.
        const { container } = renderThread(node());
        const bubbles = [...container.querySelectorAll('[data-app-thread-side]')];
        expect(bubbles.map((b) => b.getAttribute('data-app-thread-side')))
            .toEqual(['left', 'right', 'center', 'right']);
        expect(bubbles.map((b) => b.getAttribute('data-app-thread-tone')))
            .toEqual(['neutral', 'primary', 'neutral', 'warning']);
    });

    it('falls back to left/neutral for a value with no mapping', () => {
        const { container } = renderThread(node({ sideMap: [] }));
        const sides = [...container.querySelectorAll('[data-app-thread-side]')]
            .map((b) => b.getAttribute('data-app-thread-side'));
        expect(new Set(sides)).toEqual(new Set(['left']));
    });

    it('renders plain bodies as text and keeps their line breaks', () => {
        const { getByText } = renderThread(node());
        expect(getByText('Waar blijft mijn pakket?')).toBeTruthy();
        expect(getByText('Onderweg!')).toBeTruthy();
    });

    it('renders an HTML body in a sandboxed iframe WITHOUT allow-scripts', () => {
        // The single most important line in this file: allow-scripts +
        // allow-same-origin together would let a customer's e-mail strip its
        // own sandbox and run code inside the app.
        const { container } = renderThread(node({
            htmlField: 'html',
            source: { kind: 'static', value: [{ kind: 'requester', html: '<p>hoi</p><script>evil()</script>' }] },
        }));
        const frame = container.querySelector('iframe');
        expect(frame).toBeTruthy();
        const sandbox = frame.getAttribute('sandbox') || '';
        expect(sandbox).not.toContain('allow-scripts');
    });

    it('shows attachment chips only where there are attachments', () => {
        const { container } = renderThread(node());
        const chipGroups = container.querySelectorAll('[data-app-thread-chips="attachments"]');
        expect(chipGroups).toHaveLength(1);
        expect(chipGroups[0].textContent).toContain('bon.pdf');
    });

    it('renders citation chips when a field is bound', () => {
        const { container } = renderThread(node({
            citationsField: 'cites', citationLabelKey: 'title',
            source: { kind: 'static', value: [{ kind: 'agent', body: 'x', cites: [{ title: 'Handboek' }] }] },
        }));
        const chips = container.querySelector('[data-app-thread-chips="citations"]');
        expect(chips.textContent).toContain('Handboek');
    });

    it('keeps the TAIL when rowLimit truncates', () => {
        // Unlike a timeline, dropping the newest messages in a conversation
        // would hide exactly what the agent needs to answer.
        const many = Array.from({ length: 10 }, (_, i) => ({ kind: 'agent', body: `m${i}`, author: 'Ann' }));
        const { container, queryByText } = renderThread(node({ rowLimit: 3, source: { kind: 'static', value: many } }));
        expect(container.querySelectorAll('[data-app-thread-row]')).toHaveLength(3);
        expect(queryByText('m9')).toBeTruthy();
        expect(queryByText('m0')).toBeNull();
    });

    it('renders the empty state', () => {
        const { getByText } = renderThread(node({ source: { kind: 'static', value: [] }, emptyText: 'Nog niks.' }));
        expect(getByText('Nog niks.')).toBeTruthy();
    });

    it('fires onRowClick with the row, in run mode only', () => {
        const runAction = vi.fn();
        const { container } = renderThread(node({}, { onRowClick: 'act_1' }), { runAction, mode: 'run' });
        fireEvent.click(container.querySelectorAll('button')[0]);
        expect(runAction).toHaveBeenCalledWith('act_1', { formValues: MESSAGES[0], item: MESSAGES[0] });

        runAction.mockClear();
        const edit = renderThread(node({}, { onRowClick: 'act_1' }), { runAction, mode: 'edit' });
        expect(edit.container.querySelectorAll('button')).toHaveLength(0);
        expect(runAction).not.toHaveBeenCalled();
    });

    it('uses no purple — the house palette only', () => {
        const { container } = renderThread(node());
        expect(container.innerHTML).not.toMatch(/indigo|violet|purple/i);
    });
});

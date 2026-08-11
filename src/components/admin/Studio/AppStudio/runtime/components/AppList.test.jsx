import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AppList from './AppList';
import { RuntimeProvider, DEFAULT_RUNTIME } from '../RuntimeContext';

/**
 * The list is the sidebar picker of any inbox-shaped app. It shipped declaring
 * an onRowClick event that the component never implemented — clicking a row
 * silently did nothing — so the click test here is a regression guard, not a
 * nicety.
 */

const ROWS = [
    { id: 't1', subject: 'Where is my order?', requester: 'jan@x.nl', status: 'open', assignee: 'Ann', at: new Date(Date.now() - 5 * 60000).toISOString(), unread: true },
    { id: 't2', subject: 'Invoice question', requester: 'ana@x.nl', status: 'resolved', assignee: 'Bo', at: new Date(Date.now() - 3 * 3600000).toISOString(), unread: false },
];

const TONES = [
    { value: 'open', label: 'Open', tone: 'primary' },
    { value: 'resolved', label: 'Resolved', tone: 'success' },
];

function node(props = {}, extra = {}) {
    return {
        id: 'cmp_l',
        type: 'list',
        props: { source: { kind: 'static', value: ROWS }, titleKey: 'subject', ...props },
        style: { span: 12 },
        ...extra,
    };
}

function renderList(n, runtime = {}) {
    return render(
        <RuntimeProvider value={{ ...DEFAULT_RUNTIME, mode: 'run', ...runtime }}>
            <AppList node={n} />
        </RuntimeProvider>,
    );
}

describe('AppList', () => {
    it('renders titles and the empty state', () => {
        const { getByText } = renderList(node());
        expect(getByText('Where is my order?')).toBeTruthy();

        const empty = renderList(node({ source: { kind: 'static', value: [] }, emptyText: 'Niets.' }));
        expect(empty.getByText('Niets.')).toBeTruthy();
    });

    it('fires onRowClick with the whole row — in run mode only', () => {
        // The bug this guards: the spec declared the event, the component did
        // not implement it, and validation happily accepted the wiring.
        const runAction = vi.fn();
        const { container } = renderList(node({}, { onRowClick: 'act_1' }), { runAction });
        fireEvent.click(container.querySelectorAll('button')[0]);
        expect(runAction).toHaveBeenCalledWith('act_1', { formValues: ROWS[0] });

        runAction.mockClear();
        const edit = renderList(node({}, { onRowClick: 'act_1' }), { runAction, mode: 'edit' });
        expect(edit.container.querySelectorAll('button')).toHaveLength(0);
        expect(runAction).not.toHaveBeenCalled();
    });

    it('is not clickable without an action', () => {
        const { container } = renderList(node());
        expect(container.querySelectorAll('button')).toHaveLength(0);
    });

    it('colours the badge from badgeToneMap and shows its label', () => {
        const { container, getByText } = renderList(node({
            badgeKey: 'status', badgeToneMap: TONES,
        }));
        const badges = [...container.querySelectorAll('[data-app-list-badge]')];
        expect(badges.map((b) => b.getAttribute('data-app-list-badge'))).toEqual(['primary', 'success']);
        expect(getByText('Open')).toBeTruthy();
    });

    it('falls back to neutral for a value with no mapping', () => {
        const { container } = renderList(node({ badgeKey: 'status', badgeToneMap: [] }));
        const badges = [...container.querySelectorAll('[data-app-list-badge]')];
        expect(badges.map((b) => b.getAttribute('data-app-list-badge'))).toEqual(['neutral', 'neutral']);
    });

    it('marks only the unread rows', () => {
        const { container } = renderList(node({ unreadKey: 'unread' }));
        expect(container.querySelectorAll('[data-app-list-unread]')).toHaveLength(1);
    });

    it('shows a short relative timestamp, not a raw date', () => {
        const { getByText } = renderList(node({ timestampKey: 'at' }));
        expect(getByText('5 min')).toBeTruthy();
        expect(getByText('3 u')).toBeTruthy();
    });

    it('shows the meta line', () => {
        const { getByText } = renderList(node({ metaKey: 'assignee' }));
        expect(getByText('Ann')).toBeTruthy();
    });

    it('uses no purple', () => {
        const { container } = renderList(node({ badgeKey: 'status', badgeToneMap: TONES, unreadKey: 'unread' }));
        expect(container.innerHTML).not.toMatch(/indigo|violet|purple/i);
    });
});

import { act, fireEvent, render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AppFilterBar from './AppFilterBar';
import { RuntimeProvider, buildScope, DEFAULT_RUNTIME } from '../RuntimeContext';

function withRuntime(ui, overrides = {}) {
    const value = { ...DEFAULT_RUNTIME, scope: buildScope({ now: '2026-01-01T00:00:00.000Z' }), ...overrides };
    return render(<RuntimeProvider value={value}>{ui}</RuntimeProvider>);
}

function fbNode(fields) {
    return { id: 'cmp_fb', type: 'filter_bar', visible: true, props: { fields }, style: { span: 12 } };
}

const FIELDS = [
    { name: 'q', label: 'Search', type: 'search', options: [] },
    { name: 'status', label: 'Status', type: 'select', options: [{ value: 'open', label: 'Open' }, { value: 'done', label: 'Done' }] },
    { name: 'mine', label: 'Only mine', type: 'toggle', options: [] },
    { name: 'from', label: 'From', type: 'date', options: [] },
];

describe('AppFilterBar', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    const settle = () => act(() => { vi.advanceTimersByTime(300); });

    it('publishes the whole filters object via setVar("filters", …)', () => {
        const setVar = vi.fn();
        const { getByLabelText } = withRuntime(<AppFilterBar node={fbNode(FIELDS)} />, { mode: 'run', setVar });

        fireEvent.change(getByLabelText('Search'), { target: { value: 'bee' } });
        settle();
        expect(setVar).toHaveBeenLastCalledWith('filters', { q: 'bee' });

        fireEvent.change(getByLabelText('Status'), { target: { value: 'open' } });
        expect(setVar).toHaveBeenLastCalledWith('filters', { q: 'bee', status: 'open' });

        fireEvent.click(getByLabelText('Only mine'));
        expect(setVar).toHaveBeenLastCalledWith('filters', { q: 'bee', status: 'open', mine: true });

        fireEvent.change(getByLabelText('From'), { target: { value: '2026-01-15' } });
        expect(setVar).toHaveBeenLastCalledWith('filters', { q: 'bee', status: 'open', mine: true, from: '2026-01-15' });
    });

    it('publishes typing ONCE per pause, not once per keystroke', () => {
        const setVar = vi.fn();
        const { getByLabelText } = withRuntime(<AppFilterBar node={fbNode(FIELDS)} />, { mode: 'run', setVar });
        for (const value of ['b', 'be', 'bee']) {
            fireEvent.change(getByLabelText('Search'), { target: { value } });
        }
        expect(getByLabelText('Search').value).toBe('bee'); // the control stays live
        expect(setVar).not.toHaveBeenCalled();
        settle();
        expect(setVar).toHaveBeenCalledTimes(1);
        expect(setVar).toHaveBeenLastCalledWith('filters', { q: 'bee' });
    });

    it('a discrete control flushes a pending keystroke instead of queueing it', () => {
        const setVar = vi.fn();
        const { getByLabelText } = withRuntime(<AppFilterBar node={fbNode(FIELDS)} />, { mode: 'run', setVar });
        fireEvent.change(getByLabelText('Search'), { target: { value: 'bee' } });
        fireEvent.change(getByLabelText('Status'), { target: { value: 'open' } });
        expect(setVar).toHaveBeenCalledTimes(1);
        expect(setVar).toHaveBeenLastCalledWith('filters', { q: 'bee', status: 'open' });
        settle();
        expect(setVar).toHaveBeenCalledTimes(1);
    });

    it('omits cleared controls from the published object', () => {
        const setVar = vi.fn();
        const { getByLabelText } = withRuntime(<AppFilterBar node={fbNode(FIELDS)} />, { mode: 'run', setVar });
        fireEvent.change(getByLabelText('Search'), { target: { value: 'x' } });
        fireEvent.change(getByLabelText('Search'), { target: { value: '' } });
        settle();
        expect(setVar).toHaveBeenLastCalledWith('filters', {});
        // Unchecking a toggle also drops the key.
        fireEvent.click(getByLabelText('Only mine'));
        fireEvent.click(getByLabelText('Only mine'));
        expect(setVar).toHaveBeenLastCalledWith('filters', {});
    });

    it('does not publish after unmount', () => {
        const setVar = vi.fn();
        const { getByLabelText, unmount } = withRuntime(<AppFilterBar node={fbNode(FIELDS)} />, { mode: 'run', setVar });
        fireEvent.change(getByLabelText('Search'), { target: { value: 'bee' } });
        unmount();
        settle();
        expect(setVar).not.toHaveBeenCalled();
    });

    it('degrades to local state when setVar is absent (default runtime no-op)', () => {
        const { getByLabelText } = withRuntime(<AppFilterBar node={fbNode(FIELDS)} />, { mode: 'run', setVar: undefined });
        fireEvent.change(getByLabelText('Search'), { target: { value: 'still works' } });
        expect(getByLabelText('Search').value).toBe('still works');
    });

    it('disables controls in edit mode and shows a hint when unconfigured', () => {
        const { getByLabelText } = withRuntime(<AppFilterBar node={fbNode(FIELDS)} />, { mode: 'edit' });
        expect(getByLabelText('Search').disabled).toBe(true);
        const { getByText } = withRuntime(<AppFilterBar node={fbNode([])} />);
        expect(getByText('No filters configured yet.')).toBeTruthy();
    });
});

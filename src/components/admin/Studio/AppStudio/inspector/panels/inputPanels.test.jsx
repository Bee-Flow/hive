import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { InputDateInspector, todayLocalIso } from './inputPanels';

/**
 * "Pick a date" seeds today. A date-only ISO string cut from toISOString() is
 * a UTC date, which is yesterday for every user east of UTC.
 */

const NODE = {
    id: 'cmp_date1', type: 'input_date', visible: true,
    props: { name: 'due', label: 'Due', required: false, defaultValue: null },
    style: { span: 6 },
};

function renderPanel(node = NODE) {
    const definition = {
        schemaVersion: 2, meta: { name: 'T' }, theme: {}, homeScreenId: 'scr_d',
        screens: [{ id: 'scr_d', name: 'T', showInNav: true, maxWidth: 'medium', sections: [{ id: 'sec_d', style: {}, children: [node] }] }],
        actions: {},
    };
    const onCommit = vi.fn();
    const utils = render(<InputDateInspector node={node} definition={definition} onCommit={onCommit} disabled={false} />);
    const lastProps = () => onCommit.mock.calls.at(-1)[0].screens[0].sections[0].children[0].props;
    return { onCommit, lastProps, ...utils };
}

afterEach(() => vi.useRealTimers());

describe('InputDateInspector — default date', () => {
    it('todayLocalIso tracks the local calendar day, not the UTC one', () => {
        vi.useFakeTimers();
        // Late evening UTC: already tomorrow east of UTC.
        vi.setSystemTime(new Date('2026-08-02T22:30:00Z'));
        expect(todayLocalIso()).toBe(new Date().toLocaleDateString('en-CA'));
        // Early morning UTC: still yesterday west of UTC.
        vi.setSystemTime(new Date('2026-08-02T01:30:00Z'));
        expect(todayLocalIso()).toBe(new Date().toLocaleDateString('en-CA'));
    });

    it('"Pick a date" seeds the local date', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-08-02T22:30:00Z'));
        const { lastProps, getByRole } = renderPanel();
        fireEvent.click(getByRole('radio', { name: 'Pick a date' }));
        expect(lastProps().defaultValue).toBe(new Date().toLocaleDateString('en-CA'));
    });
});

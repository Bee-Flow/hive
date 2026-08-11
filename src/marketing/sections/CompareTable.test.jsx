/**
 * Compare table — the semantics ARE the feature.
 *
 * A comparison only works for assistive tech when the table announces which
 * column and which aspect a cell belongs to, so the scope attributes are
 * pinned here rather than trusted. The overflow wrapper is pinned for the
 * same reason: without it a wide table makes the whole PAGE scroll
 * horizontally on a phone.
 *
 * Run: cd agent-hub && npx vitest run src/marketing/sections/CompareTable.test.jsx
 */
import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import CompareTable from './CompareTable';

const base = {
    enabled: true,
    title: 'Bee Flow vs the incumbent',
    leftLabel: 'Bee Flow',
    rightLabel: 'ChatGPT Teams',
    rows: [
        { aspect: 'Data residency', left: 'EU, your own cluster', right: 'US cloud' },
        { aspect: 'Source', left: 'Fair-code, self-hostable', right: 'Closed' },
    ],
    footnote: 'Comparison as of 2026.',
};

// Relative, so jsdom's configured origin is preserved — an absolute URL with
// a different host throws SecurityError. Same helper as MediaText.test.jsx.
function setPreview(on) {
    window.history.replaceState({}, '', on ? '?preview=1' : '?');
}

afterEach(() => setPreview(false));

describe('table semantics', () => {
    it('renders the column heads as th scope="col"', () => {
        const { container } = render(<CompareTable data={base} />);
        const colHeads = [...container.querySelectorAll('thead th[scope="col"]')];
        expect(colHeads).toHaveLength(3); // aspect corner + left + right
        expect(colHeads[1].textContent).toBe('Bee Flow');
        expect(colHeads[2].textContent).toBe('ChatGPT Teams');
    });

    it('renders each aspect as a th scope="row"', () => {
        const { container } = render(<CompareTable data={base} />);
        const rowHeads = [...container.querySelectorAll('tbody th[scope="row"]')];
        expect(rowHeads.map(h => h.textContent))
            .toEqual(['Data residency', 'Source']);
        // The value cells are plain td — never headers.
        expect(container.querySelectorAll('tbody td')).toHaveLength(4);
    });

    it('wraps the table in an overflow scroller so mobile scrolls the table, not the page', () => {
        const { container } = render(<CompareTable data={base} />);
        const table = container.querySelector('table.compare-table');
        expect(table.parentElement.className).toContain('compare-table-scroll');
    });

    it('shows the footnote under the table', () => {
        const { container } = render(<CompareTable data={base} />);
        expect(container.querySelector('.compare-table-footnote').textContent)
            .toBe('Comparison as of 2026.');
    });
});

describe('empty content', () => {
    it('renders nothing on the published site when rows are empty', () => {
        const { container } = render(
            <CompareTable data={{ ...base, rows: [] }} />,
        );
        expect(container.querySelector('table')).toBeNull();
    });

    it('renders nothing when every row is blank', () => {
        const { container } = render(
            <CompareTable data={{ ...base, rows: [{ aspect: '', left: ' ', right: '' }] }} />,
        );
        expect(container.querySelector('table')).toBeNull();
    });

    it('drops only the blank rows when others have content', () => {
        const { container } = render(
            <CompareTable data={{
                ...base,
                rows: [...base.rows, { aspect: '', left: '', right: '' }],
            }} />,
        );
        expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
    });

    it('keeps the empty scaffold in the editor preview so rows stay clickable', () => {
        setPreview(true);
        const { container } = render(
            <CompareTable data={{ ...base, rows: [{ aspect: '', left: '', right: '' }], footnote: '' }} />,
        );
        expect(container.querySelector('table')).not.toBeNull();
        expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    });

    it('hides an empty footnote on the published site', () => {
        const { container } = render(
            <CompareTable data={{ ...base, footnote: '' }} />,
        );
        expect(container.querySelector('.compare-table-footnote')).toBeNull();
    });
});

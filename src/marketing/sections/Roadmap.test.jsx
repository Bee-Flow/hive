/**
 * The roadmap renderer.
 *
 * Two behaviours here are not cosmetic and are the reason this file exists:
 *
 *   - grouping is DERIVED, never stored. Locale overrides address array items
 *     by numeric index, so if the renderer (or an editor) ever persisted a
 *     sorted order, every Dutch translation would land on a different item.
 *   - an item with a missing or unrecognised status must still render. A
 *     translated status ('bèta') or a typo would otherwise delete a roadmap
 *     entry from a public page with no error anywhere.
 *
 * Run: cd agent-hub && npx vitest run src/marketing/sections/Roadmap.test.jsx
 */
import { render, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Roadmap, { groupByStatus, ROADMAP_STATUSES } from './Roadmap.jsx';

const item = (over = {}) => ({ title: 'Thing', body: 'Does a thing', status: 'shipped', ...over });

const renderRoadmap = (over = {}) => render(
    <Roadmap data={{ enabled: true, title: 'Roadmap', items: [], ...over }} />,
);

describe('grouping', () => {
    it('is derived from status, not from the order items are stored in', () => {
        const items = [
            item({ title: 'A', status: 'exploring' }),
            item({ title: 'B', status: 'shipped' }),
            item({ title: 'C', status: 'exploring' }),
            item({ title: 'D', status: 'beta' }),
        ];
        const groups = groupByStatus(items);
        expect(groups.map(g => g.status)).toEqual(['shipped', 'beta', 'exploring']);
        expect(groups[2].entries.map(e => e.item.title)).toEqual(['A', 'C']);
    });

    it('keeps each item\'s ORIGINAL index, so inline-edit paths stay correct', () => {
        // The EditableText path is roadmap.items.<index>.title. If the index
        // followed the on-screen position, editing the first card on the page
        // would rewrite whichever item happens to sit first in the array.
        const items = [item({ status: 'exploring' }), item({ status: 'shipped' })];
        const groups = groupByStatus(items);
        expect(groups[0].status).toBe('shipped');
        expect(groups[0].entries[0].index).toBe(1);
    });

    it('drops empty buckets rather than rendering a heading with nothing under it', () => {
        expect(groupByStatus([item({ status: 'beta' })]).map(g => g.status)).toEqual(['beta']);
    });

    it('never loses an item to an unknown or missing status', () => {
        const items = [
            item({ title: 'translated', status: 'bèta' }),
            item({ title: 'absent', status: undefined }),
            item({ title: 'typo', status: 'shiped' }),
        ];
        const kept = groupByStatus(items).flatMap(g => g.entries.map(e => e.item.title));
        expect(kept).toHaveLength(3);
        expect(kept).toContain('translated');
    });
});

describe('rendering', () => {
    it('renders a card per item, with its caveat', () => {
        const { container } = renderRoadmap({
            items: [item({ title: 'Legal', status: 'beta', note: 'Enterprise plan, Dutch law only' })],
        });
        const card = container.querySelector('.roadmap-card');
        expect(within(card).getByText('Legal')).toBeTruthy();
        expect(within(card).getByText('Enterprise plan, Dutch law only')).toBeTruthy();
    });

    it('carries the status on the card, so a linked item still says what it is', () => {
        const { container } = renderRoadmap({ items: [item({ status: 'building' })] });
        expect(container.querySelector('.roadmap--building')).toBeTruthy();
    });

    it('uses the editor\'s group names and falls back when one is blank', () => {
        const { container } = renderRoadmap({
            items: [item({ status: 'shipped' })],
            statusLabels: { shipped: 'Live today' },
            showLegend: false,
        });
        expect(container.querySelector('.roadmap-group-heading').textContent).toContain('Live today');

        const { container: bare } = renderRoadmap({ items: [item({ status: 'shipped' })], statusLabels: {}, showLegend: false });
        expect(bare.querySelector('.roadmap-group-heading').textContent).toContain('Available now');
    });

    it('keys only the statuses actually on the page', () => {
        // A legend entry for an empty bucket is a swatch for a colour that
        // appears nowhere — and an unused "Available now" chip on a roadmap
        // where nothing is finished reads as a claim, not a key.
        const { container } = renderRoadmap({
            items: [item({ status: 'beta' }), item({ status: 'building' })],
        });
        const shown = [...container.querySelectorAll('.roadmap-legend-item')]
            .map(n => n.textContent.trim());
        expect(shown).toEqual(['In beta', 'In development']);
        expect(shown.length).toBeLessThan(ROADMAP_STATUSES.length);
    });

    it('renders no legend and no groups when there are no items', () => {
        const { container } = renderRoadmap({ items: [] });
        expect(container.querySelector('.roadmap-legend')).toBeNull();
        expect(container.querySelector('.roadmap-group')).toBeNull();
    });

    it('renders nothing at all when the block is disabled', () => {
        const { container } = render(<Roadmap data={{ enabled: false, items: [item()] }} />);
        expect(container.querySelector('.roadmap-card')).toBeNull();
    });

    it('survives items being absent entirely', () => {
        const { container } = render(<Roadmap data={{ enabled: true, title: 'T' }} />);
        expect(container.querySelector('#roadmap')).toBeTruthy();
    });
});

import { describe, it, expect } from 'vitest';
import { createState, toListItem, ROUTES } from './notebooks';

/**
 * Demo-parity drift guard. The overview grid renders whatever the list
 * endpoint returns; when the real endpoint grows a field the cards consume,
 * this fixture has to grow it too or the demo grid renders zeros/blanks —
 * which looks exactly like the product being broken (see monitoring.test.js
 * for how that failure mode plays out unnoticed).
 */

// Every field the card contract needs (plan: API contract, GET /api/notebooks).
const CARD_KEYS = [
    'id', 'name', 'sourceCount', 'processingCount', 'failedCount',
    'sourceWordCount', 'docWordCount', 'messageCount', 'preview',
    'pinned', 'pinnedAt', 'lastActivityAt', 'lastActivityKind',
    'createdAt', 'updatedAt',
];

describe('notebooks fixture — card shape', () => {
    it('toListItem carries every key the card contract needs', () => {
        for (const n of createState().notebooks) {
            const item = toListItem(n);
            for (const key of CARD_KEYS) {
                expect(item, `${n.id} is missing ${key}`).toHaveProperty(key);
                expect(item[key], `${n.id}.${key} is undefined`).not.toBeUndefined();
            }
        }
    });

    it('derives real, non-zero figures from the seeded tender notebook', () => {
        const item = toListItem(createState().notebooks[0]);
        expect(item.sourceCount).toBe(6);
        expect(item.messageCount).toBe(2);
        expect(item.sourceWordCount).toBe(14820 + 6410 + 3180 + 940 + 610 + 4275);
        expect(item.docWordCount).toBeGreaterThan(50);
        // The preview must be plain text, not markup, and card-sized.
        expect(item.preview).not.toMatch(/[<>]/);
        expect(item.preview.length).toBeLessThanOrEqual(300);
        expect(item.preview).toContain('Tender 2026-114');
    });

    it('pins exactly one notebook so the affordance demos', () => {
        const pinned = createState().notebooks.map(toListItem).filter(i => i.pinned);
        expect(pinned).toHaveLength(1);
        expect(pinned[0].pinnedAt).toBeTruthy();
    });
});

describe('notebooks fixture — routes', () => {
    const list = (qs) => ROUTES['GET /api/notebooks']({
        state: createState(), query: new URLSearchParams(qs || ''),
    });

    it('list floats the pinned notebook first', () => {
        const { notebooks } = list();
        expect(notebooks[0].pinned).toBe(true);
    });

    it('list honours search (case-insensitive name match)', () => {
        const { notebooks } = list('search=dpia');
        expect(notebooks).toHaveLength(1);
        expect(notebooks[0].id).toBe('nb_demo_dpia');
    });

    it('list honours sort=name within pin groups', () => {
        const { notebooks } = list('sort=name');
        const unpinned = notebooks.filter(n => !n.pinned).map(n => n.name);
        expect(unpinned).toEqual([...unpinned].sort((a, b) => a.localeCompare(b)));
    });

    it('PUT maps pinned to pinnedAt without bumping version, and echoes version', () => {
        const state = createState();
        const target = state.notebooks[0];
        const before = target.version;
        const res = ROUTES['PUT /api/notebooks/:id']({
            state, params: { id: target.id }, body: { pinned: true },
        });
        expect(res.success).toBe(true);
        expect(res.version).toBe(before);
        expect(target.pinnedAt).toBeTruthy();

        const unpin = ROUTES['PUT /api/notebooks/:id']({
            state, params: { id: target.id }, body: { pinned: false },
        });
        expect(unpin.version).toBe(before);
        expect(target.pinnedAt).toBeNull();
    });

    it('PUT bumps and echoes version on a content update', () => {
        const state = createState();
        const target = state.notebooks[0];
        const before = target.version;
        const res = ROUTES['PUT /api/notebooks/:id']({
            state, params: { id: target.id }, body: { name: 'Renamed', expectedVersion: before },
        });
        expect(res.version).toBe(before + 1);
        expect(target.name).toBe('Renamed');
        // CAS input must not leak onto the record.
        expect(target.expectedVersion).toBeUndefined();
    });
});

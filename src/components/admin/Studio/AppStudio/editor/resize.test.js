import { describe, it, expect } from 'vitest';
import { HEIGHT_STEPS, heightFromDrag, spanFromDrag } from './resize';

describe('spanFromDrag', () => {
    const columnWidth = 40; // a 480px grid / 12 columns

    it('adds one column per column-width dragged right', () => {
        expect(spanFromDrag({ startSpan: 3, dx: 40, columnWidth })).toBe(4);
        expect(spanFromDrag({ startSpan: 3, dx: 120, columnWidth })).toBe(6);
    });

    it('subtracts columns when dragged left', () => {
        expect(spanFromDrag({ startSpan: 6, dx: -80, columnWidth })).toBe(4);
    });

    it('snaps to the NEAREST column (rounds half-columns)', () => {
        expect(spanFromDrag({ startSpan: 4, dx: 19, columnWidth })).toBe(4); // <½ col
        expect(spanFromDrag({ startSpan: 4, dx: 21, columnWidth })).toBe(5); // >½ col
    });

    it('clamps to 1..12', () => {
        expect(spanFromDrag({ startSpan: 2, dx: -400, columnWidth })).toBe(1);
        expect(spanFromDrag({ startSpan: 10, dx: 400, columnWidth })).toBe(12);
    });

    it('leaves the (clamped) start span when the grid is unmeasurable', () => {
        expect(spanFromDrag({ startSpan: 5, dx: 200, columnWidth: 0 })).toBe(5);
        expect(spanFromDrag({ startSpan: 5, dx: 200, columnWidth: NaN })).toBe(5);
        expect(spanFromDrag({ startSpan: 99, dx: 0, columnWidth })).toBe(12); // start clamped
    });
});

describe('heightFromDrag', () => {
    const stepPx = 80;

    it('walks the height vocabulary by dragged steps', () => {
        expect(heightFromDrag({ startHeight: 'auto', dy: 80, stepPx })).toBe('sm');
        expect(heightFromDrag({ startHeight: 'auto', dy: 240, stepPx })).toBe('lg');
        expect(heightFromDrag({ startHeight: 'lg', dy: -160, stepPx })).toBe('sm');
    });

    it('clamps at the ends of the vocabulary', () => {
        expect(heightFromDrag({ startHeight: 'xl', dy: 400, stepPx })).toBe('xl');
        expect(heightFromDrag({ startHeight: 'auto', dy: -400, stepPx })).toBe('auto');
    });

    it('treats an unknown start as auto and keeps it when undraggable', () => {
        expect(heightFromDrag({ startHeight: 'weird', dy: 0, stepPx })).toBe('auto');
        expect(heightFromDrag({ startHeight: 'md', dy: 100, stepPx: 0 })).toBe('md');
    });

    it('exposes the ordered step vocabulary', () => {
        expect(HEIGHT_STEPS).toEqual(['auto', 'sm', 'md', 'lg', 'xl']);
    });
});

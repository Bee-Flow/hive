import { describe, it, expect } from 'vitest';
import { buildDateRange, DATE_RANGE_PRESETS } from './dateRange';

describe('buildDateRange', () => {
    it('returns empty params for "all"', () => {
        const r = buildDateRange('all');
        expect(r.params.toString()).toBe('');
        expect(r.filter.from).toBeNull();
        expect(r.filter.to).toBeNull();
    });

    it('returns empty params for null input', () => {
        const r = buildDateRange(null);
        expect(r.params.toString()).toBe('');
    });

    it('populates params for a preset', () => {
        const r = buildDateRange('7d');
        expect(r.params.get('from')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(r.params.get('to')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(r.filter.from).toBe(r.params.get('from'));
        expect(r.filter.to).toBe(r.params.get('to'));
    });

    it('passes through an explicit { from, to }', () => {
        const r = buildDateRange({ from: '2026-01-01T00:00:00Z', to: '2026-02-01T00:00:00Z' });
        expect(r.params.get('from')).toBe('2026-01-01T00:00:00Z');
        expect(r.params.get('to')).toBe('2026-02-01T00:00:00Z');
    });

    it('exposes the preset list', () => {
        expect(DATE_RANGE_PRESETS).toContain('7d');
        expect(DATE_RANGE_PRESETS).toContain('all');
    });
});

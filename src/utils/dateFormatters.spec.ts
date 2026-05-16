import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    formatDate,
    formatTime,
    formatDuration,
    formatBytes,
    toLocalDatetimeInput,
    shortModel,
    formatRelativeTime,
    formatRelativeDate,
} from './dateFormatters';

describe('formatDate', () => {
    it('returns em-dash for null / empty', () => {
        expect(formatDate(null)).toBe('—');
        expect(formatDate('')).toBe('—');
    });

    it('returns the input verbatim on unparseable string', () => {
        expect(formatDate('not-a-date')).toBe('not-a-date');
    });

    it('formats a valid ISO string', () => {
        // Exact locale formatting varies across nodes — assert structure not exact bytes.
        const out = formatDate('2026-05-14T10:30:00Z');
        expect(out).toMatch(/\d{1,2}/);
        expect(out).toMatch(/2026/);
    });

    it('includes time when withTime=true', () => {
        const out = formatDate('2026-05-14T10:30:00Z', { withTime: true });
        expect(out).toMatch(/\d{2}:\d{2}/);
    });
});

describe('formatTime', () => {
    it('returns em-dash for null', () => {
        expect(formatTime(null)).toBe('—');
    });
    it('formats a valid input', () => {
        expect(formatTime('2026-05-14T10:30:00Z')).toMatch(/\d{2}:\d{2}/);
    });
});

describe('formatDuration', () => {
    it('em-dash for null/NaN', () => {
        expect(formatDuration(null)).toBe('—');
        expect(formatDuration(NaN)).toBe('—');
    });
    it('ms scale', () => {
        expect(formatDuration(500)).toBe('500ms');
    });
    it('seconds scale', () => {
        expect(formatDuration(3500)).toBe('4s');
    });
    it('minutes scale', () => {
        expect(formatDuration(75_000)).toBe('1m 15s');
    });
    it('hours scale', () => {
        expect(formatDuration(3_660_000)).toBe('1h 1m');
    });
    it('days scale', () => {
        expect(formatDuration(90_000_000)).toBe('1d 1h');
    });
});

describe('formatBytes', () => {
    it('em-dash for null', () => {
        expect(formatBytes(null)).toBe('—');
    });
    it('bytes', () => {
        expect(formatBytes(512)).toBe('512 B');
    });
    it('kilobytes', () => {
        expect(formatBytes(2048)).toBe('2.0 KB');
    });
    it('megabytes', () => {
        expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    });
    it('gigabytes', () => {
        expect(formatBytes(3 * 1024 ** 3)).toBe('3.00 GB');
    });
});

describe('toLocalDatetimeInput', () => {
    it('empty string for null', () => {
        expect(toLocalDatetimeInput(null)).toBe('');
    });
    it('returns 16-char yyyy-MM-ddTHH:mm', () => {
        const out = toLocalDatetimeInput('2026-05-14T10:30:00Z');
        expect(out).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });
});

describe('shortModel', () => {
    it('em-dash for empty', () => {
        expect(shortModel('')).toBe('—');
        expect(shortModel(null)).toBe('—');
    });
    it('strips vendor prefix', () => {
        expect(shortModel('anthropic/claude-sonnet-4-5')).toBe('claude-sonnet-4-5');
    });
    it('strips yyyymmdd snapshot suffix', () => {
        expect(shortModel('claude-sonnet-4-5-20251022')).toBe('claude-sonnet-4-5');
    });
    it('strips yyyy-mm-dd snapshot suffix', () => {
        expect(shortModel('claude-sonnet-4-5-2025-10-22')).toBe('claude-sonnet-4-5');
    });
});

describe('formatRelativeTime', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
    });
    afterEach(() => { vi.useRealTimers(); });

    it('returns nowLabel for ages under a minute', () => {
        expect(formatRelativeTime('2026-05-15T11:59:30Z')).toBe('just now');
        expect(formatRelativeTime('2026-05-15T11:59:30Z', { nowLabel: 'now' })).toBe('now');
    });
    it('returns Xm ago for minute-level ages', () => {
        expect(formatRelativeTime('2026-05-15T11:55:00Z')).toBe('5m ago');
    });
    it('returns Xh ago for hour-level ages', () => {
        expect(formatRelativeTime('2026-05-15T09:00:00Z')).toBe('3h ago');
    });
    it('returns Xd ago for day-level ages under a week', () => {
        expect(formatRelativeTime('2026-05-13T12:00:00Z')).toBe('2d ago');
    });
    it('falls back to toLocaleDateString past a week', () => {
        const result = formatRelativeTime('2026-04-01T00:00:00Z');
        expect(result).not.toMatch(/ago/);
        expect(result).not.toBe('');
    });
});

describe('formatRelativeDate', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
    });
    afterEach(() => { vi.useRealTimers(); });

    it("returns 'Today' for same-day input", () => {
        expect(formatRelativeDate('2026-05-15T09:00:00Z')).toBe('Today');
    });
    it("returns 'Yesterday' for previous-day input", () => {
        expect(formatRelativeDate('2026-05-14T09:00:00Z')).toBe('Yesterday');
    });
    it('returns Xd ago for two-to-six days', () => {
        expect(formatRelativeDate('2026-05-12T09:00:00Z')).toBe('3d ago');
    });
    it('honors todayShowsTime: same-day returns the time of day (hh:mm)', () => {
        const out = formatRelativeDate('2026-05-15T09:00:00Z', { todayShowsTime: true });
        // Locale-formatted time (could be "11:00", "11:00 AM", "11.00", etc.) — just
        // assert it contains digits and is not the literal "Today" word.
        expect(out).not.toBe('Today');
        expect(out).toMatch(/\d/);
    });
});

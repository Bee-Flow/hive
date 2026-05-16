// Shared date / number / byte / model formatters.
//
// Before this module existed, formatDate() had been re-implemented in 8
// different files (admin terminations, admin feedback, version history,
// search overlay, KB detail, memory panel, Gmail picker, Drive picker).
// fmtTime/fmtDuration/fmtBytes/toLocalInput/shortModel were each duplicated
// across at least two settings panels with slightly different signatures.
//
// All consumers should import from here. Don't add another local copy.

import { MS_PER_SECOND, MS_PER_MINUTE, MS_PER_HOUR, MS_PER_DAY, BYTES_PER_KB, BYTES_PER_MB, BYTES_PER_GB } from '../constants/units';

const EM_DASH = '—';

export type DateLike = string | number | Date | null | undefined;

export interface FormatDateOptions {
    /** Also render hh:mm after the date. */
    withTime?: boolean;
    /** BCP-47 locale identifier; defaults to en-GB. */
    locale?: string;
}

export interface FormatTimeOptions {
    /** Render seconds in addition to hh:mm. */
    withSeconds?: boolean;
    /** BCP-47 locale identifier; defaults to en-GB. */
    locale?: string;
}

/**
 * Format an ISO/parsable date string for compact display.
 * Returns the source string unchanged on parse failure (never throws).
 */
export function formatDate(input: DateLike, opts: FormatDateOptions = {}): string {
    if (input == null || input === '') return EM_DASH;
    const { withTime = false, locale = 'en-GB' } = opts;
    try {
        const d = input instanceof Date ? input : new Date(input);
        if (Number.isNaN(d.getTime())) return String(input);
        const dateStr = d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
        if (!withTime) return dateStr;
        const timeStr = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
        return `${dateStr} ${timeStr}`;
    } catch {
        return String(input);
    }
}

/** Format clock time (hh:mm or hh:mm:ss). Returns em-dash on bad input. */
export function formatTime(input: DateLike, opts: FormatTimeOptions = {}): string {
    if (input == null || input === '') return EM_DASH;
    const { withSeconds = false, locale = 'en-GB' } = opts;
    try {
        const d = input instanceof Date ? input : new Date(input);
        if (Number.isNaN(d.getTime())) return String(input);
        return d.toLocaleTimeString(locale, withSeconds
            ? { hour: '2-digit', minute: '2-digit', second: '2-digit' }
            : { hour: '2-digit', minute: '2-digit' });
    } catch {
        return String(input);
    }
}

/** Format a millisecond duration as `1h 24m`, `3m 12s`, `850ms`, etc. */
export function formatDuration(ms: number | null | undefined): string {
    if (ms == null || Number.isNaN(ms)) return EM_DASH;
    if (ms < MS_PER_SECOND) return `${Math.round(ms)}ms`;
    if (ms < MS_PER_MINUTE) return `${Math.round(ms / MS_PER_SECOND)}s`;
    if (ms < MS_PER_HOUR) {
        const m = Math.floor(ms / MS_PER_MINUTE);
        const s = Math.round((ms % MS_PER_MINUTE) / MS_PER_SECOND);
        return s ? `${m}m ${s}s` : `${m}m`;
    }
    if (ms < MS_PER_DAY) {
        const h = Math.floor(ms / MS_PER_HOUR);
        const m = Math.round((ms % MS_PER_HOUR) / MS_PER_MINUTE);
        return m ? `${h}h ${m}m` : `${h}h`;
    }
    const d = Math.floor(ms / MS_PER_DAY);
    const h = Math.round((ms % MS_PER_DAY) / MS_PER_HOUR);
    return h ? `${d}d ${h}h` : `${d}d`;
}

/** Format a byte count as `4.2 MB` / `847 KB` / `12 B`. Binary (1024) base. */
export function formatBytes(bytes: number | null | undefined): string {
    if (bytes == null || Number.isNaN(bytes)) return EM_DASH;
    if (bytes < BYTES_PER_KB) return `${bytes} B`;
    if (bytes < BYTES_PER_MB) return `${(bytes / BYTES_PER_KB).toFixed(1)} KB`;
    if (bytes < BYTES_PER_GB) return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
    return `${(bytes / BYTES_PER_GB).toFixed(2)} GB`;
}

/**
 * Format a Date for an HTML `<input type="datetime-local">`. Slices off the
 * timezone suffix so the picker shows the user's local clock.
 */
export function toLocalDatetimeInput(input: DateLike): string {
    if (input == null || input === '') return '';
    try {
        const d = input instanceof Date ? input : new Date(input);
        if (Number.isNaN(d.getTime())) return '';
        const tz = d.getTimezoneOffset() * MS_PER_MINUTE;
        return new Date(d.getTime() - tz).toISOString().slice(0, 16);
    } catch {
        return '';
    }
}

export interface FormatRelativeTimeOptions {
    /** Locale for the fallback toLocaleDateString call. */
    locale?: string;
    /** Text used for ages under a minute. Defaults to 'just now'. */
    nowLabel?: string;
}

/**
 * Fine-grained relative-time formatter:
 *   "just now" → "5m ago" → "3h ago" → "2d ago" → toLocaleDateString
 *
 * Replaces the duplicated inline implementations in VersionHistory and
 * MemoryPanel.
 */
export function formatRelativeTime(input: DateLike, opts: FormatRelativeTimeOptions = {}): string {
    if (input == null || input === '') return '';
    const { locale, nowLabel = 'just now' } = opts;
    try {
        const d = input instanceof Date ? input : new Date(input);
        if (Number.isNaN(d.getTime())) return String(input);
        const diff = Date.now() - d.getTime();
        if (diff < MS_PER_MINUTE) return nowLabel;
        if (diff < MS_PER_HOUR) return `${Math.floor(diff / MS_PER_MINUTE)}m ago`;
        if (diff < MS_PER_DAY) return `${Math.floor(diff / MS_PER_HOUR)}h ago`;
        if (diff < 7 * MS_PER_DAY) return `${Math.floor(diff / MS_PER_DAY)}d ago`;
        return d.toLocaleDateString(locale);
    } catch {
        return String(input);
    }
}

export interface FormatRelativeDateOptions {
    /** Locale for the fallback toLocaleDateString call. */
    locale?: string;
    /** When true, "Today" returns the time of day (hh:mm) instead of the word. */
    todayShowsTime?: boolean;
    /** Options forwarded to toLocaleDateString for the fallback branch. */
    fallbackOptions?: Intl.DateTimeFormatOptions;
}

/**
 * Day-grained relative-date formatter:
 *   "Today" (or current time of day) → "Yesterday" → "3d ago" → date
 *
 * Replaces the duplicated inline implementations in SearchOverlay,
 * GoogleDrivePicker, and GmailPicker.
 */
export function formatRelativeDate(input: DateLike, opts: FormatRelativeDateOptions = {}): string {
    if (input == null || input === '') return '';
    const { locale, todayShowsTime = false, fallbackOptions } = opts;
    try {
        const d = input instanceof Date ? input : new Date(input);
        if (Number.isNaN(d.getTime())) return String(input);
        const diffDays = Math.floor((Date.now() - d.getTime()) / MS_PER_DAY);
        if (diffDays <= 0) {
            return todayShowsTime
                ? d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
                : 'Today';
        }
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        return d.toLocaleDateString(locale, fallbackOptions);
    } catch {
        return String(input);
    }
}

/**
 * Collapse a verbose model identifier like
 * "anthropic/claude-sonnet-4-5-20251022" → "claude-sonnet-4-5".
 */
export function shortModel(model: string | null | undefined): string {
    if (!model || typeof model !== 'string') return EM_DASH;
    const tail = (model.includes('/') ? model.split('/').pop() : model) ?? model;
    return tail.replace(/[-_]?\d{8}$/, '').replace(/[-_]?\d{4}-\d{2}-\d{2}$/, '');
}

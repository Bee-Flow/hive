import { describe, it, expect } from 'vitest';
import { outcomeLabel, whatHappened, triggerLabel, runTitle, errorClassLabel, runIdFromText } from './runLanguage';

/**
 * The runs UI speaks in sentences, not machine words — and every status the
 * server can emit must map to SOMETHING readable, because an unmapped status
 * silently regresses to jargon.
 */
describe('outcomeLabel / whatHappened', () => {
    it('every server status reads as a plain word', () => {
        const statuses = ['success', 'error', 'failed', 'running', 'queued', 'paused', 'cancelled', 'awaiting_approval', 'awaiting_confirm', 'awaiting_form', 'skipped', 'handled_error', 'weird_future_status'];
        for (const status of statuses) {
            const label = outcomeLabel({ status });
            expect(typeof label, status).toBe('string');
            expect(label.length, status).toBeGreaterThan(0);
            expect(label, status).not.toMatch(/_/); // no snake_case leaks
            const sentence = whatHappened({ status });
            expect(sentence.en.length, status).toBeGreaterThan(0);
        }
    });

    it('a failure leads with the reason, not the word "error"', () => {
        const s = whatHappened({ status: 'error', error: 'Mailbox not connected. Extra detail here.' });
        expect(s.tone).toBe('error');
        expect(s.en).toContain('Failed — Mailbox not connected');
    });

    it('falls back to the typed error class when there is no message', () => {
        const s = whatHappened({ status: 'error', errorClass: 'timeout' });
        expect(s.en).toContain('took too long');
    });

    it('a success with absorbed failures says so', () => {
        const s = whatHappened({ status: 'success', handledErrorCount: 2 });
        expect(s.en).toBe('Finished — 2 problems handled automatically');
        expect(s.tone).toBe('warn');
    });
});

describe('triggerLabel', () => {
    it('maps every known trigger kind to a sentence', () => {
        expect(triggerLabel('schedule')).toBe('On a schedule');
        expect(triggerLabel('manual')).toBe('Started by hand');
        expect(triggerLabel('webhook')).toMatch(/another system/);
        expect(triggerLabel('dry_run')).toBe('Test run');
        expect(triggerLabel(null)).toBe('—');
        // Unknown kinds degrade to readable words, never snake_case.
        expect(triggerLabel('some_new_kind')).toBe('some new kind');
    });
});

describe('errorClassLabel', () => {
    it('names the classes it knows and stays null for the rest', () => {
        expect(errorClassLabel('auth')).toMatch(/signed in/);
        expect(errorClassLabel('unknown_class')).toBeNull();
        expect(errorClassLabel(null)).toBeNull();
    });
});

describe('runTitle', () => {
    it('names a run by WHEN it ran, flagging tests', () => {
        const t = runTitle({ startedAt: '2026-08-12T14:03:00Z', mode: 'live' }, 'en-GB');
        expect(t).toMatch(/^Run of /);
        expect(t).not.toContain('test');
        expect(runTitle({ startedAt: '2026-08-12T14:03:00Z', mode: 'dry_run' }, 'en-GB')).toMatch(/· test$/);
    });

    it('degrades to the short id only when there is no timestamp', () => {
        expect(runTitle({ id: 'run_abcdef123456' })).toBe('Run run_abcd');
    });
});

describe('runIdFromText', () => {
    it('pulls the id out of a pasted deep link', () => {
        expect(runIdFromText('https://x.example/app/studio/routines/a1?view=runs&run=run_12345abc&step=s1')).toBe('run_12345abc');
    });
    it('accepts a bare id', () => {
        expect(runIdFromText('run_12345abc')).toBe('run_12345abc');
        expect(runIdFromText('  b47ac10b-58cc  ')).toBe('b47ac10b-58cc');
    });
    it('rejects prose', () => {
        expect(runIdFromText('please open my last run')).toBeNull();
        expect(runIdFromText('')).toBeNull();
    });
});

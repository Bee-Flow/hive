/**
 * Unit tests for the BFSF-221 work-summary helpers in useChatEngine:
 *   - extractMdHeading: derives a title from workspace_update markdown
 *   - summarizeWorkItem: picks the right i18n key/params for a work item
 */
import { describe, it, expect, vi } from 'vitest';
import { extractMdHeading, summarizeWorkItem } from './useChatEngine';

describe('extractMdHeading', () => {
    it('returns the first markdown heading text', () => {
        expect(extractMdHeading('# Quarterly Report\n\nSome intro text.')).toBe('Quarterly Report');
    });

    it('finds a heading that is not on the first line and supports deeper levels', () => {
        expect(extractMdHeading('intro paragraph\n\n### Section One\nbody')).toBe('Section One');
    });

    it('returns null when there is no heading', () => {
        expect(extractMdHeading('just plain text\nwith no headings')).toBeNull();
    });

    it('returns null for null/empty input', () => {
        expect(extractMdHeading(null)).toBeNull();
        expect(extractMdHeading('')).toBeNull();
        expect(extractMdHeading(undefined)).toBeNull();
    });

    it('truncates the heading to 80 characters', () => {
        const long = 'x'.repeat(120);
        const result = extractMdHeading(`# ${long}`);
        expect(result).toHaveLength(80);
        expect(result).toBe('x'.repeat(80));
    });
});

describe('summarizeWorkItem', () => {
    const t = vi.fn((key, params) => JSON.stringify({ key, params }));

    it('uses the titled key with {title} params for a webpage', () => {
        const out = summarizeWorkItem(t, { kind: 'webpage', title: 'Landing' });
        expect(t).toHaveBeenCalledWith('chat.work_summary.webpage', { title: 'Landing' });
        expect(JSON.parse(out)).toEqual({ key: 'chat.work_summary.webpage', params: { title: 'Landing' } });
    });

    it('uses the titled key for a document', () => {
        summarizeWorkItem(t, { kind: 'document', title: 'Brief' });
        expect(t).toHaveBeenCalledWith('chat.work_summary.document', { title: 'Brief' });
    });

    it('uses the titled key for a notebook', () => {
        summarizeWorkItem(t, { kind: 'notebook', title: 'Research Notes' });
        expect(t).toHaveBeenCalledWith('chat.work_summary.notebook', { title: 'Research Notes' });
    });

    it('falls back to the *_untitled key without params when title is missing', () => {
        summarizeWorkItem(t, { kind: 'webpage', title: null });
        expect(t).toHaveBeenCalledWith('chat.work_summary.webpage_untitled', undefined);
        summarizeWorkItem(t, { kind: 'notebook' });
        expect(t).toHaveBeenCalledWith('chat.work_summary.notebook_untitled', undefined);
    });

    it('returns null for null or kindless input without calling t', () => {
        const tStrict = vi.fn();
        expect(summarizeWorkItem(tStrict, null)).toBeNull();
        expect(summarizeWorkItem(tStrict, undefined)).toBeNull();
        expect(summarizeWorkItem(tStrict, { title: 'No kind' })).toBeNull();
        expect(tStrict).not.toHaveBeenCalled();
    });
});

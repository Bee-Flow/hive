import { describe, it, expect } from 'vitest';
import { looksLikeSideEffect } from './IntegrationActionNode.jsx';

describe('looksLikeSideEffect (fallback heuristic)', () => {
    it('does NOT flag gmail_read_attachment (token "attachment" ≠ verb "attach")', () => {
        // The previous substring check matched "_attach" inside "_attachment"
        // and wrongly painted this read-only tool as a write.
        expect(looksLikeSideEffect('gmail_read_attachment')).toBe(false);
    });

    it('keeps read-only tools read-only', () => {
        expect(looksLikeSideEffect('gmail_search')).toBe(false);
        expect(looksLikeSideEffect('gmail_read')).toBe(false);
        expect(looksLikeSideEffect('gmail_list_labels')).toBe(false);
        expect(looksLikeSideEffect('nextcloud_list_trash')).toBe(false);
    });

    it('still flags real write tools by verb token', () => {
        expect(looksLikeSideEffect('gmail_compose')).toBe(true);
        expect(looksLikeSideEffect('drive_create_folder')).toBe(true);
        expect(looksLikeSideEffect('youtrack_update_issue')).toBe(true);
        expect(looksLikeSideEffect('webpage_set_metadata')).toBe(true);
    });

    it('handles empty / undefined input', () => {
        expect(looksLikeSideEffect('')).toBe(false);
        expect(looksLikeSideEffect(undefined)).toBe(false);
    });
});
